// The rounds going on right now, for the play button and its sheet, and when a round counts for
// History. Split out of rounds.js and history.js (which re-export them) so Up next's first paint
// loads neither the courses list nor the Tab's money.
import { holeComplete } from './round.js';

/** Every round still being played, the one you were in last first, then newest first. */
export function roundsInProgress(state) {
  return Object.values(state.rounds || {})
    .filter(r => r.status === 'active')
    .sort((a, b) => (b.id === state.activeRoundId) - (a.id === state.activeRoundId) || (b.createdAt || 0) - (a.createdAt || 0));
}

/** Holes with every score in, for "3 of 18 holes" lines. */
export function holesScored(round) {
  return round.holes.filter(h => holeComplete(round, h)).length;
}

/** When a round counts for History: when it finished, or when it started if it never did. */
export const roundTime = r => r.finishedAt || r.createdAt || 0;

/** Rounds still being played, the one the Play button resumes first. */
export function activeRounds(state) {
  return Object.values(state.rounds)
    .filter(r => r.status === 'active')
    .sort((a, b) => (b.id === state.activeRoundId) - (a.id === state.activeRoundId) || b.createdAt - a.createdAt);
}
