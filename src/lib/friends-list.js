// Friends: everyone you've played with, across all your crews, and people one step out you might
// know. Pure and unit tested (friends-list.test.js). No new server data and no new table:
//  • Played with comes from the finished rounds on this phone. One friend is one person, whichever
//    of their ids a round has (canonicalOf, people-links.js), with rounds together, when you last
//    played and your record against them (headToHeadSummary in ledger.js, the same as Players).
//  • Suggested comes from friends' rounds the feed already has (friend_rounds(), friend-feed.js):
//    someone in a friend's round who isn't your friend yet. The rules:
//      - only accounts: a seat the feed says nothing about is a guest with no account, never suggested
//      - only people whose setting let that round reach you: the server sends a round only when
//        nobody in it is Only you, so someone who chose Only you never shows up here
//      - never you, and never someone you've already played with
//    The server never says which account a friend of a friend is (only that the seat has one), so a
//    suggestion goes by their seat in those rounds, by first name and initial, and opens the round
//    you saw them in.
import { countsAsDone } from './big-money.js';
import { meFor, myIds } from './format.js';
import { headToHeadSummary, nameOf } from './ledger.js';
import { canonicalOf } from './pair-debts.js';
import { roundTime } from './rounds-live.js';
import { agoLabel } from './lately.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const first = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';
/** At most this many suggestions. */
export const MAX_SUGGESTED = 10;

/** "Dalton R.": a first name and the last name's initial, from the name in a round. */
export function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Someone';
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.` : parts[0];
}

/**
 * Everyone you've played a finished round with, the one you played with last first:
 * [{ id, name, rounds, lastAt, lastRoundId, record: { won, lost, even, net } | null, crews: [name], account }].
 * `rounds` counts every round together, just playing too; the record is the bets between you.
 */
export function playedWith(state) {
  const who = canonicalOf(state);
  const mine = myIds(state);
  const isMine = id => mine.has(id) || mine.has(who(id));
  const people = new Map();
  for (const r of Object.values(state?.rounds || {})) {
    if (!r || !Array.isArray(r.players) || !countsAsDone(state, r)) continue;
    const me = meFor(r, state);
    if (!me || !r.players.some(p => p.id === me)) continue; // a round you only watched
    const seen = new Set();
    const at = roundTime(r);
    for (const p of r.players) {
      if (!p?.id || isMine(p.id)) continue;
      const k = who(p.id);
      if (seen.has(k)) continue;
      seen.add(k);
      const cur = people.get(k) || { id: k, rounds: 0, lastAt: 0, lastRoundId: null };
      cur.rounds++;
      if (at >= cur.lastAt) { cur.lastAt = at; cur.lastRoundId = r.id; }
      people.set(k, cur);
    }
  }
  const h2h = headToHeadSummary(state, mine);
  const crews = new Map();
  for (const c of Object.values(state?.crews || {})) {
    for (const pid of Array.isArray(c?.playerIds) ? c.playerIds : []) {
      const k = who(pid);
      if (!crews.has(k)) crews.set(k, new Set());
      crews.get(k).add(c.name);
    }
  }
  const accountOf = isObj(state?.accountOf) ? state.accountOf : {};
  const accountFor = k => accountOf[k] || Object.entries(accountOf).find(([pid]) => who(pid) === k)?.[1] || null;
  return [...people.values()].map(p => ({
    ...p, name: nameOf(state, p.id), record: h2h.get(p.id) || null,
    crews: [...(crews.get(p.id) || [])].filter(Boolean).sort(), account: accountFor(p.id),
  })).sort((a, b) => b.lastAt - a.lastAt || b.rounds - a.rounds || a.name.localeCompare(b.name));
}

/** "4 rounds · last played 3 days ago". */
export function togetherLine(f, now = Date.now()) {
  const n = `${f.rounds} round${f.rounds === 1 ? '' : 's'}`;
  return f.lastAt ? `${n} · last played ${agoLabel(f.lastAt, now).replace(/^(Just now|Yesterday)$/, m => m.toLowerCase())}` : n;
}

/** "You’re 5 and 3 against Sam", "Even with Sam, 2 and 2", or null with no bets between you. */
export function recordLine(f) {
  const r = f.record;
  if (!r || !r.rounds) return null;
  const name = first(f.name);
  const even = r.even ? `, ${r.even} even` : '';
  if (r.won === r.lost) return `Even with ${name}, ${r.won} and ${r.lost}${even}`;
  return `You’re ${r.won} and ${r.lost} against ${name}${even}`;
}

/** "Played with Dalton", "Played with Dalton and Sam", "Played with Dalton and 2 others". */
export function viaLine(names) {
  const list = [...new Set(names)];
  if (!list.length) return 'Played with your friends';
  if (list.length === 1) return `Played with ${list[0]}`;
  if (list.length === 2) return `Played with ${list[0]} and ${list[1]}`;
  return `Played with ${list[0]} and ${list.length - 1} others`;
}

/**
 * People one step out: friends of your friends who were in a friend's round that reached your
 * feed, most friends in common first. `rounds`: friends' rounds as friendRounds() lists them.
 * [{ key, seat, name, via: [first names], viaText, rounds, lastAt, sub, target }]
 */
export function suggestedFriends(state, rounds = [], { now = Date.now(), limit = MAX_SUGGESTED } = {}) {
  const who = canonicalOf(state);
  const mine = myIds(state);
  const known = new Set(playedWith(state).map(f => f.id));
  const accountOf = isObj(state?.accountOf) ? state.accountOf : {};
  const myAccount = state?.me ? accountOf[state.me] : null;
  // A friend's name as you know them (their own profile, or your card for them), else the round's
  const byAccount = new Map();
  for (const [pid, acct] of Object.entries(accountOf)) if (typeof acct === 'string' && !byAccount.has(acct)) byAccount.set(acct, who(pid));
  const out = new Map();
  for (const v of rounds) {
    // Only rounds the server sent: a round this phone watches from a code says nothing about accounts
    if (!v || v.source !== 'feed' || !isObj(v.people) || !Array.isArray(v.round?.players)) continue;
    const seats = v.round.players;
    const friends = seats.filter(p => v.people[p.id]?.friend === true).map(p => {
      const local = byAccount.get(v.people[p.id].account);
      return local ? first(nameOf(state, local)) : first(p.name);
    });
    if (!friends.length) continue;
    for (const p of seats) {
      const seat = v.people[p.id];
      // An account (the feed has a line for the seat), not a friend yet, not you, not someone you've played with
      if (!seat || seat.friend === true || !p.id) continue;
      if (mine.has(p.id) || mine.has(who(p.id)) || known.has(who(p.id))) continue;
      if (seat.account && (seat.account === myAccount || byAccount.has(seat.account))) continue;
      const cur = out.get(p.id) || { key: `seat:${p.id}`, seat: p.id, name: shortName(p.name), via: [], rounds: 0, lastAt: 0, last: null };
      cur.rounds++;
      for (const f of friends) if (!cur.via.includes(f)) cur.via.push(f);
      if (v.at >= cur.lastAt) { cur.lastAt = v.at; cur.last = v; }
      out.set(p.id, cur);
    }
  }
  return [...out.values()]
    .sort((a, b) => b.via.length - a.via.length || b.rounds - a.rounds || b.lastAt - a.lastAt || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ last, ...s }) => ({
      ...s, viaText: viaLine(s.via),
      sub: `${last.title} · ${agoLabel(last.at, now)}`,
      target: last.target,
    }));
}
