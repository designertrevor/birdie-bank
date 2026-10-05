// The Big Game on this phone (big-game.js has the math): which copy of the game counts, each
// group's card (its round here, or the copy fetched from its live round, big-sync.js), the boards,
// and once every group is in, the game's money as trip money, the way a decided cup stake is
// (cup-stake.js): each of the fewest payments that square the game is money between those two
// people on the trip, so the Tab, Where it comes from and Settle the game all take it like a trip
// expense the winner paid for the loser, and paying it is a payment for trip money
// (trip-expenses.js newPayment) that reaches every phone in the game's rounds.
//
// Every phone works the payments out from the same cards and the same copy of the game, in the
// organizer's ids (the ids in every group's round), so they're the same lines on every phone;
// each phone then knows each person by its own id for them (people-links.js), the way it knows
// them in the rounds. Until every group's card is on this phone (another group's round can't be
// fetched yet, or is still being played), the game has no money here at all: never part of it.
// Pure, unit tested.
import { BIG_FORMAT, BIG_NAME, bigField, bigLines, bigResults, bigStarted, cleanBig, groupOf } from './big-game.js';
import { canonicalOf, codeOf, finishedAt } from './pair-debts.js';
import { cleanPlan } from './trip-plan.js';
import { meFor } from './format.js';
import { betsOf } from './pair-bets.js';

/** The id the game's line between two people goes by as trip money: "big:<tripId>:<from>><to>". */
export const bigMoneyId = (tripId, from, to) => `big:${tripId}:${from}>${to}`;
export const isBigMoney = x => !!x?.big;

/** The game's rounds on this phone: every round stamped with it, oldest first. */
export function bigRounds(state, tripId) {
  return Object.values(state.rounds || {}).filter(r => r?.trip?.id === tripId).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * The copy of the game that counts on this phone: the newest version among the organizer's own
 * record, the stamps on the game's rounds here, the cards fetched from the other groups, and the
 * copy the organizer's phone put on the server. Null when this phone doesn't know the game.
 */
export function bigOf(state, tripId) {
  const list = [];
  const rec = state.trips?.[tripId];
  if (rec?.big) list.push({ big: rec.big, rank: 3 });
  const server = state.bigRemote?.[tripId];
  if (server?.big) list.push({ big: server.big, rank: 2, endedAt: server.endedAt });
  for (const r of bigRounds(state, tripId)) if (r.trip?.big) list.push({ big: r.trip.big, rank: 1 });
  for (const c of Object.values(state.bigCards?.[tripId] || {})) if (c?.trip?.id === tripId && c.trip.big) list.push({ big: c.trip.big, rank: 0 });
  let best = null;
  for (const x of list) {
    const b = cleanBig(x.big);
    if (!b) continue;
    if (!best || b.v > best.big.v || (b.v === best.big.v && x.rank > best.rank)) best = { big: b, rank: x.rank };
  }
  return best?.big || null;
}

/** A group's card on this phone: its round here (by id or live code), else the copy fetched from its live round. */
export function cardFor(state, tripId, group, rounds = bigRounds(state, tripId)) {
  const here = rounds.find(r => (group.roundId && r.id === group.roundId) || (group.code && codeOf(r) === group.code));
  if (here) return here;
  const cards = state.bigCards?.[tripId] || {};
  return (group.code && cards[group.code]) || (group.roundId && Object.values(cards).find(c => c?.id === group.roundId)) || null;
}

/** When the organizer closed the game early, from any copy this phone has: their record, the game, or the trip's plan. */
function endedOf(state, tripId, big) {
  return state.trips?.[tripId]?.endedAt || big?.endedAt || state.bigRemote?.[tripId]?.endedAt || cleanPlan(state.tripPlans?.[tripId])?.endedAt || null;
}

const cache = new WeakMap();

/**
 * Everything about the game on this phone: { big, field, results, final, started, ended, lines,
 * waiting, rounds }, or null when it isn't a Big Game this phone knows. `lines` are the fewest
 * payments (organizer's ids) once it's decided, else []. `waiting`: groups whose card isn't here yet.
 */
export function bigStatus(state, tripId) {
  let byState = cache.get(state);
  if (!byState) { byState = new Map(); cache.set(state, byState); }
  if (byState.has(tripId)) return byState.get(tripId);
  const big = bigOf(state, tripId);
  let out = null;
  if (big) {
    const rounds = bigRounds(state, tripId);
    const ended = endedOf(state, tripId, big);
    const field = bigField(big, g => cardFor(state, tripId, g, rounds), { ended: !!ended });
    const results = bigResults(big, field);
    out = {
      big, field, results, final: field.final, started: bigStarted(field), ended, rounds,
      lines: field.final ? bigLines(results.balances) : [],
      waiting: field.groups.filter(g => !g.card),
    };
  }
  byState.set(tripId, out);
  return out;
}

/** Big Game ids this phone knows, from its records and the stamps on its rounds. */
export function bigTripIds(state) {
  const ids = new Set();
  for (const t of Object.values(state.trips || {})) if (t?.format === BIG_FORMAT && t.id) ids.add(t.id);
  for (const r of Object.values(state.rounds || {})) if (r?.trip?.format === BIG_FORMAT && r.trip.id) ids.add(r.trip.id);
  return [...ids];
}

/** How someone in the game is written into a payment between two of them: by their seat in their group's round, so every phone places them. */
function personIn(st, id, name) {
  const g = groupOf(st.big, id);
  return { id, name: String(name || '').slice(0, 40), refs: g?.code ? [`${g.code}:${id}`] : [] };
}

/**
 * The decided game as trip money on this phone, one entry a line: shaped like a trip expense as
 * trip-expenses.js resolves one, the one owed as the payer and the one who owes in it, so the Tab,
 * Settle the game and Where it comes from take it as they take an expense ({ id, tripId, big: true,
 * what, payer, parts, balances, cents, amount, names, at, raw }, ids as this phone knows them).
 * A line between two ids this phone knows as one person is left out (it squares itself).
 */
export function bigMoney(state, tripId) {
  const st = bigStatus(state, tripId);
  if (!st?.final || !st.lines.length) return [];
  const who = canonicalOf(state);
  const name = id => st.big.people[id]?.name || '';
  const at = Math.max(0, ...st.field.groups.map(g => (g.card ? finishedAt(g.card) : 0)), st.ended || 0);
  const what = state.trips?.[tripId]?.name || st.rounds.find(r => r.trip?.name)?.trip.name || BIG_NAME;
  const out = [];
  for (const l of st.lines) {
    const from = who(l.from), to = who(l.to);
    if (from === to) continue;
    const id = bigMoneyId(tripId, l.from, l.to);
    out.push({
      id, tripId, big: true, what, key: `${l.from}>${l.to}`,
      payer: to, parts: [{ id: from, cents: l.cents, part: null }],
      balances: { [to]: l.cents, [from]: -l.cents }, cents: l.cents, amount: l.cents / 100,
      names: { [from]: name(l.from), [to]: name(l.to) }, at,
      // The two of them as a trip expense writes them, so a payment between them names them the same way
      raw: { id, payer: personIn(st, l.to, name(l.to)), people: [{ ...personIn(st, l.from, name(l.from)), part: null }] },
    });
  }
  return out;
}

/** A game's lines as trip expenses write people (bigMoney `raw`), for a payment between two of them. */
export function bigRaw(state, tripId) {
  return bigMoney(state, tripId).map(x => x.raw);
}

const allCache = new WeakMap();

/** Every decided Big Game on this phone as trip money (bigMoney), for the Tab. */
export function allBigMoney(state) {
  if (allCache.has(state)) return allCache.get(state);
  const out = bigTripIds(state).flatMap(id => bigMoney(state, id));
  allCache.set(state, out);
  return out;
}

/**
 * What the decided games put between you and one person: [{ expense, amount, at }] newest first,
 * amount in cents, positive when they owe you. `isMine` and `isThem` say who's who.
 */
export function bigBetween(state, isMine, isThem) {
  const out = [];
  for (const x of allBigMoney(state)) {
    const p = x.parts[0];
    const c = isMine(x.payer) && isThem(p.id) ? p.cents : isThem(x.payer) && isMine(p.id) ? -p.cents : 0;
    if (c) out.push({ expense: x, amount: c, at: x.at || 0 });
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Each person's money from the game once decided, in dollars by the ids this phone knows them by: { id: dollars }. */
export function bigBy(state, tripId) {
  const st = bigStatus(state, tripId);
  if (!st?.final) return null;
  const who = canonicalOf(state);
  const out = {};
  for (const [id, c] of Object.entries(st.results.balances)) {
    const k = who(id);
    out[k] = Math.round(((out[k] || 0) * 100 + c)) / 100;
  }
  return out;
}

/**
 * The round on this phone the decided game's money goes on, for the screens that add rounds up, so
 * the game counts once: the round you played (finished, else still open: a game the organizer
 * closed early can leave your group's round open), else the game's first finished round here.
 * Null when the game isn't decided.
 */
export function bigHome(state, tripId) {
  const st = bigStatus(state, tripId);
  if (!st?.final) return null;
  const mine = r => { const me = meFor(r, state); return !!me && (r.players || []).some(p => p.id === me); };
  const done = st.rounds.filter(r => r.status === 'done');
  return done.find(mine) || st.rounds.find(mine) || done[0] || null;
}

/**
 * Whether a round counts on the screens that add up finished rounds (History, Season, Close the
 * books, the profile and Your stats): a finished round, or the round a decided Big Game's money
 * goes on while it's still open (bigHome), so a game closed early has its money there too.
 */
export function countsAsDone(state, round) {
  if (round?.status === 'done') return true;
  return round?.trip?.format === BIG_FORMAT && !!round.trip.id && bigHome(state, round.trip.id)?.id === round.id;
}

/**
 * What a Big Game's round is to the screens that count money rounds: null when it isn't one,
 * 'home' when the decided game's money goes on it (bigHome), else 'none' (the game isn't decided,
 * or its money goes on another round), which is never an even money round of its own unless the
 * round had money of its own (a side bet between two of its players).
 */
export function bigRole(state, round) {
  if (round?.trip?.format !== BIG_FORMAT || !round.trip.id) return null;
  return bigHome(state, round.trip.id)?.id === round.id ? 'home' : 'none';
}

/** A round with money of its own: a game with a bet, side games or side bets (a Big Game's group round starts with none). */
export function hasOwnMoney(round) {
  return (round?.sideGames?.length || 0) > 0 || betsOf(round).length > 0 || round?.game !== 'stroke' || (round?.settings?.stroke?.stake || 0) > 0;
}

/**
 * A Big Game's round with no money on it for the screens that count money rounds: the game's money
 * goes on another round (or isn't decided yet) and the round has none of its own. It's a round you
 * played, never an even money round.
 */
export const bigNoMoney = (state, round) => bigRole(state, round) === 'none' && !hasOwnMoney(round);

/**
 * The decided game's money on one of its rounds here, for the screens that add rounds up (History,
 * Season, Players, Close the books; the Tab has it already, as trip money): { id: dollars }, the
 * whole game's money on one round a phone (bigHome), so the game counts once. Ids are that
 * round's player ids (the game's for someone in another group). With `group`, only this round's
 * own players' money, on whichever finished round it's asked for: what the round's results screen
 * shows. Null when it isn't a decided game's round.
 */
export function bigRoundMoney(state, round, { group = false } = {}) {
  const tripId = round?.trip?.format === BIG_FORMAT ? round.trip.id : null;
  if (!tripId) return null;
  const st = bigStatus(state, tripId);
  if (!st?.final) return null;
  const home = !group && bigHome(state, tripId)?.id === round.id;
  if (round.status !== 'done' && !home) return null;
  const who = canonicalOf(state);
  const seatIn = (r, id) => (r.players || []).find(p => p.id === id || who(p.id) === who(id));
  if (!group && !home) return {};
  const out = {};
  for (const [id, c] of Object.entries(st.results.balances)) {
    if (!c) continue;
    const seat = seatIn(round, id)?.id || (group ? null : id);
    if (!seat) continue;
    out[seat] = Math.round((out[seat] || 0) * 100 + c) / 100;
  }
  return out;
}

/**
 * The decided game's payments between you and people in other groups, on the round its money goes
 * on (bigHome), for the head to heads: [{ id, amount }], `id` as this phone knows them, `amount` in
 * dollars, positive when they owe you. People in your own group are in the round's pairs already
 * (withBigMoney). `isMe` says which ids are yours. Empty for any other round.
 */
export function bigAcross(state, round, isMe) {
  if (bigRole(state, round) !== 'home') return [];
  const who = canonicalOf(state);
  const seated = new Set((round.players || []).map(p => who(p.id)));
  const out = [];
  for (const x of bigMoney(state, round.trip.id)) {
    const from = x.parts[0].id, to = x.payer;
    if (isMe(to) && !isMe(from) && !seated.has(who(from))) out.push({ id: from, amount: x.cents / 100 });
    else if (isMe(from) && !isMe(to) && !seated.has(who(to))) out.push({ id: to, amount: -x.cents / 100 });
  }
  return out;
}

/**
 * A round's results (roundResults or tabResults) with the decided game's money in them, for those
 * screens: `balances` and `standings` add bigRoundMoney (`group` as there), and `pairs` add the
 * game's payments between two people in the round (what each won from the other). The same
 * results otherwise.
 */
export function withBigMoney(state, round, res, { group = false } = {}) {
  const add = bigRoundMoney(state, round, { group });
  if (!add || !res) return res;
  // A round still open (the game was closed early) has none of its own money on the Tab yet: only the game's
  if (round.status !== 'done') {
    const ids = (round.players || []).map(p => p.id);
    res = { ...res, balances: Object.fromEntries(ids.map(id => [id, 0])), pairs: Object.fromEntries(ids.map(id => [id, {}])), standings: (res.standings || []).map(p => ({ ...p, amount: 0 })) };
  }
  const r2 = v => Math.round(v * 100) / 100;
  const balances = { ...res.balances };
  for (const [id, v] of Object.entries(add)) balances[id] = r2((balances[id] || 0) + v);
  const who = canonicalOf(state);
  const seat = id => (round.players || []).find(p => p.id === id || who(p.id) === who(id))?.id || null;
  const pairs = Object.fromEntries(Object.entries(res.pairs || {}).map(([k, v]) => [k, { ...v }]));
  for (const l of bigStatus(state, round.trip.id).lines) {
    const a = seat(l.from), b = seat(l.to);
    if (!a || !b || a === b) continue;
    pairs[b] = { ...(pairs[b] || {}), [a]: r2((pairs[b]?.[a] || 0) + l.cents / 100) };
    pairs[a] = { ...(pairs[a] || {}), [b]: r2((pairs[a]?.[b] || 0) - l.cents / 100) };
  }
  const standings = (res.standings || []).map(p => ({ ...p, amount: balances[p.id] ?? p.amount ?? 0 }))
    .sort((x, y) => y.amount - x.amount);
  return { ...res, balances, pairs, standings };
}

/**
 * A Big Game's group round with no money of its own, as its results screens show it: the round's
 * results with each of its players' money from the whole game once it's decided (withBigMoney,
 * `group`), and `big: { final }` so the screens say whose game it is and that it's settled once.
 */
export function bigRoundResults(state, round, res) {
  const st = round?.trip?.format === BIG_FORMAT ? bigStatus(state, round.trip.id) : null;
  if (!st || !res) return res;
  return { ...withBigMoney(state, round, res, { group: true }), transfers: [], big: { final: !!st.final } };
}
