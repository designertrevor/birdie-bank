import test from 'node:test';
import assert from 'node:assert/strict';
import { usualRound } from './rounds.js';
import { COURSES } from '../data/courses.js';

const course = { id: COURSES[0].id, name: COURSES[0].name };
const players = [{ id: 'p1', name: 'Trevor' }, { id: 'p2', name: 'Dave' }];
const state = rounds => ({ players: { p1: { id: 'p1' }, p2: { id: 'p2' } }, customCourses: {}, rounds });
const round = (id, extra) => ({ id, game: 'skins', course, players, createdAt: 1, status: 'done', ...extra });

test('your usual: the newest finished round this phone set up', () => {
  const s = state({ a: round('a', { createdAt: 1 }), b: round('b', { createdAt: 2 }) });
  assert.equal(usualRound(s).round.id, 'b');
});

test('your usual: a round still in progress is never offered', () => {
  const s = state({ a: round('a', { createdAt: 1 }), b: round('b', { createdAt: 2, status: 'active' }) });
  assert.equal(usualRound(s).round.id, 'a');
  assert.equal(usualRound(state({ b: round('b', { status: 'active' }) })), null);
});

test('your usual: a finished round being fixed is not offered while it is open', () => {
  const s = state({ a: round('a', { createdAt: 1 }), b: round('b', { createdAt: 2, editing: true }) });
  assert.equal(usualRound(s).round.id, 'a');
});

test('your usual: rounds joined from someone else, or with a player gone, are skipped', () => {
  const s = state({ a: round('a', { createdAt: 1 }), b: round('b', { createdAt: 2, localMe: 'p1' }), c: round('c', { createdAt: 3, players: [...players, { id: 'gone', name: 'X' }] }) });
  assert.equal(usualRound(s).round.id, 'a');
});

test('your usual: a round you only watched from a link is never offered', () => {
  const s = state({ a: round('a', { createdAt: 1 }), w: round('w', { createdAt: 2, localMe: null, shared: { code: 'WTCH', host: false } }) });
  assert.equal(usualRound(s).round.id, 'a');
});
