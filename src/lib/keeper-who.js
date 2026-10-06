// Who keeps the card and who may change a shared round (keeper.js has the rules and the rest).
// Split out of keeper.js, which re-exports it, so Up next's first paint loads only this part.
// Pure, no imports.

/** The keeper record, or null when the round has none (not shared, or shared before keepers existed). */
export function keeperOf(round) {
  const k = round?.keeper;
  if (!k || typeof k !== 'object') return null;
  return { id: typeof k.id === 'string' ? k.id : null, since: Number(k.since) || 0, by: typeof k.by === 'string' ? k.by : null, lastSaveAt: Number(k.lastSaveAt) || 0, hole: k.hole ?? null };
}

export const isPlayer = (round, pid) => !!pid && (round?.players || []).some(p => p.id === pid);

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
