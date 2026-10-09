// Usage counts, the part every screen imports: `track(event, props)`. Tiny on purpose, since it's on
// the first screen. Until the tracker (analytics-core.js) is loaded after the first paint, events
// wait here; without a PostHog key it never loads and they're dropped (ops-late.js). The tracker
// checks the event names, keeps only allowed properties and honours Share usage data.
const MAX_QUEUE = 50;
let impl = null;
let off = false;
let queue = [];

const call = (kind, a, b) => {
  if (off) return;
  if (impl) { try { impl[kind](a, b); } catch { /* never let counting break the app */ } return; }
  if (queue.length < MAX_QUEUE) queue.push([kind, a, b]);
};

/** Count one moment (see EVENTS in analytics-core.js). Safe anywhere: a no-op without a key or with sharing off. */
export const track = (event, props) => call('track', event, props);
/** The account, as an opaque id (never an email). */
export const identify = id => call('identify', id);
/** Signed out: the next events start a fresh anonymous id. */
export const reset = () => call('reset');

/** Hand the waiting events to the tracker and send the rest straight to it. */
export function attachTracker(tracker) {
  impl = tracker;
  const waiting = queue;
  queue = [];
  waiting.forEach(([kind, a, b]) => call(kind, a, b));
}
/** No key: drop what waited and ignore the rest. */
export function trackingOff() { off = true; queue = []; }
/** For tests: how many wait. */
export const waitingCount = () => queue.length;

/** The shape of a round for round_started and round_finished: game, holes, players, side games. Never a name, course or amount. */
export function roundProps(round, extra = {}) {
  if (!round) return { ...extra };
  return {
    game: round.game,
    holes: Array.isArray(round.holes) ? round.holes.length : undefined,
    players: Array.isArray(round.players) ? round.players.length : undefined,
    sides: Array.isArray(round.sideGames) ? round.sideGames.length : 0,
    trip: !!round.trip,
    ...extra,
  };
}
