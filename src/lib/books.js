// Close the books (ROADMAP area 7): at the end of a season, or any time, close a crew's tab or the
// whole Tab for a stretch of rounds. It shows each person's final net for the season (what they won
// or lost in its rounds), and settles or rolls each line still open: Paid records the payment the way
// the Tab or the crew's tab pays a line, and "Roll to next season" leaves it owed into the next
// season, with a Roll to next time ask to the other person when the two of you shared a round live
// (carry.js), so their phone shows it too. The season is kept as a closed season with its totals, for
// History and Season.
//
// Rounds are never rewritten. A closed season is a marker on your phone (`state.books`, synced in
// your profile) plus payments and carry-overs made with the Tab's own machinery (shared-tab.js,
// carry.js, crew-tabs.js), so both phones agree on every dollar. The money never moves on its own:
// a rolled line is still owed, it just opens the next season. A book is
// { id, scope: 'all' | 'crew:<id>', name, crewName?, since, closedAt, by, rounds: [roundId],
//   totals: [{ id, name, cents }], lines: [{ from, to, fromName, toName, cents, how: 'paid' | 'rolled' }],
//   carries: [carryId], updatedAt }. Pure, unit tested; the action is in tab-sync.js.
import { allocatePayment } from './shared-tab.js';
import { canCarry, cardCarry, carryReducer, carryRows, carrySplit, sharedOwed, splitCodes, splitRounds } from './carry.js';
import { crewKey, crewPayment, crewsOf, tabKeyOf, tabsOf } from './crew-tabs.js';
import { nameOf } from './ledger.js';
import { canonicalOf, finishedAt } from './pair-debts.js';
import { onTab, tabResults } from './play-for.js';
import { tripsOf } from './trips.js';
import { withBigMoney } from './big-money.js';

/** The whole Tab's books, as against one crew's. */
export const ALL = 'all';
/** The reason on a carry made by closing the books, shown on both phones' cards. */
export const ROLL_REASON = 'Closing the books for the season';

const cents = v => Math.round((Number(v) || 0) * 100);
export const lineKey = l => `${l.from}>${l.to}`;
const crewIdOf = scope => (String(scope || '').startsWith('crew:') ? scope.slice(5) : null);

/** Every closed season on this phone, newest first; `scope` keeps it to one tab's. */
export function booksOf(state, scope = null) {
  return Object.values(state.books || {}).filter(b => b?.id && (!scope || b.scope === scope))
    .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0) || a.id.localeCompare(b.id));
}

/** The last closed season of a tab, or null. */
export const lastBook = (state, scope) => booksOf(state, scope)[0] || null;

/** Who a closed season was for: "Everyone" or the crew's name (as it is now, else as it was). */
export function bookScopeName(state, book) {
  if (book.scope === ALL) return 'Everyone';
  const id = crewIdOf(book.scope);
  return String(state.crews?.[id]?.name || '').trim() || book.crewName || 'Crew';
}

/**
 * The tab's finished rounds with money in the season open now, oldest first: since its last close
 * (all of them before any), up to `now`. The whole Tab's are every round; a crew's are the rounds on
 * its tab (crew-tabs.js).
 */
export function openRounds(state, scope, { now = Date.now() } = {}) {
  const since = lastBook(state, scope)?.closedAt || 0;
  const trips = tripsOf(state), crews = crewsOf(state);
  const crew = crewIdOf(scope);
  return Object.values(state.rounds || {})
    .filter(r => r.status === 'done' && onTab(r) && finishedAt(r) > since && finishedAt(r) <= now)
    .filter(r => !crew || tabKeyOf(state, r, { trips, crews }) === crewKey(crew))
    .sort((a, b) => finishedAt(a) - finishedAt(b));
}

/**
 * Each person's final net in some rounds, in cents, biggest first: what they won or lost in them,
 * before any payment. A Big Game's rounds have the game's money in them (big-money.js), as the Tab does.
 */
export function seasonTotals(state, rounds) {
  const who = canonicalOf(state);
  const bal = new Map();
  for (const r of rounds) for (const [id, v] of Object.entries(withBigMoney(state, r, tabResults(r)).balances)) bal.set(who(id), (bal.get(who(id)) || 0) + cents(v));
  return [...bal].map(([id, c]) => ({ id, cents: c })).filter(x => x.cents)
    .sort((a, b) => b.cents - a.cents || a.id.localeCompare(b.id));
}

/** "2026 season", or "2026 season 2" when that name is taken on this tab. */
export function defaultBookName(state, scope, now = Date.now()) {
  const year = new Date(now).getFullYear();
  const taken = new Set(booksOf(state, scope).map(b => b.name));
  let name = `${year} season`;
  for (let n = 2; taken.has(name); n++) name = `${year} season ${n}`;
  return name;
}

/** Tidy a season name typed in: single spaces, at most 32 characters. */
export function cleanBookName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 32);
}

/**
 * What closing a tab's books would show: { scope, since, rounds, totals, lines, tab }. `lines` are
 * the tab's own payments still to make (the whole Tab's, or the crew's tab), whatever season they
 * came from: closing settles or rolls all of them, so the next season starts from what's rolled.
 */
export function closePreview(state, scope, { now = Date.now() } = {}) {
  const all = tabsOf(state, { now });
  const crew = crewIdOf(scope);
  const tab = crew ? all.tabs.find(t => t.key === crewKey(crew)) || null : null;
  const lines = crew ? tab?.lines || [] : all.everyone.lines;
  const rounds = openRounds(state, scope, { now });
  const last = lastBook(state, scope);
  return { scope, since: last?.closedAt || (rounds.length ? finishedAt(rounds[0]) : null), rounds, totals: seasonTotals(state, rounds), lines, tab };
}

/**
 * Close a tab's books. `picks` says for each line (by lineKey) 'paid' or 'rolled' (rolled when it
 * says nothing). Every line is worked out from the same Tab, before any of it is paid, so paying all
 * of them squares the tab exactly. Returns { book, rows, settlements, expenses, carries, withdrawn }
 * (`withdrawn`: an earlier close's unanswered asks to roll a line now paid, taken back) to send
 * and keep: payments the way the Tab (allocatePayment) or the crew's tab (crewPayment) pays a whole
 * line, and a Roll to next time ask for each rolled line of yours with someone you shared a round
 * live with (unless one is already asked or agreed between you). With `ask` off (the shared Tab
 * can't reach the other phone) a rolled line is only kept in the book.
 */
export function closeBooks(state, scope, { name = null, picks = {}, now = Date.now(), ask = true, makeId = () => Math.random().toString(36).slice(2, 9) } = {}) {
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  const prev = closePreview(state, scope, { now });
  const crew = crewIdOf(scope);
  const rows = [], settlements = [], expenses = [], carries = [], withdrawn = [], lines = [];
  const pair = (c, l) => (who(c.from) === who(l.from) && who(c.to) === who(l.to)) || (who(c.from) === who(l.to) && who(c.to) === who(l.from));
  for (const line of prev.lines) {
    const how = picks[lineKey(line)] === 'paid' ? 'paid' : 'rolled';
    lines.push({ from: line.from, to: line.to, fromName: nameOf(state, line.from), toName: nameOf(state, line.to), cents: cents(line.amount), how });
    if (how === 'paid') {
      const res = crew
        ? crewPayment(state, crew, line.from, line.to, { now, makeId, tab: prev.tab, line })
        : allocatePayment(state, { from: line.from, to: line.to, amount: line.amount }, { now, makeId });
      rows.push(...res.rows);
      settlements.push(...res.settlements);
      expenses.push(...(res.expenses || []));
      // An earlier close's ask to roll this line, still unanswered, is moot once it's paid
      for (const c of state.carries || []) {
        if (c?.status !== 'asked' || c.reason !== ROLL_REASON || !pair(c, line)) continue;
        const next = carryReducer(c, { type: 'withdraw', at: now });
        rows.push(...carryRows(state, next, { now }));
        withdrawn.push(next);
      }
      continue;
    }
    // Rolled: still owed, into the next season. Between you and someone you shared a round live
    // with, it's a Roll to next time ask their phone answers, on the rounds both phones have
    const other = line.from === me ? line.to : line.to === me ? line.from : null;
    if (!ask || !other || !canCarry(state, me, other, now)) continue;
    const owed = { from: line.from, to: line.to, amount: line.amount };
    const open = cardCarry(state, me, other, owed, now);
    if (open && (open.status === 'asked' || open.status === 'agreed')) continue;
    const shared = sharedOwed(state, line.from, line.to, now);
    if (!shared || who(shared.from) !== who(line.from)) continue;
    const amount = Math.min(cents(line.amount), cents(shared.amount)) / 100;
    const split = carrySplit(state, shared.from, shared.to, amount, now);
    if (!split.length) continue;
    const carry = carryReducer(null, { type: 'ask', from: shared.from, to: shared.to, amount, by: me, reason: ROLL_REASON, at: now, roundIds: splitRounds(split), codes: splitCodes(split) });
    rows.push(...carryRows(state, carry, { now, split }));
    carries.push(carry);
  }
  const names = id => nameOf(state, id);
  const book = {
    id: `bk_${makeId()}`, scope, name: cleanBookName(name) || defaultBookName(state, scope, now),
    ...(crew ? { crewName: String(state.crews?.[crew]?.name || '').trim() || 'Crew' } : {}),
    since: prev.since, closedAt: now, by: me,
    rounds: prev.rounds.map(r => r.id),
    totals: prev.totals.map(t => ({ ...t, name: names(t.id) })),
    lines, carries: carries.map(c => c.id), updatedAt: now,
  };
  return { book, rows, settlements, expenses, carries, withdrawn };
}

/** Your final net in a closed season, in cents (you are `state.me`). */
export function myBookNet(state, book) {
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  return (book.totals || []).filter(t => who(t.id) === me).reduce((a, t) => a + t.cents, 0);
}

/** What a tab's last close rolled into the season open now, for you: cents, positive when it's owed to you. */
export function rolledIn(state, scope) {
  const book = lastBook(state, scope);
  if (!book) return 0;
  const who = canonicalOf(state);
  const me = state.me ? who(state.me) : null;
  let c = 0;
  for (const l of book.lines || []) {
    if (l.how !== 'rolled') continue;
    if (who(l.to) === me) c += l.cents;
    else if (who(l.from) === me) c -= l.cents;
  }
  return c;
}
