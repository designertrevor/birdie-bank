// Who keeps score in a shared round. Pure, so the tests and the sync layer can both use it.
//
// One phone keeps the card. round.keeper = { id, since, by, lastSaveAt, hole?, from? } travels in
// the round's meta, so every phone agrees on it:
//  • id: the player keeping score, or null for "the phone that started the round" (which covers an
//    organizer who keeps score without playing).
//  • since: when they got the card. by: who handed it over (a player id, or null for the host phone);
//    a player who took the card is their own `by`.
//  • lastSaveAt: when the keeper last saved a hole.
//  • hole: the hole number on the handing phone at handoff, so the new keeper starts there.
//  • from: on a card that was taken, who had it (a player id, or null for the host phone), so their
//    phone can say who took it.
// round.cardAsk = { by, at, no?, noAt? }: a player asked the keeper for the card. The keeper answers
// Yes (hands it over) or No (`no`: the ask ends and the asker sees it). With no answer after
// ASK_MS, the asker can take the card with one tap. A player asks from their own phone and takes
// it on the same phone, so the wait is timed by one clock.
// round.onApp = { pid: at }: players whose phone took their seat in this round. Only they can be
// handed the card: a player with no phone can't keep score.
//
// Rules (decided 2026-09-29): only the round's players edit, watchers never do. A round that isn't
// shared is always yours to edit. A shared round in progress from before this shipped has no keeper:
// every player's phone edits it as before, until the host phone opens it and writes one. A finished
// round being fixed keeps today's rule: any player's phone (or the host's) can fix it.
//
// This is enforced on the phone (in the UI and in what sync.js sends), not on the server: the live
// round tables are open by code, and an older copy of the app ignores the keeper. Locking it down on
// the server belongs with the S3 plan lock-down.
import { merge3 } from './sync-model.js';

/** How long the keeper has to answer an ask before the asker can take the card. */
export const ASK_MS = 2 * 60 * 1000;
/** How long "Mike took the card" or "Trevor said no" stays up. */
export const NOTE_MS = 10 * 60 * 1000;

/** The keeper record, or null when the round has none (not shared, or shared before keepers existed). */
export function keeperOf(round) {
  const k = round?.keeper;
  if (!k || typeof k !== 'object') return null;
  return { id: typeof k.id === 'string' ? k.id : null, since: Number(k.since) || 0, by: typeof k.by === 'string' ? k.by : null, lastSaveAt: Number(k.lastSaveAt) || 0, hole: k.hole ?? null };
}

const isPlayer = (round, pid) => !!pid && (round?.players || []).some(p => p.id === pid);

/**
 * Which player is "you" on this phone, for keeping score. The host phone is the organizer (state.me,
 * who may or may not be playing). A phone that joined from a link is the seat it took (round.localMe),
 * and a watcher has none: we never fall back to state.me there, since saved player ids repeat across
 * an organizer's rounds and a watcher could otherwise look like a player.
 */
export function keeperMe(round, state) {
  if (!round?.shared) return state?.me ?? null;
  return round.shared.host ? state?.me ?? null : round.localMe ?? null;
}

/** Whether this phone keeps the card right now (in a shared round with a keeper). */
export function isKeeper(round, me, isHost) {
  const k = keeperOf(round);
  if (!k) return false;
  return k.id === null ? !!isHost : me === k.id;
}

/** Whether this phone may change the round: scores, marks, bets, players, length. */
export function canEdit(round, me, isHost) {
  if (!round) return false;
  // Not shared, or sharing stopped: this phone's copy is its own
  if (!round.shared || round.shared.ended) return true;
  const player = isPlayer(round, me);
  // Watchers never edit. The host phone always can in a round with no keeper yet
  if (!player && !isHost) return false;
  // Fixing a finished round: any player's phone, as before
  if (round.status === 'done') return true;
  const k = keeperOf(round);
  // A round shared before keepers existed: every player's phone edits, as before
  if (!k) return true;
  return k.id === null ? !!isHost : me === k.id;
}

/**
 * Whether this phone should leave the hole screen for the results: a shared round that finished on
 * another phone (the keeper's). Never while fixing scores (`editing` stays on this phone), so any
 * player can still fix a finished round, and never on the phone that finished it (`finishedHere`),
 * which already went to its results.
 */
export function shouldLeaveHole(round, { finishedHere = false } = {}) {
  if (!round?.shared || round.shared.ended) return false;
  return round.status === 'done' && !round.editing && !finishedHere;
}

/** The keeper's first name for "Trevor is keeping score": their seat, else the organizer's name. */
export function keeperName(round) {
  const k = keeperOf(round);
  const first = n => String(n || '').trim().split(/\s+/)[0];
  const seat = k?.id ? round.players?.find(p => p.id === k.id) : null;
  if (seat?.name) return first(seat.name);
  return first(round?.hostName) || 'The organizer';
}

/**
 * How long until `me` can take the card, in ms: the time left on their ask (0 once it's up), or
 * null with no open ask of theirs. Only a player who isn't the keeper, while the round is played.
 */
export function askLeft(round, me, now = Date.now()) {
  if (!round?.shared || round.status !== 'active' || round.editing) return null;
  const k = keeperOf(round);
  const a = openAsk(round);
  if (!k || !a || a.by !== me || !isPlayer(round, me) || k.id === me) return null;
  return Math.max(0, Math.min(ASK_MS, a.at + ASK_MS - now));
}

/** Whether `me` can take the card: they asked, and the keeper didn't answer in ASK_MS. */
export function canTakeCard(round, me, now = Date.now()) {
  return askLeft(round, me, now) === 0;
}

/** "1:42": the time left on an ask. */
export function clockText(ms) {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Players the card can be handed to: every player, with whether their phone is on the round. */
export function handOffChoices(round) {
  const k = keeperOf(round);
  return (round?.players || [])
    .filter(p => !k || p.id !== k.id)
    .map(p => ({ id: p.id, name: p.name, onApp: !!round.onApp?.[p.id] }));
}

// Changes to the keeper, as plain updates to apply to the round (Object.assign(round, patch)).

/** The keeper for a round being shared, or a legacy shared round the host phone opens: the host phone. */
export function hostKeeper(now = Date.now()) {
  return { keeper: { id: null, since: now, by: null, lastSaveAt: now } };
}

/** Hand the card to `to` (a player id) from `by` (the keeper's player id, or null for the host phone). */
export function handOff(to, by, now = Date.now(), hole = null) {
  return { keeper: { id: to, since: now, by: by ?? null, lastSaveAt: now, ...(hole != null ? { hole } : {}) }, cardAsk: null };
}

/** The keeper saved a hole. */
export function keeperSaved(round, now = Date.now()) {
  const k = keeperOf(round);
  return k ? { keeper: { ...round.keeper, lastSaveAt: now } } : {};
}

/** `by` asks the keeper for the card. */
export function askForCard(by, now = Date.now()) {
  return { cardAsk: { by, at: now } };
}

/** The asker took it back. */
export function clearAsk() {
  return { cardAsk: null };
}

/** The keeper said No: the ask ends, and the asker's phone says so. */
export function declineAsk(round, now = Date.now()) {
  const a = openAsk(round);
  return a ? { cardAsk: { ...a, no: true, noAt: now } } : {};
}

/** The ask still standing: from a player who isn't the keeper, and not answered No. */
export function openAsk(round) {
  const a = round?.cardAsk;
  const k = keeperOf(round);
  if (!a || !a.by || a.no || !isPlayer(round, a.by) || (k && k.id === a.by)) return null;
  return { by: a.by, at: Number(a.at) || 0 };
}

/** The keeper said No to `me`'s ask, lately: { at, noAt }, or null. */
export function declinedAsk(round, me, now = Date.now()) {
  const a = round?.cardAsk;
  if (!a?.no || a.by !== me) return null;
  const noAt = Number(a.noAt) || 0;
  return now - noAt < NOTE_MS ? { at: Number(a.at) || 0, noAt } : null;
}

/** `me` takes the card after an unanswered ask. `from` is kept so the old keeper's phone can say who took it. */
export function takeCard(round, me, now = Date.now(), hole = null) {
  const k = keeperOf(round);
  return { keeper: { id: me, since: now, by: me, lastSaveAt: now, ...(hole != null ? { hole } : {}), from: k ? k.id : null }, cardAsk: null };
}

/**
 * Who took the card from this phone lately (their player id), or null. `me` and `isHost` say
 * which phone this is: the host phone had it when `from` is null.
 */
export function tookFromMe(round, me, isHost, now = Date.now()) {
  const k = round?.keeper;
  if (!k || typeof k !== 'object' || !('from' in k) || k.by !== k.id || !k.id) return null;
  const mine = k.from === null ? !!isHost : k.from === me;
  if (!mine || k.id === me) return null;
  return now - (Number(k.since) || 0) < NOTE_MS ? k.id : null;
}

/** Mark a player's phone as on the round (they took their seat). */
export function seatTaken(round, pid, now = Date.now()) {
  if (!isPlayer(round, pid)) return {};
  return { onApp: { ...(round.onApp || {}), [pid]: now } };
}

// What a phone that can't edit may still send in the round's meta. Everything else it sends is
// what the server already had, so a phone that isn't keeping score can't change the game.
const OPEN_KEYS = ['keeper', 'cardAsk', 'onApp'];
const PAY_KEYS = ['payApp', 'payHandle', 'venmo'];

/**
 * The meta a phone sends. The keeper (or anyone, in a round with no keeper yet) sends its copy.
 * Any other phone sends the server's last copy with only the keeper, the ask, the on-the-app list
 * and its own seat's payment app laid over it. With no server copy yet it sends nothing (null).
 */
export function metaToSend(base, local, { editor, me }) {
  if (editor) return local;
  if (!base || typeof base !== 'object') return null;
  const out = { ...base };
  for (const k of OPEN_KEYS) {
    if (k in local) out[k] = local[k];
    else delete out[k];
  }
  if (me && Array.isArray(base.players) && Array.isArray(local.players)) {
    const mine = local.players.find(p => p.id === me);
    if (mine) out.players = base.players.map(p => (p.id === me ? { ...p, ...Object.fromEntries(PAY_KEYS.filter(k => k in mine).map(k => [k, mine[k]])) } : p));
  }
  return out;
}

/**
 * The meta to keep on this phone when the server's copy (`remote`) arrives. The phone keeping score
 * merges as ever (see merge3). Any other phone keeps only what it may change (metaToSend) and takes
 * the rest from the server, so a copy that drifted (say, bets changed while it still had the card)
 * can't hold on to a game no other phone is playing.
 */
export function metaToKeep(base, local, remote, { editor, me }) {
  const mine = editor ? local : metaToSend(base, local, { editor, me });
  return mine == null ? remote : merge3(base, mine, remote, 1);
}

/**
 * The hole record to keep on this phone when the server's copy (`remote`) arrives. The keeper's phone
 * merges as ever: scores it hasn't sent yet are kept, and a clash keeps its own. Any other phone takes
 * the keeper's scores, but keeps (and then sends) scores it saved itself while it still had the card
 * and couldn't send yet, say with no signal before handing off. The keeper's copy wins a clash.
 * A phone that never kept score has nothing of its own, so it simply gets the keeper's copy.
 */
export function holeToKeep(base, local, remote, editor) {
  return editor ? merge3(base, local, remote, 2) : merge3(base, remote, local, 2, true);
}
