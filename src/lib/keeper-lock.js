// The server's keeper lock, as plain rules. supabase/2026-09-30-keeper-lock.sql does the same thing in
// the database, and the dev "two tabs" transport (sync-adapters.js) uses this copy, so the tests here
// are the spec for both. Pure, so tests can load it.
//
// Every phone has a device key (device.js): a secret it sends with each request, and the key's hash,
// which rides in the round's meta. `hostDev` is the phone that shared the round, and `devs` maps each
// seat to the phone that took it. The server hashes the secret it's sent (the "writer") and checks it
// against them:
//  • A round in progress: only the keeper's phone writes it (the host phone when keeper.id is null).
//    The phone that just handed the card off may still send holes it saved before, and any other phone
//    may only do what a player does without the card: take its seat, set its payment app, ask for the
//    card, and take the card when an ask has stood for TAKE_WAIT_MS. Anything else it sends is left out,
//    so the server keeps its own copy and every phone gets it back.
//  • A finished round: any player's phone (a seat's phone, or the host phone) can fix it.
//  • A round shared before the lock (no hostDev), or one whose keeper's phone isn't known (an older app
//    took the card), stays open to everyone with the code, as before.
import { stable } from './sync-model.js';

/** How long an ask for the card has to stand on the server before the asker can take it (the phone waits 2 minutes). */
export const TAKE_WAIT_MS = 90 * 1000;
const PAY_KEYS = ['payApp', 'payHandle', 'venmo'];

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;
const same = (a, b) => stable(a) === stable(b);
const devsOf = meta => (isObj(meta?.devs) ? meta.devs : {});
const seatsOf = meta => new Set((Array.isArray(meta?.players) ? meta.players : []).map(p => p?.id).filter(isStr));

/** The keeper's seat, or null (no keeper, or the host phone keeps score). */
export function keeperSeat(meta) {
  return isObj(meta?.keeper) && isStr(meta.keeper.id) ? meta.keeper.id : null;
}

/** The hash of the keeper's phone, or null when there's no keeper or its phone isn't known. */
export function keeperDev(meta) {
  if (!isObj(meta?.keeper)) return null;
  const seat = keeperSeat(meta);
  const d = seat ? devsOf(meta)[seat] : meta.hostDev;
  return isStr(d) ? d : null;
}

/** Whether a round is locked to its keeper right now. */
export function isLocked(meta) {
  return isStr(meta?.hostDev) && meta.status !== 'done' && !!keeperDev(meta);
}

/** Whether `w` (a device hash) is one of the round's players' phones, or the host phone. */
export function isPlayerDev(meta, w) {
  return isStr(w) && (w === meta?.hostDev || Object.values(devsOf(meta)).includes(w));
}

/** Whether `w` may change anything in a round whose server meta is `meta`. */
export function fullWriter(meta, w) {
  if (!meta || !isStr(meta.hostDev)) return true; // shared before the lock, or by an older app
  if (meta.status === 'done') return isPlayerDev(meta, w);
  const k = keeperDev(meta);
  if (!k) return true; // the keeper's phone isn't known: open, as before
  return isStr(w) && w === k;
}

/** Seats that point at `w` after this write: only ever added, only to the writer's own hash. */
function nextDevs(old, next, w, full) {
  const out = { ...devsOf(old) };
  if (!isStr(w) || !isObj(next?.devs)) return out;
  const seats = seatsOf(full ? next : old);
  // Nobody takes over the keeper's seat without the card (a finished round has no card to take)
  const kseat = old?.status === 'done' ? null : keeperSeat(old);
  for (const [s, v] of Object.entries(next.devs)) {
    if (v !== w || out[s] === w || !seats.has(s)) continue;
    if (!full && s === kseat) continue;
    out[s] = w;
  }
  return out;
}

/** What a phone without the card may change: see the top of this file. */
function openChanges(old, next, w, devs, { askSeenAt, now }) {
  const out = structuredClone(old);
  const mine = new Set(Object.entries(devs).filter(([, v]) => v === w).map(([s]) => s));
  if (isObj(next.onApp) && mine.size) {
    const onApp = { ...(isObj(old.onApp) ? old.onApp : {}) };
    for (const s of mine) if (next.onApp[s] != null) onApp[s] = next.onApp[s];
    out.onApp = onApp;
  }
  if (Array.isArray(old.players) && Array.isArray(next.players) && mine.size) {
    out.players = old.players.map(p => {
      const q = mine.has(p?.id) && next.players.find(x => x?.id === p.id);
      if (!q) return p;
      const o = { ...p };
      for (const k of PAY_KEYS) { if (k in q) o[k] = q[k]; else delete o[k]; }
      return o;
    });
  }
  // Seat claims (people-links.js) stay open to every phone with the code, as before
  if ('claims' in next) out.claims = next.claims; else delete out.claims;
  const oa = old.cardAsk, na = next.cardAsk;
  if (!same(oa, na)) {
    const ok = isObj(na) ? mine.has(na.by) && !na.no : isObj(oa) && mine.has(oa.by);
    if (ok) out.cardAsk = isObj(na) ? na : null;
  }
  // Taking the card after an ask nobody answered
  const nk = next.keeper;
  if (!same(old.keeper, nk) && isObj(nk) && mine.has(nk.id) && old.status !== 'done'
    && isObj(oa) && oa.by === nk.id && !oa.no && askSeenAt && now - askSeenAt >= TAKE_WAIT_MS) {
    out.keeper = nk;
    out.cardAsk = isObj(na) ? na : null;
  }
  return out;
}

/**
 * The meta the server keeps when `w` writes `next` over `old` (null for a new round).
 * `row` is what the server tracks beside the meta: { askSeenAt } (when the current ask arrived).
 */
export function lockedMeta(old, next, w, { askSeenAt = 0, now = Date.now() } = {}) {
  if (!isObj(next)) return next;
  const full = fullWriter(old, w);
  const devs = nextDevs(old, next, w, full);
  const out = full ? { ...next } : openChanges(old, next, w, devs, { askSeenAt, now });
  if (Object.keys(devs).length || 'devs' in (old || {})) out.devs = devs; else delete out.devs;
  // The host phone is set once, by the host phone itself, and never changes
  if (isStr(old?.hostDev)) out.hostDev = old.hostDev;
  else if (!(isStr(w) && out.hostDev === w)) delete out.hostDev;
  return out;
}

/** What the server tracks beside the meta after a write: { prevDev, askSeenAt }. */
export function lockTrack(old, out, row = {}, now = Date.now()) {
  const was = keeperDev(old), is = keeperDev(out);
  const ask = m => (isObj(m?.cardAsk) ? `${m.cardAsk.by}|${m.cardAsk.at}` : null);
  return {
    prevDev: old && was !== is ? was : row.prevDev ?? null,
    askSeenAt: ask(old) !== ask(out) ? (ask(out) ? now : null) : row.askSeenAt ?? null,
  };
}

/** Whether `w` may write a hole. Seat requests (negative numbers) are open to anyone with the link. */
export function holeAllowed(meta, holeNo, w, prevDev = null) {
  if (holeNo < 0 || !meta) return true;
  if (fullWriter(meta, w)) return true;
  // The phone that just handed off can still send holes it saved while it had the card
  return isStr(w) && w === prevDev && meta.status !== 'done';
}

/** Whether `w` may stop sharing (delete) the round. */
export function removeAllowed(meta, w) {
  return fullWriter(meta, w) || (isStr(w) && w === meta?.hostDev);
}

/** A seat's device entries from two copies of the meta: the server's (`remote`) plus this phone's own seat. */
export function mergeDevs(remote, local, me) {
  const out = { ...(isObj(remote) ? remote : {}) };
  if (me && isObj(local) && isStr(local[me])) out[me] = local[me];
  return Object.keys(out).length ? out : undefined;
}
