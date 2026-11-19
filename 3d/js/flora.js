// Flowers that read as flowers (Charlie, 19 Nov 2026: "sort these coloured balls out, do flowers").
// Each bloom is a flat five-petal head with a centre, tipped a little and held on a short stem above a mound of leaves.
// Shared by Charter House (courtyard beds, the planters under the ground-floor windows, front-door pots) and the Print House
// (its garden and the garden next door). Geometry goes into the caller's buckets through add(key, geometry); the keys are
// materials that floraMaterials() puts into M.
import * as THREE from 'three';

export const PETAL_COLOURS = ['#f4a6c0', '#fbfaf5', '#b49ce6', '#f6cf4f', '#e65a67', '#f7b993', '#9fb7f2', '#d9438a'];

export function floraMaterials(M, clippingPlanes = null) {
  if (M.flLeaf) return M;
  const mk = (o) => new THREE.MeshStandardMaterial(clippingPlanes ? { ...o, clippingPlanes } : o);   // clipped with the floor cut, like the pots
  PETAL_COLOURS.forEach((c, i) => { M['flPetal' + i] = mk({ color: c, roughness: 0.62, side: THREE.DoubleSide }); });
  M.flCentre = mk({ color: '#e7b425', roughness: 0.8 });
  M.flCentreDark = mk({ color: '#5b3a1e', roughness: 0.85 });
  M.flLeaf = mk({ color: '#4f7a3a', roughness: 0.82 });
  M.flLeafDark = mk({ color: '#36592b', roughness: 0.85 });
  M.flSoil = mk({ color: '#3d2f24', roughness: 1 });
  return M;
}

// one flower outline, made once: five rounded petals, cupped a little
const HEAD = (() => {
  const s = new THREE.Shape(), N = 30;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, k = 0.42 + 0.58 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.7);
    const x = Math.cos(a) * k, y = Math.sin(a) * k; if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  const g = new THREE.ShapeGeometry(s, 1); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, 0.22 * (x * x + z * z)); }   // cupped
  g.computeVertexNormals(); return g;
})();
const CENTRE = (() => { const g = new THREE.SphereGeometry(0.3, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.55, 1); return g; })();

export function makeFlora(add0, seed = 7) {
  const add = (k, g) => add0(k, g.index ? g.toNonIndexed() : g);   // every caller's merge gets non-indexed geometry
  let sd = seed >>> 0 || 7; const R = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const leafBlob = (x, y, z, r, key) => {
    const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(p.getX(i) * 53 + x * 7) * Math.sin(p.getZ(i) * 47 + z * 5)) * 0.14; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.62, p.getZ(i) * k); }
    g.computeVertexNormals(); g.translate(x, y, z); add(key, g);
  };
  // a single flower: r is the head radius (0.025 to 0.06 m), stem from y0 up to y
  const head = (x, y, z, r, ci = Math.floor(R() * PETAL_COLOURS.length), y0 = null) => {
    const g = HEAD.clone(); g.scale(r, r, r); g.rotateY(R() * Math.PI * 2); g.rotateX((R() - 0.5) * 0.7); g.rotateZ((R() - 0.5) * 0.7); g.translate(x, y, z); add('flPetal' + ci, g);
    const c = CENTRE.clone(); c.scale(r, r, r); c.translate(x, y + r * 0.08, z); add(ci === 3 || ci === 5 ? 'flCentreDark' : 'flCentre', c);
    if (y0 !== null && y - y0 > 0.03) { const s = new THREE.CylinderGeometry(0.004, 0.005, y - y0, 4); s.translate(x, (y + y0) / 2, z); add('flLeaf', s); }
  };
  // a flowering plant: a low mound of leaves with n flowers of one or two colours held just above it
  const clump = (x, y, z, r, n = 7, palette = null) => {
    const nb = 3 + Math.floor(R() * 3);
    for (let i = 0; i < nb; i++) { const a = R() * Math.PI * 2, d = R() * r * 0.45; leafBlob(x + Math.cos(a) * d, y + r * 0.28, z + Math.sin(a) * d, r * (0.45 + R() * 0.25), R() < 0.5 ? 'flLeaf' : 'flLeafDark'); }
    const cs = palette || [Math.floor(R() * PETAL_COLOURS.length)]; if (!palette && R() < 0.35) cs.push(Math.floor(R() * PETAL_COLOURS.length));
    const top = y + r * 0.6;
    for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.85; head(x + Math.cos(a) * d, top + R() * r * 0.35, z + Math.sin(a) * d, 0.028 + R() * 0.022, cs[i % cs.length], y + r * 0.2); }
  };
  // fill a rectangle of soil with flowering plants (y = soil level)
  const bed = (x0, z0, x1, z1, y, density = 1, palette = null) => {
    const step = 0.26 / Math.sqrt(density);
    for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) {
      if (R() < 0.18) continue;
      clump(x + (R() - 0.5) * step * 0.5, y, z + (R() - 0.5) * step * 0.5, 0.1 + R() * 0.06, 4 + Math.floor(R() * 5), palette);
    }
  };
  // a scatter of flowers through existing planting (no leaves of its own), heads at y .. y + dy
  const scatter = (x0, z0, x1, z1, y, n, dy = 0.15) => { for (let i = 0; i < n; i++) { const yy = y + R() * dy; head(x0 + R() * (x1 - x0), yy, z0 + R() * (z1 - z0), 0.03 + R() * 0.022, undefined, yy - 0.12); } };
  return { head, clump, bed, scatter, leafBlob, R };
}
