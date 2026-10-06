// Polish pass on the overnight 9 screens: who's just playing, said the same way on the Players step
// and the Bets step, with you as "You" and the verb to match.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { justPlayingWho } from './just-playing.js';

const names = { p1: 'Trevor Nielsen', p2: 'Sam Ortiz', p3: 'Bo Green', p4: 'Al Reyes' };
const nameOf = id => names[id];

test('one friend just playing is "is", you on your own are "are"', () => {
  assert.equal(justPlayingWho(['p2'], 'p1', nameOf), 'Sam Ortiz is');
  assert.equal(justPlayingWho(['p1'], 'p1', nameOf), 'You are');
});

test('you are said as You, never your own name, and a list reads with "and"', () => {
  assert.equal(justPlayingWho(['p1', 'p2'], 'p1', nameOf), 'You and Sam Ortiz are');
  assert.equal(justPlayingWho(['p2', 'p3', 'p4'], 'p1', nameOf), 'Sam Ortiz, Bo Green and Al Reyes are');
});

test('nobody just playing says nothing, and a missing name is Someone', () => {
  assert.equal(justPlayingWho([], 'p1', nameOf), '');
  assert.equal(justPlayingWho(['zz'], 'p1', nameOf), 'Someone is');
  assert.equal(justPlayingWho(['p2']), 'p2 is');
});
