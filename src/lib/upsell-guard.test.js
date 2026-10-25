// The upsell guard: never a paywall, upsell or Pro sheet while a round is live (paywall rules, overnight 13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_HOURS, UPSELL_ROUTES, allowedRoutes, anyRoundLive, roundIsLive, routeAllowed, upsellAllowed } from './upsell-guard.js';

const NOW = Date.UTC(2026, 9, 11, 18);
const HOUR = 3600000;
const round = (extra = {}) => ({ id: 'r1', status: 'active', createdAt: NOW - 2 * HOUR, ...extra });
const live = { rounds: { r1: round() } };
const done = { rounds: { r1: round({ status: 'done', finishedAt: NOW - HOUR }) } };

test('a round being played, watched or fixed is live; a finished one and a long-forgotten one are not', () => {
  assert.equal(roundIsLive(round(), NOW), true);
  assert.equal(roundIsLive(round({ status: 'done', editing: true }), NOW), true);
  assert.equal(roundIsLive(round({ status: 'done' }), NOW), false);
  assert.equal(roundIsLive(round({ createdAt: NOW - (LIVE_HOURS + 1) * HOUR }), NOW), false);
  assert.equal(roundIsLive(round({ createdAt: undefined }), NOW), true);
  assert.equal(roundIsLive(null, NOW), false);
  assert.equal(anyRoundLive(live, NOW), true);
  assert.equal(anyRoundLive(done, NOW), false);
  assert.equal(anyRoundLive({}, NOW), false);
});

test('no paywall or upsell while a round is live, with the flag on', () => {
  assert.equal(upsellAllowed(live, { now: NOW }), false);
  assert.equal(upsellAllowed(done, { now: NOW }), true);
  assert.equal(upsellAllowed({ rounds: {} }, { now: NOW }), true);
});

test('with the paywall flag off the guard changes nothing', () => {
  assert.equal(upsellAllowed(live, { gated: false, now: NOW }), true);
  assert.equal(routeAllowed('paywall', live, { gated: false, now: NOW }), true);
});

test('navigation drops the paywall while a round is live and lets everything else through', () => {
  assert.ok(UPSELL_ROUTES.has('paywall'));
  assert.equal(routeAllowed('paywall', live, { now: NOW }), false);
  assert.equal(routeAllowed('paywall', done, { now: NOW }), true);
  assert.equal(routeAllowed('play', live, { now: NOW }), true);
  assert.equal(routeAllowed('yourPlan', live, { now: NOW }), true);
  // The onboarding reset ([name, params]) and a restored stack ({ name }) both lose only the paywall
  assert.deepEqual(allowedRoutes([['plan', { id: 'p' }], ['paywall', { source: 'onboarding' }]], live, { now: NOW }), [['plan', { id: 'p' }]]);
  assert.deepEqual(allowedRoutes([{ name: 'paywall' }, { name: 'season' }], live, { now: NOW }).map(r => r.name), ['season']);
  assert.equal(allowedRoutes([['paywall', {}]], done, { now: NOW }).length, 1);
});
