// Round model: creating a round and deriving everything (strokes, nets, money) from it.
import {
  courseHandicap, strokesOffLow, strokesOnHole, rankHoles, pickupGross,
  settleBankerHole, bankerFor, holeWinner, nassauResult, pressOpportunities, minimalTransfers,
} from './golf.js';

export const GAMES = {
  banker: {
    name: 'Banker', min: 3, max: 8, holes: [9, 18],
    blurb: 'Rotating banker takes on everyone each hole',
    players: '3–8 players',
  },
  nassau: {
    name: 'Nassau', min: 2, max: 2, holes: [18],
    blurb: 'Front 9, back 9 and total — three bets in one',
    players: '2 players',
  },
  skins: {
    name: 'Skins', min: 2, max: 8, holes: [9, 18],
    blurb: 'Win a hole outright to take the skin',
    players: '2–8 players',
  },
  wolf: {
    name: 'Wolf', min: 4, max: 4, holes: [9, 18],
    blurb: 'Pick a partner each hole — or go it alone',
    players: '4 players exactly',
  },
};

/** Course par for a set of holes. */
export function parOf(holes) { return holes.reduce((a, h) => a + (h.par || 0), 0); }

/**
 * The holes a round will play, in playing order.
 * Each: { no, courseIdx, par, hdcp, yards: {teeName: y} }
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
    const yards = {};
    for (const t of course.tees || []) yards[t.name] = t.yards?.[idx] ?? null;
    return { no, courseIdx: idx, par: h.par, hdcp, yards };
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

/** Build a new round object from wizard selections. */
export function createRound({ id, game, course, holesCount, nine, startHole, players, settings, hcPct, useHandicaps = true }) {
  const holes = holesInPlay(course, holesCount, nine, startHole);
  const par = parOf(holes);
  const withHc = players.map(p => {
    const tee = course.tees?.find(t => t.name === p.tee) || course.tees?.[0] || null;
    const courseHc = effectiveCourseHc(p.index, tee, course, holes, holesCount, p.courseHcOverride).value;
    return { id: p.id, name: p.name, tee: tee?.name ?? null, index: p.index ?? null, courseHc };
  });
  const plays = useHandicaps ? strokesOffLow(withHc.map(p => p.courseHc), hcPct) : withHc.map(() => 0);
  return {
    id, game, status: 'active',
    createdAt: Date.now(), finishedAt: null,
    course: { id: course.id, name: course.name, city: course.city, tees: course.tees?.map(t => ({ name: t.name, color: t.color })) || [] },
    holesCount, nine: holesCount === 9 && course.holes.length === 18 ? nine : null,
    holes, par,
    useHandicaps, hcPct,
    players: withHc.map((p, i) => ({ ...p, plays: plays[i] })),
    settings: structuredClone(settings),
    scores: {},      // holeNo -> { pid: gross | 'X' }
    banker: {},      // holeNo -> { banker, bets, doubled, doubleBack }
    wolf: {},        // holeNo -> { wolf, partner: pid | null (lone) }
    presses: [],
    pressSeq: 0,
    current: 0,      // index into holes
  };
}

export function strokesFor(round, player, hole) {
  return strokesOnHole(player.plays, hole.rank, round.holes.length);
}

/** Effective gross (pickups → net double bogey) and net for a player on a hole. */
export function netFor(round, player, hole) {
  const g = round.scores[hole.no]?.[player.id];
  if (g == null) return null;
  const st = strokesFor(round, player, hole);
  const gross = g === 'X' ? pickupGross(hole.par, st) : g;
  return gross - st;
}

export function holeComplete(round, hole) {
  const s = round.scores[hole.no];
  return !!s && round.players.every(p => s[p.id] != null);
}

export function holesPlayed(round) {
  return round.holes.filter(h => holeComplete(round, h));
}

// --------------------------- Banker ---------------------------------------

export function bankerHoleSetup(round, idx) {
  const hole = round.holes[idx];
  const existing = round.banker[hole.no];
  if (existing) return existing;
  const ids = round.players.map(p => p.id);
  const s = round.settings.banker;
  const prevHole = round.holes[idx - 1];
  const prev = prevHole && round.banker[prevHole.no];
  let banker;
  if (s.rotation === 'choice' && prev) banker = prev.banker;
  else banker = bankerFor(s.rotation, idx, ids, s.firstBanker || 0);
  const bets = {};
  for (const id of ids) if (id !== banker) bets[id] = prev?.bets?.[id] ?? s.defaultBet;
  return { banker, bets, doubled: {}, doubleBack: false };
}

// --------------------------- Nassau ---------------------------------------

export function nassauWinners(round) {
  const [a, b] = round.players;
  const w = {};
  for (const h of round.holes) {
    const r = holeWinner(netFor(round, a, h), netFor(round, b, h));
    if (r !== undefined) w[h.no] = r;
  }
  return w;
}

export function nassauAmounts(round) {
  const n = round.settings.nassau;
  return { front: n.front, back: n.back, total: n.total };
}

export function nassauPressOptions(round, nextHoleNo) {
  if (round.settings.nassau.pressMode === 'off') return [];
  return pressOpportunities(nassauWinners(round), round.presses, nassauAmounts(round), nextHoleNo, round.settings.nassau.threshold);
}

// --------------------------- Skins ----------------------------------------

export function skinsTable(round) {
  const value = round.settings.skins.value;
  const carry = round.settings.skins.carryover;
  let pot = 1;
  const rows = [];
  for (const h of round.holes) {
    if (!holeComplete(round, h)) { rows.push({ hole: h, winner: undefined, skins: 0, pot }); continue; }
    const nets = round.players.map(p => [p.id, netFor(round, p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    const lows = nets.filter(n => n[1] === low);
    if (lows.length === 1) { rows.push({ hole: h, winner: lows[0][0], skins: pot, pot }); pot = 1; }
    else { rows.push({ hole: h, winner: null, skins: 0, pot }); pot = carry ? pot + 1 : 1; }
  }
  return { rows, value, unclaimed: pot > 1 ? pot - 1 : 0 };
}

// --------------------------- Wolf -----------------------------------------

export function wolfFor(round, idx) {
  return round.players[idx % round.players.length].id;
}

export function wolfHoleResult(round, hole) {
  const setup = round.wolf[hole.no];
  if (!setup || !holeComplete(round, hole)) return null;
  const P = round.settings.wolf.point;
  const mult = round.settings.wolf.loneMultiplier;
  const ids = round.players.map(p => p.id);
  const net = Object.fromEntries(round.players.map(p => [p.id, netFor(round, p, hole)]));
  const teamA = setup.partner ? [setup.wolf, setup.partner] : [setup.wolf];
  const teamB = ids.filter(id => !teamA.includes(id));
  const best = t => Math.min(...t.map(id => net[id]));
  const a = best(teamA), b = best(teamB);
  const deltas = Object.fromEntries(ids.map(id => [id, 0]));
  if (a === b) return { deltas, winner: null, teamA, teamB };
  const winners = a < b ? teamA : teamB, losers = a < b ? teamB : teamA;
  const unit = setup.partner ? P : P * mult;
  // Every loser pays every winner one unit
  for (const w of winners) for (const l of losers) { deltas[w] += unit; deltas[l] -= unit; }
  return { deltas, winner: a < b ? 'wolf' : 'pack', teamA, teamB };
}

// --------------------------- Results --------------------------------------

/** Money by player id plus game-specific detail. Works on partial rounds too. */
export function roundResults(round) {
  const ids = round.players.map(p => p.id);
  const balances = Object.fromEntries(ids.map(id => [id, 0]));
  const detail = {};

  if (round.game === 'banker') {
    detail.holes = [];
    round.holes.forEach(h => {
      const setup = round.banker[h.no];
      if (!setup || !holeComplete(round, h)) return;
      const net = Object.fromEntries(round.players.map(p => [p.id, netFor(round, p, h)]));
      const r = settleBankerHole(setup, net, ids, { ties: round.settings.banker.ties });
      for (const id of ids) balances[id] += r.deltas[id];
      detail.holes.push({ no: h.no, banker: setup.banker, ...r });
    });
  }

  if (round.game === 'nassau') {
    const res = nassauResult(nassauWinners(round), round.presses, nassauAmounts(round));
    balances[ids[0]] = res.net; balances[ids[1]] = -res.net;
    detail.lines = res.lines;
  }

  if (round.game === 'skins') {
    const t = skinsTable(round);
    const n = ids.length;
    for (const r of t.rows) {
      if (!r.winner) continue;
      for (const id of ids) {
        if (id === r.winner) balances[id] += r.skins * t.value * (n - 1);
        else balances[id] -= r.skins * t.value;
      }
    }
    detail.skins = t;
  }

  if (round.game === 'wolf') {
    detail.holes = [];
    for (const h of round.holes) {
      const r = wolfHoleResult(round, h);
      if (!r) continue;
      for (const id of ids) balances[id] += r.deltas[id];
      detail.holes.push({ no: h.no, ...r });
    }
  }

  const standings = [...round.players]
    .map(p => ({ ...p, amount: balances[p.id] }))
    .sort((a, b) => b.amount - a.amount);
  return { balances, standings, transfers: minimalTransfers(balances), detail };
}

/** Gross totals + counts for stats. */
export function scoreSummary(round, pid) {
  let gross = 0, played = 0, birdies = 0, eagles = 0, pars = 0;
  for (const h of round.holes) {
    const g = round.scores[h.no]?.[pid];
    if (g == null) continue;
    const p = round.players.find(x => x.id === pid);
    const eff = g === 'X' ? pickupGross(h.par, strokesFor(round, p, h)) : g;
    gross += eff; played++;
    if (g !== 'X') {
      if (eff - h.par <= -2) eagles++;
      else if (eff - h.par === -1) birdies++;
      else if (eff === h.par) pars++;
    }
  }
  return { gross, played, birdies, eagles, pars };
}
