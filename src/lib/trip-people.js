// Who can go on a trip, for "Who's going" in the trip sheet: everyone this phone knows you play
// with, one row a person. Your usuals first, then whoever you played with most lately, then the
// rest of your players. People come from three places: players saved on this phone, the players
// in rounds you played (a friend's friend from a round you joined has no saved player here), and
// the people in your saved usuals. The same person under two ids is one row (people-links.js, by
// canonicalOf), and you're never on the list: the organizer is always going.
//
// Also the trip's join link: a trip has no link of its own, so its first planned round's group link
// is the way in (plans.js, plan-sync.js). Friends answer on it, so they add themselves, and the
// round they play is on the trip from its stamp. Pure, unit tested.
import { canonicalOf } from './pair-debts.js';
import { nameOf } from './ledger.js';
import { usualsOf } from './usuals.js';
import { HOST, inviteText, planPeople } from './plans.js';
import { tripDates, tripGoing, tripPlans } from './trips.js';

/** Past this many people, the list gets a search box. */
export const SEARCH_FROM = 8;

const lower = s => String(s || '').trim().toLowerCase();
/** A name typed in: single spaces, trimmed, at most 24 characters (as Players saves it). */
export const cleanPersonName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 24);

/**
 * Everyone you could take on a trip, as [{ id, name, index, usual, rounds, lastAt, saved }]:
 * `usual` they're in one of your usuals, `rounds` how many of your rounds they played, `lastAt`
 * the newest of them, `saved` there's a player saved for them on this phone. `picked` ids are
 * always on it (someone picked before, even one this phone no longer has a round with). Ids are
 * each person's kept id (canonicalOf), so a pick is the same person on every screen.
 */
export function tripInvitees(state, { picked = [] } = {}) {
  const who = canonicalOf(state);
  const me = state?.me ? who(state.me) : null;
  const people = new Map();
  const touch = (raw, { name = '', index = null, usual = false, at = null } = {}) => {
    if (typeof raw !== 'string' || !raw) return;
    const id = who(raw);
    if (!id || id === me) return;
    let p = people.get(id);
    if (!p) { p = { id, fallback: '', index: null, usual: false, rounds: 0, lastAt: 0 }; people.set(id, p); }
    if (usual) p.usual = true;
    if (at != null) { p.rounds++; p.lastAt = Math.max(p.lastAt, at); }
    if (p.index == null && Number.isFinite(index)) p.index = index;
    if (!p.fallback && name) p.fallback = String(name);
  };
  for (const p of Object.values(state?.players || {})) touch(p?.id, { name: p?.name, index: p?.index ?? null });
  for (const r of Object.values(state?.rounds || {})) {
    const list = Array.isArray(r?.players) ? r.players : [];
    // Rounds you played, not ones you only watched
    if (!me || !list.some(p => who(p.id) === me)) continue;
    const at = Number(r.finishedAt || r.createdAt) || 0;
    // One count a round, even when two seats in it are the same person
    const seen = new Set();
    for (const p of list) {
      const id = who(p.id);
      if (seen.has(id)) continue;
      seen.add(id);
      touch(p.id, { name: p.name, index: p.index ?? null, at });
    }
  }
  for (const u of usualsOf(state)) for (const id of Array.isArray(u?.players) ? u.players : []) touch(id, { name: u.names?.[id], usual: true });
  const kept = new Set();
  for (const id of picked) { touch(id); if (typeof id === 'string' && id) kept.add(who(id)); }
  const out = [];
  for (const p of people.values()) {
    const known = nameOf(state, p.id);
    const name = (known && known !== 'Someone' ? known : p.fallback) || '';
    // Nobody to show without a name (a usual's player saved with none): a row of "Someone" helps nobody, unless they're picked already
    if (!name && !kept.has(p.id)) continue;
    const saved = state?.players?.[p.id];
    out.push({
      id: p.id,
      name: name || 'Someone',
      index: saved && saved.index != null ? saved.index : p.index,
      usual: p.usual, rounds: p.rounds, lastAt: p.lastAt, saved: !!saved,
    });
  }
  return out.sort((a, b) => (a.usual === b.usual ? 0 : a.usual ? -1 : 1) || b.lastAt - a.lastAt || a.name.localeCompare(b.name));
}

/** The people whose name has `query` in it (any case), in the list's own order. Everyone for an empty query. */
export function filterInvitees(list, query) {
  const q = lower(query).replace(/\s+/g, ' ');
  if (!q) return list;
  return list.filter(p => lower(p.name).includes(q));
}

/**
 * What a name typed in "Add someone" does: { kind: 'self' } (it's you, and you're going already),
 * { kind: 'existing', id } (someone on the list by that name), { kind: 'new', name } (someone new),
 * or null for nothing typed.
 */
export function nameToAdd(state, list, typed) {
  const name = cleanPersonName(typed);
  if (!name) return null;
  if (state?.me && lower(nameOf(state, state.me)) === lower(name)) return { kind: 'self' };
  const same = list.find(p => lower(p.name) === lower(name));
  return same ? { kind: 'existing', id: same.id } : { kind: 'new', name };
}

/**
 * What the keyboard's Done (or Enter) does in the find-or-add box, where `matches` is the list as
 * the box filters it: the person whose name it is, the one match there is, someone new only when
 * nothing matches, and nothing at all while it's still a search with several matches, so closing
 * the keyboard mid-search never saves a half-typed name as a player. { kind: 'pick', id },
 * { kind: 'add', name }, { kind: 'self' } or null. The Add button and the Add row add the name as typed.
 */
export function submitTyped(state, list, matches, typed) {
  const t = nameToAdd(state, list, typed);
  if (!t) return null;
  if (t.kind === 'self') return t;
  if (t.kind === 'existing') return { kind: 'pick', id: t.id };
  if (matches.length === 1) return { kind: 'pick', id: matches[0].id };
  return matches.length ? null : { kind: 'add', name: t.name };
}

/**
 * Save someone picked from a round or a usual as a player on this phone (a draft of the state), so
 * the trip's teams, flights and standings can use them like anyone in Players. Nothing changes for
 * someone already saved.
 */
export function savePerson(s, person, now = Date.now()) {
  if (!person?.id || s.players?.[person.id]) return;
  if (!s.players) s.players = {};
  s.players[person.id] = { id: person.id, name: cleanPersonName(person.name) || 'Player', index: Number.isFinite(person.index) ? person.index : null, venmo: '', createdAt: now };
}

/** A line under each name on the list: "Usual · 12 rounds together", "3 rounds together", or the handicap. */
export function inviteeLine(p) {
  const rounds = p.rounds ? `${p.rounds} round${p.rounds === 1 ? '' : 's'} together` : '';
  const hc = p.index != null ? `Index ${p.index}` : '';
  return [p.usual ? 'Usual' : '', rounds || hc].filter(Boolean).join(' · ') || 'In your players';
}

/**
 * The planned round whose group link brings friends onto the trip: the trip's soonest round still
 * planned that this phone organizes. Null when there's none yet (plan one, and it has the link).
 */
export function tripLinkPlan(state, tripId, now = new Date()) {
  return tripPlans(state, tripId, now).find(p => p.host) || null;
}

/** The text that goes with the trip's link: the trip, then the first round's own invite. */
export function tripInviteText(trip, plan, link, now = new Date()) {
  const where = trip?.where ? ` at ${trip.where}` : '';
  const dates = tripDates(trip);
  return `${trip?.name || 'Golf trip'}${dates ? `, ${dates}` : ''}${where}.\n${inviteText(plan, link, now)}`;
}

/**
 * People who answered a trip round's link and aren't on Who's going yet, so the organizer sees
 * the link working: [{ key, name, status }] with status 'in' or 'maybe', soonest round's answer
 * first, one a name.
 */
export function tripAnswers(state, trip, now = new Date()) {
  if (!trip) return [];
  const who = canonicalOf(state);
  const going = new Set(tripGoing(state, trip));
  const names = new Set([...going].map(id => lower(nameOf(state, id))));
  const out = [];
  for (const plan of tripPlans(state, trip.id, now)) {
    for (const p of planPeople(plan)) {
      if (p.who === HOST || (p.status !== 'in' && p.status !== 'maybe')) continue;
      // Answered as someone going (an invite's own link, or a player id): already on the list
      if (going.has(who(p.who))) continue;
      const n = lower(p.name);
      if (!n || names.has(n)) continue;
      names.add(n);
      out.push({ key: `${plan.id}:${p.who}`, name: p.name, status: p.status });
    }
  }
  return out;
}
