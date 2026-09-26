import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { revealSteps, revealTiming } from './reveal.js';

const SETTINGS = {
  nassau: { front: 5, back: 5, total: 10, pressMode: 'manual', threshold: 2 },
  skins: { value: 2, carryover: true },
  nines: { point: 1 },
  stableford: { stake: 5, payout: 'pot', modified: false },
  rabbit: { stake: 5, tiesFree: true },
};
const course9 = {
  id: 'c9', name: 'Nine', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const players = [
  { id: 'a', name: 'Ann Lee', index: 10 },
  { id: 'b', name: 'Bo Diaz', index: 2 },
  { id: 'c', name: 'Cy Park', index: 5 },
];
const mk = (game, n = 2) => createRound({ id: 'r', game, course: course9, holesCount: 9, players: players.slice(0, n), settings: SETTINGS, hcPct: 100, useHandicaps: false });
const play = (r, rows) => rows.forEach((s, i) => { r.scores[i + 1] = s; });

test('nassau: legs in order with winners and amounts, then presses', () => {
  const r = mk('nassau');
  // Ann wins the first four, the last five are halved until Bo takes hole 9
  play(r, [
    { a: 3, b: 4 }, { a: 3, b: 4 }, { a: 3, b: 4 }, { a: 3, b: 4 },
    { a: 4, b: 4 }, { a: 4, b: 4 }, { a: 4, b: 4 }, { a: 4, b: 4 }, { a: 5, b: 4 },
  ]);
  r.presses.push({ id: 'p1', leg: 'total', start: 6, by: 1 });
  const { title, steps } = revealSteps(r, roundResults(r));
  assert.equal(title, 'The bets');
  assert.deepEqual(steps.map(s => s.label), ['First 4', 'Last 5', 'All 9', 'All 9 press from H6']);
  assert.deepEqual(steps.map(s => s.text), ['Ann 4 up', 'Bo 1 up', 'Ann 3 up', 'Bo 1 up']);
  assert.deepEqual(steps.map(s => s.amount), [5, 5, 10, 10]);
  assert.ok(steps.every(s => !s.tie));
});

test('nassau: a halved leg is a push with no amount, unplayed legs are skipped', () => {
  const r = mk('nassau');
  play(r, [{ a: 4, b: 4 }, { a: 4, b: 4 }, { a: 4, b: 4 }, { a: 4, b: 4 }]);
  const { steps } = revealSteps(r, roundResults(r));
  assert.deepEqual(steps.map(s => s.label), ['First 4', 'All 9']);
  assert.equal(steps[0].text, 'Halved');
  assert.equal(steps[0].tie, true);
  assert.equal(steps[0].amount, undefined);
  assert.equal(steps[1].text, 'All square');
});

test('skins: skins per player, most first, with holes and carried skins', () => {
  const r = mk('skins', 3);
  play(r, [
    { a: 3, b: 4, c: 4 }, // Ann 1
    { a: 4, b: 4, c: 4 }, // carry
    { a: 5, b: 3, c: 4 }, // Bo 2
    { a: 4, b: 5, c: 3 }, // Cy 1
    { a: 4, b: 3, c: 5 }, // Bo 1
    { a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 }, { a: 4, b: 4, c: 4 },
  ]);
  const { title, steps } = revealSteps(r, roundResults(r));
  assert.equal(title, 'Skins won');
  assert.deepEqual(steps.map(s => s.label), ['Bo', 'Ann', 'Cy', 'Carried over']);
  assert.deepEqual(steps.map(s => s.value), ['3 skins', '1 skin', '1 skin', '4 skins']);
  assert.equal(steps[0].text, 'H3, H5');
  assert.equal(steps[0].amount, 12); // 3 skins x $2 x 2 opponents
  assert.equal(steps[3].tie, true);
});

test('skins with nothing won has no steps', () => {
  const r = mk('skins', 3);
  play(r, [{ a: 4, b: 4, c: 4 }]);
  assert.deepEqual(revealSteps(r, roundResults(r)).steps, []);
});

test('banker: the three biggest holes, in playing order', () => {
  const round = { game: 'banker', players: players.map(p => ({ id: p.id, name: p.name })), holes: [] };
  const res = { detail: { holes: [
    { no: 1, banker: 'a', deltas: { a: 4, b: -2, c: -2 } },
    { no: 2, banker: 'b', deltas: { a: 10, b: -10, c: 0 } },
    { no: 3, banker: 'c', deltas: { a: -1, b: -1, c: 2 } },
    { no: 4, banker: 'a', deltas: { a: 12, b: -6, c: -6 } },
    { no: 5, banker: 'b', deltas: { a: 0, b: 0, c: 0 } },
  ] } };
  const { title, steps } = revealSteps(round, res);
  assert.equal(title, 'Biggest holes');
  assert.deepEqual(steps.map(s => s.label), ['Hole 1', 'Hole 2', 'Hole 4']);
  assert.deepEqual(steps.map(s => s.amount), [4, 10, 12]);
  assert.deepEqual(steps.map(s => s.text), ['Ann as banker', 'Ann beats the banker', 'Ann as banker']);
});

test('points games list points per player, most first', () => {
  const r = mk('nines', 3);
  play(r, [{ a: 3, b: 4, c: 5 }, { a: 3, b: 4, c: 5 }]);
  const { title, steps } = revealSteps(r, roundResults(r));
  assert.equal(title, 'Points');
  assert.deepEqual(steps.map(s => [s.label, s.value]), [['Ann', '10 points'], ['Bo', '6 points'], ['Cy', '2 points']]);
});

test('stableford totals, best first', () => {
  const r = mk('stableford', 2);
  play(r, [{ a: 3, b: 4 }, { a: 4, b: 5 }]);
  const { steps } = revealSteps(r, roundResults(r));
  assert.deepEqual(steps.map(s => [s.label, s.value]), [['Ann', '5 pts'], ['Bo', '3 pts']]);
});

test('rabbit: only finished legs, with the holder or a loose rabbit', () => {
  const r = mk('rabbit', 3);
  play(r, Array.from({ length: 9 }, (_, i) => (i === 8 ? { a: 5, b: 3, c: 4 } : { a: 4, b: 4, c: 4 })));
  const { steps } = revealSteps(r, roundResults(r));
  assert.deepEqual(steps, [{ key: 'All 9', label: 'All 9', text: 'Bo holds the rabbit', amount: 10 }]);
});

test('unknown or empty detail returns no steps', () => {
  assert.deepEqual(revealSteps({ game: 'nassau', players: [] }, { detail: {} }).steps, []);
  assert.deepEqual(revealSteps({ game: 'mystery', players: [] }, {}).steps, []);
});

test('timing keeps the whole reveal near four seconds', () => {
  for (const [steps, n] of [[0, 2], [3, 4], [6, 4], [12, 8]]) {
    const t = revealTiming(steps, n);
    assert.ok(t.landed <= 4200, `${steps} steps, ${n} players: ${t.landed}ms`);
  }
  assert.equal(revealTiming(0, 4).stepsEnd, 0);
});
