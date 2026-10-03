// Live shared rounds: keeps local rounds that have `shared.code` in step with the server.
// Local edits are pushed per hole; remote edits are merged in. Failed pushes retry, and
// edits made offline are kept on the phone until they reach the server.
import { useSyncExternalStore } from 'react';
import { STORE_KEY, getState, subscribe, update } from './store.js';
import { localAdapter, supabaseAdapter } from './sync-adapters.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { leaveRound } from './rounds.js';
import { applyHole, applyMeta, assemble, buildHole, buildMeta, buildRequest, firstOpenIdx, followKeeper, isRequestNo, newCode, newRequestNo, readRequest, stable } from './sync-model.js';
import { payFields } from './pay.js';
import { canEdit, holeToKeep, hostKeeper, isKeeper, keeperMe, keeperOf, metaToKeep, metaToSend, registerDevice, seatTaken } from './keeper.js';
import { deviceReady, myDevice } from './device.js';
import { claimSeat, mergeClaims } from './people-links.js';
import { applyBetAsk, betAskProblem, buildBetAsk, keepAsks, readBetAsk } from './bet-asks.js';

/** Whether this phone may change a shared round (see keeper.js), and who it is in it. */
function editorOf(round) {
  const me = keeperMe(round, getState());
  return { me, editor: canEdit(round, me, !!round?.shared?.host) };
}


let adapterPromise = null;
/** The configured transport, or null when shared scoring isn't set up. */
export function getAdapter() {
  if (!adapterPromise) {
    // This phone's device hash is ready before anything is sent, so the server's lock knows it (device.js)
    if (supabaseConfigured) adapterPromise = deviceReady().then(getSupabase).then(supabaseAdapter);
    else if (import.meta.env.DEV || localStorage.getItem('bb-sync-local') === '1') adapterPromise = deviceReady().then(() => localAdapter(myDevice));
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
  // Only the phone keeping score sends changes to the game. Any other phone sends only what it's
  // allowed to (asking for the card, taking its seat): see metaToSend
  const { me, editor } = editorOf(round);
  const meta = metaToSend(parse(entry.lastMeta), buildMeta(round), { editor, me });
  const metaJson = meta ? stable(meta) : entry.lastMeta;
  // Holes go up from any phone whose copy differs from the server's. On a phone that isn't keeping
  // score that can only be holes it saved while it had the card and couldn't send yet (no signal,
  // then it handed off): incoming holes replace everything else (see holeToKeep), so it has no other
  // edits to send. Held back, those scores would never reach the other phones.
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
    // A phone that isn't keeping score keeps only what it may change (see metaToKeep)
    const merged = metaToKeep(base, local, ev.data, editorOf(round));
    if (stable(merged) === stable(local)) return;
    update(s => {
      const r = s.rounds[roundId]; if (!r) return;
      const code = r.shareCode;
      applyMeta(r, merged);
      // An older app's meta has no shareCode; this phone keeps its own
      if (code && !r.shareCode) r.shareCode = code;
      // Side bet changes this phone asked for that the round now shows are done (see bet-asks.js)
      if (r.betAsks) { const kept = keepAsks(r); if (kept.length) r.betAsks = kept; else delete r.betAsks; }
      if (r.status === 'done') leaveRound(s, roundId);
      if (r.status === 'active' && !s.activeRoundId) s.activeRoundId = roundId;
    });
    // This phone may have just been handed the card, with side bet asks still waiting on it
    applyBetAsks(roundId);
  }
  if (ev.type === 'hole') {
    // Seat requests ride under negative hole numbers (see sync-model.js)
    if (isRequestNo(ev.holeNo)) { noteRequest(roundId, ev.holeNo, ev.data); return; }
    const json = stable(ev.data);
    if (json === entry.lastHoles[ev.holeNo]) return;
    const base = parse(entry.lastHoles[ev.holeNo]);
    entry.lastHoles[ev.holeNo] = json;
    saveBase(roundId, entry);
    const round = getState().rounds[roundId];
    const idx = round ? round.holes.findIndex(h => h.no === ev.holeNo) : -1;
    if (idx < 0) return;
    // Scores this phone hasn't sent yet are kept; the push that follows sends the merged hole.
    // On a phone that isn't keeping score the keeper's copy wins a clash (see holeToKeep)
    const local = buildHole(round, idx);
    const merged = holeToKeep(base, local, ev.data, editorOf(round).editor);
    if (stable(merged) === stable(local)) return;
    const { editor } = editorOf(round);
    update(s => {
      const r = s.rounds[roundId]; if (!r) return;
      const wasAt = r.current, wasOpen = firstOpenIdx(r);
      applyHole(r, ev.holeNo, merged);
      // A phone that's only watching moves on with the keeper (see followKeeper)
      if (!editor) followKeeper(r, wasAt, wasOpen);
    });
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

// Rounds this phone has put its device on this session: once each, so a server that won't take it
// (say, an older copy of the lock) can't start a back-and-forth
const registered = new Set();

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
      // A guest who joined before making a profile claims their seat once they have one
      if (r.localMe && s.me && claimSeat(r, r.localMe, s.me)) {
        update(d => { const x = d.rounds[id]; const c = x && claimSeat(x, x.localMe, d.me); if (c) x.claims = c; });
        continue; // the store change runs this again and pushes it
      }
      // Put this phone on the round for the server's keeper lock (a round shared before it, or a seat
      // taken on an older copy of the app)
      const dev = myDevice();
      const reg = dev && !registered.has(id) && registerDevice(r, keeperMe(r, s), dev, !!r.shared.host);
      if (dev) registered.add(id);
      if (reg) { update(d => { if (d.rounds[id]) Object.assign(d.rounds[id], reg); }); continue; }
      pushChanges(id);
    }
    // A finished round being fixed goes live again so the fixes reach the other phones
    for (const r of Object.values(s.rounds)) if (r.shared?.code && !r.shared.ended && (r.status === 'active' || r.editing) && !live.has(r.id)) start(r.id);
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
  catchUpClaims();
}

/** Finished shared rounds this recent pick up seats claimed after they ended. */
const CLAIM_DAYS = 14;

/**
 * Someone can join from the link after the round is over, when this phone isn't listening any
 * more. Once per launch, look up the claims on recently finished shared rounds (read only, and
 * quietly nothing with no signal) so this phone links its copy of that friend to them too.
 */
async function catchUpClaims() {
  const since = Date.now() - CLAIM_DAYS * 864e5;
  const rounds = Object.values(getState().rounds).filter(r => r.status === 'done' && r.shared?.code && !r.shared.ended && !live.has(r.id) && (r.finishedAt || 0) >= since);
  if (!rounds.length) return;
  const adapter = await getAdapter();
  if (!adapter) return;
  for (const r of rounds) {
    try {
      const remote = await adapter.fetch(r.shared.code);
      const theirs = remote?.meta?.claims;
      if (!theirs) continue;
      update(s => {
        const x = s.rounds[r.id];
        if (!x) return;
        const claims = mergeClaims(x.claims, theirs);
        if (stable(claims) !== stable(x.claims)) x.claims = claims;
      });
    } catch { /* no signal: next launch */ }
  }
}

// --------------------------- actions --------------------------------------

export async function shareRound(roundId) {
  const adapter = await getAdapter();
  if (!adapter) throw new Error('Shared scoring isn’t set up yet');
  const code = newCode();
  // Who's inviting, for the invite card ("Trevor invited you")
  update(s => {
    const r = s.rounds[roundId]; const me = s.players[s.me];
    if (!r) return;
    if (me?.name) r.hostName = me.name.split(' ')[0];
    // This phone keeps score to start with, and the organizer's seat (if they're playing) is on the app
    if (!keeperOf(r)) Object.assign(r, hostKeeper());
    Object.assign(r, seatTaken(r, s.me));
    // This phone is the host phone, and the organizer's seat if they're playing (keeper-lock.js)
    const dev = myDevice();
    if (dev) {
      r.hostDev = dev;
      if (r.players.some(p => p.id === s.me)) r.devs = { ...r.devs, [s.me]: dev };
    }
  });
  const round = getState().rounds[roundId];
  const holes = {};
  round.holes.forEach((h, i) => { const d = buildHole(round, i); if (d) holes[h.no] = d; });
  await adapter.create(code, buildMeta(round), holes);
  freshNext.add(roundId);
  // shareCode stays after sharing stops, so the round's payments on the shared Tab outlive the live round
  update(s => { s.rounds[roundId].shared = { code, host: true, since: Date.now() }; s.rounds[roundId].shareCode = code; });
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
  round.shareCode = code;
  round.localMe = localMe;
  freshNext.add(round.id);
  update(s => {
    s.rounds[round.id] = round;
    if (round.status === 'active') s.activeRoundId = round.id;
  });
  await start(round.id, { fresh: true });
  // Put your payment app on your seat (if the round doesn't have one yet), so the others can pay you
  update(s => {
    const r = s.rounds[round.id];
    const seat = r?.players.find(p => p.id === localMe);
    const mine = payFields(s.players[s.me]);
    if (seat && mine.payHandle && !seat.payHandle) Object.assign(seat, mine);
    // Your seat is on the app now, so the scorekeeper can hand you the card
    if (seat && r.status === 'active') Object.assign(r, seatTaken(r, localMe));
    // And the server knows this phone is that seat, so it can keep score or fix it later (keeper-lock.js)
    if (seat && myDevice()) r.devs = { ...r.devs, [localMe]: myDevice() };
    // The seat is you: every phone in the round links its copy of this player to you (people-links.js).
    // A finished round counts too while its link still works. A guest with no profile yet claims later
    const claims = seat && claimSeat(r, localMe, s.me);
    if (claims) r.claims = claims;
  });
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

// --------------------------- Seat requests ---------------------------------
// Someone who opened the link but isn't on the list asks for a seat; the scorekeeper's phone
// shows it and answers. Kept in memory on the scorekeeper's phone: a reconnect or reopen
// fetches the round again, which brings back any request still waiting.

const requests = new Map(); // roundId -> Map(no -> { no, name, at })
let reqVersion = 0;
const reqListeners = new Set();
function reqChanged() { reqVersion++; reqListeners.forEach(l => l()); }
const subReq = l => { reqListeners.add(l); return () => reqListeners.delete(l); };

function noteRequest(roundId, no, data) {
  // A side bet change from another phone rides the same way (see bet-asks.js)
  const ask = readBetAsk(data);
  if (ask) { noteBetAsk(roundId, no, ask); return; }
  // ...and one taken back is gone from the slot
  if (data == null) betAsks.get(roundId)?.delete(no);
  const r = readRequest(data);
  const list = requests.get(roundId) || new Map();
  const had = list.has(no);
  if (r?.status === 'waiting') list.set(no, { no, name: r.name, at: r.at });
  else list.delete(no);
  requests.set(roundId, list);
  if (had !== list.has(no) || r?.status === 'waiting') reqChanged();
}

/**
 * Seat requests waiting on this round's scorekeeper, oldest first: [{ no, name, at }]. They show on
 * the phone keeping score (the host phone in a round with no keeper yet).
 */
export function useSeatRequests(roundId) {
  useSyncExternalStore(subReq, () => reqVersion, () => reqVersion);
  const round = getState().rounds[roundId];
  if (!round?.shared || round.shared.ended) return [];
  const host = !!round.shared.host;
  const keeps = keeperOf(round) ? isKeeper(round, keeperMe(round, getState()), host) : host;
  if (!keeps) return [];
  return [...(requests.get(roundId)?.values() || [])].sort((a, b) => a.at - b.at);
}

/**
 * Ask for a seat in a shared round. Returns the request's slot number to watch.
 * Throws when it can't be sent, so the joiner can be told to ask the scorekeeper instead.
 */
export async function requestSeat(code, name) {
  const adapter = await getAdapter();
  const data = buildRequest(name);
  if (!adapter || !data) throw new Error('Can’t send a request');
  const no = newRequestNo();
  await adapter.upsertHole(code, no, data);
  return no;
}

/** Take back a seat request (the joiner changed their mind). Best effort. */
export async function cancelSeatRequest(code, no) {
  const adapter = await getAdapter();
  try { await adapter?.upsertHole(code, no, null); } catch { /* it'll just go unanswered */ }
}

/**
 * Watch a seat request for an answer. `cb` gets the request ({ status, playerId, ... }), or
 * { status: 'gone' } when the round stopped being shared. Listens live and checks every few
 * seconds too, in case the live connection drops. Returns a function that stops watching.
 */
export function watchSeatRequest(code, no, cb) {
  let stopped = false, unsub = null, last = null;
  const tell = r => { const j = stable(r); if (!stopped && j !== last) { last = j; cb(r); } };
  const check = async () => {
    try {
      const adapter = await getAdapter();
      const remote = await adapter?.fetch(code);
      if (stopped) return;
      if (!remote) tell({ status: 'gone' });
      else { const r = readRequest(remote.holes?.[no]); if (r) tell(r); }
    } catch { /* no signal: try again on the next tick */ }
  };
  getAdapter().then(adapter => {
    if (stopped || !adapter) return;
    unsub = adapter.subscribe(code, ev => {
      if (ev.type === 'deleted') tell({ status: 'gone' });
      if (ev.type === 'hole' && Number(ev.holeNo) === no) { const r = readRequest(ev.data); if (r) tell(r); }
      if (ev.type === 'connected') check();
    });
  });
  check();
  const timer = setInterval(check, 6000);
  return () => { stopped = true; clearInterval(timer); unsub?.(); };
}

/**
 * Answer a seat request: `playerId` is the seat they were given, or null for "not this time".
 * The round with the new player goes up first, so their phone finds the seat when it looks.
 */
export async function answerSeatRequest(roundId, no, playerId) {
  const round = getState().rounds[roundId];
  const req = requests.get(roundId)?.get(no);
  const adapter = await getAdapter();
  if (!round?.shared?.code || !adapter || !req) return;
  if (playerId) {
    // A push already running returns straight away (the new player goes in the next one), so wait for ours to land
    for (let i = 0; i < 10 && !(await pushChanges(roundId)); i++) await new Promise(res => setTimeout(res, 300));
  }
  await adapter.upsertHole(round.shared.code, no, { request: { name: req.name, at: req.at, status: playerId ? 'in' : 'no', ...(playerId ? { playerId } : {}) } });
  requests.get(roundId)?.delete(no);
  reqChanged();
}

// --------------------------- Side bet asks ---------------------------------
// Either player in a side bet can change it from their own phone (bet-asks.js). Their phone sends an
// ask under a negative hole number; the phone keeping score applies it by itself when it comes from
// one of the two players, sends the round, then marks the ask done (or says why not).

const betAsks = new Map(); // roundId -> Map(no -> ask), the asks still waiting, as every phone hears them
const applying = new Set(); // "roundId:no" being applied on this phone

function noteBetAsk(roundId, no, ask) {
  const list = betAsks.get(roundId) || new Map();
  if (ask.status === 'waiting') list.set(no, ask); else list.delete(no);
  betAsks.set(roundId, list);
  // The phone that sent it: an answer ends the wait, and a no says why
  const mine = getState().rounds[roundId]?.betAsks?.find(x => x.no === no);
  if (mine && mine.status === 'waiting' && ask.status !== 'waiting') {
    update(s => {
      const r = s.rounds[roundId]; if (!r?.betAsks) return;
      r.betAsks = r.betAsks.flatMap(x => (x.no !== no ? [x] : ask.status === 'no' ? [{ ...x, status: 'no', why: ask.why || null }] : []));
      if (!r.betAsks.length) delete r.betAsks;
    });
  }
  applyBetAsks(roundId);
}

/** On the phone keeping score: apply every side bet ask still waiting, oldest first, then answer each. */
async function applyBetAsks(roundId) {
  const list = betAsks.get(roundId);
  const round = getState().rounds[roundId];
  if (!list?.size || !round?.shared?.code || round.shared.ended) return;
  // Only the keeper's phone applies them; in a round with no keeper every player edits directly
  if (!keeperOf(round) || !isKeeper(round, keeperMe(round, getState()), !!round.shared.host)) return;
  const adapter = await getAdapter();
  if (!adapter) return;
  for (const [no, ask] of [...list].sort((a, b) => a[1].at - b[1].at)) {
    const key = `${roundId}:${no}`;
    if (applying.has(key)) continue;
    applying.add(key);
    try {
      const why = betAskProblem(getState().rounds[roundId], ask);
      if (!why) update(s => { const r = s.rounds[roundId]; if (r) s.rounds[roundId] = applyBetAsk(r, ask); });
      // The round goes up first, so the sender's phone sees the bet when it hears the answer
      if (!why) for (let i = 0; i < 10 && !(await pushChanges(roundId)); i++) await new Promise(res => setTimeout(res, 300));
      await adapter.upsertHole(round.shared.code, no, { betAsk: { ...ask, status: why ? 'no' : 'done', ...(why ? { why } : {}) } });
      list.delete(no);
    } catch { /* no signal: it's still on the server, so the next reconnect brings it back */ } finally {
      applying.delete(key);
    }
  }
}

/**
 * Ask the phone keeping score to make a side bet change (see bet-asks.js): `fields` is
 * { by, op, id, bet?, hole?, pid? }. Waits on this phone (round.betAsks) until the keeper's phone
 * answers. Throws when it can't be sent, so the sender can be told.
 */
export async function sendBetAsk(roundId, fields) {
  const round = getState().rounds[roundId];
  const adapter = await getAdapter();
  const data = buildBetAsk(fields);
  if (!round?.shared?.code || !adapter || !data) throw new Error('Can’t send it');
  const no = newRequestNo();
  update(s => { const r = s.rounds[roundId]; if (r) r.betAsks = [...(r.betAsks || []), { no, ask: data.betAsk, status: 'waiting' }]; });
  try {
    await adapter.upsertHole(round.shared.code, no, data);
  } catch (e) {
    update(s => { const r = s.rounds[roundId]; if (!r?.betAsks) return; r.betAsks = r.betAsks.filter(x => x.no !== no); if (!r.betAsks.length) delete r.betAsks; });
    throw e;
  }
  return no;
}

/** Take back a side bet ask still waiting, or put away one the keeper's phone said no to. */
export async function dropBetAsk(roundId, no) {
  const round = getState().rounds[roundId];
  const was = round?.betAsks?.find(x => x.no === no);
  update(s => { const r = s.rounds[roundId]; if (!r?.betAsks) return; r.betAsks = r.betAsks.filter(x => x.no !== no); if (!r.betAsks.length) delete r.betAsks; });
  if (was?.status !== 'waiting' || !round?.shared?.code) return;
  const adapter = await getAdapter();
  try { await adapter?.upsertHole(round.shared.code, no, null); } catch { /* it may still be applied */ }
}
