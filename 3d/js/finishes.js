// Procedural interior finishes for the fitted-out homes: oak planks, sisal and carpet, porcelain and ceramic tiles and
// travertine, drawn once on canvases (seamless tiles, sized in metres) and mapped onto the fit-out boxes by world-scale
// box projection. The same textures go out in the floor exports, so the photoreal 360s get the real grain and joints too.
import * as THREE from 'three';

const cache = new Map();
const rgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hsh = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const n1 = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 5.1) * 0.2;
function canvasTex(w, h, draw, size, rot = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  draw(img.data, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.userData.size = size; t.userData.rot = rot;
  return t;
}
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

// engineered oak planks: 190 mm boards in random lengths, staggered, with grain, the odd knot and a micro-bevel at the joints.
// The tile is 12 boards (2.28 m) across and 4.4 m along; `along` = 'u' runs the boards along the plan's x axis.
export function plankTexture({ base = '#d3b590', boards = 12, w = 0.19, len = 4.4, along = 'v', seed = 1 } = {}) {
  return memo('plank' + base + boards + w + len + along + seed, () => {
    const B = rgb(base), W = 1024, H = 2048, pw = W / boards, tileW = boards * w;
    return canvasTex(W, H, (d) => {
      for (let c = 0; c < boards; c++) {
        // periodic cut points along the board column, 1.1-2.3 m apart
        const cuts = []; let y = hsh(c, seed) * len;
        while (cuts.length < 8) { cuts.push(y % len); y += 1.1 + 1.2 * hsh(c * 13 + cuts.length, seed + 3); if (y - cuts[0] > len - 0.9) break; }
        cuts.sort((a, b) => a - b);
        const x0 = Math.round(c * pw), x1 = Math.round((c + 1) * pw);
        for (let py = 0; py < H; py++) {
          const yy = py / H * len;
          let si = cuts.length - 1; for (let i = 0; i < cuts.length; i++) if (cuts[i] <= yy) si = i;
          const id = c * 31 + si * 7 + seed * 101, tone = 0.9 + 0.18 * hsh(id, 1.3), warm = hsh(id, 4.1) - 0.5;
          const dEnd = Math.min(...cuts.map(k => { const q = Math.abs(yy - k); return Math.min(q, len - q); }));
          const kx = hsh(id, 9.2), ky = cuts[si] + 0.3 + hsh(id, 2.2) * 0.8, knot = hsh(id, 6.6) > 0.72;
          for (let px = x0; px < x1; px++) {
            const ax = (px - x0) / (x1 - x0);   // 0..1 across the board
            const wav = n1(yy * 1.3 + id, id) * 0.06 + n1(yy * 6.1, id * 2) * 0.012;
            const ring = Math.abs(Math.sin((ax + wav) * (9 + 5 * hsh(id, 8.8)) * Math.PI + id));
            let v = tone * (0.93 + 0.07 * Math.pow(ring, 0.35)) * (1 - 0.08 * Math.pow(1 - ring, 14));
            v *= 1 + 0.025 * Math.sin(yy * 37 + ax * 3 + id) + 0.02 * (hsh(px, py) - 0.5);
            if (knot) { const dk = Math.hypot((ax - kx) * w, yy - ky); if (dk < 0.016) v *= 0.62 + dk * 12; else if (dk < 0.05) v *= 0.96 + 0.04 * Math.sin(dk * 300); }
            const eA = Math.min(ax, 1 - ax) * w;   // metres to the long edge
            if (eA < 0.0014 || dEnd < 0.0014) v *= 0.52; else if (eA < 0.003 || dEnd < 0.003) v *= 0.82;
            const o = (py * W + px) * 4;
            d[o] = Math.min(255, B[0] * v * (1 + warm * 0.06)); d[o + 1] = Math.min(255, B[1] * v); d[o + 2] = Math.min(255, B[2] * v * (1 - warm * 0.08)); d[o + 3] = 255;
          }
        }
      }
    }, [tileW, len], along === 'u');
  });
}

// sisal / wool flatweave: a fine basket weave of twisted strands; `carpet` gives a soft cut-pile speckle instead
export function weaveTexture({ base = '#c7b391', size = 0.24, carpet = false } = {}) {
  return memo('weave' + base + size + carpet, () => {
    const B = rgb(base), N = 512;
    return canvasTex(N, N, (d) => {
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        let v;
        if (carpet) {
          v = 0.92 + 0.1 * (hsh(px, py) - 0.5) + 0.04 * n1(px * 0.09, py * 0.07) + 0.03 * Math.sin((px + py) * 0.21);
        } else {
          const cell = 16, cx = Math.floor(px / cell), cy = Math.floor(py / cell), hor = (cx + cy) % 2 === 0;
          const a = hor ? px : py, b = hor ? py : px, strand = (b % cell) / cell * 4;   // four strands per cell
          const ridge = Math.abs(Math.sin(strand * Math.PI)), twist = 0.5 + 0.5 * Math.sin(a * 0.9 + Math.floor(strand) * 2.1);
          v = (0.72 + 0.28 * Math.pow(ridge, 0.6)) * (0.94 + 0.08 * twist) * (0.95 + 0.1 * hsh(px * 3 + py, 7));
        }
        const o = (py * N + px) * 4; d[o] = Math.min(255, B[0] * v); d[o + 1] = Math.min(255, B[1] * v); d[o + 2] = Math.min(255, B[2] * v); d[o + 3] = 255;
      }
    }, [size, size]);
  });
}

// tiles: w x h metres with a grout joint, a little tone per tile and a soft mottle; `bond` offsets alternate rows (metro)
export function tileTexture({ base = '#cfcac2', grout = null, w = 0.6, h = 0.6, nx = 2, ny = 2, joint = 0.003, bond = false, gloss = false } = {}) {
  return memo('tile' + base + grout + w + h + nx + ny + joint + bond + gloss, () => {
    const B = rgb(base), Gc = grout ? rgb(grout) : B.map(x => x * 0.8), TW = w * nx, TH = h * ny;
    const N = 1024, M = Math.max(64, Math.round(N * TH / TW / 64) * 64);
    return canvasTex(N, M, (d) => {
      for (let py = 0; py < M; py++) for (let px = 0; px < N; px++) {
        const y = py / M * TH, row = Math.floor(y / h), x = (px / N * TW + (bond && row % 2 ? w / 2 : 0)) % TW, col = Math.floor(x / w);
        const ex = Math.min(x - col * w, (col + 1) * w - x), ey = Math.min(y - row * h, (row + 1) * h - y);
        const o = (py * N + px) * 4;
        if (ex < joint / 2 || ey < joint / 2) { d[o] = Gc[0]; d[o + 1] = Gc[1]; d[o + 2] = Gc[2]; d[o + 3] = 255; continue; }
        const id = row * 17 + col, edge = gloss ? 1 - 0.1 * Math.exp(-Math.min(ex, ey) / 0.004) : 1;
        const v = (0.95 + 0.08 * hsh(id, 2)) * (0.97 + 0.03 * n1(x * 9 + id, y * 7)) * (0.985 + 0.03 * (hsh(px, py) - 0.5)) * edge;
        d[o] = Math.min(255, B[0] * v); d[o + 1] = Math.min(255, B[1] * v); d[o + 2] = Math.min(255, B[2] * v); d[o + 3] = 255;
      }
    }, [TW, TH]);
  });
}

// travertine / honed stone in large-format 1200 x 600 tiles: soft horizontal banding, pores and a faint joint
export function stoneTexture({ base = '#d9cfbf', w = 1.2, h = 0.6, veins = false } = {}) {
  return memo('stone' + base + w + h + veins, () => {
    const B = rgb(base), N = 1024, TW = w, TH = h * 2, M = Math.round(N * TH / TW);
    return canvasTex(N, M, (d) => {
      for (let py = 0; py < M; py++) for (let px = 0; px < N; px++) {
        const x = px / N * TW, y = py / M * TH, row = Math.floor(y / h), id = row * 5 + 1;
        const band = n1(y * 18 + n1(x * 3 + id, id) * 0.6, id) * 0.5 + 0.5;
        let v = (0.9 + 0.12 * band) * (0.97 + 0.06 * hsh(id, 3));
        if (hsh(px * 7 + 3, py * 13 + 1) > 0.9965) v *= 0.7;   // pores
        if (veins) { const vv = Math.abs(Math.sin((x * 2.1 + y * 5.3 + n1(x * 4, y * 3) * 0.8) * 6)); v *= 0.9 + 0.1 * Math.pow(vv, 0.25); }
        const ey = Math.min(y - row * h, (row + 1) * h - y), ex = Math.min(x, TW - x);
        if (ey < 0.0015 || ex < 0.0015) v *= 0.82;
        const o = (py * N + px) * 4; d[o] = Math.min(255, B[0] * v); d[o + 1] = Math.min(255, B[1] * v * 0.995); d[o + 2] = Math.min(255, B[2] * v * 0.985); d[o + 3] = 255;
      }
    }, [TW, TH]);
  });
}

// world-scale box projection (geometry in metres): floors and tops take (x, z), walls take (x, y) or (z, y) by their normal
export function boxUV(g, sx, sy = sx, rot = false) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let a, b;
    if (ay >= ax && ay >= az) { a = rot ? z : x; b = rot ? x : z; } else if (ax > az) { a = z; b = y; } else { a = x; b = y; }
    uv[i * 2] = a / sx; uv[i * 2 + 1] = b / sy;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
// apply box UVs to a geometry list when its material carries one of these textures
export function finishUV(list, mat) {
  const s = mat && mat.map && mat.map.userData && mat.map.userData.size;
  return s ? list.map(g => boxUV(g, s[0], s[1], mat.map.userData.rot)) : list;
}
// a hand-knotted wool rug, mapped once over the rug (no world tiling): heathered field, a border band and a fine inner line
export function rugTexture({ base = '#6e655b', band = '#8a8073', line = '#d9cdb8', inset = 0.07, bandW = 0.05 } = {}) {
  return memo('rug' + base + band + line + inset + bandW, () => {
    const B = rgb(base), Bd = rgb(band), L = rgb(line), N = 1024;
    return canvasTex(N, N, (d) => {
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const x = px / N, y = py / N, e = Math.min(x, y, 1 - x, 1 - y);
        let C = B;
        if (e > inset && e < inset + bandW) C = Bd;
        const li = Math.abs(e - (inset + bandW + 0.012));
        if (li < 0.0025) C = L;
        if (e < 0.008) C = Bd;
        const v = (0.9 + 0.12 * (Math.sin(px * 0.8 + Math.sin(py * 0.31) * 2) * 0.5 + 0.5) * 0.4 + 0.1 * hsh(px, py)) * (0.97 + 0.04 * n1(x * 23, y * 19));
        const o = (py * N + px) * 4; d[o] = Math.min(255, C[0] * v); d[o + 1] = Math.min(255, C[1] * v); d[o + 2] = Math.min(255, C[2] * v); d[o + 3] = 255;
      }
    }, null);
  });
}
