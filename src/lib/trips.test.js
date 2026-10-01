// Trips: the trip worked out from its rounds, everyone's standings, partial players, settling the
// trip once (and someone's part early), and the Tab staying exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import { sharedDebts } from './pair-debts.js';
import { applyRows, roundRows, roundStatus } from './shared-tab.js';
import { isTripPayment, settlingTrips, tripOfPayment, tripPaymentId } from './trip-pay.js';
import {
  countsByDefault, currentTrips, myTripNet, newTrip, partPlan, roundsInDates, tripByGame, tripDay, tripOnDay, tripPayRoute,
  tripPeople, tripRounds, tripStamp, tripStatus, tripsOf, cleanTripName, tripChips, tripDates, upDown,
} from './trips.js';
import { applyDoc, toDocs } from './cloud-model.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
/** Noon (local time) on a day in October 2026. */
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;

const TRIP = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });

/**
 * A finished 9-hole skins round at `skin` a skin, finished at `at`, every hole halved except the
 * ones given. `trip` stamps it; `code` makes it a round shared live.
 */
function round(id, ids, holes = {}, { at = OCT(16), trip = TRIP, code = null, skin = 2, status = 'done', playFor = null, localMe } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * HOUR;
  r.status = status;
  if (status === 'done') r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (code) r.shareCode = code;
  if (playFor) r.playFor = playFor;
  if (localMe !== undefined) r.localMe = localMe;
  return r;
}
/** `w` wins hole `no` outright (a 3 against everyone's 4). */
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const stateOf = (me, rounds, extra = {}) => ({
  me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra,
});
const FOUR = ['t', 's', 'm', 'd'];

/** Bandon: Friday and Saturday morning with all four, Saturday afternoon without Dave, Sunday all four. */
function bandon({ trip = TRIP, codes = false } = {}) {
  return [
    round('r1', FOUR, wins(FOUR, [1, 't'], [2, 't'], [3, 's']), { at: OCT(16, 15), trip, code: codes ? 'AAAAAA' : null }),
    round('r2', FOUR, wins(FOUR, [1, 'd'], [4, 's'], [5, 's']), { at: OCT(17, 11), trip, code: codes ? 'BBBBBB' : null }),
    round('r3', ['t', 's', 'm'], wins(['t', 's', 'm'], [2, 'm'], [6, 't']), { at: OCT(17, 17), trip, code: codes ? 'CCCCCC' : null }),
    round('r4', FOUR, wins(FOUR, [7, 't'], [8, 't'], [9, 'm']), { at: OCT(18, 12), trip, code: codes ? 'DDDDDD' : null }),
  ];
}

const cents = v => Math.round(v * 100);
const total = bal => Object.values(bal).reduce((a, v) => a + cents(v), 0);
/** Sum each round's own balances by player: what the trip should add up to. */
function byHand(rounds) {
  const out = {};
  for (const r of rounds) for (const [id, v] of Object.entries(roundResults(r).balances)) out[id] = (out[id] || 0) + cents(v);
  return out;
}
/** Record every line of a plan as a payment from "Settle the trip", the way the Settle screen does on a phone with no shared round. */
const payAll = (s, plan, at = OCT(18, 14)) => ({ ...s, settlements: [...s.settlements, ...plan.map((t, i) => ({ id: tripPaymentId(TRIP.id, t.from, t.to, at + i), from: t.from, to: t.to, amount: t.amount, at: at + i }))] });

// ---------------------------------------------------------------------------
// The trip from its rounds

test('a trip is worked out from the stamps on its rounds, and its own record wins', () => {
  const s = stateOf('t', bandon());
  const t = tripsOf(s).get('t_bandon');
  assert.equal(t.derived, true, 'a friend’s phone knows the trip from its rounds alone');
  assert.equal(t.name, 'Bandon 2026');
  assert.equal(t.start, '2026-10-16');
  assert.deepEqual(tripRounds(s, 't_bandon').map(r => r.id), ['r1', 'r2', 'r3', 'r4']);
  // The organizer's phone has the record (renamed since): it wins
  const own = stateOf('t', bandon(), { trips: { t_bandon: { ...TRIP, name: 'Bandon boys' } } });
  assert.equal(tripsOf(own).get('t_bandon').name, 'Bandon boys');
  assert.equal(tripsOf(own).get('t_bandon').derived, false);
  // Rounds that aren't on the trip stay off it
  const other = round('r9', ['t', 'j'], wins(['t', 'j'], [1, 't']), { at: OCT(17, 9), trip: null });
  assert.deepEqual(tripRounds(stateOf('t', [...bandon(), other]), 't_bandon').map(r => r.id), ['r1', 'r2', 'r3', 'r4']);
});

test('new trips: tidy names, the last day never before the first, a money format saved for later formats', () => {
  const t = newTrip({ id: 'x', name: '  Myrtle   Beach  ', start: '2026-11-05', end: '2026-11-02', now: OCT(1) });
  assert.equal(t.name, 'Myrtle Beach');
  assert.equal(t.end, '2026-11-05');
  assert.equal(t.format, 'money');
  assert.equal(newTrip({ id: 'y', name: '', start: '2026-11-05', end: '2026-11-07' }).name, 'Golf trip');
  assert.equal(cleanTripName('x'.repeat(50)).length, 32);
  assert.deepEqual(tripStamp(TRIP), { id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', format: 'money' });
  assert.deepEqual(tripDay(TRIP, '2026-10-17'), { day: 2, days: 3 });
  assert.deepEqual(tripDay(TRIP, '2026-10-20'), { day: null, days: 3 });
});

test('standings: everyone’s net across the trip’s rounds, adding up to zero', () => {
  const rounds = bandon();
  const s = stateOf('t', rounds);
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  const hand = byHand(rounds);
  assert.deepEqual(Object.fromEntries(st.standings.map(p => [p.id, cents(p.amount)])), hand);
  assert.equal(st.standings.reduce((a, p) => a + cents(p.amount), 0), 0);
  // Best first
  for (let i = 1; i < st.standings.length; i++) assert.ok(st.standings[i - 1].amount >= st.standings[i].amount);
  assert.equal(myTripNet(s, st), hand.t / 100);
});

test('a partial player is on the trip for their rounds only', () => {
  const rounds = bandon();
  const s = stateOf('t', rounds);
  const people = tripPeople(s, 't_bandon');
  assert.equal(people.get('d').rounds, 3, 'Dave missed Saturday afternoon');
  assert.equal(people.get('t').rounds, 4);
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  const dave = st.standings.find(p => p.id === 'd');
  assert.equal(cents(dave.amount), byHand(rounds.filter(r => r.id !== 'r3')).d, 'none of the round he missed');
  // Someone who only played one round (Kim, Friday only) owes only what Friday says, and only pays Friday's players
  const kimRound = round('r5', ['t', 'k'], wins(['t', 'k'], [1, 't'], [2, 't']), { at: OCT(16, 18) });
  const s2 = stateOf('t', [...rounds, kimRound]);
  const st2 = tripStatus(s2, 't_bandon', { now: OCT(18, 13) });
  assert.equal(cents(st2.standings.find(p => p.id === 'k').amount), cents(roundResults(kimRound).balances.k));
  for (const line of partPlan(st2.plan, 'k')) assert.equal([line.from, line.to].sort().join(), 'k,t', 'Kim only settles with Trevor, the one she played with');
});

test('people links: one person with two ids is one line in the standings', () => {
  // Sam joined Saturday from his own phone with a different id (zs); Trevor linked the two
  const rounds = bandon();
  rounds[1] = round('r2', ['t', 'zs', 'm', 'd'], wins(['t', 'zs', 'm', 'd'], [1, 'd'], [4, 'zs'], [5, 'zs']), { at: OCT(17, 11) });
  const s = stateOf('t', rounds, { links: { zs: 's' } });
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  assert.equal(st.standings.length, 4);
  assert.ok(!st.standings.some(p => p.id === 'zs'));
  assert.equal(tripPeople(s, 't_bandon').get('s').rounds, 4);
});

test('points rounds on a trip never add a dollar; an all-points trip has points standings', () => {
  const rounds = bandon();
  rounds[2] = round('r3', ['t', 's', 'm'], wins(['t', 's', 'm'], [2, 'm']), { at: OCT(17, 17), playFor: { kind: 'points' } });
  const s = stateOf('t', rounds);
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  assert.deepEqual(Object.fromEntries(st.standings.map(p => [p.id, cents(p.amount)])), byHand(rounds.filter(r => r.id !== 'r3')));
  assert.equal(st.points, null);
  const pts = [round('p1', ['t', 's'], wins(['t', 's'], [1, 't']), { at: OCT(16, 15), playFor: { kind: 'points' } })];
  const sp = tripStatus(stateOf('t', pts), 't_bandon', { now: OCT(18, 13) });
  assert.equal(sp.standings.length, 0);
  assert.ok(sp.points.t > 0);
  assert.equal(sp.plan.length, 0);
});

// ---------------------------------------------------------------------------
// The Tab: trip money is folded in, and grouping changes nothing

test('the Tab’s totals and plan are exactly the same with or without the trip', () => {
  for (const codes of [false, true]) {
    const withTrip = stateOf('t', bandon({ codes }));
    const without = stateOf('t', bandon({ codes, trip: null }));
    const now = OCT(18, 13);
    assert.deepEqual(tabBalances(withTrip), tabBalances(without));
    assert.deepEqual(outstanding(withTrip, { now }), outstanding(without, { now }));
    assert.deepEqual(sharedDebts(withTrip, { now }), sharedDebts(without, { now }));
  }
});

test('old rounds keep their money: a trip payment never touches rounds that aren’t on the trip', () => {
  const home = round('h1', ['t', 'j'], wins(['t', 'j'], [1, 't'], [2, 't']), { at: OCT(10), trip: null, code: 'HHHHHH' });
  const base = stateOf('t', [home, ...bandon({ codes: true })]);
  const now = OCT(18, 13);
  const before = sharedDebts(base, { now }).filter(d => [d.from, d.to].includes('j'));
  const st = tripStatus(base, 't_bandon', { now });
  const paid = payAll(base, st.plan.slice(0, 1));
  assert.deepEqual(sharedDebts(paid, { now }).filter(d => [d.from, d.to].includes('j')), before, 'Jess and Trevor’s home round stays between them');
  assert.ok(settlingTrips(paid).has('t_bandon'));
  assert.equal(settlingTrips(base).size, 0);
});

test('settling the trip squares it in the fewest payments, and the Tab with it', () => {
  const s = stateOf('t', bandon());
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  assert.equal(st.phase, 'ready');
  assert.ok(st.plan.length <= 3, 'never more than one fewer than the people');
  assert.ok(st.plan.length < st.perRound, 'fewer than settling round by round');
  const done = payAll(s, st.plan);
  const after = tripStatus(done, 't_bandon', { now: OCT(18, 15) });
  assert.equal(after.plan.length, 0);
  assert.equal(after.phase, 'square');
  assert.equal(after.squareAt, OCT(18, 14) + st.plan.length - 1);
  // Folded in: the trip's payments are on the Tab, so the Tab is square too
  assert.equal(outstanding(done, { now: OCT(18, 15) }).length, 0);
  assert.ok(Object.values(tabBalances(done)).every(v => Math.abs(v) < 0.005));
});

test('rounds shared live: once the trip is being settled, its money is squared across the trip, not pair by pair', () => {
  const s = stateOf('t', bandon({ codes: true }));
  const now = OCT(18, 13);
  // Before anyone pays, the Tab keeps each shared round's money between the two people, as always
  assert.ok(sharedDebts(s, { now }).length > 0);
  const st = tripStatus(s, 't_bandon', { now });
  const half = payAll(s, st.plan.slice(0, 1));
  // After the first trip payment, the trip's rounds leave the pair-by-pair layer...
  assert.equal(sharedDebts(half, { now }).length, 0);
  // ...and the Tab's plan is what's left of the trip: no money going round in circles
  const tab = outstanding(half, { now });
  const rest = tripStatus(half, 't_bandon', { now }).plan;
  assert.equal(tab.reduce((a, t) => a + cents(t.amount), 0), rest.reduce((a, t) => a + cents(t.amount), 0));
  const all = payAll(s, st.plan);
  assert.equal(outstanding(all, { now }).length, 0);
});

test('a trip payment row reaches the other phone as a trip payment, never as paying one round', () => {
  const trevor = stateOf('t', bandon({ codes: true }));
  const now = OCT(18, 13);
  const st = tripStatus(trevor, 't_bandon', { now });
  const line = st.plan[0];
  const route = tripPayRoute(trevor, 't_bandon', line.from, line.to, { now });
  assert.equal(route.code, 'DDDDDD', 'the newest shared round both played');
  const row = { code: route.code, id: tripPaymentId('t_bandon', line.from, line.to, now), kind: 'payment', from: route.from, to: route.to, amount: line.amount, status: 'paid', by: 't', reason: null, at: now, updatedAt: now };
  // Mike's phone has the same rounds (he's m there too)
  const mike = applyRows(stateOf('m', bandon({ codes: true })), [row]);
  const s = mike.settlements.find(x => x.id === row.id);
  assert.ok(s && isTripPayment(s));
  assert.equal(tripOfPayment(s), 't_bandon');
  // It squares the trip on his phone too
  assert.equal(tripStatus(mike, 't_bandon', { now }).plan.length, st.plan.length - 1);
  // The round's own who's-square status ignores it
  const r4 = mike.rounds.r4;
  assert.deepEqual(roundStatus(r4, roundRows(mike, r4)), roundStatus(r4, roundRows(stateOf('m', bandon({ codes: true })), r4)));
});

test('a round only one of them played is never the route; with no shared round it stays on this phone', () => {
  const s = stateOf('t', bandon({ codes: true }));
  // Dave missed r3 (CCCCCC), so a Dave payment goes on r4
  assert.equal(tripPayRoute(s, 't_bandon', 'd', 't', { now: OCT(18, 13) }).code, 'DDDDDD');
  const noCodes = stateOf('t', bandon());
  assert.equal(tripPayRoute(noCodes, 't_bandon', 'd', 't', { now: OCT(18, 13) }), null);
});

// ---------------------------------------------------------------------------
// Payments made elsewhere count, so the trip never asks twice

test('a round’s own settle up and a Tab payment after the trip started count toward the trip', () => {
  const rounds = bandon();
  const s = stateOf('t', rounds);
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  const r1 = roundResults(rounds[0]).transfers[0];
  // Marked paid on Friday's settle-up screen
  const marked = { ...s, settlements: [{ id: 's_1', from: r1.from, to: r1.to, amount: r1.amount, at: OCT(16, 16), roundId: 'r1' }] };
  const left = tripStatus(marked, 't_bandon', { now: OCT(18, 13) });
  const owed = st => st.plan.reduce((a, t) => a + cents(t.amount), 0);
  assert.ok(owed(left) < owed(st));
  // Paying the whole card on the Tab (no round) after the last round: the trip counts it, up to what the trip has
  const line = st.plan[0];
  const card = { ...s, settlements: [{ id: 's_2', from: line.from, to: line.to, amount: line.amount + 15, at: OCT(18, 13) }] };
  const after = tripStatus(card, 't_bandon', { now: OCT(18, 14) });
  assert.equal(owed(after), owed(st) - cents(line.amount), 'never more than the trip had them owing');
  // A payment from before the trip is old money, not the trip's
  const old = { ...s, settlements: [{ id: 's_3', from: line.from, to: line.to, amount: line.amount, at: OCT(10) }] };
  assert.equal(owed(tripStatus(old, 't_bandon', { now: OCT(18, 14) })), owed(st));
});

// ---------------------------------------------------------------------------
// When the trip opens to settle, and leaving early

test('phases: soon, being played, ready right after the last round, then square', () => {
  const soon = stateOf('t', [], { trips: { t_bandon: TRIP } });
  assert.equal(tripStatus(soon, 't_bandon', { now: OCT(10) }).phase, 'soon');
  const rounds = bandon();
  // Saturday night: the last day hasn't come, so it's still on
  assert.equal(tripStatus(stateOf('t', rounds.slice(0, 3)), 't_bandon', { now: OCT(17, 20) }).phase, 'on');
  // A round being played keeps it on, even on the last day
  const live = round('r4', FOUR, {}, { at: OCT(18, 12), status: 'active' });
  assert.equal(tripStatus(stateOf('t', [...rounds.slice(0, 3), live]), 't_bandon', { now: OCT(18, 10) }).phase, 'on');
  // Sunday's round is in: ready to settle
  assert.equal(tripStatus(stateOf('t', rounds), 't_bandon', { now: OCT(18, 13) }).phase, 'ready');
  // A planned round still to come on the last day keeps it on
  const plan = { id: 'pl1', status: 'planned', date: '2026-10-18', teeTime: '15:00', trip: tripStamp(TRIP), createdAt: OCT(15) };
  assert.equal(tripStatus(stateOf('t', rounds, { plans: { pl1: plan } }), 't_bandon', { now: OCT(18, 13) }).phase, 'on');
  // Done playing early: the organizer says so and it opens
  const early = stateOf('t', rounds.slice(0, 2), { trips: { t_bandon: { ...TRIP, endedAt: OCT(17, 12) } } });
  assert.equal(tripStatus(early, 't_bandon', { now: OCT(17, 13) }).phase, 'ready');
  // The dates went by with no rounds at all
  assert.equal(tripStatus(soon, 't_bandon', { now: OCT(25) }).phase, 'empty');
});

test('leaving early: someone settles just their part, and the rest settle after the last round', () => {
  const rounds = bandon();
  // Saturday noon, Dave heads home after two rounds
  const sat = stateOf('t', rounds.slice(0, 2));
  const st = tripStatus(sat, 't_bandon', { now: OCT(17, 12) });
  assert.equal(st.phase, 'on');
  const part = partPlan(st.plan, 'd');
  assert.ok(part.length > 0);
  // His part is exactly what he's up or down
  const dave = part.reduce((a, t) => a + (t.to === 'd' ? cents(t.amount) : -cents(t.amount)), 0);
  assert.equal(dave, cents(st.standings.find(p => p.id === 'd').amount));
  const paid = payAll(sat, part, OCT(17, 12));
  // The rest of the trip, Saturday afternoon and Sunday (Dave plays Sunday here, so take him out of it)
  const rest = [rounds[2], round('r4', ['t', 's', 'm'], wins(['t', 's', 'm'], [7, 't'], [9, 'm']), { at: OCT(18, 12) })];
  const end = { ...paid, rounds: { ...paid.rounds, ...Object.fromEntries(rest.map(r => [r.id, r])) } };
  const fin = tripStatus(end, 't_bandon', { now: OCT(18, 13) });
  assert.equal(fin.phase, 'ready');
  assert.ok(!fin.plan.some(t => t.from === 'd' || t.to === 'd'), 'Dave is square and out of it');
  const all = payAll(end, fin.plan, OCT(18, 14));
  assert.equal(tripStatus(all, 't_bandon', { now: OCT(18, 15) }).phase, 'square');
  assert.ok(Object.values(tabBalances(all)).every(v => Math.abs(v) < 0.005));
});

test('current trips: shown while on, ready or just square; gone a few days after', () => {
  const s = stateOf('t', bandon(), { trips: { t_bandon: TRIP } });
  assert.deepEqual(currentTrips(s, { now: OCT(17, 13) }).map(x => x.phase), ['on']);
  assert.deepEqual(currentTrips(s, { now: OCT(18, 13) }).map(x => x.phase), ['ready']);
  const st = tripStatus(s, 't_bandon', { now: OCT(18, 13) });
  const paid = payAll(s, st.plan);
  assert.deepEqual(currentTrips(paid, { now: OCT(19) }).map(x => x.phase), ['square']);
  assert.deepEqual(currentTrips(paid, { now: OCT(25) }), []);
  // A trip only known from a friend's stamps, with nothing planned, isn't pushed at you before it starts
  const friend = stateOf('m', []);
  assert.deepEqual(currentTrips(friend, { now: OCT(10) }), []);
});

// ---------------------------------------------------------------------------
// Counting a round for the trip

test('“Count it for the trip?”: the trip on that day, yes by default when trip people are in it', () => {
  const s = stateOf('t', bandon(), { trips: { t_bandon: TRIP } });
  assert.equal(tripOnDay(s, '2026-10-17').id, 't_bandon');
  assert.equal(tripOnDay(s, '2026-10-19'), null);
  assert.equal(countsByDefault(s, 't_bandon', ['t', 's']), true);
  assert.equal(countsByDefault(s, 't_bandon', ['t', 'j']), false, 'a round with other friends during the trip');
  assert.equal(countsByDefault(s, 't_bandon', ['t']), true);
  // A brand new trip with no rounds yet: yes
  assert.equal(countsByDefault(stateOf('t', [], { trips: { t_bandon: TRIP } }), 't_bandon', ['t', 'j']), true);
});

test('rounds in the trip’s dates can be added, and a round on another trip stays there', () => {
  const loose = round('r6', ['t', 's'], wins(['t', 's'], [1, 't']), { at: OCT(17, 8), trip: null });
  const before = round('r7', ['t', 's'], wins(['t', 's'], [1, 't']), { at: OCT(12), trip: null });
  const elsewhere = round('r8', ['t', 's'], {}, { at: OCT(17, 9), trip: { id: 't_other', name: 'Other', start: '2026-10-17', end: '2026-10-17' } });
  const s = stateOf('t', [...bandon(), loose, before, elsewhere]);
  const ids = roundsInDates(s, TRIP).map(r => r.id);
  assert.ok(ids.includes('r6'));
  assert.ok(!ids.includes('r7'));
  assert.ok(!ids.includes('r8'));
  assert.ok(['r1', 'r2', 'r3', 'r4'].every(id => ids.includes(id)));
});

test('the games view: each game’s money across the trip, read from each round’s own results', () => {
  const rounds = bandon();
  const s = stateOf('t', rounds);
  const { columns, rows } = tripByGame(s, 't_bandon');
  assert.deepEqual(columns, ['Skins']);
  const hand = byHand(rounds);
  for (const [id, row] of rows) assert.equal(cents(row.Skins), hand[id]);
});

// ---------------------------------------------------------------------------
// The record syncs with your account

test('the account profile carries trips, and an older profile keeps this phone’s', () => {
  const s = { ...stateOf('t', []), customCourses: {}, crews: {}, settings: {}, favorites: [], trips: { t_bandon: TRIP } };
  assert.deepEqual(toDocs(s)['profile:me'].data.trips, { t_bandon: TRIP });
  const draft = structuredClone(s);
  applyDoc(draft, 'profile', 'me', { me: 't', onboarded: true, favorites: [], settings: {} });
  assert.deepEqual(draft.trips, { t_bandon: TRIP });
  applyDoc(draft, 'profile', 'me', { me: 't', onboarded: true, favorites: [], settings: {}, trips: {} });
  assert.deepEqual(draft.trips, {});
  assert.equal(total({ a: 1, b: -1 }), 0);
});

test('the words: dates, the days at a glance and where you stand', () => {
  assert.equal(tripDates(TRIP), 'Oct 16 to 18');
  assert.equal(tripDates({ start: '2026-10-30', end: '2026-11-02' }), 'Oct 30 to Nov 2');
  assert.equal(tripDates({ start: '2026-10-30', end: '2026-10-30' }), 'Oct 30');
  const rounds = bandon();
  const live = round('r4', FOUR, {}, { at: OCT(18, 12), status: 'active' });
  const plan = { id: 'pl1', status: 'planned', date: '2026-10-18', teeTime: '15:00', trip: tripStamp(TRIP), createdAt: OCT(15) };
  const st = tripStatus(stateOf('t', [...rounds.slice(0, 3), live], { plans: { pl1: plan } }), 't_bandon', { now: OCT(18, 10) });
  assert.deepEqual(tripChips(st).map(c => `${c.label}:${c.state}`), ['Fri:done', 'Sat AM:done', 'Sat PM:done', 'Sun AM:now', 'Sun PM:planned']);
  assert.equal(upDown(12), 'You’re up $12');
  assert.equal(upDown(-5.5), 'You’re down $5.50');
  assert.equal(upDown(0), 'You’re even');
});
