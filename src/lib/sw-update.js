// The browser side of app updates: register the service worker, notice when a new version has
// downloaded and is waiting, and swap to it only when app-update.js says so. The new worker never
// takes over on its own (see public/sw.js), so a phone mid-round keeps the version it started on.
// A swap at launch happens behind the splash (updateBehindSplash), before the first screen shows,
// so the page never reloads in front of you: a version that finishes downloading once the app is
// on the screen waits for Up next's "Update ready", or for the next launch.
import { useSyncExternalStore } from 'react';
import { getState } from './store.js';
import { isNewerBuild, openedFromLink, readBuilt, updateAction, updateSafe, versionCheckDue } from './app-update.js';
import { BUILT } from './build-info.js';

// Matches the message public/sw.js listens for
const APPLY = 'apply-update';
// How often a long-open app asks for a new version when it comes back to the screen
const CHECK_MS = 30 * 60000;

let reg = null;
let ready = false;
let asked = false;
// True only while the splash is still up: the one moment a reload costs nothing (main.jsx)
let launching = false;
let launchCheck = null;
let lastCheck = 0;
let lastVersion = 0;
// The newest build this phone has already asked the service worker to fetch
let chased = 0;
// Read when this file first runs, before the app tidies ?join=, ?plan= or a sign-in code out of the address bar
const fromLink = typeof location === 'undefined' ? false : openedFromLink(location.search, location.hash);
const listeners = new Set();

function setReady(v) {
  if (ready === v) return;
  ready = v;
  listeners.forEach(l => l());
}

/** A new version is waiting: take it now if that's safe at launch, otherwise let Up next offer it. */
function found() {
  if (!reg?.waiting) return;
  const action = updateAction({ waiting: true, safe: updateSafe(getState()), launching, fromLink });
  if (action === 'apply') applyUpdate();
  else setReady(true);
}

/** True once this tab has asked for the swap: the page is about to reload. */
export function reloadPending() {
  return asked;
}

/**
 * Before the app renders: a new version that downloaded earlier and is waiting swaps in now, while
 * the splash is still up, so the first screen you see is already the new one. Resolves to true when
 * a reload is coming (main.jsx keeps the splash up for it), false when there's nothing to do.
 */
export function updateBehindSplash() {
  if (launchCheck) return launchCheck;
  launchCheck = (async () => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return false;
    const r = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (!r?.waiting) return false;
    reg = r;
    launching = true;
    try { found(); } finally { launching = false; }
    return asked;
  })();
  return launchCheck;
}

/** Swap to the waiting version and reload. Does nothing while a round is going on. */
export function applyUpdate() {
  if (!reg?.waiting || !updateSafe(getState())) return false;
  asked = true;
  reg.waiting.postMessage({ type: APPLY });
  return true;
}

/** True once a new version is downloaded and waiting (Up next decides whether to show it). */
export function useUpdateReady() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => ready, () => false);
}

function check() {
  if (!reg || Date.now() - lastCheck < CHECK_MS) return;
  lastCheck = Date.now();
  reg.update().catch(() => {});
}

/** Ask the service worker for the new version now, once per newer build seen. */
function chase(theirs) {
  if (!reg || !isNewerBuild(theirs, BUILT) || theirs <= chased) return;
  chased = theirs;
  lastCheck = Date.now();
  reg.update().catch(() => {});
}

/**
 * Read /version.json (at launch, then at most every 10 minutes when the app comes back to the screen)
 * and chase a newer build. The query string keeps an older service worker from answering with a
 * saved copy. A missing file, no signal or a dev build does nothing.
 */
async function checkVersion() {
  if (!BUILT || !versionCheckDue(Date.now(), lastVersion)) return;
  lastVersion = Date.now();
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) chase(readBuilt(await res.json()));
  } catch { /* offline, or no version.json */ }
}

/** A shared round says a newer build kept its score (sync.js): fetch that version so Up next can offer it. */
export function noticeNewerBuild(theirs) {
  chase(theirs);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  // Only this tab asked for the swap, so only this tab reloads (another open tab keeps going)
  sw.addEventListener('controllerchange', () => { if (asked) location.reload(); });
  addEventListener('load', () => sw.register('/sw.js').then(r => {
    reg = r;
    lastCheck = Date.now();
    // A version already waiting was handled behind the splash (updateBehindSplash); here it can only be offered
    found();
    checkVersion();
    // With no controller yet this is the very first install, which isn't an update
    const follow = next => next?.addEventListener('statechange', () => { if (next.state === 'installed' && sw.controller) found(); });
    follow(r.installing);
    r.addEventListener('updatefound', () => follow(r.installing));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); checkVersion(); } });
  }).catch(() => {}));
}
