// Sending challenges (challenge-push.js): one code per challenge however many times it's tried, a
// move made while the challenge is on its way still goes up, and only the moves sent come off the
// unsent list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeMeta, planCodeOf, pushChallenge, pushMoves } from './challenge-push.js';
import { newChallenge, withMove } from './challenges.js';

const dave = { who: 'dave', name: 'Dave Smith' };
const mike = { who: 'mike', name: 'Mike Jones' };

/** A store like store.js: update gets a copy it can change. */
function store(init) {
  let state = structuredClone(init);
  return { getState: () => state, update: fn => { const d = structuredClone(state); fn(d); state = d; } };
}

/** A server that remembers what it got, and can wait (or fail) on a call. */
function server({ failCreate = 0, hold = null } = {}) {
  const made = new Map();
  const moves = [];
  let fails = failCreate;
  return {
    made, moves,
    async create(code, planCode, meta) {
      if (fails > 0) { fails--; throw new Error('No signal'); }
      if (!made.has(code)) made.set(code, { planCode, meta });
      if (hold) await hold;
    },
    async addMove(code, planCode, m) { if (!made.has(code)) throw new Error('No challenge'); if (!moves.some(x => x.code === code && x.id === m.id)) moves.push({ code, ...m }); },
  };
}

const challenge = () => ({ ...newChallenge({ id: 'c1', from: dave, to: mike, kind: 'match', stake: 20, now: 1000 }), mine: 'from', made: true, code: null, unsent: true });
let codes = 0;
const newCode = () => `CODE0${++codes}`;

test('a challenge that fails to go up tries again under the same code, so the server never gets two', async () => {
  const s = store({ challenges: { c1: challenge() } });
  const adapter = server({ failCreate: 1 });
  await assert.rejects(pushChallenge({ ...s, adapter, newCode }, 'c1'));
  const code = s.getState().challenges.c1.pendingCode;
  assert.ok(code);
  assert.equal(s.getState().challenges.c1.code, null);
  assert.equal(await pushChallenge({ ...s, adapter, newCode }, 'c1'), true);
  assert.equal(adapter.made.size, 1);
  assert.equal(s.getState().challenges.c1.code, code);
  assert.equal('pendingCode' in s.getState().challenges.c1, false);
  assert.equal('unsent' in s.getState().challenges.c1, false);
});

test('two refreshes sending the same challenge at once send it once', async () => {
  const s = store({ challenges: { c1: challenge() } });
  const adapter = server();
  await Promise.all([pushChallenge({ ...s, adapter, newCode }, 'c1'), pushChallenge({ ...s, adapter, newCode }, 'c1')]);
  assert.equal(adapter.made.size, 1);
});

test('a move made while the challenge is on its way is kept unsent and goes up next time', async () => {
  let release;
  const hold = new Promise(r => { release = r; });
  const s = store({ challenges: { c1: challenge() } });
  const adapter = server({ hold });
  const going = pushChallenge({ ...s, adapter, newCode }, 'c1');
  // Dave marks Mike's answer while it's still going up (no code yet, so it rides with the challenge)
  await Promise.resolve();
  s.update(st => { st.challenges.c1 = withMove(st.challenges.c1, { id: 'm1', side: 'to', move: 'accept', at: 2000 }); });
  release();
  await going;
  const c = s.getState().challenges.c1;
  assert.deepEqual(c.unsentMoves, { m1: true });
  assert.equal(adapter.moves.length, 0);
  await pushMoves({ ...s, adapter }, 'c1');
  assert.deepEqual(adapter.moves.map(m => m.id), ['m1']);
  assert.equal('unsentMoves' in s.getState().challenges.c1, false);
});

test('pushMoves takes off only what it sent', async () => {
  const ch = { ...withMove(challenge(), { id: 'm1', side: 'to', move: 'counter', stake: 10, at: 2000 }), code: 'ABCDEF', unsent: undefined, unsentMoves: { m1: true } };
  const s = store({ challenges: { c1: ch } });
  const adapter = server();
  adapter.made.set('ABCDEF', {});
  const slow = { ...adapter, async addMove(code, planCode, m) {
    await adapter.addMove(code, planCode, m);
    // Another move comes in while this one is going up
    s.update(st => { st.challenges.c1 = { ...withMove(st.challenges.c1, { id: 'm2', side: 'from', move: 'accept', at: 3000 }), unsentMoves: { ...st.challenges.c1.unsentMoves, m2: true } }; });
  } };
  await pushMoves({ ...s, adapter: slow }, 'c1');
  assert.deepEqual(s.getState().challenges.c1.unsentMoves, { m2: true });
});

test('what goes up: the shared part only, its plan by code; nothing local', () => {
  const ch = { ...challenge(), pendingCode: 'XYZ', unsentMoves: { a: true }, syncedAt: 5, plan: { id: 'pl1', code: 'PLAN01', date: '2026-10-10' } };
  const meta = challengeMeta(ch);
  for (const k of ['code', 'pendingCode', 'mine', 'made', 'unsent', 'unsentMoves', 'syncedAt', 'moves']) assert.equal(k in meta, false, k);
  assert.deepEqual(meta.plan, { code: 'PLAN01', date: '2026-10-10' });
  assert.equal(planCodeOf({ plans: {} }, { plan: null }), null);
  assert.equal(planCodeOf({ plans: { pl1: { id: 'pl1' } } }, { plan: { id: 'pl1', code: null } }), undefined);
});
