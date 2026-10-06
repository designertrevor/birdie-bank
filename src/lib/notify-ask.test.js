import test from 'node:test';
import assert from 'node:assert/strict';
import { afterNotNow, afterOff, afterOn, afterShown, backingOff, iosVersion, pushSupport, settingsRow, shouldAsk } from './notify-ask.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 8, 12);
const IPHONE_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const IPHONE_16_3 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const web = { serviceWorker: true, pushManager: true, notification: true };
const ok = { ok: true, why: null };
const ask = over => shouldAsk({ moment: 'planned', support: ok, permission: 'default', signedIn: true, prefs: {}, now: NOW, ...over });

test('iOS versions come from the user agent, an iPad asking for the desktop site included', () => {
  assert.equal(iosVersion(IPHONE_17), 17.2);
  assert.equal(iosVersion(IPHONE_16_3), 16.3);
  assert.equal(iosVersion(IPAD_DESKTOP, true), 17.1);
  assert.equal(iosVersion(IPAD_DESKTOP, false), null);
  assert.equal(iosVersion(ANDROID), null);
});

test('no VAPID key means no push anywhere', () => {
  assert.deepEqual(pushSupport({ key: '', ua: ANDROID, ...web }), { ok: false, why: 'no-key' });
});

test('an iPhone only gets web push as a Home Screen app on iOS 16.4 or later', () => {
  assert.equal(pushSupport({ key: 'k', ua: IPHONE_17, standalone: false, ...web }).why, 'ios-browser');
  assert.equal(pushSupport({ key: 'k', ua: IPHONE_16_3, standalone: true, ...web }).why, 'ios-old');
  assert.equal(pushSupport({ key: 'k', ua: IPHONE_17, standalone: true, ...web }).ok, true);
});

test('a browser without service workers or push is unsupported', () => {
  assert.equal(pushSupport({ key: 'k', ua: ANDROID, serviceWorker: true, pushManager: false, notification: true }).why, 'unsupported');
  assert.equal(pushSupport({ key: 'k', ua: ANDROID, ...web }).ok, true);
});

test('the ask only comes right after planning or joining a round, never at launch', () => {
  assert.equal(ask({ moment: 'planned' }), true);
  assert.equal(ask({ moment: 'joined' }), true);
  assert.equal(ask({ moment: 'launch' }), false);
  assert.equal(ask({ moment: undefined }), false);
});

test('no ask where push cannot work, signed out, or once the browser has been asked', () => {
  assert.equal(ask({ support: { ok: false, why: 'ios-browser' } }), false);
  assert.equal(ask({ signedIn: false }), false);
  assert.equal(ask({ permission: 'granted' }), false);
  assert.equal(ask({ permission: 'denied' }), false);
});

test('Not now backs off two weeks, then two months, then for good', () => {
  let prefs = afterNotNow({}, NOW);
  assert.equal(ask({ prefs, now: NOW + 13 * DAY }), false);
  assert.equal(ask({ prefs, now: NOW + 15 * DAY }), true);
  prefs = afterNotNow(prefs, NOW + 15 * DAY);
  assert.equal(ask({ prefs, now: NOW + 60 * DAY }), false);
  assert.equal(ask({ prefs, now: NOW + 76 * DAY }), true);
  prefs = afterNotNow(prefs, NOW + 76 * DAY);
  assert.equal(prefs.notNow, 3);
  assert.equal(backingOff(prefs, NOW + 3650 * DAY), true);
  assert.equal(ask({ prefs, now: NOW + 3650 * DAY }), false);
});

test('at most one ask a day, and never once turned off in Settings', () => {
  const shown = afterShown({}, NOW);
  assert.equal(ask({ prefs: shown, now: NOW + 3600000 }), false);
  assert.equal(ask({ prefs: shown, now: NOW + DAY + 1 }), true);
  assert.equal(ask({ prefs: afterOff({}) }), false);
});

test('turning them on clears the back-off and the off switch', () => {
  const prefs = afterOn({ notNow: 3, notNowAt: NOW, off: true, askedAt: NOW });
  assert.deepEqual(prefs, { askedAt: NOW });
});

test('the Settings row hides where push cannot work and explains the iPhone browser', () => {
  assert.equal(settingsRow({ support: { ok: false, why: 'no-key' } }).show, false);
  assert.equal(settingsRow({ support: { ok: false, why: 'ios-old' } }).show, false);
  const ios = settingsRow({ support: { ok: false, why: 'ios-browser' }, signedIn: true });
  assert.equal(ios.show, true);
  assert.equal(ios.disabled, true);
  assert.match(ios.sub, /Home Screen/);
});

test('the Settings row is on only when allowed, subscribed and not turned off', () => {
  assert.equal(settingsRow({ support: ok, signedIn: false }).disabled, true);
  assert.equal(settingsRow({ support: ok, signedIn: true, permission: 'denied' }).disabled, true);
  assert.equal(settingsRow({ support: ok, signedIn: true, permission: 'default' }).on, false);
  assert.equal(settingsRow({ support: ok, signedIn: true, permission: 'granted', subscribed: true }).on, true);
  assert.equal(settingsRow({ support: ok, signedIn: true, permission: 'granted', subscribed: true, prefs: { off: true } }).on, false);
});
