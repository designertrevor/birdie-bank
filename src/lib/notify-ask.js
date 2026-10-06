// When to ask for notifications. Never at launch: only right after something that earns it
// (you planned a round, or joined one), and only when this phone can get web push at all. We ask
// with our own sheet first (what you'd get, Turn on or Not now) and only then the browser's
// prompt, so a "Not now" never burns the one browser prompt. "Not now" backs off: two weeks, then
// two months, then never again from here (Settings still turns them on).
// Pure functions of plain data, so they're easy to test. No storage, no network.
//
// Prefs (this phone only, push-client.js keeps them): { notNow: count, notNowAt: ms, off: true
// when turned off in Settings, askedAt: ms of the last soft ask }

/** The moments that earn the ask. */
export const ASK_MOMENTS = ['planned', 'joined'];
/** Days to wait after the first and second "Not now". After the third, the app never asks again. */
export const BACKOFF_DAYS = [14, 60];
const DAY = 86400000;

/**
 * The iOS version from a user agent string, as a number (16.4), or null when it isn't iOS.
 * An iPad asking for the desktop site says it's a Mac; `touch` (navigator.maxTouchPoints > 1) catches that.
 */
export function iosVersion(ua = '', touch = false) {
  const m = /(?:iPhone|iPad|iPod)[^)]*? OS (\d+)[_.](\d+)/.exec(ua);
  if (m) return Number(`${m[1]}.${m[2]}`);
  if (/Macintosh/.test(ua) && touch) {
    const v = /Version\/(\d+)\.(\d+)/.exec(ua);
    return v ? Number(`${v[1]}.${v[2]}`) : 0;
  }
  return null;
}

/**
 * Whether this phone can get web push: { ok, why }. `why` is 'no-key' (no VAPID key set, so push
 * is off everywhere), 'ios-old' (iOS before 16.4 has no web push), 'ios-browser' (iOS only
 * sends web push to an app added to the Home Screen) or 'unsupported'.
 */
export function pushSupport({ key = '', ua = '', touch = false, standalone = false, serviceWorker = false, pushManager = false, notification = false } = {}) {
  if (!key) return { ok: false, why: 'no-key' };
  const ios = iosVersion(ua, touch);
  if (ios != null) {
    if (ios && ios < 16.4) return { ok: false, why: 'ios-old' };
    if (!standalone) return { ok: false, why: 'ios-browser' };
  }
  if (!serviceWorker || !pushManager || !notification) return { ok: false, why: 'unsupported' };
  return { ok: true, why: null };
}

/** Whether a "Not now" still holds at `now`. */
export function backingOff(prefs, now = Date.now()) {
  const n = prefs?.notNow || 0;
  if (!n) return false;
  if (n > BACKOFF_DAYS.length) return true;
  return now < (prefs.notNowAt || 0) + BACKOFF_DAYS[n - 1] * DAY;
}

/**
 * Whether to show our own "Want a heads-up?" sheet now. Only after a moment that earns it, on a
 * phone that can get push, signed in (a notification needs an account to go to), while the browser
 * still hasn't been asked, not turned off in Settings, not backing off from a "Not now", and at
 * most once a day whatever happens.
 */
export function shouldAsk({ moment, support, permission, signedIn, prefs = {}, now = Date.now() } = {}) {
  if (!ASK_MOMENTS.includes(moment)) return false;
  if (!support?.ok || !signedIn) return false;
  if (permission !== 'default') return false;
  if (prefs.off) return false;
  if (prefs.askedAt && now - prefs.askedAt < DAY) return false;
  return !backingOff(prefs, now);
}

/** The prefs after the soft ask was shown. */
export function afterShown(prefs = {}, now = Date.now()) {
  return { ...prefs, askedAt: now };
}

/** The prefs after "Not now": one more step back. */
export function afterNotNow(prefs = {}, now = Date.now()) {
  return { ...prefs, notNow: (prefs.notNow || 0) + 1, notNowAt: now };
}

/** The prefs after turning notifications on (from the sheet or Settings): no more backing off. */
export function afterOn(prefs = {}) {
  const { off: _off, notNow: _n, notNowAt: _a, ...rest } = prefs;
  return rest;
}

/** The prefs after turning them off in Settings: never asked again until turned back on there. */
export function afterOff(prefs = {}) {
  return { ...prefs, off: true };
}

/**
 * The Settings row: { show, on, disabled, sub }. Hidden with no key or no web push here at all;
 * on an iPhone in the browser it says how to get them.
 */
export function settingsRow({ support, permission, signedIn, prefs = {}, subscribed = false } = {}) {
  const why = support?.why;
  if (why === 'no-key' || why === 'ios-old' || why === 'unsupported') return { show: false };
  if (why === 'ios-browser') return { show: true, on: false, disabled: true, sub: 'Add this app to your Home Screen (Share, then Add to Home Screen), then turn them on here' };
  if (!signedIn) return { show: true, on: false, disabled: true, sub: 'Sign in first, so they know where to find you' };
  if (permission === 'denied') return { show: true, on: false, disabled: true, sub: 'Blocked in your browser’s settings for this site. Allow them there to turn them on' };
  const on = permission === 'granted' && !prefs.off && subscribed;
  return { show: true, on, disabled: false, sub: 'Round invites, who’s in, round results, payments to you and tee time reminders' };
}
