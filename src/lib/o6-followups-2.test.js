import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBetAsk } from './bet-asks.js';

const bet = { kind: 'custom', sides: ['a', 'b'], stake: 5, label: 'Longest drive' };

test('a remove heard before its add keeps the bet off when the add arrives', () => {
  const round = { id: 'r1', players: [{ id: 'a' }, { id: 'b' }], bets: [] };
  const remove = { op: 'remove', id: 'X', from: 'a', at: 200 };
  const add = { op: 'add', id: 'X', from: 'a', at: 100, bet };
  const after = applyBetAsk(applyBetAsk(round, remove), add);
  assert.ok(!(after.bets || []).some(b => b.id === 'X'));
  assert.ok(after.betsGone.includes('X'));
});
