// Entourage for the street model: people, cyclists and dogs walking the OSM pavements, in the manner of
// the figures in architectural CGIs. Every body part is one InstancedMesh shared by all figures (20 draw
// calls in all); figures are animated by rewriting instance matrices each frame (forward kinematics for
// walking and chatting, two-bone IK for riders and buggy pushers).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
function rng(seed) { let s = (seed * 2654435761 + 12345) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - Math.floor(v);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

// ------------------------------------------------------------------ reference skeleton (a 1.75 m adult, metres)
// pelvis pivot at the waist; legs hang from the hip joints, arms from the shoulders, the head from the neck base
const SK = { pivot: 0.98, hipX: 0.088, hipY: -0.09, thigh: 0.40, shin: 0.42, shX: 0.192, shY: 0.4, uarm: 0.30, farm: 0.25, neckY: 0.505 };

// gait keyframes over one stride (u = 0 at heel strike of that leg): knee flexion and foot pitch (toe up +)
function table(keys, n = 96) {
  const out = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const u = i / n; let k = 0; while (k < keys.length - 2 && keys[k + 1][0] < u) k++;
    const [u0, v0] = keys[k], [u1, v1] = keys[k + 1], t = clamp((u - u0) / (u1 - u0), 0, 1), s = t * t * (3 - 2 * t);
    out[i] = v0 + (v1 - v0) * s;
  }
  return out;
}
const THIGH = table([[0, 0.34], [0.12, 0.28], [0.3, 0.05], [0.5, -0.23], [0.58, -0.21], [0.66, -0.06], [0.74, 0.16], [0.84, 0.33], [0.92, 0.37], [1, 0.34]]);
const KNEE = table([[0, 0.06], [0.12, 0.24], [0.3, 0.1], [0.46, 0.1], [0.58, 0.42], [0.68, 0.92], [0.78, 0.62], [0.88, 0.22], [0.96, 0.06], [1, 0.06]]);
const FOOT = table([[0, 0.24], [0.09, 0.0], [0.4, 0.0], [0.52, -0.22], [0.61, -0.55], [0.7, -0.35], [0.84, 0.02], [0.95, 0.2], [1, 0.24]]);
const look = (tab, u) => { const f = frac(u) * (tab.length - 1), i = Math.floor(f), t = f - i; return tab[i] + (tab[Math.min(i + 1, tab.length - 1)] - tab[i]) * t; };

// ------------------------------------------------------------------ geometry
function smooth(g) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); g = mergeVertices(g, 1e-5); g.computeVertexNormals(); return g; }
function lathe(prof, seg, sx = 1, sz = 1) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), seg);
  g.scale(sx, 1, sz); return smooth(g);
}
function ell(rx, ry, rz, x, y, z, ws = 8, hs = 6) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return smooth(g); }
function tube(a, b, r0, r1 = r0, seg = 6, caps = false) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps); g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate(A.x, A.y, A.z); return smooth(g);
}
function paint(g, c) { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
const merge = (list) => mergeGeometries(list, false);
// a shell visible from both sides (inside faces flipped), for open shapes on a single-sided material
function twoSided(g) {
  const b = g.clone(), ix = b.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  const n = b.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return merge([g, b]);
}

// hair: a cap over the skull whose edge runs from the forehead, over the ears, down to the nape
function hairCap() {
  const nP = 12, nT = 4, pos = [], idx = [];
  const C = [0, 0.156, 0.004], RX = 0.089, RY = 0.122, RZ = 0.108;
  for (let j = 0; j <= nT; j++) for (let i = 0; i <= nP; i++) {
    const ph = (i / nP) * TAU, f = (1 - Math.cos(ph)) / 2;            // f: 0 at the front, 1 at the back
    const tMax = 1.02 + 1.1 * Math.pow(f, 1.1);
    const t = (j / nT) * tMax, puff = 1 + 0.06 * Math.cos(Math.min(t, Math.PI / 2)) + 0.025 * f;
    pos.push(C[0] + RX * Math.sin(t) * Math.sin(ph) * puff, C[1] + RY * Math.cos(t) * puff, C[2] + RZ * Math.sin(t) * Math.cos(ph) * puff);
  }
  for (let j = 0; j < nT; j++) for (let i = 0; i < nP; i++) {
    const a = j * (nP + 1) + i, b = a + 1, c = a + nP + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  return smooth(g);
}

function buildGeoms() {
  const G = {};
  // head with neck, ears and a hint of a nose (origin at the neck base)
  {
    const sk = new THREE.SphereGeometry(1, 12, 8), p = sk.attributes.position, cs = new Float32Array(p.count * 3).fill(1);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // eye sockets and mouth: a little shade so the face reads as a face up close
      if (z > 0.8 && Math.abs(y) < 0.05 && Math.abs(x) > 0.3) cs.set([0.6, 0.56, 0.56], i * 3);
      else if (z > 0.9 && y < -0.3 && y > -0.45) cs.set([0.88, 0.74, 0.72], i * 3);
      else if (z > 0.6 && y > 0.6 && y < 0.8) cs.set([0.95, 0.94, 0.94], i * 3);
      if (y < 0) { const k = Math.pow(-y, 1.5); x *= 1 - 0.26 * k; z *= z > 0 ? 1 - 0.1 * k : 1 - 0.4 * k; }
      if (z > 0) z *= 0.93;
      p.setXYZ(i, x * 0.077, y * 0.113 + 0.155, z * 0.097 + 0.012);
    }
    sk.setAttribute('color', new THREE.BufferAttribute(cs, 3));
    const neck = new THREE.CylinderGeometry(0.054, 0.061, 0.14, 7, 1, true); neck.translate(0, 0.05, -0.008);
    const nose = new THREE.ConeGeometry(0.016, 0.04, 4); nose.rotateY(Math.PI / 4); nose.scale(0.8, 1, 0.75); nose.rotateX(Math.PI / 2 + 0.35); nose.translate(0, 0.14, 0.104);
    const skin = (g) => paint(g, '#ffffff'), sm = sk; sm.deleteAttribute('uv'); sm.deleteAttribute('normal');
    const skm = mergeVertices(sm, 1e-5); skm.computeVertexNormals();
    G.head = merge([skm, skin(smooth(neck)), skin(ell(0.013, 0.029, 0.02, 0.076, 0.15, 0.004, 5, 3)), skin(ell(0.013, 0.029, 0.02, -0.076, 0.15, 0.004, 5, 3)), paint(smooth(nose), '#f4eeee')]);
  }
  G.hair = hairCap();
  G.hairLong = (() => { const g = lathe([[0, -0.34], [0.052, -0.335], [0.078, -0.3], [0.09, -0.19], [0.094, -0.08], [0.078, -0.015], [0, 0]], 9, 1, 0.62); g.translate(0, 0, -0.048); return g; })();
  // coat: chest, waist and sloping shoulders, collar round the neck (origin at the waist pivot)
  {
    const g = new THREE.LatheGeometry([[0, -0.15], [0.168, -0.15], [0.16, -0.03], [0.15, 0.1], [0.162, 0.24], [0.18, 0.35], [0.19, 0.408], [0.176, 0.444], [0.14, 0.472], [0.092, 0.502], [0.068, 0.545], [0, 0.545]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i) * 0.68;
      if (y > 0.4) y += 0.018 * Math.pow(Math.abs(x) / 0.19, 2) * clamp((y - 0.4) / 0.06, 0, 1);    // flatter shoulder line
      if (y > 0.3) z *= 1 - 0.18 * clamp((y - 0.3) / 0.12, 0, 1) * Math.pow(Math.abs(x) / 0.19, 2); // shoulders thinner front-to-back
      if (z > 0 && y > 0.15 && y < 0.42) z *= 1.06;                                                         // chest
      p.setXYZ(i, x, y, z);
    }
    G.torso = smooth(g);
  }
  G.tail = lathe([[0.222, -0.56], [0.196, -0.33], [0.172, -0.16], [0.158, -0.09], [0.146, -0.04], [0, -0.03]], 10, 1, 0.82);
  G.pelvis = lathe([[0, -0.212], [0.09, -0.206], [0.138, -0.172], [0.155, -0.11], [0.155, -0.04], [0.148, 0.03], [0, 0.06]], 8, 1, 0.67);
  G.uarm = lathe([[0, -0.318], [0.038, -0.308], [0.045, -0.2], [0.05, -0.05], [0.045, 0.012], [0, 0.032]], 6, 0.92, 1);
  G.farm = lathe([[0, -0.258], [0.035, -0.25], [0.035, -0.2], [0.042, -0.06], [0.037, 0.028], [0, 0.04]], 6);
  { const th = new THREE.SphereGeometry(1, 4, 3); th.scale(0.013, 0.03, 0.013); th.rotateX(-0.45); th.translate(0, -0.045, 0.03); const pa = new THREE.SphereGeometry(1, 6, 4); pa.scale(0.023, 0.07, 0.036); pa.rotateX(0.12); pa.translate(0, -0.066, 0.004); G.hand = merge([smooth(pa), smooth(th)]); }
  G.thigh = lathe([[0, -0.43], [0.05, -0.422], [0.058, -0.36], [0.07, -0.18], [0.079, -0.04], [0.068, 0.045], [0, 0.075]], 6, 1, 1.05);
  G.shin = lathe([[0, -0.437], [0.046, -0.43], [0.048, -0.3], [0.055, -0.1], [0.053, 0.02], [0, 0.05]], 6);
  {
    const g = new THREE.BoxGeometry(1, 1, 1, 2, 1, 2), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const n = v.clone().normalize().multiplyScalar(0.5); v.lerp(n, 0.55);
      let x = v.x * 0.094 * (v.z < 0 ? 0.88 : 1), y = v.y * 0.095 - 0.03, z = v.z * 0.255 + 0.058;
      if (y < -0.072) y = -0.072;
      if (z > 0.07 && y > -0.045) y = -0.045 + (y + 0.045) * (1 - 0.45 * clamp((z - 0.07) / 0.11, 0, 1));
      p.setXYZ(i, x, y, z);
    }
    G.shoe = smooth(g);
  }
  // tote / shopping bag held in the hand (origin at the grip)
  {
    const body = new THREE.BoxGeometry(0.075, 0.31, 0.3, 1, 2, 2); body.translate(0, -0.29, 0);
    G.bag = merge([smooth(body), tube([0, -0.135, 0.09], [0, 0.005, 0.01], 0.008, 0.008, 4), tube([0, -0.135, -0.09], [0, 0.005, -0.01], 0.008, 0.008, 4)]);
  }
  // pram: bassinet, hood, frame and wheels (origin on the ground under the handle; forward +z)
  {
    const dark = '#26272a', blk = '#111112', W = '#ffffff';
    const cot = new THREE.SphereGeometry(1, 12, 8), cp = cot.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = Math.min(cp.getY(i), 0.5); cp.setXYZ(i, cp.getX(i) * 0.22, y * 0.24 + 0.6, cp.getZ(i) * 0.37 + 0.5); }
    const hood = new THREE.SphereGeometry(0.222, 10, 5, Math.PI, Math.PI, 0, Math.PI / 2); hood.scale(1, 1.15, 1.1); hood.translate(0, 0.7, 0.4);
    const parts = [paint(smooth(cot), W), twoSided(paint(smooth(hood), W)), paint(tube([-0.22, 0.99, 0.02], [0.22, 0.99, 0.02], 0.017, 0.017, 6), blk)];
    for (const sx of [-1, 1]) {
      parts.push(paint(tube([sx * 0.21, 0.99, 0.02], [sx * 0.21, 0.13, 0.25], 0.012), dark));
      parts.push(paint(tube([sx * 0.21, 0.6, 0.12], [sx * 0.2, 0.1, 0.82], 0.011), dark));
      parts.push(paint(tube([sx * 0.2, 0.48, 0.2], [sx * 0.2, 0.48, 0.74], 0.01), dark));
      for (const [z, r] of [[0.25, 0.14], [0.82, 0.1]]) { const w = new THREE.CylinderGeometry(r, r, 0.035, 12); w.rotateZ(Math.PI / 2); w.translate(sx * 0.245, r, z); parts.push(paint(smooth(w), blk)); }
    }
    G.buggy = merge(parts);
  }
  // bicycle frame (origin on the ground under the bottom bracket; forward +z). White parts take the paint colour.
  {
    const W = '#ffffff', blk = '#151516', grey = '#77797c';
    const BB = [0, 0.28, 0], RA = [0, 0.34, -0.43], FA = [0, 0.34, 0.63], ST = [0, 0.76, -0.147], HT = [0, 0.82, 0.44], HB = [0, 0.66, 0.49], SD = [0, 0.86, -0.18];
    const parts = [tube(BB, ST, 0.017), tube(ST, HT, 0.016), tube(BB, HB, 0.019), tube(HB, HT, 0.021)];
    for (const sx of [-1, 1]) {
      parts.push(tube([sx * 0.035, 0.28, 0], [sx * 0.05, 0.34, -0.43], 0.011), tube([sx * 0.02, 0.75, -0.15], [sx * 0.05, 0.34, -0.43], 0.01));
      parts.push(tube([sx * 0.02, 0.66, 0.49], [sx * 0.045, 0.34, 0.63], 0.012));
    }
    parts.forEach(g => paint(g, W));
    parts.push(paint(tube(ST, SD, 0.013), grey), paint(tube(HT, [0, 0.95, 0.42], 0.014), grey), paint(tube([-0.27, 0.95, 0.36], [0.27, 0.95, 0.36], 0.012), grey));
    parts.push(paint(tube([0, 0.95, 0.42], [-0.22, 0.95, 0.38], 0.013), grey), paint(tube([0, 0.95, 0.42], [0.22, 0.95, 0.38], 0.013), grey));
    for (const sx of [-1, 1]) parts.push(paint(tube([sx * 0.2, 0.95, 0.365], [sx * 0.28, 0.95, 0.355], 0.02), blk));
    parts.push(paint(ell(0.07, 0.03, 0.13, 0, 0.875, -0.19, 8, 5), blk));
    { const c = new THREE.CylinderGeometry(0.1, 0.1, 0.008, 16); c.rotateZ(Math.PI / 2); c.translate(0.06, 0.28, 0); parts.push(paint(smooth(c), grey)); }
    // mudguards
    for (const [z0, a0, a1] of [[-0.43, 0.25, 1.95], [0.63, 0.4, 1.6]]) {
      const g = new THREE.TorusGeometry(0.37, 0.022, 3, 16, a1 - a0); g.rotateZ(a0); g.rotateY(Math.PI / 2); g.scale(1.6, 1, 1); g.translate(0, 0.34, z0); parts.push(paint(smooth(g), blk));
    }
    G.bike = merge(parts);
  }
  // wheel: tyre, rim, hub and spokes (axle along x)
  {
    const tyre = new THREE.TorusGeometry(0.318, 0.026, 5, 22); tyre.rotateY(Math.PI / 2); tyre.scale(0.75, 1, 1);
    const parts = [paint(smooth(tyre), '#141415'), paint(tube([-0.04, 0, 0], [0.04, 0, 0], 0.02, 0.02, 8, true), '#9a9ca0')];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; parts.push(paint(tube([(i % 2 ? 1 : -1) * 0.03, 0, 0], [0, Math.sin(a) * 0.3, Math.cos(a) * 0.3], 0.003, 0.003, 3), '#b5b7ba')); }
    G.wheel = merge(parts);
  }
  // dog (labrador-sized; origin on the ground under the body; forward +z): body, neck, head, snout, ears, tail
  {
    const body = new THREE.LatheGeometry([[0, -0.36], [0.07, -0.35], [0.115, -0.3], [0.13, -0.18], [0.128, 0.0], [0.142, 0.16], [0.135, 0.28], [0.09, 0.355], [0, 0.37]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
    body.rotateX(Math.PI / 2);
    { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { let x = p.getX(i) * 0.8, y = p.getY(i), z = p.getZ(i); if (y < 0 && z > -0.05) y *= 1 + 0.25 * clamp((z + 0.05) / 0.3, 0, 1); if (y < 0 && z < -0.05) y *= 0.85; p.setXYZ(i, x, y + 0.5, z); } }
    const W = '#ffffff', ear = '#d9d2c8';
    const parts = [paint(smooth(body), W), paint(tube([0, 0.54, 0.24], [0, 0.69, 0.4], 0.075, 0.062, 8), W), paint(ell(0.068, 0.072, 0.092, 0, 0.71, 0.44, 9, 7), W)];
    parts.push(paint(tube([0, 0.68, 0.48], [0, 0.665, 0.6], 0.043, 0.032, 7, true), W), paint(ell(0.019, 0.016, 0.014, 0, 0.675, 0.605, 6, 4), '#141212'));
    for (const sx of [-1, 1]) { const e = new THREE.SphereGeometry(1, 6, 4); e.scale(0.014, 0.058, 0.04); e.rotateZ(sx * 0.25); e.translate(sx * 0.068, 0.675, 0.42); parts.push(paint(smooth(e), ear)); }
    parts.push(paint(tube([0, 0.56, -0.33], [0, 0.66, -0.58], 0.03, 0.012, 6, true), W));
    G.dog = merge(parts);
    G.dogLeg = lathe([[0, -0.47], [0.03, -0.465], [0.034, -0.44], [0.024, -0.39], [0.026, -0.2], [0.04, -0.06], [0.045, 0.02], [0, 0.05]], 6);
  }
  // soft contact shadow
  { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); G.blob = g; }
  return G;
}

function blobTexture() {
  const N = 32, a = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const r = Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) / (N / 2), v = r >= 1 ? 0 : Math.pow(1 - r * r, 1.6);
    a.set([0, 0, 0, Math.round(255 * v)], (j * N + i) * 4);
  }
  const t = new THREE.DataTexture(a, N, N); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

// ------------------------------------------------------------------ palettes
const PAL = {
  coat: ['#1f2a44', '#b08a5a', '#5b5e3a', '#38393c', '#6b2430', '#e3d9c4', '#1d1d20', '#8c877e', '#2f4a3a', '#7d4528', '#4a6283', '#b7b5b0', '#a88a3c', '#9c6f6a', '#2b3a55', '#d9d4ca', '#54453a'],
  coatW: [1.4, 1.1, 0.9, 1.3, 0.8, 0.7, 1.3, 0.7, 0.6, 0.5, 0.6, 0.5, 0.3, 0.4, 0.8, 0.5, 0.6],
  trousers: ['#283750', '#40557a', '#1d1d20', '#38393d', '#a3916c', '#4b4d38', '#66676b', '#2a2522', '#5a6f8f'],
  trousersW: [1.5, 1.1, 1.4, 1.0, 0.5, 0.4, 0.5, 0.5, 0.6],
  skin: ['#f3d5c4', '#eac2a8', '#ddae8f', '#cb9372', '#b27858', '#8f5c40', '#704530', '#523223'],
  skinW: [0.15, 0.2, 0.18, 0.13, 0.1, 0.09, 0.08, 0.07],
  hair: ['#16120f', '#2a1e16', '#43301f', '#644530', '#5c2b1a', '#a6875b', '#806340', '#8c8884', '#bbb7b1'],
  hairW: [1.4, 1.5, 1.3, 0.9, 0.4, 0.5, 0.6, 0.4, 0.3],
  shoe: ['#19191a', '#3d291c', '#e6e5e1', '#7d7d80', '#7a4f30', '#22262f'],
  shoeW: [1.6, 0.8, 1.1, 0.5, 0.5, 0.6],
  bag: ['#d8cbad', '#202022', '#7d5233', '#2a3552', '#9e3a2e', '#cfc9bd', '#56603f'],
  hat: ['#232325', '#8a2c2c', '#4a5a6a', '#c9b28a', '#3c4a3a', '#d6d2c8'],
  dress: ['#26262c', '#6b2430', '#34466a', '#8a7a5a', '#4a3a4a', '#2f4a3a'],
  tights: ['#18181a', '#2a2420', '#3a2e2a'],
  bike: ['#1d1e20', '#d8d6d0', '#28406a', '#7a1f22', '#2f4a3a', '#8a8d90', '#b8a37a', '#1f5a6a'],
  pram: ['#2a2c30', '#3a4a5c', '#55594a', '#8b8984', '#1f2532', '#6a5a4e'],
  dogs: {
    lab: [['#d9b77a', 1.2], ['#1d1a18', 1], ['#5a3a26', 0.6]],
    spaniel: [['#6a3a22', 1], ['#c9b8a2', 0.6], ['#2a201c', 0.4]],
    terrier: [['#e9e4da', 1], ['#9a7652', 0.8], ['#26221f', 0.7], ['#b9b0a2', 0.5]],
  },
};
function pickW(R, list, w) { let t = 0; for (const x of w) t += x; let r = R() * t; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; } return list[list.length - 1]; }
const col = (hex, R, j = 0.07) => { const c = new THREE.Color(hex); const k = 1 + (R() - 0.5) * 2 * j; return c.multiplyScalar(k); };

// ------------------------------------------------------------------ paths
const CARRIAGE = { primary: 1.5, primary_link: 0.7, secondary: 1.4, tertiary: 1.3, unclassified: 1.05, residential: 0.95, living_street: 1.1, service: 0.4 };
const FOOTK = { pedestrian: 1.8, footway: 1.0, steps: 0.35, path: 0.55 };

function chainRoads(list) {
  const key = (p) => Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2);
  const ends = new Map();
  list.forEach((r, i) => { for (const e of [0, 1]) { const k = key(e ? r.c[r.c.length - 1] : r.c[0]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push([i, e]); } });
  const used = new Uint8Array(list.length), out = [];
  const extend = (pts, w, cat) => {
    for (;;) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], dl = Math.hypot(dx, dz) || 1;
      let best = null, bd = 0.75;
      for (const [j, e] of ends.get(key(b)) || []) {
        if (used[j] || list[j].cat !== cat) continue;
        const c = list[j].c, n = e ? c[c.length - 2] : c[1], ex = n[0] - b[0], ez = n[1] - b[1], el = Math.hypot(ex, ez) || 1;
        const ang = Math.acos(clamp((dx * ex + dz * ez) / (dl * el), -1, 1));
        if (ang < bd) { bd = ang; best = [j, e]; }
      }
      if (!best) return;
      used[best[0]] = 1; const c = list[best[0]].c, seq = best[1] ? c.slice().reverse() : c;
      for (let k = 1; k < seq.length; k++) pts.push(seq[k]);
      w.push(list[best[0]].w);
    }
  };
  for (let i = 0; i < list.length; i++) {
    if (used[i]) continue; used[i] = 1;
    let pts = list[i].c.slice(); const w = [list[i].w];
    extend(pts, w, list[i].cat); pts.reverse(); extend(pts, w, list[i].cat); pts.reverse();
    out.push({ c: pts, w: w.reduce((a, b) => a + b, 0) / w.length, k: list[i].k, cat: list[i].cat });
  }
  return out;
}
function offsetLine(c, d) {
  const n = c.length, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; };
  for (let i = 0; i < n; i++) {
    const n1 = i > 0 ? nrm(c[i - 1], c[i]) : null, n2 = i < n - 1 ? nrm(c[i], c[i + 1]) : null;
    let m = n1 && n2 ? [n1[0] + n2[0], n1[1] + n2[1]] : (n1 || n2); const ml = Math.hypot(m[0], m[1]) || 1; m = [m[0] / ml, m[1] / ml];
    const k = d / Math.max(0.4, m[0] * (n1 || n2)[0] + m[1] * (n1 || n2)[1]);
    out.push([c[i][0] + m[0] * k, c[i][1] + m[1] * k]);
  }
  return out;
}
function resample(c, step) {   // c: [[x,z]] or [[x,y,z]] -> [[x,y|null,z]]
  const out = [], has = c[0].length === 3;
  const P = (p) => (has ? p : [p[0], null, p[1]]);
  for (let i = 0; i < c.length - 1; i++) {
    const a = P(c[i]), b = P(c[i + 1]), L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) { const t = k / n; out.push([a[0] + (b[0] - a[0]) * t, has ? a[1] + (b[1] - a[1]) * t : null, a[2] + (b[2] - a[2]) * t]); }
  }
  out.push(P(c[c.length - 1]));
  return out;
}
function makePath(pts, type, meta) {   // pts: [[x,y,z]]
  const n = pts.length, x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n), cum = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = pts[i][0]; y[i] = pts[i][1]; z[i] = pts[i][2]; if (i) cum[i] = cum[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]); }
  return { x, y, z, cum, len: cum[n - 1], n, type, ...meta };
}
// position on a path at arc length s (h: a {seg} cursor kept by the agent), writing out {x,y,z,tx,tz}
function at(P, s, h, o) {
  s = clamp(s, 0, P.len);
  let i = clamp(h.seg | 0, 0, P.n - 2);
  while (i < P.n - 2 && P.cum[i + 1] < s) i++;
  while (i > 0 && P.cum[i] > s) i--;
  h.seg = i;
  const L = P.cum[i + 1] - P.cum[i] || 1e-6, t = (s - P.cum[i]) / L;
  o.x = P.x[i] + (P.x[i + 1] - P.x[i]) * t; o.y = P.y[i] + (P.y[i + 1] - P.y[i]) * t; o.z = P.z[i] + (P.z[i + 1] - P.z[i]) * t;
  o.tx = (P.x[i + 1] - P.x[i]) / L; o.tz = (P.z[i + 1] - P.z[i]) / L;
  return o;
}

// ------------------------------------------------------------------ the crowd
export function buildCrowd(THREE_unused, { roads = [], groundAt = () => 0, focus = [0, 0], radius = 260, extraPaths = [], blds = [], seed = 1, quality = 'high', pavementLift = 0 } = {}) {
  const R = rng(seed);
  const Q = quality === 'low' ? 0.34 : quality === 'medium' ? 0.67 : 1;
  const [fx, fz] = focus;
  const group = new THREE.Group(); group.name = 'crowd';

  // ---- building footprints in a grid for point-in-polygon tests
  const cell = 20, grid = new Map(), gk = (i, j) => i * 73856093 ^ j * 19349663;
  for (const b of blds) {
    const p = b.p || b; if (!p || p.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    if (x1 < fx - radius - 30 || x0 > fx + radius + 30 || z1 < fz - radius - 30 || z0 > fz + radius + 30) continue;
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) { const k = gk(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  }
  const inside = (x, z) => {
    const list = grid.get(gk(Math.floor(x / cell), Math.floor(z / cell))); if (!list) return false;
    for (const p of list) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } if (c) return true; }
    return false;
  };
  const near = (x, z) => Math.hypot(x - fx, z - fz);

  // ---- walkable paths: pavements both sides of carriageways, the centre of footways, plus the explicit extra paths
  const peds = [], bikes = [];
  const sel = [];
  for (const r of roads) {
    if (!r || !r.c || r.c.length < 2) continue;
    const cat = CARRIAGE[r.k] != null ? 'car' : FOOTK[r.k] != null ? 'foot' : null; if (!cat) continue;
    if (Math.min(...r.c.map(p => near(p[0], p[1]))) > radius + 20) continue;
    sel.push({ c: r.c, w: r.w || (cat === 'car' ? 6 : 2), k: r.k, cat });
  }
  // carriageway segments in a grid, so nobody is placed standing in the road
  const rgrid = new Map();
  for (const r of sel) {
    if (r.cat !== 'car') continue; const hw = r.w / 2 + 0.5;
    for (let i = 0; i < r.c.length - 1; i++) {
      const [ax, az] = r.c[i], [bx, bz] = r.c[i + 1];
      for (let ci = Math.floor((Math.min(ax, bx) - hw) / cell); ci <= Math.floor((Math.max(ax, bx) + hw) / cell); ci++)
        for (let cj = Math.floor((Math.min(az, bz) - hw) / cell); cj <= Math.floor((Math.max(az, bz) + hw) / cell); cj++) { const k = gk(ci, cj); if (!rgrid.has(k)) rgrid.set(k, []); rgrid.get(k).push([ax, az, bx, bz, hw]); }
    }
  }
  const onRoad = (x, z) => {
    for (const [ax, az, bx, bz, hw] of rgrid.get(gk(Math.floor(x / cell), Math.floor(z / cell))) || []) {
      const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < hw) return true;
    }
    return false;
  };
  const runs = (samples, type, meta, probe) => {
    // split a sampled line into runs inside the radius and clear of buildings
    const ok = samples.map((p, i) => {
      if (near(p[0], p[2]) > radius) return false;
      if (!probe) return true;
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[2] - a[2]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      return !inside(p[0], p[2]) && !inside(p[0] + tz * probe, p[2] - tx * probe) && !inside(p[0] - tz * probe, p[2] + tx * probe);
    });
    const out = []; let cur = [];
    const flush = () => { if (cur.length >= 4) out.push(makePath(cur, type, meta)); cur = []; };
    samples.forEach((p, i) => { if (ok[i]) cur.push(p); else flush(); }); flush();
    return out;
  };
  for (const r of chainRoads(sel)) {
    const kw = r.cat === 'car' ? CARRIAGE[r.k] : FOOTK[r.k];
    if (r.cat === 'car') {
      for (const sd of [1, -1]) {
        const s = resample(offsetLine(r.c, sd * (r.w / 2 + 1.2)), 1.5).map(p => [p[0], groundAt(p[0], p[2]) + pavementLift, p[2]]);
        peds.push(...runs(s, 'pave', { kw, outer: sd, lanes: 0.4 }, 0.5));
      }
      if (r.k !== 'service' && r.k !== 'living_street') {
        const s = resample(r.c, 2).map(p => [p[0], groundAt(p[0], p[2]), p[2]]);
        bikes.push(...runs(s, 'road', { kw, lane: Math.max(0.6, r.w / 2 - 0.85) }, 0).filter(p => p.len > 25));
      }
    } else {
      const s = resample(r.c, 1.5).map(p => [p[0], groundAt(p[0], p[2]), p[2]]);
      peds.push(...runs(s, 'foot', { kw, outer: 0, lanes: Math.min(1.2, Math.max(0.3, r.w / 2 - 0.4)) }, 0.35));
    }
  }
  const extras = [];
  for (const e of extraPaths) {
    if (!e || !e.pts || e.pts.length < 2) continue;
    const s = resample(e.pts.map(p => (p.length === 3 ? p : [p[0], groundAt(p[0], p[1]), p[1]])), 1.0);
    const P = makePath(s, 'extra', { kw: 1, outer: 0, lanes: 0.25, kind: e.kind || 'walk' });
    if (P.len > 2) extras.push(P);
  }

  // weighted random placement along the road paths, denser near the focus
  const flat = []; let wsum = 0;
  peds.forEach((P, pi) => { for (let i = 0; i < P.n; i++) { const d = near(P.x[i], P.z[i]); wsum += P.kw * (0.07 + 0.93 * Math.exp(-Math.pow(d / (0.3 * radius), 2))) * 1.5; flat.push(wsum, pi, P.cum[i]); } });
  const placeOnRoads = () => {
    if (!flat.length) return null;
    const r = R() * wsum; let lo = 0, hi = flat.length / 3 - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (flat[m * 3] < r) lo = m + 1; else hi = m; }
    return { P: peds[flat[lo * 3 + 1]], s: clamp(flat[lo * 3 + 2] + (R() - 0.5) * 1.5, 0, peds[flat[lo * 3 + 1]].len) };
  };

  // ---- figures
  const figs = [];
  const SL = { head: 0, hair: 0, hairLong: 0, torso: 0, tail: 0, pelvis: 0, uarm: 0, farm: 0, hand: 0, thigh: 0, shin: 0, shoe: 0, bag: 0, blob: 0 };
  const COL = {};   // part -> [slot, Color][]
  const setC = (part, slot, c) => { (COL[part] || (COL[part] = [])).push([slot, c]); };
  function makeFig(o = {}) {
    const female = o.female ?? R() < 0.5, kid = !!o.kid;
    const H = kid ? 1.1 + R() * 0.2 : female ? 1.6 + R() * 0.14 : 1.7 + R() * 0.18;
    const f = { female, kid, s: H / 1.75, bx: kid ? 0.88 : female ? 0.86 + R() * 0.05 : 0.97 + R() * 0.08, hx: female ? 1.0 + R() * 0.05 : 0.96 + R() * 0.05, bz: 0.94 + R() * 0.16, hs: kid ? 1.22 : 0.97 + R() * 0.06, seed: R() * 100 };
    f.bz *= f.bx > 1 ? 1.03 : 1;
    const skin = col(pickW(R, PAL.skin, PAL.skinW), R, 0.04);
    const old = !kid && R() < 0.16;
    let hair = col(old ? (R() < 0.5 ? PAL.hair[7] : PAL.hair[8]) : pickW(R, PAL.hair.slice(0, 7), PAL.hairW.slice(0, 7)), R, 0.06);
    const hat = !kid && R() < 0.09, bald = !female && !hat && (old ? R() < 0.4 : R() < 0.07);
    if (hat) hair = col(PAL.hat[Math.floor(R() * PAL.hat.length)], R);
    if (bald) hair = skin.clone().multiplyScalar(0.93);
    const coat = col(pickW(R, PAL.coat, PAL.coatW), R);
    const legs = col(pickW(R, PAL.trousers, PAL.trousersW), R, 0.05);
    f.hatK = hat ? 1.06 : bald ? 0.985 : 1;
    f.head = SL.head++; setC('head', f.head, skin);
    f.hair = SL.hair++; setC('hair', f.hair, hair);
    f.hairLong = -1; if (!hat && !bald && (female ? R() < 0.62 : R() < 0.04)) { f.hairLong = SL.hairLong++; setC('hairLong', f.hairLong, hair); f.hairLen = 0.75 + R() * 0.55; }
    f.torso = SL.torso++; setC('torso', f.torso, coat);
    f.pelvis = SL.pelvis++;
    // long coat, or a skirt/dress with tights
    f.tail = -1; let shinC = legs, thighC = legs;
    const r = R();
    if (!kid && r < (female ? 0.3 : 0.22)) { f.tail = SL.tail++; setC('tail', f.tail, coat); f.tailLen = 0.75 + R() * 0.45; setC('pelvis', f.pelvis, coat); }
    else if (female && !kid && r < 0.48) { const d = col(PAL.dress[Math.floor(R() * PAL.dress.length)], R); f.tail = SL.tail++; setC('tail', f.tail, d); f.tailLen = 0.74 + R() * 0.3; shinC = thighC = col(PAL.tights[Math.floor(R() * PAL.tights.length)], R, 0.03); setC('pelvis', f.pelvis, d); }
    if (!COL.pelvis || COL.pelvis[COL.pelvis.length - 1][0] !== f.pelvis) setC('pelvis', f.pelvis, legs);
    f.uarm = SL.uarm; SL.uarm += 2; f.farm = SL.farm; SL.farm += 2; f.hand = SL.hand; SL.hand += 2;
    f.thigh = SL.thigh; SL.thigh += 2; f.shin = SL.shin; SL.shin += 2; f.shoe = SL.shoe; SL.shoe += 2;
    const sleeve = coat, shoe = col(pickW(R, PAL.shoe, PAL.shoeW), R, 0.05);
    for (const k of [0, 1]) { setC('uarm', f.uarm + k, sleeve); setC('farm', f.farm + k, sleeve); setC('hand', f.hand + k, skin); setC('thigh', f.thigh + k, thighC); setC('shin', f.shin + k, shinC); setC('shoe', f.shoe + k, shoe); }
    f.bag = -1; if (o.bag) { f.bag = SL.bag++; setC('bag', f.bag, col(PAL.bag[Math.floor(R() * PAL.bag.length)], R)); f.bagSide = R() < 0.5 ? 0 : 1; }
    f.blob = SL.blob++;
    figs.push(f); return f;
  }

  const walkers = [], idlers = [], riders = [], dogs = [], prams = [];
  const newWalker = (P, s, o = {}) => {
    const kind = P.kind;
    const f = makeFig({ bag: o.bag ?? R() < 0.28, kid: o.kid, female: o.female });
    const slow = kind === 'stroll' ? 0.62 + R() * 0.3 : kind === 'walk' && P.type === 'extra' ? 0.95 + R() * 0.3 : 1.1 + R() * 0.4;
    const w = { f, P, s, dir: o.dir ?? (R() < 0.5 ? 1 : -1), speed: o.speed ?? slow, v: 0, lane: o.lane ?? (0.08 + R() * (P.lanes - 0.08)), lat: 0, yaw: 0, ph: R() * TAU, pause: 0, h: { seg: 0 }, phone: !o.kid && !o.noPhone && R() < 0.08, look: R() * 100, leader: o.leader || null, x: 0, y: 0, z: 0 };
    w.v = w.speed; w.lat = w.dir * w.lane;
    walkers.push(w); return w;
  };

  // explicit garden / walkway paths: a few slow walkers and some pairs standing chatting
  extras.forEach((P, i) => {
    const stroll = P.kind === 'stroll';
    let n = clamp(Math.round(P.len / (stroll ? 14 : 10)), 1, stroll ? 3 : 4);
    n = Math.max(i < 3 ? 1 : 0, Math.round(n * Q));
    for (let k = 0; k < n; k++) newWalker(P, R() * P.len);
    if (stroll ? R() < 0.75 * Q + 0.2 : R() < 0.35 * Q) for (let k = 0; k < 5 && !addPair(P, R() * P.len); k++);
  });
  function addPair(P, s) {
    const o = at(P, s, { seg: 0 }, {}), a = R() * TAU, d = 0.42 + R() * 0.08;
    const lat = P.type === 'pave' ? P.outer * 0.85 : (R() - 0.5) * P.lanes;
    let cx = o.x + o.tz * lat, cz = o.z - o.tx * lat;
    const pts = [[cx + Math.sin(a) * d, cz + Math.cos(a) * d], [cx - Math.sin(a) * d, cz - Math.cos(a) * d]];
    const bad = () => pts.some(([x, z]) => inside(x, z) || inside(x + 0.3, z) || inside(x - 0.3, z) || inside(x, z + 0.3) || inside(x, z - 0.3) || (P.type !== 'extra' && onRoad(x, z)));
    if (bad()) { if (P.type !== 'pave') return false; cx = o.x; cz = o.z; pts[0] = [cx + Math.sin(a) * d, cz + Math.cos(a) * d]; pts[1] = [cx - Math.sin(a) * d, cz - Math.cos(a) * d]; if (bad()) return false; }
    const n = R() < 0.25 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const ang = a + (k * TAU) / n + (n === 2 ? 0 : 0.3), x = cx + Math.sin(ang) * d, z = cz + Math.cos(ang) * d;
      const f = makeFig({ bag: R() < 0.2 });
      idlers.push({ f, x, y: o.y, z, yaw: ang + Math.PI + (R() - 0.5) * 0.3, style: Math.floor(R() * 4), t0: R() * 50, talk: R() * 10 });
    }
    return true;
  }

  // pavements and footways
  const nRoad = Math.max(0, Math.round(60 * Q) - Math.round((walkers.length + idlers.length) * 0.5));   // the extra paths' people come partly out of the road budget
  if (peds.length) {
    let made = 0;
    const nPairs = Math.round(5 * Q), nCouples = Math.round(5 * Q), nKids = Math.round(3 * Q), nPram = Math.max(1, Math.round(2 * Q)), nDogs = Math.round(10 * Q);
    for (let i = 0; i < nPairs; i++) for (let k = 0; k < 8; k++) { const p = placeOnRoads(); if (addPair(p.P, p.s)) { made += 2; break; } }
    for (let i = 0; i < nCouples + nKids; i++) {
      const p = placeOnRoads(), kid = i >= nCouples;
      const a = newWalker(p.P, p.s, { lane: Math.min(p.P.lanes, 0.3), speed: kid ? 1.05 + R() * 0.15 : 1.08 + R() * 0.2, noPhone: true });
      newWalker(p.P, p.s, { leader: a, lane: Math.min(p.P.lanes, 0.3) - 0.62, dir: a.dir, speed: a.speed, kid, noPhone: true, bag: kid ? false : undefined });
      made += 2;
    }
    for (let i = 0; i < nPram; i++) { const p = placeOnRoads(); const w = newWalker(p.P, p.s, { female: R() < 0.7, bag: false, speed: 1.0 + R() * 0.15, noPhone: true }); w.pram = prams.length; prams.push({ w, slot: i, blob: SL.blob++, col: col(PAL.pram[Math.floor(R() * PAL.pram.length)], R) }); made++; }
    const dogOwners = [];
    while (made < nRoad) { const p = placeOnRoads(); const w = newWalker(p.P, p.s); made++; if (dogOwners.length < nDogs && !w.f.kid && w.f.bag < 0 && !w.phone) dogOwners.push(w); }
    // dogs on leads beside some walkers
    for (const w of dogOwners) {
      const breed = pickW(R, ['lab', 'spaniel', 'terrier'], [1, 0.9, 1.1]);
      const [c] = pickW(R, PAL.dogs[breed], PAL.dogs[breed].map(x => x[1]));
      const ds = breed === 'lab' ? 0.95 + R() * 0.1 : breed === 'spaniel' ? 0.74 + R() * 0.06 : 0.55 + R() * 0.07, lf = breed === 'terrier' ? 0.78 : breed === 'spaniel' ? 0.9 : 1;
      w.speed = Math.min(w.speed, 1.3); w.dog = dogs.length; w.phone = false;
      dogs.push({ w, side: R() < 0.5 ? 1 : -1, s: ds, lf, c: col(c, R, 0.05), ph: R() * TAU, yaw: 0, x: 0, y: 0, z: 0, wander: R() * 100, blob: SL.blob++, hand: new THREE.Vector3() });
    }
  }
  // cyclists on the carriageway, keeping left
  if (bikes.length) {
    const nB = Math.round(8 * Q);
    let tot = 0; const cw = bikes.map(P => (tot += P.len * P.kw * (0.3 + 0.7 * Math.exp(-near(P.x[P.n >> 1], P.z[P.n >> 1]) / radius))));
    for (let i = 0; i < nB; i++) {
      const r = R() * tot; const P = bikes[Math.max(0, cw.findIndex(v => v >= r))];
      const f = makeFig({ bag: false, female: R() < 0.35 });
      riders.push({ f, P, s: R() * P.len, dir: R() < 0.5 ? 1 : -1, speed: 4 + R() * 1, v: 4.5, lat: 0, yaw: 0, crank: R() * TAU, wheel: 0, h: { seg: 0 }, slot: i, col: col(PAL.bike[Math.floor(R() * PAL.bike.length)], R), pitch: 0 });
    }
  }

  // ---- instanced meshes
  const G = buildGeoms();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  const matV = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, vertexColors: true });
  const I = {};
  const mk = (name, geo, m, n) => {
    const mesh = new THREE.InstancedMesh(geo, m, Math.max(1, n)); mesh.name = 'crowd_' + name; mesh.count = n;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.raycast = () => {};
    mesh.visible = n > 0; group.add(mesh); I[name] = mesh; return mesh;
  };
  mk('head', G.head, matV, SL.head);
  for (const k of ['hair', 'hairLong', 'torso', 'tail', 'pelvis', 'uarm', 'farm', 'hand', 'thigh', 'shin', 'shoe', 'bag']) mk(k, G[k], mat, SL[k]);
  mk('pram', G.buggy, matV, prams.length); mk('bike', G.bike, matV, riders.length); mk('wheel', G.wheel, matV, riders.length * 2);
  mk('dog', G.dog, matV, dogs.length); mk('dogLeg', G.dogLeg, mat, dogs.length * 4);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
  mk('blob', G.blob, blobMat, SL.blob); I.blob.receiveShadow = false; I.blob.renderOrder = 1;
  for (const [part, list] of Object.entries(COL)) for (const [slot, c] of list) I[part].setColorAt(slot, c);
  prams.forEach(p => I.pram.setColorAt(p.slot, p.col));
  riders.forEach(r => { I.bike.setColorAt(r.slot, r.col); I.wheel.setColorAt(r.slot * 2, new THREE.Color(1, 1, 1)); I.wheel.setColorAt(r.slot * 2 + 1, new THREE.Color(1, 1, 1)); });
  dogs.forEach((d, i) => { I.dog.setColorAt(i, d.c); for (let k = 0; k < 4; k++) I.dogLeg.setColorAt(i * 4 + k, d.c); });
  for (const m of Object.values(I)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  // leads: one line-segments object for every dog
  const SEG = 6, leadPos = new Float32Array(Math.max(1, dogs.length) * SEG * 6);
  const leadGeo = new THREE.BufferGeometry(); leadGeo.setAttribute('position', new THREE.BufferAttribute(leadPos, 3).setUsage(THREE.DynamicDrawUsage));
  leadGeo.setDrawRange(0, dogs.length * SEG * 2);
  const leads = new THREE.LineSegments(leadGeo, new THREE.LineBasicMaterial({ color: 0x1b1a1a })); leads.frustumCulled = false; leads.raycast = () => {}; leads.name = 'crowd_leads';
  if (dogs.length) group.add(leads);

  // ---- posing
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YZX'), _p = new THREE.Vector3(), _sc = new THREE.Vector3(1, 1, 1), _loc = new THREE.Matrix4(), _tmp = new THREE.Matrix4(), _sv = new THREE.Vector3();
  const Mroot = new THREE.Matrix4(), Mp = new THREE.Matrix4(), Mt = new THREE.Matrix4(), Mh = new THREE.Matrix4(), Ma = new THREE.Matrix4(), Mf = new THREE.Matrix4(), Mw = [new THREE.Matrix4(), new THREE.Matrix4()], Mth = new THREE.Matrix4(), Msh = new THREE.Matrix4(), Mft = new THREE.Matrix4();
  const jt = (out, parent, x, y, z, rx, ry, rz) => { _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _sc.set(1, 1, 1); _loc.compose(_p, _q, _sc); return out.multiplyMatrices(parent, _loc); };
  const put = (mesh, slot, m, sx = 1, sy = 1, sz = 1) => { if (slot < 0) return; if (sx === 1 && sy === 1 && sz === 1) mesh.setMatrixAt(slot, m); else mesh.setMatrixAt(slot, _tmp.copy(m).scale(_sv.set(sx, sy, sz))); };
  const rootM = (x, y, z, yaw, s, pitch = 0) => { _e.set(pitch, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _e.order = 'YZX'; _p.set(x, y, z); _sc.set(s, s, s); return Mroot.compose(_p, _q, _sc); };
  const blob = (slot, x, y, z, yaw, sx, sz) => { _e.set(0, yaw, 0); _q.setFromEuler(_e); _p.set(x, y + 0.025, z); _sc.set(sx, 1, sz); I.blob.setMatrixAt(slot, _loc.compose(_p, _q, _sc)); };
  const P = { px: 0, py: 0, lp: 0, tp: 0, rp: 0, lt: 0, tt: 0, rt: 0, hy: 0, hp: 0, hip: [0, 0], knee: [0, 0], ank: [0, 0], labd: [0, 0], sh: [0, 0], el: [0, 0], aabd: [0, 0], wr: [0, 0] };
  const drop = (hip, knee, a) => { const ca = Math.cos(a), sa = Math.sin(a); return SK.thigh * Math.cos(hip) + SK.shin * Math.cos(hip - knee) - Math.min(-0.07 * ca - 0.06 * sa, -0.055 * ca + 0.19 * sa); };

  // forward kinematics from the pose P (all limb angles already relative to their parent)
  function applyFK(f, legs = true) {
    jt(Mp, Mroot, P.px, P.py, 0, P.lp, P.tp, P.rp);
    put(I.pelvis, f.pelvis, Mp, f.hx, 1, f.hx);
    jt(Mt, Mp, 0, 0, 0, P.lt, P.tt, P.rt);
    put(I.torso, f.torso, Mt, f.bx, 1, f.bz);
    // coat skirts and skirts share the torso's axis, so the seam where they meet stays clean
    if (f.tail >= 0) put(I.tail, f.tail, Mt, Math.max(f.bx, f.hx) * 1.02, f.tailLen, Math.max(f.bz, f.hx) * 1.02);
    jt(Mh, Mt, 0, SK.neckY, 0, P.hp, P.hy, 0);
    put(I.head, f.head, Mh, f.hs, f.hs, f.hs);
    put(I.hair, f.hair, Mh, f.hs * f.hatK, f.hs * f.hatK, f.hs * f.hatK);
    if (f.hairLong >= 0) put(I.hairLong, f.hairLong, jt(Ma, Mh, 0, 0.235 * f.hs, 0, 0, 0, 0), f.hs, f.hs * f.hairLen, f.hs);
    for (let k = 0; k < 2; k++) {
      const sg = k ? -1 : 1;
      jt(Ma, Mt, sg * SK.shX * f.bx, SK.shY, 0, -P.sh[k], 0, sg * P.aabd[k]); put(I.uarm, f.uarm + k, Ma);
      jt(Mf, Ma, 0, -SK.uarm, 0, -P.el[k], 0, 0); put(I.farm, f.farm + k, Mf);
      jt(Mw[k], Mf, 0, -SK.farm, 0, -P.wr[k], 0, 0); put(I.hand, f.hand + k, Mw[k]);
      if (!legs) continue;
      jt(Mth, Mp, sg * SK.hipX * f.hx, SK.hipY, 0, -P.hip[k], 0, sg * P.labd[k]); put(I.thigh, f.thigh + k, Mth);
      jt(Msh, Mth, 0, -SK.thigh, 0, P.knee[k], 0, 0); put(I.shin, f.shin + k, Msh);
      jt(Mft, Msh, 0, -SK.shin, 0, -P.ank[k], 0, -sg * P.labd[k]); put(I.shoe, f.shoe + k, Mft);
    }
  }
  // limb matrix from joint A to joint B (geometry hangs along -y), in root-local space, then into the world
  const _ya = new THREE.Vector3(), _xa = new THREE.Vector3(), _za = new THREE.Vector3(), _B = new THREE.Vector3(), _A = new THREE.Vector3(), _C = new THREE.Vector3(), _d = new THREE.Vector3(), _pd = new THREE.Vector3();
  function limb(out, A, B, fwd) {
    _ya.subVectors(A, B).normalize(); _xa.crossVectors(_ya, fwd).normalize(); _za.crossVectors(_xa, _ya);
    _loc.makeBasis(_xa, _ya, _za).setPosition(A); return out.multiplyMatrices(Mroot, _loc);
  }
  function twoBone(A, C, L1, L2, pole, outB) {
    _d.subVectors(C, A); let d = _d.length(); d = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3); _d.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    _pd.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize();
    outB.copy(A).addScaledVector(_d, a).addScaledVector(_pd, h);
    C.copy(A).addScaledVector(_d, d);
    return outB;
  }
  const FWD = new THREE.Vector3(0, 0, 1), _pole = new THREE.Vector3(), _sh = new THREE.Vector3(), _el = new THREE.Vector3(), _gr = new THREE.Vector3(), _inv = new THREE.Matrix4(), _wr = new THREE.Vector3();
  // arms reaching for grips given in root-local space (buggy handle, handlebars)
  function armsTo(f, grips, poleOut = 0.55) {
    for (let k = 0; k < 2; k++) {
      const sg = k ? -1 : 1;
      _loc.multiplyMatrices(_inv.copy(Mroot).invert(), Mt);                       // torso in root-local space
      _sh.set(sg * SK.shX * f.bx, SK.shY, 0).applyMatrix4(_loc);
      _gr.copy(grips[k]);
      _pole.set(sg * poleOut, -0.6, -0.5);
      twoBone(_sh, _gr, SK.uarm, SK.farm + 0.075, _pole, _el);
      limb(Ma, _sh, _el, FWD); put(I.uarm, f.uarm + k, Ma);
      _wr.copy(_el).addScaledVector(_d.subVectors(_gr, _el).normalize(), SK.farm);
      limb(Mf, _el, _wr, FWD); put(I.farm, f.farm + k, Mf);
      limb(Mw[k], _wr, _gr, _pole.set(0, 0, 1)); put(I.hand, f.hand + k, Mw[k]);
    }
  }

  function gait(f, ph, g, amp, t, w) {
    const sd = f.seed;
    const shift = 0.5 + 0.5 * Math.sin(t * 0.33 + sd), ig = 1 - g;
    const lp = 0.025 * g + 0.01, lt = 0.035 * g * amp + 0.012 * Math.sin(t * 0.7 + sd) * ig;
    let mx = 0;
    const hipA = [0, 0], kn = [0, 0], al = [0, 0];
    for (let k = 0; k < 2; k++) {
      const u = frac(ph / TAU + k * 0.5), wsh = k ? 1 - shift : shift;
      hipA[k] = g * (0.05 + (look(THIGH, u) - 0.05) * 1.1 * amp) + ig * (0.015 + 0.07 * wsh);
      kn[k] = g * look(KNEE, u) * (0.65 + 0.35 * amp) + ig * (0.02 + 0.17 * wsh);
      al[k] = g * look(FOOT, u) * amp;
      mx = Math.max(mx, drop(hipA[k], kn[k], al[k]));
      P.labd[k] = 0.012 * g + ig * (0.035 + 0.04 * wsh);
    }
    const uL = frac(ph / TAU);
    P.py = mx * Math.cos(P.labd[0] * 0.5) - SK.hipY * Math.cos(lp);
    P.px = g * 0.018 * Math.sin(TAU * uL) + ig * 0.03 * (shift - 0.5);
    P.lp = lp; P.tp = -0.08 * g * amp * Math.cos(TAU * uL); P.rp = 0.035 * g * Math.sin(TAU * uL) + ig * 0.05 * (shift - 0.5);
    P.lt = lt; P.tt = 0.14 * g * amp * Math.cos(TAU * uL); P.rt = -P.rp * 0.6;
    for (let k = 0; k < 2; k++) {
      P.hip[k] = hipA[k] + lp; P.knee[k] = kn[k]; P.ank[k] = al[k] - hipA[k] + kn[k];
      const u = frac(ph / TAU + k * 0.5), c = Math.cos(TAU * u);
      P.sh[k] = 0.03 - g * 0.25 * amp * c + lp + lt; P.el[k] = 0.16 + g * 0.24 * amp * Math.max(0, -c) + ig * 0.08; P.aabd[k] = 0.075; P.wr[k] = 0.06;
    }
    // head steady on the walk, glancing about now and then
    const glance = Math.sin(t * 0.21 + sd * 3) * Math.sin(t * 0.13 + sd);
    P.hy = -P.tp - P.tt + 0.45 * Math.pow(glance, 3); P.hp = -lp - lt + 0.04;
  }
  const _hand = new THREE.Vector3();
  const handPt = (k, out) => out.set(0, -0.075, 0.01).applyMatrix4(Mw[k]);

  function poseWalker(w, t) {
    const f = w.f, g = clamp(w.v / 0.5, 0, 1), amp = clamp(w.v / 1.3, 0.45, 1.15) * (f.kid ? 1.1 : 1);
    rootM(w.x, w.y, w.z, w.yaw, f.s);
    gait(f, w.ph, g, amp, t, w);
    if (f.bag >= 0) { const k = f.bagSide; P.sh[k] = P.sh[k] * 0.35 + 0.02; P.el[k] = 0.1; P.aabd[k] = 0.16; }
    if (w.phone) { const k = (f.seed * 10 | 0) % 2; P.sh[k] = 0.3 + P.lp + P.lt; P.el[k] = 1.55; P.wr[k] = 0.25; P.aabd[k] = 0.02; P.hp = 0.38; P.hy *= 0.2; }
    if (w.dog != null) { const k = dogs[w.dog].side > 0 ? 0 : 1; P.sh[k] = 0.32 + 0.05 * Math.sin(t * 1.3 + f.seed) + P.lp + P.lt; P.el[k] = 0.55; P.aabd[k] = 0.12; }
    if (w.pram != null) { P.lt += 0.08; P.sh[0] = P.sh[1] = 0.6; P.el[0] = P.el[1] = 0.5; }
    applyFK(f);
    if (w.dog != null) { const d = dogs[w.dog]; handPt(d.side > 0 ? 0 : 1, d.hand); }
    if (w.pram != null) {
      const gy = 0.98 / f.s, gz = 0.36 / f.s, gx = 0.19 / f.s;
      armsTo(f, [_A.set(gx, gy, gz), _C.set(-gx, gy, gz)], 0.5);
      const pr = prams[w.pram];
      _e.set(0, w.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _e.order = 'YZX'; _p.set(w.x + Math.sin(w.yaw) * 0.36, w.y, w.z + Math.cos(w.yaw) * 0.36); _sc.set(1, 1, 1);
      I.pram.setMatrixAt(pr.slot, _loc.compose(_p, _q, _sc));
      blob(pr.blob, w.x + Math.sin(w.yaw) * 0.82, w.y, w.z + Math.cos(w.yaw) * 0.82, w.yaw, 0.62, 1.0);
    }
    if (f.bag >= 0) {
      handPt(f.bagSide, _hand);
      _e.set(0.18 * Math.sin(w.ph) * g, w.yaw, 0.04, 'YXZ'); _q.setFromEuler(_e); _e.order = 'YZX'; _sc.set(f.s, f.s, f.s);
      I.bag.setMatrixAt(f.bag, _loc.compose(_hand, _q, _sc));
    }
    blob(f.blob, w.x, w.y, w.z, w.yaw, 0.62 * f.s, 0.5 * f.s);
  }

  function poseIdler(d, t) {
    const f = d.f, tt = t + d.t0;
    rootM(d.x, d.y, d.z, d.yaw + 0.06 * Math.sin(tt * 0.23), f.s);
    gait(f, 0, 0, 0, tt, null);
    const talking = Math.sin(tt * 0.31 + d.talk) > 0.1;
    // a conversation: gestures while talking, nods while listening, weight shifting from foot to foot
    if (d.style === 0) { P.sh[0] = 0.15 + P.lp + P.lt; P.el[0] = 1.35; P.wr[0] = 0.2; P.aabd[0] = 0.05; }                                                 // holding a coffee
    else if (d.style === 1) { for (const k of [0, 1]) { P.sh[k] = -0.12 + P.lp + P.lt; P.el[k] = 0.45; P.aabd[k] = 0.16; P.wr[k] = -0.2; } }              // hands in pockets
    else if (d.style === 2) { P.sh[1] = -0.05 + P.lp + P.lt; P.el[1] = 0.35; P.aabd[1] = 0.22; }                                                           // hand on hip-ish
    if (talking) { const k = d.style === 0 ? 1 : 0; P.sh[k] = 0.28 + 0.12 * Math.sin(tt * 1.7) + P.lp + P.lt; P.el[k] = 1.0 + 0.3 * Math.sin(tt * 2.3 + 1); P.wr[k] = 0.3 * Math.sin(tt * 3.1); P.aabd[k] = 0.12; }
    P.hp += talking ? 0.03 * Math.sin(tt * 2.9) : 0.06 + 0.06 * Math.max(0, Math.sin(tt * 2.2)); P.hy = 0.12 * Math.sin(tt * 0.4 + d.talk);
    applyFK(f);
    if (f.bag >= 0) { handPt(f.bagSide, _hand); _e.set(0, d.yaw, 0.02, 'YXZ'); _q.setFromEuler(_e); _e.order = 'YZX'; _sc.set(f.s, f.s, f.s); I.bag.setMatrixAt(f.bag, _loc.compose(_hand, _q, _sc)); }
    blob(f.blob, d.x, d.y, d.z, d.yaw, 0.6 * f.s, 0.52 * f.s);
  }

  // riders: hips on the saddle, feet on the pedals, hands on the bars
  const _pl = new THREE.Matrix4(), SAD = new THREE.Vector3(0, 0.984, -0.155), _hip = new THREE.Vector3(), _kn = new THREE.Vector3(), _an = new THREE.Vector3(), _pf = new THREE.Vector3(0, 0.25, 1);
  function poseRider(r, t) {
    const f = r.f, s = f.s;
    rootM(r.x, r.y, r.z, r.yaw, s, r.pitch);
    const lp = 0.36, lt = 0.1;
    P.px = 0; P.py = 0; P.lp = lp; P.tp = 0.04 * Math.sin(r.crank); P.rp = 0.02 * Math.sin(r.crank); P.lt = lt; P.tt = -P.tp * 0.5; P.rt = 0;
    jt(Mp, Mroot, 0, SAD.y + 0.09 * Math.cos(lp), SAD.z + 0.09 * Math.sin(lp), P.lp, P.tp, P.rp);
    put(I.pelvis, f.pelvis, Mp, f.hx, 1, f.hx);
    if (f.tail >= 0) put(I.tail, f.tail, Mp, 0, 0, 0);
    jt(Mt, Mp, 0, 0, 0, P.lt, P.tt, P.rt); put(I.torso, f.torso, Mt, f.bx, 1, f.bz);
    jt(Mh, Mt, 0, SK.neckY, 0, -lp - lt + 0.22, 0.25 * Math.pow(Math.sin(t * 0.17 + f.seed), 5), 0);
    put(I.head, f.head, Mh, f.hs, f.hs, f.hs); put(I.hair, f.hair, Mh, f.hs * f.hatK, f.hs * f.hatK, f.hs * f.hatK);
    if (f.hairLong >= 0) put(I.hairLong, f.hairLong, jt(Ma, Mh, 0, 0.235 * f.hs, 0, 0, 0, 0), f.hs, f.hs * Math.min(f.hairLen, 0.9), f.hs);
    armsTo(f, [_A.set(0.25, 0.95, 0.35), _C.set(-0.25, 0.95, 0.35)], 0.7);
    _inv.copy(Mroot).invert(); const pl = _pl.multiplyMatrices(_inv, Mp);
    for (let k = 0; k < 2; k++) {
      const sg = k ? -1 : 1, th = r.crank + k * Math.PI;
      _hip.set(sg * SK.hipX * f.hx, SK.hipY, 0).applyMatrix4(pl);
      const a = -0.18 + 0.22 * Math.sin(th - 0.6);
      const ca = Math.cos(a), sa = Math.sin(a);
      // ankle from the pedal (ball of the foot on the spindle)
      _an.set(sg * 0.1, 0.28 + 0.17 * Math.cos(th), 0.17 * Math.sin(th));
      _an.y -= -0.075 * ca + 0.12 * sa; _an.z -= 0.075 * sa + 0.12 * ca;
      twoBone(_hip, _an, SK.thigh, SK.shin, _pf, _kn);
      limb(Mth, _hip, _kn, FWD); put(I.thigh, f.thigh + k, Mth);
      limb(Msh, _kn, _an, FWD); put(I.shin, f.shin + k, Msh);
      _e.set(-a, 0, 0); _q.setFromEuler(_e); _sc.set(1, 1, 1); _loc.compose(_an, _q, _sc); put(I.shoe, f.shoe + k, Mft.multiplyMatrices(Mroot, _loc));
    }
    put(I.bike, r.slot, Mroot);
    for (let k = 0; k < 2; k++) { jt(Ma, Mroot, 0, 0.34, k ? 0.63 : -0.43, r.wheel, 0, 0); put(I.wheel, r.slot * 2 + k, Ma); }
    blob(f.blob, r.x + Math.sin(r.yaw) * 0.1, r.y, r.z + Math.cos(r.yaw) * 0.1, r.yaw, 0.55 * s, 1.75 * s);
  }

  function poseDog(d, i, t) {
    const s = d.s, g = clamp(d.v / 0.4, 0, 1), lf = d.lf;
    rootM(d.x, d.y, d.z, d.yaw, s);
    const bob = 0.012 * g * Math.abs(Math.cos(d.ph)), drop0 = 0.47 * (1 - lf);
    jt(Ma, Mroot, 0, bob - drop0, 0, 0.02 * Math.sin(d.ph * 2) * g, 0, 0.03 * Math.sin(d.ph) * g);
    put(I.dog, i, Ma);
    let k = 0;
    for (const [sx, zz, ph] of [[1, 0.24, 0], [-1, 0.24, Math.PI], [1, -0.25, Math.PI], [-1, -0.25, 0]]) {
      jt(Mf, Ma, sx * 0.066, 0.48, zz, -0.45 * g * Math.sin(d.ph + ph), 0, 0);
      put(I.dogLeg, i * 4 + k++, Mf, 1, lf, 1);
    }
    blob(d.blob, d.x, d.y, d.z, d.yaw, 0.38 * s, 0.95 * s);
    // the lead, sagging from the owner's hand to the collar
    _hand.copy(d.hand);
    _C.set(0, 0.63, 0.33).applyMatrix4(Ma);
    const L = _hand.distanceTo(_C), sag = Math.max(0.05, 1.25 - L) * 0.32;
    for (let j = 0; j < SEG; j++) for (let e = 0; e < 2; e++) {
      const u = (j + e) / SEG, o = (i * SEG + j) * 6 + e * 3;
      leadPos[o] = _hand.x + (_C.x - _hand.x) * u; leadPos[o + 1] = _hand.y + (_C.y - _hand.y) * u - sag * 4 * u * (1 - u); leadPos[o + 2] = _hand.z + (_C.z - _hand.z) * u;
    }
  }

  // ---- simulation
  const O = {}, O2 = {};
  // direction of travel at s, from a point behind to a point ahead (smooths the turns at vertices)
  const _h2 = { seg: 0 };
  function heading(P_, s, dir, seg, ahead, behind) {
    _h2.seg = seg; at(P_, s + dir * ahead, _h2, O2); const ax = O2.x, ay = O2.y, az = O2.z;
    _h2.seg = seg; at(P_, s - dir * behind, _h2, O2);
    let dx = ax - O2.x, dz = az - O2.z; const dl = Math.hypot(dx, dz) || 1;
    O2.dx = dx / dl; O2.dz = dz / dl; O2.slope = (ay - O2.y) / dl; return O2;
  }
  function stepWalker(w, dt) {
    if (w.leader) {
      const L = w.leader; if (L.dir !== w.dir) w.lane = -w.lane;
      w.P = L.P; w.s = L.s; w.dir = L.dir; w.v = L.v; w.pause = L.pause;
    } else {
      // at the end of a path: slow to a stop, turn round on the spot, set off back the other way
      if (w.pause > 0) {
        w.pause -= dt; w.v = Math.max(0, w.v - dt * 2.2);
        if (w.flip && w.v < 0.12) { w.flip = false; w.dir = -w.dir; w.lane = -w.lane; }
      } else w.v = Math.min(w.speed, w.v + dt * 1.0);
      w.s += w.dir * w.v * dt;
      if (!w.flip && w.pause <= 0 && (w.s >= w.P.len || w.s <= 0)) { w.pause = 0.9 + R() * 2.2; w.flip = true; }
      w.s = clamp(w.s, 0, w.P.len);
    }
    const P_ = w.P;
    at(P_, w.s, w.h, O);
    const hd = heading(P_, w.s, w.dir, w.h.seg, 1.6, 1.0), dx = hd.dx, dz = hd.dz;
    w.lat += clamp(w.dir * w.lane - w.lat, -0.6 * dt, 0.6 * dt);
    // lateral offset along the path's own left normal (= dir x the travel direction's left normal (dz,-dx))
    w.x = O.x + w.dir * dz * w.lat; w.z = O.z - w.dir * dx * w.lat; w.y = O.y;
    w.yaw += angDiff(w.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * (w.pause > 0 ? 2.4 : 5)));
    w.ph += (w.v * dt / (0.83 * 1.75 * w.f.s * clamp(Math.pow(w.v / 1.3, 0.4), 0.6, 1.1) * (w.f.kid ? 0.9 : 1))) * TAU;
  }
  function stepRider(r, dt) {
    const rem = r.dir > 0 ? r.P.len - r.s : r.s;
    r.v += (Math.min(r.speed, 1.2 + rem * 0.32) - r.v) * Math.min(1, dt * 1.5);
    r.s += r.dir * r.v * dt;
    if (r.s >= r.P.len || r.s <= 0) { r.s = clamp(r.s, 0, r.P.len); r.dir = -r.dir; }
    const P_ = r.P;
    at(P_, r.s, r.h, O);
    const hd = heading(P_, r.s, r.dir, r.h.seg, 3, 2), dx = hd.dx, dz = hd.dz;
    r.lat += clamp(r.dir * P_.lane - r.lat, -1.4 * dt, 1.4 * dt);
    // keep left: lateral offset along the path's left normal, signed by the direction of travel
    const nx = O.x + r.dir * dz * r.lat, nz = O.z - r.dir * dx * r.lat, mx = nx - r.x, mz = nz - r.z;
    if (dt > 0 && mx * mx + mz * mz > 1e-8) r.yaw += angDiff(r.yaw, Math.atan2(mx, mz)) * (1 - Math.exp(-dt * 6));
    r.x = nx; r.z = nz; r.y = O.y;
    r.pitch = -Math.atan(hd.slope) * 0.9;
    r.wheel += r.v * dt / 0.345; r.crank += r.v * dt / (0.345 * TAU * 2.6) * TAU;
  }
  function stepDog(d, dt, t) {
    const w = d.w, side = d.side;
    const wob = Math.sin(t * 0.5 + d.wander), wob2 = Math.sin(t * 0.31 + d.wander * 2);
    const fwd = 0.55 + 0.3 * wob, lat = 0.62 + 0.18 * wob2;
    const sy = Math.sin(w.yaw), cy = Math.cos(w.yaw);
    // owner's right is (-cy, 0, sy); side +1 puts the dog on the owner's left (+x of the figure)
    const tx = w.x + sy * fwd + cy * lat * side, tz = w.z + cy * fwd - sy * lat * side;
    const px = d.x, pz = d.z;
    if (!d.init) { d.x = tx; d.z = tz; d.init = true; }
    d.x += (tx - d.x) * Math.min(1, dt * 3); d.z += (tz - d.z) * Math.min(1, dt * 3); d.y = w.y;
    const mv = Math.hypot(d.x - px, d.z - pz); d.v = dt > 0 ? mv / dt : 0;
    if (mv > 1e-4) d.yaw += angDiff(d.yaw, Math.atan2(d.x - px, d.z - pz)) * Math.min(1, dt * 6);
    else d.yaw += angDiff(d.yaw, w.yaw) * Math.min(1, dt * 2);
    d.ph += (d.v * dt / (0.62 * d.s)) * TAU;
  }

  let visible = true;
  function update(dt = 0, time = 0) {
    if (!visible) return;
    dt = clamp(dt, 0, 0.1);
    for (const w of walkers) if (!w.leader) stepWalker(w, dt);
    for (const w of walkers) if (w.leader) stepWalker(w, dt);
    for (const r of riders) stepRider(r, dt);
    for (const d of dogs) stepDog(d, dt, time);
    for (const w of walkers) poseWalker(w, time);
    for (const d of idlers) poseIdler(d, time);
    for (const r of riders) poseRider(r, time);
    dogs.forEach((d, i) => poseDog(d, i, time));
    for (const m of Object.values(I)) m.instanceMatrix.needsUpdate = true;
    if (dogs.length) leadGeo.attributes.position.needsUpdate = true;
  }
  // settle everyone onto their paths and pose the first frame
  for (const w of walkers) { stepWalker(w, 0); if (!w.leader) { const O3 = at(w.P, clamp(w.s + w.dir, 0, w.P.len), { seg: 0 }, {}); w.yaw = Math.atan2(O3.x - w.x, O3.z - w.z); } }
  for (const w of walkers) if (w.leader) w.yaw = w.leader.yaw;
  for (const r of riders) { stepRider(r, 0); const O3 = at(r.P, clamp(r.s + r.dir * 2, 0, r.P.len), { seg: 0 }, {}); r.yaw = Math.atan2(O3.x - r.x, O3.z - r.z); r.lat = r.dir * r.P.lane; stepRider(r, 0); }
  for (const d of dogs) { d.yaw = d.w.yaw; stepDog(d, 0, 0); d.yaw = d.w.yaw; }
  update(0, 0);

  const count = walkers.length + idlers.length + riders.length + dogs.length;
  return {
    group, update, count,
    counts: { pedestrians: walkers.length + idlers.length, cyclists: riders.length, dogs: dogs.length },
    setVisible(v) { visible = !!v; group.visible = visible; },
  };
}
