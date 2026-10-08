// Before a trip's first round is in, its standings say when the trip tees off instead of showing
// a dash for everyone: "Tees off Fri", from the first planned round's day (or the trip's first
// day while nothing is planned yet), with the tee time in the longer line under the table.
// Pure functions of plain data, so they're easy to test.
import { daysUntil, timeLabel } from './plan-basics.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Nothing planned and the trip's dates gone by, or no dates at all: the one line left to say. */
export const NOTHING_PLAYED = 'Nothing played yet';

/**
 * The day and tee time the trip tees off: the first planned round still to come (`planned`, soonest
 * first, as tripStatus lists them), or the trip's first day (`start`) while it's still ahead and
 * nothing is planned. Null once there's nothing ahead to point at.
 * { date: 'YYYY-MM-DD', teeTime: 'HH:MM' | null }
 */
export function teesOffAt({ planned = [], start = null } = {}, now = new Date()) {
  const first = planned.find(p => p?.date && (daysUntil(p.date, now) ?? -1) >= 0);
  if (first) return { date: first.date, teeTime: first.teeTime || null };
  if (start && (daysUntil(start, now) ?? -1) >= 0) return { date: start, teeTime: null };
  return null;
}

/**
 * The standings' line before the first round: "Tees off today", "Tees off tomorrow", "Tees off Fri"
 * (this week) or "Tees off Oct 16" (further out), short enough for the money column. `long` is the
 * line under the table, with the whole weekday and the tee time: "Tees off Friday at 7:40 AM".
 * "Nothing played yet" when there's nothing ahead.
 */
export function teesOffLine(trip, now = new Date(), { long = false } = {}) {
  const at = teesOffAt(trip, now);
  if (!at) return NOTHING_PLAYED;
  const n = daysUntil(at.date, now);
  const [y, m, d] = at.date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const when = n === 0 ? 'today'
    : n === 1 ? 'tomorrow'
    : n < 7 ? (long ? DAYS[day.getDay()] : DAYS[day.getDay()].slice(0, 3))
    : long ? `${DAYS[day.getDay()].slice(0, 3)}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : `${MONTHS[day.getMonth()]} ${day.getDate()}`;
  const time = long && at.teeTime ? timeLabel(at.teeTime) : '';
  return `Tees off ${when}${time ? ` at ${time}` : ''}`;
}
