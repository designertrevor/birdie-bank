// The status page (public/status.html, status.js, status-core.js) and the two health modes it
// asks: what each answer means, the line at the top, the 5 second limit, and that course search's
// health check never spends GolfCourseAPI quota.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CHECKS, SLOW_MS, TIMEOUT_MS, checkedAgo, judge, runCheck, summary } from '../../public/status-core.js';
import coursesHandler from '../../api/courses.js';
import push, { healthAnswer } from '../../api/push.js';

const read = p => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const check = id => CHECKS.find(c => c.id === id);

test('the page checks the app, the database, sign-in, course search and notifications, all with GETs that cost nothing', () => {
  assert.deepEqual(CHECKS.map(c => c.id), ['app', 'db', 'auth', 'courses', 'push']);
  assert.equal(check('app').url, '/version.json');
  assert.match(check('db').url, /\/rest\/v1\/live_rounds\?select=code&code=eq\.status-check&limit=1$/);
  assert.match(check('auth').url, /\/auth\/v1\/health$/);
  assert.equal(check('courses').url, '/api/courses?health=1');
  assert.equal(check('push').url, '/api/push?health=1');
  // The public key, never a secret one
  assert.match(check('db').headers.apikey, /^sb_publishable_/);
  assert.equal(TIMEOUT_MS, 5000);
});

test('each answer becomes a green, amber or grey row', () => {
  assert.deepEqual(judge(check('app'), { ok: true, status: 200, body: { id: '47e25cb', built: 1 } }, 120), { state: 'up', label: 'Normal', detail: 'Working · version 47e25cb' });
  assert.equal(judge(check('db'), { ok: true, status: 200, body: [] }, SLOW_MS + 1).state, 'slow');
  assert.deepEqual(judge(check('courses'), { ok: true, status: 200, body: { ok: true, configured: false } }, 80), { state: 'slow', label: 'Off', detail: 'Running, but switched off on the server' });
  assert.equal(judge(check('push'), { ok: true, status: 200, body: { ok: true, configured: true } }, 80).state, 'up');
  assert.deepEqual(judge(check('auth'), null, 5000, { timedOut: true }), { state: 'down', label: 'Down', detail: 'No answer in 5 seconds' });
  assert.equal(judge(check('auth'), null, 30).detail, 'Couldn’t reach it');
  assert.equal(judge(check('db'), { ok: false, status: 503, body: null }, 30).detail, 'Server error (503)');
  assert.equal(judge(check('db'), { ok: false, status: 401, body: null }, 30).state, 'down');
});

test('the top line says all is normal, or names what is down', () => {
  const rows = states => CHECKS.map((c, i) => ({ name: c.name, state: states[i] }));
  assert.equal(summary(rows(['up', 'up', 'up', 'up', 'up'])).text, 'All systems normal');
  assert.equal(summary(rows(['up', null, 'up', 'up', 'up'])).text, 'Checking…');
  assert.equal(summary(rows(['up', 'up', 'up', 'down', 'up'])).text, 'Course search is down');
  assert.equal(summary(rows(['up', 'down', 'down', 'up', 'up'])).text, 'Live scoring and accounts and Sign in are down');
  assert.equal(summary(rows(['up', 'up', 'down', 'down', 'down'])).text, 'Sign in, Course search and Notifications are down');
  const slow = summary(rows(['up', 'slow', 'up', 'up', 'up']));
  assert.equal(slow.tone, 'slow');
  assert.match(slow.sub, /Live scoring and accounts is slow/);
  assert.equal(summary(rows(['down', 'down', 'down', 'down', 'down'])).text, 'Can’t reach anything from here');
  assert.equal(summary(rows(['up', 'up', 'down', 'up', 'up']), { online: false }).text, 'Can’t reach anything from here');
  // No em dash in anything the page says
  const all = JSON.stringify([CHECKS, summary(rows(['up', 'slow', 'down', 'up', 'up']))]);
  assert.ok(!all.includes(String.fromCharCode(0x2014)));
});

test('"Checked just now", then minutes and hours', () => {
  const now = 10_000_000;
  assert.equal(checkedAgo(now - 20_000, now), 'Checked just now');
  assert.equal(checkedAgo(now - 3 * 60_000, now), 'Checked 3 min ago');
  assert.equal(checkedAgo(now - 61 * 60_000, now), 'Checked 1 hour ago');
  assert.equal(checkedAgo(0, now), 'Not checked yet');
});

test('a check times out after its limit, measures its time, and skips the cache on our own files', async () => {
  let t = 0;
  const clock = () => t;
  const seen = [];
  const ok = async (url, init) => { seen.push({ url, init }); t += 42; return new Response('{"id":"abc1234"}', { headers: { 'content-type': 'application/json' } }); };
  const out = await runCheck(check('app'), { fetchImpl: ok, clock });
  assert.deepEqual(out, { ms: 42, state: 'up', label: 'Normal', detail: 'Working · version abc1234' });
  assert.match(seen[0].url, /^\/version\.json\?t=\d+$/);
  assert.equal(seen[0].init.cache, 'no-store');
  assert.equal(seen[0].init.credentials, 'omit');
  // Supabase's own URL goes as it is, with the key header
  await runCheck(check('db'), { fetchImpl: ok, clock });
  assert.ok(!seen[1].url.includes('&t='));
  assert.match(seen[1].init.headers.apikey, /^sb_publishable_/);

  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const slow = await runCheck(check('courses'), { fetchImpl: hang, timeout: 20 });
  assert.equal(slow.state, 'down');
  assert.equal(slow.detail, 'No answer in 5 seconds');
  const broken = await runCheck(check('courses'), { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(broken.detail, 'Couldn’t reach it');
});

function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = b => { res.body = b; };
  return res;
}

test('course search health answers 200 without calling GolfCourseAPI, with or without the key', async () => {
  const realFetch = globalThis.fetch;
  const keep = process.env.GOLFCOURSEAPI_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('{}'); };
  try {
    for (const key of ['test-key', undefined]) {
      if (key) process.env.GOLFCOURSEAPI_KEY = key; else delete process.env.GOLFCOURSEAPI_KEY;
      const res = fakeRes();
      await coursesHandler({ method: 'GET', url: '/api/courses?health=1&t=1' }, res);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(JSON.parse(res.body), { ok: true, configured: !!key });
      assert.equal(res.headers['cache-control'], 'no-store');
    }
    assert.equal(calls, 0, 'no upstream call, so no quota spent');
  } finally {
    globalThis.fetch = realFetch;
    if (keep == null) delete process.env.GOLFCOURSEAPI_KEY; else process.env.GOLFCOURSEAPI_KEY = keep;
  }
});

test('push health answers 200 and says whether pushes are set up; anything else is still POST only', async () => {
  assert.deepEqual(await healthAnswer(null).json(), { ok: true, configured: false });
  assert.deepEqual(await healthAnswer({}).json(), { ok: true, configured: true });
  const res = await push.fetch(new Request('https://birdie-bank.vercel.app/api/push?health=1'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal((await push.fetch(new Request('https://birdie-bank.vercel.app/api/push'))).status, 405);
});

test('the page is at /status, blends into Safari\'s bars, follows the picked theme, and stays out of the offline copy', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(vercel.rewrites.some(r => r.source === '/status' && r.destination === '/status.html'));
  const html = read('public/status.html');
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<div class="edge-top" aria-hidden="true"><\/div>/);
  assert.match(html, /<div class="edge-bottom" aria-hidden="true"><\/div>/);
  assert.match(html, /name="theme-color" media="\(prefers-color-scheme: dark\)"/);
  assert.match(html, /<script src="\/status\.js"><\/script>\s*<\/head>/);
  const css = read('public/status.css');
  assert.match(css, /html \{ background: var\(--edge-top-background\)/);
  assert.match(css, /max\(12px, env\(safe-area-inset-top\)\)/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(read('public/status.js'), /"theme":"\(light\|dark\)"/);
  // The offline copy never saves it (vite.config.js SKIP): it has to ask the network to mean anything
  const skip = read('vite.config.js').match(/const SKIP = (\/.*\/);/)[1];
  const re = new RegExp(skip.slice(1, -1));
  for (const f of ['status.html', 'status.css', 'status.js', 'status-core.js']) assert.ok(re.test(f), f);
  assert.ok(!re.test('index.html'));
  // Linked from Settings and watched by the uptime check
  assert.match(read('src/screens/Settings.jsx'), /href="\/status"/);
  assert.match(read('.github/workflows/uptime.yml'), /check \/status 200/);
});

test('the service worker sends the status page\'s script and styles to the network, never its runtime cache', () => {
  // Run public/sw.js with a stand-in worker and see which GETs it answers itself (cache first, saved
  // to birdie-bank-runtime, which nothing clears) and which it leaves to the network
  const listeners = {};
  const origin = 'https://birdie-bank.vercel.app';
  const sandbox = {
    self: { addEventListener: (type, fn) => { listeners[type] = fn; } },
    location: new URL(origin), URL, caches: { match: () => Promise.resolve(null), open: () => Promise.resolve({ put() {} }) },
    fetch: () => Promise.resolve(new Response('')), setTimeout, clearTimeout, Response,
  };
  vm.runInNewContext(read('public/sw.js'), sandbox);
  const answers = path => {
    let answered = false;
    listeners.fetch({ request: { method: 'GET', mode: 'no-cors', url: origin + path }, respondWith: () => { answered = true; } });
    return answered;
  };
  for (const f of ['/status.js', '/status-core.js', '/status.css', '/status.js?v=2']) assert.equal(answers(f), false, f);
  for (const f of ['/assets/index-3f9a1c.js', '/assets/index-3f9a1c.css', '/icon.svg', '/status-board.png']) assert.equal(answers(f), true, f);
});
