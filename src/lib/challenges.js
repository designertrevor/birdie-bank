// Challenges (ROADMAP area 21): "Dave challenges Mike to a $20 match on Saturday." Mike accepts,
// declines or counters with a new amount, and once it's agreed it goes into the round as a two-player
// side bet (pair-bets.js): the round planned for it (roll call, or setup from the plan), or, for a
// challenge made from a Player card, the next round both of them are in.
//
// A challenge is what it was made as plus the moves made on it since, in order:
//   { id, v, from: { who, name }, to: { who, name }, kind, stake, holes, label?, unit, plan, at, moves }
// - kind: a side bet's kind (match, hole, ctp, custom), stake its amount (a hole, a par 3, or the bet).
// - holes: 'all', 'front' or 'back' (by hole number, worked out on the round when it's played).
// - unit: 'money', or 'points' for a challenge made on a points plan, which never moves money.
// - plan: { id, code, date } for a challenge on a planned round (`who` is the person's key on the
//   plan, the way answers are kept), or null for one made from a Player card (`who` is the player's
//   id on the phone that made it).
// - moves: [{ id, side: 'from' | 'to' | 'keeper', move, stake?, roundId?, at }]. 'accept', 'decline'
//   and 'counter' (a new stake) are for whoever's turn it is; 'withdraw' is either of the two calling
//   it off before it's played; 'on' is the phone starting the round putting it in, and 'back' that
//   phone giving it back when the round goes before it's played (deleted, or kept for another day),
//   so it's agreed again for the next round together. Moves are played
//   back in time order and one that doesn't fit where the challenge stands is skipped, so two phones
//   that tap at once always end up agreeing.
// - setBy: { who, name } when the organizer (or the scorekeeper) set it up between two other people
//   ("Trevor set up Mike v Dave"). Then both of them answer: it's agreed once both are in at the
//   same amount, and whoever set it up can call it off (a 'keeper' withdraw).
// - A move whose id starts with PROXY ('px_') is an answer put in for someone by the organizer or
//   the scorekeeper ("Mike's in", "Dave says $10"), the way the organizer marks RSVP answers. Once
//   that person answers from their own phone (before the round starts), their own answers win and
//   every answer put in for them is left out. Kept in the id so the server's rows (insert only, side
//   'from' or 'to') carry it with no new column.
// - A planned round moved to another day ("Schedule for later", a new plan from the round that never
//   teed off) carries the old plan in its `movedFrom` ([{ id, code, keys }], keys: the old plan's
//   keys to the new one's), and its challenges move with it (challengeView).
// Only the phone of whoever made it knows `mine`/`made`; everything else is shared. Pure, unit tested.
import { BET_MAX, MAX_BETS, cleanBet, cleanBetLabel, kindFits, nineRange } from './pair-bets.js';
import { daysUntil, dayLabel } from './plans.js';
import { linksOf } from './people-links.js';
import { money } from './golf.js';
import { points } from './play-for.js';

export const CHALLENGE_KINDS = ['match', 'hole', 'ctp', 'custom'];
export const CHALLENGE_HOLES = ['all', 'front', 'back'];
export const HOLES_LABEL = { all: 'All the holes', front: 'Front 9', back: 'Back 9' };
/** The amounts to tap; anything else is typed in. */
export const CHALLENGE_STAKES = [5, 10, 20, 50];
/** How many times the amount can go back and forth before it's accept or decline. */
export const MAX_COUNTERS = 4;
/** A challenge from a Player card that nobody answers goes after this many days. */
export const OPEN_DAYS = 14;
/** An agreed challenge from a Player card waits this many days for a round with both of them in it. */
export const ACCEPTED_DAYS = 30;
export const MAX_MOVES = 20;

const DAY = 24 * 60 * 60 * 1000;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';
const other = side => (side === 'from' ? 'to' : 'from');
const validStake = v => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= BET_MAX;
const roundStake = v => Math.round(Math.min(BET_MAX, Math.max(0, Number(v) || 0)) * 100) / 100;

/** The side bet id a challenge becomes, so it only ever goes into a round once. */
export const betIdOf = ch => `ch_${ch.id}`;

/**
 * A new challenge, as it's saved. `from` is you (your key on the plan, or your player id), `to` the
 * person you're challenging. `plan`: the planned round it's for ({ id, code, date }) or null.
 */
export function newChallenge({ id, from, to, kind, stake, holes = 'all', label = '', plan = null, unit = 'money', setBy = null, now = Date.now() }) {
  const ch = {
    id, v: 1,
    from: { who: from.who, name: first(from.name) },
    to: { who: to.who, name: first(to.name) },
    ...(setBy?.who ? { setBy: { who: setBy.who, name: first(setBy.name) } } : {}),
    kind: CHALLENGE_KINDS.includes(kind) ? kind : 'match',
    stake: roundStake(stake),
    holes: CHALLENGE_HOLES.includes(holes) ? holes : 'all',
    unit: unit === 'points' ? 'points' : 'money',
    plan: plan ? { id: plan.id ?? null, code: plan.code ?? null, date: plan.date ?? null } : null,
    at: now,
    moves: [],
  };
  if (ch.kind === 'custom') ch.label = cleanBetLabel(label) || 'Side bet';
  return ch;
}

/** Why a challenge can't be sent yet, or null when it's ready. */
export function challengeProblem(draft) {
  if (draft?.setBy && !draft?.from?.who) return 'Pick who’s playing';
  if (!draft?.to?.who) return draft?.setBy ? 'Pick who they’re playing' : 'Pick who you’re challenging';
  if (draft.from?.who && draft.from.who === draft.to.who) return draft.setBy ? 'Pick two different people' : 'You can’t challenge yourself';
  if (!validStake(Number(draft.stake))) return 'Pick an amount';
  if (draft.kind === 'custom' && !cleanBetLabel(draft.label)) return 'Give it a name';
  return null;
}

/** A well-formed challenge from the server (or anywhere), or null: a garbled one is left out. */
export function cleanChallenge(raw) {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  if (!isObj(raw.from) || !isObj(raw.to) || !raw.from.who || !raw.to.who || raw.from.who === raw.to.who) return null;
  if (!CHALLENGE_KINDS.includes(raw.kind) || !CHALLENGE_HOLES.includes(raw.holes) || !validStake(raw.stake)) return null;
  return raw;
}

/** Moves in the order they come: by time, then id, so every phone plays them back the same way. */
function ordered(moves) {
  return (Array.isArray(moves) ? moves : []).filter(m => isObj(m) && m.id && m.move)
    .slice().sort((a, b) => (a.at || 0) - (b.at || 0) || String(a.id).localeCompare(String(b.id)));
}

/** The start of the id of an answer put in for someone by the organizer or the scorekeeper. */
export const PROXY = 'px_';
/** Whether a move is an answer put in for someone (not from their own phone). */
export const isProxy = m => typeof m?.id === 'string' && m.id.startsWith(PROXY);
const isPerson = side => side === 'from' || side === 'to';

/**
 * The moves that count, in order: answers put in for someone are left out once that person
 * answered from their own phone before the round started (their own answer wins). An answer of
 * their own after it went into a round never fits, so it changes nothing.
 */
function counted(moves) {
  const list = ordered(moves);
  const onAt = list.find(m => m.move === 'on')?.at ?? Infinity;
  const own = new Set(list.filter(m => isPerson(m.side) && !isProxy(m) && (m.at || 0) <= onAt).map(m => m.side));
  return own.size ? list.filter(m => !(isProxy(m) && own.has(m.side))) : list;
}

/** Whether it's `side`'s call where the challenge stands `s` ('both': either of the two). */
const onTurn = (s, side) => isPerson(side) && (s.turn === side || s.turn === 'both');

/**
 * Where a challenge stands, from its moves:
 * { status, stake, turn, by, counters, roundId, at, acceptedAt, ins, setBy }
 * - status: 'open' (waiting on `turn`), 'countered' (a new amount, waiting on `turn`), 'accepted',
 *   'declined', 'off' (called off) or 'on' (in a round, `roundId`).
 * - turn: 'from', 'to', 'both' (one set up between two others that neither answered yet) or null.
 * - stake: the amount as it stands now (the last counter's). `by`: the side that made the last move.
 * - ins: the sides in at that amount (the one who made it, or whoever named it last).
 * - at: when it last changed; acceptedAt: when it was agreed (null until then).
 */
export function challengeState(ch) {
  return play(ch).state;
}

/** The challenge played back: { state, steps: [{ m, after }] } for each move that counted. */
function play(ch, moves = ch.moves) {
  const setBy = !!ch.setBy?.who;
  const s = { status: 'open', stake: ch.stake, turn: setBy ? 'both' : 'to', by: setBy ? 'keeper' : 'from', counters: 0, roundId: null, at: ch.at || 0, acceptedAt: null, ins: setBy ? [] : ['from'], setBy };
  const steps = [];
  for (const m of counted(moves)) {
    if (!fits(s, m)) continue;
    s.by = m.side;
    s.at = m.at || s.at;
    if (m.move === 'accept') {
      s.ins = [...new Set([...s.ins, m.side])];
      if (s.ins.includes('from') && s.ins.includes('to')) { s.status = 'accepted'; s.turn = null; s.acceptedAt = m.at || s.at; }
      else s.turn = other(m.side);
    }
    else if (m.move === 'decline') { s.status = 'declined'; s.turn = null; }
    else if (m.move === 'counter') { s.status = 'countered'; s.stake = roundStake(m.stake); s.turn = other(m.side); s.counters++; s.ins = [m.side]; }
    else if (m.move === 'withdraw') { s.status = 'off'; s.turn = null; }
    else if (m.move === 'on') { s.status = 'on'; s.turn = null; s.roundId = m.roundId || null; }
    else if (m.move === 'back') { s.status = 'accepted'; s.turn = null; s.roundId = null; }
    steps.push({ m, after: { ...s, ins: [...s.ins] } });
  }
  return { state: s, steps };
}

/** Whether a move fits where the challenge stands `s` (see challengeState). */
function fits(s, m) {
  const waiting = s.status === 'open' || s.status === 'countered';
  switch (m.move) {
    case 'accept': case 'decline': return waiting && onTurn(s, m.side);
    case 'counter': return waiting && onTurn(s, m.side) && s.counters < MAX_COUNTERS && validStake(Number(m.stake)) && roundStake(m.stake) !== s.stake;
    // Either of the two, or whoever set it up between them
    case 'withdraw': return (waiting || s.status === 'accepted') && (isPerson(m.side) || (m.side === 'keeper' && s.setBy));
    case 'on': return s.status === 'accepted';
    case 'back': return s.status === 'on' && !!m.roundId && m.roundId === s.roundId;
    default: return false;
  }
}

/** The move id for a new move: `base` as it is, or marked as put in for someone (`proxy`). */
export const moveIdFor = (base, proxy = false) => (proxy ? `${PROXY}${base}` : String(base));

/**
 * Whether `side` can make `move` now (for the buttons). A counter without a `stake` asks whether one
 * could be made at all; 'back' needs the `roundId` it went into. `proxy`: put in for them by the
 * organizer or scorekeeper. Without it, it's their own answer, which can change one put in for them.
 */
export function canMove(ch, side, move, stake = null, roundId = null, proxy = false) {
  if ((ch.moves || []).length >= MAX_MOVES) return false;
  const at = Math.max(ch.at || 0, ...(ch.moves || []).map(m => Number(m?.at) || 0)) + 1;
  const tryIt = st => !!withMove(ch, { id: moveIdFor('zzzz_try', proxy), side, move, stake: st, roundId, at });
  if (move === 'counter' && stake == null) return tryIt(1) || tryIt(2);
  return tryIt(stake);
}

/** The challenge with a move made on it, or null when the move doesn't fit (nothing changes). */
export function withMove(ch, { id, side, move, stake = null, roundId = null, at = Date.now() }) {
  if ((ch.moves || []).length >= MAX_MOVES) return null;
  const m = { id, side, move, at };
  if (move === 'counter') m.stake = roundStake(stake);
  if ((move === 'on' || move === 'back') && roundId) m.roundId = roundId;
  if (move === 'counter' && !validStake(Number(stake))) return null;
  const next = { ...ch, moves: [...(ch.moves || []), m] };
  return play(next).steps.some(x => x.m.id === m.id) ? next : null;
}

/**
 * The answers put in for `side` that still count (none once they answered from their own phone),
 * so a card can say "Trevor marked it". Empty for a side with nothing put in for them.
 */
export function proxiedFor(ch, side) {
  return play(ch).steps.filter(x => x.m.side === side && isProxy(x.m)).map(x => x.m);
}

/** Moves from two copies of a challenge put together (each move once, by id). */
export function mergeMoves(a = [], b = []) {
  const byId = new Map();
  for (const m of [...(a || []), ...(b || [])]) if (isObj(m) && m.id && !byId.has(m.id)) byId.set(m.id, m);
  return ordered([...byId.values()]);
}

// --------------------------- whose it is ------------------------------------

/** Whether a plan's `movedFrom` holds the plan a challenge was made for (by its id, or its code). */
const movedEntry = (plan, cp) => (Array.isArray(plan?.movedFrom) ? plan.movedFrom : [])
  .find(e => isObj(e) && ((cp.id && e.id === cp.id) || (cp.code && e.code === cp.code))) || null;

/** The plan a challenge was made for, as it is on this phone (found by its id, else its code), or null. */
function madeForPlan(state, cp) {
  const plans = state?.plans || {};
  const byId = cp.id ? plans[cp.id] : null;
  if (byId && (!cp.code || !byId.code || byId.code === cp.code)) return byId;
  return cp.code ? Object.values(plans).find(p => p?.code === cp.code) || null : null;
}

/**
 * Where a planned round's challenge went when its round moved to another day: the newest plan on
 * this phone that came from its plan ({ plan, keys }), or null. A plan moved twice carries both.
 */
function movedTo(state, cp) {
  let best = null;
  for (const plan of Object.values(state?.plans || {})) {
    const e = movedEntry(plan, cp);
    if (e && (!best || (plan.movedFrom.length > best.plan.movedFrom.length))) best = { plan, keys: isObj(e.keys) ? e.keys : {} };
  }
  return best;
}

/** The plan a challenge is for on this phone (the one its round moved to, if it did), or null. */
export function planOf(state, ch) {
  if (!ch?.plan) return null;
  return movedTo(state, ch.plan)?.plan || madeForPlan(state, ch.plan);
}

/**
 * A challenge as it reads on this phone: one whose planned round moved to another day is on the new
 * plan (its day, its id and code, and each person by their key on it). Anything else as it is.
 * Never saved or sent: what goes up is always the challenge as it was made.
 */
export function challengeView(state, ch) {
  if (!ch?.plan || ch.viewed) return ch;
  const moved = movedTo(state, ch.plan);
  const plan = moved?.plan || madeForPlan(state, ch.plan);
  if (!plan) return ch;
  const key = who => (moved && moved.keys[who]) || who;
  const view = { ...ch, viewed: true, plan: { id: plan.id ?? ch.plan.id ?? null, code: plan.code ?? (moved ? null : ch.plan.code ?? null), date: plan.date ?? ch.plan.date ?? null } };
  if (moved) {
    view.from = { ...ch.from, who: key(ch.from.who) };
    view.to = { ...ch.to, who: key(ch.to.who) };
    if (ch.setBy) view.setBy = { ...ch.setBy, who: key(ch.setBy.who) };
  }
  return view;
}

/**
 * What a challenge made here goes up as: { planCode, ch }. Under the plan it was made for, as it
 * was made; or, when that plan never got a code and its round moved to a plan that has one, as it
 * reads on the new plan (so every phone finds the people by their keys on it). planCode is null for
 * one from a Player card, and undefined while there's no plan code to send it under yet.
 */
export function challengeToSend(state, ch) {
  if (!ch?.plan) return { planCode: null, ch };
  const made = madeForPlan(state, ch.plan);
  const code = made?.code || ch.plan.code;
  if (code) return { planCode: code, ch };
  const moved = movedTo(state, ch.plan);
  if (!moved?.plan?.code) return { planCode: undefined, ch };
  const { viewed: _v, ...view } = challengeView(state, ch);
  return { planCode: moved.plan.code, ch: view };
}

/** Your key on a plan on this phone: the organizer's own key, or who you said you are. */
export const planMe = plan => (plan ? (plan.host ? plan.hostWho : plan.localMe) : null);

/** Which side of a challenge you are on this phone: 'from', 'to' or null (it's between two others). */
export function sideOf(state, ch) {
  if (ch.plan) {
    const v = challengeView(state, ch);
    const me = planMe(planOf(state, v));
    if (!me) return null;
    return me === v.from.who ? 'from' : me === v.to.who ? 'to' : null;
  }
  return ch.mine === 'from' || ch.mine === 'to' ? ch.mine : null;
}

/** Whether this phone set the challenge up between two others (the organizer's, or the scorekeeper's). */
export function setUpHere(state, ch) {
  if (!ch?.setBy?.who) return false;
  if (!ch.plan) return !!ch.made;
  const v = challengeView(state, ch);
  const plan = planOf(state, v);
  return !!plan && planMe(plan) === v.setBy.who;
}

/**
 * The sides this phone can put an answer in for, for someone who isn't answering from their own
 * phone (or hasn't opened the app): on a planned round the organizer's phone, for anyone on it but
 * themselves; one from a Player card on the phone that made it, for the other person (or for both,
 * when it was set up between two others). Like marking RSVP answers.
 */
export function markSides(state, ch) {
  const side = sideOf(state, ch);
  let can = false;
  if (ch.plan) can = !!planOf(state, ch)?.host;
  else can = !!ch.made;
  if (!can) return [];
  return ['from', 'to'].filter(x => x !== side);
}

/** Who puts answers in for others on this challenge, by first name: whoever set it up, else the organizer, else whoever made it. */
export function markerName(state, ch) {
  if (ch.setBy?.name) return first(ch.setBy.name);
  if (ch.plan) { const p = planOf(state, ch); if (p?.hostName) return first(p.hostName); }
  return first(ch.from.name);
}

/**
 * Whether a challenge still counts on this phone: 'live', 'closed' (declined, called off or in a
 * round), 'gone' (its plan was called off or deleted), 'missed' (its round started without it, or its
 * day went by) or 'expired' (from a Player card: nobody answered in OPEN_DAYS, or no round together
 * in ACCEPTED_DAYS once agreed).
 */
export function challengeLife(state, ch, now = Date.now()) {
  const s = challengeState(ch);
  if (s.status === 'declined' || s.status === 'off' || s.status === 'on') return 'closed';
  if (ch.plan) {
    // A round moved to another day: the challenge lives on the plan it moved to
    const plan = planOf(state, ch);
    if (!plan || plan.gone || plan.status === 'off') return 'gone';
    if (plan.status === 'started') return 'missed';
    const days = daysUntil(plan.date, new Date(now));
    return days != null && days < 0 ? 'missed' : 'live';
  }
  if (s.status === 'accepted') return now - (s.acceptedAt || s.at) > ACCEPTED_DAYS * DAY ? 'expired' : 'live';
  // Unanswered: from when it was made, or from the last counter (a new amount is a fresh ask)
  return now - (s.at || ch.at || 0) > OPEN_DAYS * DAY ? 'expired' : 'live';
}

/** Every challenge on this phone, well formed. */
export function allChallenges(state) {
  return Object.values(state?.challenges || {}).map(cleanChallenge).filter(Boolean).map(ch => challengeView(state, ch));
}

/** Your challenges still going, for Up next: your call first, then waiting on them, then agreed. */
export function myChallenges(state, now = Date.now()) {
  const rank = (ch, side) => { const s = challengeState(ch); return onTurn(s, side) ? 0 : s.turn ? 1 : 2; };
  // Yours, and the ones you set up between two others (you're putting their answers in)
  return allChallenges(state)
    .map(ch => ({ ch, side: sideOf(state, ch) }))
    .filter(x => (x.side || setUpHere(state, x.ch)) && challengeLife(state, x.ch, now) === 'live')
    .sort((a, b) => rank(a.ch, a.side) - rank(b.ch, b.side) || (challengeState(b.ch).at - challengeState(a.ch).at))
    .map(x => x.ch);
}

/** A plan's challenges, newest first: the ones still going and the ones answered (not the called off). */
export function planChallenges(state, plan) {
  if (!plan) return [];
  return allChallenges(state)
    .filter(ch => ch.plan && planOf(state, ch)?.id === plan.id && challengeState(ch).status !== 'off')
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

/** Challenges from Player cards with one friend (any of their ids), still going. */
export function challengesWith(state, playerId, now = Date.now()) {
  const L = linksOf(state);
  const them = L.personOf(playerId);
  return allChallenges(state).filter(ch => {
    if (ch.plan || !ch.made || challengeLife(state, ch, now) !== 'live') return false;
    // One set up here between two others: on either one's card
    if (ch.setBy) return L.personOf(ch.from.who) === them || L.personOf(ch.to.who) === them;
    const side = sideOf(state, ch);
    return side && L.personOf(ch[other(side)].who) === them;
  });
}

// --------------------------- into the round ---------------------------------

/** The player in `round` for a name, when exactly one fits (full name first, then first name). */
function byName(round, name, skip) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const cands = round.players.filter(p => !skip.has(p.id));
  const full = cands.filter(p => String(p.name || '').trim().toLowerCase() === n);
  if (full.length === 1) return full[0].id;
  const firsts = cands.filter(p => first(p.name).toLowerCase() === first(n).toLowerCase());
  return firsts.length === 1 ? firsts[0].id : null;
}

/**
 * The two players in `round` a challenge is between, [from, to] by their ids in the round, or null
 * when either isn't in it. A planned round's challenge goes by the roll call's `idOf` (the plan's
 * keys to player ids). One from a Player card: you are you; on the phone that made it the other is
 * the player it was made with (any of their ids), and on the phone it was sent to, the one player
 * in the round with their name.
 */
export function challengePair(state, ch, round, { idOf = null, me = state?.me } = {}) {
  const L = linksOf(state);
  const inRound = id => (id == null ? null : round.players.find(p => p.id === id || L.personOf(p.id) === L.personOf(id))?.id ?? null);
  if (ch.plan) {
    if (!idOf) return null;
    // By each person's key on the plan it's for now (the one its round moved to, if it did)
    const v = challengeView(state, ch);
    const a = inRound(idOf[v.from.who]), b = inRound(idOf[v.to.who]);
    return a && b && a !== b ? [a, b] : null;
  }
  // Set up on this phone between two others: both are players here
  if (ch.setBy && ch.made) {
    const a = inRound(ch.from.who), b = inRound(ch.to.who);
    return a && b && a !== b ? [a, b] : null;
  }
  const mine = ch.mine === 'from' || ch.mine === 'to' ? ch.mine : null;
  if (!mine) return null;
  const ids = { [mine]: inRound(me) };
  if (!ids[mine]) return null;
  const them = other(mine);
  ids[them] = ch.made ? inRound(ch[them].who) : byName(round, ch[them].name, new Set([ids[mine]]));
  return ids.from && ids.to && ids.from !== ids.to ? [ids.from, ids.to] : null;
}

/** The side bet an agreed challenge is between two players in `round` ([a, b], from and to). */
export function challengeBet(ch, round, [a, b]) {
  const s = challengeState(ch);
  const holes = ch.holes === 'front' || ch.holes === 'back' ? nineRange(round, ch.holes) : null;
  return cleanBet(round, {
    id: betIdOf(ch), kind: ch.kind, sides: [a, b], stake: s.stake,
    ...(holes ? { holes } : {}),
    ...(ch.kind === 'custom' ? { label: ch.label } : {}),
    playFor: ch.unit === 'points' ? 'points' : 'money',
  });
}

/**
 * Whether a round can carry a challenge's amount as it was agreed: a money one never goes into a
 * points round (it waits for one that can carry it), and a points one (made on a points plan) never
 * goes into a money round, where its points would be played as dollars. A reward round carries both.
 */
function unitFits(ch, round) {
  const kind = round.playFor?.kind;
  if (kind === 'reward') return true;
  return (kind === 'points' ? 'points' : 'money') === (ch.unit === 'points' ? 'points' : 'money');
}

/**
 * The agreed challenges that go into a round about to start, as side bets: [{ ch, bet }].
 * `planId`: the plan it's starting from (its own challenges come in by the roll call's `idOf`).
 * Challenges from Player cards come in whenever both people are in the round, except a money one
 * on a points round or a points one on a money round (unitFits), or a front or back nine one in a
 * round that doesn't play that nine (a 9-hole round of the other nine). Never one already in the round or
 * taken off it, a match or per-hole bet between two teammates in a scramble, or past MAX_BETS.
 */
export function challengesForRound(state, round, { planId = null, idOf = null, now = Date.now(), me = state?.me } = {}) {
  const have = new Set([...(round.bets || []).map(b => b?.id), ...(round.betsGone || [])]);
  let room = MAX_BETS - (round.bets || []).length;
  const out = [];
  for (const ch of allChallenges(state)) {
    if (room <= 0) break;
    if (challengeState(ch).status !== 'accepted' || challengeLife(state, ch, now) !== 'live') continue;
    if (have.has(betIdOf(ch))) continue;
    if (ch.plan && (!planId || planOf(state, ch)?.id !== planId)) continue;
    if (!unitFits(ch, round)) continue;
    // A front or back nine challenge waits for a round that plays that nine: in a 9-hole round of the
    // other nine it would be a bet on holes nobody agreed to
    if ((ch.holes === 'front' || ch.holes === 'back') && !nineRange(round, ch.holes)) continue;
    const pair = challengePair(state, ch, round, { idOf: ch.plan ? idOf : null, me });
    if (!pair || !kindFits(round, ch.kind, pair)) continue;
    out.push({ ch, bet: challengeBet(ch, round, pair) });
    have.add(betIdOf(ch));
    room--;
  }
  return out;
}

/** The round with its agreed challenges added as side bets: { round, used: [challenge ids] }. */
export function withChallenges(state, round, opts = {}) {
  const found = challengesForRound(state, round, opts);
  if (!found.length) return { round, used: [] };
  return { round: { ...round, bets: [...(round.bets || []), ...found.map(f => f.bet)] }, used: found.map(f => f.ch.id) };
}

/**
 * The challenges to give back ('back') when `round` goes from this phone before it's finished
 * (deleted, or kept for another day): the ones that went into it. Only for a round this phone set
 * up; a copy of someone else's round leaving this phone gives nothing back, since it goes on there.
 */
export function challengesToGiveBack(state, round) {
  if (!round?.id || round.status === 'done' || round.localMe || round.shared?.host === false) return [];
  return allChallenges(state).filter(ch => { const s = challengeState(ch); return s.status === 'on' && s.roundId === round.id; }).map(ch => ch.id);
}

/** The challenge id a side bet came from, or null. */
export const challengeIdOfBet = betId => (typeof betId === 'string' && betId.startsWith('ch_') ? betId.slice(3) : null);

// --------------------------- words ------------------------------------------

/** The formatter for a challenge's amounts: dollars, or points for one on a points plan. */
export const challengeFmt = ch => (ch?.unit === 'points' ? points : money);

/** What's on it, for a line: "$20 match", "$5 a hole", "Closest to the pin, $5 a par 3", "Longest drive, $10". */
export function challengeWhat(ch, stake = challengeState(ch).stake) {
  const s = challengeFmt(ch)(stake);
  return { match: `${s} match`, hole: `${s} a hole`, ctp: `Closest to the pin, ${s} a par 3`, custom: `${cleanBetLabel(ch.label) || 'Side bet'}, ${s}` }[ch.kind] || s;
}

/** What's on it inside a sentence: "a $20 match", "$5 a hole", "closest to the pin at $5 a par 3", "$10 on Longest drive". */
export function challengeAsk(ch, stake = challengeState(ch).stake) {
  const s = challengeFmt(ch)(stake);
  return { match: `a ${s} match`, hole: `${s} a hole`, ctp: `closest to the pin at ${s} a par 3`, custom: `${s} on ${cleanBetLabel(ch.label) || 'a side bet'}` }[ch.kind] || s;
}

/** When it's for: the plan's day ("Saturday"), or "Next round together". */
export function challengeWhen(ch, now = Date.now()) {
  if (ch.plan) return dayLabel(ch.plan.date, new Date(now)) || 'The planned round';
  return 'Next round together';
}

/** One line: "$20 match · Back 9 · Saturday". */
export function challengeLine(ch, now = Date.now()) {
  return [challengeWhat(ch), ch.holes !== 'all' ? HOLES_LABEL[ch.holes] : null, challengeWhen(ch, now)].filter(Boolean).join(' · ');
}

/**
 * "You challenged Mike", "Dave challenged you", "Dave challenged Mike". One set up between two
 * others says who set it up: "You set up Mike v Dave", "Trevor set you up v Dave", "Trevor set up
 * Mike v Dave". `setter`: this phone set it up.
 */
export function challengeHeadline(ch, side, setter = false) {
  if (ch.setBy) {
    if (setter) return `You set up ${first(ch.from.name)} v ${first(ch.to.name)}`;
    if (side) return `${first(ch.setBy.name)} set you up v ${first(ch[other(side)].name)}`;
    return `${first(ch.setBy.name)} set up ${first(ch.from.name)} v ${first(ch.to.name)}`;
  }
  if (side === 'from') return `You challenged ${first(ch.to.name)}`;
  if (side === 'to') return `${first(ch.from.name)} challenged you`;
  return `${first(ch.from.name)} challenged ${first(ch.to.name)}`;
}

/** "Trevor set up Mike v Dave, $20 match": who set it up and what's on it, in one line. */
export function setUpLine(ch, stake = challengeState(ch).stake) {
  if (!ch.setBy) return `${first(ch.from.name)} v ${first(ch.to.name)}, ${challengeWhat(ch, stake)}`;
  return `${first(ch.setBy.name)} set up ${first(ch.from.name)} v ${first(ch.to.name)}, ${challengeWhat(ch, stake)}`;
}

/**
 * Where it stands in a few friendly words, for you (`side`): "Your call", "Waiting on Mike",
 * "Mike says $10", "You’re on", "In the round", "Not this time", "Called off". One set up between
 * two others: "Waiting on Mike and Dave", "Mike’s in. Waiting on Dave".
 */
export function challengeStatusText(ch, side, life = 'live') {
  const s = challengeState(ch);
  const name = k => (k === side ? 'You' : k === 'keeper' ? first(ch.setBy?.name) : first(ch[k]?.name));
  if (s.status === 'on') return 'In the round';
  if (s.status === 'declined') return s.by === side ? 'You passed' : `${name(s.by)} passed this time`;
  if (s.status === 'off') return s.by === side ? 'You called it off' : `${name(s.by)} called it off`;
  if (life === 'missed') return 'Missed the round';
  if (life === 'gone') return 'The round’s off';
  if (life === 'expired') return 'Ran out of time';
  if (s.status === 'accepted') return side ? 'You’re on' : 'It’s on';
  if (s.turn === 'both') return side ? 'Your call' : `Waiting on ${first(ch.from.name)} and ${first(ch.to.name)}`;
  if (s.status === 'countered') {
    const says = `${s.by === side ? 'You' : first(ch[s.by].name)} said ${challengeFmt(ch)(s.stake)}`;
    return s.turn === side ? `${says}. Your call` : says;
  }
  const waiting = s.turn === side ? 'Your call' : `Waiting on ${first(ch[s.turn].name)}`;
  // Set up between two others and one of them is in
  if (ch.setBy && s.ins.length === 1) return `${s.ins[0] === side ? 'You’re' : `${first(ch[s.ins[0]].name)}’s`} in. ${waiting}`;
  return waiting;
}

/** The status chip's look: 'mine' (your call), 'wait', 'on' (agreed or in the round) or 'done'. */
export function challengeTone(ch, side, life = 'live') {
  const s = challengeState(ch);
  if (s.status === 'on' || (s.status === 'accepted' && life === 'live')) return 'on';
  if (life !== 'live' || s.status === 'declined' || s.status === 'off') return 'done';
  return onTurn(s, side) ? 'mine' : 'wait';
}

/**
 * The line under a card when an answer was put in for someone: "Trevor marked Mike’s answer. Mike
 * can change it from his own phone." or, on that person's phone, "Trevor marked your answer. Not
 * right? Answer here and yours counts." Null when nothing put in for anyone still counts.
 */
export function proxyNote(state, ch, side, life = 'live') {
  const s = challengeState(ch);
  if (life !== 'live' || s.status === 'on' || s.status === 'off' || s.status === 'declined') return null;
  const marked = ['from', 'to'].filter(x => proxiedFor(ch, x).length);
  if (!marked.length) return null;
  const by = markerName(state, ch);
  if (side && marked.includes(side)) return `${by} marked your answer. Not right? Answer here and yours counts.`;
  if (markSides(state, ch).length) {
    const names = marked.map(x => first(ch[x].name));
    return `You marked ${names.join(' and ')}’s answer${names.length > 1 ? 's' : ''}. Their own answer counts if they give one.`;
  }
  return `${by} marked ${marked.map(x => `${first(ch[x].name)}’s`).join(' and ')} answer${marked.length > 1 ? 's' : ''}.`;
}

/** "today", "tomorrow", "on Saturday": a plan's day inside a sentence. */
function dayWords(date, now) {
  const d = dayLabel(date, new Date(now));
  if (!d) return '';
  return d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : `on ${d}`;
}

/**
 * The text that goes with the link, from `side` to the other one: "Mike, you up for a $20 match on
 * Saturday?", or after a counter "Mike, I'll do a $10 match instead."
 */
export function challengeInviteText(ch, link, side = 'from', now = Date.now()) {
  const s = challengeState(ch);
  const to = first(ch[other(side)].name);
  const when = ch.plan ? dayWords(ch.plan.date, now) : 'next time we play';
  const holes = ch.holes !== 'all' ? ` on the ${HOLES_LABEL[ch.holes].toLowerCase()}` : '';
  if (ch.setBy && s.by === 'keeper') return challengeSetUpText(ch, link, other(side), now);
  const lead = s.status === 'countered' && s.by === side
    ? `${to}, I’ll do ${challengeAsk(ch)} instead.`
    : `${to}, you up for ${challengeAsk(ch)}${holes}${when ? ` ${when}` : ''}?`;
  return [lead, 'Tap to accept, decline or name your own amount:', link].filter(Boolean).join('\n');
}

/**
 * The text from whoever set it up to one of the two (`toSide`): "Mike, I set up you v Dave, a $20
 * match on Saturday. You in?" with the link to answer.
 */
export function challengeSetUpText(ch, link, toSide, now = Date.now()) {
  const to = first(ch[toSide].name), vs = first(ch[other(toSide)].name);
  const when = ch.plan ? dayWords(ch.plan.date, now) : 'next time you two play';
  const holes = ch.holes !== 'all' ? ` on the ${HOLES_LABEL[ch.holes].toLowerCase()}` : '';
  return [`${to}, I set up you v ${vs}, ${challengeAsk(ch)}${holes}${when ? ` ${when}` : ''}. You in?`, link ? 'Tap to accept, decline or name your own amount:' : null, link].filter(Boolean).join('\n');
}

/** What happens next, in a line, for a challenge's page (null once it's answered no or called off). */
export function challengeNextText(state, ch, now = Date.now()) {
  const s = challengeState(ch);
  const life = challengeLife(state, ch, now);
  const side = sideOf(state, ch);
  const them = first(ch[other(side || 'from')].name);
  if (s.status === 'on') return 'It’s in the round as a side bet.';
  if (life === 'expired') return 'Nobody played it in time, so it’s off. Challenge again any time.';
  if (life === 'missed') return 'The round went ahead without it. Challenge again next time.';
  if (life === 'gone') return 'That round is off, so the challenge is too.';
  if (s.status === 'declined' || s.status === 'off') return null;
  if (s.status === 'accepted') return ch.plan ? 'It goes in as a side bet when the round starts.' : ch.setBy ? `It goes in as a side bet the next time ${first(ch.from.name)} and ${first(ch.to.name)} play a round together.` : 'It goes in as a side bet the next time you two play a round together.';
  if (!side && setUpHere(state, ch)) return `Mark ${first(ch.from.name)} and ${first(ch.to.name)}’s answers when they tell you, or send it to them. If they answer from their own phone, theirs counts.`;
  if (!ch.code && ch.made) return `It lives on your phone for now. Mark ${them}’s answer when they tell you.`;
  return s.turn === side ? 'Accept, pass, or name your own amount.' : `${them} can accept, pass or name their own amount.`;
}

/** The link that opens one challenge: ?challenge=CODE. */
export function challengeLink(origin, code) {
  return `${origin}/?challenge=${code}`;
}

// --------------------------- Lately -----------------------------------------

/**
 * Lately rows for challenges, from the last `since` on: someone challenging you (or two others),
 * and answers to yours. Your own taps aren't news to you. An amount shows only when you're one of
 * the two; between two others it says who, never how much (like the rest of Lately).
 * [{ id, kind: 'challenge', at, text, target }] (sub is filled in by Lately).
 */
export function challengeLately(state, since, until) {
  const out = [];
  const inWindow = at => typeof at === 'number' && at >= since && at <= until;
  for (const ch of allChallenges(state)) {
    // A planned round's challenge whose plan isn't on this phone any more: nobody here can say whose it was
    if (ch.plan && !planOf(state, ch)) continue;
    const side = sideOf(state, ch);
    const setter = setUpHere(state, ch);
    // This phone puts answers in for others: those taps are its own, never news to it
    const marker = markSides(state, ch).length > 0;
    const target = ['challenge', { id: ch.id }];
    const fromN = first(ch.from.name), toN = first(ch.to.name);
    if (ch.setBy) {
      if (!setter && inWindow(ch.at)) {
        const text = side ? `${first(ch.setBy.name)} set you up v ${first(ch[other(side)].name)}, ${challengeAsk(ch, ch.stake)}` : `${first(ch.setBy.name)} set up ${fromN} v ${toN}`;
        out.push({ id: `ch:${ch.id}`, kind: 'challenge', at: ch.at, target, text });
      }
    } else if (side !== 'from' && inWindow(ch.at)) {
      out.push({ id: `ch:${ch.id}`, kind: 'challenge', at: ch.at, target, text: side === 'to' ? `${fromN} challenged you to ${challengeAsk(ch, ch.stake)}` : `${fromN} challenged ${toN}` });
    }
    // Each move that counted, with the challenge as it stood just after it (an amount as it was then)
    for (const { m, after } of play(ch).steps) {
      const proxy = isProxy(m);
      if (m.side === 'keeper' || m.move === 'on' || !inWindow(m.at)) continue;
      if (proxy ? marker : m.side === side) continue;
      const who = first(ch[m.side].name);
      const by = markerName(state, ch);
      // An answer put in for you: who put it in
      if (proxy && m.side === side) {
        let text = null;
        if (m.move === 'accept') text = `${by} marked you in for ${challengeAsk(ch, after.stake)}`;
        if (m.move === 'decline') text = `${by} marked that you passed this time`;
        if (m.move === 'counter') text = `${by} marked you down for ${challengeFmt(ch)(m.stake)}`;
        if (m.move === 'withdraw') text = `${by} called off your challenge with ${first(ch[other(m.side)].name)}`;
        if (text) out.push({ id: `chm:${ch.id}:${m.id}`, kind: 'challenge', at: m.at, target, text });
        continue;
      }
      const yours = side === other(m.side);
      let text = null;
      // The challenge is the maker's: when they answer a counter it's on "your counter", and when
      // they call it off it's "the challenge", never "yours"
      const theirs = first(ch[other(m.side)].name);
      const ofIt = ch.setBy ? `the one with ${theirs}` : m.side === 'to' ? `${theirs}’s challenge` : `a challenge with ${theirs}`;
      const yourAsk = ch.setBy ? 'the one with you' : m.side === 'to' ? 'challenge' : 'counter';
      if (m.move === 'accept') text = yours ? `${who} is in for ${challengeAsk(ch, after.stake)}` : `${who} accepted ${ofIt}`;
      if (m.move === 'decline') text = yours ? (ch.setBy ? `${who} passed on ${yourAsk} this time` : `${who} passed on your ${yourAsk} this time`) : `${who} passed on ${ofIt}`;
      if (m.move === 'counter') text = yours ? `${who} came back with ${challengeFmt(ch)(m.stake)}` : `${who} came back on ${ofIt}`;
      if (m.move === 'withdraw') text = yours ? `${who} called off ${m.side === 'to' && !ch.setBy ? 'your' : 'the'} challenge` : `${who} called off a challenge with ${theirs}`;
      if (text) out.push({ id: `chm:${ch.id}:${m.id}`, kind: 'challenge', at: m.at, target, text });
    }
  }
  return out;
}

// --------------------------- moved to another day ---------------------------

/**
 * The old plan's keys to the new plan's, for a round kept for another day: the organizer to the
 * organizer, anyone on both by their key, and anyone else (a friend from the group link, who got a
 * player id at the roll call) by their name, when exactly one person on the new plan has it.
 */
export function movedKeys(oldPlan, newPlan) {
  const keys = {};
  const newPeople = (newPlan?.people || []).filter(p => p?.id);
  const taken = new Set();
  const oldWho = [...new Set([...(oldPlan?.people || []).map(p => p?.id), ...Object.keys(oldPlan?.answers || {})].filter(Boolean))];
  const nameOf = who => (oldPlan.people || []).find(p => p.id === who)?.name || oldPlan.answers?.[who]?.name || '';
  const later = [];
  for (const who of oldWho) {
    const to = who === oldPlan.hostWho ? newPlan.hostWho : newPeople.some(p => p.id === who) ? who : null;
    if (to) { keys[who] = to; taken.add(to); } else later.push(who);
  }
  for (const who of later) {
    const n = first(nameOf(who)).toLowerCase();
    const fits = newPeople.filter(p => !taken.has(p.id) && first(p.name).toLowerCase() === n);
    if (fits.length === 1) { keys[who] = fits[0].id; taken.add(fits[0].id); }
  }
  return keys;
}

/**
 * The `movedFrom` for a plan made from `oldPlan`'s round kept for another day: the old plan (by
 * its id and code, with its keys to the new plan's), and every plan the old one came from in turn.
 */
export function movedFromFor(oldPlan, newPlan) {
  if (!oldPlan?.id) return [];
  const keys = movedKeys(oldPlan, newPlan);
  const earlier = (Array.isArray(oldPlan.movedFrom) ? oldPlan.movedFrom : []).filter(isObj).map(e => ({
    ...e, keys: Object.fromEntries(Object.entries(isObj(e.keys) ? e.keys : {}).map(([a, b]) => [a, keys[b] ?? b])),
  }));
  return [{ id: oldPlan.id, code: oldPlan.code ?? null, keys }, ...earlier];
}

// --------------------------- on the preview ---------------------------------

/** What's on it with no amount, for an image with amounts hidden: "match", "per hole", "closest to the pin", "Longest drive". */
export function challengeWhatNoAmount(ch) {
  return { match: 'match', hole: 'per hole', ctp: 'closest to the pin', custom: cleanBetLabel(ch.label) || 'side bet' }[ch.kind] || 'side bet';
}

/**
 * A plan's agreed challenges, for the preview: [{ ch, from, to, what, plain }] ("Dave", "Mike",
 * "$20 match", "match"), oldest first. Only the agreed ones still going: an open one isn't on yet.
 */
export function agreedOnPlan(state, plan, now = Date.now()) {
  return planChallenges(state, plan)
    .filter(ch => challengeState(ch).status === 'accepted' && challengeLife(state, ch, now) === 'live')
    .reverse()
    .map(ch => {
      const holes = ch.holes !== 'all' ? `, ${HOLES_LABEL[ch.holes].toLowerCase()}` : '';
      return { ch, from: ch.from.who, to: ch.to.who, fromName: first(ch.from.name), toName: first(ch.to.name), what: `${challengeWhat(ch)}${holes}`, plain: `${challengeWhatNoAmount(ch)}${holes}`, money: ch.unit !== 'points' };
    });
}
