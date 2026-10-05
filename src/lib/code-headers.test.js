// Every request for a table that names a round's, plan's or challenge's code carries that code in a
// header (supabase/2026-10-06-round-codes.sql shows a request only the rows its header names), and
// a plan or challenge write pokes its channel, since table changes stop reaching phones there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_HEADER, planSupabaseAdapter } from './plan-adapters.js';
import { CHALLENGE_HEADER, challengeSupabaseAdapter } from './challenge-adapters.js';
import { TAB_HEADER, supabaseTab } from './tab-adapters.js';

const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));

// A stand-in client that records each request's table and headers, and the pokes sent
function fakeDb(rows = {}) {
  const requests = [];
  const pokes = [];
  const channels = [];
  class Query {
    constructor(table) { Object.assign(this, { table, headers: {}, op: 'select' }); }
    select() { return this; }
    insert() { this.op = 'insert'; return this; }
    upsert() { this.op = 'upsert'; return this; }
    update() { this.op = 'update'; return this; }
    delete() { this.op = 'delete'; return this; }
    eq() { return this; }
    in(k, v) { this.inList = v; return this; }
    maybeSingle() { this.single = true; return this; }
    setHeader(k, v) { this.headers = { ...this.headers, [k.toLowerCase()]: v }; return this; }
    then(res, rej) {
      requests.push({ table: this.table, op: this.op, headers: this.headers, inList: this.inList });
      const data = rows[this.table] || [];
      return Promise.resolve({ data: this.single ? data[0] || null : data, error: null }).then(res, rej);
    }
  }
  const db = {
    from: t => new Query(t),
    channel(name) {
      const ch = {
        name, handlers: [],
        on(kind, filter, fn) { this.handlers.push({ kind, filter, fn }); return this; },
        subscribe(fn) { setTimeout(() => fn?.('SUBSCRIBED'), 0); return this; },
        send(msg) { pokes.push({ name, via: 'channel', event: msg.event }); return Promise.resolve('ok'); },
        httpSend(event) { pokes.push({ name, via: 'http', event }); return Promise.resolve({ success: true }); },
        broadcast(event) { this.handlers.filter(x => x.kind === 'broadcast' && x.filter.event === event).forEach(x => x.fn({})); },
      };
      channels.push(ch);
      return ch;
    },
    removeChannel() { return Promise.resolve('ok'); },
  };
  return { db, requests, pokes, channels };
}

test('every plan request names the plan in x-plan-code, and its writes poke the plan', async () => {
  const s = fakeDb({ planned_rounds: [{ meta: { name: 'Sat' } }] });
  const a = planSupabaseAdapter(s.db);
  await a.create('PLAN01', { name: 'Sat' });
  await a.updateMeta('PLAN01', { name: 'Sun' });
  await a.fetch('PLAN01');
  await a.setRsvp('PLAN01', { who: 'dave', name: 'Dave', status: 'in' });
  await a.setVote('PLAN01', 'dave', 'game', 'skins');
  await a.setVote('PLAN01', 'dave', 'game', null);
  await a.remove('PLAN01');
  assert.ok(s.requests.length >= 8);
  for (const r of s.requests) assert.equal(r.headers[PLAN_HEADER], 'PLAN01', `${r.op} ${r.table}`);
  assert.deepEqual([...new Set(s.requests.map(r => r.table))].sort(), ['plan_rsvps', 'plan_votes', 'planned_rounds']);
  assert.ok(s.pokes.length >= 5 && s.pokes.every(p => p.name === 'plan-PLAN01' && p.event === 'poke'));
});

test('a phone on a plan hears a poke as a change, and pokes over its open channel', async () => {
  const s = fakeDb();
  const a = planSupabaseAdapter(s.db);
  const heard = [];
  const stop = a.subscribe('PLAN01', ev => heard.push(ev.type));
  await wait();
  s.channels[0].broadcast('poke');
  assert.deepEqual(heard, ['connected', 'changed']);
  await a.setRsvp('PLAN01', { who: 'dave', name: 'Dave', status: 'in' });
  assert.deepEqual(s.pokes.at(-1), { name: 'plan-PLAN01', via: 'channel', event: 'poke' });
  stop();
});

test('every challenge request names the challenge (or its plan), and its writes poke both', async () => {
  const s = fakeDb({ challenges: [{ code: 'CHAL01', meta: {} }, { code: 'CHAL02', meta: {} }], challenge_moves: [] });
  const a = challengeSupabaseAdapter(s.db);
  await a.create('CHAL01', 'PLAN01', { stake: 5 });
  await a.addMove('CHAL01', 'PLAN01', { id: 'm1', side: 'to', move: 'accept', at: 1 });
  await a.fetch('CHAL01');
  const byPlan = s.requests.length;
  await a.fetchForPlan('PLAN01');
  for (const r of s.requests.slice(0, byPlan)) assert.equal(r.headers[CHALLENGE_HEADER], 'CHAL01', `${r.op} ${r.table}`);
  const [list, moves] = s.requests.slice(byPlan);
  assert.equal(list.headers[PLAN_HEADER], 'PLAN01');
  assert.equal(moves.headers[PLAN_HEADER], 'PLAN01');
  assert.equal(moves.headers[CHALLENGE_HEADER], 'CHAL01,CHAL02');
  assert.deepEqual([...new Set(s.pokes.map(p => p.name))].sort(), ['challenge-CHAL01', 'challenge-PLAN01']);
});

test('the Tab reads its rounds\' payments with their codes in x-round-code, a hundred at a time, and writes one with its code', async () => {
  const s = fakeDb({ round_payments: [] });
  const a = supabaseTab(s.db);
  const codes = Array.from({ length: 150 }, (_, i) => `C${String(i).padStart(5, '0')}`);
  await a.fetchRows(codes);
  assert.equal(s.requests.length, 2);
  assert.deepEqual(s.requests.map(r => r.headers[TAB_HEADER].split(',')), [codes.slice(0, 100), codes.slice(100)]);
  assert.deepEqual(s.requests.map(r => r.inList), [codes.slice(0, 100), codes.slice(100)]);
  await a.upsertRow({ code: 'AAAAAA', id: 'p1', kind: 'payment', from: 'a', to: 'b', amount: 5, status: 'paid' });
  assert.equal(s.requests.at(-1).headers[TAB_HEADER], 'AAAAAA');
});
