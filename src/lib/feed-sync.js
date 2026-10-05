// The Friends feed on the server: friend_rounds() lists the live and finished rounds of people
// you've played with that you're not in, by each person's profile setting
// (supabase/2026-10-06-friend-feed.sql; friend-feed.js has the rules and the views). "Watch" keeps
// a friend's round on this phone with its last copy, and while its screen is open follows it live
// over the same connection a watcher's phone uses, read only. Its trash talk goes through
// talk-sync.js (threads 'follow:<code>').
//
// Offline first and quiet: the last answer is kept on the phone, so the feed opens straight away
// and with no signal. Signed out, or before the SQL is run (the server says "no such function"),
// the feed shows only what the phone already has, and asks again on a later load.
//
// API for screens:
//   useFriendRounds()       -> { rounds, feed }: friends' rounds for the feed (friend-feed.js friendRounds)
//   useFeed()               -> { rows, at, status, follows } and keeps it fresh while mounted.
//                              status: 'unknown' | 'ready' | 'off' (SQL not run) | 'offline' | 'error'
//                              | 'signed-out' | 'local' (dev, no server: rounds shared in this browser)
//   refreshFeed({ force })  ask the server now (at most every 20 seconds unless forced)
//   watchRound(code, row)   follow a friend's round; stopWatching(code) lets it go
//   useLiveRound(code, row) while mounted, the round's latest copy from the live connection:
//                           { row, state: 'connecting' | 'live' | 'gone' | 'offline' }
//                           A round whose money stays back from you has no code here: it's fetched
//                           by its ref (friend_round) every 20 seconds, never with a code.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { STORE_KEY, useStore } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { accountNow, onAccount } from './cloud.js';
import { isNotSetUp, retryOnLoad, serverStateAfter } from './profile-model.js';
import { getAdapter } from './sync.js';
import { cleanFeedRow, feedMeta, friendRounds, liveSource } from './friend-feed.js';

const FEED_KEY = `bb-feed:${STORE_KEY}`;       // { rows, at, offAt, uid }: uid is the account the rows came for
const FOLLOW_KEY = `bb-follows:${STORE_KEY}`;  // { [code]: { since, row } }, for that same account
const MIN_GAP = 20e3;
const EVERY = 60e3;
const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } }

const cached = load(FEED_KEY, {});
let snap = {
  rows: Array.isArray(cached.rows) ? cached.rows.map(cleanFeedRow).filter(Boolean) : [],
  at: Number(cached.at) || 0,
  status: 'unknown',
  follows: load(FOLLOW_KEY, {}),
};
let offAt = Number(cached.offAt) || 0;
let uid = typeof cached.uid === 'string' ? cached.uid : null;
const listeners = new Set();
function set(patch) {
  snap = { ...snap, ...patch };
  listeners.forEach(l => l());
}
const sub = l => { listeners.add(l); return () => listeners.delete(l); };
const persistFeed = () => save(FEED_KEY, { rows: snap.rows, at: snap.at, offAt, uid });

/** What the phone kept is another account's: start the feed over for this one. */
function forAccount(user) {
  if (!user || user === uid) return;
  uid = user;
  set({ rows: [], at: 0, follows: {} });
  persistFeed();
  persistFollows();
}
const persistFollows = () => save(FOLLOW_KEY, snap.follows);

/** The feed as this phone has it now. */
export const feedNow = () => snap;

// --------------------------- asking the server -------------------------------

/** Dev and testing with no server: every round shared in this browser (two tabs act as two phones). */
function localRows() {
  const rows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('bb-live:')) continue;
      const v = JSON.parse(localStorage.getItem(k));
      if (!v?.meta) continue;
      const people = Object.fromEntries((v.meta.players || []).map(p => [p.id, { friend: true, money: false, account: null }]));
      rows.push({ code: k.slice('bb-live:'.length), meta: v.meta, holes: v.holes || {}, people, updatedAt: Date.now() });
    }
  } catch { /* storage blocked */ }
  return rows.map(cleanFeedRow).filter(Boolean);
}

/** The rows from the server, with each followed round's copy brought up to date. */
function landRows(rows, status) {
  const follows = { ...snap.follows };
  let moved = false;
  for (const r of rows) {
    if (follows[r.code]) { follows[r.code] = { ...follows[r.code], row: r }; moved = true; }
  }
  set({ rows, at: Date.now(), status, ...(moved ? { follows } : {}) });
  persistFeed();
  if (moved) persistFollows();
}

let running = null;
let lastRun = 0;
/** Ask the server for friends' rounds now. Quiet: never throws. */
export function refreshFeed({ force = false } = {}) {
  if (running) return running;
  if (!force && Date.now() - lastRun < MIN_GAP) return Promise.resolve();
  if (!supabaseConfigured) {
    if (import.meta.env.DEV || localFlag()) landRows(localRows(), 'local');
    else set({ status: 'off' });
    return Promise.resolve();
  }
  const user = accountNow().user?.id || null;
  if (!user) { set({ status: 'signed-out' }); return Promise.resolve(); }
  forAccount(user);
  // A server that said "not set up" only a little while ago isn't asked again until later
  if (!force && offAt && !retryOnLoad(offAt)) { set({ status: 'off' }); return Promise.resolve(); }
  lastRun = Date.now();
  running = (async () => {
    try {
      const db = await getSupabase();
      if (!db) { set({ status: 'off' }); return; }
      const { data, error } = await db.rpc('friend_rounds');
      if (error) throw error;
      if (offAt) offAt = 0;
      landRows((Array.isArray(data) ? data : []).map(cleanFeedRow).filter(Boolean), 'ready');
    } catch (e) {
      if (isNotSetUp(e)) { offAt = Date.now(); persistFeed(); set({ status: 'off' }); return; }
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      const now = serverStateAfter(e, online);
      if (now === 'error') console.warn('Friends feed:', e?.message || e);
      set({ status: now });
    }
  })().finally(() => { running = null; });
  return running;
}

/**
 * The feed, kept fresh while a screen shows it: asks now, every minute while the app is in view,
 * when it wakes or comes back online, and when you sign in or out.
 */
export function useFeed() {
  const s = useSyncExternalStore(sub, () => snap, () => snap);
  useEffect(() => {
    refreshFeed();
    const tick = () => { if (document.visibilityState === 'visible') refreshFeed(); };
    const timer = setInterval(tick, EVERY);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    // Signing in or out (not every sync the account makes)
    let user = accountNow().user?.id || null;
    const off = onAccount(() => {
      const now = accountNow().user?.id || null;
      if (now === user) return;
      user = now;
      refreshFeed({ force: true });
    });
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
      off();
    };
  }, []);
  return s;
}

/** Friends' rounds as this phone sees them now (see friendRounds), kept fresh while mounted. */
export function useFriendRounds() {
  const state = useStore();
  const feed = useFeed();
  // Signed out, what came from the server for an account stays out of sight (rounds this phone
  // watches from a code still show, from the phone itself)
  const out = feed.status === 'signed-out';
  const rounds = useMemo(() => friendRounds(state, { rows: out ? [] : feed.rows, follows: out ? {} : feed.follows, status: feed.status }), [state, feed, out]);
  return { rounds, feed };
}

// --------------------------- watching one -----------------------------------

/** Follow a friend's round: it stays on top of your feed with its last copy, and its talk is yours to join. */
export function watchRound(code, row = null) {
  const r = cleanFeedRow(row) || snap.rows.find(x => x.code === code) || snap.follows[code]?.row || null;
  if (!r) return false;
  set({ follows: { ...snap.follows, [code]: { since: Date.now(), row: r } } });
  persistFollows();
  return true;
}

/** Stop watching a friend's round. */
export function stopWatching(code) {
  if (!snap.follows[code]) return;
  const follows = { ...snap.follows };
  delete follows[code];
  set({ follows });
  persistFollows();
}

/** A friend's round's row as the feed may show it now (see friendRounds in friend-feed.js), or null. */
export function rowFor(s, code) {
  const fresh = s.rows.find(r => r.code === code);
  if (fresh) return fresh;
  return s.status === 'ready' ? null : cleanFeedRow(s.follows[code]?.row) || null;
}

/** The round's latest copy over the live connection, laid over `row` (the feed's copy). */
function liveCopy(row, remote) {
  const holes = {};
  for (const [no, data] of Object.entries(remote.holes || {})) if (Number(no) > 0 && data) holes[no] = data;
  return cleanFeedRow({ ...row, meta: feedMeta(remote.meta), holes, updatedAt: Date.now() });
}

/** Fetch one friend's round by its ref (friend_round), for a round whose money stays back. */
async function fetchByRef(ref) {
  const db = await getSupabase();
  if (!db) throw new Error('offline');
  const { data, error } = await db.rpc('friend_round', { p_ref: ref });
  if (error) throw error;
  return cleanFeedRow(Array.isArray(data) ? data[0] : null);
}

/** The feed's copy of one round replaced with a fresher one (a round fetched by its ref). */
function landRow(code, next) {
  const rows = snap.rows.map(r => (r.code === code ? next : r));
  const follows = snap.follows[code] ? { ...snap.follows, [code]: { ...snap.follows[code], row: next } } : snap.follows;
  set({ rows, follows });
  persistFeed();
  if (follows !== snap.follows) persistFollows();
}

/**
 * While a friend's round is on screen: its latest copy, live. A round whose money may reach you
 * listens on the round's own channel (the one a watcher's phone uses) and fetches the round again
 * a moment after anything changes, so a run of saves is one fetch. One whose money stays back is
 * never fetched with a code (that would bring the money with it): it's asked for by its ref every
 * 20 seconds, with the same parts kept back, or left to the feed when it has no ref. A round you
 * watch keeps the new copy for next time.
 */
export function useLiveRound(code, row) {
  const [live, setLive] = useState({ row: null, state: 'connecting' });
  const has = !!row;
  const source = liveSource(row);
  const kind = source?.kind || null;
  useEffect(() => {
    if (!code || !has || !kind) return undefined;
    let stopped = false, unsub = null, timer = null, every = null;
    const wake = () => { if (document.visibilityState === 'visible') pull(); };
    const pull = async () => {
      try {
        if (kind === 'feed') { await refreshFeed(); if (!stopped) setLive(l => ({ ...l, state: 'live' })); return; }
        if (kind === 'ref') {
          const next = await fetchByRef(code);
          if (stopped) return;
          if (!next) { setLive(l => ({ ...l, state: 'gone' })); return; }
          landRow(code, next);
          setLive({ row: next, state: 'live' });
          return;
        }
        const adapter = await getAdapter();
        const remote = await adapter?.fetch(code);
        if (stopped) return;
        if (!remote) { setLive(l => ({ ...l, state: 'gone' })); return; }
        const base = rowFor(snap, code) || row;
        const next = liveCopy(base, remote);
        if (!next) return;
        setLive({ row: next, state: 'live' });
        if (snap.follows[code]) {
          set({ follows: { ...snap.follows, [code]: { ...snap.follows[code], row: next } } });
          persistFollows();
        }
      } catch { if (!stopped) setLive(l => ({ ...l, state: 'offline' })); }
    };
    if (kind === 'code') {
      const soon = () => { clearTimeout(timer); timer = setTimeout(pull, 500); };
      getAdapter().then(adapter => {
        if (stopped || !adapter) return;
        unsub = adapter.subscribe(code, ev => {
          if (ev.type === 'deleted') setLive(l => ({ ...l, state: 'gone' }));
          else if (ev.type === 'connected' || ev.type === 'meta' || (ev.type === 'hole' && Number(ev.holeNo) > 0)) soon();
        });
      });
    } else {
      every = setInterval(wake, MIN_GAP);
    }
    pull();
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(every);
      unsub?.();
      document.removeEventListener('visibilitychange', wake);
    };
  }, [code, has, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return live;
}
