// Suggested handicap allowance for a game, from the WHS table. Pure, no DOM. Unit tested in allowances.test.js.

/**
 * WHS recommended handicap allowances, as a % of each player's course handicap.
 * Source: Rules of Handicapping (effective January 2024), Appendix C, table of recommended
 * allowances: stroke play "Individual 95%", "Individual Stableford 95%", "Four-Ball 85%";
 * match play "Individual 100%", "Four-Ball 90%". Scramble rows live in games.js (SCRAMBLE_ALLOWANCE).
 * Checked 2026-09-29 against the R&A/USGA 2024 Rules of Handicapping PDF
 * (https://www.golfrsa.com/wp-content/uploads/2024/01/WHS_Rules_of_Handicapping_2024.pdf, Appendix C).
 * `format` is how the hint names it, after "for".
 */
export const WHS_ALLOWANCE = {
  stroke: { pct: 95, format: 'stroke play' },
  stableford: { pct: 95, format: 'Stableford' },
  singlesMatch: { pct: 100, format: 'singles match play' },
  fourBallMatch: { pct: 90, format: 'best ball match play' },
  // Best ball played as stroke play (2026-10-03)
  fourBallStroke: { pct: 85, format: 'best ball stroke play' },
  // "Best 1 of 4 stroke play 75%" and "Best 2 of 4 stroke play 85%", for best ball with teams of three or four
  best1of4: { pct: 75, format: 'best 1 of 4' },
  best2of4: { pct: 85, format: 'best 2 of 4' },
};

// Shamble isn't in Appendix C. The USGA's guidance for a selected drive, which a shamble starts with, is
// 75% of each player's course handicap for two-person teams and 65% for four-person teams; three-person
// teams get 70%, in between. Source, checked 2026-10-03: USGA Rules of Handicapping, Committee content,
// "Selected drive" https://www.usga.org/handicapping/roh/Content/rules/Committee%20Content/USGA/LG_R7h7.htm
export const SHAMBLE_ALLOWANCE = { 2: 75, 3: 70, 4: 65 };
const SIZE_WORD = { 2: 'twos', 3: 'threes', 4: 'fours' };

/**
 * Best ball and Shamble, from the teams (arrays of ids) and the game's settings. Best ball with pairs
 * is four-ball: 90% as a match (holes won, or per hole) and 85% as stroke play. Teams of three or four
 * use the "best 1 of 4" and "best 2 of 4" rows, played as a match too (Appendix C has no match play row
 * for them, nor a row for teams of three, so those use the four-player one). Uneven teams get nothing.
 */
function teamGameAllowance(game, teams, settings) {
  if (!teams || teams.length !== 2 || teams[0].length !== teams[1].length) return null;
  const size = Math.min(4, teams[0].length);
  if (size < 2) return null;
  if (game === 'shamble') return { pct: SHAMBLE_ALLOWANCE[size], format: `a shamble in ${SIZE_WORD[size]}` };
  if (size === 2) return settings?.format !== 'hole' && settings?.scoring === 'stroke' ? WHS_ALLOWANCE.fourBallStroke : WHS_ALLOWANCE.fourBallMatch;
  const row = settings?.count === 2 ? WHS_ALLOWANCE.best2of4 : WHS_ALLOWANCE.best1of4;
  return size === 4 ? row : { ...row, format: row.format.replace('of 4', `of ${size}`) };
}

/** The team shape of a head-to-head game: 'singles' (1 v 1), 'fourball' (2 v 2) or null for anything else. */
function sideShape(teams, players) {
  if (!teams || !teams.length) return players === 2 ? 'singles' : null;
  if (teams.length !== 2) return null;
  const [a, b] = teams.map(t => t.length);
  if (a === 1 && b === 1) return 'singles';
  if (a === 2 && b === 2) return 'fourball';
  return null;
}

/**
 * The WHS allowance for a game as set up, { pct, format }, or null when WHS has no format for it.
 * `teams` are arrays of player ids (null for 1 v 1 Nassau and Hammer); `players` is how many play.
 * Skins, Wolf, Banker, Vegas, Quota and the points games have no Appendix C row, so they get
 * nothing. Scramble gets nothing here either: its team allowances are applied already.
 * Uneven or bigger sides (1 v 3, 3 v 3) are not a WHS format, so they get nothing too.
 * Best ball and Shamble read their `settings` (the game's own block) for the scoring and balls that
 * count; Alternate shot and Chapman, like Scramble, have their team allowances applied already.
 */
export function suggestedAllowance(game, { teams = null, players = null, settings = null } = {}) {
  switch (game) {
    case 'bestball':
    case 'shamble': return teamGameAllowance(game, teams, settings);
    case 'stroke': return WHS_ALLOWANCE.stroke;
    case 'stableford': return WHS_ALLOWANCE.stableford;
    case 'match':
    case 'nassau':
    case 'hammer': {
      const shape = sideShape(teams, players);
      return shape === 'singles' ? WHS_ALLOWANCE.singlesMatch : shape === 'fourball' ? WHS_ALLOWANCE.fourBallMatch : null;
    }
    // Sixes is always best ball of each pair (sideNet), in both its match and per-hole modes
    case 'sixes': return WHS_ALLOWANCE.fourBallMatch;
    default: return null;
  }
}

/** The hint line: "Handicap rules suggest 95% for stroke play", or "full strokes" at 100%. */
export function allowanceHint(s) {
  if (!s) return '';
  return `Handicap rules suggest ${s.pct === 100 ? 'full strokes' : `${s.pct}%`} for ${s.format}`;
}

/**
 * The Strokes given choices: 100, 90, 80, plus the suggested % when it is not one of them.
 * `current` is kept too, so a 95% saved from a stroke play round still shows as picked in match play.
 */
export function strokesGivenOptions(s, current = null) {
  const out = new Set([100, 90, 80]);
  if (s) out.add(s.pct);
  if (typeof current === 'number' && current > 0 && current <= 100) out.add(current);
  return [...out].sort((a, b) => b - a);
}

// --------------------------- Allowances by game ---------------------------
// A round has one Strokes given % (round.hcPct) and, with side games, each side game can play off its
// own (round.sideGames[i].hcPct), for example 85% in the Skins and full strokes in the singles match.
// A side game with no hcPct of its own plays off the round's, which is every round made before this.

/** The % of strokes a game in the round plays off: 'main' or a side game's key. */
export function gamePct(round, key = 'main') {
  const base = round?.hcPct ?? 100;
  if (key === 'main') return base;
  const own = (round?.sideGames || []).find(sg => sg?.game === key)?.hcPct;
  return typeof own === 'number' && own > 0 && own <= 100 ? own : base;
}

/** Whether any side game plays off a different % from the main game. */
export function pctsDiffer(round) {
  return (round?.sideGames || []).some(sg => sg && gamePct(round, sg.game) !== gamePct(round));
}

/**
 * Players' `plays` worked out again at another %, for a side game with its own allowance. Strokes
 * are off the same player the round plays off (the lowest `plays` among players who were there from
 * the start), so a late joiner is placed exactly as addPlayerToRound places them. With nobody late
 * this is strokesOffLow at `pct`. Returns new player objects; the ones passed in are untouched.
 */
export function playsAtPct(players, pct, joined = {}) {
  if (!players.length) return players;
  const playing = players.map(p => Math.round((p.courseHc ?? 0) * (pct / 100)));
  let ref = -1;
  players.forEach((p, i) => {
    if (joined?.[p.id] != null) return;
    if (ref < 0 || (p.plays ?? 0) < (players[ref].plays ?? 0)) ref = i;
  });
  const low = ref < 0 ? Math.min(...playing) : playing[ref];
  return players.map((p, i) => ({ ...p, plays: playing[i] - low }));
}

// --------------------------- Half strokes ---------------------------------
// Half-pops: with round.halfStrokes on, each handicap stroke counts as half a shot in the games
// decided hole by hole (a 5 with a stroke is a net 4½), so a big handicap gap doesn't win every hole
// the high player gets a pop on. Ties stay ties when both nets are equal, and nothing about the money
// changes except who wins each hole. Other games in the same round keep full strokes.

/** Games where half strokes apply: the matches and the skins-style "win the hole outright" games. */
export const HALF_STROKE_GAMES = ['match', 'nassau', 'hammer', 'sixes', 'skins', 'rabbit'];

/** Whether a round (or one game's view of it, see gameView) counts each stroke as half. */
export function halfStrokesOn(round) {
  return !!round?.halfStrokes && HALF_STROKE_GAMES.includes(round.game);
}

/** Whether the round has a game half strokes can apply to (main or side), so setup can offer the toggle. */
export function halfStrokesOffered(game, sideGames = []) {
  return HALF_STROKE_GAMES.includes(game) || sideGames.some(sg => HALF_STROKE_GAMES.includes(sg?.game));
}

/** A net score or total for show: 4, 4½, ½, −1½. Whole numbers as they are. */
export function netText(n) {
  if (n == null || !Number.isFinite(n)) return '–';
  if (Number.isInteger(n)) return String(n);
  const whole = Math.trunc(n);
  const sign = n < 0 ? '−' : '';
  return `${sign}${whole === 0 ? '' : Math.abs(whole)}½`;
}

/** "1 stroke", "3 strokes", or with half strokes "1 half stroke", "3 half strokes". */
export function strokesWords(n, half = false) {
  return `${n} ${half ? 'half ' : ''}stroke${n === 1 ? '' : 's'}`;
}

/** The rules line for half strokes. */
export const HALF_STROKES_RULE = 'Half strokes: each handicap stroke counts as half a shot, so a 5 with a stroke is a net 4½. It beats a 5 and loses to a 4. Used in the matches and skins, where a full stroke can decide too many holes.';

/** "full strokes" or "85% of strokes". */
export const pctWords = pct => (pct == null || pct >= 100 ? 'full strokes' : `${pct}% of strokes`);

/**
 * The round's own strokes lines for a game's rules sheet (`key` is 'main' or a side game's key):
 * its % when games play off different ones, and the half strokes rule when it applies. Empty when
 * handicaps are off or there's nothing beyond the usual.
 */
export function strokesRulesLines(round, key = 'main') {
  if (!round?.useHandicaps) return [];
  const game = key === 'main' ? round.game : key;
  const out = [];
  if (pctsDiffer(round)) out.push(`This game plays off ${pctWords(gamePct(round, key))} this round.`);
  if (round.halfStrokes && HALF_STROKE_GAMES.includes(game)) out.push(HALF_STROKES_RULE);
  return out;
}

/** Side games that count handicap strokes, so they can have their own Strokes given %. */
export const STROKE_SIDE_GAMES = ['skins', 'rabbit', 'birdies'];
