// The Print House, 61 Wellington Street, Stockport SK1 3AD — 21 Living, Ollier Smurthwaite Architects.
// Unit data: live from Salesforce (Property__c, project "The Print House"), pulled 30 Oct 2026.
// Layout: Ollier Smurthwaite GA plans A817_C_201B–213B (Jan 2026): per floor, two 1A apartments in the side block on
// Fletcher Street, then along the main block from its south end: the 2A, four 1Bs and the 1C beside the core.
// Local frame (metres): u runs along the main block's Fletcher Street face from the 1C's end wall (u = 0) to the 2A's
// gable; v runs from that street face (v = 0) back into the residents' garden; y up from the lower-ground floor.
// The side block is square to Seaton House and turned 11.7° to the main block (as the GA plans): it has its own frame,
// s from its Fletcher Street face back to the walkway, t along Fletcher Street from the core (phSide below).

export const PH_SITE = {
  name: 'The Print House',
  address: '61 Wellington Street, Stockport SK1 3AD',
  developer: '21 Living',
  architect: 'Ollier Smurthwaite',
  completion: 'September 2027',
  lease: '999 years',
  groundRent: 'Nil',
  serviceCharge: 2.24,
  rent1: 1250, rent2: 1525,          // Brik forecast Oct 2026: 1 bed £1,250, 2 bed £1,500–1,550
  reservation: 2500,                 // Print House reservation deposit (ROI deck)
  whatsapp: '447353164480', phone: '07353 164480', email: 'charlie@brik-studios.com',
  updated: '30 Oct 2026',
  // placement in the town model: the main block's long axis runs 11.7° off Seaton House's side (OpenStreetMap), as the GA
  // plans, which also lays it parallel to Fletcher Street; origin set so the side block's Fletcher face is 3.5 m off that
  // road's centre line and it stands 1 m clear of Seaton House (13 Nov 2026; the old axis was 19° out)
  origin: [-61.99, 195.59], u: [-0.0993, 0.9951], v: [0.9951, 0.0993],
};
export const PH_FH = 2.85;                 // floor to floor, every floor (Ollier Smurthwaite elevations and sections: 2850)
export const PH_FLOORS = [
  { id: 0, name: 'Lower ground', short: 'LG', level: 0 },
  { id: 1, name: 'Ground floor', short: 'G', level: 1 },
  { id: 2, name: 'First floor', short: '1', level: 2 },
  { id: 3, name: 'Second floor', short: '2', level: 3 },
  { id: 4, name: 'Third floor', short: '3', level: 4, note: 'Top floor in the slate mansard: 2.65 m ceilings, twin roof windows' },
];
// The plan, from A817_C_204B (GA plan, ground floor, rev B 26/03/26): the main street face runs 23.496 m between its end
// piers (window bays 2372 at a 3.824 m pitch, piers 450 + 552 + 450), the 1C is set back 2.474 m behind it with a 45°
// chamfer at the corner, the 2A has a bedroom wing at the west end set back 2.586 m, and the block is 11.57 m deep.
export const PH_PLAN = {
  D: 11.57, US: 5.02, UW: 28.516, C1: 2.474, CH: 1.08,
  WING: [28.516, 2.586, 30.54, 6.175],
  PW: [5.296, 9.12, 12.944, 16.768, 20.592],          // party walls on the pier centres, 1C | 1B | 1B | 1B | 1B | 2A
  CORE: { u0: -0.562, u1: 6.1, v1: 12.17 },            // stair and lift core: its street face, the walkway side, the step at the 1C
  SIDE: { o: [-3.57, 16.71], ang: -11.7, S: 9.88, T: 9.69, PW: 4.407 },
  GAL: 1.45,
};
const SA_ = Math.sin(PH_PLAN.SIDE.ang * Math.PI / 180), CA_ = Math.cos(PH_PLAN.SIDE.ang * Math.PI / 180);
export const PH_SIDE = { o: PH_PLAN.SIDE.o, ex: [CA_, SA_], ey: [-SA_, CA_] };   // s axis (Fletcher face -> walkway), t axis (along Fletcher)
export function phSide(s, t) { const F = PH_SIDE; return [F.o[0] + s * F.ex[0] + t * F.ey[0], F.o[1] + s * F.ex[1] + t * F.ey[1]]; }
// footprints [u0, v0, u1, v1] in the local frame (the side block: the bounding box in u, v; fpS is its rectangle in s, t)
const P_ = PH_PLAN, sideFp = (t0, t1) => { const c = [[0, t0], [P_.SIDE.S, t0], [P_.SIDE.S, t1], [0, t1]].map(([a, b]) => phSide(a, b)); return [Math.min(...c.map(q => q[0])), Math.min(...c.map(q => q[1])), Math.max(...c.map(q => q[0])), Math.max(...c.map(q => q[1]))]; };
const SLOTS = [
  { type: '1A', fp: sideFp(P_.SIDE.PW, P_.SIDE.T), fpS: [0, P_.SIDE.PW, P_.SIDE.S, P_.SIDE.T], facing: 'Fletcher Street', side: true },
  { type: '1A', fp: sideFp(0, P_.SIDE.PW), fpS: [0, 0, P_.SIDE.S, P_.SIDE.PW], facing: 'Fletcher Street', side: true },
  { type: '2A', fp: [P_.PW[4], 0, P_.UW, P_.D], facing: 'St Joseph’s Church', corner: true },
  { type: '1B', fp: [P_.PW[3], 0, P_.PW[4], P_.D], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [P_.PW[2], 0, P_.PW[3], P_.D], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [P_.PW[1], 0, P_.PW[2], P_.D], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [P_.PW[0], 0, P_.PW[1], P_.D], facing: 'St Joseph’s School' },
  { type: '1C', fp: [0, P_.C1, P_.PW[0], P_.D], facing: 'Fletcher Street and St Joseph’s', corner: true },
];
const SF = [[1,'G',1,414.2,182000,'Available'],[2,'G',1,414.2,182000,'Available'],[3,'G',2,650.7,293000,'Available'],[4,'G',1,432.5,188000,'Available'],[5,'G',1,432.5,188000,'Available'],[6,'G',1,432.5,188000,'Available'],[7,'G',1,429.8,188000,'Available'],[8,'G',1,411.2,182000,'Available'],
  [9,'1',1,414.2,185000,'Available'],[10,'1',1,414.2,185000,'Available'],[11,'1',2,650.7,296000,'Exchanged'],[12,'1',1,432.5,192000,'In Legals'],[13,'1',1,432.5,192000,'Exchanged'],[14,'1',1,432.5,192000,'Exchanged'],[15,'1',1,429.8,192000,'In Legals'],[16,'1',1,411.2,186000,'Exchanged'],
  [17,'2',1,414.2,187000,'Exchanged'],[18,'2',1,414.2,187000,'In Legals'],[19,'2',2,650.7,298000,'Exchanged'],[20,'2',1,432.5,194000,'Exchanged'],[21,'2',1,432.5,194000,'Exchanged'],[22,'2',1,432.5,194000,'Exchanged'],[23,'2',1,429.8,194000,'Exchanged'],[24,'2',1,411.2,188000,'Exchanged'],
  [25,'3',1,414.2,189000,'Exchanged'],[26,'3',1,414.2,189000,'Exchanged'],[27,'3',2,650.7,299000,'Exchanged'],[28,'3',1,432.5,196000,'Exchanged'],[29,'3',1,432.5,196000,'Exchanged'],[30,'3',1,432.5,196000,'In Legals'],[31,'3',1,429.8,196000,'In Legals'],[32,'3',1,411.2,190000,'Exchanged'],
  [33,'4',1,414.2,184000,'Available'],[34,'4',1,414.2,184000,'Available'],[35,'4',2,650.7,295000,'Available'],[36,'4',1,432.5,189000,'Available'],[37,'4',1,432.5,189000,'Available'],[38,'4',1,432.5,189000,'Available'],[39,'4',1,429.8,189000,'Available'],[40,'4',1,411.2,184000,'Available']];
export const PH_UNITS = SF.map(([plot, fl, beds, sqft, price, status]) => {
  const floor = fl === 'G' ? 0 : +fl, k = (plot - 1) % 8, s = SLOTS[k];
  const top = floor === 4;
  const note = (s.type === '2A' ? 'End two bed, dual aspect' : s.type === '1C' ? 'Corner one bed by the core' : s.side ? 'Side block: two front doors per landing' : 'Faces St Joseph’s, garden behind') + (top ? ', top floor' : '');
  const view = s.type === '2A' ? 'Dual aspect at the quiet south end: St Joseph’s Church to the front, the residents’ garden behind'
    : s.side ? 'Faces Fletcher Street over a hedge and cobbled wall; bedroom and front door over the residents’ garden'
    : s.type === '1C' ? 'Corner one bed looking out to St Joseph’s and along Fletcher Street'
    : 'Kitchen-living looks out to St Joseph’s Church; bedroom and front door over the residents’ garden';
  return { plot, apt: `${PH_FLOORS[floor].short}.${String(k + 1).padStart(2, '0')}`, floor, type: s.type, beds, sqft: Math.round(sqft), price, status, note, view, fp: s.fp.slice(), fpS: s.fpS ? s.fpS.slice() : null, slot: k, side: !!s.side };
});

// The top floor sits in a slate mansard (A817_T_302A / T_301A elevations, T_400F section): brick 1.5 m above the third floor to the
// wall plate (+72.40), then a 58° slate slope 1.69 m high to the flat roof (+74.09), Velux-style twin rooflights in the slope over
// every window bay (RL-01..12), 2.685 m ceilings inside. Faces are façade lines in the plan frame with the outward normal; a hip
// meets the next slope at that end, otherwise the slope stops against a brick end wall.
export const PH_ROOF = {
  TF: 4 * PH_FH, KNEE: 4 * PH_FH + 1.5, TOP: 4 * PH_FH + 3.19, CEIL: 4 * PH_FH + 2.685, TH: 0.3, PITCH: 58 * Math.PI / 180,
  faces: [],   // filled below: every street-facing edge of the main block, the core and the side block
};
// outlines (plan u, v): each edge [p0, p1, slope] runs with the building on its left-hand side as seen from above in plan
// (outward normal (dv, -du)); slope = the mansard on a street face, otherwise the wall rises to the flat roof
{
  const P = PH_PLAN, [w0, w1, w2, w3] = P.WING, C = P.CORE, sd = (a, b) => phSide(a, b), S = P.SIDE;
  const ring = (pts, sl) => pts.map((p, i) => [p, pts[(i + 1) % pts.length], sl[i]]);
  PH_ROOF.main = ring([[0, P.D], [0, P.C1 + P.CH], [P.CH, P.C1], [P.US, P.C1], [P.US, 0], [P.UW, 0], [P.UW, w1], [w2, w1], [w2, w3], [P.UW, w3], [P.UW, P.D]],
    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0]);
  const sideN = (u) => sd((u - S.o[0]) / PH_SIDE.ex[0], 0);   // the side block's north wall at a given u
  PH_ROOF.core = ring([[C.u0, sideN(C.u0)[1]], [C.u0, C.v1], [0, C.v1], [0, P.D], [C.u1, P.D], sd(S.S, 0)], [1, 0, 0, 0, 0, 0]);
  PH_ROOF.side = ring([sd(0, S.T), sd(0, 0), sd(S.S, 0), sd(S.S, S.T)], [1, 0, 0, 1]);
  for (const [k, edges] of [['main', PH_ROOF.main], ['core', PH_ROOF.core], ['side', PH_ROOF.side]])
    edges.forEach(([p0, p1, sl], i) => { if (sl) { const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len]; PH_ROOF.faces.push({ id: k + i, block: k, p0, p1, n: [d[1], -d[0]], len, d }); } });
}
// the highest point inside a top-floor flat at plan (u, v): the flat ceiling, or the underside of the slope near a façade
export function phTopY(u, v) {
  const R = PH_ROOF, tn = Math.tan(R.PITCH), inset = R.TH / Math.sin(R.PITCH);
  let y = R.CEIL;
  for (const f of R.faces) {
    const s = (u - f.p0[0]) * f.d[0] + (v - f.p0[1]) * f.d[1]; if (s < -0.4 || s > f.len + 0.4) continue;
    const L = -((u - f.p0[0]) * f.n[0] + (v - f.p0[1]) * f.n[1]); if (L < -0.5 || L > 4) continue;
    y = Math.min(y, R.KNEE + (L - inset) * tn);
  }
  return y;
}
