// Where you were: the tab, the screens open on top of it, and what was typed or open on them, so
// coming back after a phone call, a GPS app or iOS dropping the page from memory lands on the same
// hole with the same sheet open, not back on Up next. Pure rules here; kept.js does the saving.

/** localStorage key for the saved place (one per phone). */
export const PLACE_KEY = 'kept-place';
/** A place older than this is stale: opening the app the next morning starts on Up next. */
export const PLACE_MAX_AGE = 4 * 3600e3;
/** Unsaved scores outlive the place while their round is still going, up to a day. */
export const DRAFT_MAX_AGE = 24 * 3600e3;
const MAX_STACK = 12;

// Params that only mean something the moment they're pushed: the reveal after finishing a round,
// and "open Add an expense" from Up next. Coming back shows the screen as it was left instead.
const ONE_SHOT = { roundDetail: ['celebrate'], trip: ['add'] };

// Screens whose `id` (or the plan they edit or start) names something on this phone. One that's
// gone since isn't brought back.
const NEEDS = {
  play: (s, id) => s.rounds?.[id]?.status === 'active',
  roundDetail: (s, id) => !!s.rounds?.[id],
  plan: (s, id) => !!s.plans?.[id],
  rollCall: (s, id) => !!s.plans?.[id],
  preview: (s, id) => !!s.plans?.[id],
  challenge: (s, id) => !!s.challenges?.[id],
  // A plan link comes back only once its plan is on this phone: a dead link ("Plan not found") never does
  planLink: (s, _id, p) => !!p.code && Object.values(s.plans || {}).some(x => x?.code === p.code),
  // Editing a plan, or the round setup a plan's roll call started: not once that plan is gone
  newRound: (s, _id, p) => [p.edit, p.fromPlan].every(pid => !pid || !!s.plans?.[pid]),
};

/** True for a plain JSON value (what survives a save): no functions, Sets or class instances. */
export function plainJSON(v, depth = 0) {
  if (depth > 12) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.every(x => plainJSON(x, depth + 1));
  if (typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(v).every(x => x === undefined || plainJSON(x, depth + 1));
  }
  return false;
}

/** What gets written: the tab, the screen stack (name, params, key) and the kept values. */
export function placeToSave({ tab, stack = [], kept = {}, maps = {}, at }) {
  const screens = [];
  for (const e of stack.slice(-MAX_STACK)) {
    // A screen that can't be written (a callback in its params) ends what can come back
    if (!e?.name || !plainJSON(e.params ?? {})) break;
    screens.push({ name: e.name, params: e.params ?? {}, key: e.key });
  }
  const keep = obj => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined && plainJSON(v)));
  return { at, tab, stack: screens, kept: keep(kept), maps: Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, keep(m)])) };
}

/**
 * The place to come back to, from what was saved: { tab, stack, kept, maps }, or null when there's
 * nothing fresh to restore. `screens` and `tabs` are the names the app knows. The stack is cut at the
 * first screen that can't open any more (an unknown name, a round since finished or deleted), so
 * back still walks the screens that were under it. Kept values only come back with their screens;
 * unsaved scores come back while their round is still going.
 */
export function readPlace(saved, state, { now = Date.now(), screens = [], tabs = [] } = {}) {
  if (!saved || typeof saved !== 'object' || !state?.onboarded) return null;
  const age = now - Number(saved.at);
  if (!(age >= 0)) return null;
  const known = new Set(screens);
  const stack = [];
  if (age <= PLACE_MAX_AGE) {
    for (const e of Array.isArray(saved.stack) ? saved.stack : []) {
      if (!e || !known.has(e.name) || !plainJSON(e.params ?? {}) || e.key == null) break;
      const params = { ...(e.params || {}) };
      for (const k of ONE_SHOT[e.name] || []) delete params[k];
      const need = NEEDS[e.name];
      if (need && !need(state, params.id, params)) break;
      stack.push({ name: e.name, params, key: e.key });
    }
  }
  const tab = age <= PLACE_MAX_AGE && tabs.includes(saved.tab) ? saved.tab : null;
  // Kept values belong to a screen (its key) or a tab ("tab:ledger"); only those coming back keep theirs
  const scopes = new Set(stack.map(e => String(e.key)));
  if (tab) scopes.add(`tab:${tab}`);
  const kept = Object.fromEntries(Object.entries(saved.kept || {}).filter(([k]) => scopes.has(k.slice(0, k.indexOf('|')))));
  // Unsaved scores are "roundId:holeNo": kept while that round is still being played
  const drafts = age <= DRAFT_MAX_AGE
    ? Object.fromEntries(Object.entries(saved.maps?.drafts || {}).filter(([k]) => state.rounds?.[k.split(':')[0]]?.status === 'active'))
    : {};
  if (!stack.length && !tab && !Object.keys(drafts).length) return null;
  return { tab, stack, kept, maps: { drafts } };
}

/** The kept values of the screens still open: `scopes` are their keys (and "tab:<tab>"). */
export function keptFor(kept, scopes) {
  const live = new Set(scopes.map(String));
  return Object.fromEntries(Object.entries(kept || {}).filter(([k]) => live.has(k.slice(0, k.indexOf('|')))));
}
