// CSP reports (csp-report.js, api/csp-report.js): both report shapes are read, tidied and sent on
// to Sentry's security endpoint for the DSN, or logged when there's no DSN.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_FIELD, MAX_REPORTS, cleanUrl, logLine, readReports, sentrySecurityUrl } from './csp-report.js';
import handler, { cspReportHandler } from '../../api/csp-report.js';
import { createLimiter, cspReportRules, LIMITS } from './rate-limit.js';

const DSN = 'https://abc123@o4508.ingest.us.sentry.io/4508999';

test('the security endpoint comes from the DSN, tagged with the environment and release', () => {
  const u = new URL(sentrySecurityUrl(DSN, { environment: 'production', release: 'birdie-bank@47e25cb' }));
  assert.equal(u.origin, 'https://o4508.ingest.us.sentry.io');
  assert.equal(u.pathname, '/api/4508999/security/');
  assert.equal(u.searchParams.get('sentry_key'), 'abc123');
  assert.equal(u.searchParams.get('sentry_environment'), 'production');
  assert.equal(u.searchParams.get('sentry_release'), 'birdie-bank@47e25cb');
  assert.equal(new URL(sentrySecurityUrl('https://k@sentry.example.com/prefix/7')).pathname, '/prefix/api/7/security/');
  for (const bad of ['', null, 'nope', 'https://o1.ingest.sentry.io/1', 'https://k@o1.ingest.sentry.io/', 'https://k@o1.ingest.sentry.io/abc']) assert.equal(sentrySecurityUrl(bad), null, String(bad));
});

const OLD = {
  'csp-report': {
    'document-uri': 'https://birdie-bank.vercel.app/?join=AB12CD#x', 'referrer': '', 'violated-directive': 'img-src',
    'effective-directive': 'img-src', 'original-policy': "default-src 'self'", 'blocked-uri': 'https://evil.example/p.gif?u=1',
    'disposition': 'report', 'script-sample': 'secret', 'status-code': 200,
  },
};
const NEW = [
  { type: 'csp-violation', age: 2, url: 'https://birdie-bank.vercel.app/rules/wolf', body: { documentURL: 'https://birdie-bank.vercel.app/rules/wolf?ref=bob', blockedURL: 'inline', effectiveDirective: 'script-src-elem', originalPolicy: 'x', disposition: 'report', sample: 'alert(1)', lineNumber: 4 } },
  { type: 'deprecation', body: { id: 'x' } },
  { type: 'csp-violation', body: { documentURL: 'https://birdie-bank.vercel.app/', blockedURL: 'chrome-extension://abcdef/inject.js', effectiveDirective: 'script-src-elem' } },
];

test('the older report-uri shape is read and tidied: no query string, no hash, no code sample', () => {
  const [r] = readReports(JSON.stringify(OLD));
  assert.equal(r['document-uri'], 'https://birdie-bank.vercel.app/');
  assert.equal(r['blocked-uri'], 'https://evil.example/p.gif');
  assert.equal(r['effective-directive'], 'img-src');
  assert.equal('script-sample' in r, false);
});

test('the Reporting API shape becomes the older one, without other report types or browser extensions', () => {
  const list = readReports(JSON.stringify(NEW));
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    'document-uri': 'https://birdie-bank.vercel.app/rules/wolf', 'blocked-uri': 'inline', 'effective-directive': 'script-src-elem',
    'violated-directive': 'script-src-elem', 'original-policy': 'x', 'disposition': 'report', 'line-number': 4,
  });
  const many = Array.from({ length: 40 }, () => NEW[0]);
  assert.equal(readReports(JSON.stringify(many)).length, MAX_REPORTS);
  for (const junk of ['', 'not json', '{}', '[]', '{"csp-report": 3}', 'x'.repeat(70000), null]) assert.deepEqual(readReports(junk), [], String(junk).slice(0, 12));
});

test('urls lose their query and hash, and browser keywords stay as they are', () => {
  assert.equal(cleanUrl('https://a.example/p?code=1#h'), 'https://a.example/p');
  assert.equal(cleanUrl('inline'), 'inline');
  assert.equal(cleanUrl('eval'), 'eval');
  assert.equal(cleanUrl('data'), 'data');
  assert.equal(logLine({ 'effective-directive': 'img-src', 'blocked-uri': 'https://x.example/a', 'document-uri': 'https://birdie-bank.vercel.app/status', disposition: 'report' }), 'csp report: img-src blocked https://x.example/a on /status');
});

const post = (body, type = 'application/csp-report') => new Request('https://birdie-bank.vercel.app/api/csp-report', {
  method: 'POST', headers: { 'Content-Type': type, 'User-Agent': 'TestPhone/1.0' }, body,
});

async function withEnv(env, fn) {
  const keep = { ...process.env };
  const realFetch = globalThis.fetch;
  const realLog = console.log;
  const sent = [];
  const logs = [];
  for (const k of ['SENTRY_DSN', 'VITE_SENTRY_DSN', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_SHA']) delete process.env[k];
  Object.assign(process.env, env);
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response(null, { status: 200 }); };
  console.log = line => logs.push(line);
  try { await fn({ sent, logs }); } finally {
    process.env = keep;
    globalThis.fetch = realFetch;
    console.log = realLog;
  }
}

test('the function only takes POSTs, and answers 204 whatever comes in', async () => {
  assert.equal((await handler.fetch(new Request('https://birdie-bank.vercel.app/api/csp-report'))).status, 405);
  await withEnv({}, async ({ sent }) => {
    assert.equal((await handler.fetch(post('garbage'))).status, 204);
    assert.equal(sent.length, 0);
  });
});

test('without a DSN the report goes to the log, not anywhere else', async () => {
  await withEnv({}, async ({ sent, logs }) => {
    assert.equal((await handler.fetch(post(JSON.stringify(OLD)))).status, 204);
    assert.equal(sent.length, 0);
    assert.deepEqual(logs, ['csp report: img-src blocked https://evil.example/p.gif on /']);
  });
});

test('with the app DSN each report goes to Sentry, tagged with the deploy, in the older shape', async () => {
  await withEnv({ VITE_SENTRY_DSN: DSN, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: '47e25cb0000000' }, async ({ sent }) => {
    assert.equal((await handler.fetch(post(JSON.stringify(NEW), 'application/reports+json'))).status, 204);
    assert.equal(sent.length, 1);
    const u = new URL(sent[0].url);
    assert.equal(u.host, 'o4508.ingest.us.sentry.io');
    assert.equal(u.searchParams.get('sentry_environment'), 'preview');
    assert.equal(u.searchParams.get('sentry_release'), 'birdie-bank@47e25cb');
    assert.equal(sent[0].init.headers['Content-Type'], 'application/csp-report');
    assert.equal(sent[0].init.headers['User-Agent'], 'TestPhone/1.0');
    const body = JSON.parse(sent[0].init.body);
    assert.equal(body['csp-report']['document-uri'], 'https://birdie-bank.vercel.app/rules/wolf');
  });
  // SENTRY_DSN, when set, wins
  await withEnv({ SENTRY_DSN: 'https://zzz@o1.ingest.de.sentry.io/9', VITE_SENTRY_DSN: DSN }, async ({ sent }) => {
    await handler.fetch(post(JSON.stringify(OLD)));
    assert.equal(new URL(sent[0].url).host, 'o1.ingest.de.sentry.io');
  });
});

test('only the known report fields go on, each cut to a sane length', () => {
  const [r] = readReports(JSON.stringify({ 'csp-report': {
    'document-uri': 'https://birdie-bank.vercel.app/', 'blocked-uri': `https://x.example/${'a'.repeat(5000)}`,
    'line-number': 3, 'effective-directive': { nested: 'junk' }, 'anything-else': 'spam', 'script-sample': 'secret',
  } }));
  assert.deepEqual(Object.keys(r).sort(), ['blocked-uri', 'document-uri', 'line-number']);
  assert.equal(r['blocked-uri'].length, MAX_FIELD);
  assert.equal(r['line-number'], 3);
});

test('reports past the rate limit are dropped quietly, still a 204, and a body that says it is too big is never read', async () => {
  const limited = cspReportHandler(createLimiter('csp-test', [{ scope: 'ip', max: 2, windowSeconds: 60 }], { now: () => 1000 }));
  await withEnv({ VITE_SENTRY_DSN: DSN }, async ({ sent }) => {
    const many = JSON.stringify(Array.from({ length: 5 }, () => NEW[0]));
    assert.equal((await limited.fetch(post(many, 'application/reports+json'))).status, 204);
    assert.equal(sent.length, 2);
    assert.equal((await limited.fetch(post(JSON.stringify(OLD)))).status, 204);
    assert.equal(sent.length, 2);
    const big = new Request('https://birdie-bank.vercel.app/api/csp-report', { method: 'POST', headers: { 'Content-Length': String(1e7) }, body: JSON.stringify(OLD) });
    assert.equal((await handler.fetch(big)).status, 204);
    assert.equal(sent.length, 2);
  });
  // The real limits: per IP first, then everyone, so one phone can't spend everyone's hour
  assert.deepEqual(cspReportRules().map(r => r.scope), ['ip', 'all']);
  assert.ok(LIMITS.cspReport.ip.max <= LIMITS.cspReport.all.max);
});
