// The halfway sheet (halfway.js): when it fires, and what it shows per game. Display only, so the
// money is checked to be the same before and after.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, scoreSummary } from './round.js';
import { toParOf } from './to-par.js';
import { freshHole } from './moments.js';
import { HALFWAY_POS, atHalfway, halfwayFor } from './halfway.js';

const SETTINGS = {
  skins: { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' },
  stroke: { stake: 5, payout: 'pot' },
  match: { stake: 10, pressMode: 'off' },
  nassau: { front: 5, back: 5, total: 10, pressMode: 'manual', threshold: 2 },
  stableford: { stake: 5, payout: 'pot', modified: false },
};
const flat = n => ({ id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: n }, (_, i) => ({ par: 4, hdcp: i + 1 })) });
const PEOPLE = ['Ann Lee', 'Bo Diaz', 'Cy Park', 'Di Moss'].map((name, i) => ({ id: 'abcd'[i], name, index: 0 }));
function mk(game, { ids = 'abcd', holes = 18, teams = null, justPlaying = [] } = {}) {
  return createRound({ id: 'r', game, course: flat(holes), holesCount: holes, players: [...ids].map(id => PEOPLE.find(p => p.id === id)), settings: structuredClone(SETTINGS), hcPct: 100, useHandicaps: false, teams, justPlaying });
}
/** Scores hole by hole: each entry is { a: 3 } over a par 4 for everyone. */
function play(r, holes) {
  holes.forEach((over, i) => { r.scores[r.holes[i].no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...over }; });
  return r;
}
const nine = over => Array.from({ length: 9 }, (_, i) => (i === 0 ? over : {}));
const pos = n => Array.from({ length: n }, (_, i) => i + 1);

test('it fires on the ninth hole of eighteen and nowhere else', () => {
  const r = play(mk('stroke'), nine({ a: 3 }));
  assert.equal(HALFWAY_POS, 9);
  const fresh = freshHole(r, pos(8), pos(9));
  assert.deepEqual(fresh, { pos: 9, final: false });
  assert.equal(atHalfway(r, fresh), true);
  assert.equal(atHalfway(r, { pos: 8, final: false }), false);
  assert.equal(atHalfway(r, { pos: 10, final: false }), false);
  // A round that finishes on its ninth (every other hole filled in): the reveal says who won instead
  assert.equal(atHalfway(r, { pos: 9, final: true }), false);
  assert.equal(atHalfway(r, null), false);
  assert.equal(atHalfway({ ...r, status: 'done' }, fresh), false);
  // A nine-hole round has no halfway; its results are one hole away
  assert.equal(atHalfway(play(mk('stroke', { holes: 9 }), nine({ a: 3 })), { pos: 9, final: false }), false);
  assert.equal(halfwayFor(mk('stroke', { holes: 9 })), null);
});

test('stroke play: the leader at the turn, the totals as the game reads them, and everyone’s money', () => {
  const r = play(mk('stroke'), nine({ a: 3 }));
  const h = halfwayFor(r);
  assert.equal(h.holes.length, 9);
  assert.deepEqual(h.holes.map(x => x.no), pos(9));
  assert.equal(h.played, 9);
  assert.equal(h.title, 'Ann leads at the turn');
  assert.match(h.text, /^Up \$\d+ through nine\. Nine to go\.$/);
  assert.equal(h.stepsTitle, 'Totals');
  assert.equal(h.steps[0].label, 'Ann');
  assert.equal(h.steps[0].value, '-1');
  assert.equal(h.steps[0].text, 'Net 35');
  // Amounts stay out of the steps: the money is listed once underneath
  assert.ok(h.steps.every(s => !('amount' in s)));
  assert.equal(h.standings[0].id, 'a');
  assert.ok(h.standings[0].amount > 0);
  assert.equal(h.standings.length, 4);
  assert.equal(h.money, true);
  assert.equal(h.fmt(h.standings[0].amount, { sign: true })[0], '+');
});

test('all square at the turn when nobody leads', () => {
  const h = halfwayFor(play(mk('stroke'), nine({})));
  assert.equal(h.title, 'All square at the turn');
  assert.match(h.text, /nobody’s ahead/);
  assert.ok(h.standings.every(p => p.amount === 0));
});

test('a match shows the match state, skins who holds what, a Nassau its front nine and total', () => {
  const m = halfwayFor(play(mk('match', { ids: 'ab' }), nine({ a: 3 })));
  assert.equal(m.stepsTitle, 'The match');
  assert.equal(m.steps.length, 1);
  assert.match(m.steps[0].text, /Ann 1 up/);
  assert.equal(m.title, 'Ann leads at the turn');
  const s = halfwayFor(play(mk('skins'), nine({ b: 3 })));
  assert.equal(s.stepsTitle, 'Skins won');
  assert.equal(s.steps[0].label, 'Bo');
  assert.equal(s.steps[0].value, '1 skin');
  assert.equal(s.steps[0].text, 'H1');
  assert.equal(s.title, 'Bo leads at the turn');
  const n = halfwayFor(play(mk('nassau', { ids: 'ab' }), nine({ a: 3 })));
  assert.deepEqual(n.steps.map(x => x.label), ['Front 9', 'Total']);
});

test('a card with no game gets the card alone', () => {
  const r = play(mk('stroke', { ids: 'ab', justPlaying: ['a', 'b'] }), nine({ a: 3 }));
  const h = halfwayFor(r);
  assert.equal(h.title, 'Halfway there');
  assert.equal(h.text, 'Nine down, nine to go.');
  assert.deepEqual(h.steps, []);
  assert.equal(h.standings, null);
  assert.equal(h.holes.length, 9);
});

test('the sheet never changes the money', () => {
  const r = play(mk('skins'), nine({ b: 3 }));
  const before = JSON.stringify(roundResults(r));
  halfwayFor(r);
  assert.equal(JSON.stringify(roundResults(r)), before);
  assert.equal(r.holes.length, 18);
});

test('the first nine’s card totals stop at nine, even once the tenth is in', () => {
  // Ten holes saved: the sheet's card shows the first nine, so its totals and to par must too
  const r = play(mk('stroke'), [...nine({ a: 3 }), { a: 6, b: 6, c: 6, d: 6 }]);
  const first = halfwayFor(r).holes;
  assert.equal(first.length, 9);
  assert.deepEqual(scoreSummary(r, 'a', first), { ...scoreSummary(r, 'a', first), gross: 35, played: 9 });
  assert.equal(scoreSummary(r, 'a').played, 10);
  assert.deepEqual(toParOf(r, r.players[0], { holes: first }), { played: 9, gross: -1, net: null });
  assert.equal(toParOf(r, r.players[0]).gross, 1);
});
