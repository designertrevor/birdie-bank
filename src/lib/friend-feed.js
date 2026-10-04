// The Friends feed: friends' rounds you're not in (live, and finished this week), plans you're
// invited to, settle-ups, recaps and trash talk, in one place. Pure and unit tested. The transport
// is feed-sync.js; the server's rules are supabase/2026-10-06-friend-feed.sql, and the first part
// of this file is the same rules in JavaScript (keep the two in step).
//
// Who shows up follows each person's one profile setting (profile-model.js):
//  • A friend is an account you've played a round with. Only rounds with a friend in them come up.
//  • Only you: nothing. A round with anyone in it set to Only you never comes up for people outside it.
//  • People you've played with (the default) and Everyone: the round comes up for that friend's friends.
//  • Money: a player's amounts show only with Show my money on. A guest with no account has no
//    setting, so theirs never shows. Points rounds read in points, which are bragging rights.
// A friend's round as the server sends it (a "row"):
//   { code, meta, holes: { [holeNo]: data }, people: { [seat]: { friend, money, account } }, updatedAt }
import { GAMES, gameView, holeComplete, isTeamGame, matchScored, nassauWinners, roundResults, scorers, sideNames } from './round.js';
import { assemble } from './sync-model.js';
import { gameLabel, meFor, myIds } from './format.js';
import { money } from './golf.js';
import { codeOf } from './pair-debts.js';
import { countsMoney, playForOf, points, rewardOutcome } from './play-for.js';
import { toParOf } from './to-par.js';
import { agoLabel, latelyItems } from './lately.js';
import { countsLine, planChoice, planCounts, upcomingPlans, whenLabel } from './plans.js';
import { followThread, withTalk } from './talk.js';

export { followThread };

const HOUR = 36e5;
const DAY = 24 * HOUR;
/** A round still going shows while it moved in the last 12 hours; a finished one for 7 days. */
export const LIVE_HOURS = 12;
export const DONE_DAYS = 7;
/** Friends' rounds on Up next, at most. */
export const UP_NEXT_FRIENDS = 3;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const LEVELS = ['everyone', 'played', 'hidden'];
const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
const nameList = names => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// --------------------------- the server's rules -----------------------------

/** The one setting from a saved privacy row, as feed_level() reads it. No row reads as the default. */
export function feedLevel(p) {
  if (!isObj(p)) return 'played';
  if (LEVELS.includes(p.profile)) return p.profile;
  // Saved before the one setting: any part hidden reads as Only you (fromLegacy in profile-model.js)
  if (['stats', 'handicap', 'homeCourse'].some(k => (p[k] ?? 'played') === 'hidden')) return 'hidden';
  return 'played';
}

/** Whether someone's amounts may show, as feed_money() reads it: Show my money on, and not Only you. */
export function feedMoney(p) {
  if (!isObj(p) || feedLevel(p) === 'hidden') return false;
  if (LEVELS.includes(p.profile)) return p.showMoney === true;
  return ['played', 'everyone'].includes(p.money);
}

/** A round's meta as a friend watching gets it (feed_meta): no device hashes, seat claims or payment apps. */
export function feedMeta(m) {
  if (!isObj(m)) return null;
  const { devs: _d, hostDev: _h, claims: _c, ...rest } = m;
  if (Array.isArray(rest.players)) {
    rest.players = rest.players.map(p => {
      if (!isObj(p)) return p;
      const { payApp: _a, payHandle: _p, ...keep } = p;
      return keep;
    });
  }
  return rest;
}

const seatIds = m => (Array.isArray(m?.players) ? m.players : [])
  .filter(p => isObj(p) && typeof p.id === 'string' && p.id.length >= 1 && p.id.length <= 64)
  .map(p => p.id);

/**
 * The linked seats of a live round (feed_seats): [{ seat, account, level, money }]. `accounts` maps
 * a player id to its account, `privacy` an account to its saved privacy (missing: the default).
 */
export function feedSeats(m, { accounts = {}, privacy = {} } = {}) {
  return seatIds(m).filter(id => accounts[id]).map(id => {
    const account = accounts[id];
    return { seat: id, account, level: feedLevel(privacy[account]), money: feedMoney(privacy[account]) };
  });
}

/**
 * Whether the round with meta `m` may come up in `me`'s feed (feed_round_ok): this phone isn't on it,
 * nobody in it is Only you, `me` isn't in it, and a friend of `me` is. `friends`: the accounts `me`
 * has played with; `device`: this phone's hash.
 */
export function feedRoundOk(m, { me, friends = new Set(), device = null, accounts = {}, privacy = {} } = {}) {
  if (!me || !isObj(m)) return false;
  if (device && (m.hostDev === device || Object.values(isObj(m.devs) ? m.devs : {}).includes(device))) return false;
  const seats = feedSeats(m, { accounts, privacy });
  if (seats.some(s => s.account === me || s.level === 'hidden')) return false;
  return seats.some(s => s.account !== me && friends.has(s.account));
}

/** The round is recent enough for the feed: moved in the last 12 hours, or finished in the last 7 days. */
export function feedWindowOk(status, at, now = Date.now()) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return false;
  if (status === 'done') return at > now - DONE_DAYS * DAY;
  if (status === 'active') return at > now - LIVE_HOURS * HOUR;
  return false;
}

/** What the feed says about each linked seat (friend_rounds people): { seat: { friend, money, account } }. */
export function feedPeople(m, { friends = new Set(), accounts = {}, privacy = {} } = {}) {
  const out = {};
  for (const s of feedSeats(m, { accounts, privacy })) {
    const friend = friends.has(s.account);
    out[s.seat] = { friend, money: s.money, account: friend ? s.account : null };
  }
  return out;
}

/**
 * The ids a friend watching may write as on a round's talk (follow_seats), or null. While the live
 * round is there (`live`: its meta) the round must be one they may see (`ok`); once it's gone, the
 * ids they had when they followed it (`followed`, or null when they never did).
 */
export function followSeatsFor({ live = null, ok = false, ids = [], followed = null } = {}) {
  if (live) return ok && ids.length ? [...new Set(ids)] : null;
  return followed?.length ? [...new Set(followed)] : null;
}

/** A friend watching writes only on the round itself, never a settle-up line or a side bet. */
export function followerMayWrite(row, seats) {
  return !!(seats && row?.on === 'round' && row.who && seats.includes(row.who));
}

// --------------------------- rows on this phone -----------------------------

/** A row from friend_rounds() (or the cache) cleaned for this phone, or null when it isn't one. */
export function cleanFeedRow(x) {
  if (!isObj(x) || typeof x.code !== 'string' || !/^[A-Z0-9]{6}$/.test(x.code)) return null;
  const meta = feedMeta(x.meta);
  if (!meta || !Array.isArray(meta.players) || !Array.isArray(meta.holes)) return null;
  const holes = {};
  for (const [no, data] of Object.entries(isObj(x.holes) ? x.holes : {})) if (Number(no) > 0 && isObj(data)) holes[no] = data;
  const people = {};
  for (const [seat, p] of Object.entries(isObj(x.people) ? x.people : {})) {
    if (!isObj(p)) continue;
    people[seat] = { friend: p.friend === true, money: p.money === true, account: p.friend === true && typeof p.account === 'string' ? p.account : null };
  }
  const at = typeof x.updatedAt === 'number' ? x.updatedAt : Date.parse(x.updated_at ?? x.updatedAt) || 0;
  return { code: x.code, meta, holes, people, updatedAt: at };
}

// --------------------------- one round, as the feed shows it ----------------

/** "Sam 2 up", "All square": a match's whole-round standing, or null for a game that isn't a match. */
export function matchLine(round) {
  const g = round?.game;
  const matchy = g === 'match' || g === 'nassau' || (isTeamGame(g) && matchScored(round));
  if (!matchy) return null;
  try {
    const main = gameView(round, 'main') || round;
    let a = 0, b = 0;
    for (const w of Object.values(nassauWinners(main))) { if (w === 0) a++; else if (w === 1) b++; }
    if (a === b) return 'All square';
    const names = sideNames(main);
    const lead = a > b ? 0 : 1;
    const name = round.teams?.length === 2 ? names[lead] : first(names[lead]);
    return `${name} ${Math.abs(a - b)} up`;
  } catch { return null; }
}

/**
 * A round for the feed, from the round itself. `people` says, for each linked seat, whether they're a
 * friend and whether their money may show. Returns null for a round that can't be shown.
 * { id, code, status: 'live' | 'done', title, game, course, thru, holes, hole, friends, line, result,
 *   players: [{ id, name, friend, place, amount, amountText, toPar, played }], isMoney, at, following, target }
 */
export function roundView(round, { code, people = {}, at = 0, following = false, source = 'feed', target = null } = {}) {
  if (!round || !Array.isArray(round.players) || !round.players.length || !Array.isArray(round.holes) || !round.holes.length || !GAMES[round.game]) return null;
  const status = round.status === 'done' ? 'done' : 'live';
  let thru = 0;
  try { thru = round.holes.filter(h => holeComplete(round, h)).length; } catch { thru = 0; }
  let res = null;
  try { res = roundResults(round); } catch { res = null; }
  const isMoney = countsMoney(round);
  // Points are bragging rights and show for everyone; dollars only for someone who chose Show my money
  const shows = id => !isMoney || people[id]?.money === true;
  const fmt = (id, v) => (!shows(id) ? null : isMoney ? money(v, { sign: true }) : points(v, { sign: true }));
  let units = [];
  try { units = scorers(round); } catch { units = []; }
  const unitOf = id => units.find(u => u.id === id) || units.find(u => u.team && (u.players || []).includes(id)) || null;
  const order = res?.standings?.length ? res.standings : round.players.map(p => ({ ...p, amount: 0 }));
  const players = order.map((p, i) => {
    const amt = Number(p.amount) || 0;
    const place = order.findIndex(q => (Number(q.amount) || 0) === amt) + 1;
    const unit = unitOf(p.id);
    let par = { played: 0, gross: 0 };
    try { if (unit) par = toParOf(round, unit); } catch { /* a scorer this round can't add up */ }
    return {
      id: p.id, name: first(p.name), friend: people[p.id]?.friend === true, place: place || i + 1,
      amount: shows(p.id) ? amt : null, amountText: fmt(p.id, amt), toPar: par.played ? par.gross : null, played: par.played,
      team: unit?.team ? unit.name : null,
    };
  });
  const friends = players.filter(p => p.friend).map(p => p.name);
  // Who's up: a match's standing, else whoever leads the game (with their amount when it may show)
  const bal = res?.balances || {};
  const top = Math.max(0, ...round.players.map(p => Number(bal[p.id]) || 0));
  const leaders = top > 0.004 ? players.filter(p => Math.abs((Number(bal[p.id]) || 0) - top) < 0.005) : [];
  const leadAmount = leaders.length === 1 && leaders[0].amountText ? `, ${leaders[0].amountText}` : '';
  const ahead = !leaders.length ? 'All square' : leaders.length === 1 ? `${leaders[0].name} leads${leadAmount}` : `${nameList(leaders.map(p => p.name))} lead`;
  const took = !leaders.length ? 'All square' : leaders.length === 1 ? `${leaders[0].name} took it${leadAmount}` : `${nameList(leaders.map(p => p.name))} split it`;
  const reward = status === 'done' && res ? rewardOutcome(round, res) : null;
  let line;
  if (!thru) line = status === 'live' ? 'On the first tee' : 'No holes scored';
  else if (status === 'done') line = reward ? reward.text : took;
  else line = matchLine(round) || ahead;
  return {
    id: `friend:${code}`, code, status, source,
    title: `${gameLabel(round)} at ${round.course?.name || 'the course'}`,
    game: gameLabel(round), course: round.course?.name || null,
    thru, holes: round.holes.length, hole: Math.min(thru + 1, round.holes.length),
    friends, names: players.map(p => p.name), line, players, isMoney, playFor: playForOf(round).kind,
    at, following, round,
    target: target || ['friendRound', { code }],
  };
}

/** A row from friend_rounds() as the feed shows it, or null. */
export function friendRoundView(row, { following = false } = {}) {
  const r = cleanFeedRow(row);
  if (!r) return null;
  let round;
  try { round = assemble(r.meta, r.holes); } catch { return null; }
  return roundView(round, { code: r.code, people: r.people, at: r.updatedAt, following });
}

// --------------------------- the feed ----------------------------------------

/** Whether you're one of the players in a round on this phone (not only watching it). */
function playsIn(round, state) {
  const me = meFor(round, state);
  const ids = myIds(state);
  return !!round?.shared?.host || round.players?.some(p => p.id === me || ids.has(p.id));
}

/**
 * Friends' rounds for the feed, newest first with live ones on top (the ones you watch first):
 *  • rows: what friend_rounds() last sent; `status`: where the server stands ('ready' once it answered)
 *  • follows: { [code]: { since, row } } the rounds you watch, with their last copy
 *  • rounds this phone is only watching from a code (joined as a watcher) come from the phone itself.
 * A round you play in is never here: it's on Up next already. Once the server has answered, a round
 * you watch that it no longer sends (someone in it changed their setting, or sharing stopped) drops
 * out too; with no server it shows from the copy this phone kept.
 */
export function friendRounds(state, { rows = [], follows = {}, status = 'unknown', now = Date.now() } = {}) {
  const here = new Set();
  const out = new Map();
  for (const r of Object.values(state?.rounds || {})) {
    const code = codeOf(r);
    if (!r || !Array.isArray(r.players)) continue;
    if (code) here.add(code);
    // Watching from a code: a friend's round as this phone already has it
    if (!playsIn(r, state) && r.shared?.code && !r.shared.ended && r.status === 'active') {
      const v = roundView(r, { code: r.shared.code, at: r.createdAt || 0, source: 'watching', target: ['play', { id: r.id }] });
      if (v) out.set(`local:${r.id}`, v);
    }
  }
  const fresh = new Map();
  for (const row of rows) {
    const r = cleanFeedRow(row);
    if (r && !here.has(r.code)) fresh.set(r.code, r);
  }
  const add = (r, following) => {
    if (out.has(r.code)) return;
    const v = friendRoundView(r, { following });
    if (!v || !feedWindowOk(v.status === 'done' ? 'done' : 'active', v.at, now)) return;
    out.set(r.code, v);
  };
  for (const [code, f] of Object.entries(isObj(follows) ? follows : {})) {
    if (here.has(code)) continue;
    const r = fresh.get(code) || (status === 'ready' ? null : cleanFeedRow(f?.row));
    if (r) add(r, true);
  }
  for (const r of fresh.values()) add(r, false);
  const rank = v => (v.status === 'live' ? (v.following ? 0 : 1) : 2);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || b.at - a.at || String(a.code).localeCompare(String(b.code)));
}

/** The friends' rounds Up next shows: live ones, then any finished in the last day, at most three. */
export function upNextFriends(rounds, { now = Date.now(), limit = UP_NEXT_FRIENDS } = {}) {
  return rounds.filter(v => v.source !== 'watching' && (v.status === 'live' || v.at > now - DAY)).slice(0, limit);
}

/** "Sam is playing", "Sam and Dave are playing", "Sam, Dave and 1 more": who you know in a round. */
export function friendsLine(view) {
  const f = view?.friends || [];
  if (!f.length) return view?.status === 'done' ? 'Friends played' : 'Friends are playing';
  const who = f.length <= 2 ? nameList(f) : `${f[0]}, ${f[1]} and ${f.length - 2} more`;
  if (view.status === 'done') return `${who} played`;
  return `${who} ${f.length === 1 ? 'is' : 'are'} playing`;
}

/** The small line over a friend's round: "Live · Hole 8 of 18", or "Finished · 2h ago". */
export function statusLine(view, now = Date.now()) {
  if (view.status === 'done') return `Finished · ${agoLabel(view.at, now)}`;
  if (!view.thru) return 'Live · Teeing off';
  if (view.thru >= view.holes) return `Live · All ${view.holes} in`;
  return `Live · Hole ${view.hole} of ${view.holes}`;
}

/** A finished friend's round as a feed row ({ id, kind, at, text, sub, target, talkKey }). */
export function friendRoundItem(view, now = Date.now()) {
  const shown = view.players.filter(p => p.amountText && view.isMoney && view.line.indexOf(p.amountText) < 0).slice(0, 2);
  return {
    id: view.id, kind: 'friend', at: view.at,
    text: `${view.title} · ${view.line}`,
    sub: [friendsLine(view), ...shown.map(p => `${p.name} ${p.amountText}`), agoLabel(view.at, now)].join(' · '),
    target: view.target, talkKey: followThread(view.code),
  };
}

/** A plan you're invited to (someone else organizes it) as a feed row. */
export function planItem(plan, now = new Date()) {
  const { game } = planChoice(plan);
  const host = first(plan.hostName) === 'Someone' ? 'A friend' : first(plan.hostName);
  const mine = plan.localMe ? plan.answers?.[plan.localMe]?.status : null;
  const answer = mine === 'in' ? 'You’re in' : mine === 'out' ? 'You’re out' : mine === 'maybe' ? 'You’re a maybe' : 'Answer';
  return {
    id: `plan:${plan.id}`, kind: 'plan', at: plan.createdAt || 0,
    text: `${host} invited you · ${whenLabel(plan, now)}`,
    sub: [`${GAMES[game]?.name || 'Golf'} at ${plan.course?.name || 'a course to be set'}`, countsLine(planCounts(plan)), answer].filter(Boolean).join(' · '),
    target: ['plan', { id: plan.id }],
  };
}

/**
 * The newest comment and reactions by other people on each friend's round you watch, as feed rows.
 * `talk`: state.talk; `ids`: who counts as you.
 */
export function followTalkItems(views, talk = {}, { ids = new Set(), now = Date.now() } = {}) {
  const out = [];
  for (const v of views) {
    const rows = Object.values(talk?.[followThread(v.code)] || {}).filter(r => r && !r.deleted && !r.mine && !ids.has(r.who));
    const comments = rows.filter(r => r.kind === 'comment' && r.body).sort((a, b) => b.at - a.at);
    const name = r => v.players.find(p => p.id === r.who)?.name || first(r.name);
    if (comments.length) {
      const c = comments[0];
      const body = String(c.body);
      out.push({
        id: `talk:follow:${v.code}`, kind: 'talk', at: c.at,
        text: `${name(c)}: “${body.length > 80 ? `${body.slice(0, 79).trimEnd()}…` : body}”`,
        sub: [v.title, comments.length > 1 ? `${comments.length - 1} more` : null, agoLabel(c.at, now)].filter(Boolean).join(' · '),
        target: v.target,
      });
    }
  }
  return out;
}

/**
 * The whole group feed: { live, plans, lately }.
 *  • live: friends' rounds going on now (cards with Watch)
 *  • plans: plans you're invited to that are still to come, soonest first
 *  • lately: friends' finished rounds, then everything Lately has (settle-ups, carry-overs, answers,
 *    challenges, your recaps and the trash talk), newest first. Amounts only as Lately and the
 *    friends' settings allow.
 */
export function groupFeed(state, { rounds = [], now = Date.now() } = {}) {
  const live = rounds.filter(v => v.status === 'live');
  const plans = upcomingPlans(state, new Date(now)).filter(p => !p.host && p.status === 'planned' && !p.gone).map(p => planItem(p, new Date(now)));
  const done = rounds.filter(v => v.status === 'done').map(v => friendRoundItem(v, now));
  const talk = followTalkItems(rounds.filter(v => v.following), state?.talk, { ids: myIds(state), now });
  const mine = withTalk(latelyItems(state, now, { withLast: true }), state, now);
  const lately = [...done, ...talk, ...mine].sort((a, b) => b.at - a.at || String(a.id).localeCompare(String(b.id)));
  return { live, plans, lately };
}
