// Who keeps score in a shared round. Pure, so the tests and the sync layer can both use it.
//
// One phone keeps the card. round.keeper = { id, since, by, lastSaveAt, hole? } travels in the
// round's meta, so every phone agrees on it:
//  • id: the player keeping score, or null for "the phone that started the round" (which covers an
//    organizer who keeps score without playing).
//  • since: when they got the card. by: who handed it over (a player id, or null for the host phone).
//  • lastSaveAt: when the keeper last saved a hole. After KEEPER_QUIET_MS with no save, any other
//    player can take the card (with a confirm, never on its own).
//  • hole: the hole number on the handing phone at handoff, so the new keeper starts there.
// round.cardAsk = { by, at }: a player asked the keeper for the card.
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

/** How long the keeper's phone has to go without saving a hole before another player can take the card. */
export const KEEPER_QUIET_MS = 10 * 60 * 1000;

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

/** The keeper's first name for "Trevor is keeping score": their seat, else the organizer's name. */
export function keeperName(round) {
  const k = keeperOf(round);
  const first = n => String(n || '').trim().split(/\s+/)[0];
  const seat = k?.id ? round.players?.find(p => p.id === k.id) : null;
  if (seat?.name) return first(seat.name);
  return first(round?.hostName) || 'The organizer';
}

/**
 * Whether `me` can take the card because the keeper's phone has gone quiet: a player in the round,
 * not the keeper, the round still being played, and no hole saved for KEEPER_QUIET_MS.
 * `seenAt` is when this phone last heard of a keeper save, by its own clock: the quiet time counts
 * from whichever is later, so a keeper phone whose clock runs slow can't make the card look quiet
 * too soon. A save time in the future (a keeper clock running fast) counts as just now.
 */
export function canTakeCard(round, me, now = Date.now(), seenAt = 0) {
  if (!round?.shared || round.status !== 'active' || round.editing) return false;
  const k = keeperOf(round);
  if (!k || !isPlayer(round, me) || k.id === me) return false;
  const last = Math.max(k.lastSaveAt || k.since || 0, seenAt || 0);
  if (last > now) return false;
  return now - last >= KEEPER_QUIET_MS;
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

/** The keeper said "Keep it", or the asker took it back. */
export function clearAsk() {
  return { cardAsk: null };
}

/** The ask still standing: from a player who isn't the keeper. */
export function openAsk(round) {
  const a = round?.cardAsk;
  const k = keeperOf(round);
  if (!a || !a.by || !isPlayer(round, a.by) || (k && k.id === a.by)) return null;
  return { by: a.by, at: Number(a.at) || 0 };
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
