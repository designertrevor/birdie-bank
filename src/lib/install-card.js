// "Add it to your Home Screen": a card on Up next for testers using the app in a phone's browser,
// until it's in the App Store. On iPhone it matters more than it looks: notifications only work
// from the Home Screen, the browser can clear a site's saved data after a week unused, and the
// Home Screen app keeps its own saved data apart from Safari's, so it starts empty unless you're
// signed in. Pure, so the tests can drive it; InstallUpNext.jsx draws it.
import { iosVersion } from './notify-ask.js';

const DAY = 24 * 60 * 60 * 1000;
/** How long each "Not now" holds: a week, then a month, then it's gone for good. */
export const BACKOFF_DAYS = [7, 30];
export const INSTALL_KEY = 'bb-install';

/**
 * Which phone this is, for the steps: 'installed' (already opened from the Home Screen), 'ios'
 * (Safari, or another iPhone browser, which has Add to Home Screen in its share menu too),
 * 'android', or null (a computer, or anything else: no card).
 */
export function installPlatform({ ua = '', touch = false, standalone = false } = {}) {
  if (standalone) return 'installed';
  if (iosVersion(ua, touch) != null) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return null;
}

/** Which browser on an iPhone, for where its Share button is: 'safari', 'chrome', 'other'. */
export function iosBrowser(ua = '') {
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua)) return 'other';
  return 'safari';
}

/** The saved answers ({ notNow, notNowAt, done }) as they are, or empty. */
export function readPrefs(raw) {
  try {
    const p = JSON.parse(raw || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}

/** Whether the card is put away at `now`: added already, or a "Not now" still holding. */
export function putAway(prefs, now = Date.now()) {
  if (prefs?.done) return true;
  const n = prefs?.notNow || 0;
  if (!n) return false;
  if (n > BACKOFF_DAYS.length) return true;
  return now < (prefs.notNowAt || 0) + BACKOFF_DAYS[n - 1] * DAY;
}

/** The answers after a "Not now" at `now`. */
export function notNow(prefs, now = Date.now()) {
  return { ...prefs, notNow: (prefs?.notNow || 0) + 1, notNowAt: now };
}

/**
 * Whether to show the card: on a phone's browser (not the Home Screen app, not a computer), once
 * you're set up, never while a round is going on, and not while it's put away.
 */
export function showInstall({ platform, onboarded = false, roundOn = false, prefs = {}, now = Date.now() } = {}) {
  if (platform !== 'ios' && platform !== 'android') return false;
  if (!onboarded || roundOn) return false;
  return !putAway(prefs, now);
}

/**
 * Whether to say "save your rounds first": an iPhone's Home Screen app starts with nothing from
 * Safari, so anyone not signed in with something to lose signs in before adding it. Android's
 * installed app shares the browser's saved data, so it never needs this.
 */
export function needsSignInFirst({ platform, accounts = false, signedIn = false, hasData = false } = {}) {
  return platform === 'ios' && accounts && !signedIn && hasData;
}
