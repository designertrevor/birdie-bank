// Challenges (challenges.js): the lifecycle (accept, decline, counter, call it off, into a round),
// two phones' moves played back the same way, whose challenge it is on each phone, when one stops
// counting, and an agreed challenge becoming exactly the right side bet in the right round, once.
// Old rounds never change: a round with no challenge in it keeps exactly the money it had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, holeComplete } from './round.js';
import { betResult, betsOf } from './pair-bets.js';
import { newPlan, planStart } from './plans.js';
import { oldRounds } from './overnight5-money.fixtures.js';
import { latelyItems } from './lately.js';
import { mergeBackup } from './backup.js';
import {
  ACCEPTED_DAYS, MAX_COUNTERS, OPEN_DAYS, betIdOf, canMove, challengeAsk, challengeBet, challengeHeadline, challengeInviteText, challengeLately, challengeLife,
  challengeLine, challengePair, challengeProblem, challengeState, challengeStatusText, challengeTone, challengeWhat, challengesForRound, challengesWith,
  cleanChallenge, mergeMoves, myChallenges, newChallenge, planChallenges, sideOf, withChallenges, withMove,
} from './challenges.js';

const DAY = 86400000;
const NOW = new Date(2026, 9, 3, 21, 0).getTime(); // Saturday night, Oct 3
const PARS = [4, 4, 3, 4, 5, 3, 4, 4, 3, 4, 4, 3, 4, 5, 3, 4, 4, 3];
const COURSE = { id: 'c1', name: 'Rancho Park', city: 'LA', tees: [{ name: 'Blue' }], holes: PARS.map((par, i) => ({ par, hdcp: i + 1 })) };
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' }, nassau: { front: 5, back: 5, total: 5, pressMode: 'manual' } };

let n = 0;
const mid = () => `m${++n}`;
/** A challenge with moves made one after another, a minute apart. */
function played(ch, ...moves) {
  let c = ch;
  for (const m of moves) c = withMove(c, { id: mid(), at: (ch.at || 0) + ((c.moves || []).length + 1) * 60000, ...m }) || c;
  return c;
}
const dave = { who: 'dave', name: 'Dave Smith' };
const mike = { who: 'mike', name: 'Mike Jones' };
const base = (o = {}) => newChallenge({ id: 'c1', from: dave, to: mike, kind: 'match', stake: 20, now: NOW - DAY, ...o });

// --------------------------- making one ------------------------------------

test('a new challenge keeps first names, a clean stake and only its kind’s fields', () => {
  const ch = base();
  assert.deepEqual(ch.from, { who: 'dave', name: 'Dave' });
  assert.deepEqual(ch.to, { who: 'mike', name: 'Mike' });
  assert.equal(ch.stake, 20);
  assert.equal(ch.holes, 'all');
  assert.equal(ch.unit, 'money');
  assert.equal(ch.plan, null);
  assert.equal('label' in ch, false);
  const custom = newChallenge({ id: 'c2', from: dave, to: mike, kind: 'custom', stake: 600, label: '  Longest   drive on 7 ', holes: 'nope' });
  assert.equal(custom.label, 'Longest drive on 7');
  assert.equal(custom.stake, 500); // the most a side bet can be
  assert.equal(custom.holes, 'all');
  assert.equal(newChallenge({ id: 'c3', from: dave, to: mike, kind: 'bogus', stake: 5 }).kind, 'match');
});

test('challengeProblem says what is missing before it can be sent', () => {
  assert.equal(challengeProblem({ from: dave, to: null, stake: 5, kind: 'match' }), 'Pick who you’re challenging');
  assert.equal(challengeProblem({ from: dave, to: dave, stake: 5, kind: 'match' }), 'You can’t challenge yourself');
  assert.equal(challengeProblem({ from: dave, to: mike, stake: 0, kind: 'match' }), 'Pick an amount');
  assert.equal(challengeProblem({ from: dave, to: mike, stake: 5, kind: 'custom', label: ' ' }), 'Give it a name');
  assert.equal(challengeProblem({ from: dave, to: mike, stake: 5, kind: 'custom', label: 'Longest drive' }), null);
});

test('cleanChallenge leaves out anything that could never have been made', () => {
  assert.ok(cleanChallenge(base()));
  assert.equal(cleanChallenge(null), null);
  assert.equal(cleanChallenge({ ...base(), to: dave }), null);
  assert.equal(cleanChallenge({ ...base(), kind: 'skins' }), null);
  assert.equal(cleanChallenge({ ...base(), stake: -5 }), null);
  assert.equal(cleanChallenge({ ...base(), stake: '20' }), null);
});

// --------------------------- the lifecycle ---------------------------------

test('open: waiting on the person challenged', () => {
  const s = challengeState(base());
  assert.equal(s.status, 'open');
  assert.equal(s.turn, 'to');
  assert.equal(s.stake, 20);
});

test('accept: it’s on at the amount offered', () => {
  const s = challengeState(played(base(), { side: 'to', move: 'accept' }));
  assert.equal(s.status, 'accepted');
  assert.equal(s.stake, 20);
  assert.equal(s.turn, null);
  assert.equal(s.acceptedAt, NOW - DAY + 60000);
});

test('decline: closed, and nothing after it counts', () => {
  const ch = played(base(), { side: 'to', move: 'decline' });
  assert.equal(challengeState(ch).status, 'declined');
  assert.equal(withMove(ch, { id: 'x', side: 'to', move: 'accept', at: NOW }), null);
  assert.equal(withMove(ch, { id: 'x', side: 'from', move: 'withdraw', at: NOW }), null);
});

test('counter: a new amount, and the turn goes back; the counter is what gets accepted', () => {
  const ch = played(base(), { side: 'to', move: 'counter', stake: 10 });
  let s = challengeState(ch);
  assert.equal(s.status, 'countered');
  assert.equal(s.stake, 10);
  assert.equal(s.turn, 'from');
  assert.equal(s.by, 'to');
  // Mike can't accept his own counter
  assert.equal(withMove(ch, { id: 'x', side: 'to', move: 'accept', at: NOW }), null);
  s = challengeState(played(ch, { side: 'from', move: 'accept' }));
  assert.equal(s.status, 'accepted');
  assert.equal(s.stake, 10);
});

test('counters can go back and forth, up to the limit, and never to the same amount', () => {
  let ch = played(base(), { side: 'to', move: 'counter', stake: 10 }, { side: 'from', move: 'counter', stake: 15 });
  assert.equal(challengeState(ch).stake, 15);
  assert.equal(challengeState(ch).turn, 'to');
  assert.equal(withMove(ch, { id: 'x', side: 'to', move: 'counter', stake: 15, at: NOW }), null);
  assert.equal(withMove(ch, { id: 'x', side: 'to', move: 'counter', stake: 0, at: NOW }), null);
  assert.equal(withMove(ch, { id: 'x', side: 'to', move: 'counter', stake: 900, at: NOW }), null);
  ch = played(ch, { side: 'to', move: 'counter', stake: 12 }, { side: 'from', move: 'counter', stake: 14 });
  assert.equal(challengeState(ch).counters, MAX_COUNTERS);
  assert.equal(canMove(ch, 'to', 'counter'), false);
  assert.equal(canMove(ch, 'to', 'accept'), true);
  assert.equal(canMove(ch, 'to', 'decline'), true);
});

test('only whoever’s turn it is can accept, decline or counter', () => {
  const ch = base();
  assert.equal(canMove(ch, 'from', 'accept'), false);
  assert.equal(canMove(ch, 'from', 'counter'), false);
  assert.equal(canMove(ch, 'to', 'accept'), true);
  assert.equal(canMove(ch, 'to', 'counter'), true);
  assert.equal(canMove(ch, 'to', 'counter', 20), false); // the same amount isn't a counter
  assert.equal(canMove(ch, 'to', 'counter', 25), true);
  assert.equal(canMove(ch, 'keeper', 'on'), false); // not agreed yet
});

test('either of the two can call it off before it’s played, not after', () => {
  assert.equal(challengeState(played(base(), { side: 'from', move: 'withdraw' })).status, 'off');
  assert.equal(challengeState(played(base(), { side: 'to', move: 'accept' }, { side: 'to', move: 'withdraw' })).status, 'off');
  assert.equal(canMove(base(), 'keeper', 'withdraw'), false);
  const on = played(base(), { side: 'to', move: 'accept' }, { side: 'keeper', move: 'on', roundId: 'r1' });
  const s = challengeState(on);
  assert.equal(s.status, 'on');
  assert.equal(s.roundId, 'r1');
  assert.equal(canMove(on, 'from', 'withdraw'), false);
  assert.equal(canMove(on, 'keeper', 'on'), false); // into one round only
});

test('two phones tapping at once agree: moves play back by time and a late one that no longer fits is skipped', () => {
  const ch = base();
  const accept = { id: 'a1', side: 'to', move: 'accept', at: NOW - 5000 };
  const withdraw = { id: 'w1', side: 'from', move: 'withdraw', at: NOW - 4000 };
  const one = { ...ch, moves: mergeMoves([accept], [withdraw]) };
  const other = { ...ch, moves: mergeMoves([withdraw], [accept, accept]) };
  assert.deepEqual(one.moves.map(m => m.id), ['a1', 'w1']);
  assert.deepEqual(other.moves, one.moves); // each move once, the same order
  assert.equal(challengeState(one).status, 'off'); // accepted, then called off
  // Mike accepts on one phone and declines on another at the same moment: by id, whichever way they arrive
  const yes = { id: 'k1', side: 'to', move: 'accept', at: NOW - 3000 };
  const no = { id: 'k2', side: 'to', move: 'decline', at: NOW - 3000 };
  assert.equal(challengeState({ ...ch, moves: [no, yes] }).status, 'accepted');
  assert.deepEqual(challengeState({ ...ch, moves: [no, yes] }), challengeState({ ...ch, moves: [yes, no] }));
  // An accept that arrives after a decline changes nothing
  const decline = { id: 'd1', side: 'to', move: 'decline', at: NOW - 2000 };
  const late = { id: 'a2', side: 'to', move: 'accept', at: NOW - 1000 };
  assert.equal(challengeState({ ...ch, moves: [late, decline] }).status, 'declined');
});

// --------------------------- whose it is -----------------------------------

const plan = (o = {}) => newPlan({
  id: 'pl1', hostName: 'Trevor Nielsen', game: 'nassau', holesCount: 18, date: '2026-10-10', teeTime: '08:10', course: COURSE,
  people: [{ id: 'dave', name: 'Dave Smith' }, { id: 'mike', name: 'Mike Jones' }, { id: 'sam', name: 'Sam' }], ballot: { games: [], bets: [5] }, suggestedBet: 5, settings: SETTINGS, now: NOW - 2 * DAY, ...o,
});
const planned = (o = {}) => base({ plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' }, ...o });

test('sideOf: on a plan by your key on it; from a Player card by the side this phone took', () => {
  const host = { plans: { pl1: { ...plan(), code: 'PLAN01' } } };
  const ch = planned({ from: { who: 'host', name: 'Trevor' } });
  assert.equal(sideOf(host, ch), 'from');
  assert.equal(sideOf(host, planned()), null); // Dave v Mike, on the organizer's phone
  const mikes = { plans: { pl_PLAN01: { ...plan(), id: 'pl_PLAN01', host: false, code: 'PLAN01', localMe: 'mike' } } };
  assert.equal(sideOf(mikes, planned()), 'to'); // found by the plan's code
  assert.equal(sideOf({}, { ...base(), mine: 'from' }), 'from');
  assert.equal(sideOf({}, { ...base(), mine: 'to' }), 'to');
  assert.equal(sideOf({}, base()), null);
});

test('challengeLife: a plan’s challenge lives and dies with its plan', () => {
  const now = NOW;
  const st = p => ({ plans: { pl1: { ...plan(), code: 'PLAN01', ...p } } });
  assert.equal(challengeLife(st({}), planned(), now), 'live');
  assert.equal(challengeLife(st({ status: 'off' }), planned(), now), 'gone');
  assert.equal(challengeLife(st({ gone: true }), planned(), now), 'gone');
  assert.equal(challengeLife({ plans: {} }, planned(), now), 'gone');
  assert.equal(challengeLife(st({ status: 'started' }), planned(), now), 'missed');
  assert.equal(challengeLife(st({ date: '2026-10-01' }), planned(), now), 'missed');
  assert.equal(challengeLife(st({}), played(planned(), { side: 'to', move: 'decline' }), now), 'closed');
});

test('challengeLife: one from a Player card runs out if nobody answers, or no round comes along', () => {
  const ch = base({ now: NOW });
  assert.equal(challengeLife({}, ch, NOW + (OPEN_DAYS - 1) * DAY), 'live');
  assert.equal(challengeLife({}, ch, NOW + (OPEN_DAYS + 1) * DAY), 'expired');
  const yes = played(ch, { side: 'to', move: 'accept' });
  assert.equal(challengeLife({}, yes, NOW + (OPEN_DAYS + 1) * DAY), 'live');
  assert.equal(challengeLife({}, yes, NOW + (ACCEPTED_DAYS + 1) * DAY), 'expired');
});

test('myChallenges: yours still going, your call first; planChallenges: everything on the plan but the called off', () => {
  const mine = id => ({ ...base({ id, now: NOW - DAY }), mine: 'from', made: true });
  const theirs = { ...base({ id: 'c_to', from: mike, to: dave, now: NOW - 2 * DAY }), mine: 'to' };
  const agreed = played(mine('c_yes'), { side: 'to', move: 'accept' });
  const old = { ...base({ id: 'c_old', now: NOW - 40 * DAY }), mine: 'from' };
  const other = base({ id: 'c_x' }); // neither side on this phone
  const state = { challenges: { c_wait: mine('c_wait'), c_to: theirs, c_yes: agreed, c_old: old, c_x: other } };
  assert.deepEqual(myChallenges(state, NOW).map(c => c.id), ['c_to', 'c_wait', 'c_yes']);
  const ps = { plans: { pl1: { ...plan(), code: 'PLAN01' } }, challenges: { a: planned({ id: 'a' }), b: played(planned({ id: 'b', now: NOW }), { side: 'from', move: 'withdraw' }), c: base({ id: 'c' }) } };
  assert.deepEqual(planChallenges(ps, ps.plans.pl1).map(c => c.id), ['a']);
});

// --------------------------- into the round --------------------------------

/** A round for Trevor, Dave and Mike at Rancho Park (no handicaps), scored with `scores` by hole number. */
function round({ ids = ['me', 'dave', 'mike'], names = ['Trevor Nielsen', 'Dave Smith', 'Mike Jones'], holesCount = 18, playFor = null, scores = {}, game = 'skins', teams = null } = {}) {
  const r = createRound({ id: 'r1', game, course: COURSE, holesCount, nine: 'front', startHole: null, players: ids.map((id, i) => ({ id, name: names[i], index: null })), settings: SETTINGS, hcPct: 100, useHandicaps: false, teams });
  if (playFor) r.playFor = playFor;
  r.scores = scores;
  return r;
}

test('a planned round’s agreed challenge becomes exactly the right side bet, through the roll call’s players', () => {
  const p = { ...plan(), code: 'PLAN01' };
  for (const who of ['dave', 'mike']) p.answers[who] = { name: who, status: 'in', at: 1 };
  const players = { me: { id: 'me', name: 'Trevor Nielsen' }, dave: { id: 'dave', name: 'Dave Smith' }, mike: { id: 'mike', name: 'Mike Jones' } };
  const ch = played(planned({ holes: 'back' }), { side: 'to', move: 'counter', stake: 15 }, { side: 'from', move: 'accept' });
  const state = { me: 'me', players, settings: SETTINGS, plans: { pl1: p }, challenges: { c1: ch } };
  const setup = planStart(state, p, ['host', 'dave', 'mike'], { course: COURSE });
  assert.deepEqual(setup.idOf, { host: 'me', dave: 'dave', mike: 'mike' });
  const r = round();
  const found = challengesForRound(state, r, { planId: 'pl1', idOf: setup.idOf, now: NOW });
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].bet, { id: 'ch_c1', kind: 'match', sides: ['dave', 'mike'], stake: 15, holes: [10, 18] });
  // Without the plan (any other round), a plan's challenge never comes in
  assert.equal(challengesForRound(state, r, { now: NOW }).length, 0);
  assert.equal(challengesForRound(state, r, { planId: 'other', idOf: setup.idOf, now: NOW }).length, 0);
});

test('the bet pays what the challenge said: Dave wins the back nine match by a hole and takes $15', () => {
  const p = { ...plan(), code: 'PLAN01' };
  const ch = played(planned({ holes: 'back' }), { side: 'to', move: 'counter', stake: 15 }, { side: 'from', move: 'accept' });
  const state = { me: 'me', players: {}, settings: SETTINGS, plans: { pl1: p }, challenges: { c1: ch } };
  const scores = {};
  PARS.forEach((par, i) => { scores[i + 1] = { me: par, dave: par, mike: par }; });
  scores[12].dave = 2; // a birdie on the back
  const before = round({ scores });
  const { round: r, used } = withChallenges(state, before, { planId: 'pl1', idOf: { host: 'me', dave: 'dave', mike: 'mike' }, now: NOW });
  assert.deepEqual(used, ['c1']);
  assert.ok(r.holes.every(h => holeComplete(r, h)));
  const res = betResult(r, betsOf(r)[0]);
  assert.equal(res.amount, 15);
  const withBet = roundResults(r).balances;
  const without = roundResults(before).balances;
  assert.equal(Math.round((withBet.dave - without.dave) * 100), 1500);
  assert.equal(Math.round((withBet.mike - without.mike) * 100), -1500);
  assert.equal(Math.round((withBet.me - without.me) * 100), 0); // Trevor isn't in it
});

test('kinds and units: per hole, closest to the pin and custom keep their own fields; a points plan’s challenge plays for points', () => {
  const r = round({ playFor: { kind: 'reward', reward: 'Lunch' } });
  const pair = ['dave', 'mike'];
  assert.deepEqual(challengeBet(base({ kind: 'hole', stake: 2 }), r, pair), { id: 'ch_c1', kind: 'hole', sides: pair, stake: 2, playFor: 'money' });
  assert.deepEqual(challengeBet(base({ kind: 'ctp', stake: 5, holes: 'front' }), r, pair), { id: 'ch_c1', kind: 'ctp', sides: pair, stake: 5, playFor: 'money', holes: [1, 9] });
  assert.deepEqual(challengeBet(base({ kind: 'custom', stake: 10, label: 'Longest drive' }), r, pair), { id: 'ch_c1', kind: 'custom', sides: pair, stake: 10, playFor: 'money', label: 'Longest drive' });
  assert.deepEqual(challengeBet(base({ unit: 'points' }), r, pair).playFor, 'points');
  // A money round's bet has no playFor at all, like every bet made in setup
  assert.equal('playFor' in challengeBet(base(), round(), pair), false);
  // A nine-hole round has no back nine: the bet covers the round
  assert.equal('holes' in challengeBet(base({ holes: 'back' }), round({ holesCount: 9 }), pair), false);
});

test('a Player card challenge: on the phone that made it, by the player (any of their ids); on the phone it was sent to, by name', () => {
  const agreed = c => played(c, { side: 'to', move: 'accept' });
  // Dave's phone: he made it with Mike's card (mike2 is the same person, linked)
  const davePhone = { me: 'dave', players: {}, links: { mike2: 'mike' }, challenges: { c1: { ...agreed(base()), mine: 'from', made: true } } };
  const r = round({ ids: ['dave', 'mike2', 'sam'], names: ['Dave Smith', 'Mike Jones', 'Sam'] });
  assert.deepEqual(challengePair(davePhone, davePhone.challenges.c1, r), ['dave', 'mike2']);
  assert.deepEqual(challengesForRound(davePhone, r, { now: NOW }).map(f => f.bet.sides), [['dave', 'mike2']]);
  // Mike's phone: Dave's ids mean nothing here, so it's the one Dave in the round
  const mikePhone = { me: 'm', players: {}, challenges: { c1: { ...agreed(base()), mine: 'to', made: false } } };
  const r2 = round({ ids: ['m', 'd', 's'], names: ['Mike Jones', 'Dave Smith', 'Sam'] });
  assert.deepEqual(challengesForRound(mikePhone, r2, { now: NOW }).map(f => f.bet.sides), [['d', 'm']]);
  // Two Daves: nobody can tell which, so it waits for a round with one
  const r3 = round({ ids: ['m', 'd', 'd2'], names: ['Mike Jones', 'Dave Smith', 'Dave Brown'] });
  assert.equal(challengesForRound(mikePhone, r3, { now: NOW }).length, 0);
  // Not both in the round: it waits for the next one
  assert.equal(challengesForRound(davePhone, round({ ids: ['dave', 'sam', 'zed'], names: ['Dave', 'Sam', 'Zed'] }), { now: NOW }).length, 0);
});

test('only agreed, live challenges go in, once, and never back after the bet comes off', () => {
  const make = (id, ...moves) => ({ ...played(base({ id }), ...moves), mine: 'from', made: true });
  const state = {
    me: 'dave', players: {},
    challenges: {
      open: make('open'), no: make('no', { side: 'to', move: 'decline' }), off: make('off', { side: 'to', move: 'accept' }, { side: 'from', move: 'withdraw' }),
      yes: make('yes', { side: 'to', move: 'accept' }),
      stale: { ...played(base({ id: 'stale', now: NOW - 60 * DAY }), { side: 'to', move: 'accept' }), mine: 'from', made: true },
    },
  };
  const r = round({ ids: ['dave', 'mike'], names: ['Dave', 'Mike'] });
  assert.deepEqual(challengesForRound(state, r, { now: NOW }).map(f => f.ch.id), ['yes']);
  const once = withChallenges(state, r, { now: NOW }).round;
  assert.deepEqual(challengesForRound(state, once, { now: NOW }), []);
  assert.deepEqual(challengesForRound(state, { ...r, betsGone: [betIdOf({ id: 'yes' })] }, { now: NOW }), []);
});

test('a money challenge from a Player card waits out a points round; a scramble’s teammates can’t have a match', () => {
  const state = { me: 'dave', players: {}, challenges: { c1: { ...played(base(), { side: 'to', move: 'accept' }), mine: 'from', made: true } } };
  const ids = ['dave', 'mike'], names = ['Dave', 'Mike'];
  assert.equal(challengesForRound(state, round({ ids, names, playFor: { kind: 'points' } }), { now: NOW }).length, 0);
  assert.equal(challengesForRound(state, round({ ids, names, playFor: { kind: 'reward', reward: 'Lunch' } }), { now: NOW }).length, 1);
  const four = { ids: ['dave', 'mike', 'a', 'b'], names: ['Dave', 'Mike', 'A', 'B'], game: 'scramble' };
  assert.equal(challengesForRound(state, round({ ...four, teams: [['dave', 'mike'], ['a', 'b']] }), { now: NOW }).length, 0);
  assert.equal(challengesForRound(state, round({ ...four, teams: [['dave', 'a'], ['mike', 'b']] }), { now: NOW }).length, 1);
});

test('old rounds keep exactly their money: no agreed challenge for them, the same round back', () => {
  const state = { me: 'p0', players: {}, challenges: { c1: { ...base(), mine: 'from', made: true }, c2: { ...played(base({ id: 'c2' }), { side: 'to', move: 'decline' }), mine: 'from', made: true } } };
  for (const { round: r } of oldRounds(60)) {
    const before = JSON.stringify(roundResults(r));
    const out = withChallenges(state, r, { now: NOW });
    assert.equal(out.round, r);
    assert.deepEqual(out.used, []);
    assert.equal(JSON.stringify(roundResults(out.round)), before);
  }
});

test('challengesWith: a friend’s Player card shows the challenges with them, any of their ids', () => {
  const state = { me: 'dave', links: { mike2: 'mike' }, challenges: { c1: { ...base(), mine: 'from', made: true }, c2: { ...base({ id: 'c2', to: { who: 'sam', name: 'Sam' } }), mine: 'from', made: true } } };
  assert.deepEqual(challengesWith(state, 'mike2', NOW).map(c => c.id), ['c1']);
});

// --------------------------- words -----------------------------------------

test('the words: what, when, who, and where it stands for each side', () => {
  const ch = base({ holes: 'back' });
  assert.equal(challengeWhat(ch), '$20 match');
  assert.equal(challengeAsk(ch), 'a $20 match');
  assert.equal(challengeLine(ch, NOW), '$20 match · Back 9 · Next round together');
  assert.equal(challengeWhat(base({ kind: 'ctp', stake: 5 })), 'Closest to the pin, $5 a par 3');
  assert.equal(challengeAsk(base({ kind: 'custom', stake: 10, label: 'Longest drive' })), '$10 on Longest drive');
  assert.equal(challengeWhat(base({ unit: 'points', kind: 'hole', stake: 2 })), '2 pts a hole');
  assert.equal(challengeLine(planned(), NOW), '$20 match · Sat, Oct 10');
  assert.equal(challengeHeadline(ch, 'from'), 'You challenged Mike');
  assert.equal(challengeHeadline(ch, 'to'), 'Dave challenged you');
  assert.equal(challengeHeadline(ch, null), 'Dave challenged Mike');
  assert.equal(challengeStatusText(ch, 'to'), 'Your call');
  assert.equal(challengeStatusText(ch, 'from'), 'Waiting on Mike');
  const k = played(ch, { side: 'to', move: 'counter', stake: 10 });
  assert.equal(challengeStatusText(k, 'from'), 'Mike said $10. Your call');
  assert.equal(challengeStatusText(k, 'to'), 'You said $10');
  assert.equal(challengeTone(k, 'from'), 'mine');
  assert.equal(challengeTone(k, 'to'), 'wait');
  const yes = played(k, { side: 'from', move: 'accept' });
  assert.equal(challengeStatusText(yes, 'to'), 'You’re on');
  assert.equal(challengeStatusText(yes, null), 'It’s on');
  assert.equal(challengeTone(yes, 'to'), 'on');
  assert.equal(challengeStatusText(played(ch, { side: 'to', move: 'decline' }), 'from'), 'Mike passed this time');
  assert.equal(challengeStatusText(yes, 'to', 'missed'), 'Missed the round');
});

test('the text with the link is friendly and says what changed', () => {
  assert.equal(challengeInviteText(base({ holes: 'back' }), 'L', 'from', NOW), 'Mike, you up for a $20 match on the back 9 next time we play?\nTap to accept, decline or name your own amount:\nL');
  assert.equal(challengeInviteText(planned(), 'L', 'from', NOW), 'Mike, you up for a $20 match on Sat, Oct 10?\nTap to accept, decline or name your own amount:\nL');
  const k = played(base(), { side: 'to', move: 'counter', stake: 10 });
  assert.equal(challengeInviteText(k, 'L', 'to', NOW).split('\n')[0], 'Dave, I’ll do a $10 match instead.');
});

// --------------------------- Lately ----------------------------------------

test('Lately: challenges to you and answers to yours, with amounts only when you’re in it', () => {
  const at = NOW - 3 * DAY;
  const toMe = { ...base({ id: 'a', from: mike, to: dave, now: at }), mine: 'to' };
  const mine = { ...played(base({ id: 'b', now: at }), { side: 'to', move: 'counter', stake: 10 }, { side: 'from', move: 'accept' }), mine: 'from', made: true };
  const others = played(planned({ id: 'c', now: at }), { side: 'to', move: 'accept' });
  const state = { me: 'dave', players: {}, rounds: {}, settlements: [], plans: { pl1: { ...plan(), code: 'PLAN01' } }, challenges: { a: toMe, b: mine, c: others } };
  const rows = challengeLately(state, NOW - 30 * DAY, NOW);
  const texts = rows.sort((x, y) => x.at - y.at || x.id.localeCompare(y.id)).map(r => r.text);
  assert.deepEqual(texts, [
    'Mike challenged you to a $20 match',
    'Dave challenged Mike', // on the plan, between two others: no amount
    'Mike came back with $10', // Dave's own accept isn't news to Dave
    'Mike accepted Dave’s challenge',
  ]);
  const items = latelyItems(state, NOW).filter(i => i.kind === 'challenge');
  assert.equal(items.length, 4);
  assert.ok(items.every(i => i.sub));
  assert.deepEqual(items.find(i => i.text.startsWith('Mike challenged you')).target, ['challenge', { id: 'a' }]);
  assert.deepEqual(items.find(i => i.text === 'Dave challenged Mike').target, ['plan', { id: 'pl1' }]);
});

test('a backup keeps challenges, so an agreed one still goes into the round after a restore', () => {
  const data = { players: {}, challenges: { c1: base() } };
  const { state } = mergeBackup({ players: {}, challenges: {} }, data);
  assert.deepEqual(Object.keys(state.challenges), ['c1']);
});
