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
 * Playing handicaps off the low player: the best player plays off 0 and everyone
 * else gets the difference, scaled by `pct` (100 = full difference).
 */
export function strokesOffLow(courseHcs, pct = 100) {
  const known = courseHcs.map(h => (h == null ? 0 : h));
  const low = Math.min(...known);
  return known.map(h => Math.round((h - low) * (pct / 100)));
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
 * opts = { ties: 'push' | 'banker' }
 * Returns { deltas: {pid: $}, matchups: [{pid, amount, result: 'win'|'loss'|'push'}] }
 */
export function settleBankerHole(hole, net, playerIds, opts = {}) {
  const ties = opts.ties || 'push';
  const deltas = Object.fromEntries(playerIds.map(id => [id, 0]));
  const matchups = [];
  const b = hole.banker;
  for (const pid of playerIds) {
    if (pid === b) continue;
    const bet = hole.bets?.[pid] || 0;
    const mult = hole.doubled?.[pid] ? (hole.doubleBack ? 4 : 2) : 1;
    const amount = bet * mult;
    let result;
    if (net[pid] < net[b]) result = 'win';
    else if (net[pid] > net[b]) result = 'loss';
    else result = ties === 'banker' ? 'loss' : 'push';
    if (result === 'win') { deltas[pid] += amount; deltas[b] -= amount; }
    if (result === 'loss') { deltas[pid] -= amount; deltas[b] += amount; }
    matchups.push({ pid, amount, mult, result });
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
    bets.push({ key: 'p' + p.id, id: p.id, leg: p.leg, start: p.start, end: l.end, amount: p.amount ?? amounts[p.leg], press: true, by: p.by });
  }
  return bets.map(b => ({ ...b, status: matchStatus(winners, b.start, b.end) }));
}

/**
 * Presses that are allowed before playing `nextHole`: the trailing player may press the
 * most recent bet on a leg when it is `threshold` or more down and holes remain in the leg.
 */
export function pressOpportunities(winners, presses, amounts, nextHole, threshold = 2, legs = LEGS) {
  const bets = nassauBets(winners, presses, amounts, legs);
  const out = [];
  for (const leg of Object.keys(legs)) {
    const l = legs[leg];
    if (nextHole < l.start || nextHole > l.end) continue;
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
