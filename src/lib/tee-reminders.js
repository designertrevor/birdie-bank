// Tee time reminders. On a plan the organizer can add the course's booking page (saved on this
// phone for that course, so the next plan there has it, and read from the course database when it
// sends one) and pick a day to be reminded. From that day Up next shows "Book your tee time" with
// the link, until they tap Booked: that puts the tee time on the plan, everyone with the link sees
// it, and there's a text for the group. There's no push yet, so the card is the reminder.
// The app never books anything itself: it only links to the course's own page.
// Pure functions of plain data, so they're easy to test.
//
// On a plan (shared with the group like the rest of it, see plans.js planMeta):
//   booking: { url, courseId, remindOn }  the link for the plan's course and the reminder day (YYYY-MM-DD)
//   booked:  { at }                       set by Booked; the time itself is the plan's teeTime
// On this phone only: plan.teeSnooze (YYYY-MM-DD, "Tomorrow" on the card) and
// state.courseLinks ({ courseId: url }, synced with your profile).
import { findCourse } from './courses.js';
import { cleanBookingUrl, linkSite } from './booking-url.js';
import { dayChoices, dayLabel, daysUntil, isoDate, timeLabel } from './plans.js';

export { cleanBookingUrl, linkSite };

/**
 * The booking page this phone knows for a course: the one you saved for it (or for the built-in
 * course it corrects), else the one the course database sent. '' when there's none.
 */
export function courseBookingUrl(state, course) {
  if (!course?.id) return '';
  const links = state?.courseLinks || {};
  const c = findCourse(state, course.id) || course;
  return cleanBookingUrl(links[course.id] || links[c.id] || (c.replaces && links[c.replaces]) || c.bookingUrl || course.bookingUrl || '');
}

/** The plan's booking page: the one saved on it for its course, else the course's own. */
export function planBookingUrl(state, plan) {
  const b = plan?.booking;
  if (b?.url && (!b.courseId || b.courseId === plan.course?.id)) return cleanBookingUrl(b.url);
  return courseBookingUrl(state, plan?.course);
}

/** At most this many days to pick from: the two weeks before the round. */
export const REMIND_DAYS_MAX = 14;

/**
 * Days the organizer can be reminded on: today up to the day before the round (a round today
 * offers today), the last two weeks of them at most. Each is { iso, top, bottom } like the plan's
 * day strip.
 */
export function remindDayChoices(plan, now = new Date()) {
  const n = daysUntil(plan?.date, now);
  if (n == null || n < 0) return [];
  return dayChoices(now, Math.max(1, n)).slice(-REMIND_DAYS_MAX);
}

/** The reminder day to suggest: three days before the round, or today when that's gone by. */
export function suggestedRemindOn(plan, now = new Date()) {
  const n = daysUntil(plan?.date, now);
  if (n == null || n < 0) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + Math.max(0, n - 3));
  return isoDate(d);
}

/** Whether a plan is one you're organizing that's still on (not called off, moved, started or gone). */
function stillOn(plan) {
  return !!plan?.host && plan.status === 'planned' && !plan.gone && !plan.movedTo;
}

/**
 * Whether Up next shows "Book your tee time" for this plan now: you organized it, it's still on,
 * it isn't booked, a reminder day is set and has come (a day set after the round counts as the
 * day before it), the round hasn't gone by, and you didn't put it off until a later day.
 */
export function teeTimeDue(plan, now = new Date()) {
  if (!stillOn(plan) || plan.booked || !plan.booking?.remindOn) return false;
  const n = daysUntil(plan.date, now);
  if (n == null || n < 0) return false;
  const today = isoDate(now);
  const last = n > 0 ? isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n - 1)) : today;
  const on = plan.booking.remindOn < last ? plan.booking.remindOn : last;
  if (today < on) return false;
  return !(plan.teeSnooze && today < plan.teeSnooze);
}

/** Your plans that need a tee time booked now, soonest round first. */
export function teeTimeReminders(state, now = new Date()) {
  return Object.values(state?.plans || {})
    .filter(p => teeTimeDue(p, now))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0));
}

/** The day after `now`, for "Tomorrow" on the card. */
export function tomorrowIso(now = new Date()) {
  return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
}

/** "Saturday at Birch Creek GC": the card's line under "Book your tee time". */
export function teeTimeLine(plan, now = new Date()) {
  const day = dayLabel(plan.date, now);
  return [day, plan.course?.name].filter(Boolean).join(' at ') || 'Your next round';
}

/** What the plan's reminder says on the plan screen: "We'll remind you Wednesday". */
export function remindOnLabel(plan, now = new Date()) {
  const on = plan?.booking?.remindOn;
  if (!on) return '';
  const n = daysUntil(on, now);
  if (n == null) return '';
  if (n <= 0) return 'Reminder on Up next today';
  return `Reminder on Up next ${n === 1 ? 'tomorrow' : dayLabel(on, now)}`;
}

/** The plan's booking as Booked leaves it (mutates a plan draft): the tee time, and when. */
export function markBooked(p, teeTime, at = Date.now()) {
  if (teeTime) p.teeTime = teeTime;
  p.booked = { at };
  delete p.teeSnooze;
}

/**
 * The plan's day or course changed (mutates a plan draft, call it before the change): a tee time
 * booked for the old day or course isn't booked any more, so Booked comes off and the reminder
 * can show again. A change of tee time alone keeps it booked.
 */
export function rebookIfMoved(p, { date, courseId }) {
  const moved = (date !== undefined && date !== p.date) || (courseId !== undefined && courseId !== (p.course?.id ?? null));
  if (!moved) return false;
  delete p.booked;
  delete p.teeSnooze;
  return true;
}

/** Set the booking link and reminder day on a plan draft (mutates). An empty link clears it. */
export function setBooking(p, { url, remindOn }) {
  const next = { ...(p.booking || {}) };
  if (url !== undefined) {
    const clean = cleanBookingUrl(url);
    if (clean) { next.url = clean; next.courseId = p.course?.id || null; } else { delete next.url; delete next.courseId; }
  }
  if (remindOn !== undefined) {
    if (remindOn) next.remindOn = remindOn; else delete next.remindOn;
    delete p.teeSnooze;
  }
  if (Object.keys(next).length) p.booking = next; else delete p.booking;
}

/** The text for the group once it's booked: when, where, and the plan link to answer. */
export function bookedText(plan, link, now = new Date()) {
  const n = daysUntil(plan.date, now);
  const day = n === 0 ? 'today' : n === 1 ? 'tomorrow' : dayLabel(plan.date, now);
  const t = timeLabel(plan.teeTime);
  return [
    `Tee time’s booked: ${day}${t ? ` at ${t}` : ''}${plan.course?.name ? `, ${plan.course.name}` : ''}.`,
    link ? 'Tap to say if you’re in:' : null,
    link || null,
  ].filter(Boolean).join('\n');
}
