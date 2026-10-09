// Usage counts: a handful of moments (the app opened, a round started or finished, a plan made,
// onboarding done, the paywall seen and answered, a payment request sent), so Trevor can see rounds
// per week, how many days pass between opens and who upgrades. Never a name, an email, a course or
// an amount: each event's properties come from a short list of allowed keys, and every value is a
// number, a yes/no or a short slug like a game id.
//
// This is the tracker behind `track` (analytics.js, the tiny part screens import). ops-late.js loads
// it after the first paint, and only with a PostHog key; events tracked before PostHog loads wait in
// a short queue. "Share usage data" off in Settings drops them. Pure: the library is handed in
// (`load`), so the tests drive it with a stand-in.

// The events, by name, so a typo can't make a new one
export const EVENTS = new Set([
  'app_opened', 'round_started', 'round_finished', 'plan_created', 'onboarding_finished',
  'paywall_viewed', 'plan_picked', 'request_sent',
]);

// Every property any event may carry. Anything else is dropped on the phone.
const PROP_KEYS = new Set([
  'days_since_open', 'days_since_round', 'first_open', 'rounds_done',
  'game', 'holes', 'players', 'sides', 'trip', 'from', 'early', 'shared', 'role',
  'invited', 'path', 'source', 'variant', 'choice', 'plan', 'app', 'via',
  'ref', 'ref_landing', 'ref_new',
]);
const SLUG = /^[A-Za-z0-9_./?:-]{1,48}$/;
const MAX_QUEUE = 50;

/** Only the allowed keys, with numbers, yes/no and short slugs as values (nothing with an @ or a space). */
export function cleanProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const [k, v] of Object.entries(props)) {
    if (!PROP_KEYS.has(k)) continue;
    if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'string' && SLUG.test(v)) out[k] = v;
  }
  return out;
}

const DAY = 864e5;
/** Whole days between two times (0 the same day it happened), or null without a start. */
export const daysBetween = (from, to) => (from && to >= from ? Math.floor((to - from) / DAY) : null);

// A return to the app counts as a new open after this long away
export const REOPEN_AFTER = 30 * 60 * 1000;

/**
 * The app_opened properties for an open at `now`, or null when it's too soon after the last one to
 * count (the phone came back from another app within half an hour). `lastRoundAt`: when the last
 * round on this phone finished; `roundsDone`: how many it has.
 */
export function openProps({ lastOpenAt, now, lastRoundAt = null, roundsDone = 0 }) {
  if (lastOpenAt && now - lastOpenAt < REOPEN_AFTER) return null;
  const props = { first_open: !lastOpenAt, rounds_done: roundsDone };
  const d = daysBetween(lastOpenAt, now);
  if (d != null) props.days_since_open = d;
  const r = daysBetween(lastRoundAt, now);
  if (r != null) props.days_since_round = r;
  return props;
}

/**
 * A tracker. `load()` resolves to the client ({ capture, identify, reset, setEnabled }); `allowed()`
 * says whether Share usage data is on; `context()` gives properties every event carries (where
 * the phone came from). Before `start()` events wait; `start()` with no key turns it off for good.
 */
export function createTracker() {
  let state = 'waiting'; // 'waiting' | 'loading' | 'ready' | 'off'
  let client = null;
  let opts = { load: null, allowed: () => true, context: () => ({}) };
  let queue = [];

  const allowed = () => { try { return opts.allowed() !== false; } catch { return false; } };
  const push = item => { if (queue.length < MAX_QUEUE) queue.push(item); };
  const run = ([kind, a, b]) => {
    try {
      if (kind === 'capture') client.capture(a, b);
      else if (kind === 'identify') client.identify(a);
      else if (kind === 'reset') client.reset();
    } catch { /* never let counting break the app */ }
  };
  const load = () => {
    if (state !== 'waiting' || !opts.load || !allowed()) return;
    state = 'loading';
    Promise.resolve().then(opts.load).then(c => {
      if (!c) { state = 'off'; queue = []; return; }
      client = c;
      state = 'ready';
      const waiting = queue;
      queue = [];
      if (allowed()) waiting.forEach(run);
    }).catch(() => { state = 'waiting'; });
  };

  return {
    /** Count one moment. Unknown events are ignored; properties are cleaned (cleanProps). */
    track(event, props) {
      if (state === 'off' || !EVENTS.has(event)) return;
      if (state !== 'waiting' && !allowed()) return;
      let ctx = {};
      try { ctx = opts.context() || {}; } catch { /* no context */ }
      const item = ['capture', event, cleanProps({ ...props, ...ctx })];
      if (state === 'ready') run(item);
      else { push(item); if (state === 'waiting') load(); } // a load that failed (no signal) tries again
    },
    /** The account, as an opaque id (never an email). */
    identify(id) {
      if (state === 'off' || !id) return;
      if (state === 'ready') { if (allowed()) run(['identify', id]); } else push(['identify', id]);
    },
    /** Signed out: the next events start a fresh anonymous id. */
    reset() {
      if (state === 'ready') run(['reset']);
    },
    /**
     * Start it: `key` (none turns it off and drops the queue), `load`, `allowed`, `context`.
     * Loads the library now unless Share usage data is off, in which case `sharingChanged` loads it later.
     */
    start({ key, load: loader, allowed: isAllowed, context } = {}) {
      if (state !== 'waiting') return;
      if (!key || !loader) { state = 'off'; queue = []; return; }
      opts = { load: loader, allowed: isAllowed || (() => true), context: context || (() => ({})) };
      if (!allowed()) queue = [];
      load();
    },
    /** Share usage data was switched: on loads it (if it hadn't), off stops sending. */
    sharingChanged(on) {
      if (state === 'off') return;
      if (!on) queue = [];
      if (client) { try { client.setEnabled(!!on); } catch { /* ignore */ } }
      if (on) load();
    },
    /** For tests and the Settings row: 'waiting' | 'loading' | 'ready' | 'off', and the queue length. */
    status() { return { state, queued: queue.length }; },
  };
}
