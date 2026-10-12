// The Pro trial, from start to finish (roadmap area 11, paywall rules). Behind the paywall flag,
// like everything Pro: nothing reads this with the flag off.
// - A timeline anyone on the trial can see in Your plan: day N of 14, the reminder day, the end date
//   and the price after.
// - A reminder at least two days before it ends (REMIND_LEAD_DAYS), on Up next. In-app only for now:
//   the trial lives on this phone (there are no payments yet), so the server has nothing to push from.
// - Never a surprise charge: the end date and the price are always shown before a charge could happen,
//   and safeToCharge says no until the reminder has been shown at least two days before the end.
// Pure functions of plain data, so they're easy to test.
import { DEFAULT_PLAN, PLANS, REMIND_DAY, TRIAL_DAYS, priceLabel } from './paywall.js';

const DAY = 24 * 60 * 60 * 1000;
/** The fewest days between the reminder and the end of the trial. */
export const REMIND_LEAD_DAYS = 2;

const fmtDay = t => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** The trial on this phone, if one is running at `now`: the saved answer from the paywall, else null. */
export function activeTrial(state, now = Date.now()) {
  const p = state?.paywall;
  if (p?.choice !== 'trial' || !Number.isFinite(p.trialEnds) || p.trialEnds <= now) return null;
  return p;
}

/** When the reminder is due for a trial ending at `ends`: day REMIND_DAY, and never later than two days before the end. */
export function remindAt(ends, { days = TRIAL_DAYS, remind = REMIND_DAY } = {}) {
  const start = ends - days * DAY;
  return Math.min(start + remind * DAY, ends - REMIND_LEAD_DAYS * DAY);
}

/**
 * Where the trial stands, for Your plan's timeline. Null with no trial running.
 * { day, of, daysLeft, start, ends, remindAt, plan, price, pct, steps }: `day` is 1 on the first
 * day and `of` on the last; `steps` are today, the reminder and the end, each `done` once passed.
 */
export function trialProgress(state, now = Date.now(), { days = TRIAL_DAYS, remind = REMIND_DAY } = {}) {
  const p = activeTrial(state, now);
  if (!p) return null;
  const ends = p.trialEnds;
  const start = ends - days * DAY;
  const day = Math.min(days, Math.max(1, Math.floor((now - start) / DAY) + 1));
  const daysLeft = Math.max(1, Math.ceil((ends - now) / DAY));
  const at = remindAt(ends, { days, remind });
  const plan = PLANS[p.plan] || PLANS[DEFAULT_PLAN];
  const price = priceLabel(plan);
  const remindDay = Math.round((at - start) / DAY);
  return {
    day, of: days, daysLeft, start, ends, remindAt: at, plan, price,
    pct: Math.round((day / days) * 100),
    steps: [
      { key: 'start', icon: 'check', title: 'Day 1', when: fmtDay(start), text: 'Everything in Pro, unlocked.', done: true },
      { key: 'remind', icon: 'bell', title: `Day ${remindDay}`, when: fmtDay(at), text: 'We remind you the trial is ending.', done: now >= at },
      { key: 'end', icon: 'star', title: `Day ${days}`, when: fmtDay(ends), text: `The trial ends. Then ${price}, unless you cancel.`, done: false },
    ],
  };
}

/**
 * The line that always comes before a charge: the end date and the price after it.
 * "Your trial ends Tue, Oct 13. Then $49.99 a year, unless you cancel. Nothing is charged before then."
 */
export function chargeNotice(state, now = Date.now()) {
  const p = activeTrial(state, now);
  if (!p) return null;
  const plan = PLANS[p.plan] || PLANS[DEFAULT_PLAN];
  return `Your trial ends ${fmtDay(p.trialEnds)}. Then ${priceLabel(plan)}, unless you cancel. Nothing is charged before then.`;
}

/**
 * The reminder card for Up next, or null. Due from the reminder day until the trial ends, unless it
 * was put away for this trial (`reminderSeen` holds the end it was put away for). Not with Pro for
 * life or a paid plan, which have no trial to end. Never while a round is live: the caller passes
 * `allowed` from the upsell guard (upsell-guard.js).
 */
export function trialReminder(state, now = Date.now(), { lifetime = false, subscription = null, allowed = true } = {}) {
  if (lifetime || subscription || !allowed) return null;
  const t = trialProgress(state, now);
  if (!t || now < t.remindAt) return null;
  if (state.paywall.reminderSeen === t.ends) return null;
  return {
    ends: t.ends,
    daysLeft: t.daysLeft,
    title: `Your Pro trial ends in ${t.daysLeft} ${t.daysLeft === 1 ? 'day' : 'days'}`,
    text: chargeNotice(state, now),
  };
}

/** The paywall answer after the reminder shows: when it first showed (kept), for safeToCharge. */
export function markReminded(paywall, now = Date.now()) {
  return paywall?.remindedAt ? paywall : { ...paywall, remindedAt: now };
}

/** The paywall answer after "Got it" on the reminder: put away for this trial only. */
export function putReminderAway(paywall, now = Date.now()) {
  return { ...markReminded(paywall, now), reminderSeen: paywall?.trialEnds ?? null };
}

/**
 * Whether a charge may happen at `now` (for when payments are wired up). Only once the trial has
 * ended, and only if the reminder showed at least REMIND_LEAD_DAYS before the end. Otherwise the
 * charge waits: the payment side should push the trial's end back rather than charge by surprise.
 * TODO(pro): read this, or its server twin, before the first charge once Stripe is wired up.
 */
export function safeToCharge(paywall, now = Date.now()) {
  if (paywall?.choice !== 'trial' || !Number.isFinite(paywall.trialEnds)) return false;
  if (now < paywall.trialEnds) return false;
  const r = paywall.remindedAt;
  return Number.isFinite(r) && r <= paywall.trialEnds - REMIND_LEAD_DAYS * DAY;
}
