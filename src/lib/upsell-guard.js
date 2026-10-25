// Never a paywall, an upsell or a Pro sheet while a round is live (roadmap area 11: 18Birdies' mid-round
// pop-ups get called "infuriating"). Every upsell surface asks upsellAllowed first, and the app's
// navigation (App.jsx) drops any route in UPSELL_ROUTES while a round is live, so nothing slips past.
// Only with the paywall flag on: with it off, nothing here changes anything.
// Kept tiny with no imports, since App.jsx (the first screen's bundle) reads it.

const HOUR = 60 * 60 * 1000;
/**
 * A round left "active" longer than this (started and never finished) no longer counts as live, so a
 * forgotten round from last week doesn't hide Pro for good. A real round, even 36 holes and the drive
 * home, is well inside it.
 */
export const LIVE_HOURS = 24;

/** The screens that are upsells: the paywall itself. Add any new Pro sheet or upsell screen here. */
export const UPSELL_ROUTES = new Set(['paywall']);

/** A round that counts as live: being played, watched or reopened to fix scores, and started inside LIVE_HOURS. */
export function roundIsLive(round, now = Date.now()) {
  if (!round || !(round.status === 'active' || round.editing)) return false;
  const started = round.createdAt;
  if (!Number.isFinite(started)) return true;
  return now - started < LIVE_HOURS * HOUR;
}

/** True when any round on this phone is live. */
export function anyRoundLive(state, now = Date.now()) {
  return Object.values(state?.rounds || {}).some(r => roundIsLive(r, now));
}

/**
 * The guard: whether a paywall, upsell or Pro sheet may show right now. `gated` is the paywall flag;
 * with it off this is always true, as there are no upsells to hold back.
 */
export function upsellAllowed(state, { gated = true, now = Date.now() } = {}) {
  if (!gated) return true;
  return !anyRoundLive(state, now);
}

/** Whether the app may open the screen `name` now: anything but an upsell, or an upsell when allowed. */
export function routeAllowed(name, state, opts = {}) {
  return !UPSELL_ROUTES.has(name) || upsellAllowed(state, opts);
}

/** A list of [name, params] routes with any upsell left out while a round is live. */
export function allowedRoutes(routes, state, opts = {}) {
  return routes.filter(r => routeAllowed(Array.isArray(r) ? r[0] : r?.name, state, opts));
}
