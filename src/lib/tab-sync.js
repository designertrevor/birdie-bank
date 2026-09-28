// The shared Tab on the server: payments and carry-overs for rounds that were shared live, one
// row per round transfer in `round_payments` (supabase/2026-09-29-round-payments.sql). Both
// phones write rows and read each other's, so "I paid" shows on both at once.
// Rows wait in a queue on the phone and go out when there's signal. Until the SQL has run (or
// with no server at all) everything stays on this phone, as it did before: no errors, and the
// buttons that need the other phone (Roll to next time) stay hidden.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, uid, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { allocatePayment, applyRows, lastPayment, tabCodes, undoRows } from './shared-tab.js';
import { activeCarry, carryReducer, carryRows, carrySplit, splitCodes, splitRounds } from './carry.js';

const QUEUE = 'bb-tab-queue';
const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the round_payments table isn't on the server yet. */
export class TabOffError extends Error {
  constructor() { super('The shared Tab isn’t switched on yet'); this.name = 'TabOffError'; }
}

const iso = ms => new Date(ms || Date.now()).toISOString();
const toDb = r => ({
  code: r.code, id: r.id, kind: r.kind, from_id: r.from, to_id: r.to, amount: Number(r.amount) || 0, status: r.status,
  by_id: r.by || null, reason: r.reason ? String(r.reason).slice(0, 60) : null, created_at: iso(r.at), updated_at: iso(r.updatedAt),
});
const fromDb = x => ({
  code: x.code, id: x.id, kind: x.kind, from: x.from_id, to: x.to_id, amount: Number(x.amount) || 0, status: x.status,
  by: x.by_id || null, reason: x.reason || null, at: Date.parse(x.created_at) || 0, updatedAt: Date.parse(x.updated_at) || 0,
});

// --------------------------- transport ---------------------------------------
//   fetchRows(codes) -> rows   upsertRow(row)   subscribe(codes, cb) -> unsubscribe

function supabaseTab(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new TabOffError();
    throw error;
  };
  return {
    kind: 'supabase',
    async fetchRows(codes) {
      if (!codes.length) return [];
      const r = await db.from('round_payments').select('*').in('code', codes);
      check(r);
      return (r.data || []).map(fromDb);
    },
    async upsertRow(row) { check(await db.from('round_payments').upsert(toDb(row))); },
    subscribe(codes, cb) {
      if (!codes.length) return () => {};
      const ch = db.channel(`tab-${codes.join('-').slice(0, 60)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_payments', filter: `code=in.(${codes.join(',')})` }, p => {
          if (p.new?.code) cb(fromDb(p.new));
        })
        .subscribe();
      return () => { db.removeChannel(ch); };
    },
  };
}

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
      } catch (e) { noteError(e); break; }
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
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', soon);
    return () => {
      stopped = true;
      clearTimeout(timer);
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
  const { rows, settlements } = allocatePayment(s, { from, to, amount }, { now, makeId: () => uid() });
  const carry = activeCarry(s, from, to, { from, to, amount });
  if (carry?.status === 'asked') rows.push(...carryRows(s, carryReducer(carry, { type: 'withdraw', at: now }), { now }));
  commit(rows, { add: settlements });
  return { shared: !off && rows.some(r => r.kind === 'payment') };
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

/** Take back payments (one tap, no confirm: it can be put back the same way). Returns a redo function. */
export function undoPayments(settlementsToUndo, netted = []) {
  const s = getState();
  const now = Date.now();
  const { rows, remove } = undoRows(s, { settlements: settlementsToUndo, netted }, { now });
  const gone = (s.settlements || []).filter(x => remove.includes(x.id));
  commit(rows, { remove });
  return () => {
    const later = Date.now();
    commit(rows.map(r => ({ ...r, status: r.id.endsWith(':net') ? 'netted' : 'paid', updatedAt: later })), { add: gone });
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
