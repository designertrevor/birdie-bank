// The shared Tab: payments and carry-overs that belong to a round that was shared live, so an
// "I paid" on one phone shows on the other. The server keeps one row per round transfer (see
// supabase/2026-09-29-round-payments.sql); this file turns those rows into this phone's
// settlements, carries and the round's who-is-square status. Pure, unit tested. The transport
// is tab-sync.js.
//
// The Tab by person is this phone's own math (every round on this phone). What's open on the
// shared rounds stays between the two people in them (pair-debts.js), so both phones agree on it;
// the rest is netted and passed on through the group as before. The shared layer is per round
// transfer: a payment is tied to the round transfers between the two people, oldest first, and
// anything the shared rounds don't explain stays local.
import { onTab, tabResults } from './play-for.js';
import { meFor } from './format.js';
import { outstanding, tabWith } from './ledger.js';
import { FETCH_DAYS, canonicalOf, cents, codeOf, finishedAt, lockedRounds, nettedId, nettedOn, pairDebt, paidOn, played, sharedRounds } from './pair-debts.js';
import { isTripPayment } from './trip-pay.js';
import { planRows } from './trip-plan.js';

export { FETCH_DAYS, canonicalOf, codeOf, nettedId, pairDebt, played, sharedRounds };

const DAY = 864e5;
/** The who-is-square strip follows your newest shared round from this far back. */
export const STRIP_DAYS = 30;

/** A full transfer paid in one go: both phones marking it land on the same row, so it counts once. */
export const paymentId = (code, from, to, part = null) => (part ? `${code}:${from}>${to}:${part}` : `${code}:${from}>${to}`);
/** The carry-over row for one round's transfer between two people. */
export const carryRowId = (code, from, to) => `${code}:${from}>${to}:carry`;
/** One carry on this phone: the pair (in the direction owed) and when it was asked. */
export const carryId = (from, to, at) => `k:${from}>${to}:${at}`;
const rowKey = r => `${r.code}|${r.id}`;


/** The codes to look up on the server. */
export function tabCodes(state, opts) {
  return [...new Set(sharedRounds(state, opts).map(codeOf))];
}

/**
 * Shared rounds both people played (ids as the Tab knows them), oldest first. Only rounds the
 * other phone still looks up (FETCH_DAYS) count: a payment or ask put on an older round would
 * never reach it, so older rounds stay on this phone like any unshared round.
 */
export function pairRounds(state, a, b, { days = FETCH_DAYS, now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const A = who(a), B = who(b);
  return lockedRounds(state, { days, now }).filter(r => {
    const ids = new Set(r.players.map(p => who(p.id)));
    return ids.has(A) && ids.has(B);
  });
}

/**
 * Money rounds by share code. A points or reward round never takes a payment row, so a row a
 * phone on an older version put on one (it can't tell it isn't money) never moves a dollar here.
 */
function roundsByCode(state) {
  const out = new Map();
  for (const r of Object.values(state.rounds || {})) {
    if (!onTab(r)) continue;
    const c = codeOf(r);
    if (c && !out.has(c)) out.set(c, r);
  }
  return out;
}

/** Same data, same text: compares settlements and carries without caring about key order. */
function same(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const x = a?.[k], y = b?.[k];
    if (Array.isArray(x) || Array.isArray(y)) { if (JSON.stringify(x || []) !== JSON.stringify(y || [])) return false; }
    else if ((x ?? null) !== (y ?? null)) return false;
  }
  return true;
}

/** The settlement a paid row stands for. */
function settlementOf(row, round) {
  const s = { id: row.id, from: row.from, to: row.to, amount: Number(row.amount), at: row.at, roundId: round.id, code: row.code, by: row.by || null, shared: true };
  // Made from "Settle the trip" (trip-pay.js): the trip knows it's being settled on every phone
  if (row.reason) s.reason = row.reason;
  return s;
}

/**
 * Put payment and carry rows from the server (or from this phone) onto the state. Returns a
 * new state with `tabRows` (the rows, kept for the round status), `settlements` and `carries`.
 * A 'paid' payment is a settlement, 'undone' removes it, 'netted' changes no money. Rows for a
 * round this phone doesn't have are ignored. Applying the same rows twice changes nothing.
 */
export function applyRows(state, rows) {
  const rounds = roundsByCode(state);
  const cache = {};
  for (const [k, r] of Object.entries(state.tabRows || {})) if (rounds.has(r.code)) cache[k] = r;
  // Only rows that are new or changed here move money. A row this phone already had is not
  // applied again, so a payment your other phone took back (and the account sync removed)
  // doesn't come back from this phone's older copy when some other row arrives.
  const changed = new Set();
  for (const row of rows || []) {
    if (!row?.code || !row.id || !rounds.has(row.code)) continue;
    const k = rowKey(row);
    if (cache[k] && (cache[k].updatedAt || 0) > (row.updatedAt || 0)) continue;
    if (cache[k] && JSON.stringify(cache[k]) === JSON.stringify(row)) continue;
    cache[k] = row;
    changed.add(k);
  }

  // Payments: only settlements named by a row are touched, so local payments stay as they are
  const settlements = [...(state.settlements || [])];
  for (const k of changed) {
    const row = cache[k];
    if (row.kind !== 'payment') continue;
    const i = settlements.findIndex(s => s.id === row.id);
    if (row.status === 'paid') {
      const s = settlementOf(row, rounds.get(row.code));
      if (i < 0) settlements.push(s);
      else if (!same(settlements[i], s)) settlements[i] = s;
    } else if (row.status === 'undone' && i >= 0) settlements.splice(i, 1);
  }

  // Carries: the rows written together (same pair, same ask time) are one carry
  const who = canonicalOf(state);
  const groupOf = row => carryId(who(row.from), who(row.to), row.at);
  const touched = new Set([...changed].map(k => cache[k]).filter(r => r.kind === 'carry').map(groupOf));
  // One ask written before two ids were linked was saved as two carries (one per id). Now that
  // they're one person it's one carry again, built from all its rows
  const sharedKey = c => carryId(who(c.from), who(c.to), c.at);
  const seen = new Map();
  for (const c of state.carries || []) {
    if (!c.shared) continue;
    const k = sharedKey(c);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) touched.add(k);
  const groups = new Map();
  for (const row of Object.values(cache)) {
    if (row.kind !== 'carry') continue;
    const id = groupOf(row);
    if (!touched.has(id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  const carries = [...(state.carries || [])];
  for (const [id, list] of groups) {
    const newest = list.reduce((a, b) => ((b.updatedAt || 0) > (a.updatedAt || 0) ? b : a));
    const answered = newest.status === 'agreed' || newest.status === 'declined';
    const carry = {
      id, from: who(newest.from), to: who(newest.to),
      amount: list.reduce((a, r) => a + cents(r.amount), 0) / 100,
      status: newest.status, by: who(newest.by), reason: newest.reason || null, at: newest.at,
      ...(answered ? { answeredAt: newest.updatedAt } : {}),
      roundIds: list.map(r => rounds.get(r.code).id), codes: list.map(r => r.code),
      updatedAt: newest.updatedAt || newest.at, shared: true,
    };
    let i = carries.findIndex(c => c.id === id);
    // A carry saved before two ids were linked has its old pair in its id: it's still the same carry
    if (i < 0) i = carries.findIndex(c => c.shared && sharedKey(c) === id);
    if (i >= 0) carry.id = carries[i].id;
    // Any other copy of it (saved under the other id before the link) goes, so it's one carry
    const extra = i < 0 ? [] : carries.filter((c, j) => j !== i && c.shared && sharedKey(c) === id);
    if (i < 0) carries.push(carry);
    else if (extra.length || ((carries[i].updatedAt || 0) <= carry.updatedAt && !same(carries[i], carry))) carries[i] = carry;
    for (const c of extra) carries.splice(carries.indexOf(c), 1);
  }
  return { ...state, tabRows: cache, settlements, carries };
}


/**
 * Round transfers still open between two people (either direction), oldest round first. `only`
 * (a Set of round ids) keeps it to some of their rounds, a trip's.
 */
export function openTransfers(state, a, b, now = Date.now(), only = null) {
  const who = canonicalOf(state);
  const A = who(a), B = who(b);
  const out = [];
  for (const r of pairRounds(state, A, B, { now })) {
    if (only && !only.has(r.id)) continue;
    const code = codeOf(r);
    for (const t of tabResults(r).transfers) {
      const f = who(t.from), to = who(t.to);
      if (!((f === A && to === B) || (f === B && to === A))) continue;
      if (nettedOn(state, code, t)) continue;
      const paid = paidOn(state, r, code, t);
      const open = cents(t.amount) - paid;
      if (open > 0) out.push({ round: r, code, t, open, paid, forward: f === A });
    }
  }
  return out;
}

const payRow = (state, round, t, id, amount, now) => ({
  code: codeOf(round), id, kind: 'payment', from: t.from, to: t.to, amount, status: 'paid',
  by: meFor(round, state), reason: null, at: now, updatedAt: now,
});

/**
 * Rows that pay `settle` cents (positive in the open list's forward direction) on round transfers,
 * oldest first. With `square`, every transfer left open between the two is marked 'netted' too.
 */
function fillRows(state, open, settle, square, rows, now) {
  const fill = (list, c) => {
    let left = c;
    for (const x of list) {
      if (!left) break;
      const part = Math.min(left, x.open);
      left -= part;
      const first = part === x.open && x.paid === 0 && !(state.settlements || []).some(s => s.id === paymentId(x.code, x.t.from, x.t.to));
      // Part of a transfer is keyed by what was paid on it before, so two phones marking the same
      // payment before they sync land on one row too (a second, later payment gets its own key)
      const id = first ? paymentId(x.code, x.t.from, x.t.to) : paymentId(x.code, x.t.from, x.t.to, `p${x.paid}`);
      rows.push(payRow(state, x.round, x.t, id, part / 100, now));
      x.open -= part;
    }
  };
  if (settle > 0) fill(open.filter(o => o.forward), settle);
  if (settle < 0) fill(open.filter(o => !o.forward), -settle);
  // The rounds are square now: every transfer left open between the two is done with too
  if (open.length && square) {
    for (const x of open) {
      if (x.open <= 0) continue;
      rows.push({ ...payRow(state, x.round, x.t, nettedId(x.code, x.t.from, x.t.to), x.open / 100, now), status: 'netted' });
    }
  }
  return rows;
}

/**
 * Rows that square what's open between two people on some of their shared rounds (a trip's,
 * `roundIds`), the way a whole-card payment does: the net is paid on its round transfers, oldest
 * first, and the rest are marked 'netted'. Both phones of the pair hold these rounds, so both see
 * the pair square. `reason` tags the rows (trip-pay.js). Returns { rows, cents }: cents is the net
 * `from` paid `to` (negative the other way).
 */
export function squareRows(state, from, to, roundIds, { now = Date.now(), reason = null } = {}) {
  const open = openTransfers(state, from, to, now, roundIds);
  const net = open.reduce((c, x) => c + (x.forward ? x.open : -x.open), 0);
  return { rows: fillRows(state, open, net, true, [], now).map(r => ({ ...r, reason })), cents: net };
}

/**
 * Record `from` paying `to` (the person card, the Settle up sheet). Only the shared rounds
 * between the two count on the shared side, never money passed on through someone else:
 * - A payment of the whole card (what the Tab has between them) squares their shared rounds
 *   exactly: the shared amount is paid on its round transfers, oldest first, in whichever way
 *   it runs, and every other open transfer between them is marked 'netted' for the status.
 * - A part payment fills the shared transfers the same way first, and nets the rest only once
 *   it covers the whole shared amount.
 * - Then a trip's published plan between the two (trip-plan.js): all of it with the whole card,
 *   or what a part payment has left over, on the plan's own rows so both phones see it.
 * Whatever the shared rounds don't explain (local-only rounds, money passed on) is a local
 * settlement with no code, as before: it can run the other way when the shared rounds owe more
 * than the whole card. Returns { rows, settlements } to send and to add.
 */
export function allocatePayment(state, { from, to, amount }, { now = Date.now(), makeId = () => Math.random().toString(36).slice(2, 9) } = {}) {
  const who = canonicalOf(state);
  const F = who(from), T = who(to);
  const total = cents(amount);
  const shared = pairDebt(state, F, T, { now }); // cents: positive when F owes T on the shared rounds
  const card = Math.round(tabWith(outstanding(state, { now }), new Set([T]), F) * 100);
  const whole = card > 0 && total >= card;
  // The shared amount this payment settles, positive in the F to T direction
  const settle = whole ? shared : shared > 0 ? Math.min(total, shared) : 0;
  const rows = [], settlements = [];
  const open = openTransfers(state, F, T, now);
  fillRows(state, open, settle, settle === shared, rows, now);
  // Then what a trip's published plan has between them (trip-plan.js), on the plan's own rows
  const onPlan = planRows(state, F, T, { amount: whole ? null : Math.max(0, total - settle), now });
  rows.push(...onPlan.rows);
  const left = total - settle - onPlan.cents;
  if (left > 0) settlements.push({ id: `s_${makeId()}`, from, to, amount: left / 100, at: now });
  if (left < 0) settlements.push({ id: `s_${makeId()}`, from: to, to: from, amount: -left / 100, at: now });
  return { rows, settlements };
}

/**
 * The most recent payment between two people: every settlement between them recorded at that
 * moment (one tap can pay several round transfers), plus the transfers it netted.
 * Returns { at, settlements, netted } or null.
 */
export function lastPayment(state, a, b) {
  const who = canonicalOf(state);
  const A = who(a), B = who(b);
  const between = (x, y) => (who(x) === A && who(y) === B) || (who(x) === B && who(y) === A);
  const list = (state.settlements || []).filter(s => between(s.from, s.to));
  if (!list.length) return null;
  const at = Math.max(...list.map(s => s.at || 0));
  return {
    at,
    settlements: list.filter(s => (s.at || 0) === at),
    netted: Object.values(state.tabRows || {}).filter(r => r.kind === 'payment' && r.status === 'netted' && r.at === at && between(r.from, r.to)),
  };
}

/**
 * The payments list: every settlement, one row per tap (the same two people at the same moment),
 * newest first. One tap can pay several round transfers, or run both ways (the shared rounds one
 * way, the rest of the Tab the other), so a row is netted: { key, at, from, to, amount, settlements }.
 */
export function paymentGroups(state) {
  const who = canonicalOf(state);
  const groups = new Map();
  for (const s of state.settlements || []) {
    const [a, b] = [who(s.from), who(s.to)].sort();
    const key = `${s.at || 0}|${a}|${b}`;
    if (!groups.has(key)) groups.set(key, { key, at: s.at || 0, a, list: [] });
    groups.get(key).list.push(s);
  }
  return [...groups.values()].map(g => {
    // Cents from `a` to the other one: the sign says which way the tap went on the whole
    const net = g.list.reduce((c, s) => c + (who(s.from) === g.a ? 1 : -1) * cents(s.amount), 0);
    const fromA = net > 0 || (net === 0 && who(g.list[0].from) === g.a);
    const { from, to } = g.list.find(s => (who(s.from) === g.a) === fromA);
    return { key: g.key, at: g.at, from, to, amount: Math.abs(net) / 100, settlements: g.list };
  }).sort((x, y) => y.at - x.at);
}

/** The transfers these payments netted (written in the same tap, between the same people). */
export function nettedFor(state, settlements) {
  const who = canonicalOf(state);
  const pair = (a, b) => [who(a), who(b)].sort().join('|');
  const keys = new Set(settlements.map(s => `${s.at}|${pair(s.from, s.to)}`));
  return Object.values(state.tabRows || {}).filter(r => r.kind === 'payment' && r.status === 'netted' && keys.has(`${r.at}|${pair(r.from, r.to)}`));
}

/** Rows that take a payment back (and what to remove locally for payments that were never shared). */
export function undoRows(state, pay, { now = Date.now() } = {}) {
  const rows = [], remove = [];
  for (const s of pay.settlements) {
    const row = s.code && state.tabRows?.[`${s.code}|${s.id}`];
    if (row) rows.push({ ...row, status: 'undone', updatedAt: now });
    else if (s.code) rows.push({ code: s.code, id: s.id, kind: 'payment', from: s.from, to: s.to, amount: s.amount, status: 'undone', by: s.by || null, reason: null, at: s.at, updatedAt: now });
    else remove.push(s.id);
  }
  for (const r of pay.netted) rows.push({ ...r, status: 'undone', updatedAt: now });
  return { rows, remove };
}

/** Everything this phone knows about one round's payments and carries, as rows. */
export function roundRows(state, round) {
  const code = codeOf(round);
  // A trip payment on this round's code squares the trip, not this round's transfers
  const rows = code ? Object.values(state.tabRows || {}).filter(r => r.code === code && !isTripPayment(r)) : [];
  const ids = new Set(rows.map(r => r.id));
  // Payments recorded on this phone before the table was there count too
  for (const s of state.settlements || []) {
    if (ids.has(s.id) || isTripPayment(s) || !(s.roundId === round.id || (code && s.code === code))) continue;
    rows.push({ code, id: s.id, kind: 'payment', from: s.from, to: s.to, amount: s.amount, status: 'paid', at: s.at, updatedAt: s.at });
  }
  return rows;
}

/**
 * Who's square in one round, from the round's own transfers and its rows:
 * { playerId: 'square' | 'owes' | 'waiting' | 'carried' }. A transfer counts as paid only once
 * what's been paid reaches its current amount (a fixed hole can grow it after a payment).
 */
export function roundStatus(round, rows) {
  const out = Object.fromEntries(round.players.map(p => [p.id, 'square']));
  const owes = new Set(), waits = new Set(), carried = new Set();
  const match = (r, t) => r.from === t.from && r.to === t.to;
  for (const t of tabResults(round).transfers) {
    const paid = rows.filter(r => r.kind === 'payment' && r.status === 'paid' && match(r, t)).reduce((a, r) => a + cents(r.amount), 0);
    const netted = rows.some(r => r.kind === 'payment' && r.status === 'netted' && match(r, t));
    if (netted || paid >= cents(t.amount)) continue;
    const isCarried = rows.some(r => r.kind === 'carry' && r.status === 'agreed' && ((r.from === t.from && r.to === t.to) || (r.from === t.to && r.to === t.from)));
    if (isCarried) { carried.add(t.from); carried.add(t.to); }
    else { owes.add(t.from); waits.add(t.to); }
  }
  for (const id of Object.keys(out)) {
    if (owes.has(id)) out[id] = 'owes';
    else if (waits.has(id)) out[id] = 'waiting';
    else if (carried.has(id)) out[id] = 'carried';
  }
  return out;
}

/**
 * The round the who-is-square strip follows: your newest finished shared round from the last
 * 30 days that had at least one payment to make. { round, latest } where latest says it's your
 * most recent finished round of all, or null.
 */
export function stripRound(state, { now = Date.now() } = {}) {
  const shared = lockedRounds(state, { days: STRIP_DAYS, now }).filter(r => tabResults(r).transfers.length);
  const round = shared.at(-1);
  if (!round) return null;
  // Your newest round of any kind (a points round after it means it isn't your latest)
  const newest = Object.values(state.rounds || {}).filter(r => r.status === 'done' && played(r, state)).sort((a, b) => finishedAt(b) - finishedAt(a))[0];
  return { round, latest: newest?.id === round.id };
}

/** How long a card keeps the last payment's undo link. */
export const RECENT_MS = 3 * DAY;

/** The last payment between you and someone, while it's recent enough to take back. */
export function recentPayment(state, meId, other, now = Date.now()) {
  const pay = lastPayment(state, meId, other);
  return pay && now - pay.at < RECENT_MS ? pay : null;
}

/** "Sep 27". */
export const shortDate = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** "just now", "12 min ago", "today", "yesterday" or "Sep 27". */
export function ago(at, now = Date.now()) {
  const d = now - at;
  if (d < 60e3) return 'just now';
  if (d < 3600e3) return `${Math.floor(d / 60e3)} min ago`;
  const day = t => new Date(t).toDateString();
  if (day(at) === day(now)) return 'today';
  if (day(at) === day(now - DAY)) return 'yesterday';
  return shortDate(at);
}
