// The browser side of app updates: register the service worker, notice when a new version has
// downloaded and is waiting, and swap to it only when app-update.js says so. The new worker never
// takes over on its own (see public/sw.js), so a phone mid-round keeps the version it started on.
import { useSyncExternalStore } from 'react';
import { getState } from './store.js';
import { isNewerBuild, openedFromLink, readBuilt, updateAction, updateSafe, versionCheckDue } from './app-update.js';
import { BUILT } from './build-info.js';

// Matches the message public/sw.js listens for
const APPLY = 'apply-update';
// "Launching": the first few seconds after opening, before the first tap or key press
const LAUNCH_MS = 10000;
// How often a long-open app asks for a new version when it comes back to the screen
const CHECK_MS = 30 * 60000;

let reg = null;
let ready = false;
let asked = false;
let touched = false;
let lastCheck = 0;
let lastVersion = 0;
// The newest build this phone has already asked the service worker to fetch
let chased = 0;
// Read when this file first runs, before the app tidies ?join=, ?plan= or a sign-in code out of the address bar
const fromLink = openedFromLink(location.search, location.hash);
const listeners = new Set();

const launching = () => !touched && performance.now() < LAUNCH_MS;

function setReady(v) {
  if (ready === v) return;
  ready = v;
  listeners.forEach(l => l());
}

/** A new version is waiting: take it now if that's safe at launch, otherwise let Up next offer it. */
function found() {
  if (!reg?.waiting) return;
  const action = updateAction({ waiting: true, safe: updateSafe(getState()), launching: launching(), fromLink });
  if (action === 'apply') applyUpdate();
  else setReady(true);
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
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, () => { touched = true; }, { once: true, capture: true }));
  // Only this tab asked for the swap, so only this tab reloads (another open tab keeps going)
  sw.addEventListener('controllerchange', () => { if (asked) location.reload(); });
  addEventListener('load', () => sw.register('/sw.js').then(r => {
    reg = r;
    lastCheck = Date.now();
    found();
    checkVersion();
    // With no controller yet this is the very first install, which isn't an update
    const follow = next => next?.addEventListener('statechange', () => { if (next.state === 'installed' && sw.controller) found(); });
    follow(r.installing);
    r.addEventListener('updatefound', () => follow(r.installing));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check(); checkVersion(); } });
  }).catch(() => {}));
}
