// Recently deleted: a deleted round is kept for 30 days, so a wrong tap is a restore and not lost
// money history. A deleted round moves out of `rounds` into `deletedRounds`, with the time it went
// (deletedAt) and the payments and talk it took with it. Everything that reads `rounds` (History,
// the Tab, stats, Season, trips, rivalries, the shared Tab rows) leaves it out just as it did when
// a delete was for good, and Restore puts it all back.
// Cloud sync keeps it as the same round document with deletedAt inside (cloud-model.js), so no new
// table is needed and a delete or a restore reaches your other phones like any edit.
// Pure, so tests can load it; the screens and App.jsx do the saving.
import { leaveRound } from './rounds.js';

/** How long a deleted round can come back. */
export const KEEP_DAYS = 30;
const DAY = 864e5;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** Deleted rounds as { id: round with deletedAt }, never undefined. */
export function deletedRoundsOf(state) {
  return isObj(state?.deletedRounds) ? state.deletedRounds : {};
}

/**
 * Delete a round (mutates a draft): it leaves `rounds`, its payments and talk go with it, and the
 * play button moves on if it was the round in play. Returns false when there was no such round.
 */
export function softDeleteRound(draft, id, now = Date.now()) {
  const round = draft.rounds?.[id];
  if (!round) return false;
  const settlements = (draft.settlements || []).filter(x => x.roundId === id);
  const talk = draft.talk?.[`round:${id}`];
  const kept = { ...round, deletedAt: now };
  // What went with it, so Restore brings back exactly the money it had
  const withIt = {};
  if (settlements.length) withIt.settlements = settlements;
  if (talk) withIt.talk = talk;
  if (Object.keys(withIt).length) kept.deletedWith = withIt;
  if (!isObj(draft.deletedRounds)) draft.deletedRounds = {};
  draft.deletedRounds[id] = kept;
  delete draft.rounds[id];
  if (talk) delete draft.talk[`round:${id}`];
  if (settlements.length) draft.settlements = draft.settlements.filter(x => x.roundId !== id);
  leaveRound(draft, id);
  return true;
}

/** Put a deleted round back where it was, with its payments and talk (mutates a draft). */
export function restoreRound(draft, id) {
  const kept = deletedRoundsOf(draft)[id];
  if (!kept) return false;
  delete draft.deletedRounds[id];
  // A copy already back (another phone restored it first) stays as it is
  if (draft.rounds[id]) return true;
  const round = { ...kept };
  const { deletedWith } = round;
  delete round.deletedAt;
  delete round.deletedWith;
  draft.rounds[id] = round;
  if (deletedWith?.settlements?.length) {
    const have = new Set((draft.settlements || []).map(x => x.id));
    draft.settlements = [...(draft.settlements || []), ...deletedWith.settlements.filter(x => !have.has(x.id))];
  }
  if (deletedWith?.talk) {
    if (!isObj(draft.talk)) draft.talk = {};
    draft.talk[`round:${id}`] = { ...deletedWith.talk, ...draft.talk[`round:${id}`] };
  }
  // A round that was still being played is back in play
  if (round.status === 'active' && !draft.rounds[draft.activeRoundId]) draft.activeRoundId = id;
  return true;
}

/** True when a deleted round is past its 30 days. */
export function expired(kept, now = Date.now()) {
  return !(Number(kept?.deletedAt) > now - KEEP_DAYS * DAY);
}

/** Delete for good the rounds deleted more than 30 days ago (mutates a draft). Returns how many went. */
export function purgeDeleted(draft, now = Date.now()) {
  let gone = 0;
  for (const [id, kept] of Object.entries(deletedRoundsOf(draft))) {
    if (expired(kept, now)) { delete draft.deletedRounds[id]; gone++; }
  }
  return gone;
}

/** Whole days since it was deleted, and whole days left before it goes for good (at least 1 while it's here). */
export function deletedDays(kept, now = Date.now()) {
  const ago = Math.max(0, Math.floor((now - Number(kept.deletedAt)) / DAY));
  const left = Math.max(1, Math.ceil((Number(kept.deletedAt) + KEEP_DAYS * DAY - now) / DAY));
  return { ago, left };
}

/** "Deleted today", "Deleted yesterday", "Deleted 3 days ago". */
export function deletedAgoLabel(kept, now = Date.now()) {
  const { ago } = deletedDays(kept, now);
  return ago === 0 ? 'Deleted today' : ago === 1 ? 'Deleted yesterday' : `Deleted ${ago} days ago`;
}

/** "1 day left", "27 days left". */
export function daysLeftLabel(kept, now = Date.now()) {
  const { left } = deletedDays(kept, now);
  return `${left} ${left === 1 ? 'day' : 'days'} left`;
}

/** The rounds that can still come back, newest delete first. */
export function deletedList(state, now = Date.now()) {
  return Object.values(deletedRoundsOf(state))
    .filter(r => r?.id && !state.rounds?.[r.id] && !expired(r, now))
    .sort((a, b) => b.deletedAt - a.deletedAt);
}

/** At launch: delete for good what's past its 30 days, saving only when something went. */
export async function purgeOnLaunch(now = Date.now()) {
  const { getState, update } = await import('./store.js');
  if (!Object.values(deletedRoundsOf(getState())).some(r => expired(r, now))) return;
  update(s => { purgeDeleted(s, now); });
}
