// Live shared rounds: keeps local rounds that have `shared.code` in step with the server.
// Local edits are pushed per hole; remote edits are merged in. Failed pushes retry.
import { useSyncExternalStore } from 'react';
import { getState, subscribe, update } from './store.js';
import { localAdapter, supabaseAdapter } from './sync-adapters.js';
import { applyHole, applyMeta, assemble, buildHole, buildMeta, newCode, stable } from './sync-model.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY;

let adapterPromise = null;
/** The configured transport, or null when shared scoring isn't set up. */
export function getAdapter() {
  if (!adapterPromise) {
    if (URL_ && KEY_) adapterPromise = supabaseAdapter(URL_, KEY_);
    else if (import.meta.env.DEV || localStorage.getItem('bb-sync-local') === '1') adapterPromise = Promise.resolve(localAdapter());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
export const syncConfigured = !!(URL_ && KEY_) || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('bb-sync-local') === '1');

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

const live = new Map(); // roundId -> { code, lastMeta, lastHoles: {no: json}, unsub, pending: Set }

async function pushChanges(roundId) {
  const entry = live.get(roundId);
  const round = getState().rounds[roundId];
  if (!entry || !round) return;
  const adapter = await getAdapter();
  if (!adapter) return;
  const tasks = [];
  const meta = buildMeta(round);
  const metaJson = stable(meta);
  if (metaJson !== entry.lastMeta) {
    tasks.push(adapter.upsertMeta(entry.code, meta).then(() => { entry.lastMeta = metaJson; }));
  }
  round.holes.forEach((h, i) => {
    const data = buildHole(round, i);
    const json = stable(data);
    if (json !== (entry.lastHoles[h.no] ?? stable(null))) {
      tasks.push(adapter.upsertHole(entry.code, h.no, data).then(() => { entry.lastHoles[h.no] = json; }));
    }
  });
  if (!tasks.length) return;
  setStatus({ pending: status.pending + tasks.length });
  const results = await Promise.allSettled(tasks);
  const failed = results.filter(r => r.status === 'rejected');
  setStatus({ pending: Math.max(0, status.pending - tasks.length), state: failed.length ? 'offline' : 'live', lastError: failed[0]?.reason?.message || null });
}

function onRemote(roundId, ev) {
  const entry = live.get(roundId);
  if (!entry) return;
  if (ev.type === 'connected') { setStatus({ state: 'live' }); return; }
  if (ev.type === 'deleted') {
    update(s => { const r = s.rounds[roundId]; if (r?.shared) r.shared = { ...r.shared, ended: true }; });
    stop(roundId);
    return;
  }
  if (ev.type === 'meta') {
    const json = stable(ev.data);
    if (json === entry.lastMeta) return;
    entry.lastMeta = json;
    update(s => {
      const r = s.rounds[roundId]; if (!r) return;
      applyMeta(r, ev.data);
      if (r.status === 'done' && s.activeRoundId === roundId) s.activeRoundId = null;
      if (r.status === 'active' && !s.activeRoundId) s.activeRoundId = roundId;
    });
  }
  if (ev.type === 'hole') {
    const json = stable(ev.data);
    if (json === entry.lastHoles[ev.holeNo]) return;
    entry.lastHoles[ev.holeNo] = json;
    update(s => { const r = s.rounds[roundId]; if (r) applyHole(r, ev.holeNo, ev.data); });
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
    await pushChanges(roundId); // anything we changed while offline
  } catch (e) {
    setStatus({ state: 'offline', lastError: e.message });
  }
}

// Rounds that were just created on / fetched from the server — nothing to push or pull
const freshNext = new Set();

async function start(roundId, { fresh = false } = {}) {
  fresh = fresh || freshNext.delete(roundId);
  if (live.has(roundId)) return;
  const round = getState().rounds[roundId];
  if (!round?.shared?.code || round.shared.ended) return;
  // Claim the slot before awaiting so a second call can't subscribe twice
  const entry = { code: round.shared.code, lastMeta: null, lastHoles: {}, unsub: null };
  live.set(roundId, entry);
  const adapter = await getAdapter();
  if (!adapter) { live.delete(roundId); return; }
  if (fresh) {
    // We just created or fetched it: everything local is already on the server
    entry.lastMeta = stable(buildMeta(round));
    round.holes.forEach((h, i) => { entry.lastHoles[h.no] = stable(buildHole(round, i)); });
  }
  setStatus({ state: 'connecting' });
  entry.unsub = adapter.subscribe(entry.code, ev => onRemote(roundId, ev));
  if (!fresh) resync(roundId);
}

function stop(roundId) {
  const e = live.get(roundId);
  e?.unsub?.();
  live.delete(roundId);
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
    if (r.shared?.code && !r.shared.ended && r.status === 'active') start(r.id);
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
