// A trip's handicap flights as saved (flights.js has the rest). Split out so a trip's stamp and
// status read them without loading the flights' boards and team picking. Pure, no imports.

export const FLIGHT_NAMES = ['A', 'B', 'C', 'D'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** A trip's flights as saved: up to four lists of { id, name }, each person once, or null. */
export function cleanFlights(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = raw.slice(0, FLIGHT_NAMES.length).map(f => (Array.isArray(f) ? f : [])
    .filter(p => isObj(p) && isStr(p.id) && !seen.has(p.id) && seen.add(p.id)).slice(0, 24)
    .map(p => ({ id: p.id, name: String(p.name || '').trim().slice(0, 40) || 'Player' })))
    .filter(f => f.length);
  return out.length ? out : null;
}

