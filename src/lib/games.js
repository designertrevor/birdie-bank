// Pure maths for the team and points games. No DOM, no storage. Unit tested in games.test.js.
// Money conventions used across these games:
//  • "sides": two teams (any sizes). The stake is per player; with uneven sides the total at risk is
//    stake × the bigger side, and each side splits its share evenly. So in 1 v 3 the loner plays for 3× the stake.
//  • "per point": every pair settles the difference in points (Bingo Bango Bongo, Dots, Stableford,
//    Quota, per-stroke Stroke play), so each point wins the value from every other player.
//    Nines is the one exception: each player's (points − the average) × value, "every point above
//    or below 54" over 18 holes. Both always sum to zero.
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

/** Match-play notation for a finished or running match: "3&2", "2 up", "1 up", "All square", "Dormie". */
export function matchLabel(status, name) {
  if (status.leader === null) return status.left === 0 ? 'Halved' : 'All square';
  const who = name ? `${name} ` : '';
  if (status.closed && status.left > 0) return `${who}${status.by}&${status.left}`;
  return `${who}${status.by} up`;
}

// ---------------------------------------------------------------------------
// Vegas
// ---------------------------------------------------------------------------

/** A team's Vegas number: low score first, high second, unless a score is 10 or more, which goes first. */
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
 * House rule `birdieDouble` (off unless the round says so): a birdie made by one team alone doubles
 * the hole's points, and an eagle triples them, whoever wins the hole. Both teams birdie, no change.
 * Sources, checked 2026-09-30: Swing by Swing, "How to play the golf gambling game Vegas"
 * https://golf.swingbyswing.com/lifestyle/how-to-play-the-golf-gambling-game-vegas/ ("lone birdies
 * double the point value, eagles triple") and 18Birdies https://help.18birdies.com/article/58-vegas
 * Returns { numbers: [a, b], diff (positive = A wins), flipped: [bool, bool], mult }.
 */
export function vegasHole(nets, gross, par, { birdieFlip = true, birdieDouble = false, daytona = false } = {}) {
  const best = t => Math.min(...gross[t].map(g => (typeof g === 'number' ? g : Infinity)));
  const birdie = t => best(t) <= par - 1;
  const bA = birdieFlip && birdie(0), bB = birdieFlip && birdie(1);
  // House rule "Daytona" (daytona, off unless the round says so, added 2026-10-03): a team with no real
  // par or better on the hole puts its high number first, so a bogey hole costs more. Judged on real
  // scores, like the birdie flip. Sources, checked 2026-10-03: Golf Compendium, "The Daytona golf
  // betting game explained" https://golfcompendium.com/2020/10/the-daytona-golf-betting-game-explained.html
  // and GOLF.com https://golf.com/news/golf-gambling-betting-game-las-vegas-daytona/
  const high = [0, 1].map(t => daytona && !(best(t) <= par));
  const flipped = [bB && !bA, bA && !bB];
  const numbers = [0, 1].map(t => (flipped[t] || high[t] ? vegasFlipped(...nets[t]) : vegasNumber(...nets[t])));
  let mult = 1;
  if (birdieDouble && birdie(0) !== birdie(1)) mult = best(birdie(0) ? 0 : 1) <= par - 2 ? 3 : 2;
  return { numbers, diff: (numbers[1] - numbers[0]) * mult, flipped, mult, ...(daytona ? { high } : {}) };
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

/**
 * Quota (Chicago) points from a gross score: bogey 1, par 2, birdie 4, eagle 8, better 16.
 * House rule `minus` (off unless the round says so, added 2026-10-03): double bogey or worse is −1
 * instead of 0, so a blow-up hole costs you. Source, checked 2026-10-03: Live Tourney, "Quota game in
 * golf" https://www.livetourney.com/blog/quota-game-in-golf ("penalizing double bogeys with -1 point").
 */
export function quotaPoints(gross, par, { minus = false } = {}) {
  const d = gross - par;
  if (d >= 2) return minus ? -1 : 0;
  return d === 1 ? 1 : d === 0 ? 2 : d === -1 ? 4 : d === -2 ? 8 : 16;
}

/** Quota target: 36 less the course handicap over 18 holes, 18 less it over 9. */
export function quotaFor(courseHc, holes = 18) {
  return (holes === 9 ? 18 : 36) - (courseHc || 0);
}

/**
 * Nines (5-3-1): nine points a hole for three players. Low gets 5, middle 3, high 1; ties share:
 * all tied 3-3-3, two low tied 4-4-1, two high tied 5-2-2.
 */
export function ninesPoints(nets, { sweep = false, birdies = null } = {}) {
  const [a, b, c] = nets;
  const sorted = [...nets].sort((x, y) => x - y);
  const [lo, mid, hi] = sorted;
  let table;
  // House rule "sweep" (off unless the round says so): win the hole by two or more and take all nine.
  // Source, checked 2026-09-30: The Golf News Net, "How to play Nines or 5-3-1"
  // https://thegolfnewsnet.com/ryan_ballengee/2026/03/13/golf-betting-games-how-to-play-nines-5-3-1-rules-44877/
  // House rule "birdie bonus" (`birdies`, which players made a real birdie or better; off unless the
  // round says so, added 2026-10-03): win the hole outright with a birdie and it's 7-1-1. A sweep still
  // takes all nine. Same source: "First place wins with birdie or better - 7 pts, second and third
  // place - 1 pt".
  const winner = lo < mid ? nets.indexOf(lo) : -1;
  if (sweep && mid - lo >= 2) table = { [lo]: 9, [mid]: 0, [hi]: 0 };
  else if (birdies && winner >= 0 && birdies[winner]) table = { [lo]: 7, [mid]: 1, [hi]: 1 };
  else if (lo === hi) table = { [lo]: 3 };
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
  for (const id of ids) out[id] = (points[id] - avg) * value;
  return roundCents(out);
}

/**
 * Settle a set of totals. mode 'pot': everyone antes `stake`, best total takes it (ties split).
 * mode 'per': every pair settles the difference × stake. lowerWins picks the direction.
 * `over` (a pot, higher wins, totals measured against a target like Quota's): everyone above zero
 * shares the pot in proportion to how far above they are. Nobody above zero, and the best takes it
 * as usual. Source, checked 2026-10-03: Golf Genius, "Tournament scored points and purse options"
 * https://docs.golfgenius.com/en/articles/10778633-tournament-scored-points-and-purse-options
 * ("paid out depending on their points over Quota in relation to all of the points over Quota").
 */
export function settleTotals(totals, { mode = 'pot', stake = 1, lowerWins = true, over = false } = {}) {
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
  const pot = stake * ids.length;
  const above = over && !lowerWins ? ids.filter(id => totals[id] > 0) : [];
  if (above.length) {
    const sum = above.reduce((a, id) => a + totals[id], 0);
    for (const id of ids) out[id] -= stake;
    for (const id of above) out[id] += pot * totals[id] / sum;
    return roundCents(out);
  }
  const best = lowerWins ? Math.min(...ids.map(id => totals[id])) : Math.max(...ids.map(id => totals[id]));
  const winners = ids.filter(id => totals[id] === best);
  for (const id of ids) out[id] -= stake;
  for (const id of winners) out[id] += pot / winners.length;
  return roundCents(out);
}

/**
 * Round money to whole cents without making or losing a cent. Splitting $20 three ways gives
 * $6.666… each; rounding each on its own hands out $20.01, and then the balances no longer sum to
 * zero and the settle-up can't square everyone. Each amount is rounded, then the spare cent(s) come
 * back from whoever was rounded furthest the wrong way (the first listed when it's a tie).
 */
export function roundCents(amounts) {
  const ids = Object.keys(amounts);
  const raw = ids.map(id => amounts[id] * 100);
  const out = raw.map(v => Math.round(v));
  let off = out.reduce((a, v) => a + v, 0) - Math.round(raw.reduce((a, v) => a + v, 0)); // > 0: too many cents handed out
  if (off) {
    const step = off > 0 ? -1 : 1;
    const pull = i => (out[i] - raw[i]) * -step; // how far rounding went the way we need to undo
    const order = ids.map((_, i) => i).sort((i, j) => pull(j) - pull(i));
    for (let k = 0; off; k++) { out[order[k % order.length]] += step; off += step; }
  }
  return Object.fromEntries(ids.map((id, i) => [id, out[i] / 100 || 0]));
}

// ---------------------------------------------------------------------------
// Scramble
// ---------------------------------------------------------------------------

/**
 * WHS scramble allowances by team size, applied to course handicaps from the lowest up.
 * Source: Rules of Handicapping (effective January 2024), Appendix C, table of recommended
 * allowances: "Scramble (4 players) 25% low/20%/15%/10% high", "Scramble (3 players) 30% low/20%/10% high",
 * "Scramble (2 players) 35% low/15% high". The 3-player row was added in the 2024 update.
 * Checked 2026-09-27 against the R&A/USGA 2024 Rules of Handicapping PDF
 * (https://www.golfrsa.com/wp-content/uploads/2024/01/WHS_Rules_of_Handicapping_2024.pdf, Appendix C).
 */
export const SCRAMBLE_ALLOWANCE = { 1: [1], 2: [0.35, 0.15], 3: [0.3, 0.2, 0.1], 4: [0.25, 0.2, 0.15, 0.1] };

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
 * mode 'free' (the standard): an outright winner catches a loose rabbit; someone else winning a
 * hole outright sets it free again, and the next outright winner catches it.
 * mode 'steal' (the old default): any outright winner takes it straight from the holder.
 * With tiesFree a tied hole sets the rabbit loose; without it ties change nothing.
 * A row's optional `gone` lists players who have left; if the holder is one of them the rabbit runs loose.
 * Returns { holder, history: [holder after each hole] }.
 */
export function rabbitHolder(rows, { mode = 'free', tiesFree = false } = {}) {
  let holder = null;
  const history = [];
  for (const r of rows) {
    if (holder && r.gone?.includes(holder)) holder = null;
    if (r.winner === undefined) { history.push(holder); continue; }
    if (r.winner) holder = mode === 'steal' || !holder || holder === r.winner ? r.winner : null;
    else if (tiesFree) holder = null;
    history.push(holder);
  }
  return { holder, history };
}

// ---------------------------------------------------------------------------
// Dots (junk)
// ---------------------------------------------------------------------------

// Arnie and Hogan, as most groups play them (sources checked 2026-09-29):
//   Arnie (Arnold Palmer, never shy of the rough): par or better on a par 4 or 5 without ever being
//   in the fairway. https://golfcompendium.com/2019/03/arnies-golf-bet.html (par 4s and 5s only)
//   Hogan (Ben Hogan, the tee-to-green ball striker): par or better after hitting the fairway off the
//   tee and the green in regulation, so par 4s and 5s too. The Hogan points game scores those same
//   shots: https://golfcompendium.com/2020/10/how-to-play-golf-game-named-hogan.html
//   Junk in general: https://www.golfcompendium.com/2025/10/junk-golf-game.html and
//   https://thegolfnewsnet.com/golfnewsnetteam/2016/07/08/what-is-junk-in-golf-dots-trash-garbage-birdies-greenies-sandies-50976/
// The chips only show on those pars (see DOT_PARS); the money counts whatever was marked.
export const DOT_KINDS = {
  greenie: { name: 'Greenie', help: 'Closest to the pin in one on a par 3, and par or better to keep it' },
  sandy: { name: 'Sandy', help: 'Par or better after being in a bunker' },
  barkie: { name: 'Barkie', help: 'Par or better after hitting a tree' },
  chipin: { name: 'Chip-in', help: 'Holed from off the green' },
  polie: { name: 'Polie', help: 'Holed a putt longer than the flagstick' },
  arnie: { name: 'Arnie', help: 'Par or better without ever being on the fairway (par 4s and 5s)' },
  hogan: { name: 'Hogan', help: 'Par or better after hitting the fairway and the green in regulation (par 4s and 5s)' },
};

/** Dots that only happen on some pars: a greenie is a par 3 thing, an Arnie or a Hogan needs a fairway. */
export const DOT_PARS = { greenie: [3], arnie: [4, 5], hogan: [4, 5] };

/** Automatic dots from a gross score: birdie 1, eagle or better 2. */
export function scoreDots(gross, par) {
  if (typeof gross !== 'number') return 0;
  return gross <= par - 2 ? 2 : gross === par - 1 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Snake
// ---------------------------------------------------------------------------
// Published rules: whoever three-putts takes the snake, and the next three-putt passes it on.
// Whoever holds it at the end (or at each nine, if chosen) pays each other player the snake's value.
// The snake can stay a fixed amount, grow by the stake with every three-putt, or double each time.
// House rule: a doubling snake can have a cap, the most times it doubles (4 by default for new rounds,
// so $5, 10, 20, 40, 80). Past the cap it stays at the capped amount. No cap (0 or unset) doubles forever;
// rounds saved before the cap existed have none, so their money doesn't change.
// Sources, checked 2026-09-27:
//  Golf Monthly, "What is the Snake game in golf?" https://www.golfmonthly.com/features/the-game/what-is-the-snake-golf-betting-game-67209
//  The Golf News Net, "Golf games: How to play Snake" https://thegolfnewsnet.com/ryan_ballengee/2026/03/13/golf-betting-games-how-to-play-snake-rules-44859/
//  Golf Games Hub, "How to play the Snake golf game" https://www.golfgameshub.com/snake-golf-game/ (fixed amount and doubling)
// When two players three-putt the same hole, the last to do it takes the snake; the scorekeeper taps
// them in the order they happened.

/**
 * What the snake is worth after `count` three-putts: fixed, growing by the stake, or doubling.
 * `cap` is the most doubles a doubling snake makes; 0 or unset means no cap.
 */
export function snakeValue(count, stake, growth = 'flat', cap = 0) {
  if (!count) return 0;
  if (growth === 'grow') return stake * count;
  if (growth === 'double') return stake * 2 ** (cap > 0 ? Math.min(count - 1, cap) : count - 1);
  return stake;
}

/**
 * Who holds the snake through a run of holes. rows: [{ putts: [pid, ...] in the order they happened,
 * or undefined for a hole not played }]. Returns { holder, count, history: [holder after each hole] }.
 */
export function snakeHolder(rows) {
  let holder = null, count = 0;
  const history = [];
  for (const r of rows) {
    const putts = r.putts || [];
    // A four-putt (r.fours, under that house rule) adds one more on top of its three-putt
    if (putts.length) { holder = putts.at(-1); count += putts.length + (r.fours?.length || 0); }
    history.push(holder);
  }
  return { holder, count, history };
}

// ---------------------------------------------------------------------------
// Hammer
// ---------------------------------------------------------------------------
// Published rules: a hole-by-hole match for two players or two teams. At any point on a hole a side
// can "hammer" to double the hole's value. The other side accepts and plays on at double, or concedes
// the hole at the value before the hammer. A side can't hammer twice in a row: the other side has to
// hammer back first. Groups agree a cap before the first tee.
// Sources, checked 2026-09-27:
//  Great Games for Golfers, "Hammer" https://greatgamesforgolfers.com/golf-games/hammer/ (alternation, forfeit at the old bet)
//  Golf Games Hub, "How to play Hammer golf" https://www.golfgameshub.com/how-to-play-hammer-golf-betting-game/ (either side throws first, set a ceiling)
//  Golf Digest, "How to play Hammer" https://www.golfdigest.com/story/how-to-play-hammer-golf-game-explained
// House options here: the most hammers on one hole (0 means no limit), and who throws the first hammer
// on a hole: either side, or only the side behind in the Hammer money (either when level).

/**
 * Whether `side` (0 or 1) may hammer now. `hammers` is the list of sides that have hammered this hole,
 * in order; `behind` is the side behind before this hole (null when level).
 */
export function canHammer(hammers, side, { max = 3, who = 'either', behind = null, conceded = null } = {}) {
  if (conceded != null) return false;
  if (max && hammers.length >= max) return false;
  if (hammers.length) return hammers.at(-1) !== side;
  return who === 'trailing' && behind != null ? side === behind : true;
}

/**
 * One Hammer hole. `mark` is { hammers: [side, ...], conceded: side | null }, `winner` the match-play
 * result from the scores (0, 1, null halved, undefined not played). Returns { winner, value, hammers, conceded }:
 * `value` is what each player on the losing side pays (before the uneven-sides split).
 */
export function hammerHole(mark, winner, base) {
  const hammers = mark?.hammers || [];
  const conceded = mark?.conceded ?? null;
  // Conceding turns down the last hammer, so the hole goes at the value before it
  if (conceded != null && hammers.length && hammers.at(-1) !== conceded) {
    return { winner: 1 - conceded, value: base * 2 ** (hammers.length - 1), hammers, conceded };
  }
  if (winner === undefined) return { winner: undefined, value: 0, hammers, conceded: null };
  return { winner, value: winner == null ? 0 : base * 2 ** hammers.length, hammers, conceded: null };
}

// ---------------------------------------------------------------------------
// Birdie pot (a side game)
// ---------------------------------------------------------------------------
// Each player in the pot puts in the stake. Every net birdie is one share and a net eagle or better
// is `eagleShares` (2 by default), and the pot is split by shares. With no birdies nobody pays.
// Both rules sit in DEFAULT_SETTINGS.birdies so they are easy to change (flagged for Trevor, 2026-09-29).

/** Shares one player earns for a net score on a hole: 1 for a birdie, `eagleShares` for an eagle or better. */
export function birdieShares(net, par, eagleShares = 2) {
  if (net == null) return 0;
  if (net <= par - 2) return eagleShares;
  return net === par - 1 ? 1 : 0;
}

/**
 * Money from a birdie pot. `shares` is { pid: shares } for everyone in the pot. Everyone puts in
 * `stake` and the pot is split by shares; no shares at all means nobody pays. Whole cents, summing to zero.
 */
export function birdiePot(shares, stake) {
  const ids = Object.keys(shares);
  const out = Object.fromEntries(ids.map(id => [id, 0]));
  const total = ids.reduce((a, id) => a + (shares[id] || 0), 0);
  if (!total || ids.length < 2 || !stake) return out;
  const pot = stake * ids.length;
  for (const id of ids) out[id] = pot * (shares[id] || 0) / total - stake;
  return roundCents(out);
}
