// Team points, Ryder Cup style: a trip format beside "Money across every round" (trips.js).
//
// The trip has two teams. The organizer picks them on the trip (a captains' draft on one phone,
// or the app balances them by handicap), and they ride in the trip's stamp on every round, so a
// friend's phone setting up a round knows who's on which team. Each round on the trip carries its
// own matches (`round.cup = { kind, sides: [[ids], [ids]] }`, side 0 always the first team):
// four-ball (best ball of two against two) or singles, paired off in the order each side lists its
// players. A match is worked out hole by hole from the round's own scores and strokes, whatever
// game the round is playing, so the round keeps its own games and bets as they are.
// A win is 1 point, a halved match half a point each. Matches count once their round is done; a
// match closed out early ends there ("3&2"), and one the round never finished goes to whoever led
// on the holes played, the way an unfinished Nassau bet pays. The team score adds up every match
// on the trip, and the leaderboard gives each player the points of the matches they played in.
//
// A friend in another group has a different phone, so each round's matches also go to the server
// (cup-sync.js) and every phone on the trip reads the others' (`state.cupRemote`). Until that SQL
// has run, a phone counts the matches of the rounds it has.
//
// The optional stake is on the team result: each player on the losing team pays it, and the
// winners split the pot evenly. It folds into each person's trip total once the trip is over, and
// it's paid from Settle the trip in a few payments worked out from the teams, so every phone on
// the trip lists the same payments. It's kept off the Tab (the Tab is round by round), with its
// own "I paid" marks (`state.cupPaid`, shared through cup-sync.js too). A halved cup pays nothing.
// Pure, unit tested.
import { holeWinner } from './golf.js';
import { oneBall, sideNet } from './round.js';
import { canonicalOf, codeOf } from './pair-debts.js';
import { stable } from './sync-model.js';

export const CUP_FORMAT = 'cup';
export const CUP_KINDS = {
  fourball: { name: 'Four-ball', blurb: 'Best ball of two against two', size: 2 },
  singles: { name: 'Singles', blurb: 'One against one', size: 1 },
};
export const TEAM_NAMES = ['Blue', 'Red'];
/** The most a person can put on the cup, in dollars. */
export const MAX_STAKE = 500;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;
const cents = v => Math.round((Number(v) || 0) * 100);
const lower = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** "5½", "½", "3". */
export function cupPoints(v) {
  const n = Math.round((Number(v) || 0) * 2) / 2;
  const whole = Math.floor(n);
  return n % 1 ? (whole ? `${whole}½` : '½') : String(whole);
}

/** The cup in a few words (`cup` from trips.js cupStatus): "Blue leads 3½ to 2½", "All square at 2", "Red wins the cup 5 to 3". */
export function cupHeadline(cup) {
  const [a, b] = cup.score.points;
  const n = cup.names;
  if (cup.final) return cup.winner == null ? `The cup is halved, ${cupPoints(a)} all` : `${n[cup.winner]} wins the cup ${cupPoints(Math.max(a, b))} to ${cupPoints(Math.min(a, b))}`;
  if (!cup.score.done) return cup.score.live.length ? 'The first matches are out' : 'No matches played yet';
  if (a === b) return `All square at ${cupPoints(a)}`;
  const lead = a > b ? 0 : 1;
  return `${n[lead]} leads ${cupPoints(Math.max(a, b))} to ${cupPoints(Math.min(a, b))}`;
}

/** A team name typed in: trimmed, single spaces, at most 16 characters. */
export function cleanTeamName(s, i = 0) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16) || TEAM_NAMES[i];
}

/** A whole-dollar stake from 0 to MAX_STAKE. */
export function cleanStake(v) {
  const n = Math.round(Number(v) || 0);
  return Math.max(0, Math.min(MAX_STAKE, n));
}

/**
 * A trip's cup as the organizer set it: { names, teams: [[{ id, name }], [...]], captains, stake,
 * pick: 'draft' | 'balance' | 'hand' }. Anyone on both teams stays on the first.
 */
export function cleanCup(raw) {
  const c = isObj(raw) ? raw : {};
  const names = [0, 1].map(i => cleanTeamName(Array.isArray(c.names) ? c.names[i] : null, i));
  const seen = new Set();
  const teams = [0, 1].map(i => (Array.isArray(c.teams?.[i]) ? c.teams[i] : [])
    .filter(p => isObj(p) && isStr(p.id) && !seen.has(p.id) && seen.add(p.id))
    .slice(0, 24)
    .map(p => ({ id: p.id, name: String(p.name || '').trim().slice(0, 40) || 'Player' })));
  const captains = [0, 1].map(i => {
    const id = Array.isArray(c.captains) ? c.captains[i] : null;
    return isStr(id) && teams[i].some(p => p.id === id) ? id : null;
  });
  const pick = ['draft', 'balance', 'hand'].includes(c.pick) ? c.pick : 'hand';
  return { names, teams, captains, stake: cleanStake(c.stake), pick };
}

// --------------------------- picking the teams ---------------------------

/** Handicap index for sorting: no handicap sorts after everyone with one. */
const indexOf = p => (p?.index == null || p.index === '' || Number.isNaN(Number(p.index)) ? 99 : Number(p.index));

/**
 * Two teams as even as handicaps allow: best player first, then a snake (A, B, B, A, A, B...), so
 * neither team gets all the low handicaps. `people`: [{ id, name, index }]. Ties keep the order given.
 */
export function balanceTeams(people) {
  const list = people.map((p, i) => ({ p, i })).sort((a, b) => indexOf(a.p) - indexOf(b.p) || a.i - b.i).map(x => x.p);
  const teams = [[], []];
  list.forEach((p, i) => teams[[0, 1, 1, 0][i % 4]].push({ id: p.id, name: p.name }));
  return teams;
}

/** Each team's handicaps added up (no handicap counts as none): [a, b], one decimal. */
export function teamHandicaps(teams, indexById) {
  return teams.map(t => Math.round(t.reduce((a, p) => a + (indexById(p.id) == null ? 0 : Number(indexById(p.id)) || 0), 0) * 10) / 10);
}

/** In a captains' draft, which team picks next: the smaller one, the first team on a tie. */
export function pickingTeam(teams) {
  return teams[0].length <= teams[1].length ? 0 : 1;
}

/** Move someone to a team (`team` 0 or 1), or off both (`team` null). */
export function moveTo(teams, person, team) {
  const out = teams.map(t => t.filter(p => p.id !== person.id));
  if (team === 0 || team === 1) out[team].push({ id: person.id, name: person.name });
  return out;
}

// --------------------------- each round's matches ---------------------------

/** The cup on a trip record or stamp, or null when the trip isn't played for team points. */
export function cupOf(trip) {
  return trip?.format === CUP_FORMAT ? cleanCup(trip.cup) : null;
}

/**
 * Which team a player is on, from the trip's teams: the same person (any id this phone links to
 * them), or else the same name on the card. Null when they're on neither.
 */
export function teamOf(state, cup, player) {
  if (!cup) return null;
  const who = canonicalOf(state);
  const me = who(player.id);
  for (const i of [0, 1]) if (cup.teams[i].some(p => p.id === player.id || who(p.id) === me)) return i;
  const n = lower(player.name);
  if (!n) return null;
  const hits = [0, 1].filter(i => cup.teams[i].some(p => lower(p.name) === n));
  return hits.length === 1 ? hits[0] : null;
}

/** Four-ball when both sides have two or more, else singles. */
export const defaultKind = sides => (sides[0].length >= 2 && sides[1].length >= 2 ? 'fourball' : 'singles');

/** A list turned `k` places: [a, b, c] by 1 is [b, c, a]. */
const turned = (list, k) => (list.length ? list.map((_, i) => list[(i + k) % list.length]) : list);

/**
 * A round's matches to start with: everyone on the trip's teams on their team's side, in the
 * team's order, and anyone on neither team on the side with fewer so far (so a friend who wasn't
 * picked still plays). `players`: the round's [{ id, name }]. `kind` null picks four-ball or singles.
 * Partners and opponents rotate from round to round: `rotate` is how many of the trip's rounds
 * came before, and each one turns the order (both sides in four-ball, so partners change; the
 * second side in singles, so opponents do).
 */
export function defaultRoundCup(state, trip, players, kind = null, { rotate = 0 } = {}) {
  const cup = cupOf(trip);
  if (!cup) return null;
  const sides = [[], []];
  const order = p => {
    const t = teamOf(state, cup, p);
    if (t == null) return 999;
    const who = canonicalOf(state);
    const k = cup.teams[t].findIndex(x => x.id === p.id || who(x.id) === who(p.id));
    return k < 0 ? cup.teams[t].findIndex(x => lower(x.name) === lower(p.name)) : k;
  };
  const known = players.map(p => ({ p, t: teamOf(state, cup, p) }));
  for (const t of [0, 1]) sides[t] = known.filter(x => x.t === t).map(x => x.p).sort((a, b) => order(a) - order(b)).map(p => p.id);
  for (const { p, t } of known) if (t == null) sides[sides[0].length <= sides[1].length ? 0 : 1].push(p.id);
  const k = kind && CUP_KINDS[kind] ? kind : defaultKind(sides);
  const n = Math.max(0, Math.floor(rotate) || 0);
  return { kind: k, sides: k === 'fourball' ? sides.map(s => turned(s, n)) : [sides[0], turned(sides[1], n)] };
}

/**
 * Whether a round's game can count for the cup: matches use each player's own scores, so a game
 * played with one ball a team (a scramble, alternate shot, Chapman: round.js ONE_BALL_GAMES) can't.
 */
export const cupCounts = game => !oneBall(game);

/** A round's cup as it was saved, tidied to the round's own players, or null (always for a one-ball game). */
export function cleanRoundCup(round) {
  const c = round?.cup;
  if (!isObj(c) || !Array.isArray(c.sides) || !cupCounts(round.game)) return null;
  const ids = new Set((round.players || []).map(p => p.id));
  const seen = new Set();
  const sides = [0, 1].map(i => (Array.isArray(c.sides[i]) ? c.sides[i] : []).filter(id => ids.has(id) && !seen.has(id) && seen.add(id)));
  return { kind: CUP_KINDS[c.kind] ? c.kind : defaultKind(sides), sides };
}

/**
 * The matches a round's cup makes, paired off in each side's order: four-ball while both sides
 * have two left, then singles while both have one; anyone left over sits this round out.
 * [{ kind, sides: [[ids], [ids]] }], plus `out` (the ids sitting out).
 */
export function pairMatches(cup) {
  if (!cup) return { matches: [], out: [] };
  const [a, b] = cup.sides.map(s => [...s]);
  const matches = [];
  if (cup.kind === 'fourball') while (a.length >= 2 && b.length >= 2) matches.push({ kind: 'fourball', sides: [a.splice(0, 2), b.splice(0, 2)] });
  while (a.length && b.length) matches.push({ kind: 'singles', sides: [a.splice(0, 1), b.splice(0, 1)] });
  return { matches, out: [...a, ...b] };
}

/** "2 up", "3&2", "All square", "Halved". `left` holes still to play once it closed. */
function resultLabel({ by, left, closed, done }) {
  if (!by) return done ? 'Halved' : 'All square';
  return closed && left > 0 ? `${by}&${left}` : `${by} up`;
}

/**
 * One match, hole by hole in playing order, from the round's net scores (best ball for four-ball;
 * a player who left is carried by their partner, as in match play). Stops when it's closed out.
 * { thru, leader (0 | 1 | null), by, left, closed, done, winner (0 | 1 | null when halved or not done),
 *   points ([a, b] once done, else null), label }. A done match with no hole played is `void`.
 */
export function matchResult(round, match) {
  const total = round.holes.length;
  let up = 0, thru = 0, left = total, closed = false;
  for (let i = 0; i < total; i++) {
    const h = round.holes[i];
    const w = holeWinner(sideNet(round, match.sides[0], h), sideNet(round, match.sides[1], h));
    if (w === undefined) continue;
    thru++;
    if (w === 0) up++;
    else if (w === 1) up--;
    left = total - (i + 1);
    if (Math.abs(up) > left) { closed = true; break; }
  }
  const finished = round.status === 'done';
  const done = closed || finished || (thru === total);
  const leader = up > 0 ? 0 : up < 0 ? 1 : null;
  const by = Math.abs(up);
  const out = { thru, leader, by, left: closed ? left : finished ? 0 : total - thru, closed, done, winner: null, points: null };
  if (done && !thru) return { ...out, void: true, done: finished, label: 'Not played' };
  if (done) {
    out.winner = leader;
    out.points = leader === 0 ? [1, 0] : leader === 1 ? [0, 1] : [0.5, 0.5];
  }
  out.label = resultLabel({ by, left: out.left, closed, done });
  return out;
}

/** A round's matches with their results: [{ kind, sides, result }], and who sits out. */
export function roundCupResults(round) {
  const { matches, out } = pairMatches(cleanRoundCup(round));
  return { matches: matches.map(m => ({ ...m, result: matchResult(round, m) })), out };
}

// --------------------------- the whole trip ---------------------------

/** The key a round's matches go by on every phone: its live code, or its own id when it isn't shared. */
export const cupKey = round => codeOf(round) || `L${round.id}`;

/** A day (YYYY-MM-DD) in local time. */
const dayOf = t => {
  const d = new Date(t || 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * What a round puts on the cup, the same shape on every phone (and what goes to the server):
 * { key, status, at, day, course, holes, players: [{ id, name, team, acct }], matches: [{ kind, sides, result }] }.
 */
export function cupEntry(state, round) {
  const cup = cleanRoundCup(round);
  if (!cup) return null;
  const { matches } = roundCupResults(round);
  const team = id => (cup.sides[0].includes(id) ? 0 : cup.sides[1].includes(id) ? 1 : null);
  const acct = isObj(state?.accountOf) ? state.accountOf : {};
  return {
    key: cupKey(round), status: round.status === 'done' ? 'done' : 'active', at: round.createdAt || 0, day: dayOf(round.createdAt),
    course: round.course?.name || null, holes: round.holes.length,
    players: round.players.map(p => ({ id: p.id, name: p.name, team: team(p.id), ...(isStr(acct[p.id]) ? { acct: acct[p.id] } : {}) })),
    matches: matches.map(m => ({ kind: m.kind, sides: m.sides, result: pick(m.result) })),
  };
}
const pick = r => ({ thru: r.thru, leader: r.leader, by: r.by, left: r.left, closed: r.closed, done: r.done, winner: r.winner, points: r.points, label: r.label, ...(r.void ? { void: true } : {}) });

/** A round's matches as they came from the server, tidied, or null when it isn't one. */
export function cleanEntry(raw) {
  if (!isObj(raw) || !isStr(raw.key) || !Array.isArray(raw.players) || !Array.isArray(raw.matches)) return null;
  const players = raw.players.filter(p => isObj(p) && isStr(p.id)).slice(0, 8)
    .map(p => ({ id: p.id, name: String(p.name || '').slice(0, 40) || 'Player', team: p.team === 0 || p.team === 1 ? p.team : null, ...(isStr(p.acct) ? { acct: p.acct } : {}) }));
  const ids = new Set(players.map(p => p.id));
  const side = s => (Array.isArray(s) ? s.filter(id => ids.has(id)).slice(0, 2) : []);
  const num = (v, max = 99) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const matches = raw.matches.filter(isObj).slice(0, 8).map(m => {
    const r = isObj(m.result) ? m.result : {};
    const done = !!r.done && !r.void;
    const winner = done && (r.winner === 0 || r.winner === 1) ? r.winner : null;
    return {
      kind: CUP_KINDS[m.kind] ? m.kind : 'singles', sides: [side(m.sides?.[0]), side(m.sides?.[1])],
      result: {
        thru: num(r.thru), leader: r.leader === 0 || r.leader === 1 ? r.leader : null, by: num(r.by), left: num(r.left), closed: !!r.closed,
        done: !!r.done, winner, points: done ? (winner === 0 ? [1, 0] : winner === 1 ? [0, 1] : [0.5, 0.5]) : null,
        label: String(r.label || '').slice(0, 20), ...(r.void ? { void: true } : {}),
      },
    };
  }).filter(m => m.sides[0].length && m.sides[1].length);
  return {
    key: raw.key.slice(0, 64), status: raw.status === 'done' ? 'done' : 'active', at: Number(raw.at) || 0,
    day: /^\d{4}-\d{2}-\d{2}$/.test(raw.day) ? raw.day : null, course: isStr(raw.course) ? raw.course.slice(0, 60) : null,
    holes: num(raw.holes, 18), players, matches,
  };
}

/**
 * Every round's matches on the trip: this phone's own rounds (with their own cup), then rounds only
 * the server has told it about (another group's, from `state.cupRemote`), oldest first. Each entry
 * has `local` true when this phone has the round.
 */
export function cupEntries(state, tripId) {
  const out = new Map();
  for (const r of Object.values(state.rounds || {})) {
    if (r?.trip?.id !== tripId || (r.status !== 'done' && r.status !== 'active')) continue;
    const e = cupEntry(state, r);
    if (e) out.set(e.key, { ...e, local: true, roundId: r.id });
  }
  const remote = isObj(state.cupRemote?.[tripId]) ? state.cupRemote[tripId] : {};
  for (const [key, raw] of Object.entries(remote)) {
    if (key.startsWith('P') || out.has(key)) continue;
    // A round this phone has that isn't on the cup here (taken off the trip, or a one-ball game) stays
    // off, and so does the copy a round posted under its own id before it was shared live (it goes by its code now)
    if (Object.values(state.rounds || {}).some(r => `L${r.id}` === key || cupKey(r) === key)) continue;
    const e = cleanEntry({ ...raw, key });
    if (e) out.set(key, { ...e, local: false });
  }
  return [...out.values()].sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/**
 * Another group's round the server still has as being played, once the trip is over (the
 * organizer said so, or its last day has gone by): its phone stopped posting, so each match goes
 * to whoever led on the holes played, as in a round ended early, and one with no hole played
 * counts for nothing. Without this a group that never finished would hold up the cup for good.
 */
export function closeEntry(e) {
  if (e.status !== 'active') return e;
  const matches = e.matches.map(m => {
    const r = m.result;
    if (r.points || r.void) return m;
    if (!r.thru) return { ...m, result: { ...r, done: true, winner: null, points: null, void: true, label: 'Not played' } };
    const winner = r.leader === 0 || r.leader === 1 ? r.leader : null;
    const points = winner === 0 ? [1, 0] : winner === 1 ? [0, 1] : [0.5, 0.5];
    return { ...m, result: { ...r, done: true, winner, points, label: resultLabel({ by: winner == null ? 0 : r.by, left: 0, closed: false, done: true }) } };
  });
  return { ...e, status: 'done', matches };
}

/**
 * The team score: { points: [a, b], done (matches finished), live: [{ entry, match }], halved,
 * matches (every match, newest round first) }.
 */
export function cupScore(entries) {
  const points = [0, 0];
  const live = [];
  let done = 0;
  const all = [];
  for (const e of entries) {
    for (const m of e.matches) {
      if (m.result.void) continue;
      all.push({ entry: e, match: m });
      if (m.result.points) { points[0] += m.result.points[0]; points[1] += m.result.points[1]; done++; }
      else if (m.result.thru > 0 || e.status === 'active') live.push({ entry: e, match: m });
    }
  }
  return { points, done, live, matches: all.reverse() };
}

/**
 * Each player's record across the trip's matches, most points first: [{ key, id, name, team,
 * played, won, lost, halved, points }]. One person is one row: the same id on this phone, the same
 * account, or the same name on a round this phone doesn't have. `id` is null for someone known only
 * by name from another group's round.
 */
export function cupLeaderboard(state, entries) {
  const who = canonicalOf(state);
  const known = new Set(Object.keys(state.players || {}));
  for (const r of Object.values(state.rounds || {})) for (const p of r?.players || []) known.add(p.id);
  const byAcct = new Map();
  for (const [id, a] of Object.entries(isObj(state.accountOf) ? state.accountOf : {})) if (isStr(a) && !byAcct.has(a)) byAcct.set(a, who(id));
  const rows = new Map();
  const keyOf = p => {
    if (known.has(p.id)) return who(p.id);
    if (p.acct && byAcct.has(p.acct)) return byAcct.get(p.acct);
    return `n:${lower(p.name)}`;
  };
  for (const e of entries) {
    for (const m of e.matches) {
      if (!m.result.points) continue;
      for (const s of [0, 1]) {
        for (const pid of m.sides[s]) {
          const p = e.players.find(x => x.id === pid);
          if (!p) continue;
          const k = keyOf(p);
          const row = rows.get(k) || { key: k, id: k.startsWith('n:') ? null : k, name: p.name, team: s, played: 0, won: 0, lost: 0, halved: 0, points: 0 };
          row.played++;
          row.points += m.result.points[s];
          if (m.result.winner === s) row.won++;
          else if (m.result.winner == null) row.halved++;
          else row.lost++;
          row.team = s;
          rows.set(k, row);
        }
      }
    }
  }
  // Someone known only by name who is also someone this phone knows, by the same name: one row
  for (const [k, row] of [...rows]) {
    if (row.id) continue;
    const same = [...rows.values()].filter(x => x.id && lower(nameFor(state, x)) === k.slice(2));
    if (same.length !== 1) continue;
    const into = same[0];
    for (const f of ['played', 'won', 'lost', 'halved', 'points']) into[f] += row[f];
    rows.delete(k);
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.won - a.won || a.played - b.played || String(a.name).localeCompare(String(b.name)));
}
const nameFor = (state, row) => state.players?.[row.id]?.name || row.name;

// --------------------------- the stake ---------------------------

/**
 * The stake's payments once the cup is decided (`winner` 0 or 1): each player on the losing team
 * pays the stake, and each winner gets an even share of the pot (the odd cent to the first
 * winners). Paid in team order, losers' first player to winners' first, so every phone on the trip
 * works out the same payments. [{ key, from, to, amount, fromName, toName }], ids as the teams have
 * them. None when the cup is halved, there's no stake or a team is empty.
 */
export function stakeLines(cup, winner) {
  if (!cup || !cup.stake || (winner !== 0 && winner !== 1)) return [];
  const losers = cup.teams[1 - winner], winners = cup.teams[winner];
  if (!losers.length || !winners.length) return [];
  const each = cents(cup.stake);
  const pot = each * losers.length;
  const share = Math.floor(pot / winners.length);
  const due = winners.map((p, i) => share + (i < pot - share * winners.length ? 1 : 0));
  const lines = [];
  let w = 0;
  for (const l of losers) {
    let owe = each;
    while (owe > 0 && w < winners.length) {
      const c = Math.min(owe, due[w]);
      if (c > 0) {
        lines.push({ key: `${l.id}>${winners[w].id}`, from: l.id, to: winners[w].id, amount: c / 100, fromName: l.name, toName: winners[w].name });
        owe -= c; due[w] -= c;
      }
      if (!due[w]) w++;
    }
  }
  return lines;
}

/** Each person's stake once the cup is decided, by their id on the teams, in dollars (+ won, - paid). */
export function stakeBalances(cup, winner) {
  const out = {};
  for (const l of stakeLines(cup, winner)) {
    out[l.from] = Math.round(((out[l.from] || 0) - l.amount) * 100) / 100;
    out[l.to] = Math.round(((out[l.to] || 0) + l.amount) * 100) / 100;
  }
  return out;
}

/** The id of a stake payment marked on this phone. */
export const stakePaymentId = (tripId, key, at) => `cup:${tripId}:${key}:${Number(at || 0).toString(36)}`;

/** A stake payment mark, tidied, or null: { id, key, from, to, amount, at }. */
function cleanMark(m) {
  if (!isObj(m) || !isStr(m.id) || !isStr(m.key) || !isStr(m.from) || !isStr(m.to) || cents(m.amount) <= 0) return null;
  return { id: m.id.slice(0, 120), key: m.key.slice(0, 140), from: m.from, to: m.to, amount: cents(m.amount) / 100, at: Number(m.at) || 0, ...(isStr(m.byName) ? { byName: m.byName.slice(0, 40) } : {}) };
}

/**
 * Every stake payment marked for the trip: this phone's own (`state.cupPaid`, which it can undo)
 * and other phones' (from the server). [{ ...mark, mine }], newest first, each once.
 */
export function stakeMarks(state, tripId) {
  const out = new Map();
  for (const m of Array.isArray(state.cupPaid?.[tripId]) ? state.cupPaid[tripId] : []) {
    const c = cleanMark(m);
    if (c) out.set(c.id, { ...c, mine: true });
  }
  const remote = isObj(state.cupRemote?.[tripId]) ? state.cupRemote[tripId] : {};
  for (const [key, row] of Object.entries(remote)) {
    if (!key.startsWith('P') || !Array.isArray(row?.pays)) continue;
    for (const m of row.pays.slice(0, 100)) {
      const c = cleanMark(m);
      if (c && !out.has(c.id)) out.set(c.id, { ...c, mine: false, byName: c.byName || (isStr(row.byName) ? row.byName.slice(0, 40) : null) });
    }
  }
  return [...out.values()].sort((a, b) => b.at - a.at);
}

/** The stake lines with what's been marked on each: [{ ...line, paid (cents), open (cents), marks }]. */
export function stakeOpen(lines, marks) {
  return lines.map(l => {
    const on = marks.filter(m => m.key === l.key);
    const paid = on.reduce((a, m) => a + cents(m.amount), 0);
    return { ...l, paid, open: Math.max(0, cents(l.amount) - paid), marks: on };
  });
}

// --------------------------- what goes to the server ---------------------------

/** How far a round's matches have got, to tell an older copy from a newer one. */
const progress = e => (e?.matches || []).reduce((a, m) => a + (Number(m.result?.thru) || 0), 0) + (e?.status === 'done' ? 1000 : 0);

const myName = s => String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || null;

/**
 * What this phone should post for a trip now: [{ key, data }]. A round only this phone has, or one
 * it shared live, always; a round it joined only when the server has no copy, or an older one (the
 * phone that shared it may be out of signal). A round taken off the trip is posted as gone. And
 * this phone's stake marks, when there are any (`me`: this phone's key for them, cup-sync.js).
 */
export function cupPosts(s, trip, remote = {}, me = null) {
  const out = new Map();
  const same = (key, data) => remote[key] && stable(remote[key]) === stable(data);
  const live = key => !!remote[key] && !remote[key].gone;
  const posted = key => !!me && live(key) && remote[key].by === me;
  const claimed = new Set();
  for (const r of Object.values(s.rounds || {})) {
    if (r.status !== 'done' && r.status !== 'active') continue;
    const key = cupKey(r);
    const mine = !codeOf(r) || !!r.shared?.host;
    // Posted under its own id before it was shared live: that copy goes, or the round counts twice
    const old = `L${r.id}`;
    if (old !== key && (mine || posted(old)) && live(old)) out.set(old, { gone: true });
    if (r.trip?.id !== trip.id) {
      // Taken off the trip: it stops counting on every phone
      if ((mine || posted(key)) && live(key)) out.set(key, { gone: true });
      continue;
    }
    const e = cupEntry(s, r);
    if (!e) {
      if ((mine || posted(key)) && live(key)) out.set(key, { gone: true });
      continue;
    }
    claimed.add(key);
    // `by`: this phone posted it, so it can take it back if the round is deleted here
    const data = me ? { ...e, by: me } : e;
    if (same(key, data)) continue;
    if (mine || !remote[key] || progress(e) > progress(remote[key])) out.set(key, data);
  }
  // A round only this phone had, deleted here: it stops counting on every phone
  for (const key of Object.keys(remote)) if (key.startsWith('L') && !claimed.has(key) && !out.has(key) && posted(key)) out.set(key, { gone: true });
  const pays = Array.isArray(s.cupPaid?.[trip.id]) ? s.cupPaid[trip.id] : [];
  if (me && (pays.length || remote[me])) {
    const data = { byName: myName(s), pays };
    if (!same(me, data)) out.set(me, data);
  }
  return [...out].map(([key, data]) => ({ key, data }));
}
