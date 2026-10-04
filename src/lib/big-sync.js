// The Big Game across phones. Each group keeps score in its own live round, so its scores are
// already on the server, posted by the group's scorekeeper under the keeper lock. Every phone in
// the game knows every group's live code (they ride in the game, on each round's stamp), so it
// reads the other groups' rounds from there, read only, and keeps a copy of each (`state.bigCards`,
// by game and code): the board shows every group, and once they're all in, every phone works out
// the same money from the same cards.
//
// The organizer's own copy of the game (side bets added after tee off, a game closed early) goes
// on the server too (`big_games`, supabase/2026-10-06-big-game.sql): the organizer's phone writes
// it, every phone in the game's rounds reads it. Until that SQL runs, the newest copy still reaches
// a group whose card the organizer's phone keeps (on the round's stamp), and every other phone
// keeps the copy it has: no errors, nothing to switch on.
//
// The organizer's phone also hands each group's card to the scorekeeper picked for it as soon as
// that player's phone takes their seat, before anyone scores.
import { useEffect } from 'react';
import { getState, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { getAdapter as liveAdapter } from './sync.js';
import { stable } from './sync-model.js';
import { BIG_FORMAT } from './big-game.js';
import { bigOf, bigTripIds } from './big-money.js';
import { isOrganizer, tripOf } from './trips.js';
import { cleanRecord, codesToRead, gameRecord, handOffs, recordDue, toCard } from './big-sync-model.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the big_games table isn't on the server yet. */
class BigOffError extends Error {
  constructor() { super('The Big Game record isn’t switched on yet'); this.name = 'BigOffError'; }
}

// --------------------------- transport (the game record) ----------------------------
//   fetch(tripIds) -> [{ tripId, v, at, big, endedAt, byName }]   publish(record, codes)

function supabaseGames(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error)) throw new BigOffError();
    throw error;
  };
  return {
    async fetch(ids) {
      if (!ids.length) return [];
      const r = await db.from('big_games').select('trip_id, game').in('trip_id', ids);
      check(r);
      return (r.data || []).map(x => ({ ...x.game, tripId: x.trip_id }));
    },
    async publish(rec, codes) {
      check(await db.from('big_games').upsert({ trip_id: rec.tripId, codes, game: rec }));
    },
  };
}

// Dev and testing: localStorage, so two tabs (one with ?profile=b) act as two phones
const LOCAL_KEY = 'bb-big-games';
function localGames() {
  const load = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };
  return {
    async fetch(ids) { const all = load(); return ids.map(id => all[id]).filter(Boolean); },
    async publish(rec) { const all = load(); all[rec.tripId] = rec; localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); },
  };
}

let gamesPromise = null;
function gamesAdapter() {
  if (!gamesPromise) {
    if (supabaseConfigured) gamesPromise = getSupabase().then(db => (db ? supabaseGames(db) : null));
    else if (import.meta.env.DEV || localFlag()) gamesPromise = Promise.resolve(localGames());
    else gamesPromise = Promise.resolve(null);
  }
  return gamesPromise;
}

// "Off": no big_games table yet. Learned on the first try, for this session
let recordOff = false;
const note = (what, e) => {
  if (e instanceof BigOffError) recordOff = true;
  else console.warn(`Big Game ${what}:`, e?.message || e);
};

/** Whether the organizer's changes reach every phone in the game (the SQL has run). */
export const recordOn = () => !recordOff;

// --------------------------- the loop ----------------------------------------------

/** Keep a fetched card when it's changed (the board and the money read it). */
function keepCard(tripId, code, card) {
  const was = getState().bigCards?.[tripId]?.[code];
  const { fetchedAt: _a, ...a } = was || {};
  const { fetchedAt: _b, ...b } = card;
  if (was && stable(a) === stable(b)) return;
  update(st => { st.bigCards = { ...(st.bigCards || {}), [tripId]: { ...(st.bigCards?.[tripId] || {}), [code]: card } }; });
}

let running = null;
let again = false;
/** Read the other groups' rounds and the game record, put the organizer's record up, and hand out the cards. */
export function refreshBig() {
  if (running) { again = true; return running; }
  running = (async () => {
    const ids = bigTripIds(getState()).filter(id => tripOf(getState(), id)?.format === BIG_FORMAT);
    if (!ids.length) return;
    // The organizer's phone hands each group's card on once its scorekeeper's phone is on the round
    for (const id of ids) {
      const moves = handOffs(getState(), id);
      if (moves.length) update(st => { for (const m of moves) if (st.rounds[m.roundId]) Object.assign(st.rounds[m.roundId], m.patch); });
    }
    const live = await liveAdapter().catch(() => null);
    if (live) {
      for (const id of ids) {
        for (const code of codesToRead(getState(), id)) {
          try {
            const remote = await live.fetch(code);
            if (remote?.meta) keepCard(id, code, toCard(remote.meta, remote.holes));
          } catch (e) { note('rounds', e); }
        }
      }
    }
    if (recordOff) return;
    const games = await gamesAdapter().catch(() => null);
    if (!games) return;
    try {
      const rows = (await games.fetch(ids)).map(cleanRecord).filter(Boolean);
      const byId = new Map(rows.map(r => [r.tripId, r]));
      const s = getState();
      const fresh = rows.filter(r => stable(s.bigRemote?.[r.tripId] || null) !== stable(r));
      if (fresh.length) update(st => { st.bigRemote = { ...(st.bigRemote || {}) }; for (const r of fresh) st.bigRemote[r.tripId] = r; });
      for (const id of ids) {
        const st = getState();
        const trip = tripOf(st, id);
        if (!trip || !isOrganizer(st, trip)) continue;
        const mine = gameRecord(st, id);
        if (!recordDue(mine, byId.get(id) || null)) continue;
        const codes = mine.big.groups.map(g => g.code).filter(Boolean).slice(0, 100);
        await games.publish(mine, codes);
        update(x => { x.bigRemote = { ...(x.bigRemote || {}), [id]: mine }; });
      }
    } catch (e) { note('record', e); }
  })().finally(() => {
    running = null;
    if (again) { again = false; refreshBig(); }
  });
  return running;
}

/**
 * Keep the game fresh while a screen with it is open: now, when the phone wakes or comes back
 * online, and every 30 seconds (`live`: the board, a group's round) or two minutes.
 */
export function useBigSync({ live = false } = {}) {
  const s = getState();
  const ids = bigTripIds(s);
  // The organizer's phone also looks again as soon as a group's phone takes a seat, to hand it the card
  const sig = ids.length ? JSON.stringify(ids.map(id => {
    const big = bigOf(s, id);
    const seats = Object.values(s.rounds || {}).filter(r => r.trip?.id === id && r.shared?.host && r.status === 'active').map(r => `${Object.keys(r.onApp || {}).length}${r.keeper?.id || ''}`);
    return [id, big?.v || 0, big?.groups.map(g => g.code).join(','), seats.join()];
  })) : '';
  useEffect(() => {
    if (!sig) return undefined;
    let timer = setTimeout(() => refreshBig(), 300);
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => refreshBig(), 250); };
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    const every = setInterval(() => { if (document.visibilityState === 'visible') refreshBig(); }, live ? 30e3 : 120e3);
    const stored = e => { if (e.key === LOCAL_KEY || String(e.key || '').startsWith('bb-live:')) soon(); };
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
  }, [sig, live]);
}
