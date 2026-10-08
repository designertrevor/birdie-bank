// What Up next's first paint can tell from the state without the Tab's money (ledger.js, trips.js
// and the rest load just after it, see UpNext.jsx): whether there's a finished round, and whether
// there's a trip about. Pure, tested in upnext-first.test.js.
import { roundTime } from './rounds-live.js';

/** Your newest finished round (any you kept, as History counts them), or null. The same round lastResult() names. */
export function lastDoneRound(state) {
  return Object.values(state?.rounds || {}).filter(r => r?.status === 'done').sort((a, b) => roundTime(b) - roundTime(a))[0] || null;
}

/**
 * Whether any trip is about, from the same places tripsOf() reads: a trip of its own, or a round
 * or plan stamped with one. A trip that's over or hidden still counts: the standing (trips.js)
 * decides what shows, and that comes with the money just after the first paint.
 */
export function anyTrips(state) {
  if (Object.values(state?.trips || {}).some(t => t?.id)) return true;
  if (Object.values(state?.rounds || {}).some(r => r?.trip?.id)) return true;
  return Object.values(state?.plans || {}).some(p => p?.trip?.id);
}
