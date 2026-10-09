import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCrashReporter } from './crash-core.js';
import { attachReporter, crashReportsOff, reportError, waitingCount, windowError } from './crash.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');

function fakeSentry() {
  const sent = [];
  return { sent, capture: (e, ctx) => sent.push([e.message || String(e), ctx]) };
}

test('crash reports: without a DSN nothing loads and nothing is kept', async () => {
  const r = createCrashReporter();
  r.report(new Error('early'));
  r.start({ load: null });
  assert.deepEqual(r.status(), { state: 'off', queued: 0 });
  r.report(new Error('later'));
  assert.equal(r.status().queued, 0);
});

test('crash reports: errors from before Sentry loads are sent once it is up', async () => {
  const r = createCrashReporter();
  const s = fakeSentry();
  r.fromWindow(new Error('at launch'), 'window');
  r.report(new Error('in a screen'), { componentStack: 'at Play', where: 'screen' });
  r.start({ load: () => s });
  await tick();
  assert.deepEqual(s.sent, [['at launch', { where: 'window' }], ['in a screen', { componentStack: 'at Play', where: 'screen' }]]);
  // Once up, Sentry's own handlers catch the window's errors, so they aren't sent twice
  r.fromWindow(new Error('after'), 'window');
  assert.equal(s.sent.length, 2);
  r.report(new Error('boundary'), { where: 'screen' });
  assert.equal(s.sent.length, 3);
});

test('crash reports: Share usage data off sends nothing and drops what waited; on loads it', async () => {
  let on = false;
  let loads = 0;
  const s = fakeSentry();
  const r = createCrashReporter();
  r.report(new Error('x'));
  r.start({ allowed: () => on, load: () => { loads += 1; return s; } });
  await tick();
  assert.equal(loads, 0);
  assert.equal(r.status().queued, 0);
  r.report(new Error('while off'));
  assert.equal(r.status().queued, 0);
  on = true;
  r.sharingChanged(true);
  await tick();
  assert.equal(loads, 1);
  r.report(new Error('on'));
  on = false;
  r.report(new Error('off again'));
  assert.deepEqual(s.sent.map(x => x[0]), ['on']);
});

test('crash reports: the queue is short and a failed load tries again', async () => {
  const r = createCrashReporter();
  for (let i = 0; i < 25; i++) r.report(new Error(String(i)));
  assert.equal(r.status().queued, 10);
  let fail = true;
  const s = fakeSentry();
  r.start({ load: () => (fail ? Promise.reject(new Error('offline')) : s) });
  await tick();
  assert.equal(r.status().state, 'waiting');
  fail = false;
  r.report(new Error('next'));
  await tick();
  assert.equal(s.sent.length, 10, 'the first ten, then the cap kept the rest out');
  assert.equal(r.status().state, 'ready');
});

test('reportError (the first-screen part): waits for the reporter, then hands over what waited', async () => {
  assert.doesNotThrow(() => reportError(new Error('a'), { where: 'test' }));
  windowError(new Error('b'), 'window');
  reportError(null);
  assert.equal(waitingCount(), 2);
  const r = createCrashReporter();
  const s = fakeSentry();
  attachReporter(r);
  r.start({ load: () => s });
  await tick();
  assert.deepEqual(s.sent, [['a', { where: 'test' }], ['b', { where: 'window' }]]);
  crashReportsOff();
  reportError(new Error('c'));
  assert.equal(s.sent.length, 2);
});

test('wired: the error boundary reports, and the libraries only load after the first paint with their keys', () => {
  assert.match(read('../components/ErrorBoundary.jsx'), /reportError\(error, \{ componentStack: info\?\.componentStack/);
  const late = read('./ops-late.js');
  assert.match(late, /if \(SENTRY_DSN\) \{[\s\S]*import\('\.\/sentry-client\.js'\)[\s\S]*\} else crashReportsOff\(\);/);
  assert.match(late, /if \(POSTHOG_KEY\) \{[\s\S]*import\('\.\/posthog-client\.js'\)[\s\S]*\} else trackingOff\(\);/);
  assert.match(late, /release: `birdie-bank@\$\{BUILD_ID\}`/);
  // Nothing to do (no keys, no creator code): the rest never loads
  assert.match(read('./ops.js'), /if \(!SENTRY_DSN && !POSTHOG_KEY && !launch\?\.search && !unsaved\) \{/);
  const main = read('../main.jsx');
  assert.ok(main.indexOf('requestIdleCallback(opsAfterPaint') > main.indexOf('createRoot('), 'after the first render');
  // No screen or first-screen module pulls a library in up front
  for (const f of ['./ops.js', './ops-late.js', './crash.js', './crash-core.js', './analytics.js', './analytics-core.js', './attribution.js', '../main.jsx', '../App.jsx']) {
    assert.doesNotMatch(read(f), /from '(@sentry|posthog-js)/, f);
  }
  // Sentry: errors only, no replay, no tracing, no console or taps in breadcrumbs, scrubbed
  const sentry = read('./sentry-client.js');
  assert.doesNotMatch(sentry, /replayIntegration|browserTracingIntegration|tracesSampleRate/);
  assert.match(sentry, /defaultIntegrations: false/);
  assert.match(sentry, /console: false, dom: false/);
  assert.match(sentry, /beforeSend: event => \(allowed\(\) \? scrubEvent\(event\) : null\)/);
  assert.match(sentry, /userInfo: false/);
  // PostHog: no autocapture, no recording, nothing fetched from PostHog's CDN, no cookies
  const ph = read('./posthog-client.js');
  for (const line of ['autocapture: false', 'capture_pageview: false', 'disable_session_recording: true', 'disable_external_dependency_loading: true', "persistence: 'localStorage'"]) {
    assert.ok(ph.includes(line), line);
  }
  assert.match(ph, /posthog-js\/dist\/module\.slim/);
});

test('Settings has the Share usage data switch, on by default, and the privacy page names both services', () => {
  const settings = read('../screens/Settings.jsx');
  assert.match(settings, /Share usage data/);
  assert.match(settings, /s\.settings\.shareUsage = v/);
  assert.match(read('./store.js'), /shareUsage: true/);
  const privacy = read('../../public/privacy.html');
  for (const word of ['Sentry', 'PostHog', 'Share usage data', '%SUPPORT_EMAIL%', 'creator']) assert.ok(privacy.includes(word), word);
});
