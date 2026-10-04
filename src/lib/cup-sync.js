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
import { CUP_FORMAT, cupPosts } from './cup.js';
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

/** This phone's key for its own stake marks: one row a phone (null until the device hash is known). */
export const payKey = () => (myDevice() ? `P${myDevice().slice(0, 20)}` : null);

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
        const posts = cupPosts(getState(), trip, remote, payKey());
        // One row the server turns down (a round whose live sharing has stopped, say) never holds up the rest
        const sent = [];
        for (const p of posts) {
          try {
            await adapter.publish(trip.id, p.key, p.data);
            sent.push(p);
          } catch (e) {
            if (e instanceof CupOffError) throw e;
            note(e);
          }
        }
        if (sent.length) update(st => { st.cupRemote = { ...(st.cupRemote || {}), [trip.id]: { ...(st.cupRemote?.[trip.id] || {}), ...Object.fromEntries(sent.map(p => [p.key, p.data])) } }; });
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
