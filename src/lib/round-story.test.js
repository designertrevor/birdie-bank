// History's round cards (round-story.js): who came out on top, the round's best moment, the good
// days, and that the facts a card shows are the ones the one-line row always showed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { myNet } from './history.js';
import { bigDays, roundFacts, roundHighlight, roundWinner } from './round-story.js';

const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true }, stroke: { stake: 5, payout: 'pot' } };
const course = { id: 'c', name: 'Logan River', city: 'Logan', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };
const people = ids => ids.map(id => ({ id, name: `${id[0].toUpperCase()}${id.slice(1)} Smith`, index: 0 }));

function round(id, game, ids, holes = {}, extra = {}) {
  const r = createRound({ id, game, course, holesCount: 9, players: people(ids), settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = holes[h.no] || Object.fromEntries(ids.map(p => [p, 4]));
  r.status = 'done';
  r.finishedAt = r.createdAt = Date.UTC(2026, 9, 10 + Number(id.replace(/\D/g, '') || 0));
  return Object.assign(r, extra);
}
const state = rounds => ({ me: 'me', players: {}, rounds: Object.fromEntries(rounds.map(r => [r.id, r])), settlements: [] });

test('winner: you, someone else, a tie, all square', () => {
  const won = round('r1', 'stroke', ['me', 'mike'], { 1: { me: 3, mike: 4 } });
  assert.deepEqual(roundWinner(won, state([won])), { text: 'You won', you: true });
  const lost = round('r2', 'stroke', ['me', 'mike'], { 1: { me: 5, mike: 4 } });
  assert.deepEqual(roundWinner(lost, state([lost])), { text: 'Mike won', you: false });
  const even = round('r3', 'stroke', ['me', 'mike']);
  assert.equal(roundWinner(even, state([even])).text, 'All square');
  // Two skins each: you and Mike share the top
  const tie = round('r4', 'skins', ['me', 'mike', 'dave'], { 1: { me: 3, mike: 4, dave: 4 }, 2: { me: 4, mike: 3, dave: 4 } });
  const w = roundWinner(tie, state([tie]));
  assert.equal(w.text, 'You and Mike tied for the top');
  assert.equal(w.you, true);
});

test('winner: your seat in a joined round is you', () => {
  const r = round('r1', 'stroke', ['seat', 'mike'], { 1: { seat: 3, mike: 4 } }, { localMe: 'seat' });
  assert.deepEqual(roundWinner(r, state([r])), { text: 'You won', you: true });
});

test('highlight: a big moment shows, a quiet round has none, and it is the same each time', () => {
  // Four holes carried, then Mike takes them all on 5
  const big = round('r1', 'skins', ['me', 'mike', 'dave'], { 5: { me: 4, mike: 3, dave: 4 } });
  const h = roundHighlight(big);
  assert.ok(h, 'a 5-skin carry is a moment');
  assert.equal(h.hole, 5);
  assert.match(h.title, /Mike/);
  assert.deepEqual(roundHighlight(structuredClone(big)), h, 'a cloned round reads the same');
  const quiet = round('r2', 'stroke', ['me', 'mike']);
  assert.equal(roundHighlight(quiet), null);
  // A fixed hole after the round changes the moment, not a stale copy of it
  const fixed = structuredClone(big);
  fixed.scores[5] = { me: 3, mike: 4, dave: 4 };
  assert.match(roundHighlight(fixed).title, /Me/);
});

test('big days: your best win of each month, only with more than one round in it', () => {
  const a = round('r1', 'stroke', ['me', 'mike'], { 1: { me: 3, mike: 4 } });
  const b = round('r2', 'stroke', ['me', 'mike', 'dave'], { 1: { me: 3, mike: 4, dave: 4 } });
  const c = round('r3', 'stroke', ['me', 'mike'], { 1: { me: 5, mike: 4 } });
  const s = state([a, b, c]);
  const amount = r => myNet(r, s);
  assert.deepEqual([...bigDays([{ rounds: [a, b, c] }], amount)], ['r2']);
  assert.deepEqual([...bigDays([{ rounds: [a] }], amount)], [], 'a month of one round has nothing to stand out from');
  assert.deepEqual([...bigDays([{ rounds: [c, c] }], amount)], [], 'no win, no big day');
  const lunch = round('r4', 'stroke', ['me', 'mike', 'dave'], { 1: { me: 2, mike: 4, dave: 4 } }, { playFor: { kind: 'reward', reward: 'Lunch' } });
  assert.deepEqual([...bigDays([{ rounds: [a, lunch] }], r => myNet(r, state([a, lunch])))], ['r1'], 'points and lunch rounds never count as a money day');
});

test('facts: the card and the row read the same amount, and a points round never shows dollars', () => {
  const r = round('r1', 'stroke', ['me', 'mike'], { 1: { me: 3, mike: 4 } });
  const s = state([r]);
  const f = roundFacts(r, s);
  assert.equal(f.amount, myNet(r, s));
  assert.equal(f.money(f.amount, { sign: true }), '+$5');
  const pts = round('r2', 'stroke', ['me', 'mike'], { 1: { me: 3, mike: 4 } }, { playFor: { kind: 'points' } });
  const p = roundFacts(pts, state([pts]));
  assert.ok(!p.money(p.amount, { sign: true }).includes('$'), 'points, not dollars');
  assert.equal(p.sub, 'For bragging rights');
});
