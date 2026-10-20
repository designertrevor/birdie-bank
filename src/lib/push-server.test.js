import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createECDH } from 'node:crypto';
import { handlePush, handleTee, payloadGroups, pushConfig } from './push-server.js';
import { cleanPushRequest } from './push-events.js';

const b64u = b => Buffer.from(b).toString('base64url');
const vapid = createECDH('prime256v1');
vapid.generateKeys();
const ENV = {
  VAPID_PRIVATE_KEY: vapid.getPrivateKey('base64url'),
  VAPID_SUBJECT: 'mailto:hello@example.com',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  VITE_SUPABASE_URL: 'https://db.example.co/',
  VITE_SUPABASE_ANON_KEY: 'anon',
};

function sub(user, host = 'fcm.googleapis.com') {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  return { to_user: user, push_endpoint: `https://${host}/send/${user}`, push_p256dh: b64u(ua.getPublicKey()), push_auth: b64u(Buffer.alloc(16, 3)) };
}

/** A fake network: Supabase's user check and RPCs, and push services answering `status` per endpoint. */
function fakeFetch({ user = 'u-caller', rows = [], status = {}, rpcs = {} } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init });
    const u = String(url);
    const json = body => ({ ok: true, status: 200, json: async () => body });
    if (u.endsWith('/auth/v1/user')) return init.headers.Authorization === 'Bearer good' ? json({ id: user }) : { ok: false, status: 401, json: async () => ({}) };
    if (u.includes('/rest/v1/rpc/')) {
      const name = u.split('/rest/v1/rpc/')[1];
      if (name in rpcs) return rpcs[name] === 404 ? { ok: false, status: 404, json: async () => ({}) } : json(rpcs[name]);
      return json(rows);
    }
    if (u.includes('/rest/v1/push_subscriptions')) return { ok: true, status: 204 };
    const s = status[u] ?? 201;
    return { ok: s < 300, status: s };
  };
  fn.calls = calls;
  return fn;
}

const req = cleanPushRequest({ kind: 'rsvp', scope: 'plan', code: 'AB12CD', data: { name: 'Dalton', status: 'in' } });

test('push is off, sending nothing, until every key is set', async () => {
  assert.equal(pushConfig({}), null);
  assert.equal(pushConfig({ ...ENV, VAPID_PRIVATE_KEY: '' }), null);
  assert.equal(pushConfig({ ...ENV, SUPABASE_SERVICE_ROLE_KEY: '' }), null);
  assert.equal(pushConfig({ ...ENV, VAPID_SUBJECT: '' }), null);
  const f = fakeFetch();
  assert.deepEqual(await handlePush(null, 'good', req, f), { status: 204, sent: 0 });
  assert.equal(f.calls.length, 0);
});

test('an app built with a different public key turns push off rather than send pushes browsers drop', () => {
  assert.ok(pushConfig({ ...ENV, VITE_VAPID_PUBLIC_KEY: vapid.getPublicKey('base64url') }));
  assert.equal(pushConfig({ ...ENV, VITE_VAPID_PUBLIC_KEY: 'someone-elses' }), null);
});

test('the caller must be signed in, and a bad request is refused before anything is looked up', async () => {
  const cfg = pushConfig(ENV);
  const f = fakeFetch({ rows: [sub('u-host')] });
  assert.equal((await handlePush(cfg, 'forged', req, f)).status, 401);
  assert.equal((await handlePush(cfg, '', req, f)).status, 401);
  assert.equal((await handlePush(cfg, 'good', null, f)).status, 400);
  assert.ok(f.calls.every(c => !String(c.url).includes('/rpc/')));
});

test('the database picks who gets it, for the caller it checked, with the kind\'s own audience', async () => {
  const cfg = pushConfig(ENV);
  const f = fakeFetch({ user: 'u-dalton', rows: [sub('u-host')] });
  const r = await handlePush(cfg, 'good', req, f);
  assert.deepEqual(r, { status: 204, sent: 1 });
  const rpc = f.calls.find(c => String(c.url).endsWith('/rest/v1/rpc/push_targets'));
  assert.equal(rpc.init.headers.Authorization, 'Bearer service');
  assert.deepEqual(JSON.parse(rpc.init.body), { p_caller: 'u-dalton', p_scope: 'plan', p_kind: 'rsvp', p_code: 'AB12CD', p_to: 'host', p_players: [], p_topic: 'in' });
  const push = f.calls.find(c => String(c.url).startsWith('https://fcm.googleapis.com/'));
  assert.match(push.init.headers.Authorization, /^vapid t=/);
});

test('nobody to send to (or the SQL not run yet) sends nothing, quietly', async () => {
  const cfg = pushConfig(ENV);
  const f = fakeFetch({ rows: [] });
  assert.deepEqual(await handlePush(cfg, 'good', req, f), { status: 204, sent: 0 });
});

test('a subscription the push service says is gone is deleted, and a bad endpoint is never called', async () => {
  const cfg = pushConfig(ENV);
  const gone = sub('u-gone');
  const local = sub('u-local', 'localhost');
  const f = fakeFetch({ rows: [sub('u-ok'), gone, local], status: { [gone.push_endpoint]: 410 } });
  const r = await handlePush(cfg, 'good', req, f);
  assert.equal(r.sent, 1);
  const del = f.calls.filter(c => c.init.method === 'DELETE');
  assert.equal(del.length, 1);
  assert.match(String(del[0].url), /user_id=eq\.u-gone/);
  assert.ok(!f.calls.some(c => String(c.url).includes('localhost')));
});

test('the hourly tee time reminder sends one push per due plan, to the zones at 8 in the morning', async () => {
  const cfg = pushConfig(ENV);
  const rows = [{ plan_code: 'AB12CD', plan_date: '2026-10-10', plan_course: 'Birch Creek', ...sub('u-host') }];
  const zones = [{ time_zone: 'America/Denver' }, { time_zone: 'Asia/Tokyo' }, { time_zone: 'America/Los_Angeles' }];
  const f = fakeFetch({ rows, rpcs: { push_tee_zones: zones } });
  // 14:00 UTC on Oct 8 is 8:00 in Denver (summer time), 7:00 in Los Angeles, 23:00 in Tokyo
  assert.equal(await handleTee(cfg, new Date('2026-10-08T14:00:00Z'), f), 1);
  const rpc = f.calls.find(c => String(c.url).endsWith('/rest/v1/rpc/push_tee_due'));
  assert.deepEqual(JSON.parse(rpc.init.body), { p_days: { 'America/Denver': '2026-10-08' } });
  // 23:00 UTC is 8:00 the next day in Tokyo
  const g = fakeFetch({ rows, rpcs: { push_tee_zones: zones } });
  await handleTee(cfg, new Date('2026-10-08T23:00:00Z'), g);
  assert.deepEqual(JSON.parse(g.calls.find(c => String(c.url).endsWith('/rpc/push_tee_due')).init.body), { p_days: { 'Asia/Tokyo': '2026-10-09' } });
  assert.equal(await handleTee(null, new Date('2026-10-08T14:00:00Z'), f), 0);
});

test('an hour when no zone is at 8 asks for nothing', async () => {
  const cfg = pushConfig(ENV);
  const f = fakeFetch({ rows: [sub('u-host')], rpcs: { push_tee_zones: [{ time_zone: 'America/Denver' }] } });
  assert.equal(await handleTee(cfg, new Date('2026-10-08T03:00:00Z'), f), 0);
  assert.ok(!f.calls.some(c => String(c.url).endsWith('/rpc/push_tee_due')));
});

test('before the time zone SQL runs, the tee reminder goes on Utah\u2019s day in Utah\u2019s 8 o\u2019clock hour', async () => {
  const cfg = pushConfig(ENV);
  const rows = [{ plan_code: 'AB12CD', plan_date: '2026-10-10', plan_course: 'Birch Creek', ...sub('u-host') }];
  const f = fakeFetch({ rows, rpcs: { push_tee_zones: 404 } });
  assert.equal(await handleTee(cfg, new Date('2026-10-09T03:00:00Z'), f), 0);
  assert.ok(!f.calls.some(c => String(c.url).endsWith('/rpc/push_tee_due')));
  assert.equal(await handleTee(cfg, new Date('2026-10-09T14:30:00Z'), f), 1);
  assert.deepEqual(JSON.parse(f.calls.find(c => String(c.url).endsWith('/rpc/push_tee_due')).init.body), { p_today: '2026-10-09' });
});

test('a round finished push tells each person how they did, by the seats the database says are theirs', async () => {
  const cfg = pushConfig(ENV);
  const winner = { ...sub('u-a'), to_seats: ['pa'] };
  const second = { ...sub('u-b'), to_seats: ['zz', 'pb'] };
  const unknown = { ...sub('u-c'), to_seats: [] };
  const f = fakeFetch({ rows: [winner, second, unknown] });
  const fin = cleanPushRequest({ kind: 'finished', scope: 'round', code: 'AB12CD', results: { pa: 'won', pb: 2 }, data: { course: 'Birch Creek' } });
  const r = await handlePush(cfg, 'good', fin, f);
  assert.equal(r.sent, 3);
  const pushes = f.calls.filter(c => String(c.url).startsWith('https://fcm.googleapis.com/'));
  assert.equal(pushes.length, 3);
  assert.deepEqual(pushes.map(c => String(c.url)).sort(), [winner, second, unknown].map(x => x.push_endpoint).sort());
  // What each one says (the bodies above are encrypted)
  const said = payloadGroups(fin, [winner, second, unknown]).flatMap(g => g.rows.map(x => [x.to_user, g.payload.title]));
  assert.deepEqual(Object.fromEntries(said), { 'u-a': 'You won the Birch Creek round', 'u-b': 'You finished 2nd', 'u-c': 'Round finished' });
  // Any other push: one payload for everyone, seats or not
  assert.equal(payloadGroups(req, [winner, second, unknown]).length, 1);
  // What the server asks the database is the same as before: the results never leave the server
  const rpc = f.calls.find(c => String(c.url).endsWith('/rest/v1/rpc/push_targets'));
  assert.equal(JSON.parse(rpc.init.body).p_results, undefined);
});
