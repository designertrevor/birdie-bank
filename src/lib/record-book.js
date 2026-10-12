// The Record Book limit (roadmap area 8). With the paywall flag on and no Pro, the record views
// (History, Player cards, rivalry cards, Your stats, Hall of fame) show the last FREE_ROUNDS
// finished rounds; older ones are hidden from those views, never deleted, and Pro (the trial, a paid
// plan or Pro for life) brings every one back. With the flag off (testers today) nothing changes.
//
// Hidden means hidden in a view only. This returns a copy of the state for those screens to read;
// the stored state, sync and the money never see it. The Tab, settle-up, carry-overs, payments,
// trips and Season money keep reading the real state, so every round still counts there.
// Pure, unit tested (record-book.test.js).
import { countsAsDone } from './big-money.js';
import { linksOf } from './people-links.js';
import { roundTime } from './rounds-live.js';
import { BIG_FORMAT } from './big-format.js';

/** How many finished rounds a free group sees in its record views. */
export const FREE_ROUNDS = 10;

/**
 * Whether the record views are limited on this phone: only with the paywall flag on (`gated`) and
 * no Pro. `pro` is true for the trial, a paid plan and Pro for life (canUsePro in entitlements.js).
 */
export function recordBookLimited({ gated = false, pro = false } = {}) {
  return !!gated && !pro;
}

/**
 * Who is who, worked out from every round, written as plain links. Several links come from the
 * rounds themselves (a claimed seat in a joined round), so a view without the older rounds would
 * otherwise split a friend into two cards. Each id goes straight to the id kept for its person.
 */
function frozenLinks(state) {
  const L = linksOf(state);
  const links = { ...(state?.links && typeof state.links === 'object' ? state.links : {}) };
  const ids = new Set(Object.keys(state?.players || {}));
  for (const r of Object.values(state?.rounds || {})) for (const p of r?.players || []) if (p?.id) ids.add(p.id);
  for (const id of ids) {
    const kept = L.personOf(id);
    if (kept && kept !== id && !(id in links)) links[id] = kept;
  }
  return links;
}

/**
 * The state the record views read. Returns:
 * - state: the same object when nothing is hidden, else a copy whose `rounds` leave out finished
 *   rounds older than the newest `keep` (rounds still being played always stay), with who-is-who
 *   carried over from every round;
 * - limited: the limit is on (flag on, no Pro), whether or not anything is hidden yet;
 * - hidden: how many finished rounds are left out of the views;
 * - total: how many finished rounds there are in all.
 */
export function recordBookView(state, { gated = false, pro = false, keep = FREE_ROUNDS } = {}) {
  const limited = recordBookLimited({ gated, pro });
  const units = finishedUnits(state);
  const total = units.length;
  if (!limited || total <= keep) return { state, limited, hidden: 0, total };
  // Newest first; a tie on time goes by key, so every phone hides the same rounds
  const sorted = [...units].sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
  // A unit with a round still being played always stays, whatever its age
  const gone = sorted.slice(keep).filter(u => !u.rounds.some(r => r?.status === 'active'));
  if (!gone.length) return { state, limited, hidden: 0, total };
  const out = new Set();
  for (const u of gone) for (const r of u.rounds) out.add(r);
  const kept = {};
  for (const [k, r] of Object.entries(state.rounds)) if (!out.has(r)) kept[k] = r;
  return { state: { ...state, rounds: kept, links: frozenLinks(state) }, limited, hidden: gone.length, total };
}

/**
 * The finished rounds as the record views count them, one unit each. A Big Game is one unit with
 * every round of its groups: its money is worked out from all of them together (big-money.js), so
 * hiding some of its group rounds would move or drop the game's money in the views that remain.
 */
function finishedUnits(state) {
  const rounds = Object.values(state?.rounds || {}).filter(Boolean);
  const bigKey = r => (r?.trip?.format === BIG_FORMAT && r.trip.id ? `big:${r.trip.id}` : null);
  const byBig = new Map();
  for (const r of rounds) {
    const k = bigKey(r);
    if (k) byBig.set(k, [...(byBig.get(k) || []), r]);
  }
  const units = new Map();
  for (const r of rounds) {
    if (!countsAsDone(state, r)) continue;
    const big = bigKey(r);
    const key = big || `round:${r.id}`;
    const at = roundTime(r);
    const u = units.get(key);
    if (u) u.at = Math.max(u.at, at);
    else units.set(key, { key, at, rounds: big ? byBig.get(big) : [r] });
  }
  return [...units.values()];
}

/**
 * The calm line under a record view, or null when there's nothing to say: nothing hidden, or a
 * round is being played right now (never an upsell during a live round).
 */
export function recordBookLine({ hidden = 0, live = false, keep = FREE_ROUNDS } = {}) {
  if (!hidden || live) return null;
  const older = hidden === 1 ? 'the 1 older round' : `the ${hidden} older rounds`;
  return {
    title: `Your last ${keep} rounds`,
    text: `Pro brings back ${older}. Nothing is deleted, and the Tab still counts every round.`,
  };
}
