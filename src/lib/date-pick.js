// The date and tee time pickers' logic (components/DatePicker.jsx): month grids, min and max,
// ranges, quick picks and time steps. Values are the strings the native inputs used to give back,
// "YYYY-MM-DD" for a day and "HH:MM" (24 hour) for a time, "" when empty, so nothing that reads
// them changes. Pure functions of their arguments (and `now`), so they're easy to test.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = n => String(n).padStart(2, '0');

/** "2026-10-05" for a local date. */
export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local date for "2026-10-05", or null when it isn't a real day ("2026-02-31", "", junk). */
export function fromISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

export const todayISO = (now = new Date()) => toISO(now);

/** The day `n` days after (or before) `iso`. */
export function addDays(iso, n) {
  const d = fromISO(iso);
  return d ? toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)) : '';
}

/** The same day `n` months on, kept inside the month ("Jan 31" plus one month is "Feb 28"). */
export function addMonths(iso, n) {
  const d = fromISO(iso);
  if (!d) return '';
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last)));
}

/**
 * Whether a day ("2026-10-05"), a month ("2026-10") or a year ("2026") is allowed between min and
 * max (each a day, or empty for no limit). A month or year counts when any of its days does.
 */
export function inBounds(v, min, max) {
  if (!v) return false;
  return (!min || v >= min.slice(0, v.length)) && (!max || v <= max.slice(0, v.length));
}

/** The nearest allowed day to `iso`. */
export function clampISO(iso, min, max) {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** "October 2026" */
export const monthTitle = (year, month) => `${MONTHS[month]} ${year}`;

/**
 * One month as six weeks of seven days, Sunday first, so the sheet stays the same height from
 * month to month. Each cell: { iso, day, outside (another month's day), disabled, today }.
 */
export function monthGrid(year, month, { min, max, today } = {}) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i);
      const iso = toISO(d);
      week.push({ iso, day: d.getDate(), outside: d.getMonth() !== month, disabled: !inBounds(iso, min, max), today: iso === today });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Whether stepping a month back (-1) or on (+1) from year/month reaches an allowed day. */
export function canStepMonth(year, month, dir, min, max) {
  const d = new Date(year, month + dir, 1);
  return inBounds(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`, min, max);
}

/** The twelve months of a year for the month view: [{ month, label, ym, disabled }]. */
export function monthCells(year, { min, max } = {}) {
  return MONTHS_SHORT.map((label, month) => {
    const ym = `${year}-${pad(month + 1)}`;
    return { month, label, ym, disabled: !inBounds(ym, min, max) };
  });
}

/** The page of twelve years holding `year` for the year view (pages start on a multiple of 12): [{ year, disabled }]. */
export function yearCells(year, { min, max } = {}) {
  const from = year - (((year % 12) + 12) % 12);
  return Array.from({ length: 12 }, (_, i) => ({ year: from + i, disabled: !inBounds(String(from + i), min, max) }));
}

/**
 * Where the keyboard cursor goes from `iso` for a key in the day grid: arrows a day or a week,
 * Page Up and Page Down a month, Home and End the start and end of the week. Null for other keys.
 */
export function moveCursor(iso, key) {
  const d = fromISO(iso);
  if (!d) return null;
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'PageUp': return addMonths(iso, -1);
    case 'PageDown': return addMonths(iso, 1);
    case 'Home': return addDays(iso, -d.getDay());
    case 'End': return addDays(iso, 6 - d.getDay());
    default: return null;
  }
}

/** "Sat, Oct 11", with the year when it isn't this year: "Sat, Oct 11, 2027". */
export function dateLabel(iso, now = new Date()) {
  const d = fromISO(iso);
  if (!d) return '';
  const base = `${WEEKDAYS[d.getDay()].slice(0, 3)}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** "Saturday, October 11, 2026": what a screen reader says for a day in the grid. */
export function longDateLabel(iso) {
  const d = fromISO(iso);
  return d ? `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
}

/**
 * The days golfers reach for, inside min and max: Today, Tomorrow, then the coming Saturday and
 * Sunday when they aren't one of those already. Each: { iso, top, bottom, label }.
 */
export function quickDays(now = new Date(), { min, max } = {}) {
  const today = toISO(now);
  const out = [
    { iso: today, top: 'Today', label: 'Today' },
    { iso: addDays(today, 1), top: 'Tmrw', label: 'Tomorrow' },
  ];
  for (const dow of [6, 0]) {
    const ahead = (dow - now.getDay() + 7) % 7;
    const iso = addDays(today, ahead);
    if (out.some(q => q.iso === iso)) continue;
    out.push({ iso, top: WEEKDAYS[dow].slice(0, 3), label: WEEKDAYS[dow] });
  }
  return out
    .filter(q => inBounds(q.iso, min, max))
    .map(q => {
      const d = fromISO(q.iso);
      return { ...q, bottom: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` };
    });
}

// ---------------------------------------------------------------------------
// Ranges
// ---------------------------------------------------------------------------

/** Whether a day sits strictly between the two ends of a range (either order). */
export function betweenEnds(iso, from, to) {
  if (!from || !to || from === to) return false;
  const [a, b] = from < to ? [from, to] : [to, from];
  return iso > a && iso < b;
}

/**
 * A tap on a day in the range sheet. `editing` is the end the tap sets ('from' or 'to').
 * Setting From moves on to To; a From after To starts the range over from that day. Setting To
 * before From makes that day the new From and waits for To again. Setting To stays on To, so
 * another tap moves the end. Returns { range, editing }.
 */
export function rangeTap({ from = '', to = '' }, iso, editing) {
  if (editing === 'from') {
    if (to && iso > to) return { range: { from: iso, to: '' }, editing: 'to' };
    return { range: { from: iso, to }, editing: 'to' };
  }
  if (from && iso < from) return { range: { from: iso, to: '' }, editing: 'to' };
  return { range: { from, to: iso }, editing: 'to' };
}

/** "Sep 6 to Oct 5", "Since Sep 6", "Up to Oct 5", or "Any dates", for the range field. */
export function rangeText({ from, to }, now = new Date()) {
  const short = iso => {
    const d = fromISO(iso);
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`}`;
  };
  const a = fromISO(from) ? from : '', b = fromISO(to) ? to : '';
  if (a && b) return a <= b ? `${short(a)} to ${short(b)}` : `${short(b)} to ${short(a)}`;
  if (a) return `Since ${short(a)}`;
  if (b) return `Up to ${short(b)}`;
  return 'Any dates';
}

/** Ranges to start from when looking back: the last 7, 30 and 90 days and the last 12 months. */
export function rangePresets(now = new Date()) {
  const today = toISO(now);
  return [
    { key: '7d', label: 'Last 7 days', from: addDays(today, -6), to: today },
    { key: '30d', label: 'Last 30 days', from: addDays(today, -29), to: today },
    { key: '90d', label: 'Last 90 days', from: addDays(today, -89), to: today },
    { key: '12m', label: 'Last 12 months', from: addDays(addMonths(today, -12), 1), to: today },
  ];
}

// ---------------------------------------------------------------------------
// Tee times
// ---------------------------------------------------------------------------

/** { h, m } (24 hour) from "08:10", or null. */
export function parseTime(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? { h, m: min } : null;
}

/** "08:10" from 8 and 10. */
export const toTime = (h, m) => `${pad(h)}:${pad(m)}`;

/** The 12 hour clock's hour and half for a 24 hour hour: 0 is 12 AM, 13 is 1 PM. */
export const from24 = h => ({ h12: h % 12 || 12, half: h < 12 ? 'am' : 'pm' });

/** Back to 24 hours: 12 AM is 0, 12 PM is 12, 1 PM is 13. */
export const to24 = (h12, half) => (h12 % 12) + (half === 'pm' ? 12 : 0);

/** The hours to pick from, in clock order. */
export const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * The minutes to pick from for a step in seconds (what a native time input's step was), at least
 * a minute. A saved minute off the step ("08:07" with 5 minute steps) is kept in the list.
 */
export function minuteChoices(step = 300, value = '') {
  const every = Math.max(1, Math.round((Number(step) || 60) / 60));
  const out = [];
  for (let m = 0; m < 60; m += every) out.push(m);
  const t = parseTime(value);
  if (t && !out.includes(t.m)) { out.push(t.m); out.sort((a, b) => a - b); }
  return out;
}

/**
 * A tap in the time sheet. `part` is 'hour' (n is 1 to 12), 'minute' (0 to 59) or 'half'
 * ('am' or 'pm'). `half` is the AM or PM showing, used when nothing is picked yet. Picking an hour
 * first gives it :00, so there's a time straight away. A minute needs an hour first, so it gives
 * back the value unchanged until there is one.
 */
export function timeTap(value, part, n, half = 'am') {
  const t = parseTime(value);
  if (part === 'hour') return toTime(to24(n, t ? from24(t.h).half : half), t ? t.m : 0);
  if (!t) return value || '';
  if (part === 'minute') return toTime(t.h, n);
  if (part === 'half') return toTime(to24(from24(t.h).h12, n), t.m);
  return value;
}
