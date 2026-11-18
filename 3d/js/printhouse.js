// The Print House new-build blocks behind Seaton House (61 Wellington Street): the main rear block (2A, four 1Bs,
// 1C per floor) facing St Joseph's, the side block on Fletcher Street (two 1As per floor), the lift and stair core,
// steel-and-glass access walkways round the residents' garden, and the garden itself. Façades as the Ollier Smurthwaite
// elevations A817_T_300A-307B: 2.85 m floor to floor, twin timber casements 2372 x 2035 (two leaves, two panes across,
// three rows) in 25 mm recessed brick bays, soldier-course lintels, pressed aluminium sills, a precast stone band and a
// recessed brick band under the eaves, aluminium gutters and downpipes, and the top storey in a 58° slate mansard lit by
// twin rooflights (no windows in the wall). Built in the plan's own frame: local x = u (south along the block),
// local z = -v (v runs east into the garden), so the plan coordinates read straight across.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PH_SITE, PH_FH, PH_UNITS, PH_ROOF, PH_PLAN, PH_SIDE, phSide, phTopY } from './ph_data.js?v=1795002500';
import { roomBox } from './building.js?v=1795002500';
import { roomMaterial, tex } from './materials.js?v=1795002500';

const FH = PH_FH, NF = 5;
const WS = 0.515, WH = 2.035, WW = 2.372;  // window: bottom above the floor (450 brick + 65 sill), height, width (A817_T_302A)

export function phBasis() {
  const [ux, uz] = PH_SITE.u, [vx, vz] = PH_SITE.v;
  const theta = Math.atan2(-uz, ux);          // rotation about y taking local +x onto u (local +z then points along -v)
  return { theta, toWorld: (u, v) => [PH_SITE.origin[0] + ux * u + vx * v, PH_SITE.origin[1] + uz * u + vz * v] };
}

export function phBaseY(groundAt) {
  const B = phBasis();
  let yr = 0, nr = 0; for (const u of [6, 12, 18, 24]) { yr += groundAt(...B.toWorld(u, -3.2)); nr++; }
  let y0 = yr / nr + 1.85; for (const [u, v] of [[0, 3.6], [5.02, 0], [28.5, 0], phSide(0, 0), phSide(0, 9.69)]) y0 = Math.max(y0, groundAt(...B.toWorld(u, v)) + 0.15);
  return y0;
}
export function buildPrintHouse(M, opts = {}) {
  const { groundAt, forest } = opts;
  const B = phBasis();
  const group = new THREE.Group(); group.name = 'PrintHouse';
  // base level: the lowest corner of the blocks (the lower ground floor opens at the rear)
  // base level: the lower ground floor (+59.50) stands about 1.85 m above Fletcher Street along the long face (road +57.78 to
  // +57.25 on A817_T_302A / T_310A), behind the retained stone boundary wall: so the floor is set from the road, not the plot
  const y0 = phBaseY(groundAt);
  group.position.set(PH_SITE.origin[0], y0, PH_SITE.origin[1]); group.rotation.y = B.theta;
  group.userData.y0 = y0;
  const G = {}; const add = (k, g) => (G[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  // split a geometry's triangles by face normal (test(n) true -> second part): the inside faces of the brick facades and the
  // undersides of slabs and roofs are plaster, so the cut-aways and the photoreal rooms read as finished interiors
  const splitBy = (g, test) => {
    if (g.index) g = g.toNonIndexed();
    const pos = g.attributes.position, nt = pos.count / 3, pick = new Array(nt), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < nt; t++) { a.fromBufferAttribute(pos, 3 * t); b.fromBufferAttribute(pos, 3 * t + 1).sub(a); c.fromBufferAttribute(pos, 3 * t + 2).sub(a); pick[t] = test(b.cross(c).normalize()); }
    const part = (want) => { const out = new THREE.BufferGeometry(); for (const [nm, at] of Object.entries(g.attributes)) { const sz = at.itemSize, arr = []; for (let t = 0; t < nt; t++) if (pick[t] === want) for (let k = 0; k < 3 * sz; k++) arr.push(at.array[3 * t * sz + k]); out.setAttribute(nm, new THREE.Float32BufferAttribute(arr, sz)); } return out; };
    return [part(false), part(true)];
  };
  // box in plan coords: u0..u1 along x, v0..v1 -> z = -v
  const box = (u0, v0, u1, v1, ya, yb) => { const g = new THREE.BoxGeometry(Math.max(0.01, u1 - u0), Math.max(0.01, yb - ya), Math.max(0.01, v1 - v0)); g.translate((u0 + u1) / 2, (ya + yb) / 2, -(v0 + v1) / 2); return g; };
  const V2 = (a, b) => new THREE.Vector2(a, b);
  const EAV = PH_ROOF.TOP + 0.12;         // the garden faces rise to the flat roof (rev B: parapet removed), an aluminium fascia on top
  const windows = [], roomGeo = {}, pots = [];
  // the slate mansard over the top floor: brick to the knee wall, a 58° slope up to the flat roof (PH_ROOF in ph_data.js)
  const R = PH_ROOF, SA = Math.sin(R.PITCH), CA = Math.cos(R.PITCH), RISE = R.TOP - R.KNEE, SL = RISE / SA, RUN = RISE / Math.tan(R.PITCH);
  // ---- walls with openings, per facade: a facade is a line in plan (p0 -> p1) with an outward normal
  const facade = (p0, p1, n, openingsAll, yTop, mat, yBase = 0) => {
    const openings = openingsAll.filter(o => o.y0 >= yBase - 0.01 && o.y1 <= yTop + 0.01);
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), dir = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
    const sh = new THREE.Shape([new THREE.Vector2(0, yBase), new THREE.Vector2(len, yBase), new THREE.Vector2(len, yTop), new THREE.Vector2(0, yTop)]);
    for (const o of openings) { const h = new THREE.Path(); h.moveTo(o.a, o.y0); h.lineTo(o.b, o.y0); h.lineTo(o.b, o.y1); if (o.arch) h.absarc((o.a + o.b) / 2, o.y1, (o.b - o.a) / 2, 0, Math.PI, false); else h.lineTo(o.a, o.y1); h.lineTo(o.a, o.y0); sh.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false, curveSegments: 10 });
    // map: local x along dir, y up, extrude z outward along the normal
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(dir[0], 0, -dir[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, -n[1]));
    m.setPosition(p0[0] - n[0] * 0.35, 0, -(p0[1] - n[1] * 0.35));
    g.applyMatrix4(m);
    // brick-sized UVs
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[2 * i] = (p.getX(i) + p.getZ(i)) / 2.2; uv[2 * i + 1] = p.getY(i) / 2.2; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const [outer, inner] = splitBy(g, (nv) => nv.x * n[0] - nv.z * n[1] < -0.7); outer.userData.brickUV = true;
    add(mat, outer); if (inner.attributes.position.count) add('plasterIn', inner);
    // frames, glass, sills for each opening
    for (const o of openings) {
      const w = o.b - o.a, h = o.y1 - o.y0, c = (o.a + o.b) / 2;
      const at = (s, y, d) => [p0[0] + dir[0] * s + n[0] * d, y, p0[1] + dir[1] * s + n[1] * d];
      const fr = 0.07, dIn = -0.12;
      const piece = (s0, s1, ya, yb, d0, d1, key) => {
        const a = at(s0, ya, d0), b = at(s1, yb, d1);
        const g2 = new THREE.BoxGeometry(Math.max(0.01, s1 - s0), yb - ya, Math.max(0.01, Math.abs(d1 - d0)));
        const mm = new THREE.Matrix4().makeBasis(new THREE.Vector3(dir[0], 0, -dir[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], 0, -n[1]));
        mm.setPosition((a[0] + b[0]) / 2, (ya + yb) / 2, -((a[2] + b[2]) / 2));
        g2.applyMatrix4(mm); add(key, g2);
      };
      if (o.kind !== 'door') {
        piece(o.a, o.a + fr, o.y0, o.y1, dIn - 0.06, dIn + 0.02, 'frame'); piece(o.b - fr, o.b, o.y0, o.y1, dIn - 0.06, dIn + 0.02, 'frame');
        piece(o.a, o.b, o.y0, o.y0 + fr, dIn - 0.06, dIn + 0.02, 'frame'); piece(o.a, o.b, o.y1 - fr, o.y1, dIn - 0.06, dIn + 0.02, 'frame');
        // timber casements as the elevations: twin leaves meeting on a double mullion, each leaf two panes across and three rows,
        // the bottom row fixed and a little taller (transom), the upper two opening
        const leaves = w > 1.6 ? [[o.a + fr, c - 0.045], [c + 0.045, o.b - fr]] : [[o.a + fr, o.b - fr]];
        if (w > 1.6) piece(c - 0.045, c + 0.045, o.y0, o.y1, dIn - 0.06, dIn + 0.02, 'frame');
        const hi = h - 2 * fr, yT = o.y0 + fr + 0.37 * hi, yM = yT + 0.315 * hi;
        for (const [la, lb] of leaves) {
          const lc = (la + lb) / 2;
          if (lb - la > 0.45) piece(lc - 0.018, lc + 0.018, o.y0 + fr, o.y1 - fr, dIn - 0.045, dIn + 0.005, 'frame');
          if (h > 1.2) { piece(la, lb, yT - 0.03, yT + 0.03, dIn - 0.055, dIn + 0.01, 'frame'); piece(la, lb, yM - 0.018, yM + 0.018, dIn - 0.045, dIn + 0.005, 'frame'); }
        }
        piece(o.a + 0.02, o.b - 0.02, o.y0 + 0.02, o.y1 - 0.02, dIn - 0.03, dIn - 0.02, 'glass');
        piece(o.a - 0.04, o.b + 0.04, o.y0 - 0.05, o.y0, -0.03, 0.055, 'alu');                 // pressed aluminium sill
        if (!o.arch && o.y1 + 0.3 <= yTop + 0.01) piece(o.a - 0.05, o.b + 0.05, o.y1, o.y1 + 0.3, -0.005, 0.012, 'soldier');   // soldier-course lintel
        if (o.stair) continue;
        const wp = at(c, o.y0 + h / 2, 0); windows.push({ id: o.id, plot: o.plot, floor: o.floor, local: new THREE.Vector3(wp[0], wp[1], -wp[2]), n: [n[0], n[1]], w, h });
        // the lit room behind the glass (same shader as Charter House: lights up when the floor is hovered)
        const fy = o.floor * FH, rg = roomBox(o.a - 0.5, fy + 0.02, 0.38, o.b + 0.5, fy + FH - 0.28, 3.6, (o.y1 - o.y0) > 2 ? 0 : 1, (o.plot * 7.3) % 1);
        const rm = new THREE.Matrix4().makeBasis(new THREE.Vector3(dir[0], 0, -dir[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-n[0], 0, n[1]));
        rm.setPosition(p0[0], 0, -p0[1]); rg.applyMatrix4(rm);
        if (o.floor === NF - 1) { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, Math.min(p.getY(i), Math.max(o.floor * FH + 0.1, phTopY(p.getX(i), -p.getZ(i)) - 0.03))); }   // kept under the mansard
        (roomGeo[o.plot] ||= []).push(rg);
      } else {
        // front doors in heritage colours with raised panels, a glazed slot and a brass handle; a coir mat and a planted pot
        // outside each one (Charlie, 18 Nov: the doors looked dark and black, they should feel homely)
        const dk = 'door' + ((o.plot * 7 + o.floor * 3 + Math.round(o.a * 10)) % 4);
        piece(o.a, o.b, o.y0, o.y1, dIn - 0.05, dIn, dk);
        piece(o.a + 0.12, o.b - 0.12, o.y0 + 0.16, o.y0 + 0.92, dIn, dIn + 0.014, dk);
        piece(o.a + 0.12, o.b - 0.12, o.y0 + 1.05, o.y1 - 0.55, dIn, dIn + 0.014, dk);
        piece(o.a + 0.18, o.b - 0.18, o.y1 - 0.45, o.y1 - 0.14, dIn - 0.02, dIn + 0.004, 'glass');
        const hx = (o.a + o.b) / 2 > 0 ? o.b - 0.13 : o.a + 0.13;
        piece(hx - 0.018, hx + 0.018, o.y0 + 0.92, o.y0 + 1.16, dIn, dIn + 0.06, 'brass');
        piece((o.a + o.b) / 2 - 0.09, (o.a + o.b) / 2 + 0.09, o.y0 + 1.42, o.y0 + 1.52, dIn, dIn + 0.012, 'brass');   // number plate
        if (o.plot) {
          piece(o.a - 0.04, o.b + 0.04, o.y0 + 0.03, o.y0 + 0.045, 0.03, 0.62, 'mat');
          const ps = o.a - 0.42; piece(ps - 0.2, ps + 0.2, o.y0 + 0.03, o.y0 + 0.47, 0.08, 0.48, 'pot');
          pots.push(at(ps, o.y0 + 0.47, 0.28));
        }
      }
    }
  };
  // ---- the plan (PH_PLAN / PH_ROOF in ph_data.js): three outlines, each edge a façade line with the building on its left
  const P = PH_PLAN, D = P.D, TF = R.TF, S = P.SIDE, GAL = P.GAL;
  const edgeOf = ([p0, p1, sl]) => { const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len]; return { p0, p1, sl: !!sl, len, d, n: [d[1], -d[0]] }; };
  const MAINE = R.main.map(edgeOf), COREE = R.core.map(edgeOf), SIDEE = R.side.map(edgeOf);
  // a box in the side block's turned frame (s along ex, t along ey), as box() does in the main frame
  const SIDEM = new THREE.Matrix4().makeBasis(new THREE.Vector3(PH_SIDE.ex[0], 0, -PH_SIDE.ex[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-PH_SIDE.ey[0], 0, PH_SIDE.ey[1])).setPosition(PH_SIDE.o[0], 0, -PH_SIDE.o[1]);
  const sbox = (a0, b0, a1, b1, ya, yb) => { const g = new THREE.BoxGeometry(Math.max(0.01, a1 - a0), Math.max(0.01, yb - ya), Math.max(0.01, b1 - b0)); g.translate((a0 + a1) / 2, (ya + yb) / 2, -(b0 + b1) / 2); return g.applyMatrix4(SIDEM); };
  // a box along a façade line: s along the edge from p0, l outward from the face, y up
  const ebox = (e, s0, s1, l0, l1, ya, yb, key) => {
    const g = new THREE.BoxGeometry(Math.max(0.005, s1 - s0), Math.max(0.005, yb - ya), Math.max(0.005, l1 - l0)); g.translate((s0 + s1) / 2, (ya + yb) / 2, (l0 + l1) / 2);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(e.d[0], 0, -e.d[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(e.n[0], 0, -e.n[1])).setPosition(e.p0[0], 0, -e.p0[1]));
    add(key, g);
  };
  // ---- openings, per edge (a, b along the edge from p0)
  const ops = new Map(); const op = (e, o) => { if (!ops.has(e)) ops.set(e, []); ops.get(e).push(o); };
  const [mEast, , m1C, , mMain, , mWing, , , mGable, mGarden] = MAINE, [cStreet, , , , cWalk] = COREE, [sFletch, , sWalk] = SIDEE;
  const slot = (k) => PH_UNITS.find(q => q.slot === k).fp;
  for (let f = 0; f < NF; f++) {
    const y = f * FH, top = f === NF - 1, plotOf = (k) => f * 8 + k + 1;
    const win = (e, c, k, id, o = {}) => op(e, { a: c - WW / 2, b: c + WW / 2, y0: y + WS, y1: y + WS + WH, plot: plotOf(k), floor: f, id, ...o });
    const narrow = (e, a, k, id, o = {}) => op(e, { a, b: a + 0.91, y0: y + WS, y1: o.arch ? y + 2.095 : y + WS + WH, plot: plotOf(k), floor: f, id, ...o });   // arched: the arch and its soldier ring take the lintel's place
    // the main street face: one window bay per 1B, two for the 2A (W-x-06..W-x-11), at a 3.824 m pitch
    [[6, 'W6'], [5, 'W5'], [4, 'W4'], [3, 'W3'], [2, 'W2'], [2, 'W2b']].forEach(([k, id], i) => win(mMain, 2.188 + i * 3.824, k, id));
    win(m1C, 0.779 + WW / 2, 7, 'W7');                                     // the 1C's window on its set-back face (W-x-05)
    narrow(mEast, D - 9.6, 7, 'N7', { arch: f === 3 });                    // the 1C's narrow casement on its end wall (W-x-04)
    narrow(mWing, 0.564, 2, 'S2');                                        // the 2A's bedroom wing (W-x-12)
    // the side block's Fletcher Street face: one bay per 1A
    win(sFletch, S.T - 2.326, 1, 'F1'); win(sFletch, S.T - 6.488, 0, 'F0');
    // the stair core: the lower ground entrance door, then a narrow casement on each floor (W-x-03), arched on the second
    if (f === 0) op(cStreet, { a: 2.74, b: 3.74, y0: 0.02, y1: 2.3, kind: 'door', floor: f, plot: 0 });
    else if (!top) narrow(cStreet, 3.0, 0, 'C' + f, { stair: true, arch: f === 3, plot: 0 });   // W-G-03 sits just past the 562 step (A817_C_204B)
    // garden faces: each flat's front door off the walkway (the lower ground opens to the garden) and a bedroom window
    for (let k = 2; k <= 6; k++) {
      const [ua, , ub] = slot(k), A = (u) => P.UW - u;                    // the garden face runs from the gable (u = UW) back to u = 0
      if (k === 2) { op(mGarden, { a: A(21.85), b: A(20.9), y0: y + 0.02, y1: y + 2.15, kind: 'door', plot: plotOf(k), floor: f }); for (const u0 of [23.3, 25.6]) op(mGarden, { a: A(u0 + 1.2), b: A(u0), y0: y + 0.85, y1: y + 2.3, plot: plotOf(k), floor: f, id: 'E' + k + u0 }); }
      else { op(mGarden, { a: A(ua + 1.75), b: A(ua + 0.55), y0: y + 0.85, y1: y + 2.3, plot: plotOf(k), floor: f, id: 'E' + k }); op(mGarden, { a: A(ub - 0.5), b: A(ub - 1.45), y0: y + 0.02, y1: y + 2.15, kind: 'door', plot: plotOf(k), floor: f }); }
    }
    for (const [k, ta, tb] of [[1, 0, S.PW], [0, S.PW, S.T]]) {
      op(sWalk, { a: ta + 0.5, b: ta + 1.7, y0: y + 0.85, y1: y + 2.3, plot: plotOf(k), floor: f, id: 'G' + k });
      op(sWalk, { a: tb - 1.4, b: tb - 0.45, y0: y + 0.02, y1: y + 2.15, kind: 'door', plot: plotOf(k), floor: f });
    }
    if (f > 0) op(cWalk, { a: 0.9, b: 1.85, y0: y + 0.02, y1: y + 2.15, kind: 'door', floor: f, plot: 0 });   // the 1C's front door, off the landing by the lift
  }
  // the back of a full-height wall above the roof: where the wall rises past the mansard slope or the flat roof beside it, its
  // inner face is out in the open, so it is faced in brick there (Charlie, 18 Nov: white triangles at the mansard ends and a
  // white line round the roofs)
  const inset = R.TH / Math.sin(R.PITCH), TN = Math.tan(R.PITCH);
  const cover = (u, v) => { const t = phTopY(u, v); return t >= R.CEIL - 1e-3 ? R.TOP : Math.min(R.TOP, t + inset * TN); };
  const cheek = (e) => {
    const n = Math.max(2, Math.ceil(e.len / 0.2)), pts = [];
    for (let i = 0; i <= n; i++) { const sx = e.len * i / n, u = e.p0[0] + e.d[0] * sx - e.n[0] * 0.6, v = e.p0[1] + e.d[1] * sx - e.n[1] * 0.6; pts.push([sx, Math.min(EAV, cover(u, v) - 0.02)]); }
    if (pts.every(([, y]) => y >= EAV - 0.005)) return;
    const sh = new THREE.Shape([V2(e.len, EAV), V2(0, EAV), ...pts.map(([x, y]) => V2(x, y))]);
    const g = new THREE.ShapeGeometry(sh, 1);   // in the edge frame: x along the edge, y up; turned to face into the building
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(e.d[0], 0, -e.d[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(e.n[0], 0, -e.n[1])).setPosition(e.p0[0] - e.n[0] * 0.352, 0, -(e.p0[1] - e.n[1] * 0.352)));
    const idx = g.index; if (idx) { for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); } }   // flip to face inwards
    const pp = g.attributes.position, uv = new Float32Array(pp.count * 2);
    for (let i = 0; i < pp.count; i++) { uv[2 * i] = (pp.getX(i) + pp.getZ(i)) / 2.2; uv[2 * i + 1] = pp.getY(i) / 2.2; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.computeVertexNormals(); g.userData.brickUV = true; add('brick', g);
  };
  // ---- walls: street faces stop at the mansard's knee (their top-floor windows become rooflights), the rest rise to the roof
  const shared = new Set([COREE[3], COREE[5]]);                           // the core's walls against the 1C and the side block
  const roofOps = new Map();
  for (const e of [...MAINE, ...COREE, ...SIDEE]) {
    if (shared.has(e)) continue;
    const list = (ops.get(e) || []).map(o => ({ ...o }));
    if (e.sl) { roofOps.set(e, list.filter(o => o.floor === NF - 1 && o.kind !== 'door' && !o.stair)); facade(e.p0, e.p1, e.n, list, R.KNEE, 'brick'); }
    else { facade(e.p0, e.p1, e.n, list, EAV, 'brick'); ebox(e, -0.02, e.len + 0.02, -0.02, 0.12, EAV, EAV + 0.1, 'alu'); cheek(e); }   // aluminium fascia
  }
  // arched heads (A817_T_301A): a semicircular fanlight and an arched soldier course over the second-floor narrow casements
  for (const [e, list] of ops) for (const o of list) if (o.arch) {
    const c = (o.a + o.b) / 2, r = (o.b - o.a) / 2, Mx = new THREE.Matrix4().makeBasis(new THREE.Vector3(e.d[0], 0, -e.d[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(e.n[0], 0, -e.n[1])).setPosition(e.p0[0], 0, -e.p0[1]);
    const ring = new THREE.Shape(); ring.absarc(c, o.y1, r + 0.3, 0, Math.PI, false); ring.lineTo(c - r, o.y1); ring.absarc(c, o.y1, r, Math.PI, 0, true); ring.lineTo(c + r + 0.3, o.y1);
    const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.03, bevelEnabled: false, curveSegments: 10 }); rg.translate(0, 0, -0.02); rg.applyMatrix4(Mx); add('soldier', rg);
    const fan = new THREE.Shape(); fan.absarc(c, o.y1, r - 0.04, 0, Math.PI, false); fan.lineTo(c + r - 0.04, o.y1);
    const fg = new THREE.ShapeGeometry(fan, 10); fg.translate(0, 0, -0.14); fg.applyMatrix4(Mx); add('glass', fg);
    const fr = new THREE.Shape(); fr.absarc(c, o.y1, r, 0, Math.PI, false); fr.lineTo(c - r + 0.06, o.y1); fr.absarc(c, o.y1, r - 0.06, Math.PI, 0, true); fr.lineTo(c + r, o.y1);
    const frg = new THREE.ExtrudeGeometry(fr, { depth: 0.08, bevelEnabled: false, curveSegments: 10 }); frg.translate(0, 0, -0.18); frg.applyMatrix4(Mx); add('frame', frg);
    ebox(e, c - r, c + r, -0.21, -0.1, o.y1 - 0.03, o.y1 + 0.03, 'frame');
  }
  // ---- brickwork detail of the street faces (A817_T_301A / 302A): each window bay in a 25 mm recessed panel from the ground to the
  // third floor with the piers proud, a precast stone band at +450 over the third floor, a recessed band per bay, a projecting
  // course under the aluminium gutter; downpipes on alternate piers of the long faces
  const skin = (e, holes, yA, yB, d = 0.025) => {
    const sh = new THREE.Shape([new THREE.Vector2(0, yA), new THREE.Vector2(e.len, yA), new THREE.Vector2(e.len, yB), new THREE.Vector2(0, yB)]);
    for (const [a, b, ya0, yb0] of holes) { const h = new THREE.Path(), A = Math.max(0.01, a), Bq = Math.min(e.len - 0.01, b), ya = Math.max(yA + 0.01, ya0), yb = Math.min(yB - 0.01, yb0); if (Bq - A < 0.05 || yb - ya < 0.05) continue; h.moveTo(A, ya); h.lineTo(Bq, ya); h.lineTo(Bq, yb); h.lineTo(A, yb); h.lineTo(A, ya); sh.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 1 });
    g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(e.d[0], 0, -e.d[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(e.n[0], 0, -e.n[1])).setPosition(e.p0[0], 0, -e.p0[1]));
    const pp = g.attributes.position, uv = new Float32Array(pp.count * 2);
    for (let i = 0; i < pp.count; i++) { uv[2 * i] = (pp.getX(i) + pp.getZ(i)) / 2.2; uv[2 * i + 1] = pp.getY(i) / 2.2; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.userData.brickUV = true; add('brick', g);
  };
  for (const e of [...MAINE, ...COREE, ...SIDEE]) {
    if (!e.sl) continue;
    const bays = [...new Set((ops.get(e) || []).filter(o => o.floor === 0 && o.kind !== 'door' && o.b - o.a > 2).map(o => +((o.a + o.b) / 2).toFixed(3)))].sort((x, y) => x - y).map(c => [c - WW / 2 - 0.45, c + WW / 2 + 0.45]);
    if (e === mGable) bays.push([0.9, e.len - 0.9]);
    const holes = []; for (const [a, b] of bays) { holes.push([a, b, 0.02, TF - 0.01]); holes.push([a + 0.12, b - 0.12, TF + 0.675, TF + 1.06]); }
    for (const o of ops.get(e) || []) if (o.b - o.a <= 2 && o.y1 < R.KNEE) holes.push([o.a - 0.06, o.b + 0.06, o.y0 - 0.06, o.arch ? o.y1 + (o.b - o.a) / 2 + 0.31 : o.y1 + (o.kind === 'door' ? 0.04 : 0.31)]);   // narrow casements and doors sit in plain brick
    if (e.len > 1.2) skin(e, holes, 0, R.KNEE - 0.16);
    ebox(e, -0.03, e.len + 0.03, -0.02, 0.045, TF + 0.45, TF + 0.525, 'sill');          // precast stone band
    ebox(e, -0.03, e.len + 0.03, -0.02, 0.07, R.KNEE - 0.16, R.KNEE - 0.07, 'brick');   // projecting brick course
    if (bays.length > 1) {
      const piers = [bays[0][0] - 0.276, ...bays.slice(1).map((q, i) => (bays[i][1] + q[0]) / 2), bays[bays.length - 1][1] + 0.276].filter(x => x > 0.15 && x < e.len - 0.15);
      piers.forEach((x, i) => { if (!(i % 2)) ebox(e, x - 0.05, x + 0.05, 0.03, 0.13, 0, R.KNEE - 0.05, 'alu'); });
    }
  }
  // the lower part of the west gable: blank brick with a big recessed panel (A817_T_300A)
  skin(mGable, [[0.9, mGable.len - 0.9, 0.02, TF - 0.01]], 0, EAV - 0.4);
  // ---- the slate mansard: per outline, the street edges slope in by RUN to the flat roof, the hips and valleys fall where the
  // offset edges meet; twin rooflights over every window bay on the top floor; the flat roof over the rest
  const isect = (a, da, b, db) => { const cr = da[0] * db[1] - da[1] * db[0]; if (Math.abs(cr) < 1e-6) return b.slice(); const t = ((b[0] - a[0]) * db[1] - (b[1] - a[1]) * db[0]) / cr; return [a[0] + da[0] * t, a[1] + da[1] * t]; };
  for (const E of [MAINE, COREE, SIDEE]) {
    const off = E.map(e => { const o = e.sl ? RUN : 0; return [e.p0[0] - e.n[0] * o, e.p0[1] - e.n[1] * o]; });
    const Q = E.map((e, i) => { const j = (i + E.length - 1) % E.length; return isect(off[j], E[j].d, off[i], e.d); });
    // the flat roof: underside at the top floor's ceiling, top at the roof level
    const sh = new THREE.Shape(Q.map(([u, v]) => V2(u, v))); const rg = new THREE.ExtrudeGeometry(sh, { depth: R.TOP - R.CEIL, bevelEnabled: false, curveSegments: 1 });
    rg.rotateX(-Math.PI / 2); rg.translate(0, R.CEIL, 0); add('roof', rg);
    E.forEach((e, i) => {
      const Q0 = Q[i], Q1 = Q[(i + 1) % E.length];
      if (E[(i + E.length - 1) % E.length].sl && e.sl) {   // lead on the hip (or valley) from the knee to the top
        const a = new THREE.Vector3(e.p0[0], R.KNEE, -e.p0[1]), b = new THREE.Vector3(Q0[0], R.TOP, -Q0[1]), L = a.distanceTo(b);
        const hg = new THREE.BoxGeometry(0.16, 0.05, L); hg.lookAt(b.clone().sub(a)); hg.translate(...a.clone().add(b).multiplyScalar(0.5).toArray()); add('lead', hg);
      }
      if (!e.sl) return;
      const X = new THREE.Vector3(e.d[0], 0, -e.d[1]), N3 = new THREE.Vector3(e.n[0], 0, -e.n[1]), UP = new THREE.Vector3(0, 1, 0);
      const Y = UP.clone().multiplyScalar(SA).addScaledVector(N3, -CA), Z = N3.clone().multiplyScalar(SA).addScaledVector(UP, CA);
      const Mx = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(e.p0[0], R.KNEE, -e.p0[1]);   // local: s along, t up the slope, -d into it
      const sq0 = (Q0[0] - e.p0[0]) * e.d[0] + (Q0[1] - e.p0[1]) * e.d[1], sq1 = (Q1[0] - e.p0[0]) * e.d[0] + (Q1[1] - e.p0[1]) * e.d[1];
      const rw = (roofOps.get(e) || []).map(o => ({ o, c: (o.a + o.b) / 2, w: 1.33, t0: 0.24, t1: 1.22 })).filter(r => r.c - r.w / 2 > sq0 * 1.22 / SL - 0.05 && r.c + r.w / 2 < e.len + (sq1 - e.len) * 1.22 / SL + 0.05);   // RL-01..12: twin rooflights, 1.33 x 0.98 m
      const sl = new THREE.Shape([V2(0, 0), V2(e.len, 0), V2(sq1, SL), V2(sq0, SL)]);
      for (const r of rw) { const h = new THREE.Path(); h.moveTo(r.c - r.w / 2, r.t0); h.lineTo(r.c + r.w / 2, r.t0); h.lineTo(r.c + r.w / 2, r.t1); h.lineTo(r.c - r.w / 2, r.t1); h.lineTo(r.c - r.w / 2, r.t0); sl.holes.push(h); }
      const g = new THREE.ExtrudeGeometry(sl, { depth: R.TH, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, -R.TH);
      { const p = g.attributes.position, uv = g.attributes.uv; for (let k = 0; k < p.count; k++) uv.setXY(k, (p.getX(k) + p.getZ(k)) / 2.6, (p.getY(k) - p.getZ(k)) / 2.6); }
      g.applyMatrix4(Mx);
      const [outer, inner] = splitBy(g, (nv) => nv.x * Z.x + nv.y * Z.y + nv.z * Z.z < -0.7);   // seen from inside it is the plastered sloping ceiling
      add('slate', outer); add('plasterIn', inner);
      ebox(e, -0.02, e.len + 0.02, -0.17, 0.02, R.KNEE - 0.08, R.KNEE + 0.05, 'alu');   // aluminium gutter at the wall plate
      { // lead roll along the top of the slope
        const a = new THREE.Vector3(Q0[0], R.TOP + 0.02, -Q0[1]), b = new THREE.Vector3(Q1[0], R.TOP + 0.02, -Q1[1]), L = a.distanceTo(b);
        if (L > 0.1) { const lg = new THREE.BoxGeometry(0.2, 0.08, L); lg.lookAt(b.clone().sub(a)); lg.translate(...a.clone().add(b).multiplyScalar(0.5).toArray()); add('lead', lg); }
      }
      const lbox = (sA, sB, tA, tB, dA, dB, key) => { const b = new THREE.BoxGeometry(Math.max(0.005, sB - sA), Math.max(0.005, tB - tA), Math.max(0.005, dB - dA)); b.translate((sA + sB) / 2, (tA + tB) / 2, -(dA + dB) / 2); b.applyMatrix4(Mx); add(key, b); };
      const Pq = (s, l) => [e.p0[0] + e.d[0] * s - e.n[0] * l, e.p0[1] + e.d[1] * s - e.n[1] * l];
      for (const r of rw) {   // the rooflights: a dark aluminium frame and flashing outside, white linings and sashes inside, a mullion between the pair
        const a = r.c - r.w / 2, b = r.c + r.w / 2;
        lbox(a - 0.07, b + 0.07, r.t0 - 0.07, r.t0 + 0.05, -0.05, 0.06, 'frame'); lbox(a - 0.07, b + 0.07, r.t1 - 0.05, r.t1 + 0.07, -0.05, 0.06, 'frame');
        lbox(a - 0.07, a + 0.05, r.t0, r.t1, -0.05, 0.06, 'frame'); lbox(b - 0.05, b + 0.07, r.t0, r.t1, -0.05, 0.06, 'frame');
        lbox(r.c - 0.05, r.c + 0.05, r.t0, r.t1, -0.04, 0.06, 'frame');
        lbox(a, b, r.t0, r.t1, 0.03, 0.04, 'glass');
        lbox(a, b, r.t0, r.t0 + 0.02, 0.06, R.TH + 0.01, 'sash'); lbox(a, b, r.t1 - 0.02, r.t1, 0.06, R.TH + 0.01, 'sash');
        lbox(a, a + 0.02, r.t0, r.t1, 0.06, R.TH + 0.01, 'sash'); lbox(b - 0.02, b, r.t0, r.t1, 0.06, R.TH + 0.01, 'sash');
        for (const [sa, sb] of [[a, r.c - 0.04], [r.c + 0.04, b]]) {
          lbox(sa, sb, r.t0, r.t0 + 0.07, 0.05, 0.11, 'sash'); lbox(sa, sb, r.t1 - 0.07, r.t1, 0.05, 0.11, 'sash');
          lbox(sa, sa + 0.06, r.t0, r.t1, 0.05, 0.11, 'sash'); lbox(sb - 0.06, sb, r.t0, r.t1, 0.05, 0.11, 'sash');
          lbox(sa, sb, r.t1 - 0.32, r.t1 - 0.27, 0.05, 0.1, 'sash');
        }
        lbox(r.c - 0.06, r.c + 0.06, r.t0, r.t1, 0.05, 0.115, 'sash');
        const lp = Pq(r.c, 0.6); windows.push({ id: r.o.id, plot: r.o.plot, floor: r.o.floor, local: new THREE.Vector3(lp[0], TF + 1.5, -lp[1]), n: [e.n[0], e.n[1]], w: r.w, h: r.t1 - r.t0, roof: true });
      }
    });
  }
  // the lift overrun and the 1 m² smoke vent (AOV) on the core's roof
  { const [u0, u1, v0, v1] = [P.CORE.u1 - 3.2, P.CORE.u1 - 0.9, P.D + 0.4, P.D + 2.4];
    add('brick', box(u0, v0, u1, v1, R.TOP, R.TOP + 0.6)); add('alu', box(u0 - 0.05, v0 - 0.05, u1 + 0.05, v1 + 0.05, R.TOP + 0.6, R.TOP + 0.68));
    add('frame', box(1.0, P.D + 1.2, 2.0, P.D + 2.2, R.TOP, R.TOP + 0.3)); }
  // ---- walkways (A817_T_304B / 306A): 1.45 m steel decks on the garden faces of the main and side blocks, joined at a landing
  // by the core; steel posts and rails with X panels (CGI); columns down to the garden
  const GU1 = 23.0, sW0 = phSide(S.S, 0), sW1 = phSide(S.S + GAL, 0);
  const decks = [
    { k: 'main', b: (y) => box(P.CORE.u1, D, GU1, D + GAL, y - 0.12, y + 0.02), rail: [[P.CORE.u1 + 1.5, D + GAL], [GU1, D + GAL]], end: [[GU1, D + GAL], [GU1, D]] },
    { k: 'land', b: (y) => box(P.CORE.u1, D + GAL - 0.01, Math.max(sW1[0], P.CORE.u1 + GAL), sW0[1] + 0.05, y - 0.12, y + 0.02), rail: [] },
    { k: 'side', b: (y) => sbox(S.S, 0, S.S + GAL, S.T, y - 0.12, y + 0.02), rail: [phSide(S.S + GAL, S.T), phSide(S.S + GAL, 0.4)], end: [phSide(S.S, S.T), phSide(S.S + GAL, S.T)] },
  ];
  // Charlie, 15 Nov: the walkways as the 21 Living CGI, not the drawings: black steel X panels in the balustrade and a canopy
  // over the top walkway (the drawings show glass infill and no canopy)
  const exbar = (e, s0, s1, l, ya, yb) => {   // the two diagonals of one balustrade bay, in the edge's own frame
    const span = s1 - s0, h = yb - ya, len = Math.hypot(span, h), ang = Math.atan2(h, span);
    for (const sg of [1, -1]) {
      const g = new THREE.BoxGeometry(len, 0.025, 0.025); g.rotateZ(sg * ang); g.translate((s0 + s1) / 2, (ya + yb) / 2, l);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(e.d[0], 0, -e.d[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(e.n[0], 0, -e.n[1])).setPosition(e.p0[0], 0, -e.p0[1]));
      add('steel', g);
    }
  };
  const railRun = (a, b, y) => {   // posts, top and bottom rails, X panels between, along a plan line
    const e = edgeOf([a, b, 0]), n = Math.max(2, Math.round(e.len / 1.5));
    for (let i = 0; i <= n; i++) ebox(e, i * e.len / n - 0.03, i * e.len / n + 0.03, 0.0, 0.06, y, y + 1.1, 'steel');
    ebox(e, 0, e.len, 0, 0.07, y + 1.06, y + 1.12, 'steel'); ebox(e, 0, e.len, 0, 0.05, y + 0.1, y + 0.15, 'steel');
    for (let i = 0; i < n; i++) exbar(e, i * e.len / n + 0.03, (i + 1) * e.len / n - 0.03, 0.035, y + 0.15, y + 1.06);
  };
  for (let f = 1; f < NF; f++) {
    const y = f * FH;
    for (const dk of decks) {
      const g = dk.b(y); add('steel', g);
      const tg = g.clone(); tg.computeBoundingBox(); const pp = tg.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > y) pp.setY(i, y + 0.05); else pp.setY(i, y + 0.02); add('deck', tg);
      if (dk.rail.length) railRun(dk.rail[0], dk.rail[1], y);
      if (dk.end) railRun(dk.end[0], dk.end[1], y);
    }
  }
  for (const dk of decks) add('steel', dk.b(NF * FH + 0.1));   // the canopy over the top walkway (CGI)
  for (const [a, b] of [[[P.CORE.u1 + 1.5, D + GAL], [GU1, D + GAL]], [phSide(S.S + GAL, S.T), phSide(S.S + GAL, 0.4)]]) {
    const e = edgeOf([a, b, 0]), n = Math.max(1, Math.round(e.len / 4.5));
    for (let i = 0; i <= n; i++) ebox(e, i * e.len / n - 0.09, i * e.len / n + 0.09, 0.02, 0.2, 0, NF * FH, 'steel');   // columns up to the canopy
  }
  // ---- the plot: it stands on the lower ground floor's level above Fletcher Street. Charlie, 18 Nov: one even, curving brick
  // boundary wall round the street sides (no stepped plinths and broken railings), grass and a clipped hedge behind it, a black
  // railing along the top; the garden opened up and paved now Seaton House's rear annex is gone; a low ramped walkway with rails
  // up the gap between the side block and Seaton House from Fletcher Street into the garden
  {
    const WB = 1.6, Rf = 8.5;                                   // the wall's face, out from the main street face; the corner radius
    const toPlan = (x, z) => { const dx = x - PH_SITE.origin[0], dz = z - PH_SITE.origin[1]; return [dx * PH_SITE.u[0] + dz * PH_SITE.u[1], dx * PH_SITE.v[0] + dz * PH_SITE.v[1]]; };
    // the boundary line: along the main street face (v = -WB, running north), round a fillet, then along the side block's Fletcher face
    const ex = PH_SIDE.ex, ey = PH_SIDE.ey, P1 = phSide(-WB, 0);
    const cu = P1[0] - ey[0] * ((P1[1] + WB) / ey[1]), corner = [cu, -WB];                       // the two lines meet here
    const dA = [-1, 0], dB = ey, cosT = -(dA[0] * dB[0] + dA[1] * dB[1]), half = Math.acos(Math.max(-1, Math.min(1, cosT))) / 2;
    const tl = Rf / Math.tan(half), T0 = [corner[0] + tl, -WB], T1 = [corner[0] + dB[0] * tl, corner[1] + dB[1] * tl];
    const cen = [T0[0], -WB + Rf];
    const a0 = Math.atan2(T0[1] - cen[1], T0[0] - cen[0]), a1 = Math.atan2(T1[1] - cen[1], T1[0] - cen[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const tEnd = (S.T + 0.4) - ((T1[0] - P1[0]) * ey[0] + (T1[1] - P1[1]) * ey[1]);              // on along the Fletcher face
    const line = [[P.WING[2] + 1.0, -WB], T0];
    for (let k = 1; k < 24; k++) { const a = a0 + da * k / 24; line.push([cen[0] + Rf * Math.cos(a), cen[1] + Rf * Math.sin(a)]); }
    line.push(T1, [T1[0] + dB[0] * tEnd, T1[1] + dB[1] * tEnd]);
    // the platform the plot stands on: inside the wall, round to the garden side of the blocks
    const ret = [phSide(S.S + GAL + 0.3, S.T + 0.4), [P.CORE.u1, D + GAL + 0.3], [P.UW + 2.6, D + GAL + 0.3], [P.UW + 2.6, -WB]];
    const plat = [...line, ...ret];
    group.userData.platform = plat.map(([u, v]) => B.toWorld(u, v));   // the walled plot, kept clear of street furniture
    const slab = (Q, top = 0) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(Q.map(([u, v]) => V2(u, v))), { depth: 6 + top, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, -6, 0); return g; };
    { const [side, top] = splitBy(slab(plat), (nv) => nv.y > 0.7); add('lawn', top); const pp = side.attributes.position, uv = new Float32Array(pp.count * 2); for (let k = 0; k < pp.count; k++) { uv[2 * k] = (pp.getX(k) - pp.getZ(k)) / 2.2; uv[2 * k + 1] = pp.getY(k) / 2.2; } side.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); side.userData.brickUV = true; add('brick', side); }
    // the wall's parapet above the platform, stone coping, a continuous railing on the coping; grass and a hedge behind
    for (let k = 0; k < line.length - 1; k++) {
      const a = line[k], b = line[k + 1], e = edgeOf([a, b, 0]); if (e.len < 0.02) continue;
      ebox(e, -0.02, e.len + 0.02, 0.0, 0.34, 0, 0.5, 'brick');
      ebox(e, -0.04, e.len + 0.04, -0.06, 0.4, 0.5, 0.6, 'coping');
      const nb = Math.max(1, Math.round(e.len / 0.14));
      for (let q = 0; q < nb; q++) { const x = (q + 0.5) * e.len / nb; ebox(e, x - 0.011, x + 0.011, 0.16, 0.18, 0.6, 1.62, 'steel'); }
      ebox(e, -0.02, e.len + 0.02, 0.14, 0.2, 1.58, 1.64, 'steel'); ebox(e, -0.02, e.len + 0.02, 0.14, 0.2, 0.7, 0.74, 'steel');
      ebox(e, -0.01, e.len + 0.01, 0.5, 1.17, 0, 0.82, 'hedge');
      if (forest && !opts.context) for (let x = 0.45; x < e.len; x += 0.9) { const q = [e.p0[0] + e.d[0] * x + e.n[0] * 0.83, e.p0[1] + e.d[1] * x + e.n[1] * 0.83], [wx, wz] = B.toWorld(...q); forest.add(wx, wz, { h: 0.7, r: 0.5, kind: 'hedge', seed: 7000 + k * 31 + Math.round(x * 10), y: y0 + 0.2 }); }
    }
    // the ramped walkway up the gap between the side block and Seaton House (from the pavement to the garden level)
    const sp = opts.seatonPoly;
    if (sp && groundAt) {
      const sb0 = phSide(0, S.T), sb1 = phSide(S.S, S.T);                                         // the side block's east face
      const w0 = toPlan(...sp[3]), w1 = toPlan(...sp[0]);                                      // Seaton's back wall (south, north end)
      const near = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy); return [a[0] + dx * t, a[1] + dy * t]; };
      const m0 = sb0.map((c, k) => (c + near(sb0, w0, w1)[k]) / 2), m1 = sb1.map((c, k) => (c + near(sb1, w0, w1)[k]) / 2);
      const dir = [m1[0] - m0[0], m1[1] - m0[1]], dl = Math.hypot(...dir), du = [dir[0] / dl, dir[1] / dl];
      const A0 = [m0[0] - du[0] * 2.2, m0[1] - du[1] * 2.2], A1 = [m1[0] + du[0] * 1.2, m1[1] + du[1] * 1.2];
      const gy = groundAt(...B.toWorld(...A0)) - y0 + 0.05, n = 14, nrm = [-du[1], du[0]];
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, ya = gy + (0.04 - gy) * t0, yb = gy + (0.04 - gy) * t1;
        const pa = [A0[0] + (A1[0] - A0[0]) * t0, A0[1] + (A1[1] - A0[1]) * t0], pb = [A0[0] + (A1[0] - A0[0]) * t1, A0[1] + (A1[1] - A0[1]) * t1];
        const e = edgeOf([pa, pb, 0]);
        ebox(e, -0.01, e.len + 0.01, -1.15, 1.15, Math.min(ya, yb) - 1.5, (ya + yb) / 2, 'path');   // the ramp, stepping up the slope
        for (const sd of [-1.05, 1.05]) {
          ebox(e, 0, 0.05, sd - 0.025, sd + 0.025, (ya + yb) / 2, (ya + yb) / 2 + 1.0, 'steel');
          ebox(e, -0.01, e.len + 0.01, sd - 0.03, sd + 0.03, (ya + yb) / 2 + 0.95, (ya + yb) / 2 + 1.0, 'steel');
          ebox(e, -0.01, e.len + 0.01, sd - 0.02, sd + 0.02, (ya + yb) / 2 + 0.45, (ya + yb) / 2 + 0.48, 'steel');
        }
      }
    }
    // the residents' garden: paved in sandstone flags right across to Seaton House's back wall, a lawn in the middle
    const sw = sp ? sp.map(q => toPlan(...q)) : null;
    const court = [[P.CORE.u1, D], [P.UW + 2.6, D], [P.UW + 2.6, D + 4.6], ...(sw ? [[sw[3][0] - 0.2, sw[3][1] - 0.25], isect([sw[3][0], sw[3][1] - 0.25], [sw[0][0] - sw[3][0], sw[0][1] - sw[3][1]], phSide(S.S + GAL + 0.3, 0), ey)] : [[17.6, 23.4], [8.1, 25.3]]), phSide(S.S + GAL + 0.3, S.T + 0.4), phSide(S.S + GAL + 0.3, 0)];
    { const [side, top] = splitBy(slab(court), (nv) => nv.y > 0.7); add('path', top); add('wallStone', side); }
  }
  // ---- residents' garden (Charlie, 18 Nov: paved and much nicer): a lawn panel with sandstone paths round it, raised oak-edged
  // planters along Seaton House's wall and under the walkways, benches, multi-stem birches and an ornamental tree
  {
    add('lawn', box(10.6, D + 4.4, 20.2, D + 9.4, 0.0, 0.07));
    for (const [a, b, c, d] of [[8.6, D + GAL + 0.4, 22.6, D + GAL + 1.3], [24.0, D + GAL + 0.4, 29.6, D + GAL + 1.3]]) { add('oak', box(a, b, c, d, 0, 0.45)); add('soil', box(a + 0.08, b + 0.08, c - 0.08, d - 0.08, 0.45, 0.47)); }
    const benches = [[12.2, D + 3.3, 14.6, D + 3.8], [16.2, D + 3.3, 18.6, D + 3.8], [13.4, D + 10.0, 15.8, D + 10.5]];
    for (const [a, b, c, d] of benches) { add('oak', box(a, b, c, d, 0.38, 0.46)); add('steel', box(a + 0.1, b, a + 0.18, d, 0, 0.38)); add('steel', box(c - 0.18, b, c - 0.1, d, 0, 0.38)); }
    if (forest) {
      const trees = [[9.0, D + 6.0, 6.5, 'birch'], [22.4, D + 6.8, 6.8, 'birch'], [15.4, D + 6.9, 5.2, 'sycamore'], [26.6, D + 3.2, 5.8, 'birch']];
      trees.forEach(([u, v, h, kind], k) => { const [x, z] = B.toWorld(u, v); forest.add(x, z, { h, r: kind === 'birch' ? 1.9 : 2.6, kind, seed: 5100 + k, y: y0 + 0.05 }); });
      let sd = 77; const rr = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
      if (!opts.context) {
        for (let k = 0; k < 90; k++) { const bed = rr() < 0.75 ? [8.7, D + GAL + 0.5, 22.5, D + GAL + 1.2] : [24.1, D + GAL + 0.5, 29.5, D + GAL + 1.2]; const u = bed[0] + rr() * (bed[2] - bed[0]), v = bed[1] + rr() * (bed[3] - bed[1]); const [x, z] = B.toWorld(u, v); const g = rr() < 0.45; forest.add(x, z, { h: g ? 0.7 : 0.8 + rr() * 0.5, r: g ? 0.4 : 0.5, kind: g ? 'grass' : 'shrub', seed: 5300 + k, y: y0 + 0.47 }); }
        for (let k = 0; k < 26; k++) { const u = 10.8 + rr() * 9.2, v = rr() < 0.5 ? D + 4.5 + rr() * 0.5 : D + 8.8 + rr() * 0.5; const [x, z] = B.toWorld(u, v); forest.add(x, z, { h: 0.55, r: 0.35, kind: rr() < 0.5 ? 'grass' : 'shrub', seed: 5500 + k, y: y0 + 0.07 }); }
        for (const [u, py, v] of pots) { const [x, z] = B.toWorld(u, v); forest.add(x, z, { h: 0.75, r: 0.32, kind: 'shrub', seed: 5700 + Math.round(u * 13 + py * 7), y: y0 + py }); }
      }
    }
  }
  // ---- assemble
  const mats = {
    brick: M.brick || M.cBrick, band: M.brick2 || M.cBrickOld, zinc: M.timberBlack || new THREE.MeshStandardMaterial({ color: '#2d3033', roughness: 0.5, metalness: 0.4 }),
    zincWall: new THREE.MeshStandardMaterial({ color: '#34383c', roughness: 0.42, metalness: 0.55, clippingPlanes: M.brick?.clippingPlanes }),
    zincRoof: new THREE.MeshStandardMaterial({ color: '#3a3e42', roughness: 0.38, metalness: 0.6, side: THREE.DoubleSide }),
    frame: new THREE.MeshStandardMaterial({ color: '#25282b', roughness: 0.45, metalness: 0.3, clippingPlanes: M.brick?.clippingPlanes }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#2b3743', roughness: 0.05, metalness: 0.15, envMapIntensity: 1.3, transparent: true, opacity: 0.55, clearcoat: 1, clippingPlanes: M.brick?.clippingPlanes }), sill: M.stone, door: new THREE.MeshStandardMaterial({ color: '#1e2124', roughness: 0.5, clippingPlanes: M.brick?.clippingPlanes }),
    room: new THREE.MeshStandardMaterial({ color: '#2a2622', emissive: new THREE.Color('#ffcf98'), emissiveIntensity: 0.0, roughness: 1, clippingPlanes: M.brick?.clippingPlanes }),
    steel: new THREE.MeshStandardMaterial({ color: '#1f2225', roughness: 0.42, metalness: 0.6, clippingPlanes: M.brick?.clippingPlanes }),
    deck: new THREE.MeshStandardMaterial({ color: '#55595d', roughness: 0.8, metalness: 0.2, clippingPlanes: M.brick?.clippingPlanes }),
    balGlass: M.balGlass, roof: new THREE.MeshStandardMaterial({ color: '#4a4c4f', roughness: 0.9, clippingPlanes: M.brick?.clippingPlanes }), lawn: M.grass, path: (() => { const m = M.paving.clone(); m.color = new THREE.Color('#cfc6b6'); m.roughness = 1; return m; })(), planter: new THREE.MeshStandardMaterial({ color: '#2b2e31', roughness: 0.55, metalness: 0.4 }),
    plasterIn: new THREE.MeshStandardMaterial({ color: '#ebe7e1', roughness: 0.92, clippingPlanes: M.brick?.clippingPlanes }),
    slate: M.slate || M.cSlate, lead: new THREE.MeshStandardMaterial({ color: '#3c4043', roughness: 0.55, metalness: 0.35, clippingPlanes: M.brick?.clippingPlanes }),
    sash: new THREE.MeshStandardMaterial({ color: '#f2f1ec', roughness: 0.45, clippingPlanes: M.brick?.clippingPlanes }),
    alu: new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.4, metalness: 0.5, clippingPlanes: M.brick?.clippingPlanes }), soldier: M.brick || M.cBrick,
    wallStone: (() => { const T = (n, o) => tex((opts.base || 'assets/') + 'tex/' + n, o); return new THREE.MeshStandardMaterial({ map: T('sandstone_w.jpg'), normalMap: T('sandstone_normal.jpg', { srgb: false }), normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.92, color: new THREE.Color(0.62, 0.64, 0.7), clippingPlanes: M.brick?.clippingPlanes }); })(),   // the retained stone boundary wall: weathered coursed sandstone
    soil: new THREE.MeshStandardMaterial({ color: '#3b2c22', roughness: 1 }), oak: new THREE.MeshStandardMaterial({ color: '#a5774a', roughness: 0.6 }),
    door0: new THREE.MeshStandardMaterial({ color: '#26364a', roughness: 0.42, clippingPlanes: M.brick?.clippingPlanes }), door1: new THREE.MeshStandardMaterial({ color: '#4c5b4d', roughness: 0.45, clippingPlanes: M.brick?.clippingPlanes }),
    door2: new THREE.MeshStandardMaterial({ color: '#5a272c', roughness: 0.42, clippingPlanes: M.brick?.clippingPlanes }), door3: new THREE.MeshStandardMaterial({ color: '#1f3a2e', roughness: 0.42, clippingPlanes: M.brick?.clippingPlanes }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a24f', roughness: 0.3, metalness: 1, clippingPlanes: M.brick?.clippingPlanes }),
    mat: new THREE.MeshStandardMaterial({ color: '#7a6346', roughness: 1, clippingPlanes: M.brick?.clippingPlanes }),
    pot: new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.6, metalness: 0.2, clippingPlanes: M.brick?.clippingPlanes }),
    hedge: new THREE.MeshStandardMaterial({ color: '#3e5a2c', roughness: 0.95 }),
    coping: new THREE.MeshStandardMaterial({ color: '#9a9a96', roughness: 0.85 }),
  };
  const meshes = {};
  for (const [k, list] of Object.entries(G)) {
    // every box gets the same UVs; the facade walls already carry brick-scaled ones, so map the plain boxes per face
    if (k === 'soldier') for (const gg of list) {   // bricks on end: the course pattern turned through 90°
      const p = gg.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getY(i) / 2.2; uv[2 * i + 1] = (p.getX(i) + p.getZ(i)) / 2.2; }
      gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    for (const gg of list) if (!gg.userData.brickUV && (k === 'brick' || k === 'band')) {
      gg.computeVertexNormals(); const p = gg.attributes.position, nn = gg.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)); uv[2 * i] = (ay > 0.7 ? p.getX(i) : ax > 0.7 ? p.getZ(i) : p.getX(i)) / 2.2; uv[2 * i + 1] = (ay > 0.7 ? p.getZ(i) : p.getY(i)) / 2.2; }
      gg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    let g = mergeGeometries(list, false); if (!g) continue;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (k === 'roof') { const [top, under] = splitBy(g, (nv) => nv.y < -0.7); g = top; (G.soffit ||= []).push(under); }
    const m = new THREE.Mesh(g, mats[k] || M.stone); m.castShadow = !['glass', 'balGlass', 'room', 'lawn', 'path'].includes(k); m.receiveShadow = true; m.name = 'ph_' + k;
    group.add(m); meshes[k] = m;
  }
  // per-apartment rooms behind the glass
  // behind the glass: slices of the 21 Living Print House CGIs
  const roomTex = new THREE.TextureLoader().load((opts.base || 'assets/') + 'tex/room_atlas_ph.jpg'); roomTex.colorSpace = THREE.SRGBColorSpace;
  const unitRooms = new Map();
  if (opts.context) {   // a backdrop copy (Charter House edition): one draw call for every room
    const mat = roomMaterial(roomTex); mat.side = THREE.DoubleSide; mat.uniforms.uBright.value = 0.1;
    const mesh = new THREE.Mesh(mergeGeometries(Object.values(roomGeo).flat(), false), mat); mesh.name = 'rooms_ph'; mesh.renderOrder = 1; mesh.userData.bright = 0.85; group.add(mesh);
  } else for (const [plot, list] of Object.entries(roomGeo)) {
    const mat = roomMaterial(roomTex); mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(mergeGeometries(list, false), mat); mesh.name = 'rooms_' + plot; mesh.renderOrder = 1; mesh.userData.bright = 0.85; mat.uniforms.uBright.value = 0.2; group.add(mesh); unitRooms.set(+plot, mesh);
  }
  // floor slabs + party walls between apartments (seen when a floor is cut open)
  {
    const slab = [], walls = [];
    const inset = (E, d) => { const off = E.map(e => [e.p0[0] - e.n[0] * d, e.p0[1] - e.n[1] * d]); return E.map((e, i) => { const j = (i + E.length - 1) % E.length; return isect(off[j], E[j].d, off[i], e.d); }); };
    const polySlab = (Q, ya, yb) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(Q.map(([u, v]) => V2(u, v))), { depth: yb - ya, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, ya, 0); return g; };
    const QM = inset(MAINE, 0.36), QS = inset(SIDEE, 0.36);
    const cutTop = (g, y) => {   // under the mansard: follow the sloping ceiling, stop at the flat one
      g.computeBoundingBox(); const { min: q0, max: q1 } = g.boundingBox;
      const h = new THREE.BoxGeometry(q1.x - q0.x, q1.y - q0.y, q1.z - q0.z, Math.max(1, Math.ceil((q1.x - q0.x) / 0.12)), 1, Math.max(1, Math.ceil((q1.z - q0.z) / 0.12)));
      h.translate((q0.x + q1.x) / 2, (q0.y + q1.y) / 2, (q0.z + q1.z) / 2);
      const p = h.attributes.position; for (let k = 0; k < p.count; k++) { const lim = phTopY(p.getX(k), -p.getZ(k)) + 0.03; if (p.getY(k) > lim) p.setY(k, Math.max(lim, y + 0.1)); }
      h.computeVertexNormals(); return h;
    };
    for (let f = 0; f < NF; f++) {
      const y = f * FH;
      slab.push(polySlab(QM, y - 0.25, y + 0.02), polySlab(QS, y - 0.25, y + 0.02));
      const list = [];
      for (const u of P.PW) list.push(box(u - 0.06, u < P.US ? P.C1 + 0.36 : 0.36, u + 0.06, D - 0.36, y, y + FH - 0.3));      // main block party walls
      const pw = sbox(0.36, S.PW - 0.06, S.S - 0.36, S.PW + 0.06, y, y + FH - 0.3);                                            // between the two 1As
      for (const g of list) walls.push(f === NF - 1 ? cutTop(g, y) : g);
      walls.push(pw);   // (the side block's party wall runs square to its own frame; under the mansard it stops at the knee)
    }
    const sg = mergeGeometries(slab.map(g => g.index ? g.toNonIndexed() : g), false);
    { const p = sg.attributes.position, uv = sg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.6, p.getZ(i) / 1.6); }   // oak boards at a real scale
    const [sTop, sUnder] = splitBy(sg, (nv) => nv.y < -0.7);
    const sm = new THREE.Mesh(sTop, M.timber || M.plaster || M.stone); sm.receiveShadow = true; sm.name = 'ph_slabs'; group.add(sm);
    { // plaster ceilings: the undersides of the slabs and of the roof deck
      const sf = mergeGeometries([...(G.soffit || []), sUnder].map(x => { if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); if (!x.attributes.normal) x.computeVertexNormals(); return x; }), false);
      if (sf) { const so = new THREE.Mesh(sf, mats.plasterIn); so.receiveShadow = true; so.name = 'ph_soffit'; group.add(so); }
    }
    const wm = new THREE.Mesh(mergeGeometries(walls.map(g => g.index ? g.toNonIndexed() : g), false), M.plaster || M.stone); wm.castShadow = false; wm.receiveShadow = true; wm.name = 'ph_party'; group.add(wm);
  }
  // picking volumes (the side block's in its own turned frame)
  const pick = new THREE.Group(); pick.name = 'pick'; const invis = new THREE.MeshBasicMaterial({ visible: false });
  const unitHit = new Map(), floorHit = [];
  for (const u of PH_UNITS) {
    const y = u.floor * FH, g = u.fpS ? sbox(u.fpS[0] - 0.4, u.fpS[1], u.fpS[2] + 0.4, u.fpS[3], y + 0.05, y + FH - 0.05) : box(u.fp[0] - 0.4, u.fp[1] - 0.4, u.fp[2] + 0.4, u.fp[3] + 0.4, y + 0.05, y + FH - 0.05);
    const m = new THREE.Mesh(g, invis); m.userData.plot = u.plot; m.userData.floor = u.floor; pick.add(m); unitHit.set(u.plot, m);
  }
  for (let f = 0; f < NF; f++) { const y = f * FH; const a = new THREE.Mesh(box(-0.4, -0.4, P.UW + 2.4, D + GAL + 0.3, y, y + FH), invis); const b = new THREE.Mesh(sbox(-0.4, -0.2, S.S + GAL + 0.3, S.T + 0.4, y, y + FH), invis); a.userData.floor = b.userData.floor = f; pick.add(a, b); floorHit.push([a, b]); }
  group.add(pick);
  group.updateMatrixWorld(true);
  const W2 = (lp) => lp.clone().applyMatrix4(group.matrixWorld);
  for (const w of windows) { w.pos = W2(w.local); const nl = new THREE.Vector3(w.n[0], 0, -w.n[1]).applyQuaternion(group.quaternion); w.normal = nl; }
  // warm bulbs (they glow in the evening): a wall light beside every front door on the walkways, and festoon strings
  // criss-crossing the garden from the ground-floor walkway to the back of Seaton House
  const bulbs = [];
  for (const [e, list] of ops) for (const o of list) if (o.kind === 'door' && o.floor > 0) { const s = (o.a + o.b) / 2 + 0.78, q = [e.p0[0] + e.d[0] * s + e.n[0] * 0.14, e.p0[1] + e.d[1] * s + e.n[1] * 0.14]; bulbs.push(W2(new THREE.Vector3(q[0], o.floor * FH + 2.3, -q[1]))); }
  const string = (a, b, sag) => { const n = Math.max(2, Math.round(a.distanceTo(b) / 0.75)); for (let i = 0; i <= n; i++) { const t = i / n, q = a.clone().lerp(b, t); q.y -= sag * 4 * t * (1 - t); bulbs.push(W2(q)); } };
  const hy = FH + 2.7;
  for (const u of [10.0, 13.6]) string(new THREE.Vector3(u, hy, -(D + GAL)), new THREE.Vector3(u, hy - 0.4, -(D + 10.2)), 0.9);
  for (const v of [D + 4.0, D + 7.0]) string(new THREE.Vector3(8.6, hy, -v), new THREE.Vector3(15.2, hy - 0.4, -v), 0.8);
  // building outline (world) for the floor glow: the main block, the core and the side block as one polygon in plan
  const outlinePlan = [...MAINE.slice(0, 10).map(e => e.p0), MAINE[10].p0, [P.CORE.u1, D], phSide(S.S, 0), phSide(S.S, S.T), phSide(0, S.T), phSide(0, 0), COREE[0].p0, COREE[1].p0, COREE[2].p0].map(([u, v]) => [u, v]);
  const outlineWorld = outlinePlan.map(([u, v]) => B.toWorld(u, v));
  return { group, meshes, windows, unitRooms, unitHit, floorHit, pick, y0, FH, NF, outlinePlan, outlineWorld, bulbs, toWorld: B.toWorld, local: (u, y, v) => W2(new THREE.Vector3(u, y, -v)), units: PH_UNITS };
}

// Seaton House, 61 Wellington Street: the retained Victorian frontage (Brik Studios' new HQ, the Print House offices), on its
// OpenStreetMap footprint less the rear annex, with the CGI's street elevation: five big multi-pane windows on each floor, stone
// sills and heads, a raised parapet with THE PRINT HOUSE centred on it, the gabled entrance bay with three arched windows.
// Charlie, 18 Nov: two pitched roofs behind a square parapet (it reads flat from the road), larger windows, the logo in the
// middle, and the offices' proper entrance on the Fletcher Street end with a paved forecourt.
export function buildSeatonHouse(M, poly, groundAt, opts = {}) {
  const group = new THREE.Group(); group.name = 'seaton';
  const n = poly.length; let cx = 0, cz = 0; for (const [x, z] of poly) { cx += x; cz += z; } cx /= n; cz /= n;
  // the street frontage: the longest edge facing east-ish (Wellington Street)
  let best = null;
  for (let i = 0; i < n; i++) {
    const A = poly[i], Bp = poly[(i + 1) % n], dx = Bp[0] - A[0], dz = Bp[1] - A[1], L = Math.hypot(dx, dz);
    let nx = dz / L, nz = -dx / L; const mx = (A[0] + Bp[0]) / 2, mz = (A[1] + Bp[1]) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
    const score = L * Math.max(0, nx * 0.96 + nz * 0.28);
    if (!best || score > best.score) best = { A, B: Bp, L, nx, nz, score };
  }
  // run the facade from its north end (lower z) to its south end, where the gabled entrance bay is
  let { A: F0, B: F1 } = best; if (F0[1] > F1[1]) [F0, F1] = [F1, F0];
  const L = best.L, dx = (F1[0] - F0[0]) / L, dz = (F1[1] - F0[1]) / L, nx = best.nx, nz = best.nz;
  let depth = 0; for (const [x, z] of poly) depth = Math.max(depth, -((x - F0[0]) * nx + (z - F0[1]) * nz));
  let gMin = 1e9; for (const [x, z] of poly) gMin = Math.min(gMin, groundAt(x, z));
  const gF = Math.min(groundAt(...F0), groundAt(...F1)), H = 9.6, top = gF + H, base = gMin - 1.2, EV = H - 1.0;   // EV: the eaves inside the parapet
  const G = {}; const add = (k, g) => (G[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  const keep = [poly.map(([x, z]) => [x, z])];   // areas the street furniture keeps out of
  // a box in the frontage frame: s along the frontage from the north end, y above gF, d out from the front wall (negative = into the building)
  const M4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(dx, 0, dz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-dz, 0, dx));
  const sg = (-dz * nx + dx * nz) > 0 ? 1 : -1;
  const fbox = (k, s0, s1, y0, y1, d0, d1) => { const g = new THREE.BoxGeometry(Math.max(0.005, s1 - s0), Math.max(0.005, y1 - y0), Math.max(0.005, Math.abs(d1 - d0))); g.translate((s0 + s1) / 2, gF + (y0 + y1) / 2, sg * (d0 + d1) / 2); g.applyMatrix4(M4); g.translate(F0[0], 0, F0[1]); add(k, g); };
  // body: the walls up to the eaves (a solid block), then a parapet ring round the roofs
  {
    const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: gF + EV - base, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, base, 0); add('wall', g);
    const ring = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const inset = poly.map(([x, z]) => { const ddx = cx - x, ddz = cz - z, l = Math.hypot(ddx, ddz); return [x + ddx / l * 0.42, z + ddz / l * 0.42]; });
    ring.holes.push(new THREE.Path(inset.map(([x, z]) => new THREE.Vector2(x, -z)).reverse()));
    const pg = new THREE.ExtrudeGeometry(ring, { depth: H - EV, bevelEnabled: false }); pg.rotateX(-Math.PI / 2); pg.translate(0, gF + EV, 0); add('wall', pg);
    const cop = new THREE.ExtrudeGeometry(ring, { depth: 0.1, bevelEnabled: false }); cop.rotateX(-Math.PI / 2); cop.translate(0, top, 0); add('stone', cop);
  }
  // the front wall, 0.4 m proud of the body, with its window holes (so the glass sits in a deep reveal)
  const wins = [];
  const MAIN = Math.min(18.2, L - 6.2), bay = MAIN / 5;
  for (let i = 0; i < 5; i++) { const c = bay * (i + 0.5); wins.push({ a: c - 1.42, b: c + 1.42, y0: 0.6, y1: 3.35, grid: [3, 3] }, { a: c - 1.36, b: c + 1.36, y0: 4.3, y1: 6.85, grid: [3, 3] }); }
  const gb0 = MAIN, gb1 = L, gc = (gb0 + gb1) / 2;
  wins.push({ a: gb0 + 0.6, b: gb0 + 1.5, y0: 0.6, y1: 2.9, grid: [1, 2] });
  wins.push({ a: gc - 0.75, b: gc + 0.75, y0: 0.05, y1: 2.9, door: true });
  for (const k of [-1.45, 0, 1.45]) wins.push({ a: gc + k - 0.45, b: gc + k + 0.45, y0: 4.1, y1: 6.6, grid: [1, 3], arch: true });
  {
    const sh = new THREE.Shape([new THREE.Vector2(0, base - gF), new THREE.Vector2(L, base - gF), new THREE.Vector2(L, H), new THREE.Vector2(0, H)]);
    for (const w of wins) { const h = new THREE.Path(); h.moveTo(w.a, w.y0); h.lineTo(w.b, w.y0); h.lineTo(w.b, w.y1); h.lineTo(w.a, w.y1); h.lineTo(w.a, w.y0); sh.holes.push(h); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false }); g.translate(0, gF, sg > 0 ? 0 : -0.4); g.applyMatrix4(M4); g.translate(F0[0], 0, F0[1]);
    add('wall', g);
  }
  const winFrames = (w, box) => {
    const fr = 0.07, d0 = 0.02, d1 = 0.1;
    box('glass', w.a, w.b, w.y0, w.y1, 0.0, 0.02);
    box('frame', w.a, w.a + fr, w.y0, w.y1, d0, d1); box('frame', w.b - fr, w.b, w.y0, w.y1, d0, d1);
    box('frame', w.a, w.b, w.y0, w.y0 + fr, d0, d1); box('frame', w.a, w.b, w.y1 - fr, w.y1, d0, d1);
    const [cols, rows] = w.grid;
    for (let i = 1; i < cols; i++) { const t = w.a + (w.b - w.a) * i / cols; box('frame', t - 0.03, t + 0.03, w.y0, w.y1, d0, d1 - 0.02); }
    for (let j = 1; j < rows; j++) { const t = w.y0 + (w.y1 - w.y0) * j / rows; box('frame', w.a, w.b, t - 0.025, t + 0.025, d0, d1 - 0.02); }
  };
  for (const w of wins) {
    if (w.door) { fbox('door', w.a, w.b, w.y0, w.y1, 0.02, 0.1); fbox('stone', w.a - 0.3, w.b + 0.3, w.y1, w.y1 + 0.35, 0.3, 0.5); fbox('stone', w.a - 0.3, w.a - 0.05, w.y0, w.y1, 0.3, 0.48); fbox('stone', w.b + 0.05, w.b + 0.3, w.y0, w.y1, 0.3, 0.48); continue; }
    winFrames(w, fbox);
    fbox('stone', w.a - 0.12, w.b + 0.12, w.y0 - 0.14, w.y0, 0.3, 0.5);
    if (w.arch) fbox('stone', w.a - 0.1, w.b + 0.1, w.y1, w.y1 + 0.32, 0.36, 0.46);
    else if (w.y0 > 4) fbox('stone', w.a - 0.22, w.b + 0.22, w.y1 + 0.05, w.y1 + 0.36, 0.38, 0.5);
  }
  // stone bands: plinth, the band over the ground-floor windows, cornice; the raised parapet with its coping
  fbox('plinth', 0, L, base - gF, 0.45, 0.38, 0.5);
  fbox('stone', 0, L, 3.5, 3.8, 0.38, 0.5);
  fbox('stone', 0, MAIN, 7.3, 7.5, 0.38, 0.52);
  fbox('brickF', 0, MAIN, 7.5, 7.8, 0.4, 0.5);
  const p0 = bay * 0.55, p1 = MAIN - bay * 0.55;
  fbox('brickF', p0, p1, H, H + 1.15, 0.0, 0.4); fbox('stone', p0 - 0.05, p1 + 0.05, H + 1.15, H + 1.25, -0.05, 0.45);
  fbox('stone', 0, p0, H - 0.1, H + 0.02, -0.05, 0.45); fbox('stone', p1, MAIN, H - 0.1, H + 0.02, -0.05, 0.45);
  // as the architect's CGIs (A817 D&A pp. 57-58): brick piers between the five bays, a frieze of cast-iron vents under the
  // cornice, and the raised parapet stepped down at its ends
  for (let i = 0; i <= 5; i++) { const c = bay * i; fbox('brickF', Math.max(0, c - 0.3), Math.min(MAIN, c + 0.3), base - gF, 7.3, 0.4, 0.49); }
  for (let i = 0; i < 5; i++) for (const k of [0.28, 0.72]) { const c = bay * (i + k); fbox('lead', c - 0.3, c + 0.3, 7.53, 7.73, 0.5, 0.52); }
  for (const [a, b] of [[p0 - 0.75, p0], [p1, p1 + 0.75]]) { fbox('brickF', a, b, H, H + 0.55, 0.0, 0.4); fbox('stone', a - 0.05, b + 0.05, H + 0.55, H + 0.65, -0.05, 0.45); }
  // two pitched roofs behind the parapet over the main range, ridges along the street, a lead valley between them
  {
    const s0 = 0.42, s1 = MAIN - 0.1, d0 = -0.42, d1 = -(depth - 0.42), half = (d1 - d0) / 2, rise = 1.85;
    const slate = (sa, sb, da, ya, db, yb) => {   // one roof slope between two lines along s
      const g = new THREE.BufferGeometry(), P = (s, y, d) => new THREE.Vector3(s, gF + y, sg * d).applyMatrix4(M4).add(new THREE.Vector3(F0[0], 0, F0[1]));
      const a = P(sa, ya, da), b = P(sb, ya, da), c = P(sb, yb, db), e = P(sa, yb, db);
      const pos = []; const tri = (p, q, r) => { const nrm = new THREE.Vector3().subVectors(q, p).cross(new THREE.Vector3().subVectors(r, p)); if (nrm.y < 0) [q, r] = [r, q]; pos.push(...p.toArray(), ...q.toArray(), ...r.toArray()); };
      tri(a, b, c); tri(a, c, e);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const pp = g.attributes.position, uv = new Float32Array(pp.count * 2); for (let k = 0; k < pp.count; k++) { uv[2 * k] = (pp.getX(k) * dx + pp.getZ(k) * dz) / 2.6; uv[2 * k + 1] = pp.getY(k) / 1.4; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      add('slate', g);
    };
    for (const k of [0, 1]) {
      const da = d0 + k * 2 * half, dm = da + half, db = da + 2 * half;
      slate(s0, s1, da, EV, dm, EV + rise); slate(s0, s1, db, EV, dm, EV + rise);
      const gs = new THREE.Shape([new THREE.Vector2(sg * da, EV), new THREE.Vector2(sg * db, EV), new THREE.Vector2(sg * dm, EV + rise)]);
      for (const ss of [s0, s1]) { const gg = new THREE.ShapeGeometry(gs); gg.rotateY(-Math.PI / 2); gg.translate(ss, gF, 0); gg.applyMatrix4(M4); gg.translate(F0[0], 0, F0[1]); add('brickF', gg); }
      fbox('lead', s0, s1, EV + rise - 0.02, EV + rise + 0.08, dm - 0.12, dm + 0.12);   // lead ridge
    }
    fbox('lead', s0, s1, EV, EV + 0.06, d0 + half * 2 - 0.3, d0 + half * 2 + 0.3);   // the valley gutter
  }
  // the gabled entrance bay: a pitched roof running back from a brick gable with stone kneelers
  {
    const w = gb1 - gb0, rise = 2.6, dep = Math.min(9, depth - 0.6);
    const sh = new THREE.Shape([new THREE.Vector2(gb0, H - 0.05), new THREE.Vector2(gb1, H - 0.05), new THREE.Vector2(gc, H + rise)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: false }); g.translate(0, gF, sg > 0 ? -dep + 0.4 : -0.4); g.applyMatrix4(M4); g.translate(F0[0], 0, F0[1]); add('brickF', g);
    const ang = Math.atan2(rise, w / 2), len = Math.hypot(rise, w / 2) + 0.2;
    for (const k of [-1, 1]) {
      const r = new THREE.BoxGeometry(len, 0.12, dep + 0.3); r.rotateZ(-k * ang); r.translate(gc + k * w / 4, gF + H + rise / 2 + 0.08, sg * (-dep / 2 + 0.4)); r.applyMatrix4(M4); r.translate(F0[0], 0, F0[1]); add('slate', r);
      const c = new THREE.BoxGeometry(len, 0.14, 0.5); c.rotateZ(-k * ang); c.translate(gc + k * w / 4, gF + H + rise / 2 + 0.12, sg * 0.3); c.applyMatrix4(M4); c.translate(F0[0], 0, F0[1]); add('stone', c);
    }
    fbox('stone', gc - 0.35, gc + 0.35, 7.3, 8.0, 0.4, 0.5);
    fbox('wall', gb0 + 0.3, gb1 - 0.3, EV, H + 0.1, -dep + 0.4, -depth + 0.42);   // filled behind the gable roof
    // the stone roundel in the gable and a corbelled brick band under it (the D&A's 3D views)
    { const a = Math.atan2(nx, nz), at = (s, d) => [F0[0] + dx * s + nx * d, F0[1] + dz * s + nz * d];
      const r = new THREE.TorusGeometry(0.46, 0.08, 8, 28); r.rotateY(a); const [rx, rz] = at(gc, 0.45); r.translate(rx, gF + H + 0.95, rz); add('stone', r);
      const dsk = new THREE.CircleGeometry(0.4, 24); dsk.rotateY(a); const [qx, qz] = at(gc, 0.415); dsk.translate(qx, gF + H + 0.95, qz); add('brickF', dsk);
      for (let k = 0; k < 7; k++) { const s = gb0 + 0.55 + k * (w - 1.1) / 6; fbox('brickF', s - 0.16, s + 0.16, H - 0.32, H - 0.1, 0.4, 0.52); } }
  }
  // the other walls: windows on the garden side and on the Fletcher Street end, and the offices' entrance on that end
  const edgeFrame = (A, Bq) => {   // s along A -> B, d out of the building
    const ex = Bq[0] - A[0], ez = Bq[1] - A[1], l = Math.hypot(ex, ez), ux = ex / l, uz = ez / l; let ox = uz, oz = -ux;
    if (((A[0] + Bq[0]) / 2 - cx) * ox + ((A[1] + Bq[1]) / 2 - cz) * oz < 0) { ox = -ox; oz = -oz; }
    const g0 = Math.min(groundAt(...A), groundAt(...Bq));
    const rh = (-uz * ox + ux * oz) > 0, sx = rh ? 1 : -1;   // keep the frame right-handed (a mirrored one turns the boxes inside out)
    const box = (k, s0, s1, y0, y1, d0, d1) => { const g = new THREE.BoxGeometry(Math.max(0.005, s1 - s0), Math.max(0.005, y1 - y0), Math.max(0.005, Math.abs(d1 - d0))); g.translate(sx * (s0 + s1) / 2, (y0 + y1) / 2, (d0 + d1) / 2); g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(sx * ux, 0, sx * uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(ox, 0, oz)).setPosition(A[0], 0, A[1])); add(k, g); };
    return { len: l, g0, box, at: (s, d) => [A[0] + ux * s + ox * d, A[1] + uz * s + oz * d], u: [ux, uz], o: [ox, oz] };
  };
  const others = []; for (let i = 0; i < n; i++) { const A = poly[i], Bq = poly[(i + 1) % n]; if ((A === best.A && Bq === best.B) || (A === best.B && Bq === best.A)) continue; others.push([A, Bq]); }
  // the Fletcher Street end: the edge nearest the side block (lowest z midpoint)
  others.sort((a, b) => (a[0][1] + a[1][1]) - (b[0][1] + b[1][1]));
  const [endE, ...rest] = others;
  {
    const E = edgeFrame(...endE), y = (v) => E.g0 + v, c = E.len / 2;
    const wb = (k, s0, s1, y0, y1, d0, d1) => E.box(k, s0, s1, y(y0), y(y1), d0, d1);
    // as the architect's D&A (pp. 30, 38-39, 57): a tall arched stair window by the Wellington Street corner, the offices' door
    // in a stone surround under THE PRINT HOUSE set vertically, and arched windows on both floors towards the garden
    const atF0 = Math.hypot(E.at(0, 0)[0] - F0[0], E.at(0, 0)[1] - F0[1]) < 0.6, X = (x) => atF0 ? x : E.len - x;   // x: from the corner
    const span = (x0, x1) => [Math.min(X(x0), X(x1)), Math.max(X(x0), X(x1))];
    const arched = (x, wdt, y0, y1, rows) => {
      const [a, b] = span(x - wdt / 2, x + wdt / 2), w = { a, b, y0, y1, grid: [2, rows] };
      winFrames(w, (k, aa, bb, ya, yb, d0, d1) => wb(k, aa, bb, ya, yb, d0, d1));
      wb('stone', a - 0.1, b + 0.1, y0 - 0.14, y0, 0, 0.12);                                  // sill
      for (let k = 0; k < 7; k++) { const t0 = Math.PI * k / 7, t1 = Math.PI * (k + 1) / 7, r = (b - a) / 2 + 0.12, cx = (a + b) / 2;   // the arch head in stone voussoirs
        const xa = cx - r * Math.cos(t0), xb = cx - r * Math.cos(t1), ya = y1 + r * 0.55 * Math.sin(t0), yb = y1 + r * 0.55 * Math.sin(t1);
        wb(k === 3 ? 'stone' : 'stone', Math.min(xa, xb) - 0.02, Math.max(xa, xb) + 0.02, Math.min(ya, yb) - 0.05, Math.max(ya, yb) + 0.1, 0, 0.1); }
      wb('glass', a + 0.06, b - 0.06, y1, y1 + (b - a) / 2 * 0.5, 0.0, 0.02);                // the glazed lunette under the arch
    };
    const xd = 3.1, [d0, d1] = span(xd - 0.62, xd + 0.62), dc = (d0 + d1) / 2;
    arched(1.3, 0.9, 0.9, 6.3, 6);                                                             // the stair window, both floors
    for (const x of [5.2, 7.1, 9.0]) if (x + 0.6 < E.len) { arched(x, 1.1, 0.9, 2.95, 3); arched(x, 1.1, 4.4, 6.35, 3); }
    // the door: panelled, deep blue-black, in a stone surround with a keystone, a fanlight over, three stone steps
    wb('door', d0, d1, 0.12, 2.6, 0.06, 0.12);
    for (const [ya, yb] of [[0.35, 1.25], [1.45, 2.4]]) for (const [xa, xb] of [[d0 + 0.12, dc - 0.06], [dc + 0.06, d1 - 0.12]]) wb('frame', xa, xb, ya, yb, 0.12, 0.14);
    wb('glass', d0, d1, 2.7, 3.15, 0.04, 0.06); wb('frame', d0, d1, 2.6, 2.7, 0.04, 0.12);
    wb('stone', d0 - 0.32, d0 - 0.04, -0.3, 3.25, 0, 0.2); wb('stone', d1 + 0.04, d1 + 0.32, -0.3, 3.25, 0, 0.2);
    wb('stone', d0 - 0.42, d1 + 0.42, 3.25, 3.6, 0, 0.24); wb('stone', dc - 0.17, dc + 0.17, 3.15, 3.7, 0.05, 0.3);
    wb('brass', dc + 0.25, dc + 0.31, 1.15, 1.45, 0.12, 0.16);
    for (let k = 0; k < 3; k++) wb('stone', d0 - 0.55 - k * 0.15, d1 + 0.55 + k * 0.15, -0.3, 0.12 - k * 0.14, 0.12, 0.55 + k * 0.32);
    for (const sx of [d0 - 0.75, d1 + 0.75]) { wb('steel', sx - 0.1, sx + 0.1, 2.2, 2.65, 0.0, 0.22); wb('lamp', sx - 0.07, sx + 0.07, 2.27, 2.58, 0.06, 0.2); }
    // a brass name plate by the door
    {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
      x.fillStyle = '#b8924a'; x.fillRect(0, 0, 512, 256); x.fillStyle = '#2b2116'; x.textAlign = 'center';
      x.font = '700 64px "Archivo", "Helvetica Neue", Arial, sans-serif'; x.fillText('THE PRINT HOUSE', 256, 112); x.font = '500 40px "Archivo", Arial, sans-serif'; x.fillText('OFFICES · SEATON HOUSE', 256, 182);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.6 }));
      const [px, pz] = E.at(atF0 ? d1 + 0.75 : d0 - 0.75, 0.05); m.position.set(px, y(1.5), pz); m.rotation.y = Math.atan2(E.o[0], E.o[1]); group.add(m);
    }
    // THE PRINT HOUSE in white letters set vertically over the door, as the CGI from Wellington Street
    {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 768; const x = cv.getContext('2d');
      x.fillStyle = '#f2ede4'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const lines = ['THE', 'PRINT', 'HOUSE']; let fs = 220; x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`;
      const tw = Math.max(...lines.map(l => x.measureText(l).width)); if (tw > 490) { fs = Math.floor(fs * 490 / tw); x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`; }
      lines.forEach((l, k) => x.fillText(l, 256, 128 + k * 256));
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.55), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.7 }));
      const [px, pz] = E.at(dc, 0.04); m.position.set(px, y(5.15), pz); m.rotation.y = Math.atan2(E.o[0], E.o[1]); m.name = 'seatonSignV'; group.add(m);
    }
    // the forecourt: sandstone flags out to the pavement, two planters
    const fc = [E.at(-0.6, 0.02), E.at(E.len + 0.4, 0.02), E.at(E.len + 0.4, 4.4), E.at(-0.6, 4.4)];
    keep.push([E.at(-0.6, 0), E.at(E.len + 0.4, 0), E.at(E.len + 0.4, 4.75), E.at(-0.6, 4.75)]);
    const fg = new THREE.PlaneGeometry(1, 1, 10, 6), fp = fg.attributes.position;
    for (let k = 0; k < fp.count; k++) { const a = fp.getX(k) + 0.5, b = 0.5 - fp.getY(k); const px = fc[0][0] + (fc[1][0] - fc[0][0]) * a + (fc[3][0] - fc[0][0]) * b, pz = fc[0][1] + (fc[1][1] - fc[0][1]) * a + (fc[3][1] - fc[0][1]) * b; fp.setXYZ(k, px, Math.max(groundAt(px, pz), E.g0 - 0.3) + 0.06, pz); }
    { const uv = fg.attributes.uv; for (let k = 0; k < fp.count; k++) uv.setXY(k, fp.getX(k) / 1.6, fp.getZ(k) / 1.6); }
    fg.computeVertexNormals(); { const nn = fg.attributes.normal; if (nn.getY(0) < 0) { const idx = fg.index; for (let k = 0; k < idx.count; k += 3) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); } fg.computeVertexNormals(); } }
    add('flags', fg);
    for (const sx of [dc - 2.05, dc + 2.05]) { wb('pot', sx - 0.45, sx + 0.45, -0.3, 0.6, 0.6, 1.5); if (opts.forest) { const [px, pz] = E.at(sx, 1.05); opts.forest.add(px, pz, { h: 1.6, r: 0.5, kind: 'shrub', seed: 6100 + Math.round(sx * 10), y: y(0.6) }); } }
    // a low brick wall with stone coping and railings along the pavement edge, open in front of the door (D&A 3D views)
    for (let x = -0.6; x < E.len + 0.4 - 0.01; x += 0.5) {
      const x1 = Math.min(E.len + 0.4, x + 0.5), xm = (x + x1) / 2; if (Math.abs(xm - dc) < 1.7) continue;
      const [gx, gz] = E.at(xm, 4.45), gy = Math.max(groundAt(gx, gz), E.g0 - 0.3) - E.g0;
      wb('wall', x, x1, gy - 0.3, gy + 0.55, 4.3, 4.6); wb('stone', x - 0.01, x1 + 0.01, gy + 0.55, gy + 0.63, 4.27, 4.63);
      for (let q = 0; q < 4; q++) { const xb = x + (q + 0.5) * (x1 - x) / 4; wb('steel', xb - 0.012, xb + 0.012, gy + 0.63, gy + 1.45, 4.44, 4.46); }
      wb('steel', x, x1, gy + 1.38, gy + 1.43, 4.42, 4.48); wb('steel', x, x1, gy + 0.72, gy + 0.75, 4.43, 4.47);
    }
  }
  // the garden side and the far end, as the courtyard CGI: tall windows on the ground floor, long low strips of glazing under
  // the eaves on the first floor, a stone band below the parapet
  for (const [A, Bq] of rest) {
    const E = edgeFrame(A, Bq); if (E.len < 6) continue;
    const bx = (kk, a, b2, ya, yb, d0, d1) => E.box(kk, a, b2, E.g0 + ya, E.g0 + yb, d0, d1);
    const nw = Math.floor((E.len - 1) / 3.2), pad = (E.len - nw * 3.2) / 2;
    for (let k = 0; k < nw; k++) {
      const c = pad + k * 3.2 + 1.6;
      winFrames({ a: c - 0.55, b: c + 0.55, y0: 0.7, y1: 3.1, grid: [1, 3] }, bx); bx('stone', c - 0.65, c + 0.65, 0.56, 0.7, 0, 0.12); bx('stone', c - 0.65, c + 0.65, 3.1, 3.3, 0, 0.1);
      winFrames({ a: c - 1.35, b: c + 1.35, y0: 5.55, y1: 6.55, grid: [3, 1] }, bx); bx('stone', c - 1.45, c + 1.45, 5.41, 5.55, 0, 0.12);
    }
    bx('stone', 0, E.len, 7.6, 7.82, 0, 0.1);
  }
  // ---- THE COURTYARD (A817 D&A pp. 21, 25, 43, 58): the residents' way in from Wellington Street, a single-storey brick screen
  // with a tall black steel gate across the gap at the west end; a flagged path steps down past the bike store to the garden
  {
    const at = (s, d) => [F0[0] + dx * s + nx * d, F0[1] + dz * s + nz * d];
    const s0 = L, s1 = L + 4.1, gl = groundAt(...at(L + 2, 0.8)) - gF, yG = phBaseY(groundAt) - gF, ga = s0 + 0.8, gb = s1 - 0.8, gh = 3.2;
    fbox('wall', s0, ga, gl - 0.4, gl + 4.3, 0, 0.4); fbox('wall', gb, s1, gl - 0.4, gl + 4.3, 0, 0.4); fbox('wall', ga, gb, gl + gh, gl + 4.3, 0, 0.4);
    fbox('wall', s1 - 0.4, s1, gl - 2.4, gl + 4.3, -3.0, 0);
    fbox('stone', s0, s1, gl + gh, gl + gh + 0.22, 0.4, 0.48); fbox('stone', s0 - 0.03, s1 + 0.03, gl + 4.3, gl + 4.42, -0.05, 0.46); for (const [a, b] of [[s0, ga], [gb, s1]]) fbox('stone', a, b, gl - 0.4, gl + 0.3, 0.4, 0.46);
    for (let x = ga + 0.06; x < gb - 0.03; x += 0.12) fbox('steel', x - 0.012, x + 0.012, gl + 0.05, gl + gh - 0.05, 0.18, 0.21);
    for (const yy of [0.12, 1.65, gh - 0.12]) fbox('steel', ga, gb, gl + yy - 0.04, gl + yy + 0.04, 0.16, 0.23);
    fbox('steel', (ga + gb) / 2 - 0.03, (ga + gb) / 2 + 0.03, gl + 0.05, gl + gh - 0.05, 0.15, 0.24);
    {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 160; const x = cv.getContext('2d');
      x.fillStyle = '#f2ede4'; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = 128; x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`;
      const tw = x.measureText('THE COURTYARD').width; if (tw > 990) { fs = Math.floor(fs * 990 / tw); x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`; }
      x.fillText('THE COURTYARD', 512, 84);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7 * 160 / 1024), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.7 }));
      const [px, pz] = at((s0 + s1) / 2, 0.42); m.position.set(px, gF + gl + 3.86, pz); m.rotation.y = Math.atan2(nx, nz); m.name = 'courtyardSign'; group.add(m);
    }
    // the path, stepping down in shallow flights from the gate to the garden behind Seaton House
    keep.push([at(s0, 0.6), at(s1 + 0.1, 0.6), at(s1 + 0.1, -depth - 4.2), at(s0, -depth - 4.2)]);
    const pa = s0 + 0.12, pb = s0 + 2.25, dA = 0.35, dB = -depth - 2.4, n = 16;
    for (let k = 0; k < n; k++) {
      const da = dA + (dB - dA) * k / n, db = dA + (dB - dA) * (k + 1) / n, yk = gl + (yG - gl) * (k + 0.5) / n;
      fbox('flags', pa, pb, yk - 1.6, yk + 0.06, db, da);
    }
    // the bike store against the boundary: steel frame, timber slat back, a sedum roof, Sheffield stands
    const ba = pb + 0.25, bb = s1 - 0.42, bd0 = -1.4, bd1 = -9.6, by = gl + (yG - gl) * 0.35;
    fbox('flags', ba, bb + 0.3, by - 1.6, by + 0.04, bd1 - 0.3, bd0 + 0.3);
    for (let d = bd0; d >= bd1 - 0.01; d -= (bd0 - bd1) / 4) { for (const x of [ba + 0.05, bb - 0.05]) fbox('steel', x - 0.05, x + 0.05, by, by + 2.3, d - 0.05, d + 0.05); }
    fbox('steel', ba - 0.05, bb + 0.1, by + 2.3, by + 2.42, bd1 - 0.15, bd0 + 0.15); fbox('sedum', ba, bb + 0.05, by + 2.42, by + 2.5, bd1 - 0.1, bd0 + 0.1);
    for (let d = bd0 - 0.1; d > bd1 + 0.05; d -= 0.16) fbox('timber', bb - 0.06, bb, by + 0.1, by + 2.25, d - 0.05, d + 0.05);
    for (let d = bd0 - 0.6; d > bd1 + 0.3; d -= 0.9) { for (const e of [-0.28, 0.28]) fbox('steel', ba + 0.35, ba + 0.39, by, by + 0.8, d + e - 0.02, d + e + 0.02); fbox('steel', ba + 0.35, ba + 0.39, by + 0.76, by + 0.82, d - 0.3, d + 0.3); }
    // the railing along the neighbour's side, 1.8 m, black
    for (let d = -0.3; d > -depth - 4; d -= 0.5) {
      const d1 = Math.max(-depth - 4, d - 0.5), yq = gl + (yG - gl) * Math.min(1, (-d) / (-dB));
      fbox('wall', s1 - 0.18, s1 + 0.02, yq - 1.2, yq + 0.3, d1, d);
      for (let q = 0; q < 4; q++) { const dd = d - (q + 0.5) * (d - d1) / 4; fbox('steel', s1 - 0.1, s1 - 0.07, yq + 0.3, yq + 1.8, dd - 0.012, dd + 0.012); }
      fbox('steel', s1 - 0.11, s1 - 0.06, yq + 1.72, yq + 1.78, d1, d);
    }
  }
  // materials (none of these are cut by the floor section, which belongs to the apartment building)
  const plain = (m, o = {}) => { const c = m.clone(); c.clippingPlanes = null; c.side = THREE.FrontSide; Object.assign(c, o); return c; };
  const brick = plain(M.cBrick || M.brick, { side: THREE.DoubleSide });
  const mats = {
    wall: brick, brickF: brick, plinth: plain(M.brick2 || M.cBrickOld || brick), stone: plain(M.stone), slate: plain(M.slate || M.cSlate, { side: THREE.DoubleSide }),
    lead: new THREE.MeshStandardMaterial({ color: '#3c4043', roughness: 0.55, metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: '#20272d', roughness: 0.12, metalness: 0.4, envMapIntensity: 1.4 }),
    frame: new THREE.MeshStandardMaterial({ color: '#2a2827', roughness: 0.5, metalness: 0.3 }),
    door: new THREE.MeshStandardMaterial({ color: '#1f3a2e', roughness: 0.45, metalness: 0.1 }),
    steel: new THREE.MeshStandardMaterial({ color: '#1f2225', roughness: 0.42, metalness: 0.6 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a24f', roughness: 0.3, metalness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: new THREE.Color('#ffcf88'), emissiveIntensity: 0.6, roughness: 0.4 }),
    pot: new THREE.MeshStandardMaterial({ color: '#33363a', roughness: 0.6, metalness: 0.2 }),
    flags: (() => { const m = plain(M.paving); m.color = new THREE.Color('#d8cdb8'); return m; })(),
    sedum: new THREE.MeshStandardMaterial({ color: '#6e7f3e', roughness: 0.95 }),
    timber: new THREE.MeshStandardMaterial({ color: '#8a6a48', roughness: 0.8 }),
  };
  for (const [k, list] of Object.entries(G)) {
    const g = mergeGeometries(list.map(x => { if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); if (!x.attributes.normal) x.computeVertexNormals(); return x; }), false);
    if (!g) continue;
    if (k === 'wall' || k === 'brickF' || k === 'plinth') {   // brick-sized UVs along each face
      g.computeVertexNormals(); const p = g.attributes.position, nn = g.attributes.normal, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) { const ax = Math.abs(nn.getX(i)), az = Math.abs(nn.getZ(i)), ay = Math.abs(nn.getY(i)); const hz = ay > 0.7; uv[2 * i] = (hz ? p.getX(i) : ax > az ? p.getZ(i) : p.getX(i)) / 2.2; uv[2 * i + 1] = (hz ? p.getZ(i) : p.getY(i)) / 2.2; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const m = new THREE.Mesh(g, mats[k] || mats.stone); m.castShadow = !['glass', 'flags'].includes(k); m.receiveShadow = true; m.name = 'seaton_' + k; group.add(m);
  }
  // THE PRINT HOUSE in white letters, centred on the raised parapet and filling it
  {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 192; const x = c.getContext('2d');
    x.fillStyle = '#f2ede4'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let fs = 150; x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`; const tw = x.measureText('THE PRINT HOUSE').width; if (tw > 1960) { fs = Math.floor(fs * 1960 / tw); x.font = `700 ${fs}px "Archivo", "Helvetica Neue", Arial, sans-serif`; }
    x.fillText('THE PRINT HOUSE', 1024, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const sw = Math.min((p1 - p0) * 0.9, 0.95 * 2048 / 192), m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 192 / 2048), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.7 }));
    const sc = (p0 + p1) / 2;
    m.position.set(F0[0] + dx * sc + nx * 0.42, gF + H + 0.58, F0[1] + dz * sc + nz * 0.42); m.rotation.y = Math.atan2(nx, nz); m.name = 'seatonSign';
    group.add(m);
  }
  group.userData = { front: { F0, F1, nx, nz, gF, top }, keep };
  return group;
}

// "THE PRINT HOUSE" in white letters on Seaton House's parapet, as in the CGI of the Wellington Street frontage
export function buildSeatonSign(groundAt) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 112; const x = c.getContext('2d');
  x.fillStyle = '#f4efe6'; x.font = '600 84px "Archivo", "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,.25)'; x.shadowBlur = 4; x.fillText('THE PRINT HOUSE', 512, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 0.94), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.2, roughness: 0.6 }));
  const mx = -26.5, mz = 213, nx = 0.96, nz = 0.28;
  m.position.set(mx + nx * 0.42, groundAt(mx + nx * 3, mz + nz * 3) + 7.6, mz + nz * 0.42); m.rotation.y = Math.atan2(nx, nz); m.name = 'seatonSign';
  return m;
}
