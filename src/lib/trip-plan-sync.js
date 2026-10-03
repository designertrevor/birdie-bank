// The trip plans on the server (`trip_plans`, supabase/2026-10-03-trip-plans.sql): the organizer's
// phone publishes each trip's plan (trip-plan.js), every phone on the trip reads it. Until the SQL
// has run (or with no server at all) nothing is published or read, and every phone settles trips
// pair by pair exactly as before: no errors, nothing to switch on.
// The organizer's phone republishes whenever its plan stops checking out (a round added, a score
// fixed, a payment the plan didn't count), so every phone moves to the new version together.
import { useEffect } from 'react';
import { getState, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { codeOf } from './pair-debts.js';
import { buildPlan, cleanPlan, planState, samePlan } from './trip-plan.js';
import { isOrganizer, tripRounds, tripsOf } from './trips.js';
import { refreshTab } from './tab-sync.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the trip_plans table isn't on the server yet. */
class PlansOffError extends Error {
  constructor() { super('Trip plans aren’t switched on yet'); this.name = 'PlansOffError'; }
}

// --------------------------- transport ---------------------------------------
//   fetch(tripIds) -> [plan]   publish(plan, codes)

function supabasePlans(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new PlansOffError();
    throw error;
  };
  return {
    async fetch(ids) {
      if (!ids.length) return [];
      const r = await db.from('trip_plans').select('trip_id, plan').in('trip_id', ids);
      check(r);
      return (r.data || []).map(x => ({ ...x.plan, tripId: x.trip_id }));
    },
    async publish(plan, codes) {
      check(await db.from('trip_plans').upsert({ trip_id: plan.tripId, codes, plan }));
    },
  };
}

// Dev and testing: localStorage, so two tabs (one with ?profile=b) act as two phones
function localPlans() {
  const KEY = 'bb-trip-plans';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    async fetch(ids) { const all = load(); return ids.map(id => all[id]).filter(Boolean); },
    async publish(plan) { const all = load(); all[plan.tripId] = plan; localStorage.setItem(KEY, JSON.stringify(all)); },
  };
}

let adapterPromise = null;
function getAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? supabasePlans(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(localPlans());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}

// "Off": no server, or no trip_plans table yet. Learned on the first try, for this session
let off = !(supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag()));
const note = e => {
  if (e instanceof PlansOffError) off = true;
  else console.warn('Trip plans:', e?.message || e);
};

/** Whether plans can reach the other phones (so a trip with rounds shared live can be deleted everywhere). */
export const plansOn = () => !off;

/** Trip ids this phone knows, records and stamps alike (a deleted trip's too, to hear about it). */
function tripIds(s) {
  const ids = new Set([...tripsOf(s).keys(), ...Object.keys(s.tripPlans || {})]);
  for (const r of Object.values(s.rounds || {})) if (r?.trip?.id) ids.add(r.trip.id);
  return [...ids];
}

/** Keep a plan on this phone, newer versions only. The first one you see isn't "Updated". */
function keep(plans) {
  const s = getState();
  const next = {};
  for (const raw of plans) {
    const p = cleanPlan(raw);
    if (!p) continue;
    const cur = cleanPlan(s.tripPlans?.[p.tripId]);
    if (cur && cur.version > p.version) continue;
    if (cur && JSON.stringify(cur) === JSON.stringify(p)) continue;
    next[p.tripId] = p;
  }
  if (!Object.keys(next).length) return;
  update(st => {
    st.tripPlans = { ...(st.tripPlans || {}), ...next };
    st.tripPlanSeen = st.tripPlanSeen || {};
    for (const p of Object.values(next)) if (st.tripPlanSeen[p.tripId] == null) st.tripPlanSeen[p.tripId] = p.version;
  });
}

/** Your first name, so friends' phones can say whose phone the plan is waiting on. */
const myName = s => String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || null;

/**
 * On the organizer's phone: publish a trip's plan when there's none yet, or the one out there
 * doesn't check out here any more (or leaves a round out, or "done playing" changed).
 */
async function publishMine(adapter) {
  const s = getState();
  for (const trip of tripsOf(s).values()) {
    if (!isOrganizer(s, trip)) continue;
    const cur = cleanPlan(s.tripPlans?.[trip.id]);
    if (cur?.deleted) continue;
    const ps = planState(s, trip.id);
    const ended = trip.endedAt || null;
    if (cur && ps.status === 'live' && !ps.pending.length && (cur.endedAt || null) === ended) continue;
    const next = buildPlan(s, trip.id, { version: (cur?.version || 0) + 1, endedAt: ended, byName: myName(s) });
    if (!next || (cur && samePlan(cur, next))) continue;
    const codes = [...new Set(tripRounds(s, trip.id).map(codeOf).filter(Boolean))];
    try {
      await adapter.publish(next, codes);
      keep([next]);
    } catch (e) { note(e); if (off) return; }
  }
}

let running = null;
/** Read the plans for every trip this phone knows, then publish your own trips' plans if they're due. */
export function refreshPlans() {
  if (off) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    const adapter = await getAdapter();
    if (!adapter) return;
    const ids = tripIds(getState());
    if (!ids.length) return;
    try {
      // The payment rows first: a plan counts the payments made on its rounds
      await refreshTab();
      keep(await adapter.fetch(ids));
      await publishMine(adapter);
    } catch (e) { note(e); }
  })().finally(() => { running = null; });
  return running;
}

/** The organizer deletes a trip: every phone on it hears so and stops showing it. */
export async function publishDeleted(tripId) {
  if (off) return false;
  const adapter = await getAdapter();
  if (!adapter) return false;
  const s = getState();
  const cur = cleanPlan(s.tripPlans?.[tripId]);
  const plan = { tripId, version: (cur?.version || 0) + 1, deleted: true, at: Date.now() };
  const codes = [...new Set(tripRounds(s, tripId).map(codeOf).filter(Boolean))];
  try {
    await adapter.publish(plan, codes);
    keep([plan]);
    return true;
  } catch (e) { note(e); return false; }
}

/**
 * Keep trip plans fresh while a screen is open: now, when the phone wakes or comes back online,
 * every minute, and soon after this phone's trip rounds or payments change (the organizer's
 * phone republishes then).
 */
export function useTripPlans() {
  const s = getState();
  const ids = tripIds(s);
  const sig = ids.length ? JSON.stringify([ids, ids.map(id => tripRounds(s, id).map(r => `${r.id}:${r.status}:${r.finishedAt || 0}`)), (s.settlements || []).length, Object.keys(s.tabRows || {}).length, ids.map(id => s.trips?.[id]?.endedAt || 0)]) : '';
  useEffect(() => {
    if (!sig || off) return undefined;
    let timer = setTimeout(() => refreshPlans(), 400);
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => refreshPlans(), 250); };
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    const every = setInterval(() => { if (document.visibilityState === 'visible') refreshPlans(); }, 60e3);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', soon);
    return () => {
      clearTimeout(timer);
      clearInterval(every);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', soon);
    };
  }, [sig]);
}
