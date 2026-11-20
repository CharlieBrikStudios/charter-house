// Streets round The Print House (Charlie's video, 18 Nov: "pavements, street lamps, fresh tarmac and road markings like
// Charter House"). Fletcher Street and Wellington Street from the OpenStreetMap centre lines (roads.json): a fresh tarmac
// surface, granite kerbs, double yellow lines both sides (as the architect's CGIs), a dashed white centre line on Wellington
// Street, give-way lines where Fletcher Street meets it, and Victorian lamp posts along the far pavements. Levels come from the
// ground (1 m LiDAR). Anything that would fall inside the Print House's walled plot, Seaton House or its forecourt is left out.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeFlora } from './flora.js?v=1795176500';

const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };

export function buildPHStreets(M, roads, groundAt, { centre, radius = 85, keepOut = [], blds = [], lampHeads = [], names = /Fletcher Street|Wellington Street/, pave = false, yellows = true } = {}) {
  const group = new THREE.Group(); group.name = 'phStreets';
  const G = {}; const add = (k, g) => (G[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  const near = (x, z) => Math.hypot(x - centre[0], z - centre[1]) < radius;
  const blocked = (x, z) => keepOut.some(P => inPoly(P, x, z));
  const inBld = (x, z) => blds.some(b => b.bb && x > b.bb[0] && x < b.bb[2] && z > b.bb[1] && z < b.bb[3] && inPoly(b.p, x, z));
  for (const b of blds) if (!b.bb) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of b.p) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } b.bb = [x0, z0, x1, z1]; }
  const sel = roads.filter(r => names.test(r.n || '') && r.c.some(([x, z]) => near(x, z)));
  // junction nodes: ends shared by two or more of the streets (markings stop short of them)
  const ends = []; for (const r of roads) if (!['footway', 'path', 'steps', 'cycleway'].includes(r.k)) ends.push(r.c[0], r.c[r.c.length - 1]);
  const nodeCount = (p) => ends.filter(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5).length;
  // a strip draped on the ground: samples [{x, z, tx, tz, s}], offset from the centre line, width, lift, uv scale
  const strip = (S, off, w, lift, k, uvs = 3, test = true) => {
    let run = [];
    const flush = () => {
      if (run.length < 2) { run = []; return; }
      const pos = [], uv = [], idx = [];
      run.forEach((p, i) => {
        for (const sd of [-1, 1]) { const o = off + sd * w / 2, x = p.x - p.tz * o, z = p.z + p.tx * o; pos.push(x, groundAt(x, z) + lift, z); uv.push((o - off + w / 2) / uvs, p.s / uvs); }
        if (i < run.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      if (g.attributes.normal.getY(0) < 0) { const ix = g.index; for (let q = 0; q < ix.count; q += 3) { const t = ix.getX(q + 1); ix.setX(q + 1, ix.getX(q + 2)); ix.setX(q + 2, t); } g.computeVertexNormals(); }
      add(k, g); run = [];
    };
    for (const p of S) { const x = p.x - p.tz * off, z = p.z + p.tx * off; if (test && (blocked(x, z) || inBld(x, z))) flush(); else run.push(p); }
    flush();
  };
  const kerb = (S, off, side, me) => {   // a granite kerb: its face towards the road and a 0.15 m top
    const pos = [], idx = []; let n = 0;
    const flush = () => { if (n >= 2) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos.splice(0), 3)); g.setIndex(idx.splice(0)); g.computeVertexNormals(); add('kerb', g); } pos.length = 0; idx.length = 0; n = 0; };
    for (const p of S) {
      const x = p.x - p.tz * off, z = p.z + p.tx * off, x2 = p.x - p.tz * (off + side * 0.15), z2 = p.z + p.tx * (off + side * 0.15);
      if (blocked(x2, z2) || inBld(x2, z2) || blocked(x, z) || onOther(x, z, me)) { flush(); continue; }
      const y = groundAt(x, z);
      pos.push(x, y - 0.02, z, x, y + 0.11, z, x2, y + 0.11, z2);
      if (n > 0) { const a = (n - 1) * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      n++;
    }
    flush();
  };
  const lamp = (x, z) => {
    const gy = groundAt(x, z);
    const prof = [[0.16, 0], [0.16, 0.25], [0.11, 0.4], [0.07, 0.6], [0.06, 3.3], [0.08, 3.45], [0.05, 3.6], [0.045, 4.4], [0.07, 4.5], [0, 4.55]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12); g.translate(x, gy, z); add('post', g);
    const cage = new THREE.BoxGeometry(0.44, 0.07, 0.44); cage.translate(x, gy + 4.585, z); add('post', cage);
    const cap = new THREE.ConeGeometry(0.34, 0.32, 4); cap.rotateY(Math.PI / 4); cap.translate(x, gy + 5.33, z); add('post', cap);
    const glass = new THREE.CylinderGeometry(0.24, 0.17, 0.58, 4, 1); glass.rotateY(Math.PI / 4); glass.translate(x, gy + 4.9, z); add('glow', glass);
    lampHeads.push(new THREE.Vector3(x, gy + 4.9, z));
  };
  const lamps = [];
  // every street's centre line, smoothed and sampled every 0.5 m (kerbs, lines and lamps stay off the other streets' tarmac)
  const SM = sel.map(r => {
    const C = new THREE.CatmullRomCurve3(r.c.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const Ltot = C.getLength(), N = Math.max(4, Math.ceil(Ltot / 0.5)), all = [];
    for (let i = 0; i <= N; i++) { const t = i / N, p = C.getPointAt(t), tg = C.getTangentAt(t); all.push({ x: p.x, z: p.z, tx: tg.x, tz: tg.z, s: t * Ltot }); }
    return { r, C, Ltot, N, all, hw: r.w / 2 + 0.5 };
  });
  const onOther = (x, z, me) => SM.some(o => o !== me && o.all.some(p => Math.abs(p.x - x) < o.hw + 0.2 && Math.abs(p.z - z) < o.hw + 0.2 && Math.hypot(p.x - x, p.z - z) < o.hw + 0.1));
  // the junctions: a disc of tarmac over each mouth, where the streets' strips leave gaps
  { const seen = [];
    for (const m of SM) for (const e of [m.r.c[0], m.r.c[m.r.c.length - 1]]) {
      if (!near(e[0], e[1]) || seen.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 1)) continue;
      const meet = SM.filter(o => [o.r.c[0], o.r.c[o.r.c.length - 1]].some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 0.5)); if (meet.length < 2) continue;
      seen.push(e); const R = Math.max(...meet.map(o => o.hw)) + 1.2, g = new THREE.CircleGeometry(R, 28); g.rotateX(-Math.PI / 2);
      const pp = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i) + e[0], z = pp.getZ(i) + e[1]; pp.setXYZ(i, x, groundAt(x, z) + 0.011, z); uv.setXY(i, x / 7, z / 7); }
      g.computeVertexNormals(); add('tarmac', g);
    } }
  for (const me of SM) {
    const { r, C, Ltot, N, all, hw } = me;
    const S = all.filter(p => near(p.x, p.z)); if (S.length < 4) continue;
    const jA = nodeCount(r.c[0]) > 1, jB = nodeCount(r.c[r.c.length - 1]) > 1;
    const mk = S.filter(p => (!jA || p.s > 7) && (!jB || p.s < Ltot - 7));   // markings stop short of the junctions
    strip(S, 0, hw * 2, 0.012, 'tarmac', 7, false);
    for (const sd of [-1, 1]) {
      kerb(S, sd * hw, sd, me);
      if (yellows) for (const o of [hw - 0.3, hw - 0.45]) strip(mk, sd * o, 0.08, 0.026, 'yellow', 1);
      if (pave) strip(S, sd * (hw + 1.15), 2.0, 0.11, 'pave', 2.4);   // freshly laid flags behind the kerb (Oldham Street Lofts, Charlie 19 Nov)
    }
    if (/Wellington/.test(r.n)) { const dash = []; let run = []; for (const p of mk) { if (Math.floor(p.s / 6) % 1 === 0 && (p.s % 6) < 3) run.push(p); else if (run.length) { dash.push(run); run = []; } } if (run.length) dash.push(run); dash.forEach(d => strip(d, 0, 0.1, 0.026, 'white', 1)); }
    // give-way lines across Fletcher Street where it meets Wellington Street (double dashed, 0.2 m)
    if (/Fletcher/.test(r.n)) for (const [j, at] of [[jA, 0], [jB, Ltot]]) {
      if (!j) continue; const end = r.c[at ? r.c.length - 1 : 0]; if (!near(end[0], end[1]) || !ends.some(q => Math.hypot(q[0] - end[0], q[1] - end[1]) < 0.5 && roads.some(rr => /Wellington/.test(rr.n || '') && (rr.c[0] === q || rr.c[rr.c.length - 1] === q)))) continue;
      const t = (at ? Ltot - 4.2 : 4.2) / Ltot, p = C.getPointAt(t), tg = C.getTangentAt(t);
      for (const back of [0, 0.5]) for (let o = -r.w / 2 + 0.2; o < r.w / 2 - 0.3; o += 0.9) {
        const bx = p.x + tg.x * (at ? -back : back), bz = p.z + tg.z * (at ? -back : back);
        const g = new THREE.PlaneGeometry(0.6, 0.2); g.rotateX(-Math.PI / 2); g.rotateY(Math.atan2(tg.x, tg.z)); const cx = bx - tg.z * (o + 0.3), cz = bz + tg.x * (o + 0.3); g.translate(cx, groundAt(cx, cz) + 0.027, cz); add('white', g);
      }
    }
    // lamp posts every ~26 m on whichever pavement is clear of buildings and the Print House plot
    for (let s0 = 6; s0 < Ltot; s0 += 26) {
      const p = all[Math.min(all.length - 1, Math.round(s0 / Ltot * N))]; if (!near(p.x, p.z)) continue;
      for (const sd of [1, -1]) {
        const o = sd * (hw + 0.9), x = p.x - p.tz * o, z = p.z + p.tx * o, x2 = p.x - p.tz * sd * (hw + 2.2), z2 = p.z + p.tx * sd * (hw + 2.2);
        if (blocked(x, z) || inBld(x, z) || inBld(x2, z2) || onOther(x, z, me) || lamps.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
        lamps.push([x, z]); lamp(x, z); break;
      }
    }
  }
  const tarmac = M.asphalt.clone(); tarmac.color = new THREE.Color('#a4a6ab'); tarmac.roughness = 0.88; tarmac.polygonOffset = true; tarmac.polygonOffsetFactor = -1;
  const pv = (M.paving || M.stone).clone(); pv.color = new THREE.Color('#d9d6cf'); pv.polygonOffset = true; pv.polygonOffsetFactor = -1;
  const mats = { pave: pv, tarmac, kerb: M.kerb || M.stone, yellow: M.lineYellow, white: M.lineWhite, post: M.timberBlack || new THREE.MeshStandardMaterial({ color: '#1d1f21', roughness: 0.5, metalness: 0.4 }), glow: M.lampGlow };
  for (const [k, list] of Object.entries(G)) {
    const g = mergeGeometries(list.map(x => { if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }), false); if (!g) continue;
    const m = new THREE.Mesh(g, mats[k]); m.receiveShadow = true; m.castShadow = k === 'post' || k === 'kerb'; m.name = 'phst_' + k; group.add(m);
  }
  return group;
}

// Round the Print House (Charlie's video, 18 Nov): the mini car park across Fletcher Street gets brick piers and black gates
// so it reads as that building's own; the school playground opposite gets a play surface (its walls come from context.js);
// the garden of the flats next door (Marsland House) is planted up: hedges, trees, shrubs, flowers and flagged paths.
const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
const lineDist = (x, z, L) => { let d = 1e9; for (let i = 0; i + 1 < L.length; i++) d = Math.min(d, segDist(x, z, L[i], L[i + 1])); return d; };
export function buildPHExtras(M, groundAt, forest, SP, roads = []) {
  const group = new THREE.Group(); group.name = 'phExtras';
  const G = {}; const add = (k, g) => (G[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  const streets = roads.filter(r => /Fletcher Street|Wellington Street/.test(r.n || ''));
  const onStreet = (x, z, pad = 1.0) => streets.some(r => lineDist(x, z, r.c) < r.w / 2 + 0.5 + pad);
  // a box along a chord from A to B: s along it, y up from ground at A, t across
  const along = (A, Bq) => { const L = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), ux = (Bq[0] - A[0]) / L, uz = (Bq[1] - A[1]) / L, ang = Math.atan2(-uz, ux);
    return { L, box: (k, s0, s1, y0, y1, t0, t1) => { const g = new THREE.BoxGeometry(Math.max(0.01, s1 - s0), Math.max(0.01, y1 - y0), Math.max(0.01, t1 - t0)); g.rotateY(ang); const sc = (s0 + s1) / 2, tc = (t0 + t1) / 2; g.translate(A[0] + ux * sc - uz * tc, (y0 + y1) / 2, A[1] + uz * sc + ux * tc); add(k, g); } }; };
  // ---- the gates
  if (SP.gate_mini) {
    const A = SP.gate_mini.a, Bq = SP.gate_mini.b, C = along(A, Bq), gy = Math.min(groundAt(...A), groundAt(...Bq));
    for (const s of [0, C.L]) { C.box('brick', s - 0.3, s + 0.3, gy - 0.3, gy + 1.75, -0.3, 0.3); C.box('stone', s - 0.36, s + 0.36, gy + 1.75, gy + 1.9, -0.36, 0.36); }
    for (let s = 0.4; s < C.L - 0.35; s += 0.12) C.box('iron', s - 0.013, s + 0.013, gy + 0.08, gy + 1.55 + 0.12 * Math.sin(Math.PI * s / C.L), -0.015, 0.015);
    for (const y of [0.15, 0.85, 1.48]) C.box('iron', 0.32, C.L - 0.32, gy + y, gy + y + 0.05, -0.025, 0.025);
    C.box('iron', C.L / 2 - 0.03, C.L / 2 + 0.03, gy + 0.08, gy + 1.62, -0.03, 0.03);
    // a small plate on the pier: the flats' own parking
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
    x.fillStyle = '#1f2a24'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#efe9dc'; x.textAlign = 'center'; x.font = '700 58px Arial, sans-serif'; x.fillText('PRIVATE PARKING', 256, 112); x.font = '500 40px Arial, sans-serif'; x.fillText('Residents only', 256, 182);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    const ux = (Bq[0] - A[0]) / C.L, uz = (Bq[1] - A[1]) / C.L; pl.position.set(A[0] - uz * -0.31, gy + 1.3, A[1] + ux * -0.31); pl.rotation.y = Math.atan2(uz, -ux); group.add(pl);
  }
  // ---- St Joseph's car park closed off from Fletcher Street (Charlie, 19 Nov: "a low wall and a tree line here and a path that
  // follows it round"): a low brick wall on the line, a flagged path inside it and a row of small trees between path and bays
  if (SP.divider && SP.divider.length > 1) {
    const L = SP.divider, c = SP.dividerIn;   // c: a point inside the car park, so 'in' is known
    for (let i = 0; i + 1 < L.length; i++) {
      const A = L[i], Bq = L[i + 1], C = along(A, Bq), ux = (Bq[0] - A[0]) / C.L, uz = (Bq[1] - A[1]) / C.L;
      let nx = -uz, nz = ux; if ((c[0] - A[0]) * nx + (c[1] - A[1]) * nz < 0) { nx = -nx; nz = -nz; }
      const sgn = (nx * -uz + nz * ux) > 0 ? 1 : -1;   // which way the box frame's t runs relative to 'in'
      for (let s = 0; s < C.L; s += 2.0) {
        const s1 = Math.min(C.L, s + 2.0), mx = A[0] + ux * (s + s1) / 2, mz = A[1] + uz * (s + s1) / 2, gy = groundAt(mx, mz);
        C.box('brick', s, s1 + 0.01, gy - 0.3, gy + 0.72, -0.13, 0.13); C.box('stone', s, s1 + 0.01, gy + 0.72, gy + 0.8, -0.17, 0.17);
        const gp = groundAt(mx + nx * 1.1, mz + nz * 1.1); C.box('flags', s, s1 + 0.01, gp - 0.05, gp + 0.05, Math.min(sgn * 0.35, sgn * 1.85), Math.max(sgn * 0.35, sgn * 1.85));
      }
      for (let s = 2.2; s < C.L - 1; s += 5.5) { const x = A[0] + ux * s + nx * 2.6, z = A[1] + uz * s + nz * 2.6; forest.add(x, z, { h: 5.5 + (s % 3) * 0.4, r: 1.7, kind: 'birch', seed: Math.floor(x * 31 + z * 7), density: 0.9 }); }
    }
  }
  // ---- the playground: a green play surface with painted markings, benches along the wall
  if (SP.play && SP.play.length > 2) {
    const P = SP.play, sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))), g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, groundAt(pp.getX(i), pp.getZ(i)) + 0.04); g.computeVertexNormals(); add('play', g);
    let bi = 0, bl = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length], l = Math.hypot(q[0] - P[i][0], q[1] - P[i][1]); if (l > bl) { bl = l; bi = i; } }
    const q0 = P[bi], q1 = P[(bi + 1) % P.length], ux = (q1[0] - q0[0]) / bl, uz = (q1[1] - q0[1]) / bl;
    let cx = 0, cz = 0; for (const [x, z] of P) { cx += x; cz += z; } cx /= P.length; cz /= P.length;
    const mark = (k, geo, x, z) => { geo.rotateX(-Math.PI / 2); geo.translate(x, groundAt(x, z) + 0.055, z); add(k, geo); };
    mark('lineWhite', new THREE.RingGeometry(1.5, 1.6, 40), cx + ux * 3.5, cz + uz * 3.5);
    mark('lineYellow', new THREE.RingGeometry(0.5, 0.58, 24), cx + ux * 3.5, cz + uz * 3.5);
    for (let k = 0; k < 8; k++) { const s = -2.5 - k * 0.65, q = new THREE.PlaneGeometry(0.55, 0.55); q.rotateZ(-Math.atan2(uz, ux)); mark(k % 3 === 2 ? 'lineYellow' : 'lineWhite', q, cx + ux * s, cz + uz * s); }
  }
  // ---- the garden next door
  const GD = SP.garden;
  if (GD) {
    const inGrass = (x, z) => GD.grass.some(P => inPoly(P, x, z));
    const nearPath = (x, z, d) => GD.paths.some(L => lineDist(x, z, L) < d);
    const nearHedge = (x, z, d) => GD.hedges.some(L => lineDist(x, z, L) < d);
    // flagged paths, 1.5 m wide
    for (const L of GD.paths) for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.2) continue; const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      for (let s = 0; s < l; s += 0.9) { const s1 = Math.min(l, s + 0.9), x0 = a[0] + ux * s, z0 = a[1] + uz * s, x1 = a[0] + ux * s1, z1 = a[1] + uz * s1;
        const q = []; for (const [x, z] of [[x0 - uz * 0.75, z0 + ux * 0.75], [x0 + uz * 0.75, z0 - ux * 0.75], [x1 + uz * 0.75, z1 - ux * 0.75], [x1 - uz * 0.75, z1 + ux * 0.75]]) q.push(x, groundAt(x, z) + 0.05, z);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...q.slice(0, 3), ...q.slice(6, 9), ...q.slice(3, 6), ...q.slice(0, 3), ...q.slice(9, 12), ...q.slice(6, 9)], 3)); g.computeVertexNormals();
        if (g.attributes.normal.getY(0) < 0) { const p = g.attributes.position; for (let k = 0; k < p.count; k += 3) { const tx = p.getX(k + 1), ty = p.getY(k + 1), tz = p.getZ(k + 1); p.setXYZ(k + 1, p.getX(k + 2), p.getY(k + 2), p.getZ(k + 2)); p.setXYZ(k + 2, tx, ty, tz); } g.computeVertexNormals(); }
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0).map((_, k) => k % 2 ? 0 : 0), 2)); add('flags', g); }
    }
    if (forest) {
      // clipped hedges on the OpenStreetMap hedge lines
      let sd = 4311; const rr = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (const L of GD.hedges) for (let i = 0; i + 1 < L.length; i++) { const a = L[i], b = L[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0.4; s < l; s += 0.75) { const x = a[0] + (b[0] - a[0]) * s / l, z = a[1] + (b[1] - a[1]) * s / l; if (!onStreet(x, z, 0.3)) forest.add(x, z, { h: 1.2, r: 0.62, kind: 'hedge', seed: 8000 + Math.round(x * 7 + z * 13) }); } }
      // trees on a loose grid, clear of the paths, hedges and the street
      let k = 0; const kinds = ['birch', 'sycamore', 'birch', 'oak'];
      for (const P of GD.grass) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
        for (let x = x0 + 2.5; x < x1; x += 5.2) for (let z = z0 + 2.5; z < z1; z += 5.2) { const px = x + (rr() - 0.5) * 1.6, pz = z + (rr() - 0.5) * 1.6;
          if (!inPoly(P, px, pz) || nearPath(px, pz, 2.0) || nearHedge(px, pz, 1.6) || onStreet(px, pz, 2.5)) continue;
          const kind = kinds[k++ % kinds.length]; forest.add(px, pz, { h: kind === 'oak' ? 8.5 : kind === 'birch' ? 7.5 : 7, r: kind === 'birch' ? 2.0 : 3.0, kind, seed: 8200 + k }); } }
      // shrubs and grasses along the path edges, low enough to see over
      for (let i = 0; i < 260; i++) { const P = GD.grass[i % GD.grass.length]; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
        const px = x0 + rr() * (x1 - x0), pz = z0 + rr() * (z1 - z0); if (!inPoly(P, px, pz) || onStreet(px, pz, 0.6) || nearPath(px, pz, 0.85)) continue;
        if (!nearPath(px, pz, 2.6) && !nearHedge(px, pz, 1.4) && rr() < 0.7) continue;
        forest.add(px, pz, { h: 0.5 + rr() * 0.7, r: 0.35 + rr() * 0.3, kind: rr() < 0.55 ? 'shrub' : 'grass', seed: 8400 + i }); }
    }
    // flowers in the beds by the paths: flowering plants, not coloured balls (Charlie, 19 Nov)
    let fs = 9157; const fr = () => ((fs = (fs * 16807) % 2147483647) / 2147483647);
    const FLR = makeFlora(add, 9157);
    for (let i = 0; i < 520; i++) { const P = GD.grass[i % GD.grass.length]; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
      const px = x0 + fr() * (x1 - x0), pz = z0 + fr() * (z1 - z0); if (!inPoly(P, px, pz) || onStreet(px, pz, 0.6)) continue; const dp = Math.min(...GD.paths.map(L => lineDist(px, pz, L))); if (dp < 0.85 || dp > 1.9) continue;
      FLR.clump(px, groundAt(px, pz), pz, 0.14 + fr() * 0.08, 5 + Math.floor(fr() * 5)); }
  }
  const flags = M.paving.clone(); flags.color = new THREE.Color('#cfc6b6'); flags.side = THREE.DoubleSide;
  const mats = { brick: M.cBrickOld || M.brick, stone: M.stone, iron: M.timberBlack, play: new THREE.MeshStandardMaterial({ color: '#3f6b4c', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), lineWhite: M.lineWhite, lineYellow: M.lineYellow, flags };
  for (const [k, list] of Object.entries(G)) {
    const g = mergeGeometries(list.map(x => { if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); if (!x.attributes.normal) x.computeVertexNormals(); return x; }), false); if (!g) continue;
    const mat = mats[k] || M[k];
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = ['brick', 'stone', 'iron'].includes(k); m.name = 'phx_' + k; group.add(m);
  }
  return group;
}
