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
git config --global user.email "charlie@brik-studios.com"; git config --global user.name "Charlie Baxter (RunPod splat job)"
[ -d io ] || git clone -q --depth 1 -b splat-job "https://x-access-token:${GH_TOKEN}@github.com/CharlieBrikStudios/charter-house.git" io
push() { (cd io && git add -A splat && git commit -qm "$1" && git pull -q --rebase origin splat-job && git push -q origin splat-job) >/dev/null 2>&1 || echo "push failed"; }
say() { local J=$1; shift; mkdir -p io/splat/$J; echo "$(date -u +%FT%TZ) $*" | tee -a io/splat/$J/progress.log; push "splat $J: $*"; }
pip install -q gdown pillow-heif >/dev/null 2>&1 || pip install -q --user gdown pillow-heif >/dev/null 2>&1
# node for the web compression (a plain binary download: no root needed)
# (the image has no curl: python downloads it)
command -v npx >/dev/null || { python3 -c "import urllib.request;urllib.request.urlretrieve('https://nodejs.org/dist/v20.18.0/node-v20.18.0-linux-x64.tar.gz','/tmp/node.tgz')" && tar -xzf /tmp/node.tgz -C $HOME && export PATH=$HOME/node-v20.18.0-linux-x64/bin:$PATH; }
# iPhone clips are usually HDR (HLG): tone-map them to ordinary video colours so the scan isn't washed out (plain extract if that fails)
TM="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# ------------------------------------------------------------------ one place: frames -> camera solve -> splat -> web file
run_group() {
  local J=$1 G=$2 W=$WS/$1 D=$WS/$1/$2
  mkdir -p $D/frames io/splat/$J/$G
  local i=0
  while IFS= read -r f; do
    i=$((i + 1)); local o="$D/frames/c$(printf %02d $i)_%05d.jpg"
    local trc=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_transfer -of csv=p=0 "$f" 2>/dev/null)
    if [ "$trc" = arib-std-b67 ] || [ "$trc" = smpte2084 ]; then
      ffmpeg -nostdin -loglevel error -i "$f" -vf "fps=$((FPS * 2)),$TM,scale=1920:-2" -q:v 2 "$o" || ffmpeg -nostdin -loglevel error -y -i "$f" -vf "fps=$((FPS * 2)),scale=1920:-2" -q:v 2 "$o"
    else
      ffmpeg -nostdin -loglevel error -i "$f" -vf "fps=$((FPS * 2)),scale=1920:-2" -q:v 2 "$o"
    fi
  done < <(python3 -c "import json;print('\\n'.join(x for x in json.load(open('$W/groups.json'))['$G']['files'] if x.lower().endswith(('.mov','.mp4','.m4v'))))")
  python3 - "$W/groups.json" "$G" "$D/frames" <<'EOF'
# keep the sharper frame of each consecutive pair (variance of the Laplacian); add the stills, 1920 px on the long side
import sys, os, glob, json, cv2
from PIL import Image, ImageOps
try:
    from pillow_heif import register_heif_opener; register_heif_opener()
except Exception as e: print('no heif', e)
groups, G, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
fs = sorted(glob.glob(os.path.join(out, 'c*.jpg'))); drop = 0
for a, b in zip(fs[0::2], fs[1::2]):
    if a.split('_')[0] != b.split('_')[0]: continue
    va = cv2.Laplacian(cv2.imread(a, 0), cv2.CV_64F).var(); vb = cv2.Laplacian(cv2.imread(b, 0), cv2.CV_64F).var()
    os.remove(b if va >= vb else a); drop += 1
n = 0
for f in groups[G]['files']:
    if not f.lower().endswith(('.heic', '.heif', '.jpg', '.jpeg', '.png')): continue
    try:
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB'); w, h = im.size; s = 1920 / max(w, h)
        if s < 1: im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        im.save(os.path.join(out, 'p_%03d.jpg' % n), quality=92); n += 1
    except Exception as e: print('skip', f, e)
print('dropped', drop, 'stills', n)
EOF
  local NF=$(ls $D/frames | wc -l)
  say $J "$G: $NF frames ($(ls $D/frames | grep -c '^p_') stills)"
  [ $NF -lt 25 ] && { say $J "$G: skipped, too few frames for a scan"; return; }
  local MM=vocab_tree; [ $NF -le 300 ] && MM=exhaustive
  ns-process-data images --data $D/frames --output-dir $D/data --matching-method $MM --num-downscales 2 > $D/colmap.log 2>&1
  say $J "$G: camera solve: $(grep -iE 'colmap found poses|found poses' $D/colmap.log | tail -1 | tr -d '\r' | cut -c1-160)"
  [ -f $D/data/transforms.json ] || { cp $D/colmap.log io/splat/$J/$G/; say $J "$G: FAILED camera solve (colmap.log pushed)"; return; }
  ns-train $METHOD --data $D/data --output-dir $D/outputs --max-num-iterations $ITERS --viewer.quit-on-train-completion True \
    --pipeline.model.cull-alpha-thresh 0.005 > $D/train.log 2>&1
  local CFG=$(find $D/outputs -name config.yml | head -1)
  [ -n "$CFG" ] || { tail -60 $D/train.log > io/splat/$J/$G/train_tail.log; say $J "$G: FAILED training (log pushed)"; return; }
  ns-export gaussian-splat --load-config "$CFG" --output-dir $D/export > $D/export.log 2>&1
  local PLY=$(find $D/export -name '*.ply' | head -1)
  [ -n "$PLY" ] || { tail -40 $D/export.log > io/splat/$J/$G/export_tail.log; say $J "$G: FAILED export (log pushed)"; return; }
  say $J "$G: trained ($ITERS steps), exported $(du -h "$PLY" | cut -f1)"
  # compress for the web (PlayCanvas SOG, ~15x smaller; compressed PLY if this version can't write SOG)
  npx -y @playcanvas/splat-transform "$PLY" $D/$G.sog > $D/compress.log 2>&1 || npx -y @playcanvas/splat-transform "$PLY" $D/$G.compressed.ply >> $D/compress.log 2>&1
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
  mkdir -p $W/raw; say $J "pod up on $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1); $(nproc) cpus; job $J"
  gdown -q --folder "$URL" -O $W/raw --remaining-ok > $W/gdown.log 2>&1
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
  rm -rf $W/raw   # keep the pod disk free for the next job
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
