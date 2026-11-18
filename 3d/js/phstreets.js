// Streets round The Print House (Charlie's video, 18 Nov: "pavements, street lamps, fresh tarmac and road markings like
// Charter House"). Fletcher Street and Wellington Street from the OpenStreetMap centre lines (roads.json): a fresh tarmac
// surface, granite kerbs, double yellow lines both sides (as the architect's CGIs), a dashed white centre line on Wellington
// Street, give-way lines where Fletcher Street meets it, and Victorian lamp posts along the far pavements. Levels come from the
// ground (1 m LiDAR). Anything that would fall inside the Print House's walled plot, Seaton House or its forecourt is left out.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };

export function buildPHStreets(M, roads, groundAt, { centre, radius = 85, keepOut = [], blds = [], lampHeads = [] } = {}) {
  const group = new THREE.Group(); group.name = 'phStreets';
  const G = {}; const add = (k, g) => (G[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  const near = (x, z) => Math.hypot(x - centre[0], z - centre[1]) < radius;
  const blocked = (x, z) => keepOut.some(P => inPoly(P, x, z));
  const inBld = (x, z) => blds.some(b => b.bb && x > b.bb[0] && x < b.bb[2] && z > b.bb[1] && z < b.bb[3] && inPoly(b.p, x, z));
  for (const b of blds) if (!b.bb) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of b.p) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } b.bb = [x0, z0, x1, z1]; }
  const sel = roads.filter(r => /Fletcher Street|Wellington Street/.test(r.n || '') && r.c.some(([x, z]) => near(x, z)));
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
      for (const o of [hw - 0.3, hw - 0.45]) strip(mk, sd * o, 0.08, 0.026, 'yellow', 1);
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
  const mats = { tarmac, kerb: M.kerb || M.stone, yellow: M.lineYellow, white: M.lineWhite, post: M.timberBlack || new THREE.MeshStandardMaterial({ color: '#1d1f21', roughness: 0.5, metalness: 0.4 }), glow: M.lampGlow };
  for (const [k, list] of Object.entries(G)) {
    const g = mergeGeometries(list.map(x => { if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; }), false); if (!g) continue;
    const m = new THREE.Mesh(g, mats[k]); m.receiveShadow = true; m.castShadow = k === 'post' || k === 'kerb'; m.name = 'phst_' + k; group.add(m);
  }
  return group;
}
