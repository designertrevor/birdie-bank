// The day-after recap on Up next: your last round, the next day you open the app. Who took it
// and how you did, who's square and who isn't, what the group rolled to next time, and a moment
// or two from the round.
//
// The rules:
//  • It shows from the calendar day after the round finished (not "Monday": groups play any day),
//    for RECAP_DAYS, until you dismiss it, a newer round finishes, or a round is going on.
//  • Who's paid is status only for everyone ("Owes", "Waiting", "Square", "Carried"), the same
//    words as the who's-square strip on the Tab. An amount shows only on a line you're in.
//  • Money is what the round puts on the Tab (tabResults): a lunch round's side bets for money
//    count, its points never do. A points or reward round has nothing to pay, so no paid section.
//  • Nothing here changes any amount: it only reads the rounds, the payments and the Tab.
// Pure, unit tested in recap.test.js.
import { GAMES, bettors, cardOnly, holeAtPos, isJustPlaying, roundResults } from './round.js';
import { niceRound } from './just-playing.js';
import { gameLabel, meFor, myIds } from './format.js';
import { money } from './golf.js';
import { nameOf, outstanding, tabWith } from './ledger.js';
import { canonicalOf, codeOf, roundRows } from './shared-tab.js';
import { roundTime } from './history.js';
import { isTripPayment } from './trip-pay.js';
import { countsMoney, onTab, playForOf, rewardOutcome, tabResults, unitFmt } from './play-for.js';
import { PRIORITY, rankOf, roundMoment } from './moments.js';
import { recapDay, recapRound } from './recap-round.js';

// Which round the recap is about lives in recap-round.js, so Up next can ask without loading the moments
export { RECAP_DAYS, myDoneRounds, recapDay, recapRound } from './recap-round.js';

/** At most this many moments from the round. */
export const RECAP_MOMENTS = 2;
const EPS = 0.005;

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const toCents = v => Math.round((Number(v) || 0) * 100);
const list = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
// "You and Sam", never "Sam and You"
const youFirst = names => (names.includes('You') ? ['You', ...names.filter(n => n !== 'You')] : names);

/** "You" for any id that means you, else the person's first name (one friend is one name, see people-links.js). */
function youOr(state, id) {
  const ids = myIds(state);
  const who = canonicalOf(state);
  return ids.has(id) || ids.has(who(id)) ? 'You' : first(nameOf(state, who(id)));
}

/** Who's buying in a reward round, as rewardOutcome says it but with you as "You": "You’re buying." */
function youBuy(state, reward) {
  if (!reward.owers.length) return reward.buy;
  const names = reward.owers.map(id => youOr(state, id));
  if (!names.includes('You')) return reward.buy;
  // You first, then the rest
  const ordered = youFirst(names);
  const split = reward.lines.some(l => l.split);
  return ordered.length === 1 ? 'You’re buying.' : split ? `${list(ordered)} split it.` : `${list(ordered)} each buy one.`;
}

/** Who took the round: "Sam took it", "You took it", "Sam and Dave took it" (a team), "Sam and Dave split it", "All square". */
function headline(round, state, res) {
  // A card kept on its own: no game, so nobody took anything
  if (cardOnly(round)) return 'Nice round';
  const reward = rewardOutcome(round, res);
  if (reward) {
    // Who wins the reward, with you as "You" like the rest of the card
    if (!reward.winners.length) return 'All square';
    const names = youFirst(reward.winners.map(id => youOr(state, id)));
    return names.length > 1 ? `${list(names)} share ${reward.noun}` : `${names[0]} ${names[0] === 'You' ? 'win' : 'wins'} ${reward.noun}`;
  }
  const bal = res.balances;
  const top = Math.max(...round.players.map(p => bal[p.id] ?? 0));
  if (!(top > EPS)) return 'All square';
  const winners = round.players.filter(p => top - (bal[p.id] ?? 0) < EPS).map(p => p.id);
  const names = youFirst(winners.map(id => youOr(state, id)));
  if (names.length === 1) return `${names[0]} took it`;
  const team = round.teams?.find(t => t.players.length === winners.length && t.players.every(id => winners.includes(id)));
  return team ? `${list(names)} took it` : `${list(names)} split it`;
}

/** Your own line: "You +$12", "You were level", or who's buying in a reward round. Null when you didn't play. */
function yourLine(round, state, res) {
  const me = meFor(round, state);
  if (!me || !round.players.some(p => p.id === me)) return null;
  // Just playing: your score, never a bet you weren't in
  if (isJustPlaying(round, me)) {
    const n = niceRound(round, me);
    return n ? `You shot ${n.score} (${n.toPar})` : 'You were just playing';
  }
  const reward = rewardOutcome(round, res);
  if (reward) {
    // A reward round's side bets for money are dollars of their own, on the Tab
    const cash = onTab(round) ? tabResults(round, res).balances[me] ?? 0 : 0;
    const buy = youBuy(state, reward);
    return Math.abs(cash) > EPS ? `${buy} You ${money(cash, { sign: true })} on side bets` : buy;
  }
  const amount = Math.round((res.balances[me] ?? 0) * 100) / 100;
  if (Math.abs(amount) < EPS) return countsMoney(round) ? 'You broke even' : 'You were level';
  return `You ${unitFmt(round)(amount, { sign: true })}`;
}

/** The round with only the holes up to playing position `pos` scored, the way it stood then. */
function through(round, pos) {
  const r = { ...round, status: 'active', scores: { ...round.scores }, marks: { ...(round.marks || {}) } };
  round.holes.forEach((h, i) => { if (i + 1 > pos) { delete r.scores[h.no]; delete r.marks[h.no]; } });
  return r;
}

/**
 * The best moments from a finished round, as they happened on the course: [{ id, hole, title, text, kind }],
 * most exciting first, at most `limit`, one of each kind. Quiet holes and a lone skin are left out when
 * something bigger happened.
 */
export function recapMoments(round, { limit = RECAP_MOMENTS } = {}) {
  const found = [];
  round.holes.forEach((h, i) => {
    const pos = i + 1;
    if (!round.scores?.[h.no]) return;
    let m = null;
    try { m = roundMoment(through(round, pos), pos); } catch { m = null; }
    if (m && m.kind !== 'final') found.push({ ...m, hole: holeAtPos(round, pos), pos, rank: rankOf(m) });
  });
  found.sort((a, b) => b.rank - a.rank || a.pos - b.pos);
  const out = [];
  const kinds = new Set();
  for (const m of found) {
    if (out.length >= limit) break;
    if (kinds.has(m.kind)) continue;
    // A single skin is everyday stuff: it only fills in when nothing bigger happened
    if (out.length && m.rank <= PRIORITY.skin) continue;
    kinds.add(m.kind);
    out.push({ id: `${round.id}:${m.id}`, hole: m.hole, title: m.title, text: m.text, kind: m.kind });
  }
  return out;
}

/** Agreed carry-overs on this round, by pair: [{ from, to, amount }] (ids as the round has them). */
function roundCarries(state, round, rows) {
  const who = canonicalOf(state);
  const out = new Map();
  const add = (from, to, amount) => {
    const k = [who(from), who(to)].sort().join('|');
    const had = out.get(k);
    out.set(k, { from, to, amount: (had?.amount || 0) + (Number(amount) || 0) });
  };
  for (const r of rows) if (r.kind === 'carry' && r.status === 'agreed') add(r.from, r.to, r.amount);
  // A carry saved on this phone that names the round (rows already counted keep it from doubling).
  // Its amount can cover other rounds too, so only this round's part of it shows: never more than
  // the round has between the two of them
  const transfers = tabResults(round).transfers;
  for (const c of state.carries || []) {
    if (c?.status !== 'agreed' || !Array.isArray(c.roundIds) || !c.roundIds.includes(round.id)) continue;
    const k = [who(c.from), who(c.to)].sort().join('|');
    if (out.has(k)) continue;
    const t = transfers.find(x => who(x.from) === who(c.from) && who(x.to) === who(c.to));
    add(t?.from ?? c.from, t?.to ?? c.to, t ? Math.min(toCents(c.amount), toCents(t.amount)) / 100 : 0);
  }
  return [...out.values()];
}

/**
 * Where each of the round's payments stands: [{ from, to, amount, status, left, onTab, payeeDone }], where
 * status is 'paid', 'square' (the Tab has squared it some other way), 'carried' (rolled to next time) or
 * 'open', and `left` is what's still open in cents. The Tab has the last word, the way it keeps the money:
 *  • A shared round's money is kept between the two people in it (pair-debts.js): it's open only while
 *    the Tab has the payer paying this same person, and never for more than the Tab has between them.
 *  • A round on this phone alone goes into everyone's balances, and the Tab squares the group in the
 *    fewest payments, so the payer's money can be routed to someone else. A payment between the two
 *    since the round (on the Tab, with no round on it) pays it. Otherwise it's square only once the
 *    payer owes nobody on the Tab: someone nobody owes any more can still have a payer who hasn't paid
 *    (their money goes where the payee owed it), so that alone never squares it. Then `onTab` is false,
 *    `left` is never more than the payer still owes in all, and `payeeDone` says nobody owes the payee
 *    any more, so they aren't waiting on anyone.
 */
export function recapTransfers(state, round, { now = Date.now(), rows = roundRows(state, round), plan = outstanding(state, { now }) } = {}) {
  const who = canonicalOf(state);
  const carries = roundCarries(state, round, rows);
  const match = (r, t) => r.from === t.from && r.to === t.to;
  const shared = !!codeOf(round);
  const owesInAll = id => plan.filter(d => d.from === id).reduce((a, d) => a + toCents(d.amount), 0);
  const payees = new Set(plan.map(d => who(d.to)));
  const since = roundTime(round);
  // Tab payments with no round on them, from one to the other since the round (a round's own are in rows)
  const ids = new Set(rows.map(r => r.id));
  const loose = (state.settlements || []).filter(s => !s.code && !s.roundId && !ids.has(s.id) && !isTripPayment(s) && (s.at || 0) >= since);
  return tabResults(round).transfers.map(t => {
    const due = toCents(t.amount);
    const paid = rows.filter(r => r.kind === 'payment' && r.status === 'paid' && match(r, t)).reduce((a, r) => a + toCents(r.amount), 0);
    const netted = rows.some(r => r.kind === 'payment' && r.status === 'netted' && match(r, t));
    const base = { from: t.from, to: t.to, amount: t.amount, onTab: false, payeeDone: false };
    if (netted || paid >= due) return { ...base, status: 'paid', left: 0 };
    const pair = [who(t.from), who(t.to)].sort().join('|');
    if (carries.some(c => [who(c.from), who(c.to)].sort().join('|') === pair)) return { ...base, status: 'carried', left: due - paid };
    const onCard = toCents(tabWith(plan, new Set([who(t.to)]), who(t.from)));
    if (onCard > 0) return { ...base, status: 'open', left: Math.min(due - paid, onCard), onTab: true };
    if (shared) return { ...base, status: 'square', left: 0 };
    const paidSince = loose.filter(s => who(s.from) === who(t.from) && who(s.to) === who(t.to)).reduce((a, s) => a + toCents(s.amount), 0);
    if (paid + paidSince >= due) return { ...base, status: 'paid', left: 0 };
    const owes = owesInAll(who(t.from));
    if (owes <= 0) return { ...base, status: 'square', left: 0 };
    return { ...base, status: 'open', left: Math.min(due - paid - paidSince, owes), payeeDone: !payees.has(who(t.to)) };
  });
}

/**
 * Who's square in the round, one entry a player: { playerId: 'square' | 'owes' | 'waiting' | 'carried' },
 * like roundStatus on the Tab but with the Tab's word on rounds that were never shared.
 */
export function recapStatus(round, transfers) {
  const out = Object.fromEntries(round.players.map(p => [p.id, 'square']));
  const owes = new Set(), waits = new Set(), carried = new Set();
  for (const t of transfers) {
    if (t.status === 'open') { owes.add(t.from); if (!t.payeeDone) waits.add(t.to); }
    if (t.status === 'carried') { carried.add(t.from); carried.add(t.to); }
  }
  for (const id of Object.keys(out)) {
    if (owes.has(id)) out[id] = 'owes';
    else if (waits.has(id)) out[id] = 'waiting';
    else if (carried.has(id)) out[id] = 'carried';
  }
  return out;
}

/**
 * Who's paid in a round: null when it had nothing to pay, else { people: [{ id, name, status }], square,
 * total, allSquare, mine: [{ id, text, status, other }] }. Only `mine` has amounts, and only on lines
 * you're one of the two in.
 */
export function recapPaid(state, round, { now = Date.now(), rows = roundRows(state, round), res = roundResults(round) } = {}) {
  if (!onTab(round) || !tabResults(round, res).transfers.length) return null;
  const ids = myIds(state);
  const who = canonicalOf(state);
  const isMe = id => ids.has(id) || ids.has(who(id));
  const name = id => (isMe(id) ? 'You' : first(nameOf(state, who(id))));
  const transfers = recapTransfers(state, round, { now, rows });
  const status = recapStatus(round, transfers);
  // Anyone just playing had nothing to pay, so they're not in who's paid
  const people = bettors(round).map(p => ({ id: p.id, name: name(p.id), status: status[p.id] }));
  const square = people.filter(p => p.status === 'square').length;
  const mine = [];
  // What the Tab has between you and someone now (positive: they pay you), worked out only when a line needs it
  let plan = null;
  const between = id => tabWith(plan ??= outstanding(state, { now }), ids, id);
  for (const t of transfers) {
    const fromMe = isMe(t.from), toMe = isMe(t.to);
    if (fromMe === toMe) continue; // between two other people (or you and you): status only
    const other = who(fromMe ? t.to : t.from);
    const o = name(other);
    const amt = money(t.amount);
    // Still owed, but the Tab squares it through someone else: it says who pays whom
    const routed = t.status === 'open' && !t.onTab;
    // Owed to you, but nobody owes you on the Tab any more: it went to what you owed, so it's square for you
    const doneForMe = routed && !fromMe && t.payeeDone;
    // Squared some other way: it's this round's money that's square, not always everything between you
    const squared = fromMe ? `Your ${amt} to ${o} is squared on the Tab` : `${o}’s ${amt} to you is squared on the Tab`;
    // Netted against other money between the two of you: say against what
    const netted = () => {
      const v = between(other);
      if (fromMe && v > 0) return `Your ${amt} to ${o} comes off what ${o} owes you on the Tab`;
      if (fromMe && v === 0) return `Your ${amt} to ${o} evens out with what ${o} owed you on the Tab`;
      if (!fromMe && v < 0) return `${o}’s ${amt} to you comes off what you owe ${o} on the Tab`;
      if (!fromMe && v === 0) return `${o}’s ${amt} to you evens out with what you owed ${o} on the Tab`;
      return squared;
    };
    const text = doneForMe
      ? squared
      : routed
      ? (fromMe ? `You still owe ${money(t.left / 100)} from this round. The Tab has who to pay` : `${o} still owes ${money(t.left / 100)} from this round. The Tab has who pays you`)
      : t.status === 'open'
      ? (fromMe ? `You owe ${o} ${money(t.left / 100)}` : `${o} owes you ${money(t.left / 100)}`)
      : t.status === 'carried'
        ? `You and ${o} rolled ${amt} to next time`
        : t.status === 'paid'
          ? (fromMe ? `You paid ${o} ${amt}` : `${o} paid you ${amt}`)
          : netted();
    mine.push({ id: `${t.from}>${t.to}`, text, status: doneForMe ? 'square' : t.status, other });
  }
  return { people, square, total: people.length, allSquare: square === people.length, mine };
}

/**
 * Everything the recap card shows, for one round:
 * { round, id, when, title, headline, yours, playFor, moments, paid, carried, code, target }
 * - paid: see recapPaid.
 * - carried: [{ id, text, mine }]: an amount only on a carry you're one of the two in.
 */
export function recapOf(state, round, now = Date.now()) {
  const res = roundResults(round);
  const ids = myIds(state);
  const who = canonicalOf(state);
  const isMe = id => ids.has(id) || ids.has(who(id));
  const name = id => (isMe(id) ? 'You' : first(nameOf(state, who(id))));
  const rows = roundRows(state, round);
  const owed = recapPaid(state, round, { now, rows, res });
  // What you rolled over has its own line under "Rolled to next time", so it isn't said twice
  const paid = owed && { ...owed, mine: owed.mine.filter(l => l.status !== 'carried') };
  const carried = roundCarries(state, round, rows).map(c => {
    const mineToo = isMe(c.from) || isMe(c.to);
    const other = isMe(c.from) ? c.to : c.from;
    return {
      id: `${c.from}>${c.to}`, mine: mineToo,
      text: mineToo ? `You and ${name(other)} rolled ${Number(c.amount) > 0 ? money(c.amount) : 'it'} to next time` : `${name(c.from)} and ${name(c.to)} rolled it to next time`,
    };
  });
  const pf = playForOf(round);
  return {
    round, id: round.id,
    when: recapDay(roundTime(round), now),
    title: `${gameLabel(round)} at ${round.course?.name || 'the course'}`,
    headline: headline(round, state, res),
    yours: yourLine(round, state, res),
    playFor: pf.kind,
    moments: recapMoments(round),
    paid, carried,
    code: codeOf(round),
    target: ['roundDetail', { id: round.id }],
  };
}

/** The recap to show on Up next right now, or null. A round it can't read never takes Up next down with it. */
export function currentRecap(state, now = Date.now()) {
  try {
    const r = recapRound(state, now);
    return r ? recapOf(state, r, now) : null;
  } catch {
    return null;
  }
}
