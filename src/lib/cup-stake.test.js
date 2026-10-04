// A team points trip's stake as trip money (cup-stake.js, 2026-10-04): once the cup is decided it's in
// each person's balance on the Tab, Settle the trip and the published plan, exactly once, the same on
// every phone; paying it from the Tab or Settle the trip squares it on both phones; the "I paid"
// marks from before still count. And foursomes (alternate shot) as a cup match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { outstanding, personStory, tabBalances, tabWith } from './ledger.js';
import { breakdownWith } from './where-from.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { buildPlan, duePlan, planState } from './trip-plan.js';
import { newTrip, tripPayment, tripStamp, tripStatus, tripsOf } from './trips.js';
import { mergeExpenses } from './trip-expenses.js';
import { allStakeMoney, stakeMoney, stakeMoneyId } from './cup-stake.js';
import { CUP_KINDS, cleanEntry, cleanRoundCup, cupCounts, cupEntry, cupKindsFor, defaultRoundCup, matchResult, pairMatches, roundCupResults } from './cup.js';

const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const OCT = (day, hour = 12) => new Date(2026, 9, day, hour).getTime();
const HOUR = 36e5;
const NAMES = { t: 'Trevor', s: 'Sam', m: 'Mike', d: 'Dave' };
const cents = v => Math.round(v * 100);
const CUP = { names: ['Blue', 'Red'], teams: [[{ id: 't', name: 'Trevor' }, { id: 's', name: 'Sam' }], [{ id: 'm', name: 'Mike' }, { id: 'd', name: 'Dave' }]], stake: 20 };
const TRIP = newTrip({ id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', by: 't', format: 'cup', cup: CUP, now: OCT(1) });
const MONEY_TRIP = newTrip({ id: 't_cup', name: 'Cup trip', start: '2026-10-16', end: '2026-10-18', by: 't', now: OCT(1) });
const NOW = OCT(18, 20);
const FOURBALL = { kind: 'fourball', sides: [['t', 's'], ['m', 'd']] };
const SINGLES = { kind: 'singles', sides: [['t', 's'], ['m', 'd']] };

/** A 9-hole skins round ($2 a skin, no handicaps), everyone a 4 but the birdies given ({ no: { pid: 3 } }). */
function round(id, holes, { at, cup, code = null, trip = TRIP } = {}) {
  const ids = ['t', 's', 'm', 'd'];
  const settings = { hcPct: 100, skins: { value: 2, carryover: true } };
  const r = createRound({ id, game: 'skins', course: flat9, holesCount: 9, players: ids.map(x => ({ id: x, name: NAMES[x], index: 0 })), settings, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, 4])), ...(holes[h.no] || {}) };
  r.createdAt = at - 4 * HOUR;
  r.status = 'done';
  r.finishedAt = at;
  if (trip) r.trip = tripStamp(trip);
  if (cup) r.cup = cup;
  if (code) r.shareCode = code;
  return r;
}
const birdies = (pid, ...nos) => Object.fromEntries(nos.map(no => [no, { [pid]: 3 }]));
const merge = (...maps) => {
  const out = {};
  for (const m of maps) for (const [no, v] of Object.entries(m)) out[no] = { ...(out[no] || {}), ...v };
  return out;
};
/** Three days, Red wins the cup 3 to 2 (cup.test.js cupRounds), each round shared live so far as `codes` says. */
function cupRounds({ codes = true, trip = TRIP, day3 = true } = {}) {
  const c = k => (codes ? k : null);
  const list = [
    round('r1', birdies('t', 4), { at: OCT(16, 15), cup: FOURBALL, code: c('CUPAAA'), trip }),
    round('r2', merge(birdies('t', 4), birdies('d', 7, 8)), { at: OCT(17, 15), cup: SINGLES, code: c('CUPBBB'), trip }),
  ];
  if (day3) list.push(round('r3', merge(birdies('m', 1), birdies('d', 2)), { at: OCT(18, 12), cup: SINGLES, code: c('CUPCCC'), trip }));
  return list;
}
const stateOf = (me, rounds, extra = {}) => ({
  me, players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [], carries: [], tabRows: {}, plans: {}, trips: {}, ...extra,
});
/** Trevor's phone (the organizer's) and each friend's, `z<id>`, which knows the others by their seats. */
function phonesOf(rounds, trip = TRIP) {
  const on = me => stateOf(`z${me}`, rounds.map(r => ({ ...r, localMe: me })));
  return { t: stateOf('t', rounds, { trips: { t_cup: trip } }), s: on('s'), m: on('m'), d: on('d') };
}
const idOn = (s, x) => (x === s.me.slice(1) ? s.me : x);
const owes = (s, x, y, now = NOW) => cents(tabWith(outstanding(s, { now }), new Set([idOn(s, y)]), idOn(s, x)));
const myTotal = (s, now = NOW) => outstanding(s, { now }).reduce((a, t) => a + (t.to === s.me ? cents(t.amount) : t.from === s.me ? -cents(t.amount) : 0), 0);
const PAIRS = [['t', 's'], ['t', 'm'], ['t', 'd'], ['s', 'm'], ['s', 'd'], ['m', 'd']];
function agree(phones, now = NOW) {
  for (const [x, y] of PAIRS) {
    const seen = [x, y].map(k => owes(phones[k], x, y, now));
    assert.equal(new Set(seen).size, 1, `${x} and ${y}’s phones agree (${seen})`);
  }
}
const deliver = (phones, rows) => { for (const k of Object.keys(phones)) phones[k] = applyRows(phones[k], rows); };
const share = (phones, ...list) => { for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripExpenses: mergeExpenses(phones[k].tripExpenses || {}, list) }; };
function paid(phones, k, res) {
  phones[k] = { ...phones[k], settlements: [...phones[k].settlements, ...res.settlements] };
  deliver(phones, res.rows);
  share(phones, ...(res.expenses || []));
}
const publish = (phones, plan) => { for (const k of Object.keys(phones)) phones[k] = { ...phones[k], tripPlans: { t_cup: plan } }; };
/** Each person's money from the rounds alone, in cents. */
function roundsMoney(rounds) {
  const out = { t: 0, s: 0, m: 0, d: 0 };
  for (const r of rounds) for (const [id, v] of Object.entries(roundResults(r).balances)) out[id] += cents(v);
  return out;
}
const STAKE = { t: -2000, s: -2000, m: 2000, d: 2000 };

// ---------------------------------------------------------------------------
// On the Tab, the same on every phone

test('the decided stake is on the Tab, equal to the cup result, the same on every phone', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  const golf = roundsMoney(rounds);
  for (const [k, s] of Object.entries(phones)) {
    const st = tripStatus(s, 't_cup', { now: NOW });
    assert.equal(st.cup.final, true, `${k}’s phone has the cup decided`);
    assert.equal(st.cup.winner, 1);
    assert.ok(st.cup.lines.every(l => l.onTab), `${k}’s phone places everyone`);
    // Their balance on the Tab: the rounds and the stake, nothing else
    assert.equal(myTotal(s), golf[k] + STAKE[k], `${k}’s total`);
    assert.equal(cents(tabBalances(s, { now: NOW })[s.me]), golf[k] + STAKE[k], `${k}’s balance`);
    // The trip total says the same
    assert.equal(cents(st.totals.find(p => p.id === s.me).amount), golf[k] + STAKE[k]);
  }
  agree(phones);
  // The stake between each loser and their winner: exactly the stake, on top of the rounds
  const plain = phonesOf(cupRounds({ trip: MONEY_TRIP }), MONEY_TRIP);
  for (const [x, y] of [['t', 'm'], ['s', 'd']]) for (const k of [x, y]) {
    assert.equal(owes(phones[k], x, y) - owes(plain[k], x, y), 2000, `${x} pays ${y} the stake, on ${k}’s phone`);
  }
  for (const [x, y] of [['t', 's'], ['m', 'd'], ['t', 'd'], ['s', 'm']]) assert.equal(owes(phones[x], x, y), owes(plain[x], x, y), `nothing between ${x} and ${y}`);
});

test('before the cup is decided the Tab is exactly the rounds’ money', () => {
  const mid = cupRounds({ day3: false });
  const phones = phonesOf(mid), plain = phonesOf(cupRounds({ day3: false, trip: MONEY_TRIP }), MONEY_TRIP);
  const now = OCT(17, 18);
  for (const k of Object.keys(phones)) {
    assert.deepEqual(stakeMoney(phones[k], 't_cup', { now }), []);
    assert.deepEqual(tabBalances(phones[k], { now }), tabBalances(plain[k], { now }), k);
    assert.deepEqual(outstanding(phones[k], { now }), outstanding(plain[k], { now }), k);
  }
});

test('a halved cup, no stake or a money trip puts nothing on the Tab, and old money stays as it was', () => {
  const plain = phonesOf(cupRounds({ trip: MONEY_TRIP }), MONEY_TRIP);
  const free = newTrip({ ...TRIP, format: 'cup', cup: { ...CUP, stake: 0 }, now: OCT(1) });
  const noStake = phonesOf(cupRounds({ trip: free }), free);
  for (const k of Object.keys(plain)) {
    assert.deepEqual(allStakeMoney(plain[k], { now: NOW }), []);
    assert.deepEqual(allStakeMoney(noStake[k], { now: NOW }), []);
    assert.deepEqual(outstanding(noStake[k], { now: NOW }), outstanding(plain[k], { now: NOW }), k);
  }
  // Halved: day three Trevor and Mike halve, Dave beats Sam, 2½ all
  const halved = [...cupRounds({ day3: false }), round('r3', birdies('d', 2), { at: OCT(18, 12), cup: SINGLES, code: 'CUPCCC' })];
  const h = phonesOf(halved);
  assert.equal(tripStatus(h.t, 't_cup', { now: NOW }).cup.halved, true);
  assert.deepEqual(allStakeMoney(h.t, { now: NOW }), []);
});

// ---------------------------------------------------------------------------
// Settle the trip and the published plan: once

test('Settle the trip has the stake once, and paying its lines squares the Tab on every phone', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  const golf = roundsMoney(rounds);
  for (const [k, s] of Object.entries(phones)) {
    const st = tripStatus(s, 't_cup', { now: NOW });
    assert.equal(st.phase, 'ready');
    const mine = st.plan.reduce((a, t) => a + (t.to === s.me ? cents(t.amount) : t.from === s.me ? -cents(t.amount) : 0), 0);
    assert.equal(mine, golf[k] + STAKE[k], `${k}’s lines are the rounds and the stake`);
    // The stake is the expense part of a line, and nothing is left to mark paid on the trip alone
    assert.equal(st.cup.lines.filter(l => l.open > 0 && !l.onTab).length, 0);
  }
  // Everyone pays their own lines from their own phone (no plan published: pair by pair)
  for (const k of Object.keys(phones)) {
    for (const t of tripStatus(phones[k], 't_cup', { now: NOW }).plan.filter(x => x.from === phones[k].me)) {
      paid(phones, k, tripPayment(phones[k], 't_cup', t.from, t.to, { now: NOW + 1000 }));
    }
  }
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(tripStatus(s, 't_cup', { now: NOW + 2000 }).phase, 'square', `${k} square`);
    assert.equal(myTotal(s, NOW + 2000), 0, `${k}’s Tab is square`);
  }
  agree(phones, NOW + 2000);
});

test('the published plan covers the stake line by line, every phone takes it, and paying it squares everyone', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  const golf = roundsMoney(rounds);
  const before = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  const plan = buildPlan(phones.t, 't_cup', { now: NOW });
  assert.deepEqual(plan.expenses.map(x => x.id), [stakeMoneyId('t_cup', 's>d'), stakeMoneyId('t_cup', 't>m')]);
  // Each person's lines are their rounds and their stake, once
  const byPlan = { t: 0, s: 0, m: 0, d: 0 };
  for (const l of plan.lines) { byPlan[l.from] -= cents(l.amount); byPlan[l.to] += cents(l.amount); }
  for (const id of Object.keys(byPlan)) assert.equal(byPlan[id], golf[id] + STAKE[id], `${id}’s lines`);
  publish(phones, plan);
  for (const [k, s] of Object.entries(phones)) {
    const ps = planState(s, 't_cup', { now: NOW });
    assert.equal(ps.status, 'live', `${k}’s phone takes the plan`);
    assert.equal(ps.pendingExpenses.length, 0);
    assert.equal(myTotal(s), before[k], `${k}’s total on the Tab is unchanged by the plan`);
    const st = tripStatus(s, 't_cup', { now: NOW });
    assert.ok(st.plan.every(t => !t.expense && !t.local), 'all on the plan');
  }
  agree(phones);
  // The organizer's phone doesn't publish again while it holds
  assert.equal(duePlan(phones.t, tripsOf(phones.t).get('t_cup'), { now: NOW }), null);
  for (const l of plan.lines) deliver(phones, tripPayment(phones[l.from], 't_cup', idOn(phones[l.from], l.from), idOn(phones[l.from], l.to), { now: NOW + 5000 }).rows);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(tripStatus(s, 't_cup', { now: NOW + 9000 }).plan.length, 0, `${k} square`);
    assert.equal(myTotal(s, NOW + 9000), 0, `${k}’s balance is zero`);
  }
});

test('a plan published before the cup was decided is republished with the stake, and waits pair by pair until then', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  // Published on the last morning: the third round and the stake aren't in it
  const early = buildPlan({ ...phones.t, rounds: Object.fromEntries(Object.entries(phones.t.rounds).filter(([id]) => id !== 'r3')) }, 't_cup', { now: OCT(18, 9) });
  assert.equal(early.expenses, undefined);
  publish(phones, early);
  const totals = Object.fromEntries(Object.entries(phones).map(([k, s]) => [k, myTotal(s)]));
  for (const k of Object.keys(phones)) assert.equal(totals[k], roundsMoney(rounds)[k] + STAKE[k], `${k} has the stake meanwhile`);
  agree(phones);
  const next = duePlan(phones.t, tripsOf(phones.t).get('t_cup'), { now: NOW });
  assert.equal(next.version, 2);
  assert.equal(next.expenses.length, 2);
  publish(phones, next);
  for (const [k, s] of Object.entries(phones)) {
    assert.equal(planState(s, 't_cup', { now: NOW }).status, 'live', k);
    assert.equal(myTotal(s), totals[k], `${k}’s total is the same on the new plan`);
  }
  agree(phones);
});

test('a phone that works the cup out another way finds the plan out of date, and keeps the stake pair by pair', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  publish(phones, buildPlan(phones.t, 't_cup', { now: NOW }));
  // Sam's phone hasn't got the last round yet: the cup isn't decided there
  const sam = { ...phones.s, rounds: Object.fromEntries(Object.entries(phones.s.rounds).filter(([id]) => id !== 'r3')) };
  const ps = planState(sam, 't_cup', { now: NOW });
  assert.equal(ps.status, 'stale');
  assert.equal(ps.why, 'cup');
});

// ---------------------------------------------------------------------------
// Paying from the Tab, and the marks from before

test('paying the stake from the Tab reaches the other phone, so both see it squared', () => {
  const phones = phonesOf(cupRounds());
  const card = owes(phones.t, 't', 'm');
  assert.equal(card, owes(phones.m, 't', 'm'));
  paid(phones, 't', allocatePayment(phones.t, { from: 't', to: 'm', amount: card / 100 }, { now: NOW + 1000, makeId: () => 'p1' }));
  assert.equal(owes(phones.t, 't', 'm', NOW + 2000), 0);
  assert.equal(owes(phones.m, 't', 'm', NOW + 2000), 0, 'Mike’s phone sees it paid');
  agree(phones, NOW + 2000);
  // Sam pays Dave in part from the Tab, Dave marks the rest on his phone
  const sd = owes(phones.s, 's', 'd');
  paid(phones, 's', allocatePayment(phones.s, { from: 'zs', to: 'd', amount: 15 }, { now: NOW + 3000, makeId: () => 'p2' }));
  assert.equal(owes(phones.d, 's', 'd', NOW + 4000), sd - 1500);
  agree(phones, NOW + 4000);
  paid(phones, 'd', allocatePayment(phones.d, { from: 's', to: 'zd', amount: (sd - 1500) / 100 }, { now: NOW + 5000, makeId: () => 'p3' }));
  for (const k of ['s', 'd']) assert.equal(owes(phones[k], 's', 'd', NOW + 6000), 0, k);
  agree(phones, NOW + 6000);
});

test('the stake’s I paid marks from before still count: a line marked paid stays paid, a part paid leaves the rest', () => {
  const rounds = cupRounds();
  const phones = phonesOf(rounds);
  const plain = phonesOf(cupRounds({ trip: MONEY_TRIP }), MONEY_TRIP);
  // Marked on Trevor's phone before the stake was on the Tab: all of his, $5 of Sam's
  const marks = [
    { id: 'cup:t_cup:t>m:a', key: 't>m', from: 't', to: 'm', amount: 20, at: NOW - 600e3, byName: 'Trevor' },
    { id: 'cup:t_cup:s>d:b', key: 's>d', from: 's', to: 'd', amount: 5, at: NOW - 500e3, byName: 'Trevor' },
  ];
  phones.t = { ...phones.t, cupPaid: { t_cup: marks } };
  for (const k of ['s', 'm', 'd']) phones[k] = { ...phones[k], cupRemote: { t_cup: { Ptrev: { byName: 'Trevor', pays: marks } } } };
  for (const [k, s] of Object.entries(phones)) {
    const items = stakeMoney(s, 't_cup', { now: NOW });
    assert.deepEqual(items.map(x => [x.key, x.cents]), [['s>d', 1500]], `${k}: only what the marks leave`);
    assert.equal(owes(s, 't', 'm'), owes(plain[k], 't', 'm'), `${k}: Trevor’s stake is paid`);
  }
  assert.equal(owes(phones.d, 's', 'd') - owes(plain.d, 's', 'd'), 1500);
  agree(phones);
  // The trip total still has the whole stake: it was won and lost, then paid
  assert.equal(tripStatus(phones.t, 't_cup', { now: NOW }).standings.find(p => p.id === 't').stake, -20);
});

test('someone this phone can’t place stays off its Tab and is marked paid on the trip, as before', () => {
  // Mike's phone has only the first round: Dave, then, is known there, but a teammate it never met isn't
  const four = { ...CUP, teams: [[...CUP.teams[0]], [...CUP.teams[1], { id: 'q', name: 'Quinn' }]] };
  const trip = newTrip({ ...TRIP, format: 'cup', cup: four, now: OCT(1) });
  const s = stateOf('t', cupRounds({ trip }), { trips: { t_cup: trip } });
  const st = tripStatus(s, 't_cup', { now: NOW });
  const off = st.cup.lines.filter(l => !l.onTab);
  assert.ok(off.length > 0 && off.every(l => l.to === 'q' && l.toId === null));
  const on = stakeMoney(s, 't_cup', { now: NOW });
  assert.equal(on.length, st.cup.lines.length - off.length);
  assert.ok(on.every(x => x.payer !== null));
  assert.equal(st.phase, 'ready', 'Quinn’s line is still to mark paid on the trip');
});

test('the person card and Where it comes from show the stake on its own line, moving them as it moves the Tab', () => {
  const s = phonesOf(cupRounds()).t;
  const plain = phonesOf(cupRounds({ trip: MONEY_TRIP }), MONEY_TRIP).t;
  const story = personStory(s, new Set(['t']), 'm', { now: NOW });
  const before = personStory(plain, new Set(['t']), 'm', { now: NOW });
  const item = story.items.find(it => it.kind === 'expense' && it.expense.stake);
  assert.equal(item.amount, -20);
  assert.equal(story.spent, -20);
  assert.equal(story.net, before.net, 'never in the head to head');
  const card = x => cents(x.net + x.spent - x.paid);
  assert.equal(card(story) - card(before), -2000);
  assert.equal(owes(s, 'm', 't') - owes(plain, 'm', 't'), -2000, 'the same as the Tab');
  // Nobody else's card has it
  assert.equal(personStory(s, new Set(['t']), 's', { now: NOW }).spent, 0);
  const w = breakdownWith(s, new Set(['t']), 'm', { now: NOW });
  const w0 = breakdownWith(plain, new Set(['t']), 'm', { now: NOW });
  assert.equal(cents(w.spent), -2000);
  assert.equal(cents(w.open) - cents(w0.open), -2000);
});

// ---------------------------------------------------------------------------
// Foursomes (alternate shot)

/** An Alternate shot round, Trevor and Sam against Mike and Dave, team scores by hole ({ no: { t0, t1 } }). */
function altRound(id, holes = {}, { pairs = [['t', 's'], ['m', 'd']], useHandicaps = false, hcs = null, upto = 9, cup = { kind: 'foursomes', sides: pairs } } = {}) {
  const ids = pairs.flat();
  const players = ids.map((x, i) => ({ id: x, name: NAMES[x], index: 0, ...(hcs ? { courseHcOverride: hcs[i] } : {}) }));
  const settings = { hcPct: 100, altshot: { format: 'total', scoring: 'match', stake: 10 } };
  const r = createRound({ id, game: 'altshot', course: flat9, holesCount: 9, players, settings, hcPct: 100, useHandicaps, teams: pairs });
  for (const h of r.holes) if (h.no <= upto) r.scores[h.no] = { t0: 4, t1: 4, ...(holes[h.no] || {}) };
  r.createdAt = OCT(16, 8);
  r.status = upto === 9 ? 'done' : 'active';
  if (r.status === 'done') r.finishedAt = OCT(16, 12);
  r.trip = tripStamp(TRIP);
  if (cup) r.cup = cup;
  return r;
}

test('foursomes is a cup match for an Alternate shot round, and only for one', () => {
  assert.equal(CUP_KINDS.foursomes.name, 'Foursomes');
  assert.equal(cupCounts('altshot'), true);
  assert.deepEqual(cupKindsFor('altshot'), ['foursomes']);
  assert.deepEqual(cupKindsFor('skins'), ['fourball', 'singles']);
  // Asked for on another game, it's four-ball
  const r = round('r1', {}, { at: OCT(16, 15), cup: { kind: 'foursomes', sides: [['t', 's'], ['m', 'd']] } });
  assert.equal(cleanRoundCup(r).kind, 'fourball');
  // On Alternate shot, whatever kind was saved, it's foursomes between the round's two teams
  const a = altRound('a1', {}, { cup: { kind: 'singles', sides: [['t', 's'], ['m', 'd']] } });
  assert.deepEqual(cleanRoundCup(a), { kind: 'foursomes', sides: [['t', 's'], ['m', 'd']] });
  // Pairs off two by two, nobody left for singles
  assert.deepEqual(pairMatches({ kind: 'foursomes', sides: [['t', 's', 'x'], ['m', 'd', 'y']] }), { matches: [{ kind: 'foursomes', sides: [['t', 's'], ['m', 'd']] }], out: ['x', 'y'] });
});

test('a foursomes match is scored hole by hole from each pair’s one ball: a win is a point, halved half each', () => {
  // Trevor and Sam win 1 and 3, Mike and Dave win 6: Blue 2 up, a point
  const r = altRound('a1', { 1: { t0: 3 }, 3: { t0: 3 }, 6: { t1: 3 } });
  const { matches } = roundCupResults(r);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, 'foursomes');
  assert.deepEqual([matches[0].result.winner, matches[0].result.points, matches[0].result.label], [0, [1, 0], '1 up']);
  // Closed out early: Red wins 1 to 5, 5 up with 4 to play reads 5&4
  const big = altRound('a2', { 1: { t1: 3 }, 2: { t1: 3 }, 3: { t1: 3 }, 4: { t1: 3 }, 5: { t1: 3 } });
  const res = matchResult(big, roundCupResults(big).matches[0]);
  assert.deepEqual([res.winner, res.label, res.closed], [1, '5&4', true]);
  // All square after nine: halved, half a point each
  const even = altRound('a3', { 2: { t0: 3 }, 8: { t1: 3 } });
  assert.deepEqual(roundCupResults(even).matches[0].result.points, [0.5, 0.5]);
  // Being played: where it stands, not counted yet
  const live = altRound('a4', { 1: { t1: 3 } }, { upto: 4 });
  const l = roundCupResults(live).matches[0].result;
  assert.deepEqual([l.leader, l.by, l.thru, l.points], [1, 1, 4, null]);
});

test('a foursomes match plays off the team handicaps, the same strokes the round’s own game uses', () => {
  // Course handicaps 8 and 10 against 0 and 0: Blue's team plays off 9 (half of 18), Red's 0, so Blue gets
  // a stroke a hole over nine: Blue's 5s are net 4s, level with Red's 4s, all square
  const r = altRound('a1', Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(no => [no, { t0: 5 }])), { useHandicaps: true, hcs: [8, 10, 0, 0] });
  assert.deepEqual(roundCupResults(r).matches[0].result.points, [0.5, 0.5]);
  // Without the strokes Red would win every hole
  const gross = altRound('a2', Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(no => [no, { t0: 5 }])));
  assert.equal(roundCupResults(gross).matches[0].result.winner, 1);
  // The round's own money is the round's: the cup never changes it
  const plain = structuredClone(r);
  delete plain.cup;
  assert.deepEqual(roundResults(r), roundResults(plain));
});

test('the cup sides follow the round’s teams, the first trip team first, even after a partner swap', () => {
  // Saved Blue first; the round's teams are listed Red first
  const r = altRound('a1', {}, { pairs: [['m', 'd'], ['t', 's']], cup: { kind: 'foursomes', sides: [['t', 's'], ['m', 'd']] } });
  assert.deepEqual(cleanRoundCup(r).sides, [['t', 's'], ['m', 'd']]);
  // A partner swap mid-round: the match is between the teams as they are now
  const swapped = structuredClone(r);
  swapped.teams[0].players = ['m', 's'];
  swapped.teams[1].players = ['t', 'd'];
  const c = cleanRoundCup(swapped);
  assert.equal(c.kind, 'foursomes');
  assert.equal(c.sides.flat().length, 4);
  // Without two teams of two there's nothing to play
  assert.equal(cleanRoundCup({ ...r, teams: null }), null);
});

test('foursomes partners come from the trip’s teams and rotate from round to round, like four-ball', () => {
  const s = stateOf('t', [], { trips: { t_cup: TRIP } });
  const players = ['t', 's', 'm', 'd'].map(id => ({ id, name: NAMES[id] }));
  const r0 = defaultRoundCup(s, TRIP, players, null, { game: 'altshot' });
  assert.deepEqual(r0, { kind: 'foursomes', sides: [['t', 's'], ['m', 'd']] });
  // With three on each team the partners change round to round
  const six = { ...CUP, teams: [[...CUP.teams[0], { id: 'a', name: 'Al' }], [...CUP.teams[1], { id: 'b', name: 'Bo' }]] };
  const trip6 = newTrip({ ...TRIP, format: 'cup', cup: six, now: OCT(1) });
  const all = [...players, { id: 'a', name: 'Al' }, { id: 'b', name: 'Bo' }];
  const turns = [0, 1, 2].map(rotate => defaultRoundCup(s, trip6, all, null, { rotate, game: 'altshot' }).sides[0].slice(0, 2));
  assert.deepEqual(turns, [['t', 's'], ['s', 'a'], ['a', 't']]);
  // Chapman still has no matches: it can't count
  assert.equal(cupCounts('chapman'), false);
});

test('a foursomes round goes to the server and back as foursomes, and counts on the cup and leaderboard', () => {
  const r = altRound('a1', { 1: { t0: 3 } });
  const s = stateOf('t', [r], { trips: { t_cup: TRIP } });
  const e = cupEntry(s, r);
  assert.equal(e.matches[0].kind, 'foursomes');
  assert.deepEqual(cleanEntry(JSON.parse(JSON.stringify(e))).matches[0], e.matches[0]);
  const st = tripStatus(s, 't_cup', { now: OCT(16, 13) });
  assert.deepEqual(st.cup.score.points, [1, 0]);
  const row = id => st.cup.leaderboard.find(x => x.id === id);
  assert.deepEqual([row('t').points, row('s').points, row('m').points, row('d').points], [1, 1, 0, 0]);
});
