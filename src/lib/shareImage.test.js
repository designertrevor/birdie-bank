import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { shareCardModel, shareImageName } from './shareImage.js';

const SETTINGS = { nassau: { front: 5, back: 5, total: 10, pressMode: 'manual', threshold: 2 }, skins: { value: 2, carryover: true } };
const course9 = {
  id: 'c9', name: 'Pebble Beach G.L.', city: 'Town',
  tees: [{ name: 'Red', color: '#f00', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const players = [{ id: 'a', name: 'Ann Lee', index: 10 }, { id: 'b', name: 'Bo Diaz', index: 2 }, { id: 'c', name: 'Cy Park', index: 5 }];
const mk = (game, n) => {
  const r = createRound({ id: 'r', game, course: course9, holesCount: 9, players: players.slice(0, n), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  r.createdAt = new Date(2026, 8, 26).getTime();
  return r;
};
const DOLLAR = /\$/;

test('card model with amounts: winner, standings and bets', () => {
  const r = mk('nassau', 2);
  for (let h = 1; h <= 9; h++) r.scores[h] = { a: h <= 4 ? 3 : 4, b: 4 };
  const m = shareCardModel(r, roundResults(r));
  assert.equal(m.headline, 'Ann');
  assert.equal(m.sub, '+$15');
  assert.equal(m.big, true);
  assert.equal(m.course, 'Pebble Beach G.L.');
  assert.match(m.meta, /Nassau$/);
  assert.deepEqual(m.standings.map(p => [p.place, p.name, p.amount]), [[1, 'Ann Lee', '+$15'], [2, 'Bo Diaz', '−$15']]);
  assert.equal(m.betsTitle, 'The bets');
  assert.deepEqual(m.bets.map(b => b.value), ['$5', '–', '$10']);
});

test('card model with amounts hidden has no dollar figures anywhere', () => {
  const r = mk('nassau', 2);
  for (let h = 1; h <= 9; h++) r.scores[h] = { a: h <= 4 ? 3 : 4, b: 4 };
  const m = shareCardModel(r, roundResults(r), { showAmounts: false });
  assert.equal(m.sub, 'takes it');
  assert.equal(m.big, false);
  assert.ok(m.standings.every(p => p.amount === null));
  assert.doesNotMatch(JSON.stringify(m), DOLLAR);
  assert.deepEqual(m.bets.map(b => b.value), [null, '–', null]);
  assert.equal(m.bets[0].text, 'Ann 4 up');
});

test('ties share a place and the headline names everyone on top', () => {
  const r = mk('skins', 3);
  r.scores[1] = { a: 3, b: 4, c: 4 };
  r.scores[2] = { a: 4, b: 3, c: 4 };
  const m = shareCardModel(r, roundResults(r));
  assert.equal(m.headline, 'Ann & Bo');
  assert.equal(m.sub, '+$2 each');
  assert.deepEqual(m.standings.map(p => p.place), [1, 1, 3]);
  assert.deepEqual(m.bets.map(b => b.value), ['1 skin', '1 skin']); // skin counts stay, they are not money
});

test('all square', () => {
  const r = mk('skins', 2);
  r.scores[1] = { a: 4, b: 4 };
  const m = shareCardModel(r, roundResults(r));
  assert.equal(m.headline, 'All square');
  assert.equal(m.big, false);
});

test('image file name is a readable slug with the date', () => {
  assert.equal(shareImageName(mk('skins', 2)), 'birdie-bank-pebble-beach-g-l-2026-09-26.png');
  assert.equal(shareImageName({ course: { name: '!!!' }, createdAt: new Date(2026, 0, 5).getTime() }), 'birdie-bank-round-2026-01-05.png');
});
