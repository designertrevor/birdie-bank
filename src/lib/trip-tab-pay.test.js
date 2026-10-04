// Paying a whole Tab line that has money from before a trip in it (2026-10-04 QA): Settle the trip
// has the pair square too, never the trip's part paid twice or turned around.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, tabWith } from './ledger.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { newTrip, tripStamp, tripStatus } from './trips.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (d, h = 12) => new Date(2026, 9, d, h).getTime();
const TRIP = newTrip({ id: 'tp', name: 'Bandon', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });
const NOW = OCT(19, 10);
/** Skins at `skin` a hole, `wins` [[hole, winner]], everyone else a 4. */
function round(id, ids, wins, { at, code = null, trip = true, skin = 2 } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings: { hcPct: 100, skins: { value: skin, carryover: false } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, 4]));
  for (const [no, w] of wins) r.scores[no][w] = 3;
  r.createdAt = at - 4 * 36e5; r.status = 'done'; r.finishedAt = at;
  if (trip) r.trip = tripStamp(TRIP);
  if (code) r.shareCode = code;
  return r;
}
const between = (s, a, b) => outstanding(s, { now: NOW }).filter(x => (x.from === a && x.to === b) || (x.from === b && x.to === a));

test('paying the whole Tab line squares the pair on Settle the trip too, with money from before the trip in it', () => {
  // Before the trip Sam owed Trevor $2; on it Sam owes $8 on a round shared live and Trevor owes him $2 on one only this phone has
  const pre = round('r0', ['t', 's'], [[1, 't']], { at: OCT(10), trip: false });
  const shared = round('r1', ['t', 's'], [[1, 't'], [2, 't'], [3, 't'], [4, 't']], { at: OCT(16), code: 'SHR001' });
  const local = round('r2', ['t', 's'], [[1, 's']], { at: OCT(17) });
  let s = { me: 't', players: {}, rounds: { r0: pre, r1: shared, r2: local }, settlements: [], carries: [], tabRows: {}, plans: {}, trips: { tp: TRIP } };
  const card = tabWith(outstanding(s, { now: NOW }), new Set(['t']), 's');
  const trip = tripStatus(s, 'tp', { now: NOW }).plan.find(l => l.from === 's' && l.to === 't');
  assert.ok(card > trip.amount, 'the Tab has the money from before the trip on top');
  const res = allocatePayment(s, { from: 's', to: 't', amount: card }, { now: NOW + 1000, makeId: () => 'p1' });
  s = applyRows({ ...s, settlements: [...s.settlements, ...res.settlements] }, res.rows);
  assert.deepEqual(between(s, 's', 't'), [], 'square on the Tab');
  const after = tripStatus(s, 'tp', { now: NOW + 2000 });
  assert.deepEqual(after.plan.filter(l => [l.from, l.to].includes('s') && [l.from, l.to].includes('t')), [], 'and square on the trip');
});

test('a whole Tab card paid mid-trip pays the trip part but never settles the trip', async () => {
  const { tripOnDay } = await import('./trips.js');
  const { cupTiming } = await import('./cup-stake.js');
  const { tripSettleOf, tripOfPayment } = await import('./trip-pay.js');
  // Day 1 of 3: a round only this phone has, Sam lost $4 to Trevor
  const r1 = round('r1', ['t', 's'], [[1, 't'], [2, 't']], { at: OCT(16, 15) });
  const now = OCT(16, 18);
  const s0 = { me: 't', players: {}, rounds: { r1 }, settlements: [], carries: [], tabRows: {}, plans: {}, trips: { tp: TRIP } };
  const card = tabWith(outstanding(s0, { now }), new Set(['t']), 's');
  assert.equal(card, 4);
  const res = allocatePayment(s0, { from: 's', to: 't', amount: card }, { now, makeId: () => 'p1' });
  assert.equal(res.settlements.length, 1);
  assert.equal(tripOfPayment(res.settlements[0]), 'tp', 'still counted as trip money');
  assert.equal(tripSettleOf(res.settlements[0]), null, 'but not a Settle the trip payment');
  const s1 = { ...s0, settlements: res.settlements };
  const st = tripStatus(s1, 'tp', { now });
  assert.equal(st.closed, false);
  assert.equal(st.phase, 'on');
  assert.deepEqual(st.settling, [], 'the rounds stay unlocked');
  assert.deepEqual(st.plan, [], 'the pair is square on the trip');
  assert.equal(tripOnDay(s1, '2026-10-17')?.id, 'tp', 'day 2 is still the trip');
  assert.equal(cupTiming(s1, TRIP, { now }).over, false);
  assert.deepEqual(outstanding(s1, { now }), []);
});
