// Gentle payment nudges. Once someone has owed you for a while (a week unless you pick another
// gap in Settings, or Off), Up next suggests a friendly reminder you send with one tap: the same
// text the Tab's Remind button sends. Never more than once a week per person (a Remind from the
// Tab counts, and so does "Not now"), never for money the two of you agreed to carry over or one
// of you asked to roll, and never for a few cents. There's no push yet, so the suggestion is the
// reminder: it waits on Up next until you send it or put it away.
// Pure functions of plain data, so they're easy to test.
//
// How long someone has owed you: from the first money round you played together after the last
// payment between you (either way) or the carry-over you last agreed (its money rolled into the
// next round, so that round is where the clock starts). Money with no round behind it (a trip
// expense only) has no clock, so it's left to the Tab's own Remind.
import { outstanding } from './ledger.js';
import { canonicalOf, lastPayment } from './shared-tab.js';
import { cardCarry } from './carry.js';
import { myIds } from './format.js';

export const DAY_MS = 864e5;
/** The gaps to pick from in Settings, in days. 0 is Off. */
export const NUDGE_CHOICES = [0, 3, 7, 14];
export const NUDGE_DEFAULT = 7;
/** At most one suggestion per person in this many days. */
export const NUDGE_EVERY_DAYS = 7;
/** Less than this (in dollars) isn't worth a reminder. */
export const NUDGE_MIN = 1;
/** Up next shows this many at most; the rest wait on the Tab. */
export const NUDGES_ON_HOME = 2;

/** The gap in days your settings ask for (0: Off). Anything unknown reads as the default. */
export function nudgeDays(settings) {
  const n = settings?.nudgeDays;
  return NUDGE_CHOICES.includes(n) ? n : NUDGE_DEFAULT;
}

/** "Off", "3 days", "1 week", "2 weeks": the Settings labels. */
export function nudgeChoiceLabel(n) {
  if (!n) return 'Off';
  if (n % 7 === 0) return n === 7 ? '1 week' : `${n / 7} weeks`;
  return `${n} days`;
}

/** When you last nudged (or reminded, or put away a nudge for) this person, on any of their ids. */
export function lastNudged(state, id) {
  const who = canonicalOf(state);
  const k = who(id);
  let at = 0;
  for (const [x, t] of Object.entries(state?.nudges || {})) if (who(x) === k && Number(t) > at) at = Number(t);
  return at;
}

/** Record a nudge for `id` on a state draft (mutates), keyed by the person as this phone knows them. */
export function noteNudge(draft, id, at = Date.now()) {
  const k = canonicalOf(draft)(id);
  draft.nudges = { ...(draft.nudges || {}), [k]: at };
  // Old entries only ever matter for a week, so the map stays small
  for (const [x, t] of Object.entries(draft.nudges)) if (at - Number(t) > 60 * DAY_MS) delete draft.nudges[x];
}

/**
 * When `from` started owing `to` the money that's open now, as a time, or null when there's no
 * finished money round together since the last payment or agreed carry-over between them.
 * `rounds` are the ids of the rounds the two played together (outstanding()'s `rounds`).
 */
export function owedSince(state, from, to, rounds = []) {
  const who = canonicalOf(state);
  const A = who(from), B = who(to);
  let cutoff = lastPayment(state, from, to)?.at || 0;
  for (const c of state?.carries || []) {
    const pair = (who(c.from) === A && who(c.to) === B) || (who(c.from) === B && who(c.to) === A);
    if (pair && c.status === 'agreed') cutoff = Math.max(cutoff, c.answeredAt || c.at || 0);
  }
  let since = null;
  for (const id of rounds) {
    const r = state?.rounds?.[id];
    const at = r?.status === 'done' ? (r.finishedAt || r.createdAt || 0) : 0;
    if (at > cutoff && (since == null || at < since)) since = at;
  }
  return since;
}

/**
 * The reminders to suggest on Up next, most owed first:
 * [{ id, amount, since, days }], `id` the person as the Tab knows them, `days` how long it's been.
 * Empty when nudges are off in your settings.
 */
export function paymentNudges(state, { now = Date.now(), days = nudgeDays(state?.settings) } = {}) {
  if (!days) return [];
  const ids = myIds(state);
  const who = canonicalOf(state);
  const mine = id => ids.has(id) || ids.has(who(id));
  const out = [];
  for (const d of outstanding(state, { now })) {
    if (!mine(d.to) || mine(d.from) || !(d.amount >= NUDGE_MIN)) continue;
    // A carry-over agreed (or asked for) covers the card, so no nudge rides over it
    const carry = cardCarry(state, d.to, d.from, { from: d.from, to: d.to, amount: d.amount }, now);
    if (carry && (carry.status === 'agreed' || carry.status === 'asked')) continue;
    const since = owedSince(state, d.from, d.to, d.rounds);
    if (since == null || now - since < days * DAY_MS) continue;
    if (now - lastNudged(state, d.from) < NUDGE_EVERY_DAYS * DAY_MS) continue;
    out.push({ id: d.from, amount: d.amount, since, days: Math.floor((now - since) / DAY_MS) });
  }
  return out.sort((a, b) => b.amount - a.amount || a.since - b.since);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Saturday" for a day in the last week, else "Sep 27". */
export function sinceDay(at, now = Date.now()) {
  const d = new Date(at);
  const start = t => { const x = new Date(t); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  const ago = Math.round((start(now) - start(at)) / DAY_MS);
  if (ago >= 1 && ago < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** The card's line, friendly and never about how late it is: "Mike still owes you $18 from Saturday". */
export function nudgeLine(name, amount, since, { now = Date.now(), fmt = v => `$${v}` } = {}) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'A friend';
  return `${first} still owes you ${fmt(amount)} from ${sinceDay(since, now)}`;
}
