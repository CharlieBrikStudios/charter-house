#!/usr/bin/env python3
"""Camera solve for one place of the Charter House street scans (run by run_splat.sh on the RunPod pod), with pycolmap 4
(COLMAP with GLOMAP's global mapper built in).

8 Nov: COLMAP 3.8's incremental mapper (in the nerfstudio image) sat for 45+ minutes on 300 phone frames and placed a fifth of
them. Global SfM solves every camera at once from the matches - minutes, and far more robust on video. This script:
  1. reads the frames in <data>/images/<folder>/ (one folder per clip; stills in p_* folders), one camera per clip (lens prior
     from the clip's 35 mm-equivalent focal length if the phone recorded it), one per still (from its EXIF)
  2. matches every frame with every other (up to 450 frames; sequential with loop closure above that)
  3. global mapping (incremental as a fallback when that places under half the frames), keeps the biggest model
  4. writes nerfstudio's transforms.json (per-frame lens values, OpenGL camera axes) and sparse_pc.ply (the starting points)
usage: sfm.py <data dir> [threads] [lens.json]   ->  prints a one-line summary starting "SFM"
"""
import json, os, sys, time
import numpy as np
import pycolmap

data = sys.argv[1]
NT = int(sys.argv[2]) if len(sys.argv) > 2 else -1
lens = json.load(open(sys.argv[3])) if len(sys.argv) > 3 and os.path.exists(sys.argv[3]) else {}
img_dir = os.path.join(data, 'images'); work = os.path.join(data, 'colmap'); os.makedirs(work, exist_ok=True)
db = os.path.join(work, 'database.db')
if os.path.exists(db): os.remove(db)
t0 = time.time()
log = lambda *a: print('%5.0fs' % (time.time() - t0), *a, flush=True)
MODEL = os.environ.get('SFM_MODEL', 'RADIAL')   # one focal length (phone lenses have square pixels): OPENCV's separate fx, fy wandered apart
dev = pycolmap.Device.cuda if getattr(pycolmap, 'has_cuda', False) else pycolmap.Device.auto

folders = sorted(d for d in os.listdir(img_dir) if os.path.isdir(os.path.join(img_dir, d)))
names = {d: sorted(d + '/' + f for f in os.listdir(os.path.join(img_dir, d)) if f.lower().endswith(('.jpg', '.jpeg', '.png'))) for d in folders}
N = sum(len(v) for v in names.values())
ext = pycolmap.FeatureExtractionOptions(); ext.num_threads = NT; ext.sift.max_num_features = 8192; ext.max_image_size = 1600
from PIL import Image
no_prior = []
for d in folders:
    if not names[d]: continue
    ro = pycolmap.ImageReaderOptions(); ro.camera_model = MODEL
    still = d.startswith('p_')   # (stills carry their focal length in the EXIF)
    if not still:
        f35 = (lens.get(d) or {}).get('f35')
        w, h = Image.open(os.path.join(img_dir, names[d][0])).size
        if f35:   # focal in pixels = f35 * (frame diagonal / 43.27 mm): given as the camera's starting values, marked as a known prior
            f = float(f35) * np.hypot(w, h) / 43.27; ro.camera_params = ('%.2f,%.2f,%.2f,0,0' % (f, w / 2, h / 2)) if MODEL == 'RADIAL' else ('%.2f,%.2f,%.2f,%.2f,0,0,0,0' % (f, f, w / 2, h / 2))
        else: ro.default_focal_length_factor = 0.75; no_prior.append(d)
    pycolmap.extract_features(db, img_dir, image_names=names[d], camera_mode=pycolmap.CameraMode.PER_IMAGE if still else pycolmap.CameraMode.SINGLE,
                              reader_options=ro, extraction_options=ext, device=dev)
log('features', N, 'images in', len(folders), 'folders')

mo = pycolmap.FeatureMatchingOptions(); mo.num_threads = NT
if N <= 450:
    pycolmap.match_exhaustive(db, matching_options=mo, device=dev)
else:
    po = pycolmap.SequentialPairingOptions(); po.overlap = 20; po.quadratic_overlap = True
    pycolmap.match_sequential(db, matching_options=mo, pairing_options=po, device=dev)
log('matched')
if no_prior and os.environ.get('SFM_CALIB', '0') == '1':   # (off by default: on a test film it halved the frames placed)
    try: log('view graph calibration', pycolmap.calibrate_view_graph(db), 'for', ' '.join(no_prior))
    except Exception as e: log('view graph calibration failed:', e)

def biggest(recs):
    recs = list((recs or {}).values()); return max(recs, key=lambda r: r.num_reg_images()) if recs else None
gp = pycolmap.GlobalPipelineOptions(); gp.num_threads = NT
out_g = os.path.join(work, 'global'); os.makedirs(out_g, exist_ok=True)
try:
    rec = biggest(pycolmap.global_mapping(db, img_dir, out_g, options=gp)); how = 'global'
except Exception as e:
    log('global mapping failed:', e); rec, how = None, 'global failed'
log(how, rec.num_reg_images() if rec else 0)
if rec is None or rec.num_reg_images() < 0.5 * N:
    ip = pycolmap.IncrementalPipelineOptions(); ip.num_threads = NT; ip.max_runtime_seconds = 2400; ip.ba_global_function_tolerance = 1e-6
    out_i = os.path.join(work, 'incremental'); os.makedirs(out_i, exist_ok=True)
    try:
        r2 = biggest(pycolmap.incremental_mapping(db, img_dir, out_i, options=ip))
        log('incremental', r2.num_reg_images() if r2 else 0)
        if r2 and (rec is None or r2.num_reg_images() > rec.num_reg_images()): rec, how = r2, 'incremental'
    except Exception as e:
        log('incremental mapping failed:', e)
if rec is None:
    print('SFM FAILED: no model from %d frames' % N); sys.exit(1)
os.makedirs(os.path.join(work, 'best'), exist_ok=True); rec.write(os.path.join(work, 'best'))

# ---- nerfstudio transforms.json: OpenGL camera axes (x right, y up, z back), lens values on every frame
frames = []
for iid in rec.reg_image_ids():
    im = rec.images[iid]; cam = rec.cameras[im.camera_id]
    w2c = np.eye(4); w2c[:3, :4] = im.cam_from_world().matrix()
    c2w = np.linalg.inv(w2c); c2w[:3, 1:3] *= -1
    p = list(cam.params) + [0.0] * 8
    if cam.model_name == 'OPENCV': fx, fy, cx, cy, k1, k2, p1, p2 = p[:8]
    elif cam.model_name in ('SIMPLE_RADIAL', 'RADIAL'): fx = fy = p[0]; cx, cy, k1 = p[1:4]; k2 = p[4] if cam.model_name == 'RADIAL' else 0.0; p1 = p2 = 0.0
    elif cam.model_name == 'PINHOLE': fx, fy, cx, cy = p[:4]; k1 = k2 = p1 = p2 = 0.0
    else: fx = fy = p[0]; cx, cy = p[1:3]; k1 = k2 = p1 = p2 = 0.0
    frames.append({'file_path': 'images/' + im.name, 'transform_matrix': c2w.tolist(), 'colmap_im_id': int(iid),
                   'fl_x': fx, 'fl_y': fy, 'cx': cx, 'cy': cy, 'w': cam.width, 'h': cam.height, 'k1': k1, 'k2': k2, 'p1': p1, 'p2': p2})
frames.sort(key=lambda f: f['file_path'])
pts = [(p.xyz, p.color) for p in rec.points3D.values()]
with open(os.path.join(data, 'sparse_pc.ply'), 'wb') as f:
    f.write(('ply\nformat binary_little_endian 1.0\nelement vertex %d\nproperty float x\nproperty float y\nproperty float z\n'
             'property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n' % len(pts)).encode())
    a = np.zeros(len(pts), dtype=[('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('r', 'u1'), ('g', 'u1'), ('b', 'u1')])
    if pts:
        xyz = np.array([q[0] for q in pts]); rgb = np.array([q[1] for q in pts])
        a['x'], a['y'], a['z'] = xyz[:, 0], xyz[:, 1], xyz[:, 2]; a['r'], a['g'], a['b'] = rgb[:, 0], rgb[:, 1], rgb[:, 2]
    f.write(a.tobytes())
json.dump({'camera_model': 'OPENCV', 'frames': frames, 'ply_file_path': 'sparse_pc.ply'}, open(os.path.join(data, 'transforms.json'), 'w'), indent=1)
per = {}
for fr in frames: k = fr['file_path'].split('/')[1]; per[k] = per.get(k, 0) + 1
print('SFM %s: %d of %d frames placed (%.0f%%), %d points, %.0f s; by folder %s' % (
    how, len(frames), N, 100.0 * len(frames) / max(1, N), len(pts), time.time() - t0, ' '.join('%s:%d/%d' % (k, per.get(k, 0), len(names[k])) for k in folders)))
