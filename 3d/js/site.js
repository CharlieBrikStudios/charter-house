// Which development this page sells: Charter House (default) or The Print House (window.__SITE = 'ph' or ?site=ph).
// Everything the selector shows (units, floors, prices, copy) comes through here, so one engine serves both.
import * as CHD from './data.js?v=1793370097';
import { PH_SITE, PH_FLOORS, PH_UNITS, PH_FH } from './ph_data.js?v=1793370097';

export const IS_PH = typeof window !== 'undefined' && (window.__SITE === 'ph' || /[?&]site=ph\b/.test(location.search));
export const START_AREA = typeof window !== 'undefined' && (window.__START === 'area' || /[?&]start=area\b/.test(location.search));
export const UNITS = IS_PH ? PH_UNITS : CHD.UNITS;
export const FLOORS = IS_PH ? PH_FLOORS : CHD.FLOORS;
export const SITE = IS_PH ? PH_SITE : CHD.SITE;
export const FLOOR_H = IS_PH ? PH_FH : CHD.FLOOR_H;
export const STATUS = {
  ...CHD.STATUS,
  'Exchanged': { key: 'sold', label: 'Sold', color: '#7c736c' },
  'Complete': { key: 'sold', label: 'Sold', color: '#7c736c' },
};
export const INTERIORS = CHD.INTERIORS;
export const SUN = IS_PH ? {} : CHD.SUN;
export const fmtGBP = CHD.fmtGBP, sqm = CHD.sqm;
export const NAME = SITE.name;
