import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_QUOTA, quotaConfig, quotaEmail, quotaEvent, utcDay, watchCourseQuota } from './course-quota.js';
import handler from '../../api/courses.js';

const ENV = {
  VITE_SUPABASE_URL: 'https://db.example.supabase.co/',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  RESEND_API_KEY: 're_secret',
  FEEDBACK_EMAIL: 'trevor@example.com',
};

/** A fetch that answers the Supabase count with `row` (or a failure) and records every call. */
function fakeFetch({ row = { calls: 1, limited_before: false }, rpcStatus = 200, resendStatus = 200, upstream } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers || {} });
    if (url.includes('/rest/v1/rpc/course_api_call')) {
      return new Response(JSON.stringify([typeof row === 'function' ? row(body) : row]), { status: rpcStatus, headers: { 'content-type': 'application/json' } });
    }
    // The shared rate limit (src/lib/rate-limit.js) says yes and isn't counted as a call here
    if (url.includes('/rest/v1/rpc/rate_hit')) return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.startsWith('https://api.resend.com/')) return new Response('{"id":"x"}', { status: resendStatus });
    if (url.startsWith('https://api.golfcourseapi.com/') && upstream) return upstream();
    throw new TypeError(`unexpected fetch ${url}`);
  };
  fetchImpl.calls = calls;
  fetchImpl.limits = () => calls.filter(c => c.url.includes('/rest/v1/rpc/rate_hit'));
  fetchImpl.rpc = () => calls.filter(c => c.url.includes('course_api_call'));
  fetchImpl.mail = () => calls.filter(c => c.url.startsWith('https://api.resend.com/'));
  return fetchImpl;
}

test('quotaConfig: off without Supabase, free plan by default, Pro when set, email only with Resend', () => {
  assert.equal(quotaConfig({}), null);
  assert.equal(quotaConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' }), null);
  const free = quotaConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: 'k' });
  assert.equal(free.quota, DEFAULT_QUOTA);
  assert.equal(free.warnAt, 28);
  assert.equal(free.url, 'https://x.supabase.co');
  assert.equal(free.mail, null);
  const pro = quotaConfig({ ...ENV, GOLFCOURSEAPI_DAILY_QUOTA: '10000', FEEDBACK_FROM: 'Birdie Bank <hi@example.com>' });
  assert.equal(pro.quota, 10000);
  assert.equal(pro.warnAt, 8000);
  assert.deepEqual(pro.mail, { key: 're_secret', to: 'trevor@example.com', from: 'Birdie Bank <hi@example.com>' });
  // Junk in the quota falls back to the free plan
  assert.equal(quotaConfig({ ...ENV, GOLFCOURSEAPI_DAILY_QUOTA: 'lots' }).quota, DEFAULT_QUOTA);
  assert.equal(quotaConfig({ ...ENV, GOLFCOURSEAPI_DAILY_QUOTA: '0' }).quota, DEFAULT_QUOTA);
});

test('utcDay is the UTC date', () => {
  assert.equal(utcDay(new Date('2026-10-20T23:30:00-07:00')), '2026-10-21');
  assert.equal(utcDay(new Date('2026-10-20T06:00:00Z')), '2026-10-20');
});

test('quotaEvent fires once at 80%, once at the quota, and on the first 429', () => {
  const cfg = quotaConfig(ENV);
  const at = (calls, extra = {}) => quotaEvent({ calls, limited: false, limitedBefore: false, ...extra }, cfg);
  assert.equal(at(1), null);
  assert.equal(at(27), null);
  assert.equal(at(28), 'warning');
  assert.equal(at(29), null);
  assert.equal(at(35), 'out');
  assert.equal(at(36), null);
  assert.equal(at(3, { limited: true }), 'limited');
  assert.equal(at(3, { limited: true, limitedBefore: true }), null);
  // A 429 beats the count's own line
  assert.equal(at(28, { limited: true }), 'limited');
  // A quota of 1 has no room for a separate warning
  const tiny = quotaConfig({ ...ENV, GOLFCOURSEAPI_DAILY_QUOTA: '1' });
  assert.equal(quotaEvent({ calls: 1, limited: false, limitedBefore: false }, tiny), 'out');
});

test('quotaEmail says how much is used, what happens next and how to get more', () => {
  const cfg = quotaConfig(ENV);
  const warn = quotaEmail('warning', { calls: 28, day: '2026-10-20' }, cfg);
  assert.equal(warn.subject, 'Birdie Bank: course search is at 80% of today’s GolfCourseAPI calls');
  assert.match(warn.text, /used 28 of 35 GolfCourseAPI calls today \(2026-10-20 UTC, 80%\)/);
  assert.match(warn.text, /golfcourseapi\.com/);
  assert.match(warn.text, /GOLFCOURSEAPI_DAILY_QUOTA/);
  assert.match(warn.html, /^<pre/);
  const out = quotaEmail('out', { calls: 35, day: '2026-10-20' }, cfg);
  assert.equal(out.subject, 'Birdie Bank: course search is out of GolfCourseAPI calls for today');
  assert.match(out.text, /rate limited/);
  const limited = quotaEmail('limited', { calls: 12, day: '2026-10-20' }, cfg);
  assert.match(limited.subject, /over the limit/);
  assert.match(limited.text, /12 of 35/);
  for (const m of [warn, out, limited]) {
    assert.ok(!m.text.includes(String.fromCharCode(0x2014)), 'no em dashes');
    assert.ok(!JSON.stringify(m).includes('re_secret'));
  }
});

test('watch: a low-quota count emails Trevor once, through Resend, without the keys leaking', async () => {
  const f = fakeFetch({ row: { calls: 28, limited_before: false } });
  const out = await watchCourseQuota(ENV, { now: new Date('2026-10-20T15:00:00Z') }, f);
  assert.deepEqual(out, { calls: 28, event: 'warning', emailed: true });
  const [rpc] = f.rpc();
  assert.equal(rpc.url, 'https://db.example.supabase.co/rest/v1/rpc/course_api_call');
  assert.deepEqual(rpc.body, { p_day: '2026-10-20', p_add: 1, p_limited: false });
  assert.equal(rpc.headers.apikey, 'service-secret');
  const [mail] = f.mail();
  assert.equal(mail.headers.Authorization, 'Bearer re_secret');
  assert.deepEqual(mail.body.to, ['trevor@example.com']);
  assert.equal(mail.body.from, 'Birdie Bank <onboarding@resend.dev>');
  assert.match(mail.body.subject, /80%/);
  assert.ok(!mail.body.text.includes('service-secret'));
  assert.equal(f.calls.length, 2);
});

test('watch: calls short of the line only count, the quota itself emails "out"', async () => {
  const quiet = fakeFetch({ row: { calls: 29, limited_before: false } });
  assert.deepEqual(await watchCourseQuota(ENV, {}, quiet), { calls: 29, event: null, emailed: false });
  assert.equal(quiet.mail().length, 0);
  const out = fakeFetch({ row: { calls: 35, limited_before: false } });
  assert.deepEqual(await watchCourseQuota(ENV, {}, out), { calls: 35, event: 'out', emailed: true });
  assert.match(out.mail()[0].body.subject, /out of GolfCourseAPI calls/);
});

test('watch: a 429 is noted without counting and emails only the first time that day', async () => {
  const first = fakeFetch({ row: { calls: 12, limited_before: false } });
  assert.deepEqual(await watchCourseQuota(ENV, { add: 0, limited: true }, first), { calls: 12, event: 'limited', emailed: true });
  assert.deepEqual(first.rpc()[0].body, { p_day: utcDay(), p_add: 0, p_limited: true });
  assert.match(first.mail()[0].body.subject, /over the limit/);
  const again = fakeFetch({ row: { calls: 12, limited_before: true } });
  assert.deepEqual(await watchCourseQuota(ENV, { add: 0, limited: true }, again), { calls: 12, event: null, emailed: false });
  assert.equal(again.mail().length, 0);
});

test('watch: never throws; off without Supabase, quiet when the SQL has not run or Resend is unset or fails', async () => {
  const f = fakeFetch({ row: { calls: 28, limited_before: false } });
  assert.equal(await watchCourseQuota({}, {}, f), null);
  assert.equal(f.calls.length, 0);
  // The function isn't there yet (404 from PostgREST)
  const missing = fakeFetch({ rpcStatus: 404, row: { message: 'not found' } });
  assert.equal(await watchCourseQuota(ENV, {}, missing), null);
  assert.equal(missing.mail().length, 0);
  // Supabase unreachable
  const down = async () => { throw new TypeError('fetch failed'); };
  assert.equal(await watchCourseQuota(ENV, {}, down), null);
  // No Resend: counted, nothing sent
  const noMail = fakeFetch({ row: { calls: 28, limited_before: false } });
  const { RESEND_API_KEY, ...envNoMail } = ENV;
  assert.ok(RESEND_API_KEY);
  assert.deepEqual(await watchCourseQuota(envNoMail, {}, noMail), { calls: 28, event: 'warning', emailed: false });
  assert.equal(noMail.mail().length, 0);
  // Resend down: still counted, reported as not emailed
  const mailDown = fakeFetch({ row: { calls: 28, limited_before: false }, resendStatus: 500 });
  assert.deepEqual(await watchCourseQuota(ENV, {}, mailDown), { calls: 28, event: 'warning', emailed: false });
});

// ---------------------------------------------------------------------------
// End to end through api/courses.js: a search that lands on 80% emails Trevor and still answers.

function fakeRes() {
  const r = { statusCode: 0, headers: {}, body: null };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.end = b => { r.body = b ? JSON.parse(b) : null; };
  return r;
}

async function callHandler(url, { env, fetchImpl }) {
  const saved = {};
  const keys = ['GOLFCOURSEAPI_KEY', 'GOLFCOURSEAPI_DAILY_QUOTA', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'FEEDBACK_EMAIL', 'FEEDBACK_FROM'];
  for (const k of keys) { saved[k] = process.env[k]; if (env[k] == null) delete process.env[k]; else process.env[k] = env[k]; }
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const res = fakeRes();
    await handler({ method: 'GET', url }, res);
    return res;
  } finally {
    globalThis.fetch = realFetch;
    for (const k of keys) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

const json = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('courses function: the search that reaches 80% is answered and emails Trevor', async () => {
  const f = fakeFetch({ row: { calls: 28, limited_before: false }, upstream: json(200, { courses: [] }) });
  const res = await callHandler('/api/courses?q=pinehurst', { env: { ...ENV, GOLFCOURSEAPI_KEY: 'gca-key' }, fetchImpl: f });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { courses: [] });
  assert.equal(f.rpc().length, 1);
  assert.deepEqual(f.rpc()[0].body, { p_day: utcDay(), p_add: 1, p_limited: false });
  assert.equal(f.mail().length, 1);
  assert.match(f.mail()[0].body.subject, /80% of today’s GolfCourseAPI calls/);
  // The upstream call carries our key, and nothing else does
  const upstream = f.calls.find(c => c.url.startsWith('https://api.golfcourseapi.com/'));
  assert.equal(upstream.headers.Authorization, 'Bearer gca-key');
  assert.ok(!f.calls.filter(c => c !== upstream).some(c => JSON.stringify(c).includes('gca-key')));
});

test('courses function: a 429 from the API counts once, notes the limit, emails once, and answers rate_limited', async () => {
  const seen = [];
  const row = body => { seen.push(body); return { calls: 12, limited_before: seen.length > 2 }; };
  const f = fakeFetch({ row, upstream: json(429, { error: 'rate limit exceeded' }) });
  const env = { ...ENV, GOLFCOURSEAPI_KEY: 'gca-key' };
  const res = await callHandler('/api/courses?q=pinehurst', { env, fetchImpl: f });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: 'rate_limited' });
  assert.deepEqual(seen.map(b => [b.p_add, b.p_limited]), [[1, false], [0, true]]);
  assert.equal(f.mail().length, 1);
  assert.match(f.mail()[0].body.subject, /over the limit/);
  // The next 429 that day sends nothing more
  await callHandler('/api/courses?q=pinehurst', { env, fetchImpl: f });
  assert.equal(seen.length, 4);
  assert.equal(f.mail().length, 1);
});

test('courses function: a quiet call counts, an unreachable API still counts, and no count ever breaks a search', async () => {
  const f = fakeFetch({ row: { calls: 2, limited_before: false }, upstream: json(200, { courses: [] }) });
  const env = { ...ENV, GOLFCOURSEAPI_KEY: 'gca-key' };
  assert.equal((await callHandler('/api/courses?q=pinehurst', { env, fetchImpl: f })).statusCode, 200);
  assert.equal(f.rpc().length, 1);
  assert.equal(f.mail().length, 0);
  const down = fakeFetch({ row: { calls: 3, limited_before: false }, upstream: () => { throw new TypeError('fetch failed'); } });
  assert.equal((await callHandler('/api/courses?q=pinehurst', { env, fetchImpl: down })).statusCode, 504);
  assert.equal(down.rpc().length, 1);
  // Supabase down: the search is unaffected
  const dbDown = async (url, init) => url.includes('supabase') ? Promise.reject(new TypeError('fetch failed')) : json(200, { courses: [] })(url, init);
  assert.equal((await callHandler('/api/courses?q=pinehurst', { env, fetchImpl: dbDown })).statusCode, 200);
  // Without the service key nothing is counted and nothing else is called
  const bare = fakeFetch({ upstream: json(200, { courses: [] }) });
  assert.equal((await callHandler('/api/courses?q=pinehurst', { env: { GOLFCOURSEAPI_KEY: 'gca-key' }, fetchImpl: bare })).statusCode, 200);
  assert.equal(bare.calls.length, 1);
  // With it, the shared rate limit is asked first: per IP, then everyone
  assert.deepEqual(f.limits().map(c => c.body.p_key), ['courses:ip:unknown', 'courses:all']);
});
