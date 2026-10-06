// Rounds in progress: more than one can be going at once (a paused round never gets deleted
// to make room for a new one). `activeRoundId` is just the one you were in last, so the
// play button knows where to take you back to.
import { GAMES } from './round.js';
import { findCourse } from './courses.js';
import { stampAvatars } from './avatars.js';
import { roundsInProgress } from './rounds-live.js';

export { holesScored, roundsInProgress } from './rounds-live.js';

/** The round to go back to once `leavingId` is finished or deleted: the newest other one in progress, or null. */
export function nextActiveId(state, leavingId) {
  const rest = roundsInProgress({ ...state, activeRoundId: null }).filter(r => r.id !== leavingId);
  return rest[0]?.id || null;
}

/** Add a new round and make it the current one. Rounds already in progress stay as they are (mutates a draft). */
export function addRound(draft, round) {
  // Everyone's avatar rides along, so a friend opening the round link sees them on the seats
  stampAvatars(draft, round);
  draft.rounds[round.id] = round;
  if (round.status === 'active') draft.activeRoundId = round.id;
}

/** Take a round out of play (finished or deleted) and point the play button at the next one (mutates a draft). */
export function leaveRound(draft, id) {
  if (draft.activeRoundId === id || !draft.rounds[draft.activeRoundId] || draft.rounds[draft.activeRoundId].status !== 'active') {
    draft.activeRoundId = nextActiveId(draft, id);
  }
}

/**
 * "Your usual": the last finished round this phone set up whose course and players still
 * exist, to offer as a one-tap repeat. A round still being played (or a finished one being
 * fixed) is never offered.
 */
export function usualRound(state) {
  const recent = Object.values(state.rounds || {})
    .filter(r => !r.localMe && r.shared?.host !== false && GAMES[r.game] && r.status === 'done' && !r.editing) // watched rounds aren't yours to repeat
    // A Big Game's group round is the game's, set up again from the game's page, never a usual
    .filter(r => r.trip?.format !== 'big')
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  for (const r of recent) {
    const course = findCourse(state, r.course?.id);
    if (course && r.players.every(p => state.players?.[p.id])) return { round: r, course };
  }
  return null;
}
