// The roadmap on this phone and on the server (supabase/2026-10-07-roadmap.sql). This phone keeps
// its own votes, the ideas it sent and the "it's live" notes it showed (roadmap.js has the rules);
// the server keeps one vote per account, the comments, and the ideas Trevor put on the roadmap.
// Votes are saved here first and go up once you're signed in and the server has the tables, so
// nothing is lost before the SQL runs or with no signal. Comments need both, and hide until then.
import { useSyncExternalStore } from 'react';
import { getSupabase } from './supabase.js';
import { getState } from './store.js';
import { accountNow, onAccount } from './cloud.js';
import { addSent, cleanLocal, commentName, countsFromRows, emptyLocal, markTold, markVotesSynced, pendingVotes, roadmapOff, toggleVote } from './roadmap.js';

const LOCAL = 'bb-roadmap';
const SERVER = 'bb-roadmap-server';
/** Up next looks again at most this often; the roadmap screen every time it opens. */
const UP_NEXT_EVERY = 30 * 60e3;

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

const emptyServer = () => ({ counts: {}, requests: [], mine: [], myVotes: [], state: 'unknown', at: 0 });
function loadServer() {
  const s = read(SERVER, null);
  if (!s || typeof s !== 'object') return emptyServer();
  return { ...emptyServer(), ...s, state: s.state === 'off' ? 'off' : 'unknown' };
}

let snap = { local: cleanLocal(read(LOCAL, emptyLocal())), server: loadServer() };
const listeners = new Set();
function set(patch) {
  snap = { ...snap, ...patch };
  if (patch.local) write(LOCAL, snap.local);
  if (patch.server) write(SERVER, snap.server);
  listeners.forEach(l => l());
}
const sub = l => { listeners.add(l); return () => listeners.delete(l); };

/** { local, server } for React. */
export function useRoadmap() { return useSyncExternalStore(sub, () => snap, () => snap); }
export function roadmapNow() { return snap; }

const signedIn = () => !!accountNow().user;

/** Whether the server answered "not set up" (the SQL hasn't run) or there's no server at all. */
const offState = error => (roadmapOff(error) ? 'off' : /fetch|network|load failed/i.test(error?.message || '') ? 'offline' : 'error');

let refreshing = null;
/**
 * Fetch the counts, the listed ideas, and (when there's something to ask about) your votes and your
 * ideas. `every` skips it when the last look was that recent.
 */
export function refreshRoadmap({ every = 0 } = {}) {
  if (refreshing) return refreshing;
  if (every && Date.now() - snap.server.at < every) return Promise.resolve(snap.server);
  refreshing = (async () => {
    const db = await getSupabase();
    if (!db) { set({ server: { ...snap.server, state: 'off', at: Date.now() } }); return snap.server; }
    const me = signedIn();
    const askMine = me || snap.local.sent.length > 0;
    const [c, r, m, v] = await Promise.all([
      db.rpc('roadmap_counts'),
      db.rpc('roadmap_requests'),
      askMine ? db.rpc('roadmap_mine') : Promise.resolve({ data: [] }),
      me ? db.rpc('roadmap_my_votes') : Promise.resolve({ data: [] }),
    ]);
    const err = c.error || r.error || m.error || v.error;
    if (err) { set({ server: { ...snap.server, state: offState(err), at: Date.now() } }); return snap.server; }
    set({
      server: {
        counts: countsFromRows(c.data),
        requests: Array.isArray(r.data) ? r.data : [],
        mine: Array.isArray(m.data) ? m.data.map(x => ({ ...x, id: String(x.id).toLowerCase() })) : [],
        myVotes: Array.isArray(v.data) ? v.data.map(x => (typeof x === 'string' ? x : x?.roadmap_my_votes)).filter(Boolean) : [],
        state: 'on',
        at: Date.now(),
      },
    });
    await flushVotes();
    return snap.server;
  })().catch(() => { set({ server: { ...snap.server, state: 'offline', at: Date.now() } }); return snap.server; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

/** Up next's light look: only when this phone has voted or sent an idea, and not too often. */
export function refreshForUpNext() {
  const { votes, sent } = snap.local;
  if (!Object.keys(votes).length && !sent.length) return Promise.resolve(snap.server);
  return refreshRoadmap({ every: UP_NEXT_EVERY });
}

let flushing = null;
/** Send votes the server doesn't have yet. Only for a signed-in account, once the SQL has run. */
export function flushVotes() {
  if (flushing) return flushing;
  const todo = pendingVotes(snap.local);
  if (!todo.length || !signedIn() || snap.server.state === 'off') return Promise.resolve();
  flushing = (async () => {
    const db = await getSupabase();
    if (!db) return;
    const done = [];
    for (const t of todo) {
      const { error } = await db.rpc('roadmap_vote', { p_item: t.item, p_on: t.on });
      if (error) {
        if (roadmapOff(error)) set({ server: { ...snap.server, state: 'off' } });
        break;
      }
      done.push(t);
    }
    if (!done.length) return;
    const myVotes = new Set(snap.server.myVotes);
    const counts = { ...snap.server.counts };
    for (const t of done) {
      const had = myVotes.has(t.item);
      if (t.on && !had) { myVotes.add(t.item); counts[t.item] = { votes: (counts[t.item]?.votes || 0) + 1, comments: counts[t.item]?.comments || 0 }; }
      if (!t.on && had) { myVotes.delete(t.item); counts[t.item] = { votes: Math.max(0, (counts[t.item]?.votes || 0) - 1), comments: counts[t.item]?.comments || 0 }; }
    }
    set({ local: markVotesSynced(snap.local, done), server: { ...snap.server, myVotes: [...myVotes], counts } });
  })().catch(() => {}).finally(() => { flushing = null; });
  return flushing;
}

/** Vote for an item, or take the vote back. Saved here at once; it goes up when it can. */
export function toggleRoadmapVote(id) {
  set({ local: toggleVote(snap.local, id, snap.server.myVotes) });
  flushVotes();
  return snap.local.votes[id].on;
}

/** Remember an idea sent from "Suggest something", so the roadmap shows it to you and tells you when it ships. */
export function noteSentIdea({ id, kind, title }) {
  set({ local: addSent(snap.local, { id, kind, title }) });
}

/** These "it's live" notes have been shown. */
export function markNotesTold(keys) {
  if (!keys.length) return;
  set({ local: markTold(snap.local, keys) });
}

// Signing in sends the votes made while signed out, and picks up the account's votes
if (typeof window !== 'undefined') {
  let was = signedIn();
  onAccount(() => {
    const now = signedIn();
    if (now && !was && (pendingVotes(snap.local).length || snap.server.state === 'on')) refreshRoadmap();
    was = now;
  });
}

// --------------------------- comments ----------------------------------------

/** One item's comments: { state: 'on' | 'off' | 'offline' | 'error', rows: [{ id, name, body, at, mine }] }. */
export async function loadComments(item) {
  const db = await getSupabase();
  if (!db) return { state: 'off', rows: [] };
  try {
    const { data, error } = await db.rpc('roadmap_comments', { p_item: item });
    if (error) {
      if (roadmapOff(error)) set({ server: { ...snap.server, state: 'off' } });
      return { state: offState(error), rows: [] };
    }
    return { state: 'on', rows: (Array.isArray(data) ? data : []).map(r => ({ id: r.id, name: r.name || null, body: r.body, at: r.created_at, mine: !!r.mine })) };
  } catch (e) { return { state: offState(e), rows: [] }; }
}

/** The name your comments go out under (see commentName): null shows as "A golfer". */
export function myCommentName() {
  const s = getState();
  return commentName(s.players?.[s.me]?.name, s.profile?.privacy?.profile);
}

/** Post a comment. Resolves to the new row, or throws with a message to show. */
export async function addComment(item, body) {
  const text = String(body || '').trim().slice(0, 500);
  if (!text) throw new Error('Write something first');
  if (!signedIn()) throw new Error('Sign in to comment');
  const db = await getSupabase();
  if (!db) throw new Error('Comments aren’t open yet');
  const id = crypto.randomUUID();
  const name = myCommentName();
  const { error } = await db.rpc('roadmap_add_comment', { p_id: id, p_item: item, p_body: text, p_name: name });
  if (error) {
    if (roadmapOff(error)) throw new Error('Comments aren’t open yet');
    if (error.code === '54000') throw new Error('That’s a lot of comments for one day. Try again tomorrow');
    throw new Error('Couldn’t post that. Check your signal and try again');
  }
  const c = snap.server.counts[item] || { votes: 0, comments: 0 };
  set({ server: { ...snap.server, counts: { ...snap.server.counts, [item]: { ...c, comments: c.comments + 1 } } } });
  return { id, name, body: text, at: new Date().toISOString(), mine: true };
}

/** Take back one of your comments. */
export async function deleteComment(item, id) {
  const db = await getSupabase();
  if (!db) throw new Error('Comments aren’t open yet');
  const { error } = await db.rpc('roadmap_delete_comment', { p_id: id });
  if (error) throw new Error('Couldn’t delete that. Try again');
  const c = snap.server.counts[item] || { votes: 0, comments: 0 };
  set({ server: { ...snap.server, counts: { ...snap.server.counts, [item]: { ...c, comments: Math.max(0, c.comments - 1) } } } });
}
