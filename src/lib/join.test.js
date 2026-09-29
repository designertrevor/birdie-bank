import test from 'node:test';
import assert from 'node:assert/strict';
import { afterJoin, joinRoute, teamLine } from './join.js';

const state = { rounds: {
  a: { id: 'a', status: 'active', shared: { code: 'ABC123', host: false } },
  b: { id: 'b', status: 'done', shared: { code: 'DONE11', host: false } },
  c: { id: 'c', status: 'active', shared: { code: 'ENDED1', host: false, ended: true } },
} };

test('join link: a round you do not have yet opens the invite card', () => {
  assert.deepEqual(joinRoute(state, 'xyz789'), ['joinInvite', { code: 'XYZ789' }]);
  assert.deepEqual(joinRoute({}, 'XYZ-789'), ['joinInvite', { code: 'XYZ789' }]);
});

test('join link: a round already on this phone opens as it is', () => {
  assert.deepEqual(joinRoute(state, 'abc123'), ['play', { id: 'a' }]);
  assert.deepEqual(joinRoute(state, 'DONE11'), ['roundDetail', { id: 'b' }]);
});

test('join link: a round whose sharing ended still opens the copy on this phone', () => {
  assert.deepEqual(joinRoute(state, 'ENDED1'), ['play', { id: 'c' }]);
});

test('join link: a bad code goes nowhere', () => {
  assert.equal(joinRoute(state, ''), null);
  assert.equal(joinRoute(state, 'AB1'), null);
});

test('after joining: the round, or its results when finished', () => {
  assert.deepEqual(afterJoin('r1', false), ['play', { id: 'r1' }]);
  assert.deepEqual(afterJoin('r1', true), ['roundDetail', { id: 'r1' }]);
});

test('team line: an auto-named pair stands alone', () => {
  assert.equal(teamLine('Sam & Dave', ['Dave']), 'Sam & Dave');
});

test('team line: a plain team name says who you are with', () => {
  assert.equal(teamLine('Team A', ['Dave']), 'Team A with Dave');
  assert.equal(teamLine('Team A', ['Dave', 'Bo']), 'Team A with Dave and Bo');
  assert.equal(teamLine('Team A', ['Dave', 'Bo', 'Cy']), 'Team A with Dave, Bo and Cy');
});

test('team line: a renamed team missing one mate lists them all', () => {
  assert.equal(teamLine('Dave’s Bandits', ['Dave', 'Bo']), 'Dave’s Bandits with Dave and Bo');
});

test('team line: names match whole words in any case', () => {
  assert.equal(teamLine('sam & DAVE', ['Dave']), 'sam & DAVE');
  assert.equal(teamLine('Davey & Sam', ['Dave']), 'Davey & Sam with Dave');
});

test('team line: no mates is just the team name', () => {
  assert.equal(teamLine('Team A', []), 'Team A');
  assert.equal(teamLine('Team A'), 'Team A');
});
