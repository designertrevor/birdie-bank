// Round model: creating a round and deriving everything (strokes, nets, money) from it.
import {
  courseHandicap, strokesOffLow, strokesOnHole, rankHoles, pickupGross,
  settleBankerHole, bankerFor, holeWinner, nassauResult, pressOpportunities, minimalTransfers, nassauLegs, matchStatus,
} from './golf.js';
import {
  bestBall, sideSplit, vegasHole, sixesPairings, sixesSegments, stablefordPoints, quotaPoints, quotaFor, ninesPoints,
  acesDeuces, pointsToMoney, settleTotals, scrambleTeamHandicap, rabbitHolder, scoreDots, DOT_KINDS,
} from './games.js';

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
    players: '2–8 players · 1 v 1, 2 v 2, 1 v 2, 1 v 3…', icon: 'sword', group: 'Head to head',
  },
  vegas: {
    name: 'Vegas', min: 4, max: 4, holes: [9, 18], teams: { count: 2, size: 2 },
    blurb: 'Pair up scores into a number: 4 and 5 make 45',
    players: '4 players · 2 v 2', icon: 'dice-five', group: 'Head to head',
  },
  sixes: {
    name: 'Sixes', min: 4, max: 4, holes: [9, 18], order: true,
    blurb: 'Partners rotate every six holes: Hollywood, round robin',
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
    players: '2–8 players', icon: 'list-numbers', group: 'Totals',
  },
  stableford: {
    name: 'Stableford', min: 2, max: 8, holes: [9, 18],
    blurb: 'Points for every hole. A blow-up only costs you a zero',
    players: '2–8 players', icon: 'star', group: 'Totals',
  },
  quota: {
    name: 'Quota', min: 2, max: 8, holes: [9, 18],
    blurb: 'Beat your own number: 36 minus your handicap',
    players: '2–8 players', icon: 'target', group: 'Totals',
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
};

export const GAME_GROUPS = ['Classics', 'Head to head', 'Team', 'Totals', 'Points'];

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
export function createRound({ id, game, course, holesCount, nine, startHole, players, settings, hcPct, useHandicaps = true, teams = null }) {
  const holes = holesInPlay(course, holesCount, nine, startHole);
  const par = parOf(holes);
  const withHc = players.map(p => {
    const tee = course.tees?.find(t => t.name === p.tee) || course.tees?.[0] || null;
    const courseHc = effectiveCourseHc(p.index, tee, course, holes, holesCount, p.courseHcOverride).value;
    return { id: p.id, name: p.name, tee: tee?.name ?? null, index: p.index ?? null, courseHc, courseHcOverride: p.courseHcOverride ?? null };
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
    wolf: {},        // holeNo -> { wolf, partner: pid | null (lone) }
    marks: {},       // holeNo -> game-specific extras (dots, bingo bango bongo)
    presses: [],
    pressSeq: 0,
    current: 0,      // index into holes
  };
  if (teams?.length) round.teams = withTeamHandicaps(round, buildTeams(teams, full), full, useHandicaps, hcPct);
  return round;
}

/**
 * Who has a score box on each hole: the players, or the teams in a scramble.
 * Each: { id, name, plays, team?: true }.
 */
export function scorers(round) {
  if (round.game === 'scramble' && round.teams) return round.teams.map(t => ({ id: t.id, name: t.name, plays: t.plays || 0, courseHc: t.courseHc, team: true, players: t.players }));
  return round.players;
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

export function resizeRound(round, course, holesCount, nine = 'front') {
  if (holesCount === round.holesCount) return round;
  const holes = resizedHoles(round, course, holesCount, nine);
  const ratio = holesCount / round.holesCount;
  const players = round.players.map(p => {
    const tee = course.tees?.find(t => t.name === p.tee) || null;
    // A figure set by hand (stored, or, on older rounds, one that doesn't match the formula) is scaled
    const was = effectiveCourseHc(p.index, tee, course, round.holes, round.holesCount, null).value;
    const override = p.courseHcOverride ?? (was === p.courseHc ? null : p.courseHc);
    if (override != null) {
      const v = Math.round(override * ratio);
      return { ...p, courseHc: v, courseHcOverride: v };
    }
    return { ...p, courseHc: effectiveCourseHc(p.index, tee, course, holes, holesCount, null).value, courseHcOverride: null };
  });
  const plays = round.useHandicaps ? strokesOffLow(players.map(p => p.courseHc), round.hcPct) : players.map(() => 0);
  const full = players.map((p, i) => ({ ...p, plays: plays[i] }));
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

/** Holes with scores that would stop counting if the round were resized to `holes`. */
export function scoredHolesDropped(round, holes) {
  return round.holes.filter(h => !holes.some(n => n.no === h.no) && Object.values(round.scores[h.no] || {}).some(v => v != null));
}

export function strokesFor(round, player, hole) {
  return strokesOnHole(player.plays, hole.rank, round.holes.length);
}

/** Effective gross (pickups → net double bogey) for a scorer on a hole, or null. */
export function grossFor(round, player, hole) {
  const g = round.scores[hole.no]?.[player.id];
  if (g == null) return null;
  return g === 'X' ? pickupGross(hole.par, strokesFor(round, player, hole)) : g;
}

/** Effective gross (pickups → net double bogey) and net for a scorer on a hole. */
export function netFor(round, player, hole) {
  const gross = grossFor(round, player, hole);
  if (gross == null) return null;
  return gross - strokesFor(round, player, hole);
}

export function holeComplete(round, hole) {
  const s = round.scores[hole.no];
  return !!s && scorers(round).every(p => s[p.id] != null);
}

export function holesPlayed(round) {
  return round.holes.filter(h => holeComplete(round, h));
}

const playerById = (round, pid) => round.players.find(p => p.id === pid);

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

// --------------------------- Nassau & match play ---------------------------

/** Best-ball net of a side (array of player ids) on a hole; null until everyone has scored. */
export function sideNet(round, side, hole) {
  return bestBall(side.map(pid => netFor(round, playerById(round, pid), hole)));
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

export function nassauAmounts(round) {
  if (round.game === 'match') return { match: round.settings.match.stake };
  const n = round.settings.nassau;
  return { front: n.front, back: n.back, total: n.total };
}

function pressSettings(round) {
  return round.game === 'match' ? round.settings.match : round.settings.nassau;
}

/** Press options before playing the hole at position `nextHoleNo` (1-based). */
export function nassauPressOptions(round, nextHoleNo) {
  const s = pressSettings(round);
  if (!s || s.pressMode === 'off') return [];
  return pressOpportunities(nassauWinners(round), round.presses, nassauAmounts(round), nextHoleNo, s.threshold, roundLegs(round));
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

// --------------------------- Vegas ----------------------------------------

/** Vegas hole by hole: [{ hole, numbers, diff, flipped, deltas }] for scored holes. */
export function vegasTable(round) {
  const teams = round.teams || [];
  const point = round.settings.vegas.point;
  const rows = [];
  for (const h of round.holes) {
    if (!holeComplete(round, h) || teams.length !== 2) { rows.push({ hole: h, played: false }); continue; }
    const nets = teams.map(t => t.players.map(pid => netFor(round, playerById(round, pid), h)));
    const gross = teams.map(t => t.players.map(pid => round.scores[h.no]?.[pid]));
    const r = vegasHole(nets, gross, h.par, { birdieFlip: round.settings.vegas.birdieFlip });
    const deltas = {};
    teams[0].players.forEach(pid => { deltas[pid] = r.diff * point; });
    teams[1].players.forEach(pid => { deltas[pid] = -r.diff * point; });
    rows.push({ hole: h, played: true, ...r, deltas });
  }
  return rows;
}

/** Preview a Vegas hole from draft scores ({ pid: gross | 'X' }). */
export function vegasPreview(round, hole, draft) {
  const teams = round.teams || [];
  if (teams.length !== 2 || teams.some(t => t.players.some(pid => draft[pid] == null))) return null;
  const eff = pid => { const p = playerById(round, pid); const st = strokesFor(round, p, hole); const g = draft[pid]; return (g === 'X' ? pickupGross(hole.par, st) : g) - st; };
  const nets = teams.map(t => t.players.map(eff));
  const gross = teams.map(t => t.players.map(pid => draft[pid]));
  return vegasHole(nets, gross, hole.par, { birdieFlip: round.settings.vegas.birdieFlip });
}

// --------------------------- Sixes ----------------------------------------

/** The three six-hole matches: [{ seg, sides: [[pid,pid],[pid,pid]], winners, status }]. */
export function sixesMatches(round) {
  const ids = round.players.map(p => p.id);
  const pairs = sixesPairings(ids);
  const segs = sixesSegments(round.holes.length);
  return segs.map((seg, i) => {
    const [a, b] = pairs[i];
    const winners = {};
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

/** Per-player totals for the totals games: net strokes, Stableford points, quota points. */
export function totalsTable(round) {
  const out = round.players.map(p => {
    let total = 0, played = 0;
    const quota = round.game === 'quota' ? quotaFor(round.useHandicaps ? p.courseHc : 0, round.holes.length) : null;
    for (const h of round.holes) {
      if (!holeComplete(round, h)) continue;
      played++;
      if (round.game === 'stroke') total += netFor(round, p, h);
      else if (round.game === 'stableford') total += stablefordPoints(netFor(round, p, h), h.par, round.settings.stableford.modified);
      else if (round.game === 'quota') total += quotaPoints(grossFor(round, p, h), h.par);
    }
    const toPar = round.game === 'stroke' ? total - round.holes.filter(h => holeComplete(round, h)).reduce((a, h) => a + h.par, 0) : null;
    return { id: p.id, name: p.name, total, played, quota, toPar, vsQuota: quota != null ? total - quota : null };
  });
  return out;
}

/** Points per hole per player for nines, aces (as money), bingo bango bongo and dots. */
export function pointsTable(round) {
  const ids = round.players.map(p => p.id);
  const rows = [];
  for (const h of round.holes) {
    const s = round.settings;
    if (round.game === 'bbb') {
      const m = round.marks?.[h.no];
      if (!m) continue;
      const pts = Object.fromEntries(ids.map(id => [id, 0]));
      for (const k of ['bingo', 'bango', 'bongo']) if (m[k] && pts[m[k]] != null) pts[m[k]] += 1;
      rows.push({ hole: h, points: pts, label: ['bingo', 'bango', 'bongo'].filter(k => m[k]).map(k => k[0].toUpperCase()).join('') });
      continue;
    }
    if (round.game === 'dots') {
      const m = round.marks?.[h.no] || {};
      const pts = Object.fromEntries(ids.map(id => [id, 0]));
      let any = false;
      for (const p of round.players) {
        const manual = (m[p.id] || []).filter(k => s.dots.kinds?.[k] !== false && DOT_KINDS[k]);
        const auto = s.dots.auto ? scoreDots(round.scores[h.no]?.[p.id], h.par) : 0;
        pts[p.id] = manual.length + auto;
        if (pts[p.id]) any = true;
      }
      if (!any && !holeComplete(round, h)) continue;
      rows.push({ hole: h, points: pts });
      continue;
    }
    if (!holeComplete(round, h)) continue;
    if (round.game === 'nines') {
      const nets = round.players.map(p => netFor(round, p, h));
      const pts = ninesPoints(nets);
      rows.push({ hole: h, points: Object.fromEntries(ids.map((id, i) => [id, pts[i]])) });
    }
  }
  return rows;
}

// --------------------------- Rabbit ---------------------------------------

/** Rabbit legs: for each nine, the rows and who holds it at the end. */
export function rabbitTable(round) {
  const legs = nassauLegs(round.holes.length);
  const segs = round.holes.length === 18 ? [legs.front, legs.back] : [legs.total];
  const rows = round.holes.map(h => {
    if (!holeComplete(round, h)) return { hole: h, winner: undefined };
    const nets = round.players.map(p => [p.id, netFor(round, p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    const lows = nets.filter(n => n[1] === low);
    return { hole: h, winner: lows.length === 1 ? lows[0][0] : null };
  });
  const out = segs.map(seg => {
    const part = rows.slice(seg.start - 1, seg.end);
    const { holder, history } = rabbitHolder(part, round.settings.rabbit.tiesFree);
    const done = part.every(r => r.winner !== undefined);
    return { seg, rows: part, holder, history, done };
  });
  return { legs: out, rows };
}

// --------------------------- Results --------------------------------------

/** Money by player id plus game-specific detail. Works on partial rounds too. */
export function roundResults(round) {
  const ids = round.players.map(p => p.id);
  const balances = Object.fromEntries(ids.map(id => [id, 0]));
  const detail = {};
  const s = round.settings;
  const add = deltas => { for (const id of ids) balances[id] += deltas[id] || 0; };
  const round2 = () => { for (const id of ids) balances[id] = Math.round(balances[id] * 100) / 100; };

  if (round.game === 'banker') {
    detail.holes = [];
    round.holes.forEach(h => {
      const setup = round.banker[h.no];
      if (!setup || !holeComplete(round, h)) return;
      const net = Object.fromEntries(round.players.map(p => [p.id, netFor(round, p, h)]));
      const r = settleBankerHole(setup, net, ids, { ties: s.banker.ties });
      add(r.deltas);
      detail.holes.push({ no: h.no, banker: setup.banker, ...r });
    });
  }

  if (round.game === 'nassau' || round.game === 'match') {
    const res = nassauResult(nassauWinners(round), round.presses, nassauAmounts(round), roundLegs(round));
    spreadSides(round, balances, res.net);
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
      add(r.deltas);
      detail.holes.push({ no: h.no, ...r });
    }
  }

  if (round.game === 'vegas') {
    const rows = vegasTable(round);
    for (const r of rows) if (r.played) add(r.deltas);
    detail.vegas = rows;
  }

  if (round.game === 'sixes') {
    const matches = sixesMatches(round);
    detail.matches = matches.map(m => {
      const st = m.status;
      let net = 0; // positive = side 0 wins
      if (s.sixes.mode === 'holes') {
        const w0 = Object.values(m.winners).filter(w => w === 0).length, w1 = Object.values(m.winners).filter(w => w === 1).length;
        net = (w0 - w1) * s.sixes.stake;
      } else if (st.leader != null && st.done) net = st.leader === 0 ? s.sixes.stake : -s.sixes.stake;
      for (const pid of m.sides[0]) balances[pid] += net;
      for (const pid of m.sides[1]) balances[pid] -= net;
      return { ...m, net };
    });
  }

  if (round.game === 'scramble') {
    const teams = round.teams || [];
    const played = round.holes.filter(h => holeComplete(round, h));
    const parPlayed = played.reduce((a, h) => a + h.par, 0);
    const totals = {};
    for (const t of scorers(round)) totals[t.id] = played.reduce((a, h) => a + netFor(round, t, h), 0);
    if (played.length && teams.length) {
      // Everyone antes the stake; the winning team's players split the pot (tied teams share it)
      const best = Math.min(...teams.map(t => totals[t.id]));
      const winners = teams.filter(t => totals[t.id] === best).flatMap(t => t.players);
      const pot = s.scramble.stake * ids.length;
      for (const id of ids) balances[id] -= s.scramble.stake;
      for (const id of winners) balances[id] += pot / winners.length;
    }
    detail.totals = scorers(round).map(t => ({ id: t.id, name: t.name, total: totals[t.id], toPar: totals[t.id] - parPlayed, played: played.length }));
  }

  if (round.game === 'stroke' || round.game === 'stableford' || round.game === 'quota') {
    const table = totalsTable(round);
    const played = table[0]?.played || 0;
    if (played) {
      const key = round.game === 'quota' ? 'vsQuota' : 'total';
      const totals = Object.fromEntries(table.map(t => [t.id, t[key]]));
      const cfg = s[round.game];
      add(settleTotals(totals, { mode: cfg.payout === 'pot' ? 'pot' : 'per', stake: cfg.stake, lowerWins: round.game === 'stroke' }));
    }
    detail.totals = table;
  }

  if (round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') {
    const rows = pointsTable(round);
    const pts = Object.fromEntries(ids.map(id => [id, 0]));
    for (const r of rows) for (const id of ids) pts[id] += r.points[id] || 0;
    if (round.game === 'dots') {
      // Every dot is paid by each of the other players
      for (const id of ids) for (const other of ids) if (other !== id) { balances[id] += pts[id] * s.dots.value; balances[other] -= pts[id] * s.dots.value; }
    } else if (round.game === 'bbb') {
      // Every pair settles the difference in points
      if (rows.length) add(settleTotals(pts, { mode: 'per', stake: s.bbb.value, lowerWins: false }));
    } else if (rows.length) add(pointsToMoney(pts, s.nines.point));
    detail.points = pts;
    detail.rows = rows;
  }

  if (round.game === 'aces') {
    detail.holes = [];
    for (const h of round.holes) {
      if (!holeComplete(round, h)) continue;
      const r = acesDeuces(round.players.map(p => netFor(round, p, h)), ids, s.aces);
      add(r.deltas);
      detail.holes.push({ no: h.no, ...r });
    }
  }

  if (round.game === 'rabbit') {
    const t = rabbitTable(round);
    for (const leg of t.legs) {
      if (!leg.done || !leg.holder) continue;
      for (const id of ids) {
        if (id === leg.holder) balances[id] += s.rabbit.stake * (ids.length - 1);
        else balances[id] -= s.rabbit.stake;
      }
    }
    detail.rabbit = t;
  }

  round2();
  const standings = [...round.players]
    .map(p => ({ ...p, amount: balances[p.id] }))
    .sort((a, b) => b.amount - a.amount);
  return { balances, standings, transfers: minimalTransfers(balances), detail };
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
  const now = roundResults(counted).balances;
  const before = roundResults(without).balances;
  const delta = Object.fromEntries(Object.keys(now).map(id => [id, Math.round((now[id] - before[id]) * 100) / 100]));
  return { balances: now, delta };
}

/** Gross totals + counts for stats. Works for a player or a scramble team id. */
export function scoreSummary(round, pid) {
  let gross = 0, played = 0, birdies = 0, eagles = 0, pars = 0;
  const p = scorers(round).find(x => x.id === pid);
  if (!p) return { gross, played, birdies, eagles, pars };
  for (const h of round.holes) {
    const g = round.scores[h.no]?.[pid];
    if (g == null) continue;
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
