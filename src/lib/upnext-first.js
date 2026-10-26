// What Up next's first paint can tell from the state without the Tab's money (ledger.js, trips.js
// and the rest load just after it, see UpNext.jsx): whether there's a finished round, and whether
// there's a trip about. Pure, tested in upnext-first.test.js.
import { roundTime } from './rounds-live.js';
import { daysUntil } from './plan-basics.js';
import { minutesToTee } from './countdown.js';

/** Your newest finished round (any you kept, as History counts them), or null. The same round lastResult() names. */
export function lastDoneRound(state) {
  return Object.values(state?.rounds || {}).filter(r => r?.status === 'done').sort((a, b) => roundTime(b) - roundTime(a))[0] || null;
}

/**
 * Whether any trip is about, from the same places tripsOf() reads: a trip of its own, or a round
 * or plan stamped with one. A trip that's over or hidden still counts: the standing (trips.js)
 * decides what shows, and that comes with the money just after the first paint.
 */
export function anyTrips(state) {
  if (Object.values(state?.trips || {}).some(t => t?.id)) return true;
  if (Object.values(state?.rounds || {}).some(r => r?.trip?.id)) return true;
  return Object.values(state?.plans || {}).some(p => p?.trip?.id);
}

/** Finished rounds before Up next shows the number tiles: fewer and they'd be mostly zeros. */
export const TILES_FROM = 3;

/** How many rounds you've finished (as lastDoneRound counts them), for the number tiles. */
export function doneCount(state) {
  return Object.values(state?.rounds || {}).filter(r => r?.status === 'done').length;
}

/**
 * The upcoming plan the countdown strip counts down to: the first of `plans` (upcomingPlans order)
 * that's still on, still ahead, and that you haven't said you're out of. Null with none, so a
 * phone with nothing planned shows no ticking clock.
 */
export function nextPlan(plans, now = new Date()) {
  return (plans || []).find(p => {
    if (!p || p.status !== 'planned' || p.gone || p.movedTo) return false;
    const days = daysUntil(p.date, now);
    if (days == null || days < 0) return false;
    // Today's round whose tee time has been and gone has nothing left to count
    if (days === 0 && (minutesToTee(p, now) ?? 1) <= 0) return false;
    const me = p.host ? p.hostWho : p.localMe;
    return p.answers?.[me]?.status !== 'out';
  }) || null;
}

const pad = n => String(n).padStart(2, '0');

/**
 * The countdown strip's clock: with a tee time, `parts` like [['03', 'd'], ['21', 'h'], ['04', 'm']]
 * (no days on the day itself); without one, `words` ("4 days", "Tomorrow", "Today"). Null once
 * it's gone.
 */
export function stripClock(plan, now = new Date()) {
  const days = daysUntil(plan?.date, now);
  if (days == null || days < 0) return null;
  const mins = minutesToTee(plan, now);
  if (mins == null) return { words: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days` };
  if (mins <= 0) return null;
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return { parts: [...(d ? [[pad(d), 'd']] : []), [pad(h), 'h'], [pad(m), 'm']] };
}
