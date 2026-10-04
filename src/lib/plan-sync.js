// Upcoming rounds on the server: the organizer's phone shares a plan under a 6-letter code,
// friends answer and vote from the group link, and everyone's phone picks up the latest when
// it looks. Each person only ever writes their own answer, so nothing needs merging. Once
// supabase/2026-10-04-plan-lock.sql has run, the server holds everyone to that (plan-lock.js):
// only the organizer changes the plan, and an answer made from someone's own phone is theirs.
// Until the upcoming rounds SQL has run (or with no server at all), plans stay on the
// organizer's phone: they mark who's in themselves, and the group link stays hidden.
import { useEffect, useSyncExternalStore } from 'react';
import { getState, update } from './store.js';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { PlansOffError, planLocalAdapter, planSupabaseAdapter } from './plan-adapters.js';
import { newCode, stable } from './sync-model.js';
import { RSVPS, answersFrom, betVoteChoice, cleanName, daysUntil, gameVoteChoice, movedLocalMe, movedPlanOf, planLink, planMeta } from './plans.js';
import { PAY_APP_IDS } from './pay.js';
import { deviceReady, myDevice } from './device.js';

const localFlag = () => { try { return localStorage.getItem('bb-sync-local') === '1'; } catch { return false; } };

let adapterPromise = null;
/** The configured transport for plans, or null when there's no server (local-only planning). */
export function getPlanAdapter() {
  if (!adapterPromise) {
    if (supabaseConfigured) adapterPromise = getSupabase().then(db => (db ? planSupabaseAdapter(db) : null));
    else if (import.meta.env.DEV || localFlag()) adapterPromise = deviceReady().then(() => planLocalAdapter(myDevice));
    else adapterPromise = Promise.resolve(null);
  }
  return adapterPromise;
}
const hasServer = supabaseConfigured || import.meta.env.DEV || (typeof localStorage !== 'undefined' && localFlag());

// "Off": no server, or the server doesn't have the plan tables yet. Learned on the first try.
let off = !hasServer;
let offSnap = off;
const offListeners = new Set();
function noteError(e) {
  if (e instanceof PlansOffError && !off) {
    off = true; offSnap = true;
    offListeners.forEach(l => l());
  }
}
const subOff = l => { offListeners.add(l); return () => offListeners.delete(l); };
/** True while group links can't be used, so screens hide them and plan on this phone only. */
export function usePlansOff() {
  return useSyncExternalStore(subOff, () => offSnap, () => offSnap);
}

// --------------------------- answers --------------------------------------

/** Send one answer and its votes. Resolves false when the server kept someone else's answer instead. */
async function pushAnswer(adapter, code, who, a) {
  if (!a || !RSVPS.includes(a.status)) return true;
  // The server only takes the payment apps it knows and handles up to 80 characters
  const pay = PAY_APP_IDS.includes(a.payApp) && a.payHandle ? { payApp: a.payApp, payHandle: String(a.payHandle).slice(0, 80) } : { payApp: null, payHandle: null };
  const kept = await adapter.setRsvp(code, { who, name: cleanName(a.name) || 'Guest', status: a.status, ...pay });
  if (kept === false) return false;
  await Promise.all([adapter.setVote(code, who, 'game', gameVoteChoice(a)), adapter.setVote(code, who, 'bet', betVoteChoice(a))]);
  return true;
}

/**
 * Save `who`'s answer and votes on this phone and, when the plan is shared, on the server.
 * An answer that can't be sent is kept and goes up on the next refresh. Resolves true when sent,
 * false when it couldn't be (it goes up later), and 'taken' when the answer is someone else's
 * (they answered from their own phone): this phone then takes the server's copy back.
 */
export async function answerPlan(id, who, patch) {
  update(s => {
    const p = s.plans?.[id];
    if (!p) return;
    p.answers = { ...p.answers, [who]: { ...p.answers?.[who], ...patch, at: Date.now() } };
    if (p.code) p.unsent = { ...p.unsent, [who]: true };
  });
  const plan = getState().plans?.[id];
  if (!plan?.code) return true;
  try {
    const adapter = await getPlanAdapter();
    if (!adapter) return false;
    const kept = await pushAnswer(adapter, plan.code, who, plan.answers[who]);
    update(s => { const p = s.plans?.[id]; if (p?.unsent) delete p.unsent[who]; });
    if (!kept) { await refreshPlan(id); return 'taken'; }
    return true;
  } catch (e) { noteError(e); return false; }
}

// --------------------------- the plan itself --------------------------------

/** Share a plan: it gets a code and a group link. Throws PlansOffError until the SQL has run. */
export async function sharePlan(id) {
  const plan = getState().plans?.[id];
  if (!plan) throw new Error('Plan not found');
  if (plan.code) return plan.code;
  const adapter = await getPlanAdapter();
  if (!adapter) throw new PlansOffError();
  const code = newCode();
  try {
    await adapter.create(code, planMeta(plan));
    // Every answer the organizer already has (their own, and anyone they marked) goes up too
    for (const [who, a] of Object.entries(plan.answers || {})) await pushAnswer(adapter, code, who, a);
  } catch (e) { noteError(e); throw e; }
  update(s => { const p = s.plans?.[id]; if (p) { p.code = code; p.syncedAt = Date.now(); } });
  // A round kept for another day: its old plan points friends to this one now it has a link
  for (const e of Array.isArray(plan.movedFrom) ? plan.movedFrom : []) {
    const old = e?.id && getState().plans?.[e.id];
    if (old?.host) await editPlan(old.id, p => { p.movedTo = { id, code, date: plan.date || null }; });
  }
  return code;
}

/** What a screen says when the server kept a plan as it was because this isn't the phone that shared it. */
export const PLAN_LOCKED = 'This plan was shared from another phone, so changes made here stay on this phone';

/**
 * Send the organizer's plan to the server. True when it went up (or there's nothing on the server
 * to change any more), 'taken' when the server kept its own copy because this isn't the phone (or
 * account) that shared it: a backup restored on a new phone, say, before signing in.
 */
async function pushMeta(adapter, plan) {
  if ((await adapter.updateMeta(plan.code, planMeta(plan))) !== false) return true;
  return (await adapter.fetch(plan.code)) ? 'taken' : true;
}

/**
 * Change the plan on the organizer's phone and send it to the group (mutates a draft in `fn`).
 * Resolves true when sent, false when it couldn't be (it goes up on the next refresh), and
 * 'taken' when the server keeps its own copy (PLAN_LOCKED): the change stays on this phone.
 */
export async function editPlan(id, fn) {
  update(s => {
    const p = s.plans?.[id];
    if (!p) return;
    fn(p);
    if (p.code) p.metaUnsent = true;
  });
  const plan = getState().plans?.[id];
  if (!plan?.code || !plan.host) return true;
  try {
    const adapter = await getPlanAdapter();
    const sent = adapter ? await pushMeta(adapter, plan) : true;
    update(s => { const p = s.plans?.[id]; if (p) delete p.metaUnsent; });
    return sent;
  } catch (e) { noteError(e); return false; }
}

/** Take a plan off this phone. The organizer's copy comes off the server too. */
export async function removePlan(id) {
  const plan = getState().plans?.[id];
  update(s => { delete s.plans?.[id]; });
  if (plan?.host && plan.code) {
    try { await (await getPlanAdapter())?.remove(plan.code); } catch { /* it'll be tidied up later */ }
  }
}

/** Put what the server has onto this phone's copy. Only writes when something changed. */
function applyRemote(id, remote) {
  const answers = answersFrom(remote.rsvps, remote.votes);
  const cur = getState().plans?.[id];
  if (!cur) return;
  const next = structuredClone(cur);
  if (!cur.host) {
    const meta = remote.meta || {};
    for (const k of Object.keys(planMeta(next))) if (!(k in meta)) delete next[k];
    Object.assign(next, meta, { id });
  }
  // Answers this phone hasn't managed to send yet win over the server's older copy
  for (const who of Object.keys(cur.unsent || {})) if (cur.answers?.[who]) answers[who] = cur.answers[who];
  next.answers = answers;
  delete next.gone;
  if (stable(next) === stable(cur)) return;
  next.syncedAt = Date.now();
  update(s => { if (s.plans?.[id]) s.plans[id] = next; });
}

/** Send anything unsent, then pick up the latest answers (and, for friends, the latest plan). */
export async function refreshPlan(id) {
  const plan = getState().plans?.[id];
  if (!plan?.code) return;
  try {
    const adapter = await getPlanAdapter();
    if (!adapter) return;
    if (plan.host && plan.metaUnsent) {
      // Kept by the server (not the phone that shared it): no use sending it again
      await pushMeta(adapter, plan);
      update(s => { const p = s.plans?.[id]; if (p) delete p.metaUnsent; });
    }
    for (const who of Object.keys(plan.unsent || {})) {
      await pushAnswer(adapter, plan.code, who, plan.answers?.[who]);
      update(s => { const p = s.plans?.[id]; if (p?.unsent) delete p.unsent[who]; });
    }
    const remote = await adapter.fetch(plan.code);
    if (!remote) {
      // The organizer took it down: a friend's copy says so; the organizer's own stays local
      if (!plan.host) update(s => { const p = s.plans?.[id]; if (p) p.gone = true; });
      return;
    }
    applyRemote(id, remote);
    // A friend's plan whose round moved to another day: pick up the new plan, as the same person
    const now = getState().plans?.[id];
    if (!now?.host && now?.movedTo?.code && !movedPlanOf(getState(), now)) await openPlanLink(now.movedTo.code);
  } catch (e) { noteError(e); }
}

/** Keep one plan fresh while it's on screen: now, on every change, and when the phone wakes. */
export function usePlanLive(id, code) {
  useEffect(() => {
    if (!id || !code) return;
    let stopped = false, unsub = null, timer = null;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => { if (!stopped) refreshPlan(id); }, 250); };
    refreshPlan(id);
    getPlanAdapter().then(adapter => {
      if (stopped || !adapter) return;
      unsub = adapter.subscribe(code, ev => { if (ev.type !== 'connected') soon(); });
    });
    const wake = () => { if (document.visibilityState === 'visible') soon(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', soon);
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsub?.();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', soon);
    };
  }, [id, code]);
}

/** Refresh every shared plan once (Up next calls this when it opens). A friend's started plan keeps looking until the live round's link arrives. */
export function refreshPlans() {
  for (const p of Object.values(getState().plans || {})) {
    // A friend's started plan also until its day has gone by, so a round kept for another day reaches them
    if (p?.code && (p.status !== 'started' || (!p.host && (!p.liveCode || (!p.movedTo && (daysUntil(p.date) ?? -99) >= -1))))) refreshPlan(p.id);
  }
}

/**
 * Open a plan from a link (?plan=CODE, or ?plan=CODE&p=WHO for one person's own link) and keep
 * it on this phone, so it shows on Up next. Resolves to the plan's id, or null when the code
 * isn't found. Throws when there's no signal or no server.
 */
export async function openPlanLink(code, who = null) {
  const adapter = await getPlanAdapter();
  if (!adapter) throw new PlansOffError();
  let remote;
  try { remote = await adapter.fetch(code); } catch (e) { noteError(e); throw e; }
  const existing = Object.values(getState().plans || {}).find(p => p.code === code);
  if (!remote) {
    if (existing && !existing.host) update(s => { s.plans[existing.id].gone = true; });
    return existing?.id ?? null;
  }
  const meta = remote.meta || {};
  const known = w => !!w && (meta.people?.some(p => p.id === w) || remote.rsvps?.some(r => r.who === w));
  if (existing) {
    const me = !existing.host && !existing.localMe ? (known(who) ? who : movedLocalMe(getState(), meta)) : null;
    if (me) update(s => { s.plans[existing.id].localMe = me; });
    applyRemote(existing.id, remote);
    return existing.id;
  }
  const id = meta.id && !getState().plans?.[meta.id] ? meta.id : `pl_${code}`;
  // The new plan of a round kept for another day: you're who you were on the old one
  const me = known(who) ? who : movedLocalMe(getState(), meta);
  update(s => {
    if (!s.plans) s.plans = {};
    s.plans[id] = { ...meta, id, code, host: false, answers: answersFrom(remote.rsvps, remote.votes), localMe: me, syncedAt: Date.now() };
  });
  return id;
}

/** The group link, or one person's own link. */
export function planShareLink(plan, who = null) {
  return plan?.code ? planLink(location.origin, plan.code, who) : null;
}
