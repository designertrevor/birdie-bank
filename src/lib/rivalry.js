// Rivalry cards, the start of the Record Book: you against one friend, all time. Built on the
// same round-by-round story the Player card lists (ledger.js personStory), so its money and record
// always agree with the story, the head to head on Players and History, and the Tab.
// - Money: what you've won from them, bet by bet, in money rounds only. Points and reward rounds
//   count in the record, the streak and "rounds together", never in dollars.
// - A round where one of you left early counts like any other: the round's pairs already square
//   you for the holes after (see round.js), so it's the holes you both played.
// - One friend with more than one id is one rival (people-links.js), and so are you.
// Pure, unit tested.
import { leftAt } from './round.js';
import { meFor } from './format.js';
import { headToHeadSummary, nameOf, personStory } from './ledger.js';
import { canonicalOf } from './pair-debts.js';

const c = v => Math.round(v * 100) / 100 || 0;
const resultOf = amount => (amount > 0 ? 'won' : amount < 0 ? 'lost' : 'even');
const first = name => String(name || '').trim().split(/\s+/)[0] || 'They';

/** Who of the two left the round before the last hole: 'you', 'them', 'both' or null. */
export function leftEarly(round, state, ids, other) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  const who = canonicalOf(state);
  const O = who(other);
  const me = meFor(round, state);
  const gone = id => leftAt(round, id) < round.holes.length;
  const you = !!me && gone(me);
  const them = round.players.some(p => !mine.has(p.id) && p.id !== me && who(p.id) === O && gone(p.id));
  return you && them ? 'both' : you ? 'you' : them ? 'them' : null;
}

/**
 * You against one friend, all time:
 * { rounds, won, lost, even, net, moneyRounds, otherRounds, streak, best, worst, first, last, leftEarly, rows }
 * - net: dollars you're up (+) or down (-) on them, same as the story and the head to head;
 * - streak: { result: 'won' | 'lost' | 'even', count } for the newest rounds in a row, or null;
 * - best / worst: your biggest money win and loss against them, { id, round, amount, at, left },
 *   or null (the newest one wins a tie);
 * - first / last: the first and the latest round you played together;
 * - rows: every round together, newest first, { id, round, amount, money, at, result, left }.
 * `ids` is every id that means you.
 */
export function rivalry(state, ids, other) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  const story = personStory(state, mine, other);
  const rows = story.items.filter(it => it.kind === 'round').map(it => ({
    id: it.id, round: it.round, amount: it.amount, money: it.money, at: it.at,
    result: resultOf(it.amount), left: leftEarly(it.round, state, mine, other),
  }));
  let streak = null;
  for (const r of rows) {
    if (!streak) streak = { result: r.result, count: 1 };
    else if (r.result === streak.result) streak.count++;
    else break;
  }
  let best = null, worst = null;
  for (const r of rows) {
    if (!r.money) continue;
    // Newest first, so a strict comparison keeps the newest of two equal amounts
    if (r.amount > 0 && (!best || r.amount > best.amount)) best = r;
    if (r.amount < 0 && (!worst || r.amount < worst.amount)) worst = r;
  }
  const moneyRounds = rows.filter(r => r.money).length;
  return {
    rounds: story.rounds, won: story.won, lost: story.lost, even: story.even, net: story.net,
    moneyRounds, otherRounds: rows.length - moneyRounds,
    streak, best, worst,
    first: rows.at(-1) || null, last: rows[0] || null,
    leftEarly: rows.filter(r => r.left).length,
    rows,
  };
}

/** Who leads the series: "You lead 5–3", "Bo leads 5–3", "All square 4–4" (even rounds left out). */
export function seriesLine(rv, name) {
  const f = first(name);
  if (rv.won > rv.lost) return `You lead ${rv.won}–${rv.lost}`;
  if (rv.lost > rv.won) return `${f} leads ${rv.lost}–${rv.won}`;
  return `All square ${rv.won}–${rv.lost}`;
}

/** "You've won the last 3", "Bo took the last one", "The last 2 were even". Null with no rounds. */
export function streakLine(streak, name) {
  if (!streak) return null;
  const f = first(name);
  const { result, count } = streak;
  if (result === 'won') return count === 1 ? 'You took the last one' : `You’ve won the last ${count}`;
  if (result === 'lost') return count === 1 ? `${f} took the last one` : `${f} has won the last ${count}`;
  return count === 1 ? 'The last one was even' : `The last ${count} were even`;
}

// Light trash talk for your nemesis, never mean. {n} is their first name.
export const NEMESIS_LINES = [
  '{n} has your number. Time to get it back.',
  '{n} would like to thank you for your continued support.',
  'Every group has one. Yours is {n}.',
  'Circle the next tee time with {n}.',
  '{n} is buying the first round with your money.',
  'Somewhere, {n} is already practicing the handshake.',
];

/** A line for this nemesis. It stays put until you play them again, then may change. */
export function nemesisLine(id, name, rounds = 0) {
  let h = rounds;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return NEMESIS_LINES[h % NEMESIS_LINES.length].replaceAll('{n}', first(name));
}

/**
 * Your nemesis: the friend you've lost the most money to, all time, from the same head to head
 * the Players list shows. { id, name, net, rounds, won, lost, even, line } or null when you're
 * not down on anyone. A tie goes to more rounds together, then more losses, then the name.
 */
export function nemesis(state, ids) {
  const mine = ids instanceof Set ? ids : new Set(ids);
  let pick = null;
  for (const [id, h] of headToHeadSummary(state, mine)) {
    if (!(h.net <= -0.01)) continue;
    const cand = { id, name: nameOf(state, id), ...h };
    if (!pick || cand.net < pick.net
      || (cand.net === pick.net && (cand.rounds > pick.rounds
        || (cand.rounds === pick.rounds && (cand.lost > pick.lost
          || (cand.lost === pick.lost && cand.name.localeCompare(pick.name) < 0)))))) pick = cand;
  }
  return pick && { ...pick, net: c(pick.net), line: nemesisLine(pick.id, pick.name, pick.rounds) };
}
