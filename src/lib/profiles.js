// Profiles: your profile on the server, the profiles of people you've played with, photos, and
// "Delete your account". Offline first, like cloud.js: everything is saved on the phone first (your
// profile also rides along in your account's saved data, see cloud-model.js), and goes to the
// server when you're signed in and have signal. Until the profiles SQL is run
// (supabase/2026-10-01-profiles.sql) the server answers "no such table or function": the app notes
// it quietly, keeps working from the phone's copy, and tries again on a later load.
//
// API for screens (all safe to call signed out, offline, or before the SQL is run):
//
//   useMyProfile()            -> { playerId, name, index, payApp, payHandle, avatar, homeCourse,
//                                  privacy, updatedAt }  your profile (profile-model.js profileOf)
//   useMyStats()              -> profileStats for you: { rounds, friends, record: { won, lost, even },
//                                  favoriteGame, since, lastPlayed, money: { net, best, rounds } }
//   usePersonProfile(id)      -> profileFor(state, id): anyone's profile by any of their player ids,
//                                  or null. { accountId, name, index, homeCourse, avatar, payApp,
//                                  payHandle, stats, updatedAt, mine }
//   useProfileServer()        -> 'unknown' | 'ready' | 'off' (SQL not run) | 'offline' | 'error' | 'signed-out'
//
//   setAvatar(avatar)         a Ball buddy: { kind: 'buddy', id, ...anything the picker needs }, or null
//   setHomeCourse(course)     { id, name, place? } or null
//   setProfilePrivacy(level)  who can see your profile: 'everyone' | 'played' (the default) | 'hidden'
//   setShowMoney(on)          your net and best round go with your profile (off until you turn it on)
//   saveProfile(patch)        any of { avatar, homeCourse, privacy } at once
//   uploadPhoto(file)         resizes to 256px and saves it as your avatar. Resolves
//                             { ok, where: 'account' | 'phone', avatar } ('phone' when signed out or
//                             before the SQL: it uploads on its own later). Rejects only for a file
//                             that isn't a picture.
//   removePhoto()             back to no avatar (removes your photos from the server too)
//   refreshProfiles({ retry }) ask the server now (it also runs on its own: on start, on sign-in,
//                             after a seat is claimed, when the app comes back, every 5 minutes);
//                             retry: true asks even a server that said "not set up"
//   deleteAccountReady()      'ready' | 'unavailable' (SQL not run) | 'offline' | 'signed-out' | 'error'
//   deleteAccount()           see DeleteAccount.jsx: { ok: true } or { ok: false, reason } with the
//                             reasons above. Nothing changes unless the server can do all of it.
//
// Re-exported from profile-model.js for screens: PROFILE_LEVELS, PRIVACY_DEFAULTS, moneyShown,
// profileShown, profileFor, profileOf, profileStats.
import { useMemo, useSyncExternalStore } from 'react';
import { STORE_KEY, getState, resetAll, subscribe, update, useStore } from './store.js';
import { getSupabase } from './supabase.js';
import { accountNow, onAccount, signOut } from './cloud.js';
import { stable } from './sync-model.js';
import {
  PRIVACY_DEFAULTS, PROFILE_LEVELS, applyPeople, cropSquare, isNotSetUp, knownPlayerIds, moneyShown,
  normalizeAvatar, normalizeHomeCourse, normalizePrivacy, profileFor, profileOf, profileShown, profileStats, retryOnLoad,
  serverStateAfter, toRow,
} from './profile-model.js';
import { deepStats } from './deep-stats.js';

export { PRIVACY_DEFAULTS, PROFILE_LEVELS, moneyShown, profileShown, profileFor, profileOf, profileStats };

const BUCKET = 'avatars';
const PHOTO_PX = 256;
const MIN_GAP = 60e3; // at most one round trip a minute unless something changed here
const LOCAL = `profile-sync:${STORE_KEY}`; // { offAt, pushed: { [uid]: hash } }

// --------------------------- bookkeeping -----------------------------------

function loadLocal() { try { return JSON.parse(localStorage.getItem(LOCAL)) || {}; } catch { return {}; } }
function saveLocal(v) { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch { /* storage full or blocked */ } }
let local = loadLocal();

let server = 'unknown';
const listeners = new Set();
function setServer(v) {
  if (server === v) return;
  server = v;
  listeners.forEach(l => l());
}
/** Where the server stands: 'unknown' | 'ready' | 'off' | 'offline' | 'error' | 'signed-out'. */
export function useProfileServer() {
  return useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => server, () => server);
}

const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const signedInUser = () => accountNow().user?.id || null;

function noteOff() {
  local = { ...local, offAt: Date.now() };
  saveLocal(local);
  setServer('off');
}
function noteError(e) {
  const now = serverStateAfter(e, online());
  if (now === 'off') { noteOff(); return; }
  setServer(now);
  if (now === 'error') console.warn('Profiles:', e?.message || e);
}
/** Throws the error from a Supabase reply. */
function check(res) { if (res?.error) throw res.error; return res?.data; }

// --------------------------- your profile ----------------------------------

/**
 * Change your profile on this phone right away, and send it to the server soon after. `patch` has
 * any of avatar, homeCourse, privacy (privacy merges with what's there).
 */
export function saveProfile(patch = {}) {
  update(s => {
    const cur = s.profile && typeof s.profile === 'object' ? s.profile : {};
    const next = { ...cur };
    if ('avatar' in patch) next.avatar = normalizeAvatar(patch.avatar);
    if ('homeCourse' in patch) next.homeCourse = normalizeHomeCourse(patch.homeCourse);
    if ('privacy' in patch) next.privacy = normalizePrivacy({ ...normalizePrivacy(cur.privacy), ...patch.privacy });
    next.updatedAt = Date.now();
    s.profile = next;
  });
  soon();
}
export const setAvatar = avatar => saveProfile({ avatar });
export const setHomeCourse = homeCourse => saveProfile({ homeCourse });
export function setProfilePrivacy(level) {
  if (!PROFILE_LEVELS.includes(level)) return;
  saveProfile({ privacy: { profile: level } });
}
export const setShowMoney = on => saveProfile({ privacy: { showMoney: on === true } });

/** Your profile, kept up to date. */
export function useMyProfile() {
  const own = useStore(s => s.profile);
  const card = useStore(s => s.players[s.me]);
  const me = useStore(s => s.me);
  return useMemo(() => profileOf({ me, players: card ? { [me]: card } : {}, profile: own }), [own, card, me]);
}

/** Your basic stats from the rounds on this phone. */
export function useMyStats() {
  const state = useStore();
  return useMemo(() => profileStats(state), [state]);
}

/** Anyone's profile by any of their player ids (null when there's nothing beyond their player card). */
export function usePersonProfile(id) {
  const state = useStore();
  return useMemo(() => profileFor(state, id), [state, id]);
}

// --------------------------- photos ----------------------------------------

/** A picture file as a 256px square JPEG: { blob, dataUrl }. Browser only. */
async function squareJpeg(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('That file isn’t a picture.');
  let src, w, h, done = () => {};
  if (typeof createImageBitmap === 'function') {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    w = src.width; h = src.height; done = () => src.close?.();
  } else {
    const url = URL.createObjectURL(file);
    src = await new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = no; img.src = url; });
    w = src.naturalWidth; h = src.naturalHeight; done = () => URL.revokeObjectURL(url);
  }
  try {
    const { sx, sy, size } = cropSquare(w, h);
    if (!size) throw new Error('That picture is empty.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PHOTO_PX;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, size, size, 0, 0, PHOTO_PX, PHOTO_PX);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85));
    return { blob: blob || await (await fetch(dataUrl)).blob(), dataUrl };
  } finally { done(); }
}

/** Your photo files on the server, by path. */
async function myPhotoPaths(db, uid) {
  const { data, error } = await db.storage.from(BUCKET).list(uid, { limit: 100 });
  if (error) throw error;
  return (data || []).filter(f => f?.name && !f.name.startsWith('.')).map(f => `${uid}/${f.name}`);
}

/** Send a photo up and return its avatar; older photos of yours are removed. */
async function sendPhoto(db, uid, blob) {
  const path = `${uid}/${Date.now().toString(36)}.jpg`;
  const up = await db.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (up.error) throw up.error;
  const url = db.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl;
  if (!url) throw new Error('No link for the photo');
  try {
    const old = (await myPhotoPaths(db, uid)).filter(p => p !== path);
    if (old.length) await db.storage.from(BUCKET).remove(old);
  } catch { /* old photos can wait */ }
  return { kind: 'photo', url, path };
}

/**
 * Make a picture your avatar. It's saved on this phone straight away; when you're signed in and the
 * server is ready it goes up too (otherwise it waits on the phone and goes up later on its own).
 */
export async function uploadPhoto(file) {
  const { blob, dataUrl } = await squareJpeg(file);
  const uid = signedInUser();
  if (uid && server !== 'off') {
    try {
      const db = await getSupabase();
      if (db) {
        const avatar = await sendPhoto(db, uid, blob);
        saveProfile({ avatar });
        setServer('ready');
        return { ok: true, where: 'account', avatar };
      }
    } catch (e) { noteError(e); }
  }
  const avatar = { kind: 'photo', url: dataUrl, pending: true };
  saveProfile({ avatar });
  return { ok: true, where: 'phone', avatar: normalizeAvatar(avatar) };
}

/** No avatar again. Your photos come off the server too (when it can be reached). */
export async function removePhoto() {
  const had = getState().profile?.avatar;
  saveProfile({ avatar: null });
  const uid = signedInUser();
  if (!uid || had?.kind !== 'photo' || had.pending) return;
  try {
    const db = await getSupabase();
    const paths = db ? await myPhotoPaths(db, uid) : [];
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
  } catch { /* the next photo replaces them anyway */ }
}

/** A photo that waited on the phone goes up now. */
async function sendWaitingPhoto(db, uid) {
  const a = getState().profile?.avatar;
  if (a?.kind !== 'photo' || !a.pending || !a.url?.startsWith('data:')) return;
  const blob = await (await fetch(a.url)).blob();
  const avatar = await sendPhoto(db, uid, blob);
  // Only if it's still the photo they picked
  if (getState().profile?.avatar?.url === a.url) saveProfile({ avatar });
}

// --------------------------- talking to the server -------------------------

/** Send your profile when it changed since the last time it went up. */
async function pushMine(db, uid) {
  const state = getState();
  if (!state.onboarded) return;
  // The deeper stats go too, with no money in them (profile-model.js publicDeep), unless you're only you
  const row = toRow(profileOf(state), uid, { ...profileStats(state), deep: deepStats(state) });
  if (!row) return;
  const hash = stable(row);
  if (local.pushed?.[uid] === hash) return;
  check(await db.from('profiles').upsert({ ...row, updated_at: new Date().toISOString() }));
  local = { ...local, pushed: { [uid]: hash } };
  saveLocal(local);
}

/** Link your seats on the server, then fetch who's who for every id on this phone. */
async function pullPeople(db, uid) {
  const mine = check(await db.rpc('link_my_players')) || [];
  const asked = knownPlayerIds(getState());
  const rows = mine.map(x => ({ player_id: typeof x === 'string' ? x : x?.link_my_players, user_id: uid, visible: false }));
  for (let i = 0; i < asked.length; i += 500) {
    rows.push(...(check(await db.rpc('people_profiles', { p_ids: asked.slice(i, i + 500) })) || []));
  }
  const s = getState();
  const draft = { me: s.me, accountOf: { ...(s.accountOf || {}) }, profiles: { ...(s.profiles || {}) } };
  applyPeople(draft, rows, { asked, myAccount: uid });
  if (stable(draft.accountOf) !== stable(s.accountOf || {}) || stable(draft.profiles) !== stable(s.profiles || {})) {
    update(d => { d.accountOf = draft.accountOf; d.profiles = draft.profiles; });
  }
}

let running = null;
let again = false;
let lastRun = 0;
/**
 * Bring profiles up to date with the server now (or right after the run in progress). Quiet: never
 * throws. `soon: true` keeps to at most one trip a minute; a server that said "not set up" is only
 * asked again with `retry: true` (on a later load, or signing in).
 */
export function refreshProfiles({ soon: gentle = false, retry = false } = {}) {
  const uid = signedInUser();
  if (!uid) { setServer('signed-out'); return Promise.resolve(); }
  if (gentle && Date.now() - lastRun < MIN_GAP) return Promise.resolve();
  if (server === 'off' && !retry) return Promise.resolve();
  if (running) { again = true; return running; }
  running = (async () => {
    do {
      again = false;
      lastRun = Date.now();
      try {
        const db = await getSupabase();
        if (!db) return;
        await sendWaitingPhoto(db, uid).catch(e => { if (isNotSetUp(e)) throw e; });
        await pushMine(db, uid);
        await pullPeople(db, uid);
        if (local.offAt) { local = { ...local, offAt: null }; saveLocal(local); }
        setServer('ready');
      } catch (e) {
        noteError(e);
        break;
      }
    } while (again);
  })().finally(() => { running = null; });
  return running;
}

let timer = null;
/** Send changes a moment after they're made, so a run of taps is one trip. */
function soon() {
  clearTimeout(timer);
  timer = setTimeout(() => refreshProfiles(), 1500);
}

/** What on this phone would change who's linked: your id and the seats claimed in your rounds. */
function claimSignature(s) {
  const parts = [`me:${s.me || ''}`];
  for (const r of Object.values(s.rounds || {})) {
    if (r?.localMe) parts.push(`${r.id}:${r.localMe}`);
    if (r?.claims && typeof r.claims === 'object') parts.push(`${r.id}#${Object.keys(r.claims).length}`);
  }
  return parts.sort().join('|');
}

let booted = false;
/** Call once on app start (after bootCloud). */
export function bootProfiles() {
  if (booted || typeof window === 'undefined') return;
  booted = true;
  // A server that said "not set up" only a little while ago isn't asked again on this load
  const retry = retryOnLoad(local.offAt);
  if (!retry) server = 'off';
  let user = signedInUser();
  let first = true;
  onAccount(() => {
    const now = signedInUser();
    if (now === user) return;
    user = now;
    // The account showing up as the app starts follows the load rule; signing in later always asks
    if (now) refreshProfiles({ retry: first ? retry : true });
    else setServer('signed-out');
    first = false;
  });
  // A seat taken, a round arriving with claims, or a new "me": link again shortly
  let rounds = getState().rounds, me = getState().me;
  let sig = claimSignature(getState());
  let claimTimer = null;
  subscribe(() => {
    const s = getState();
    if (s.rounds === rounds && s.me === me) return;
    rounds = s.rounds; me = s.me;
    const next = claimSignature(s);
    if (next === sig) return;
    sig = next;
    clearTimeout(claimTimer);
    claimTimer = setTimeout(() => refreshProfiles(), 3000);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshProfiles({ soon: true }); });
  window.addEventListener('online', () => refreshProfiles({ soon: true }));
  setInterval(() => { if (document.visibilityState === 'visible') refreshProfiles({ soon: true }); }, 5 * 60e3);
  if (user) { first = false; refreshProfiles({ retry }); }
}

// --------------------------- delete your account ---------------------------

/**
 * What this phone kept for the deleted account, gone: the profile bookkeeping and the saved copies
 * of shared rounds (signing out already started the round data fresh). Only this phone's own keys:
 * the device key, unsent suggestions, unsent Tab marks and another dev profile's data stay.
 */
function clearPhoneKeys() {
  try {
    const drop = [LOCAL];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`bb-live-base:${STORE_KEY}:`)) drop.push(k);
    }
    drop.forEach(k => localStorage.removeItem(k));
  } catch { /* storage blocked */ }
  local = {};
}

/** Whether "Delete your account" can run: 'ready', or the reason it can't. */
export async function deleteAccountReady() {
  if (!signedInUser()) return 'signed-out';
  if (!online()) return 'offline';
  try {
    const db = await getSupabase();
    if (!db) return 'unavailable';
    check(await db.rpc('delete_my_account', { p_check: true }));
    return 'ready';
  } catch (e) {
    const now = serverStateAfter(e, online());
    return now === 'off' ? 'unavailable' : now;
  }
}

/**
 * Delete the signed-in account for good: photos, profile, linked player ids and saved data on the
 * server, then the account; then this phone signs out and starts fresh. Other people's rounds stay
 * as they are. Changes nothing unless the server can do all of it.
 */
export async function deleteAccount() {
  const ready = await deleteAccountReady();
  if (ready !== 'ready') return { ok: false, reason: ready };
  const uid = signedInUser();
  const db = await getSupabase();
  try {
    const paths = await myPhotoPaths(db, uid).catch(() => []);
    if (paths.length) await db.storage.from(BUCKET).remove(paths).catch(() => {});
    check(await db.rpc('delete_my_account'));
  } catch (e) {
    const now = serverStateAfter(e, online());
    return { ok: false, reason: now === 'off' ? 'unavailable' : now };
  }
  clearTimeout(timer);
  try { await signOut(); } catch { resetAll(); /* the account is gone either way */ }
  clearPhoneKeys();
  setServer('signed-out');
  return { ok: true };
}
