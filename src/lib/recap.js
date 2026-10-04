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
import { GAMES, holeAtPos, roundResults } from './round.js';
import { gameLabel, meFor, myIds } from './format.js';
import { money } from './golf.js';
import { nameOf, outstanding, tabWith } from './ledger.js';
import { canonicalOf, codeOf, roundRows } from './shared-tab.js';
import { activeRounds, roundTime } from './history.js';
import { played } from './pair-debts.js';
import { countsMoney, onTab, playForOf, rewardOutcome, tabResults, unitFmt } from './play-for.js';
import { PRIORITY, rankOf, roundMoment } from './moments.js';

/** How many days the recap stays up after the day it first shows. */
export const RECAP_DAYS = 7;
/** At most this many moments from the round. */
export const RECAP_MOMENTS = 2;
const DAY = 24 * 60 * 60 * 1000;
const EPS = 0.005;
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const toCents = v => Math.round((Number(v) || 0) * 100);
const startOfDay = t => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const list = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** "Yesterday" for the day before `now`, otherwise "Sat, Sep 26". */
export function recapDay(at, now = Date.now()) {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days === 1) return 'Yesterday';
  const d = new Date(at);
  return `${SHORT_DAYS[d.getDay()]}, ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Your finished rounds (ones you played, never a watcher's copy), newest first. */
export function myDoneRounds(state) {
  return Object.values(state?.rounds || {})
    .filter(r => r?.status === 'done' && GAMES[r.game] && played(r, state))
    .sort((a, b) => roundTime(b) - roundTime(a));
}

/**
 * The round the recap is about, or null: your newest finished round, once a new calendar day has
 * started since it finished and for RECAP_DAYS after that, unless it's been dismissed on this phone
 * (`seen`, { roundId: when }) or a round is going on.
 */
export function recapRound(state, now = Date.now(), { seen = state?.recapSeen } = {}) {
  if (activeRounds(state).length) return null;
  const r = myDoneRounds(state)[0];
  if (!r) return null;
  const at = roundTime(r);
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days < 1 || days > RECAP_DAYS) return null;
  if (seen && typeof seen === 'object' && seen[r.id]) return null;
  return r;
}

/** Who took the round: "Sam took it", "You took it", "Sam and Dave took it" (a team), "Sam and Dave split it", "All square". */
function headline(round, state, res) {
  const reward = rewardOutcome(round, res);
  if (reward) return reward.win.replace(/\.$/, '');
  const bal = res.balances;
  const top = Math.max(...round.players.map(p => bal[p.id] ?? 0));
  if (!(top > EPS)) return 'All square';
  const winners = round.players.filter(p => top - (bal[p.id] ?? 0) < EPS).map(p => p.id);
  const ids = myIds(state);
  const who = canonicalOf(state);
  const names = winners.map(id => (ids.has(id) || ids.has(who(id)) ? 'You' : first(nameOf(state, who(id)))));
  if (names.length === 1) return `${names[0]} took it`;
  const team = round.teams?.find(t => t.players.length === winners.length && t.players.every(id => winners.includes(id)));
  return team ? `${list(names)} took it` : `${list(names)} split it`;
}

/** Your own line: "You +$12", "You were level", or who's buying in a reward round. Null when you didn't play. */
function yourLine(round, state, res) {
  const me = meFor(round, state);
  if (!me || !round.players.some(p => p.id === me)) return null;
  const reward = rewardOutcome(round, res);
  if (reward) {
    // A reward round's side bets for money are dollars of their own, on the Tab
    const cash = onTab(round) ? tabResults(round, res).balances[me] ?? 0 : 0;
    return Math.abs(cash) > EPS ? `${reward.buy} You ${money(cash, { sign: true })} on side bets` : reward.buy;
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
  // A carry saved on this phone that names the round (rows already counted keep it from doubling)
  for (const c of state.carries || []) {
    if (c?.status !== 'agreed' || !Array.isArray(c.roundIds) || !c.roundIds.includes(round.id)) continue;
    const k = [who(c.from), who(c.to)].sort().join('|');
    if (!out.has(k)) add(c.from, c.to, c.amount);
  }
  return [...out.values()];
}

/**
 * Where each of the round's payments stands: [{ from, to, amount, status, left, onTab }], where status is
 * 'paid' (paid on the round, or squared when the whole card was paid), 'square' (on the Tab the payer
 * owes nobody any more, or nobody owes the other person, however it got there), 'carried' (rolled to next time) or 'open', and `left` is
 * what's still open in cents. `onTab` says the Tab still has the payer paying this same person (it
 * squares the group in the fewest payments, so the money can be routed to someone else): then `left`
 * is never more than the Tab has between the two.
 */
export function recapTransfers(state, round, { now = Date.now(), rows = roundRows(state, round), plan = outstanding(state, { now }) } = {}) {
  const who = canonicalOf(state);
  const carries = roundCarries(state, round, rows);
  const match = (r, t) => r.from === t.from && r.to === t.to;
  const payers = new Set(plan.map(d => who(d.from)));
  const payees = new Set(plan.map(d => who(d.to)));
  return tabResults(round).transfers.map(t => {
    const due = toCents(t.amount);
    const paid = rows.filter(r => r.kind === 'payment' && r.status === 'paid' && match(r, t)).reduce((a, r) => a + toCents(r.amount), 0);
    const netted = rows.some(r => r.kind === 'payment' && r.status === 'netted' && match(r, t));
    const base = { from: t.from, to: t.to, amount: t.amount };
    if (netted || paid >= due) return { ...base, status: 'paid', left: 0, onTab: false };
    const pair = [who(t.from), who(t.to)].sort().join('|');
    if (carries.some(c => [who(c.from), who(c.to)].sort().join('|') === pair)) return { ...base, status: 'carried', left: due - paid, onTab: false };
    // The Tab has the last word: a payer who owes nobody on it, or someone nobody owes any more, is square
    if (!payers.has(who(t.from)) || !payees.has(who(t.to))) return { ...base, status: 'square', left: 0, onTab: false };
    const onCard = toCents(tabWith(plan, new Set([who(t.to)]), who(t.from)));
    return { ...base, status: 'open', left: onCard > 0 ? Math.min(due - paid, onCard) : due - paid, onTab: onCard > 0 };
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
    if (t.status === 'open') { owes.add(t.from); waits.add(t.to); }
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
  const people = round.players.map(p => ({ id: p.id, name: name(p.id), status: status[p.id] }));
  const square = people.filter(p => p.status === 'square').length;
  const mine = [];
  for (const t of transfers) {
    const fromMe = isMe(t.from), toMe = isMe(t.to);
    if (fromMe === toMe) continue; // between two other people (or you and you): status only
    const other = who(fromMe ? t.to : t.from);
    const o = name(other);
    const amt = money(t.amount);
    // Still owed, but the Tab squares it through someone else: it says who pays whom
    const routed = t.status === 'open' && !t.onTab;
    const text = routed
      ? (fromMe ? `You still owe ${money(t.left / 100)} from this round. The Tab has who to pay` : `${o} still owes ${money(t.left / 100)} from this round. The Tab has who pays you`)
      : t.status === 'open'
      ? (fromMe ? `You owe ${o} ${money(t.left / 100)}` : `${o} owes you ${money(t.left / 100)}`)
      : t.status === 'carried'
        ? `You and ${o} rolled ${amt} to next time`
        : t.status === 'paid'
          ? (fromMe ? `You paid ${o} ${amt}` : `${o} paid you ${amt}`)
          : `You and ${o} are square`;
    mine.push({ id: `${t.from}>${t.to}`, text, status: t.status, other });
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
  const paid = recapPaid(state, round, { now, rows, res });
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
