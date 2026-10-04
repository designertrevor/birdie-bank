// The trip's published plan: one set of payments that squares the trip's rounds shared live in the
// fewest payments, worked out on the organizer's phone (it has every trip round) and kept on the
// server (supabase/2026-10-03-trip-plans.sql), so every phone on the trip settles from the same
// plan and the Tab shows the same amount on both phones of every pair.
//
// A plan: { tripId, version, at, endedAt, byName, rounds: [{ code, mark }], netted: ['CODE|id'],
// lines: [{ code, from, to, amount }], expenses?: [{ id, mark }] }.
// - rounds: the shared rounds it covers, each with a mark of its transfers, so a fixed score shows.
// - expenses: the trip expenses it covers (trip-expenses.js), each with a mark of its money, so a
//   changed or deleted expense shows. Only expenses whose people all played a round shared live
//   on the trip that links them up, so the payments can square them. Left out when there are none.
// - netted: the payments on those rounds it already counted (round settle ups, earlier plan
//   payments), by row. A payment on them it didn't count means it's out of date.
// - lines: who pays whom. `from` and `to` are player ids in round `code`, a round both of them
//   played, so every phone can tell who they are whatever ids it knows them by.
// Payments on a line ride on that round's code (`planPaymentId`), so both people's phones get them.
//
// On each phone a plan is 'live' when it checks out against the rounds and payments the phone
// has: the marks match, every payment it has on those rounds is netted or paid on the plan, and
// your own lines add up to exactly what those rounds, expenses and payments have you owing or owed.
// Then the covered rounds leave the Tab's pair-by-pair money (pair-debts.js lockedRounds), the
// covered expenses leave the rest, and the plan's open lines take their place. Otherwise it's 'stale' (the organizer's phone republishes) and the
// phone stays pair by pair, exactly as before there were plans. A trip round shared live that the
// plan doesn't cover yet stays pair by pair until it does, and an expense it doesn't cover yet stays
// with the rest of the Tab. Pure, unit tested.
import { onTab, tabResults } from './play-for.js';
import { fewestPayments } from './ledger.js';
import { FETCH_DAYS, canonicalOf, codeOf, played } from './pair-debts.js';
import { tripOfPayment } from './trip-pay.js';
import { meFor } from './format.js';
import { expenseMark, rawTripExpenses, tripExpenses } from './trip-expenses.js';

const DAY = 864e5;
const cents = v => Math.round((Number(v) || 0) * 100);
const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const rowKey = (code, id) => `${code}|${id}`;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;

/** A payment on one of the plan's lines: "trip:<tripId>:plan:<from>><to>:<when>". */
export function planPaymentId(tripId, from, to, at) {
  return `trip:${tripId}:plan:${from}>${to}:${Number(at || 0).toString(36)}`;
}
/** The trip a payment on a published plan's line paid, or null for any other payment. */
export function planPaymentTrip(s) {
  const id = tripOfPayment(s);
  return id && String(s.id).startsWith(`trip:${id}:plan:`) ? id : null;
}
export const isPlanPayment = s => planPaymentTrip(s) != null;

/** A short mark of a round's money (its transfers), so a fixed score makes the plan out of date. */
export function roundMark(round) {
  // What the round puts on the Tab: a money round's own transfers, a reward round's side bets for money
  const text = tabResults(round).transfers.map(t => `${t.from}>${t.to}:${cents(t.amount)}`).sort().join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${h.toString(36)}.${text.length.toString(36)}`;
}

/** A plan as it came from the server, tidied, or null when it isn't one. A deleted trip's plan is { tripId, deleted }. */
export function cleanPlan(p) {
  if (!isObj(p) || !isStr(p.tripId)) return null;
  const version = Number(p.version) || 0;
  if (p.deleted) return { tripId: p.tripId, version, deleted: true, at: Number(p.at) || 0 };
  if (!Array.isArray(p.rounds) || !Array.isArray(p.lines) || !Array.isArray(p.netted)) return null;
  const rounds = p.rounds.filter(r => isObj(r) && isStr(r.code) && isStr(r.mark)).map(r => ({ code: r.code, mark: r.mark }));
  const lines = p.lines.filter(l => isObj(l) && isStr(l.code) && isStr(l.from) && isStr(l.to) && cents(l.amount) > 0)
    .map(l => ({ code: l.code, from: l.from, to: l.to, amount: cents(l.amount) / 100 }));
  if (rounds.length !== p.rounds.length || lines.length !== p.lines.length) return null;
  const rawEx = p.expenses == null ? [] : p.expenses;
  if (!Array.isArray(rawEx)) return null;
  const expenses = rawEx.filter(x => isObj(x) && isStr(x.id) && isStr(x.mark)).map(x => ({ id: x.id, mark: x.mark }));
  if (expenses.length !== rawEx.length) return null;
  return {
    tripId: p.tripId, version, at: Number(p.at) || 0, endedAt: Number(p.endedAt) || null,
    byName: isStr(p.byName) ? p.byName.slice(0, 40) : null,
    rounds, netted: p.netted.filter(isStr), lines,
    // Only when it covers any, so a plan with none is just as it was before there were expenses
    ...(expenses.length ? { expenses } : {}),
  };
}

/** The same payments for the same rounds (the version and time aside). */
export function samePlan(a, b) {
  if (!a || !b) return false;
  const key = p => JSON.stringify([p.deleted || false, p.endedAt || null, p.rounds, [...p.netted].sort(), p.lines, p.expenses || []]);
  return key(a) === key(b);
}

/** The trip's finished money rounds shared live that this phone played, within the Tab's window. */
function tripShared(state, tripId, now) {
  return Object.values(state.rounds || {})
    .filter(r => r?.trip?.id === tripId && r.status === 'done' && onTab(r) && codeOf(r) && played(r, state)
      && (r.finishedAt || r.createdAt || 0) >= now - FETCH_DAYS * DAY)
    .sort((a, b) => (a.finishedAt || a.createdAt || 0) - (b.finishedAt || b.createdAt || 0));
}

/**
 * The trip's expenses the plan can square: everyone in one (and whoever paid) is linked up by the
 * rounds shared live the plan covers, so the payments can reach them. The rest stay with the Tab.
 */
function plannable(state, tripId, rounds, who) {
  const list = tripExpenses(state, tripId);
  if (!list.length) return [];
  const up = new Map();
  const top = id => { let x = id; while (up.get(x) !== x) x = up.get(x); return x; };
  for (const r of rounds) {
    const ids = [...new Set(r.players.map(p => who(p.id)))];
    for (const id of ids) if (!up.has(id)) up.set(id, id);
    for (const id of ids.slice(1)) up.set(top(id), top(ids[0]));
  }
  return list.filter(x => up.has(x.payer) && Object.entries(x.balances).every(([id, c]) => !c || (up.has(id) && top(id) === top(x.payer))));
}

/**
 * The organizer's plan for a trip: the fewest payments that square its rounds shared live and the
 * expenses they link up, less every payment already made on them, only ever between two people who
 * played one of them together. Null when there's nothing to cover, or the money doesn't add up to the cent.
 */
export function buildPlan(state, tripId, { now = Date.now(), version = 1, endedAt = null, byName = null } = {}) {
  const who = canonicalOf(state);
  const rounds = tripShared(state, tripId, now);
  if (!rounds.length) return null;
  const codes = new Set(rounds.map(codeOf));
  const bal = {};
  const add = (id, c) => { bal[id] = (bal[id] || 0) + c; };
  for (const r of rounds) for (const [pid, v] of Object.entries(tabResults(r).balances)) add(who(pid), cents(v));
  const spent = plannable(state, tripId, rounds, who);
  for (const x of spent) for (const [id, c] of Object.entries(x.balances)) add(id, c);
  const netted = [];
  for (const s of state.settlements || []) {
    if (!s.code || !codes.has(s.code)) continue;
    add(who(s.from), cents(s.amount));
    add(who(s.to), -cents(s.amount));
    netted.push(rowKey(s.code, s.id));
  }
  if (Object.values(bal).reduce((a, c) => a + c, 0) !== 0) return null;
  const together = new Map(); // pair -> rounds both played, most players first, then newest
  for (const r of [...rounds].sort((a, b) => b.players.length - a.players.length || (b.finishedAt || 0) - (a.finishedAt || 0))) {
    const ids = [...new Set(r.players.map(p => who(p.id)))];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      together.set(k, [...(together.get(k) || []), r]);
    }
  }
  const pay = fewestPayments(Object.fromEntries(Object.entries(bal).map(([k, c]) => [k, c / 100])), { canPay: (a, b) => together.has(pairKey(a, b)) });
  const lines = [];
  for (const t of pay) {
    const r = together.get(pairKey(t.from, t.to))?.[0];
    const seat = id => r?.players.find(p => who(p.id) === id)?.id;
    if (!r || !seat(t.from) || !seat(t.to)) return null;
    lines.push({ code: codeOf(r), from: seat(t.from), to: seat(t.to), amount: t.amount });
  }
  // With expenses in it, every line has to square everyone to the cent, or it's not published
  if (spent.length) {
    const got = {};
    for (const t of pay) { got[t.from] = (got[t.from] || 0) - cents(t.amount); got[t.to] = (got[t.to] || 0) + cents(t.amount); }
    if (Object.entries(bal).some(([id, c]) => (got[id] || 0) !== c)) return null;
  }
  return {
    tripId, version, at: now, endedAt: endedAt || null, byName: byName || null,
    rounds: rounds.map(r => ({ code: codeOf(r), mark: roundMark(r) })), netted: netted.sort(), lines,
    ...(spent.length ? { expenses: spent.map(x => ({ id: x.id, mark: expenseMark(x.raw) })).sort((a, b) => a.id.localeCompare(b.id)) } : {}),
  };
}

/**
 * On the organizer's phone: the plan to publish now, or null when the one out there still holds
 * (it checks out here, covers every trip round shared live, and says the same about "done
 * playing"). A new plan is the next version.
 */
export function duePlan(state, trip, { now = Date.now(), byName = null } = {}) {
  const cur = cleanPlan(state.tripPlans?.[trip.id]);
  if (cur?.deleted) return null;
  const ps = planState(state, trip.id, { now });
  const ended = trip.endedAt || null;
  if (cur && ps.status === 'live' && !ps.pending.length && !ps.pendingExpenses.length && (cur.endedAt || null) === ended) return null;
  const next = buildPlan(state, trip.id, { now, version: (cur?.version || 0) + 1, endedAt: ended, byName });
  return !next || (cur && samePlan(cur, next)) ? null : next;
}

const cache = new WeakMap();

/**
 * The trip's plan on this phone: { status, plan, ... }.
 * - 'none': no plan (the SQL hasn't run, or nothing's published yet). Pair by pair, as before.
 * - 'stale': a plan that doesn't check out here (a round fixed, a payment it didn't count, a
 *   payment row not here yet). Pair by pair until the organizer's phone republishes.
 * - 'live': settle from the plan. `covered` (round ids on this phone), `rounds` (those rounds),
 *   `settlements` (the payments it netted or that paid its lines, on this phone), `open` (each
 *   pair's open money on the plan, [{ from, to, cents }], ids as this phone knows them), `lines`
 *   (each line: { from, to, cents, code, rf, rt }, rf and rt the round's ids), `pending` (trip
 *   rounds shared live it doesn't cover yet, which stay pair by pair), `expenses` (the ids of the
 *   trip expenses it covers) and `pendingExpenses` (ones it doesn't cover yet).
 * - 'deleted': the organizer deleted the trip.
 */
export function planState(state, tripId, { now = Date.now() } = {}) {
  let byState = cache.get(state);
  if (!byState) { byState = new Map(); cache.set(state, byState); }
  const key = `${tripId}|${Math.floor(now / DAY)}`;
  if (!byState.has(key)) byState.set(key, check(state, tripId, now));
  return byState.get(key);
}

function check(state, tripId, now) {
  const plan = cleanPlan(state.tripPlans?.[tripId]);
  if (!plan) return { status: 'none', plan: null };
  if (plan.deleted) return { status: 'deleted', plan };
  const stale = why => ({ status: 'stale', plan, why });
  const who = canonicalOf(state);
  const me = who(state.me);
  const codes = new Set(plan.rounds.map(r => r.code));
  const byCode = new Map();
  for (const r of Object.values(state.rounds || {})) {
    const c = codeOf(r);
    if (c && codes.has(c) && r.status === 'done' && onTab(r) && !byCode.has(c)) byCode.set(c, r);
  }
  // Every covered round this phone has: on the trip, and its money as the plan saw it
  for (const { code, mark } of plan.rounds) {
    const r = byCode.get(code);
    if (!r) continue;
    if (r.trip?.id !== tripId) return stale('round');
    if (roundMark(r) !== mark) return stale('score');
    if (played(r, state) && (r.finishedAt || r.createdAt || 0) < now - FETCH_DAYS * DAY) return stale('old');
  }
  const mine = new Set(tripShared(state, tripId, now).map(codeOf));
  // Payments on the covered rounds: netted by the plan, or paid on its lines. Rows for rounds this
  // phone looks up must all be here (a missing one is still on its way, or was taken back)
  const netted = new Set(plan.netted);
  const settlements = [], post = [];
  const seen = new Set();
  for (const s of state.settlements || []) {
    if (!s.code || !byCode.has(s.code)) continue;
    const k = rowKey(s.code, s.id);
    seen.add(k);
    if (netted.has(k)) settlements.push(s);
    else if (planPaymentTrip(s) === tripId) { settlements.push(s); post.push(s); }
    else if (mine.has(s.code)) return stale('payment');
  }
  for (const k of netted) if (mine.has(k.slice(0, k.indexOf('|'))) && !seen.has(k)) return stale('missing');
  // The trip's expenses: each one it covers as it saw it (not changed, not deleted)
  const marks = new Map((plan.expenses || []).map(x => [x.id, x.mark]));
  for (const e of marks.size ? rawTripExpenses(state, tripId) : []) {
    if (marks.has(e.id) && (e.deleted || expenseMark(e) !== marks.get(e.id))) return stale('expense');
  }
  const spent = tripExpenses(state, tripId);
  const spentIn = spent.filter(x => marks.has(x.id));
  // The lines, as this phone knows the people in them
  const lines = [];
  for (const l of plan.lines) {
    const r = byCode.get(l.code);
    if (!r) continue; // a round this phone doesn't have: two other people's line
    if (!r.players.some(p => p.id === l.from) || !r.players.some(p => p.id === l.to)) return stale('line');
    const from = who(l.from), to = who(l.to);
    if (from !== to) lines.push({ from, to, cents: cents(l.amount), code: l.code, rf: l.from, rt: l.to });
  }
  // Your own lines are exactly what the covered rounds and their payments have you owing or owed
  let left = 0, owed = 0;
  for (const r of byCode.values()) for (const [pid, v] of Object.entries(tabResults(r).balances)) if (who(pid) === me) left += cents(v);
  for (const x of spentIn) left += x.balances[me] || 0;
  for (const s of settlements) {
    if (post.includes(s)) continue;
    if (who(s.from) === me) left += cents(s.amount);
    if (who(s.to) === me) left -= cents(s.amount);
  }
  for (const l of lines) { if (l.to === me) owed += l.cents; if (l.from === me) owed -= l.cents; }
  if (left !== owed) return stale('total');
  // Each pair's open money: its lines, less what's been paid on them since
  const net = new Map(); // "a|b" -> cents a owes b
  const owe = (f, t, c) => { const k = pairKey(f, t); net.set(k, (net.get(k) || 0) + (f < t ? c : -c)); };
  for (const l of lines) owe(l.from, l.to, l.cents);
  for (const s of post) { const f = who(s.from), t = who(s.to); if (f !== t) owe(f, t, -cents(s.amount)); }
  const open = [];
  for (const [k, c] of net) {
    if (!c) continue;
    const [a, b] = k.split('|');
    open.push(c > 0 ? { from: a, to: b, cents: c } : { from: b, to: a, cents: -c });
  }
  const covered = new Set([...byCode.values()].map(r => r.id));
  const pending = tripShared(state, tripId, now).filter(r => !codes.has(codeOf(r))).map(r => r.id);
  return {
    status: 'live', plan, covered, rounds: [...byCode.values()], settlements, post, open, lines, pending,
    expenses: new Set(spentIn.map(x => x.id)), pendingExpenses: spent.filter(x => !marks.has(x.id)).map(x => x.id),
  };
}

/** Every live plan on this phone. */
function livePlans(state, now) {
  const ids = new Set(Object.keys(state.tripPlans || {}));
  return [...ids].map(id => planState(state, id, { now })).filter(p => p.status === 'live');
}

/** Round ids a live plan covers: their money settles on the plan, not pair by pair. */
export function coveredRounds(state, { now = Date.now() } = {}) {
  const out = new Set();
  if (!state.tripPlans) return out;
  for (const p of livePlans(state, now)) for (const id of p.covered) out.add(id);
  return out;
}

/**
 * What the Tab takes from the live plans: { rounds, settlements, open, expenses }. The rounds,
 * expenses (ids) and payments come out of the group's balances and each pair's open money on the plan goes in, so the Tab
 * shows every pair what the plan has between them.
 */
export function planDebts(state, { now = Date.now() } = {}) {
  const out = { rounds: [], settlements: [], open: [], expenses: [] };
  if (!state.tripPlans) return out;
  for (const p of livePlans(state, now)) {
    out.rounds.push(...p.rounds);
    out.settlements.push(...p.settlements);
    out.open.push(...p.open);
    out.expenses.push(...p.expenses);
  }
  return out;
}

/**
 * Rows that pay a plan's open money between two people (ids as this phone knows them): `amount`
 * cents from `from` to `to`, or all of it either way (`amount` null, a whole card or Settle the
 * trip). `trip` keeps it to one trip's plan. Each row goes on its line's round, so both phones
 * get it. Returns { rows, cents }: cents is what `from` paid `to` on the plan (negative when the
 * plan had `to` owing `from`).
 */
export function planRows(state, from, to, { amount = null, now = Date.now(), reason = null, trip = null } = {}) {
  const who = canonicalOf(state);
  const F = who(from), T = who(to);
  const rows = [];
  let paid = 0;
  for (const tripId of Object.keys(state.tripPlans || {})) {
    if (trip && tripId !== trip) continue;
    const p = planState(state, tripId, { now });
    if (p.status !== 'live') continue;
    const o = p.open.find(x => (x.from === F && x.to === T) || (x.from === T && x.to === F));
    if (!o) continue;
    const forward = o.from === F;
    if (amount != null && !forward) continue;
    let c = amount == null ? o.cents : Math.min(o.cents, amount - paid);
    if (c <= 0) continue;
    // On the pair's line (the first, when one phone sees two of them between the same people)
    const line = p.lines.find(l => l.from === o.from && l.to === o.to) || p.lines.find(l => l.from === o.to && l.to === o.from);
    const [rf, rt] = line.from === o.from ? [line.rf, line.rt] : [line.rt, line.rf];
    const round = p.rounds.find(r => codeOf(r) === line.code);
    rows.push({
      code: line.code, id: planPaymentId(tripId, rf, rt, now), kind: 'payment', from: rf, to: rt, amount: c / 100,
      status: 'paid', by: meFor(round, state) || null, reason: reason || `trip:${tripId}`, at: now, updatedAt: now,
    });
    paid += forward ? c : -c;
  }
  return { rows, cents: paid };
}
