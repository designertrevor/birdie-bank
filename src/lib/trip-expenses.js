// Trip expenses (ROADMAP area 7): gas, dinner, the house, on the same Tab as the bets. Anyone on a
// trip adds one: what it was, how much, who paid, and how it's split (equally among the people
// picked, by amounts, or by shares). Its money folds into each person's trip total, the Tab and
// Settle the trip, so the trip settles once for everything at the end.
//
// An expense: { id, tripId, what, amount, split, payer, people, by, at, updatedAt, deleted? }
// - amount: dollars, to the cent. split: 'equal' | 'amounts' | 'shares'.
// - payer and each of people: { id, name, refs }, where people are everyone in the split and each
//   one's `part` is null (equal), their dollars (amounts) or their shares (shares). The payer is
//   in people only when they share in it.
// - refs: 'CODE:seat' for each trip round shared live the person has a seat in, so every phone can
//   tell who they are whatever ids it knows them by (a friend's phone knows them by their seats).
//   `id` is the adder's own id for them, used when no ref is on this phone.
// - by: the adder's id. Only the adder changes or deletes it; a deleted one stays as
//   { id, tripId, by, deleted: true, updatedAt } so every phone hears it's gone.
//
// Splits are to the cent: the cents that don't divide evenly go to the payer first when they're in
// the split (so nobody is asked for a cent more than their share), then down the list. Every
// expense adds up to exactly $0 across the people in it. Expenses reach the other phones through
// trip-expense-sync.js; until then they're on this phone and your account. Pure, unit tested.
import { canonicalOf, codeOf } from './pair-debts.js';

const MAX_AMOUNT = 99999.99;
const MAX_PEOPLE = 40;
const MAX_SHARES = 99;
/** The kinds of split, in the order the sheet offers them. */
export const SPLITS = { equal: 'Equally', amounts: 'By amount', shares: 'By shares' };
/** One tap fills in what it was. */
export const QUICK_WHATS = ['Dinner', 'Gas', 'The house', 'Drinks', 'Groceries', 'Caddies'];

export const toCents = v => Math.round((Number(v) || 0) * 100);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** Tidy what it was: trimmed, single spaces, at most 40 characters. */
export function cleanWhat(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** An amount typed in ("12", "$12.50", "1,200"), in cents, or null when it isn't one. */
export function parseAmount(s) {
  const t = String(s ?? '').replace(/[$,\s]/g, '');
  if (!/^\d*(\.\d{0,2})?$/.test(t) || !t || t === '.') return null;
  const c = Math.round(Number(t) * 100);
  return Number.isFinite(c) ? c : null;
}

function cleanPerson(p, { part = false } = {}) {
  if (!isObj(p) || !isStr(p.id) || p.id.length > 64) return null;
  const refs = (Array.isArray(p.refs) ? p.refs : []).filter(r => isStr(r) && r.length <= 80 && /^[A-Z0-9]{6}:./.test(r)).slice(0, 8);
  const out = { id: p.id, name: String(p.name || '').slice(0, 40), refs };
  if (part) out.part = p.part == null ? null : Number(p.part);
  return out;
}

/**
 * An expense as it came from the server, your account or the sheet, tidied, or null when it isn't
 * one (an amount split that doesn't add up, shares that aren't whole, nobody in it). A deleted one
 * comes back as its stub.
 */
export function cleanExpense(e) {
  if (!isObj(e) || !isStr(e.id) || e.id.length > 64 || !isStr(e.tripId) || e.tripId.length > 64) return null;
  const updatedAt = Number(e.updatedAt) || 0;
  const by = isStr(e.by) ? e.by.slice(0, 64) : null;
  if (e.deleted) return { id: e.id, tripId: e.tripId, by, deleted: true, at: Number(e.at) || 0, updatedAt };
  const total = toCents(e.amount);
  if (total <= 0 || total > toCents(MAX_AMOUNT) || Math.abs(Number(e.amount) * 100 - total) > 1e-6) return null;
  if (!SPLITS[e.split]) return null;
  const payer = cleanPerson(e.payer);
  if (!payer || !Array.isArray(e.people) || !e.people.length || e.people.length > MAX_PEOPLE) return null;
  const people = e.people.map(p => cleanPerson(p, { part: true }));
  if (people.some(p => !p) || new Set(people.map(p => p.id)).size !== people.length) return null;
  if (e.split === 'equal') for (const p of people) p.part = null;
  if (e.split === 'shares' && people.some(p => !Number.isInteger(p.part) || p.part < 1 || p.part > MAX_SHARES)) return null;
  if (e.split === 'amounts') {
    if (people.some(p => !Number.isFinite(p.part) || p.part < 0 || Math.abs(p.part * 100 - toCents(p.part)) > 1e-6)) return null;
    if (people.reduce((a, p) => a + toCents(p.part), 0) !== total) return null;
    for (const p of people) p.part = toCents(p.part) / 100;
  }
  return {
    id: e.id, tripId: e.tripId, what: cleanWhat(e.what) || 'Expense', amount: total / 100, split: e.split,
    payer, people, by, at: Number(e.at) || 0, updatedAt,
  };
}

/**
 * Each person's share in cents, in the order of `people`, adding up to the amount exactly. Equal and
 * shares splits share the cents that don't divide evenly by the biggest fractions left, the payer
 * first on a tie, then down the list.
 */
export function shareCents(e) {
  const total = toCents(e.amount);
  if (e.split === 'amounts') return e.people.map(p => toCents(p.part));
  const w = e.people.map(p => (e.split === 'shares' ? Number(p.part) || 0 : 1));
  const W = w.reduce((a, x) => a + x, 0);
  if (!W) return e.people.map(() => 0);
  const base = w.map(x => Math.floor((total * x) / W));
  let left = total - base.reduce((a, x) => a + x, 0);
  const order = e.people.map((p, i) => ({ i, frac: (total * w[i]) % W, payer: p.id === e.payer.id ? 0 : 1 }))
    .sort((a, b) => b.frac - a.frac || a.payer - b.payer || a.i - b.i);
  for (const o of order) { if (left <= 0) break; base[o.i]++; left--; }
  return base;
}

/** A short mark of an expense's money, so a changed one makes the trip's published plan out of date. */
export function expenseMark(e) {
  const ref = p => `${p.id}~${(p.refs || []).join(',')}`;
  const text = [toCents(e.amount), e.split, ref(e.payer), ...e.people.map(p => `${ref(p)}=${p.part ?? ''}`)].join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(36)}.${text.length.toString(36)}`;
}

/** Rounds on this phone by their live code. */
function byCode(state) {
  const out = new Map();
  for (const r of Object.values(state.rounds || {})) {
    const c = codeOf(r);
    if (c && !out.has(c)) out.set(c, r);
  }
  return out;
}

/** Who a person in an expense is on this phone: by a seat in a round this phone has, else by the id. */
export function personOn(state, p, { who = canonicalOf(state), codes = byCode(state) } = {}) {
  for (const ref of p.refs || []) {
    const i = ref.indexOf(':');
    const r = codes.get(ref.slice(0, i));
    const seat = ref.slice(i + 1);
    if (r?.players?.some(x => x.id === seat)) return who(seat);
  }
  return who(p.id);
}

/**
 * How this phone writes someone into an expense: their id here, their name, and their seat in each
 * of the trip's rounds shared live (newest first), so other phones can tell who they are.
 */
export function personFor(state, tripId, id, name = '') {
  const who = canonicalOf(state);
  const k = who(id);
  const refs = [];
  const rounds = Object.values(state.rounds || {}).filter(r => r?.trip?.id === tripId && codeOf(r) && (r.status === 'done' || r.status === 'active'))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  for (const r of rounds) {
    const seat = r.players.find(p => who(p.id) === k);
    if (seat) refs.push(`${codeOf(r)}:${seat.id}`);
  }
  return { id: k, name: String(name || '').slice(0, 40), refs: refs.slice(0, 8) };
}

/** Whether a trip is still known on this phone (a deleted trip's expenses move no money). */
function tripKnown(state, id) {
  if (state.tripPlans?.[id]?.deleted && !state.trips?.[id]) return false;
  if (state.trips?.[id]) return true;
  return Object.values(state.rounds || {}).some(r => r?.trip?.id === id) || Object.values(state.plans || {}).some(p => p?.trip?.id === id);
}

/**
 * One expense as this phone sees it: { id, tripId, what, amount, cents, split, payer, parts, balances,
 * names, by, at, raw }. payer and each part's id are people as this phone knows them; parts are
 * [{ id, cents, part }] in the split's order; balances: { id: cents }, positive when owed (the
 * payer's is what the others owe them), adding up to 0.
 */
export function resolveExpense(state, e, opts = {}) {
  const who = opts.who || canonicalOf(state);
  const codes = opts.codes || byCode(state);
  const at = p => personOn(state, p, { who, codes });
  const payer = at(e.payer);
  const shares = shareCents(e);
  const parts = e.people.map((p, i) => ({ id: at(p), cents: shares[i], part: p.part }));
  const balances = { [payer]: toCents(e.amount) };
  for (const x of parts) balances[x.id] = (balances[x.id] || 0) - x.cents;
  const names = {};
  for (const p of [e.payer, ...e.people]) if (p.name) names[at(p)] = p.name;
  return {
    id: e.id, tripId: e.tripId, what: e.what, amount: e.amount, cents: toCents(e.amount), split: e.split,
    payer, parts, balances, names, by: e.by ? who(e.by) : null, at: e.at, updatedAt: e.updatedAt, raw: e,
  };
}

const cache = new WeakMap();

/** Every expense on this phone, tidied (deleted ones as their stub): { byTrip: Map(tripId -> [expense]) }. */
function indexOf(state) {
  let hit = cache.get(state);
  if (hit) return hit;
  const byTrip = new Map();
  for (const raw of Object.values(state.tripExpenses || {})) {
    const e = cleanExpense(raw);
    if (!e) continue;
    if (!byTrip.has(e.tripId)) byTrip.set(e.tripId, []);
    byTrip.get(e.tripId).push(e);
  }
  hit = { byTrip, resolved: new Map(), all: null };
  cache.set(state, hit);
  return hit;
}

/** Every expense of a trip on this phone, tidied, deleted ones included (as their stub). */
export function rawTripExpenses(state, tripId) {
  if (!state.tripExpenses) return [];
  return indexOf(state).byTrip.get(tripId) || [];
}

/** A trip's expenses as this phone sees them (resolveExpense), newest first. Deleted ones are left out. */
export function tripExpenses(state, tripId) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (idx.resolved.has(tripId)) return idx.resolved.get(tripId);
  const who = canonicalOf(state);
  const codes = byCode(state);
  const list = tripKnown(state, tripId)
    ? (idx.byTrip.get(tripId) || []).filter(e => !e.deleted).map(e => resolveExpense(state, e, { who, codes }))
      .sort((a, b) => (b.at || 0) - (a.at || 0) || a.id.localeCompare(b.id))
    : [];
  idx.resolved.set(tripId, list);
  return list;
}

/** Every trip expense on this phone with money on the Tab (its trip still known here). */
export function allExpenses(state) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (!idx.all) idx.all = [...idx.byTrip.keys()].flatMap(id => tripExpenses(state, id));
  return idx.all;
}

/** Add expenses' balances into `bal` ({ id: cents }), mutating it. */
export function addExpenseCents(bal, list) {
  for (const x of list) for (const [id, c] of Object.entries(x.balances)) bal[id] = (bal[id] || 0) + c;
  return bal;
}

/** The pairs an expense puts money between: each person in the split with the payer, as "a|b" keys. */
export function expensePairs(list) {
  const out = new Set();
  for (const x of list) for (const p of x.parts) if (p.id !== x.payer && p.cents) out.add(p.id < x.payer ? `${p.id}|${x.payer}` : `${x.payer}|${p.id}`);
  return out;
}

/** Whether this phone added the expense, so it can change or delete it. */
export function canEditExpense(state, x) {
  if (!x?.by) return false;
  const who = canonicalOf(state);
  return who(x.by) === who(state.me);
}

/**
 * Each person's expenses on a trip: Map(id -> { paid, share, net }) in cents. `net` is what they're
 * owed for them (paid less their share).
 */
export function expenseTotals(list) {
  const out = new Map();
  const get = id => { if (!out.has(id)) out.set(id, { paid: 0, share: 0, net: 0 }); return out.get(id); };
  for (const x of list) {
    get(x.payer).paid += x.cents;
    for (const p of x.parts) get(p.id).share += p.cents;
  }
  for (const v of out.values()) v.net = v.paid - v.share;
  return out;
}

/**
 * Keep the newer copy of each expense (by updatedAt; a deleted one wins a tie), for expenses
 * coming from the server or your account. Returns the merged map, or `cur` itself when nothing changed.
 */
export function mergeExpenses(cur = {}, incoming = []) {
  let out = cur;
  for (const raw of incoming) {
    const e = cleanExpense(raw);
    if (!e) continue;
    const have = cur[e.id] ? cleanExpense(cur[e.id]) : null;
    if (have && (have.updatedAt > e.updatedAt || (have.updatedAt === e.updatedAt && (have.deleted || !e.deleted)))) continue;
    if (have && JSON.stringify(have) === JSON.stringify(e)) continue;
    if (out === cur) out = { ...cur };
    out[e.id] = e;
  }
  return out;
}

/** "Split 4 ways", "Split by amount", "Split by shares", or "For Sam" when it's all one person's. */
export function splitLine(x, short = id => id) {
  const inIt = x.parts.filter(p => p.cents > 0);
  if (inIt.length === 1 && inIt[0].id !== x.payer) return `For ${short(inIt[0].id)}`;
  if (x.split === 'amounts') return 'Split by amount';
  if (x.split === 'shares') return 'Split by shares';
  return `Split ${x.parts.length} way${x.parts.length === 1 ? '' : 's'}`;
}

/**
 * What the trip expenses put between you and one person, expense by expense: [{ expense, amount, at }]
 * newest first, amount in cents, positive when they owe you for it (you paid and they're in it),
 * negative when you owe them. `isMine` and `isThem` say who's who (ids as this phone knows them).
 */
export function expensesBetween(state, isMine, isThem) {
  const out = [];
  for (const x of allExpenses(state)) {
    let c = 0;
    if (isMine(x.payer)) for (const p of x.parts) if (isThem(p.id)) c += p.cents;
    if (isThem(x.payer)) for (const p of x.parts) if (isMine(p.id)) c -= p.cents;
    if (c) out.push({ expense: x, amount: c, at: x.at || 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}
