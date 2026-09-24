// Pure maths for the team and points games. No DOM, no storage — unit tested in games.test.js.
// Money conventions used across these games:
//  • "sides": two teams (any sizes). The stake is per player; with uneven sides the total at risk is
//    stake × the bigger side, and each side splits its share evenly. So in 1 v 3 the loner plays for 3× the stake.
//  • "points": each player's money is (their points − the average) × value, so it always sums to zero.
//  • "pot": everyone antes the stake; the best total takes it all, and ties split it.

// ---------------------------------------------------------------------------
// Sides
// ---------------------------------------------------------------------------

/** Best ball of a side: the lowest net among its members; null if any is missing. */
export function bestBall(nets) {
  if (!nets.length || nets.some(n => n == null)) return null;
  return Math.min(...nets);
}

/**
 * Money for two sides when side `winner` (0 or 1) wins `stake` per player.
 * Returns [amountForEachOnSide0, amountForEachOnSide1] (positive = wins).
 */
export function sideSplit(stake, size0, size1, winner) {
  if (winner == null) return [0, 0];
  const total = stake * Math.max(size0, size1);
  const a = total / size0, b = total / size1;
  return winner === 0 ? [a, -b] : [-a, b];
}

/** Match-play notation for a finished or running match: "3&2", "2 up", "1 up", "AS", "Dormie". */
export function matchLabel(status, name) {
  if (status.leader === null) return status.left === 0 ? 'Halved' : 'AS';
  const who = name ? `${name} ` : '';
  if (status.closed && status.left > 0) return `${who}${status.by}&${status.left}`;
  return `${who}${status.by} up`;
}

// ---------------------------------------------------------------------------
// Vegas
// ---------------------------------------------------------------------------

/** A team's Vegas number: low score first, high second — unless a score is 10 or more, which goes first. */
export function vegasNumber(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (hi >= 10) return hi * 10 + lo;
  return lo * 10 + hi;
}

/** The flipped number (high first): what a natural birdie by the other team does to you. */
export function vegasFlipped(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return hi * 10 + lo;
}

/**
 * One Vegas hole. nets/gross are [teamA:[n,n], teamB:[n,n]].
 * A team that makes a natural birdie or better flips the other team's number (unless both did).
 * Returns { numbers: [a, b], diff (positive = A wins), flipped: [bool, bool] }.
 */
export function vegasHole(nets, gross, par, { birdieFlip = true } = {}) {
  const birdie = t => gross[t].some(g => typeof g === 'number' && g <= par - 1);
  const bA = birdieFlip && birdie(0), bB = birdieFlip && birdie(1);
  const flipped = [bB && !bA, bA && !bB];
  const numbers = [0, 1].map(t => (flipped[t] ? vegasFlipped(...nets[t]) : vegasNumber(...nets[t])));
  return { numbers, diff: numbers[1] - numbers[0], flipped };
}

// ---------------------------------------------------------------------------
// Sixes (Hollywood / round robin)
// ---------------------------------------------------------------------------

/** The three partner rotations for four players (by index): each player partners everyone once. */
export function sixesPairings(ids) {
  const [a, b, c, d] = ids;
  return [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
}

/** Playing positions (1-based) of the three matches: 6 holes each over 18, 3 each over 9. */
export function sixesSegments(n = 18) {
  const len = n / 3;
  return [0, 1, 2].map(i => ({ start: i * len + 1, end: (i + 1) * len, label: `Holes ${i * len + 1}–${(i + 1) * len}` }));
}

// ---------------------------------------------------------------------------
// Points games
// ---------------------------------------------------------------------------

/** Stableford points for a net score. Standard: 0/1/2/3/4/5. Modified: −3/−1/0/2/5/8. */
export function stablefordPoints(net, par, modified = false) {
  const d = net - par;
  if (modified) return d >= 2 ? -3 : d === 1 ? -1 : d === 0 ? 0 : d === -1 ? 2 : d === -2 ? 5 : 8;
  return d >= 2 ? 0 : d === 1 ? 1 : d === 0 ? 2 : d === -1 ? 3 : d === -2 ? 4 : 5;
}

/** Quota (Chicago) points from a gross score: bogey 1, par 2, birdie 4, eagle 8, better 16. */
export function quotaPoints(gross, par) {
  const d = gross - par;
  return d >= 2 ? 0 : d === 1 ? 1 : d === 0 ? 2 : d === -1 ? 4 : d === -2 ? 8 : 16;
}

/** Quota target: 36 less the course handicap over 18 holes, 18 less it over 9. */
export function quotaFor(courseHc, holes = 18) {
  return (holes === 9 ? 18 : 36) - (courseHc || 0);
}

/**
 * Nines (5-3-1): nine points a hole for three players. Low gets 5, middle 3, high 1; ties share:
 * all tied 3-3-3, two low tied 4-4-1, two high tied 5-2-2.
 */
export function ninesPoints(nets) {
  const [a, b, c] = nets;
  const sorted = [...nets].sort((x, y) => x - y);
  const [lo, mid, hi] = sorted;
  let table;
  if (lo === hi) table = { [lo]: 3 };
  else if (lo === mid) table = { [lo]: 4, [hi]: 1 };
  else if (mid === hi) table = { [lo]: 5, [hi]: 2 };
  else table = { [lo]: 5, [mid]: 3, [hi]: 1 };
  return [a, b, c].map(n => table[n]);
}

/** Aces & Deuces: the outright low wins `ace` from everyone; the outright high pays `deuce` to everyone. */
export function acesDeuces(nets, ids, { ace = 2, deuce = 1 } = {}) {
  const deltas = Object.fromEntries(ids.map(id => [id, 0]));
  const lo = Math.min(...nets), hi = Math.max(...nets);
  const lows = ids.filter((_, i) => nets[i] === lo), highs = ids.filter((_, i) => nets[i] === hi);
  let aceId = null, deuceId = null;
  if (lows.length === 1 && lo !== hi) {
    aceId = lows[0];
    for (const id of ids) if (id !== aceId) { deltas[id] -= ace; deltas[aceId] += ace; }
  }
  if (highs.length === 1 && lo !== hi) {
    deuceId = highs[0];
    for (const id of ids) if (id !== deuceId) { deltas[id] += deuce; deltas[deuceId] -= deuce; }
  }
  return { deltas, ace: aceId, deuce: deuceId };
}

/** Money from points: each player's (points − average) × value. Sums to zero. */
export function pointsToMoney(points, value) {
  const ids = Object.keys(points);
  if (!ids.length) return {};
  const avg = ids.reduce((a, id) => a + points[id], 0) / ids.length;
  const out = {};
  for (const id of ids) out[id] = Math.round((points[id] - avg) * value * 100) / 100;
  return out;
}

/**
 * Settle a set of totals. mode 'pot': everyone antes `stake`, best total takes it (ties split).
 * mode 'per': every pair settles the difference × stake. lowerWins picks the direction.
 */
export function settleTotals(totals, { mode = 'pot', stake = 1, lowerWins = true } = {}) {
  const ids = Object.keys(totals).filter(id => totals[id] != null);
  const out = Object.fromEntries(Object.keys(totals).map(id => [id, 0]));
  if (ids.length < 2) return out;
  if (mode === 'per') {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const d = (totals[a] - totals[b]) * stake * (lowerWins ? -1 : 1); // positive = a wins
      out[a] += d; out[b] -= d;
    }
    return out;
  }
  const best = lowerWins ? Math.min(...ids.map(id => totals[id])) : Math.max(...ids.map(id => totals[id]));
  const winners = ids.filter(id => totals[id] === best);
  const pot = stake * ids.length;
  for (const id of ids) out[id] -= stake;
  for (const id of winners) out[id] += pot / winners.length;
  for (const id of ids) out[id] = Math.round(out[id] * 100) / 100;
  return out;
}

// ---------------------------------------------------------------------------
// Scramble
// ---------------------------------------------------------------------------

/** USGA-style scramble allowances by team size, applied low handicap first. */
const SCRAMBLE_ALLOWANCE = { 1: [1], 2: [0.35, 0.15], 3: [0.2, 0.15, 0.1], 4: [0.25, 0.2, 0.15, 0.1] };

/** Team course handicap for a scramble from its members' course handicaps. */
export function scrambleTeamHandicap(courseHcs) {
  const hcs = courseHcs.map(h => h ?? 0).sort((a, b) => a - b).slice(0, 4);
  const w = SCRAMBLE_ALLOWANCE[hcs.length] || SCRAMBLE_ALLOWANCE[4];
  return Math.round(hcs.reduce((a, h, i) => a + h * w[i], 0));
}

// ---------------------------------------------------------------------------
// Rabbit
// ---------------------------------------------------------------------------

/**
 * Who holds the rabbit through a run of holes. rows: [{ winner: pid | null (tie) | undefined (unplayed) }].
 * With tiesFree a tied hole sets the rabbit loose. Returns { holder, history: [holder after each hole] }.
 */
export function rabbitHolder(rows, tiesFree = true) {
  let holder = null;
  const history = [];
  for (const r of rows) {
    if (r.winner === undefined) { history.push(holder); continue; }
    if (r.winner) holder = r.winner;
    else if (tiesFree) holder = null;
    history.push(holder);
  }
  return { holder, history };
}

// ---------------------------------------------------------------------------
// Dots (junk)
// ---------------------------------------------------------------------------

export const DOT_KINDS = {
  greenie: { name: 'Greenie', help: 'On the green in one on a par 3 (and two-putt or better)' },
  sandy: { name: 'Sandy', help: 'Par or better after being in a bunker' },
  barkie: { name: 'Barkie', help: 'Par or better after hitting a tree' },
  chipin: { name: 'Chip-in', help: 'Holed from off the green' },
  polie: { name: 'Polie', help: 'Holed a putt longer than the flagstick' },
  arnie: { name: 'Arnie', help: 'Par without ever touching the fairway' },
};

/** Automatic dots from a gross score: birdie 1, eagle or better 2. */
export function scoreDots(gross, par) {
  if (typeof gross !== 'number') return 0;
  return gross <= par - 2 ? 2 : gross === par - 1 ? 1 : 0;
}
