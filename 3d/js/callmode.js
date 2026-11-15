// Call mode (preview, 15 Nov 2026, Charlie's "go ahead with all those"). Loaded only with ?call in the link.
// Charlie's stops on one key, proof billboards, the protected council land, the bollards, a see-through St Mary's Gate,
// the one bed vs two bed compare, an honest live line and the after-call shortlist link. Nothing here changes the live page.
import { UNITS, SITE, STATUS, FLOORS, fmtGBP } from './site.js?v=1794535000';
import { rentFor, PICKS } from './sales.js?v=1794535000';

const BASE = 'assets/';
const $ = (s, r = document) => r.querySelector(s);
const st = (u) => STATUS[u.status] || STATUS.Available;
const isAvail = (u) => u.status === 'Available';
const rentOf = (u) => rentFor(u, false).pcm;
const yieldOf = (u) => (rentOf(u) * 12 / u.price * 100).toFixed(1);
const byPlot = new Map(UNITS.map(u => [u.plot, u]));

// ---------------------------------------------------------------- the facts on the billboards (every figure sourced)
// pos: model metres, y = height above the ground there. Sources: the Charter House investment report and Charlie.
const BB = {
  smg: { pos: [-38, 17, 8], tag: 'St Mary’s Gate · sold by Brik', big: '£900 → £1,250', small: 'One-bed rent forecast £900 pcm (Q1 2023). Let at £1,100 to £1,250 by May 2025.', foot: '50 apartments · sold out off-plan · fully let' },
  charter: { pos: [11, 19, 10], tag: 'Private pre-launch', big: 'Charter House', small: '27 apartments on the corner of Churchgate and Harvey Street', brand: true },
  park: { pos: [100, 7, 15], tag: 'The park', big: 'Rectory Green', small: 'At the end of Churchgate', soft: true },
  lofts: { pos: [-168, 16, 102], tag: 'Underbank Lofts · sold by Brik', big: '12 days', small: 'All 25 apartments sold, January 2026' },
  print: { pos: [-40, 19, 213], tag: 'The Print House · sold by Brik', big: '5 days · 7 days', small: 'Phase one sold out in 5 days. Phase two in 7.' },
  church: { pos: null, place: 'tower', tag: 'Grade I', big: 'St Mary’s Church', small: 'Stockport’s oldest church, founded around 1190', soft: true },
  hall: { pos: null, place: 'hall', tag: 'Grade II · 1861', big: 'Market Hall', small: 'The “Glass Umbrella”. Best Small Indoor Market 2023', soft: true },
  brewery: { pos: [-8, 25, 70], tag: 'Since 1849', big: 'Robinsons Brewery', small: 'The Victorian brewery still frames the view', soft: true },
  station: { pos: [-132, 24, 734], tag: 'Stockport station', big: '8 min', small: 'To Manchester Piccadilly. 11 trains an hour.' },
};
// council-owned land (Charlie, 15 Nov: "car park / new children's park, council-owned, protected views")
const LAND = [
  { id: 'carpark', name: 'Council car park', p: [[-48, -11], [0, -11], [0, -38], [-35, -45], [-48, -44]] },
  { id: 'kids', name: 'Children’s park', p: [[22, -30], [33, -24], [33, -11], [1, -10], [0, -16], [0, -37]] },
];
const BOLLARDS = { pos: [-6, 0, 30], big: 'No through traffic', small: 'This was a cut-through to Asda. No traffic now.' };   // Charlie's words; spot to confirm
// St Mary's Gate on its footprint (world.json special.smg), the building that hides St Mary's from the corner
const SMG = [[-12.5, 18.8], [-22.5, 18.3], [-22.8, 13.5], [-63.0, 15.2], [-63.8, 1.9], [-13.3, 1.0]];

// ---------------------------------------------------------------- Charlie's stops, in his order
// cam: [x, height above ground, z] -> look at [x, height, z]
const STOPS = [
  { k: 'Bearings', t: 'Charter House, on the corner of Churchgate', s: 'The park at the end of the street. The Underbanks start 30 seconds away.', cam: [150, 58, 52], at: [10, 4, 4], bb: ['charter', 'park', 'brewery'] },
  { k: 'The old town', t: 'Down to the Market Hall, between the churches', s: 'St Mary’s and the 1861 Market Hall, at the top of Churchgate. St Mary’s Gate is see-through here so you can find them.', cam: [30, 30, -24], at: [-150, 2, -18], bb: ['church', 'hall', 'lofts'], xray: true },
  { k: 'The views', t: 'St Mary’s Gate, the car park and the children’s park', s: 'The car park and the park are council-owned. The view stays.', cam: [6, 13.5, -3.5], at: [-30, 1, -30], bb: ['smg'], land: true },
  { k: 'A quiet street', t: 'The bollards', s: 'This was a cut-through to Asda. No traffic now.', cam: [-2, 14, -16], at: [-6, 0, 30], bollards: true },
  { k: 'The apartments', t: 'One bed or two bed', s: 'The plan, the price, the rent and the yield, side by side.', units: true },
  { k: 'Round the back', t: 'The courtyard and the walkways', s: 'The residents’ entrances, off the street.', cam: [36, 9.5, 37], at: [14, 5.5, 13] },
  { k: 'Your shortlist', t: 'The flats you looked at', s: 'I’ll send you a link with the plans and the numbers on WhatsApp.', shortlist: true },
];

let CH, THREE, on = false, idx = -1, raf = 0;
const seen = new Set();
const bbEls = new Map();
let landGroup = null, bollPin = null, xrayBox = null, xrayLine = null, xrayMats = [];
const V = () => new THREE.Vector3();

function css() {
  const s = document.createElement('style');
  s.textContent = `
  body.callmode #ui .tools, body.callmode #views, body.callmode #looks, body.callmode #hint, body.callmode #ui .credit,
  body.callmode #navpad, body.callmode #labels .ltag, body.callmode #disclaimer, body.callmode #acard, body.callmode #btn-fs { display: none !important; }
  body.callmode:not(.cm-units) #panel { display: none !important; }
  #cm-go { position: fixed; left: 16px; bottom: 16px; z-index: 60; padding: 11px 16px; border-radius: 999px; border: 1px solid rgba(214,176,106,.6); background: rgba(24,19,16,.88); color: #f3ead9; font: 600 14px/1 var(--f-body); cursor: pointer; }
  body.callmode #cm-go { display: none; }
  #cm-bar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 70; display: none; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; background: rgba(24,19,16,.9); border: 1px solid rgba(255,255,255,.12); color: #f3ead9; font: 500 13px/1 var(--f-body); box-shadow: 0 8px 30px rgba(0,0,0,.35); }
  body.callmode #cm-bar { display: flex; }
  #cm-bar button { height: 34px; min-width: 34px; padding: 0 12px; border-radius: 999px; border: 0; background: rgba(255,255,255,.08); color: inherit; font: inherit; cursor: pointer; }
  #cm-bar button:hover { background: rgba(255,255,255,.16); }
  #cm-bar .n { padding: 0 8px; opacity: .8; white-space: nowrap; }
  #cm-bar .dots { display: flex; gap: 5px; padding: 0 6px; }
  #cm-bar .dots i { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; }
  #cm-bar .dots i.on { background: #d8b476; }
  #cm-cap { position: fixed; left: 28px; bottom: 30px; z-index: 65; max-width: min(620px, calc(100vw - 56px)); display: none; color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,.55); pointer-events: none; }
  body.callmode #cm-cap { display: block; }
  #cm-cap .k { font: 600 12px/1 var(--f-body); letter-spacing: .16em; text-transform: uppercase; color: #e7c98d; }
  #cm-cap h2 { margin: 10px 0 8px; font: 600 clamp(28px, 3.4vw, 46px)/1.06 var(--f-display); }
  #cm-cap p { margin: 0; font: 400 clamp(15px, 1.4vw, 19px)/1.45 var(--f-body); color: #f4efe6; }
  #cm-live { position: fixed; right: 18px; bottom: 18px; z-index: 65; display: none; padding: 10px 14px; border-radius: 12px; background: rgba(24,19,16,.86); border: 1px solid rgba(255,255,255,.12); color: #f3ead9; font: 500 13.5px/1.35 var(--f-body); }
  body.callmode #cm-live { display: block; }
  body.callmode.cm-units #cm-live { right: auto; left: 18px; bottom: auto; top: 64px; }
  #cm-live b { color: #fff; font-weight: 700; }
  #cm-live small { display: block; opacity: .65; font-size: 11.5px; margin-top: 2px; }
  .cm-bb { position: fixed; left: 0; top: 0; z-index: 62; transform: translate(-50%, -100%); pointer-events: none; display: none; }
  .cm-bb .c { min-width: 190px; max-width: 280px; padding: 12px 14px 11px; border-radius: 12px; background: rgba(24,19,16,.92); border: 1px solid rgba(214,176,106,.55); color: #f3ead9; font: 400 12.5px/1.35 var(--f-body); box-shadow: 0 10px 34px rgba(0,0,0,.4); }
  .cm-bb.soft .c { background: rgba(255,255,255,.9); color: #2b221c; border-color: rgba(0,0,0,.12); min-width: 0; padding: 9px 12px; }
  .cm-bb .tg { display: block; font: 600 10.5px/1 var(--f-body); letter-spacing: .12em; text-transform: uppercase; color: #d8b476; margin-bottom: 7px; }
  .cm-bb.soft .tg { color: #8a6a32; margin-bottom: 4px; }
  .cm-bb .bg { display: block; font: 700 26px/1.05 var(--f-display); color: #fff; margin-bottom: 5px; }
  .cm-bb.soft .bg { font-size: 17px; color: #2b221c; margin-bottom: 2px; }
  .cm-bb .ft { display: block; margin-top: 6px; opacity: .7; font-size: 11.5px; }
  .cm-bb .stem { width: 2px; height: 34px; margin: 0 auto; background: linear-gradient(rgba(214,176,106,.9), rgba(214,176,106,0)); }
  .cm-bb.soft .stem { background: linear-gradient(rgba(255,255,255,.9), rgba(255,255,255,0)); height: 22px; }
  #cm-cmp, #cm-short { position: fixed; inset: 0; z-index: 80; display: none; align-items: center; justify-content: center; background: rgba(12,10,8,.55); }
  #cm-cmp.on, #cm-short.on { display: flex; }
  .cm-box { position: relative; width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 40px); overflow: auto; padding: 22px; border-radius: 18px; background: #f7f2ea; color: #2b221c; font: 400 14px/1.45 var(--f-body); box-shadow: 0 20px 60px rgba(0,0,0,.45); }
  .cm-box h3 { margin: 0 0 14px; font: 600 24px/1.1 var(--f-display); }
  .cm-box .x { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 50%; border: 0; background: rgba(0,0,0,.07); font-size: 18px; cursor: pointer; }
  .cm-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .cm-cols { grid-template-columns: 1fr; } }
  .cm-col { padding: 14px; border-radius: 14px; background: #fff; border: 1px solid rgba(0,0,0,.08); }
  .cm-col select { width: 100%; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,.18); font: 600 14px var(--f-body); background: #fff; color: #2b221c; color-scheme: light; }
  .cm-col select option { color: #2b221c; background: #fff; }
  .cm-col img { width: 100%; height: 260px; object-fit: contain; background: #fff; border-radius: 10px; margin: 10px 0; border: 1px solid rgba(0,0,0,.06); }
  .cm-col .pr { font: 700 28px/1 var(--f-display); }
  .cm-col .pr.sold { color: #e3242b; font-size: 22px; text-transform: uppercase; letter-spacing: .04em; }
  .cm-col .cm-kv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0; }
  .cm-col .cm-kv div { padding: 8px 10px; border-radius: 10px; background: #f7f2ea; }
  .cm-col .cm-kv span { display: block; color: #6b5a4c; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; opacity: .65; }
  .cm-col .cm-kv b { display: block; font-size: 16px; color: #2b221c; text-align: left; }
  .cm-col .vw { margin: 0 0 10px; color: #5b4c40; }
  .cm-col .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .cm-col .acts button, .cm-box .go { padding: 9px 13px; border-radius: 999px; border: 1px solid rgba(0,0,0,.16); background: #fff; font: 600 13px var(--f-body); cursor: pointer; }
  .cm-col .acts button.main, .cm-box .go.main { background: #2b221c; color: #fff; border-color: #2b221c; }
  .cm-st { display: inline-block; margin-left: 6px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #e8f3ea; color: #24663a; }
  .cm-st.reserved, .cm-st.legals { background: #fdf1dd; color: #8a5a12; }
  .cm-st.sold { background: #fde5e6; color: #b3151c; }
  .cm-sl { display: grid; gap: 10px; margin: 6px 0 16px; }
  .cm-sl label { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: #fff; border: 1px solid rgba(0,0,0,.08); cursor: pointer; }
  .cm-sl input { width: 18px; height: 18px; }
  .cm-link { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
  .cm-link input { flex: 1; padding: 9px 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,.18); font: 13px ui-monospace, monospace; }
  .cm-upan { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
  .cm-upan img { width: 100%; border-radius: 10px; background: #fff; margin: 8px 0; }
  .cm-upan .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13.5px; padding: 3px 0; }
  .cm-upan button { width: 100%; margin-top: 8px; padding: 10px; border-radius: 999px; border: 1px solid rgba(214,176,106,.6); background: rgba(214,176,106,.14); color: inherit; font: 600 13.5px var(--f-body); cursor: pointer; }
  `;
  document.head.appendChild(s);
}

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
function ground(x, z) { try { return CH.groundAt(x, z) || 0; } catch { return 0; } }
function worldOf(spec) {
  if (spec.place && CH.PLACES[spec.place]) return new THREE.Vector3(...CH.PLACES[spec.place]);
  if (!spec.pos) return null;
  const [x, h, z] = spec.pos; return new THREE.Vector3(x, ground(x, z) + h, z);
}

function buildUI() {
  css();
  document.body.appendChild(el(`<button id="cm-go" type="button" title="Start call mode (C)">Start call mode</button>`));
  document.body.appendChild(el(`<div id="cm-bar" role="group" aria-label="Call mode">
    <button type="button" data-cm="prev" aria-label="Previous stop">‹</button><span class="n" id="cm-n"></span><span class="dots" id="cm-dots"></span>
    <button type="button" data-cm="next" aria-label="Next stop">›</button><button type="button" data-cm="cmp">Compare</button><button type="button" data-cm="short">Shortlist</button><button type="button" data-cm="exit" aria-label="Leave call mode">✕</button></div>`));
  document.body.appendChild(el(`<div id="cm-cap" aria-live="polite"><span class="k" id="cm-k"></span><h2 id="cm-t"></h2><p id="cm-s"></p></div>`));
  document.body.appendChild(el(`<div id="cm-live"></div>`));
  document.body.appendChild(el(`<div id="cm-cmp" role="dialog" aria-label="Compare two apartments"><div class="cm-box"><button class="x" type="button" aria-label="Close">✕</button><h3>One bed or two bed</h3><div class="cm-cols" id="cm-cols"></div></div></div>`));
  document.body.appendChild(el(`<div id="cm-short" role="dialog" aria-label="Shortlist link"><div class="cm-box" style="width:min(620px,calc(100vw - 32px))"><button class="x" type="button" aria-label="Close">✕</button><h3>Their shortlist</h3><p style="margin:0 0 8px">Tick the flats to include. The link opens a page with their plans, prices, rents and views.</p><div class="cm-sl" id="cm-sl"></div><button class="go main" type="button" id="cm-mk">Make the link</button><div class="cm-link" id="cm-lk" hidden><input id="cm-url" readonly><button class="go" type="button" id="cm-cp">Copy</button><a class="go" id="cm-open" target="_blank" rel="noopener">Open</a></div></div></div>`));
  const dots = $('#cm-dots'); STOPS.forEach((s, i) => { const d = document.createElement('i'); d.title = s.t; d.onclick = () => go(i); dots.appendChild(d); });
  for (const [id, b] of Object.entries(BB)) {
    const e = el(`<div class="cm-bb ${b.soft ? 'soft' : ''}"><div class="c"><span class="tg">${b.tag}</span><span class="bg">${b.big}</span>${b.small}${b.foot ? `<span class="ft">${b.foot}</span>` : ''}</div><div class="stem"></div></div>`);
    document.body.appendChild(e); bbEls.set(id, { e, spec: b, p: null });
  }
  for (const L of LAND) { const e = el(`<div class="cm-bb soft"><div class="c"><span class="tg">${L.name}</span><span class="bg">Council-owned</span>The view stays.</div><div class="stem"></div></div>`); document.body.appendChild(e); bbEls.set('land-' + L.id, { e, spec: { land: L }, p: null }); }
  { const e = el(`<div class="cm-bb"><div class="c"><span class="tg">A quiet street</span><span class="bg">${BOLLARDS.big}</span>${BOLLARDS.small}</div><div class="stem"></div></div>`); document.body.appendChild(e); bbEls.set('bollards', { e, spec: { pos: BOLLARDS.pos }, p: null }); }
  $('#cm-go').onclick = () => start();
  $('#cm-bar').addEventListener('click', (e) => {
    const a = e.target.closest('[data-cm]')?.dataset.cm; if (!a) return;
    if (a === 'next') go(idx + 1); else if (a === 'prev') go(idx - 1); else if (a === 'exit') stop(); else if (a === 'cmp') openCompare(); else if (a === 'short') openShort();
  });
  for (const id of ['#cm-cmp', '#cm-short']) $(id).addEventListener('click', (e) => { if (e.target === $(id) || e.target.closest('.x')) $(id).classList.remove('on'); });
  $('#cm-mk').onclick = makeLink;
  $('#cm-cp').onclick = async () => { const u = $('#cm-url').value; try { await navigator.clipboard.writeText(u); $('#cm-cp').textContent = 'Copied'; } catch { $('#cm-url').select(); } };
  // keys: right / left arrow, page down / up (presentation clickers), Escape. Captured first so the walk keys do not move the camera.
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input,select,textarea')) return;
    if (!on) { if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) { start(); e.preventDefault(); } return; }
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { go(idx + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { go(idx - 1); }
    else if (k === 'Escape') { if ($('#cm-cmp').classList.contains('on') || $('#cm-short').classList.contains('on')) { $('#cm-cmp').classList.remove('on'); $('#cm-short').classList.remove('on'); } else stop(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
}

function live() {
  const left = UNITS.filter(isAvail).length, res = UNITS.filter(u => st(u).key === 'reserved').length, agreed = UNITS.filter(u => st(u).key === 'legals').length, sold = UNITS.filter(u => st(u).key === 'sold').length;
  const gone = UNITS.length - left;
  const parts = [res && `${res} reserved`, agreed && `${agreed} sale agreed`, sold && `${sold} sold`].filter(Boolean);
  $('#cm-live').innerHTML = `<b>${left} of ${UNITS.length}</b> still available · <b>${gone}</b> secured${parts.length ? ` (${parts.join(', ')})` : ''}<small>From the live list, ${SITE.updated}</small>`;
}

// ---------------------------------------------------------------- the 3D overlays
function drape(p, lift) {
  // a ring of points every 2 m along the edge, each on the ground
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let j = 0; j < n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n; out.push(new THREE.Vector3(x, ground(x, z) + lift, z)); }
  }
  return out;
}
function buildLand() {
  landGroup = new THREE.Group(); landGroup.name = 'cm-land'; landGroup.visible = false;
  const fill = new THREE.MeshBasicMaterial({ color: '#6fcf8a', transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  const edge = new THREE.LineBasicMaterial({ color: '#c9f5d4', transparent: true, opacity: 0.95 });
  for (const L of LAND) {
    const shape = new THREE.Shape(L.p.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ShapeGeometry(shape, 1);
    // ShapeGeometry lies in x-y: move it to x-z on the ground, adding interior points by subdividing the triangles twice
    let geo = g.toNonIndexed();
    for (let k = 0; k < 3; k++) geo = subdivide(geo);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getY(i); pa.setXYZ(i, x, ground(x, z) + 0.35, z); }
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, fill); m.renderOrder = 5; landGroup.add(m);
    const ring = drape(L.p, 0.42); ring.push(ring[0].clone());
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), edge); ln.renderOrder = 6; landGroup.add(ln);
    const cx = L.p.reduce((a, q) => a + q[0], 0) / L.p.length, cz = L.p.reduce((a, q) => a + q[1], 0) / L.p.length;
    bbEls.get('land-' + L.id).p = new THREE.Vector3(cx, ground(cx, cz) + 3, cz);
  }
  CH.scene.add(landGroup);
}
function subdivide(geo) {
  const a = geo.attributes.position, out = [];
  for (let i = 0; i < a.count; i += 3) {
    const A = [a.getX(i), a.getY(i), a.getZ(i)], B = [a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)], C = [a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)];
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const ab = m(A, B), bc = m(B, C), ca = m(C, A);
    out.push(...A, ...ab, ...ca, ...ab, ...B, ...bc, ...ca, ...bc, ...C, ...ab, ...bc, ...ca);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); return g;
}
function buildBollards() {
  const [x, , z] = BOLLARDS.pos, y = ground(x, z);
  bollPin = new THREE.Group(); bollPin.visible = false;
  const ringM = new THREE.MeshBasicMaterial({ color: '#d8b476', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  const r = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 48), ringM); r.rotation.x = -Math.PI / 2; r.position.set(x, y + 0.3, z); bollPin.add(r);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.5, 48), ringM.clone()); r2.material.opacity = 0.45; r2.rotation.x = -Math.PI / 2; r2.position.set(x, y + 0.3, z); bollPin.add(r2);
  bollPin.userData.r2 = r2;
  CH.scene.add(bollPin);
  bbEls.get('bollards').p = new THREE.Vector3(x, y + 4, z);
}
// St Mary's Gate cut away by a box clip on every material near it, with a light outline left in its place
function buildXray() {
  let gmin = 1e9; for (const [x, z] of SMG) gmin = Math.min(gmin, ground(x, z));
  const x0 = Math.min(...SMG.map(p => p[0])) - 0.4, x1 = Math.max(...SMG.map(p => p[0])) + 0.4, z0 = Math.min(...SMG.map(p => p[1])) - 0.4, z1 = Math.max(...SMG.map(p => p[1])) + 0.4;
  xrayBox = { x0, x1, z0, z1, y0: gmin + 0.25, y1: gmin + 19, planes: [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane()) };
  setXray(false);
  xrayLine = makeOutline(gmin);
}
function collectXray() {
  const { x0, x1, z0, z1 } = xrayBox;
  const box = new THREE.Box3(new THREE.Vector3(x0, xrayBox.y0, z0), new THREE.Vector3(x1, xrayBox.y1, z1)), bb = new THREE.Box3();
  const mats = new Set();
  CH.scene.traverse((o) => {
    if (!o.isMesh || !o.material || o.name === 'cm-land') return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    if (!bb.intersectsBox(box)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !(m.clippingPlanes && m.clippingPlanes.length)) mats.add(m);
  });
  for (const m of mats) { if (m.clippingPlanes === xrayBox.planes) continue; m.clippingPlanes = xrayBox.planes; m.clipIntersection = true; m.needsUpdate = true; xrayMats.push(m); }
}
function makeOutline(gmin) {
  // the outline: the footprint at the ground and at the roof line, with the corners
  const top = 13.4, pts = [];
  const ring = (h) => SMG.map(([x, z]) => new THREE.Vector3(x, gmin + h, z));
  const lo = ring(0.3), hi = ring(top);
  for (let i = 0; i < SMG.length; i++) { const j = (i + 1) % SMG.length; pts.push(lo[i], lo[j], hi[i], hi[j], lo[i], hi[i]); }
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthTest: false }));
  line.renderOrder = 20; line.visible = false; CH.scene.add(line); return line;
}
function setXray(v) {
  const b = xrayBox; if (!b) return;
  const [p0, p1, p2, p3, p4, p5] = b.planes;
  if (v) collectXray();
  if (!v) { p0.set(new THREE.Vector3(-1, 0, 0), 1e6); p1.set(new THREE.Vector3(1, 0, 0), -1e6 + 1); for (const p of [p2, p3, p4, p5]) p.set(new THREE.Vector3(0, 1, 0), 0); }
  else {
    p0.set(new THREE.Vector3(-1, 0, 0), b.x0); p1.set(new THREE.Vector3(1, 0, 0), -b.x1);
    p2.set(new THREE.Vector3(0, -1, 0), b.y0); p3.set(new THREE.Vector3(0, 1, 0), -b.y1);
    p4.set(new THREE.Vector3(0, 0, -1), b.z0); p5.set(new THREE.Vector3(0, 0, 1), -b.z1);
  }
  if (xrayLine) xrayLine.visible = v;
}

// ---------------------------------------------------------------- moving between stops
function exitOthers() {
  try { if (CH.S.mode === 'tour') CH.exitTour(undefined, false, true); } catch { }
  try { if ($('#inside')?.getAttribute('aria-hidden') === 'false') CH.closeInterior(); } catch { }
  try { if ($('#viewui')?.getAttribute('aria-hidden') === 'false') CH.closeView(true); } catch { }
  $('#cm-cmp').classList.remove('on'); $('#cm-short').classList.remove('on');
}
function pickPair() {
  // the one bed: Charlie's one-bed pick if it is still there, else the first available one bed; the two bed likewise
  // (fallback: the highest available flat of that size, then the cheapest; a street-facing flat shows the views best)
  const pickOf = (beds) => { const p = Object.keys(PICKS).map(Number).find(n => byPlot.get(n)?.beds === beds && isAvail(byPlot.get(n))); if (p) return p; const av = UNITS.filter(u => u.beds === beds && isAvail(u)).sort((a, b) => b.floor - a.floor || a.price - b.price); return av[0]?.plot || UNITS.find(u => u.beds === beds)?.plot; };
  return [pickOf(1), pickOf(2)];
}
const fly = (p, t, d) => window.__fastFlights ? CH.jump(p.toArray(), t.toArray()) : CH.flyTo(p, t, d);
function go(i) {
  if (!on) return;
  i = Math.max(0, Math.min(STOPS.length - 1, i)); idx = i;
  const s = STOPS[i];
  exitOthers();
  $('#cm-k').textContent = s.k; $('#cm-t').textContent = s.t; $('#cm-s').textContent = s.s;
  $('#cm-n').textContent = `${i + 1} of ${STOPS.length}`;
  [...$('#cm-dots').children].forEach((d, j) => d.classList.toggle('on', j === i));
  document.body.classList.toggle('cm-units', !!s.units);
  { const P = $('#panel'); if (P && P.classList.contains('hide') === !!s.units) { P.classList.toggle('hide', !s.units); dispatchEvent(new Event('resize')); } }
  setXray(!!s.xray); landGroup.visible = !!s.land; bollPin.visible = !!s.bollards;
  for (const [id, b] of bbEls) b.show = (s.bb || []).includes(id) || (s.land && id.startsWith('land-')) || (s.bollards && id === 'bollards');
  if (s.units) {
    const [a, b] = pickPair();
    CH.toUnit(a);
    setTimeout(() => { if (idx === i) openCompare(a, b); }, 1700);
  } else if (s.shortlist) {
    if (CH.S.mode !== 'explore') CH.toExplore(false);
    fly(new THREE.Vector3(-14, 13.5, -29), new THREE.Vector3(9, 6, 6), 1.6);
    setTimeout(() => { if (idx === i) openShort(); }, 900);
  } else {
    if (CH.S.mode !== 'explore') CH.toExplore(false);
    const [cx, ch, cz] = s.cam, [tx, th, tz] = s.at;
    fly(new THREE.Vector3(cx, ground(cx, cz) + ch, cz), new THREE.Vector3(tx, ground(tx, tz) + th, tz), 2.2);
  }
}
function start() {
  if (on) return; on = true; window.__CALL_ON = true;
  document.body.classList.add('callmode');
  window.__noClamp = true; CH.controls.maxDistance = 600; CH.controls.minDistance = 2; CH.controls.autoRotate = false;
  live(); go(0); loop();
}
function stop() {
  on = false; window.__CALL_ON = false; document.body.classList.remove('callmode', 'cm-units');
  setXray(false); landGroup.visible = false; bollPin.visible = false;
  for (const b of bbEls.values()) { b.show = false; b.e.style.display = 'none'; }
  cancelAnimationFrame(raf);
  window.__noClamp = false; CH.controls.maxDistance = 190; CH.controls.minDistance = 9;
  { const P = $('#panel'); if (P && P.classList.contains('hide')) { P.classList.remove('hide'); dispatchEvent(new Event('resize')); } }
  $('#cm-cmp').classList.remove('on'); $('#cm-short').classList.remove('on');
}
const tmp = () => new THREE.Vector3();
let T0 = null;
function loop() {
  raf = requestAnimationFrame(loop);
  if (!T0) T0 = tmp();
  const cam = CH.camera, w = innerWidth, h = innerHeight;
  if (CH.S) CH.S.idle = -1e9;   // no idle spin while Charlie talks
  for (const b of bbEls.values()) {
    if (!b.show) { if (b.e.style.display !== 'none') b.e.style.display = 'none'; continue; }
    if (!b.p) b.p = worldOf(b.spec);
    if (!b.p) continue;
    T0.copy(b.p).project(cam);
    const vis = T0.z < 1 && T0.x > -1.1 && T0.x < 1.1 && T0.y > -1.1 && T0.y < 1.2;
    b.e.style.display = vis ? 'block' : 'none';
    if (vis) { b.sx = (T0.x + 1) / 2 * w; b.sy = (1 - T0.y) / 2 * h; b.d = T0.z; } else b.sx = null;
  }
  placeBillboards(w, h);
  if (bollPin && bollPin.visible) { const t = performance.now() / 1000, r2 = bollPin.userData.r2, k = 1 + 0.25 * Math.sin(t * 2.4); r2.scale.set(k, k, 1); }
  // every apartment opened in call mode joins the shortlist
  if (CH.S.mode === 'unit' && CH.S.plot != null) seen.add(CH.S.plot);
}

function placeBillboards(w, h) {
  // nearest first; each card's box (anchored bottom-centre at its point) is pushed up past any card already placed
  const list = [...bbEls.values()].filter(b => b.show && b.sx != null).sort((a, c) => a.d - c.d), placed = [];
  for (const b of list) {
    const bw = b.e.offsetWidth || 220, bh = b.e.offsetHeight || 90;
    let x = Math.min(Math.max(b.sx, bw / 2 + 12), w - bw / 2 - 12), y = Math.max(b.sy, bh + 66);
    for (let k = 0; k < 6; k++) {
      const hit = placed.find(r => Math.abs(r.x - x) < (r.w + bw) / 2 + 8 && y > r.y - r.h - 8 && y - bh < r.y + 8);
      if (!hit) break; y = hit.y - hit.h - 10; if (y - bh < 60) { y = hit.y + bh + 10; }
    }
    placed.push({ x, y, w: bw, h: bh });
    b.e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}

// ---------------------------------------------------------------- compare
function colHTML(u, side) {
  const s = st(u), sold = s.key === 'sold';
  const opts = UNITS.slice().sort((a, b) => a.beds - b.beds || a.plot - b.plot).map(x => `<option value="${x.plot}" ${x.plot === u.plot ? 'selected' : ''}>Plot ${x.plot} · ${x.beds} bed · ${x.sqft} sq ft · ${(STATUS[x.status] || STATUS.Available).label}</option>`).join('');
  return `<div class="cm-col" data-side="${side}"><select aria-label="Choose an apartment">${opts}</select>
    <img src="${BASE}plans/unit${u.plot}.jpg" alt="Floor plan of plot ${u.plot}">
    <div><span class="pr${sold ? ' sold' : ''}">${sold ? 'Sold' : fmtGBP(u.price)}</span><span class="cm-st ${s.key}">${s.label}</span></div>
    <div class="cm-kv"><div><span>Forecast rent</span><b>${fmtGBP(rentOf(u))} pcm</b></div><div><span>Gross yield</span><b>${sold ? 'n/a' : yieldOf(u) + '%'}</b></div><div><span>Size</span><b>${u.sqft} sq ft</b></div><div><span>Floor</span><b>${FLOORS[u.floor].name}</b></div></div>
    <p class="vw">${u.view}. ${u.note}.</p>
    <div class="acts"><button class="main" type="button" data-a="go">Show it on the model</button><button type="button" data-a="view">View from the window</button></div></div>`;
}
let cmpPair = null;
function openCompare(a, b) {
  if (a == null || b == null) { const [pa, pb] = pickPair(); a = a ?? (CH.S.plot ?? pa); b = b ?? (byPlot.get(a)?.beds === 1 ? pb : pa); }
  cmpPair = [a, b];
  const C = $('#cm-cols'); C.innerHTML = colHTML(byPlot.get(a), 0) + colHTML(byPlot.get(b), 1);
  C.querySelectorAll('select').forEach(sel => sel.onchange = () => { const side = +sel.closest('.cm-col').dataset.side; cmpPair[side] = +sel.value; openCompare(...cmpPair); });
  C.querySelectorAll('[data-a]').forEach(bt => bt.onclick = () => { const p = cmpPair[+bt.closest('.cm-col').dataset.side]; $('#cm-cmp').classList.remove('on'); if (bt.dataset.a === 'go') CH.toUnit(p); else { CH.toUnit(p, false); CH.seeView(p); } seen.add(p); });
  $('#cm-cmp').classList.add('on');
  seen.add(a); seen.add(b);
}

// ---------------------------------------------------------------- the shortlist link
function openShort() {
  const list = [...seen].filter(p => byPlot.has(p)).sort((a, b) => a - b);
  const all = list.length ? list : pickPair();
  $('#cm-sl').innerHTML = all.map(p => { const u = byPlot.get(p), s = st(u); return `<label><input type="checkbox" value="${p}" checked><span><b>Plot ${p}</b> · ${u.beds} bed · ${u.sqft} sq ft · ${s.key === 'sold' ? 'Sold' : fmtGBP(u.price)} <span class="cm-st ${s.key}">${s.label}</span></span></label>`; }).join('');
  $('#cm-lk').hidden = true; $('#cm-cp').textContent = 'Copy';
  $('#cm-short').classList.add('on');
}
function makeLink() {
  const ps = [...$('#cm-sl').querySelectorAll('input:checked')].map(i => i.value);
  if (!ps.length) return;
  const u = new URL('shortlist.html', location.href); u.search = ''; u.hash = ''; u.searchParams.set('p', ps.join('.'));
  $('#cm-url').value = u.href; $('#cm-open').href = u.href; $('#cm-lk').hidden = false;
}

// the unit panel in call mode: the plan, the yield and a compare button right there (no jump into a 360)
function enhancePanel() {
  const P = $('#panel'); if (!P) return;
  const mo = new MutationObserver(() => {
    if (!on || CH.S.mode !== 'unit' || CH.S.plot == null || P.querySelector('.cm-upan')) return;
    const u = byPlot.get(CH.S.plot); if (!u) return; const sold = st(u).key === 'sold';
    const box = el(`<div class="cm-upan"><img src="${BASE}plans/unit${u.plot}.jpg" alt="Floor plan of plot ${u.plot}">
      <div class="row"><span>Forecast rent</span><b>${fmtGBP(rentOf(u))} pcm</b></div><div class="row"><span>Gross yield</span><b>${sold ? 'n/a' : yieldOf(u) + '%'}</b></div>
      <div class="row"><span>Aspect</span><span style="text-align:right">${u.view}</span></div><button type="button">Compare with a ${u.beds === 1 ? 'two' : 'one'} bed</button></div>`);
    box.querySelector('button').onclick = () => { const [a, b] = pickPair(); openCompare(u.plot, u.beds === 1 ? b : a); };
    const sc = P.querySelector('.pscroll'); (sc || P).appendChild(box);
  });
  mo.observe(P, { childList: true });
}

export function init(api) {
  CH = api; THREE = api.THREE;
  const ready = () => { const L = $('#loader'); return CH.CHref && CH.CHref() && (!L || getComputedStyle(L).display === 'none' || L.classList.contains('done') || L.classList.contains('off') || +getComputedStyle(L).opacity === 0); };
  const boot = () => {
    if (!ready()) return setTimeout(boot, 400);
    buildUI(); buildLand(); buildBollards(); buildXray(); enhancePanel();
    window.__CALL = { start, stop, go, STOPS, seen, openCompare, openShort };
    if (/[?&]call=go\b/.test(location.search)) start();
  };
  boot();
}
