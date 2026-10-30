// Instanced broadleaf trees: tapered bark trunks + leaf-card crowns with rounded "crown normals",
// warm translucency against the sun and a gentle wind sway.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const windUniforms = { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTrans: { value: 1 }, uNear: { value: 9 } };

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export class Forest {
  constructor(leafTex, barkMat, groundY, leafAlpha = null) {
    this.leafTex = leafTex; this.leafAlpha = leafAlpha; this.barkMat = barkMat; this.groundY = groundY || (() => 0);
    this.cards = []; this.trunks = []; this.crowns = []; this.far = [];
    this.focus = [11, 10]; this.lodR = 230;   // beyond this distance from the site, trees are drawn as solid crowns
  }

  // kind: 'oak' (big, rounded), 'sycamore', 'birch' (light, narrow), 'shrub', 'grass', 'hedge'
  add(x, z, { h = 18, r = 7, kind = 'oak', seed = 1, density = 1, y = null, tint = null } = {}) {
    const R = rng(seed * 9301 + 49297);
    const low = kind === 'shrub' || kind === 'grass' || kind === 'hedge' || kind === 'pot';
    const gy = y ?? this.groundY(x, z);
    const trunkH = low ? 0 : h * (kind === 'birch' ? 0.34 : 0.27);
    const crownC = new THREE.Vector3(x, gy + trunkH + (h - trunkH) * 0.5, z);
    if (!low && Math.hypot(x - this.focus[0], z - this.focus[1]) > this.lodR) {
      // distant tree: a plain trunk and a lumpy solid crown (no leaf cards), a fraction of the cost to draw
      if (trunkH > 0) { const tr = (kind === 'birch' ? 0.012 : 0.022) * h; const g = new THREE.CylinderGeometry(tr * 0.6, tr, trunkH + (h - trunkH) * 0.3, 5, 1); g.translate(x, gy + (trunkH + (h - trunkH) * 0.3) / 2, z); this.trunks.push(g); }
      const cr = kind === 'birch' ? r * 0.62 : r, ch = (h - trunkH) * 0.52;
      this.far.push({ x, y: crownC.y, z, cr, ch, seed, kind, tint });
      this.crowns.push([x, crownC.y, z, cr, ch]);
      return;
    }
    if (trunkH > 0) {
      const tr = (kind === 'birch' ? 0.012 : 0.022) * h;
      const g = new THREE.CylinderGeometry(tr * 0.55, tr, trunkH + (h - trunkH) * 0.35, 9, 1);
      g.translate(x, gy + (trunkH + (h - trunkH) * 0.35) / 2, z);
      this.trunks.push(g);
      // main limbs reaching into the crown
      const limbs = kind === 'birch' ? 2 : 4;
      for (let i = 0; i < limbs; i++) {
        const a = R() * Math.PI * 2, L = (h - trunkH) * (0.45 + R() * 0.2);
        const lg = new THREE.CylinderGeometry(tr * 0.18, tr * 0.42, L, 6, 1);
        lg.translate(0, L / 2, 0);
        lg.rotateZ(0.55 + R() * 0.35); lg.rotateY(a);
        lg.translate(x, gy + trunkH * (0.85 + R() * 0.25), z);
        this.trunks.push(lg);
      }
    }
    // foliage clumps on the crown ellipsoid
    const cr = kind === 'birch' ? r * 0.6 : r;
    const ch = (h - trunkH) * 0.55;
    if (!low) this.crowns.push([x, crownC.y, z, cr, ch]);
    const nClump = Math.round((kind === 'pot' ? 7 : kind === 'shrub' ? 5 : kind === 'grass' ? 3 : kind === 'hedge' ? 4 : 9 + r * 1.8) * density);
    const cardSize = kind === 'pot' ? 0.36 : kind === 'grass' ? 0.9 : kind === 'shrub' ? 1.1 : kind === 'hedge' ? 1.1 : kind === 'birch' ? 1.6 : 2.6 + r * 0.06;
    const perClump = kind === 'pot' ? 10 : kind === 'grass' ? 7 : kind === 'shrub' ? 9 : kind === 'hedge' ? 10 : 11;
    const baseTint = tint || (kind === 'birch' ? [1.08, 1.12, 0.92] : kind === 'grass' ? [1.15, 1.08, 0.75] : [1, 1, 1]);
    for (let c = 0; c < nClump; c++) {
      // fibonacci-ish shell + some interior
      const u = R(), v = R();
      const th = 2 * Math.PI * u, ph = Math.acos(1 - 1.85 * v);   // slight bias to the upper half
      const rad = 0.62 + 0.38 * Math.cbrt(R());
      const cx = x + Math.sin(ph) * Math.cos(th) * cr * rad;
      const cz = z + Math.sin(ph) * Math.sin(th) * cr * rad;
      const cy = crownC.y + Math.cos(ph) * ch * rad - (low ? 0 : ch * 0.15);
      const clumpR = kind === 'pot' ? 0.14 : kind === 'grass' ? 0.35 : kind === 'shrub' || kind === 'hedge' ? 0.5 : cr * 0.32;
      for (let k = 0; k < perClump; k++) {
        const px = cx + (R() - 0.5) * 2 * clumpR, py = kind === 'pot' ? gy + 0.18 + R() * h * 0.8 : (kind === 'shrub' || kind === 'grass' || kind === 'hedge') ? gy + 0.3 + R() * h * 0.8 : cy + (R() - 0.5) * 2 * clumpR * 0.8, pz = cz + (R() - 0.5) * 2 * clumpR;
        const s = cardSize * (0.75 + R() * 0.5);
        const tile = Math.floor(R() * 4);
        const tv = 0.85 + R() * 0.3;
        // face the card outward from the crown (with jitter) so leaves read crisply, not edge-on
        const nx = px - crownC.x + (R() - 0.5) * cr * 0.6, ny = (py - crownC.y) * 1.2 + (R() - 0.5) * cr * 0.5 + cr * 0.2, nz = pz - crownC.z + (R() - 0.5) * cr * 0.6;
        this.cards.push({
          p: [px, py, pz], s, n: [nx, ny, nz], roll: R() * Math.PI * 2,
          tile, tint: [baseTint[0] * tv, baseTint[1] * tv, baseTint[2] * tv], c: [crownC.x, kind === 'pot' ? gy + h * 0.3 : low ? gy - 0.5 : crownC.y, crownC.z],
        });
      }
    }
  }

  build(castShadow = true) {
    const group = new THREE.Group(); group.name = 'trees';
    if (this.trunks.length) {
      const g = mergeGeometries(this.trunks.map(t => t.toNonIndexed()), false);
      const m = new THREE.Mesh(g, this.barkMat); m.castShadow = castShadow; m.receiveShadow = true; group.add(m);
    }
    const n = this.cards.length;
    const quad = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({ map: this.leafTex, alphaMap: this.leafAlpha, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.72, metalness: 0, envMapIntensity: 0.7, color: '#dfe6c3' });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, windUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
attribute float aTile; attribute vec3 aTint; attribute vec3 aCenter;
uniform float uTime; varying vec3 vTint; varying vec3 vCrownN; varying vec3 vWP;`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
vMapUv = (uv * 0.5) + vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;
#endif
#ifdef USE_ALPHAMAP
vAlphaMapUv = (uv * 0.5) + vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;
#endif`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
float sway = sin(uTime * 1.3 + ip.x * 0.31 + ip.z * 0.17) * 0.06 + sin(uTime * 2.7 + ip.y) * 0.03;
transformed.x += sway * (position.y + 0.5);
transformed.z += sway * 0.6 * (position.x + 0.5);`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
vec4 ipn = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
vec3 cn = normalize(ipn.xyz - aCenter + vec3(0.0, 0.25, 0.0));
// express the crown normal in the instance's local space so the regular pipeline transforms it
objectNormal = normalize(mix(objectNormal, (transpose(mat3(instanceMatrix)) * cn), 0.82));
vTint = aTint; vCrownN = cn; vWP = ipn.xyz;`)
      ;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec3 uSunDir; uniform float uTrans, uNear; varying vec3 vTint; varying vec3 vCrownN; varying vec3 vWP;`)
        .replace('#include <normal_fragment_begin>', `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
vec3 normal = normalize( vNormal );   // crown normal: deliberately not flipped on back faces
vec3 nonPerturbedNormal = normal;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
diffuseColor.rgb *= vTint;`)
        .replace('#include <alphatest_fragment>', `
// cards seen edge-on smear into streaks: demand a more solid texel the more grazing the card is
vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
float facing = abs(dot(fN, normalize(vViewPosition)));
float thr = mix(1.01, 0.5, smoothstep(0.12, 0.42, facing));
if (diffuseColor.a < thr) discard;
// dissolve leaves close to the camera, so orbiting or flying never puts a wall of foliage in your face
float camD = length(vViewPosition);
float keep = smoothstep(uNear * 0.35, uNear, camD);
float dn = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
if (keep < dn) discard;
diffuseColor.a = 1.0;`)
        .replace('#include <opaque_fragment>', `
// soft translucency: leaves glow when the sun is behind them, inner crown darker
float back = clamp(dot(normalize(cameraPosition - vWP), -uSunDir), 0.0, 1.0);
float rim = clamp(dot(vCrownN, -uSunDir) * 0.5 + 0.5, 0.0, 1.0);
outgoingLight += diffuseColor.rgb * vec3(1.0, 0.85, 0.45) * pow(back, 3.0) * rim * 0.55 * uTrans;
outgoingLight *= mix(0.78, 1.0, clamp(dot(vCrownN, vec3(0.0,1.0,0.0)) * 0.5 + 0.55, 0.0, 1.0));
outgoingLight += diffuseColor.rgb * vec3(0.07, 0.09, 0.05);   // skylight scattering through the canopy
#include <opaque_fragment>`);
    };
    const mesh = new THREE.InstancedMesh(quad, mat, n);
    const tile = new Float32Array(n), tint = new Float32Array(n * 3), cen = new Float32Array(n * 3);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const zf = new THREE.Vector3(0, 0, 1), nv = new THREE.Vector3(), qr = new THREE.Quaternion();
    this.cards.forEach((c, i) => {
      nv.set(...c.n); if (nv.lengthSq() < 1e-6) nv.set(0, 1, 0); nv.normalize();
      q.setFromUnitVectors(zf, nv); qr.setFromAxisAngle(zf, c.roll); q.multiply(qr);
      s.set(c.s, c.s, c.s); p.set(...c.p);
      m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
      tile[i] = c.tile; tint.set(c.tint, i * 3); cen.set(c.c, i * 3);
    });
    quad.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 1));
    quad.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    quad.setAttribute('aCenter', new THREE.InstancedBufferAttribute(cen, 3));
    mesh.castShadow = castShadow; mesh.receiveShadow = true;
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: this.leafAlpha, alphaTest: 0.5 });
    mesh.customDepthMaterial.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
vMapUv = (uv * 0.5) + vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;
#endif
#ifdef USE_ALPHAMAP
vAlphaMapUv = (uv * 0.5) + vec2(mod(aTile, 2.0), floor(aTile / 2.0)) * 0.5;
#endif`);
    };
    mesh.frustumCulled = false;
    mesh.name = 'leaves';
    group.add(mesh);
    if (this.far.length) group.add(this.buildFar());
    return group;
  }
  buildFar() {
    // lumpy icosphere, two per tree (main crown + a side lobe), tinted per tree
    let g = new THREE.IcosahedronGeometry(1, 2); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + 0.13 * Math.sin(x * 5.1 + y * 3.7) * Math.sin(z * 4.3 - y * 2.9) + 0.07 * Math.sin(x * 11 + z * 9); p.setXYZ(i, x * n, y * n, z * n); }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, metalness: 0, envMapIntensity: 0.18 });
    const n = this.far.length * 2, m = new THREE.InstancedMesh(g, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p3 = new THREE.Vector3(), c = new THREE.Color();
    this.far.forEach((t, i) => {
      const R = rng(t.seed * 31 + 7);
      const base = t.kind === 'birch' ? [0.2, 0.27, 0.14] : [0.13 + R() * 0.04, 0.2 + R() * 0.05, 0.09 + R() * 0.03];
      const tt = t.tint || [1, 1, 1];
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      m4.compose(p3.set(t.x, t.y, t.z), q, s.set(t.cr * 0.95, t.ch * 1.05, t.cr * 0.95)); m.setMatrixAt(i * 2, m4);
      m.setColorAt(i * 2, c.setRGB(base[0] * tt[0], base[1] * tt[1], base[2] * tt[2]));
      const a = R() * 6.28;
      m4.compose(p3.set(t.x + Math.cos(a) * t.cr * 0.45, t.y + t.ch * 0.25, t.z + Math.sin(a) * t.cr * 0.45), q, s.set(t.cr * 0.62, t.ch * 0.7, t.cr * 0.62)); m.setMatrixAt(i * 2 + 1, m4);
      m.setColorAt(i * 2 + 1, c.setRGB(base[0] * tt[0] * 1.12, base[1] * tt[1] * 1.12, base[2] * tt[2] * 1.05));
    });
    m.castShadow = false; m.receiveShadow = true; m.name = 'farcrowns';
    return m;
  }
}
