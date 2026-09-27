// Rounds in progress: more than one can be going at once (a paused round never gets deleted
// to make room for a new one). `activeRoundId` is just the one you were in last, so the
// play button knows where to take you back to.
import { holeComplete } from './round.js';

/** Every round still being played, the one you were in last first, then newest first. */
export function roundsInProgress(state) {
  return Object.values(state.rounds || {})
    .filter(r => r.status === 'active')
    .sort((a, b) => (b.id === state.activeRoundId) - (a.id === state.activeRoundId) || (b.createdAt || 0) - (a.createdAt || 0));
}

/** The round to go back to once `leavingId` is finished or deleted: the newest other one in progress, or null. */
export function nextActiveId(state, leavingId) {
  const rest = roundsInProgress({ ...state, activeRoundId: null }).filter(r => r.id !== leavingId);
  return rest[0]?.id || null;
}

/** Add a new round and make it the current one. Rounds already in progress stay as they are (mutates a draft). */
export function addRound(draft, round) {
  draft.rounds[round.id] = round;
  if (round.status === 'active') draft.activeRoundId = round.id;
}

/** Take a round out of play (finished or deleted) and point the play button at the next one (mutates a draft). */
export function leaveRound(draft, id) {
  if (draft.activeRoundId === id || !draft.rounds[draft.activeRoundId] || draft.rounds[draft.activeRoundId].status !== 'active') {
    draft.activeRoundId = nextActiveId(draft, id);
  }
}

/** Holes with every score in, for "3 of 18 holes" lines. */
export function holesScored(round) {
  return round.holes.filter(h => holeComplete(round, h)).length;
}
