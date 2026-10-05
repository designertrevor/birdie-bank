// Who may read and write a round's, a plan's or a challenge's talk on the server: the same rules as
// supabase/2026-10-04-comments.sql and 2026-10-07-challenge-talk.sql, in JavaScript, with tests.
// Keep them in step.
//
// The server knows a phone by the hash of its device key (keeper-lock.js, the x-bb-device header)
// and an account by its user id. A live round's meta has the host phone (hostDev) and the phone
// that took each seat (devs: { seat: hash }); account_players links seats to accounts.
//  • A round: the phones and accounts of the people in it. Each speaks only as its own seat: a
//    seat's own phone, the host phone for the seats nobody took from the link (the people it
//    keeps score for), or the account the seat is linked to. A round shared before the keeper
//    lock (no hostDev) is open to every seat, as everything else in it is.
//  • A plan: everyone on it, which (like the plan itself, until plans are locked down) is anyone
//    with its code: the organizer, the people it lists, and anyone who answered.
//  • A challenge: like the challenge itself, anyone with its code (the two in it, and whoever set
//    it up between them, each answer from a link with no account). They speak only as one of
//    those people: the ids it was made with, from its meta (from, to, setBy).
//  • Once a phone or account has been let in (join_comments, join_challenge_comments), it stays in, with the seats it had,
//    so the talk outlives the live round (sharing stopped, or the 30-day tidy-up).
//  • Each person changes or deletes only their own rows: the phone or account that wrote them.
//  • A friend watching from the Friends feed (supabase/2026-10-06-friend-feed.sql) also reads and
//    writes the talk on the round itself, never a settle-up line's or a side bet's, as their own
//    ids: friend-feed.js followSeatsFor and followerMayWrite are those rules.

const str = v => (typeof v === 'string' && v.length > 0 ? v : null);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const roundIds = players => (Array.isArray(players) ? players : [])
  .filter(p => p && typeof p === 'object' && typeof p.id === 'string' && p.id.length >= 1 && p.id.length <= 64)
  .map(p => p.id);

/**
 * The seats phone `w` (or an account whose linked seats are `linked`) may speak as in a live
 * round with meta `m`, or null when it isn't in the round.
 */
export function roundSeats(m, w, linked = new Set()) {
  if (!m || typeof m !== 'object') return null;
  const ids = roundIds(m.players);
  if (!str(m.hostDev)) return ids; // shared before the lock: open, as before
  const devs = obj(m.devs);
  const seats = ids.filter(id =>
    (w && str(devs[id]) === w)
    || (w && w === m.hostDev && !str(devs[id]))
    || linked.has(id));
  return seats.length ? seats : null;
}

/** Everyone on a plan with meta `m` and answers `rsvps` ([{ who }]), or null when there's no plan. */
export function planSeats(m, rsvps = []) {
  if (!m || typeof m !== 'object') return null;
  const ids = new Set();
  for (const p of Array.isArray(m.people) ? m.people : []) if (str(p?.id)) ids.add(p.id);
  if (str(m.hostWho)) ids.add(m.hostWho);
  for (const r of rsvps) if (str(r?.who)) ids.add(r.who);
  return [...ids];
}

/** The people in a challenge with meta `m` (from, to, and setBy when someone set it up), or null when there's no challenge. */
export function challengeSeats(m) {
  if (!m || typeof m !== 'object') return null;
  const ids = [str(m.from?.who), str(m.to?.who), str(m.setBy?.who)].filter(Boolean);
  return ids.length ? [...new Set(ids)] : null;
}

/** How a phone or an account is remembered once it's in: 'd:hash' or 'u:userId'. */
export const memberKeys = (w, user) => [w ? `d:${w}` : null, user ? `u:${user}` : null].filter(Boolean);

/**
 * The seats you may speak as now, or null when you can't read or write this talk.
 *  scope: 'round' | 'plan' | 'challenge'
 *  live: the live round's meta, or null when it's gone; plan: the plan's meta, or null; rsvps: its answers
 *  challenge: the challenge's meta, or null when there's no such challenge
 *  joined: [{ member, seats }] remembered from before; w: this phone's hash; user: the account id
 *  linked: the seats linked to the account (account_players)
 */
export function seatsFor({ scope, live = null, plan = null, rsvps = [], challenge = null, joined = [], w = null, user = null, linked = new Set() }) {
  const keys = memberKeys(w, user);
  const mine = joined.filter(j => keys.includes(j.member));
  if (scope === 'plan') return mine.length && plan ? planSeats(plan, rsvps) : null;
  // A challenge's people, or the ones remembered on joining once the challenge is gone
  if (scope === 'challenge') return mine.length ? challengeSeats(challenge) || [...new Set(mine.flatMap(j => j.seats || []))] : null;
  if (scope !== 'round') return null;
  const now = live ? roundSeats(live, w, linked) : null;
  if (now) return now;
  const kept = [...new Set(mine.flatMap(j => j.seats || []))];
  return kept.length ? kept : null;
}

/** Joining: who is let in, with which seats. Returns the rows to remember, or [] when not in. */
export function joinRows({ scope, live = null, plan = null, rsvps = [], challenge = null, w = null, user = null, linked = new Set() }) {
  const seats = scope === 'plan' ? planSeats(plan, rsvps) : scope === 'round' ? roundSeats(live, w, linked) : scope === 'challenge' ? challengeSeats(challenge) : null;
  if (!seats) return [];
  return memberKeys(w, user).map(member => ({ member, seats }));
}

/** The row was written by this phone or this account. */
export function ownsRow(row, w, user) {
  return !!((row?.authorDev && w && row.authorDev === w) || (row?.authorUser && user && row.authorUser === user));
}

/** May a new row go in: you're in, and it's written as one of your seats. */
export function mayAdd(row, seats) {
  return !!(seats && row?.who && seats.includes(row.who));
}

/**
 * May `prior` become `next`: only your own rows, and what it is about, who wrote it and when
 * never change (the server keeps those from the first copy).
 */
export function mayChange(prior, next, { w = null, user = null, seats = null } = {}) {
  if (!ownsRow(prior, w, user)) return false;
  if (!mayAdd({ who: prior.who }, seats)) return false;
  return ['on', 'kind', 'who'].every(k => next[k] === undefined || next[k] === prior[k]);
}

/** May you delete it outright: only your own. */
export const mayDelete = (row, w, user) => ownsRow(row, w, user);
