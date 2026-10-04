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
//
// Paying for expenses the trip's published plan doesn't cover (trip-plan.js: someone it can't link
// up, a trip played only for lunch or points, or before the organizer's phone republishes) is an
// expense too, a payment: { ..., kind: 'payment', what: 'Payment', split: 'amounts', payer: whoever
// paid, people: [whoever got it, part: the amount], reason? }. It goes up and comes back like any
// expense, so it reaches every phone that has the trip's expenses, and its money squares the
// expenses between the two of them on every phone. Its id comes from what it pays (expensePayId),
// so the payer and the payee marking it on both phones before they sync pay it once. Anyone takes
// it back with a record that `undoes` it and puts it back with one that undoes that: the latest
// tap wins, on every phone (undoneIds). Those expenses stay between the two people in them,
// pair by pair, the same on every phone (ledger.js expenseDebts). Payments never show as expenses.
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
  if (e.kind === 'payment') return cleanPayment(e, { by, updatedAt });
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

const REASON = /^(trip|trip-part):.{1,64}$/;

/** A payment for expenses (see the top of this file), tidied, or null when it isn't one. */
function cleanPayment(e, { by, updatedAt }) {
  const total = toCents(e.amount);
  if (total <= 0 || total > toCents(MAX_AMOUNT) || Math.abs(Number(e.amount) * 100 - total) > 1e-6) return null;
  const payer = cleanPerson(e.payer);
  const to = Array.isArray(e.people) && e.people.length === 1 ? cleanPerson(e.people[0], { part: true }) : null;
  if (!payer || !to || to.id === payer.id) return null;
  to.part = total / 100;
  const out = {
    id: e.id, tripId: e.tripId, kind: 'payment', what: 'Payment', amount: total / 100, split: 'amounts',
    payer, people: [to], by, at: Number(e.at) || 0, updatedAt,
  };
  if (isStr(e.undoes) && e.undoes.length <= 64 && e.undoes !== e.id) out.undoes = e.undoes;
  if (isStr(e.reason) && REASON.test(e.reason)) out.reason = e.reason;
  return out;
}

/** Whether an expense (raw or as this phone sees it) is a payment for expenses rather than one. */
export const isPayment = x => (x?.raw || x)?.kind === 'payment';

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

/** The seat a ref names in a round this phone has, or null. */
function seatOn(ref, codes) {
  const i = ref.indexOf(':');
  const r = codes.get(ref.slice(0, i));
  const seat = ref.slice(i + 1);
  return r?.players?.some(x => x.id === seat) ? seat : null;
}

/** Everyone this phone knows by an id of its own: you, your players, and every seat in its rounds. */
function knownIds(state, who) {
  const out = new Set();
  if (state.me) out.add(who(state.me));
  for (const id of Object.keys(state.players || {})) out.add(who(id));
  for (const r of Object.values(state.rounds || {})) for (const x of r?.players || []) out.add(who(x.id));
  return out;
}

/**
 * Who each person in this phone's expenses is when none of their seats are on this phone (a round
 * it doesn't have): every entry that shares a seat with another (CODE:seat), or an id, is the same
 * person, whichever phone wrote it (their own phone writes them by its own id, a friend's by their
 * seat). Map(raw id -> id here): the one person this phone knows in the group, else one id for the
 * whole group so they're never two people. A group that reaches two people this phone knows (bad
 * data) is left to each entry's own id.
 */
function aliasesOf(state, who, codes) {
  const idx = indexOf(state);
  if (idx.alias) return idx.alias;
  const up = new Map();
  const top = k => { let x = k; while (up.get(x) !== x) x = up.get(x); return x; };
  const join = (a, b) => { for (const k of [a, b]) if (!up.has(k)) up.set(k, k); const [x, y] = [top(a), top(b)]; if (x !== y) up.set(x, y); };
  for (const list of idx.byTrip.values()) for (const e of list) {
    if (e.deleted) continue;
    for (const p of [e.payer, ...e.people]) {
      join(`i:${p.id}`, `i:${p.id}`);
      for (const ref of p.refs) { join(`i:${p.id}`, `r:${ref}`); join(`r:${ref}`, `i:${ref.slice(ref.indexOf(':') + 1)}`); }
    }
  }
  const known = knownIds(state, who);
  const groups = new Map(); // top -> { ids, here }
  for (const k of up.keys()) {
    const g = top(k);
    if (!groups.has(g)) groups.set(g, { ids: [], here: new Set() });
    const x = groups.get(g);
    if (k.startsWith('i:')) {
      const id = k.slice(2);
      x.ids.push(id);
      if (known.has(who(id))) x.here.add(who(id));
    } else {
      const seat = seatOn(k.slice(2), codes);
      if (seat) x.here.add(who(seat));
    }
  }
  const out = new Map();
  for (const { ids, here } of groups.values()) {
    if (here.size > 1) continue;
    const id = here.size ? [...here][0] : who([...ids].sort()[0]);
    for (const x of ids) out.set(x, id);
  }
  idx.alias = out;
  return out;
}

/**
 * Who a person in an expense is on this phone: by a seat in a round this phone has, else as the
 * rest of the trip's expenses place them (aliasesOf), else by the id.
 */
export function personOn(state, p, { who = canonicalOf(state), codes = byCode(state) } = {}) {
  for (const ref of p.refs || []) {
    const seat = seatOn(ref, codes);
    if (seat) return who(seat);
  }
  if (state.tripExpenses) {
    const id = aliasesOf(state, who, codes).get(p.id);
    if (id) return id;
  }
  return who(p.id);
}

/**
 * Whether this phone can place someone (an id as it knows them): you, one of your players, or a
 * seat in one of its rounds. A payment between two people is only marked on a phone that can
 * place both, so it never reaches their phones as someone else.
 */
export function placeable(state, id) {
  return knownIds(state, canonicalOf(state)).has(id);
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

/**
 * How a payment for expenses between two people writes one of them (`id`, paying or paid by
 * `other`): as personFor, with the seats and the id the trip's expenses already know them by on
 * this phone, the ones between the two of them first, so the other one's phone tells who they are
 * in the payment the way it does in those expenses (a phone that knows you only by a seat in
 * someone else's round reads you by that seat, never by this phone's own id for you).
 */
function payPerson(state, tripId, id, name, other) {
  const who = codesWho(state);
  const k = who.who(id), o = who.who(other);
  const base = personFor(state, tripId, k, name);
  const refs = [...base.refs];
  const ids = new Map();
  for (const e of rawTripExpenses(state, tripId)) {
    if (e.deleted) continue;
    const list = [e.payer, ...e.people];
    const between = list.some(p => personOn(state, p, who) === o);
    for (const p of list) {
      if (personOn(state, p, who) !== k) continue;
      for (const r of p.refs || []) if (!refs.includes(r)) refs.push(r);
      ids.set(p.id, (ids.get(p.id) || 0) + (between ? 1000 : 1));
    }
  }
  // For a phone none of the seats reach: the id the expenses use most for them (between the two of
  // them first), else their seat in the newest round, never just this phone's own id for them
  const common = [...ids].sort((a, b) => b[1] - a[1])[0]?.[0];
  const seat = base.refs[0] ? base.refs[0].slice(base.refs[0].indexOf(':') + 1) : null;
  return { id: common || seat || base.id, name: base.name, refs: refs.slice(0, 8) };
}
const codesWho = state => ({ who: canonicalOf(state), codes: byCode(state) });

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
  // Whoever added it, by their own entry in it when they're in it (its seats), so a friend's phone
  // that knows them only by a seat can still say who it was
  const adder = e.by ? [e.payer, ...e.people].find(p => p.id === e.by) : null;
  return {
    id: e.id, tripId: e.tripId, what: e.what, amount: e.amount, cents: toCents(e.amount), split: e.split,
    payer, parts, balances, names, by: adder ? at(adder) : e.by ? who(e.by) : null, at: e.at, updatedAt: e.updatedAt, raw: e,
    ...(e.kind === 'payment' ? { pay: true, ...(e.undoes ? { undoes: e.undoes } : {}), ...(e.reason ? { reason: e.reason } : {}) } : {}),
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
  hit = { byTrip, resolved: new Map(), money: new Map(), all: null, allMoney: null, alias: null };
  cache.set(state, hit);
  return hit;
}

/** Every expense of a trip on this phone, tidied, deleted ones included (as their stub). */
export function rawTripExpenses(state, tripId) {
  if (!state.tripExpenses) return [];
  return indexOf(state).byTrip.get(tripId) || [];
}

/**
 * The payments taken back, from a trip's records (deleted ones left out). A record that `undoes`
 * a payment takes it back, one that undoes that puts it back, and so on: the latest of them (by
 * when it was tapped) says whether the payment stands, whichever phones they came from. A record
 * whose payment (or the record it undoes) isn't here moves nothing.
 */
function undoneIds(raw) {
  const byId = new Map(raw.filter(e => e.kind === 'payment').map(e => [e.id, e]));
  const latest = new Map(); // payment id -> { at, depth, id }
  for (const e of byId.values()) {
    let x = e, depth = 0;
    const seen = new Set();
    while (x?.undoes && !seen.has(x.id)) { seen.add(x.id); x = byId.get(x.undoes); depth++; }
    if (!x || x.undoes) continue; // its payment isn't here (or a loop)
    const cur = latest.get(x.id);
    const mine = { at: e.at || 0, depth, id: e.id };
    if (!cur || mine.at > cur.at || (mine.at === cur.at && (mine.depth > cur.depth || (mine.depth === cur.depth && mine.id > cur.id)))) latest.set(x.id, mine);
  }
  const out = new Set();
  for (const [id, l] of latest) if (l.depth % 2) out.add(id);
  return out;
}

/**
 * Everything with money a trip has on this phone (resolveExpense), newest first: its expenses and
 * the payments for them still standing (`pay: true`), deleted ones and the records that take a
 * payment back or put it back (undoneIds) left out.
 */
export function tripMoney(state, tripId) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (idx.money.has(tripId)) return idx.money.get(tripId);
  const who = canonicalOf(state);
  const codes = byCode(state);
  const raw = tripKnown(state, tripId) ? (idx.byTrip.get(tripId) || []).filter(e => !e.deleted) : [];
  const off = undoneIds(raw);
  const list = raw.filter(e => e.kind !== 'payment' || (!e.undoes && !off.has(e.id)))
    .map(e => resolveExpense(state, e, { who, codes }))
    .sort((a, b) => (b.at || 0) - (a.at || 0) || a.id.localeCompare(b.id));
  idx.money.set(tripId, list);
  return list;
}

/** A trip's expenses as this phone sees them (resolveExpense), newest first. Deleted ones and payments are left out. */
export function tripExpenses(state, tripId) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (idx.resolved.has(tripId)) return idx.resolved.get(tripId);
  const list = tripMoney(state, tripId).filter(x => !x.pay);
  idx.resolved.set(tripId, list);
  return list;
}

/**
 * The payments for a trip's expenses, as payments ({ id, from, to, amount, at, by, tripId, reason?,
 * expensePay: true, expense }), newest first: the ones still standing (not taken back), so the Tab
 * and the trip list them with the rest. `expense` is the payment as tripMoney has it.
 */
export function tripPays(state, tripId) {
  return tripMoney(state, tripId).filter(x => x.pay).map(x => ({
    id: x.id, from: x.payer, to: x.parts[0].id, amount: x.cents / 100, at: x.at || 0, by: x.by, tripId: x.tripId,
    ...(x.reason ? { reason: x.reason } : {}), expensePay: true, expense: x,
  }));
}

/** Every trip expense on this phone with money on the Tab (its trip still known here), payments left out. */
export function allExpenses(state) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (!idx.all) idx.all = [...idx.byTrip.keys()].flatMap(id => tripExpenses(state, id));
  return idx.all;
}

/** Every trip's expenses and the payments for them on this phone (tripMoney), for the Tab's money. */
export function allTripMoney(state) {
  if (!state.tripExpenses) return [];
  const idx = indexOf(state);
  if (!idx.allMoney) idx.allMoney = [...idx.byTrip.keys()].flatMap(id => tripMoney(state, id));
  return idx.allMoney;
}

/** Every payment for trip expenses still standing on this phone (tripPays), newest first. */
export function allTripPays(state) {
  if (!state.tripExpenses) return [];
  return [...indexOf(state).byTrip.keys()].flatMap(id => tripPays(state, id)).sort((a, b) => b.at - a.at);
}

/**
 * What expenses and their payments put between each two people, pair by pair: [{ from, to, cents }]
 * with `from` owing `to`, one a pair (ids as this phone knows them). Each person in an expense owes
 * whoever paid their part; a payment takes it off.
 */
export function expensePairDebts(list) {
  const net = new Map(); // "a|b" -> cents a owes b
  for (const x of list) {
    for (const p of x.parts) {
      if (p.id === x.payer || !p.cents) continue;
      const [a, b] = p.id < x.payer ? [p.id, x.payer] : [x.payer, p.id];
      net.set(`${a}|${b}`, (net.get(`${a}|${b}`) || 0) + (p.id === a ? p.cents : -p.cents));
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
 * A payment for trip expenses, written on this phone: `from` paid `to` `amount` cents (ids as this
 * phone knows them, with their names). `undoes` takes back someone else's payment.
 */
export function newPayment(state, { id, tripId, from, to, amount, fromName = '', toName = '', reason = null, undoes = null, now = Date.now() }) {
  const who = canonicalOf(state);
  return cleanExpense({
    id, tripId, kind: 'payment', amount: amount / 100, split: 'amounts',
    payer: payPerson(state, tripId, from, fromName, to), people: [{ ...payPerson(state, tripId, to, toName, from), part: amount / 100 }],
    by: who(state.me), at: now, updatedAt: now, ...(reason ? { reason } : {}), ...(undoes ? { undoes } : {}),
  });
}

/**
 * The id for a payment of the expenses between `from` and `to` on a trip (ids as this phone knows
 * them): the same on both their phones when both mark it before they sync, so the two taps are one
 * payment, like a round transfer's row. It comes from the trip, the expenses between the two (each
 * one's id, version and where the two are in it), the payments already between them and the
 * amount, and never one this phone already has (a payment taken back keeps its id).
 */
export function expensePayId(state, tripId, from, to, amount) {
  const who = codesWho(state);
  const at = p => personOn(state, p, who);
  const parts = [];
  for (const e of rawTripExpenses(state, tripId)) {
    if (e.deleted || e.undoes) continue;
    const list = [e.payer, ...e.people].map(at);
    const f = list.flatMap((id, i) => (id === from ? [i] : [])), t = list.flatMap((id, i) => (id === to ? [i] : []));
    if (!f.length || !t.length) continue;
    parts.push(e.kind === 'payment' ? `p${e.id}` : `${e.id}.${e.updatedAt}:${f.join(',')}>${t.join(',')}`);
  }
  const text = [tripId, amount, ...parts.sort()].join('|');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  const base = `xp_${h1.toString(36)}${h2.toString(36)}`;
  let id = base;
  for (let n = 2; state.tripExpenses?.[id]; n++) id = `${base}_${n}`;
  return id;
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
    // Against what this batch has kept so far, so a stale copy later in it can't undo a newer one
    const have = out[e.id] ? cleanExpense(out[e.id]) : null;
    // An expense never moves trip or changes hands: a copy that says otherwise isn't this one
    if (have && (have.tripId !== e.tripId || (have.by && e.by && have.by !== e.by))) continue;
    if (have && (have.updatedAt > e.updatedAt || (have.updatedAt === e.updatedAt && (have.deleted || !e.deleted)))) continue;
    if (have && JSON.stringify(have) === JSON.stringify(e)) continue;
    if (out === cur) out = { ...cur };
    out[e.id] = e;
  }
  return out;
}

/**
 * Your own expenses that need writing again because the trip has rounds shared live this phone
 * didn't have when they were saved: each person gets their seat in those rounds (refs), so the
 * phones that know them only by a seat (a friend who joined someone else's round) can tell who
 * they are. Returns the expenses to keep, newer (updatedAt `now`), or [] when none need it. An
 * expense added before any round was shared (the house paid ahead) gets its seats this way.
 */
export function restampExpenses(state, { now = Date.now() } = {}) {
  const out = [];
  for (const raw of Object.values(state.tripExpenses || {})) {
    const e = cleanExpense(raw);
    if (!e || e.deleted || !canEditExpense(state, { by: e.by }) || !tripKnown(state, e.tripId)) continue;
    let changed = false;
    const again = p => {
      const fresh = personFor(state, e.tripId, p.id).refs;
      if (!fresh.some(r => !p.refs.includes(r))) return p;
      changed = true;
      return { ...p, refs: [...fresh, ...p.refs.filter(r => !fresh.includes(r))].slice(0, 8) };
    };
    const payer = again(e.payer);
    const people = e.people.map(again);
    if (changed) out.push({ ...e, payer, people, updatedAt: Math.max(now, e.updatedAt + 1) });
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

/**
 * Which of this phone's own expenses to send up, given the server's rows ([{ expense, codes }]) and
 * the round codes this phone has for each trip it knows (Map(tripId -> Set of codes)): the ones the
 * server doesn't have, has an older copy of, or has without a round code this phone now knows (so
 * the people in that round can read it). Returns [{ expense, codes }].
 */
export function expensesToSend(state, rows, tripCodes) {
  const there = new Map(rows.map(x => [x.expense?.id, x]));
  const out = [];
  for (const raw of Object.values(state.tripExpenses || {})) {
    const e = cleanExpense(raw);
    if (!e || !tripCodes.has(e.tripId) || !canEditExpense(state, { by: e.by })) continue;
    const codes = [...tripCodes.get(e.tripId)].slice(0, 100);
    const have = there.get(e.id);
    const theirs = have ? cleanExpense(have.expense) : null;
    // Both phones of a pair marked the same payment (one id): the server keeps the first one up
    if (theirs?.by && e.by && theirs.by !== e.by) continue;
    const newCodes = !have || codes.some(c => !(have.codes || []).includes(c));
    if (theirs && theirs.updatedAt >= e.updatedAt && !newCodes) continue;
    out.push({ expense: e, codes });
  }
  return out;
}
