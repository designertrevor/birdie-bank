// Round model: creating a round and deriving everything (strokes, nets, money) from it.
import {
  courseHandicap, strokesOffLow, strokesOnHole, rankHoles, pickupGross,
  settleBankerHole, bankerFor, holeWinner, nassauResult, pressOpportunities, minimalTransfers, nassauLegs, matchStatus,
} from './golf.js';
import {
  bestBall, sideSplit, vegasHole, sixesPairings, sixesSegments, stablefordPoints, quotaPoints, quotaFor, ninesPoints,
  acesDeuces, settleTotals, scrambleTeamHandicap, rabbitHolder, scoreDots, DOT_KINDS, roundCents,
  snakeHolder, snakeValue, hammerHole, canHammer, birdiePot, birdieShares,
} from './games.js';
import { payFields } from './pay.js';
import { gamePct, halfStrokesOn, playsAtPct } from './allowances.js';
import { betsMoney, betsOf, isCashBet } from './pair-bets.js';

/**
 * Every game the app can score. `teams` says how players are grouped in the setup step:
 *   { count: 2, size: 2 }: exactly two teams of two (Vegas)
 *   { count: 2 }: two sides of any size, e.g. 1 v 1, 2 v 2, 1 v 3 (match play)
 *   { count: 2, optional: true }: two sides only when more than two play (Nassau)
 *   { count: [2, 4] }: two to four teams (scramble)
 * `order` means the playing order matters (banker rotation, wolf, sixes pairings).
 * `marks` means the scorekeeper records things other than scores on each hole.
 */
export const GAMES = {
  banker: {
    name: 'Banker', min: 3, max: 8, holes: [9, 18], order: true,
    blurb: 'Rotating banker takes on everyone each hole',
    players: '3–8 players', icon: 'bank', group: 'Classics',
  },
  nassau: {
    name: 'Nassau', min: 2, max: 4, holes: [9, 18], teams: { count: 2, optional: true },
    blurb: 'Front, back and total: three bets in one',
    players: '2–4 players', icon: 'flag-pennant', group: 'Classics',
  },
  skins: {
    name: 'Skins', min: 2, max: 8, holes: [9, 18],
    blurb: 'Win a hole outright to take the skin',
    players: '2–8 players', icon: 'coins', group: 'Classics',
  },
  wolf: {
    name: 'Wolf', min: 4, max: 4, holes: [9, 18], order: true,
    blurb: 'Pick a partner each hole, or go it alone',
    players: '4 players exactly', icon: 'paw-print', group: 'Classics',
  },
  match: {
    name: 'Match play', min: 2, max: 8, holes: [9, 18], teams: { count: 2 },
    blurb: 'Singles, best ball, or one against the field',
    players: '2–8 players', icon: 'sword', group: 'Head to head',
  },
  hammer: {
    name: 'Hammer', min: 2, max: 4, holes: [9, 18], teams: { count: 2, optional: true }, marks: true,
    blurb: 'Double the hole any time. Take it or fold',
    players: '2–4 players · 1 v 1 or 2 v 2', icon: 'hammer', group: 'Head to head',
  },
  vegas: {
    name: 'Vegas', min: 4, max: 4, holes: [9, 18], teams: { count: 2, size: 2 },
    blurb: 'Pair up scores into a number: 4 and 5 make 45',
    players: '4 players · 2 v 2', icon: 'dice-five', group: 'Head to head',
  },
  sixes: {
    name: 'Sixes', min: 4, max: 4, holes: [9, 18], order: true,
    blurb: 'Partners switch every six holes. Also called Hollywood',
    players: '4 players exactly', icon: 'arrows-clockwise', group: 'Head to head',
  },
  scramble: {
    name: 'Scramble', min: 2, max: 8, holes: [9, 18], teams: { count: [2, 4] },
    blurb: 'One ball per team, best shot every time',
    players: '2–8 players · 2–4 teams', icon: 'users-four', group: 'Team',
  },
  stroke: {
    name: 'Stroke play', min: 2, max: 8, holes: [9, 18],
    blurb: 'Lowest net total wins the pot, or pay per stroke',
    players: '2–8 players', icon: 'list-numbers', group: 'Full round',
  },
  stableford: {
    name: 'Stableford', min: 2, max: 8, holes: [9, 18],
    blurb: 'Points for every hole. A blow-up only costs you a zero',
    players: '2–8 players', icon: 'star', group: 'Full round',
  },
  quota: {
    name: 'Quota', min: 2, max: 8, holes: [9, 18],
    blurb: 'Beat your own number: 36 minus your handicap',
    players: '2–8 players', icon: 'target', group: 'Full round',
  },
  nines: {
    name: 'Nines', min: 3, max: 3, holes: [9, 18],
    blurb: '5-3-1: nine points a hole for a threesome',
    players: '3 players exactly', icon: 'number-circle-nine', group: 'Points',
  },
  aces: {
    name: 'Aces & Deuces', min: 3, max: 4, holes: [9, 18],
    blurb: 'Low wins from everyone, high pays everyone',
    players: '3–4 players', icon: 'spade', group: 'Points',
  },
  bbb: {
    name: 'Bingo Bango Bongo', min: 2, max: 8, holes: [9, 18], marks: true,
    blurb: 'First on, closest in, first in the hole',
    players: '2–8 players', icon: 'confetti', group: 'Points',
  },
  dots: {
    name: 'Dots', min: 2, max: 8, holes: [9, 18], marks: true,
    blurb: 'Greenies, sandies, chip-ins: junk that pays',
    players: '2–8 players', icon: 'medal', group: 'Points',
  },
  rabbit: {
    name: 'Rabbit', min: 2, max: 8, holes: [9, 18],
    blurb: 'Win a hole to catch the rabbit, hold it at the turn',
    players: '2–8 players', icon: 'rabbit', group: 'Points',
  },
  snake: {
    name: 'Snake', min: 2, max: 8, holes: [9, 18], marks: true,
    blurb: 'Three-putt and you hold the snake. Pass it on',
    players: '2–8 players', icon: 'wave-sine', group: 'Points',
  },
};

export const GAME_GROUPS = ['Classics', 'Head to head', 'Team', 'Full round', 'Points'];

/** Course par for a set of holes. */
export function parOf(holes) { return holes.reduce((a, h) => a + (h.par || 0), 0); }

/**
 * The holes a round will play, in playing order.
 * Each: { no, courseIdx, par, hdcp, rank }
 */
export function holesInPlay(course, holesCount, nine = 'front', startHole = null) {
  const n = course.holes.length;
  let list = [];
  // 9-hole cards number handicaps 1–9 or odd 1–17; normalise to a 1–9 ranking first
  const nineRank = n === 9 ? rankHoles(course.holes.map(h => h.hdcp)) : null;
  const make = (no, idx, pass = 0) => {
    const h = course.holes[idx];
    // On a 9-hole course played twice, split handicaps into odd (first pass) / even (second)
    const hdcp = n === 9 && holesCount === 18 ? (nineRank[idx] * 2 - (pass === 0 ? 1 : 0)) : h.hdcp;
    return { no, courseIdx: idx, par: h.par, hdcp };
  };
  if (holesCount === 18) {
    if (n === 18) list = course.holes.map((_, i) => make(i + 1, i));
    else list = [...course.holes.map((_, i) => make(i + 1, i, 0)), ...course.holes.map((_, i) => make(i + 10, i, 1))];
  } else {
    if (n === 9) list = course.holes.map((_, i) => make(i + 1, i));
    else {
      const off = nine === 'back' ? 9 : 0;
      list = course.holes.slice(off, off + 9).map((_, i) => make(off + i + 1, off + i));
    }
  }
  if (startHole != null) {
    const k = list.findIndex(h => h.no === startHole);
    if (k > 0) list = [...list.slice(k), ...list.slice(0, k)];
  }
  const ranks = rankHoles(list.map(h => h.hdcp));
  return list.map((h, i) => ({ ...h, rank: ranks[i] }));
}

/**
 * Course handicap for the holes actually being played. Ratings on 9-hole courses are
 * 9-hole ratings, so they're doubled into the 18-hole formula.
 */
export function roundCourseHandicap(index, tee, course, holes, holesCount) {
  if (!tee) return null;
  const nineCourse = course.holes.length === 9;
  const t = nineCourse && tee.rating != null ? { ...tee, rating: tee.rating * 2 } : tee;
  const par = nineCourse && holesCount === 9 ? parOf(holes) * 2 : holesCount === 9 ? parOf(course.holes) : parOf(holes);
  const full = courseHandicap(index, t, par, 18);
  if (full == null) return null;
  return holesCount === 9 ? Math.round(full / 2) : full;
}

/**
 * Course handicap a player will actually play off: manual override, else WHS from the
 * tee's rating/slope, else their index (halved for 9 holes), else 0.
 */
export function effectiveCourseHc(index, tee, course, holes, holesCount, override) {
  if (override != null) return { value: override, source: 'set' };
  const computed = roundCourseHandicap(index, tee, course, holes, holesCount);
  if (computed != null) return { value: computed, source: 'whs' };
  if (index != null) return { value: Math.round(holesCount === 9 ? index / 2 : index), source: 'index' };
  return { value: 0, source: 'none' };
}

const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D'];

/** Teams from arrays of player ids: [{ id, name, players }]. Names come from first names when short enough. */
export function buildTeams(groups, players) {
  return groups.map((pids, i) => {
    const members = pids.map(pid => players.find(p => p.id === pid)).filter(Boolean);
    const first = members.map(p => p.name.split(' ')[0]);
    const name = members.length <= 2 ? first.join(' & ') : TEAM_NAMES[i];
    return { id: `t${i}`, name, players: members.map(p => p.id) };
  });
}

/** Scramble teams play off one handicap built from their members', then strokes off the low team. */
function withTeamHandicaps(round, teams, players, useHandicaps, hcPct) {
  if (round.game !== 'scramble') return teams;
  const hcs = teams.map(t => scrambleTeamHandicap(t.players.map(pid => players.find(p => p.id === pid)?.courseHc ?? 0)));
  const plays = useHandicaps ? strokesOffLow(hcs, hcPct) : hcs.map(() => 0);
  return teams.map((t, i) => ({ ...t, courseHc: hcs[i], plays: plays[i] }));
}

/** Build a new round object from wizard selections. `teams` is an array of arrays of player ids. */
export function createRound({ id, game, course, holesCount, nine, startHole, players, settings, hcPct, useHandicaps = true, teams = null, halfStrokes = false }) {
  const holes = holesInPlay(course, holesCount, nine, startHole);
  const par = parOf(holes);
  const withHc = players.map(p => {
    const tee = course.tees?.find(t => t.name === p.tee) || course.tees?.[0] || null;
    const courseHc = effectiveCourseHc(p.index, tee, course, holes, holesCount, p.courseHcOverride).value;
    // Payment app and handle ride along, so friends who join the round can pay each other
    return { id: p.id, name: p.name, tee: tee?.name ?? null, index: p.index ?? null, courseHc, courseHcOverride: p.courseHcOverride ?? null, ...payFields(p) };
  });
  const plays = useHandicaps ? strokesOffLow(withHc.map(p => p.courseHc), hcPct) : withHc.map(() => 0);
  const full = withHc.map((p, i) => ({ ...p, plays: plays[i] }));
  const round = {
    id, game, status: 'active',
    createdAt: Date.now(), finishedAt: null,
    course: { id: course.id, name: course.name, city: course.city, tees: course.tees?.map(t => ({ name: t.name, color: t.color })) || [] },
    holesCount, nine: holesCount === 9 && course.holes.length === 18 ? nine : null,
    holes, par,
    useHandicaps, hcPct,
    players: full,
    teams: null,
    settings: structuredClone(settings),
    scores: {},      // holeNo -> { scorerId: gross | 'X' }
    banker: {},      // holeNo -> { banker, bets, doubled, doubleBack }
    wolf: {},        // holeNo -> { wolf, partner: pid | null (lone), blind?: true (lone, called before the tee shots) }
    marks: {},       // holeNo -> game-specific extras (dots, bingo bango bongo)
    presses: [],
    pressSeq: 0,
    current: 0,      // index into holes
    left: {},        // playerId -> hole number they stopped after (0: before the first hole)
  };
  if (teams?.length) round.teams = withTeamHandicaps(round, buildTeams(teams, full), full, useHandicaps, hcPct);
  // Half strokes (allowances.js) only when chosen, so a round without them looks as it always did
  if (halfStrokes && useHandicaps) round.halfStrokes = true;
  return round;
}

// --------------------------- Bets changed mid-round ---------------------------
// A bet changed during a round applies from a given hole on (the default) or to the whole round.
// round.settings always holds the bets for the holes still to come. round.betHistory keeps the
// bets that earlier holes were played for: [{ upto, settings }], sorted by `upto`, each entry
// covering the playing positions after the previous entry's `upto` up to and including its own.
// `settings` is just the game's own block (round.settings[round.game]) at the time.
// A side game keeps its own history the same way on its own entry (round.sideGames[i].betHistory),
// so the main game's history and a side game's never mix, and rounds from before have none.

/**
 * Changes that always cover every hole: a game whose money is one pot for the whole round, and a
 * change to how the whole round is laid out, which can't hold for only some holes (Skins net, gross
 * or both, which is read once for the round, and a Snake split into nines or not).
 */
export function wholeRoundOnly(game, before, after) {
  if (game === 'scramble' || game === 'birdies' || POT_GAMES.includes(game)) return true;
  if (game === 'skins') return before?.payout === 'pot' || after?.payout === 'pot' || (before?.kind || 'net') !== (after?.kind || 'net');
  if (game === 'snake') return !!before?.nines !== !!after?.nines;
  if (game === 'stroke' || game === 'stableford' || game === 'quota') return before?.payout === 'pot' || after?.payout === 'pot';
  return false;
}

/** The round's settings in force on the hole at playing position `pos` (1-based). */
export function settingsAt(round, pos) {
  const hist = round.betHistory;
  if (!hist?.length) return round.settings;
  const e = hist.find(x => pos <= x.upto);
  return e ? { ...round.settings, [round.game]: e.settings } : round.settings;
}

/**
 * Change the game's bets in a round under way. `fromPos` is the playing position the new bets
 * start on; holes before it keep what they were played for. Leave it null (or 1) for the whole
 * round, which also clears any earlier changes. `key` picks the game: 'main', or a side game's key,
 * whose settings and history live on its own round.sideGames entry. Returns a new round; `round`
 * is not mutated.
 */
export function changeBets(round, gameSettings, fromPos = null, key = 'main') {
  if (key !== 'main') return changeSideBets(round, key, gameSettings, fromPos);
  const game = round.game;
  const next = { ...round, settings: { ...round.settings, [game]: structuredClone(gameSettings) } };
  if (fromPos == null || fromPos <= 1 || wholeRoundOnly(game, round.settings[game], gameSettings)) {
    delete next.betHistory;
    return next;
  }
  const upto = fromPos - 1;
  const kept = (round.betHistory || []).filter(x => x.upto < upto);
  const hist = [...kept, { upto, settings: structuredClone(settingsAt(round, upto)[game]) }];
  // Neighbouring stretches played for the same bets are one stretch
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const merged = [];
  for (const e of hist) {
    if (merged.length && same(merged.at(-1).settings, e.settings)) merged[merged.length - 1] = e;
    else merged.push(e);
  }
  if (merged.length && same(merged.at(-1).settings, gameSettings)) merged.pop();
  if (merged.length) next.betHistory = merged; else delete next.betHistory;
  return next;
}

/** changeBets for a side game: the same rules, run on the side game's own settings and history. */
function changeSideBets(round, key, gameSettings, fromPos) {
  const i = (round.sideGames || []).findIndex(sg => sg?.game === key && sg.settings && typeof sg.settings === 'object');
  if (i < 0) return round;
  const sg = round.sideGames[i];
  const alone = changeBets({ game: key, settings: { [key]: sg.settings }, betHistory: sg.betHistory }, gameSettings, fromPos);
  const next = { ...sg, settings: alone.settings[key] };
  if (alone.betHistory) next.betHistory = alone.betHistory; else delete next.betHistory;
  return { ...round, sideGames: round.sideGames.map((x, k) => (k === i ? next : x)) };
}

/** A game's bet history: the main game's, or a side game's own (see changeBets). */
function historyOf(round, key) {
  if (key === 'main') return round.betHistory;
  const hist = sideGamesOf(round).find(sg => sg.game === key)?.betHistory;
  return Array.isArray(hist) ? hist : undefined;
}

/** Whether any hole of a game ('main' or a side game's key) was played for different bets than the ones in force now. */
export function betsChanged(round, key = 'main') {
  return !!historyOf(round, key)?.length;
}

/**
 * The holes a game's bets changed on, in playing order: [{ pos, no }], each the first hole played
 * for the new bets. Empty when the bets never changed.
 */
export function betChanges(round, key = 'main') {
  return (historyOf(round, key) || []).map(e => ({ pos: e.upto + 1, no: round.holes?.[e.upto]?.no ?? e.upto + 1 }));
}

// --------------------------- Players who left --------------------------------
// round.left maps a player id to the hole number they stopped after (0 means before the first hole).
// From the next hole on they have no score box, holes are complete without them and each game's
// money for those holes is worked out among the players still playing. Holes they played count as normal.

/** Playing position (1-based) of the last hole a player played, or Infinity while they're still playing. */
export function leftAt(round, pid) {
  const no = round.left?.[pid];
  if (no == null) return Infinity;
  if (no === 0) return 0;
  const i = round.holes.findIndex(h => h.no === no);
  // Their hole was dropped by a change of round length: treat them as still playing rather than guess
  return i < 0 ? Infinity : i + 1;
}

/** Playing position (1-based) of a hole in this round. */
export function posOf(round, hole) {
  return round.holes.findIndex(h => h.no === hole.no) + 1;
}

const anyLeft = round => (!!round.left && Object.keys(round.left).length > 0) || (!!round.joined && Object.keys(round.joined).length > 0);

/** Whether a player is in the round on this hole: they've joined and haven't left. */
export function playsHole(round, pid, hole) {
  if (!anyLeft(round)) return true;
  const pos = posOf(round, hole);
  return pos >= joinedAt(round, pid) && pos <= leftAt(round, pid);
}

/** The players in the round on a hole. */
export function playersOn(round, hole) {
  if (!anyLeft(round)) return round.players;
  return round.players.filter(p => playsHole(round, p.id, hole));
}

/** Players who left, in the order they left: [{ player, after: hole number (0: before the first), pos }]. */
export function playersLeft(round) {
  return round.players
    .filter(p => round.left?.[p.id] != null)
    .map(p => ({ player: p, after: round.left[p.id], pos: leftAt(round, p.id) }))
    .sort((a, b) => a.pos - b.pos);
}

/** Players still in at the end of the round. */
export function playersToEnd(round) {
  return round.players.filter(p => leftAt(round, p.id) >= round.holes.length);
}

/**
 * Whether `pid` can be marked as leaving: at least two players (or, in a scramble, two teams)
 * have to be left to play on.
 */
export function canLeave(round, pid) {
  if (round.left?.[pid] != null) return false;
  const staying = playersToEnd(round).filter(p => p.id !== pid).map(p => p.id);
  if (round.game === 'scramble' && round.teams) return round.teams.filter(t => t.players.some(x => staying.includes(x))).length >= 2;
  return staying.length >= 2;
}

// --------------------------- Players added mid-round -------------------------
// round.joined maps a player id to the hole number they started on. Before it they have no
// score box and no money; from it on they play like everyone else, the same way the holes
// after someone leaves are worked out without them. Players there from the start aren't in it.

/** Games a player can be added to. Games with sides, teams or an exact head count aren't, even before the first score. */
export const ADD_MID_ROUND = ['banker', 'skins', 'stroke', 'stableford', 'quota', 'aces', 'bbb', 'dots', 'rabbit'];

/** Playing position (1-based) of the first hole a player plays: 1 unless they were added mid-round. */
export function joinedAt(round, pid) {
  const no = round.joined?.[pid];
  if (no == null) return 1;
  const i = round.holes.findIndex(h => h.no === no);
  // Their hole was dropped by a change of round length: count them from the start rather than guess
  return i < 0 ? 1 : i + 1;
}

/** Players added after the first hole, in the order they joined: [{ player, from: hole number, pos }]. */
export function playersJoined(round) {
  return round.players
    .filter(p => joinedAt(round, p.id) > 1)
    .map(p => ({ player: p, from: round.joined[p.id], pos: joinedAt(round, p.id) }))
    .sort((a, b) => a.pos - b.pos);
}

/** Whether a player was in for every hole: there from the first and never left. */
export function playsWholeRound(round, pid) {
  return joinedAt(round, pid) <= 1 && leftAt(round, pid) >= round.holes.length;
}

/** Whether any score has been entered yet. */
export function roundStarted(round) {
  return round.holes.some(h => Object.values(round.scores?.[h.no] || {}).some(v => v != null));
}

/** Most players in a round with side games: a side game takes up to 8, whatever the main game's cap. */
export const MAX_SIDE_PLAYERS = 8;

/** Why nobody can join the main game right now, or null when someone can. Its cap counts only its own players. */
function mainAddProblem(round) {
  const g = GAMES[round.game];
  const inMain = gameView(round, 'main').players.length;
  if (inMain >= g.max) return `${g.name} is for ${g.max === g.min ? g.max : `up to ${g.max}`} players, and the group is full.`;
  if (!ADD_MID_ROUND.includes(round.game)) {
    // Sides, teams and rotations are set when the round is made, so a new player would have no side to play on
    return roundStarted(round)
      ? `${g.name} is set up for the players who started, so nobody can join once it’s under way.`
      : `${g.name} is played in set sides, so a new player can’t be slotted in. Start a fresh round with everyone in it.`;
  }
  return null;
}

/**
 * Whether a side game can take someone new. A pot (the birdie pot, or Skins played for a pot) is for
 * the players who started, so it only takes someone new before the first hole they'd miss (`late`).
 */
function sideTakes(sg, late) {
  if (sg.game === 'birdies' || POT_GAMES.includes(sg.game)) return !late;
  if (sg.game === 'skins' && sg.settings?.payout === 'pot') return !late;
  return true;
}

/**
 * Why nobody can be added to this round right now, or null when someone can. With side games, a
 * player who can't join the main game (set sides, or it's full) can still join a side game that takes
 * them, up to MAX_SIDE_PLAYERS in the round.
 */
export function addPlayerProblem(round) {
  const main = mainAddProblem(round);
  if (!main) return null;
  const sgs = sideGamesOf(round);
  if (!sgs.length) return main;
  if (round.players.length >= MAX_SIDE_PLAYERS) return `A round is for up to ${MAX_SIDE_PLAYERS} players, and the group is full.`;
  const late = roundStarted(round);
  return sgs.some(sg => sideTakes(sg, late)) ? null : main;
}

/**
 * The games someone being added could play, one switch each: the main game first, then each side
 * game. `first` is their first name and `fromNo` the hole they start on (null before any score).
 * [{ key, label, on, disabled, reason }]. `on` is the switch's starting place; a disabled game is
 * always off. Fixed-side main games (and a full one) never take a late joiner.
 */
export function joinGames(round, first, fromNo = null) {
  const pos = fromNo == null ? 1 : round.holes.findIndex(h => h.no === fromNo) + 1;
  const late = pos > 1;
  const name = first || 'they';
  const out = [];
  const g = GAMES[round.game];
  const problem = mainAddProblem(round);
  if (problem) {
    const full = ADD_MID_ROUND.includes(round.game) && gameView(round, 'main').players.length >= g.max;
    out.push({ key: 'main', label: g.name, on: false, disabled: true, reason: full ? `${g.name} is for ${g.max === g.min ? g.max : `up to ${g.max}`} players, so ${name} sits it out.` : `${g.name} is set up for the players already in it, so ${name} sits it out.` });
  } else {
    const pid = '__new';
    const probe = { ...round, joined: late ? { ...(round.joined || {}), [pid]: fromNo } : round.joined };
    out.push({ key: 'main', label: g.name, on: true, disabled: false, reason: late ? mainJoinRule(probe, pid) : 'They play every hole.' });
  }
  for (const sg of sideGamesOf(round)) {
    const label = SIDE_GAMES[sg.game].label;
    if (!sideTakes(sg, late)) { out.push({ key: sg.game, label, on: false, disabled: true, reason: 'The pot is for the players who started.' }); continue; }
    const reason = !late ? 'They play every hole.'
      : sg.game === 'skins' ? `From hole ${fromNo}. Skins already carrying stay with the players who built them.`
        : `From hole ${fromNo}.`;
    out.push({ key: sg.game, label, on: true, disabled: false, reason });
  }
  return out;
}

/**
 * The first hole a new player could start on: the hole on screen if nobody has scored it yet,
 * else the next hole with no scores. Null when every hole has scores.
 */
export function firstOpenHole(round) {
  const from = Math.min(round.current || 0, round.holes.length - 1);
  const h = round.holes.find((x, i) => i >= from && !Object.values(round.scores?.[x.no] || {}).some(v => v != null));
  return h ? h.no : null;
}

/**
 * Add a player to a round. `player` is { id, name, index?, courseHc? } (courseHc: the strokes
 * base to play off; else it comes from the index). `fromNo` is the hole number they start on.
 * Before any score is in they're simply one more player and everyone's strokes are worked out
 * again. Once the round is under way nobody else's strokes change: the new player gets strokes
 * against the same low player everyone else plays off. Returns a new round; `round` is untouched.
 * `games` lists the game keys they play (see gameKeys); leave it null for every game. When they're
 * not in every game, round.gamesFor records theirs, and nobody else's strokes change even before the
 * first score, so a player who's only in a side game never moves the main game's strokes.
 */
export function addPlayerToRound(round, player, fromNo = null, games = null) {
  const hc = player.courseHc ?? (player.index != null ? Math.round(round.holesCount === 9 ? player.index / 2 : player.index) : 0);
  const fresh = { id: player.id, name: player.name, tee: null, index: player.index ?? null, courseHc: hc, courseHcOverride: player.courseHc ?? null, ...payFields(player) };
  const next = { ...round, players: [...round.players], joined: { ...(round.joined || {}) } };
  const keys = gameKeys(round);
  const inAll = !Array.isArray(games) || keys.every(k => games.includes(k));
  if (!inAll) next.gamesFor = { ...(round.gamesFor || {}), [fresh.id]: keys.filter(k => games.includes(k)) };
  const started = roundStarted(round) || !inAll;
  if (!started) {
    const all = [...round.players, fresh];
    const plays = round.useHandicaps ? strokesOffLow(all.map(p => p.courseHc), round.hcPct) : all.map(() => 0);
    next.players = all.map((p, i) => ({ ...p, plays: plays[i] }));
    return next;
  }
  let plays = 0;
  if (round.useHandicaps && round.players.length) {
    // Strokes off the same low player as before, so nobody's strokes on holes already played move
    const all = strokesOffLow([...round.players.map(p => p.courseHc), hc], round.hcPct);
    const low = round.players.reduce((a, p, i) => (p.plays < round.players[a].plays ? i : a), 0);
    plays = all.at(-1) - all[low] + (round.players[low].plays || 0);
  }
  next.players.push({ ...fresh, plays });
  const pos = fromNo == null ? -1 : round.holes.findIndex(h => h.no === fromNo);
  if (pos > 0) next.joined[fresh.id] = fromNo;
  return next;
}

/** What joining late does to the game, in a sentence (for the results and the add-a-player sheet). */
export function joinRule(round, pid) {
  const list = round.gamesFor?.[pid];
  if (Array.isArray(list) && sideGamesOf(round).length) return joinRuleByGame(round, pid, list);
  return withSideRule(mainJoinRule(round, pid), round, 'joined');
}

/** joinRule for a player who picked their games (round.gamesFor): a line for each game. */
function joinRuleByGame(round, pid, list) {
  const g = GAMES[round.game];
  const whole = playsWholeRound(round, pid);
  const parts = [list.includes('main') ? mainJoinRule(round, pid)
    : ADD_MID_ROUND.includes(round.game) ? `They sit out ${g.name}.` : `${g.name} is set up for the players already in it, so they sit it out.`];
  for (const sg of sideGamesOf(round)) {
    const inIt = list.includes(sg.game);
    const pot = POT_NAMES[sg.game] || (sg.game === 'skins' && sg.settings?.payout === 'pot' ? 'skins pot' : null);
    const label = SIDE_GAMES[sg.game].label;
    if (!inIt) parts.push(`They sit out ${pot ? `the ${pot}` : label}.`);
    else if (pot && !whole) parts.push(`The ${pot} is for the players who started, so they’re not in it.`);
    else if (pot) parts.push(`They’re in the ${pot}.`);
    else if (sg.game === 'skins') parts.push(whole ? 'They’re in Skins.' : 'They play Skins from there. Skins already carrying stay with the players who built them.');
    else parts.push(whole ? `They’re in ${label}.` : `They’re in ${label} from there.`);
  }
  return parts.join(' ');
}

/**
 * The main game's rule sentence, plus a word on the side games when a round has them: the birdie
 * pot is for the players who started (like every pot), and Skins and Junk carry on among whoever
 * is playing. Rounds without side games get the main sentence unchanged.
 */
function withSideRule(text, round, kind) {
  const sgs = sideGamesOf(round);
  if (!sgs.length) return text;
  const notes = [];
  // The birdie, closest to the pin and long drive pots: one sentence for them all
  const pots = sgs.filter(sg => POT_NAMES[sg.game]).map(sg => POT_NAMES[sg.game]);
  if (pots.length) {
    const what = pots.length === 1 ? `The ${pots[0]} is` : `The ${nameList(pots)} are`;
    notes.push(kind === 'joined' ? `${what} for the players who started, so they’re not in ${pots.length === 1 ? 'it' : 'them'}.` : `They’re out of the ${nameList(pots)}.`);
  }
  const others = sgs.filter(sg => !POT_NAMES[sg.game]).map(sg => SIDE_GAMES[sg.game].label);
  if (others.length) notes.push(kind === 'joined' ? `They’re in ${others.join(' and ')} from there.` : `${others.join(' and ')} carr${others.length > 1 ? 'y' : 'ies'} on among the players still there.`);
  return [text, ...notes].join(' ');
}

function mainJoinRule(round, pid) {
  const g = round.game;
  const s = round.settings?.[g];
  if ((g === 'stroke' || g === 'stableford' || g === 'quota') && s?.payout === 'pot') return 'The pot is for the players who started, so they’re not in it.';
  if (g === 'stroke' || g === 'stableford' || g === 'quota') return 'Their money counts from there: they settle with each player on the holes they both played.';
  if (g === 'rabbit') {
    const legs = nassauLegs(round.holes.length);
    const pos = joinedAt(round, pid);
    if (round.holes.length === 18 && pos <= legs.back.start) return pos === legs.back.start ? 'They’re in the rabbit on the back nine.' : 'They sit out the front nine rabbit and are in on the back nine.';
    return 'The rabbit was already running, so they sit it out.';
  }
  if (g === 'skins' && s?.payout === 'pot') return 'The pot is for the players who started, so they’re not in it.';
  if (g === 'skins') return 'They play for the skins from there on. Skins already carrying stay with the players who built them.';
  if (g === 'banker') return 'Their money counts from there: they bet against the bank and take their turn as banker.';
  return 'Their money counts from there.';
}

/**
 * Who has a score box on each hole: the players, or the teams in a scramble.
 * Each: { id, name, plays, team?: true }. With a hole, only those still playing it
 * (a scramble team plays on while any of its players is still there).
 */
export function scorers(round, hole = null) {
  if (round.game === 'scramble' && round.teams) {
    const teams = round.teams.map(t => ({ id: t.id, name: t.name, plays: t.plays || 0, courseHc: t.courseHc, team: true, players: t.players }));
    return hole ? teams.filter(t => t.players.some(pid => playsHole(round, pid, hole))) : teams;
  }
  return hole ? playersOn(round, hole) : round.players;
}

/** The two sides of a head-to-head game as arrays of player ids (teams if set, else one player each). */
export function sides(round) {
  if (round.teams?.length === 2) return round.teams.map(t => t.players);
  return round.players.slice(0, 2).map(p => [p.id]);
}

/**
 * The nine to keep when an 18-hole round on an 18-hole course drops to 9: whichever nine has
 * more scored holes, else the one the round started on.
 */
export function defaultNine(round) {
  let front = 0, back = 0;
  for (const h of round.holes) {
    if (!holeComplete(round, h)) continue;
    if (h.no <= 9) front++; else back++;
  }
  if (front !== back) return back > front ? 'back' : 'front';
  return (round.holes[0]?.no ?? 1) >= 10 ? 'back' : 'front';
}

/**
 * Change a round in progress between 9 and 18 holes. Scores, bets and wolf picks already
 * entered stay (they're keyed by hole number); the holes in play, par, course handicaps and
 * strokes are worked out again for the new length. Presses are cleared because the
 * legs change with the length. Returns a new round object; `round` is not mutated.
 */
function resizedHoles(round, course, holesCount, nine) {
  // Hole numbers, par and handicaps for the new length; the playing order comes from the round
  // so holes already scored keep their place (e.g. started on 5: 5–9, 1–4, then 10–18)
  const byNo = new Map(holesInPlay(course, holesCount, nine).map(h => [h.no, h]));
  let order = round.holes.map(h => h.no).filter(no => byNo.has(no));
  if (holesCount === 18) {
    // A 9-hole course goes round again in the same order; an 18-hole course carries on into the other nine
    const rest = course.holes.length === 9 ? order.map(no => no + 9) : [...byNo.keys()];
    for (const no of rest) if (!order.includes(no)) order.push(no);
  }
  const list = order.map(no => byNo.get(no));
  const ranks = rankHoles(list.map(h => h.hdcp));
  return list.map((h, i) => ({ ...h, rank: ranks[i] }));
}

export function resizeRound(round, rawCourse, holesCount, nine = 'front') {
  if (holesCount === round.holesCount) return round;
  // Fixes made during the round (a hole's par or stroke index, a tee's rating or slope) carry over
  const course = fixedCourse(rawCourse, round);
  // Course handicaps never move with a par fix (see fixHole), so they're worked out from the card's own pars
  const hcCourse = teeFixedCourse(rawCourse, round);
  const holes = resizedHoles(round, course, holesCount, nine);
  const ratio = holesCount / round.holesCount;
  const hcHoles = parFree(round, round.holes);
  const players = round.players.map(p => {
    const tee = hcCourse.tees?.find(t => t.name === p.tee) || null;
    // A figure set by hand (stored, or, on older rounds, one that doesn't match the formula) is scaled
    const was = effectiveCourseHc(p.index, tee, hcCourse, hcHoles, round.holesCount, null).value;
    const override = p.courseHcOverride ?? (was === p.courseHc ? null : p.courseHc);
    if (override != null) {
      const v = Math.round(override * ratio);
      return { ...p, courseHc: v, courseHcOverride: v };
    }
    return { ...p, courseHc: effectiveCourseHc(p.index, tee, hcCourse, parFree(round, holes), holesCount, null).value, courseHcOverride: null };
  });
  const full = withPlays(round, players);
  const curNo = round.holes[Math.min(round.current, round.holes.length - 1)]?.no;
  let current = holes.findIndex(h => h.no === curNo);
  if (current < 0) current = Math.max(0, holes.findIndex(h => !holeComplete(round, h)));
  if (current >= holes.length) current = holes.length - 1;
  const next = {
    ...round,
    holesCount, nine: holesCount === 9 && course.holes.length === 18 ? nine : null,
    holes, par: parOf(holes),
    players: full,
    presses: [],
    current,
  };
  if (round.teams) next.teams = withTeamHandicaps(next, round.teams, full, round.useHandicaps, round.hcPct);
  return next;
}

/** Players with `plays` (strokes off the low) worked out again from their course handicaps. */
function withPlays(round, players) {
  let plays = round.useHandicaps ? strokesOffLow(players.map(p => p.courseHc), round.hcPct) : players.map(() => 0);
  // A player who's only in the side games never sets the low: the main game's players play off
  // their own low, as if the side-only player weren't there (and they play off that same low)
  if (round.useHandicaps && round.gamesFor) {
    const lows = plays.filter((_, i) => playsGame(round, players[i].id, 'main'));
    const low = lows.length ? Math.min(...lows) : 0;
    plays = plays.map(v => v - low);
  }
  return players.map((p, i) => ({ ...p, plays: plays[i] }));
}

// --------------------------- Fix a hole or a tee ---------------------------
// The scorekeeper can correct a hole's par or stroke index, or a tee's rating and slope, for this
// round only. round.holeFixes = { holeNo: { courseIdx, par?: [old, new], hdcp?: [old, new], at, by } }
// and round.teeFixes = { teeName: { rating?: [old, new], slope?: [old, new], at, by } }. Rounds
// without them are untouched. A resize keeps them (see fixedCourse).

/** A 9-hole card played twice for 18: both passes share each course hole. */
export function playedTwice(round) {
  const idxs = round.holes.map(h => h.courseIdx).filter(i => i != null);
  return new Set(idxs).size < idxs.length;
}

/** Holes with each par as it was before any fix, for course handicaps (a par fix never moves them). */
function parFree(round, holes) {
  const fixes = Object.values(round.holeFixes || {});
  if (!fixes.length) return holes;
  return holes.map(h => {
    const f = fixes.find(x => x.courseIdx === h.courseIdx && x.par);
    return f ? { ...h, par: f.par[0] } : h;
  });
}

/** The course with this round's tee fixes laid over it. */
function teeFixedCourse(course, round) {
  const tf = round.teeFixes;
  if (!course || !tf || !Object.keys(tf).length) return course;
  return {
    ...course,
    tees: (course.tees || []).map(t => {
      const f = tf[t.name];
      if (!f) return t;
      return { ...t, ...(f.rating ? { rating: f.rating[1] } : {}), ...(f.slope ? { slope: f.slope[1] } : {}) };
    }),
  };
}

/** The course with this round's hole and tee fixes laid over it (the same object when there are none). */
export function fixedCourse(course, round) {
  const base = teeFixedCourse(course, round);
  const fixes = Object.values(round.holeFixes || {});
  if (!base || !fixes.length) return base;
  // A stroke index is only ever fixed on a round that isn't a 9 played twice, so it's always the card's own
  return {
    ...base,
    holes: base.holes.map((h, i) => {
      const f = fixes.filter(x => x.courseIdx === i);
      if (!f.length) return h;
      const par = f.find(x => x.par)?.par[1];
      const hdcp = f.find(x => x.hdcp)?.hdcp[1];
      return { ...h, ...(par != null ? { par } : {}), ...(hdcp != null ? { hdcp } : {}) };
    }),
  };
}

/** The fix recorded on a hole, or null. */
export function holeFixOf(round, holeNo) {
  return round.holeFixes?.[holeNo] || null;
}

/**
 * Correct one hole's par and stroke index for this round. Par applies to every pass over that
 * course hole (a 9-hole card played twice). A stroke index another hole already has swaps the two,
 * as on a real card, and every hole's rank is worked out again, so strokes can move on holes
 * already played and the money recounts. Course handicaps and strokes off the low stay as they
 * are: a par change shifts everyone's course handicap by the same amount. Returns a new round.
 */
export function fixHole(round, holeNo, { par, hdcp } = {}, { at = Date.now(), by = null } = {}) {
  const i = round.holes.findIndex(h => h.no === holeNo);
  if (i < 0) return round;
  const holes = round.holes.map(h => ({ ...h }));
  const target = holes[i];
  const fixes = { ...(round.holeFixes || {}) };
  const note = (h, key, from, to) => {
    const prev = fixes[h.no] || { courseIdx: h.courseIdx };
    const orig = prev[key] ? prev[key][0] : from;
    const next = { ...prev, at, by };
    if (orig === to) delete next[key]; else next[key] = [orig, to];
    if (!next.par && !next.hdcp) delete fixes[h.no]; else fixes[h.no] = next;
  };
  if (par != null && par !== target.par) {
    // A hole without a courseIdx (never expected) only ever fixes itself
    for (const h of holes) if (h === target || (target.courseIdx != null && h.courseIdx === target.courseIdx)) { note(h, 'par', h.par, par); h.par = par; }
  }
  if (hdcp != null && hdcp !== target.hdcp && !playedTwice(round)) {
    const other = holes.find(h => h.no !== holeNo && h.hdcp === hdcp);
    if (other) { note(other, 'hdcp', other.hdcp, target.hdcp); other.hdcp = target.hdcp; }
    note(target, 'hdcp', target.hdcp, hdcp);
    target.hdcp = hdcp;
  }
  const ranks = rankHoles(holes.map(h => h.hdcp));
  const next = { ...round, holes: holes.map((h, k) => ({ ...h, rank: ranks[k] })) };
  next.par = parOf(next.holes);
  if (Object.keys(fixes).length) next.holeFixes = fixes; else delete next.holeFixes;
  return next;
}

/** The hole whose stroke index `hdcp` would be swapped with `holeNo`'s, or null. */
export function hdcpSwapWith(round, holeNo, hdcp) {
  return round.holes.find(h => h.no !== holeNo && h.hdcp === hdcp) || null;
}

/**
 * Correct a tee's rating and slope for this round. Course handicaps for players on that tee are
 * worked out again (a handicap set by hand stays), then everyone's strokes off the low.
 * `course` is this phone's copy of the course (the round only keeps tee names). Returns a new round.
 */
export function fixTee(round, course, teeName, { rating, slope } = {}, { at = Date.now(), by = null } = {}) {
  const tee = course?.tees?.find(t => t.name === teeName);
  if (!tee) return round;
  const fixes = { ...(round.teeFixes || {}) };
  const prev = fixes[teeName] || {};
  const next = { ...prev, at, by };
  for (const [key, to] of [['rating', rating], ['slope', slope]]) {
    if (to == null) continue;
    const orig = prev[key] ? prev[key][0] : tee[key] ?? null;
    if (orig === to) delete next[key]; else next[key] = [orig, to];
  }
  if (next.rating || next.slope) fixes[teeName] = next; else delete fixes[teeName];
  const out = { ...round };
  if (Object.keys(fixes).length) out.teeFixes = fixes; else delete out.teeFixes;
  const wasCourse = teeFixedCourse(course, round);
  const hcCourse = teeFixedCourse(course, out);
  const hcHoles = parFree(round, round.holes);
  const players = round.players.map(p => {
    if (p.tee !== teeName || p.courseHcOverride != null) return p;
    // A figure that doesn't match the tee as it was was set by hand (older rounds only kept the figure): it stays
    const was = effectiveCourseHc(p.index, wasCourse.tees.find(x => x.name === teeName), wasCourse, hcHoles, round.holesCount, null).value;
    if (was !== p.courseHc) return p;
    const t = hcCourse.tees.find(x => x.name === teeName);
    return { ...p, courseHc: effectiveCourseHc(p.index, t, hcCourse, hcHoles, round.holesCount, null).value };
  });
  // No course handicap moved: strokes stay exactly as they are (a late joiner keeps playing off the same low)
  if (players.every((p, i) => p.courseHc === round.players[i].courseHc)) return out;
  out.players = withPlays(round, players);
  if (round.teams) out.teams = withTeamHandicaps(out, round.teams, out.players, round.useHandicaps, round.hcPct);
  return out;
}

/**
 * Change handicaps on a round under way: on or off, the Strokes given % (the round's and each side
 * game's, `sidePcts`: { key: pct | null }), half strokes, and each player's tee or course handicap
 * (`players`: { pid: { tee?, courseHc? } }, where a courseHc of null goes back to the one worked out
 * from their index). Every hole, the ones already played included, is worked out again with the new
 * strokes. `course` is this phone's copy of the course (null when it isn't saved here: a tee change
 * then keeps the handicap as it was). Returns a new round; `round` is not mutated.
 */
export function changeHandicaps(round, course, { useHandicaps = round.useHandicaps !== false, hcPct = round.hcPct, halfStrokes = !!round.halfStrokes, sidePcts = {}, players: edits = {} } = {}) {
  const out = { ...round, useHandicaps, hcPct };
  if (halfStrokes && useHandicaps) out.halfStrokes = true; else delete out.halfStrokes;
  if (Array.isArray(round.sideGames) && Object.keys(sidePcts).length) {
    out.sideGames = round.sideGames.map(sg => {
      if (!sg || !(sg.game in sidePcts)) return sg;
      const { hcPct: _own, ...rest } = sg;
      return sidePcts[sg.game] == null ? rest : { ...rest, hcPct: sidePcts[sg.game] };
    });
  }
  const hcCourse = teeFixedCourse(course, round);
  const hcHoles = parFree(round, round.holes);
  const players = round.players.map(p => {
    const e = edits[p.id];
    if (!e) return p;
    const tee = e.tee !== undefined ? e.tee : p.tee;
    const override = 'courseHc' in e ? e.courseHc : p.courseHcOverride ?? null;
    let courseHc = override ?? p.courseHc;
    if (override == null && hcCourse) {
      const t = hcCourse.tees?.find(x => x.name === tee) || null;
      courseHc = effectiveCourseHc(p.index, t, hcCourse, hcHoles, round.holesCount, null).value;
    }
    return { ...p, tee, courseHcOverride: override ?? null, courseHc };
  });
  out.players = withPlays(out, players);
  if (round.teams) out.teams = withTeamHandicaps(out, round.teams, out.players, useHandicaps, hcPct);
  return out;
}

/** Players in a round with no handicap at all (no index, none set by hand), who play off 0. */
export function noHandicap(round) {
  return round.players.filter(p => p.index == null && p.courseHcOverride == null);
}

/**
 * Where strokes differ between two versions of a round, hole by hole:
 * [{ id, name, holeNo, from, to }] for every player (or scramble team) and every hole.
 */
export function strokeChanges(before, after) {
  const out = [];
  const units = scorers(after);
  for (const u of units) {
    const was = scorers(before).find(x => x.id === u.id);
    if (!was) continue;
    for (const h of after.holes) {
      const bh = before.holes.find(x => x.no === h.no);
      if (!bh) continue;
      const from = before.useHandicaps ? popsFor(before, was, bh) : 0;
      const to = after.useHandicaps ? popsFor(after, u, h) : 0;
      if (from !== to) out.push({ id: u.id, name: u.name, holeNo: h.no, from, to });
    }
  }
  return out;
}

/** Holes with scores that would stop counting if the round were resized to `holes`. */
export function scoredHolesDropped(round, holes) {
  return round.holes.filter(h => !holes.some(n => n.no === h.no) && Object.values(round.scores[h.no] || {}).some(v => v != null));
}

/** Strokes a player (or scramble team) gets on a hole, as counted: halves with half strokes on (see allowances.js). */
export function strokesFor(round, player, hole) {
  const st = popsFor(round, player, hole);
  return halfStrokesOn(round) ? st / 2 : st;
}

/** Whole strokes (pops) on a hole, for the dots on the card and a pickup's gross, half strokes or not. */
export function popsFor(round, player, hole) {
  return strokesOnHole(player.plays, hole.rank, round.holes.length);
}

/** Effective gross (pickups → net double bogey) for a scorer on a hole, or null. */
export function grossFor(round, player, hole) {
  const g = round.scores[hole.no]?.[player.id];
  if (g == null) return null;
  // A pickup's gross is whole on the card: par + 2 + its pops (with half strokes, a touch over net double)
  return g === 'X' ? pickupGross(hole.par, popsFor(round, player, hole)) : g;
}

/** Effective gross (pickups → net double bogey) and net for a scorer on a hole. */
export function netFor(round, player, hole) {
  const gross = grossFor(round, player, hole);
  if (gross == null) return null;
  return gross - strokesFor(round, player, hole);
}

/** Every scorer still playing the hole has a score. Only complete holes count for money. */
export function holeComplete(round, hole) {
  const s = round.scores[hole.no];
  const who = scorers(round, hole);
  return !!s && who.length > 0 && who.every(p => s[p.id] != null);
}

export function holesPlayed(round) {
  return round.holes.filter(h => holeComplete(round, h));
}

const playerById = (round, pid) => round.players.find(p => p.id === pid);

// --------------------------- Banker ---------------------------------------

/**
 * "Low score banks": whoever had the lowest gross score on the hole before banks this one, among the
 * players on this hole. A tie keeps the bank with the banker if they were in it, else the tied player
 * next after them in the playing order. Null on the first hole, or when the hole before has no scores.
 */
export function lowBanker(round, idx, ids, prevBanker = null) {
  const prevHole = round.holes[idx - 1];
  const sc = prevHole && round.scores[prevHole.no];
  if (!sc) return null;
  // A pickup counts as worse than any score
  const val = pid => (sc[pid] === 'X' ? Infinity : typeof sc[pid] === 'number' ? sc[pid] : null);
  const scored = ids.filter(pid => val(pid) != null);
  if (!scored.length) return null;
  const low = Math.min(...scored.map(val));
  const tied = scored.filter(pid => val(pid) === low);
  if (tied.length === 1) return tied[0];
  if (prevBanker && tied.includes(prevBanker)) return prevBanker;
  const all = round.players.map(p => p.id);
  const from = prevBanker ? all.indexOf(prevBanker) : -1;
  for (let n = 1; n <= all.length; n++) {
    const pid = all[(from + n + all.length) % all.length];
    if (tied.includes(pid)) return pid;
  }
  return tied[0];
}

// Amounts groups actually bet, smallest first. Four of them show as chips (the game's default bet is
// always one), the way tip and donation screens offer three or four amounts and "Other"
const BET_LADDER = [1, 2, 5, 10, 15, 20, 25, 50, 100];
/** The four Banker bet chips inside the game's min and max, the default bet always among them. */
export function betPresets(min = 1, max = 20, def = null) {
  const lo = min || 1, hi = max || Infinity;
  let picks = BET_LADDER.filter(v => v >= lo && v <= hi).slice(0, 4);
  if (!picks.length) picks = [lo];
  if (def != null && def >= lo && def <= hi && !picks.includes(def)) picks = [...picks.slice(0, 3), def].sort((a, b) => a - b);
  return picks;
}

export function bankerHoleSetup(round, idx) {
  const hole = round.holes[idx];
  const existing = round.banker[hole.no];
  const all = round.players.map(p => p.id);
  const ids = playersOn(round, hole).map(p => p.id);
  // A setup made before someone left: drop their bet, and start fresh if they were the banker
  if (existing && ids.includes(existing.banker)) {
    if (ids.length === all.length) return existing;
    return { ...existing, bets: Object.fromEntries(Object.entries(existing.bets || {}).filter(([pid]) => ids.includes(pid))) };
  }
  const s = round.settings.banker;
  const prevHole = round.holes[idx - 1];
  const prev = prevHole && round.banker[prevHole.no];
  let banker;
  if (s.rotation === 'choice' && prev && ids.includes(prev.banker)) banker = prev.banker;
  else if (s.rotation === 'low') banker = lowBanker(round, idx, ids, prev?.banker) ?? bankerFor('fixed', 0, all, s.firstBanker || 0);
  else banker = bankerFor(s.rotation, idx, all, s.firstBanker || 0);
  // The rotation skips anyone who has left: the bank passes to the next player in the order
  const k = all.indexOf(banker);
  for (let n = 1; !ids.includes(banker) && n <= all.length; n++) banker = all[(k + n) % all.length];
  // Each player's bet carries over from the last hole they bet on (last hole's banker didn't bet
  // on it, so theirs comes from the hole before), else the default
  const lastBet = id => {
    for (let i = idx - 1; i >= 0; i--) {
      const v = round.banker[round.holes[i].no]?.bets?.[id];
      if (v != null) return v;
    }
    return s.defaultBet;
  };
  const bets = {};
  for (const id of ids) if (id !== banker) bets[id] = lastBet(id);
  return { banker, bets, doubled: {}, doubleBack: false };
}

// --------------------------- Nassau & match play ---------------------------

/**
 * Best-ball net of a side (array of player ids) on a hole; null until everyone has scored.
 * A player who has left doesn't count: their partner's ball carries the side. A side with
 * nobody left has no score, so the hole isn't played and the bets stand as they were.
 */
export function sideNet(round, side, hole) {
  const on = side.filter(pid => playsHole(round, pid, hole));
  return bestBall(on.map(pid => netFor(round, playerById(round, pid), hole)));
}

/** Hole winners (0 | 1 | null) keyed by playing position (1-based). Legs follow playing order. */
export function nassauWinners(round) {
  const [a, b] = sides(round);
  const w = {};
  round.holes.forEach((h, i) => {
    const r = holeWinner(sideNet(round, a, h), sideNet(round, b, h));
    if (r !== undefined) w[i + 1] = r;
  });
  return w;
}
export const matchWinners = nassauWinners;

/** The legs bets run over: three for Nassau, one for match play. */
export function roundLegs(round) {
  if (round.game === 'match') return { match: { start: 1, end: round.holes.length, label: 'Match' } };
  return nassauLegs(round.holes.length);
}

/** Hole number played at a Nassau position. */
export function holeAtPos(round, pos) { return round.holes[pos - 1]?.no ?? pos; }

/** Leg amounts, as they stand now or (with `pos`) as they stood on the hole at that playing position. */
export function nassauAmounts(round, pos = null) {
  const s = pos == null ? round.settings : settingsAt(round, pos);
  if (round.game === 'match') return { match: s.match.stake };
  const n = s.nassau;
  return { front: n.front, back: n.back, total: n.total };
}

function pressSettings(round) {
  return round.game === 'match' ? round.settings.match : round.settings.nassau;
}

/**
 * Press options before playing the hole at position `nextHoleNo` (1-based). With presses off,
 * only a Nassau's press at the turn (if that house rule is on) can come up.
 */
export function nassauPressOptions(round, nextHoleNo) {
  const s = pressSettings(round);
  if (!s) return [];
  const turn = round.game === 'nassau' && !!s.turnPress;
  if (s.pressMode === 'off' && !turn) return [];
  return pressOpportunities(nassauWinners(round), round.presses, nassauAmounts(round), nextHoleNo, s.threshold, roundLegs(round),
    { noLast: !!s.noLastPress, turn, only: s.pressMode === 'off' ? 'turn' : null });
}
export const pressMode = round => pressSettings(round)?.pressMode || 'off';

/** Display names for the two sides. */
export function sideNames(round) {
  if (round.teams?.length === 2) return round.teams.map(t => t.name);
  return round.players.slice(0, 2).map(p => p.name);
}

/** Per-player money from a "side 0 wins `net`" result, using the uneven-sides split. */
function spreadSides(round, balances, net) {
  const [a, b] = sides(round);
  if (!net) return;
  const [ea, eb] = sideSplit(Math.abs(net), a.length, b.length, net > 0 ? 0 : 1);
  for (const pid of a) balances[pid] += ea;
  for (const pid of b) balances[pid] += eb;
}

// --------------------------- Skins ----------------------------------------
// House rules (settings.skins):
//  • kind: 'net' (the default), 'gross', or 'both': a net skin and a gross skin on every hole, each
//    with its own carryovers, as many clubs run them side by side.
//  • payout: 'per' (each other player pays the skin's value, the default) or 'pot': everyone puts in
//    `stake` (per kind), and the pot is split by skins won. No skins won means everyone gets theirs back.
//  • lastCarry: what skins still carried after the last hole do. 'void' (nobody gets them, the default),
//    'split' (shared by the players tied for low on the last hole) or 'playoff' (a playoff hole among
//    them, and the scorekeeper picks the winner: round.skinsPlayoff = { net: pid, gross: pid }).
//  • canadian: Canadian skins. When the low net score on a hole is a birdie or better and it's tied, a
//    natural birdie (or better, with no help from a stroke) beats a net one: the lowest gross among
//    the tied players who made it without strokes wins, if that's one player. Net skins only.
//  • validate: a skin only counts if its winner makes net par or better on the next hole. If they
//    don't, the skins they took go back into the carry and ride on that next hole (with carryovers
//    off they're gone). The last hole's skin, and the skin on the last hole played in a round
//    finished early, need no check. A winner who left before the next hole keeps theirs.
// Both are off unless turned on, so rounds from before read exactly as they always did.
// Sources, checked 2026-09-27: Stick Golf, "How to play Skins" https://stickapp.golf/games/skins/ (split the
// last-hole carry among the tied players, or a playoff), Golf Games Hub, "Skins golf game rules"
// https://www.golfgameshub.com/skins-golf-game-rules-strategy-scoring/ (gross and net, a pot split by
// skins won) and Live Tourney, "Skins game rules" https://www.livetourney.com/blog/skins-game-rules-golf.

/** The skins kinds in play: ['net'], ['gross'] or ['net', 'gross']. */
export function skinsKinds(round) {
  const k = round.settings.skins?.kind || 'net';
  return k === 'both' ? ['net', 'gross'] : [k];
}

/**
 * Skins hole by hole for one kind ('net' or 'gross'; the first kind in play by default). Each skin is
 * worth the bet in force on the hole it came from, so a skin carried into a hole after the bet went up
 * keeps its old value.
 *
 * A carry stays with the players who built it (decided 2026-09-28). Each carried skin remembers who was
 * on its hole, and only they can win it or pay for it. So a player added mid-round plays for the skins
 * of the holes they play, carries built from then on included, but not for a carry built before they
 * joined. When a hole is won outright, the winner takes that hole's skin and every carried skin they
 * were in for; any carried skin they weren't in for keeps carrying among the players who built it.
 * Everyone there from the first hole is in for every skin, so without late joiners this is plain skins.
 *
 * A row: `pot` is every skin riding on the hole (this one plus all carried), `worth` what each player in
 * for all of them pays if the hole is won outright, `purse` what such a winner collects, `skins` how
 * many the winner took and `parts` what they took, [{ skins, worth, payers }] (one entry per group of
 * payers), and `kept` how many skins are still carried after it.
 *
 * `ends` says what happens to skins still carried after the last hole, one entry per group of players
 * who can still claim them: { skins, worth, rule, tied, field, winner, row }. `field` is the builders
 * still in at the end and `tied` the low scores among them on the last hole. With 'split' the tied share
 * them (alone, they take them); with 'playoff' the picked winner takes them if they're in `tied` (alone,
 * they take them without one). `end` is the first of them, or null when nothing is carried.
 */
export function skinsTable(round, kind = skinsKinds(round)[0]) {
  const value = round.settings.skins.value;
  // The carry: one { worth, field } per tied hole, `field` the players on that hole
  let carry = [];
  const rows = [];
  let lastDone = null;
  const scoreOf = (p, h) => (kind === 'gross' ? grossFor(round, p, h) : netFor(round, p, h));
  // Skins bunched by a key (who pays them, or who can claim them): [{ skins, worth, ...data }]
  const bunch = (skins, key) => {
    const out = new Map();
    for (const sk of skins) {
      const k = key(sk);
      const g = out.get(k.id) || { skins: 0, worth: 0, ...k.data };
      g.skins += 1; g.worth += sk.worth;
      out.set(k.id, g);
    }
    return [...out.values()];
  };
  // A skin waiting on its winner's next hole (validate): { row, took, carryover, at }
  let pending = null;
  round.holes.forEach((h, i) => {
    const s = settingsAt(round, i + 1).skins;
    // Only the players still on a hole play for it, so a carried skin won later is paid by them alone
    const on = playersOn(round, h);
    const field = on.map(p => p.id);
    // The last skin won needs its winner's net par or better here, or it goes back into the carry
    if (pending?.at === i && holeComplete(round, h)) {
      const { row, took } = pending;
      const w = on.find(p => p.id === row.winner);
      if (w && netFor(round, w, h) > h.par) {
        Object.assign(row, { winner: null, lost: row.winner, lostSkins: took.length, skins: 0, parts: [], pending: false, kept: row.kept + (pending.carryover ? took.length : 0) });
        if (pending.carryover) carry = [...carry, ...took];
      } else row.pending = false;
    }
    if (pending?.at <= i) pending = null;
    const all = [...carry, { worth: s.value, field }];
    const worth = all.reduce((a, sk) => a + sk.worth, 0);
    const purse = all.reduce((a, sk) => a + sk.worth * Math.max(0, sk.field.filter(id => field.includes(id)).length - 1), 0);
    const base = { hole: h, pot: all.length, worth, purse, field };
    if (!holeComplete(round, h)) { rows.push({ ...base, winner: undefined, skins: 0, kept: carry.length }); return; }
    const nets = on.map(p => [p.id, scoreOf(p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    let lows = nets.filter(n => n[1] === low);
    // Canadian skins: a natural birdie beats a net one
    let canadian = false;
    if (lows.length > 1 && s.canadian && kind === 'net' && low <= h.par - 1) {
      const naturals = lows.map(n => [n[0], grossFor(round, on.find(p => p.id === n[0]), h)]).filter(n => n[1] <= h.par - 1);
      const best = naturals.filter(n => n[1] === Math.min(...naturals.map(x => x[1])));
      if (best.length === 1) { lows = best; canadian = true; }
    }
    if (lows.length === 1) {
      const w = lows[0][0];
      const took = all.filter(sk => sk.field.includes(w));
      carry = s.carryover ? carry.filter(sk => !sk.field.includes(w)) : [];
      const parts = bunch(took, sk => {
        const payers = sk.field.filter(id => id !== w && field.includes(id));
        return { id: payers.join(','), data: { payers } };
      });
      const row = { ...base, winner: w, skins: took.length, parts, kept: carry.length };
      if (canadian) row.canadian = true;
      // Validate: it's not theirs until the next hole says so (the last hole's skin needs no check)
      if (s.validate && i < round.holes.length - 1) { row.pending = true; pending = { row, took, carryover: !!s.carryover, at: i + 1 }; }
      rows.push(row);
    } else {
      carry = s.carryover ? all : [];
      rows.push({ ...base, winner: null, skins: 0, tied: lows.map(n => n[0]), kept: carry.length });
    }
    lastDone = rows.at(-1);
  });
  // After the last hole, or when the round was finished early: what the skins still carried do
  const ends = [];
  const over = holeComplete(round, round.holes.at(-1)) || round.status === 'done';
  // A round finished before a skin's next hole was scored: the skin stands
  if (over) for (const r of rows) if (r.pending) r.pending = false;
  if (over && carry.length && lastDone) {
    const rule = round.settings.skins.lastCarry || 'void';
    const h = lastDone.hole;
    const onLast = playersOn(round, h);
    const groups = bunch(carry, sk => {
      const field = sk.field.filter(id => lastDone.field.includes(id));
      return { id: field.join(','), data: { field } };
    });
    for (const g of groups) {
      const nets = onLast.filter(p => g.field.includes(p.id)).map(p => [p.id, scoreOf(p, h)]);
      const low = Math.min(...nets.map(n => n[1]));
      const tied = nets.filter(n => n[1] === low).map(n => n[0]);
      const picked = rule === 'playoff' ? (tied.length === 1 ? tied[0] : round.skinsPlayoff?.[kind]) : null;
      ends.push({ ...g, rule, tied, row: lastDone, winner: picked && tied.includes(picked) ? picked : null });
    }
  }
  const claimed = ends.filter(e => e.tied.length && (e.rule === 'split' || e.winner)).reduce((a, e) => a + e.skins, 0);
  return { rows, value, kind, ends, end: ends[0] || null, unclaimed: carry.length - claimed };
}

/**
 * Money from one kind of skins. Per skin: each player in for a skin and on the winning hole pays the
 * winner its worth. Pot: everyone still in at the end puts in `stake` and the pot is shared by skins
 * won. Returns { deltas, won: { pid: { skins, amount, holes } } } where `amount` is what the skins brought in.
 */
function skinsMoney(round, t, onPay = null) {
  const ids = round.players.map(p => p.id);
  const deltas = Object.fromEntries(ids.map(id => [id, 0]));
  const won = {};
  const credit = (pid, skins, amount, no) => {
    won[pid] ??= { skins: 0, amount: 0, holes: [] };
    won[pid].skins += skins; won[pid].amount += amount;
    if (no != null && !won[pid].holes.includes(no)) won[pid].holes.push(no);
  };
  const cfg = round.settings.skins;
  const ends = t.ends || [];
  if (cfg.payout === 'pot') {
    // Like the other pots, a player who left or joined partway is out of it: they don't put in, and their skins don't count
    const inPot = round.players.filter(p => playsWholeRound(round, p.id)).map(p => p.id);
    const shares = Object.fromEntries(inPot.map(id => [id, 0]));
    for (const r of t.rows) if (r.winner && !r.pending && r.winner in shares) { shares[r.winner] += r.skins; credit(r.winner, r.skins, 0, r.hole.no); }
    for (const end of ends) {
      if (end.rule === 'split') {
        const tied = end.tied.filter(id => id in shares);
        for (const id of tied) { shares[id] += end.skins / tied.length; credit(id, end.skins / tied.length, 0, end.row.hole.no); }
      } else if (end.winner && end.winner in shares) { shares[end.winner] += end.skins; credit(end.winner, end.skins, 0, end.row.hole.no); }
    }
    const total = Object.values(shares).reduce((a, v) => a + v, 0);
    const played = t.rows.some(r => r.winner !== undefined);
    if (played && total > 0 && inPot.length >= 2) {
      const stake = cfg.stake ?? cfg.value;
      const pot = stake * inPot.length;
      for (const id of inPot) {
        deltas[id] += pot * shares[id] / total - stake;
        if (won[id]) won[id].amount = Math.round(pot * shares[id] / total * 100) / 100;
      }
    }
    return { deltas, won };
  }
  const pay = (winners, payers, worth, skins, no) => {
    // Each payer pays the worth once, shared by the winners
    for (const id of payers) {
      deltas[id] -= worth;
      for (const w of winners) onPay?.(id, w, worth / winners.length);
    }
    for (const w of winners) { deltas[w] += worth * payers.length / winners.length; credit(w, skins / winners.length, worth * payers.length / winners.length, no); }
  };
  // Each part of a won hole is paid by the players in for those skins
  for (const r of t.rows) if (r.winner && !r.pending) for (const part of r.parts) pay([r.winner], part.payers, part.worth, part.skins, r.hole.no);
  for (const end of ends) {
    if (end.rule === 'split' && end.tied.length) pay(end.tied, end.field.filter(id => !end.tied.includes(id)), end.worth, end.skins, end.row.hole.no);
    else if (end.winner) pay([end.winner], end.field.filter(id => id !== end.winner), end.worth, end.skins, end.row.hole.no);
  }
  return { deltas, won };
}

// --------------------------- Wolf -----------------------------------------

/**
 * The wolf on the hole at index `idx`. If a player leaves, Wolf carries on as a threesome:
 * the rotation runs through the players still there, and the wolf picks one of the other two
 * as a partner or goes lone against both.
 */
export function wolfFor(round, idx) {
  const hole = round.holes[idx];
  const on = hole ? playersOn(round, hole) : round.players;
  const list = on.length ? on : round.players;
  return list[idx % list.length].id;
}

/** The saved wolf pick for a hole if it still stands (nobody in it has left), else a fresh one. */
export function wolfHoleSetup(round, idx) {
  const hole = round.holes[idx];
  const setup = round.wolf[hole.no];
  const ids = playersOn(round, hole).map(p => p.id);
  if (setup && ids.includes(setup.wolf) && (setup.partner == null || ids.includes(setup.partner))) return setup;
  return { wolf: wolfFor(round, idx), partner: undefined };
}

/**
 * One wolf hole's money. With the "ties carry" house rule (wolf.carry, off unless the round says so),
 * a tied hole's points ride on to the next hole that's won: that hole pays its unit once for itself
 * and once more for every tied hole carried in (see wolfCarryBefore). Ties still carried after the
 * last hole go unclaimed. A round saved before the rule has no `carry`, so its money doesn't change.
 */
export function wolfHoleResult(round, hole) {
  const r = wolfHoleBase(round, hole);
  if (!r) return null;
  if (r.winner == null) return settingsAt(round, posOf(round, hole)).wolf.carry ? { ...r, carries: true } : r;
  const carried = wolfCarryBefore(round, hole);
  if (!carried) return r;
  const deltas = Object.fromEntries(Object.entries(r.deltas).map(([id, v]) => [id, v * (carried + 1)]));
  return { ...r, deltas, carried };
}

/**
 * Tied holes carried into `hole` under "ties carry": the run of ties with the rule on since the last
 * hole that was won. A hole with no result yet (not played, no pick) doesn't break the run.
 */
export function wolfCarryBefore(round, hole) {
  // Switched off for this hole (a bet change): whatever was riding is dropped, like Sixes and Aces
  if (!settingsAt(round, posOf(round, hole)).wolf?.carry) return 0;
  let carried = 0;
  for (const h of round.holes) {
    if (h.no === hole.no) break;
    const r = wolfHoleBase(round, h);
    if (!r) continue;
    // A tie played with the rule off (switched off, then on again) drops the run too
    if (r.winner != null || !settingsAt(round, posOf(round, h)).wolf.carry) carried = 0;
    else carried++;
  }
  return carried;
}

/**
 * What a blind wolf pays or wins, as a multiple of the point. From 2026-09-30 it's always more than a
 * lone wolf: blindPlus (1 or 2) on top of the lone multiplier, so lone 2× gives blind 3× or 4×.
 * A round saved before that keeps its own blindMultiplier (3× when it has none), so its money stands.
 */
export function blindMultiplierOf(w) {
  if (w?.blindPlus != null) return (w.loneMultiplier || 2) + w.blindPlus;
  return w?.blindMultiplier ?? 3;
}

function wolfHoleBase(round, hole) {
  const setup = round.wolf[hole.no];
  if (!setup || !holeComplete(round, hole)) return null;
  const cfg = settingsAt(round, posOf(round, hole)).wolf;
  const { point: P, loneMultiplier: mult } = cfg;
  const on = playersOn(round, hole);
  const ids = on.map(p => p.id);
  // A pick that names someone who has left doesn't stand
  if (!ids.includes(setup.wolf) || (setup.partner && !ids.includes(setup.partner))) return null;
  const net = Object.fromEntries(on.map(p => [p.id, netFor(round, p, hole)]));
  const teamA = setup.partner ? [setup.wolf, setup.partner] : [setup.wolf];
  const teamB = ids.filter(id => !teamA.includes(id));
  if (!teamB.length) return null;
  const best = t => Math.min(...t.map(id => net[id]));
  const a = best(teamA), b = best(teamB);
  const deltas = Object.fromEntries(ids.map(id => [id, 0]));
  const blind = !setup.partner && setup.blind ? { blind: true } : {};
  if (a === b) return { deltas, winner: null, teamA, teamB, ...blind };
  const winners = a < b ? teamA : teamB, losers = a < b ? teamB : teamA;
  // A blind wolf went lone before anyone teed off, for more (see blindMultiplierOf). Only a hole
  // saved with blind: true pays it, so rounds from before blind wolf keep their money.
  const unit = setup.partner ? P : P * (setup.blind ? blindMultiplierOf(cfg) : mult);
  // Every loser pays every winner one unit
  for (const w of winners) for (const l of losers) { deltas[w] += unit; deltas[l] -= unit; }
  return { deltas, winner: a < b ? 'wolf' : 'pack', teamA, teamB, ...blind };
}

// --------------------------- Vegas ----------------------------------------

/** Vegas hole by hole: [{ hole, numbers, diff, flipped, deltas }] for scored holes. */
export function vegasTable(round) {
  const teams = round.teams || [];
  const rows = [];
  for (const [i, h] of round.holes.entries()) {
    if (!holeComplete(round, h) || teams.length !== 2) { rows.push({ hole: h, played: false }); continue; }
    const { point, birdieFlip, birdieDouble } = settingsAt(round, i + 1).vegas;
    // Vegas needs two full teams: once a player leaves, the holes after aren't counted
    if (teams.some(t => t.players.some(pid => !playsHole(round, pid, h)))) { rows.push({ hole: h, played: false, short: true }); continue; }
    const nets = teams.map(t => t.players.map(pid => netFor(round, playerById(round, pid), h)));
    const gross = teams.map(t => t.players.map(pid => round.scores[h.no]?.[pid]));
    const r = vegasHole(nets, gross, h.par, { birdieFlip, birdieDouble: !!birdieDouble });
    const deltas = {};
    teams[0].players.forEach(pid => { deltas[pid] = r.diff * point; });
    teams[1].players.forEach(pid => { deltas[pid] = -r.diff * point; });
    rows.push({ hole: h, played: true, ...r, point, deltas });
  }
  return rows;
}

/** Preview a Vegas hole from draft scores ({ pid: gross | 'X' }). */
export function vegasPreview(round, hole, draft) {
  const teams = round.teams || [];
  if (teams.length !== 2 || teams.some(t => t.players.some(pid => draft[pid] == null))) return null;
  const eff = pid => { const p = playerById(round, pid); const st = strokesFor(round, p, hole); const g = draft[pid]; return (g === 'X' ? pickupGross(hole.par, popsFor(round, p, hole)) : g) - st; };
  const nets = teams.map(t => t.players.map(eff));
  const gross = teams.map(t => t.players.map(pid => draft[pid]));
  const vs = settingsAt(round, posOf(round, hole)).vegas;
  return vegasHole(nets, gross, hole.par, { birdieFlip: vs.birdieFlip, birdieDouble: !!vs.birdieDouble });
}

// --------------------------- Sixes ----------------------------------------

/** The three six-hole matches: [{ seg, sides: [[pid,pid],[pid,pid]], winners, status }]. */
export function sixesMatches(round) {
  const ids = round.players.map(p => p.id);
  const pairs = sixesPairings(ids);
  const segs = sixesSegments(round.holes.length);
  // If a player leaves, the match under way finishes with their partner playing alone
  // (see sideNet), and matches that hadn't started are off: the rotation needs all four
  const firstGone = Math.min(...ids.map(pid => leftAt(round, pid)));
  return segs.map((seg, i) => {
    const [a, b] = pairs[i];
    const winners = {};
    if (firstGone < seg.start) return { seg, sides: [a, b], winners, status: matchStatus(winners, seg.start, seg.end), index: i, off: true };
    for (let pos = seg.start; pos <= seg.end; pos++) {
      const h = round.holes[pos - 1];
      const r = holeWinner(sideNet(round, a, h), sideNet(round, b, h));
      if (r !== undefined) winners[pos] = r;
    }
    return { seg, sides: [a, b], winners, status: matchStatus(winners, seg.start, seg.end), index: i };
  });
}

/** Which of the three matches the hole at playing position `pos` belongs to. */
export function sixesMatchAt(round, pos) {
  return sixesMatches(round).find(m => pos >= m.seg.start && pos <= m.seg.end) || null;
}

// --------------------------- Points & totals --------------------------------

/** A player's full-round quota target (null outside Quota). */
function quotaOf(round, p) {
  return round.game === 'quota' ? quotaFor(round.useHandicaps ? p.courseHc : 0, round.holes.length) : null;
}

/**
 * Per-player totals for the totals games: net strokes, Stableford points, quota points.
 * Quota scales to the holes played: `quota` is the full-round target, `target` the share of it for
 * the holes this player has played (34 over 18 holes is 17 after 9), and `vsQuota` is against `target`.
 * `target` and `vsQuota` are to one decimal for showing; the money uses the exact figures.
 */
export function totalsTable(round) {
  const out = round.players.map(p => {
    let total = 0, played = 0, par = 0;
    const quota = quotaOf(round, p);
    for (const h of round.holes) {
      if (!holeComplete(round, h) || !playsHole(round, p.id, h)) continue;
      played++;
      par += h.par;
      total += totalsHoleValue(round, p, h);
    }
    const toPar = round.game === 'stroke' ? total - par : null;
    const exact = quota != null ? quota * (played / round.holes.length) : null;
    const tenth = v => Math.round(v * 10) / 10;
    return {
      id: p.id, name: p.name, total, played, quota, toPar,
      target: exact != null ? tenth(exact) : null,
      vsQuota: exact != null ? tenth(total - exact) : null,
      vsQuotaExact: exact != null ? total - exact : null,
      left: leftAt(round, p.id) < round.holes.length,
    };
  });
  return out;
}

/** One player's number on one hole in the totals games: net strokes, Stableford points or quota points. */
function totalsHoleValue(round, p, h) {
  if (round.game === 'stroke') {
    // House rule: net double bogey is the most a hole can cost (stroke.cap, off unless the round says
    // so), the World Handicap System's maximum hole score. Source, checked 2026-09-30: USGA Rules of
    // Handicapping 3.1 https://www.usga.org/handicapping/roh/Content/rules/3%201b%20After%20a%20Handicap%20Index%20Has%20Been%20Established.htm
    const net = netFor(round, p, h);
    return settingsAt(round, posOf(round, h)).stroke?.cap ? Math.min(net, h.par + 2) : net;
  }
  if (round.game === 'stableford') return stablefordPoints(netFor(round, p, h), h.par, round.settings.stableford.modified);
  return quotaPoints(grossFor(round, p, h), h.par);
}

/**
 * Pairwise settling for per-stroke / per-point bets: every pair settles the difference on the
 * holes they both played, so a player who left is square with everyone for the holes after.
 * `value(pid, hole)` is a player's number on a counted hole and `stake(pos)` the bet in force at
 * a playing position, so each hole is paid at its own bet. Returns money by player id.
 */
function settlePairs(round, value, { stake, lowerWins, onPair = null }) {
  const ids = round.players.map(p => p.id);
  const out = Object.fromEntries(ids.map(id => [id, 0]));
  const counted = round.holes.map((h, i) => [h, i + 1]).filter(([h]) => holeComplete(round, h));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const both = counted.filter(([h]) => playsHole(round, a, h) && playsHole(round, b, h));
    const d = both.reduce((acc, [h, pos]) => acc + (value(a, h) - value(b, h)) * stake(pos), 0) * (lowerWins ? -1 : 1); // positive = a wins
    out[a] += d; out[b] -= d;
    onPair?.(a, b, d);
  }
  return out;
}

/** Points per hole per player for nines, aces (as money), bingo bango bongo and dots. */
export function pointsTable(round) {
  const ids = round.players.map(p => p.id);
  const rows = [];
  for (const [i, h] of round.holes.entries()) {
    const s = settingsAt(round, i + 1);
    // Rows carry `field`: the players still on the hole, who are the only ones it settles between
    const field = playersOn(round, h).map(p => p.id);
    if (round.game === 'bbb') {
      // Bingo bango bongo is marks only, so a missing score doesn't stop the hole counting
      const m = round.marks?.[h.no];
      if (!m) continue;
      const pts = Object.fromEntries(ids.map(id => [id, 0]));
      const got = ['bingo', 'bango', 'bongo'].filter(k => m[k] && field.includes(m[k]));
      for (const k of got) pts[m[k]] += 1;
      // House rule "sweep doubles" (bbb.sweep, off unless the round says so): all three to one player is 6.
      // Source, checked 2026-09-30: Golf Monthly, "What is Bingo Bango Bongo?"
      // https://golfmonthly.com/features/the-game/what-is-bingo-bango-bongo-67061
      const swept = s.bbb.sweep && got.length === 3 && m.bingo === m.bango && m.bango === m.bongo;
      if (swept) pts[m.bingo] = 6;
      rows.push({ hole: h, points: pts, field, value: s.bbb.value, label: got.map(k => k[0].toUpperCase()).join('') + (swept ? ' ×2' : ''), ...(swept ? { swept: true } : {}) });
      continue;
    }
    // A hole with a score missing isn't counted for money
    if (!holeComplete(round, h)) continue;
    if (round.game === 'dots') {
      const m = round.marks?.[h.no] || {};
      const pts = Object.fromEntries(ids.map(id => [id, 0]));
      for (const pid of field) {
        const manual = (m[pid] || []).filter(k => s.dots.kinds?.[k] !== false && DOT_KINDS[k]);
        const auto = s.dots.auto ? scoreDots(round.scores[h.no]?.[pid], h.par) : 0;
        pts[pid] = manual.length + auto;
      }
      rows.push({ hole: h, points: pts, field, value: s.dots.value });
      continue;
    }
    // Nines is scored for exactly three, so once a player leaves the holes after aren't counted
    if (round.game === 'nines' && field.length === round.players.length) {
      const nets = round.players.map(p => netFor(round, p, h));
      const pts = ninesPoints(nets, { sweep: !!s.nines.sweep });
      rows.push({ hole: h, points: Object.fromEntries(ids.map((id, k) => [id, pts[k]])), field, value: s.nines.point });
    }
  }
  return rows;
}

// --------------------------- Rabbit ---------------------------------------

/** Rabbit legs: for each nine, the rows and who holds it at the end. */
export function rabbitTable(round) {
  const legs = nassauLegs(round.holes.length);
  const segs = round.holes.length === 18 ? [legs.front, legs.back] : [legs.total];
  const rows = round.holes.map((h, i) => {
    // `gone`: players who left before this hole. If the rabbit's holder leaves, it runs loose.
    // Someone added partway through a leg sits that leg out and plays for the next one
    const seg = segs.find(sg => i + 1 >= sg.start && i + 1 <= sg.end) || segs[0];
    const start = round.holes[seg.start - 1];
    const on = playersOn(round, h).filter(p => !start || playsHole(round, p.id, start));
    const gone = round.players.filter(p => !on.includes(p)).map(p => p.id);
    if (!holeComplete(round, h)) return { hole: h, winner: undefined, gone };
    const nets = on.map(p => [p.id, netFor(round, p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    const lows = nets.filter(n => n[1] === low);
    return { hole: h, winner: lows.length === 1 ? lows[0][0] : null, gone };
  });
  const out = segs.map(seg => {
    const part = rows.slice(seg.start - 1, seg.end);
    // A leg is played for the rules and bet in force when it started. Rounds from before the
    // "set free" default have no mode and keep the old "steal" rule.
    const rs = settingsAt(round, seg.start).rabbit;
    const { holder, history } = rabbitHolder(part, { mode: rs.mode || 'steal', tiesFree: !!rs.tiesFree });
    const done = part.every(r => r.winner !== undefined);
    const played = part.some(r => r.winner !== undefined);
    // Only the players still there at the end of the leg pay the holder
    const last = round.holes[seg.end - 1];
    // A player added partway through a leg sits it out and is in from the next one
    const first = round.holes[seg.start - 1];
    const payers = last ? playersOn(round, last).filter(p => !first || playsHole(round, p.id, first)).map(p => p.id) : round.players.map(p => p.id);
    // Like a Nassau leg, an unfinished leg pays on the holes played: whoever holds the rabbit now
    const pays = !!holder && payers.includes(holder);
    const amount = pays ? rs.stake * (payers.length - 1) : 0;
    return { seg, rows: part, holder, history, done, played, pays, payers, stake: rs.stake, amount };
  });
  return { legs: out, rows };
}

// --------------------------- Snake ----------------------------------------

/** Three-putts on a hole, in the order they happened (players still on the hole only). */
function snakePutts(round, h) {
  const m = round.marks?.[h.no];
  if (!m) return undefined;
  const on = playersOn(round, h).map(p => p.id);
  return (m.snake || []).filter(pid => on.includes(pid));
}

/**
 * Snake legs: one for the round, or one per nine with "each nine" on. A leg is played for the rules
 * and bet in force when it started. A hole counts once it's saved (its marks exist), scores or not.
 * Like a Nassau leg, an unfinished leg pays on the holes played: whoever holds the snake now pays.
 * A holder who leaves still pays it, to each player still there at the end of the leg.
 */
export function snakeTable(round) {
  const legs = nassauLegs(round.holes.length);
  const first = settingsAt(round, 1).snake || {};
  const segs = first.nines && round.holes.length === 18 ? [legs.front, legs.back] : [legs.total];
  const rows = round.holes.map(h => ({ hole: h, putts: snakePutts(round, h) }));
  const out = segs.map(seg => {
    const part = rows.slice(seg.start - 1, seg.end);
    const ss = settingsAt(round, seg.start).snake || {};
    const { holder, count, history } = snakeHolder(part);
    // A round saved before the cap existed has none: its snake keeps doubling, as it was played
    const cap = ss.cap || 0;
    const value = snakeValue(count, ss.stake || 0, ss.growth || 'flat', cap);
    const last = round.holes[seg.end - 1];
    const others = (last ? playersOn(round, last) : round.players).map(p => p.id).filter(id => id !== holder);
    const played = part.some(r => r.putts !== undefined);
    const done = part.every(r => r.putts !== undefined);
    return { seg, rows: part, holder, count, history, value, others, played, done, amount: holder ? value * others.length : 0, stake: ss.stake || 0, growth: ss.growth || 'flat', cap };
  });
  return { legs: out, rows };
}

// --------------------------- Hammer ---------------------------------------

/**
 * Hammer hole by hole. Each hole is a match-play hole between the two sides (best ball when there are
 * partners) worth the base bet in force on it, doubled for every hammer that was taken. A concession
 * settles the hole at the value before the last hammer, scores or not. A row's `net` is what each
 * player on side 0 wins (positive) or pays, before the uneven-sides split; `behind` is the side behind
 * going into the hole, for the "side behind throws first" rule.
 */
export function hammerTable(round) {
  const [a, b] = sides(round);
  let total = 0;
  return round.holes.map((h, i) => {
    const hs = settingsAt(round, i + 1).hammer || {};
    const base = hs.stake || 0;
    const behind = total > 0 ? 1 : total < 0 ? 0 : null;
    const mark = round.marks?.[h.no] || {};
    const winner = holeWinner(sideNet(round, a, h), sideNet(round, b, h));
    const r = hammerHole(mark, winner, base);
    const net = r.winner === 0 ? r.value : r.winner === 1 ? -r.value : 0;
    total += net;
    return { hole: h, pos: i + 1, base, behind, ...r, net, running: total, max: hs.max ?? 3, who: hs.who || 'either' };
  });
}

/** Which sides may hammer on this hole right now, given the hole's marks so far: [bool, bool]. */
export function hammerOptions(round, hole, mark) {
  const row = hammerTable(round).find(r => r.hole.no === hole.no);
  if (!row) return [false, false];
  const opts = { max: row.max, who: row.who, behind: row.behind, conceded: mark?.conceded ?? null };
  return [0, 1].map(side => canHammer(mark?.hammers || [], side, opts));
}

// --------------------------- Results --------------------------------------

/**
 * Money for one game by player id plus game-specific detail. Works on partial rounds too.
 * `pairs[a][b]` is the honest head-to-head: what a won from b, worked out bet by bet and hole by
 * hole (not from the fewest-payments list, which can route money between people who never bet each other).
 * This is one game only: a round with side games adds them up in roundResults.
 */
export function gameResults(round) {
  const ids = round.players.map(p => p.id);
  const balances = Object.fromEntries(ids.map(id => [id, 0]));
  const detail = {};
  const s = round.settings;
  const add = deltas => { for (const id of ids) balances[id] += deltas[id] || 0; };
  const zero = () => Object.fromEntries(ids.map(id => [id, 0]));
  // Head to head: records who won what from whom. It never changes balances.
  const raw = Object.fromEntries(ids.map(id => [id, {}]));
  const pay = (from, to, amt) => {
    if (!amt || from === to || !raw[from] || !raw[to]) return;
    raw[to][from] = (raw[to][from] || 0) + amt;
    raw[from][to] = (raw[from][to] || 0) - amt;
  };
  // One bet's money among several players: each loser pays each winner in proportion to what they won
  const spread = deltas => {
    const win = ids.filter(id => deltas[id] > 0), lose = ids.filter(id => deltas[id] < 0);
    const total = win.reduce((a, id) => a + deltas[id], 0);
    if (!total) return;
    for (const l of lose) for (const w of win) pay(l, w, -deltas[l] * deltas[w] / total);
  };
  const addSpread = deltas => { add(deltas); spread(deltas); };
  // Whole cents that still sum to zero, even when a pot splits three ways
  const round2 = () => { const r = roundCents(balances); for (const id of ids) balances[id] = r[id]; };

  if (round.game === 'banker') {
    detail.holes = [];
    round.holes.forEach(h => {
      const setup = round.banker[h.no];
      if (!setup || !holeComplete(round, h)) return;
      // Only the players still on the hole bet on it; a saved setup whose banker has left doesn't stand
      const on = playersOn(round, h);
      const field = on.map(p => p.id);
      if (!field.includes(setup.banker)) return;
      const net = Object.fromEntries(on.map(p => [p.id, netFor(round, p, h)]));
      const bs = settingsAt(round, posOf(round, h)).banker;
      const r = settleBankerHole(setup, net, field, { ties: bs.ties, birdies: bs.birdies, gross: round.scores[h.no], par: h.par });
      add(r.deltas);
      for (const m of r.matchups) {
        if (m.result === 'win') pay(setup.banker, m.pid, m.amount);
        if (m.result === 'loss') pay(m.pid, setup.banker, m.amount);
      }
      detail.holes.push({ no: h.no, banker: setup.banker, ...r });
    });
  }

  if (round.game === 'nassau' || round.game === 'match') {
    // Each bet is played for the amount in force on the hole it started: a leg under way keeps its bet
    const legs = roundLegs(round);
    const amounts = Object.fromEntries(Object.entries(legs).map(([k, l]) => [k, nassauAmounts(round, l.start)[k]]));
    const presses = round.presses.map(p => ({ ...p, amount: p.amount ?? nassauAmounts(round, p.start)[p.leg] }));
    const res = nassauResult(nassauWinners(round), presses, amounts, legs);
    const d = zero();
    spreadSides(round, d, res.net);
    addSpread(d);
    detail.lines = res.lines;
  }

  if (round.game === 'skins') {
    detail.skinsWon = {};
    for (const kind of skinsKinds(round)) {
      const t = skinsTable(round, kind);
      // Per skin records who paid whom; a pot is spread like the other pots
      const m = skinsMoney(round, t, pay);
      add(m.deltas);
      if (s.skins?.payout === 'pot') spread(m.deltas);
      for (const [pid, w] of Object.entries(m.won)) {
        const all = (detail.skinsWon[pid] ??= { skins: 0, amount: 0, holes: [] });
        all.skins += w.skins; all.amount += w.amount;
        all.holes.push(...w.holes.map(no => (skinsKinds(round).length > 1 ? `${no}${kind === 'gross' ? 'g' : 'n'}` : no)));
      }
      if (kind === skinsKinds(round)[0]) detail.skins = t; else detail.skinsGross = t;
    }
    for (const w of Object.values(detail.skinsWon)) w.amount = Math.round(w.amount * 100) / 100;
  }

  if (round.game === 'hammer') {
    const rows = hammerTable(round);
    for (const r of rows) { const d = zero(); spreadSides(round, d, r.net); addSpread(d); }
    detail.hammer = rows;
  }

  if (round.game === 'snake') {
    const t = snakeTable(round);
    for (const leg of t.legs) {
      if (!leg.holder || !leg.value) continue;
      balances[leg.holder] -= leg.amount;
      for (const id of leg.others) { balances[id] += leg.value; pay(leg.holder, id, leg.value); }
    }
    detail.snake = t;
  }

  if (round.game === 'wolf') {
    detail.holes = [];
    for (const h of round.holes) {
      const r = wolfHoleResult(round, h);
      if (!r) continue;
      addSpread(r.deltas);
      detail.holes.push({ no: h.no, ...r });
    }
  }

  if (round.game === 'vegas') {
    const rows = vegasTable(round);
    for (const r of rows) if (r.played) addSpread(r.deltas);
    detail.vegas = rows;
  }

  if (round.game === 'sixes') {
    const matches = sixesMatches(round);
    // House rule "halved matches carry" (sixes.carry, per match only, off unless the round says so):
    // a match that finishes all square adds its bet to the next match. A carry still there after the
    // last match, or into a match that's off, goes unclaimed.
    let carry = 0;
    detail.matches = matches.map(m => {
      const st = m.status;
      // A match is played for the way it pays when it started
      const ms = settingsAt(round, m.seg.start).sixes;
      let net = 0; // positive = side 0 wins
      const carried = carry;
      // A match played with the rule off (switched off mid-round) drops the carry, halved or not
      if (ms.mode === 'holes' || !ms.carry || m.off || st.leader != null) carry = 0;
      else if (st.left === 0) carry += ms.stake;
      if (ms.mode === 'holes') {
        // Every hole won is worth the bet in force on that hole
        for (const [pos, w] of Object.entries(m.winners)) if (w != null) net += (w === 0 ? 1 : -1) * settingsAt(round, Number(pos)).sixes.stake;
      } else if (st.leader != null) {
        // Like Nassau, a match that isn't finished pays whoever leads it on the holes played
        const bet = ms.stake + (ms.carry ? carried : 0);
        net = st.leader === 0 ? bet : -bet;
      }
      const d = zero();
      for (const pid of m.sides[0]) d[pid] += net;
      for (const pid of m.sides[1]) d[pid] -= net;
      addSpread(d);
      return { ...m, net, ...(carried && ms.carry && ms.mode !== 'holes' ? { carried } : {}) };
    });
  }

  if (round.game === 'scramble') {
    const teams = round.teams || [];
    const played = round.holes.filter(h => holeComplete(round, h));
    // A team plays on while any of its players is still there. A team with nobody left is out
    // of the pot (it neither pays nor wins); the teams still in play for it over the whole round.
    const onHole = (t, h) => t.players.some(pid => playsHole(round, pid, h));
    const inTeams = teams.filter(t => t.players.some(pid => leftAt(round, pid) >= round.holes.length));
    const totals = {}, pars = {}, counts = {};
    for (const t of scorers(round)) {
      const mine = played.filter(h => onHole(t, h));
      totals[t.id] = mine.reduce((a, h) => a + netFor(round, t, h), 0);
      pars[t.id] = mine.reduce((a, h) => a + h.par, 0);
      counts[t.id] = mine.length;
    }
    if (played.length && inTeams.length >= 2) {
      // Everyone antes the stake; the winning team's players split the pot (tied teams share it)
      const inIds = inTeams.flatMap(t => t.players);
      const best = Math.min(...inTeams.map(t => totals[t.id]));
      const winners = inTeams.filter(t => totals[t.id] === best).flatMap(t => t.players);
      const pot = s.scramble.stake * inIds.length;
      const d = zero();
      for (const id of inIds) d[id] -= s.scramble.stake;
      for (const id of winners) d[id] += pot / winners.length;
      addSpread(d);
    }
    detail.totals = scorers(round).map(t => ({ id: t.id, name: t.name, total: totals[t.id], toPar: totals[t.id] - pars[t.id], played: counts[t.id], left: teams.length > 0 && !inTeams.some(x => x.id === t.id) }));
  }

  if (round.game === 'stroke' || round.game === 'stableford' || round.game === 'quota') {
    const table = totalsTable(round);
    const played = Math.max(0, ...table.map(t => t.played));
    const cfg = s[round.game];
    const lowerWins = round.game === 'stroke';
    if (played && cfg.payout === 'pot') {
      // The pot is played for by those in it from the first hole to the last. Anyone who left, or
      // was added partway, is out of it: they don't pay or win
      const key = round.game === 'quota' ? 'vsQuotaExact' : 'total';
      const stay = round.players.filter(p => playsWholeRound(round, p.id)).map(p => p.id);
      const totals = Object.fromEntries(table.filter(t => stay.includes(t.id)).map(t => [t.id, t[key]]));
      addSpread(settleTotals(totals, { mode: 'pot', stake: cfg.stake, lowerWins }));
    } else if (played) {
      // Per stroke or point: each pair settles on the holes they both played, each hole at its own bet.
      // A quota is for the whole round, so each hole carries an even share of it: a short round, or a
      // pair where someone left, compares the share for the holes played.
      const byId = Object.fromEntries(round.players.map(p => [p.id, p]));
      const n = round.holes.length;
      const value = round.game === 'quota'
        ? (pid, h) => totalsHoleValue(round, byId[pid], h) - quotaOf(round, byId[pid]) / n
        : (pid, h) => totalsHoleValue(round, byId[pid], h);
      add(settlePairs(round, value, { stake: pos => settingsAt(round, pos)[round.game].stake, lowerWins, onPair: (a, b, d) => pay(b, a, d) }));
    }
    detail.totals = table;
  }

  if (round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') {
    const rows = pointsTable(round);
    const pts = Object.fromEntries(ids.map(id => [id, 0]));
    for (const r of rows) for (const id of ids) pts[id] += r.points[id] || 0;
    // Every row carries the bet in force on its hole
    if (round.game === 'dots') {
      // Every dot is paid by each of the other players still on that hole
      for (const r of rows) for (const id of r.field) for (const other of r.field) {
        if (other === id) continue;
        balances[id] += r.points[id] * r.value; balances[other] -= r.points[id] * r.value;
        pay(other, id, r.points[id] * r.value);
      }
    } else if (round.game === 'bbb') {
      // Every pair settles the difference in points on the holes they both played
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const d = rows.filter(r => r.field.includes(a) && r.field.includes(b)).reduce((acc, r) => acc + (r.points[a] - r.points[b]) * r.value, 0);
        balances[a] += d; balances[b] -= d;
        pay(b, a, d);
      }
    } else {
      // Nines: every point above or below the average (3 a hole, 54 over 18) is worth the bet.
      // (points - average) x value is every pair settling its difference, split over the group
      for (const r of rows) {
        const avg = ids.reduce((a, id) => a + r.points[id], 0) / ids.length;
        for (const id of ids) balances[id] += (r.points[id] - avg) * r.value;
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
          pay(ids[j], ids[i], (r.points[ids[i]] - r.points[ids[j]]) * r.value / ids.length);
        }
      }
    }
    detail.points = pts;
    detail.rows = rows;
  }

  if (round.game === 'aces') {
    detail.holes = [];
    // House rule "ties carry" (aces.carry, off unless the round says so): a hole with no outright low
    // adds its ace to the next outright low, and a hole with no outright high adds its deuce to the
    // next outright high. Carries still there after the last hole go unclaimed.
    // Source, checked 2026-09-30: Golf Compendium, "Acey Ducey (or Aces and Deuces)"
    // https://golfcompendium.com/2019/02/golf-game-acey-ducey.html ("carryovers are at the group's option")
    let aceCarry = 0, deuceCarry = 0;
    for (const h of round.holes) {
      if (!holeComplete(round, h)) continue;
      // Low and high are among the players still on the hole
      const on = playersOn(round, h);
      if (on.length < 2) continue;
      const as = settingsAt(round, posOf(round, h)).aces;
      // Same defaults as acesDeuces, so rounds saved without every aces setting still pair up right
      // A carry only rides into a hole still played with the rule on; switched off, it's dropped
      const ace = (as?.ace ?? 2) + (as?.carry ? aceCarry : 0), deuce = (as?.deuce ?? 1) + (as?.carry ? deuceCarry : 0);
      const r = acesDeuces(on.map(p => netFor(round, p, h)), on.map(p => p.id), { ace, deuce });
      add(r.deltas);
      for (const p of on) {
        if (r.ace && p.id !== r.ace) pay(p.id, r.ace, ace);
        if (r.deuce && p.id !== r.deuce) pay(r.deuce, p.id, deuce);
      }
      const carried = as?.carry && (aceCarry || deuceCarry) ? { aceCarried: r.ace ? aceCarry : 0, deuceCarried: r.deuce ? deuceCarry : 0 } : {};
      aceCarry = as?.carry && !r.ace ? ace : 0;
      deuceCarry = as?.carry && !r.deuce ? deuce : 0;
      detail.holes.push({ no: h.no, ...r, ...carried });
    }
  }

  if (round.game === 'birdies') {
    // Birdie pot, a side game only (see birdiePotShares): each player in it puts in the stake
    const t = birdiePotShares(round);
    const bs = s.birdies || {};
    if (t.inPot.length >= 2) addSpread(birdiePot(t.shares, bs.stake ?? 0));
    detail.birdies = t;
  }

  if (POT_GAMES.includes(round.game)) {
    // Closest to the pin or long drive, a side game only (see potTable): the winner on each pot hole takes its share
    const t = potTable(round, round.game);
    addSpread(t.deltas);
    detail.pot = t;
  }

  if (round.game === 'rabbit') {
    const t = rabbitTable(round);
    // Like Nassau, a leg that isn't finished pays whoever holds the rabbit on the holes played
    for (const leg of t.legs) {
      if (!leg.pays) continue;
      for (const id of leg.payers) {
        if (id === leg.holder) balances[id] += leg.amount;
        else { balances[id] -= leg.stake; pay(id, leg.holder, leg.stake); }
      }
    }
    detail.rabbit = t;
  }

  round2();
  const standings = [...round.players]
    .map(p => ({ ...p, amount: balances[p.id] }))
    .sort((a, b) => b.amount - a.amount);
  // Whole cents, and b's side of each pair is exactly a's the other way round
  const pairs = Object.fromEntries(ids.map(id => [id, {}]));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const v = Math.round((raw[a][b] || 0) * 100) / 100 || 0;
    pairs[a][b] = v; pairs[b][a] = -v || 0;
  }
  return { balances, standings, transfers: minimalTransfers(balances), detail, pairs };
}

// --------------------------- Several games at once ------------------------
// A round has one main game (round.game, group-voted as ever) and up to two side games:
// round.sideGames = [{ game: 'skins' | 'dots' | 'birdies' | 'snake' | 'rabbit', settings }]. Each side game keeps its own
// settings, so the main game's defaults in round.settings (every game's are there) never leak in.
// round.gamesFor = { pid: ['main', 'skins', ...] } is only set for a player who isn't in every game
// (a late joiner). Both are absent on older rounds, whose money is exactly what it always was.

/** Games that can ride along as a side game, and what they're called there. GAMES is untouched. */
export const SIDE_GAMES = {
  skins: { label: 'Skins', icon: 'coins' },
  dots: { label: 'Junk', icon: 'medal' },
  birdies: { label: 'Birdie pot', icon: 'bird' },
  snake: { label: 'Snake', icon: 'wave-sine' },
  rabbit: { label: 'Rabbit', icon: 'rabbit' },
  ctp: { label: 'Closest to the pin', icon: 'crosshair' },
  drive: { label: 'Long drive', icon: 'golf' },
};

/** Most games in one round, the main game included. */
export const MAX_GAMES = 4;

/**
 * Side games that would pay for the same thing twice next to `game` (the main game or another side
 * game), so they're never on together: the same game twice, Skins with Rabbit (both pay for winning a
 * hole outright; Rabbit is a one-pot skin), and Junk with Bingo Bango Bongo (the greenie and the
 * bango both pay for being closest).
 */
const CLASH = { skins: ['skins', 'rabbit'], rabbit: ['rabbit', 'skins'], dots: ['dots', 'bbb'], snake: ['snake'], birdies: ['birdies'], ctp: ['ctp', 'bbb'], drive: ['drive'] };
function clashes(key, game) { return (CLASH[key] || []).includes(game); }
/**
 * A closest to the pin pot pays for the same shot as a greenie, so it never rides on a Dots round,
 * whose greenies are the main game's. Next to Junk as a side game both stay on, and the pot is
 * what pays for being closest: Junk's greenies are off (see gameView).
 */
const MAIN_CLASH = { ctp: ['dots'] };
const mainClashes = (key, game) => clashes(key, game) || (MAIN_CLASH[key] || []).includes(game);

/**
 * A round's side games (an empty list on older rounds). Anything setup could never make is dropped,
 * so a garbled or hand-edited round can't count money twice: games this build doesn't know, a game
 * listed twice, Skins on a Skins round, Skins with Rabbit or Junk on a Dots round (the same thing paid
 * twice), any side game on a Scramble, and anything past the MAX_GAMES cap. Junk next to Bingo Bango
 * Bongo is only kept off in setup, so a round made before that rule keeps its money.
 */
export function sideGamesOf(round) {
  if (!round || !Array.isArray(round.sideGames) || round.game === 'scramble') return [];
  const out = [];
  for (const sg of round.sideGames) {
    if (out.length >= MAX_GAMES - 1) break;
    if (!sg || !SIDE_GAMES[sg.game] || !sg.settings || typeof sg.settings !== 'object') continue;
    const hard = g => g !== 'bbb' && clashes(sg.game, g);
    // Rounds before the pots never had one, so a pot next to Bingo Bango Bongo or Dots is dropped outright
    const potClash = POT_GAMES.includes(sg.game) && mainClashes(sg.game, round.game);
    if (potClash || hard(round.game) || out.some(x => hard(x.game))) continue;
    out.push(sg);
  }
  return out;
}

/** The keys of every game in a round: 'main' first, then each side game by its game key. */
export function gameKeys(round) {
  return ['main', ...sideGamesOf(round).map(sg => sg.game)];
}

/** What a game in the round is called: the main game's name, or the side game's label. */
export function gameKeyLabel(round, key) {
  return key === 'main' ? GAMES[round.game]?.name || 'Game' : SIDE_GAMES[key]?.label || key;
}

/**
 * Side games that could still be added next to `mainGame`, given the ones already on.
 * None with a Scramble (scores are per team, so per-player side games can't work), and none that
 * clash with the main game or a side game already on (see CLASH). A game already on is never offered
 * again, the Birdie pot included (it clashes with nothing, so CLASH alone would offer a second pot).
 */
export function sideGameChoices(mainGame, sideGames = []) {
  if (!mainGame || mainGame === 'scramble') return [];
  if (sideGames.length >= MAX_GAMES - 1) return [];
  return Object.keys(SIDE_GAMES).filter(k => !mainClashes(k, mainGame) && !sideGames.some(sg => sg.game === k || clashes(k, sg.game)));
}

/** Whether `pid` plays the game `key` in this round (everyone is in every game unless gamesFor says otherwise). */
export function playsGame(round, pid, key) {
  const list = round.gamesFor?.[pid];
  return !Array.isArray(list) || list.includes(key);
}

/**
 * One game of the round as a round of its own, for the per-game engine. 'main' is the round with
 * only the players in the main game. A side game swaps in its own game, settings and bet history
 * (its own entry's betHistory, never the main game's, which settingsAt() would otherwise lay over
 * the side game's key), and has no teams or presses. Old rounds have no side game history, so
 * every hole reads the side game's settings as it always did.
 */
export function gameView(round, key) {
  const players = round.gamesFor ? round.players.filter(p => playsGame(round, p.id, key)) : round.players;
  if (key === 'main') return players === round.players ? round : { ...round, players };
  const sg = sideGamesOf(round).find(x => x.game === key);
  if (!sg) return null;
  // A side game with its own Strokes given % plays off it (see allowances.js); else everyone's strokes are the round's
  const pct = gamePct(round, key);
  const own = round.useHandicaps && pct !== gamePct(round);
  // With a closest to the pin pot on, Junk's greenies are off: the pot pays for being closest (see MAIN_CLASH)
  const noGreenie = sg.game === 'dots' && sideGamesOf(round).some(x => x.game === 'ctp');
  const settings = noGreenie ? withoutGreenie(sg.settings) : sg.settings;
  const betHistory = !Array.isArray(sg.betHistory) ? undefined : noGreenie ? sg.betHistory.map(e => ({ ...e, settings: withoutGreenie(e.settings) })) : sg.betHistory;
  return {
    ...round, game: sg.game, settings: { ...round.settings, [sg.game]: settings }, teams: null, presses: [], betHistory,
    players: own ? playsAtPct(players, pct, round.joined) : players, ...(own ? { hcPct: pct } : {}),
  };
}

/** Junk's settings with the greenie off. */
function withoutGreenie(dots) {
  // Junk counts a dot unless its kind is `false` (see pointsTable), so a greenie missing from the kinds is on too
  if (!dots || dots.kinds?.greenie === false) return dots;
  return { ...dots, kinds: { ...(dots.kinds || {}), greenie: false } };
}

/** Whether Junk's greenies are off in this round because a closest to the pin pot pays for them. */
export function greeniesInPot(round) {
  const sgs = sideGamesOf(round);
  return sgs.some(x => x.game === 'ctp') && sgs.some(x => x.game === 'dots');
}

/** Birdie pot shares: { shares: { pid: n }, inPot: [pid], holes: [{ no, pid, shares }] }. */
export function birdiePotShares(round) {
  const eagle = round.settings.birdies?.eagleShares ?? 2;
  // Like the other pots, a player who left or joined partway is out of it
  const inPot = round.players.filter(p => playsWholeRound(round, p.id));
  const shares = Object.fromEntries(inPot.map(p => [p.id, 0]));
  const holes = [];
  for (const h of round.holes) {
    if (!holeComplete(round, h)) continue;
    for (const p of inPot) {
      if (round.scores[h.no]?.[p.id] === 'X') continue;
      const n = birdieShares(netFor(round, p, h), h.par, eagle);
      if (n) { shares[p.id] += n; holes.push({ no: h.no, pid: p.id, shares: n }); }
    }
  }
  return { shares, inPot: inPot.map(p => p.id), holes };
}

// --------------------------- Closest to the pin and long drive pots ------
// Side games only. Everyone in the pot puts in the stake, and the pot is shared out across the pot's
// holes: every par 3 for closest to the pin, the chosen holes for long drive (every par 5 until the
// group picks, else every par 4). The keeper taps the winner on each pot hole, kept with the hole's
// marks as `marks[no].ctp` or `marks[no].drive`: a player id, or 'none' when nobody won it (nobody on
// the green, say). A hole nobody won carries its share to the next pot hole, or (house rule `unclaimed:
// 'split'`) its share is split across the holes that were won. Only holes reached count: a pot hole
// saved with a winner or 'none' (the scoring screen saves 'none' when nobody is tapped). So a round
// stopped early, or a pot under way, pays for the holes played; a pot added partway counts the pot
// holes already played once the keeper goes back and taps them (never as a pile of carries); and a
// share still carried at the end goes back to everyone (nobody pays it).

/** The side games that are a pot of this kind. */
export const POT_GAMES = ['ctp', 'drive'];
/** What each pot is called in a sentence ("They’re out of the birdie pot"), the birdie pot too. */
export const POT_NAMES = { birdies: 'birdie pot', ctp: 'closest to the pin pot', drive: 'long drive pot' };
/** What tapping "nobody" saves for a pot hole nobody won. */
export const POT_NONE = 'none';

/**
 * The holes a pot is played on, in playing order. `round` is any round (or the pot's game view);
 * `settings` the pot's own. Long drive's `holes` are hole numbers; a number this round doesn't play is
 * skipped, and none left (or none picked) means the default: every par 5, else every par 4.
 */
export function potHoles(round, key, settings = round.settings?.[key]) {
  const holes = round.holes || [];
  if (key === 'ctp') return holes.filter(h => h.par === 3);
  const picked = Array.isArray(settings?.holes) ? holes.filter(h => settings.holes.includes(h.no)) : [];
  if (picked.length) return picked;
  const fives = holes.filter(h => h.par >= 5);
  return fives.length ? fives : holes.filter(h => h.par === 4);
}

/** Whether long drive is on the default holes (none picked, or none this round plays). */
export function potHolesDefault(round, key, settings = round.settings?.[key]) {
  if (key === 'ctp') return true;
  const picked = Array.isArray(settings?.holes) ? (round.holes || []).filter(h => settings.holes.includes(h.no)) : [];
  return !picked.length;
}

/** Who won a pot hole from its marks: a player id, POT_NONE, or undefined when not tapped yet. */
export function potWinner(round, key, no) {
  const v = round.marks?.[no]?.[key];
  return v == null ? undefined : v;
}

/**
 * A hole's marks as the scoring screen saves them: every pot played on `hole` with nobody tapped is
 * saved as nobody's (POT_NONE), so the hole counts and carries. `marks` may be null (a round whose
 * games keep no marks, or a pot added while the hole was open); it comes back as it was when no pot
 * is played on the hole or every one already has a winner or nobody.
 */
export function potMarksFor(round, hole, marks) {
  const open = sideGamesOf(round).filter(sg => POT_GAMES.includes(sg.game) && marks?.[sg.game] == null
    && potHoles(gameView(round, sg.game), sg.game).some(h => h.no === hole.no));
  if (!open.length) return marks;
  return { ...(marks || {}), ...Object.fromEntries(open.map(sg => [sg.game, POT_NONE])) };
}

/**
 * A pot worked out on the game view `round` (round.game is the pot's key):
 * { key, inPot, stake, pot, worth, unclaimed, holes: [{ no, par, winner, reached, value, carried, paid }],
 *   won: { pid: { holes: [no], amount } }, paidOut, handedBack, deltas }.
 * `worth` is one hole's share; `value` what a reached hole was played for (its share plus any carry, or
 * with split, the pot shared out across the holes won), `paid` what its winner took. `deltas` is each
 * player's money: what they won less their part of everything paid out. Nobody's money moves until a
 * pot hole is won, and with fewer than two in the pot or no pot holes nothing does.
 */
export function potTable(round, key = round.game) {
  const s = round.settings?.[key] || {};
  const stake = s.stake ?? 0;
  const unclaimed = s.unclaimed === 'split' ? 'split' : 'carry';
  // Like the other pots, a player who left or joined partway is out of it
  const inPot = round.players.filter(p => playsWholeRound(round, p.id)).map(p => p.id);
  const list = potHoles(round, key, s);
  const n = inPot.length;
  const worth = list.length && n ? (stake * n) / list.length : 0;
  const won = Object.fromEntries(inPot.map(id => [id, { holes: [], amount: 0 }]));
  const holes = list.map(h => {
    const w = potWinner(round, key, h.no);
    // A winner who isn't in the pot (they left, or joined late) can't take it: nobody won it
    const winner = w === undefined ? undefined : inPot.includes(w) ? w : POT_NONE;
    return { no: h.no, par: h.par, winner, reached: winner !== undefined, value: 0, carried: 0, paid: 0 };
  });
  const reached = holes.filter(h => h.reached);
  const wins = reached.filter(h => h.winner !== POT_NONE);
  let handedBack = 0;
  if (n >= 2 && stake > 0) {
    if (unclaimed === 'split') {
      // The holes reached are shared out across the ones won
      const each = wins.length ? (worth * reached.length) / wins.length : 0;
      for (const h of wins) { h.value = each; h.paid = each; }
      if (!wins.length) handedBack = worth * reached.length;
    } else {
      let carry = 0;
      for (const h of reached) {
        h.carried = carry;
        h.value = worth + carry;
        if (h.winner !== POT_NONE) { h.paid = h.value; carry = 0; } else carry = h.value;
      }
      handedBack = carry;
    }
  }
  for (const h of wins) if (h.paid) { won[h.winner].holes.push(h.no); won[h.winner].amount += h.paid; }
  const paidOut = wins.reduce((a, h) => a + h.paid, 0);
  const deltas = Object.fromEntries(round.players.map(p => [p.id, 0]));
  if (paidOut > 0) for (const id of inPot) deltas[id] = won[id].amount - paidOut / n;
  return { key, inPot, stake, pot: stake * n, worth, unclaimed, holes, won, paidOut, handedBack, deltas: roundCents(deltas) };
}

/** What the side bets between two players are called in the by-game table (see pair-bets.js). */
export const BETS_LABEL = 'Side bets';
/** What a reward round's side bets played for money are called, apart from the reward's points. */
export const CASH_LABEL = 'Side bets for money';

/**
 * A reward round's side bets played for money, worked out apart from everything else (they go on
 * the Tab in dollars; the reward is decided on the games and the points bets). Its transfers are
 * pair by pair, between the two players of each bet:
 * { label, balances, pairs, transfers, standings, list }, or null when there are none.
 */
function cashResults(round, cash) {
  if (!cash.length) return null;
  const ids = round.players.map(p => p.id);
  const b = betsMoney(round, cash);
  const balances = roundCents(b.balances);
  const pairs = Object.fromEntries(ids.map(id => [id, {}]));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const v = Math.round((b.pairs[ids[i]]?.[ids[j]] || 0) * 100) / 100 || 0;
    pairs[ids[i]][ids[j]] = v; pairs[ids[j]][ids[i]] = -v || 0;
  }
  const standings = [...round.players].map(p => ({ ...p, amount: balances[p.id] })).sort((x, y) => y.amount - x.amount);
  // Each bet is between its two players, so the money goes between them too: one payment a pair,
  // never netted through someone who wasn't in the bet (the editor says "between the two of you")
  const transfers = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const v = pairs[ids[i]][ids[j]];
    if (v > 0) transfers.push({ from: ids[j], to: ids[i], amount: v });
    else if (v < 0) transfers.push({ from: ids[i], to: ids[j], amount: -v });
  }
  transfers.sort((x, y) => y.amount - x.amount);
  return { label: CASH_LABEL, balances, pairs, transfers, standings, list: b.list };
}
const withCash = (res, cash) => (cash ? { ...res, cash } : res);

/**
 * Money by player id for the whole round, every game added up. With no side games and no side bets
 * it's exactly the main game's gameResults. Otherwise each game is worked out on its own (see
 * gameView), the balances and head-to-heads are summed (a player not in a game counts 0 there), and
 * the fewest payments square everyone across all the games at once. `detail` is the main game's,
 * plus `detail.byGame`: { key: { label, balances, pairs, detail } } in playing order, main first,
 * and the two-player side bets last under `bets` ({ detail: { bets: [betResult] } }, see pair-bets.js).
 * A reward round's side bets played for money are left out of all that and come back on their own
 * as `cash` (see cashResults), only when there are some.
 */
export function roundResults(round) {
  const sgs = sideGamesOf(round);
  const all = betsOf(round);
  // A reward round's money bets stay out of the totals (they're dollars, the totals are points): see cashResults
  const cashBets = all.filter(b => isCashBet(round, b));
  const bets = cashBets.length ? all.filter(b => !isCashBet(round, b)) : all;
  const cash = cashResults(round, cashBets);
  if (!sgs.length && !bets.length) return withCash(gameResults(round), cash);
  const ids = round.players.map(p => p.id);
  const sum = Object.fromEntries(ids.map(id => [id, 0]));
  const rawPairs = Object.fromEntries(ids.map(id => [id, {}]));
  const byGame = {};
  let mainDetail = {};
  for (const key of gameKeys(round)) {
    const view = gameView(round, key);
    if (!view || !view.players.length) continue;
    const r = gameResults(view);
    for (const id of ids) sum[id] += r.balances[id] || 0;
    for (const a of Object.keys(r.pairs)) for (const [b, v] of Object.entries(r.pairs[a])) {
      if (rawPairs[a]) rawPairs[a][b] = (rawPairs[a][b] || 0) + v;
    }
    const balances = Object.fromEntries(ids.map(id => [id, r.balances[id] || 0]));
    byGame[key] = { label: gameKeyLabel(round, key), balances, pairs: r.pairs, detail: r.detail };
    if (key === 'main') mainDetail = r.detail;
  }
  // Each side bet between two players, worked out on its own two-player view of the round
  if (bets.length) {
    const b = betsMoney(round, bets);
    for (const id of ids) sum[id] += b.balances[id] || 0;
    for (const a of Object.keys(b.pairs)) for (const [o, v] of Object.entries(b.pairs[a])) rawPairs[a][o] = (rawPairs[a][o] || 0) + v;
    byGame.bets = { label: BETS_LABEL, balances: b.balances, pairs: b.pairs, detail: { bets: b.list } };
  }
  const balances = roundCents(sum);
  const standings = [...round.players].map(p => ({ ...p, amount: balances[p.id] })).sort((a, b) => b.amount - a.amount);
  const pairs = Object.fromEntries(ids.map(id => [id, {}]));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const v = Math.round((rawPairs[a][b] || 0) * 100) / 100 || 0;
    pairs[a][b] = v; pairs[b][a] = -v || 0;
  }
  return withCash({ balances, standings, transfers: minimalTransfers(balances), detail: { ...mainDetail, byGame }, pairs }, cash);
}

/** Honest head-to-head for one round: what `a` won from `b` (negative when b came out ahead). */
export function headToHead(round, a, b) {
  return roundResults(round).pairs[a]?.[b] ?? 0;
}

/** "Mike", "Mike and Sue", "Mike, Sue and Al". */
function nameList(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** What leaving does to the game, in a sentence (for the results, and before marking someone as gone). */
export function leftRule(round, pid) {
  // Someone who was only in the side games leaves the main game as it was
  if (!playsGame(round, pid, 'main')) return withSideRule(`${GAMES[round.game].name} carries on as it was: they weren’t in it.`, round, 'left');
  return withSideRule(mainLeftRule(gameView(round, 'main'), pid), round, 'left');
}

function mainLeftRule(round, pid) {
  const g = round.game;
  const first = n => n.split(' ')[0];
  if (g === 'vegas') return 'Vegas needs two full teams, so the holes after that don’t count.';
  if (g === 'nines') return 'Nines is for three, so the holes after that don’t count.';
  if (g === 'sixes') {
    const pos = leftAt(round, pid);
    const between = pos === 0 || sixesSegments(round.holes.length).some(sg => sg.end === pos);
    return between ? 'Sixes needs all four, so the matches after that are off.' : 'Their partner plays out the match under way alone, and the matches after that are off.';
  }
  if (g === 'wolf') return 'Wolf carries on with the players still there.';
  if (g === 'snake') return 'If they leave holding the snake, they still pay it. The holes after that are played among the players still there.';
  if (g === 'skins' && round.settings.skins?.payout === 'pot') return 'They’re out of the pot, so they don’t put in and their skins don’t count.';
  if (g === 'nassau' || g === 'match' || g === 'scramble' || g === 'hammer') {
    const side = (g === 'scramble' ? round.teams || [] : sides(round).map(players => ({ players }))).find(t => t.players.includes(pid));
    const mates = (side?.players || []).filter(x => x !== pid && leftAt(round, x) > leftAt(round, pid));
    if (!mates.length) return g === 'scramble' ? 'Their team is out of the pot.' : 'Their side has nobody left, so the match stops there and the bets stand as they are.';
    const names = nameList(mates.map(x => first(playerById(round, x)?.name || '')));
    return `${names} ${mates.length === 1 ? 'carries' : 'carry'} on for the ${g === 'scramble' ? 'team' : 'side'}.`;
  }
  if ((g === 'stroke' || g === 'stableford' || g === 'quota') && round.settings[g]?.payout === 'pot') return 'They’re out of the pot, so they don’t pay or win it.';
  if (g === 'stroke' || g === 'stableford' || g === 'quota') return 'They settle with each player on the holes they both played.';
  return 'The holes after that are settled among the players still playing.';
}

/**
 * Plain-English notes for the results: players who left and what it did to the game, and holes
 * that weren't counted because a score is missing, and players added partway through.
 * [{ kind: 'joined' | 'left' | 'missing', text }]
 */
export function roundNotes(round) {
  const notes = [];
  const first = n => n.split(' ')[0];
  for (const { player, from } of playersJoined(round)) {
    notes.push({ kind: 'joined', text: `${first(player.name)} joined on hole ${from}. ${joinRule(round, player.id)}` });
  }
  for (const { player, after, pos } of playersLeft(round)) {
    if (pos >= round.holes.length) continue;
    const when = after === 0 ? 'before the first hole' : `after hole ${after}`;
    notes.push({ kind: 'left', text: `${first(player.name)} left ${when}. ${leftRule(round, player.id)}` });
  }
  // Bingo bango bongo and Snake pay on marks alone, so missing scores don't matter there
  if (round.game === 'bbb' || round.game === 'snake') return notes;
  const lastScored = round.holes.reduce((a, h, i) => (Object.values(round.scores[h.no] || {}).some(v => v != null) ? i : a), -1);
  round.holes.forEach((h, i) => {
    if (i > lastScored || holeComplete(round, h)) return;
    const s = round.scores[h.no] || {};
    const missing = scorers(round, h).filter(p => s[p.id] == null);
    if (!missing.length) return;
    const all = missing.length === scorers(round, h).length;
    notes.push({ kind: 'missing', text: all ? `Hole ${h.no} not counted: no scores.` : `Hole ${h.no} not counted: no score for ${nameList(missing.map(p => (p.team ? p.name : first(p.name))))}.` });
  });
  return notes;
}

/**
 * Money while a hole is being entered: everyone's total with the hole counted, and what the hole
 * alone adds. `pending` holds the unsaved entries for the hole ({ scores, banker, wolf, marks });
 * leave it null to count the hole only if it's already saved.
 */
export function livePreview(round, hole, pending = null) {
  const no = hole.no;
  const put = (key, v) => (v ? { [key]: { ...(round[key] || {}), [no]: v } } : {});
  const counted = pending
    ? { ...round, scores: { ...round.scores, [no]: pending.scores }, ...put('banker', pending.banker), ...put('wolf', pending.wolf), ...put('marks', pending.marks) }
    : round;
  // The round before this hole: no scores and no marks. Marks have to go too, because Bingo Bango
  // Bongo and Dots count marks on their own, so a saved hole's marks would otherwise cancel out of the delta.
  const without = { ...round, scores: { ...round.scores }, marks: { ...(round.marks || {}) } };
  delete without.scores[no];
  delete without.marks[no];
  // ...and a side bet's winner tapped on this hole (closest to the pin, a custom bet), which pays on the hole too
  if (Array.isArray(round.bets)) {
    without.bets = round.bets.map(b => {
      if (b?.kind === 'ctp' && b.winners && no in b.winners) { const winners = { ...b.winners }; delete winners[no]; return { ...b, winners }; }
      if (b?.kind === 'custom' && b.winner != null && b.at === no) { const { winner: _w, at: _a, ...rest } = b; return rest; }
      return b;
    });
  }
  const res = roundResults(counted);
  const now = res.balances;
  const was = roundResults(without);
  const before = was.balances;
  const delta = Object.fromEntries(Object.keys(now).map(id => [id, Math.round((now[id] - before[id]) * 100) / 100]));
  // With side games, each game's money too (for the money bar's by-game table)
  const out = res.detail.byGame ? { balances: now, delta, byGame: res.detail.byGame } : { balances: now, delta };
  // A reward round's side bets for money, in dollars on their own (see cashResults)
  if (res.cash) {
    const b0 = was.cash?.balances || {};
    out.cash = { ...res.cash, delta: Object.fromEntries(Object.keys(res.cash.balances).map(id => [id, Math.round((res.cash.balances[id] - (b0[id] || 0)) * 100) / 100])) };
  }
  return out;
}

/** Gross totals + counts for stats. Works for a player or a scramble team id. */
export function scoreSummary(round, pid) {
  let gross = 0, played = 0, birdies = 0, eagles = 0, pars = 0;
  const p = scorers(round).find(x => x.id === pid);
  if (!p) return { gross, played, birdies, eagles, pars };
  for (const h of round.holes) {
    const g = round.scores[h.no]?.[pid];
    if (g == null) continue;
    const eff = g === 'X' ? pickupGross(h.par, popsFor(round, p, h)) : g;
    gross += eff; played++;
    if (g !== 'X') {
      if (eff - h.par <= -2) eagles++;
      else if (eff - h.par === -1) birdies++;
      else if (eff === h.par) pars++;
    }
  }
  return { gross, played, birdies, eagles, pars };
}
