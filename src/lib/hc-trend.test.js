// The handicap trend (hc-trend.js): a differential for each finished round with a full card, the
// WHS best-few-of-20 guide, and what it leaves out. It's a guide only, so nothing here touches money.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import {
  TREND_LABEL, TREND_MIN_ROUNDS, adjustedGross, guideFrom, handicapTrend, ratingFor, roundDifferential,
  trendEmptyText, trendVsOfficial,
} from './hc-trend.js';

const oak = {
  id: 'oak18', name: 'Oak Hollow', city: 'Bend',
  tees: [{ name: 'Blue', rating: 70, slope: 130 }, { name: 'Red' }],
  holes: Array.from({ length: 18 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const nine9 = { id: 'n9', name: 'Pine Nine', tees: [{ name: 'White', rating: 34, slope: 113 }], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const at = d => new Date(2026, 8, d, 15).getTime();
const SET = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'pot' }, scramble: {} };

/** A finished round: every hole `each` for everyone, then any changes ({ hole: { id: score } }). */
function round(id, { course = oak, holesCount = 18, game = 'skins', each = 5, holes = {}, tee = 'Blue', index = 10, when = at(5), extra = {} } = {}) {
  const ids = ['me', 'mike'];
  const r = createRound({ id, game, course, holesCount, players: ids.map(x => ({ id: x, name: x, index, tee })), settings: structuredClone(SET), hcPct: 100 });
  for (const h of r.holes) r.scores[h.no] = { ...Object.fromEntries(ids.map(p => [p, each])), ...(holes[h.no] || {}) };
  r.status = 'done';
  r.createdAt = when - 4 * 36e5;
  r.finishedAt = when;
  return Object.assign(r, extra);
}
const stateOf = (rounds, { index = 9.4 } = {}) => ({
  me: 'me', players: { me: { id: 'me', name: 'Me', index } }, settlements: [],
  customCourses: { [oak.id]: oak, [nine9.id]: nine9 },
  rounds: Object.fromEntries(rounds.map(r => [r.id, r])),
});

test('trend: an 18-hole round against the tee rating and slope', () => {
  const r = round('a');
  assert.deepEqual(roundDifferential(r, 'me', oak), { diff: 17.4, by: 'rating', holes: 18, gross: 90 });
  assert.deepEqual(ratingFor(r, oak, 'Blue'), { rating: 70, slope: 130 });
  assert.equal(ratingFor(r, oak, 'Red'), null, 'a tee with no rating');
});

test('trend: each hole capped at net double bogey, a pick-up counts as one', () => {
  // Course handicap 10 at 130 slope: one stroke on the 10 hardest holes. Hole 1 is the hardest.
  const r = round('b', { holes: { 1: { me: 'X' }, 18: { me: 9 } } });
  // 16 fives, hole 1 picked up (4 + 2 + 1 = 7), hole 18 a 9 capped at 6 (no stroke there)
  assert.equal(adjustedGross(r, 'me'), 16 * 5 + 7 + 6);
});

test('trend: a 9-hole round doubles into an 18-hole figure, on either card', () => {
  const front = round('c', { holesCount: 9 });
  // 18-hole rating halves for nine: (45 - 35) x 113 / 130 = 8.69, doubled
  assert.deepEqual(roundDifferential(front, 'me', oak), { diff: 17.4, by: 'rating', holes: 9, gross: 45 });
  // A 9-hole card's own rating is a 9-hole one: (45 - 34) x 2
  const pine = round('d', { course: nine9, holesCount: 9, tee: 'White' });
  assert.equal(roundDifferential(pine, 'me', nine9).diff, 22);
  // The same card played twice for 18 doubles the rating instead
  const twice = round('e', { course: nine9, holesCount: 18, tee: 'White' });
  assert.equal(roundDifferential(twice, 'me', nine9).diff, 22);
});

test('trend: no rating or slope falls back to strokes over par', () => {
  const r = round('f', { course: flat9, holesCount: 9, tee: null });
  assert.deepEqual(roundDifferential(r, 'me', flat9), { diff: 18, by: 'par', holes: 9, gross: 45 });
  // And with no course at all (a course this phone doesn't have)
  assert.equal(roundDifferential(round('g'), 'me', null).by, 'par');
  assert.equal(roundDifferential(round('g'), 'me', null).diff, 18);
});

test('trend: rounds that don’t count, a hole missing, unfinished, not your own ball', () => {
  const gap = round('h');
  delete gap.scores[7].me;
  assert.equal(roundDifferential(gap, 'me', oak), null);
  const live = round('i');
  live.status = 'active';
  assert.equal(roundDifferential(live, 'me', oak), null);
  assert.equal(roundDifferential(round('j', { game: 'scramble' }), 'me', oak), null);
  assert.equal(roundDifferential(round('k', { game: 'shamble' }), 'me', oak), null);
  assert.equal(roundDifferential(round('l'), 'nobody', oak), null);
  assert.equal(roundDifferential(null, 'me', oak), null);
});

test('trend: points and reward rounds count, it’s about the scores', () => {
  const pts = round('m', { extra: { playFor: { kind: 'points' } } });
  const lunch = round('n', { extra: { playFor: { kind: 'reward', reward: 'Lunch', owes: 'last' } } });
  assert.equal(roundDifferential(pts, 'me', oak).diff, 17.4);
  assert.equal(roundDifferential(lunch, 'me', oak).diff, 17.4);
});

test('trend: the guide is WHS best few of the last 20, and waits for 3', () => {
  assert.equal(guideFrom([]), null);
  assert.equal(guideFrom([12, 14]), null);
  assert.equal(guideFrom([10, 20, 30]), 8, 'best 1 of 3, less 2');
  assert.equal(guideFrom([10, 20, 30, 40]), 9, 'best 1 of 4, less 1');
  assert.equal(guideFrom([10, 20, 30, 40, 50]), 10);
  assert.equal(guideFrom([10, 12, 30, 40, 50, 60]), 10, 'best 2 of 6, less 1');
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(guideFrom(twenty), 4.5, 'best 8 of 20');
  // Older rounds drop off: only the last 20 count
  assert.equal(guideFrom([-5, -5, -5, ...twenty]), 4.5);
  assert.equal(guideFrom([-2, 1, 3]), -4, 'a plus guide');
});

test('trend: from your rounds, oldest first, with the guide as it stood after each', () => {
  const rounds = [
    round('r3', { each: 4, when: at(12) }),             // 72: (72 - 70) x 113 / 130 = 1.7
    round('r1', { when: at(2) }),                         // 17.4
    round('r2', { course: flat9, holesCount: 9, tee: null, when: at(7) }), // 18, by par
    round('sc', { game: 'scramble', when: at(9) }),       // never counts
    round('r4', { each: 6, when: at(20), extra: { playFor: { kind: 'points' } } }), // 108: 33.0
  ];
  const t = handicapTrend(stateOf(rounds));
  assert.deepEqual(t.points.map(p => p.id), ['r1', 'r2', 'r3', 'r4']);
  assert.deepEqual(t.points.map(p => p.diff), [17.4, 18, 1.7, 33]);
  assert.deepEqual(t.points.map(p => p.guide), [null, null, -0.3, 0.7]);
  assert.equal(t.guide, 0.7);
  assert.equal(t.official, 9.4);
  assert.equal(t.rounds, 4);
  assert.equal(t.needed, 0);
  assert.equal(t.byPar, 1);
});

test('trend: under 3 rounds says how many more, and an empty state', () => {
  const t = handicapTrend(stateOf([round('a')], { index: null }));
  assert.equal(t.guide, null);
  assert.equal(t.needed, TREND_MIN_ROUNDS - 1);
  assert.equal(t.official, null);
  assert.match(trendEmptyText(t.needed), /^Finish 2 more rounds .* 1 so far\.$/);
  assert.match(trendEmptyText(3), /^Finish 3 more rounds/);
  assert.equal(trendEmptyText(0), '');
  assert.equal(handicapTrend({}).rounds, 0);
});

test('trend: compared with the official index, and labelled as a guide', () => {
  assert.equal(trendVsOfficial(8.1, 9.4), '1.3 better than your official index');
  assert.equal(trendVsOfficial(11, 9.4), '1.6 higher than your official index');
  assert.equal(trendVsOfficial(9.6, 9.4), 'About the same as your official index');
  assert.equal(trendVsOfficial(null, 9.4), null);
  assert.equal(trendVsOfficial(9, null), null);
  assert.equal(TREND_LABEL, 'A guide from your rounds, not an official index');
});
