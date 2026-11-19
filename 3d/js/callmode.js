// Call mode (built 15 Nov 2026; live on the Charter House link from 18 Nov, started from the phone button by Home).
// Charlie's stops on one key, proof billboards, the protected council land, the bollards, a see-through St Mary's Gate,
// the one bed vs two bed compare, an honest live line and the after-call shortlist link. Nothing here changes the live page.
import { UNITS, SITE, STATUS, FLOORS, fmtGBP } from './site.js?v=1795002700';
import { rentFor, PICKS } from './sales.js?v=1795002700';

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
  ca: { pos: [-150, 30, -30], tag: 'Since 1974', big: 'Market and Underbanks', small: 'Conservation area. Nothing over four storeys.', soft: true },
  last: { pos: [11, 30, 10], tag: 'Charter House', big: 'The last site', small: 'to be developed in the Underbanks' },
  station: { pos: [-132, 24, 734], tag: 'Stockport station', big: '8 min', small: 'To Manchester Piccadilly. 11 trains an hour.' },
};
// council-owned land (Charlie, 15 Nov: "car park / new children's park, council-owned, protected views")
const LAND = [
  { id: 'carpark', name: 'Council car park', p: [[-48, -11], [0, -11], [0, -38], [-35, -45], [-48, -44]] },
  { id: 'kids', name: 'Children’s park', p: [[22, -30], [33, -24], [33, -11], [1, -10], [0, -16], [0, -37]] },
];
const BOLLARDS = { pos: [-136, 0, -12], big: 'No through traffic', small: 'This was a cut-through to Asda. No traffic now.' };   // Charlie, 15 Nov: between St Mary's Church and the Market Hall
// Market and Underbanks Conservation Area (designated 1974, extended 2005): the boundary from planning.data.gov.uk
// (Historic England / Stockport Council, entity 44014592), fitted to the model on three listed buildings' grid references
// (the Arden Arms, St Mary's Church, the Old Rectory; within 2 m)
const CA = [[-42.7,36.8],[-13.8,39.3],[-6.8,43.8],[37,68.8],[88,98.7],[105.3,78.3],[112.1,83.6],[133.7,96.6],[138.8,99.8],[140.9,97.5],[145.3,100.8],[146.5,101.8],[148.8,98],[158.8,84.5],[166.9,71.7],[170.6,68.9],[180.1,69.8],[185,68.9],[187.2,68],[191.1,61.9],[192,62.8],[200.7,60.1],[230,63.2],[251.2,66.6],[251.4,67.2],[251.2,70.2],[249.8,80.1],[249.6,82.3],[249.8,83.3],[250.4,84],[252.2,84.5],[261.8,85.9],[264.4,86],[279.9,88],[284.1,31.6],[234.3,25.3],[236.6,12.1],[239.2,-6.1],[231.5,-7.5],[223.6,-5.5],[217.1,-3.3],[212.2,-1.1],[211.5,-3.8],[202.1,-29.8],[187.7,-60.6],[182.7,-66],[118.8,-36.1],[84.8,-28],[68.3,-24.6],[36.1,-48.2],[-40.6,-59],[-36.1,-67.9],[-25.5,-86.3],[-30.8,-87.2],[-76.1,-97.1],[-85,-98.8],[-96.3,-100.2],[-100.4,-101.2],[-104.4,-102.7],[-106.3,-103.7],[-109.9,-106],[-111.6,-107.2],[-114.7,-110],[-117.5,-113.3],[-118.7,-115],[-125.5,-125.5],[-126.9,-127.6],[-128.4,-129.5],[-130.9,-132.5],[-142,-143.9],[-143.2,-144.7],[-144,-145],[-145.2,-145.3],[-146.8,-145.3],[-164.8,-125],[-165.6,-123.4],[-166.1,-121.6],[-165.9,-120.7],[-165.2,-119.1],[-164.2,-117.9],[-144.4,-100.2],[-133.9,-91.6],[-141.6,-82.7],[-144.7,-78.4],[-145.4,-77.6],[-147,-76.5],[-148.6,-76],[-150.3,-75.7],[-151.9,-75.8],[-187.8,-73.2],[-219.7,-72.5],[-220.9,-73.5],[-220.4,-74.1],[-268.8,-117.1],[-269.5,-116.2],[-271.1,-117.6],[-270.5,-118.3],[-271.6,-119.3],[-273.4,-117.2],[-283.2,-106.3],[-287.4,-102.8],[-288.9,-101.1],[-292.9,-95.8],[-297.6,-88.6],[-303.3,-80.5],[-319.3,-61.3],[-326.1,-54.1],[-329.3,-50.1],[-332.3,-45.9],[-335,-41.6],[-337.4,-37.1],[-339.5,-32.4],[-341.3,-27.7],[-342.9,-22.8],[-346.1,-9.3],[-321.6,-6.2],[-322.7,2.1],[-323,7.9],[-329.4,25.1],[-326.9,35.6],[-325.9,38.6],[-319.5,38.6],[-318.6,42.2],[-317.3,41.9],[-316.2,50.3],[-313.6,86.4],[-313.4,89],[-313.8,95.9],[-297.2,93.1],[-295.9,100.1],[-299.6,113.7],[-300.7,117.5],[-300.5,119.1],[-290.5,118],[-287.1,118.3],[-283,119.9],[-285.6,130.4],[-291.7,145.6],[-294,153.1],[-294.7,156.2],[-297.7,172.1],[-284.3,170.7],[-273.4,171.2],[-278.5,178.5],[-276.7,179.6],[-271.7,184.2],[-269.9,180.4],[-257.6,159.4],[-241.3,138.4],[-239.7,135.7],[-229.7,129.4],[-222.1,123.2],[-217.4,119.8],[-213.3,117.3],[-206.5,114.1],[-190.6,108.5],[-157.5,96.3],[-153.4,95.1],[-148.5,94.1],[-142.7,93.3],[-137.3,93.2],[-128.4,93.5],[-117.9,95.5],[-109.8,98.8],[-107.3,92.9],[-95.4,83.3],[-104.1,82],[-112.9,80.5],[-121.3,78.5],[-120.4,77.3],[-121.5,75.8],[-120.5,73.9],[-121.2,72.7],[-124.5,72],[-137.8,70.3],[-137.8,57.5],[-134.9,52.2],[-133.6,46.6],[-132.9,39.5],[-133.1,38.1],[-132.7,33.9],[-131.2,25.7],[-119.2,27],[-108.8,28.4],[-109,31.9],[-69.2,34.4]];
const CEIL = 12.5;   // four storeys
// St Mary's Gate on its footprint (world.json special.smg), the building that hides St Mary's from the corner
const SMG = [[-12.5, 18.8], [-22.5, 18.3], [-22.8, 13.5], [-63.0, 15.2], [-63.8, 1.9], [-13.3, 1.0]];

// ---------------------------------------------------------------- Charlie's stops, in his order
// cam: [x, height above ground, z] -> look at [x, height, z]
const STOPS = [
  { k: 'Bearings', t: 'Charter House, on the corner of Churchgate', s: 'The park at the end of the street. The Underbanks start 30 seconds away.', cam: [150, 58, 52], at: [10, 4, 4], bb: ['charter', 'park', 'brewery'] },
  { k: 'The old town', t: 'Down to the Market Hall, between the churches', s: 'St Mary’s and the 1861 Market Hall, at the top of Churchgate.', cam: [30, 30, -24], at: [-150, 2, -18], bb: ['church', 'hall', 'lofts'] },   // St Mary's Gate solid again (Charlie, 17 Nov)
  { k: 'The Underbanks', t: 'The last site to be developed in the Underbanks', s: 'A conservation area since 1974. Nothing over four storeys can be built here.', cam: [230, 250, 330], at: [-40, 0, 10], bb: ['ca', 'last'], ca: true },
  { k: 'The views', t: 'St Mary’s Gate, the car park and the children’s park', s: 'The car park and the park are council-owned. The view stays.', cam: [6, 13.5, -3.5], at: [-30, 1, -30], bb: ['smg'], land: true },
  { k: 'A quiet street', t: 'The bollards', s: 'This was a cut-through to Asda. No traffic now.', cam: [-78, 14, -4], at: [-137, 1, -12], bollards: true },   // down Market Place from the end of Churchgate (17 Nov: the old camera sat on a shop roof)
  { k: 'Round the back', t: 'The courtyard and the walkways', s: 'The residents’ entrances, off the street.', cam: [36, 9.5, 37], at: [14, 5.5, 13] },
  { k: 'Private pre-launch', t: 'Charter House', s: '27 apartments on the corner of Churchgate and Harvey Street.', front: true },   // ends at the front, no shortlist pop-up (Charlie, 17 Nov)
];

let CH, THREE, on = false, idx = -1, raf = 0;
const ALWAYS = ['smg', 'lofts', 'print'];   // the proof billboards, always up on the town view in the /call version
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
  /* call mode starts from a small phone button in the left-hand pad, under Home (Charlie, 18 Nov) */
  #navpad #cm-go { color: #d8b476; }
  #navpad #cm-go:hover { background: rgba(216,180,118,.18); }
  body.callmode #cm-go, body.callmode #cm-gosep { display: none; }
  #cm-bar { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 70; display: none; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; background: rgba(24,19,16,.9); border: 1px solid rgba(255,255,255,.12); color: #f3ead9; font: 500 13px/1 var(--f-body); box-shadow: 0 8px 30px rgba(0,0,0,.35); }
  body.callmode #cm-bar { display: flex; }
  #cm-bar button { height: 34px; min-width: 34px; padding: 0 12px; border-radius: 999px; border: 0; background: rgba(255,255,255,.08); color: inherit; font: inherit; cursor: pointer; }
  #cm-bar button:hover { background: rgba(255,255,255,.16); }
  #cm-bar .n { padding: 0 8px; opacity: .8; white-space: nowrap; }
  #cm-bar .dots { display: flex; flex-wrap: nowrap; gap: 5px; padding: 0 6px; }
  #cm-bar .dots i { flex: none; }
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
  .cm-bb { padding-bottom: 26px; }
  .cm-bb::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 2px; height: 26px; margin-left: -1px; background: linear-gradient(rgba(214,176,106,.95), rgba(214,176,106,.25)); }
  .cm-bb::before { content: ''; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #d8b476; box-shadow: 0 0 0 3px rgba(216,180,118,.3); }
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
  /* 360 walk arrows, picture pins and the map (Charlie, 15 Nov: like the Romal Nifty tour) */
  .spin.cm-pic i { width: 58px; height: 58px; border-radius: 50%; transform: none; background: #222 center / cover no-repeat; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(0,0,0,.45), 0 0 0 2px rgba(216,180,118,.8); }
  .spin.cm-pic:hover i { border-color: #d8b476; }
  body.cm-street #t-acts { display: none; }
  #cm-arrows { position: fixed; inset: 0; z-index: 17; pointer-events: none; }
  .cm-arr { position: absolute; left: 0; top: 0; display: none; pointer-events: auto; cursor: pointer; background: none; border: 0; padding: 0; color: #fff; }
  .cm-arr i { display: block; width: 60px; height: 60px; border-radius: 50%; background: rgba(20,16,14,.42); border: 2px solid rgba(255,250,240,.85); box-shadow: 0 4px 16px rgba(0,0,0,.35); backdrop-filter: blur(3px); transition: background .2s, transform .2s; }
  .cm-arr svg { width: 100%; height: 100%; fill: none; stroke: #fff; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; }
  .cm-arr:hover i, .cm-arr:focus-visible i { background: rgba(216,180,118,.85); }
  .cm-arr span { position: absolute; left: 50%; top: 100%; margin-top: 6px; transform: translateX(-50%); white-space: nowrap; font: 600 10.5px/1 var(--f-label, var(--f-body)); letter-spacing: .12em; text-transform: uppercase; padding: 6px 9px; border-radius: 999px; background: rgba(20,16,14,.72); border: 1px solid rgba(255,248,236,.35); }
  #cm-map { position: fixed; z-index: 18; top: calc(var(--gt, 0px) + 82px); right: calc(var(--gr, 16px)); width: 340px; border-radius: 14px; overflow: hidden; background: #e9e4da; border: 1px solid rgba(255,255,255,.5); box-shadow: 0 12px 34px rgba(0,0,0,.45); transition: opacity .3s; font-family: var(--f-body); }
  #cm-map.off { opacity: 0; pointer-events: none; }
  #cm-map .mh { display: flex; align-items: center; justify-content: space-between; padding: 7px 8px 7px 12px; background: rgba(20,16,14,.88); color: #f3ead9; font: 600 11px/1 var(--f-body); letter-spacing: .12em; text-transform: uppercase; }
  #cm-map .mh button { width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25); background: none; color: inherit; font: 15px/1 var(--f-body); cursor: pointer; }
  #cm-map .mw { position: relative; height: 200px; overflow: hidden; cursor: zoom-in; }
  #cm-map .mi { position: absolute; left: 0; top: 0; transform-origin: 0 0; transition: transform .6s cubic-bezier(.2,.8,.2,1); }
  #cm-map .mi > img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; -webkit-user-drag: none; }
  #cm-map .lb { position: absolute; transform: translate(-50%, -50%); white-space: nowrap; pointer-events: none; font: 600 9.5px/1 var(--f-body); letter-spacing: .14em; text-transform: uppercase; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.9), 0 0 8px rgba(0,0,0,.6); }
  #cm-map .lb.ch { color: #f1cf8e; font-size: 10.5px; }
  #cm-map .nd { position: absolute; width: 30px; height: 30px; margin: -15px 0 0 -15px; padding: 0; border-radius: 50%; border: 2px solid #fff; background: #333 center / cover no-repeat; box-shadow: 0 2px 8px rgba(0,0,0,.5); cursor: pointer; z-index: 2; transition: transform .2s; }
  #cm-map .nd:hover { transform: scale(1.25); z-index: 4; }
  #cm-map .nd.cur { border-color: #d8b476; box-shadow: 0 0 0 3px rgba(216,180,118,.6), 0 2px 10px rgba(0,0,0,.6); z-index: 3; }
  #cm-map .nd span { position: absolute; left: 50%; top: 100%; margin-top: 3px; transform: translateX(-50%); white-space: nowrap; font: 600 9px/1 var(--f-body); color: #fff; background: rgba(20,16,14,.8); padding: 3px 6px; border-radius: 999px; opacity: 0; pointer-events: none; transition: opacity .2s; }
  #cm-map .nd:hover span, #cm-map .nd.cur span, #cm-map.big .nd span { opacity: 1; }
  #cm-map .cone { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; pointer-events: none; z-index: 1; }
  #cm-map .cone path { fill: rgba(216,180,118,.42); stroke: rgba(255,240,210,.9); stroke-width: 1; }
  #cm-map .nn { position: absolute; right: 8px; bottom: 8px; width: 26px; height: 26px; border-radius: 50%; background: rgba(20,16,14,.75); color: #fff; display: grid; place-items: center; font: 700 10px/1 var(--f-body); z-index: 5; }
  #cm-map .nn b { display: block; transform-origin: 50% 50%; }
  #cm-map.big { top: 50%; left: 50%; right: auto; width: min(94vw, 1280px); transform: translate(-50%, -50%); z-index: 80; }
  #cm-map .nd.up span { top: auto; bottom: 100%; margin: 0 0 3px; }
  #cm-map.big .mw { height: auto; cursor: default; }
  #cm-map.big .nd { width: 46px; height: 46px; margin: -23px 0 0 -23px; border-width: 3px; }
  #cm-map.big .nd span { font-size: 10.5px; padding: 4px 8px; }
  #cm-mapshade { position: fixed; inset: 0; z-index: 79; background: rgba(8,6,5,.55); display: none; }
  #cm-mapshade.on { display: block; }
  @media (max-width: 760px) { #cm-map { width: 200px; top: calc(var(--gt, 0px) + 70px); } #cm-map .mw { height: 130px; } #cm-map .nd { width: 24px; height: 24px; margin: -12px 0 0 -12px; } .cm-arr i { width: 50px; height: 50px; } }
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
  { const pad = $('#navpad'), go = el(`<button id="cm-go" type="button" title="Start call mode (C)" aria-label="Start call mode"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg></button>`);
    if (pad) { pad.appendChild(el(`<span class="nsep" id="cm-gosep" aria-hidden="true"></span>`)); pad.appendChild(go); } else document.body.appendChild(go); }
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
let caGroup = null, clayOn = false;
function buildCA() {
  caGroup = new THREE.Group(); caGroup.name = 'cm-ca'; caGroup.visible = false;
  const gold = '#d8b476';
  const wallM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ceilM = new THREE.MeshBasicMaterial({ color: '#e0b25e', transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const lineM = new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 1 });
  const topM = new THREE.LineBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.8 });
  const ring = drape(CA, 0.5), top = ring.map(v => v.clone().setY(v.y - 0.5 + CEIL));
  ring.push(ring[0].clone()); top.push(top[0].clone());
  caGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), lineM), new THREE.Line(new THREE.BufferGeometry().setFromPoints(top), topM));
  const wp = [];
  for (let i = 0; i < ring.length - 1; i++) { const a = ring[i], b = ring[i + 1], c = top[i + 1], d = top[i]; wp.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  { const col = [], n = wp.length / 3; for (let i = 0; i < n; i++) { const lo = [0, 1, 3].includes(i % 6); col.push(0.88, 0.66, 0.3, lo ? 0.8 : 0.2); } wg.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); }
  // a 2 m gold ribbon on the ground along the boundary
  { const rp = [], q = ring; for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L * 2.5, nz = dx / L * 2.5;
      rp.push(a.x - nx, a.y, a.z - nz, b.x - nx, b.y, b.z - nz, b.x + nx, b.y, b.z + nz, a.x - nx, a.y, a.z - nz, b.x + nx, b.y, b.z + nz, a.x + nx, a.y, a.z + nz); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    const rib = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6 })); rib.renderOrder = 9; caGroup.add(rib); }
  const wall = new THREE.Mesh(wg, wallM); wall.renderOrder = 7; caGroup.add(wall);
  let geo = new THREE.ShapeGeometry(new THREE.Shape(CA.map(([x, z]) => new THREE.Vector2(x, z))), 1).toNonIndexed();
  for (let k = 0; k < 2; k++) geo = subdivide(geo);
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getY(i); pa.setXYZ(i, x, ground(x, z) + CEIL, z); }
  geo.computeBoundingSphere();
  const ceil = new THREE.Mesh(geo, ceilM); ceil.renderOrder = 8; caGroup.add(ceil);
  CH.scene.add(caGroup);
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
  setXray(!!s.xray); landGroup.visible = !!s.land; bollPin.visible = !!s.bollards; caGroup.visible = !!s.ca;
  if (!!s.ca !== clayOn) { clayOn = !!s.ca; try { CH.setClay(clayOn); } catch { } }
  for (const [id, b] of bbEls) b.show = (s.bb || []).includes(id) || (s.land && id.startsWith('land-')) || (s.bollards && id === 'bollards');
  if (s.units) {
    const [a, b] = pickPair();
    CH.toUnit(a);
    setTimeout(() => { if (idx === i) openCompare(a, b); }, 1700);
  } else if (s.front) {
    if (CH.S.mode !== 'explore') CH.toExplore(false);
    fly(new THREE.Vector3(-14, 13.5, -29), new THREE.Vector3(9, 6, 6), 1.6);
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
  live(); go(0);
}
function stop() {
  on = false; window.__CALL_ON = false; document.body.classList.remove('callmode', 'cm-units');
  setXray(false); landGroup.visible = false; bollPin.visible = false; caGroup.visible = false;
  if (clayOn) { clayOn = false; try { CH.setClay(false); } catch { } }
  for (const [id, b] of bbEls) { b.show = ALWAYS.includes(id); if (!b.show) b.e.style.display = 'none'; }   // the proof billboards stay up outside call mode
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
  if (on && CH.S) CH.S.idle = -1e9;   // no idle spin while Charlie talks
  const idleBB = !on && CH.S && CH.S.mode !== 'explore' && CH.S.mode !== 'intro';   // outside call mode the billboards show on the town view only
  for (const b of bbEls.values()) {
    if (!b.show || idleBB) { if (b.e.style.display !== 'none') b.e.style.display = 'none'; b.sx = null; continue; }
    if (!b.p) b.p = worldOf(b.spec);
    if (!b.p) continue;
    T0.copy(b.p).project(cam);
    const vis = T0.z < 1 && T0.x > -1.1 && T0.x < 1.1 && T0.y > -1.1 && T0.y < 1.2;
    b.e.style.display = vis ? 'block' : 'none';
    if (vis) { b.sx = (T0.x + 1) / 2 * w; b.sy = (1 - T0.y) / 2 * h; b.d = T0.z; } else b.sx = null;
  }
  placeBillboards(w, h);
  patchSpots();
  if (mapEl) { const S = CH.SPOTS(), cur = CH.S.mode === 'tour' && CH.T ? S[CH.T.spot] : null; if (arrowsEl) updateArrows(cur, S, w, h); updateMap(cur, S); }
  if (bollPin && bollPin.visible) { const t = performance.now() / 1000, r2 = bollPin.userData.r2, k = 1 + 0.25 * Math.sin(t * 2.4); r2.scale.set(k, k, 1); }
  // every apartment opened in call mode joins the shortlist
  if (CH.S.mode === 'unit' && CH.S.plot != null) seen.add(CH.S.plot);
}

function placeBillboards(w, h) {
  // nearest first; each card stands on a pin at its own building
  const list = [...bbEls.values()].filter(b => b.show && b.sx != null).sort((a, c) => a.d - c.d), placed = [];
  for (const b of list) {
    const bw = b.e.offsetWidth || 220, bh = b.e.offsetHeight || 90;
    const right = !on && innerWidth > 760 && !document.getElementById('panel')?.classList.contains('hide') ? 410 : 0;   // keep clear of the panel outside call mode
    // each card stays on its own building: no sliding or stacking (Charlie, 15 Nov: the Lofts card had slid onto St Marys Gate);
    // a card whose building is off screen, under the panel or behind a nearer card is hidden instead
    const x = b.sx, y = b.sy;
    const out = x < bw / 2 + 8 || x > w - right - bw / 2 - 8 || y < bh + 60 || y > h - 20;
    const hit = placed.find(r => Math.abs(r.x - x) < (r.w + bw) / 2 + 8 && y > r.y - r.h - 8 && y - bh < r.y + 8);
    if (out || hit) { b.e.style.display = 'none'; continue; }
    placed.push({ x, y, w: bw, h: bh });
    b.e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }
}

// ---------------------------------------------------------------- 360 map, walk arrows and picture pins (Charlie, 15 Nov: like the Romal Nifty tour)
// The map is a straight-down picture of this model (assets/map/call_map.jpg, made by route/map_shot.mjs) covering MAPB in model
// metres, x to the right and z down the picture. North is turned NORTH degrees from straight up (fit.json: model -> National Grid).
const MAPB = { x0: -215, x1: 45, z0: -65, z1: 60 };
const NORTH = -33.9;
const MAPLB = [['Charter House', 14, 9, 'ch'], ['Churchgate', -62, -3], ['Harvey Street', -45, 38], ['Market Place', -128, -24], ['Market Hall', -184, -2],
  ['St Mary’s', -95, -40], ['St Mary’s Gate', -38, 10], ['Robinsons Brewery', -6, 55], ['Rostron Brow', -100, 32]];
// extra links between the street 360s, so you can walk the whole set (main.js links only the spots round the building)
const XLINK = { smg: ['church'], church: ['smg', 'market'], market: ['church'], arch: ['courtyard'], courtyard: ['arch'] };
const SHORT = { church: 'St Mary’s', smg: 'St Mary’s Gate', park: 'Play park', arch: 'The entrance', brewery: 'The brewery', courtyard: 'Courtyard', walkway: 'Top-floor walkway', market: 'Market Place', corner: 'Churchgate corner', harvey: 'Harvey Street' };
const MAPNUDGE = { walkway: [6, -7] };   // the walkway 360 is upstairs, 4 m from the courtyard one: its pin moves aside so both can be tapped
const streetPano = (sp) => !!(sp && sp.pano && sp.plot == null && !sp.type);
const thumbOf = (sp) => `${BASE}spots/${sp.id}.jpg`;
let spotsRef = null, mapEl = null, mapInner = null, arrowsEl = null, mapBig = false, mapCur = -2, mapShade = null;
const mapPct = (x, z) => [(x - MAPB.x0) / (MAPB.x1 - MAPB.x0) * 100, (z - MAPB.z0) / (MAPB.z1 - MAPB.z0) * 100];
function patchSpots() {
  const S = CH.SPOTS ? CH.SPOTS() : null;
  if (!S || !S.length || S === spotsRef) return;
  spotsRef = S;
  for (const sp of S) { const add = XLINK[sp.id]; if (add && streetPano(sp)) sp.links = [...new Set([...(sp.links || []), ...add])]; }
  // the pins inside a 360 become little round pictures of the place they lead to
  const pins = [...document.querySelectorAll('#labels .spin')];
  for (const sp of S) {
    if (!streetPano(sp)) continue;
    const p = pins.find(e => e.querySelector('span') && e.querySelector('span').textContent === sp.name), i = p && p.querySelector('i');
    if (i) { i.style.backgroundImage = `url(${thumbOf(sp)})`; p.classList.add('cm-pic'); }
  }
  buildMap(S);
}
function buildArrows() {
  arrowsEl = el('<div id="cm-arrows"></div>'); document.body.appendChild(arrowsEl);
  arrowsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) CH.goSpot(+b.dataset.i); });
}
const FWD = () => new THREE.Vector3();
let fwd = null;
function updateArrows(cur, S, w, h) {
  const want = [];
  if (cur && streetPano(cur) && CH.panoOn && CH.panoOn() && !CH.tour.busy()) for (const id of cur.links || []) {
    const j = S.findIndex(q => q.id === id); if (j >= 0 && streetPano(S[j])) want.push(j);
  }
  while (arrowsEl.children.length < want.length) arrowsEl.appendChild(el('<button class="cm-arr" type="button"><i><svg viewBox="0 0 40 40"><path d="M11 25 L20 15 L29 25"/></svg></i><span></span></button>'));
  // a ring on the ground in the middle of the view, as in Street View: each arrow points the way to the next 360, even behind you
  if (!fwd) fwd = FWD();
  CH.camera.getWorldDirection(fwd); let fx = fwd.x, fz = fwd.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const o = CH.tour.st.pos, cx = w / 2, cy = h * (w > 760 ? 0.655 : 0.64), Rx = Math.min(200, w * 0.32), Ry = w > 760 ? 50 : 36;
  // the angle of each next spot (0 straight ahead, + to the right); arrows closer than MIN are spread apart so they never sit on each other
  const ths = want.map(j => { const sp = S[j]; return Math.atan2((sp.at.x - o.x) * -fz + (sp.at.z - o.z) * fx, (sp.at.x - o.x) * fx + (sp.at.z - o.z) * fz); });
  const ord = ths.map((t, k) => k).sort((a, c) => ths[a] - ths[c]);
  const at = (t) => [cx + Rx * Math.sin(t), cy - Ry * Math.cos(t)], GAP = w > 760 ? 118 : 84;
  for (let it = 0; it < 60; it++) {   // push neighbours apart round the ring until their labels clear each other
    let moved = false;
    for (let n = 1; n < ord.length; n++) { const a = ord[n - 1], c = ord[n], [x1, y1] = at(ths[a]), [x2, y2] = at(ths[c]); if (Math.hypot(x2 - x1, y2 - y1) < GAP) { ths[a] -= 0.03; ths[c] += 0.03; moved = true; } }
    if (!moved) break;
  }
  [...arrowsEl.children].forEach((b, k) => {
    const j = want[k]; if (j == null) { b.style.display = 'none'; return; }
    const sp = S[j], th = ths[k];
    const ax = cx + Rx * Math.sin(th), ay = cy - Ry * Math.cos(th);
    const rot = Math.atan2(-Ry * Math.cos(th), Rx * Math.sin(th)) * 180 / Math.PI + 90, back = Math.cos(th) < -0.2;
    b.dataset.i = j; b.title = 'Walk to ' + sp.name; b.setAttribute('aria-label', 'Walk to ' + sp.name);
    b.querySelector('span').textContent = SHORT[sp.id] || sp.name;
    b.querySelector('i').style.transform = `rotate(${rot.toFixed(1)}deg) scaleY(.8)`;
    b.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%) scale(${back ? 0.82 : 1})`;
    b.style.opacity = back ? 0.75 : 1; b.style.zIndex = String(Math.round(100 + 50 * Math.cos(th)));
    b.style.display = 'block';
  });
}
function buildMap(S) {
  if (!mapEl) {
    mapEl = el(`<div id="cm-map" class="off" role="region" aria-label="Map of the 360° views"><div class="mh"><span>Map · 360° views</span><button type="button" data-a="big" aria-label="Bigger map" title="Bigger map">⤢</button></div>
      <div class="mw"><div class="mi"><img src="${BASE}map/call_map.jpg?v=1794750000" alt="Map of the streets round Charter House" draggable="false"><svg class="cone" viewBox="-60 -60 120 120"><path d="M0 0 L-30 -52 A60 60 0 0 1 30 -52 Z"/></svg></div>
      <span class="nn" title="North"><b style="transform: rotate(${NORTH}deg)">N↑</b></span></div></div>`);
    mapShade = el('<div id="cm-mapshade"></div>');
    document.body.appendChild(mapShade); document.body.appendChild(mapEl);
    mapInner = mapEl.querySelector('.mi');
    const toggle = (v) => { mapBig = v; mapEl.classList.toggle('big', v); mapShade.classList.toggle('on', v); mapEl.querySelector('[data-a="big"]').textContent = v ? '✕' : '⤢'; mapCur = -2; };
    mapEl.querySelector('[data-a="big"]').onclick = () => toggle(!mapBig);
    mapShade.onclick = () => toggle(false);
    mapEl.addEventListener('click', (e) => { const n = e.target.closest('.nd'); if (n) { toggle(false); CH.goSpot(+n.dataset.i); } });
    mapEl.querySelector('.mw').addEventListener('click', (e) => { if (!mapBig && !e.target.closest('.nd')) toggle(true); });
  }
  mapInner.querySelectorAll('.nd, .lb').forEach(n => n.remove());
  for (const [t, x, z, c] of MAPLB) { const [l, tp] = mapPct(x, z); mapInner.appendChild(el(`<span class="lb ${c || ''}" style="left:${l}%;top:${tp}%">${t}</span>`)); }
  S.forEach((sp, i) => {
    if (!streetPano(sp)) return;
    const nd = MAPNUDGE[sp.id] || [0, 0], [l, tp] = mapPct(sp.at.x + nd[0], sp.at.z + nd[1]);
    mapInner.appendChild(el(`<button class="nd${['harvey', 'corner'].includes(sp.id) ? ' up' : ''}" type="button" data-i="${i}" style="left:${l}%;top:${tp}%;background-image:url(${thumbOf(sp)})" aria-label="Go to the 360° view: ${sp.name}"><span>${sp.name}</span></button>`));
  });
  mapCur = -2;
}
const CAMD = () => new THREE.Vector3();
let camd = null;
function updateMap(cur, S) {
  const show = !!(cur && streetPano(cur) && CH.S.mode === 'tour');
  mapEl.classList.toggle('off', !show);
  document.body.classList.toggle('cm-street', show);   // the map and the picture pins replace the row of street buttons under the caption
  if (!show) { if (mapBig) mapEl.querySelector('[data-a="big"]').click(); return; }
  const mw = mapEl.querySelector('.mw'), W = mw.clientWidth, sx = MAPB.x1 - MAPB.x0, sz = MAPB.z1 - MAPB.z0;
  const k = mapBig ? W / sx : (innerWidth > 760 ? 3.2 : 2.2);   // pixels per metre: the small map follows you, the big one shows it all
  const iw = sx * k, ih = sz * k;
  if (mapBig) mw.style.height = ih + 'px'; else mw.style.height = '';
  const i = S.indexOf(cur);
  if (i !== mapCur || mapInner.dataset.k !== String(k)) {
    mapCur = i; mapInner.dataset.k = String(k);
    mapInner.style.width = iw + 'px'; mapInner.style.height = ih + 'px';
    const nd = MAPNUDGE[cur.id] || [0, 0], [l, tp] = mapPct(cur.at.x + nd[0], cur.at.z + nd[1]), H = mw.clientHeight;
    const ox = mapBig ? 0 : Math.min(0, Math.max(W - iw, W / 2 - l / 100 * iw)), oy = mapBig ? 0 : Math.min(0, Math.max(H - ih, H / 2 - tp / 100 * ih));
    mapInner.style.transform = `translate(${ox}px, ${oy}px)`;
    mapInner.querySelectorAll('.nd').forEach(n => n.classList.toggle('cur', +n.dataset.i === i));
    const cone = mapInner.querySelector('.cone'); cone.style.left = l + '%'; cone.style.top = tp + '%';
  }
  // the cone turns with the view
  if (!camd) camd = CAMD();
  CH.camera.getWorldDirection(camd);
  const ang = Math.atan2(camd.z, camd.x) * 180 / Math.PI + 90;
  mapInner.querySelector('.cone').style.transform = `rotate(${ang.toFixed(1)}deg)`;
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
  const u = new URL('shortlist.html', document.baseURI); u.search = ''; u.hash = ''; u.searchParams.set('p', ps.join('.'));
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
    buildUI(); buildLand(); buildCA(); buildBollards(); buildXray(); enhancePanel();   // no walk arrows: the round picture pins are the way between 360s (Charlie, 18 Nov: the arrows got in the way)
    window.__CALL = { start, stop, go, STOPS, seen, openCompare, openShort };
    for (const [id, b] of bbEls) b.show = ALWAYS.includes(id);
    loop();
    if (/[?&]call=go\b/.test(location.search)) start();
  };
  boot();
}
