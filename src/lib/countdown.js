// How long until a planned round: "Saturday, 2 days", "Today, in 3 hours". Up next's cards and the
// preview both read it (see preview.js). Pure, tested in preview.test.js.
import { dayLabel, daysUntil, timeLabel } from './plan-basics.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDay(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** The plan's weekday by name ("Saturday"), whatever the distance. Empty with no date. */
export function weekdayOf(plan) {
  const d = parseDay(plan?.date);
  return d ? DAYS[d.getDay()] : '';
}

/** Minutes from `now` to the tee time on the plan's day, or null with no tee time. */
export function minutesToTee(plan, now = new Date()) {
  const d = parseDay(plan?.date);
  const m = /^(\d{1,2}):(\d{2})/.exec(String(plan?.teeTime || ''));
  if (!d || !m) return null;
  const tee = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]));
  return Math.round((tee - now) / 60000);
}

/** "in 45 minutes", "in 1 hour", "in 3 hours". */
function inTime(mins) {
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const h = Math.max(1, Math.round(mins / 60));
  return `in ${h} hour${h === 1 ? '' : 's'}`;
}

/**
 * How long until the round: { days, label, big, unit }. `label` is the line for Up next
 * ("Saturday, 2 days", "Tomorrow", "Today, in 3 hours", "Sat, Oct 11, 9 days"); `big` and `unit`
 * are the countdown tile ("2" "days", "1" "day", "Today"). Never "this week": always the day.
 * Null with no date.
 */
export function countdown(plan, now = new Date()) {
  const n = daysUntil(plan?.date, now);
  if (n == null) return null;
  const day = dayLabel(plan.date, now);
  if (n < 0) return { days: n, label: n === -1 ? 'Yesterday' : day, big: null, unit: null };
  if (n === 0) {
    const mins = minutesToTee(plan, now);
    return { days: 0, label: mins > 0 ? `Today, ${inTime(mins)}` : 'Today', big: 'Today', unit: null };
  }
  if (n === 1) return { days: 1, label: 'Tomorrow', big: '1', unit: 'day' };
  return { days: n, label: `${day}, ${n} days`, big: String(n), unit: 'days' };
}

/** How long to go, without the day: "2 days to go", "Tomorrow", "Today, in 3 hours". Empty once it's gone. */
export function toGoLabel(plan, now = new Date()) {
  const cd = countdown(plan, now);
  if (!cd || cd.days < 0) return '';
  return cd.days > 1 ? `${cd.days} days to go` : cd.label;
}

/** The Up next card's line: the countdown and the tee time, "Saturday, 2 days · 8:10 AM". */
export function countdownLine(plan, now = new Date()) {
  const cd = countdown(plan, now);
  return [cd?.label, timeLabel(plan?.teeTime)].filter(Boolean).join(' · ');
}
