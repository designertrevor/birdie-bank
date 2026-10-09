import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanUrl, cleanUrlProps, scrubBreadcrumb, scrubEvent, scrubText } from './scrub.js';

test('cleanUrl: the path only, never a join, plan or sign-in code', () => {
  assert.equal(cleanUrl('https://birdie-bank.vercel.app/?join=AB12CD'), 'https://birdie-bank.vercel.app/');
  assert.equal(cleanUrl('https://x.app/rules/wolf#how?x=1'), 'https://x.app/rules/wolf');
  assert.equal(cleanUrl('/api/courses?q=pebble'), '/api/courses');
  assert.equal(cleanUrl(''), '');
});

test('scrubText: emails, amounts, phone numbers, quoted names and row values come out', () => {
  assert.equal(scrubText('Sent to bob.smith+golf@example.com'), 'Sent to [email]');
  assert.equal(scrubText('Owes $1,250.50 and -$5'), 'Owes [amount] and [amount]');
  assert.equal(scrubText('Call (555) 123-4567'), 'Call [number]');
  assert.equal(scrubText('No player "Bob Jones" on “Pebble Beach”'), 'No player "…" on "…"');
  assert.equal(scrubText('duplicate key: Key (code)=(AB12CD) already exists'), 'duplicate key: Key (code)=(…) already exists');
  assert.equal(scrubText('fetch https://x.supabase.co/rest/v1/live_rounds?code=eq.AB12CD failed'), 'fetch https://x.supabase.co/rest/v1/live_rounds failed');
  // What an engine says stays readable
  assert.equal(scrubText("Cannot read properties of undefined (reading 'holes')"), "Cannot read properties of undefined (reading 'holes')");
  assert.equal(scrubText('x'.repeat(900)).length, 500);
  assert.equal(scrubText(undefined), undefined);
});

test('scrubBreadcrumb: requests and moves between pages only, never console lines or taps', () => {
  assert.equal(scrubBreadcrumb({ category: 'console', message: 'Bob owes $40' }), null);
  assert.equal(scrubBreadcrumb({ category: 'ui.click', message: 'button.pay' }), null);
  assert.equal(scrubBreadcrumb(null), null);
  const f = scrubBreadcrumb({ type: 'http', category: 'fetch', level: 'info', timestamp: 1, data: { method: 'GET', url: 'https://x.supabase.co/rest/v1/plans?code=eq.ZZ99', status_code: 200, request_body_size: 10 } });
  assert.deepEqual(f, { type: 'http', category: 'fetch', level: 'info', timestamp: 1, data: { method: 'GET', url: 'https://x.supabase.co/rest/v1/plans', status_code: 200 } });
  const n = scrubBreadcrumb({ category: 'navigation', data: { from: '/?plan=AB12CD&p=bob', to: '/' } });
  assert.deepEqual(n.data, { from: '/', to: '/' });
});

test('scrubEvent: no user, no query, no extras, and the message and frames cleaned', () => {
  const e = scrubEvent({
    message: 'Paid bob@example.com $20',
    user: { id: 'u1', email: 'bob@example.com', ip_address: '1.2.3.4' },
    server_name: 'phone',
    extra: { state: { players: ['Bob'] } },
    request: { url: 'https://birdie-bank.vercel.app/?join=AB12CD', query_string: 'join=AB12CD', headers: { 'User-Agent': 'Safari', Referer: 'https://x.app/?plan=AB' }, cookies: 'a=b' },
    exception: { values: [{ type: 'Error', value: 'No player "Bob"', stacktrace: { frames: [{ filename: 'https://birdie-bank.vercel.app/assets/Play-abc.js?v=1', function: 'finish', vars: { name: 'Bob' } }] } }] },
    breadcrumbs: [{ category: 'console', message: 'Bob' }, { category: 'navigation', data: { from: '/?join=A', to: '/' } }],
    contexts: { browser: { name: 'Safari' }, os: { name: 'iOS' }, state: { round: { course: 'Pebble' } }, react: { componentStack: '\n    at Play\n    at Stage' } },
    tags: { where: 'screen' },
    release: 'birdie-bank@abc1234',
  });
  assert.equal(e.user, undefined);
  assert.equal(e.server_name, undefined);
  assert.equal(e.extra, undefined);
  assert.equal(e.message, 'Paid [email] [amount]');
  assert.deepEqual(e.request, { url: 'https://birdie-bank.vercel.app/', headers: { 'User-Agent': 'Safari' } });
  assert.equal(e.exception.values[0].value, 'No player "…"');
  assert.deepEqual(e.exception.values[0].stacktrace.frames[0], { filename: 'https://birdie-bank.vercel.app/assets/Play-abc.js', function: 'finish' });
  assert.equal(e.breadcrumbs.length, 1);
  assert.deepEqual(Object.keys(e.contexts).sort(), ['browser', 'os', 'react']);
  assert.equal(e.release, 'birdie-bank@abc1234');
  assert.deepEqual(e.tags, { where: 'screen' });
  assert.equal(scrubEvent(null), null);
});

test('cleanUrlProps: PostHog\'s own address properties keep their path only', () => {
  const p = cleanUrlProps({
    $current_url: 'https://birdie-bank.vercel.app/?join=AB12CD', $pathname: '/', $host: 'birdie-bank.vercel.app',
    $search: '?join=AB12CD', $initial_referrer_info: { $referrer: 'https://www.tiktok.com/@creator/video/1?x=y' }, game: 'wolf', holes: 18,
  });
  assert.deepEqual(p, {
    $current_url: 'https://birdie-bank.vercel.app/', $pathname: '/', $host: 'birdie-bank.vercel.app',
    $initial_referrer_info: { $referrer: 'https://www.tiktok.com/@creator/video/1' }, game: 'wolf', holes: 18,
  });
  assert.equal(cleanUrlProps(undefined), undefined);
});
