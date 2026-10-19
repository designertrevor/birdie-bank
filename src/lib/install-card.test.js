import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKOFF_DAYS, installPlatform, iosBrowser, needsSignInFirst, notNow, putAway, readPrefs, showInstall } from './install-card.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const DAY = 24 * 60 * 60 * 1000;

test('platform: iPhone, Android, the Home Screen app, and nothing on a computer', () => {
  assert.equal(installPlatform({ ua: IPHONE }), 'ios');
  assert.equal(installPlatform({ ua: IPHONE_CHROME }), 'ios', 'Chrome on iPhone has Add to Home Screen too');
  assert.equal(installPlatform({ ua: ANDROID }), 'android');
  assert.equal(installPlatform({ ua: IPHONE, standalone: true }), 'installed');
  assert.equal(installPlatform({ ua: MAC }), null, 'a Mac with no touch is a computer');
  assert.equal(installPlatform({ ua: MAC, touch: true }), 'ios', 'an iPad says it’s a Mac, with touch');
});

test('iPhone browser: where the Share button is', () => {
  assert.equal(iosBrowser(IPHONE), 'safari');
  assert.equal(iosBrowser(IPHONE_CHROME), 'chrome');
  assert.equal(iosBrowser('… FxiOS/130 …'), 'other');
});

test('shows once you’re set up, on a phone browser, never mid-round', () => {
  assert.equal(showInstall({ platform: 'ios', onboarded: true }), true);
  assert.equal(showInstall({ platform: 'android', onboarded: true }), true);
  assert.equal(showInstall({ platform: 'ios', onboarded: false }), false, 'not before setup');
  assert.equal(showInstall({ platform: 'ios', onboarded: true, roundOn: true }), false, 'not while a round is on');
  assert.equal(showInstall({ platform: 'installed', onboarded: true }), false, 'not in the Home Screen app');
  assert.equal(showInstall({ platform: null, onboarded: true }), false, 'not on a computer');
});

test('Not now: a week, then a month, then gone; Added it is gone for good', () => {
  const t0 = 1_700_000_000_000;
  let p = notNow({}, t0);
  assert.equal(putAway(p, t0 + 6 * DAY), true);
  assert.equal(putAway(p, t0 + (BACKOFF_DAYS[0] + 1) * DAY), false, 'back after a week');
  const t1 = t0 + 8 * DAY;
  p = notNow(p, t1);
  assert.equal(putAway(p, t1 + 29 * DAY), true);
  assert.equal(putAway(p, t1 + 31 * DAY), false, 'back after a month');
  p = notNow(p, t1 + 31 * DAY);
  assert.equal(putAway(p, t1 + 3650 * DAY), true, 'a third Not now is for good');
  assert.equal(putAway({ done: true }), true);
  assert.equal(showInstall({ platform: 'ios', onboarded: true, prefs: { done: true } }), false);
});

test('saved answers survive junk', () => {
  assert.deepEqual(readPrefs(null), {});
  assert.deepEqual(readPrefs('not json'), {});
  assert.deepEqual(readPrefs('{"notNow":1}'), { notNow: 1 });
});

test('sign in first: only on an iPhone, signed out, with rounds or players to lose', () => {
  assert.equal(needsSignInFirst({ platform: 'ios', accounts: true, signedIn: false, hasData: true }), true);
  assert.equal(needsSignInFirst({ platform: 'ios', accounts: true, signedIn: true, hasData: true }), false);
  assert.equal(needsSignInFirst({ platform: 'ios', accounts: true, signedIn: false, hasData: false }), false);
  assert.equal(needsSignInFirst({ platform: 'android', accounts: true, signedIn: false, hasData: true }), false, 'Android’s installed app shares the browser’s data');
  assert.equal(needsSignInFirst({ platform: 'ios', accounts: false, signedIn: false, hasData: true }), false, 'no accounts, nothing to sign in to');
});
