// The Print House, 61 Wellington Street, Stockport SK1 3AD — 21 Living, Ollier Smurthwaite Architects.
// Unit data: live from Salesforce (Property__c, project "The Print House"), pulled 30 Oct 2026.
// Layout: Ollier Smurthwaite GA plans A817_C_201B–213B (Jan 2026): per floor, two 1A apartments in the side block on
// Fletcher Street, then along the main rear block from its south end: the 2A, four 1Bs and the 1C beside the core.
// Local frame (metres): origin at the north-west corner of the main block; +u runs south along the block,
// +v runs east into the courtyard garden; y up from the lower-ground floor.

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
  // placement in the town model: origin and the block's long axis (from the OSM parcel behind Seaton House)
  origin: [-55.3, 187.5], u: [-0.447, 0.894], v: [0.894, 0.447],
};
export const PH_FH = 3.05;
export const PH_FLOORS = [
  { id: 0, name: 'Lower ground', short: 'LG', level: 0 },
  { id: 1, name: 'Ground floor', short: 'G', level: 1 },
  { id: 2, name: 'First floor', short: '1', level: 2 },
  { id: 3, name: 'Second floor', short: '2', level: 3 },
  { id: 4, name: 'Third floor', short: '3', level: 4, note: 'Top floor, under the roof' },
];
// footprints [u0, v0, u1, v1] in the local frame; facing = which way the big 8 ft window looks
const SLOTS = [
  { type: '1A', fp: [0.6, 16.2, 10.2, 20.5], facing: 'Fletcher Street', side: true },
  { type: '1A', fp: [0.6, 11.9, 10.2, 16.2], facing: 'Fletcher Street', side: true },
  { type: '2A', fp: [20.4, 0, 27.2, 10.2], facing: 'St Joseph’s Church', corner: true },
  { type: '1B', fp: [16.6, 0, 20.4, 10.2], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [12.8, 0, 16.6, 10.2], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [9.0, 0, 12.8, 10.2], facing: 'St Joseph’s Church' },
  { type: '1B', fp: [5.2, 0, 9.0, 10.2], facing: 'St Joseph’s School' },
  { type: '1C', fp: [0, 0, 5.2, 10.2], facing: 'Fletcher Street and St Joseph’s', corner: true },
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
  return { plot, apt: `${PH_FLOORS[floor].short}.${String(k + 1).padStart(2, '0')}`, floor, type: s.type, beds, sqft: Math.round(sqft), price, status, note, view, fp: s.fp.slice(), slot: k, side: !!s.side };
});
