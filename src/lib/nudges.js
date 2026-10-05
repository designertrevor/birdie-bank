// Gentle payment nudges. Once someone has owed you for a while (a week unless you pick another
// gap in Settings, or Off), Up next suggests a friendly reminder you send with one tap: the same
// text the Tab's Remind button sends. Never more than once a week per person (a Remind from the
// Tab counts, and so does "Not now"), never for money the two of you agreed to carry over or one
// of you asked to roll, and never for a few cents. There's no push yet, so the suggestion is the
// reminder: it waits on Up next until you send it or put it away.
// Pure functions of plain data, so they're easy to test.
//
// How long someone has owed you: from the round (or decided Big Game) that started what they owe
// you now, after the last payment between you (either way), the carry-over you last agreed (its
// money rolled into the next round, so that round is where the clock starts) or the last close of
// the books that rolled a line between you (rolled money is never what a nudge is about). A round
// the two of you came out of square, or that you lost, never starts the clock. Money with no round
// behind it (a trip expense only) has no clock, so it's left to the Tab's own Remind.
import { outstanding } from './ledger.js';
import { canonicalOf, lastPayment } from './shared-tab.js';
import { cardCarry } from './carry.js';
import { myIds } from './format.js';
import { tabResults } from './play-for.js';
import { bigBetween } from './big-money.js';

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
 * finished money round (or decided Big Game) between them since the last payment, agreed
 * carry-over or rolled close of the books between them. `rounds` are the ids of the rounds the two
 * played together (outstanding()'s `rounds`). Taken oldest first, the clock starts at the round
 * that put `from` owing `to` and starts again whenever they're back to square between the two of
 * them; when the Tab has them owing only through the rest of the group, it's their newest round.
 */
export function owedSince(state, from, to, rounds = []) {
  const who = canonicalOf(state);
  const A = who(from), B = who(to);
  const pair = (x, y) => (who(x) === A && who(y) === B) || (who(x) === B && who(y) === A);
  let cutoff = lastPayment(state, from, to)?.at || 0;
  for (const c of state?.carries || []) {
    if (pair(c.from, c.to) && c.status === 'agreed') cutoff = Math.max(cutoff, c.answeredAt || c.at || 0);
  }
  for (const b of Object.values(state?.books || {})) {
    if ((b?.lines || []).some(l => l.how === 'rolled' && pair(l.from, l.to))) cutoff = Math.max(cutoff, b.closedAt || 0);
  }
  // What `from` owes `to` from each round and decided game after the cutoff, in cents
  const events = [];
  for (const id of new Set(rounds)) {
    const r = state?.rounds?.[id];
    const at = r?.status === 'done' ? (r.finishedAt || r.createdAt || 0) : 0;
    if (!(at > cutoff)) continue;
    const pairs = tabResults(r).pairs || {};
    let c = 0;
    for (const p of r.players || []) {
      if (who(p.id) !== A) continue;
      for (const q of r.players || []) if (who(q.id) === B) c -= Math.round((Number(pairs[p.id]?.[q.id]) || 0) * 100);
    }
    events.push({ at, c });
  }
  for (const x of bigBetween(state, id => who(id) === B, id => who(id) === A)) if (x.at > cutoff) events.push({ at: x.at, c: x.amount });
  if (!events.length) return null;
  events.sort((a, b) => a.at - b.at);
  let owed = 0, since = null;
  for (const e of events) {
    const was = owed;
    owed += e.c;
    if (owed <= 0) since = null;
    else if (was <= 0) since = e.at;
  }
  return since ?? events.at(-1).at;
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
  // One person is one card: what each owes you on the Tab, less anything you owe them back, on
  // any of their ids (the Tab's own tabWith adds up the same way), so a person never shows twice
  const owed = new Map();
  for (const d of outstanding(state, { now })) {
    const toMe = mine(d.to) && !mine(d.from), fromMe = mine(d.from) && !mine(d.to);
    if (!toMe && !fromMe) continue;
    const k = who(toMe ? d.from : d.to);
    const o = owed.get(k) || { id: toMe ? d.from : d.to, me: toMe ? d.to : d.from, cents: 0, rounds: [] };
    o.cents += (toMe ? 1 : -1) * Math.round(d.amount * 100);
    o.rounds.push(...(d.rounds || []));
    owed.set(k, o);
  }
  const out = [];
  for (const o of owed.values()) {
    const amount = o.cents / 100;
    if (!(amount >= NUDGE_MIN)) continue;
    // A carry-over agreed (or asked for) covers the card, so no nudge rides over it
    const carry = cardCarry(state, o.me, o.id, { from: o.id, to: o.me, amount }, now);
    if (carry && (carry.status === 'agreed' || carry.status === 'asked')) continue;
    const since = owedSince(state, o.id, o.me, [...new Set(o.rounds)]);
    if (since == null || now - since < days * DAY_MS) continue;
    if (now - lastNudged(state, o.id) < NUDGE_EVERY_DAYS * DAY_MS) continue;
    out.push({ id: o.id, amount, since, days: Math.floor((now - since) / DAY_MS) });
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
