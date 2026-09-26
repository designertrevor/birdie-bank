// Accounts and cloud data. Offline first: the phone's copy is always the one the app uses,
// and it's saved on the phone before anything is sent. Changes go up when there's signal,
// changes from your other devices come down, and a score is never dropped: if both sides
// changed the same thing, the newer edit wins and the other side still has its copy until then.
import { useSyncExternalStore } from 'react';
import { getState, replaceState, resetAll, subscribe, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { applyDoc, hashAll, hashDoc, outgoing, remapId, resolve, toDocs } from './cloud-model.js';

export const accountsEnabled = supabaseConfigured;
const META = 'bb-cloud';

// --------------------------- status (for UI) ------------------------------

let snap = { user: null, state: 'signed-out', pending: 0, lastSynced: null, error: null };
const listeners = new Set();
function setStatus(patch) { snap = { ...snap, ...patch }; listeners.forEach(l => l()); }
const sub = l => { listeners.add(l); return () => listeners.delete(l); };
/** { user, state: 'signed-out'|'syncing'|'synced'|'offline'|'error', pending, lastSynced, error } */
export function useAccount() { return useSyncExternalStore(sub, () => snap, () => snap); }

// --------------------------- bookkeeping ----------------------------------
// meta: { uid, cursor, shadow: {key: hash the server has}, changedAt: {key: ms} }

function loadMeta() { try { return JSON.parse(localStorage.getItem(META)) || null; } catch { return null; } }
function saveMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch { /* storage full */ } }
let meta = loadMeta();

// Note when each document last changed on this phone, so conflicts can pick the newer edit
let seen = hashAll(toDocs(getState()));
let applying = false; // true while we write the account's data into the store
function noteLocalChanges() {
  if (applying) return;
  const now = hashAll(toDocs(getState()));
  if (meta) {
    const t = Date.now();
    for (const k of new Set([...Object.keys(now), ...Object.keys(seen)])) {
      if (now[k] !== seen[k]) meta.changedAt[k] = t;
    }
    saveMeta(meta);
    setStatus({ pending: outgoing(toDocs(getState()), meta.shadow).length });
  }
  seen = now;
}

// --------------------------- sync ------------------------------------------

async function pullAll(db, since) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from('user_docs').select('kind, id, data, deleted, client_updated_at, updated_at').order('updated_at').range(from, from + 999);
    // Overlap by a minute so a row saved while we were reading isn't skipped
    if (since) q = q.gt('updated_at', new Date(Date.parse(since) - 60000).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function syncOnce() {
  const db = await getSupabase();
  if (!db) return;
  const { data: { session } } = await db.auth.getSession();
  const user = session?.user;
  if (!user) { setStatus({ user: null, state: 'signed-out', pending: 0 }); return; }
  setStatus({ user: { id: user.id, email: user.email, name: user.user_metadata?.full_name || null }, state: 'syncing', error: null });

  const firstTime = meta?.uid !== user.id;
  if (firstTime) meta = { uid: user.id, cursor: null, shadow: {}, changedAt: {} };

  // 1. Bring down what changed elsewhere
  const rows = await pullAll(db, meta.cursor);
  const remote = Object.fromEntries(rows.map(r => [`${r.kind}:${r.id}`, r]));

  // First sign-in on a phone that has its own "me": become the account's me everywhere
  const remoteProfile = remote['profile:me'];
  if (firstTime && remoteProfile?.data?.me && getState().me && remoteProfile.data.me !== getState().me) {
    const local = getState();
    applying = true;
    try { replaceState(remapId(local, local.me, remoteProfile.data.me)); } finally { applying = false; }
  }

  const localDocs = toDocs(getState());
  const take = [];
  for (const [key, r] of Object.entries(remote)) {
    const remoteHash = r.deleted ? 'null' : hashDoc(r.data);
    const choice = resolve({
      local: localDocs[key] ? hashDoc(localDocs[key].data) : 'null',
      shadow: meta.shadow[key],
      remote: remoteHash,
      localChangedAt: meta.changedAt[key] || 0,
      remoteChangedAt: firstTime ? Infinity : Number(r.client_updated_at) || 0,
    });
    // A phone's first sync keeps its own rounds that the account doesn't have yet, and
    // otherwise takes the account's copy
    if (choice === 'take') take.push(r);
    if (choice !== 'keep') meta.shadow[key] = remoteHash;
  }
  if (take.length) {
    applying = true;
    try {
      update(s => {
        for (const r of take) applyDoc(s, r.kind, r.id, r.deleted ? null : r.data);
        if (!s.activeRoundId) {
          const live = Object.values(s.rounds).find(x => x.status === 'active');
          if (live) s.activeRoundId = live.id;
        }
      });
    } finally { applying = false; }
    seen = hashAll(toDocs(getState())); // what we just applied isn't a local edit
  }
  if (rows.length) meta.cursor = rows[rows.length - 1].updated_at;
  saveMeta(meta);

  // 2. Send up what changed here (nothing until setup is done, so a half-set-up phone can't
  // overwrite the account)
  if (!getState().onboarded) { setStatus({ state: 'synced', pending: 0, lastSynced: Date.now() }); return; }
  const out = outgoing(toDocs(getState()), meta.shadow);
  for (let i = 0; i < out.length; i += 200) {
    const chunk = out.slice(i, i + 200);
    const { error } = await db.from('user_docs').upsert(chunk.map(o => ({
      user_id: user.id, kind: o.kind, id: o.id, data: o.data, deleted: o.deleted,
      client_updated_at: meta.changedAt[o.key] || Date.now(),
    })));
    if (error) throw error;
    for (const o of chunk) { meta.shadow[o.key] = o.deleted ? 'null' : hashDoc(o.data); delete meta.changedAt[o.key]; }
    saveMeta(meta);
  }
  setStatus({ state: 'synced', pending: outgoing(toDocs(getState()), meta.shadow).length, lastSynced: Date.now() });
}

let running = null;
let again = false;
/** Sync now (or right after the current sync finishes). Never throws. */
export function syncNow() {
  if (!accountsEnabled) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      try { await syncOnce(); }
      catch (e) {
        const offline = !navigator.onLine || /fetch|network/i.test(e?.message || '');
        setStatus({ state: offline ? 'offline' : 'error', error: e?.message || String(e) });
        break;
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

// --------------------------- sign in / out ---------------------------------

const redirectTo = () => `${location.origin}/`;

export async function signInWithGoogle() {
  const db = await getSupabase();
  const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

/** Emails a sign-in link that also shows a 6-digit code (for installed apps, where links open in the browser). */
export async function sendEmailCode(email) {
  const db = await getSupabase();
  const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email, token) {
  const db = await getSupabase();
  const { error } = await db.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  await syncNow();
}

/** Changes that haven't reached the server yet. */
export function unsyncedCount() { return meta ? outgoing(toDocs(getState()), meta.shadow).length : 0; }

/** Sign out and give this phone a fresh start (everything stays in the account). */
export async function signOut() {
  const db = await getSupabase();
  await db.auth.signOut({ scope: 'local' });
  meta = null;
  try { localStorage.removeItem(META); } catch { /* ignore */ }
  resetAll();
  seen = hashAll(toDocs(getState()));
  setStatus({ user: null, state: 'signed-out', pending: 0, lastSynced: null });
}

// --------------------------- wiring ---------------------------------------

let timer = null;
let booted = false;
/** Call once on app start. */
export async function bootCloud() {
  if (booted || !accountsEnabled) return;
  booted = true;
  subscribe(() => {
    if (applying) return;
    noteLocalChanges();
    if (!meta) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, 1500);
  });
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (meta && document.visibilityState === 'visible') syncNow(); }, 60000);
  const db = await getSupabase();
  db.auth.onAuthStateChange(event => {
    if (event !== 'SIGNED_IN') return;
    // Tidy the address bar after coming back from Google or an email link
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname);
    setTimeout(syncNow, 0); // outside the auth callback, per Supabase docs
  });
  syncNow();
}
