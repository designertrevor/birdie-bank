// Trash talk on the server: comments and reactions for rounds that were shared live and for plans
// with a group link, in `comments` (supabase/2026-10-04-comments.sql). Each phone writes its own
// rows and reads everyone's, so a jab on one phone shows on the others the next time they look.
// Rows are saved on the phone first and go up when there's signal: a row of yours the server
// doesn't have yet is one whose `sent` isn't its `updatedAt` (see talk.js), so nothing is lost
// offline. A round that was never shared, or a plan with no group link yet, keeps its talk on
// this phone; a plan's goes up once it gets its link. Until the SQL has run (or with no server
// at all), everything stays on this phone quietly.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, uid, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { isMissingTable } from './plan-adapters.js';
import { deviceReady, myDevice } from './device.js';
import { accountNow } from './cloud.js';
import { codeOf } from './pair-debts.js';
import { mergeRows, newComment, removedRow, talkFromDb, talkToDb, toggleReaction, unsentRows } from './talk.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

/** Thrown when the comments table isn't on the server yet. */
export class TalkOffError extends Error {
  constructor() { super('Comments aren’t switched on yet'); this.name = 'TalkOffError'; }
}
/** The server refused this one row for good (bad data, or not yours to write). */
class BadRowError extends Error {
  constructor(cause) { super(cause?.message || 'Row refused'); this.name = 'BadRowError'; this.cause = cause; }
}

// --------------------------- transport ---------------------------------------
//   join(scope, code) -> seats | null   fetchRows(scope, codes) -> db rows   upsertRow(dbRow)

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
 * Where a thread's talk goes: { scope, code } once it can reach the others, else { scope, code: null }.
 * Thread keys are 'round:<roundId>' and 'plan:<planId>' (talk.js).
 */
export function threadTarget(state, key) {
  const [kind, ...rest] = String(key).split(':');
  const id = rest.join(':');
  if (kind === 'round') return { scope: 'round', code: codeOf(state.rounds?.[id]) };
  if (kind === 'plan') return { scope: 'plan', code: state.plans?.[id]?.code || null };
  return { scope: null, code: null };
}

/**
 * Whether this phone can talk in a thread, and whether the others will see it:
 * { can, shared, off }. `can` is false only once the server has said you're not in that round.
 */
export function useTalkReach(key) {
  useSyncExternalStore(sub, () => version, () => version);
  const t = threadTarget(getState(), key);
  if (off || !t.code) return { can: true, shared: false, off };
  const s = seats.get(`${t.scope}:${t.code}`);
  return { can: s !== null, shared: true, off: false };
}

// --------------------------- sending ------------------------------------------

let flushing = null;
/** Send every row of yours the server doesn't have yet. Safe to call often. */
export function flushTalk() {
  if (flushing) return flushing;
  flushing = (async () => {
    if (off) return;
    const adapter = await getTalkAdapter();
    if (!adapter) return;
    await deviceReady();
    const s = getState();
    for (const [key, rows] of Object.entries(s.talk || {})) {
      const t = threadTarget(s, key);
      if (!t.code) continue;
      if (seats.get(`${t.scope}:${t.code}`) === null) continue; // not in it: nothing would be taken
      for (const row of unsentRows(rows)) {
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
          return;
        }
      }
    }
  })().finally(() => { flushing = null; });
  return flushing;
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
    const byCode = new Map(); // `${scope}:${code}` -> thread keys
    for (const key of keys) {
      const t = threadTarget(s, key);
      if (!t.code) continue;
      const k = `${t.scope}:${t.code}`;
      byCode.set(k, [...(byCode.get(k) || []), key]);
    }
    if (!byCode.size) return;
    for (const k of byCode.keys()) {
      if (seats.has(k)) continue;
      const [scope, code] = k.split(':');
      seats.set(k, await adapter.join(scope, code));
      changed();
    }
    await flushTalk();
    const who = { device: myDevice(), user: accountNow().user?.id || null };
    for (const scope of ['round', 'plan']) {
      const codes = [...byCode.keys()].filter(k => k.startsWith(`${scope}:`) && seats.get(k) !== null).map(k => k.split(':')[1]);
      if (!codes.length) continue;
      const rows = await adapter.fetchRows(scope, codes);
      const now = getState();
      const next = {};
      for (const [k, list] of byCode) {
        if (!k.startsWith(`${scope}:`)) continue;
        const code = k.split(':')[1];
        const mine = rows.filter(x => x.code === code).map(x => talkFromDb(x, who));
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
  return () => save(key, { ...had, updatedAt: Date.now(), sent: had.sent, refused: false });
}
