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
    left: {},        // playerId -> hole number they stopped after (0: before the first hole)
  };
  if (teams?.length) round.teams = withTeamHandicaps(round, buildTeams(teams, full), full, useHandicaps, hcPct);
  return round;
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

const anyLeft = round => !!round.left && Object.keys(round.left).length > 0;

/** Whether a player is still in the round on this hole. */
export function playsHole(round, pid, hole) {
  if (!anyLeft(round)) return true;
  return posOf(round, hole) <= leftAt(round, pid);
}

/** The players still in the round on a hole. */
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
  else banker = bankerFor(s.rotation, idx, all, s.firstBanker || 0);
  // The rotation skips anyone who has left: the bank passes to the next player in the order
  const k = all.indexOf(banker);
  for (let n = 1; !ids.includes(banker) && n <= all.length; n++) banker = all[(k + n) % all.length];
  const bets = {};
  for (const id of ids) if (id !== banker) bets[id] = prev?.bets?.[id] ?? s.defaultBet;
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
    // Only the players still on a hole play for it, so a carried skin won later is paid by them alone
    const on = playersOn(round, h);
    const field = on.map(p => p.id);
    if (!holeComplete(round, h)) { rows.push({ hole: h, winner: undefined, skins: 0, pot, field }); continue; }
    const nets = on.map(p => [p.id, netFor(round, p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    const lows = nets.filter(n => n[1] === low);
    if (lows.length === 1) { rows.push({ hole: h, winner: lows[0][0], skins: pot, pot, field }); pot = 1; }
    else { rows.push({ hole: h, winner: null, skins: 0, pot, field }); pot = carry ? pot + 1 : 1; }
  }
  return { rows, value, unclaimed: pot > 1 ? pot - 1 : 0 };
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

export function wolfHoleResult(round, hole) {
  const setup = round.wolf[hole.no];
  if (!setup || !holeComplete(round, hole)) return null;
  const P = round.settings.wolf.point;
  const mult = round.settings.wolf.loneMultiplier;
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
    // Vegas needs two full teams: once a player leaves, the holes after aren't counted
    if (teams.some(t => t.players.some(pid => !playsHole(round, pid, h)))) { rows.push({ hole: h, played: false, short: true }); continue; }
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

/** Per-player totals for the totals games: net strokes, Stableford points, quota points. */
export function totalsTable(round) {
  const out = round.players.map(p => {
    let total = 0, played = 0, par = 0;
    const quota = round.game === 'quota' ? quotaFor(round.useHandicaps ? p.courseHc : 0, round.holes.length) : null;
    for (const h of round.holes) {
      if (!holeComplete(round, h) || !playsHole(round, p.id, h)) continue;
      played++;
      par += h.par;
      total += totalsHoleValue(round, p, h);
    }
    const toPar = round.game === 'stroke' ? total - par : null;
    return { id: p.id, name: p.name, total, played, quota, toPar, vsQuota: quota != null ? total - quota : null, left: leftAt(round, p.id) < round.holes.length };
  });
  return out;
}

/** One player's number on one hole in the totals games: net strokes, Stableford points or quota points. */
function totalsHoleValue(round, p, h) {
  if (round.game === 'stroke') return netFor(round, p, h);
  if (round.game === 'stableford') return stablefordPoints(netFor(round, p, h), h.par, round.settings.stableford.modified);
  return quotaPoints(grossFor(round, p, h), h.par);
}

/**
 * Pairwise settling for per-stroke / per-point bets: every pair settles the difference on the
 * holes they both played, so a player who left is square with everyone for the holes after.
 * `value(pid, hole)` is a player's number on a counted hole; `adjust(a, b, shared)` is added to
 * a's side of the difference (used for quota targets). Returns money by player id.
 */
function settlePairs(round, value, { stake, lowerWins, adjust = null }) {
  const ids = round.players.map(p => p.id);
  const out = Object.fromEntries(ids.map(id => [id, 0]));
  const counted = round.holes.filter(h => holeComplete(round, h));
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i], b = ids[j];
    const both = counted.filter(h => playsHole(round, a, h) && playsHole(round, b, h));
    if (!both.length) continue;
    let diff = both.reduce((acc, h) => acc + value(a, h) - value(b, h), 0);
    if (adjust) diff += adjust(a, b, both.length);
    const d = diff * stake * (lowerWins ? -1 : 1); // positive = a wins
    out[a] += d; out[b] -= d;
  }
  return out;
}

/** Points per hole per player for nines, aces (as money), bingo bango bongo and dots. */
export function pointsTable(round) {
  const ids = round.players.map(p => p.id);
  const rows = [];
  for (const h of round.holes) {
    const s = round.settings;
    // Rows carry `field`: the players still on the hole, who are the only ones it settles between
    const field = playersOn(round, h).map(p => p.id);
    if (round.game === 'bbb') {
      // Bingo bango bongo is marks only, so a missing score doesn't stop the hole counting
      const m = round.marks?.[h.no];
      if (!m) continue;
      const pts = Object.fromEntries(ids.map(id => [id, 0]));
      const got = ['bingo', 'bango', 'bongo'].filter(k => m[k] && field.includes(m[k]));
      for (const k of got) pts[m[k]] += 1;
      rows.push({ hole: h, points: pts, field, label: got.map(k => k[0].toUpperCase()).join('') });
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
      rows.push({ hole: h, points: pts, field });
      continue;
    }
    // Nines is scored for exactly three, so once a player leaves the holes after aren't counted
    if (round.game === 'nines' && field.length === round.players.length) {
      const nets = round.players.map(p => netFor(round, p, h));
      const pts = ninesPoints(nets);
      rows.push({ hole: h, points: Object.fromEntries(ids.map((id, i) => [id, pts[i]])), field });
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
    // `gone`: players who left before this hole. If the rabbit's holder leaves, it runs loose
    const on = playersOn(round, h);
    const gone = round.players.filter(p => !on.includes(p)).map(p => p.id);
    if (!holeComplete(round, h)) return { hole: h, winner: undefined, gone };
    const nets = on.map(p => [p.id, netFor(round, p, h)]);
    const low = Math.min(...nets.map(n => n[1]));
    const lows = nets.filter(n => n[1] === low);
    return { hole: h, winner: lows.length === 1 ? lows[0][0] : null, gone };
  });
  const out = segs.map(seg => {
    const part = rows.slice(seg.start - 1, seg.end);
    const { holder, history } = rabbitHolder(part, round.settings.rabbit.tiesFree);
    const done = part.every(r => r.winner !== undefined);
    // Only the players still there at the end of the leg pay the holder
    const last = round.holes[seg.end - 1];
    const payers = last ? playersOn(round, last).map(p => p.id) : round.players.map(p => p.id);
    return { seg, rows: part, holder, history, done, payers };
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
      // Only the players still on the hole bet on it; a saved setup whose banker has left doesn't stand
      const on = playersOn(round, h);
      const field = on.map(p => p.id);
      if (!field.includes(setup.banker)) return;
      const net = Object.fromEntries(on.map(p => [p.id, netFor(round, p, h)]));
      const r = settleBankerHole(setup, net, field, { ties: s.banker.ties });
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
    for (const r of t.rows) {
      if (!r.winner) continue;
      for (const id of r.field) {
        if (id === r.winner) balances[id] += r.skins * t.value * (r.field.length - 1);
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
      for (const id of inIds) balances[id] -= s.scramble.stake;
      for (const id of winners) balances[id] += pot / winners.length;
    }
    detail.totals = scorers(round).map(t => ({ id: t.id, name: t.name, total: totals[t.id], toPar: totals[t.id] - pars[t.id], played: counts[t.id], left: teams.length > 0 && !inTeams.some(x => x.id === t.id) }));
  }

  if (round.game === 'stroke' || round.game === 'stableford' || round.game === 'quota') {
    const table = totalsTable(round);
    const played = Math.max(0, ...table.map(t => t.played));
    const cfg = s[round.game];
    const lowerWins = round.game === 'stroke';
    if (played && cfg.payout === 'pot') {
      // The pot is played for by those still in at the end. Anyone who left is out of it: they don't pay or win
      const key = round.game === 'quota' ? 'vsQuota' : 'total';
      const stay = playersToEnd(round).map(p => p.id);
      const totals = Object.fromEntries(table.filter(t => stay.includes(t.id)).map(t => [t.id, t[key]]));
      add(settleTotals(totals, { mode: 'pot', stake: cfg.stake, lowerWins }));
    } else if (played) {
      // Per stroke or point: each pair settles on the holes they both played
      const byId = Object.fromEntries(round.players.map(p => [p.id, p]));
      const quota = Object.fromEntries(table.map(t => [t.id, t.quota]));
      const toEnd = pid => leftAt(round, pid) >= round.holes.length;
      // A quota is for the whole round, so a pair where someone left compares a share of it for the holes they shared
      const adjust = round.game === 'quota'
        ? (a, b, shared) => -(quota[a] - quota[b]) * (toEnd(a) && toEnd(b) ? 1 : shared / round.holes.length)
        : null;
      add(settlePairs(round, (pid, h) => totalsHoleValue(round, byId[pid], h), { stake: cfg.stake, lowerWins, adjust }));
    }
    detail.totals = table;
  }

  if (round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') {
    const rows = pointsTable(round);
    const pts = Object.fromEntries(ids.map(id => [id, 0]));
    for (const r of rows) for (const id of ids) pts[id] += r.points[id] || 0;
    if (round.game === 'dots') {
      // Every dot is paid by each of the other players still on that hole
      for (const r of rows) for (const id of r.field) for (const other of r.field) {
        if (other === id) continue;
        balances[id] += r.points[id] * s.dots.value; balances[other] -= r.points[id] * s.dots.value;
      }
    } else if (round.game === 'bbb') {
      // Every pair settles the difference in points on the holes they both played
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const d = rows.filter(r => r.field.includes(a) && r.field.includes(b)).reduce((acc, r) => acc + r.points[a] - r.points[b], 0) * s.bbb.value;
        balances[a] += d; balances[b] -= d;
      }
    } else if (rows.length) add(pointsToMoney(pts, s.nines.point));
    detail.points = pts;
    detail.rows = rows;
  }

  if (round.game === 'aces') {
    detail.holes = [];
    for (const h of round.holes) {
      if (!holeComplete(round, h)) continue;
      // Low and high are among the players still on the hole
      const on = playersOn(round, h);
      if (on.length < 2) continue;
      const r = acesDeuces(on.map(p => netFor(round, p, h)), on.map(p => p.id), s.aces);
      add(r.deltas);
      detail.holes.push({ no: h.no, ...r });
    }
  }

  if (round.game === 'rabbit') {
    const t = rabbitTable(round);
    for (const leg of t.legs) {
      if (!leg.done || !leg.holder) continue;
      for (const id of leg.payers) {
        if (id === leg.holder) balances[id] += s.rabbit.stake * (leg.payers.length - 1);
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

/** "Mike", "Mike and Sue", "Mike, Sue and Al". */
function nameList(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** What happened to the game when a player left, in a sentence. */
function leftRule(round, pid) {
  const g = round.game;
  const first = n => n.split(' ')[0];
  if (g === 'vegas') return 'Vegas needs two full teams, so the holes after that weren’t counted.';
  if (g === 'nines') return 'Nines is for three, so the holes after that weren’t counted.';
  if (g === 'sixes') {
    const pos = leftAt(round, pid);
    const between = pos === 0 || sixesSegments(round.holes.length).some(sg => sg.end === pos);
    return between ? 'Sixes needs all four, so the matches after that were off.' : 'Their partner played out the match under way on their own, and the matches after that were off.';
  }
  if (g === 'wolf') return 'Wolf carried on with the players still there.';
  if (g === 'nassau' || g === 'match' || g === 'scramble') {
    const side = (g === 'scramble' ? round.teams || [] : sides(round).map(players => ({ players }))).find(t => t.players.includes(pid));
    const mates = (side?.players || []).filter(x => x !== pid && leftAt(round, x) > leftAt(round, pid));
    if (!mates.length) return g === 'scramble' ? 'Their team is out of the pot.' : 'Their side had nobody left, so the match stopped there and the bets stand as they were.';
    const names = mates.map(x => first(playerById(round, x)?.name || ''));
    return g === 'scramble' ? `${nameList(names)} played on for the team.` : `${nameList(names)} played on for the side.`;
  }
  if ((g === 'stroke' || g === 'stableford' || g === 'quota') && round.settings[g]?.payout === 'pot') return 'They’re out of the pot, so they don’t pay or win it.';
  if (g === 'stroke' || g === 'stableford' || g === 'quota') return 'They settle with each player on the holes they both played.';
  return 'The holes after that were settled among the players still playing.';
}

/**
 * Plain-English notes for the results: players who left and what it did to the game, and holes
 * that weren't counted because a score is missing. [{ kind: 'left' | 'missing', text }]
 */
export function roundNotes(round) {
  const notes = [];
  const first = n => n.split(' ')[0];
  for (const { player, after, pos } of playersLeft(round)) {
    if (pos >= round.holes.length) continue;
    const when = after === 0 ? 'before the first hole' : `after hole ${after}`;
    notes.push({ kind: 'left', text: `${first(player.name)} left ${when}. ${leftRule(round, player.id)}` });
  }
  // Bingo bango bongo pays on marks alone, so missing scores don't matter there
  if (round.game === 'bbb') return notes;
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
  const without = { ...round, scores: { ...round.scores } };
  delete without.scores[no];
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
