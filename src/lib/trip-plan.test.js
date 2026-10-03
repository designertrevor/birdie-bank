// The trip's published plan: the organizer's phone works out the fewest payments for the whole
// trip, every phone settles from it and agrees, and before there's a plan (the SQL hasn't run) or
// while one is out of date, everything is exactly as it was: pair by pair.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { fewestPayments, outstanding, tabBalances, tabWith } from './ledger.js';
import { paidOn, sharedDebts, codeOf } from './pair-debts.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { isTripPayment, tripOfPayment, tripSettleOf } from './trip-pay.js';
import { buildPlan, cleanPlan, coveredRounds, duePlan, isPlanPayment, planPaymentId, planState, roundMark, samePlan } from './trip-plan.js';
import {
  canDeleteTrip, countsByDefault, currentTrips, isOrganizer, newTrip, partPlan, tripGoing, tripHidden, tripOnDay, tripPayment, tripStamp, tripStatus, tripsOf,
} from './trips.js';
import { applyDoc, toDocs } from './cloud-model.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;
const TRIP = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });

function round(id, ids, holes = {}, { at = OCT(16), trip = TRIP, code = null, skin = 2 } = {}) {
  const settings = { hcPct: 100, skins: { value: skin, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: x.toUpperCase(), index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.createdAt = at - 4 * HOUR;
  r.status = 'done';
  r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (code) r.shareCode = code;
  return r;
}
const wins = (ids, ...list) => Object.fromEntries(list.map(([no, w]) => [no, Object.fromEntries(ids.map(p => [p, p === w ? 3 : 4]))]));
const stateOf = (me, rounds, extra = {}) => ({
  me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra,
});
const cents = v => Math.round(v * 100);
const NOW = OCT(18, 13);

/**
 * Five friends over three rounds, all shared live. Round by round (and pair by pair) it takes a
 * lot of payments; across the whole trip far fewer. Eve only plays the first round, Cal skips the
 * second, so their phones never see the whole trip.
 */
function rounds5() {
  const all = ['t', 'a', 'b', 'c', 'e'];
  const tab = ['t', 'a', 'b'], tabc = ['t', 'a', 'b', 'c'];
  const r1 = round('q1', all, wins(all, [1, 'a'], [2, 'a'], [3, 'c'], [4, 'e'], [5, 't'], [6, 'b'], [7, 't'], [8, 'a'], [9, 'e']), { at: OCT(16, 15), code: 'AAAAAA', skin: 5 });
  const r2 = round('q2', tab, wins(tab, [1, 'b'], [2, 'b'], [3, 'b'], [4, 't'], [5, 'a'], [6, 'b'], [7, 't'], [8, 'b'], [9, 'b']), { at: OCT(17, 11), code: 'BBBBBB', skin: 5 });
  const r3 = round('q3', tabc, wins(tabc, [1, 'c'], [2, 'c'], [3, 'c'], [4, 'a'], [5, 'a'], [6, 't'], [7, 'c'], [8, 'c'], [9, 't']), { at: OCT(18, 12), code: 'CCCCCC', skin: 5 });
  return [r1, r2, r3];
}
/** Each phone holds the rounds its person played; a friend's phone knows them by their seat in each round. */
function phonesOf(rounds) {
  const on = (me, list) => stateOf(`z${me}`, list.map(r => ({ ...r, localMe: me })));
  const has = id => rounds.filter(r => r.players.some(p => p.id === id));
  return {
    t: stateOf('t', rounds, { trips: { t_bandon: TRIP } }),
    a: on('a', has('a')), b: on('b', has('b')), c: on('c', has('c')), e: on('e', has('e')),
  };
}
/** Send rows to every phone that has their round, the way the server does. */
const deliver = (phones, rows) => { for (const k of Object.keys(phones)) phones[k] = applyRows(phones[k], rows); };
/** The organizer publishes; every phone on the trip reads the same plan. */
const publish = (phones, plan) => { for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripPlans: { t_bandon: plan } }; };
/** A phone's id for someone, as the rounds have them. */
const idOn = (s, x) => (x === s.me.slice(1) ? s.me : x);
/** What a phone's Tab says `x` owes `y`, in cents. */
const owes = (s, x, y, now = NOW) => cents(tabWith(outstanding(s, { now }), new Set([idOn(s, y)]), idOn(s, x)));
/** Your total on the Tab: what everyone owes you, less what you owe. */
function myTotal(s, now = NOW) {
  const plan = outstanding(s, { now });
  return plan.reduce((a, t) => a + (t.to === s.me ? cents(t.amount) : t.from === s.me ? -cents(t.amount) : 0), 0);
}
const PAIRS = [['t', 'a'], ['t', 'b'], ['t', 'c'], ['t', 'e'], ['a', 'b'], ['a', 'c'], ['a', 'e'], ['b', 'c'], ['b', 'e'], ['c', 'e']];
/** Both phones of every pair say the same, and it's what the plan says (`expect`, cents x owes y). */
function agree(phones, expect = null) {
  for (const [x, y] of PAIRS) {
    const seen = [x, y].filter(k => phones[k].rounds && Object.values(phones[k].rounds).length).map(k => owes(phones[k], x, y));
    assert.equal(new Set(seen).size, 1, `${x} and ${y}’s phones agree (${seen})`);
    if (expect) assert.equal(seen[0], expect(x, y), `${x} and ${y} are what the plan says`);
  }
}
/** Cents x owes y on a plan (lines are seat ids, the same as these test ids). */
const onPlan = plan => (x, y) => plan.lines.reduce((a, l) => a + (l.from === x && l.to === y ? cents(l.amount) : l.from === y && l.to === x ? -cents(l.amount) : 0), 0);

test('the published plan is the fewest payments over the whole trip', () => {
  const rounds = rounds5();
  const s = stateOf('t', rounds, { trips: { t_bandon: TRIP } });
  const plan = buildPlan(s, 't_bandon', { now: NOW });
  assert.equal(plan.version, 1);
  assert.deepEqual(plan.rounds.map(r => r.code), ['AAAAAA', 'BBBBBB', 'CCCCCC']);
  // Everyone's trip total, by hand
  const hand = {};
  for (const r of rounds) for (const [id, v] of Object.entries(roundResults(r).balances)) hand[id] = (hand[id] || 0) + cents(v);
  const byPlan = {};
  for (const l of plan.lines) { byPlan[l.from] = (byPlan[l.from] || 0) - cents(l.amount); byPlan[l.to] = (byPlan[l.to] || 0) + cents(l.amount); }
  for (const [id, c] of Object.entries(hand)) assert.equal(byPlan[id] || 0, c, `${id}’s lines are exactly their trip total`);
  // As few as the trip's totals allow, and fewer than pair by pair
  const fewest = fewestPayments(Object.fromEntries(Object.entries(hand).map(([k, c]) => [k, c / 100])));
  assert.equal(plan.lines.length, fewest.length);
  assert.ok(plan.lines.length <= Object.keys(hand).filter(k => hand[k]).length - 1);
  assert.ok(plan.lines.length < sharedDebts(s, { now: NOW }).length, `fewer than pair by pair (${plan.lines.length} vs ${sharedDebts(s, { now: NOW }).length})`);
  // Each line is between two people who played a round together, on a round both played
  for (const l of plan.lines) {
    const r = rounds.find(x => codeOf(x) === l.code);
    assert.ok(r.players.some(p => p.id === l.from) && r.players.some(p => p.id === l.to));
  }
  assert.ok(samePlan(plan, buildPlan(s, 't_bandon', { now: NOW + 5000, version: 9 })), 'the same rounds give the same plan');
});

test('before the SQL runs (no plan), everything is exactly what it was: pair by pair', () => {
  const phones = phonesOf(rounds5());
  for (const k of Object.keys(phones)) {
    const s = phones[k];
    const before = { tab: outstanding(s, { now: NOW }), bal: tabBalances(s), st: tripStatus(s, 't_bandon', { now: NOW }) };
    for (const extra of [{}, { tripPlans: {} }, { tripPlans: { t_bandon: { junk: true } } }]) {
      const same = { ...s, ...extra };
      assert.deepEqual(outstanding(same, { now: NOW }), before.tab);
      assert.deepEqual(tabBalances(same), before.bal);
      assert.deepEqual(tripStatus(same, 't_bandon', { now: NOW }).plan, before.st.plan);
      assert.equal(tripStatus(same, 't_bandon', { now: NOW }).published.status, 'none');
    }
    // Pair by pair: the trip's plan is the Tab's own pair-by-pair money
    assert.ok(before.st.plan.every(t => t.plan === 0 && t.local === 0));
  }
  agree(phones);
});

test('with the plan published, every phone agrees with it and the Tab totals stay the same', () => {
  const phones = phonesOf(rounds5());
  const totals = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  publish(phones, plan);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'live', `${k}’s phone takes the plan`);
    assert.equal(myTotal(s), totals[k], `${k}’s total on the Tab is unchanged`);
    assert.equal(cents(tabBalances(s)[s.me] || 0), totals[k], 'and it’s still what their balance says');
  }
  agree(phones, onPlan(plan));
  // Settle the trip on each phone lists the plan's lines that phone can see, the same amounts
  for (const [k, s] of Object.entries(phones)) {
    const mine = tripStatus(s, 't_bandon', { now: NOW }).plan.filter(t => t.from === s.me || t.to === s.me);
    const want = plan.lines.filter(l => l.from === k || l.to === k).map(l => `${l.from}>${l.to} ${cents(l.amount)}`).sort();
    assert.deepEqual(mine.map(t => `${t.from === s.me ? k : t.from}>${t.to === s.me ? k : t.to} ${cents(t.amount)}`).sort(), want);
  }
});

test('paying the plan squares the trip and the Tab on every phone, counted once', () => {
  const phones = phonesOf(rounds5());
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  publish(phones, plan);
  // Each person marks their own line from their own phone
  for (const l of plan.lines) {
    const k = l.from;
    const s = phones[k];
    const { rows, settlements } = tripPayment(s, 't_bandon', idOn(s, l.from), idOn(s, l.to), { now: NOW + 60e3 });
    assert.equal(settlements.length, 0, 'it all rides on the rounds, nothing stays on one phone');
    assert.ok(rows.length && rows.every(r => isPlanPayment({ id: r.id }) && r.code === l.code));
    deliver(phones, rows);
  }
  for (const [k, s] of Object.entries(phones)) {
    const st = tripStatus(s, 't_bandon', { now: NOW + 120e3 });
    assert.equal(st.plan.length, 0, `${k}’s trip is square`);
    assert.equal(st.phase, 'square');
    assert.ok(st.closed, 'and it says the trip was settled');
    assert.equal(outstanding(s, { now: NOW + 120e3 }).filter(t => t.from === s.me || t.to === s.me).length, 0, `${k}’s Tab is square`);
    assert.equal(Math.abs(cents(tabBalances(s)[s.me] || 0)), 0);
  }
  // A plan payment never counts as paid on a round's own transfers
  const s = phones.t;
  for (const r of Object.values(s.rounds)) for (const t of roundResults(r).transfers) assert.equal(paidOn(s, r, codeOf(r), t), 0);
});

test('a whole-card payment on the Tab pays the plan between the two, and the other phone sees it', () => {
  const phones = phonesOf(rounds5());
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  const line = phones.t.tripPlans.t_bandon.lines.find(l => l.from === 't' || l.to === 't');
  const other = line.from === 't' ? line.to : line.from;
  const [from, to] = line.from === 't' ? ['t', other] : [other, 't'];
  const due = owes(phones.t, from, to);
  assert.ok(due > 0);
  const { rows, settlements } = allocatePayment(phones.t, { from, to, amount: due / 100 }, { now: NOW + 1000 });
  assert.equal(settlements.length, 0);
  assert.ok(rows.length && rows.every(r => isPlanPayment({ id: r.id })));
  deliver(phones, rows);
  assert.equal(owes(phones.t, from, to), 0);
  assert.equal(owes(phones[other], from, to), 0, 'the friend’s phone sees it');
  agree(phones);
});

test('a partial player settles their part early on the plan, and the trip goes on without them', () => {
  // Saturday noon: two rounds in, Eve (first round only) heads home
  const [r1, r2, r3] = rounds5();
  const phones = phonesOf([r1, r2]);
  const sat = OCT(17, 12);
  const v1 = buildPlan(phones.t, 't_bandon', { now: sat });
  publish(phones, v1);
  const eve = partPlan(tripStatus(phones.e, 't_bandon', { now: sat }).plan, 'ze');
  assert.ok(eve.length > 0);
  // Her part is exactly what she's up or down
  const net = eve.reduce((a, t) => a + (t.to === 'ze' ? cents(t.amount) : -cents(t.amount)), 0);
  assert.equal(net, cents(roundResults(r1).balances.e));
  for (const t of eve) deliver(phones, tripPayment(phones.e, 't_bandon', t.from, t.to, { now: sat + 1000, part: true }).rows);
  assert.equal(partPlan(tripStatus(phones.e, 't_bandon', { now: sat + 2000 }).plan, 'ze').length, 0, 'Eve is square');
  assert.ok(!tripStatus(phones.t, 't_bandon', { now: sat + 2000 }).closed, 'her part never closes the trip');
  // Sunday's round comes in: the plan doesn't cover it yet, so it waits pair by pair (both phones agree)
  for (const k of ['t', 'a', 'b', 'c']) phones[k] = { ...phones[k], rounds: { ...phones[k].rounds, q3: k === 't' ? r3 : { ...r3, localMe: k } } };
  const ps = planState(phones.t, 't_bandon', { now: NOW });
  assert.equal(ps.status, 'live');
  assert.deepEqual(ps.pending, ['q3']);
  agree(phones);
  // The organizer's phone republishes: version 2 covers it and counts Eve's payments
  const v2 = buildPlan(phones.t, 't_bandon', { now: NOW, version: 2 });
  assert.equal(v2.rounds.length, 3);
  assert.ok(!v2.lines.some(l => l.from === 'e' || l.to === 'e'), 'Eve is out of it');
  publish(phones, v2);
  for (const [k, s] of Object.entries(phones)) assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'live', `${k} takes version 2`);
  agree(phones, onPlan(v2));
  // Everyone else pays; all square, and Eve was never asked twice
  for (const l of v2.lines) deliver(phones, tripPayment(phones[l.from], 't_bandon', idOn(phones[l.from], l.from), idOn(phones[l.from], l.to), { now: NOW + 5000 }).rows);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(tripStatus(s, 't_bandon', { now: NOW + 9000 }).plan.length, 0, `${k} square`);
    assert.equal(cents(tabBalances(s)[s.me] || 0), 0, `${k}’s balance is zero`);
  }
});

test('a fixed score makes the plan out of date: that phone goes pair by pair until version 2', () => {
  const rounds = rounds5();
  const phones = phonesOf(rounds);
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  // Hole 9 of the second round is fixed on Andy's phone first
  const fixed = structuredClone(phones.a.rounds.q2);
  fixed.scores[9] = { t: 4, a: 3, b: 4 };
  const stale = { ...phones.a, rounds: { ...phones.a.rounds, q2: fixed } };
  assert.notEqual(roundMark(fixed), roundMark(rounds[1]));
  const st = tripStatus(stale, 't_bandon', { now: NOW });
  assert.equal(st.published.status, 'stale');
  // Exactly the pair-by-pair Tab, as if there were no plan
  const { tripPlans: _p, ...bare } = stale;
  assert.deepEqual(outstanding(stale, { now: NOW }), outstanding(bare, { now: NOW }));
  assert.deepEqual(st.plan, tripStatus(bare, 't_bandon', { now: NOW }).plan);
  assert.equal(coveredRounds(stale, { now: NOW }).size, 0);
  // The fix reaches every phone in that round and the organizer's, which republishes
  for (const k of ['t', 'a', 'b']) phones[k] = { ...phones[k], rounds: { ...phones[k].rounds, q2: k === 't' ? { ...fixed, localMe: undefined } : { ...fixed, localMe: k } } };
  delete phones.t.rounds.q2.localMe;
  assert.equal(planState(phones.t, 't_bandon', { now: NOW }).status, 'stale');
  const v2 = buildPlan(phones.t, 't_bandon', { now: NOW, version: 2 });
  publish(phones, v2);
  for (const [k, s] of Object.entries(phones)) assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'live', k);
  agree(phones, onPlan(v2));
});

test('a payment the plan didn’t count makes it out of date, and the next version counts it', () => {
  const phones = phonesOf(rounds5());
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  // An older phone marks one of round 1's transfers paid on the round itself
  const t = roundResults(phones.t.rounds.q1).transfers[0];
  const row = { code: 'AAAAAA', id: `AAAAAA:${t.from}>${t.to}`, kind: 'payment', from: t.from, to: t.to, amount: t.amount, status: 'paid', by: t.from, reason: null, at: NOW, updatedAt: NOW };
  deliver(phones, [row]);
  for (const k of Object.keys(phones)) {
    const played = Object.values(phones[k].rounds).some(r => r.id === 'q1');
    if (played) assert.equal(planState(phones[k], 't_bandon', { now: NOW }).status, 'stale', k);
  }
  const v2 = buildPlan(phones.t, 't_bandon', { now: NOW, version: 2 });
  assert.ok(v2.netted.includes(`AAAAAA|${row.id}`));
  publish(phones, v2);
  for (const k of Object.keys(phones)) assert.equal(planState(phones[k], 't_bandon', { now: NOW }).status, 'live', k);
  agree(phones, onPlan(v2));
});

test('a plan that doesn’t add up for you, or names someone not in its round, is never used', () => {
  const phones = phonesOf(rounds5());
  const plan = buildPlan(phones.t, 't_bandon', { now: NOW });
  const off = structuredClone(plan);
  off.lines[0].amount += 1;
  for (const k of [off.lines[0].from, off.lines[0].to]) {
    const s = { ...phones[k], tripPlans: { t_bandon: off } };
    assert.equal(planState(s, 't_bandon', { now: NOW }).status, 'stale', `${k}’s lines don’t add up`);
    assert.deepEqual(outstanding(s, { now: NOW }), outstanding(phones[k], { now: NOW }));
  }
  const stranger = structuredClone(plan);
  stranger.lines[0].from = 'nobody';
  assert.equal(planState({ ...phones.t, tripPlans: { t_bandon: stranger } }, 't_bandon', { now: NOW }).status, 'stale');
  assert.equal(cleanPlan({ tripId: 'x', rounds: 'no' }), null);
  assert.equal(cleanPlan(null), null);
});

test('old rounds keep their money with a plan in force', () => {
  const home = round('h1', ['t', 'j'], wins(['t', 'j'], [1, 't'], [2, 't']), { at: OCT(10), trip: null, code: 'HHHHHH' });
  const base = stateOf('t', [home, ...rounds5()], { trips: { t_bandon: TRIP } });
  const before = owes(base, 'j', 't');
  assert.ok(before > 0);
  const withPlan = { ...base, tripPlans: { t_bandon: buildPlan(base, 't_bandon', { now: NOW }) } };
  assert.equal(planState(withPlan, 't_bandon', { now: NOW }).status, 'live');
  assert.equal(owes(withPlan, 'j', 't'), before, 'Jess and Trevor’s home round stays between them');
  assert.ok(!coveredRounds(withPlan, { now: NOW }).has('h1'));
  assert.equal(myTotal(withPlan), myTotal(base));
});

test('plan payments: their id names the trip, so they never touch a round’s own transfers', () => {
  const id = planPaymentId('t_bandon', 'a', 'b', NOW);
  assert.equal(tripOfPayment({ id }), 't_bandon');
  assert.ok(isTripPayment({ id }));
  assert.ok(isPlanPayment({ id }));
  assert.ok(!isPlanPayment({ id: 'trip:t_bandon:a>b:x' }), 'a local trip payment is not a plan payment');
  assert.deepEqual(tripSettleOf({ id, reason: 'trip-part:t_bandon' }), { id: 't_bandon', part: true });
});

test('“Done playing” and a deleted trip reach friends’ phones through the plan', () => {
  const phones = phonesOf(rounds5().slice(0, 2));
  const sat = OCT(17, 13);
  assert.equal(tripStatus(phones.a, 't_bandon', { now: sat }).phase, 'on');
  publish(phones, buildPlan(phones.t, 't_bandon', { now: sat, endedAt: sat - 1000 }));
  assert.equal(tripStatus(phones.a, 't_bandon', { now: sat }).phase, 'ready', 'the organizer said done playing');
  assert.equal(tripOnDay(phones.a, '2026-10-17'), null, 'and it takes no more rounds');
  publish(phones, { tripId: 't_bandon', version: 3, deleted: true, at: sat });
  assert.equal(tripsOf(phones.a).has('t_bandon'), false, 'gone from the friend’s phone');
  assert.equal(tripStatus(phones.a, 't_bandon', { now: sat }), null);
  assert.equal(coveredRounds(phones.a, { now: sat }).size, 0, 'the rounds go back to pair by pair');
});

// ---------------------------------------------------------------------------
// The organizer, who's going, hiding a trip

test('only the organizer edits or deletes, and only before any trip money is paid', () => {
  const rounds = rounds5();
  const t = stateOf('t', rounds, { trips: { t_bandon: TRIP } });
  const a = phonesOf(rounds).a;
  assert.ok(isOrganizer(t, tripsOf(t).get('t_bandon')));
  assert.ok(!isOrganizer(a, tripsOf(a).get('t_bandon')), 'a friend’s phone knows it from the stamps');
  const st = tripStatus(t, 't_bandon', { now: NOW });
  // Finished rounds shared live: only with trip plans on, so friends hear it's gone
  assert.deepEqual(canDeleteTrip(t, st), { ok: false, everywhere: false });
  assert.deepEqual(canDeleteTrip(t, st, { plansOn: true }), { ok: true, everywhere: true });
  assert.equal(canDeleteTrip(a, tripStatus(a, 't_bandon', { now: NOW }), { plansOn: true }).ok, false);
  // Money paid on the trip: no deleting
  const tr = roundResults(rounds[0]).transfers[0];
  const paid = { ...t, settlements: [{ id: 's1', from: tr.from, to: tr.to, amount: tr.amount, at: NOW, roundId: 'q1', code: 'AAAAAA', shared: true }] };
  assert.equal(canDeleteTrip(paid, tripStatus(paid, 't_bandon', { now: NOW }), { plansOn: true }).ok, false);
  // A trip with no rounds yet: yes, plans or not
  const fresh = stateOf('t', [], { trips: { t_bandon: TRIP } });
  assert.deepEqual(canDeleteTrip(fresh, tripStatus(fresh, 't_bandon', { now: OCT(10) })), { ok: true, everywhere: false });
});

test('who’s going: the standings and “Count it for the trip?” know them before anyone plays', () => {
  const trip = newTrip({ id: 't_bandon', name: 'Bandon 2026', start: '2026-10-16', end: '2026-10-18', by: 't', people: ['s', 'm', 't', 's', ''], now: OCT(1) });
  assert.deepEqual(trip.people, ['s', 'm'], 'distinct, and never the organizer twice');
  const s = stateOf('t', [], { trips: { t_bandon: trip } });
  assert.deepEqual(tripGoing(s, tripsOf(s).get('t_bandon')), ['t', 's', 'm']);
  assert.deepEqual(tripStatus(s, 't_bandon', { now: OCT(10) }).going, ['t', 's', 'm']);
  assert.equal(countsByDefault(s, 't_bandon', ['t', 's']), true);
  assert.equal(countsByDefault(s, 't_bandon', ['t', 'j']), false, 'a round with friends not on the trip');
  // Someone who plays a trip round is on it too, picked or not
  const kim = round('k1', ['t', 'k'], wins(['t', 'k'], [1, 't']), { at: OCT(16, 15), trip });
  const s2 = { ...s, rounds: { k1: kim } };
  assert.equal(countsByDefault(s2, 't_bandon', ['t', 'k']), true);
  assert.ok(tripStatus(s2, 't_bandon', { now: OCT(16, 16) }).standings.some(p => p.id === 'k'));
});

test('the trip card stays on the Tab and Up next until you hide it', () => {
  const rounds = rounds5();
  const s = stateOf('t', rounds, { trips: { t_bandon: TRIP } });
  const st = tripStatus(s, 't_bandon', { now: NOW });
  // Square long ago still shows: no timer
  const paid = { ...s, settlements: st.plan.map((t, i) => ({ id: `trip:t_bandon:${t.from}>${t.to}:${i}`, from: t.from, to: t.to, amount: t.amount, at: NOW + i })) };
  assert.deepEqual(currentTrips(s, { now: OCT(18, 13) + 90 * 864e5 }).map(x => x.phase), ['ready']);
  assert.equal(currentTrips(paid, { now: NOW + 90 * 864e5 }).length, 1);
  // Hidden: gone from this phone's Tab and Up next; rounds and money untouched
  const hidden = { ...s, tripHidden: { t_bandon: NOW } };
  assert.ok(tripHidden(hidden, 't_bandon'));
  assert.deepEqual(currentTrips(hidden, { now: NOW }), []);
  assert.deepEqual(outstanding(hidden, { now: NOW }), outstanding(s, { now: NOW }));
  assert.deepEqual(tripStatus(hidden, 't_bandon', { now: NOW }).plan, st.plan);
  // Playing another round for it brings it back
  const more = round('q4', ['t', 'a'], wins(['t', 'a'], [1, 'a']), { at: NOW + 3 * HOUR + 4 * HOUR });
  assert.ok(!tripHidden({ ...hidden, rounds: { ...hidden.rounds, q4: more } }, 't_bandon'));
  // It rides in the account profile
  const draft = { trips: {} };
  applyDoc(draft, 'profile', 'me', toDocs({ ...hidden, players: {}, crews: {}, customCourses: {}, settings: {} })['profile:me'].data);
  assert.deepEqual(draft.tripHidden, { t_bandon: NOW });
});

test('the organizer’s phone republishes only when the plan out there stops holding, and phones say “Updated”', () => {
  const [r1, r2, r3] = rounds5();
  const phones = phonesOf([r1, r2]);
  const trip = tripsOf(phones.t).get('t_bandon');
  const v1 = duePlan(phones.t, trip, { now: NOW, byName: 'Trevor' });
  assert.equal(v1.version, 1);
  assert.equal(v1.byName, 'Trevor');
  publish(phones, v1);
  phones.a = { ...phones.a, tripPlanSeen: { t_bandon: 1 } };
  assert.equal(duePlan(phones.t, trip, { now: NOW }), null, 'it still holds');
  assert.equal(tripStatus(phones.a, 't_bandon', { now: NOW }).published.updated, false);
  // A plan payment doesn't need a new version
  const l = v1.lines[0];
  deliver(phones, tripPayment(phones[l.from], 't_bandon', idOn(phones[l.from], l.from), idOn(phones[l.from], l.to), { now: NOW }).rows);
  assert.equal(duePlan(phones.t, trip, { now: NOW }), null);
  // A new round does
  for (const k of ['t', 'a', 'b', 'c']) phones[k] = { ...phones[k], rounds: { ...phones[k].rounds, q3: k === 't' ? r3 : { ...r3, localMe: k } } };
  const v2 = duePlan(phones.t, trip, { now: NOW });
  assert.equal(v2.version, 2);
  publish(phones, v2);
  const st = tripStatus(phones.a, 't_bandon', { now: NOW });
  assert.equal(st.published.status, 'live');
  assert.equal(st.published.updated, true, 'Andy saw version 1, so version 2 says Updated');
  assert.equal(st.published.version, 2);
  // "Done playing" goes out in the next version
  assert.equal(duePlan(phones.t, { ...trip, endedAt: NOW }, { now: NOW }).endedAt, NOW);
  // A deleted trip is never republished
  assert.equal(duePlan({ ...phones.t, tripPlans: { t_bandon: { tripId: 't_bandon', version: 3, deleted: true } } }, trip, { now: NOW }), null);
});

test('a trip round the organizer didn’t play stays between its players, and their Settle the trip says so', () => {
  const ab = ['a', 'b'];
  const q4 = round('q4', ab, wins(ab, [1, 'a'], [2, 'a']), { at: OCT(18, 9), code: 'DDDDDD', skin: 5 });
  const phones = phonesOf([...rounds5(), q4]);
  publish(phones, buildPlan(phones.t, 't_bandon', { now: NOW }));
  const onA = tripStatus(phones.a, 't_bandon', { now: NOW });
  assert.equal(planState(phones.a, 't_bandon', { now: NOW }).status, 'live');
  assert.deepEqual(onA.between.map(r => r.id), ['q4']);
  assert.ok(onA.plan.some(t => t.amount > 0), 'its money is still in a’s payments');
  assert.deepEqual(tripStatus(phones.t, 't_bandon', { now: NOW }).between, [], 'the organizer’s phone doesn’t have it');
  assert.deepEqual(tripStatus(phones.c, 't_bandon', { now: NOW }).between, [], 'nor does anyone who didn’t play it');
});
