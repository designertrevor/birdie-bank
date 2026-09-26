import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDoc, hashAll, outgoing, remapId, resolve, toDocs } from './cloud-model.js';

const base = () => ({
  me: 'p_me', onboarded: true, settings: { theme: 'system' }, favorites: [],
  players: { p_me: { id: 'p_me', name: 'Trevor' }, p_mike: { id: 'p_mike', name: 'Mike' } },
  crews: { c1: { id: 'c1', name: 'Saturday', playerIds: ['p_me', 'p_mike'] } },
  customCourses: {},
  rounds: { r1: { id: 'r1', status: 'active', players: [{ id: 'p_me' }], scores: { 1: { p_me: 4 } }, _remote: { 1: 2 } } },
  settlements: [{ id: 's1', from: 'p_mike', to: 'p_me', amount: 5 }],
  activeRoundId: 'r1',
});

test('toDocs splits state and leaves phone-only round fields out', () => {
  const d = toDocs(base());
  assert.deepEqual(Object.keys(d).sort(), ['crew:c1', 'player:p_me', 'player:p_mike', 'profile:me', 'round:r1', 'settlement:s1']);
  assert.ok(!('_remote' in d['round:r1'].data));
});

test('outgoing sends only changed docs, plus deletions', () => {
  const s = base();
  const shadow = hashAll(toDocs(s));
  assert.equal(outgoing(toDocs(s), shadow).length, 0);
  s.rounds.r1.scores[2] = { p_me: 5 };
  delete s.players.p_mike;
  const out = outgoing(toDocs(s), shadow);
  assert.deepEqual(out.map(o => [o.key, o.deleted]).sort(), [['player:p_mike', true], ['round:r1', false]]);
});

test('resolve: untouched here takes remote; both changed picks the newer edit', () => {
  assert.equal(resolve({ local: 'a', shadow: 'a', remote: 'b' }), 'take');
  assert.equal(resolve({ local: 'a', shadow: 'x', remote: 'a' }), 'same');
  assert.equal(resolve({ local: 'a', shadow: 'x', remote: 'b', localChangedAt: 200, remoteChangedAt: 100 }), 'keep');
  assert.equal(resolve({ local: 'a', shadow: 'x', remote: 'b', localChangedAt: 100, remoteChangedAt: 200 }), 'take');
  // A score entered offline is never overwritten by an older copy
  assert.equal(resolve({ local: 'new', shadow: 'old', remote: 'old2', localChangedAt: 500, remoteChangedAt: 400 }), 'keep');
});

test('applyDoc adds, replaces and deletes, keeping phone-only fields', () => {
  const s = base();
  applyDoc(s, 'round', 'r1', { id: 'r1', status: 'done', players: [], scores: {} });
  assert.equal(s.rounds.r1.status, 'done');
  assert.deepEqual(s.rounds.r1._remote, { 1: 2 });
  applyDoc(s, 'round', 'r1', null);
  assert.equal(s.rounds.r1, undefined);
  assert.equal(s.activeRoundId, null);
  applyDoc(s, 'settlement', 's2', { id: 's2', amount: 3 });
  applyDoc(s, 'settlement', 's1', null);
  assert.deepEqual(s.settlements.map(x => x.id), ['s2']);
});

test('remapId swaps a player id everywhere, keys included', () => {
  const s = remapId(base(), 'p_me', 'p_acct');
  assert.equal(s.me, 'p_acct');
  assert.ok(s.players.p_acct && !s.players.p_me);
  assert.deepEqual(s.crews.c1.playerIds, ['p_acct', 'p_mike']);
  assert.equal(s.rounds.r1.scores[1].p_acct, 4);
  assert.equal(s.settlements[0].to, 'p_acct');
});

test('a profile saved before setup finished never blanks out me', () => {
  const s = base();
  applyDoc(s, 'profile', 'me', { me: null, onboarded: false, settings: {}, favorites: [] });
  assert.equal(s.me, 'p_me');
  assert.equal(s.onboarded, true);
});
