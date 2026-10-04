// A live captains' draft on this phone (draft.js has the rules): the organizer starts it from the
// trip, each captain opens their own link and picks on their turn, and every phone reads the
// others' picks from the trip's matches table (cup-sync.js cupRows and postCupRow, no new SQL).
// `state.tripDrafts[tripId]` keeps this phone's side: `def` (the organizer's draft), `mine` (a
// captain's own seat and picks) and `rows` (the server's copy of every draft row for the trip).
// When everyone is picked the organizer's phone puts the teams on the trip and plans the
// schedule's rounds (trip-store.js). With no table on the server it says so, and the organizer
// runs the draft on one phone.
import { useEffect, useState } from 'react';
import { getState, update } from './store.js';
import { cupOff, cupRows, postCupRow, LOCAL_KEY } from './cup-sync.js';
import { deviceReady, myDevice } from './device.js';
import { stable } from './sync-model.js';
import { DRAFT_KEY, captainKey, cleanCaptainRow, cleanDraft, draftRow, draftTeams, isDraftKey, mergeDraft, newDraft, pickFor, pickHere, undoFor } from './draft.js';
import { cupOf } from './cup.js';
import { isOrganizer, tripGoing, tripOf } from './trips.js';
import { editTrip, makeScheduledRounds } from './trip-store.js';

const myName = s => String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || null;
const slot = (s, id) => s.tripDrafts?.[id] || {};

function put(tripId, patch) {
  update(st => { st.tripDrafts = { ...(st.tripDrafts || {}), [tripId]: { ...(st.tripDrafts?.[tripId] || {}), ...patch } }; });
}

/** This phone's draft for a trip, put together: { def, mine, rows, merged } (def null until there is one). */
export function draftState(state, tripId) {
  const d = slot(state, tripId);
  const rows = { ...(d.rows || {}) };
  // This phone's own rows as it has them now, so a pick shows before the server has it
  const def = cleanDraft(d.def) || cleanDraft(rows[DRAFT_KEY]);
  if (d.def && cleanDraft(d.def)) rows[DRAFT_KEY] = d.def;
  const key = captainKey(myDevice());
  if (d.mine && key) rows[key] = d.mine;
  return { def, mine: d.mine ? cleanCaptainRow(d.mine) : null, rows, merged: def ? mergeDraft(def, rows) : null, at: d.checkedAt || 0 };
}

/** Which captain this phone picks for in the trip's draft: the organizer's for any it picks for, a captain's own seat. */
export function mySeats(state, tripId) {
  const { def, mine } = draftState(state, tripId);
  const out = new Set();
  if (!def) return out;
  if (slot(state, tripId).def) def.here.forEach((h, i) => { if (h) out.add(i); });
  if (mine && mine.v === def.v && !def.here[mine.seat]) out.add(mine.seat);
  return out;
}

// --------------------------- talking to the server ---------------------------

const running = new Map();
/**
 * Post this phone's rows for the trip's draft (when they changed), then read every row. Resolves
 * 'off' when the table isn't on the server, 'offline' with no signal, else 'ok'. On the
 * organizer's phone a finished draft goes onto the trip.
 */
export function refreshDraft(tripId) {
  if (running.has(tripId)) return running.get(tripId);
  const p = (async () => {
    if (cupOff()) return 'off';
    await deviceReady();
    try {
      const s = getState();
      const d = slot(s, tripId);
      const rows = d.rows || {};
      const key = captainKey(myDevice());
      // Post first: the server only lets a phone read a trip's rows once it has posted one
      if (d.def && stable(rows[DRAFT_KEY] || null) !== stable(d.def)) {
        if (!(await postCupRow(tripId, DRAFT_KEY, d.def))) return 'off';
      }
      if (d.mine && key && stable(rows[key] || null) !== stable(d.mine)) {
        if (!(await postCupRow(tripId, key, d.mine))) return 'off';
      }
      const all = await cupRows(tripId);
      if (all == null) return 'off';
      const mine = Object.fromEntries(Object.entries(all).filter(([k]) => isDraftKey(k)));
      put(tripId, { rows: mine, checkedAt: Date.now() });
      followDraft(tripId);
      return 'ok';
    } catch {
      return 'offline';
    }
  })().finally(() => running.delete(tripId));
  running.set(tripId, p);
  return p;
}

/**
 * A captain's phone keeps up with the draft: a restarted draft (a new version) starts its picks
 * over. The organizer's phone puts a finished draft's teams on the trip, once.
 */
function followDraft(tripId) {
  const s = getState();
  const { def, merged } = draftState(s, tripId);
  const d = slot(s, tripId);
  if (!def) return;
  if (d.mine && d.mine.v !== def.v) put(tripId, { mine: { ...d.mine, v: def.v, picks: [], at: Date.now() } });
  const trip = tripOf(s, tripId);
  if (!d.def || !merged?.done || !trip || !isOrganizer(s, trip) || d.applied === def.v) return;
  const cup = cupOf(trip);
  if (!cup) return;
  editTrip(tripId, { cup: { ...cup, pick: 'draft', teams: draftTeams(def, merged), captains: def.captains } });
  put(tripId, { applied: def.v });
  if (cup.schedule) makeScheduledRounds(tripId);
}

/**
 * Keep the draft fresh while its screen is open: now, every few seconds while it's on screen, when
 * the phone comes back online, and right away when another tab (a second dev profile) posts.
 * Returns the last answer from the server: 'ok', 'off', 'offline' or null before the first.
 */
export function useDraftSync(tripId) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!tripId) return undefined;
    let live = true;
    const go = () => refreshDraft(tripId).then(r => { if (live) setStatus(r); });
    go();
    const every = setInterval(() => { if (document.visibilityState === 'visible') go(); }, 4000);
    const stored = e => { if (e.key === LOCAL_KEY) go(); };
    window.addEventListener('online', go);
    window.addEventListener('storage', stored);
    return () => {
      live = false;
      clearInterval(every);
      window.removeEventListener('online', go);
      window.removeEventListener('storage', stored);
    };
  }, [tripId]);
  return status;
}

// --------------------------- the organizer ---------------------------

/**
 * The organizer starts the live draft (or starts it over, a new version): everyone going is in
 * the pool, the trip's two captains pick, in `order`, `first` picking first. `here`: captains who
 * pick on this phone (the organizer captaining, say). Returns the draft, or null when the trip has
 * no two captains.
 */
export function startDraft(tripId, { order = 'snake', first = 0, here = [false, false] } = {}) {
  const s = getState();
  const trip = tripOf(s, tripId);
  const cup = cupOf(trip);
  if (!trip || !cup || !isOrganizer(s, trip) || !cup.captains[0] || !cup.captains[1]) return null;
  const old = cleanDraft(slot(s, tripId).def);
  const pool = tripGoing(s, trip).map(id => s.players[id]).filter(Boolean).map(p => ({ id: p.id, name: p.name, index: p.index ?? null }));
  for (const c of cup.captains) if (!pool.some(p => p.id === c)) { const p = s.players[c]; if (p) pool.push({ id: p.id, name: p.name, index: p.index ?? null }); }
  const def = newDraft({ pool, captains: cup.captains, names: cup.names, order, first, here, byName: myName(s), v: (old?.v || 0) + 1 });
  if (!def) return null;
  put(tripId, { def: draftRow(def), applied: null });
  // The trip waits on the draft: its captains on their teams, nobody else yet
  editTrip(tripId, { cup: { ...cup, pick: 'draft', draft: { live: true, order, first }, teams: cup.captains.map(id => [{ id, name: s.players[id]?.name || 'Player' }]) } });
  refreshDraft(tripId);
  return def;
}

/** The organizer's phone picks for a captain from now on (keeping what they've picked). */
export function pickForHere(tripId, seat) {
  const s = getState();
  const { def, rows } = draftState(s, tripId);
  if (!def || !slot(s, tripId).def) return;
  put(tripId, { def: draftRow(pickHere(def, rows, seat)) });
  refreshDraft(tripId);
}

// --------------------------- a captain ---------------------------

/** A captain's phone opens their link: it claims that captain's picks for the draft as it is. */
export function joinDraft(tripId, seat) {
  const s = getState();
  const d = slot(s, tripId);
  if (d.mine?.seat === seat) return refreshDraft(tripId);
  const v = cleanDraft(d.rows?.[DRAFT_KEY])?.v || 0;
  put(tripId, { mine: { draft: 1, seat, v, picks: [], name: myName(s), at: Date.now() } });
  return refreshDraft(tripId);
}

/** Pick someone on your turn (`seat`: the captain this phone picks for). Returns false when it isn't your turn. */
export function draftPick(tripId, seat, id) {
  const s = getState();
  const { def, rows } = draftState(s, tripId);
  if (!def) return false;
  const list = pickFor(def, rows, seat, id);
  if (!list) return false;
  const d = slot(s, tripId);
  if (d.def && def.here[seat]) put(tripId, { def: { ...d.def, picks: d.def.picks.map((l, i) => (i === seat ? list : l)) } });
  else if (d.mine?.seat === seat) put(tripId, { mine: { ...d.mine, v: def.v, picks: list } });
  else return false;
  refreshDraft(tripId);
  return true;
}

/** Take back your last pick, while it's still the draft's last. */
export function draftUndo(tripId, seat) {
  const s = getState();
  const { def, rows } = draftState(s, tripId);
  if (!def) return false;
  const list = undoFor(def, rows, seat);
  if (!list) return false;
  const d = slot(s, tripId);
  if (d.def && def.here[seat]) put(tripId, { def: { ...d.def, picks: d.def.picks.map((l, i) => (i === seat ? list : l)) } });
  else if (d.mine?.seat === seat) put(tripId, { mine: { ...d.mine, picks: list } });
  else return false;
  refreshDraft(tripId);
  return true;
}
