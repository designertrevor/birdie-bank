// Trip expenses on the server (`trip_expenses`, supabase/2026-10-04-trip-expenses.sql): each phone
// sends the expenses it added and reads every expense on the trips it knows, so everyone on a trip
// has the same expenses and the organizer's published plan can count them (trip-plan.js).
// Until the SQL has run (or with no server at all) an expense stays on the phone that added it and
// its account, and counts there exactly the same way: no errors, nothing to switch on.
// Nothing waits in a queue: after reading the server's copies, this phone sends any of its own
// expenses the server doesn't have yet (or has an older copy of), so one that was added with no
// signal goes up the next time there is some.
import { getState, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { codeOf } from './pair-debts.js';
import { expensesToSend, mergeExpenses } from './trip-expenses.js';
import { tripsOf } from './trips.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the trip_expenses table isn't on the server yet. */
class ExpensesOffError extends Error {
  constructor() { super('Trip expenses aren’t switched on yet'); this.name = 'ExpensesOffError'; }
}
/** The server won't take this row from this phone (someone else's, or bad data): don't retry it. */
class RefusedError extends Error {
  constructor(cause) { super(cause?.message || 'Refused'); this.name = 'RefusedError'; this.cause = cause; }
}

// --------------------------- transport ---------------------------------------
//   fetch(tripIds) -> [{ expense, codes }]   save(expense, codes)

function supabaseExpenses(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new ExpensesOffError();
    // Not this phone's row (row rules), or a check it fails: retrying won't help
    if (error.code === '42501' || /^2[23]/.test(String(error.code || ''))) throw new RefusedError(error);
    throw error;
  };
  return {
    async fetch(ids) {
      if (!ids.length) return [];
      const r = await db.from('trip_expenses').select('trip_id, id, codes, expense').in('trip_id', ids);
      check(r);
      return (r.data || []).map(x => ({ expense: { ...x.expense, id: x.id, tripId: x.trip_id }, codes: x.codes || [] }));
    },
    async save(e, codes) {
      check(await db.from('trip_expenses').upsert({ trip_id: e.tripId, id: e.id, codes, expense: e }));
    },
  };
}

// Dev and testing: localStorage, so two tabs (one with ?profile=b) act as two phones
const LOCAL_KEY = 'bb-trip-expenses';
function localExpenses() {
  const load = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };
  return {
    async fetch(ids) { const all = load(); return Object.values(all).filter(x => ids.includes(x.expense.tripId)); },
    async save(e, codes) { const all = load(); all[`${e.tripId}|${e.id}`] = { expense: e, codes }; localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); },
  };
}

let adapterPromise = null;
function getAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? supabaseExpenses(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(localExpenses());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}

// "Off": no server, or no trip_expenses table yet. Learned on the first try, for this session
let off = !(supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag()));
const note = e => {
  if (e instanceof ExpensesOffError) off = true;
  else console.warn('Trip expenses:', e?.message || e);
};

/** Whether expenses reach the other phones on the trip (otherwise they stay on this phone and your account). */
export const expensesOn = () => !off;
/** The localStorage key the dev adapter writes, so a second tab can listen for it. */
export const EXPENSES_KEY = LOCAL_KEY;

/** The trips this phone knows, and the round codes it has for each (so the server knows who's on it). */
function tripCodes(s) {
  const out = new Map([...tripsOf(s).keys()].map(id => [id, new Set()]));
  for (const r of Object.values(s.rounds || {})) {
    const c = codeOf(r);
    if (r?.trip?.id && out.has(r.trip.id) && c && /^[A-Z0-9]{6}$/.test(c)) out.get(r.trip.id).add(c);
  }
  return out;
}

/** Keep the server's copies on this phone, the newer of each. */
function keep(list) {
  const s = getState();
  const next = mergeExpenses(s.tripExpenses || {}, list);
  if (next !== (s.tripExpenses || {})) update(st => { st.tripExpenses = next; });
}

// Rows the server refused this session (someone else's, or bad data), so they aren't sent every minute
const refused = new Set();

let running = null;
/**
 * Read the expenses of every trip this phone knows, then send the ones this phone added that the
 * server doesn't have as they are here (new, changed, deleted, or the trip has rounds it didn't
 * know about when it went up).
 */
export function refreshExpenses() {
  if (off) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    const adapter = await getAdapter();
    if (!adapter) return;
    const trips = tripCodes(getState());
    const ids = [...trips.keys()];
    if (!ids.length) return;
    try {
      const rows = await adapter.fetch(ids);
      keep(rows.map(x => x.expense));
      for (const { expense: e, codes } of expensesToSend(getState(), rows, trips)) {
        if (refused.has(`${e.id}|${e.updatedAt}`)) continue;
        try { await adapter.save(e, codes); } catch (err) {
          if (err instanceof RefusedError) { refused.add(`${e.id}|${e.updatedAt}`); console.warn('Trip expenses: the server refused one', e.id, err.cause); continue; }
          throw err;
        }
      }
    } catch (e) { note(e); }
  })().finally(() => { running = null; });
  return running;
}
