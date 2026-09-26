import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestBall, sideSplit, matchLabel, vegasNumber, vegasHole, sixesPairings, sixesSegments, stablefordPoints, quotaPoints, quotaFor,
  ninesPoints, acesDeuces, pointsToMoney, settleTotals, scrambleTeamHandicap, rabbitHolder, scoreDots, roundCents,
} from './games.js';
import { createRound, roundResults, scorers, holeComplete, sixesMatches, vegasPreview } from './round.js';
import { matchStatus } from './golf.js';
import { optionsProblem, stakeSummary } from './stakes.js';

test('best ball and side splits', () => {
  assert.equal(bestBall([4, 5]), 4);
  assert.equal(bestBall([4, null]), null);
  assert.deepEqual(sideSplit(10, 2, 2, 0), [10, -10]);
  assert.deepEqual(sideSplit(10, 1, 3, 0), [30, -10]);
  assert.deepEqual(sideSplit(10, 1, 3, 1), [-30, 10]);
  assert.deepEqual(sideSplit(10, 1, 1, null), [0, 0]);
});

test('match labels', () => {
  assert.equal(matchLabel(matchStatus({ 1: 0, 2: 0, 3: 0 }, 1, 5), 'Ann'), 'Ann 3&2');
  assert.equal(matchLabel(matchStatus({ 1: 0, 2: 1 }, 1, 2)), 'Halved');
  assert.equal(matchLabel(matchStatus({ 1: 0 }, 1, 9), 'Bo'), 'Bo 1 up');
});

test('vegas numbers and birdie flips', () => {
  assert.equal(vegasNumber(4, 5), 45);
  assert.equal(vegasNumber(5, 4), 45);
  assert.equal(vegasNumber(4, 10), 104);
  const r = vegasHole([[4, 5], [5, 6]], [[4, 5], [5, 6]], 4);
  assert.deepEqual(r.numbers, [45, 56]);
  assert.equal(r.diff, 11);
  // A birdie by team A flips team B's number
  const f = vegasHole([[3, 5], [4, 5]], [[3, 5], [4, 5]], 4);
  assert.deepEqual(f.numbers, [35, 54]);
  assert.deepEqual(f.flipped, [false, true]);
  // Both birdie: nothing flips
  assert.deepEqual(vegasHole([[3, 5], [3, 6]], [[3, 5], [3, 6]], 4).flipped, [false, false]);
  // Flip off
  assert.deepEqual(vegasHole([[3, 5], [4, 5]], [[3, 5], [4, 5]], 4, { birdieFlip: false }).numbers, [35, 45]);
});

test('sixes pairings and segments', () => {
  assert.deepEqual(sixesPairings(['a', 'b', 'c', 'd']), [[['a', 'b'], ['c', 'd']], [['a', 'c'], ['b', 'd']], [['a', 'd'], ['b', 'c']]]);
  assert.deepEqual(sixesSegments(18).map(s => [s.start, s.end]), [[1, 6], [7, 12], [13, 18]]);
  assert.deepEqual(sixesSegments(9).map(s => [s.start, s.end]), [[1, 3], [4, 6], [7, 9]]);
});

test('points tables', () => {
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(n => stablefordPoints(n, 4)), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([6, 5, 4, 3, 2, 1].map(n => stablefordPoints(n, 4, true)), [-3, -1, 0, 2, 5, 8]);
  assert.deepEqual([6, 5, 4, 3, 2].map(n => quotaPoints(n, 4)), [0, 1, 2, 4, 8]);
  assert.equal(quotaFor(12), 24);
  assert.equal(quotaFor(6, 9), 12);
  assert.deepEqual(ninesPoints([3, 4, 5]), [5, 3, 1]);
  assert.deepEqual(ninesPoints([4, 4, 5]), [4, 4, 1]);
  assert.deepEqual(ninesPoints([3, 5, 5]), [5, 2, 2]);
  assert.deepEqual(ninesPoints([4, 4, 4]), [3, 3, 3]);
  assert.equal(scoreDots(3, 4), 1);
  assert.equal(scoreDots(2, 4), 2);
  assert.equal(scoreDots('X', 4), 0);
});

test('aces and deuces', () => {
  const r = acesDeuces([3, 4, 4, 6], ['a', 'b', 'c', 'd'], { ace: 2, deuce: 1 });
  assert.deepEqual(r.deltas, { a: 7, b: -1, c: -1, d: -5 });
  assert.equal(r.ace, 'a'); assert.equal(r.deuce, 'd');
  assert.equal(acesDeuces([4, 4, 5], ['a', 'b', 'c']).ace, null);
  assert.equal(acesDeuces([4, 4, 4], ['a', 'b', 'c']).deuce, null);
});

test('points to money sums to zero', () => {
  const m = pointsToMoney({ a: 60, b: 54, c: 48 }, 1);
  assert.deepEqual(m, { a: 6, b: 0, c: -6 });
});

test('rounding to cents never makes or loses a cent', () => {
  // $20 split three ways: 6.67 + 6.67 + 6.66, and the -$20 side untouched
  assert.deepEqual(roundCents({ a: 20 / 3, b: 20 / 3, c: 20 / 3, d: -10, e: -10 }), { a: 6.66, b: 6.67, c: 6.67, d: -10, e: -10 });
  assert.deepEqual(roundCents({ a: 1 / 3, b: 1 / 3, c: -2 / 3 }), { a: 0.33, b: 0.33, c: -0.66 });
  assert.deepEqual(roundCents({ a: 2.5, b: -2.5 }), { a: 2.5, b: -2.5 });
  // A three-way tie in a pot of seven used to come out a cent over
  const pot = settleTotals({ a: 1, b: 1, c: 1, d: 2, e: 2, f: 3, g: 4 }, { mode: 'pot', stake: 5 });
  assert.equal(Object.values(pot).reduce((t, v) => t + Math.round(v * 100), 0), 0);
  const pts = pointsToMoney({ a: 1, b: 0, c: 0 }, 1);
  assert.equal(Object.values(pts).reduce((t, v) => t + Math.round(v * 100), 0), 0);
});

test('settling totals: pot and per unit', () => {
  assert.deepEqual(settleTotals({ a: 70, b: 72, c: 75 }, { mode: 'pot', stake: 5 }), { a: 10, b: -5, c: -5 });
  assert.deepEqual(settleTotals({ a: 70, b: 70, c: 75 }, { mode: 'pot', stake: 5 }), { a: 2.5, b: 2.5, c: -5 });
  assert.deepEqual(settleTotals({ a: 70, b: 72 }, { mode: 'per', stake: 1 }), { a: 2, b: -2 });
  assert.deepEqual(settleTotals({ a: 30, b: 36 }, { mode: 'per', stake: 1, lowerWins: false }), { a: -6, b: 6 });
});

test('scramble team handicaps', () => {
  assert.equal(scrambleTeamHandicap([10, 20]), 7); // 3.5 + 3 = 6.5 → 7
  assert.equal(scrambleTeamHandicap([4, 8, 12, 20]), 6); // 1 + 1.6 + 1.8 + 2 = 6.4
});

test('rabbit', () => {
  const { holder, history } = rabbitHolder([{ winner: 'a' }, { winner: null }, { winner: 'b' }, { winner: undefined }]);
  assert.equal(holder, 'b');
  assert.deepEqual(history, ['a', null, 'b', 'b']);
  assert.equal(rabbitHolder([{ winner: 'a' }, { winner: null }], false).holder, 'a');
});

// ---------------------------------------------------------------------------
// Round-level results

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'rotate' },
  nassau: { front: 5, back: 5, total: 5, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  wolf: { point: 2, loneMultiplier: 2 },
  match: { stake: 10, pressMode: 'off', threshold: 2 },
  vegas: { point: 1, birdieFlip: true },
  sixes: { stake: 5, mode: 'match' },
  scramble: { stake: 5 },
  stroke: { stake: 5, payout: 'pot' },
  stableford: { stake: 1, payout: 'per', modified: false },
  quota: { stake: 1, payout: 'per' },
  nines: { point: 1 },
  aces: { ace: 2, deuce: 1 },
  bbb: { value: 1 },
  dots: { value: 1, auto: true, kinds: { greenie: true, sandy: true, barkie: true, chipin: true, polie: false, arnie: false } },
  rabbit: { stake: 5, tiesFree: true },
};
const course = {
  id: 'c', name: 'C', tees: [{ name: 'W', rating: 72, slope: 113 }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const P = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase(), index: 0, tee: 'W' }));
const mk = (game, n = 4, extra = {}) => createRound({ id: 'r', game, course, holesCount: 18, nine: 'front', players: P.slice(0, n), settings: SETTINGS, hcPct: 100, useHandicaps: false, ...extra });
const score = (r, no, s) => { r.scores[no] = s; };

test('match play 1 v 3 pays per opponent', () => {
  const r = mk('match', 4, { teams: [['a'], ['b', 'c', 'd']] });
  for (let n = 1; n <= 18; n++) score(r, n, { a: 3, b: 4, c: 4, d: 5 });
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 30, b: -10, c: -10, d: -10 });
});

test('nassau 2 v 2 uses best ball', () => {
  const r = mk('nassau', 4, { teams: [['a', 'b'], ['c', 'd']] });
  for (let n = 1; n <= 18; n++) score(r, n, { a: 6, b: 3, c: 4, d: 4 });
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 15, b: 15, c: -15, d: -15 });
});

test('vegas round', () => {
  const r = mk('vegas', 4, { teams: [['a', 'b'], ['c', 'd']] });
  score(r, 1, { a: 4, b: 5, c: 5, d: 6 }); // 45 v 56 → A +11
  score(r, 2, { a: 3, b: 5, c: 4, d: 5 }); // birdie flips B: 35 v 54 → +19
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 30, b: 30, c: -30, d: -30 });
  assert.equal(res.detail.vegas[1].flipped[1], true);
  assert.deepEqual(vegasPreview(r, r.holes[2], { a: 4, b: 4, c: 4, d: 4 }).numbers, [44, 44]);
});

test('sixes: three matches with rotating partners', () => {
  const r = mk('sixes', 4);
  // Match 1 (A&B v C&D): A&B win. Match 2 (A&C v B&D): halved. Match 3 (A&D v B&C): B&C win
  for (let n = 1; n <= 6; n++) score(r, n, { a: 3, b: 5, c: 4, d: 5 });
  for (let n = 7; n <= 12; n++) score(r, n, { a: 4, b: 4, c: 4, d: 4 });
  for (let n = 13; n <= 18; n++) score(r, n, { a: 5, b: 3, c: 5, d: 5 });
  const m = sixesMatches(r);
  assert.deepEqual(m.map(x => x.status.leader), [0, null, 1]);
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 0, b: 10, c: 0, d: -10 });
  r.settings = { ...SETTINGS, sixes: { stake: 1, mode: 'holes' } };
  assert.deepEqual(roundResults(r).balances, { a: 0, b: 12, c: 0, d: -12 });
  assert.deepEqual(roundResults(r).detail.matches.map(x => x.net), [6, 0, -6]);
});

test('scramble: teams score, winners split the pot', () => {
  const r = mk('scramble', 4, { teams: [['a', 'b'], ['c', 'd']], useHandicaps: true });
  assert.deepEqual(scorers(r).map(t => t.id), ['t0', 't1']);
  score(r, 1, { t0: 4, t1: 5 });
  assert.equal(holeComplete(r, r.holes[0]), true);
  const res = roundResults(r);
  assert.deepEqual(res.balances, { a: 5, b: 5, c: -5, d: -5 });
  assert.equal(res.detail.totals[0].toPar, 0);
});

test('stroke play pot and per stroke', () => {
  const r = mk('stroke', 3);
  score(r, 1, { a: 3, b: 4, c: 5 });
  assert.deepEqual(roundResults(r).balances, { a: 10, b: -5, c: -5 });
  r.settings = { ...SETTINGS, stroke: { stake: 1, payout: 'per' } };
  assert.deepEqual(roundResults(r).balances, { a: 3, b: 0, c: -3 });
});

test('stableford and quota', () => {
  const r = mk('stableford', 2);
  score(r, 1, { a: 3, b: 5 }); // 3 pts v 1 pt
  assert.deepEqual(roundResults(r).balances, { a: 2, b: -2 });
  const q = mk('quota', 2, { useHandicaps: true, players: [{ ...P[0], index: 10 }, P[1]] });
  assert.deepEqual(q.players.map(p => p.courseHc), [10, 0]);
  const t = roundResults(q).detail.totals;
  assert.deepEqual(t.map(x => x.quota), [26, 36]);
});

test('nines, aces, rabbit, bingo bango bongo, dots', () => {
  const n = mk('nines', 3);
  score(n, 1, { a: 3, b: 4, c: 5 });
  assert.deepEqual(roundResults(n).balances, { a: 2, b: 0, c: -2 });

  const ac = mk('aces', 4);
  score(ac, 1, { a: 3, b: 4, c: 4, d: 6 });
  assert.deepEqual(roundResults(ac).balances, { a: 7, b: -1, c: -1, d: -5 });

  const rb = mk('rabbit', 3);
  for (let h = 1; h <= 9; h++) score(rb, h, { a: 4, b: 4, c: 4 });
  score(rb, 8, { a: 3, b: 4, c: 4 });
  assert.deepEqual(roundResults(rb).balances, { a: 0, b: 0, c: 0 }); // hole 9 tie set it free
  rb.settings = { ...SETTINGS, rabbit: { stake: 5, tiesFree: false } };
  assert.deepEqual(roundResults(rb).balances, { a: 10, b: -5, c: -5 });

  const bb = mk('bbb', 3);
  score(bb, 1, { a: 4, b: 4, c: 4 });
  bb.marks[1] = { bingo: 'a', bango: 'a', bongo: 'b' };
  assert.deepEqual(roundResults(bb).balances, { a: 3, b: 0, c: -3 });

  const d = mk('dots', 3);
  score(d, 1, { a: 3, b: 4, c: 4 }); // natural birdie = 1 dot
  d.marks[1] = { b: ['sandy'], c: ['polie'] }; // polie is off in settings
  assert.deepEqual(roundResults(d).balances, { a: 1, b: 1, c: -2 });
});

test('bets can change mid-round and the money follows', () => {
  const course = { id: 'c', name: 'C', holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })), tees: [] };
  const players = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'Cy' }];
  const settings = { skins: { value: 2, carryover: true } };
  const r = createRound({ id: 'r', game: 'skins', course, holesCount: 9, players, settings, hcPct: 100, useHandicaps: false });
  r.scores[1] = { a: 3, b: 4, c: 4 };
  assert.equal(roundResults(r).balances.a, 4);
  r.settings = { ...r.settings, skins: { ...r.settings.skins, value: 1 } };
  assert.equal(roundResults(r).balances.a, 2);
});

test('stake summary and option checks', () => {
  assert.equal(stakeSummary('skins', { skins: { value: 1, carryover: true } }), '$1 a skin · carryovers');
  assert.equal(stakeSummary('nassau', { nassau: { front: 5, back: 5, total: 10 } }), '$5 / $5 / $10');
  assert.equal(optionsProblem('banker', { banker: { defaultBet: 5, min: 1, max: 20 } }), null);
  assert.match(optionsProblem('banker', { banker: { defaultBet: 25, min: 1, max: 20 } }), /between/);
  assert.equal(optionsProblem('skins', {}), null);
});
