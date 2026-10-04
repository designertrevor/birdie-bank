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
//   it off before it's played; 'on' is the phone starting the round putting it in. Moves are played
//   back in time order and one that doesn't fit where the challenge stands is skipped, so two phones
//   that tap at once always end up agreeing.
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
export function newChallenge({ id, from, to, kind, stake, holes = 'all', label = '', plan = null, unit = 'money', now = Date.now() }) {
  const ch = {
    id, v: 1,
    from: { who: from.who, name: first(from.name) },
    to: { who: to.who, name: first(to.name) },
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
  if (!draft?.to?.who) return 'Pick who you’re challenging';
  if (draft.from?.who && draft.from.who === draft.to.who) return 'You can’t challenge yourself';
  if (!validStake(Number(draft.stake))) return 'Pick an amount';
  if (draft.kind === 'custom' && !cleanBetLabel(draft.label)) return 'Give it a name';
  return null;
}

/** A well-formed challenge from the server (or anywhere), or null: a garbled one is left out. */
export function cleanChallenge(raw) {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  if (!isObj(raw.from) || !isObj(raw.to) || !raw.from.who || !raw.to.who || raw.from.who === raw.to.who) return null;
  if (!CHALLENGE_KINDS.includes(raw.kind) || !validStake(raw.stake)) return null;
  return raw;
}

/** Moves in the order they count: by time, then id, so every phone plays them back the same way. */
function ordered(moves) {
  return (Array.isArray(moves) ? moves : []).filter(m => isObj(m) && m.id && m.move)
    .slice().sort((a, b) => (a.at || 0) - (b.at || 0) || String(a.id).localeCompare(String(b.id)));
}

/**
 * Where a challenge stands, from its moves:
 * { status, stake, turn, by, counters, roundId, at, acceptedAt }
 * - status: 'open' (waiting on `turn`), 'countered' (a new amount, waiting on `turn`), 'accepted',
 *   'declined', 'off' (called off) or 'on' (in a round, `roundId`).
 * - stake: the amount as it stands now (the last counter's). `by`: the side that made the last move.
 * - at: when it last changed; acceptedAt: when it was agreed (null until then).
 */
export function challengeState(ch) {
  const s = { status: 'open', stake: ch.stake, turn: 'to', by: 'from', counters: 0, roundId: null, at: ch.at || 0, acceptedAt: null };
  for (const m of ordered(ch.moves)) {
    if (!fits(s, m)) continue;
    s.by = m.side;
    s.at = m.at || s.at;
    if (m.move === 'accept') { s.status = 'accepted'; s.turn = null; s.acceptedAt = m.at || s.at; }
    else if (m.move === 'decline') { s.status = 'declined'; s.turn = null; }
    else if (m.move === 'counter') { s.status = 'countered'; s.stake = roundStake(m.stake); s.turn = other(m.side); s.counters++; }
    else if (m.move === 'withdraw') { s.status = 'off'; s.turn = null; }
    else if (m.move === 'on') { s.status = 'on'; s.turn = null; s.roundId = m.roundId || null; }
  }
  return s;
}

/** Whether a move fits where the challenge stands `s` (see challengeState). */
function fits(s, m) {
  const waiting = s.status === 'open' || s.status === 'countered';
  switch (m.move) {
    case 'accept': case 'decline': return waiting && m.side === s.turn;
    case 'counter': return waiting && m.side === s.turn && s.counters < MAX_COUNTERS && validStake(Number(m.stake)) && roundStake(m.stake) !== s.stake;
    case 'withdraw': return (waiting || s.status === 'accepted') && (m.side === 'from' || m.side === 'to');
    case 'on': return s.status === 'accepted';
    default: return false;
  }
}

/** Whether `side` can make `move` now (for the buttons). A counter without a `stake` asks whether one could be made at all. */
export function canMove(ch, side, move, stake = null) {
  if ((ch.moves || []).length >= MAX_MOVES) return false;
  const s = challengeState(ch);
  if (move === 'counter' && stake == null) return (s.status === 'open' || s.status === 'countered') && side === s.turn && s.counters < MAX_COUNTERS;
  return fits(s, { move, side, stake });
}

/** The challenge with a move made on it, or null when the move doesn't fit (nothing changes). */
export function withMove(ch, { id, side, move, stake = null, roundId = null, at = Date.now() }) {
  if (!canMove(ch, side, move, move === 'counter' ? Number(stake) : null)) return null;
  const m = { id, side, move, at };
  if (move === 'counter') m.stake = roundStake(stake);
  if (move === 'on' && roundId) m.roundId = roundId;
  return { ...ch, moves: [...(ch.moves || []), m] };
}

/** Moves from two copies of a challenge put together (each move once, by id). */
export function mergeMoves(a = [], b = []) {
  const byId = new Map();
  for (const m of [...(a || []), ...(b || [])]) if (isObj(m) && m.id && !byId.has(m.id)) byId.set(m.id, m);
  return ordered([...byId.values()]);
}

// --------------------------- whose it is ------------------------------------

/** The plan a challenge is for on this phone (found by its id, else its code), or null. */
export function planOf(state, ch) {
  if (!ch?.plan) return null;
  const plans = state?.plans || {};
  const byId = ch.plan.id ? plans[ch.plan.id] : null;
  if (byId && (!ch.plan.code || !byId.code || byId.code === ch.plan.code)) return byId;
  return ch.plan.code ? Object.values(plans).find(p => p?.code === ch.plan.code) || null : null;
}

/** Your key on a plan on this phone: the organizer's own key, or who you said you are. */
export const planMe = plan => (plan ? (plan.host ? plan.hostWho : plan.localMe) : null);

/** Which side of a challenge you are on this phone: 'from', 'to' or null (it's between two others). */
export function sideOf(state, ch) {
  if (ch.plan) {
    const me = planMe(planOf(state, ch));
    if (!me) return null;
    return me === ch.from.who ? 'from' : me === ch.to.who ? 'to' : null;
  }
  return ch.mine === 'from' || ch.mine === 'to' ? ch.mine : null;
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
    const plan = planOf(state, ch);
    if (!plan || plan.gone || plan.status === 'off') return 'gone';
    if (plan.status === 'started') return 'missed';
    const days = daysUntil(plan.date, new Date(now));
    return days != null && days < 0 ? 'missed' : 'live';
  }
  if (s.status === 'accepted') return now - (s.acceptedAt || s.at) > ACCEPTED_DAYS * DAY ? 'expired' : 'live';
  return now - (ch.at || 0) > OPEN_DAYS * DAY ? 'expired' : 'live';
}

/** Every challenge on this phone, well formed. */
export function allChallenges(state) {
  return Object.values(state?.challenges || {}).map(cleanChallenge).filter(Boolean);
}

/** Your challenges still going, for Up next: your call first, then waiting on them, then agreed. */
export function myChallenges(state, now = Date.now()) {
  const rank = (ch, side) => { const s = challengeState(ch); return s.turn === side ? 0 : s.turn ? 1 : 2; };
  return allChallenges(state)
    .map(ch => ({ ch, side: sideOf(state, ch) }))
    .filter(x => x.side && challengeLife(state, x.ch, now) === 'live')
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
    const a = inRound(idOf[ch.from.who]), b = inRound(idOf[ch.to.who]);
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
 * on a points round or a points one on a money round (unitFits). Never one already in the round or
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

/** "You challenged Mike", "Dave challenged you", "Dave challenged Mike". */
export function challengeHeadline(ch, side) {
  if (side === 'from') return `You challenged ${first(ch.to.name)}`;
  if (side === 'to') return `${first(ch.from.name)} challenged you`;
  return `${first(ch.from.name)} challenged ${first(ch.to.name)}`;
}

/**
 * Where it stands in a few friendly words, for you (`side`): "Your call", "Waiting on Mike",
 * "Mike says $10", "You’re on", "In the round", "Not this time", "Called off".
 */
export function challengeStatusText(ch, side, life = 'live') {
  const s = challengeState(ch);
  const name = k => (k === side ? 'You' : first(ch[k]?.name));
  if (s.status === 'on') return 'In the round';
  if (s.status === 'declined') return s.by === side ? 'You passed' : `${name(s.by)} passed this time`;
  if (s.status === 'off') return s.by === side ? 'You called it off' : `${name(s.by)} called it off`;
  if (life === 'missed') return 'Missed the round';
  if (life === 'gone') return 'The round’s off';
  if (life === 'expired') return 'Ran out of time';
  if (s.status === 'accepted') return side ? 'You’re on' : 'It’s on';
  if (s.status === 'countered') {
    const says = `${s.by === side ? 'You' : first(ch[s.by].name)} said ${challengeFmt(ch)(s.stake)}`;
    return s.turn === side ? `${says}. Your call` : says;
  }
  return s.turn === side ? 'Your call' : `Waiting on ${first(ch[s.turn].name)}`;
}

/** The status chip's look: 'mine' (your call), 'wait', 'on' (agreed or in the round) or 'done'. */
export function challengeTone(ch, side, life = 'live') {
  const s = challengeState(ch);
  if (s.status === 'on' || (s.status === 'accepted' && life === 'live')) return 'on';
  if (life !== 'live' || s.status === 'declined' || s.status === 'off') return 'done';
  return s.turn === side ? 'mine' : 'wait';
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
  const lead = s.status === 'countered' && s.by === side
    ? `${to}, I’ll do ${challengeAsk(ch)} instead.`
    : `${to}, you up for ${challengeAsk(ch)}${holes}${when ? ` ${when}` : ''}?`;
  return [lead, 'Tap to accept, decline or name your own amount:', link].filter(Boolean).join('\n');
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
  if (s.status === 'accepted') return ch.plan ? 'It goes in as a side bet when the round starts.' : 'It goes in as a side bet the next time you two play a round together.';
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
    const target = ['challenge', { id: ch.id }];
    const fromN = first(ch.from.name), toN = first(ch.to.name);
    if (side !== 'from' && inWindow(ch.at)) {
      out.push({ id: `ch:${ch.id}`, kind: 'challenge', at: ch.at, target, text: side === 'to' ? `${fromN} challenged you to ${challengeAsk(ch, ch.stake)}` : `${fromN} challenged ${toN}` });
    }
    // Play the moves back to know what each one did (an amount as it stood then)
    const played = { ...ch, moves: [] };
    for (const m of ordered(ch.moves)) {
      const next = withMove(played, m);
      if (!next) continue;
      played.moves = next.moves;
      if (m.side === side || m.side === 'keeper' || m.move === 'on' || !inWindow(m.at)) continue;
      const who = first(ch[m.side].name);
      const yours = side === other(m.side);
      let text = null;
      if (m.move === 'accept') text = yours ? `${who} is in for ${challengeAsk(ch, challengeState(played).stake)}` : `${who} accepted ${first(ch[other(m.side)].name)}’s challenge`;
      if (m.move === 'decline') text = yours ? `${who} passed on your challenge this time` : `${who} passed on ${first(ch[other(m.side)].name)}’s challenge`;
      if (m.move === 'counter') text = yours ? `${who} came back with ${challengeFmt(ch)(m.stake)}` : `${who} came back on ${first(ch[other(m.side)].name)}’s challenge`;
      if (m.move === 'withdraw') text = yours ? `${who} called off your challenge` : `${who} called off a challenge with ${first(ch[other(m.side)].name)}`;
      if (text) out.push({ id: `chm:${ch.id}:${m.id}`, kind: 'challenge', at: m.at, target, text });
    }
  }
  return out;
}
