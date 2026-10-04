// The cup stake the same on every phone (2026-10-04 money review): whether a stake line is on the
// Tab comes from what every phone has (cup.js stakeLink), so a Tab payment, an "I paid" mark from a
// phone not up to date and a mark from a third phone never double count or flip, and a published
// plan never leaves a friend's phone out of date for good.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, tabWith } from './ledger.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { buildPlan, duePlan, planState } from './trip-plan.js';
import { cupOnEdit, newTrip, tripPayment, tripStamp, tripStatus, tripsOf } from './trips.js';
import { mergeExpenses } from './trip-expenses.js';
import { cleanEntry, cleanRoundCup, cupEntry, roundCupResults } from './cup.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (d, h = 12) => new Date(2026, 9, d, h).getTime();
const NAMES = { t: 'Trevor', s: 'Sam', m: 'Mike', q: 'Quinn' };
const NOW = OCT(19, 10);
const cents = v => Math.round(v * 100);
const tripWith = teams => newTrip({ id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', by: 't', format: 'cup', cup: { names: ['Blue', 'Red'], teams, stake: 20 }, now: OCT(1) });
const P = id => ({ id, name: NAMES[id] });

function round(trip, id, ids, winner, at, code, { cup = true, skin = 0 } = {}) {
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x], index: 0 })), settings: { hcPct: 100, skins: { value: skin, carryover: true } }, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = Object.fromEntries(ids.map(p => [p, p === winner && h.no === 1 ? 3 : 4]));
  r.createdAt = at - 4 * 36e5; r.status = 'done'; r.finishedAt = at; r.trip = tripStamp(trip); r.shareCode = code;
  if (cup) r.cup = { kind: 'singles', sides: [[ids[0]], [ids[1]]] };
  return r;
}
const base = (me, rounds, extra = {}) => ({ me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra });
/** The organizer's phone (every teammate a player of its own) and each friend's, `z<id>`, with the other rounds from the server. */
function phones(trip, rounds, mine) {
  const remote = have => Object.fromEntries(rounds.filter(r => !have.includes(r) && r.cup).map(r => [r.shareCode, cupEntry({}, r)]));
  const out = { t: base('t', mine.t, { trips: { t_cup: trip }, players: Object.fromEntries(Object.entries(NAMES).map(([id, name]) => [id, { id, name }])), cupRemote: { t_cup: remote(mine.t) } }) };
  for (const k of Object.keys(mine)) if (k !== 't') out[k] = base(`z${k}`, mine[k].map(r => ({ ...r, localMe: k })), { players: { [`z${k}`]: { id: `z${k}`, name: NAMES[k] } }, cupRemote: { t_cup: remote(mine[k]) } });
  return out;
}
const idOn = (s, x) => (x === s.me.slice(1) ? s.me : x);
const owes = (s, x, y) => cents(tabWith(outstanding(s, { now: NOW }), new Set([idOn(s, y)]), idOn(s, x)));
const deliver = (ph, res) => {
  for (const k of Object.keys(ph)) ph[k] = { ...applyRows(ph[k], res.rows || []), tripExpenses: mergeExpenses(ph[k].tripExpenses || {}, res.expenses || []) };
};
const markOn = (ph, line, byName) => {
  const m = { id: `cup:t_cup:${line.key}:x`, key: line.key, from: line.from, to: line.to, amount: line.amount, at: NOW + 5000, byName };
  for (const k of Object.keys(ph)) ph[k] = { ...ph[k], cupRemote: { t_cup: { ...ph[k].cupRemote.t_cup, [`P${byName}`]: { byName, pays: [m] } } } };
};

test('a stake line is on the Tab, or marked paid on the trip, the same way on every phone, the organizer’s too', () => {
  // Trevor and Mike played, Sam and Quinn played: Trevor and Quinn never did, nor Sam and Mike
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const r1 = round(trip, 'r1', ['t', 'm'], 'm', OCT(16, 15), 'RRR111');
  const r2 = round(trip, 'r2', ['s', 'q'], 'q', OCT(17, 15), 'RRR222');
  const ph = phones(trip, [r1, r2], { t: [r1], q: [r2], s: [r2], m: [r1] });
  for (const [k, s] of Object.entries(ph)) {
    const st = tripStatus(s, 't_cup', { now: NOW });
    assert.deepEqual(st.cup.lines.map(l => [l.key, l.onTab]), [['t>q', false], ['s>m', false]], k);
    assert.equal(st.phase, 'ready', `${k}: marked paid on the trip`);
  }
  // So the Tab never asks Trevor to pay Quinn, on either phone, and Settle the trip can't pay Sam to Mike
  assert.equal(owes(ph.t, 't', 'q'), 0);
  assert.equal(owes(ph.q, 't', 'q'), 0);
  const res = tripPayment(ph.t, 't_cup', 's', 'm', { now: NOW + 1000 });
  assert.equal(res.expenses.length + res.rows.length + res.settlements.length, 0);
  for (const k of ['s', 'm']) assert.equal(owes(ph[k], 's', 'm'), 0, `${k}: nothing flips`);
});

test('a Tab payment and an I paid mark for the same stake line count once, on both phones', () => {
  // Trevor and Quinn played singles, Sam and Mike played: each line's two people played together
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const r1 = round(trip, 'r1', ['t', 'q'], 'q', OCT(16, 15), 'RRR111');
  const r2 = round(trip, 'r2', ['s', 'm'], 'm', OCT(17, 15), 'RRR222');
  const ph = phones(trip, [r1, r2], { t: [r1], q: [r1], s: [r2], m: [r2] });
  for (const [k, s] of Object.entries(ph)) assert.ok(tripStatus(s, 't_cup', { now: NOW }).cup.lines.every(l => l.onTab), k);
  assert.equal(owes(ph.t, 't', 'q'), 2000);
  assert.equal(owes(ph.q, 't', 'q'), 2000);
  // Trevor pays Quinn from the Tab; then Quinn, on a phone not up to date, taps I got it too
  const pay = allocatePayment(ph.t, { from: 't', to: 'q', amount: 20 }, { now: NOW + 1000, makeId: () => 'p1' });
  deliver(ph, pay);
  for (const k of ['t', 'q']) assert.equal(owes(ph[k], 't', 'q'), 0, `${k}: paid`);
  markOn(ph, tripStatus(ph.q, 't_cup', { now: NOW }).cup.lines.find(l => l.key === 't>q'), 'Quinn');
  for (const k of ['t', 'q']) {
    assert.equal(owes(ph[k], 't', 'q'), 0, `${k}: still square`);
    assert.equal(owes(ph[k], 'q', 't'), 0, `${k}: never Quinn owing Trevor`);
  }
  // Mike marks his first (a phone not up to date), then Sam pays from the Tab what it shows: nothing more
  markOn(ph, tripStatus(ph.m, 't_cup', { now: NOW }).cup.lines.find(l => l.key === 's>m'), 'Mike');
  for (const k of ['s', 'm']) assert.equal(owes(ph[k], 's', 'm') + owes(ph[k], 'm', 's'), 0, k);
});

test('a published plan covers only stake lines every phone in them works out, so no phone is left out of date', () => {
  // Sam and Trevor played a round with no matches, Trevor and Quinn a cup singles; Mike never played
  const trip = tripWith([[P('t'), P('s')], [P('m'), P('q')]]);
  const r1 = round(trip, 'r1', ['s', 't'], 's', OCT(16, 15), 'RRR111', { cup: false, skin: 1 });
  const r2 = round(trip, 'r2', ['t', 'q'], 'q', OCT(17, 15), 'RRR222', { skin: 1 });
  const ph = phones(trip, [r1, r2], { t: [r1, r2], s: [r1], q: [r2] });
  const plan = buildPlan(ph.t, 't_cup', { now: NOW });
  for (const k of Object.keys(ph)) ph[k] = { ...ph[k], tripPlans: { t_cup: plan } };
  for (const [k, s] of Object.entries(ph)) assert.equal(planState(s, 't_cup', { now: NOW }).status, 'live', k);
  assert.equal(duePlan(ph.t, tripsOf(ph.t).get('t_cup'), { now: NOW }), null);
});

test('a third phone settling a stake line between two others names them by their seats, so both their phones see it paid', () => {
  // Trevor sat in Sam and Mike's round (no match of his), so his phone settles their line for them
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const r1 = round(trip, 'r1', ['t', 'q'], 'q', OCT(16, 15), 'RRR111');
  const r2 = round(trip, 'r2', ['s', 'm', 't'], 'm', OCT(17, 15), 'RRR222');
  const ph = phones(trip, [r1, r2], { t: [r1, r2], q: [r1], s: [r2], m: [r2] });
  for (const k of ['t', 's', 'm']) assert.equal(owes(ph[k], 's', 'm'), 2000, k);
  const res = tripPayment(ph.t, 't_cup', 's', 'm', { now: NOW + 1000 });
  assert.ok(res.expenses.length + res.rows.length > 0);
  deliver(ph, res);
  for (const k of ['t', 's', 'm']) {
    assert.equal(owes(ph[k], 's', 'm'), 0, `${k}: paid`);
    assert.equal(owes(ph[k], 'm', 's'), 0, `${k}: never flipped`);
  }
});

/** A 9-hole Alternate shot round on the trip, `pairs` its two teams, Blue (t, s) against Red (q, m) on the trip. */
function altRound(trip, pairs, { status = 'done' } = {}) {
  const r = createRound({ id: 'a1', game: 'altshot', course: flat9, holesCount: 9, players: pairs.flat().map(x => ({ id: x, name: NAMES[x], index: 0 })), settings: { hcPct: 100, altshot: { format: 'total', scoring: 'match', stake: 10 } }, hcPct: 100, useHandicaps: false, teams: pairs });
  for (const h of r.holes) r.scores[h.no] = { t0: h.no === 1 ? 3 : 4, t1: 4 };
  r.createdAt = OCT(16, 8); r.status = status; if (status === 'done') r.finishedAt = OCT(16, 12);
  r.trip = tripStamp(trip);
  r.cup = { kind: 'foursomes', sides: pairs };
  return r;
}

test('an edited cup trip gives matches only to rounds not finished before the change', () => {
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const s = base('t', []);
  const { cup: _c, ...done } = altRound(trip, [['t', 's'], ['q', 'm']]);
  assert.equal(cupOnEdit(s, done), false, 'a finished round keeps its result as it was');
  assert.equal(cupOnEdit(s, { ...done, status: 'active' }), true);
});

test('foursomes pairs that mix the teams make no match, and say so, rather than a point for one team', () => {
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const ok = altRound(trip, [['t', 's'], ['q', 'm']]);
  assert.equal(roundCupResults(ok).matches.length, 1);
  // Trevor with Quinn against Sam and Mike: each pair has a Blue and a Red
  const mixed = altRound(trip, [['t', 'q'], ['s', 'm']]);
  assert.equal(cleanRoundCup(mixed).mixed, true);
  assert.deepEqual(roundCupResults(mixed).matches, []);
  const e = cupEntry({}, mixed);
  assert.equal(e.mixed, true);
  assert.equal(cleanEntry(JSON.parse(JSON.stringify(e))).mixed, true, 'another phone reads it the same');
  const st = tripStatus(base('t', [mixed], { trips: { t_cup: trip } }), 't_cup', { now: NOW });
  assert.deepEqual(st.cup.score.points, [0, 0]);
});

test('equal stakes paid between two different pairs get their own ids, and both phones of a pair the same one', () => {
  // Trevor owes Quinn $20 and Sam owes Mike $20; each pays on his own phone before anyone syncs
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const r1 = round(trip, 'r1', ['t', 'q'], 'q', OCT(16, 15), 'RRR111');
  const r2 = round(trip, 'r2', ['s', 'm'], 'm', OCT(17, 15), 'RRR222');
  const ph = phones(trip, [r1, r2], { t: [r1], q: [r1], s: [r2], m: [r2] });
  const p1 = allocatePayment(ph.t, { from: 't', to: 'q', amount: 20 }, { now: NOW + 1000, makeId: () => 'a' });
  const p2 = allocatePayment(ph.s, { from: 'zs', to: 'm', amount: 20 }, { now: NOW + 2000, makeId: () => 'b' });
  assert.equal(p1.expenses.length, 1);
  assert.equal(p2.expenses.length, 1);
  assert.notEqual(p1.expenses[0].id, p2.expenses[0].id);
  // Quinn taps it on his phone too: one payment with Trevor's
  const p3 = allocatePayment(ph.q, { from: 't', to: 'zq', amount: 20 }, { now: NOW + 3000, makeId: () => 'c' });
  assert.equal(p3.expenses[0].id, p1.expenses[0].id);
  deliver(ph, p1); deliver(ph, p2); deliver(ph, p3);
  for (const k of ['t', 'q']) assert.equal(owes(ph[k], 't', 'q'), 0, `${k}: Trevor paid Quinn`);
  for (const k of ['s', 'm']) assert.equal(owes(ph[k], 's', 'm'), 0, `${k}: Sam paid Mike`);
});

test('an I paid mark covers the stake even when the winner owes the loser for a dinner', async () => {
  const { personFor } = await import('./trip-expenses.js');
  const { stakePaymentId } = await import('./cup.js');
  // Trevor loses $20 to Quinn and paid Quinn's $30 dinner, then marks the stake paid in cash
  const trip = tripWith([[P('t'), P('s')], [P('q'), P('m')]]);
  const r1 = round(trip, 'r1', ['t', 'q'], 'q', OCT(16, 15), 'RRR111');
  const r2 = round(trip, 'r2', ['s', 'm'], 'm', OCT(17, 15), 'RRR222');
  let s = phones(trip, [r1, r2], { t: [r1] }).t;
  const dinner = { id: 'x_dinner', tripId: 't_cup', what: 'Dinner', amount: 30, split: 'equal', payer: personFor(s, 't_cup', 't', 'Trevor'), people: [personFor(s, 't_cup', 'q', 'Quinn')], by: 't', at: OCT(17, 20), updatedAt: OCT(17, 20) };
  s = { ...s, tripExpenses: mergeExpenses({}, [dinner]) };
  assert.equal(owes(s, 'q', 't'), 1000, 'the dinner less the stake');
  const mark = { id: stakePaymentId('t_cup', 't>q', NOW), key: 't>q', from: 't', to: 'q', amount: 20, at: NOW, byName: 'Quinn' };
  s = { ...s, cupRemote: { t_cup: { ...s.cupRemote.t_cup, Pq: { byName: 'Quinn', pays: [mark] } } } };
  assert.equal(tripStatus(s, 't_cup', { now: NOW }).cup.lines.find(l => l.key === 't>q').open, 0, 'the mark covers the stake');
  assert.equal(owes(s, 'q', 't'), 3000, 'Quinn owes Trevor the whole dinner');
});
