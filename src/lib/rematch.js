// "Run it back": set up a new round like an earlier one (same game, course, group and bets).
import { findCourse } from './courses.js';
import { GAMES, isJustPlaying, sideGamesOf } from './round.js';
import { defaultTeams } from './teams.js';
import { storedPlayFor } from './play-for.js';

/**
 * The setup screen's starting values for a round like `round`, or null if its game is gone.
 * Players who aren't saved on this phone (friends from a joined round) are left for you to add,
 * and "you" in a joined round becomes you. `step` is where setup should open: the bets to
 * confirm when everything carried over, the players when someone is missing, the course
 * when it isn't saved here any more.
 */
export function rematchSetup(state, round) {
  if (!round || !GAMES[round.game]) return null;
  const course = findCourse(state, round.course?.id);
  const idFor = pid => (round.localMe && pid === round.localMe && state.me ? state.me : pid);
  const picked = [];
  const missing = [];
  for (const p of round.players) {
    const id = idFor(p.id);
    if (state.players[id]) { if (!picked.includes(id)) picked.push(id); }
    else missing.push(p.name);
  }
  const keep = p => picked.includes(idFor(p.id));
  const tees = Object.fromEntries(round.players.filter(p => keep(p) && p.tee).map(p => [idFor(p.id), p.tee]));
  const hcOverride = Object.fromEntries(round.players.filter(p => keep(p) && p.courseHcOverride != null).map(p => [idFor(p.id), p.courseHcOverride]));
  // Same teams when everyone is back; otherwise a fresh split of whoever is
  // Anyone just playing comes back just playing (absent when nobody was), and is never on a team
  const justPlaying = round.players.filter(p => keep(p) && isJustPlaying(round, p.id)).map(p => idFor(p.id));
  const betting = picked.filter(id => !justPlaying.includes(id));
  const sameGroup = !missing.length && round.teams?.every(t => t.players.every(pid => picked.includes(idFor(pid))));
  const teams = sameGroup ? round.teams.map(t => t.players.map(idFor)) : defaultTeams(round.game, betting);
  const allowed = GAMES[round.game].holes;
  const holesCount = [round.holesCount, round.holes?.length].find(n => allowed.includes(n)) ?? allowed[0];
  return {
    game: round.game,
    holesCount,
    courseId: course?.id ?? null,
    nine: round.nine || 'front',
    picked,
    missing,
    tees,
    hcOverride,
    bets: round.settings?.[round.game] ? structuredClone(round.settings[round.game]) : null,
    hcPct: round.hcPct ?? null,
    useHc: round.useHandicaps !== false,
    teams,
    ...(justPlaying.length ? { justPlaying } : {}),
    // Side games come along with their own bets (absent on rounds that had none): the bets they
    // ended on, without the holes an earlier bet covered, like the main game's
    // A side game's own Strokes given % comes along too (allowances.js)
    ...(sideGamesOf(round).length ? { sideGames: sideGamesOf(round).map(sg => ({ game: sg.game, settings: structuredClone(sg.settings), ...(sg.hcPct != null ? { hcPct: sg.hcPct } : {}) })) } : {}),
    // Half strokes: the rematch plays them too (absent when the round didn't)
    ...(round.halfStrokes ? { halfStrokes: true } : {}),
    // Played for points or a reward: the rematch is too (absent on money rounds)
    ...(storedPlayFor(round.playFor) ? { playFor: storedPlayFor(round.playFor) } : {}),
    step: !course ? 1 : missing.length ? 2 : 3,
  };
}
