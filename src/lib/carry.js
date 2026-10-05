// Carry it over: either person asks to roll what's owed into the next round, the other agrees
// or would rather get paid. A carry never touches the money: it's still in the running balance,
// it just stops the nudges on that card. Pure, unit tested.
//
// A carry is { id, from, to, amount, status: 'asked' | 'agreed' | 'declined' | 'withdrawn', by,
// reason?, at, answeredAt?, roundIds, codes }, where from owes to. It rides on the shared
// round rows (one per round it covers, see shared-tab.js), so both phones see it. Between two
// people who share rounds, a carry only ever covers those rounds (what both phones have), so the
// amount asked, agreed and shown is the same on both.
import { canonicalOf, carryId, carryRowId, codeOf, openTransfers, pairDebt, pairRounds } from './shared-tab.js';
import { countsMoney } from './play-for.js';
import { betsOf, isCashBet } from './pair-bets.js';
import { bettors } from './round.js';

const cents = v => Math.round((Number(v) || 0) * 100);

/** One-tap reasons for asking. Never about weeks: groups don't all play every week. */
export const CARRY_REASONS = ['We’ll net it next time', 'Short till payday', 'Cash when we next play'];

/** The carry's next state. Answers only apply to an open ask; anything else is ignored. */
export function carryReducer(carry, action) {
  switch (action.type) {
    case 'ask':
      return {
        id: carryId(action.from, action.to, action.at), from: action.from, to: action.to, amount: action.amount,
        status: 'asked', by: action.by, reason: action.reason || null, at: action.at,
        roundIds: action.roundIds || [], codes: action.codes || [], updatedAt: action.at,
      };
    case 'agree':
    case 'decline':
      if (carry?.status !== 'asked') return carry;
      return { ...carry, status: action.type === 'agree' ? 'agreed' : 'declined', answeredAt: action.at, updatedAt: action.at };
    case 'withdraw':
      if (carry?.status !== 'asked') return carry;
      return { ...carry, status: 'withdrawn', updatedAt: action.at };
    default:
      return carry;
  }
}

/**
 * An agreed carry is done once the two of them finish another money round together after
 * agreeing. A points or reward round in between has no money to net it into, so the carry stands.
 */
export function rolled(carry, state) {
  if (carry?.status !== 'agreed') return false;
  const who = canonicalOf(state);
  const since = carry.answeredAt || carry.at || 0;
  return Object.values(state.rounds || {}).some(r => {
    if (r.status !== 'done' || (r.finishedAt || 0) <= since) return false;
    // ...with money between them: a round either was just playing had none, so the carry stands
    const ids = new Set(bettors(r).map(p => who(p.id)));
    if (!ids.has(who(carry.from)) || !ids.has(who(carry.to))) return false;
    if (countsMoney(r)) return true;
    // A reward round nets it only when the two of them had a side bet for money together
    const two = new Set([who(carry.from), who(carry.to)]);
    return betsOf(r).some(b => isCashBet(r, b) && b.sides.every(s => two.has(who(s))));
  });
}

/**
 * The carry that applies to a pair right now, given what's owed between them ({ from, to,
 * amount }, or null when square). Adds `carried`: the carry capped at what's owed now. A carry
 * ends when the debt flips direction or clears, when it's taken back, or once it has rolled. A
 * "rather get paid" answer stands until the amount changes.
 */
export function activeCarry(state, a, b, owed) {
  const who = canonicalOf(state);
  const A = who(a), B = who(b);
  const list = (state.carries || [])
    .filter(c => (who(c.from) === A && who(c.to) === B) || (who(c.from) === B && who(c.to) === A))
    .sort((x, y) => (y.at || 0) - (x.at || 0));
  const c = list[0];
  if (!c || c.status === 'withdrawn' || rolled(c, state)) return null;
  if (!owed || !(owed.amount > 0) || who(c.from) !== who(owed.from)) return null;
  if (c.status === 'declined' && cents(c.amount) !== cents(owed.amount)) return null;
  return { ...c, carried: Math.min(c.amount, owed.amount) };
}

/** Remind and Request stay off while an agreed carry covers the card. */
export function remindable(state, pid, owed) {
  const who = canonicalOf(state);
  return cardCarry(state, state.me, who(pid), owed)?.status !== 'agreed';
}

/** A pair can roll it over only when they share a round, so the other phone can answer. */
export function canCarry(state, a, b, now = Date.now()) {
  return pairRounds(state, a, b, { now }).length > 0;
}

/**
 * What's open between two people on their shared rounds only, as { from, to, amount } (ids as
 * the Tab knows them), or null when that's square. The same on both phones.
 */
export function sharedOwed(state, a, b, now = Date.now()) {
  const c = pairDebt(state, a, b, { now });
  if (!c) return null;
  const who = canonicalOf(state);
  return c > 0 ? { from: who(a), to: who(b), amount: c / 100 } : { from: who(b), to: who(a), amount: -c / 100 };
}

/**
 * The carry on one person card. Between people who share rounds it's measured against the
 * shared rounds only, so both phones show the same amount. A carry saved before, on a pair with
 * no shared round left to look up, still reads against the Tab (`owed`) as it always did.
 */
export function cardCarry(state, a, b, owed, now = Date.now()) {
  const basis = canCarry(state, a, b, now) ? sharedOwed(state, a, b, now) : owed;
  // A carry on the shared rounds that runs against the card (this phone's own rounds turn it
  // around) isn't what the card is about, so it doesn't show there or hold back Remind
  const who = canonicalOf(state);
  if (owed && basis && who(basis.from) !== who(owed.from)) return null;
  return activeCarry(state, a, b, basis);
}

/**
 * Which shared rounds an ask covers and how much of it sits on each: the open round transfers
 * the same way first, oldest first; when the Tab has passed the money through other people and
 * no round transfer is open that way, the whole ask sits on your newest round together.
 */
export function carrySplit(state, from, to, amount, now = Date.now()) {
  const out = [];
  let left = cents(amount);
  for (const x of openTransfers(state, from, to, now).filter(o => o.forward)) {
    if (!left) break;
    const part = Math.min(left, x.open);
    left -= part;
    out.push({ round: x.round, from: x.t.from, to: x.t.to, cents: part });
  }
  if (left > 0) {
    const who = canonicalOf(state);
    const r = out.at(-1)?.round || pairRounds(state, from, to, { now }).at(-1);
    if (!r) return out;
    const hit = out.find(o => o.round === r);
    if (hit) hit.cents += left;
    else {
      const seat = id => r.players.find(p => who(p.id) === who(id))?.id || id;
      out.push({ round: r, from: seat(from), to: seat(to), cents: left });
    }
  }
  return out;
}

/** The rows that send a carry to the other phone. `split` comes from carrySplit on a new ask. */
export function carryRows(state, carry, { now = Date.now(), split = null } = {}) {
  const parts = split || rowsOf(state, carry);
  return parts.map(p => {
    const code = codeOf(p.round);
    const who = canonicalOf(state);
    const by = p.round.players.find(x => who(x.id) === who(carry.by))?.id || carry.by;
    return {
      code, id: carryRowId(code, p.from, p.to), kind: 'carry', from: p.from, to: p.to, amount: p.cents / 100,
      status: carry.status, by, reason: carry.reason || null, at: carry.at, updatedAt: now,
    };
  });
}

/** The parts of an existing carry, from the rows it was sent in. */
function rowsOf(state, carry) {
  const who = canonicalOf(state);
  return Object.values(state.tabRows || {})
    .filter(r => r.kind === 'carry' && r.at === carry.at && who(r.from) === who(carry.from) && who(r.to) === who(carry.to))
    .map(r => ({ round: Object.values(state.rounds).find(x => codeOf(x) === r.code), from: r.from, to: r.to, cents: cents(r.amount) }))
    .filter(p => p.round);
}

/** Round ids a carry split touches (for the carry's roundIds). */
export const splitRounds = split => [...new Set(split.map(p => p.round.id))];
/** Codes a carry split touches. */
export const splitCodes = split => [...new Set(split.map(p => codeOf(p.round)))];
