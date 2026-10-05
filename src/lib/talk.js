// Trash talk: reactions and comments on a finished round, its settle-ups and its side bets
// between two players, on an upcoming round, on a challenge, and on a payment marked paid on the
// Tab (its round's settle-up line), plus quick jabs to pick from. Pure, unit tested. The transport is talk-sync.js; the server's rules are
// supabase/2026-10-04-comments.sql, and talk-access.js is the same rules in JavaScript.
//
// Each round or plan is one thread on this phone: state.talk[threadKey] = { rowId: row }, where
// a row is one comment, or one person's reaction with one emoji:
//   { id, on, kind: 'comment' | 'reaction', who, name, body, jab, emoji, at, updatedAt, deleted, mine, sent }
// `on` says what it's about: 'round', 'plan', 'challenge', 'pay:from>to' (a settle-up line, which
// a payment on the Tab talks on too) or 'bet:id' (a side bet between two). `who` is the author's seat in that round (or their id on the plan), the same
// on every phone in it. `mine`: written from this phone (or your account), so you can take it
// back. `sent`: the updatedAt the server has, so a row with sent !== updatedAt still has to go up.
// Nothing here ever touches money.
import { GAMES } from './round.js';
import { gameLabel, meFor, myIds } from './format.js';
import { canonicalOf, codeOf } from './pair-debts.js';
import { isTripPayment } from './trip-pay.js';
import { nameOf } from './ledger.js';
import { dayLabel, planPeople } from './plans.js';
import { countsMoney, playForOf, tabResults } from './play-for.js';
import { betsOf, isCashBet } from './pair-bets.js';
import { roundTime } from './history.js';
import { agoLabel, LATELY_DAYS } from './lately.js';
import { challengeLife, challengeWhatNoAmount, cleanChallenge, setUpHere, sideOf } from './challenges.js';
import { challengeMoments, roundMoments, settleMoments } from './jab-moments.js';
export { countsLine, roundTalkCounts, talkCounts } from './talk-counts.js';

const DAY = 864e5;
/** The longest comment, the same as the server's check. */
export const MAX_BODY = 280;

/** The reactions, in the order they show. `key` is what the server stores. */
export const REACTIONS = [
  { key: 'clap', emoji: '👏', label: 'Nice one' },
  { key: 'fire', emoji: '🔥', label: 'On fire' },
  { key: 'laugh', emoji: '😂', label: 'Too funny' },
  { key: 'yikes', emoji: '😬', label: 'Yikes' },
  { key: 'money', emoji: '💸', label: 'Pay up', money: true },
];
const REACTION_BY_KEY = Object.fromEntries(REACTIONS.map(r => [r.key, r]));
export const emojiOf = key => REACTION_BY_KEY[key]?.emoji || '';

/**
 * Quick jabs, one list for each kind of thing. Friendly ribbing between friends, never about
 * anyone's looks, money troubles or anything off the course, and nothing that sounds like a casino.
 * A jab marked `money` talks about money, so it shows only on a thing played for money (never on a
 * points or lunch round). The lists after `gallery` are for a moment (see jab-moments.js): a birdie
 * or a three-putt in the round, how it went for you, a settle-up still owed or paid, and where a
 * challenge stands. Their jabs come first, then the thing's own list. Every key is unique (a posted
 * jab keeps its key) and at most 32 characters, the server's column.
 */
export const JABS = {
  round: [
    { key: 'putt', text: 'Nice putt, finally' },
    { key: 'chip', text: 'Who taught you to chip?' },
    { key: 'lesson', text: 'Put your winnings toward a lesson', money: true },
    { key: 'gimme', text: 'That was not a gimme' },
    { key: 'bounce', text: 'Lucky bounce. Still counts' },
    { key: 'rematch', text: 'I want a rematch' },
    { key: 'carried', text: 'Thanks for carrying me, partner' },
    { key: 'sameTime', text: 'Same time next time?' },
  ],
  // A settle-up line, owed or paid
  settle: [
    { key: 'business', text: 'Pleasure doing business' },
    { key: 'spend', text: 'Don’t spend it all at once' },
    { key: 'back', text: 'I’ll win it back next time' },
  ],
  bet: [
    { key: 'easy', text: 'Easiest money all day', money: true },
    { key: 'double', text: 'Rematch, same bet?' },
    { key: 'strokes', text: 'I want more strokes next time' },
    { key: 'called', text: 'Called it on the first tee' },
  ],
  plan: [
    { key: 'agame', text: 'Bringing my A game' },
    { key: 'practice', text: 'Hope you’ve been practicing' },
    { key: 'wallet', text: 'Bring your wallet', money: true },
    { key: 'firstRound', text: 'Loser buys the first round' },
    { key: 'teeTime', text: 'Don’t be late for the tee time' },
  ],
  // From a friend watching someone else's round (the Friends feed): cheering and ribbing from the
  // gallery, nothing about the money (they may not see it) and nothing only a player would say
  gallery: [
    { key: 'niceShot', text: 'Nice shot!' },
    { key: 'pressure', text: 'Pressure’s on' },
    { key: 'wishThere', text: 'Wish I was out there' },
    { key: 'fairway', text: 'Find the fairway' },
    { key: 'watching', text: 'I’m watching every hole' },
    { key: 'buying', text: 'Who’s buying after?' },
  ],
  // A challenge between two (challenges.js): its own list, then one for where it stands
  challenge: [
    { key: 'chFirstTee', text: 'See you on the first tee' },
    { key: 'chWarm', text: 'Better start warming up' },
    { key: 'chTalk', text: 'All talk until the first tee' },
  ],
  // ...waiting on an answer
  chOpen: [
    { key: 'chTick', text: 'Tick tock. In or out?' },
    { key: 'chThink', text: 'Take your time. I’ll wait' },
    { key: 'chScared', text: 'Nervous? Totally fine' },
  ],
  // ...agreed (or already in a round)
  chAccepted: [
    { key: 'chGameOn', text: 'Game on' },
    { key: 'chRegret', text: 'You’re going to regret that' },
    { key: 'chBring', text: 'Bring your best stuff' },
  ],
  // ...passed this time
  chDeclined: [
    { key: 'chNextTime', text: 'Next time, then' },
    { key: 'chMaybe', text: 'I’ll take that as a maybe' },
    { key: 'chSmart', text: 'Smart move, honestly' },
  ],
  // Someone in the round made a birdie (or better)
  birdie: [
    { key: 'birdieTour', text: 'Somebody call the tour' },
    { key: 'birdieAgain', text: 'Do that again. I dare you' },
    { key: 'birdieFluke', text: 'Skill or fluke? Asking for a friend' },
  ],
  // Someone three-putted (marked in a Snake game)
  threePutt: [
    { key: 'threePutt', text: 'Three putts? The hole wasn’t moving' },
    { key: 'snakeYours', text: 'The snake looks good on you' },
    { key: 'lagPutt', text: 'Lag putting is a skill, I hear' },
  ],
  // The round went your way
  win: [
    { key: 'winHumble', text: 'I’ll try to stay humble' },
    { key: 'winTrophy', text: 'Where do I pick up my trophy?' },
  ],
  // The round didn't go your way
  loss: [
    { key: 'lossMine', text: 'Next time is mine' },
    { key: 'lossFun', text: 'Still had more fun than you' },
    { key: 'lossLucky', text: 'You got lucky and you know it' },
  ],
  // A settle-up line still owed
  owed: [
    { key: 'payUp', text: 'Pay up, partner', money: true },
    { key: 'tabForgets', text: 'The Tab never forgets' },
    { key: 'noRush', text: 'No rush. Okay, a little rush' },
  ],
  // A payment marked paid
  paid: [
    { key: 'finally', text: 'Paid in full. Finally' },
    { key: 'receipt', text: 'Framing this one' },
    { key: 'paidFast', text: 'Fastest payment in the West' },
  ],
};
const JAB_BY_KEY = Object.fromEntries(Object.values(JABS).flat().map(j => [j.key, j]));
/** The most jabs a picker shows at once (a moment's first, then the thing's own). */
export const MAX_JABS = 8;

/** What a target is: 'round', 'settle', 'bet', 'plan' or 'challenge'. */
export function contextOf(on) {
  const s = String(on || '');
  if (s.startsWith('pay:')) return 'settle';
  if (s.startsWith('bet:')) return 'bet';
  if (s === 'plan') return 'plan';
  if (s === 'challenge') return 'challenge';
  return 'round';
}
/**
 * The reactions to offer on a target: all five on a thing played for money, and no "Pay up" on a
 * points or lunch round (the same rule as the jabs). One someone already picked still shows.
 */
export function reactionsFor({ money = true, picked = [] } = {}) {
  const have = new Set(picked);
  return REACTIONS.filter(r => money || !r.money || have.has(r.key));
}
/**
 * The jabs that fit a target. `money`: whether that thing is played for money (see moneyOn);
 * `set`: a list to use instead ('gallery' for a friend watching); `moments`: what happened that
 * the jabs can be about ('birdie', 'loss', 'owed', 'chAccepted' and the rest, see jab-moments.js),
 * whose jabs come first. Each jab once, at most MAX_JABS.
 */
export function jabsFor(on, { money = true, set = null, moments = [] } = {}) {
  const base = (set && JABS[set]) || JABS[contextOf(on)] || JABS.round;
  const extra = (moments || []).flatMap(m => (m !== set && JABS[m] && JABS[m] !== base ? JABS[m] : []));
  if (!extra.length) return money ? base : base.filter(j => !j.money);
  const seen = new Set();
  return [...extra, ...base]
    .filter(j => (money || !j.money) && !seen.has(j.key) && seen.add(j.key))
    .slice(0, MAX_JABS);
}

/**
 * The critter from the Ball buddies art (avatars.js) that sits by the jabs, for the first moment
 * there is, else for the kind of thing: { id, bg }.
 */
const JAB_ART = {
  birdie: { id: 'birdie', bg: 'mint' }, threePutt: { id: 'goose', bg: 'lav' }, win: { id: 'tiger', bg: 'pink' },
  loss: { id: 'frog', bg: 'peach' }, owed: { id: 'gopher', bg: 'blush' }, paid: { id: 'flamingo', bg: 'ochre' },
  chOpen: { id: 'flag', bg: 'mint' }, chAccepted: { id: 'eagle', bg: 'teal' }, chDeclined: { id: 'goose', bg: 'lav' },
  round: { id: 'birdie', bg: 'mint' }, settle: { id: 'gopher', bg: 'blush' }, bet: { id: 'tiger', bg: 'pink' },
  plan: { id: 'flag', bg: 'mint' }, gallery: { id: 'birdie', bg: 'mint' }, challenge: { id: 'flag', bg: 'mint' },
};
export function jabArt(on, { set = null, moments = [] } = {}) {
  const m = (moments || []).find(k => JAB_ART[k]);
  return JAB_ART[m] || JAB_ART[set] || JAB_ART[contextOf(on)] || JAB_ART.round;
}

/**
 * Whether a target in a round is played for money: a settle-up line always is (it's on the Tab),
 * a side bet when the round is for money or it's a lunch round's bet for money, and the round
 * itself when it counts money. A points or reward round reads in points or the reward.
 */
export function moneyOn(round, on) {
  const c = contextOf(on);
  if (c === 'settle') return true;
  if (c === 'bet') {
    const bet = betsOf(round).find(b => b.id === String(on).slice(4));
    return !!bet && (countsMoney(round) || isCashBet(round, bet));
  }
  return countsMoney(round);
}

// --------------------------- threads and targets ---------------------------

export const roundThread = round => `round:${round.id}`;
export const planThread = plan => `plan:${plan.id}`;
/** A challenge between two (challenges.js), by its id on this phone. */
export const challengeThread = ch => `challenge:${ch.id}`;
/** A friend's round you watch from the Friends feed, by its code: its talk is the round's own. */
export const followThread = code => `follow:${code}`;
/** A settle-up line of a round: one transfer, from `from` to `to`. */
export const payTarget = (from, to) => `pay:${from}>${to}`;
/** A side bet between two players. */
export const betTarget = id => `bet:${id}`;
export const reactionRowId = (on, who, key) => `r:${on}:${who}:${key}`;

// Cut to n characters without splitting an emoji in two (half of one is a character the server refuses)
const cut = (s, n) => s.slice(0, n).replace(/[\uD800-\uDBFF]$/, '');
/** Tidy a comment: single spaces, no blank lines, at most MAX_BODY characters. */
export function cleanBody(text) {
  return cut(String(text || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(), MAX_BODY).trim();
}
const cleanName = name => cut(String(name || '').replace(/\s+/g, ' ').trim(), 40).trim() || null;

/** A new comment, or null when there's nothing to say. A jab keeps its key so it reads as one. */
export function newComment({ id, on, who, name, body, jab = null, now = Date.now() }) {
  const known = jab && JAB_BY_KEY[jab];
  const text = cleanBody(known ? known.text : body);
  if (!text || !who || !on || !id) return null;
  return { id, on, kind: 'comment', who, name: cleanName(name), body: text, jab: known ? jab : null, emoji: null, at: now, updatedAt: now, deleted: false, mine: true };
}

/**
 * Tap a reaction: on if you hadn't, off if you had. Returns the row to save (an off reaction stays
 * as a row marked deleted, so the other phones hear it went).
 */
export function toggleReaction(rows, { on, who, name, emoji, now = Date.now() }) {
  if (!REACTION_BY_KEY[emoji] || !who || !on) return null;
  const id = reactionRowId(on, who, emoji);
  const had = rows?.[id];
  // A new tap is a new try: a copy the server refused before goes up again
  if (had) return { ...had, deleted: !had.deleted, name: cleanName(name) || had.name, updatedAt: Math.max(now, (had.updatedAt || 0) + 1), mine: true, refused: false };
  return { id, on, kind: 'reaction', who, name: cleanName(name), body: null, jab: null, emoji, at: now, updatedAt: now, deleted: false, mine: true };
}

/** Take a comment back. Its words go with it; the row stays so the other phones hear it went. */
export function removedRow(row, now = Date.now()) {
  return { ...row, deleted: true, body: row.kind === 'comment' ? '' : row.body, jab: null, updatedAt: Math.max(now, (row.updatedAt || 0) + 1) };
}

/** A row from the server or another phone is one this app can show. */
export function validRow(r) {
  if (!r || typeof r !== 'object' || !r.id || !r.on || !r.who) return false;
  if (r.kind === 'reaction') return !!REACTION_BY_KEY[r.emoji];
  if (r.kind === 'comment') return r.deleted || !!cleanBody(r.body);
  return false;
}

/**
 * Put rows from the server into a thread: the newer edit of each row wins. A row of yours that
 * hasn't gone up yet stays as it is unless the server's copy is newer still.
 */
export function mergeRows(local = {}, incoming = []) {
  const out = { ...local };
  let changed = false;
  for (const r of incoming) {
    if (!validRow(r)) continue;
    const had = out[r.id];
    if (had) {
      const waiting = had.mine && had.sent !== had.updatedAt;
      if ((r.updatedAt || 0) < (had.updatedAt || 0) || (waiting && (r.updatedAt || 0) === (had.updatedAt || 0))) continue;
      const next = { ...had, ...r, mine: had.mine || r.mine, sent: r.updatedAt };
      if (JSON.stringify(next) === JSON.stringify(had)) continue;
      out[r.id] = next;
    } else {
      out[r.id] = { ...r, sent: r.updatedAt };
    }
    changed = true;
  }
  return changed ? out : local;
}

/**
 * Who sees a thread's talk, from what this phone knows: { can, linked, shared, closed, off }.
 * `code`: the round's share code or the plan's link code (null when it never had one); `off`: no
 * server or no comments table yet; `seats`: what the server said when this phone joined (undefined
 * until it has, null when it said this phone isn't in it). A player always gets to talk: when the
 * server can't place this phone (the live round is gone and it never joined, or a new phone the
 * round doesn't know), the talk stays on this phone (`closed`) instead of the section vanishing.
 */
/**
 * The key a thread's seats are kept under for the session: one per way in (a player's seats, or a
 * friend watching) and code. A friend watching follows as an account, so theirs is kept per account
 * too: signing in after a look while signed out, or as someone else, asks the server again.
 */
export function talkSeatKey(t, user = null) {
  if (t?.via === 'follow') return `follow:${user || '-'}:${t.code}`;
  return `${t?.scope}:${t?.code}`;
}

export function talkReach({ off = false, code = null, seats } = {}) {
  const linked = !!code;
  if (off || !linked) return { can: true, linked, shared: false, closed: false, off: !!off };
  if (seats === null) return { can: true, linked, shared: false, closed: true, off: false };
  return { can: true, linked, shared: true, closed: false, off: false };
}

/** Rows of yours the server doesn't have yet (a row it refused for good is left out). */
export const unsentRows = (rows = {}) => Object.values(rows).filter(r => r.mine && !r.refused && r.sent !== r.updatedAt);

// --------------------------- views ------------------------------------------

const live = r => r && !r.deleted;

/**
 * Reactions on one target: [{ key, emoji, label, count, mine, who }] in REACTIONS order, only the
 * ones someone picked. One friend is one person (canonical ids), so their two seats count once.
 */
export function reactionsOn(rows = {}, on, { me = null, canon = x => x } = {}) {
  const meId = me ? canon(me) : null;
  return REACTIONS.map(r => {
    const who = [...new Set(Object.values(rows).filter(x => live(x) && x.kind === 'reaction' && x.on === on && x.emoji === r.key).map(x => canon(x.who)))];
    return { ...r, count: who.length, mine: meId != null && who.includes(meId), who };
  }).filter(r => r.count > 0);
}

/** Comments on one target (or on everything when `on` is null), oldest first. */
export function commentsOn(rows = {}, on = null) {
  return Object.values(rows)
    .filter(x => live(x) && x.kind === 'comment' && (on == null || x.on === on))
    .sort((a, b) => a.at - b.at || String(a.id).localeCompare(String(b.id)));
}

/** Who you are in a round's talk: your seat, or null when you only watched it. */
export function talkWho(round, state) {
  const me = round ? meFor(round, state) : null;
  return me && round.players.some(p => p.id === me) ? me : null;
}
/** Who you are on a plan's talk (the organizer's own id on it, or the seat you picked from the link). */
export const planWho = plan => (plan ? (plan.host ? plan.hostWho : plan.localMe) || null : null);

const firstOf = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';

/**
 * The name to show for a row: "You" for you, the name this phone keeps for the person (one
 * friend is one person, see people-links.js), else the name they wrote it under.
 */
export function talkName(state, row, { me = null, seatName = null } = {}) {
  const ids = myIds(state);
  if ((me && row.who === me) || ids.has(row.who)) return 'You';
  const kept = canonicalOf(state)(row.who);
  if (kept === state.me) return 'You';
  // A friend linked to another card goes by that card's name; otherwise the seat's own name
  const known = kept !== row.who ? nameOf(state, kept) : seatName?.(row.who);
  return firstOf(known && known !== '?' ? known : row.name);
}

/** A round's name in one short line: "Skins at Pebble Creek". */
export const roundLine = r => `${gameLabel(r)} at ${r.course?.name || 'the course'}`;
const quote = (s, max = 80) => {
  const t = cleanBody(s);
  return `“${t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t}”`;
};

/**
 * Lately items for the talk: in each thread, the newest comment by someone else (with how many
 * more), and who else reacted. [{ id, kind: 'talk' | 'react', at, text, sub, target }]
 */
export function latelyTalk(state, now = Date.now(), { days = LATELY_DAYS } = {}) {
  const t = typeof now === 'number' ? now : now.getTime();
  const since = t - days * DAY;
  const inWindow = at => typeof at === 'number' && at >= since && at <= t + 60000;
  const ids = myIds(state);
  const canon = canonicalOf(state);
  const notMe = row => !row.mine && !ids.has(row.who) && canon(row.who) !== state.me;
  const items = [];
  const add = (key, rows, { title, target, seatName, me }) => {
    const list = Object.values(rows || {}).filter(r => live(r) && notMe(r) && r.who !== me && inWindow(r.updatedAt ?? r.at));
    const comments = list.filter(r => r.kind === 'comment').sort((a, b) => b.at - a.at);
    if (comments.length) {
      const c = comments[0];
      const more = comments.length - 1;
      items.push({
        id: `talk:${key}`, kind: 'talk', at: c.at,
        text: `${talkName(state, c, { me, seatName })}: ${quote(c.body)}`,
        sub: [title, more ? `${more} more` : null, agoLabel(c.at, t)].filter(Boolean).join(' · '),
        target,
      });
    }
    const reacts = list.filter(r => r.kind === 'reaction').sort((a, b) => b.updatedAt - a.updatedAt);
    if (reacts.length) {
      const names = [...new Set(reacts.map(r => talkName(state, r, { me, seatName })))];
      const emojis = [...new Set(reacts.map(r => emojiOf(r.emoji)))].join('');
      const who = names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
      const at = reacts[0].updatedAt ?? reacts[0].at;
      items.push({ id: `react:${key}`, kind: 'react', at, text: `${who} reacted ${emojis}`, sub: [title, agoLabel(at, t)].join(' · '), target });
    }
  };
  for (const r of Object.values(state.rounds || {})) {
    if (r?.status !== 'done' || !GAMES[r.game]) continue;
    const key = roundThread(r);
    if (!state.talk?.[key]) continue;
    add(key, state.talk[key], {
      title: roundLine(r), target: ['roundDetail', { id: r.id }], me: talkWho(r, state),
      seatName: id => r.players.find(p => p.id === id)?.name || null,
    });
  }
  for (const p of Object.values(state.plans || {})) {
    // A plan called off (or taken down) has no talk on its page any more, so none here either
    if (!p || p.status === 'off' || p.gone || !state.talk?.[planThread(p)]) continue;
    const day = dayLabel(p.date, new Date(t)).replace(/^(Today|Tomorrow)$/, w => w.toLowerCase());
    add(planThread(p), state.talk[planThread(p)], {
      title: [day ? `Plan for ${day}` : 'Upcoming round', p.course?.name].filter(Boolean).join(' at '),
      target: ['plan', { id: p.id }], me: planWho(p),
      seatName: planTalk(p).seatName,
    });
  }
  for (const raw of Object.values(state.challenges || {})) {
    const ch = cleanChallenge(raw);
    if (!ch || !state.talk?.[challengeThread(ch)]) continue;
    const ctx = challengeTalk(state, ch);
    if (!ctx?.who) continue;
    add(ctx.key, state.talk[ctx.key], { title: challengeTitle(ch, ctx.who), target: ['challenge', { id: ch.id }], me: ctx.who, seatName: ctx.seatName });
  }
  return items.sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id)));
}

/**
 * A challenge's name in one short line, never with its amount: "Challenge with Mike: match", or
 * "Mike v Dave: closest to the pin" for one you set up between two others.
 */
export function challengeTitle(ch, me = null) {
  const a = firstOf(ch.from.name), b = firstOf(ch.to.name);
  const what = challengeWhatNoAmount(ch);
  if (me && me === ch.from.who) return `Challenge with ${b}: ${what}`;
  if (me && me === ch.to.who) return `Challenge with ${a}: ${what}`;
  return `${a} v ${b}: ${what}`;
}

/**
 * The talk between you and a friend, for their card: comments either of you made in rounds you
 * both played, newest first. [{ id, at, name, body, jab, round, target }]
 */
export function personTalk(state, other, { limit = 3 } = {}) {
  const canon = canonicalOf(state);
  const them = canon(other);
  const out = [];
  for (const r of Object.values(state.rounds || {})) {
    const rows = r?.status === 'done' && state.talk?.[roundThread(r)];
    if (!rows) continue;
    const me = talkWho(r, state);
    if (!me || !r.players.some(p => canon(p.id) === them)) continue;
    for (const c of commentsOn(rows)) {
      const by = canon(c.who);
      if (by !== them && by !== state.me && c.who !== me) continue;
      out.push({
        id: `${r.id}:${c.id}`, at: c.at, body: c.body, jab: c.jab, round: r, target: ['roundDetail', { id: r.id }],
        name: talkName(state, c, { me, seatName: id => r.players.find(p => p.id === id)?.name || null }),
      });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** The threads this phone looks up for Lately and the player cards: rounds you played lately, and plans you're on. */
export function recentTalkKeys(state, { days = LATELY_DAYS, now = Date.now() } = {}) {
  const since = now - days * DAY;
  const rounds = Object.values(state.rounds || {}).filter(r => r?.status === 'done' && roundTime(r) >= since && talkWho(r, state));
  const plans = Object.values(state.plans || {}).filter(p => p && p.status === 'planned' && planWho(p));
  // Challenges you're in (or set up) that are still going, and any with talk from lately
  const chs = Object.values(state.challenges || {}).map(cleanChallenge).filter(ch => {
    if (!ch?.code || !challengeTalk(state, ch)?.who) return false;
    if (challengeLife(state, ch, now) === 'live') return true;
    return Object.values(state.talk?.[challengeThread(ch)] || {}).some(r => (r.updatedAt || 0) >= since);
  });
  return [...rounds.map(roundThread), ...plans.map(planThread), ...chs.map(challengeThread)];
}

/** The two ends of a settle-up line's target ('pay:from>to'), or null. */
export function payParts(on) {
  const m = /^pay:(.+?)>(.+)$/.exec(String(on || ''));
  return m ? { from: m[1], to: m[2] } : null;
}

/**
 * Who you are and how names read in a round's talk (for the talk on screen). `momentsOn(on)` says
 * what the jabs can be about there (jab-moments.js): how the round went for you, a birdie or a
 * three-putt on the round itself; owed or paid on a settle-up line.
 */
export function roundTalk(round, state) {
  const who = talkWho(round, state);
  const seatName = id => round.players.find(p => p.id === id)?.name || null;
  let mine = null; // the round's moments, worked out once
  const momentsOn = on => {
    const c = contextOf(on);
    if (c === 'round') return (mine ??= roundMoments(round, who));
    const pay = c === 'settle' ? payParts(on) : null;
    return pay ? settleMoments(state, round, pay.from, pay.to) : [];
  };
  return { key: roundThread(round), who, myName: who ? firstOf(seatName(who)) : null, seatName, kind: 'round', moneyOn: on => moneyOn(round, on), momentsOn };
}

/**
 * The same for a challenge between two (challenges.js): you talk as your side of it (or as whoever
 * set it up between two others), by the ids it was made with, which every phone in it shares. Only
 * the people in it can join in; a challenge on points never talks money.
 */
export function challengeTalk(state, raw) {
  const ch = cleanChallenge(raw);
  if (!ch) return null;
  const side = sideOf(state, ch);
  const setter = !side && setUpHere(state, ch);
  // A side is worked out on the plan its round moved to, if it did; the id is as it was made
  const who = side ? ch[side].who : setter ? ch.setBy.who : null;
  const names = { [ch.from.who]: ch.from.name, [ch.to.who]: ch.to.name, ...(ch.setBy?.who ? { [ch.setBy.who]: ch.setBy.name } : {}) };
  const seatName = id => names[id] || null;
  return {
    key: challengeThread(ch), who, myName: who ? firstOf(seatName(who)) : null, seatName, kind: 'challenge',
    moneyOn: () => ch.unit !== 'points', momentsOn: () => challengeMoments(ch),
  };
}

/**
 * Where a payment on the Tab (shared-tab.js paymentGroups) talks: on its round's settle-up line,
 * the same line the round's page shows, so a reaction on one is on the other. When one tap paid
 * several rounds, the newest one you played that's still on this phone. { round, on } or null for
 * a payment no round of yours explains (money passed on, a trip's expenses).
 */
export function paymentTalk(state, pay) {
  let best = null;
  for (const s of pay?.settlements || []) {
    if (!s || s.expensePay || isTripPayment(s)) continue;
    const r = (s.roundId && state.rounds?.[s.roundId]) || (s.code ? Object.values(state.rounds || {}).find(x => x && codeOf(x) === s.code) : null);
    if (r?.status !== 'done' || !GAMES[r.game] || !talkWho(r, state)) continue;
    if (!tabResults(r).transfers.some(t => t.from === s.from && t.to === s.to)) continue;
    if (!best || roundTime(r) > roundTime(best.round)) best = { round: r, on: payTarget(s.from, s.to) };
  }
  return best;
}
/**
 * The same for a friend's round you watch (the Friends feed): you write as yourself, from the
 * gallery, on the round itself only (never its settle-ups or side bets), with the gallery's jabs
 * and nothing about money.
 */
export function followTalk(code, round, state) {
  const who = state?.me || null;
  const mine = who ? state.players?.[who]?.name : null;
  const seatName = id => round?.players?.find(p => p.id === id)?.name || (id === who ? mine : null) || null;
  return { key: followThread(code), who, myName: who ? firstOf(mine) : null, seatName, kind: 'follow', jabs: 'gallery', moneyOn: () => false };
}

/** The same for a plan's talk. */
export function planTalk(plan) {
  const who = planWho(plan);
  const people = planPeople(plan);
  const seatName = id => people.find(p => p.who === id)?.name || (id === plan.hostWho ? plan.hostName : null) || null;
  const money = playForOf(plan).kind === 'money';
  return { key: planThread(plan), who, myName: who ? firstOf(seatName(who)) : null, seatName, kind: 'plan', moneyOn: () => money };
}

/** Lately with the talk mixed in, newest first. */
export function withTalk(items, state, now = Date.now()) {
  return [...items, ...latelyTalk(state, now)].sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id)));
}

// --------------------------- server rows --------------------------------------

const iso = ms => new Date(ms || Date.now()).toISOString();
/** A row as the comments table keeps it. Who wrote it is the server's to fill in, never sent. */
export function talkToDb(scope, code, r) {
  return {
    scope, code, id: r.id, target: r.on, kind: r.kind, who: r.who, name: r.name || null,
    body: r.kind === 'comment' ? cleanBody(r.body) : null, jab: r.jab || null, emoji: r.kind === 'reaction' ? r.emoji : null,
    deleted: !!r.deleted, created_at: iso(r.at), updated_at: iso(r.updatedAt),
  };
}
/** A row from the comments table, for this phone (`device`: its hash; `user`: the signed-in account). */
export function talkFromDb(x, { device = null, user = null } = {}) {
  return {
    id: x.id, on: x.target, kind: x.kind, who: x.who, name: x.name || null, body: x.body ?? null, jab: x.jab || null,
    emoji: x.emoji || null, deleted: !!x.deleted, at: Date.parse(x.created_at) || 0, updatedAt: Date.parse(x.updated_at) || 0,
    mine: !!((device && x.author_dev === device) || (user && x.author_user === user)),
  };
}
