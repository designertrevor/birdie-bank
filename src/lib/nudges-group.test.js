// A nudge for money the Tab has two people owing only through the rest of the group asks for the
// new money the round shows, never the money rolled or carried before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OCT, base, skins } from './crew-tabs.fixtures.js';
import { closeBooks, closePreview, lineKey, ALL } from './books.js';
import { paymentNudges } from './nudges.js';
import { outstanding } from './ledger.js';
import { addBet, setBetWinner } from './pair-bets.js';

const all = Array.from({ length: 9 }, (_, i) => [i + 1, 't']);

function rolledThenGroup(stake) {
  let s = base([skins('r1', ['t', 'a'], all, { at: OCT(1), skin: 2 })], { settings: { nudgeDays: 7 } });
  const prev = closePreview(s, ALL, { now: OCT(2) });
  const res = closeBooks(s, ALL, { picks: Object.fromEntries(prev.lines.map(l => [lineKey(l), 'rolled'])), now: OCT(2), makeId: () => 'x' });
  s = { ...s, books: { [res.book.id]: res.book }, carries: [...s.carries, ...res.carries] };
  // Then a group round where a loses to c and t beats b: a owes t only through the group
  let r2 = skins('r2', ['t', 'a', 'b', 'c'], [], { at: OCT(3), skin: 2 });
  r2 = addBet(r2, { kind: 'custom', sides: ['a', 'c'], stake }); r2 = setBetWinner(r2, r2.bets.at(-1).id, 1, 'c');
  r2 = addBet(r2, { kind: 'custom', sides: ['b', 't'], stake }); r2 = setBetWinner(r2, r2.bets.at(-1).id, 1, 't');
  return { ...s, rounds: { ...s.rounds, r2 } };
}

test('a group-only nudge after a roll asks for only the new money, not the rolled $18', () => {
  const s = rolledThenGroup(5);
  const tab = outstanding(s, { now: OCT(12) }).find(x => x.from === 'a' && x.to === 't');
  assert.equal(tab.amount, 23); // the Tab still has the rolled money
  assert.deepEqual(paymentNudges(s, { now: OCT(12) }).map(n => [n.id, n.amount]), [['a', 5]]);
});

test('a group-only nudge for a dollar after a roll asks for the dollar', () => {
  assert.deepEqual(paymentNudges(rolledThenGroup(1), { now: OCT(12) }).map(n => [n.id, n.amount]), [['a', 1]]);
});
