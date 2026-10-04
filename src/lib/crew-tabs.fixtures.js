// Rounds and a phone for the crew and trip tab tests (crew-tabs.test.js, books.test.js).
import { createRound } from './round.js';
import { newTrip, tripStamp } from './trips.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
export const OCT = (d, h = 12) => new Date(2026, 9, d, h).getTime();
export const NOW = OCT(20, 10);
export const TRIP = newTrip({ id: 'tp', name: 'Bandon', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });

/** Skins at `skin` a hole, `wins` [[hole, winner]], everyone else a 4. */
export function skins(id, ids, wins, { at, code = null, trip = false, skin = 2 } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: skin, carryover: false } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [no, w] of wins) r.scores[no][w] = 3;
  r.createdAt = at - 4 * 36e5; r.status = 'done'; r.finishedAt = at;
  if (trip) r.trip = tripStamp(TRIP);
  if (code) r.shareCode = code;
  return r;
}
const players = ids => Object.fromEntries(ids.map(id => [id, { id, name: id.toUpperCase() }]));
/** Trevor's phone ('t') with the Saturday crew (a and b) and these rounds. */
export function base(rounds, extra = {}) {
  return { me: 't', players: players(['t', 'a', 'b', 'c', 'd']), crews: { sat: { id: 'sat', name: 'Saturday crew', playerIds: ['a', 'b'] } }, customCourses: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra };
}
