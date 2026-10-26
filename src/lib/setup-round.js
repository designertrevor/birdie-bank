// The round that setup saves (src/screens/newround/useSetupActions.js useStartRound), built here
// as plain functions so setup-round.test.js can prove a change to setup's screens saves the same
// round for the same choices. Moved out of useStartRound unchanged: the hook still asks about
// missing handicaps and age, saves the round and sends the analytics; this file only builds it.
// trips.js before cup.js: cup.js and trips.js import each other, and node runs the test from this file
import { tripStamp } from './trips.js';
import { GAMES, calcuttaSalesOf, createRound, holesInPlay } from './round.js';
import { betsOf, cleanBet } from './pair-bets.js';
import { defaultTeams, teamsCfg } from './teams.js';
import { withQuotaRules } from './quota-carry.js';
import { halfStrokesOffered } from './allowances.js';
import { findCourse } from './courses.js';
import { usualsOf } from './usuals.js';
import { withSessionWorth } from './trip-templates.js';
import { cleanRoundCup, cupCounts } from './cup.js';
import { challengeIdOfBet } from './challenges.js';

/** The betting players with handicaps on and no handicap saved or typed in (they'd play as scratch). */
export function noHandicapIds(s, { useHc, game, betting, hcOverride }) {
  // Only the betting players' handicaps matter: someone just playing gets no strokes
  return useHc && game !== 'bbb' ? betting.filter(pid => s.players[pid]?.index == null && hcOverride[pid] == null) : [];
}

/** The holes for a game just picked: the same, unless the game can't be played over them (then its first). */
export function fitHoles(game, holesCount) {
  return game && GAMES[game] && !GAMES[game].holes.includes(holesCount) ? GAMES[game].holes[0] : holesCount;
}

/**
 * The teams to use once the players are set (on the way to the Bets step, or back to the overview):
 * new or changed players get fresh teams, and so does a game that takes another number of teams
 * (three scramble teams, then a switch to Best ball). Returns `teams` itself when they still fit.
 * On a team points trip the partners start from the trip's teams, rotated (cup.js), for foursomes
 * and for any game played two against two (a 2 v 2 Nassau): `cupTeams()` gives those, or null.
 */
export function setupTeams({ game, teams, betting, foursomes = false, tripCup = false, cupTeams = () => null }) {
  const cfg = GAMES[game]?.teams;
  const wrongCount = !!cfg && !!teams && (Array.isArray(cfg.count) ? teams.length < cfg.count[0] || teams.length > cfg.count[1] : teams.length !== cfg.count);
  const twoTeams = !!cfg && (Array.isArray(cfg.count) ? cfg.count[0] <= 2 && cfg.count[1] >= 2 : cfg.count === 2);
  if (!teams || wrongCount || teams.flat().length !== betting.length || teams.flat().some(pid => !betting.includes(pid))) {
    return ((foursomes || (tripCup && twoTeams)) && cupTeams()) || defaultTeams(game, betting);
  }
  return teams;
}

/**
 * The round for setup's picks, before the age question. `noHc` is noHandicapIds's answer (when
 * nobody has a handicap the round plays without them). Returns the round, the settings to keep as
 * next time's defaults, and the agreed challenges that went in as side bets.
 */
export function buildSetupRound(s, { id, game, course, holesCount, nine, startHole, orderedPicked, betting, tees, defaultTee, hcOverride, opts, sides, useHc, noHc = [], teams, casualIds, playFor, shownBets }) {
  const players = orderedPicked.map(pid => ({ ...s.players[pid], tee: tees[pid] || defaultTee, courseHcOverride: hcOverride[pid] }));
  // Share-image choice and the side bet card are personal settings, not part of a round's bets
  // Half strokes are this round's choice, never next time's default
  const { shareAmounts: _personal, shareScores: _scores, betPrompt: _prompt, halfStrokes: _half, ...settings } = structuredClone(opts);
  const halfStrokes = !!opts.halfStrokes && halfStrokesOffered(game, sides);
  // Team quota (a Quota house rule) is played in teams too, when it's on; only the betting players count
  const round = createRound({
    // A start left over from other holes (the nine or course changed) is the first hole
    id, game, course, holesCount, nine, startHole: holesInPlay(course, holesCount, nine).some(h => h.no === startHole) ? startHole : null, players, settings, hcPct: opts.hcPct, useHandicaps: useHc && !(noHc.length && noHc.length === betting.length),
    teams: teamsCfg(game, settings, betting.length) ? teams : null, halfStrokes, justPlaying: casualIds,
  });
  // "Quota moves after the round": each player starts from the quota their last such round left them,
  // and Team quota only stays on with its teams
  withQuotaRules(s, round);
  if (sides.length) round.sideGames = structuredClone(sides);
  // The Calcutta keeps only the sales still in the round: a lot or a buyer from before a change of players goes
  const cal = round.sideGames?.find(sg => sg.game === 'calcutta');
  if (cal?.auction) cal.auction = { sales: calcuttaSalesOf(round, cal) };
  if (playFor) round.playFor = structuredClone(playFor);
  // Side bets whose two players are both still in the round (setup's list can outlive a change of players),
  // agreed challenges among them
  const bets = betsOf({ ...round, bets: shownBets }).map(b => cleanBet(round, b));
  if (bets.length) round.bets = bets;
  const challengesIn = bets.map(b => challengeIdOfBet(b.id)).filter(Boolean);
  return { round, settings, challengesIn };
}

/** After the age question: the trip, a team points trip's matches, the trip schedule's place and the usual it came from (mutates `round`). */
export function finishSetupRound(s, round, { game, course, tripPick = null, tripCup = null, roundCup = null, fromSession = null, schedHit = null, fromPlan = null, usualId = null }) {
  // Counted for the trip: the stamp rides in the round to every phone in it (trips.js)
  if (tripPick) round.trip = tripStamp(tripPick);
  // Its matches for a team points trip, as set up here (a scramble or Chapman has none: one ball a
  // team; alternate shot is foursomes between its two teams)
  if (tripCup && roundCup && cupCounts(game)) {
    const c = cleanRoundCup({ game, players: round.players, teams: round.teams, cup: withSessionWorth(roundCup, (fromSession?.trip === tripPick.id ? fromSession : schedHit?.session) || null, tripPick.id) });
    if (c) round.cup = c;
  }
  // A round the trip's schedule planned keeps its place in it (trip-templates.js)
  const planSession = fromPlan ? s.plans?.[fromPlan]?.session : null;
  if (tripPick && planSession?.trip === tripPick.id) round.session = structuredClone(planSession);
  else if (tripPick && schedHit && round.cup) round.session = structuredClone(schedHit.session);
  // Started from a saved usual (still the same game at the same course): finishing it updates "Last played"
  const from = usualId && usualsOf(s).find(u => u.id === usualId);
  if (from && from.game === game && (from.courseId === course.id || findCourse(s, from.courseId)?.id === course.id)) round.usualId = usualId;
  return round;
}
