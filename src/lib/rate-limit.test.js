import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, clientIp, courseGlobalLimit, courseRules, createLimiter, expandIpv6, feedbackRules, joinRules, memoryBuckets,
  sharedConfig, sharedHit, takeToken, tooManyResponse, tooManyText, windowLeft,
} from './rate-limit.js';
import { coursesHandler } from '../../api/courses.js';

const PER_MIN_3 = { max: 3, windowSeconds: 60 };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// ---------------------------------------------------------------------------
// The bucket math

test('takeToken: a fresh bucket is full, each request takes one, then it says no', () => {
  let b = null;
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const r = takeToken(b, 1000, PER_MIN_3);
    seen.push(r.allowed);
    b = r.bucket;
  }
  assert.deepEqual(seen, [true, true, true, false]);
  assert.equal(b.tokens, 0);
});

test('takeToken: refills evenly over the window and says how long to wait', () => {
  // 3 a minute is one token every 20 seconds
  const empty = { tokens: 0, at: 0 };
  const early = takeToken(empty, 5000, PER_MIN_3);
  assert.equal(early.allowed, false);
  assert.equal(early.retryAfter, 15); // 0.25 of a token back, 0.75 to go at 1/20 a second
  assert.ok(Math.abs(early.bucket.tokens - 0.25) < 1e-9);
  const later = takeToken(early.bucket, 20000, PER_MIN_3);
  assert.equal(later.allowed, true);
  assert.ok(Math.abs(later.bucket.tokens) < 1e-9);
});

test('takeToken: never holds more than max, and a clock going backwards adds nothing', () => {
  const r = takeToken({ tokens: 1, at: 0 }, 10 * 60 * 1000, PER_MIN_3);
  assert.equal(r.bucket.tokens, 2); // full at 3, less the one just taken
  const back = takeToken({ tokens: 0.5, at: 10000 }, 0, PER_MIN_3);
  assert.equal(back.allowed, false);
  assert.equal(back.bucket.tokens, 0.5);
});

test('memoryBuckets: keeps keys apart and forgets the least recently used', () => {
  const b = memoryBuckets(2);
  const lim = { max: 1, windowSeconds: 60 };
  assert.equal(b.take('a', 0, lim).allowed, true);
  assert.equal(b.take('b', 0, lim).allowed, true);
  assert.equal(b.take('a', 0, lim).allowed, false); // a is empty, and now the most recent
  b.take('c', 0, lim); // pushes out b, the oldest
  assert.equal(b.size, 2);
  assert.equal(b.take('b', 0, lim).allowed, true, 'b was forgotten, so it starts full');
  assert.equal(b.take('c', 0, lim).allowed, false);
});

test('windowLeft: seconds to the end of an epoch-aligned window', () => {
  assert.equal(windowLeft(0, 60), 60);
  assert.equal(windowLeft(59_999, 60), 1);
  assert.equal(windowLeft(61_000, 60), 59);
  assert.equal(windowLeft(3600_000 + 1800_000, 3600), 1800);
});

// ---------------------------------------------------------------------------
// The limits

test('the course ceiling for everyone follows the plan: an eighth of a day an hour, at least 10', () => {
  assert.deepEqual(courseGlobalLimit(35), { max: 10, windowSeconds: 3600 });
  assert.deepEqual(courseGlobalLimit(10000), { max: 1250, windowSeconds: 3600 });
  assert.deepEqual(courseRules({ GOLFCOURSEAPI_DAILY_QUOTA: '10000' }), [
    { scope: 'ip', max: 30, windowSeconds: 60 },
    { scope: 'all', max: 1250, windowSeconds: 3600 },
  ]);
  assert.equal(courseRules({}).at(-1).max, 10, 'unset is the free plan');
  assert.deepEqual(joinRules(), [{ scope: 'ip', max: 60, windowSeconds: 60 }]);
  assert.deepEqual(feedbackRules(), [{ scope: 'all', max: 20, windowSeconds: 3600 }]);
  assert.equal(LIMITS.courses.ip.max, 30);
});

// ---------------------------------------------------------------------------
// Who's asking

test('clientIp: Vercel headers, IPv6 by its /64, and nothing odd gets through as a key', () => {
  assert.equal(clientIp(new Headers({ 'x-real-ip': '203.0.113.7' })), '203.0.113.7');
  assert.equal(clientIp({ 'x-forwarded-for': '198.51.100.2, 10.0.0.1' }), '198.51.100.2');
  assert.equal(clientIp({ 'x-real-ip': '2001:db8:85a3::8a2e:370:7334' }), '2001:0db8:85a3:0000::/64');
  assert.equal(clientIp({ 'x-real-ip': '2001:db8:85a3:0:ffff::1' }), '2001:0db8:85a3:0000::/64', 'same /64, same key');
  assert.equal(clientIp({ 'x-real-ip': '::ffff:192.0.2.9' }), '192.0.2.9');
  assert.equal(clientIp({ 'x-real-ip': 'drop table' }), 'unknown');
  assert.equal(clientIp({}), 'unknown');
  assert.equal(clientIp(undefined), 'unknown');
});

test('expandIpv6: writes out :: and rejects what is not an address', () => {
  assert.equal(expandIpv6('::1'), '0000:0000:0000:0000:0000:0000:0000:0001');
  assert.equal(expandIpv6('[fe80::1%en0]'), 'fe80:0000:0000:0000:0000:0000:0000:0001');
  assert.equal(expandIpv6('1::2::3'), null);
  assert.equal(expandIpv6('1:2:3'), null);
  assert.equal(expandIpv6('12345::'), null);
});

// ---------------------------------------------------------------------------
// The shared counter

test('sharedConfig: only with the service key', () => {
  assert.equal(sharedConfig({ VITE_SUPABASE_ANON_KEY: 'anon' }), null);
  assert.deepEqual(sharedConfig({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 's' }), { url: 'https://x.supabase.co', key: 's' });
});

test('sharedHit: calls rate_hit and reads true, false, or can’t tell', async () => {
  const cfg = { url: 'https://x.supabase.co', key: 'service' };
  const calls = [];
  const ok = await sharedHit(cfg, { key: 'courses:all', max: 10, windowSeconds: 3600 }, async (u, init) => { calls.push({ u, init }); return json(200, true); });
  assert.equal(ok, true);
  assert.equal(calls[0].u, 'https://x.supabase.co/rest/v1/rpc/rate_hit');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer service');
  assert.deepEqual(JSON.parse(calls[0].init.body), { p_key: 'courses:all', p_max: 10, p_window_seconds: 3600 });
  assert.equal(await sharedHit(cfg, { key: 'k', max: 1, windowSeconds: 60 }, async () => json(200, false)), false);
  assert.equal(await sharedHit(cfg, { key: 'k', max: 1, windowSeconds: 60 }, async () => json(404, { code: 'PGRST202' })), null, 'SQL not run');
  assert.equal(await sharedHit(cfg, { key: 'k', max: 1, windowSeconds: 60 }, async () => json(200, [{ x: 1 }])), null);
  assert.equal(await sharedHit(cfg, { key: 'k', max: 1, windowSeconds: 60 }, async () => { throw new TypeError('fetch failed'); }), null);
});

// ---------------------------------------------------------------------------
// The limiter

const SERVICE = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' };

test('limiter without a service key: memory only, never calls out', async () => {
  let fetched = 0;
  const lim = createLimiter('t', [{ scope: 'ip', ...PER_MIN_3 }], { env: {}, fetchImpl: async () => { fetched++; return json(200, true); }, now: () => 0 });
  const out = [];
  for (let i = 0; i < 4; i++) out.push(await lim.check('1.2.3.4'));
  assert.deepEqual(out.map(r => r.allowed), [true, true, true, false]);
  assert.deepEqual(out[3], { allowed: false, retryAfter: 20, scope: 'ip', layer: 'memory' });
  assert.equal((await lim.check('5.6.7.8')).allowed, true, 'another IP has its own bucket');
  assert.equal(fetched, 0);
});

test('limiter: the shared counter says no, with Retry-After to the end of its window', async () => {
  const keys = [];
  const lim = createLimiter('courses', [{ scope: 'ip', max: 30, windowSeconds: 60 }, { scope: 'all', max: 10, windowSeconds: 3600 }], {
    env: SERVICE,
    now: () => 3600_000 * 5 + 600_000, // 10 minutes into an hour
    fetchImpl: async (u, init) => { const { p_key } = JSON.parse(init.body); keys.push(p_key); return json(200, p_key !== 'courses:all'); },
  });
  const r = await lim.check('203.0.113.7');
  assert.deepEqual(r, { allowed: false, retryAfter: 3000, scope: 'all', layer: 'shared' });
  assert.deepEqual(keys, ['courses:ip:203.0.113.7', 'courses:all']);
});

test('limiter: one IP over its limit never counts against everyone', async () => {
  const keys = [];
  const lim = createLimiter('courses', [{ scope: 'ip', max: 30, windowSeconds: 60 }, { scope: 'all', max: 10, windowSeconds: 3600 }], {
    env: SERVICE,
    now: () => 0,
    fetchImpl: async (u, init) => { const { p_key } = JSON.parse(init.body); keys.push(p_key); return json(200, false); },
  });
  const r = await lim.check('203.0.113.7');
  assert.equal(r.scope, 'ip');
  assert.equal(r.retryAfter, 60);
  assert.deepEqual(keys, ['courses:ip:203.0.113.7']);
});

test('limiter fails open when Supabase is down, and logs it once until it works again', async () => {
  const logs = [];
  let up = false;
  const lim = createLimiter('courses', [{ scope: 'ip', max: 100, windowSeconds: 60 }], {
    env: SERVICE,
    now: () => 0,
    log: m => logs.push(m),
    fetchImpl: async () => { if (!up) throw new TypeError('fetch failed'); return json(200, true); },
  });
  for (let i = 0; i < 5; i++) assert.equal((await lim.check('1.2.3.4')).allowed, true);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /letting requests through/);
  up = true;
  assert.equal((await lim.check('1.2.3.4')).allowed, true);
  up = false;
  assert.equal((await lim.check('1.2.3.4')).allowed, true);
  assert.equal(logs.length, 2, 'a new outage after a good call is logged again');
});

test('limiter fails open on a broken clock or bucket too', async () => {
  const lim = createLimiter('t', [{ scope: 'ip', ...PER_MIN_3 }], { buckets: { take() { throw new Error('boom'); } } });
  assert.deepEqual(await lim.check('1.2.3.4'), { allowed: true });
});

// ---------------------------------------------------------------------------
// The answer

test('a 429 has Retry-After, no caching and one plain line', async () => {
  const res = tooManyResponse(42);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '42');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('content-type'), /^text\/plain/);
  const body = await res.text();
  assert.equal(body, 'Too many requests. Try again in a minute.\n');
  assert.equal(body.trim().split('\n').length, 1);
  assert.equal(tooManyText(600), 'Too many requests. Try again in 10 minutes.\n');
  assert.equal(tooManyText(3600), 'Too many requests. Try again in an hour.\n');
});

function textRes() {
  const r = { headers: {}, statusCode: 200, body: '' };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = b => { r.body = b || ''; };
  return r;
}

test('api/courses answers 429 before calling GolfCourseAPI once over the limit', async () => {
  const saved = process.env.GOLFCOURSEAPI_KEY;
  const realFetch = globalThis.fetch;
  process.env.GOLFCOURSEAPI_KEY = 'k';
  const upstream = [];
  globalThis.fetch = async u => { upstream.push(u); return json(200, { courses: [] }); };
  try {
    const handler = coursesHandler(createLimiter('courses', [{ scope: 'ip', max: 1, windowSeconds: 60 }], { env: {}, now: () => 0 }));
    const req = { method: 'GET', url: '/api/courses?q=pine', headers: { 'x-real-ip': '203.0.113.7' } };
    const first = textRes();
    await handler(req, first);
    assert.equal(first.statusCode, 200);
    const second = textRes();
    await handler(req, second);
    assert.equal(second.statusCode, 429);
    assert.equal(second.headers['retry-after'], '60');
    assert.equal(second.headers['cache-control'], 'no-store');
    assert.equal(second.body, 'Too many requests. Try again in a minute.\n');
    assert.equal(upstream.filter(u => String(u).includes('golfcourseapi')).length, 1);
    const bad = textRes();
    await handler({ ...req, url: '/api/courses?q=p' }, bad);
    assert.equal(bad.statusCode, 400, 'a bad query is turned away before the limiter');
  } finally {
    globalThis.fetch = realFetch;
    if (saved == null) delete process.env.GOLFCOURSEAPI_KEY; else process.env.GOLFCOURSEAPI_KEY = saved;
  }
});

test('api/join answers 429 to one IP past 60 a minute, and others still get previews', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html><head></head></html>', { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const { default: join } = await import('../../api/join.js');
    const ask = ip => join.fetch(new Request('https://birdie-bank.vercel.app/api/join?draft=T1', { headers: { 'x-real-ip': ip } }));
    const codes = [];
    for (let i = 0; i < 61; i++) codes.push((await ask('198.51.100.9')).status);
    assert.equal(codes.filter(c => c === 200).length, 60);
    assert.equal(codes.at(-1), 429);
    assert.equal((await ask('198.51.100.10')).status, 200);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('api/feedback-notify sends at most 20 emails an hour, and only after the secret', async () => {
  const keys = ['RESEND_API_KEY', 'FEEDBACK_EMAIL', 'FEEDBACK_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { RESEND_API_KEY: 'r', FEEDBACK_EMAIL: 't@example.com', FEEDBACK_WEBHOOK_SECRET: 's' });
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const realFetch = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = async () => { sent++; return json(200, { id: 'x' }); };
  try {
    const { default: notify } = await import('../../api/feedback-notify.js');
    const post = secret => notify.fetch(new Request('https://birdie-bank.vercel.app/api/feedback-notify', {
      method: 'POST',
      headers: { 'x-webhook-secret': secret, 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'INSERT', record: { kind: 'bug', body: 'It broke' } }),
    }));
    for (let i = 0; i < 30; i++) assert.equal((await post('wrong')).status, 401);
    const codes = [];
    for (let i = 0; i < 21; i++) codes.push((await post('s')).status);
    assert.equal(codes.filter(c => c === 204).length, 20, 'wrong secrets never used up the emails');
    assert.equal(codes.at(-1), 429);
    assert.equal(sent, 20);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of keys) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; }
  }
});
