// What's open between two people on the rounds both their phones have: the finished rounds
// that were shared live (they keep their code), from the rounds' own transfers, less what's
// been paid on them. Both phones hold the same rounds and the same payment rows, so both work
// out the same amount. The Tab keeps this money between the two of them (never passed on
// through a third person), and "I paid", "Roll to next time" and the who's-square strip all
// count it. Pure, unit tested. Kept apart from ledger.js and shared-tab.js so both can use it.
import { roundResults } from './round.js';
import { meFor, myIds } from './format.js';

const DAY = 864e5;
/** Shared rounds this recent are looked up on the server. */
export const FETCH_DAYS = 60;

export const cents = v => Math.round((Number(v) || 0) * 100);

/** A round's live code, kept after sharing stops so its payments outlive the live round. */
export function codeOf(round) {
  return round?.shareCode || round?.shared?.code || null;
}

/** Every id that means you maps to one; everyone else stays as they are. */
export function canonicalOf(state) {
  const mine = myIds(state);
  return id => (state.me && mine.has(id) ? state.me : id);
}

export const doneRounds = state => Object.values(state.rounds || {}).filter(r => r.status === 'done');
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

/** A transfer closed by a payment that squared the pair's shared rounds (status only, no money). */
export const nettedId = (code, from, to) => `${code}:${from}>${to}:net`;

/** What has been paid on one round transfer, in cents. */
export function paidOn(state, round, code, t) {
  // Payments marked at the end of the round before the shared Tab (roundId, no code) count too
  const on = s => s.code === code || (!s.code && s.roundId === round.id);
  return (state.settlements || []).filter(s => on(s) && s.from === t.from && s.to === t.to).reduce((a, s) => a + cents(s.amount), 0);
}
export const nettedOn = (state, code, t) => state.tabRows?.[`${code}|${nettedId(code, t.from, t.to)}`]?.status === 'netted';

/**
 * Every open transfer on your shared rounds, by pair (ids as the Tab knows them), netted both
 * ways: [{ from, to, cents }], where `from` owes `to`. Nothing is passed on through anyone else.
 */
export function sharedDebts(state, { now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const net = new Map(); // "a|b" (sorted) -> cents a owes b
  for (const r of sharedRounds(state, { now })) {
    const code = codeOf(r);
    for (const t of roundResults(r).transfers) {
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
