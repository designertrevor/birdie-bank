import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMeta, assemble, buildMeta, buildRequest, cleanRequestName, isRequestNo, merge3, newRequestNo, readRequest, stable, waitingRequests } from './sync-model.js';

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

test('seat requests ride under negative hole numbers that no round ever plays', () => {
  for (let i = 0; i < 50; i++) {
    const no = newRequestNo();
    assert.ok(Number.isInteger(no) && no < 0 && isRequestNo(no) && isRequestNo(String(no)));
  }
  assert.equal(isRequestNo(1), false);
  assert.equal(buildRequest('   '), null);
  assert.deepEqual(buildRequest('  Sam   Lee  ', 5), { request: { name: 'Sam Lee', at: 5, status: 'waiting' } });
  assert.equal(cleanRequestName('x'.repeat(40)).length, 24);
});

test('waiting requests: only well-formed ones still waiting, oldest first', () => {
  const holes = {
    1: { scores: { a: 4 } },
    '-7': { request: { name: 'Sam', at: 20, status: 'waiting' } },
    '-9': { request: { name: 'Al', at: 10, status: 'waiting' } },
    '-3': { request: { name: 'Jo', at: 5, status: 'in', playerId: 'p1' } },
    '-4': { request: { name: '', at: 1, status: 'waiting' } },
    '-5': null,
    '-6': { request: { name: 'Bad', status: 'maybe' } },
  };
  assert.deepEqual(waitingRequests(holes), [{ no: -9, name: 'Al', at: 10, status: 'waiting', playerId: null }, { no: -7, name: 'Sam', at: 20, status: 'waiting', playerId: null }]);
  assert.deepEqual(readRequest(holes['-3']), { name: 'Jo', at: 5, status: 'in', playerId: 'p1' });
});

test('a round with seat requests in its hole records assembles as if they were not there', () => {
  const holes = { '-12': { request: { name: 'Sam', at: 1, status: 'waiting' } } };
  const meta = { id: 'r', holes: [{ no: 1, par: 4, rank: 1 }], players: [{ id: 'a', name: 'Ann', plays: 0 }], game: 'skins', settings: {} };
  const round = assemble(meta, holes);
  assert.deepEqual(round.scores, {});
  assert.deepEqual(round.presses, []);
});
