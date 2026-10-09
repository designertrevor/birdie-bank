import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, REOPEN_AFTER, cleanProps, createTracker, daysBetween, openProps } from './analytics-core.js';
import { attachTracker, roundProps, track, trackingOff, waitingCount } from './analytics.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const DAY = 864e5;

/** A stand-in PostHog client that writes down what it's asked. */
function fakeClient() {
  const log = [];
  return {
    log,
    capture: (e, p) => log.push(['capture', e, p]),
    identify: id => log.push(['identify', id]),
    reset: () => log.push(['reset']),
    setEnabled: on => log.push(['enabled', on]),
  };
}

test('analytics: without a key it does nothing, loads nothing and keeps nothing', async () => {
  const t = createTracker();
  t.track('app_opened', { first_open: true });
  assert.equal(t.status().queued, 1, 'waits until ops.js starts it');
  let loaded = false;
  t.start({ key: '', load: () => { loaded = true; return fakeClient(); } });
  await tick();
  assert.equal(loaded, false);
  assert.deepEqual(t.status(), { state: 'off', queued: 0 });
  t.track('round_started', { game: 'wolf' });
  assert.equal(t.status().queued, 0);
});

test('analytics: events before the library loads wait, then go in order once it is up', async () => {
  const t = createTracker();
  const c = fakeClient();
  t.track('app_opened', { first_open: true });
  t.identify('abc123');
  t.start({ key: 'phc_test', load: () => c });
  t.track('round_started', { game: 'wolf', holes: 18 });
  await tick();
  assert.equal(t.status().state, 'ready');
  assert.deepEqual(c.log, [
    ['capture', 'app_opened', { first_open: true }],
    ['identify', 'abc123'],
    ['capture', 'round_started', { game: 'wolf', holes: 18 }],
  ]);
  t.track('round_finished', { game: 'wolf' });
  assert.deepEqual(c.log.at(-1), ['capture', 'round_finished', { game: 'wolf' }]);
});

test('analytics: unknown events are ignored, and every event carries where the phone came from', async () => {
  const t = createTracker();
  const c = fakeClient();
  t.start({ key: 'k', load: () => c, context: () => ({ ref: 'goodgood', ref_landing: '/rules/wolf', ref_new: true }) });
  await tick();
  t.track('clicked_everything', { game: 'wolf' });
  t.track('paywall_viewed', { source: 'onboarding', variant: 'c' });
  assert.deepEqual(c.log, [['capture', 'paywall_viewed', { source: 'onboarding', variant: 'c', ref: 'goodgood', ref_landing: '/rules/wolf', ref_new: true }]]);
});

test('analytics: Share usage data off sends nothing and never loads the library; on again loads it', async () => {
  let on = false;
  let loads = 0;
  const c = fakeClient();
  const t = createTracker();
  t.track('app_opened', {});
  t.start({ key: 'k', allowed: () => on, load: () => { loads += 1; return c; } });
  await tick();
  assert.equal(loads, 0);
  assert.equal(t.status().queued, 0, 'what waited is dropped');
  on = true;
  t.sharingChanged(true);
  await tick();
  assert.equal(loads, 1);
  t.track('plan_created', { game: 'nassau' });
  on = false;
  t.sharingChanged(false);
  t.track('round_started', { game: 'nassau' });
  assert.deepEqual(c.log, [['capture', 'plan_created', { game: 'nassau' }], ['enabled', false]]);
});

test('analytics: a load that fails (no signal) keeps the events and tries again on the next one', async () => {
  let fail = true;
  const c = fakeClient();
  const t = createTracker();
  t.start({ key: 'k', load: () => (fail ? Promise.reject(new Error('offline')) : c) });
  t.track('app_opened', { first_open: false });
  await tick();
  assert.equal(t.status().state, 'waiting');
  fail = false;
  t.track('round_started', { game: 'skins' });
  await tick();
  assert.deepEqual(c.log.map(x => x[1]), ['app_opened', 'round_started']);
});

test('analytics: the queue is capped, so a phone offline for ages never piles up', () => {
  const t = createTracker();
  for (let i = 0; i < 80; i++) t.track('app_opened', {});
  assert.equal(t.status().queued, 50);
});

test('analytics: a client that throws never breaks the app', async () => {
  const t = createTracker();
  t.start({ key: 'k', load: () => ({ capture() { throw new Error('boom'); }, identify() {}, reset() {}, setEnabled() {} }) });
  await tick();
  assert.doesNotThrow(() => t.track('app_opened', {}));
});

test('cleanProps: only the allowed keys, and only numbers, yes/no and short slugs', () => {
  assert.deepEqual(cleanProps({
    game: 'wolf', holes: 18, players: 4, trip: false,
    name: 'Bob', email: 'bob@example.com', course: 'Pebble Beach', amount: 40, total: 120, scores: [4, 5],
  }), { game: 'wolf', holes: 18, players: 4, trip: false });
  // An allowed key with a value that could be personal is dropped too
  assert.deepEqual(cleanProps({ source: 'bob@example.com', game: 'Pebble Beach', app: 'venmo', days_since_open: NaN }), { app: 'venmo' });
  assert.deepEqual(cleanProps(null), {});
  assert.deepEqual(cleanProps({ ref_landing: '/?join', ref: 'good-good_1' }), { ref_landing: '/?join', ref: 'good-good_1' });
});

test('the event list is the one the roadmap asks for', () => {
  assert.deepEqual([...EVENTS].sort(), ['app_opened', 'onboarding_finished', 'paywall_viewed', 'plan_created', 'plan_picked', 'request_sent', 'round_finished', 'round_started']);
});

test('openProps: days since the last open and the last round, and a quick return is not a new open', () => {
  const now = Date.UTC(2026, 9, 9, 15);
  assert.deepEqual(openProps({ lastOpenAt: 0, now }), { first_open: true, rounds_done: 0 });
  assert.deepEqual(openProps({ lastOpenAt: now - 3 * DAY - 5000, now, lastRoundAt: now - 10 * DAY, roundsDone: 7 }),
    { first_open: false, rounds_done: 7, days_since_open: 3, days_since_round: 10 });
  assert.equal(openProps({ lastOpenAt: now - REOPEN_AFTER + 1000, now }), null);
  assert.deepEqual(openProps({ lastOpenAt: now - REOPEN_AFTER, now }), { first_open: false, rounds_done: 0, days_since_open: 0 });
  assert.equal(daysBetween(null, now), null);
  assert.equal(daysBetween(now + 1, now), null, 'a clock that went backwards says nothing');
});

test('roundProps: the shape of a round, never its people, course or money', () => {
  const round = {
    game: 'nassau', holes: Array(9).fill({}), course: { name: 'Pebble Beach' },
    players: [{ id: 'a', name: 'Bob' }, { id: 'b', name: 'Al' }], sideGames: [{ game: 'skins' }], settings: { nassau: { front: 20 } },
  };
  const p = cleanProps(roundProps(round, { from: 'setup' }));
  assert.deepEqual(p, { game: 'nassau', holes: 9, players: 2, sides: 1, trip: false, from: 'setup' });
  assert.deepEqual(roundProps(null, { early: true }), { early: true });
});

test('track (the first-screen part): waits for the tracker, hands it over in order, then goes straight to it', () => {
  assert.doesNotThrow(() => track('app_opened', { first_open: true }));
  track('round_started', { game: 'wolf' });
  assert.equal(waitingCount(), 2);
  const got = [];
  attachTracker({ track: (e, p) => got.push([e, p]), identify() {}, reset() {} });
  assert.equal(waitingCount(), 0);
  track('round_finished', { game: 'wolf' });
  assert.deepEqual(got.map(x => x[0]), ['app_opened', 'round_started', 'round_finished']);
  // No key: everything after is ignored
  trackingOff();
  track('plan_created', {});
  assert.equal(got.length, 3);
  assert.equal(waitingCount(), 0);
});
