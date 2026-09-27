import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMeta, buildMeta, merge3, stable } from './sync-model.js';

test('merge3 takes the remote copy when this phone has no unsent edit', () => {
  const base = { scores: { a: 4 } };
  assert.deepEqual(merge3(base, { scores: { a: 4 } }, { scores: { a: 5 } }, 2), { scores: { a: 5 } });
});

test('merge3 keeps an unsent local edit when the server did not change', () => {
  const base = { scores: { a: 4 } };
  assert.deepEqual(merge3(base, { scores: { a: 3 } }, { scores: { a: 4 } }, 2), { scores: { a: 3 } });
});

test('merge3 keeps both phones when they scored different players on one hole', () => {
  const base = null;
  const local = { scores: { a: 4 }, banker: null };
  const remote = { scores: { b: 5 }, banker: null };
  assert.equal(stable(merge3(base, local, remote, 2)), stable({ scores: { a: 4, b: 5 }, banker: null }));
});

test('merge3 keeps this phone on a true clash', () => {
  const base = { scores: { a: 4 } };
  assert.deepEqual(merge3(base, { scores: { a: 3 } }, { scores: { a: 6 } }, 2), { scores: { a: 3 } });
});

test('merge3 with no known base unions keys and lets the server win clashes', () => {
  assert.deepEqual(merge3(undefined, { status: 'active', name: 'x' }, { status: 'done' }, 1), { status: 'done', name: 'x' });
  assert.deepEqual(merge3(undefined, { scores: { a: 4, b: 3 } }, { scores: { b: 5, c: 6 } }, 2), { scores: { a: 4, b: 5, c: 6 } });
  assert.deepEqual(merge3({ status: 'active', name: 'x' }, { status: 'active', name: 'y' }, { status: 'done', name: 'x' }, 1), { status: 'done', name: 'y' });
});

test('fixing scores on a finished round stays on the phone doing it', () => {
  const round = { id: 'r', status: 'done', editing: true, scores: {}, current: 0 };
  assert.equal('editing' in buildMeta(round), false);
  // Meta from another phone doesn't carry the flag, and applying it leaves this phone's flag alone
  applyMeta(round, { id: 'r', status: 'done' });
  assert.equal(round.editing, true);
});
