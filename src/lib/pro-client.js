// Pro for life, read from your account after sign-in (entitlements, supabase/2026-10-09-lifetime-pro.sql).
// Quiet when it can't be read: no Supabase keys, signed out, offline, or the SQL hasn't run yet, and
// then nobody is Pro, the same as before. This phone keeps a copy for the account it was read for
// (lifetime-pro.js savedFor), so a lifetime holder stays Pro with no signal.
// Loaded after the first paint (App.jsx), never on the first screen.
import { useSyncExternalStore } from 'react';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { NO_PRO, readEntitlement, savedFor, toSaved } from './lifetime-pro.js';

const KEY = 'bb-pro';
const CLOUD_META = 'bb-cloud'; // cloud.js keeps the signed-in account's id here (meta.uid)

const readJson = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const save = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

// Local dev only: `?lifetime=on` shows this phone as Pro for life for this page load, so the plan
// screens can be checked before the SQL has run. Never in a production or preview build.
const DEV_LIFETIME = !!(import.meta.env?.DEV && typeof location !== 'undefined' && /[?&]lifetime=on(?:&|$)/.test(location.search));

// Until the account is known, the copy saved for the account this phone was last signed in as
let snap = DEV_LIFETIME ? { lifetime: true, since: null } : savedFor(readJson(KEY), readJson(CLOUD_META)?.uid || null);
const listeners = new Set();
const set = next => { snap = next; listeners.forEach(l => l()); };
const sub = l => { listeners.add(l); return () => listeners.delete(l); };

/** { lifetime, since } for the account on this phone. */
export function proNow() { return snap; }
/** True when the account on this phone has Pro for life. */
export function hasLifetimePro() { return snap.lifetime === true; }
/** The same in React. */
export function useLifetimePro() { return useSyncExternalStore(sub, () => snap, () => snap); }

/** Read the account's row. Leaves things as they are when it can't (offline, no table yet). */
export async function refreshPro(uid) {
  if (!supabaseConfigured || !uid) return;
  try {
    const db = await getSupabase();
    if (!db) return;
    const { data, error } = await db.from('entitlements').select('lifetime, lifetime_since').eq('user_id', uid).maybeSingle();
    if (error) return;
    const ent = readEntitlement(data);
    save(toSaved(uid, ent));
    set(ent);
  } catch { /* quiet: the copy on this phone stands */ }
}

let booted = false;
/** Call once at launch: read Pro for whichever account signs in, and forget it on sign-out. */
export function bootPro() {
  if (booted || !supabaseConfigured || DEV_LIFETIME) return;
  booted = true;
  let uid = null;
  import('./cloud.js').then(c => {
    const check = () => {
      const id = c.accountNow().user?.id || null;
      if (id && id !== uid) {
        const mine = savedFor(readJson(KEY), id);
        if (mine.lifetime !== snap.lifetime) set(mine);
        refreshPro(id);
      }
      if (!id && uid) { save(null); set(NO_PRO); }
      uid = id;
    };
    c.onAccount(check);
    check();
  }).catch(() => {});
}
