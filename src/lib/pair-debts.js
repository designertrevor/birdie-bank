// What's open between two people on the rounds both their phones have: the finished rounds
// that were shared live (they keep their code), from the rounds' own transfers, less what's
// been paid on them. Both phones hold the same rounds and the same payment rows, so both work
// out the same amount. The Tab keeps this money between the two of them (never passed on
// through a third person), and "I paid", "Roll to next time" and the who's-square strip all
// count it. Pure, unit tested. Kept apart from ledger.js and shared-tab.js so both can use it.
import { meFor, myIds } from './format.js';
import { linksOf } from './people-links.js';
import { onTab, tabResults } from './play-for.js';
import { isTripPayment } from './trip-pay.js';
import { coveredRounds } from './trip-plan.js';

const DAY = 864e5;
/** Shared rounds this recent are looked up on the server. */
export const FETCH_DAYS = 60;

export const cents = v => Math.round((Number(v) || 0) * 100);

/** A round's live code, kept after sharing stops so its payments outlive the live round. */
export function codeOf(round) {
  return round?.shareCode || round?.shared?.code || null;
}

/**
 * The one id each person goes by on this phone: every id that means you maps to you, and a
 * friend's other ids (a seat they claimed, a player merged with "Same person as...") map to the
 * one kept for them (see people-links.js). Only the grouping changes, never the money.
 */
export function canonicalOf(state) {
  const mine = myIds(state);
  const { personOf } = linksOf(state);
  return id => {
    const p = personOf(id);
    return state.me && (mine.has(id) || mine.has(p)) ? state.me : p;
  };
}

/** Finished rounds with money on the Tab: money rounds, and reward rounds' side bets for money (see tabResults). */
export const doneRounds = state => Object.values(state.rounds || {}).filter(r => r.status === 'done' && onTab(r));
export const finishedAt = r => r.finishedAt || r.createdAt || 0;

/** You played this round (a watcher's copy never counts). */
export function played(round, state) {
  const me = meFor(round, state);
  return !!me && round.players.some(p => p.id === me);
}

/** Finished shared rounds you played, oldest first, finished within `days`. */
export function sharedRounds(state, { days = FETCH_DAYS, now = Date.now() } = {}) {
  return doneRounds(state)
    .filter(r => codeOf(r) && played(r, state) && finishedAt(r) >= now - days * DAY)
    .sort((a, b) => finishedAt(a) - finishedAt(b));
}

/**
 * The shared rounds whose money the Tab keeps between the two people in them. A trip's rounds stay
 * here too: every phone of a pair has the rounds both of them played, but a phone that missed one
 * of the trip's rounds can't see the whole trip, so squaring a trip across everyone on it would
 * leave two phones disagreeing. Only the organizer's published plan can (trip-plan.js): the rounds
 * a plan that checks out on this phone covers settle on the plan instead, the same on every phone.
 */
export function lockedRounds(state, opts) {
  const list = sharedRounds(state, opts);
  if (!state.tripPlans) return list;
  const covered = coveredRounds(state, { now: opts?.now });
  return covered.size ? list.filter(r => !covered.has(r.id)) : list;
}

/** A transfer closed by a payment that squared the pair's shared rounds (status only, no money). */
export const nettedId = (code, from, to) => `${code}:${from}>${to}:net`;

/** What has been paid on one round transfer, in cents. */
export function paidOn(state, round, code, t) {
  // Payments marked at the end of the round before the shared Tab (roundId, no code) count too
  // A payment from "Settle the trip" with a trip id pays the trip's rounds this phone alone has, never one transfer
  const on = s => !isTripPayment(s) && (s.code === code || (!s.code && s.roundId === round.id));
  return (state.settlements || []).filter(s => on(s) && s.from === t.from && s.to === t.to).reduce((a, s) => a + cents(s.amount), 0);
}
export const nettedOn = (state, code, t) => state.tabRows?.[`${code}|${nettedId(code, t.from, t.to)}`]?.status === 'netted';

/** Every open transfer on your shared rounds, by pair (ids as the Tab knows them), netted both ways. */
export function sharedDebts(state, { now = Date.now() } = {}) {
  return openByPair(state, lockedRounds(state, { now }));
}

/**
 * What's open on the given shared rounds' transfers, by pair, netted both ways:
 * [{ from, to, cents }], where `from` owes `to`. Nothing is passed on through anyone else.
 */
export function openByPair(state, rounds) {
  const who = canonicalOf(state);
  const net = new Map(); // "a|b" (sorted) -> cents a owes b
  for (const r of rounds) {
    const code = codeOf(r);
    for (const t of tabResults(r).transfers) {
      const f = who(t.from), to = who(t.to);
      if (f === to || nettedOn(state, code, t)) continue;
      const open = cents(t.amount) - paidOn(state, r, code, t);
      if (open <= 0) continue;
      const [a, b] = f < to ? [f, to] : [to, f];
      const k = `${a}|${b}`;
      net.set(k, (net.get(k) || 0) + (f === a ? open : -open));
    }
  }
  const out = [];
  for (const [k, c] of net) {
    if (!c) continue;
    const [a, b] = k.split('|');
    out.push(c > 0 ? { from: a, to: b, cents: c } : { from: b, to: a, cents: -c });
  }
  return out;
}

/**
 * What's open between two people on their shared rounds, in cents: positive when `a` owes `b`,
 * negative when `b` owes `a`.
 */
export function pairDebt(state, a, b, opts) {
  const who = canonicalOf(state);
  const A = who(a), B = who(b);
  let c = 0;
  for (const d of sharedDebts(state, opts)) {
    if (d.from === A && d.to === B) c += d.cents;
    if (d.from === B && d.to === A) c -= d.cents;
  }
  return c;
}
