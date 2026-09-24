// Distances are stored in yards; shown in the user's unit.
const M_PER_YD = 0.9144;

export function distLabel(units) { return units === 'metres' ? 'Metres' : 'Yards'; }
export function distShort(units) { return units === 'metres' ? 'm' : 'yds'; }
export function showDist(yards, units) {
  if (yards == null) return null;
  return units === 'metres' ? Math.round(yards * M_PER_YD) : yards;
}
/** Convert a value typed in the user's unit back to yards for storage. */
export function toYards(v, units) {
  if (v == null) return null;
  return units === 'metres' ? Math.round(v / M_PER_YD) : v;
}
