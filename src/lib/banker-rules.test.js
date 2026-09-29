import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankerHoleSetup, createRound, lowBanker } from './round.js';

const SETTINGS = {
  hcPct: 100,
  banker: { defaultBet: 5, min: 1, max: 20, ties: 'push', rotation: 'low' },
};
const course = {
  id: 'c', name: 'Nine', city: 'Town',
  tees: [{ name: 'White', color: '#fff', rating: 35.0, slope: 113 }],
  holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })),
};
const players = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id.toUpperCase(), index: 0, tee: 'White' }));
const mk = () => createRound({ id: 'r', game: 'banker', course, holesCount: 9, nine: 'front', players, settings: SETTINGS, hcPct: 100 });

test('low score banks: the first hole goes to the first banker', () => {
  const r = mk();
  assert.equal(bankerHoleSetup(r, 0).banker, 'a');
});

test('low score banks: the lowest score on the hole before banks the next', () => {
  const r = mk();
  r.scores[1] = { a: 5, b: 4, c: 3, d: 6 };
  r.banker[1] = { banker: 'a', bets: {}, doubled: {}, doubleBack: false };
  assert.equal(bankerHoleSetup(r, 1).banker, 'c');
});

test('low score banks: a tie stays with the banker when they were in it', () => {
  const r = mk();
  r.scores[1] = { a: 3, b: 3, c: 5, d: 6 };
  r.banker[1] = { banker: 'b', bets: {}, doubled: {}, doubleBack: false };
  assert.equal(bankerHoleSetup(r, 1).banker, 'b');
});

test('low score banks: a tie without the banker goes to the next tied player in the order', () => {
  const r = mk();
  r.scores[1] = { a: 3, b: 5, c: 6, d: 3 };
  r.banker[1] = { banker: 'b', bets: {}, doubled: {}, doubleBack: false };
  // After b comes c (not tied), then d (tied)
  assert.equal(lowBanker(r, 1, ['a', 'b', 'c', 'd'], 'b'), 'd');
});

test('low score banks: a pickup never banks, and the new banker has no bet', () => {
  const r = mk();
  r.scores[1] = { a: 'X', b: 6, c: 5, d: 7 };
  r.banker[1] = { banker: 'a', bets: {}, doubled: {}, doubleBack: false };
  const setup = bankerHoleSetup(r, 1);
  assert.equal(setup.banker, 'c');
  assert.deepEqual(Object.keys(setup.bets).sort(), ['a', 'b', 'd']);
});

// --- Birdies double ---
import { settleBankerHole } from './golf.js';
import { roundResults } from './round.js';

const hole = { banker: 'a', bets: { b: 5, c: 5, d: 5 }, doubled: {}, doubleBack: false };
const ids = ['a', 'b', 'c', 'd'];

test('birdies off: a birdie pays the plain bet', () => {
  const { deltas } = settleBankerHole(hole, { a: 4, b: 3, c: 4, d: 5 }, ids, { gross: { a: 4, b: 3, c: 4, d: 5 }, par: 4 });
  assert.deepEqual(deltas, { a: 0, b: 5, c: 0, d: -5 });
});

test('real birdie: the winner’s birdie doubles, an eagle doubles again', () => {
  const g = { a: 5, b: 3, c: 2, d: 6 };
  const { deltas, matchups } = settleBankerHole(hole, g, ids, { birdies: 'gross', gross: g, par: 4 });
  assert.deepEqual(deltas, { a: -10 - 20 + 5, b: 10, c: 20, d: -5 });
  assert.equal(matchups.find(m => m.pid === 'c').birdie, 4);
});

test('real birdie: the banker’s birdie doubles every bet the banker wins', () => {
  const g = { a: 3, b: 4, c: 5, d: 3 };
  const { deltas } = settleBankerHole(hole, g, ids, { birdies: 'gross', gross: g, par: 4 });
  // b and c lose to a birdie: 10 each. d ties the banker: a push, nothing doubles
  assert.deepEqual(deltas, { a: 20, b: -10, c: -10, d: 0 });
});

test('real birdie: a stroke never makes a birdie, a net birdie setting counts it', () => {
  const gross = { a: 5, b: 4, c: 5, d: 5 };
  const net = { a: 5, b: 3, c: 5, d: 5 }; // b gets a stroke
  assert.equal(settleBankerHole(hole, net, ids, { birdies: 'gross', gross, par: 4 }).deltas.b, 5);
  assert.equal(settleBankerHole(hole, net, ids, { birdies: 'net', gross, par: 4 }).deltas.b, 10);
});

test('birdies stack on a double and a double back', () => {
  const h = { ...hole, doubled: { b: true }, doubleBack: true };
  const g = { a: 5, b: 3, c: 5, d: 5 };
  assert.equal(settleBankerHole(h, g, ids, { birdies: 'gross', gross: g, par: 4 }).deltas.b, 5 * 4 * 2);
});

test('a pickup is never a birdie, and a round’s money follows the setting', () => {
  const r = createRound({ id: 'r', game: 'banker', course, holesCount: 9, nine: 'front', players, settings: { ...SETTINGS, banker: { ...SETTINGS.banker, birdies: 'gross' } }, hcPct: 100 });
  r.scores[1] = { a: 4, b: 3, c: 'X', d: 4 };
  r.banker[1] = { banker: 'a', bets: { b: 5, c: 5, d: 5 }, doubled: {}, doubleBack: false };
  const res = roundResults(r);
  assert.equal(res.balances.b, 10);
  assert.equal(res.balances.c, -5);
});
