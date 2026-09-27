// History and Up next: which finished rounds fall in a time range, month totals, the season
// line and "your tab at a glance". Pure functions of the app state, so they're easy to test.
import { roundResults } from './round.js';
import { meFor, myIds } from './format.js';
import { outstanding } from './ledger.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When a round counts for History: when it finished, or when it started if it never did. */
export const roundTime = r => r.finishedAt || r.createdAt || 0;

/** "2026-09-27" for a local date (what a date input gives back). */
export function isoDay(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function parseDay(s) {
  const [y, m, d] = String(s || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** The range History opens on: this season (the calendar year). */
export function defaultRange(now = new Date()) {
  return { kind: 'season', year: now.getFullYear() };
}

/** Switch the control to a kind, keeping the period you were looking at where it makes sense. */
export function rangeOfKind(kind, from, now = new Date()) {
  const year = from.year ?? now.getFullYear();
  if (kind === 'season') return { kind, year };
  if (kind === 'month') {
    const month = year === now.getFullYear() ? now.getMonth() : 11;
    return { kind, year, month: from.kind === 'month' ? from.month : month };
  }
  // Custom starts on the last 30 days, a sensible window to adjust from
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(to); start.setDate(start.getDate() - 29);
  return { kind: 'custom', from: isoDay(start), to: isoDay(to) };
}

/** [start, end) in ms for a range. A custom range includes both of its days. */
export function rangeBounds(range) {
  if (range.kind === 'season') return [new Date(range.year, 0, 1).getTime(), new Date(range.year + 1, 0, 1).getTime()];
  if (range.kind === 'month') return [new Date(range.year, range.month, 1).getTime(), new Date(range.year, range.month + 1, 1).getTime()];
  let a = parseDay(range.from), b = parseDay(range.to);
  if (!a && !b) return [-Infinity, Infinity];
  if (a && b && a > b) [a, b] = [b, a];
  const end = b ? new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1).getTime() : Infinity;
  return [a ? a.getTime() : -Infinity, end];
}

/** Step a season or month range back (-1) or forward (+1). Custom ranges don't step. */
export function shiftRange(range, dir) {
  if (range.kind === 'season') return { ...range, year: range.year + dir };
  if (range.kind === 'month') {
    const d = new Date(range.year, range.month + dir, 1);
    return { ...range, year: d.getFullYear(), month: d.getMonth() };
  }
  return range;
}

/** Whether stepping forward would only show the future. */
export function isLatest(range, now = new Date()) {
  if (range.kind === 'season') return range.year >= now.getFullYear();
  if (range.kind === 'month') return range.year > now.getFullYear() || (range.year === now.getFullYear() && range.month >= now.getMonth());
  return true;
}

/** "2026 season", "September 2026", "Sep 1 to Sep 27". */
export function rangeLabel(range, now = new Date()) {
  if (range.kind === 'season') return `${range.year} season`;
  if (range.kind === 'month') return `${MONTHS[range.month]} ${range.year}`;
  const a = parseDay(range.from), b = parseDay(range.to);
  const fmt = d => `${SHORT[d.getMonth()]} ${d.getDate()}${d.getFullYear() === now.getFullYear() ? '' : `, ${d.getFullYear()}`}`;
  if (a && b) return a <= b ? `${fmt(a)} to ${fmt(b)}` : `${fmt(b)} to ${fmt(a)}`;
  if (a) return `Since ${fmt(a)}`;
  if (b) return `Up to ${fmt(b)}`;
  return 'All time';
}

/** Finished rounds in a range, newest first. */
export function roundsInRange(state, range) {
  const [start, end] = rangeBounds(range);
  return Object.values(state.rounds)
    .filter(r => r.status === 'done' && roundTime(r) >= start && roundTime(r) < end)
    .sort((a, b) => roundTime(b) - roundTime(a));
}

/** What you won or lost in a round, or null when you weren't playing in it. */
export function myNet(round, state) {
  const me = meFor(round, state);
  if (!me || !round.players.some(p => p.id === me)) return null;
  return roundResults(round).balances[me] ?? 0;
}

const cents = v => Math.round(v * 100) / 100;

/**
 * Group rounds (newest first) by month: [{ key: '2026-09', label, rounds, count, net, played }].
 * `net` adds up only the rounds you played in (`played` counts them); the year shows when it isn't this one.
 */
export function monthGroups(rounds, state, now = new Date()) {
  const groups = [];
  for (const r of rounds) {
    const d = new Date(roundTime(r));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.length || groups.at(-1).key !== key) {
      const label = d.getFullYear() === now.getFullYear() ? MONTHS[d.getMonth()] : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      groups.push({ key, label, rounds: [], count: 0, net: 0, played: 0 });
    }
    const g = groups.at(-1);
    g.rounds.push(r);
    g.count++;
    const n = myNet(r, state);
    if (n != null) { g.net = cents(g.net + n); g.played++; }
  }
  return groups;
}

/**
 * Your running total across the rounds you played in, oldest first:
 * [{ id, t, amount, total }]. This is what the season chart draws.
 */
export function netSeries(rounds, state) {
  let total = 0;
  return [...rounds]
    .sort((a, b) => roundTime(a) - roundTime(b))
    .map(r => ({ r, amount: myNet(r, state) }))
    .filter(x => x.amount != null)
    .map(({ r, amount }) => { total = cents(total + amount); return { id: r.id, t: roundTime(r), amount, total }; });
}

/** Net with each player you had money with over these rounds (positive: you came out ahead of them). */
export function headToHead(rounds, state) {
  const h2h = {};
  for (const r of rounds) {
    const me = meFor(r, state);
    if (!me) continue;
    for (const t of roundResults(r).transfers) {
      if (t.to === me) h2h[t.from] = cents((h2h[t.from] || 0) + t.amount);
      if (t.from === me) h2h[t.to] = cents((h2h[t.to] || 0) - t.amount);
    }
  }
  return h2h;
}

/** What you're owed and what you owe right now, across every round and payment (the Tab at a glance). */
export function myTab(state) {
  const mine = myIds(state);
  let owed = 0, owe = 0, people = 0;
  for (const d of outstanding(state)) {
    if (mine.has(d.to) && mine.has(d.from)) continue; // you and you on another phone's round
    if (mine.has(d.to)) { owed += d.amount; people++; }
    else if (mine.has(d.from)) { owe += d.amount; people++; }
  }
  return { owed: cents(owed), owe: cents(owe), net: cents(owed - owe), people };
}

/** Rounds still being played, the one the Play button resumes first. */
export function activeRounds(state) {
  return Object.values(state.rounds)
    .filter(r => r.status === 'active')
    .sort((a, b) => (b.id === state.activeRoundId) - (a.id === state.activeRoundId) || b.createdAt - a.createdAt);
}

/** Your most recent finished round and what you made in it (amount is null if you only kept score). */
export function lastResult(state) {
  const r = Object.values(state.rounds).filter(x => x.status === 'done').sort((a, b) => roundTime(b) - roundTime(a))[0];
  return r ? { round: r, amount: myNet(r, state) } : null;
}
