// Challenges on the server: a challenge goes up under its own 6-letter code (and its plan's code,
// when it's for a planned round), and each answer goes up as a move. A challenge on a plan reaches
// everyone with the plan (so the organizer's roll call can put it in); one from a Player card goes
// out as a link (?challenge=CODE) the other person answers from, no install needed.
// Until supabase/2026-10-04-challenges.sql has run (or with no server at all), challenges stay on
// this phone: whoever made it marks the other person's answer, and an agreed one still goes into
// the round as a side bet. Anything that couldn't be sent goes up on the next refresh.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, update, uid } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { ChallengesOffError, challengeLocalAdapter, challengeSupabaseAdapter } from './challenge-adapters.js';
import { newCode } from './sync-model.js';
import { challengeLife, challengeLink, challengesToGiveBack, cleanChallenge, mergeMoves, moveIdFor, withMove } from './challenges.js';
import { challengeMeta, planCodeOf, pushChallenge as pushChallengeWith, pushMoves } from './challenge-push.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

let adapterPromise = null;
/** The configured transport for challenges, or null when there's no server. */
export function getChallengeAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? challengeSupabaseAdapter(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = Promise.resolve(challengeLocalAdapter());
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
const hasServer = supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag());

// "Off": no server, or the server doesn't have the challenges tables yet. Learned on the first try.
let off = !hasServer;
const offListeners = new Set();
function noteError(e) {
  if (e instanceof ChallengesOffError && !off) {
    off = true;
    offListeners.forEach(l => l());
  }
}
const subOff = l => { offListeners.add(l); return () => offListeners.delete(l); };
/** Whether challenges can't leave this phone (no server, or its SQL hasn't run), as last learned. */
export const challengesOff = () => off;
/** True while challenges can't leave this phone, so screens say so and offer to mark answers. */
export function useChallengesOff() {
  return useSyncExternalStore(subOff, () => off, () => off);
}

const deps = adapter => ({ getState, update, adapter, newCode });
/** Send a challenge made here (see challenge-push.js). Resolves true once it's on the server. */
const pushChallenge = async id => pushChallengeWith(deps(await getChallengeAdapter()), id);

/**
 * Save a new challenge made on this phone (see challenges.js newChallenge) and send it. Resolves
 * to { id, code } (code null while it's on this phone only).
 */
export async function makeChallenge(ch) {
  update(s => {
    if (!s.challenges) s.challenges = {};
    // One set up between two others is neither side's on this phone: it puts their answers in
    s.challenges[ch.id] = { ...ch, mine: ch.setBy ? null : 'from', made: true, code: null, unsent: true };
  });
  try { await pushChallenge(ch.id); } catch (e) { noteError(e); }
  return { id: ch.id, code: getState().challenges?.[ch.id]?.code ?? null };
}

/**
 * Make a move on a challenge ({ side, move, stake?, roundId?, proxy? }): saved here straight away
 * (when it fits where the challenge stands) and sent. `proxy`: an answer put in for someone by the
 * organizer or scorekeeper (challenges.js PROXY). Resolves true when it was made, false when it didn't fit.
 */
export async function moveChallenge(id, { proxy = false, ...move }) {
  const ch = getState().challenges?.[id];
  if (!ch) return false;
  const m = { id: moveIdFor(uid('m'), proxy), at: Date.now(), ...move };
  const next = withMove(ch, m);
  if (!next) return false;
  const made = next.moves.at(-1);
  update(s => {
    const c = s.challenges?.[id];
    if (!c) return;
    c.moves = next.moves;
    if (c.code) c.unsentMoves = { ...c.unsentMoves, [made.id]: true };
  });
  const cur = getState().challenges?.[id];
  if (!cur?.code) return true; // on this phone only for now: it goes up with the challenge
  try {
    const adapter = await getChallengeAdapter();
    if (!adapter) return true;
    await adapter.addMove(cur.code, planCodeOf(getState(), cur) ?? null, made);
    update(s => { const c = s.challenges?.[id]; if (c?.unsentMoves) { delete c.unsentMoves[made.id]; if (!Object.keys(c.unsentMoves).length) delete c.unsentMoves; } });
  } catch (e) { noteError(e); }
  return true;
}

/** Put the challenges that went into a round on record ("In the round"), from the phone starting it. */
export function markChallengesOn(ids, roundId) {
  for (const id of ids || []) moveChallenge(id, { side: 'keeper', move: 'on', roundId });
}

/**
 * Give back the challenges that went into a round this phone set up, when the round goes before it's
 * finished (deleted, or kept for another day): they're agreed again for the next round together.
 */
export function challengesBack(round) {
  for (const id of challengesToGiveBack(getState(), round)) moveChallenge(id, { side: 'keeper', move: 'back', roundId: round.id });
}

/** Put a server copy onto this phone: new ones are added, known ones pick up moves they don't have. */
function applyRemote(code, remote, planId = null) {
  const meta = cleanChallenge(remote?.meta);
  if (!meta) return;
  const cur = getState().challenges?.[meta.id];
  const moves = mergeMoves(cur?.moves, remote.moves);
  if (cur && JSON.stringify(moves) === JSON.stringify(cur.moves || []) && cur.code === code) return;
  update(s => {
    if (!s.challenges) s.challenges = {};
    const c = s.challenges[meta.id];
    if (c) {
      c.moves = moves;
      c.code = code;
      c.syncedAt = Date.now();
      return;
    }
    s.challenges[meta.id] = { ...challengeMeta(meta), plan: meta.plan ? { ...meta.plan, id: planId } : null, code, moves, mine: null, made: false, syncedAt: Date.now() };
  });
}

/** Send anything unsent, then pick up the latest for every shared plan and every challenge from a link. */
export async function refreshChallenges() {
  // Before the challenges SQL has run there's nothing to send or fetch (learned on the first try)
  if (off) return;
  const adapter = await getChallengeAdapter().catch(() => null);
  if (!adapter) return;
  try {
    // One at a time, so one that can't go up (its plan gone from the server) never holds up the rest
    for (const ch of Object.values(getState().challenges || {})) {
      if (!ch?.unsent && !(ch?.code && ch.unsentMoves)) continue;
      try {
        if (ch.unsent) await pushChallengeWith(deps(adapter), ch.id);
        else await pushMoves(deps(adapter), ch.id);
      } catch (e) {
        if (e instanceof ChallengesOffError) throw e;
      }
    }
    const state = getState();
    for (const plan of Object.values(state.plans || {})) {
      if (!plan?.code || plan.gone || plan.status === 'off') continue;
      for (const r of await adapter.fetchForPlan(plan.code)) applyRemote(r.code, r, plan.id);
      // A round kept for another day: the challenges made for the plans it came from moved with it
      for (const e of Array.isArray(plan.movedFrom) ? plan.movedFrom : []) {
        if (!e?.code || e.code === plan.code) continue;
        for (const r of await adapter.fetchForPlan(e.code)) applyRemote(r.code, r, state.plans?.[e.id]?.code === e.code ? e.id : null);
      }
    }
    // Player card challenges still going (one that's over never changes again)
    for (const ch of Object.values(getState().challenges || {})) {
      if (!ch?.code || ch.plan || !cleanChallenge(ch) || challengeLife(getState(), ch) !== 'live') continue;
      const r = await adapter.fetch(ch.code);
      if (r) applyRemote(ch.code, r);
    }
  } catch (e) { noteError(e); }
}

/** Keep challenges fresh while a plan (or one challenge) is on screen: now, on every change, and when the phone wakes. */
export function useChallengesLive({ planCode = null, code = null } = {}) {
  useEffect(() => {
    if (!planCode && !code) return;
    let stopped = false, unsub = null, timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { if (!stopped) refreshChallenges(); }, 300); };
    refreshChallenges();
    getChallengeAdapter().then(adapter => {
      if (stopped || !adapter) return;
      unsub = adapter.subscribe({ planCode, code }, ev => { if (ev.type !== 'connected') soon(); });
    }).catch(() => {});
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsub?.();
      document.removeEventListener('visibilitychange', wake);
    };
  }, [planCode, code]);
}

/**
 * Open a challenge from its link and keep it on this phone (you're the one it was sent to, unless
 * you made it). Resolves to its id, or null when the code isn't found. Throws with no signal or server.
 */
export async function openChallengeLink(code) {
  const adapter = await getChallengeAdapter();
  if (!adapter) throw new ChallengesOffError();
  let remote;
  try { remote = await adapter.fetch(code); } catch (e) { noteError(e); throw e; }
  const meta = cleanChallenge(remote?.meta);
  if (!meta) return null;
  const known = getState().challenges?.[meta.id];
  if (!known) {
    // A challenge on a plan you have goes with that plan; any other is yours to answer
    const plan = meta.plan?.code ? Object.values(getState().plans || {}).find(p => p?.code === meta.plan.code) : null;
    update(s => {
      if (!s.challenges) s.challenges = {};
      // One set up between two others: which of the two you are is picked on its page
      s.challenges[meta.id] = { ...challengeMeta(meta), plan: meta.plan ? { ...meta.plan, id: plan?.id ?? null } : null, code, moves: mergeMoves([], remote.moves), mine: meta.plan || meta.setBy ? null : 'to', made: false, syncedAt: Date.now() };
    });
  } else applyRemote(code, remote);
  return meta.id;
}

/** Say which of the two you are, on a challenge someone set up between you and someone else (from its link). */
export function pickChallengeSide(id, side) {
  update(s => { const c = s.challenges?.[id]; if (c && !c.made && !c.plan && c.setBy && (side === 'from' || side === 'to')) c.mine = side; });
}

/** The link for a challenge on the server, or null while it's on this phone only. */
export function challengeShareLink(ch) {
  return ch?.code ? challengeLink(location.origin, ch.code) : null;
}

/** Take a challenge off this phone (one that's over), and its talk. The other phone keeps its own copy. */
export function forgetChallenge(id) {
  update(s => {
    if (s.challenges) delete s.challenges[id];
    if (s.talk) delete s.talk[`challenge:${id}`];
  });
}
