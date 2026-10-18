// Weak signal and double taps: scores and payments sent twice (a retry after a lost reply, a queue
// flushed again) are still one record, a double tap pays once, and rows queued offline survive
// and go out in order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRound } from './round.js';
import { outstanding, tabBalances } from './ledger.js';
import { allocatePayment, applyRows } from './shared-tab.js';
import { dropSent, flushQueue, queueRows, rowKey } from './tab-queue.js';
import { tapOnce } from './tap-once.js';
import { supabaseAdapter } from './sync-adapters.js';
import { applyHole, assemble, buildHole } from './sync-model.js';

const NOW = Date.UTC(2026, 8, 28, 18);
const DAY = 864e5;
const SETTINGS = { hcPct: 100, skins: { value: 2, carryover: true } };
const flat9 = { id: 'f9', name: 'Flat Nine', city: 'Town', tees: [], holes: Array.from({ length: 9 }, (_, i) => ({ par: 4, hdcp: i + 1 })) };

/** A finished, shared 9-hole skins round where B lost one $2 skin to A. */
function sharedRound() {
  const r = createRound({ id: 'r1', game: 'skins', course: flat9, holesCount: 9, players: [{ id: 'a', name: 'A', index: 0 }, { id: 'b', name: 'B', index: 0 }], settings: SETTINGS, hcPct: 100, useHandicaps: false });
  for (const h of r.holes) r.scores[h.no] = { a: 4, b: 4 };
  r.scores[1] = { a: 3, b: 4 };
  r.status = 'done';
  r.finishedAt = NOW - DAY;
  r.shareCode = 'AAAAAA';
  return r;
}
const stateOf = () => ({ me: 'a', players: {}, rounds: { r1: sharedRound() }, settlements: [], carries: [], tabRows: {} });
const row = (over = {}) => ({ code: 'AAAAAA', id: 'AAAAAA:b>a', kind: 'payment', from: 'b', to: 'a', amount: 2, status: 'paid', by: 'b', reason: null, at: NOW, updatedAt: NOW, ...over });

/** A stand-in for the server's round_payments table: one row per code and id, as an upsert keeps it. */
function paymentsServer({ loseReplies = 0, offline = false } = {}) {
  const rows = new Map();
  const sent = [];
  let lose = loseReplies;
  return {
    rows, sent,
    set offline(v) { offline = v; },
    async upsertRow(r) {
      if (offline) throw new TypeError('Load failed');
      rows.set(rowKey(r), r);
      sent.push(r.id);
      // The write landed, but the phone lost signal before the answer came back
      if (lose > 0) { lose--; throw new TypeError('Load failed'); }
    },
  };
}

/** The queue as it's saved on the phone (a JSON string), so a reload reads it back. */
function savedQueue(initial = []) {
  let json = JSON.stringify(initial);
  return { read: () => JSON.parse(json), write: q => { json = JSON.stringify(q); }, get json() { return json; } };
}

// --------------------------- the shared Tab's queue ---------------------------

test('queuing the same row twice leaves one copy waiting, the newer one', () => {
  let q = queueRows([], [row()]);
  q = queueRows(q, [row({ updatedAt: NOW + 5 })]);
  assert.equal(q.length, 1);
  assert.equal(q[0].updatedAt, NOW + 5);
  // A row sent while a newer copy was queued stays, so the newer copy still goes
  assert.equal(dropSent(q, row()).length, 1);
  assert.equal(dropSent(q, row({ updatedAt: NOW + 5 })).length, 0);
});

test('a payment sent again after the reply was lost is still one row on the server', async () => {
  const server = paymentsServer({ loseReplies: 1 });
  const store = savedQueue(queueRows([], [row()]));
  const flush = () => flushQueue({ read: store.read, write: store.write, send: r => server.upsertRow(r) });
  assert.equal(await flush(), false);
  // The server has it, but the phone doesn't know: it stays queued
  assert.equal(server.rows.size, 1);
  assert.equal(store.read().length, 1);
  assert.equal(await flush(), true);
  assert.equal(server.sent.length, 2);
  assert.equal(server.rows.size, 1);
  assert.equal(store.read().length, 0);
});

test('rows queued with no signal survive a reload and go out in the order they were made', async () => {
  const server = paymentsServer({ offline: true });
  let store = savedQueue();
  store.write(queueRows(store.read(), [row({ id: 'AAAAAA:b>a' })]));
  store.write(queueRows(store.read(), [row({ id: 'AAAAAA:b>a:p200', amount: 1 })]));
  store.write(queueRows(store.read(), [row({ id: 'AAAAAA:a>b:carry', kind: 'carry', status: 'asked' })]));
  const send = r => server.upsertRow(r);
  assert.equal(await flushQueue({ read: store.read, write: store.write, send }), false);
  assert.equal(store.read().length, 3);
  // The app closes and opens again: the queue is read back from what was saved
  store = savedQueue(JSON.parse(store.json));
  server.offline = false;
  assert.equal(await flushQueue({ read: store.read, write: store.write, send }), true);
  assert.deepEqual(server.sent, ['AAAAAA:b>a', 'AAAAAA:b>a:p200', 'AAAAAA:a>b:carry']);
  assert.equal(store.read().length, 0);
});

test('signal dropping partway stops the queue there, keeping the rest in order', async () => {
  const sent = [];
  let n = 0;
  const store = savedQueue(['x1', 'x2', 'x3'].map(id => row({ id })));
  const send = async r => { if (++n === 2) throw new TypeError('Load failed'); sent.push(r.id); };
  assert.equal(await flushQueue({ read: store.read, write: store.write, send }), false);
  assert.deepEqual(store.read().map(r => r.id), ['x2', 'x3']);
  assert.equal(await flushQueue({ read: store.read, write: store.write, send }), true);
  assert.deepEqual(sent, ['x1', 'x2', 'x3']);
});

test('a row the server refuses for good is dropped and the rest still go', async () => {
  const sent = [];
  const store = savedQueue(['x1', 'bad', 'x3'].map(id => row({ id })));
  const send = async r => { if (r.id === 'bad') throw Object.assign(new Error('check'), { bad: true }); sent.push(r.id); };
  assert.equal(await flushQueue({ read: store.read, write: store.write, send, skip: e => !!e.bad }), true);
  assert.deepEqual(sent, ['x1', 'x3']);
  assert.equal(store.read().length, 0);
});

// --------------------------- payments counted once ---------------------------

test('a payment row that arrives twice (or twice in one batch) counts once', () => {
  const s = stateOf();
  assert.equal(outstanding(s).length, 1);
  const once = applyRows(s, [row(), row()]);
  assert.equal(once.settlements.length, 1);
  const twice = applyRows(once, [row()]);
  assert.deepEqual(twice.settlements, once.settlements);
  assert.equal(outstanding(twice).length, 0);
  assert.equal(tabBalances(twice).a || 0, 0);
  assert.equal(tabBalances(twice).b || 0, 0);
});

test('both phones marking the same payment, sent twice each, land on one row and count once', async () => {
  const server = paymentsServer({ loseReplies: 1 });
  const s = stateOf();
  // Each phone works out the same payment on its own before they hear from each other
  const mine = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW });
  const theirs = allocatePayment(s, { from: 'b', to: 'a', amount: 2 }, { now: NOW + 3 });
  assert.equal(mine.rows[0].id, theirs.rows[0].id);
  for (const r of [...mine.rows, ...mine.rows, ...theirs.rows]) { try { await server.upsertRow(r); } catch { /* lost reply */ } }
  assert.equal(server.rows.size, 1);
  const after = applyRows(s, [...server.rows.values()]);
  assert.equal(after.settlements.length, 1);
  assert.equal(outstanding(after).length, 0);
});

test('a double tap on "I paid" with the old amount still on the button pays once', () => {
  let state = stateOf();
  const tap = tapOnce();
  let ran = 0;
  const markPaid = (debt, now) => tap(`card:${debt.from}>${debt.to}:${Math.round(debt.amount * 100)}`, () => {
    ran++;
    const { rows, settlements } = allocatePayment(state, debt, { now, makeId: () => `t${ran}` });
    state = applyRows({ ...state, settlements: [...state.settlements, ...settlements] }, rows);
    return { shared: rows.length > 0 };
  }, now);
  const owed = { from: 'b', to: 'a', amount: 2 };
  const first = markPaid(owed, NOW);
  const second = markPaid(owed, NOW + 250);
  assert.equal(ran, 1);
  assert.equal(second, first);
  assert.equal(state.settlements.length, 1);
  assert.equal(outstanding(state).length, 0);
  // Nobody ends up owing the other the other way
  assert.equal(tabBalances(state).a || 0, 0);
  assert.equal(tabBalances(state).b || 0, 0);
});

test('the tap guard lets a later tap through, and an Undo clears it straight away', () => {
  const tap = tapOnce(1000);
  let n = 0;
  const run = () => ++n;
  assert.equal(tap('k', run, NOW), 1);
  assert.equal(tap('k', run, NOW + 999), 1);
  assert.equal(tap('other', run, NOW + 10), 2);
  assert.equal(tap('k', run, NOW + 1000), 3);
  tap.reset();
  assert.equal(tap('k', run, NOW + 1001), 4);
});

// --------------------------- live scores sent twice ---------------------------

/** A stand-in Supabase client for live_holes: one row per code and hole, as the upsert keeps it. */
function liveServer({ loseReplies = 0 } = {}) {
  const holes = new Map();
  let lose = loseReplies;
  const from = table => {
    let pending = null;
    const q = {
      upsert(r) { pending = [].concat(r); return q; },
      select() { return q; },
      eq() { return q; },
      setHeader() { return q; },
      then(ok, fail) {
        return (async () => {
          if (table !== 'live_holes' || !pending) return { data: [], error: null };
          for (const r of pending) holes.set(`${r.code}:${r.hole_no}`, r);
          if (lose > 0) { lose--; throw new TypeError('Load failed'); }
          return { data: pending.map(r => ({ hole_no: r.hole_no, data: r.data })), error: null };
        })().then(ok, fail);
      },
    };
    return q;
  };
  return { holes, db: { from, channel: () => ({ httpSend: async () => {} }), removeChannel: () => {} } };
}

test('a hole scored offline and sent again after a lost reply is one record, with the same scores', async () => {
  const server = liveServer({ loseReplies: 1 });
  const live = supabaseAdapter(server.db, { pollMs: 0 });
  const meta = { id: 'r1', holes: [1, 2].map(no => ({ no, par: 4, rank: no })), players: [{ id: 'a', name: 'A', plays: 0 }, { id: 'b', name: 'B', plays: 0 }], game: 'skins', settings: {} };
  const round = assemble(meta, {});
  round.scores[1] = { a: 3, b: 4 };
  const data = buildHole(round, 0);
  await assert.rejects(live.upsertHole('CODE12', 1, data));
  await live.upsertHole('CODE12', 1, data);
  await live.upsertHole('CODE12', 1, data);
  assert.equal(server.holes.size, 1);
  // Another phone applying that hole as many times as it hears it ends up with the same scores
  const other = assemble(meta, {});
  for (let i = 0; i < 3; i++) applyHole(other, 1, server.holes.get('CODE12:1').data);
  assert.deepEqual(other.scores, { 1: { a: 3, b: 4 } });
  assert.equal(other.presses.length, 0);
});
