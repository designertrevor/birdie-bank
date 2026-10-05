// The shared Tab on the server: payments and carry-overs for rounds that were shared live, one
// row per round transfer in `round_payments` (supabase/2026-09-29-round-payments.sql). Both
// phones write rows and read each other's, so "I paid" shows on both at once.
// Rows wait in a queue on the phone and go out when there's signal. Until the SQL has run (or
// with no server at all) everything stays on this phone, as it did before: no errors, and the
// buttons that need the other phone (Roll to next time) stay hidden.
import { useEffect, useSyncExternalStore } from 'react';
import { STORE_KEY, getState, uid, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { allocatePayment, applyRows, lastPayment, nettedFor, tabCodes, undoRows } from './shared-tab.js';
import { cardCarry, carryReducer, carryRows, carrySplit, splitCodes, splitRounds } from './carry.js';
import { tripPayment } from './trips.js';
import { allTripPays, mergeExpenses, newPayment, resolveExpense } from './trip-expenses.js';
import { expensesOn, refreshExpenses } from './trip-expense-sync.js';
import { crewPayment } from './crew-tabs.js';
import { closeBooks } from './books.js';
import { canonicalOf } from './pair-debts.js';
import { BadRowError, TAB_CHECK_MS, TabOffError, supabaseTab } from './tab-adapters.js';

export { TabOffError, TAB_CHECK_MS } from './tab-adapters.js';

// Per dev profile (?profile=b), so two tabs acting as two phones never read each other's queue
const QUEUE = 'bb-tab-queue' + STORE_KEY.slice('birdie-bank-v1'.length);
const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

// Dev and testing: localStorage + BroadcastChannel, so two tabs (one with ?profile=b) act as two phones
function localTab() {
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bb-tab') : null;
  const KEY = 'bb-tab-rows';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    kind: 'local',
    async fetchRows(codes) { const all = load(); return Object.values(all).filter(r => codes.includes(r.code)); },
    async upsertRow(row) {
      const all = load();
      all[`${row.code}|${row.id}`] = row;
      localStorage.setItem(KEY, JSON.stringify(all));
      bc?.postMessage(row);
    },
    subscribe(codes, cb) {
      const h = e => { if (codes.includes(e.data?.code)) cb(e.data); };
      bc?.addEventListener('message', h);
      return () => bc?.removeEventListener('message', h);
    },
  };
}

let adapterPromise = null;
function getTabAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? supabaseTab(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(localTab());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
const hasServer = supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag());

// "Off": no server, or no round_payments table yet. Learned on the first try, for this session
let off = !hasServer;
const offListeners = new Set();
function noteError(e) {
  if (e instanceof TabOffError && !off) {
    off = true;
    offListeners.forEach(l => l());
  }
}
const subOff = l => { offListeners.add(l); return () => offListeners.delete(l); };
/** True while payments can't reach the other phone, so screens keep everything on this one. */
export function usePaymentsOff() {
  return useSyncExternalStore(subOff, () => off, () => off);
}

// --------------------------- queue --------------------------------------------

function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE)) || []; } catch { return []; } }
function writeQueue(q) { try { localStorage.setItem(QUEUE, JSON.stringify(q.slice(-500))); } catch { /* storage full */ } }
function enqueue(rows) {
  const keys = new Set(rows.map(r => `${r.code}|${r.id}`));
  writeQueue([...readQueue().filter(r => !keys.has(`${r.code}|${r.id}`)), ...rows]);
}

let flushing = null;
/** Send every row waiting on this phone. Safe to call often. */
export function flushTab() {
  if (flushing) return flushing;
  flushing = (async () => {
    if (off) return;
    const adapter = await getTabAdapter();
    if (!adapter) return;
    for (const row of readQueue()) {
      try {
        await adapter.upsertRow(row);
        // Only drop it if nothing newer for the same row was queued meanwhile
        writeQueue(readQueue().filter(r => !(r.code === row.code && r.id === row.id && r.updatedAt === row.updatedAt)));
      } catch (e) {
        if (e instanceof BadRowError) {
          console.warn('Shared Tab: the server refused a row, dropping it', row.id, e.cause);
          writeQueue(readQueue().filter(r => !(r.code === row.code && r.id === row.id && r.updatedAt === row.updatedAt)));
          continue;
        }
        noteError(e);
        break;
      }
    }
  })().finally(() => { flushing = null; });
  return flushing;
}

// --------------------------- applying ----------------------------------------

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Put rows on this phone's state. Only writes when something changed. */
function take(rows, { add = [], remove = [] } = {}) {
  const s = getState();
  const base = { ...s, settlements: [...(s.settlements || []).filter(x => !remove.includes(x.id)), ...add] };
  const next = applyRows(base, rows);
  if (same(next.settlements, s.settlements) && same(next.carries, s.carries || []) && same(next.tabRows, s.tabRows || {})) return;
  update(st => { st.settlements = next.settlements; st.carries = next.carries; st.tabRows = next.tabRows; });
}

/** Save rows on this phone now and send them when there's signal. */
function commit(rows, extra) {
  take(rows, extra);
  if (!rows.length) return;
  enqueue(rows);
  flushTab();
}

/**
 * Keep payments for trip expenses (or their deletions) on this phone and send them up with the
 * trip's expenses (trip-expense-sync.js), so every phone on the trip gets them.
 */
function keepExpenses(list) {
  const xs = list.filter(Boolean);
  if (!xs.length) return;
  update(st => { st.tripExpenses = mergeExpenses(st.tripExpenses || {}, xs); });
  refreshExpenses();
}

/** Send anything waiting, then pick up the other phones' rows for your recent shared rounds. */
export async function refreshTab() {
  if (off) return;
  const codes = tabCodes(getState());
  if (!codes.length) return;
  try {
    const adapter = await getTabAdapter();
    if (!adapter) return;
    await flushTab();
    const rows = await adapter.fetchRows(codes);
    // Rows still waiting to go up are newer than the server's copy
    const waiting = new Set(readQueue().map(r => `${r.code}|${r.id}`));
    take(rows.filter(r => !waiting.has(`${r.code}|${r.id}`)));
  } catch (e) { noteError(e); }
}

/**
 * Keep the shared Tab fresh while a screen is open: fetch now and when the phone wakes, and
 * (with `live`) listen for the other phones' changes.
 */
export function useTabSync({ live = false } = {}) {
  const codesKey = tabCodes(getState()).join(',');
  useEffect(() => {
    let stopped = false, unsub = null, timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { if (!stopped) refreshTab(); }, 250); };
    refreshTab();
    if (live && codesKey && !off) {
      getTabAdapter().then(adapter => {
        if (stopped || !adapter) return;
        unsub = adapter.subscribe(codesKey.split(','), row => {
          const waiting = readQueue().some(r => r.code === row.code && r.id === row.id);
          if (!waiting) take([row]);
        });
      });
    }
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    // Table changes stop once the round codes SQL is run, so a Tab left open checks again now and then
    const every = live ? setInterval(wake, TAB_CHECK_MS) : null;
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', soon);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(every);
      unsub?.();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', soon);
    };
  }, [live, codesKey]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushTab());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flushTab(); });
  if (readQueue().length) setTimeout(() => flushTab(), 3000);
}

// --------------------------- actions -----------------------------------------

/**
 * Record `from` paying `to` (the person card, the Settle up sheet). Ties the payment to the
 * shared round transfers between them, and takes back an open ask to roll it over.
 * Returns { shared }: true when the other phone will see it.
 */
export function markPaid({ from, to, amount }) {
  const s = getState();
  const now = Date.now();
  const { rows, settlements, expenses } = allocatePayment(s, { from, to, amount }, { now, makeId: () => uid() });
  const carry = cardCarry(s, from, to, { from, to, amount }, now);
  if (carry?.status === 'asked') rows.push(...carryRows(s, carryReducer(carry, { type: 'withdraw', at: now }), { now }));
  commit(rows, { add: settlements });
  keepExpenses(expenses);
  return { shared: (!off && rows.some(r => r.kind === 'payment')) || (expenses.length > 0 && expensesOn()) };
}

/** Mark one round transfer paid in full (the end-of-round settle-up). */
export function markTransfer(round, t, code) {
  const now = Date.now();
  if (!code) {
    take([], { add: [{ id: uid('s_'), from: t.from, to: t.to, amount: t.amount, at: now, roundId: round.id }] });
    return { shared: false };
  }
  const s = getState();
  const id = `${code}:${t.from}>${t.to}`;
  const taken = (s.settlements || []).some(x => x.id === id);
  const by = round.localMe ?? s.me;
  commit([{ code, id: taken ? `${id}:${uid()}` : id, kind: 'payment', from: t.from, to: t.to, amount: t.amount, status: 'paid', by, reason: null, at: now, updatedAt: now }]);
  return { shared: !off };
}

/**
 * Record one line of "Settle the trip" paid (`part`: someone leaving early settles their part).
 * The shared rounds' part squares the pair on the trip's round transfers, so both phones (and
 * everyone else in those rounds) see it and agree; the part from rounds only this phone has is a
 * payment on this phone and your account. Returns { shared, at }.
 */
export function markTripPayment({ tripId, from, to, part = false }) {
  const now = Date.now();
  const { rows, settlements, expenses } = tripPayment(getState(), tripId, from, to, { now, part });
  commit(rows, { add: settlements });
  keepExpenses(expenses);
  return { shared: (!off && rows.some(r => r.status === 'paid')) || (expenses.length > 0 && expensesOn()), at: now };
}

/** Take back payments (one tap, no confirm: it can be put back the same way). Returns a redo function. */
export function undoPayments(settlementsToUndo, netted = null) {
  const s = getState();
  // From the payments list: what that payment netted is taken back with it
  if (!netted) netted = nettedFor(s, settlementsToUndo);
  const now = Date.now();
  const { rows, remove, spent } = undoRows(s, { settlements: settlementsToUndo, netted }, { now });
  const gone = (s.settlements || []).filter(x => remove.includes(x.id));
  commit(rows, { remove });
  // Payments for trip expenses are taken back with one of this phone's that `undoes` it, and put
  // back with one that undoes that, whoever marked the payment: the latest tap on any phone wins
  // (trip-expenses.js), and both phones of a pair may hold the payment under one id
  const back = spent.map(x => newPayment(s, { id: `x_${uid()}`, tripId: x.tripId, from: x.to, to: x.from, amount: Math.round(x.amount * 100), undoes: x.id, now })).filter(Boolean);
  keepExpenses(back);
  return () => {
    const later = Math.max(Date.now(), now + 1);
    commit(rows.map(r => ({ ...r, status: r.id.endsWith(':net') ? 'netted' : 'paid', updatedAt: later })), { add: gone });
    const s2 = getState();
    keepExpenses(back.map(u => {
      const x = resolveExpense(s2, u);
      return newPayment(s2, { id: `x_${uid()}`, tripId: u.tripId, from: x.parts[0].id, to: x.payer, amount: x.cents, undoes: u.id, now: later });
    }).filter(Boolean));
  };
}

/** Undo the most recent payment between two people (the card's "Undo" and "Didn’t get it?"). */
export function undoLastPayment(a, b) {
  const pay = lastPayment(getState(), a, b);
  return pay ? undoPayments(pay.settlements, pay.netted) : null;
}

/** Ask to roll what `from` owes `to` into the next round. */
export function askCarry({ from, to, amount, by, reason = null }) {
  const s = getState();
  const now = Date.now();
  const split = carrySplit(s, from, to, amount);
  if (!split.length) return false;
  const carry = carryReducer(null, { type: 'ask', from, to, amount, by, reason, at: now, roundIds: splitRounds(split), codes: splitCodes(split) });
  commit(carryRows(s, carry, { now, split }));
  return true;
}

/** Answer or take back an ask: 'agree' | 'decline' | 'withdraw'. */
export function answerCarry(carry, type) {
  const s = getState();
  const now = Date.now();
  const next = carryReducer(carry, { type, at: now });
  if (next === carry) return;
  const rows = carryRows(s, next, { now });
  if (rows.length) { commit(rows); return; }
  // A carry that reached this phone through your account but not its rounds: answer it here
  const { carried: _carried, ...plain } = next;
  update(st => { st.carries = (st.carries || []).map(c => (c.id === next.id ? plain : c)); });
}

/**
 * Undo for payments made in one tap at `at` (and the transfers they netted): the payments this
 * phone has from that moment with those ids, rows and expense payments included. Returns a redo, or null.
 */
function undoMadeAt(at, ids) {
  const s = getState();
  const list = [...(s.settlements || []), ...allTripPays(s)].filter(x => x.at === at && ids.has(x.id));
  return list.length ? undoPayments(list) : null;
}

/**
 * One line of a crew's tab paid (crew-tabs.js crewPayment): its rounds shared live are squared on
 * their rows, which every phone in them gets; the rest is a payment here that names the crew.
 * Returns { shared, undo }.
 */
export function markCrewPayment({ crewId, from, to }) {
  const now = Date.now();
  const { rows, settlements } = crewPayment(getState(), crewId, from, to, { now, makeId: () => uid() });
  commit(rows, { add: settlements });
  const ids = new Set([...rows.filter(r => r.kind === 'payment' && r.status === 'paid').map(r => r.id), ...settlements.map(x => x.id)]);
  return { shared: !off && rows.some(r => r.status === 'paid'), undo: () => undoMadeAt(now, ids) };
}

/**
 * Close a tab's books (books.js): pay the lines picked Paid, ask to roll the rest, and keep the
 * closed season. Returns { book, shared, undo }: undo takes the payments back, withdraws the asks
 * to roll and reopens the season, the way one tap does on a person card.
 */
export function closeTheBooks({ scope, name, picks }) {
  const now = Date.now();
  const s = getState();
  const res = closeBooks(s, scope, { name, picks, now, ask: !off, makeId: () => uid() });
  commit(res.rows, { add: res.settlements });
  keepExpenses(res.expenses);
  update(st => {
    st.books = { ...(st.books || {}), [res.book.id]: res.book };
    // An ask taken back that no shared round carries: this phone's copy is the one to change
    if (res.withdrawn?.length) st.carries = (st.carries || []).map(c => (c.status === 'asked' && res.withdrawn.find(w => w.id === c.id)) || c);
  });
  const ids = new Set([...res.rows.filter(r => r.kind === 'payment' && r.status === 'paid').map(r => r.id), ...res.settlements.map(x => x.id), ...res.expenses.map(x => x.id)]);
  const undo = () => {
    undoMadeAt(now, ids);
    const s2 = getState();
    const who = canonicalOf(s2);
    for (const c of res.carries) {
      const cur = (s2.carries || []).find(k => k.id === c.id || (k.at === c.at && who(k.from) === who(c.from) && who(k.to) === who(c.to)));
      if (cur) answerCarry(cur, 'withdraw');
    }
    update(st => { const next = { ...(st.books || {}) }; delete next[res.book.id]; st.books = next; });
  };
  return { book: res.book, shared: (!off && res.rows.length > 0) || (res.expenses.length > 0 && expensesOn()), undo };
}

/** Reopen a closed season: the marker goes, and its payments and roll-overs stay as they are. */
export function reopenBooks(id) {
  update(st => { const next = { ...(st.books || {}) }; delete next[id]; st.books = next; });
}
