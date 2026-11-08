#!/bin/bash
# Charter House: Gaussian-splat 3D photo scans of Stockport streets from Charlie's iPhone footage, on a RunPod GPU pod.
# The pod runs this on boot (image ghcr.io/nerfstudio-project/nerfstudio). For each job it pulls the clips and stills from a shared
# Google Drive folder, sorts them into places by their GPS (one scan per place: a folder can hold the Underbank, the Print House
# and Underbank Lofts at once), takes frames, solves the camera path (COLMAP), trains the splat (nerfstudio splatfacto), compresses
# it (PlayCanvas splat-transform) and pushes the result plus a running progress log to this branch (splat-job) with the
# github_token RunPod secret, so Claude can fetch it from GitHub. Then it watches splat/queue.txt on the branch ("<job> <drive url>"
# per line) for more jobs, so a second folder (Churchgate) can follow without a new pod. Claude stops the pod when it's all done.
# env: DRIVE_URL + JOB (the first job; optional), GH_TOKEN, FPS (frames per second per clip, default 2), ITERS (training steps,
#      default 30000), METHOD (splatfacto | splatfacto-big), RADIUS (metres: clips further apart are different places, default 90)
set -u
FPS=${FPS:-2}; ITERS=${ITERS:-30000}; METHOD=${METHOD:-splatfacto}; RADIUS=${RADIUS:-90}
# the nerfstudio image may run as a non-root user: work in /workspace if we can make it ours, else in the home folder
SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo -n"
WS=/workspace; { mkdir -p $WS && [ -w $WS ]; } 2>/dev/null || { $SUDO mkdir -p $WS && $SUDO chown "$(id -u)" $WS; } 2>/dev/null
[ -w $WS ] || WS=$HOME/workspace; mkdir -p $WS; cd $WS
export PATH=$HOME/.local/bin:$PATH
# the nerfstudio image is lean (no git, no curl): install what the job needs
echo "env: uid $(id -u), $(python3 --version 2>&1), pip $(python3 -m pip --version 2>&1 | cut -c1-40), apt $(command -v apt-get), sudo $(command -v sudo), git $(command -v git)"
if ! command -v git >/dev/null; then
  (export DEBIAN_FRONTEND=noninteractive; $SUDO apt-get update -qq && $SUDO apt-get install -y -qq git xz-utils ca-certificates) >/tmp/apt.log 2>&1 || { echo "apt failed:"; tail -5 /tmp/apt.log; }
fi
command -v git >/dev/null || { echo "no git: giving up"; sleep infinity; }
git config --global user.email "charlie@brik-studios.com"; git config --global user.name "Charlie Baxter (RunPod splat job)"
[ -d io ] || git clone -q --depth 1 -b splat-job "https://x-access-token:${GH_TOKEN}@github.com/CharlieBrikStudios/charter-house.git" io
push() { (cd io && git add -A splat && git commit -qm "$1" && git pull -q --rebase origin splat-job && git push -q origin splat-job) >/dev/null 2>&1 || echo "push failed"; }
say() { local J=$1; shift; mkdir -p io/splat/$J; echo "$(date -u +%FT%TZ) $*" | tee -a io/splat/$J/progress.log; push "splat $J: $*"; }
python3 -m pip install -q gdown pillow-heif >/tmp/pip.log 2>&1 || python3 -m pip install -q --user gdown pillow-heif >>/tmp/pip.log 2>&1 || { echo "pip failed:"; tail -5 /tmp/pip.log; }
# pycolmap 4 (COLMAP with GLOMAP's global mapper) for the camera solve: --no-deps so it can't move the image's numpy under torch
python3 -m pip install -q --no-deps pycolmap==4.2.1 >>/tmp/pip.log 2>&1
SFMPY=$(python3 -c "import pycolmap;print(int(pycolmap.__version__.split('.')[0]) >= 4)" 2>/dev/null)
echo "pycolmap 4: ${SFMPY:-no}"
# node for the web compression (a plain binary download: no root needed)
# (the image has no curl: python downloads it)
command -v npx >/dev/null || { python3 -c "import urllib.request;urllib.request.urlretrieve('https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.gz','/tmp/node.tgz')" && tar -xzf /tmp/node.tgz -C $HOME && export PATH=$HOME/node-v20.18.0-linux-x64/bin:$PATH; }
# is the GPU usable from this container? (a community host gave "CUDA error: unknown error" to COLMAP on 8 Nov)
CUDAOK=$(python3 -c "import torch;x=torch.ones(64,device='cuda');print('ok', torch.version.cuda, torch.cuda.get_device_name(0), float(x.sum()))" 2>&1 | tail -1)
echo "torch: $CUDAOK"
# iPhone clips are usually HDR (HLG): tone-map them to ordinary video colours so the scan isn't washed out (plain extract if that fails)
TM="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# ------------------------------------------------------------------ one place: frames -> camera solve -> splat -> web file
# 8 Nov, second go: the first solve (nerfstudio's ns-process-data) put every frame on ONE camera, so portrait and landscape clips,
# the 0.5x lens and the stills fought over one set of lens values, matched each frame only with its neighbours (so separate clips
# never joined up), ran 96 threads on 9 CPUs (45 minutes) and placed 21% of the frames. Now COLMAP is run directly: one camera per
# clip (and per still size), every frame matched against every other (up to 450 frames), threads to match the CPUs, and the
# biggest joined-up model is the one trained.
ncpu() { python3 -c "
try:
    q, p = open('/sys/fs/cgroup/cpu.max').read().split()[:2]; n = int(q) // int(p) if q != 'max' else 0
except Exception: n = 0
import os; n = n or len(os.sched_getaffinity(0)); print(max(2, min(16, n)))"; }
colmap_solve() {   # $1 database, $2 images, $3 sparse dir, $4 matcher, $5 use_gpu (1/0), $6 threads, $7 log
  colmap feature_extractor --database_path $1 --image_path $2 --ImageReader.single_camera_per_folder 1 --ImageReader.camera_model OPENCV \
    --SiftExtraction.use_gpu $5 --SiftExtraction.num_threads $6 >> $7 2>&1 || return 1
  if [ $4 = exhaustive ]; then colmap exhaustive_matcher --database_path $1 --SiftMatching.use_gpu $5 --SiftMatching.num_threads $6 >> $7 2>&1 || return 1
  else colmap sequential_matcher --database_path $1 --SiftMatching.use_gpu $5 --SiftMatching.num_threads $6 --SequentialMatching.overlap 25 >> $7 2>&1 || return 1; fi
  colmap mapper --database_path $1 --image_path $2 --output_path $3 --Mapper.num_threads $6 --Mapper.ba_global_function_tolerance 1e-6 >> $7 2>&1
}
run_group() {
  local J=$1 G=$2 W=$WS/$1 D=$WS/$1/$2
  rm -rf $D; mkdir -p $D/data/images io/splat/$J/$G   # (a restart starts the place again: never prune frames twice)
  local I=$D/data/images i=0 SC="scale=1600:1600:force_original_aspect_ratio=decrease"
  while IFS= read -r f; do
    i=$((i + 1)); local c=c$(printf %02d $i); mkdir -p $I/$c; local o="$I/$c/${c}_%05d.jpg"
    local trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$f" 2>/dev/null)
    local f35=$(ffprobe -v error -show_entries format_tags -of json "$f" 2>/dev/null | python3 -c "import sys,json;t=json.load(sys.stdin).get('format',{}).get('tags',{});print(next((v for k,v in t.items() if 'focal_length.35mm' in k.lower()),''))" 2>/dev/null)
    echo "$c ${f35:-}" >> $D/lens.txt
    if [ "$trc" = arib-std-b67 ] || [ "$trc" = smpte2084 ]; then
      ffmpeg -nostdin -loglevel error -i "$f" -vf "fps=$((FPS * 2)),$TM,$SC" -q:v 2 "$o" || ffmpeg -nostdin -loglevel error -y -i "$f" -vf "fps=$((FPS * 2)),$SC" -q:v 2 "$o"
    else
      ffmpeg -nostdin -loglevel error -i "$f" -vf "fps=$((FPS * 2)),$SC" -q:v 2 "$o"
    fi
  done < <(python3 -c "import json;print('\\n'.join(x for x in json.load(open('$W/groups.json'))['$G']['files'] if x.lower().endswith(('.mov','.mp4','.m4v'))))")
  python3 - "$W/groups.json" "$G" "$I" <<'EOF'
# keep the sharper frame of each consecutive pair in each clip (variance of the Laplacian); the stills go in a folder per picture
# size (one camera each), 1600 px on the long side
import sys, os, glob, json, cv2
from PIL import Image, ImageOps
try:
    from pillow_heif import register_heif_opener; register_heif_opener()
except Exception as e: print('no heif', e)
groups, G, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
drop = 0
for d in sorted(glob.glob(os.path.join(out, 'c*'))):
    fs = sorted(glob.glob(os.path.join(d, '*.jpg')))
    for a, b in zip(fs[0::2], fs[1::2]):
        va = cv2.Laplacian(cv2.imread(a, 0), cv2.CV_64F).var(); vb = cv2.Laplacian(cv2.imread(b, 0), cv2.CV_64F).var()
        os.remove(b if va >= vb else a); drop += 1
    if not os.listdir(d): os.rmdir(d)
n = 0
for f in groups[G]['files']:
    if not f.lower().endswith(('.heic', '.heif', '.jpg', '.jpeg', '.png')): continue
    try:
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB'); w, h = im.size; s = 1600 / max(w, h)
        if s < 1: im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        sd = os.path.join(out, 'p_%dx%d' % im.size); os.makedirs(sd, exist_ok=True)
        im.save(os.path.join(sd, 'p_%03d.jpg' % n), quality=92); n += 1
    except Exception as e: print('skip', f, e)
print('dropped', drop, 'stills', n)
EOF
  local NF=$(find $I -name '*.jpg' | wc -l) NS=$(find $I -path '*/p_*' -name '*.jpg' | wc -l)
  say $J "$G: $NF frames ($NS stills) in $(ls $I | wc -l) folders"
  [ $NF -lt 25 ] && { say $J "$G: skipped, too few frames for a scan"; return; }
  local NT=$(ncpu) MM=${MATCH:-}; [ -n "$MM" ] || { [ $NF -le 450 ] && MM=exhaustive || MM=sequential; }
  # a progress line every 10 minutes while the long steps run, so they can be followed from outside the pod
  ( while sleep 600; do say $J "$G: ... $(tail -c 3000 $D/colmap.log $D/train.log 2>/dev/null | tr '\r' '\n' | grep -v '^\s*$' | tail -1 | cut -c1-140)"; done ) & local WP=$!
  local C=$D/data/colmap; mkdir -p $C/sparse; : > $D/colmap.log
  if [ "$SFMPY" = True ]; then   # global SfM (pipeline/sfm.py): minutes, not the incremental mapper's hour
    python3 -c "import json;print(json.dumps({l.split()[0]: {'f35': l.split()[1]} for l in open('$D/lens.txt') if len(l.split()) > 1}))" > $D/lens.json 2>/dev/null
    say $J "$G: camera solve (global, $NT threads; lenses: $(awk 'NF > 1 {printf "%s=%smm ", $1, $2}' $D/lens.txt 2>/dev/null))"
    python3 io/pipeline/sfm.py $D/data $NT $D/lens.json > $D/colmap.log 2>&1
    tail -c 30000 $D/colmap.log > io/splat/$J/$G/colmap_tail.log
    say $J "$G: camera solve: $(grep '^SFM' $D/colmap.log | tail -1 | cut -c1-300)"
    grep -q '^SFM [gi]' $D/colmap.log || rm -f $D/data/transforms.json
  fi
  if [ ! -f $D/data/transforms.json ]; then   # COLMAP 3.8's incremental mapper (the image's own)
  rm -rf $C; mkdir -p $C/sparse
  say $J "$G: camera solve ($MM matching, $NT threads)"
  if ! colmap_solve $C/database.db $I $C/sparse $MM 1 $NT $D/colmap.log || [ -z "$(ls $C/sparse)" ]; then
    if grep -qiE "cuda|gpu" $D/colmap.log; then   # COLMAP's own CUDA can fail where torch works: do it on the CPUs
      say $J "$G: COLMAP can't use the GPU here, solving on the CPUs instead"; rm -rf $C; mkdir -p $C/sparse
      colmap_solve $C/database.db $I $C/sparse $MM 0 $NT $D/colmap.log
    fi
  fi
  tail -c 30000 $D/colmap.log > io/splat/$J/$G/colmap_tail.log
  local BM=$(python3 - $C/sparse <<'EOF'
import sys, os, struct
d = sys.argv[1]; best = None; sizes = []
for m in sorted((x for x in os.listdir(d) if x.isdigit()), key=int):
    p = os.path.join(d, m, 'images.bin')
    if not os.path.exists(p): continue
    n = struct.unpack('<Q', open(p, 'rb').read(8))[0]; sizes.append('%s:%d' % (m, n))
    if best is None or n > best[1]: best = (m, n)
print((best[0] if best else 'none') + ' ' + ' '.join(sizes))
EOF
)
  say $J "$G: camera solve: models (model:frames) ${BM#* } of $NF frames; training model ${BM%% *}"
  [ "${BM%% *}" != none ] && python3 - "$C/sparse/${BM%% *}" "$D/data" > $D/tojson.log 2>&1 <<'EOF'
# nerfstudio's own COLMAP -> transforms.json (with the starting point cloud); then make sure every frame carries its own camera's
# lens values when there is more than one camera (older nerfstudio wrote camera 1 for everyone)
import sys, json
from pathlib import Path
from nerfstudio.process_data.colmap_utils import colmap_to_json, parse_colmap_camera_params
from nerfstudio.data.utils.colmap_parsing_utils import read_cameras_binary, read_images_binary
rec, out = Path(sys.argv[1]), Path(sys.argv[2])
n = colmap_to_json(recon_dir=rec, output_dir=out); print('frames', n)
cams, ims = read_cameras_binary(rec / 'cameras.bin'), read_images_binary(rec / 'images.bin')
T = json.load(open(out / 'transforms.json'))
cids = {im.camera_id for im in ims.values()}
print('cameras used', len(cids))
if len(cids) > 1:
    for k in ('fl_x', 'fl_y', 'cx', 'cy', 'w', 'h', 'k1', 'k2', 'k3', 'k4', 'p1', 'p2'): T.pop(k, None)
    T.setdefault('camera_model', 'OPENCV')
    for fr in T['frames']:
        fr.update({k: v for k, v in parse_colmap_camera_params(cams[ims[fr['colmap_im_id']].camera_id]).items() if k != 'camera_model'})
    json.dump(T, open(out / 'transforms.json', 'w'), indent=2)
print('ok', len(T['frames']), 'ply', T.get('ply_file_path'))
EOF
fi
  cp $D/tojson.log io/splat/$J/$G/ 2>/dev/null
  [ -f $D/data/transforms.json ] || { kill $WP 2>/dev/null; say $J "$G: FAILED camera solve (colmap_tail.log pushed)"; return; }
  ns-train $METHOD --data $D/data --output-dir $D/outputs --max-num-iterations $ITERS --viewer.quit-on-train-completion True \
    --pipeline.model.cull-alpha-thresh 0.005 nerfstudio-data --downscale-factor 1 > $D/train.log 2>&1
  kill $WP 2>/dev/null
  local CFG=$(find $D/outputs -name config.yml | head -1)
  [ -n "$CFG" ] || { tail -60 $D/train.log > io/splat/$J/$G/train_tail.log; say $J "$G: FAILED training (log pushed)"; return; }
  ns-export gaussian-splat --load-config "$CFG" --output-dir $D/export > $D/export.log 2>&1
  local PLY=$(find $D/export -name '*.ply' | head -1)
  [ -n "$PLY" ] || { tail -40 $D/export.log > io/splat/$J/$G/export_tail.log; say $J "$G: FAILED export (log pushed)"; return; }
  say $J "$G: trained ($ITERS steps), exported $(du -h "$PLY" | cut -f1)"
  # compress for the web (PlayCanvas SOG, ~15x smaller; compressed PLY if this version can't write SOG)
  # (SOG's palette step wants WebGPU, which node doesn't have here: -g cpu)
  npx -y @playcanvas/splat-transform -w "$PLY" -N $D/$G.sog -g cpu > $D/compress.log 2>&1 || npx -y @playcanvas/splat-transform -w "$PLY" $D/$G.compressed.ply >> $D/compress.log 2>&1
  local OUT=$(ls $D/$G.sog $D/$G.compressed.ply 2>/dev/null | head -1)
  [ -n "$OUT" ] || { tail -30 $D/compress.log > io/splat/$J/$G/compress_tail.log; OUT=$PLY; }
  cp $D/data/transforms.json io/splat/$J/$G/ 2>/dev/null
  find $D/outputs -name dataparser_transforms.json -exec cp {} io/splat/$J/$G/ \;
  # GitHub takes files under 100 MB: split bigger ones into 90 MB parts (the viewer joins them)
  if [ $(stat -c %s "$OUT") -gt 94000000 ]; then split -b 90m -d "$OUT" io/splat/$J/$G/$(basename "$OUT").part; else cp "$OUT" io/splat/$J/$G/; fi
  say $J "$G: DONE $(basename "$OUT") $(du -h "$OUT" | cut -f1)"
}

# ------------------------------------------------------------------ one job: a Drive folder, sorted into places
run_job() {
  local J=$1 URL=$2 W=$WS/$1
  mkdir -p $W/raw; say $J "pod up on $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1); $(nproc) cpus; job $J; torch: $CUDAOK"
  case "$CUDAOK" in ok*) ;; *) say $J "FAILED: the GPU isn't usable from this container (needs another host)"; return ;; esac
  python3 -m gdown -q --folder "$URL" -O $W/raw --remaining-ok > $W/gdown.log 2>&1
  local NV=$(find $W/raw -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) | wc -l) NP=$(find $W/raw -type f \( -iname '*.heic' -o -iname '*.jpg' -o -iname '*.jpeg' \) | wc -l)
  [ $((NV + NP)) -gt 0 ] || { tail -20 $W/gdown.log > io/splat/$J/gdown_tail.log; say $J "FAILED: could not download the Drive folder (shared as anyone with the link?)"; touch io/splat/$J/DONE; push "splat $J: gave up"; return; }
  say $J "DOWNLOADED $NV clips and $NP stills, $(du -sh $W/raw | cut -f1): the Drive copies can go now"
  python3 - "$W/raw" "$W/groups.json" "$RADIUS" <<'EOF'
# sort the files into places by GPS (QuickTime ISO6709 tag on the clips, EXIF on the stills); files with no GPS join the place of
# the nearest-numbered file that has one (iPhone numbers run in shooting order)
import sys, os, glob, json, re, math, subprocess
from PIL import Image
try:
    from pillow_heif import register_heif_opener; register_heif_opener()
except Exception: pass
raw, out, R = sys.argv[1], sys.argv[2], float(sys.argv[3])
files = sorted(f for f in glob.glob(os.path.join(raw, '**', '*'), recursive=True) if f.lower().endswith(('.mov', '.mp4', '.m4v', '.heic', '.heif', '.jpg', '.jpeg')))
def gps(f):
    try:
        if f.lower().endswith(('.mov', '.mp4', '.m4v')):
            t = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format_tags', '-of', 'json', f], capture_output=True, text=True).stdout or '{}')
            tags = {k.lower(): v for k, v in t.get('format', {}).get('tags', {}).items()}
            s = tags.get('com.apple.quicktime.location.iso6709') or tags.get('location') or ''
            m = re.match(r'([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)', s)
            return (float(m.group(1)), float(m.group(2))) if m else None
        g = Image.open(f).getexif().get_ifd(0x8825)
        if 2 not in g or 4 not in g: return None
        dms = lambda v: float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
        return (dms(g[2]) * (-1 if g.get(1) == 'S' else 1), dms(g[4]) * (-1 if g.get(3) == 'W' else 1))
    except Exception as e:
        print('gps?', f, e); return None
num = lambda f: int((re.findall(r'(\d+)', os.path.basename(f)) or ['0'])[-1])
dist = lambda a, b: math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0])))
pts = {f: gps(f) for f in files}
groups = []
for f in sorted(files, key=num):
    p = pts[f]
    if p is None: continue
    g = next((g for g in groups if dist(g['c'], p) <= R), None)
    if g is None: g = {'c': p, 'pts': [], 'files': []}; groups.append(g)
    g['pts'].append(p); g['files'].append(f); g['c'] = (sum(q[0] for q in g['pts']) / len(g['pts']), sum(q[1] for q in g['pts']) / len(g['pts']))
withgps = [f for f in files if pts[f]]
for f in files:
    if pts[f]: continue
    if not groups: groups.append({'c': None, 'pts': [], 'files': []})
    near = min(withgps, key=lambda h: abs(num(h) - num(f))) if withgps else None
    (next(g for g in groups if near in g['files']) if near else groups[0])['files'].append(f)
res = {}
for i, g in enumerate(groups):
    vids = [f for f in g['files'] if f.lower().endswith(('.mov', '.mp4', '.m4v'))]
    if not vids and len(g['files']) < 20: print('stills-only place skipped', g['files']); continue
    nums = sorted(num(f) for f in g['files'])
    res['g%d' % (len(res) + 1)] = {'lat': g['c'][0] if g['c'] else None, 'lon': g['c'][1] if g['c'] else None, 'imgs': '%d-%d' % (nums[0], nums[-1]),
                                   'clips': len(vids), 'stills': len(g['files']) - len(vids), 'files': sorted(g['files'], key=num)}
json.dump(res, open(out, 'w'), indent=1)
print(json.dumps({k: {kk: v[kk] for kk in ('lat', 'lon', 'imgs', 'clips', 'stills')} for k, v in res.items()}))
EOF
  cp $W/groups.json io/splat/$J/groups.json 2>/dev/null
  say $J "places: $(python3 -c "import json;d=json.load(open('$W/groups.json'));print('; '.join('%s IMG_%s %d clips %d stills @ %s,%s' % (k, v['imgs'], v['clips'], v['stills'], round(v['lat'], 5) if v['lat'] else '?', round(v['lon'], 5) if v['lon'] else '?') for k, v in d.items()))")"
  for G in $(python3 -c "import json;print(' '.join(json.load(open('$W/groups.json'))))"); do run_group $J $G; done
  touch io/splat/$J/DONE; say $J "ALL DONE"
  grep -q "FAILED" io/splat/$J/progress.log || rm -rf $W/raw   # keep the pod disk free for the next job (the clips are kept if anything failed)
}

[ -n "${DRIVE_URL:-}" ] && [ ! -f io/splat/${JOB:-scan}/DONE ] && run_job "${JOB:-scan}" "$DRIVE_URL"
# then any jobs queued on the branch (splat/queue.txt: "<job> <drive folder url>" per line)
while true; do
  (cd io && git pull -q --rebase origin splat-job) >/dev/null 2>&1
  if [ -f io/splat/queue.txt ]; then
    mapfile -t Q < io/splat/queue.txt
    for line in "${Q[@]}"; do
      j=${line%% *}; u=${line#* }; [ -z "$j" ] || [ "$j" = "$u" ] && continue
      [ -f io/splat/$j/DONE ] || run_job "$j" "$u"
    done
  fi
  sleep 60
done
