// Live shared rounds: keeps local rounds that have `shared.code` in step with the server.
// Local edits are pushed per hole; remote edits are merged in. Failed pushes retry, and
// edits made offline are kept on the phone until they reach the server.
import { useSyncExternalStore } from 'react';
import { STORE_KEY, getState, subscribe, update } from './store.js';
import { localAdapter, supabaseAdapter } from './sync-adapters.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { applyHole, applyMeta, assemble, buildHole, buildMeta, merge3, newCode, stable } from './sync-model.js';


let adapterPromise = null;
/** The configured transport, or null when shared scoring isn't set up. */
export function getAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(supabaseAdapter);
    else if (import.meta.env.DEV || localStorage.getItem('bb-sync-local') === '1') adapterPromise = Promise.resolve(localAdapter());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
export const syncConfigured = supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('bb-sync-local') === '1');

// --------------------------- status (for UI) ------------------------------

const status = { state: 'idle', pending: 0, lastError: null }; // idle | connecting | live | offline
let statusSnap = { ...status };
const statusListeners = new Set();
function setStatus(patch) {
  Object.assign(status, patch);
  statusSnap = { ...status };
  statusListeners.forEach(l => l());
}
const subStatus = l => { statusListeners.add(l); return () => statusListeners.delete(l); };
export function useSyncStatus() {
  return useSyncExternalStore(subStatus, () => statusSnap, () => statusSnap);
}

// --------------------------- engine ---------------------------------------
// Each live round remembers what the server last had for its meta and each hole ("base").
// The base is saved on the phone, so edits made with no signal survive the app being
// closed: on the next sync they're merged with anything that changed on other phones
// (see merge3) and sent up, instead of being replaced by the server's older copy.

const live = new Map(); // roundId -> { code, lastMeta, lastHoles: {no: json}, unsub, pushing, again, connected }

const baseKey = id => `bb-live-base:${STORE_KEY}:${id}`;
function loadBase(id, code) {
  try {
    const b = JSON.parse(localStorage.getItem(baseKey(id)));
    return b && b.code === code ? b : null;
  } catch { return null; }
}
function saveBase(id, entry) {
  try { localStorage.setItem(baseKey(id), JSON.stringify({ code: entry.code, meta: entry.lastMeta, holes: entry.lastHoles })); } catch { /* storage full */ }
}
function dropBase(id) {
  try { localStorage.removeItem(baseKey(id)); } catch { /* ignore */ }
}
const parse = json => (json == null ? undefined : JSON.parse(json));

/** Send one round's unsent changes: meta first, then holes. Resolves true when all went through. */
async function pushOnce(roundId, entry) {
  const round = getState().rounds[roundId];
  const adapter = await getAdapter();
  if (!round || !adapter || live.get(roundId) !== entry) return true;
  const meta = buildMeta(round);
  const metaJson = stable(meta);
  const holes = [];
  round.holes.forEach((h, i) => {
    const data = buildHole(round, i);
    const json = stable(data);
    if (json !== (entry.lastHoles[h.no] ?? stable(null))) holes.push([h.no, data, json]);
  });
  const metaDirty = metaJson !== entry.lastMeta;
  if (!metaDirty && !holes.length) return true;
  let failed = null;
  // Meta goes first so a hole never arrives for a player the other phones don't know yet
  if (metaDirty) {
    try { await adapter.upsertMeta(entry.code, meta); entry.lastMeta = metaJson; } catch (e) { failed = e; }
  }
  if (!failed) {
    const results = await Promise.allSettled(holes.map(([no, data, json]) => adapter.upsertHole(entry.code, no, data).then(() => { entry.lastHoles[no] = json; })));
    failed = results.find(r => r.status === 'rejected')?.reason || null;
  }
  if (live.get(roundId) === entry) saveBase(roundId, entry);
  setStatus({ state: failed ? 'offline' : 'live', lastError: failed?.message || null });
  return !failed;
}

/**
 * Push local edits. One push per round at a time, so two quick edits to the same hole can't
 * reach the server out of order; edits made while a push is running go in the next one.
 */
async function pushChanges(roundId) {
  const entry = live.get(roundId);
  if (!entry) return false;
  if (entry.pushing) { entry.again = true; return false; }
  entry.pushing = true;
  setStatus({ pending: status.pending + 1 });
  let ok = false;
  try {
    do {
      entry.again = false;
      ok = await pushOnce(roundId, entry);
    } while (ok && entry.again);
    return ok;
  } catch (e) {
    setStatus({ state: 'offline', lastError: e?.message || null });
    return false;
  } finally {
    entry.pushing = false;
    setStatus({ pending: Math.max(0, status.pending - 1) });
  }
}

function onRemote(roundId, ev) {
  const entry = live.get(roundId);
  if (!entry) return;
  if (ev.type === 'connected') {
    // Realtime doesn't replay what we missed while disconnected, so catch up on a reconnect
    if (entry.connected) resync(roundId);
    else setStatus({ state: 'live' });
    entry.connected = true;
    return;
  }
  if (ev.type === 'deleted') {
    update(s => { const r = s.rounds[roundId]; if (r?.shared) r.shared = { ...r.shared, ended: true }; });
    stop(roundId);
    return;
  }
  if (ev.type === 'meta') {
    const json = stable(ev.data);
    if (json === entry.lastMeta) return;
    const base = parse(entry.lastMeta);
    entry.lastMeta = json;
    saveBase(roundId, entry);
    const round = getState().rounds[roundId];
    if (!round) return;
    const local = buildMeta(round);
    const merged = merge3(base, local, ev.data, 1);
    if (stable(merged) === stable(local)) return;
    update(s => {
      const r = s.rounds[roundId]; if (!r) return;
      applyMeta(r, merged);
      if (r.status === 'done' && s.activeRoundId === roundId) s.activeRoundId = null;
      if (r.status === 'active' && !s.activeRoundId) s.activeRoundId = roundId;
    });
  }
  if (ev.type === 'hole') {
    const json = stable(ev.data);
    if (json === entry.lastHoles[ev.holeNo]) return;
    const base = parse(entry.lastHoles[ev.holeNo]);
    entry.lastHoles[ev.holeNo] = json;
    saveBase(roundId, entry);
    const round = getState().rounds[roundId];
    const idx = round ? round.holes.findIndex(h => h.no === ev.holeNo) : -1;
    if (idx < 0) return;
    // Scores this phone hasn't sent yet are kept; the push that follows sends the merged hole
    const local = buildHole(round, idx);
    const merged = merge3(base, local, ev.data, 2);
    if (stable(merged) === stable(local)) return;
    update(s => { const r = s.rounds[roundId]; if (r) applyHole(r, ev.holeNo, merged); });
  }
}

/** Pull the full shared round and merge it (after reconnecting or coming back online). */
async function resync(roundId) {
  const entry = live.get(roundId);
  const adapter = await getAdapter();
  if (!entry || !adapter) return;
  try {
    const remote = await adapter.fetch(entry.code);
    if (!remote) { onRemote(roundId, { type: 'deleted' }); return; }
    onRemote(roundId, { type: 'meta', data: remote.meta });
    for (const [no, data] of Object.entries(remote.holes)) onRemote(roundId, { type: 'hole', holeNo: Number(no), data });
    setStatus({ state: 'live' });
    const sent = await pushChanges(roundId); // anything we changed while offline
    // A finished round picked back up at launch only needed its last edits sent
    const r = getState().rounds[roundId];
    if (sent && r?.status === 'done' && entry.finishing) stop(roundId);
  } catch (e) {
    setStatus({ state: 'offline', lastError: e.message });
  }
}

// Rounds that were just created on / fetched from the server: nothing to push or pull
const freshNext = new Set();

async function start(roundId, { fresh = false, finishing = false } = {}) {
  fresh = fresh || freshNext.delete(roundId);
  if (live.has(roundId)) return;
  const round = getState().rounds[roundId];
  if (!round?.shared?.code || round.shared.ended) return;
  // Claim the slot before awaiting so a second call can't subscribe twice
  const saved = fresh ? null : loadBase(roundId, round.shared.code);
  const entry = { code: round.shared.code, lastMeta: saved?.meta ?? null, lastHoles: { ...saved?.holes }, unsub: null, pushing: false, again: false, connected: false, finishing };
  live.set(roundId, entry);
  const adapter = await getAdapter();
  if (!adapter) { live.delete(roundId); return; }
  if (fresh) {
    // We just created or fetched it: everything local is already on the server
    entry.lastMeta = stable(buildMeta(round));
    round.holes.forEach((h, i) => { entry.lastHoles[h.no] = stable(buildHole(round, i)); });
    saveBase(roundId, entry);
  }
  setStatus({ state: 'connecting' });
  entry.unsub = adapter.subscribe(entry.code, ev => onRemote(roundId, ev));
  if (!fresh) resync(roundId);
}

function stop(roundId) {
  const e = live.get(roundId);
  e?.unsub?.();
  live.delete(roundId);
  dropBase(roundId);
  if (!live.size) setStatus({ state: 'idle' });
}

// Push local edits on every store change; start/stop as rounds come and go
let scheduled = false;
subscribe(() => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const s = getState();
    for (const id of live.keys()) {
      const r = s.rounds[id];
      if (!r || !r.shared || r.shared.ended) { stop(id); continue; }
      pushChanges(id);
    }
    for (const r of Object.values(s.rounds)) if (r.shared?.code && !r.shared.ended && r.status === 'active' && !live.has(r.id)) start(r.id);
  });
});

// Retry and catch up when the phone comes back
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => live.forEach((_, id) => resync(id)));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') live.forEach((_, id) => resync(id)); });
  setInterval(() => { if (status.state === 'offline') live.forEach((_, id) => resync(id)); }, 15000);
}

/** Start syncing every shared round that's still in play (call once on boot). */
export function bootSync() {
  for (const r of Object.values(getState().rounds)) {
    if (!r.shared?.code || r.shared.ended) continue;
    if (r.status === 'active') start(r.id);
    // Finished while offline and closed before it synced: send what's left
    else if (loadBase(r.id, r.shared.code)) start(r.id, { finishing: true });
  }
}

// --------------------------- actions --------------------------------------

export async function shareRound(roundId) {
  const adapter = await getAdapter();
  if (!adapter) throw new Error('Shared scoring isn’t set up yet');
  const round = getState().rounds[roundId];
  const code = newCode();
  const holes = {};
  round.holes.forEach((h, i) => { const d = buildHole(round, i); if (d) holes[h.no] = d; });
  await adapter.create(code, buildMeta(round), holes);
  freshNext.add(roundId);
  update(s => { s.rounds[roundId].shared = { code, host: true, since: Date.now() }; });
  await start(roundId, { fresh: true });
  return code;
}

export async function fetchShared(code) {
  const adapter = await getAdapter();
  if (!adapter) throw new Error('Shared scoring isn’t set up yet');
  return adapter.fetch(code);
}

/** Join a shared round as `localMe` (a player id in that round, or null to watch). */
export async function joinShared(code, remote, localMe) {
  const round = assemble(remote.meta, remote.holes);
  round.shared = { code, host: false, since: Date.now() };
  round.localMe = localMe;
  freshNext.add(round.id);
  update(s => {
    s.rounds[round.id] = round;
    if (round.status === 'active') s.activeRoundId = round.id;
  });
  await start(round.id, { fresh: true });
  return round.id;
}

export async function stopSharing(roundId) {
  const round = getState().rounds[roundId];
  const adapter = await getAdapter();
  stop(roundId);
  if (round?.shared?.host && adapter) { try { await adapter.remove(round.shared.code); } catch { /* already gone */ } }
  update(s => { const r = s.rounds[roundId]; if (r) r.shared = null; });
}

export function shareLink(code) {
  return `${location.origin}/?join=${code}`;
}
