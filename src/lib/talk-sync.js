// Trash talk on the server: comments and reactions for rounds that were shared live and for plans
// with a group link, in `comments` (supabase/2026-10-04-comments.sql). Each phone writes its own
// rows and reads everyone's, so a jab on one phone shows on the others the next time they look.
// Rows are saved on the phone first and go up when there's signal: a row of yours the server
// doesn't have yet is one whose `sent` isn't its `updatedAt` (see talk.js), so nothing is lost
// offline. A round that was never shared, or a plan with no group link yet, keeps its talk on
// this phone; a plan's goes up once it gets its link. Until the SQL has run (or with no server
// at all), everything stays on this phone quietly.
// A friend's round you watch from the Friends feed (thread 'follow:<code>') talks on that round's
// own thread, joined with follow_round() (supabase/2026-10-06-friend-feed.sql), which lets a friend
// watching in on the round itself only. Before that SQL is run, it stays on this phone.
// A challenge's talk (thread 'challenge:<id>') goes up under the challenge's code once it has one,
// joined with join_challenge_comments() (supabase/2026-10-07-challenge-talk.sql). Before that SQL
// is run, it stays on this phone, and the rest of the talk goes on as before.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, uid, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { deviceReady, myDevice } from './device.js';
import { accountNow } from './cloud.js';
import { pushTalk } from './push-client.js';
import { codeOf } from './pair-debts.js';
import { mergeRows, newComment, removedRow, talkFromDb, talkReach, talkSeatKey, talkToDb, toggleReaction, unsentRows } from './talk.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the comments table isn't on the server yet. */
export class TalkOffError extends Error {
  constructor() { super('Comments aren’t switched on yet'); this.name = 'TalkOffError'; }
}
/** Thrown when the challenges' talk isn't on the server yet. */
class ChallengeTalkOffError extends Error {
  constructor() { super('Talk on challenges isn’t switched on yet'); this.name = 'ChallengeTalkOffError'; }
}
/** Thrown when following a friend's round isn't on the server yet. */
class FollowOffError extends Error {
  constructor() { super('Following friends’ rounds isn’t switched on yet'); this.name = 'FollowOffError'; }
}
/** The server refused this one row for good (bad data, or not yours to write). */
class BadRowError extends Error {
  constructor(cause) { super(cause?.message || 'Row refused'); this.name = 'BadRowError'; this.cause = cause; }
}

// --------------------------- transport ---------------------------------------
//   join(scope, code) -> seats | null   follow(code) -> seats | null   joinChallenge(code) -> seats | null
//   fetchRows(scope, codes) -> db rows   upsertRow(dbRow)

function supabaseTalk(db) {
  const check = ({ error }) => {
    if (!error) return;
    if (isMissingTable(error) || error.code === 'PGRST202' || error.code === '42883') throw new TalkOffError();
    // A check it fails, or a row that isn't this phone's to write
    if (/^2[23]/.test(String(error.code || '')) || error.code === '42501') throw new BadRowError(error);
    throw error;
  };
  return {
    kind: 'supabase',
    async join(scope, code) {
      const r = await db.rpc('join_comments', { p_scope: scope, p_code: code });
      check(r);
      return Array.isArray(r.data) ? r.data : null;
    },
    async follow(code) {
      const r = await db.rpc('follow_round', { p_code: code });
      if (r.error && (isMissingTable(r.error) || r.error.code === 'PGRST202' || r.error.code === '42883')) throw new FollowOffError();
      check(r);
      return Array.isArray(r.data) ? r.data : null;
    },
    async joinChallenge(code) {
      const r = await db.rpc('join_challenge_comments', { p_code: code });
      if (r.error && (isMissingTable(r.error) || r.error.code === 'PGRST202' || r.error.code === '42883')) throw new ChallengeTalkOffError();
      check(r);
      return Array.isArray(r.data) ? r.data : null;
    },
    async fetchRows(scope, codes) {
      if (!codes.length) return [];
      const r = await db.from('comments').select('*').eq('scope', scope).in('code', codes);
      check(r);
      return r.data || [];
    },
    async upsertRow(row) { check(await db.from('comments').upsert(row, { onConflict: 'scope,code,id' })); },
  };
}

// Dev and testing: localStorage, so two tabs (one with ?profile=b) act as two phones. Everyone is in.
function localTalk() {
  const KEY = 'bb-talk-rows';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  return {
    kind: 'local',
    async join() { return ['*']; },
    async follow() { return ['*']; },
    async joinChallenge() { return ['*']; },
    async fetchRows(scope, codes) { return Object.values(load()).filter(r => r.scope === scope && codes.includes(r.code)); },
    async upsertRow(row) {
      const all = load();
      const k = `${row.scope}|${row.code}|${row.id}`;
      all[k] = { ...row, author_dev: all[k]?.author_dev || myDevice() };
      localStorage.setItem(KEY, JSON.stringify(all));
    },
  };
}

let adapterPromise = null;
function getTalkAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? supabaseTalk(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(localTalk());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
const hasServer = supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag());

// "Off": no server, or no comments table yet. Learned on the first try, for this session
let off = !hasServer;
// Following friends' rounds isn't on the server yet (2026-10-06-friend-feed.sql), for this session
let followOff = false;
// The challenges' talk isn't on the server yet (2026-10-07-challenge-talk.sql), for this session
let challengeOff = false;
// Who you may speak as in each thread's talk on the server: `${scope}:${code}` -> seats | null
const seats = new Map();
let version = 0;
const listeners = new Set();
const changed = () => { version++; listeners.forEach(l => l()); };
const sub = l => { listeners.add(l); return () => listeners.delete(l); };
function noteError(e) {
  if (e instanceof TalkOffError && !off) { off = true; changed(); }
}

/**
 * Where a thread's talk goes: { scope, code, via? } once it can reach the others, else { scope, code: null }.
 * Thread keys are 'round:<roundId>', 'plan:<planId>' and 'challenge:<challengeId>' (talk.js), and 'follow:<code>' for a
 * friend's round you watch (via 'follow': its talk is the round's, joined as a friend watching).
 */
export function threadTarget(state, key) {
  const [kind, ...rest] = String(key).split(':');
  const id = rest.join(':');
  if (kind === 'round') return { scope: 'round', code: codeOf(state.rounds?.[id]) };
  if (kind === 'plan') return { scope: 'plan', code: state.plans?.[id]?.code || null };
  if (kind === 'follow') return { scope: 'round', code: /^[A-Z0-9]{6}$/.test(id) ? id : null, via: 'follow' };
  if (kind === 'challenge') { const c = state.challenges?.[id]?.code; return { scope: 'challenge', code: /^[A-Z0-9]{6}$/.test(c || '') ? c : null }; }
  return { scope: null, code: null };
}
// Who you may speak as is kept per way in: a player's seats, or a friend watching (per account)
const seatKey = t => talkSeatKey(t, accountNow().user?.id || null);

/**
 * Let this phone in on a thread: as a player (join_comments), as one of a challenge's people
 * (join_challenge_comments), or as a friend watching (follow_round).
 */
async function joinThread(adapter, t) {
  if (t.scope === 'challenge') {
    if (challengeOff) return null;
    try { return await adapter.joinChallenge(t.code); } catch (e) {
      if (!(e instanceof ChallengeTalkOffError)) throw e;
      challengeOff = true;
      changed();
      return null;
    }
  }
  if (t.via !== 'follow') return adapter.join(t.scope, t.code);
  // Only an account can follow a friend's round; signed out, the talk stays on this phone
  if (followOff || (adapter.kind === 'supabase' && !accountNow().user?.id)) return null;
  try { return await adapter.follow(t.code); } catch (e) {
    if (!(e instanceof FollowOffError)) throw e;
    followOff = true;
    return null;
  }
}

/**
 * Whether the others will see this phone's talk in a thread: { can, linked, shared, closed, off }
 * (see talkReach in talk.js). `linked`: the round was shared live (or the plan has its link), so
 * the talk can reach the others once comments are on; `shared`: it does now; `closed`: the server
 * can't place this phone in it, so the talk stays here.
 */
export function useTalkReach(key) {
  useSyncExternalStore(sub, () => version, () => version);
  const t = threadTarget(getState(), key);
  const scopeOff = (t.via === 'follow' && followOff) || (t.scope === 'challenge' && challengeOff);
  return talkReach({ off: off || scopeOff, code: t.code, seats: t.code ? seats.get(seatKey(t)) : undefined });
}

// --------------------------- sending ------------------------------------------

let flushing = null;
let again = false;
/**
 * Send every row of yours the server doesn't have yet. Safe to call often: a call while one is
 * going runs it once more after, so a jab sent mid-send doesn't wait for the next look.
 */
export function flushTalk() {
  if (flushing) { again = true; return flushing; }
  flushing = (async () => {
    do {
      again = false;
      if (await flushOnce() === false) break;
    } while (again);
  })().finally(() => { flushing = null; });
  return flushing;
}

// One pass over every thread. Returns false when it stopped early (off, no signal), so it isn't run again
async function flushOnce() {
  if (off) return false;
  const adapter = await getTalkAdapter();
  if (!adapter) return false;
  await deviceReady();
  const s = getState();
  for (const [key, rows] of Object.entries(s.talk || {})) {
    const t = threadTarget(s, key);
    const waiting = unsentRows(rows);
    if (!t.code || !waiting.length) continue;
    // Join first (a plan's talk takes rows only from phones that have), once a session
    const k = seatKey(t);
    if (!seats.has(k)) {
      try { seats.set(k, await joinThread(adapter, t)); changed(); } catch (e) { noteError(e); return false; }
    }
    if (seats.get(k) === null) continue; // not in it: nothing would be taken
    for (const row of waiting) {
      const mark = patch => update(st => {
        const r = st.talk?.[key]?.[row.id];
        if (r && r.updatedAt === row.updatedAt) Object.assign(r, patch);
      });
      try {
        await adapter.upsertRow(talkToDb(t.scope, t.code, row));
        mark({ sent: row.updatedAt });
      } catch (e) {
        if (e instanceof BadRowError) {
          console.warn('Comments: the server refused a row, keeping it on this phone', row.id, e.cause);
          mark({ refused: true });
          continue;
        }
        noteError(e);
        return false;
      }
    }
  }
  return true;
}

// --------------------------- fetching -----------------------------------------

/** Join, send, then pick up everyone's rows for these threads. */
export async function refreshTalk(keys) {
  if (off || !keys.length) return;
  try {
    const adapter = await getTalkAdapter();
    if (!adapter) return;
    await deviceReady();
    const s = getState();
    const byCode = new Map(); // seatKey -> { t, keys }
    for (const key of keys) {
      const t = threadTarget(s, key);
      if (!t.code) continue;
      const k = seatKey(t);
      byCode.set(k, { t, keys: [...(byCode.get(k)?.keys || []), key] });
    }
    if (!byCode.size) return;
    for (const [k, { t }] of byCode) {
      if (seats.has(k)) continue;
      seats.set(k, await joinThread(adapter, t));
      changed();
    }
    await flushTalk();
    const who = { device: myDevice(), user: accountNow().user?.id || null };
    for (const scope of ['round', 'plan', 'challenge']) {
      const codes = [...new Set([...byCode].filter(([k, { t }]) => t.scope === scope && seats.get(k) != null).map(([, { t }]) => t.code))];
      if (!codes.length) continue;
      const rows = await adapter.fetchRows(scope, codes);
      const now = getState();
      const next = {};
      for (const [k, { t, keys: list }] of byCode) {
        if (t.scope !== scope || seats.get(k) == null) continue;
        const mine = rows.filter(x => x.code === t.code).map(x => talkFromDb(x, who));
        for (const key of list) {
          const merged = mergeRows(now.talk?.[key] || {}, mine);
          if (merged !== (now.talk?.[key] || {})) next[key] = merged;
        }
      }
      if (Object.keys(next).length) update(st => { st.talk = { ...(st.talk || {}), ...next }; });
    }
  } catch (e) { noteError(e); }
}

/**
 * Keep these threads' talk fresh while a screen is open: look now and when the phone wakes, and
 * (with `live`) every 30 seconds while it's on screen.
 */
export function useTalkSync(keys, { live = false } = {}) {
  const k = [...new Set(keys)].sort().join(',');
  useEffect(() => {
    if (!k) return undefined;
    const list = k.split(',');
    let stopped = false, timer = null;
    const go = () => { if (!stopped) refreshTalk(list); };
    go();
    const wake = () => { if (document.visibilityState === 'visible') go(); };
    if (live) timer = setInterval(() => { if (document.visibilityState === 'visible') go(); }, 30000);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', go);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', go);
    };
  }, [k, live]);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushTalk());
  setTimeout(() => flushTalk(), 4000);
}

// --------------------------- actions -----------------------------------------

function save(key, row) {
  update(s => {
    s.talk = s.talk || {};
    s.talk[key] = { ...(s.talk[key] || {}), [row.id]: row };
  });
  flushTalk();
}

/** Post a comment (or a jab: `jab` is its key). Returns its id, or null when there was nothing to post. */
export function postComment(key, { on, who, name, body, jab = null }) {
  const row = newComment({ id: `c:${uid()}`, on, who, name, body, jab });
  if (!row) return null;
  save(key, row);
  // The others on it hear what you wrote, once the thread can reach them (push-client.js)
  const s = getState();
  const [kind, ...rest] = String(key).split(':');
  const thing = kind === 'round' ? s.rounds?.[rest.join(':')] : kind === 'plan' ? s.plans?.[rest.join(':')] : null;
  pushTalk(threadTarget(s, key), { id: row.id, name, course: thing?.course?.name, day: kind === 'plan' ? thing?.date : '', text: row.body });
  return row.id;
}

/** Tap a reaction on or off. */
export function react(key, { on, who, name, emoji }) {
  const row = toggleReaction(getState().talk?.[key], { on, who, name, emoji });
  if (row) save(key, row);
}

/** Take back a comment of yours. Returns a function that puts it back. */
export function takeBack(key, id) {
  const had = getState().talk?.[key]?.[id];
  if (!had?.mine || had.deleted) return null;
  save(key, removedRow(had));
  // Put back as a newer edit than the delete, so every phone (and the server) takes it
  return () => {
    const now = getState().talk?.[key]?.[id];
    save(key, { ...had, updatedAt: Math.max(Date.now(), (now?.updatedAt || 0) + 1), sent: now?.sent ?? had.sent, refused: false });
  };
}
