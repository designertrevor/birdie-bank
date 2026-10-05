// Pure golf + betting maths. No DOM, no storage. Everything here is unit tested.

// ---------------------------------------------------------------------------
// Handicaps
// ---------------------------------------------------------------------------

/** WHS course handicap. Returns null when the tee has no rating/slope. */
export function courseHandicap(index, tee, par, holesPlayed = 18) {
  if (index == null || !tee || tee.rating == null || tee.slope == null) return null;
  if (holesPlayed === 9) {
    // 9-hole: half the index against the 9-hole rating (half the 18-hole rating when no 9-hole rating exists)
    const rating9 = tee.rating / 2;
    return Math.round((index / 2) * (tee.slope / 113) + (rating9 - par));
  }
  return Math.round(index * (tee.slope / 113) + (tee.rating - par));
}

/**
 * Playing handicaps off the low player. As in WHS, the allowance `pct` is applied to each
 * player's course handicap first and rounded (a playing handicap), then the best player plays
 * off 0 and everyone else gets the difference. At 90%, 17 and 4 play off 15 and 4: 11 strokes.
 */
export function strokesOffLow(courseHcs, pct = 100) {
  const playing = courseHcs.map(h => (h == null ? 0 : Math.round(h * (pct / 100))));
  const low = Math.min(...playing);
  return playing.map(h => h - low);
}

/**
 * Strokes a player receives on one hole.
 * `rank` is the hole's difficulty rank within the holes being played (1 = hardest),
 * `n` is how many holes are being played (9 or 18). Handles plus handicaps (negative).
 */
export function strokesOnHole(playingHc, rank, n = 18) {
  if (!playingHc) return 0;
  if (playingHc > 0) {
    return Math.floor(playingHc / n) + (rank <= playingHc % n ? 1 : 0);
  }
  // Plus handicap: gives strokes back, starting on the easiest hole
  const give = -playingHc;
  return -(Math.floor(give / n) + (n + 1 - rank <= give % n ? 1 : 0)) || 0;
}

/** Rank the handicap values of the holes in play to 1..n (1 = hardest). */
export function rankHoles(hdcps) {
  const order = hdcps.map((h, i) => [h ?? 99, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(hdcps.length);
  order.forEach(([, i], r) => { ranks[i] = r + 1; });
  return ranks;
}

/** Score used for maths when a player picks up: net double bogey. */
export function pickupGross(par, strokes) {
  return par + 2 + Math.max(0, strokes);
}

// ---------------------------------------------------------------------------
// Banker
// ---------------------------------------------------------------------------

/**
 * Settle one Banker hole.
 * hole = { banker, bets: {pid: $}, doubled: {pid: bool}, doubleBack: bool }
 * net  = { pid: netScore }
 * opts = { ties: 'push' | 'banker', birdies: 'off' | 'gross' | 'net', gross: {pid: score or 'X'}, par }
 * With birdies on, the winner's birdie doubles that bet and an eagle (or better) doubles it again,
 * on top of any doubles. 'gross' counts only a real birdie; 'net' counts one after strokes.
 * House rule `par3Triple` (off unless the round says so, added 2026-10-03): on a par 3 a press triples
 * the bet instead of doubling it, and the banker's press back triples it again (9×). Source, checked
 * 2026-10-03: The Fried Egg, "Banker golf betting game" https://thefriedegg.com/banker-golf-betting-game/
 * ("the presses and represses triple the bet instead of double").
 * Returns { deltas: {pid: $}, matchups: [{pid, amount, mult, birdie, result: 'win'|'loss'|'push'}] }
 */
export function birdieMultiplier(score, par) {
  if (typeof score !== 'number' || !par) return 1;
  const under = par - score;
  return under >= 2 ? 4 : under === 1 ? 2 : 1;
}

export function settleBankerHole(hole, net, playerIds, opts = {}) {
  const ties = opts.ties || 'push';
  const birdies = opts.birdies && opts.birdies !== 'off' ? opts.birdies : null;
  // The score a birdie is judged on: the real one, or after strokes
  const birdieOf = pid => (!birdies ? 1 : birdieMultiplier(birdies === 'net' ? net[pid] : opts.gross?.[pid], opts.par));
  const deltas = Object.fromEntries(playerIds.map(id => [id, 0]));
  const matchups = [];
  const b = hole.banker;
  for (const pid of playerIds) {
    if (pid === b) continue;
    const bet = hole.bets?.[pid] || 0;
    const f = opts.par3Triple && opts.par === 3 ? 3 : 2;
    // House rule "the banker presses everyone" (pressAll, off unless the round says so, added
    // 2026-10-05): the banker's press back doubles every bet, the ones nobody pressed too. Sources,
    // checked 2026-10-05: The Fried Egg, "Banker" https://thefriedegg.com/banker-golf-betting-game/ and
    // Golf Digest https://www.golfdigest.com/story/how-to-play-banker-golf-games-explained ("he must press
    // everyone, not just whoever pressed him")
    const mult = hole.doubled?.[pid] ? (hole.doubleBack ? f * f : f) : hole.doubleBack && opts.pressAll ? f : 1;
    let result;
    if (net[pid] < net[b]) result = 'win';
    else if (net[pid] > net[b]) result = 'loss';
    else result = ties === 'banker' ? 'loss' : 'push';
    // Only the winner's birdie counts: a birdie that halves or loses the hole pays nothing extra
    const birdie = result === 'win' ? birdieOf(pid) : result === 'loss' && net[pid] !== net[b] ? birdieOf(b) : 1;
    const amount = bet * mult * birdie;
    if (result === 'win') { deltas[pid] += amount; deltas[b] -= amount; }
    if (result === 'loss') { deltas[pid] -= amount; deltas[b] += amount; }
    matchups.push({ pid, amount, mult, birdie, result });
  }
  return { deltas, matchups };
}

/** Banker for a given hole index under a rotation mode. */
export function bankerFor(mode, idx, playerIds, firstBanker = 0) {
  const n = playerIds.length;
  if (mode === 'fixed') return playerIds[firstBanker % n];
  if (mode === 'nine') return playerIds[(firstBanker + Math.floor(idx / 9)) % n];
  return playerIds[(firstBanker + idx) % n]; // 'rotate' (and default for 'choice')
}

// ---------------------------------------------------------------------------
// Nassau (2 players, match play, 18 holes)
// ---------------------------------------------------------------------------

/**
 * Nassau legs by playing position (1 = first hole played). 18 holes: front 9 / back 9 / total.
 * 9 holes: first 4 / last 5 / all 9.
 */
export function nassauLegs(n = 18) {
  const half = n === 18 ? 9 : Math.floor(n / 2);
  return n === 18
    ? { front: { start: 1, end: 9, label: 'Front 9' }, back: { start: 10, end: 18, label: 'Back 9' }, total: { start: 1, end: 18, label: 'Total' } }
    : { front: { start: 1, end: half, label: `First ${half}` }, back: { start: half + 1, end: n, label: `Last ${n - half}` }, total: { start: 1, end: n, label: `All ${n}` } };
}
export const LEGS = nassauLegs(18);

/** Hole winner from nets: 0, 1 or null (halved). Missing score = not played yet. */
export function holeWinner(n0, n1) {
  if (n0 == null || n1 == null) return undefined;
  return n0 < n1 ? 0 : n1 < n0 ? 1 : null;
}

/** Status of a match over [start,end] given winners by hole number. */
export function matchStatus(winners, start, end) {
  let w0 = 0, w1 = 0, played = 0;
  for (let h = start; h <= end; h++) {
    const w = winners[h];
    if (w === undefined) continue;
    played++;
    if (w === 0) w0++; else if (w === 1) w1++;
  }
  const diff = w0 - w1;
  const left = end - start + 1 - played;
  return {
    leader: diff > 0 ? 0 : diff < 0 ? 1 : null,
    by: Math.abs(diff),
    played, left,
    // Match can't be caught
    closed: Math.abs(diff) > left,
    dormie: Math.abs(diff) === left && left > 0,
    done: left === 0 || Math.abs(diff) > left,
  };
}

/**
 * Compute presses automatically / validate manual presses.
 * Presses: [{ id, leg, start, by: 0|1 (who pressed) }]
 * A press runs from `start` to the end of its leg.
 * Returns bets list: original legs + presses, each with its status.
 */
export function nassauBets(winners, presses, amounts, legs = LEGS) {
  const bets = Object.entries(legs).map(([leg, l]) => ({
    key: leg, leg, start: l.start, end: l.end, amount: amounts[leg], press: false,
  }));
  for (const p of presses) {
    const l = legs[p.leg];
    // A press on a leg this layout doesn't have (never made by the app) is skipped rather than crash the card
    if (!l) continue;
    bets.push({ key: 'p' + p.id, id: p.id, leg: p.leg, start: p.start, end: l.end, amount: p.amount ?? amounts[p.leg], press: true, by: p.by, ...(p.bye ? { bye: true } : {}) });
  }
  return bets.map(b => ({ ...b, status: matchStatus(winners, b.start, b.end) }));
}

/**
 * Presses that are allowed before playing `nextHole`: the trailing player may press the
 * most recent bet on a leg when it is `threshold` or more down and holes remain in the leg.
 * House rules (opts), both common in published Nassau rules:
 *  • `noLast`: no press can start on a leg's last hole (the 9th or 18th), since a one-hole bet is a coin flip.
 *  • `turn`: at the turn, the side that lost the front nine may press the back nine, however far down.
 *    It's a new bet on the back for the back's amount (the same as doubling it).
 * Sources, checked 2026-09-27: Stick Golf, "How to play Nassau" https://stickapp.golf/games/nassau/
 * ("no press on the last hole" is nearly universal) and Wikipedia, "Nassau (bet)" https://en.wikipedia.org/wiki/Nassau_(bet).
 * `only` limits the result to the regular presses ('regular') or the turn press ('turn').
 */
export function pressOpportunities(winners, presses, amounts, nextHole, threshold = 2, legs = LEGS, opts = {}) {
  const { noLast = false, turn = false, only = null } = opts;
  const bets = nassauBets(winners, presses, amounts, legs);
  const out = [];
  if (turn && only !== 'regular' && legs.back && legs.front && nextHole === legs.back.start) {
    const front = bets.find(b => b.key === 'front')?.status;
    if (front?.done && front.leader != null && !presses.some(p => p.leg === 'back' && p.start === nextHole)) {
      out.push({ leg: 'back', trailing: 1 - front.leader, by: front.by, turn: true });
    }
  }
  if (only === 'turn') return out;
  for (const leg of Object.keys(legs)) {
    const l = legs[leg];
    if (nextHole < l.start || nextHole > l.end) continue;
    if (noLast && nextHole === l.end) continue;
    const onLeg = bets.filter(b => b.leg === leg && b.start < nextHole);
    if (!onLeg.length) continue;
    const latest = onLeg[onLeg.length - 1];
    const s = latest.status;
    if (s.leader === null || s.by < threshold || s.done) continue;
    if (presses.some(p => p.leg === leg && p.start === nextHole)) continue;
    out.push({ leg, trailing: 1 - s.leader, by: s.by });
  }
  return out;
}

/**
 * The bye (house rule `bye`, off unless the round says so, added 2026-10-05): once a leg is closed out
 * with holes to play (3&2), those holes are a new bet of their own, worth all of the leg's bet ('full')
 * or half of it ('half'). Played like a press with no presser: [{ id, leg, start, amount, bye: true }],
 * one for each leg closed early, in the shape nassauBets takes. A bye is never closed out into another.
 * Source, checked 2026-10-05: Golf Compendium, "The Bye golf bet explained"
 * https://golfcompendium.com/2021/09/bye-golf-bet.html ("typically is worth half the original bet")
 */
export function byeBets(winners, amounts, legs = LEGS, mode = 'off') {
  if (mode !== 'half' && mode !== 'full') return [];
  const out = [];
  for (const [leg, l] of Object.entries(legs)) {
    for (let pos = l.start; pos < l.end; pos++) {
      if (winners[pos] === undefined) continue;
      const part = Object.fromEntries(Object.entries(winners).filter(([k]) => Number(k) <= pos));
      if (!matchStatus(part, l.start, l.end).closed) continue;
      const amount = (amounts[leg] || 0) * (mode === 'half' ? 0.5 : 1);
      if (amount) out.push({ id: `bye-${leg}`, leg, start: pos + 1, amount, by: null, bye: true });
      break;
    }
  }
  return out;
}

/**
 * Automatic presses inside one match run from `start` to `end`: whenever the newest bet on it is
 * `threshold` or more down after a hole, a press starts on the next hole (and a press that falls that far
 * behind is pressed again). Positions of each press's first hole, in order. Used by Sixes' "Auto press"
 * house rule (2026-10-05), where each six-hole match is its own leg.
 */
export function autoPressStarts(winners, start, end, threshold = 2) {
  const starts = [];
  let latest = start;
  for (let pos = start; pos < end; pos++) {
    if (winners[pos] === undefined) continue;
    const part = Object.fromEntries(Object.entries(winners).filter(([k]) => Number(k) <= pos));
    const s = matchStatus(part, latest, end);
    if (s.leader != null && s.by >= threshold && !s.closed) { starts.push(pos + 1); latest = pos + 1; }
  }
  return starts;
}

/** Money result for player 0 (positive = player 0 wins) plus per-bet breakdown. */
export function nassauResult(winners, presses, amounts, legs = LEGS) {
  const bets = nassauBets(winners, presses, amounts, legs);
  let net = 0;
  const lines = bets.map(b => {
    const s = b.status;
    const value = s.leader === null ? 0 : (s.leader === 0 ? b.amount : -b.amount);
    net += value;
    return { ...b, value };
  });
  return { net, lines };
}

// ---------------------------------------------------------------------------
// Settling up
// ---------------------------------------------------------------------------

/** Fewest payments that settle a set of balances ({pid: +won / -lost}). */
export function minimalTransfers(balances) {
  const cents = Object.entries(balances).map(([id, v]) => [id, Math.round(v * 100)]);
  const creditors = cents.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const debtors = cents.filter(([, v]) => v < 0).map(([id, v]) => [id, -v]).sort((a, b) => b[1] - a[1]);
  const out = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i][1], creditors[j][1]);
    if (pay > 0) out.push({ from: debtors[i][0], to: creditors[j][0], amount: pay / 100 });
    debtors[i][1] -= pay; creditors[j][1] -= pay;
    if (!debtors[i][1]) i++;
    if (!creditors[j][1]) j++;
  }
  return out;
}

export function money(v, { sign = false } = {}) {
  const abs = Math.abs(v);
  const s = Number.isInteger(abs) ? String(abs) : abs.toFixed(2);
  if (!sign) return (v < 0 ? '−' : '') + '$' + s;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + s;
}

export function scoreName(gross, par) {
  const d = gross - par;
  if (gross === 1) return 'Hole in one';
  if (d <= -3) return 'Albatross';
  if (d === -2) return 'Eagle';
  if (d === -1) return 'Birdie';
  if (d === 0) return 'Par';
  if (d === 1) return 'Bogey';
  if (d === 2) return 'Double';
  return '+' + d;
}

/** "net birdie" for a net score: named by strokes to par only (a net 1 isn't a hole in one). */
const NET_NAMES = { '-2': 'eagle', '-1': 'birdie', 0: 'par', 1: 'bogey', 2: 'double' };
export function netScoreName(net, par) {
  // With half strokes (allowances.js) a net can land between names: "net 4½"
  if (!Number.isInteger(net)) return `net ${Math.floor(net) || ''}½`;
  const d = net - par;
  return 'net ' + (NET_NAMES[d] || (d < 0 ? 'albatross' : `+${d}`));
}
