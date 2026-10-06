// Notifications on this phone: whether it can get them, turning them on and off, the soft ask
// after planning or joining a round (notify-ask.js decides when), and asking the server to send one
// of the pushes (push-events.js, api/push.js). All of it is off without VITE_VAPID_PUBLIC_KEY: no
// ask, no Settings row, no subscription and nothing sent. Every call is quiet on failure, and
// sending never holds anything up.
//
// The subscription is saved in push_subscriptions (supabase/2026-10-08-push.sql) under your
// account. Until that SQL has run the save fails quietly and nothing arrives; turning them on
// still keeps the browser's permission, so it works from the next launch after it runs.
import { useSyncExternalStore } from 'react';
import { getSupabase, supabaseConfigured } from './supabase.js';
import { getState } from './store.js';
import { afterNotNow, afterOff, afterOn, afterShown, pushSupport, settingsRow, shouldAsk } from './notify-ask.js';
import { carriedPushes, carryPushes, cleanPushRequest, finishResults, paidPushes, pushSlot, rememberPush, talkPush } from './push-events.js';

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
/** Push is switched on for this build. */
export const pushConfigured = !!KEY && supabaseConfigured;
const PREFS = 'bb-notify';

// --------------------------- this phone -------------------------------------

/** { ok, why } for this phone (notify-ask.js pushSupport). */
export function support() {
  if (!pushConfigured || typeof window === 'undefined') return { ok: false, why: 'no-key' };
  const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  return pushSupport({
    key: KEY, ua: navigator.userAgent, touch: navigator.maxTouchPoints > 1, standalone,
    serviceWorker: 'serviceWorker' in navigator, pushManager: 'PushManager' in window, notification: 'Notification' in window,
  });
}

const permission = () => (typeof Notification === 'undefined' ? 'denied' : Notification.permission);

function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; } }
function savePrefs(p) { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* storage blocked */ } }

// --------------------------- status (for UI) --------------------------------

let snap = { asking: null, subscribed: false, busy: false, tick: 0 };
const listeners = new Set();
function set(patch) { snap = { ...snap, ...patch }; listeners.forEach(l => l()); }
const sub = l => { listeners.add(l); return () => listeners.delete(l); };
/** { asking: 'planned' | 'joined' | null, subscribed, busy }: the soft ask showing, and the Settings row's state. */
export function useNotify() { return useSyncExternalStore(sub, () => snap, () => snap); }

async function session() {
  const db = await getSupabase();
  if (!db) return { db: null, user: null, token: null };
  const { data } = await db.auth.getSession();
  return { db, user: data?.session?.user || null, token: data?.session?.access_token || null };
}

/** The Settings row for this phone: { show, on, disabled, sub } (notify-ask.js settingsRow). */
export function notifyRow(signedIn) {
  return settingsRow({ support: support(), permission: permission(), signedIn, prefs: loadPrefs(), subscribed: snap.subscribed });
}

// --------------------------- subscribing ------------------------------------

const toKey = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

/** This phone's push subscription (made now if `make`), or null. */
async function subscription(make) {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  if (!reg?.pushManager) return null;
  const have = await reg.pushManager.getSubscription();
  if (have || !make) return have;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(KEY) });
}

/** Save this phone's subscription on your account. False when it couldn't be (no table yet, offline). */
async function save(s) {
  const { db, user } = await session();
  if (!db || !user || !s) return false;
  const j = s.toJSON();
  if (!j?.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const { error } = await db.from('push_subscriptions').upsert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
  return !error;
}

/**
 * Turn notifications on: the browser's own prompt (only from a tap), then subscribe and save it.
 * Resolves 'on', 'denied' (said no in the browser) or 'failed'.
 */
export async function turnOn() {
  if (!support().ok) return 'failed';
  set({ busy: true });
  try {
    const p = permission() === 'granted' ? 'granted' : await Notification.requestPermission();
    if (p !== 'granted') { set({ tick: snap.tick + 1 }); return 'denied'; }
    savePrefs(afterOn(loadPrefs()));
    const s = await subscription(true);
    set({ subscribed: !!s });
    if (s) save(s).catch(() => {});
    return s ? 'on' : 'failed';
  } catch { return 'failed'; }
  finally { set({ busy: false }); }
}

/** Turn them off on this phone: unsubscribe, take it off your account, and never ask again from here. */
export async function turnOff() {
  savePrefs(afterOff(loadPrefs()));
  set({ busy: true });
  try {
    const s = await subscription(false);
    if (s) {
      const endpoint = s.endpoint;
      await s.unsubscribe().catch(() => {});
      const { db, user } = await session();
      if (db && user) await db.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    }
  } catch { /* off on this phone either way */ }
  set({ busy: false, subscribed: false });
}

/**
 * At launch and after signing in: when notifications are on here, make sure your account has this
 * phone's subscription (a browser can renew it, and a sign-in on this phone is a new account).
 */
export async function refreshSubscription() {
  if (!support().ok || permission() !== 'granted' || loadPrefs().off) return;
  try {
    const s = await subscription(true);
    set({ subscribed: !!s });
    if (s) await save(s);
  } catch { /* try again next launch */ }
}

/**
 * Signing out: take this phone off the account first, so the next person to sign in here doesn't
 * get the last one's pushes. The browser keeps its permission for whoever signs in next.
 */
export async function forgetThisPhone() {
  if (!pushConfigured) return;
  try {
    const s = await subscription(false);
    const { db, user } = await session();
    if (s && db && user) await db.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', s.endpoint);
  } catch { /* signing out goes ahead either way */ }
  set({ subscribed: false });
}

let booted = false;
/** Call once at launch: keep this phone's subscription on whichever account signs in. */
export function bootPush() {
  if (!pushConfigured || booted) return;
  booted = true;
  let uid = null;
  import('./cloud.js').then(c => {
    const check = () => {
      const id = c.accountNow().user?.id || null;
      if (id && id !== uid) refreshSubscription();
      uid = id;
    };
    c.onAccount(check);
    check();
  }).catch(() => {});
}

// --------------------------- the soft ask -----------------------------------

let askedThisSession = false;

/**
 * Something that earns the ask just happened ('planned' or 'joined'): show our own sheet a moment
 * later, when notify-ask.js says it's a good time. Never more than once a launch.
 */
export function notifyMoment(moment) {
  if (!pushConfigured || askedThisSession) return;
  setTimeout(async () => {
    if (askedThisSession || document.visibilityState !== 'visible') return;
    const { user } = await session().catch(() => ({ user: null }));
    if (!shouldAsk({ moment, support: support(), permission: permission(), signedIn: !!user, prefs: loadPrefs() })) return;
    askedThisSession = true;
    savePrefs(afterShown(loadPrefs()));
    set({ asking: moment });
  }, 1500);
}

/** The sheet's answer: 'on' (it goes on to the browser's prompt) or anything else for Not now. */
export async function answerAsk(answer) {
  set({ asking: null });
  if (answer === 'on') return turnOn();
  savePrefs(afterNotNow(loadPrefs()));
  return 'later';
}

// --------------------------- sending ----------------------------------------

const sent = new Map();
const waiting = new Map();

/**
 * Ask the server to send one push (push-events.js). Fire and forget: after a few seconds (so the
 * round or plan has reached the server and your account), once a session (who's in: once per
 * change of answer, and a newer answer replaces one still waiting), signed in only, and silent
 * whatever happens.
 */
export function sendPush(request, { delay = 4000 } = {}) {
  if (!pushConfigured) return;
  const req = cleanPushRequest(request);
  if (!req) return;
  const slot = pushSlot(req);
  if (!rememberPush(sent, req)) return;
  // A newer answer replaces one still waiting (the same answer again was stopped just above)
  if (slot) { clearTimeout(waiting.get(slot)); waiting.delete(slot); }
  const timer = setTimeout(async () => {
    if (slot) waiting.delete(slot);
    try {
      const { token } = await session();
      if (!token) return;
      await fetch('/api/push', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(request) });
    } catch { /* a push is a nice-to-have */ }
  }, delay);
  if (slot) waiting.set(slot, timer);
}

// The moments, one line at each call site
const myFirst = () => { const s = getState(); return String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || ''; };

/** You shared a plan: everyone on it hears about it. */
export function pushPlanInvite(plan) {
  if (!plan?.code) return;
  sendPush({ kind: 'invite', scope: 'plan', code: plan.code, data: { name: myFirst(), day: plan.date, course: plan.course?.name } });
}

/** You shared a round: the others in it with an account hear it's live. */
export function pushRoundInvite(round) {
  const code = round?.shared?.code;
  if (code) sendPush({ kind: 'invite', scope: 'round', code, data: { name: myFirst(), course: round.course?.name } });
}

/** You answered a plan from your own phone: its organizer hears who's in. */
export function pushRsvp(plan, status, name) {
  if (!plan?.code || plan.host || !status) return;
  sendPush({ kind: 'rsvp', scope: 'plan', code: plan.code, topic: status, data: { name: name || myFirst(), status, day: plan.date, course: plan.course?.name } }, { delay: 1500 });
}

/**
 * You finished a shared round: everyone in it hears it's done, and how they did (won, their place,
 * square), never an amount (push-events.js finishResults). Just-playing seats and a card with no
 * game get the plain "Round finished".
 */
export function pushRoundFinished(round) {
  const code = round?.shared?.code || round?.shareCode;
  if (!pushConfigured || !code) return;
  const request = results => sendPush({ kind: 'finished', scope: 'round', code, results, data: { course: round.course?.name } });
  // The money logic is already loaded on the scoring screen; loaded here only when push is on
  import('./round.js').then(({ bettors, cardOnly, roundResults }) => {
    if (cardOnly(round)) return request(undefined);
    request(finishResults(roundResults(round).balances, bettors(round).map(p => p.id)));
  }).catch(() => request(undefined));
}

/**
 * Rows just marked on the shared Tab (tab-sync.js): the people paid hear it, so does the other
 * person when you ask to roll a balance to next time, and the person who asked when you answer
 * (push-events.js paidPushes, carryPushes, carriedPushes).
 */
export function pushTab(rows) {
  if (!pushConfigured) return;
  const name = myFirst();
  for (const req of [...paidPushes(rows, name), ...carryPushes(rows, name), ...carriedPushes(rows, name)]) sendPush(req, { delay: 1500 });
}

/**
 * You posted trash talk in a thread whose target is `t` (talk-sync.js threadTarget): the others on
 * it hear there's something new, never what it says (push-events.js talkPush).
 */
export function pushTalk(t, { id, name, course, day } = {}) {
  if (!pushConfigured) return;
  const req = talkPush(t, { id, name: String(name || '').trim().split(/\s+/)[0] || myFirst(), course, day });
  if (req) sendPush(req, { delay: 2500 });
}
