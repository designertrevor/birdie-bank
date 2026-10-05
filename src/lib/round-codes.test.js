// A round is read only with its code (supabase/2026-10-06-round-codes.sql): every request the app
// makes for live_rounds and live_holes names the round in the x-round-code header, against a server
// that ignores it (before the SQL) and one that shows a request only the round it names (after).
// Realtime can't see headers, so phones hear each other by a poke on the round's channel and a check
// while the round is open; on the open server table changes still come through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE_HEADER, supabaseAdapter } from './sync-adapters.js';

const wait = (ms = 5) => new Promise(r => setTimeout(r, ms));

// A stand-in for the Supabase client: tables in memory, the policy either open or by header, and
// realtime channels that a test can push table changes and broadcasts through
function fakeServer({ locked }) {
  const rounds = new Map(); // code -> meta
  const holes = new Map(); // `${code}:${no}` -> data
  const requests = [];
  const channels = [];
  const sees = (headers, code) => !locked || headers[CODE_HEADER] === code;

  class Query {
    constructor(table) { Object.assign(this, { table, op: 'select', filters: {}, headers: {}, ret: false }); }
    select() { if (this.op !== 'select') this.ret = true; return this; }
    insert(rows) { this.op = 'insert'; this.rows = [].concat(rows); return this; }
    upsert(rows) { this.op = 'upsert'; this.rows = [].concat(rows); return this; }
    update(patch) { this.op = 'update'; this.patch = patch; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(k, v) { this.filters[k] = v; return this; }
    maybeSingle() { this.single = true; return this; }
    setHeader(k, v) { this.headers = { ...this.headers, [k.toLowerCase()]: v }; return this; }
    // A slow read (server.slow ms) reads the server when it's sent and answers late, the way a slow network does
    then(res, rej) {
      if (this.op === 'select' && server.slow) { const out = this.run(); return new Promise(r => setTimeout(() => r(out), server.slow)).then(res, rej); }
      return Promise.resolve().then(() => this.run()).then(res, rej);
    }
    run() {
      requests.push({ table: this.table, op: this.op, code: this.filters.code ?? this.rows?.[0]?.code, header: this.headers[CODE_HEADER] });
      const h = this.headers;
      if (this.table === 'live_rounds') {
        if (this.op === 'insert') {
          for (const r of this.rows) {
            if (!sees(h, r.code)) return { error: { message: 'new row violates row-level security policy' } };
            rounds.set(r.code, r.meta);
          }
          return { error: null };
        }
        const code = this.filters.code;
        const visible = code != null ? (rounds.has(code) && sees(h, code) ? [code] : []) : [...rounds.keys()].filter(c => sees(h, c));
        if (this.op === 'select') {
          const data = visible.map(c => ({ code: c, meta: rounds.get(c) }));
          return { data: this.single ? data[0] || null : data, error: null };
        }
        if (this.op === 'update') { visible.forEach(c => rounds.set(c, this.patch.meta)); return { data: visible.map(c => ({ meta: rounds.get(c) })), error: null }; }
        if (this.op === 'delete') { visible.forEach(c => rounds.delete(c)); return { error: null }; }
      }
      if (this.table === 'live_holes') {
        if (this.op === 'upsert') {
          for (const r of this.rows) if (!sees(h, r.code)) return { error: { message: 'new row violates row-level security policy' } };
          for (const r of this.rows) holes.set(`${r.code}:${r.hole_no}`, r.data);
          return { data: this.rows.map(r => ({ hole_no: r.hole_no, data: r.data })), error: null };
        }
        const code = this.filters.code;
        const data = [...holes].map(([k, data]) => { const [c, no] = k.split(':'); return { code: c, hole_no: Number(no), data }; })
          .filter(x => x.code === code && sees(h, code) && (this.filters.hole_no == null || x.hole_no === this.filters.hole_no))
          .map(({ hole_no, data }) => ({ hole_no, data }));
        return { data, error: null };
      }
      return { error: { message: 'unknown' } };
    }
  }

  function channel(name) {
    const have = channels.find(c => c.name === name && !c.removed);
    if (have) return have;
    const ch = {
      name, handlers: [], sent: [], removed: false, status: null,
      on(kind, filter, fn) { this.handlers.push({ kind, filter, fn }); return this; },
      subscribe(fn) { this.status = fn; setTimeout(() => fn('SUBSCRIBED'), 0); return this; },
      send(msg) { this.sent.push(msg); return Promise.resolve('ok'); },
      httpSend(event, payload) { this.sent.push({ http: true, event, payload }); return Promise.resolve({ success: true }); },
      // What the realtime server would push to this phone
      table(table, p) { this.handlers.filter(x => x.kind === 'postgres_changes' && x.filter.table === table).forEach(x => x.fn(p)); },
      broadcast(event, payload) { this.handlers.filter(x => x.kind === 'broadcast' && x.filter.event === event).forEach(x => x.fn({ payload })); },
    };
    channels.push(ch);
    return ch;
  }
  const db = {
    from: t => new Query(t),
    channel,
    removeChannel: ch => { ch.removed = true; return Promise.resolve('ok'); },
  };
  const server = { db, rounds, holes, requests, channels, slow: 0 };
  return server;
}

for (const locked of [false, true]) {
  const server = locked ? 'the locked server' : 'the open server';

  test(`${server}: sharing, reading, scoring and stopping all name the round's code`, async () => {
    const s = fakeServer({ locked });
    const a = supabaseAdapter(s.db, { pollMs: 0 });
    await a.create('ABCDEF', { id: 'r1', status: 'active' }, { 1: { s: { me: 4 } } });
    await a.upsertMeta('ABCDEF', { id: 'r1', status: 'active', note: 'x' });
    await a.upsertHole('ABCDEF', 2, { s: { me: 5 } });
    await a.upsertHole('ABCDEF', -77, { request: { name: 'Al', status: 'waiting' } }); // a seat request
    const got = await a.fetch('ABCDEF');
    assert.deepEqual(got, { meta: { id: 'r1', status: 'active', note: 'x' }, holes: { 1: { s: { me: 4 } }, 2: { s: { me: 5 } }, '-77': { request: { name: 'Al', status: 'waiting' } } } });
    await a.remove('ABCDEF');
    assert.equal(await a.fetch('ABCDEF'), null);
    assert.ok(s.requests.length >= 8);
    for (const r of s.requests) assert.equal(r.header, 'ABCDEF', `${r.op} ${r.table} names the code`);
  });

  test(`${server}: a round shared under one code is never read with another`, async () => {
    const s = fakeServer({ locked });
    const a = supabaseAdapter(s.db, { pollMs: 0 });
    await a.create('ABCDEF', { id: 'r1' }, {});
    await a.create('GHJKMN', { id: 'r2' }, {});
    assert.equal((await a.fetch('ABCDEF')).meta.id, 'r1');
    assert.equal((await a.fetch('GHJKMN')).meta.id, 'r2');
    assert.equal(await a.fetch('ZZZZZZ'), null);
  });

  test(`${server}: a write pokes the other phones, and a poke brings the server's copy`, async () => {
    const s = fakeServer({ locked });
    const keeper = supabaseAdapter(s.db, { pollMs: 0 });
    await keeper.create('ABCDEF', { id: 'r1', v: 1 }, {});
    // Another phone: the same tables, its own realtime connection
    const other = fakeServer({ locked });
    const phone = supabaseAdapter({ ...s.db, channel: other.db.channel, removeChannel: other.db.removeChannel }, { pollMs: 0 });
    const heard = [];
    phone.subscribe('ABCDEF', ev => heard.push(ev));
    await wait();
    assert.deepEqual(heard, [{ type: 'connected' }]);

    // The keeper isn't listening, so its poke goes over HTTP
    await keeper.upsertHole('ABCDEF', 3, { s: { me: 3 } });
    const pokes = s.channels.flatMap(c => c.sent);
    assert.deepEqual(pokes.at(-1), { http: true, event: 'poke', payload: { kind: 'hole', holeNo: 3 } });
    // Never the scores themselves
    assert.ok(pokes.every(p => !('data' in (p.payload || {}))));

    // What the realtime server hands the other phone: it fetches hole 3 with the code
    const ch = other.channels.find(c => c.name === 'live-ABCDEF');
    ch.broadcast('poke', { kind: 'hole', holeNo: 3 });
    await wait();
    assert.deepEqual(heard.at(-1), { type: 'hole', holeNo: 3, data: { s: { me: 3 } } });
    await keeper.upsertMeta('ABCDEF', { id: 'r1', v: 2 });
    ch.broadcast('poke', { kind: 'meta' });
    await wait();
    assert.deepEqual(heard.at(-1), { type: 'meta', data: { id: 'r1', v: 2 } });
    // A stop is checked: only once the round is really gone does the round end
    ch.broadcast('poke', { kind: 'deleted' });
    await wait();
    assert.notEqual(heard.at(-1).type, 'deleted');
    await keeper.remove('ABCDEF');
    ch.broadcast('poke', { kind: 'deleted' });
    await wait();
    assert.deepEqual(heard.at(-1), { type: 'deleted' });
  });
}

test('a phone listening on the round pokes through its open channel, and hears its own write back', async () => {
  const s = fakeServer({ locked: true });
  const a = supabaseAdapter(s.db, { pollMs: 0 });
  await a.create('ABCDEF', { id: 'r1', v: 1 }, {});
  const heard = [];
  a.subscribe('ABCDEF', ev => heard.push(ev));
  await wait();
  await a.upsertMeta('ABCDEF', { id: 'r1', v: 2 });
  await a.upsertHole('ABCDEF', 1, { s: { me: 4 } });
  await wait();
  const ch = s.channels.find(c => c.name === 'live-ABCDEF' && !c.removed);
  assert.deepEqual(ch.sent, [
    { type: 'broadcast', event: 'poke', payload: { kind: 'meta' } },
    { type: 'broadcast', event: 'poke', payload: { kind: 'hole', holeNo: 1 } },
  ]);
  // As a table change would have told it: the server's copy, after the write
  assert.deepEqual(heard.slice(1), [{ type: 'meta', data: { id: 'r1', v: 2 } }, { type: 'hole', holeNo: 1, data: { s: { me: 4 } } }]);
});

test('the echo comes after the write has returned, the way a table change arrives', async () => {
  const s = fakeServer({ locked: true });
  const a = supabaseAdapter(s.db, { pollMs: 0 });
  await a.create('ABCDEF', { v: 1 }, {});
  const order = [];
  a.subscribe('ABCDEF', ev => { if (ev.type === 'meta') order.push('heard'); });
  await wait();
  await a.upsertMeta('ABCDEF', { v: 2 });
  order.push('returned');
  await wait();
  assert.deepEqual(order, ['returned', 'heard']);
});

test('everything listening to one round shares one channel, and one stopping leaves the others', async () => {
  const s = fakeServer({ locked: false });
  const a = supabaseAdapter(s.db, { pollMs: 0 });
  const one = [], two = [];
  const stopOne = a.subscribe('ABCDEF', ev => one.push(ev.type));
  await wait();
  const stopTwo = a.subscribe('ABCDEF', ev => two.push(ev.type));
  await wait();
  assert.equal(s.channels.filter(c => c.name === 'live-ABCDEF').length, 1);
  assert.deepEqual([one, two], [['connected'], ['connected']]);
  stopOne();
  const ch = s.channels[0];
  assert.equal(ch.removed, false);
  ch.table('live_rounds', { eventType: 'UPDATE', new: { code: 'ABCDEF', meta: { v: 3 } } });
  assert.deepEqual([one, two], [['connected'], ['connected', 'meta']]);
  stopTwo();
  assert.equal(ch.removed, true);
});

test('the open server: table changes still come through, and a delete is checked before the round ends', async () => {
  const s = fakeServer({ locked: false });
  const a = supabaseAdapter(s.db, { pollMs: 0 });
  await a.create('ABCDEF', { v: 1 }, {});
  const heard = [];
  a.subscribe('ABCDEF', ev => heard.push(ev));
  await wait();
  const ch = s.channels.find(c => c.name === 'live-ABCDEF');
  ch.table('live_holes', { eventType: 'INSERT', new: { code: 'ABCDEF', hole_no: 4, data: { s: { me: 2 } } } });
  ch.table('live_rounds', { eventType: 'UPDATE', new: { code: 'ABCDEF', meta: { v: 2 } } });
  assert.deepEqual(heard.slice(1), [{ type: 'hole', holeNo: 4, data: { s: { me: 2 } } }, { type: 'meta', data: { v: 2 } }]);
  // Another round's delete (deletes come with only the code) never ends this one
  ch.table('live_rounds', { eventType: 'DELETE', old: { code: 'ZZZZZZ' } });
  ch.table('live_rounds', { eventType: 'DELETE', old: { code: 'ABCDEF' } }); // still there on the server
  await wait();
  assert.ok(!heard.some(e => e.type === 'deleted'));
  s.rounds.delete('ABCDEF');
  ch.table('live_rounds', { eventType: 'DELETE', old: { code: 'ABCDEF' } });
  await wait();
  assert.deepEqual(heard.at(-1), { type: 'deleted' });
});

test('the locked server: with no table changes, the check while the round is open tells only what changed', async () => {
  const s = fakeServer({ locked: true });
  const a = supabaseAdapter(s.db, { pollMs: 15 });
  await a.create('ABCDEF', { v: 1 }, { 1: { s: { me: 4 } } });
  const heard = [];
  const stop = a.subscribe('ABCDEF', ev => heard.push(ev));
  await wait(40);
  // The first check tells the round as it is
  assert.deepEqual(heard.filter(e => e.type !== 'connected'), [{ type: 'meta', data: { v: 1 } }, { type: 'hole', holeNo: 1, data: { s: { me: 4 } } }]);
  heard.length = 0;
  await wait(40);
  assert.deepEqual(heard, []); // nothing changed, nothing told
  // A poke that went missing: another phone scored hole 2
  s.holes.set('ABCDEF:2', { s: { me: 5 } });
  await wait(40);
  assert.deepEqual(heard, [{ type: 'hole', holeNo: 2, data: { s: { me: 5 } } }]);
  // Gone from the server: the round ends
  s.rounds.delete('ABCDEF');
  await wait(40);
  assert.deepEqual(heard.at(-1), { type: 'deleted' });
  stop();
  const n = s.requests.length;
  await wait(40);
  assert.equal(s.requests.length, n, 'no checks after the last listener stops');
});

test('the open server: once table changes come through, the check stops', async () => {
  const s = fakeServer({ locked: false });
  const a = supabaseAdapter(s.db, { pollMs: 15 });
  await a.create('ABCDEF', { v: 1 }, {});
  const stop = a.subscribe('ABCDEF', () => {});
  await wait();
  s.channels[0].table('live_rounds', { eventType: 'UPDATE', new: { code: 'ABCDEF', meta: { v: 1 } } });
  const n = s.requests.length;
  await wait(50);
  assert.equal(s.requests.length, n);
  stop();
});

test('the join link preview reads the round with its code in the header', async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, opts = {}) => {
    seen.push({ url: String(url), headers: opts.headers || {} });
    if (String(url).endsWith('/index.html')) return new Response('<html><head><title>x</title></head></html>', { status: 200 });
    return new Response(JSON.stringify([{ meta: { game: 'skins', players: [{ id: 'a', name: 'Trevor' }] } }]), { status: 200 });
  };
  try {
    const { default: handler } = await import('../../api/join.js');
    await handler.fetch(new Request('https://example.test/api/join?code=ABCDEF'));
  } finally {
    globalThis.fetch = realFetch;
  }
  const read = seen.find(r => r.url.includes('/rest/v1/live_rounds'));
  assert.ok(read, 'it reads the round');
  assert.equal(read.headers['x-round-code'], 'ABCDEF');
  assert.match(read.url, /code=eq\.ABCDEF/);
});

// A poke's fetch that is still out when a newer change to the same hole lands must never be told last
async function pokeRace(locked) {
  const s = fakeServer({ locked });
  const a = supabaseAdapter(s.db, { pollMs: 0 });
  await a.create('ABCDEF', { v: 1 }, { 7: { s: { me: 4 } } });
  const told = [];
  const stop = a.subscribe('ABCDEF', ev => { if (ev.type === 'hole' && ev.holeNo === 7) told.push(ev.data.s.me); });
  await wait();
  const ch = s.channels[0];
  // On the open server table changes are already coming through
  if (!locked) ch.table('live_holes', { eventType: 'UPDATE', new: { code: 'ABCDEF', hole_no: 1, data: { s: {} } } });
  s.slow = 30;
  ch.broadcast('poke', { kind: 'hole', holeNo: 7 }); // the keeper wrote 4, and this fetch is slow
  await wait();
  s.slow = 0;
  s.holes.set('ABCDEF:7', { s: { me: 5 } }); // the keeper corrects it to 5
  if (!locked) ch.table('live_holes', { eventType: 'UPDATE', new: { code: 'ABCDEF', hole_no: 7, data: { s: { me: 5 } } } });
  else ch.broadcast('poke', { kind: 'hole', holeNo: 7 });
  await wait(60);
  stop();
  return told;
}

test('the open server: a slow poke fetch never lands after a newer table change, and pokes are left to the table changes', async () => {
  assert.deepEqual(await pokeRace(false), [5]);
});

test('the locked server: a slow poke fetch overtaken by a newer poke for the same hole is dropped', async () => {
  assert.deepEqual(await pokeRace(true), [5]);
});

test('the locked server: the check still heals a hole whose poke went missing, and leaves a part heard about meanwhile', async () => {
  const s = fakeServer({ locked: true });
  const a = supabaseAdapter(s.db, { pollMs: 20 });
  await a.create('ABCDEF', { v: 1 }, { 7: { s: { me: 4 } } });
  const told = [];
  const stop = a.subscribe('ABCDEF', ev => { if (ev.type === 'hole') told.push([ev.holeNo, ev.data.s.me]); });
  await wait(30);
  assert.deepEqual(told, [[7, 4]]);
  // A missed poke: the check heals it
  s.holes.set('ABCDEF:7', { s: { me: 5 } });
  await wait(30);
  assert.deepEqual(told.at(-1), [7, 5]);
  // A slow check reads 6, then a poke for 7 brings the newer 3 first: the check's 6 is dropped
  told.length = 0;
  s.holes.set('ABCDEF:7', { s: { me: 6 } });
  s.slow = 15;
  await wait(12);
  s.slow = 0;
  s.holes.set('ABCDEF:7', { s: { me: 3 } });
  s.channels[0].broadcast('poke', { kind: 'hole', holeNo: 7 });
  await wait(10);
  stop();
  assert.equal(told.at(-1)[1], 3);
});
