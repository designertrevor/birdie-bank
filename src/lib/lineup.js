// Teams, playing order and what a round is played for, changed once the round is under way: the
// rest of "every setup setting changeable mid-round". The sheets are LineupSheet.jsx and
// PlayForSheet.jsx; this file is pure and unit tested.
//
// When each change counts:
//  • Teams or sides (Match play, Nassau, Hammer, Vegas, Best ball, Shamble): the whole round. These games are played
//    between set sides, so the reason to change them partway is nearly always that they were set
//    wrong. Every hole is worked out again with the new sides. Auto presses are worked out again too,
//    hole by hole as they'd have come up; a press someone called, and a hammer someone threw, stay
//    with their side of the card (the first or the second).
//  • A Scramble's teams: only before the first score, since each team has played its own ball.
//  • Banker and Wolf order: from the next hole on. Each hole played keeps the banker or wolf it had,
//    so no money moves. The order reads from the next hole: the first name banks (or is the wolf)
//    on it, the second on the hole after, and so on round. It's kept as `round.orders` (see
//    round.js turnOrder) with the hole it counts from, so the players stay in their places: their
//    order breaks a tie in the cents, and a cent mustn't move. A hole already set up (its banker's
//    bets in, or the wolf picked) keeps its banker or wolf too, so the new order starts after it.
//  • Sixes partners: the whole round. The three matches are one rotation where everyone partners
//    everyone once, so they're set together.
//  • Who throws the first hammer: the whole round. It only decides who may hammer, never the money.
//  • Play for (money, points or a reward): the whole round. A round is played for one thing.
// Nothing here runs unless someone changes a setting, so old rounds keep their money.
import { GAMES, bankerHoleSetup, gameView, holeComplete, isTeamGame, nassauPressOptions, oneBall, playersOn, roundResults, roundStarted, settingsAt, teamsFor, turnOrder, wolfFor } from './round.js';
import { teamsProblem } from './teams.js';
import { betsOf, kindFits } from './pair-bets.js';
import { playForOf, points, rewardOutcome, storedPlayFor, tabResults } from './play-for.js';
import { sixesPairings, sixesSegments } from './games.js';
import { money } from './golf.js';

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const cents = v => Math.round((Number(v) || 0) * 100) / 100;
const rotate = (list, k) => (list.length ? list.map((_, j) => list[(j + k) % list.length]) : list);
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** What a round's lineup is: 'teams' (sides or teams), 'order' (Banker, Wolf, Sixes) or null. */
export function lineupKind(round) {
  const g = GAMES[round?.game];
  if (!g) return null;
  if (g.order) return 'order';
  if (g.teams && Array.isArray(round.teams) && round.teams.length >= 2) return 'teams';
  return null;
}

/** What the round menu calls it: "Sides", "Teams", "Banker order", "Wolf order", "Partners". */
export function lineupLabel(round) {
  const game = round?.game;
  if (game === 'banker') return 'Banker order';
  if (game === 'wolf') return 'Wolf order';
  if (game === 'sixes') return 'Partners';
  return game === 'nassau' || game === 'hammer' || game === 'match' ? 'Sides' : 'Teams';
}

/**
 * What the round menu row says: "Sides · Ann & Bo v Cy & Dan", "Banker order · Dan, Ann, Bo, Cy"
 * (from the next hole), "Sixes partners", or for a Hammer match of two "Who throws the first hammer".
 */
export function lineupMenuText(round) {
  const kind = lineupKind(round);
  if (kind === 'teams') return `${lineupLabel(round)} · ${sidesText(round)}`;
  if (round.game === 'sixes') return 'Sixes partners';
  if (kind === 'order') return `${lineupLabel(round)} · ${namesOf(round, orderNow(round).ids)}`;
  return 'Who throws the first hammer';
}

/** Index of the next hole to play: the first one without every score in, or -1 when every hole is. */
export function nextOpenIdx(round) {
  return round.holes.findIndex(h => !holeComplete(round, h));
}

// --------------------------- Playing order ---------------------------------

/**
 * Where the banker rotation stands on the hole at `idx`: the place in the order (before the
 * players who left are skipped) that banks it. 'low' and 'choice' don't follow the order hole by
 * hole, so their order reads from the top.
 */
function bankOffset(main, idx) {
  const s = main.settings.banker || {};
  const firstBanker = s.firstBanker || 0;
  if (s.rotation === 'fixed' || s.rotation === 'low' || s.rotation === 'choice') return firstBanker;
  if (s.rotation === 'nine') return firstBanker + Math.floor(idx / 9);
  return firstBanker + idx;
}

/** The players on the hole at `idx`, in order: the wolf rotation, and who can bank it. */
const wolfList = (main, idx) => {
  const hole = main.holes[idx];
  const on = hole ? playersOn(main, hole) : main.players;
  const ids = (on.length ? on : main.players).map(p => p.id);
  return turnOrder(main, idx).filter(id => ids.includes(id));
};

/**
 * Where a new Banker or Wolf order starts: the next hole to play, or the first one after it that
 * isn't set up yet. A hole with its banker saved (the bets are in) or its wolf picked keeps them,
 * so it isn't where the new order starts. -1 when every hole is in.
 */
function orderStart(round) {
  const idx = nextOpenIdx(round);
  if (idx < 0 || (round.game !== 'banker' && round.game !== 'wolf')) return idx;
  const saved = round.game === 'banker' ? round.banker : round.wolf;
  for (let i = idx; i < round.holes.length; i++) {
    const h = round.holes[i];
    if (!holeComplete(round, h) && !saved?.[h.no]) return i;
  }
  return -1;
}

/**
 * The order as the sheet shows it: { idx, ids }. `idx` is the next hole to play (-1 when every hole
 * is in) and `ids` the main game's players from that hole on: the first banks (or is the wolf) on
 * it, the second on the hole after, and so on. Sixes is the order as set up, which sets the partners.
 * The banker and wolf orders leave out anyone who has left: the bank passes over them.
 */
export function orderNow(round) {
  const main = gameView(round, 'main');
  const idx = orderStart(round);
  const at = Math.max(0, idx);
  const all = turnOrder(main, at);
  if (round.game === 'wolf') {
    const on = wolfList(main, at);
    return { idx, ids: rotate(on, at % on.length) };
  }
  if (round.game === 'banker') {
    const on = wolfList(main, at);
    return { idx, ids: rotate(all, bankOffset(main, at) % all.length).filter(id => on.includes(id)) };
  }
  return { idx, ids: all };
}

/**
 * The round with the playing order changed (see the top of this file). `ids` is the order as
 * orderNow() reads it, rearranged. The players are stored in the order that makes the rotation give
 * exactly that from the next hole. Anyone not in the main game keeps their place after the rest.
 * Returns the round itself when nothing changes, or `ids` doesn't hold the same players.
 */
export function changeOrder(round, ids) {
  if (lineupKind(round) !== 'order') return round;
  const now = orderNow(round);
  if (!Array.isArray(ids) || ids.length !== now.ids.length || !now.ids.every(id => ids.includes(id))) return round;
  if (sameList(ids, now.ids)) return round;
  const main = gameView(round, 'main');
  const at = Math.max(0, now.idx);
  const all = turnOrder(main, at);
  let order;
  if (round.game === 'sixes') order = [...ids];
  else if (round.game === 'wolf') {
    const n = ids.length;
    const placed = new Array(n);
    ids.forEach((id, j) => { placed[(at % n + j) % n] = id; });
    // A wolf who has left isn't in the rotation: they go after the others
    order = [...placed, ...all.filter(id => !placed.includes(id))];
  } else {
    // The banker rotation runs through everyone, passing over anyone who has left, so they take the
    // places after the players still here: the order still reads from the next hole as set
    const n = all.length;
    const off = bankOffset(main, at) % n;
    const gone = rotate(all, off).filter(id => !ids.includes(id));
    const placed = new Array(n);
    [...ids, ...gone].forEach((id, j) => { placed[(off + j) % n] = id; });
    order = placed;
  }
  if (sameList(order, all)) return round;
  // Banker and Wolf: the order from this hole on, the players where they are
  if (round.game !== 'sixes') return { ...round, orders: [...(round.orders || []).filter(o => (o?.from ?? 0) < at), { from: at, ids: order }] };
  const byId = new Map(round.players.map(p => [p.id, p]));
  const players = [...order.map(id => byId.get(id)), ...round.players.filter(p => !order.includes(p.id))];
  return { ...round, players };
}

/**
 * Who banks (or is the wolf) on the holes still to play, as runs: [{ from, to, id }] with hole
 * numbers, so "Holes 10–18: Bob" for a banker each nine. Empty for Sixes, for 'low' and 'choice'
 * banker rotations (the scores or the group decide) and when every hole is in.
 */
export function orderRuns(round) {
  const idx = nextOpenIdx(round);
  if (idx < 0 || (round.game !== 'banker' && round.game !== 'wolf')) return [];
  const main = gameView(round, 'main');
  const rot = main.settings.banker?.rotation;
  if (round.game === 'banker' && (rot === 'low' || rot === 'choice')) return [];
  const runs = [];
  for (let i = idx; i < round.holes.length; i++) {
    const h = round.holes[i];
    if (holeComplete(round, h)) continue;
    const id = round.game === 'wolf' ? wolfFor(main, i) : bankerHoleSetup(main, i).banker;
    const last = runs.at(-1);
    if (last && last.id === id && last.toIdx === i - 1) { last.to = h.no; last.toIdx = i; } else runs.push({ from: h.no, to: h.no, id, toIdx: i });
  }
  return runs.map(({ from, to, id }) => ({ from, to, id }));
}

/** First names in order, with commas: "Ann, Bo, Cy, Dan". */
const namesOf = (round, ids) => ids.map(id => first(round.players.find(p => p.id === id)?.name)).join(', ');

/**
 * The order on the first-tee card: who banks (or is the wolf) from the first hole, in turn. Sixes
 * lists its three matches: "1–6 Ann & Bob v Cy & Dan; 7–12 ...".
 */
export function orderText(round) {
  const main = gameView(round, 'main');
  const all = main.players.map(p => p.id);
  if (round.game === 'sixes') {
    if (all.length !== 4) return namesOf(round, all);
    const segs = sixesSegments(round.holes.length);
    return sixesPairings(all).map(([a, b], i) => `${round.holes[segs[i].start - 1]?.no ?? segs[i].start}–${round.holes[segs[i].end - 1]?.no ?? segs[i].end} ${a.map(id => namesOf(round, [id])).join(' & ')} v ${b.map(id => namesOf(round, [id])).join(' & ')}`).join('; ');
  }
  // The order as it was played from the first hole: a change mid-round is listed under what changed
  const from1 = turnOrder(main, 0);
  if (round.game === 'banker') return namesOf(round, rotate(from1, bankOffset(main, 0) % from1.length));
  return namesOf(round, round.game === 'wolf' ? from1 : all);
}

// --------------------------- Teams and sides -------------------------------

/** The round's teams as arrays of player ids, or null. */
export function teamGroups(round) {
  return Array.isArray(round.teams) ? round.teams.map(t => [...(t.players || [])]) : null;
}

/** "Ann & Bob v Cy & Dan": the sides by first name. */
export function sidesText(round, groups = teamGroups(round)) {
  if (!groups) return '';
  return groups.map(g => g.map(id => first(round.players.find(p => p.id === id)?.name)).join(' & ') || '–').join(' v ');
}

/** Why the teams can't change now, or null when they can: a one-ball game (Scramble, Alternate shot, Chapman) once a score is in. */
export function teamsLocked(round) {
  if (oneBall(round.game) && roundStarted(round)) return 'Each team has played its own ball since the first hole, so the teams stay as they are.';
  return null;
}

/** What's wrong with a new split, or null when it's fine. */
export function teamsChangeProblem(round, groups) {
  const locked = teamsLocked(round);
  if (locked) return locked;
  const ids = gameView(round, 'main').players.map(p => p.id);
  const problem = teamsProblem(round.game, groups, ids);
  if (problem) return problem;
  // A one-ball game's side bet on scores is played on the two teams' balls, so the two need different teams
  if (oneBall(round.game)) {
    const view = { ...round, teams: groups.map((players, i) => ({ id: `t${i}`, players })) };
    const clash = betsOf(round).find(b => !kindFits(view, b.kind, b.sides));
    if (clash) return `${clash.sides.map(id => first(round.players.find(p => p.id === id)?.name)).join(' and ')} have a side bet on their scores, so they need to be on different teams.`;
  }
  return null;
}

/** Games whose sides press: Match play, Nassau, and the team games played as a match (Best ball and the rest). */
export const pressesOn = game => game === 'nassau' || game === 'match' || isTeamGame(game);

/**
 * Auto presses worked out again from the first hole for the round's sides, as they would have come
 * up hole by hole: each from the holes played before it and the presses already on. Presses called
 * by hand stay as they are. The press before a hole comes up from the bets in force on the hole just
 * played (as the app does when that hole is saved), so a stretch played with presses off or by hand
 * gets no auto presses, even when they're on now.
 */
export function replayAutoPresses(round) {
  if (!pressesOn(round.game)) return round;
  const main = gameView(round, 'main');
  const before = k => settingsAt(main, k - 1);
  const autoBefore = k => before(k)[round.game]?.pressMode === 'auto';
  const ks = Array.from({ length: Math.max(0, round.holes.length - 1) }, (_, i) => i + 2);
  if (!ks.some(autoBefore)) return round;
  const presses = (round.presses || []).filter(p => !p.auto);
  for (const k of ks) {
    if (!autoBefore(k) || !holeComplete(round, round.holes[k - 2])) continue;
    const scores = {};
    for (const h of round.holes.slice(0, k - 1)) if (round.scores[h.no]) scores[h.no] = round.scores[h.no];
    const view = { ...main, settings: before(k), scores, presses: presses.filter(p => p.start <= k) };
    for (const o of nassauPressOptions(view, k)) presses.push({ id: `auto-${o.leg}-${k}`, leg: o.leg, start: k, by: o.trailing, auto: true });
  }
  presses.sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id)));
  return { ...round, presses };
}

const sameGroup = (a, b) => sameList([...a].sort(), [...b].sort());
const overlap = (a, b) => a.filter(id => b.includes(id)).length;

/**
 * The new groups lined up with the old ones: the same teams in another order are the old order, and
 * two sides keep their place on the card (first or second) with the most of their players, so a
 * press called or a hammer thrown by a side stays with the players who made it.
 */
function alignGroups(was, groups) {
  if (was.length === groups.length && groups.every(g => was.some(w => sameGroup(w, g)))) return was.map(w => groups.find(g => sameGroup(w, g)));
  if (was.length === 2 && groups.length === 2 && overlap(was[0], groups[1]) + overlap(was[1], groups[0]) > overlap(was[0], groups[0]) + overlap(was[1], groups[1])) return [groups[1], groups[0]];
  return groups;
}

/**
 * The round with new teams or sides, for every hole (see the top of this file). `groups` are arrays
 * of player ids. Returns the round itself when nothing changes or the split doesn't work.
 */
export function changeTeams(round, groups) {
  if (lineupKind(round) !== 'teams' || teamsChangeProblem(round, groups)) return round;
  const was = teamGroups(round);
  const next = alignGroups(was, groups);
  if (was.length === next.length && was.every((g, i) => sameGroup(g, next[i]))) return round;
  return replayAutoPresses({ ...round, teams: teamsFor(round, next) });
}

/** Who throws the first hammer ('either' or 'trailing') for every hole, past bets kept as they were. */
export function changeHammerWho(round, who) {
  if (round.game !== 'hammer' || (who !== 'either' && who !== 'trailing')) return round;
  // A round with no rule set plays it as 'either', so choosing that again is no change
  const whoOf = s => s?.who || 'either';
  if (whoOf(round.settings.hammer) === who && (round.betHistory || []).every(e => whoOf(e.settings) === who)) return round;
  const out = { ...round, settings: { ...round.settings, hammer: { ...round.settings.hammer, who } } };
  if (Array.isArray(round.betHistory)) out.betHistory = round.betHistory.map(e => ({ ...e, settings: { ...e.settings, who } }));
  return JSON.stringify(out) === JSON.stringify(round) ? round : out;
}

// --------------------------- Play for --------------------------------------

const withoutPlayFor = b => {
  if (!b || !('playFor' in b)) return b;
  const { playFor: _PF, ...rest } = b;
  return rest;
};

/**
 * The round played for something else (money, points or a reward), for every hole. Side bets
 * between two players go along: on a money or points round each is played for the round's unit.
 * Switching a money round to a reward keeps each side bet for money (the two agreed money) unless
 * `cashBets` is false; from points they're points unless `cashBets` is true. Reward to reward keeps
 * each bet's own choice. Returns the round itself when nothing changes.
 */
export function changePlayFor(round, playFor, { cashBets = null } = {}) {
  const next = storedPlayFor(playFor);
  const was = playForOf(round);
  const toReward = next?.kind === 'reward';
  const out = { ...round };
  if (next) out.playFor = next; else delete out.playFor;
  if (Array.isArray(round.bets) && round.bets.length) {
    if (toReward && was.kind !== 'reward') {
      const cash = cashBets ?? was.kind === 'money';
      out.bets = round.bets.map(b => (cash && b ? { ...withoutPlayFor(b), playFor: 'money' } : withoutPlayFor(b)));
    } else if (!toReward) out.bets = round.bets.map(withoutPlayFor);
  }
  return JSON.stringify(out) === JSON.stringify(round) ? round : out;
}

/** "Money", "Points (bragging rights)", "Lunch, last place buys": the first-tee card's line. */
export function playForText(round) {
  const pf = playForOf(round);
  if (pf.kind === 'points') return 'Points (bragging rights)';
  if (pf.kind === 'reward') return `${pf.reward}, ${pf.owes === 'everyone' ? 'everyone else buys one' : 'last place buys'}`;
  return 'Money';
}

/** A balances object as [{ id, name, v }] for everyone not at zero, biggest first. */
function nonZero(round, balances) {
  return round.players
    .map(p => ({ id: p.id, name: p.name, v: cents(balances?.[p.id]) }))
    .filter(x => x.v !== 0)
    .sort((a, b) => b.v - a.v);
}
const listOf = (xs, fmt) => xs.map(x => `${first(x.name)} ${fmt(x.v, { sign: true })}`).join(', ');

/**
 * What a change does to the Tab, in one plain line, or null when the Tab doesn't move. Only a
 * finished round goes on the Tab, so it says what this one will put there, from the holes so far:
 * "Goes on the Tab when the round's done: so far Ann +$4, Bob −$4", "Won't go on the Tab: so far
 * ...", or "On the Tab when the round's done, so far: Ann +$9, Bob −$9 (it was Ann +$4, Bob −$4)"
 * when it would go on before and still does, by different amounts: one set of numbers to read, and
 * what it was. Always worked out with tabResults(), so a reward round's side bets for money count
 * and nothing else does.
 */
export function tabLine(before, after) {
  const was = nonZero(before, tabResults(before).balances);
  const now = nonZero(after, tabResults(after).balances);
  if (!was.length && !now.length) return null;
  if (!now.length) return `Won’t go on the Tab: so far ${listOf(was, money)}`;
  if (!was.length) return `Goes on the Tab when the round’s done: so far ${listOf(now, money)}`;
  const a = tabResults(before).balances, b = tabResults(after).balances;
  const moved = after.players.some(p => cents((b[p.id] || 0) - (a[p.id] || 0)) !== 0);
  if (!moved) return null;
  const when = after.status === 'done' ? 'On the Tab now' : 'On the Tab when the round’s done, so far';
  return `${when}: ${listOf(now, money)} (it was ${listOf(was, money)})`;
}

/**
 * How the round stands in its new unit, or null before anything is played: "Points so far: Ann
 * +4 pts, Bob −4 pts", "So far: Ann wins lunch. Bob’s buying." A money round says nothing here:
 * tabLine() covers it.
 */
export function standingLine(after) {
  const res = roundResults(after);
  const pf = playForOf(after);
  if (pf.kind === 'money') return null;
  if (!after.holes.some(h => holeComplete(after, h))) return null;
  if (pf.kind === 'reward') return `So far: ${rewardOutcome(after, res).text}`;
  const xs = nonZero(after, res.balances);
  return xs.length ? `Points so far: ${listOf(xs, points)}` : 'Points so far: all square.';
}
