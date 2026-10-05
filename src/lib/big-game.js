// The Big Game (ROADMAP area 5): a game of 8 to 20 players across several groups, feeding one
// pot and one leaderboard. An organizer sets it up for a day: the players, the groups (by hand, or
// balanced by handicap) and what's played across the whole field:
// - the pot: individual net or gross stroke play, or Stableford, with places paid (50/30/20, say),
// - field skins: one skin a hole across every group, with or without carries,
// - team best ball: teams that can be spread over different groups, the best one or two scores a hole,
// - side bets between any two players, in the same group or not: a match or per hole, with strokes
//   worked out between the two of them.
// Each group keeps score in its own live round (its own scorekeeper and keeper lock, as any shared
// round). This file works the whole field out from the groups' cards: the leaderboards while it's
// played, and once every group is in, each person's money and the fewest payments for all of it.
//
// A Big Game is a one-day trip (`format: 'big'`, trips.js), so its rounds carry the trip's stamp
// with the game in it (`trip.big`), and its money is trip money once it's decided (big-money.js):
// on the Tab, settled in one go. The rounds keep their own games and money, if they add any.
//
// The game: { v, at, hcPct, useHandicaps, people, groups, pot, skins, teams, bets, endedAt? }
// - v: the organizer's version, one more each change, so every phone takes the newest copy.
// - people: { id: { name, hc } }: everyone in it, by the organizer's ids (the ids in every group's
//   round), with their course handicap from setup (a round's own copy wins once it's being played).
// - groups: [{ id, name, players: [id], keeper, roundId, code }]: keeper is who's planned to keep
//   score, roundId and code the group's round and its live code once the groups are started.
// - pot: { on, kind: 'net' | 'gross' | 'stableford', stake, places: [pct] }
// - skins: { on, kind: 'net' | 'gross', stake, carry, out: [id] }: out sit the skins out.
// - teams: { on, kind: 'net' | 'gross', stake, best: 1 | 2, list: [{ id, name, players }], places }
// - bets: [{ id, kind: 'match' | 'hole', sides: [a, b], stake, strokes?: { to, count } }]
// Strokes for the field are full playing handicaps (course handicap at hcPct), never off the low,
// on each player's own card. Money is in whole cents and every format adds up to exactly $0.
// Pure, unit tested.
import { pickupGross, strokesOnHole } from './golf.js';
import { matchLabel, stablefordPoints } from './games.js';
import { playsHole } from './round.js';
import { betResult } from './pair-bets.js';
import { fewestPayments } from './ledger.js';

export const BIG_FORMAT = 'big';
/** The field: at least two groups, up to six foursomes. */
export const BIG_MIN_PLAYERS = 4;
export const BIG_MAX_PLAYERS = 24;
export const GROUP_MIN = 2;
export const GROUP_MAX = 5;
export const BIG_MAX_STAKE = 500;
export const BIG_MAX_BETS = 40;
export const BIG_NAME = 'Big Game';

export const POT_KINDS = {
  net: { name: 'Net stroke play', short: 'Net', blurb: 'Lowest net total wins. Strokes on the hardest holes, from each handicap.' },
  gross: { name: 'Gross stroke play', short: 'Gross', blurb: 'Lowest total wins, no strokes.' },
  stableford: { name: 'Stableford', short: 'Stableford', blurb: 'Points a hole: 2 for a net par, 3 a birdie, 1 a bogey. Most points wins.' },
};
export const SKINS_KINDS = { net: 'Net', gross: 'Gross' };
/** Places paid, in percent of the pot. */
export const PLACES = [
  { key: '1', label: 'Winner takes all', places: [100] },
  { key: '2', label: 'Top 2', places: [60, 40] },
  { key: '3', label: 'Top 3', places: [50, 30, 20] },
  { key: '4', label: 'Top 4', places: [40, 30, 20, 10] },
];
export const BIG_BET_KINDS = {
  match: { label: 'Match', help: 'Match play between the two of them, wherever they’re playing. Win more holes and the bet is theirs.' },
  hole: { label: 'Per hole', help: 'The bet on every hole one of them wins outright. Ties push.' },
};

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = v => typeof v === 'string' && v.length > 0;
const toCents = v => Math.round((Number(v) || 0) * 100);
const stakeOf = v => Math.min(BIG_MAX_STAKE, Math.max(0, Math.round((Number(v) || 0) * 100) / 100));
const first = n => String(n || '').trim().split(/\s+/)[0] || '?';

/** A new game's formats: a $20 net pot paying three places and $10 net skins, no teams. */
export function defaultBig() {
  return {
    v: 1, at: 0, hcPct: 95, useHandicaps: true, people: {}, groups: [],
    pot: { on: true, kind: 'net', stake: 20, places: [50, 30, 20] },
    skins: { on: true, kind: 'net', stake: 10, carry: false, out: [] },
    teams: { on: false, kind: 'net', stake: 10, best: 1, list: [], places: [100] },
    bets: [],
  };
}

/** Places paid, tidied: whole percents adding up to 100, at most six. Anything else pays the winner. */
export function cleanPlaces(p) {
  if (!Array.isArray(p)) return [100];
  const list = p.map(x => Math.round(Number(x) || 0)).filter(x => x > 0).slice(0, 6);
  return list.length && list.reduce((a, x) => a + x, 0) === 100 ? list : [100];
}

/** "50/30/20", or "Winner takes all". */
export function placesLabel(places) {
  const p = cleanPlaces(places);
  return p.length === 1 ? 'Winner takes all' : p.join('/');
}

/**
 * The game as setup or the server has it, tidied, or null when it isn't one. Anyone in two groups
 * stays in the first; a team, a bet or a skins opt-out naming someone not in the game is left out,
 * so a garbled copy can't move money.
 */
export function cleanBig(raw) {
  if (!isObj(raw)) return null;
  const base = defaultBig();
  const people = {};
  for (const [id, p] of Object.entries(isObj(raw.people) ? raw.people : {})) {
    if (!isStr(id) || !isObj(p)) continue;
    const hc = Number(p.hc);
    people[id] = { name: String(p.name || '').slice(0, 40), hc: p.hc == null || !Number.isFinite(hc) ? null : Math.max(-10, Math.min(60, Math.round(hc))) };
    if (Object.keys(people).length >= BIG_MAX_PLAYERS) break;
  }
  const seen = new Set();
  const groups = [];
  for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
    if (!isObj(g) || !isStr(g.id) || groups.some(x => x.id === g.id)) continue;
    const players = (Array.isArray(g.players) ? g.players : []).filter(id => isStr(id) && people[id] && !seen.has(id)).slice(0, GROUP_MAX);
    players.forEach(id => seen.add(id));
    groups.push({
      id: g.id, name: String(g.name || '').replace(/\s+/g, ' ').trim().slice(0, 24) || `Group ${groups.length + 1}`, players,
      keeper: players.includes(g.keeper) ? g.keeper : null,
      roundId: isStr(g.roundId) ? g.roundId.slice(0, 64) : null,
      code: isStr(g.code) && /^[A-Z0-9]{6}$/.test(g.code) ? g.code : null,
    });
    if (groups.length >= 8) break;
  }
  const inGame = id => seen.has(id);
  const kindOf = (v, kinds, def) => (Object.prototype.hasOwnProperty.call(kinds, v) ? v : def);
  const pot = isObj(raw.pot) ? raw.pot : {};
  const skins = isObj(raw.skins) ? raw.skins : {};
  const teams = isObj(raw.teams) ? raw.teams : {};
  const inTeam = new Set();
  const list = [];
  for (const t of Array.isArray(teams.list) ? teams.list : []) {
    if (!isObj(t) || !isStr(t.id) || list.some(x => x.id === t.id)) continue;
    const players = (Array.isArray(t.players) ? t.players : []).filter(id => inGame(id) && !inTeam.has(id)).slice(0, 4);
    players.forEach(id => inTeam.add(id));
    if (players.length) list.push({ id: t.id, name: String(t.name || '').trim().slice(0, 24) || `Team ${list.length + 1}`, players });
  }
  const bets = [];
  for (const b of Array.isArray(raw.bets) ? raw.bets : []) {
    if (!isObj(b) || !isStr(b.id) || bets.some(x => x.id === b.id) || !BIG_BET_KINDS[b.kind]) continue;
    if (!Array.isArray(b.sides) || b.sides.length !== 2 || b.sides[0] === b.sides[1] || !b.sides.every(inGame)) continue;
    const stake = stakeOf(b.stake);
    if (!(stake > 0)) continue;
    const bet = { id: b.id, kind: b.kind, sides: [...b.sides], stake };
    const count = Math.min(36, Math.max(0, Math.floor(Number(b.strokes?.count) || 0)));
    if (isObj(b.strokes) && b.sides.includes(b.strokes.to) && count) bet.strokes = { to: b.strokes.to, count };
    bets.push(bet);
    if (bets.length >= BIG_MAX_BETS) break;
  }
  const out = {
    v: Math.max(1, Math.floor(Number(raw.v) || 1)), at: Number(raw.at) || 0,
    hcPct: Math.min(100, Math.max(0, Math.round(Number(raw.hcPct ?? base.hcPct)))) || 0,
    useHandicaps: raw.useHandicaps !== false,
    people, groups,
    pot: { on: pot.on !== false, kind: kindOf(pot.kind, POT_KINDS, 'net'), stake: stakeOf(pot.stake ?? base.pot.stake), places: cleanPlaces(pot.places ?? base.pot.places) },
    skins: { on: skins.on !== false, kind: kindOf(skins.kind, SKINS_KINDS, 'net'), stake: stakeOf(skins.stake ?? base.skins.stake), carry: !!skins.carry, out: (Array.isArray(skins.out) ? skins.out : []).filter(inGame) },
    teams: { on: !!teams.on && list.length > 1, kind: kindOf(teams.kind, SKINS_KINDS, 'net'), stake: stakeOf(teams.stake ?? base.teams.stake), best: teams.best === 2 ? 2 : 1, list, places: cleanPlaces(teams.places ?? base.teams.places) },
    bets,
  };
  if (Number(raw.endedAt) > 0) out.endedAt = Number(raw.endedAt);
  return out;
}

/** Everyone in the game, group by group: [id]. */
export const bigPlayers = big => big.groups.flatMap(g => g.players);
/** The group someone plays in, or null. */
export const groupOf = (big, id) => big.groups.find(g => g.players.includes(id)) || null;
/** A first name for someone in the game. */
export const bigName = (big, id) => first(big.people[id]?.name);

// --------------------------- Groups and teams ------------------------------

/** How many groups a field of `n` makes: foursomes, with threesomes (or a fivesome) to fit. */
export function groupCount(n) {
  return Math.max(2, Math.round(n / 4), Math.ceil(n / GROUP_MAX));
}

/**
 * Groups balanced by handicap: best to worst dealt out like a snake draft (1 2 3 3 2 1), so every
 * group gets a low, a high and two in between. `people` [{ id, hc }]; null handicaps go last.
 * Returns arrays of ids, one a group.
 */
export function balanceGroups(people, count = groupCount(people.length)) {
  const n = Math.max(1, Math.min(count, people.length));
  const sorted = [...people].sort((a, b) => (a.hc ?? 99) - (b.hc ?? 99) || String(a.id).localeCompare(String(b.id)));
  const out = Array.from({ length: n }, () => []);
  sorted.forEach((p, i) => {
    const round = Math.floor(i / n), at = i % n;
    out[round % 2 ? n - 1 - at : at].push(p.id);
  });
  return out;
}

/**
 * Teams balanced by handicap for team best ball: the best player with the worst, the second best
 * with the second worst, and so on (pairs), or a snake over four for teams of four. A spare player
 * goes in the last team. With `groups` (lists of ids), two pairs next to each other whose partners
 * are both in one group swap their second players when that puts each pair across two groups, so
 * partners play in different groups (groups balanced by handicap would otherwise line them up in
 * the same group every time). Returns arrays of ids.
 */
export function balanceTeams(people, size = 2, { groups = null } = {}) {
  const sorted = [...people].sort((a, b) => (a.hc ?? 99) - (b.hc ?? 99) || String(a.id).localeCompare(String(b.id)));
  const count = Math.max(1, Math.floor(sorted.length / size));
  if (size === 2) {
    const out = [];
    for (let i = 0; i < count; i++) out.push([sorted[i].id, sorted[sorted.length - 1 - i].id]);
    const gOf = id => (groups || []).findIndex(g => g.includes(id));
    const apart = (a, b) => gOf(a) >= 0 && gOf(b) >= 0 && gOf(a) !== gOf(b);
    if (groups?.length > 1) {
      for (let i = 0; i + 1 < out.length; i++) {
        const [p, q] = [out[i], out[i + 1]];
        if (apart(p[0], p[1]) || apart(q[0], q[1])) continue;
        if (apart(p[0], q[1]) && apart(q[0], p[1])) { [p[1], q[1]] = [q[1], p[1]]; i++; }
      }
    }
    const spare = sorted.slice(count, sorted.length - count).map(p => p.id);
    if (spare.length) out[out.length - 1].push(...spare);
    return out;
  }
  return balanceGroups(sorted, count);
}

/** Move someone to another group (or team) in a list of id arrays, keeping everyone else's place. */
export function moveTo(lists, id, to) {
  return lists.map((l, i) => (i === to ? [...l.filter(x => x !== id), id] : l.filter(x => x !== id)));
}

/** What's wrong with the groups for starting, in a line, or null: too many, too few, someone left out. */
export function groupsProblem(big) {
  const all = Object.keys(big.people);
  const placed = bigPlayers(big);
  if (all.length < BIG_MIN_PLAYERS) return `A Big Game needs at least ${BIG_MIN_PLAYERS} players.`;
  if (big.groups.length < 2) return 'Make at least two groups.';
  const small = big.groups.find(g => g.players.length < GROUP_MIN);
  if (small) return `${small.name} needs at least ${GROUP_MIN} players.`;
  const left = all.filter(id => !placed.includes(id));
  if (left.length) return `${left.map(id => bigName(big, id)).join(', ')} ${left.length === 1 ? 'isn’t' : 'aren’t'} in a group yet.`;
  return null;
}

/** Strokes between two players in a side bet: the difference of their playing handicaps, to the higher one. */
export function betStrokesFor(big, a, b, hcOf = id => big.people[id]?.hc) {
  if (!big.useHandicaps) return null;
  const play = id => Math.round((Number(hcOf(id)) || 0) * (big.hcPct / 100));
  const d = play(a) - play(b);
  if (!d) return null;
  return { to: d > 0 ? a : b, count: Math.min(36, Math.abs(d)) };
}

// --------------------------- The field ---------------------------------------
// A card is a group's round as this phone has it: its own copy, or the copy fetched from the
// group's live round (big-sync.js), with players, holes, scores, left/joined and status.

/**
 * The field on this phone: every group with its card (or none yet), every player's card and
 * playing handicap, and the holes in order. `cardOf(group)` gives the group's card or null.
 * `ended`: the organizer closed the game, so a card still being played counts as it stands.
 */
export function bigField(big, cardOf, { ended = false } = {}) {
  const groups = big.groups.map(g => {
    const card = cardOf(g) || null;
    const done = !!card && card.status === 'done';
    const thru = card ? thruOf(card, g.players) : 0;
    return { ...g, card, done, status: !card ? 'waiting' : done ? 'done' : 'live', thru, holes: card?.holes?.length || 0 };
  });
  const holes = new Map();
  for (const g of groups) for (const h of g.card?.holes || []) if (!holes.has(h.no)) holes.set(h.no, { no: h.no, par: h.par, hdcp: h.hdcp, rank: h.rank });
  const list = [...holes.values()].sort((a, b) => a.no - b.no);
  const players = new Map();
  for (const g of groups) {
    for (const id of g.players) {
      const seat = g.card?.players?.find(p => p.id === id) || null;
      const hc = seat?.courseHc ?? big.people[id]?.hc ?? null;
      players.set(id, { id, group: g.id, card: seat ? g.card : null, closed: g.done || ended, plays: big.useHandicaps ? Math.round((Number(hc) || 0) * (big.hcPct / 100)) : 0, hc });
    }
  }
  return { groups, holes: list, players, ended, final: groups.length > 0 && groups.every(g => g.card) && (groups.every(g => g.done) || ended) };
}

/** Holes in a row from the start with every one of the group's players in or out: "thru 7". */
function thruOf(card, ids) {
  let n = 0;
  for (const h of card.holes || []) {
    const s = card.scores?.[h.no] || {};
    const who = ids.filter(id => card.players?.some(p => p.id === id) && playsHole(card, id, h));
    if (!who.length || !who.every(id => s[id] != null)) break;
    n++;
  }
  return n;
}

/**
 * One player's score on a hole number: { gross, net, strokes, par } (a pickup is net double bogey),
 * null with no score yet, or { out: true } when there won't be one (they left, the hole isn't on
 * their card, or their card is finished or the game closed without it).
 */
export function scoreOn(field, id, no) {
  const p = field.players.get(id);
  if (!p?.card) return field.final ? { out: true } : null;
  const hole = p.card.holes.find(h => h.no === no);
  if (!hole || !playsHole(p.card, id, hole)) return { out: true };
  const raw = p.card.scores?.[no]?.[id];
  if (raw == null) return p.closed ? { out: true } : null;
  const strokes = strokesOnHole(p.plays, hole.rank, p.card.holes.length);
  const gross = raw === 'X' ? pickupGross(hole.par, strokes) : Number(raw);
  return { gross, net: gross - strokes, strokes, par: hole.par };
}

const valueOf = (s, kind) => (kind === 'gross' ? s.gross : s.net);

// --------------------------- Paying out ----------------------------------------

/**
 * Split `total` cents by weight to the cent, nothing made or lost: each gets their share rounded
 * down, then the spare cents go to the biggest remainders (ties in the order given).
 * `weights` [{ id, w }], the same id twice adds up. Returns { id: cents }.
 */
export function allot(total, weights) {
  const list = weights.filter(x => x.w > 0);
  const W = list.reduce((a, x) => a + x.w, 0);
  if (!list.length || !(W > 0) || !(total > 0)) return {};
  const parts = list.map((x, i) => { const exact = (total * x.w) / W; return { id: x.id, base: Math.floor(exact + 1e-9), frac: exact - Math.floor(exact + 1e-9), i }; });
  let spare = total - parts.reduce((a, x) => a + x.base, 0);
  for (const x of [...parts].sort((a, b) => b.frac - a.frac || a.i - b.i)) { if (spare <= 0) break; x.base++; spare--; }
  const out = {};
  for (const x of parts) out[x.id] = (out[x.id] || 0) + x.base;
  return out;
}

/**
 * The pot paid by place: `rows` best first ({ id, value }, equal values tie), `places` in percent.
 * Tied players share the places they cover. With fewer finishers than places, the places nobody
 * reached go to the ones paid, in the same proportions. Returns { id: cents won }.
 */
export function payPlaces(rows, pool, places) {
  if (!rows.length || pool <= 0) return {};
  const pcts = cleanPlaces(places).slice(0, rows.length);
  const sum = pcts.reduce((a, x) => a + x, 0);
  const weights = [];
  let pos = 0;
  while (pos < rows.length && pos < pcts.length) {
    let end = pos;
    while (end + 1 < rows.length && rows[end + 1].value === rows[pos].value) end++;
    const share = pcts.slice(pos, end + 1).reduce((a, x) => a + x, 0) / sum;
    for (let i = pos; i <= end; i++) weights.push({ id: rows[i].id, w: share / (end - pos + 1) });
    pos = end + 1;
  }
  return allot(pool, weights);
}

/** "1", "T2": places with ties, for rows already sorted with a `value` to compare. */
export function placeLabels(rows) {
  return rows.map(r => {
    if (r.value == null) return '–';
    const at = rows.findIndex(x => x.value === r.value);
    const tied = rows.filter(x => x.value === r.value).length > 1;
    return `${tied ? 'T' : ''}${at + 1}`;
  });
}

// --------------------------- The pot ------------------------------------------

/**
 * The individual leaderboard: [{ id, group, thru, gross, net, toPar, points, complete, value, place }]
 * best first. Stroke play ranks by to par on the holes in (net or gross), Stableford by points; once
 * the game is decided only a full card places in stroke play (a Stableford card counts as it is).
 */
export function potBoard(big, field) {
  const kind = big.pot.kind;
  const rows = [];
  for (const id of bigPlayers(big)) {
    const p = field.players.get(id);
    let thru = 0, gross = 0, net = 0, par = 0, points = 0, missing = 0;
    for (const h of field.holes) {
      const s = scoreOn(field, id, h.no);
      if (!s) continue;
      if (s.out) { if (p?.card?.holes.some(x => x.no === h.no)) missing++; continue; }
      thru++; gross += s.gross; net += s.net; par += s.par;
      points += stablefordPoints(big.useHandicaps ? s.net : s.gross, s.par);
    }
    const holes = p?.card?.holes.length || field.holes.length;
    const complete = !!p?.card && thru === holes && !missing;
    const toPar = thru ? (kind === 'gross' ? gross - par : net - par) : null;
    const value = kind === 'stableford' ? (thru || field.final ? -points : null) : field.final ? (complete ? toPar : null) : toPar;
    rows.push({ id, group: p?.group || null, thru, gross, net, toPar, points, complete, value });
  }
  rows.sort((a, b) => (a.value == null) - (b.value == null) || (a.value ?? 0) - (b.value ?? 0) || b.thru - a.thru || bigName(big, a.id).localeCompare(bigName(big, b.id)) || a.id.localeCompare(b.id));
  const places = placeLabels(rows);
  return rows.map((r, i) => ({ ...r, place: places[i] }));
}

/** What the pot pays, once decided: { pool, won: { id: cents }, balances: { id: cents } }. */
export function potMoney(big, field, board = potBoard(big, field)) {
  const ids = bigPlayers(big);
  const stake = toCents(big.pot.stake);
  if (!big.pot.on || !stake || !ids.length) return { pool: 0, won: {}, balances: {} };
  const pool = stake * ids.length;
  const placed = board.filter(r => r.value != null);
  const won = placed.length ? payPlaces(placed, pool, big.pot.places) : Object.fromEntries(ids.map(id => [id, stake]));
  const balances = Object.fromEntries(ids.map(id => [id, (won[id] || 0) - stake]));
  return { pool, won, balances };
}

// --------------------------- Field skins -----------------------------------------

/** Who's in the skins: everyone in the game but the ones who sat out. */
export const skinsPlayers = big => bigPlayers(big).filter(id => !big.skins.out.includes(id));

/**
 * Field skins, hole by hole across every group: [{ no, state: 'open' | 'won' | 'tied' | 'none', winner,
 * score, tied: [ids], carry }]. A hole is decided once everyone in the skins has a score on it or
 * won't get one; the lowest score on it alone wins the skin (net or gross). With carries, a tied hole
 * carries to the next: `carry` is how many holes the skin won (or carried) is worth.
 */
export function skinsBoard(big, field) {
  const ids = skinsPlayers(big);
  const out = [];
  let carry = 0;
  for (const h of field.holes) {
    const scores = ids.map(id => ({ id, s: scoreOn(field, id, h.no) }));
    if (scores.some(x => x.s == null)) { out.push({ no: h.no, state: 'open', winner: null, score: null, tied: [], carry: 0 }); continue; }
    const live = scores.filter(x => !x.s.out).map(x => ({ id: x.id, v: valueOf(x.s, big.skins.kind) }));
    const worth = 1 + (big.skins.carry ? carry : 0);
    if (!live.length) { out.push({ no: h.no, state: 'none', winner: null, score: null, tied: [], carry: worth }); carry = big.skins.carry ? carry + 1 : 0; continue; }
    const low = Math.min(...live.map(x => x.v));
    const at = live.filter(x => x.v === low);
    if (at.length === 1) { out.push({ no: h.no, state: 'won', winner: at[0].id, score: low, tied: [], carry: worth }); carry = 0; }
    else { out.push({ no: h.no, state: 'tied', winner: null, score: low, tied: at.map(x => x.id), carry: worth }); carry = big.skins.carry ? carry + 1 : 0; }
  }
  return out;
}

/**
 * What the skins pay: { pool, skins: { id: count }, won: { id: cents }, balances, perSkin, leftover }.
 * Without carries the pot is split by skins won. With carries each hole is worth an equal part of the
 * pot, a tie carries its part on, and whatever is still carried after the last hole is shared
 * equally by every skin won. No skins at all: everyone gets their money back.
 */
export function skinsMoney(big, field, board = skinsBoard(big, field)) {
  const ids = skinsPlayers(big);
  const stake = toCents(big.skins.stake);
  const skins = {};
  for (const h of board) if (h.state === 'won') skins[h.winner] = (skins[h.winner] || 0) + 1;
  if (!big.skins.on || !stake || ids.length < 2) return { pool: 0, skins, won: {}, balances: {}, perSkin: 0, leftover: 0 };
  const pool = stake * ids.length;
  const total = Object.values(skins).reduce((a, n) => a + n, 0);
  let won;
  let leftover = 0;
  if (!total) won = Object.fromEntries(ids.map(id => [id, stake]));
  else if (!big.skins.carry) won = allot(pool, Object.entries(skins).map(([id, n]) => ({ id, w: n })));
  else {
    // Units: each hole is one part of the pot; a skin takes its hole and every hole carried into it
    const decided = board.filter(h => h.state !== 'open');
    const units = {};
    for (const h of decided) if (h.state === 'won') units[h.winner] = (units[h.winner] || 0) + h.carry;
    const last = decided.at(-1);
    leftover = last && last.state !== 'won' ? last.carry : 0;
    const w = Object.entries(units).map(([id, u]) => ({ id, w: u + (skins[id] * leftover) / total }));
    won = allot(pool, w);
  }
  const balances = Object.fromEntries(ids.map(id => [id, (won[id] || 0) - stake]));
  return { pool, skins, won, balances, perSkin: total ? Math.round(pool / total) : 0, leftover };
}

// --------------------------- Team best ball -----------------------------------------

/**
 * Teams across the groups, the best one (or two) scores on each hole counting: [{ id, name, players,
 * thru, total, toPar, value, place }] best first. A team's hole counts once each of its players has a
 * score on it or won't get one; a ball missing then counts as net double bogey (par + 2).
 */
export function teamsBoard(big, field) {
  if (!big.teams.on) return [];
  const kind = big.teams.kind;
  const rows = big.teams.list.map(t => {
    const best = Math.min(big.teams.best, t.players.length);
    let thru = 0, total = 0, par = 0, open = 0;
    for (const h of field.holes) {
      const scores = t.players.map(id => scoreOn(field, id, h.no));
      if (scores.some(s => s == null)) { open++; continue; }
      const vals = scores.filter(s => !s.out).map(s => valueOf(s, kind)).sort((a, b) => a - b).slice(0, best);
      while (vals.length < best) vals.push(h.par + 2);
      thru++;
      total += vals.reduce((a, v) => a + v, 0);
      par += h.par * best;
    }
    const value = thru ? (field.final && open ? null : total - par) : null;
    return { id: t.id, name: t.name, players: t.players, best, thru, total, toPar: thru ? total - par : null, value };
  });
  rows.sort((a, b) => (a.value == null) - (b.value == null) || (a.value ?? 0) - (b.value ?? 0) || b.thru - a.thru || a.name.localeCompare(b.name));
  const places = placeLabels(rows);
  return rows.map((r, i) => ({ ...r, place: places[i] }));
}

/** What team best ball pays: each player on a team puts in the stake, a team's place is split among its players. */
export function teamsMoney(big, field, board = teamsBoard(big, field)) {
  const stake = toCents(big.teams.stake);
  const ids = big.teams.list.flatMap(t => t.players);
  if (!big.teams.on || !stake || big.teams.list.length < 2) return { pool: 0, won: {}, balances: {} };
  const pool = stake * ids.length;
  const placed = board.filter(r => r.value != null);
  const byTeam = placed.length ? payPlaces(placed, pool, big.teams.places) : Object.fromEntries(big.teams.list.map(t => [t.id, stake * t.players.length]));
  const won = {};
  for (const t of big.teams.list) Object.assign(won, allot(byTeam[t.id] || 0, t.players.map(id => ({ id, w: 1 }))));
  const balances = Object.fromEntries(ids.map(id => [id, (won[id] || 0) - stake]));
  return { pool, won, balances };
}

// --------------------------- Side bets --------------------------------------------

/**
 * Two players' scores side by side as a two-player round, whichever groups they're in, so a side bet
 * between them is worked out exactly like one inside a round (pair-bets.js): the holes in order, each
 * one's own scores, and a hole they won't both play left out.
 */
export function pairCard(field, a, b) {
  const players = [a, b].map(id => ({ id, name: id, plays: 0 }));
  const scores = {};
  const left = {};
  for (const h of field.holes) {
    for (const id of [a, b]) {
      const s = scoreOn(field, id, h.no);
      const p = field.players.get(id);
      const raw = p?.card?.scores?.[h.no]?.[id];
      if (s && !s.out && raw != null) scores[h.no] = { ...(scores[h.no] || {}), [id]: raw };
    }
  }
  // A hole only one of them can still play is never going to be complete: it just doesn't count
  return { id: `pair:${a}:${b}`, game: 'stroke', players, holes: field.holes.map(h => ({ ...h })), scores, left, status: field.final ? 'done' : 'active' };
}

/** Each side bet as it stands: [{ bet, result (pair-bets.js betResult), line }], `line` like "Mike 2 up thru 9". */
export function betsBoard(big, field) {
  return big.bets.map(bet => {
    const card = pairCard(field, ...bet.sides);
    const result = betResult(card, bet);
    const name = id => bigName(big, id);
    let line;
    if (!result.holes.length) line = 'Not started';
    else if (bet.kind === 'match') line = `${matchLabel(result.status, result.status.leader == null ? null : name(bet.sides[result.status.leader]))}${result.status.left > 0 && !field.final ? ` thru ${result.holes.length}` : ''}`;
    else line = result.wins[0] === result.wins[1] ? `All square, ${result.wins[0]} each` : `${name(bet.sides[result.wins[0] > result.wins[1] ? 0 : 1])} ${Math.max(...result.wins)}–${Math.min(...result.wins)}`;
    return { bet, result, line };
  });
}

/** What the side bets pay: { balances: { id: cents } }. */
export function betsMoney(big, field, board = betsBoard(big, field)) {
  const balances = {};
  for (const { bet, result } of board) {
    const c = toCents(result.amount);
    if (!c) continue;
    const [a, b] = bet.sides;
    balances[a] = (balances[a] || 0) + c;
    balances[b] = (balances[b] || 0) - c;
  }
  return { balances };
}

// --------------------------- All of it --------------------------------------------

/** Everything on one phone: the boards while it's played, and once decided, the money. */
export function bigResults(big, field) {
  const pot = big.pot.on ? potBoard(big, field) : [];
  const skins = big.skins.on ? skinsBoard(big, field) : [];
  const teams = teamsBoard(big, field);
  const bets = betsBoard(big, field);
  const money = {
    pot: big.pot.on ? potMoney(big, field, pot) : { pool: 0, won: {}, balances: {} },
    skins: big.skins.on ? skinsMoney(big, field, skins) : { pool: 0, skins: {}, won: {}, balances: {} },
    teams: teamsMoney(big, field, teams),
    bets: betsMoney(big, field, bets),
  };
  const balances = {};
  for (const part of Object.values(money)) for (const [id, c] of Object.entries(part.balances)) if (c) balances[id] = (balances[id] || 0) + c;
  return { pot, skins, teams, bets, money, balances, final: field.final };
}

/**
 * The fewest payments that square the game's money, in the organizer's ids, worked out the same
 * way on every phone that has the same cards: [{ from, to, cents }], biggest first.
 */
export function bigLines(balances) {
  const ids = Object.keys(balances).filter(id => balances[id]).sort();
  if (!ids.length) return [];
  return fewestPayments(Object.fromEntries(ids.map(id => [id, balances[id] / 100])))
    .map(t => ({ from: t.from, to: t.to, cents: toCents(t.amount) }))
    .filter(t => t.cents > 0);
}

/** "$20 net pot, top 3 · $10 net skins · $10 team best ball", what's on the game. */
export function bigSummary(big, fmt) {
  const parts = [];
  if (big.pot.on) parts.push(`${fmt(big.pot.stake)} ${POT_KINDS[big.pot.kind].short.toLowerCase()} pot, ${placesLabel(big.pot.places).toLowerCase()}`);
  if (big.skins.on) parts.push(`${fmt(big.skins.stake)} ${SKINS_KINDS[big.skins.kind].toLowerCase()} skins${big.skins.carry ? ' with carries' : ''}`);
  if (big.teams.on) parts.push(`${fmt(big.teams.stake)} team best ${big.teams.best === 2 ? 'two' : 'ball'}`);
  if (big.bets.length) parts.push(`${big.bets.length} side bet${big.bets.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** What each person puts in up front (the pot, the skins, their team): { id: cents }. */
export function buyIns(big) {
  const out = {};
  const add = (id, c) => { if (c) out[id] = (out[id] || 0) + c; };
  if (big.pot.on) for (const id of bigPlayers(big)) add(id, toCents(big.pot.stake));
  if (big.skins.on && skinsPlayers(big).length > 1) for (const id of skinsPlayers(big)) add(id, toCents(big.skins.stake));
  if (big.teams.on) for (const id of big.teams.list.flatMap(t => t.players)) add(id, toCents(big.teams.stake));
  return out;
}

/**
 * The game's day once its groups start (`today` YYYY-MM-DD): today when the day it was set for has
 * gone by, so the game's day is its rounds' day, else as it was ({} for no change).
 */
export function startDay(trip, today) {
  return trip?.start && today && trip.start < today ? { start: today, end: today } : {};
}

/** Whether the game has started: a group's round has a score in it. Then its formats and groups stay as they are. */
export function bigStarted(field) {
  return field.groups.some(g => g.card && Object.values(g.card.scores || {}).some(s => s && Object.values(s).some(v => v != null)));
}
