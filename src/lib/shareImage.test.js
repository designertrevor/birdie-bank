import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults } from './round.js';
import { cardReaction, resultsAlt, shareCardModel, shareImageName } from './shareImage.js';
import { gameTheme } from './game-theme.js';

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

test('the reaction: the winner crowned, a tie together, the group for all square', () => {
  const win = mk('nassau', 2);
  for (let h = 1; h <= 9; h++) win.scores[h] = { a: h <= 4 ? 3 : 4, b: 4 };
  assert.deepEqual(shareCardModel(win, roundResults(win)).reaction, { kind: 'win', ids: ['a'] });
  const tie = mk('skins', 3);
  tie.scores[1] = { a: 3, b: 4, c: 4 };
  tie.scores[2] = { a: 4, b: 3, c: 4 };
  assert.deepEqual(shareCardModel(tie, roundResults(tie)).reaction, { kind: 'tie', ids: ['a', 'b'] });
  const sq = mk('skins', 2);
  sq.scores[1] = { a: 4, b: 4 };
  assert.deepEqual(shareCardModel(sq, roundResults(sq)).reaction, { kind: 'square', ids: ['a', 'b'] });
  // A Big Game waiting on its other groups has no winner yet
  assert.equal(cardReaction({ ...roundResults(win), big: { final: false } }), null);
  // Five level on top is a crowd, not a reaction
  assert.equal(cardReaction({ standings: [1, 2, 3, 4, 5].map(i => ({ id: `p${i}`, amount: 2 })).concat([{ id: 'x', amount: -10 }]) }), null);
});

test('the card takes the main game\'s colour, a multi-game round its first game\'s', () => {
  const r = mk('nassau', 2);
  for (let h = 1; h <= 9; h++) r.scores[h] = { a: h <= 4 ? 3 : 4, b: 4 };
  const m = shareCardModel(r, roundResults(r));
  const t = gameTheme('nassau');
  assert.deepEqual(m.theme, { game: 'nassau', tint: t.tint, soft: t.soft, ink: t.ink });
  const sk = mk('skins', 2);
  sk.scores[1] = { a: 3, b: 4 };
  assert.equal(shareCardModel(sk, roundResults(sk)).theme.tint, gameTheme('skins').tint);
});

test('the pictures ride along, and amounts hidden stay hidden with them on', () => {
  const r = mk('nassau', 2);
  for (let h = 1; h <= 9; h++) r.scores[h] = { a: h <= 4 ? 3 : 4, b: 4 };
  const art = { cheer: 'data:image/svg+xml;charset=utf-8,%3Csvg%3E%24%3C%2Fsvg%3E', game: 'data:image/svg+xml,game' };
  const off = shareCardModel(r, roundResults(r), { showAmounts: false, art });
  assert.deepEqual(off.art, art);
  assert.doesNotMatch(JSON.stringify(off), DOLLAR);
  assert.equal(off.sub, 'takes it');
  assert.match(resultsAlt(off), /Ann’s buddy in a crown, arms up/);
  assert.doesNotMatch(resultsAlt(off), DOLLAR);
  // No pictures yet: no art on the model and nothing about it in the alt text
  const plain = shareCardModel(r, roundResults(r), { showAmounts: false });
  assert.equal(plain.art, null);
  assert.doesNotMatch(resultsAlt(plain), /crown/);
});
