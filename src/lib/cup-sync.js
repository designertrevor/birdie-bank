// A team points trip's matches on the server (`trip_cup`, supabase/2026-10-04-trip-cup.sql), so a
// friend in another group sees every match, not just their own: each phone posts the matches of
// the trip rounds it keeps (cup.js cupEntry) and reads everyone else's. Each phone also posts its
// own "I paid" marks for the stake (one row a phone), so every phone on the trip sees them.
// Until the SQL has run (or with no server at all) nothing is posted or read, and each phone
// counts the matches of the rounds it has: no errors, nothing to switch on.
import { useEffect } from 'react';
import { getState, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { stable } from './sync-model.js';
import { codeOf } from './pair-debts.js';
import { cupEntry, cupKey, CUP_FORMAT } from './cup.js';
import { tripRounds, tripsOf } from './trips.js';
import { deviceReady, myDevice } from './device.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the trip_cup table isn't on the server yet. */
class CupOffError extends Error {
  constructor() { super('Trip matches aren’t switched on yet'); this.name = 'CupOffError'; }
}

// --------------------------- transport ---------------------------------------
//   fetch(tripIds) -> [{ tripId, key, data }]   publish(tripId, key, data)

function supabaseCup(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new CupOffError();
    throw error;
  };
  return {
    async fetch(ids) {
      if (!ids.length) return [];
      const r = await db.from('trip_cup').select('trip_id, key, data').in('trip_id', ids);
      check(r);
      return (r.data || []).map(x => ({ tripId: x.trip_id, key: x.key, data: x.data }));
    },
    async publish(tripId, key, data) {
      check(await db.from('trip_cup').upsert({ trip_id: tripId, key, data }));
    },
  };
}

// Dev and testing: localStorage, so two tabs (one with ?profile=b) act as two phones
const LOCAL_KEY = 'bb-trip-cup';
function localCup() {
  const load = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };
  return {
    async fetch(ids) {
      const all = load();
      return ids.flatMap(id => Object.entries(all[id] || {}).map(([key, data]) => ({ tripId: id, key, data })));
    },
    async publish(tripId, key, data) {
      const all = load();
      all[tripId] = { ...(all[tripId] || {}), [key]: data };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    },
  };
}

let adapterPromise = null;
function getAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? supabaseCup(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(localCup());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}

// "Off": no server, or no trip_cup table yet. Learned on the first try, for this session
let off = !(supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag()));
const note = e => {
  if (e instanceof CupOffError) off = true;
  else console.warn('Trip matches:', e?.message || e);
};

/** Team points trips this phone knows. */
const cupTrips = s => [...tripsOf(s).values()].filter(t => t.format === CUP_FORMAT);

/** How far a round's matches have got, to tell an older copy from a newer one. */
const progress = e => (e?.matches || []).reduce((a, m) => a + (Number(m.result?.thru) || 0), 0) + (e?.status === 'done' ? 1000 : 0);

/** This phone's key for its own stake marks: one row a phone (null until the device hash is known). */
export const payKey = () => (myDevice() ? `P${myDevice().slice(0, 20)}` : null);
const myName = s => String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || null;

/**
 * What this phone should post for a trip now: [{ key, data }]. A round only this phone has, or one
 * it shared live, always; a round it joined only when the server has no copy, or an older one (the
 * phone that shared it may be out of signal). A round taken off the trip is posted as gone. And
 * this phone's stake marks, when there are any.
 */
export function cupPosts(s, trip, remote = {}, me = payKey()) {
  const out = [];
  const same = (key, data) => remote[key] && stable(remote[key]) === stable(data);
  for (const r of Object.values(s.rounds || {})) {
    if (r.status !== 'done' && r.status !== 'active') continue;
    const key = cupKey(r);
    const mine = !codeOf(r) || !!r.shared?.host;
    if (r.trip?.id !== trip.id) {
      // Taken off the trip: it stops counting on every phone
      if (mine && remote[key] && !remote[key].gone) out.push({ key, data: { gone: true } });
      continue;
    }
    const e = cupEntry(s, r);
    if (!e) {
      if (mine && remote[key] && !remote[key].gone) out.push({ key, data: { gone: true } });
      continue;
    }
    if (same(key, e)) continue;
    if (mine || !remote[key] || progress(e) > progress(remote[key])) out.push({ key, data: e });
  }
  const pays = Array.isArray(s.cupPaid?.[trip.id]) ? s.cupPaid[trip.id] : [];
  if (me && (pays.length || remote[me])) {
    const data = { byName: myName(s), pays };
    if (!same(me, data)) out.push({ key: me, data });
  }
  return out;
}

/** Keep what the server has for each trip (every row it lets this phone read). */
function keep(tripIds, rows) {
  const byTrip = Object.fromEntries(tripIds.map(id => [id, {}]));
  for (const r of rows) if (byTrip[r.tripId] && r.data && typeof r.data === 'object') byTrip[r.tripId][r.key] = r.data;
  const s = getState();
  if (tripIds.every(id => stable(s.cupRemote?.[id] || {}) === stable(byTrip[id]))) return;
  update(st => { st.cupRemote = { ...(st.cupRemote || {}), ...byTrip }; });
}

let running = null;
let again = false;
/** Read every team points trip's matches, then post this phone's own. */
export function refreshCup() {
  if (off) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    const adapter = await getAdapter();
    if (!adapter) return;
    await deviceReady();
    const trips = cupTrips(getState());
    if (!trips.length) return;
    const ids = trips.map(t => t.id);
    try {
      keep(ids, await adapter.fetch(ids));
      for (const trip of trips) {
        const remote = getState().cupRemote?.[trip.id] || {};
        const posts = cupPosts(getState(), trip, remote);
        for (const p of posts) await adapter.publish(trip.id, p.key, p.data);
        if (posts.length) update(st => { st.cupRemote = { ...(st.cupRemote || {}), [trip.id]: { ...(st.cupRemote?.[trip.id] || {}), ...Object.fromEntries(posts.map(p => [p.key, p.data])) } }; });
      }
    } catch (e) { note(e); }
  })().finally(() => {
    running = null;
    if (again) { again = false; refreshCup(); }
  });
  return running;
}

/**
 * Keep the trip's matches fresh while a screen is open: now, when the phone wakes or comes back
 * online, every minute, and soon after a trip round's scores or the stake's marks change here.
 */
export function useCupSync() {
  const s = getState();
  const trips = cupTrips(s);
  const sig = trips.length ? JSON.stringify(trips.map(t => [t.id, tripRounds(s, t.id).map(r => `${r.id}:${r.status}:${Object.keys(r.scores || {}).length}:${stable(r.cup || null)}`), (s.cupPaid?.[t.id] || []).length])) : '';
  useEffect(() => {
    if (!sig || off) return undefined;
    let timer = setTimeout(() => refreshCup(), 500);
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => refreshCup(), 250); };
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    const every = setInterval(() => { if (document.visibilityState === 'visible') refreshCup(); }, 60e3);
    const stored = e => { if (e.key === LOCAL_KEY) soon(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', soon);
    window.addEventListener('storage', stored);
    return () => {
      clearTimeout(timer);
      clearInterval(every);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', soon);
      window.removeEventListener('storage', stored);
    };
  }, [sig]);
}
