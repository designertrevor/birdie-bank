// Brags for the Friends feed: the moments worth a shout from rounds the feed already has, with no
// new server data. A hole in one or an eagle, three or more birdies in a round, a birdie in three
// straight rounds, a big win, a lone (or blind) Wolf beating the pack, a Nassau swept front, back
// and total, and a run of three hammered holes. Pure and unit tested (feed-brags.test.js).
//
// Where they come from, and who they may be about (the privacy rules):
//  • Your own finished rounds on this phone (you were there): anyone in them, but nobody just
//    playing (no bet, no spotlight, as in callouts.js). Amounts follow Lately's rule: yours show,
//    someone else's win is "won big" with no amount, since money between two other people never
//    shows in the feed.
//  • Friends' finished rounds from friend_rounds() (friend-feed.js): the server only sends a round
//    when nobody in it is Only you, so Only you never shows. Brags there are about your friends
//    only (people you've played with), never a friend of a friend or a guest with no account.
//    Their amounts show only where the feed already shows them (Show my money, and every seat in
//    the round lets the money reach you); otherwise there's no amount at all, and a round whose
//    money stays back has no results on this phone, so it can't make a big win either.
//  • Points are bragging rights and show for everyone, as everywhere in the feed.
// Each item is a Lately row ({ id, kind: 'brag', brag, at, text, sub, target, icon, tint }) with the
// game's own icon and its group's colour (game-theme.js), so LatelyList draws it like the rest.
import { GAMES, cardOnly, gameView, hammerTable, holeComplete, isJustPlaying, nassauWinners, oneBall, roundLegs, roundResults, sideNames, sides, wolfHoleResult } from './round.js';
import { bigGroupName, gameLabel, meFor, myIds } from './format.js';
import { money } from './golf.js';
import { countsMoney, playForOf, points } from './play-for.js';
import { canonicalOf } from './pair-debts.js';
import { nameOf } from './ledger.js';
import { agoLabel } from './lately.js';
import { DONE_DAYS } from './friend-feed.js';
import { roundTime } from './rounds-live.js';

const DAY = 24 * 36e5;
/** A money round won by this much or more is a big win. */
export const BIG_WIN = 20;
/** A points round won by this many points or more is a big win. */
export const BIG_POINTS = 10;
/** Birdies (or better) in one round that make a hot round. */
export const HOT_ROUND = 3;
/** Rounds in a row with a birdie that make a streak. */
export const STREAK_ROUNDS = 3;
/** Hammered holes won in a row that make a hammer run. */
export const HAMMER_RUN = 3;
/** At most this many brags from one round, the best first. */
export const PER_ROUND = 2;
/** At most this many brags in the feed. */
export const MAX_BRAGS = 12;

// The best first, when a round has more than PER_ROUND
const RANK = { ace: 100, eagle: 95, sweep: 85, lonewolf: 80, bigwin: 78, hammer: 70, birdies: 65, streak: 60 };
const ICON = { ace: 'flag-banner', eagle: 'bird', birdies: 'fire', streak: 'fire', bigwin: 'trophy', sweep: 'broom', lonewolf: 'paw-print', hammer: 'hammer' };
// A game's group colour, as the lately-ic tints name them (game-theme.js GROUP_TINTS)
const GROUP_TINT = { Classics: 'ochre', 'Head to head': 'pink', Team: 'mint', 'Full round': 'lav', Points: 'peach' };

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const count = n => WORDS[n] || String(n);

/** The look of a brag: the game's own icon for its own moments, a fitting one for scoring, in the game's group colour. */
export function bragLook(game, brag) {
  const g = GAMES[game];
  const own = (brag === 'lonewolf' && game === 'wolf') || (brag === 'hammer' && game === 'hammer') || (brag === 'sweep' && game === 'nassau');
  return { icon: own && g?.icon ? g.icon : ICON[brag] || 'star', tint: GROUP_TINT[g?.group] || 'peach' };
}

/**
 * Every birdie, eagle and hole in one a player made in a round (a real score, never a pickup):
 * { birdies, eagles, aces: [holeNo], eagleHoles: [holeNo], best } where best counts birdie or better.
 */
export function scoringOf(round, pid) {
  const out = { birdies: 0, eagles: 0, aces: [], eagleHoles: [], best: 0, played: 0 };
  for (const h of Array.isArray(round?.holes) ? round.holes : []) {
    const g = round.scores?.[h.no]?.[pid];
    if (g == null) continue;
    out.played++;
    if (typeof g !== 'number' || !Number.isFinite(g) || !(h.par > 0)) continue;
    if (g === 1) out.aces.push(h.no);
    else if (g - h.par <= -2) { out.eagles++; out.eagleHoles.push(h.no); }
    else if (g - h.par === -1) out.birdies++;
  }
  out.best = out.birdies + out.eagles + out.aces.length;
  return out;
}

// A round whose stakes stayed back (feedMoney: false) has no settings: the games that read them
// for who won a hole (never the money) get empty ones, so the winners still work out
const withSettings = round => (isObj(round.settings) ? round : { ...round, settings: { wolf: {}, hammer: {}, nassau: {} } });

/** Lone and blind Wolf holes each player won against the pack: Map(pid -> { holes: [no], blind }). */
export function loneWolfWins(round) {
  const out = new Map();
  let main;
  try { main = gameView(withSettings(round), 'main'); } catch { return out; }
  if (main?.game !== 'wolf') return out;
  for (const h of main.holes) {
    let r = null;
    try { r = holeComplete(main, h) ? wolfHoleResult(main, h) : null; } catch { r = null; }
    if (!r || r.winner !== 'wolf' || r.teamA?.length !== 1) continue;
    const id = r.teamA[0];
    const cur = out.get(id) || { holes: [], blind: false };
    cur.holes.push(h.no);
    if (r.blind) cur.blind = true;
    out.set(id, cur);
  }
  return out;
}

/** A Nassau one side swept, front, back and total: that side's index (0 or 1), or null. */
export function nassauSweep(round) {
  let main;
  try { main = gameView(withSettings(round), 'main'); } catch { return null; }
  if (main?.game !== 'nassau') return null;
  let winners, legs;
  try { winners = nassauWinners(main); legs = Object.values(roundLegs(main)); } catch { return null; }
  if (legs.length !== 3) return null;
  let side = null;
  for (const leg of legs) {
    const won = [0, 0];
    for (let pos = leg.start; pos <= leg.end; pos++) {
      const w = winners[pos];
      if (w === undefined) return null; // a leg not finished
      if (w === 0 || w === 1) won[w]++;
    }
    if (won[0] === won[1]) return null;
    const lead = won[0] > won[1] ? 0 : 1;
    if (side != null && side !== lead) return null;
    side = lead;
  }
  return side;
}

/** The longest run of hammered holes one side won in a row: { side, holes } or null (shorter than HAMMER_RUN). */
export function hammerRun(round) {
  let main, rows;
  try { main = gameView(withSettings(round), 'main'); if (main?.game !== 'hammer') return null; rows = hammerTable(main); } catch { return null; }
  let best = null, run = 0, side = null;
  for (const row of rows) {
    const hammered = row?.hammers?.length > 0 && (row.winner === 0 || row.winner === 1);
    if (!hammered) { run = 0; side = null; continue; }
    if (row.winner === side) run++;
    else { side = row.winner; run = 1; }
    if (run >= HAMMER_RUN && (!best || run > best.holes)) best = { side, holes: run };
  }
  return best;
}

/**
 * The brags in one round, the best PER_ROUND. `ctx`:
 *  • key: the round's id in the feed; at: when it finished; target: what tapping opens; course
 *  • who(pid): the person key, 'me' for you, or null for someone the feed may not talk about
 *  • name(pid): their first name; amountOf(pid): what they won when this phone may know it, else
 *    null; showAmount(pid): whether that amount may show (else the win reads without it)
 */
export function roundBrags(round, ctx) {
  if (!round || !Array.isArray(round.players) || !GAMES[round.game] || cardOnly(round)) return [];
  const { key, who, name, amountOf = () => null, showAmount = () => false } = ctx;
  const course = round.course?.name || 'the course';
  const ok = pid => who(pid) != null && !isJustPlaying(round, pid);
  const you = pid => who(pid) === 'me';
  const N = pid => (you(pid) ? 'You' : name(pid));
  const out = [];
  const add = (brag, pid, text) => out.push({ brag, pid, person: who(pid), text, rank: RANK[brag] });
  // Scoring: one per player, the best of it (a one-ball game's scores are a team's, so not those)
  if (!oneBall(round.game)) {
    for (const p of round.players) {
      if (!ok(p.id)) continue;
      const s = scoringOf(round, p.id);
      if (s.aces.length) add('ace', p.id, `${N(p.id)} made a hole in one on ${s.aces[0]} at ${course}. Drinks are on ${you(p.id) ? 'you' : first(name(p.id))}`);
      else if (s.eagles) {
        const more = s.birdies ? ` and ${plural(s.birdies, 'birdie')}` : '';
        add('eagle', p.id, s.eagles === 1 ? `${N(p.id)} made an eagle on ${s.eagleHoles[0]}${more} at ${course}` : `${N(p.id)} made ${count(s.eagles)} eagles${more} at ${course}`);
      } else if (s.birdies >= HOT_ROUND) add('birdies', p.id, `${N(p.id)} made ${s.birdies} birdies at ${course}. Hot putter`);
    }
  }
  // A big win: what they won in the round, by its own unit (never a Big Game's group round, whose money is the game's)
  const kind = playForOf(round).kind;
  if (!bigGroupName(round) && kind !== 'reward') {
    for (const p of round.players) {
      if (!ok(p.id)) continue;
      const v = amountOf(p.id);
      if (v == null || !Number.isFinite(v)) continue;
      if (countsMoney(round)) {
        if (v < BIG_WIN) continue;
        add('bigwin', p.id, showAmount(p.id) ? `${N(p.id)} won ${money(v)} at ${course}` : `${N(p.id)} won big at ${course}`);
      } else if (v >= BIG_POINTS) add('bigwin', p.id, `${N(p.id)} won ${points(v)} at ${course}`);
    }
  }
  // Wolf: beat the pack alone
  for (const [pid, w] of loneWolfWins(round)) {
    if (!ok(pid)) continue;
    const how = w.blind ? 'blind wolf' : 'lone wolf';
    add('lonewolf', pid, w.holes.length === 1
      ? `${N(pid)} went ${how} on ${w.holes[0]} and beat the pack`
      : `${N(pid)} beat the pack ${count(w.holes.length)} times as the ${w.blind ? 'wolf, once blind' : 'lone wolf'}`);
  }
  // Nassau swept, and a hammer run: about a side, so about everyone on it the feed may talk about
  const sideOf = i => { try { return sides(gameView(withSettings(round), 'main'))[i] || []; } catch { return []; } };
  const sideName = (i, ids) => {
    if (ids.length === 1) return N(ids[0]);
    try { return sideNames(gameView(withSettings(round), 'main'))[i]; } catch { return ids.map(N).join(' and '); }
  };
  const swept = nassauSweep(round);
  if (swept != null) {
    const ids = sideOf(swept);
    if (ids.length && ids.every(ok)) add('sweep', ids[0], `${sideName(swept, ids)} swept the Nassau at ${course}: front, back and total`);
  }
  const run = hammerRun(round);
  if (run) {
    const ids = sideOf(run.side);
    if (ids.length && ids.every(ok)) add('hammer', ids[0], `${sideName(run.side, ids)} won ${run.holes} hammered holes in a row at ${course}`);
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, PER_ROUND).map(b => ({ ...b, key }));
}

/** Who's who across rounds: the person key for a seat on this phone, or for a seat in a friend's round. */
function personKeys(state) {
  const who = canonicalOf(state);
  const mine = myIds(state);
  const isMine = id => mine.has(id) || mine.has(who(id));
  const accountOf = isObj(state?.accountOf) ? state.accountOf : {};
  const myAccount = state?.me ? accountOf[state.me] : null;
  const byAccount = new Map();
  for (const [pid, acct] of Object.entries(accountOf)) if (typeof acct === 'string' && acct && !byAccount.has(acct)) byAccount.set(acct, pid);
  return {
    local: id => (isMine(id) ? 'me' : who(id)),
    remote: account => {
      if (!account) return null;
      if (account === myAccount) return 'me';
      const local = byAccount.get(account);
      if (local) return isMine(local) ? 'me' : who(local);
      return `acct:${account}`;
    },
  };
}

/** Whether you played in a round on this phone (not only watched it). */
function playedIn(round, state) {
  const me = meFor(round, state);
  return !!me && round.players.some(p => p.id === me);
}

/**
 * Every round the feed can brag about, newest first: { key, round, at, target, who, name, amountOf,
 * showAmount, scoring }. `rounds`: friends' rounds as friendRounds() lists them.
 */
export function bragRounds(state, { rounds = [] } = {}) {
  const keys = personKeys(state);
  const out = [];
  // Your own finished rounds: you were there, so everyone in them, with amounts as Lately shows them
  for (const r of Object.values(state?.rounds || {})) {
    if (!r || r.status !== 'done' || !Array.isArray(r.players) || !Array.isArray(r.holes) || !playedIn(r, state)) continue;
    let res = null;
    try { res = roundResults(r); } catch { res = null; }
    const pts = !countsMoney(r);
    out.push({
      key: `round:${r.id}`, round: r, at: roundTime(r), target: ['roundDetail', { id: r.id }],
      who: pid => keys.local(pid),
      name: pid => first(nameOf(state, pid) || r.players.find(p => p.id === pid)?.name),
      amountOf: pid => (res ? Number(res.balances?.[pid]) || 0 : null),
      showAmount: pid => pts || keys.local(pid) === 'me',
    });
  }
  // Friends' finished rounds: only your friends, and amounts only where the feed shows them
  for (const v of rounds) {
    if (!v || v.status !== 'done' || v.source !== 'feed' || !v.round) continue;
    const people = isObj(v.people) ? v.people : {};
    const shown = new Map(v.players.map(p => [p.id, p]));
    out.push({
      key: `friend:${v.code}`, round: v.round, at: v.at, target: v.target,
      who: pid => (people[pid]?.friend === true ? keys.remote(people[pid].account) : null),
      name: pid => shown.get(pid)?.name || 'Someone',
      amountOf: pid => (shown.get(pid)?.amount ?? null),
      showAmount: pid => shown.get(pid)?.amount != null,
    });
  }
  return out.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

/**
 * Birdie streaks: each person whose last STREAK_ROUNDS rounds or more (the ones this phone or the
 * feed has) each had a birdie or better. A round they were just playing, or a one-ball game, neither
 * adds nor breaks a streak. [{ person, pid, rounds, last }] where last is the newest round's entry.
 */
export function birdieStreaks(list) {
  const byPerson = new Map();
  for (const e of list) {
    if (oneBall(e.round.game)) continue;
    const seen = new Set();
    for (const p of e.round.players) {
      const person = e.who(p.id);
      if (person == null || seen.has(person) || isJustPlaying(e.round, p.id)) continue;
      const s = scoringOf(e.round, p.id);
      if (!s.played) continue;
      seen.add(person);
      if (!byPerson.has(person)) byPerson.set(person, []);
      byPerson.get(person).push({ e, pid: p.id, best: s.best });
    }
  }
  const out = [];
  for (const [person, rows] of byPerson) {
    rows.sort((a, b) => b.e.at - a.e.at);
    let n = 0;
    while (n < rows.length && rows[n].best > 0) n++;
    if (n >= STREAK_ROUNDS) out.push({ person, pid: rows[0].pid, rounds: n, last: rows[0].e });
  }
  return out;
}

/**
 * The feed's brags, newest first, as Lately rows. Rounds from the last DONE_DAYS days (a streak is
 * shown while its newest round is), at most PER_ROUND a round and MAX_BRAGS in all.
 */
export function feedBrags(state, { rounds = [], now = Date.now(), limit = MAX_BRAGS } = {}) {
  const list = bragRounds(state, { rounds });
  const since = now - DONE_DAYS * DAY;
  const items = [];
  const sub = e => `${gameLabel(e.round)} · ${agoLabel(e.at, now)}`;
  for (const e of list) {
    if (!(e.at > since)) continue;
    let brags = [];
    try { brags = roundBrags(e.round, { ...e, course: e.round.course?.name }); } catch { brags = []; }
    for (const b of brags) {
      items.push({ id: `brag:${b.brag}:${e.key}:${b.person}`, kind: 'brag', brag: b.brag, at: e.at, text: b.text, sub: sub(e), target: e.target, ...bragLook(e.round.game, b.brag) });
    }
  }
  for (const s of birdieStreaks(list)) {
    const e = s.last;
    if (!(e.at > since)) continue;
    const text = s.person === 'me' ? `You’ve made a birdie in ${s.rounds} straight rounds` : `${e.name(s.pid)} has made a birdie in ${s.rounds} straight rounds`;
    items.push({ id: `brag:streak:${s.person}`, kind: 'brag', brag: 'streak', at: e.at, text, sub: `Latest: ${sub(e)}`, target: e.target, ...bragLook(e.round.game, 'streak') });
  }
  return items.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, limit);
}
