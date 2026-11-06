#!/bin/bash
# Charter House: a Gaussian-splat 3D photo scan of Churchgate from Charlie's iPhone 4K footage, on a RunPod GPU pod.
# The pod runs this on boot (image ghcr.io/nerfstudio-project/nerfstudio). It pulls the clips from the shared Google Drive folder,
# takes frames, solves the camera path (COLMAP), trains the splat (nerfstudio splatfacto), compresses it (PlayCanvas splat-transform)
# and pushes the result and a running progress log to this branch (splat-job) with the github_token RunPod secret, so Claude can
# fetch it from GitHub. Then it idles: Claude stops the pod from the RunPod tools as soon as the push lands.
# env: DRIVE_URL (folder link, "anyone with the link"), GH_TOKEN, JOB (name), FPS (frames per second per clip, default 1),
#      ITERS (training steps, default 30000), METHOD (splatfacto | splatfacto-big), TEST=1 (plumbing check only)
set -u
JOB=${JOB:-churchgate}; FPS=${FPS:-1}; ITERS=${ITERS:-30000}; METHOD=${METHOD:-splatfacto}
W=/workspace/$JOB; mkdir -p $W/raw $W/frames; cd /workspace
git config --global user.email "charlie@brik-studios.com"; git config --global user.name "Charlie Baxter (RunPod splat job)"
[ -d io ] || git clone -q --depth 1 -b splat-job "https://x-access-token:${GH_TOKEN}@github.com/CharlieBrikStudios/charter-house.git" io
mkdir -p io/splat/$JOB
say() {   # progress line, pushed to GitHub so it can be followed from outside the pod
  echo "$(date -u +%FT%TZ) $*" | tee -a io/splat/$JOB/progress.log
  (cd io && git add splat/$JOB && git commit -qm "splat $JOB: $*" && git pull -q --rebase origin splat-job && git push -q origin splat-job) || echo "push failed"
}
say "pod up on $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -1); $(nproc) cpus"
if [ "${TEST:-0}" = 1 ]; then
  which ns-process-data ns-train colmap ffmpeg node 2>&1 | tr '\n' ' ' > /tmp/w; say "test: tools: $(cat /tmp/w)"
  say "test done"; sleep infinity
fi
# 1 the clips
pip install -q gdown >/dev/null 2>&1
gdown -q --folder "$DRIVE_URL" -O $W/raw --remaining-ok || { say "FAILED: could not download the Drive folder (is it shared with anyone with the link?)"; sleep infinity; }
N=$(find $W/raw -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) | wc -l)
say "downloaded $N clips, $(du -sh $W/raw | cut -f1)"
# 2 frames: FPS per clip, 1920 px wide (sharper frames are kept by skipping the blurriest of each pair)
i=0
find $W/raw -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.m4v' \) | sort | while read -r f; do
  i=$((i + 1))
  ffmpeg -loglevel error -i "$f" -vf "fps=$((FPS * 2)),scale=1920:-2" -q:v 2 "$W/frames/c$(printf %02d $i)_%05d.jpg"
done
python3 - "$W/frames" <<'EOF'
# keep the sharper frame of each consecutive pair (variance of the Laplacian)
import sys, os, glob, cv2
fs = sorted(glob.glob(os.path.join(sys.argv[1], '*.jpg'))); drop = 0
for a, b in zip(fs[0::2], fs[1::2]):
    if a.split('_')[0] != b.split('_')[0]: continue
    va = cv2.Laplacian(cv2.imread(a, 0), cv2.CV_64F).var(); vb = cv2.Laplacian(cv2.imread(b, 0), cv2.CV_64F).var()
    os.remove(b if va >= vb else a); drop += 1
print('dropped', drop)
EOF
say "frames: $(ls $W/frames | wc -l)"
# 3 camera solve (COLMAP, GPU SIFT, vocabulary-tree matching across clips)
ns-process-data images --data $W/frames --output-dir $W/data --matching-method vocab_tree --num-downscales 2 > $W/colmap.log 2>&1
say "camera solve: $(grep -iE 'colmap found poses|matched' $W/colmap.log | tail -1)"
[ -f $W/data/transforms.json ] || { say "FAILED: camera solve (see colmap.log)"; cp $W/colmap.log io/splat/$JOB/ ; say "log pushed"; sleep infinity; }
# 4 train
ns-train $METHOD --data $W/data --output-dir $W/outputs --max-num-iterations $ITERS --viewer.quit-on-train-completion True \
  --pipeline.model.cull-alpha-thresh 0.005 > $W/train.log 2>&1
CFG=$(find $W/outputs -name config.yml | head -1)
[ -n "$CFG" ] || { say "FAILED: training (see train.log)"; tail -50 $W/train.log > io/splat/$JOB/train_tail.log; say "log pushed"; sleep infinity; }
say "trained ($ITERS steps)"
ns-export gaussian-splat --load-config "$CFG" --output-dir $W/export > $W/export.log 2>&1
PLY=$(find $W/export -name '*.ply' | head -1)
say "exported $(du -h "$PLY" | cut -f1)"
# 5 compress for the web (PlayCanvas SOG, ~15x smaller), keep the camera-to-world frame for aligning with the model
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1; apt-get install -y nodejs >/dev/null 2>&1; }
npx -y @playcanvas/splat-transform "$PLY" $W/$JOB.sog > $W/compress.log 2>&1 || npx -y @playcanvas/splat-transform "$PLY" $W/$JOB.compressed.ply >> $W/compress.log 2>&1
OUT=$(ls $W/$JOB.sog $W/$JOB.compressed.ply 2>/dev/null | head -1)
cp $W/data/transforms.json io/splat/$JOB/transforms.json 2>/dev/null; cp $W/data/dataparser_transforms.json io/splat/$JOB/ 2>/dev/null
find $W/outputs -name dataparser_transforms.json -exec cp {} io/splat/$JOB/ \;
# GitHub takes files under 100 MB: split bigger ones into 90 MB parts (the viewer joins them)
if [ $(stat -c %s "$OUT") -gt 94000000 ]; then split -b 90m -d "$OUT" io/splat/$JOB/$(basename "$OUT").part; else cp "$OUT" io/splat/$JOB/; fi
say "DONE $(basename "$OUT") $(du -h "$OUT" | cut -f1)"
sleep infinity
