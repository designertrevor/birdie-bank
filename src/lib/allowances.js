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
  // No game plays four-ball stroke play yet: kept for when one does
  fourBallStroke: { pct: 85, format: 'best ball stroke play' },
};

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
 */
export function suggestedAllowance(game, { teams = null, players = null } = {}) {
  switch (game) {
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

/** The hint line: "WHS suggests 95% for stroke play", or "full strokes" at 100%. */
export function allowanceHint(s) {
  if (!s) return '';
  return `WHS suggests ${s.pct === 100 ? 'full strokes' : `${s.pct}%`} for ${s.format}`;
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
