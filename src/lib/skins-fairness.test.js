// Skins fairness options added 2026-09-30: Canadian skins (a natural birdie beats a net birdie) and
// validating a skin with net par or better on the next hole. Hand-worked cases on a flat nine (par 4s),
// $2 a skin, four players, so every number can be checked on a napkin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound, roundResults, skinsTable } from './round.js';
import { skinsRulesLine } from './side-games.js';

const course = { id: 'f', name: 'Flat', city: 'T', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const P = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: ['Ann', 'Bo', 'Cy', 'Di'][i], index: 0 }));
const SKINS = { value: 2, carryover: true, kind: 'net', payout: 'per', stake: 10, lastCarry: 'void' };

function mk(skins = {}, { side = false } = {}) {
  const s = { ...SKINS, ...skins };
  const r = createRound({ id: 'r', game: side ? 'nassau' : 'skins', course, holesCount: 9, players: P, settings: { skins: side ? SKINS : s, nassau: { front: 0, back: 0, total: 0, pressMode: 'off', threshold: 2 } }, hcPct: 100, useHandicaps: false });
  if (side) r.sideGames = [{ game: 'skins', settings: s }];
  return r;
}
/** Par for everyone on holes 1..n, then any overrides: { 3: { a: 3 } }. */
function scores(r, upto, over = {}) {
  r.holes.slice(0, upto).forEach(h => {
    r.scores[h.no] = { ...Object.fromEntries(r.players.map(p => [p.id, 4])), ...(over[h.no] || {}) };
  });
  return r;
}
const bal = r => roundResults(r).balances;
/** Bo gets a stroke on the hardest hole (hole 1). */
const boStroke = r => { r.players[1].plays = 1; return r; };

// ---------------------------------------------------------------------------
// Old rounds

test('a skins round with neither option saved gives the same money as with both off', () => {
  const over = { 1: { a: 3 }, 2: { b: 5 }, 3: { a: 3, b: 3 }, 4: { c: 3 }, 5: { a: 5 }, 9: { d: 3 } };
  const old = boStroke(scores(mk(), 9, over));
  const off = boStroke(scores(mk({ canadian: false, validate: false }), 9, over));
  assert.deepEqual(bal(old), bal(off));
  // Hole 1: Ann 3 ties Bo's net 3 (carry). Hole 2: Bo's 5 leaves a three-way tie (carry). Hole 3:
  // Ann and Bo tie (carry). Hole 4: Cy takes 4 skins, $8 from each. Hole 5: tie. Hole 9: Di takes 5.
  assert.deepEqual(bal(old), { a: -8 - 10, b: -8 - 10, c: 24 - 10, d: -8 + 30 });
});

// ---------------------------------------------------------------------------
// Canadian skins

test('Canadian skins: a natural birdie beats a net birdie on the same hole', () => {
  const plain = boStroke(scores(mk(), 1, { 1: { a: 3 } }));
  assert.equal(skinsTable(plain).rows[0].winner, null, 'without it, Ann and Bo tie on net 3');
  const r = boStroke(scores(mk({ canadian: true }), 1, { 1: { a: 3 } }));
  const row = skinsTable(r).rows[0];
  assert.equal(row.winner, 'a');
  assert.equal(row.canadian, true);
  assert.deepEqual(bal(r), { a: 6, b: -2, c: -2, d: -2 });
});

test('Canadian skins: two natural birdies still tie, and a tie at net par is a tie', () => {
  const two = boStroke(scores(mk({ canadian: true }), 1, { 1: { a: 3, c: 3 } }));
  assert.equal(skinsTable(two).rows[0].winner, null);
  // Bo's 5 with a stroke ties the par 4s: no birdie, so the rule doesn't come in
  const par = boStroke(scores(mk({ canadian: true }), 1, { 1: { b: 5 } }));
  assert.equal(skinsTable(par).rows[0].winner, null);
});

test('Canadian skins: gross skins are untouched', () => {
  const r = boStroke(scores(mk({ canadian: true, kind: 'gross' }), 1, { 1: { a: 3 } }));
  assert.equal(skinsTable(r).rows[0].winner, 'a', 'gross 3 beats gross 4 anyway');
});

// ---------------------------------------------------------------------------
// Validate skins

test('validate: a skin waits on the next hole and counts once its winner makes par there', () => {
  const r = scores(mk({ validate: true }), 1, { 1: { a: 3 } });
  const row = skinsTable(r).rows[0];
  assert.equal(row.winner, 'a');
  assert.equal(row.pending, true);
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 }, 'nothing paid until hole 2 is in');
  scores(r, 2, { 1: { a: 3 } });
  assert.equal(skinsTable(r).rows[0].pending, false);
  assert.deepEqual(bal(r), { a: 6, b: -2, c: -2, d: -2 });
});

test('validate: a bogey on the next hole sends the skin back into the carry', () => {
  // Hole 1: Ann's birdie wins. Hole 2: Ann makes 5, so hole 1's skin goes back; Bo, Cy and Di tie at 4,
  // so 2 skins carry. Hole 3: Bo's birdie takes 3 skins, $6 from each, and holds with par on hole 4.
  const r = scores(mk({ validate: true }), 4, { 1: { a: 3 }, 2: { a: 5 }, 3: { b: 3 } });
  const t = skinsTable(r);
  assert.equal(t.rows[0].winner, null);
  assert.equal(t.rows[0].lost, 'a');
  assert.equal(t.rows[2].winner, 'b');
  assert.equal(t.rows[2].skins, 3);
  assert.deepEqual(bal(r), { a: -6, b: 18, c: -6, d: -6 });
});

test('validate: with carryovers off, a skin that does not hold is gone', () => {
  const r = scores(mk({ validate: true, carryover: false }), 4, { 1: { a: 3 }, 2: { a: 5 }, 3: { b: 3 } });
  assert.deepEqual(bal(r), { a: -2, b: 6, c: -2, d: -2 });
});

test('validate: the last hole needs no check, and a round ended early lets the last skin stand', () => {
  const last = scores(mk({ validate: true }), 9, { 9: { d: 3 } });
  assert.equal(skinsTable(last).rows[8].pending, undefined);
  // Holes 1 to 8 tie, so Di's birdie on 9 takes 9 skins, $18 from each
  assert.deepEqual(bal(last), { a: -18, b: -18, c: -18, d: 54 });
  const early = scores(mk({ validate: true }), 3, { 3: { c: 3 } });
  assert.deepEqual(bal(early), { a: 0, b: 0, c: 0, d: 0 });
  early.status = 'done';
  assert.deepEqual(bal(early), { a: -6, b: -6, c: 18, d: -6 });
});

test('validate: a pot is shared only by skins that held', () => {
  // $10 each in, $40 pot. Ann's skin on 1 doesn't hold; Bo's on 3 takes 3 skins and holds: all of it
  const r = scores(mk({ validate: true, payout: 'pot' }), 4, { 1: { a: 3 }, 2: { a: 5 }, 3: { b: 3 } });
  assert.deepEqual(bal(r), { a: -10, b: 30, c: -10, d: -10 });
});

test('both options work on Skins as a side game', () => {
  const r = boStroke(scores(mk({ canadian: true, validate: true }, { side: true }), 3, { 1: { a: 3 }, 2: { a: 5 }, 3: { c: 3 } }));
  // Hole 1: Ann's natural birdie beats Bo's net one, but Ann bogeys 2, so it goes back. Hole 3: Cy
  // takes 3 skins (hole 1, the tied hole 2 and hole 3), still waiting on hole 4.
  assert.deepEqual(bal(r), { a: 0, b: 0, c: 0, d: 0 });
  scores(r, 4, { 1: { a: 3 }, 2: { a: 5 }, 3: { c: 3 } });
  assert.deepEqual(bal(r), { a: -6, b: -6, c: 18, d: -6 });
});

test('the house rules line says when the options are on', () => {
  assert.equal(skinsRulesLine({ ...SKINS }), 'Net · $2 a skin · last carry unclaimed');
  assert.equal(skinsRulesLine({ ...SKINS, canadian: true, validate: true }), 'Net · $2 a skin · last carry unclaimed · Canadian · validated');
});
