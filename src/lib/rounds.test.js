import test from 'node:test';
import assert from 'node:assert/strict';
import { addRound, leaveRound, nextActiveId, roundsInProgress } from './rounds.js';

const state = () => ({
  activeRoundId: 'r2',
  rounds: {
    r1: { id: 'r1', status: 'active', createdAt: 1 },
    r2: { id: 'r2', status: 'active', createdAt: 2 },
    r3: { id: 'r3', status: 'done', createdAt: 3 },
    r4: { id: 'r4', status: 'active', createdAt: 4 },
  },
});

test('rounds in progress: the current one first, then newest first, finished ones left out', () => {
  assert.deepEqual(roundsInProgress(state()).map(r => r.id), ['r2', 'r4', 'r1']);
});

test('starting a new round keeps every round already in progress', () => {
  const s = state();
  addRound(s, { id: 'r5', status: 'active', createdAt: 5 });
  assert.equal(s.activeRoundId, 'r5');
  assert.deepEqual(roundsInProgress(s).map(r => r.id), ['r5', 'r4', 'r2', 'r1']);
});

test('finishing the current round points the play button at the newest other one', () => {
  const s = state();
  s.rounds.r2.status = 'done';
  leaveRound(s, 'r2');
  assert.equal(s.activeRoundId, 'r4');
});

test('deleting the current round does the same', () => {
  const s = state();
  delete s.rounds.r2;
  leaveRound(s, 'r2');
  assert.equal(s.activeRoundId, 'r4');
});

test('finishing a round you are not in leaves the current one alone', () => {
  const s = state();
  s.rounds.r1.status = 'done';
  leaveRound(s, 'r1');
  assert.equal(s.activeRoundId, 'r2');
});

test('no rounds left in progress clears the play button', () => {
  const s = { activeRoundId: 'r1', rounds: { r1: { id: 'r1', status: 'active' } } };
  s.rounds.r1.status = 'done';
  leaveRound(s, 'r1');
  assert.equal(s.activeRoundId, null);
  assert.equal(nextActiveId({ rounds: {} }, 'x'), null);
});
