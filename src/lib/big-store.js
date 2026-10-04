// Changing a Big Game on this phone (big-game.js has the math): saving the organizer's setup,
// starting the groups (one live round a group, each with its own scorekeeper), the side bets and
// closing the game early. Only the organizer changes it. Each change is a new version of the game:
// it goes on every group's round this phone still keeps the card for, and up to the server for the
// rest (big-sync.js).
import { getState, uid, update } from './store.js';
import { createRound } from './round.js';
import { addRound } from './rounds.js';
import { defaultTee, findCourse } from './courses.js';
import { isOrganizer, newTrip, tripOf, tripStamp } from './trips.js';
import { BIG_FORMAT, BIG_NAME, cleanBig, groupsProblem } from './big-game.js';
import { bigOf, bigStatus } from './big-money.js';
import { shareRound, syncConfigured } from './sync.js';
import { refreshBig } from './big-sync.js';
import { keeperOf } from './keeper.js';
import { codeOf } from './pair-debts.js';

/** A group's own round has no money of its own: stroke play at $0, so the game's money is all the Big Game's. */
export const GROUP_STROKE = { stake: 0, payout: 'pot', cap: false, nassau: false };

/** Settings that are this phone's, never a round's. */
const PERSONAL = ['theme', 'shareAmounts', 'betPrompt', 'callouts', 'halfStrokes'];

/** Every round of the game on this draft carries the newest copy (mutates the draft). */
function restamp(st, tripId) {
  const trip = st.trips?.[tripId];
  if (!trip) return;
  const stamp = tripStamp(trip);
  for (const r of Object.values(st.rounds || {})) if (r.trip?.id === tripId) r.trip = stamp;
}

/**
 * Save the organizer's setup: a new game, or a change to one (`id`). `setup` is what the organizer's
 * phone needs to start the groups (the course, the holes, tees and handicap edits); `big` the game.
 * Returns the trip.
 */
export function saveBigGame({ id = null, name, day, setup, big }) {
  const s = getState();
  const now = Date.now();
  const was = id ? s.trips?.[id] : null;
  if (was && !isOrganizer(s, tripOf(s, id))) return null;
  const v = Math.max(cleanBig(big)?.v || 1, (was?.big?.v || 0) + 1);
  const clean = cleanBig({ ...big, v, at: now });
  const trip = was
    ? { ...was, name: String(name || '').replace(/\s+/g, ' ').trim().slice(0, 32) || BIG_NAME, start: day, end: day, where: setup.courseName || was.where || null, people: Object.keys(clean.people).filter(x => x !== s.me), big: clean, setup, updatedAt: now }
    : { ...newTrip({ id: uid('t_'), name: name || BIG_NAME, start: day, end: day, where: setup.courseName || null, by: s.me, people: Object.keys(clean.people), format: BIG_FORMAT, big: clean, now }), setup };
  update(st => {
    st.trips = { ...(st.trips || {}), [trip.id]: trip };
    restamp(st, trip.id);
  });
  refreshBig();
  return trip;
}

/**
 * Change the game (the organizer only): `fn` gets a copy and returns the new one. A new version, on
 * every round here that carries it and on the server. Returns false when it isn't yours to change.
 */
export function editBig(tripId, fn) {
  const s = getState();
  const trip = s.trips?.[tripId];
  if (!trip || !isOrganizer(s, tripOf(s, tripId))) return false;
  const cur = bigOf(s, tripId) || cleanBig(trip.big);
  const next = cleanBig({ ...fn(structuredClone(cur)), v: cur.v + 1, at: Date.now() });
  if (!next) return false;
  update(st => {
    st.trips[tripId] = { ...st.trips[tripId], big: next, updatedAt: Date.now() };
    restamp(st, tripId);
  });
  refreshBig();
  return true;
}

/** Add or change a side bet (the organizer only), until the game is decided. */
export function saveBigBet(tripId, bet) {
  if (bigStatus(getState(), tripId)?.final) return false;
  return editBig(tripId, b => ({ ...b, bets: [...b.bets.filter(x => x.id !== bet.id), bet] }));
}

/** Take a side bet off, until the game is decided. */
export function removeBigBet(tripId, betId) {
  if (bigStatus(getState(), tripId)?.final) return false;
  return editBig(tripId, b => ({ ...b, bets: b.bets.filter(x => x.id !== betId) }));
}

/**
 * Close the game early (the organizer only): a group still playing counts as it stands, so the game
 * is decided once every group's card is in. `ended` false opens it again (before anything is paid).
 */
export function closeBig(tripId, ended = true) {
  const now = Date.now();
  const s = getState();
  if (!s.trips?.[tripId] || !isOrganizer(s, tripOf(s, tripId))) return false;
  update(st => {
    const t = { ...st.trips[tripId], updatedAt: now };
    if (ended) t.endedAt = now; else delete t.endedAt;
    st.trips[tripId] = t;
  });
  return editBig(tripId, b => {
    const out = { ...b };
    if (ended) out.endedAt = now; else delete out.endedAt;
    return out;
  });
}

/** A group's players as a round takes them: the saved player, with the tee and handicap edit from setup. */
function groupPlayers(s, big, setup, ids, course) {
  const tee = defaultTee(course)?.name || null;
  return ids.map(pid => {
    const p = s.players[pid] || { id: pid, name: big.people[pid]?.name || 'Player', index: null };
    return { ...p, tee: setup.tees?.[pid] || tee, courseHcOverride: setup.hcOverride?.[pid] ?? null };
  });
}

/**
 * Start the groups (the organizer, on the game's day): one round a group, stroke play with no money
 * of its own, each shared live so the group joins from its own link and keeps its own card. Each
 * group's round goes to the scorekeeper picked for it as soon as their phone is on it (big-sync.js).
 * Returns { ok, shared, why }: `shared` how many groups got a live link (none with no signal: start
 * sharing them again from the game's page).
 */
export async function startGroups(tripId) {
  const s = getState();
  const trip = s.trips?.[tripId];
  if (!trip || !isOrganizer(s, tripOf(s, tripId))) return { ok: false, why: 'Only the organizer starts the groups.' };
  const big = bigOf(s, tripId);
  const problem = groupsProblem(big);
  if (problem) return { ok: false, why: problem };
  if (big.groups.some(g => g.roundId)) return { ok: true, shared: await shareGroups(tripId) };
  const course = findCourse(s, trip.setup?.courseId);
  if (!course) return { ok: false, why: 'The course isn’t on this phone any more. Edit the game and pick it again.' };
  const settings = Object.fromEntries(Object.entries(structuredClone(s.settings)).filter(([k]) => !PERSONAL.includes(k)));
  settings.stroke = { ...GROUP_STROKE };
  const made = big.groups.map(g => ({
    group: g.id,
    round: createRound({
      id: uid('r_'), game: 'stroke', course, holesCount: trip.setup.holesCount || 18, nine: trip.setup.nine || 'front',
      players: groupPlayers(s, big, trip.setup, g.players, course), settings, hcPct: big.hcPct, useHandicaps: big.useHandicaps,
    }),
  }));
  const next = cleanBig({ ...big, v: big.v + 1, at: Date.now(), groups: big.groups.map(g => ({ ...g, roundId: made.find(m => m.group === g.id).round.id })) });
  const mine = made.find(m => big.groups.find(g => g.id === m.group).players.includes(s.me)) || made[0];
  update(st => {
    st.trips[tripId] = { ...st.trips[tripId], big: next, updatedAt: Date.now() };
    const stamp = tripStamp(st.trips[tripId]);
    for (const m of made) addRound(st, { ...m.round, trip: stamp });
    st.activeRoundId = mine.round.id;
  });
  return { ok: true, shared: await shareGroups(tripId), roundId: mine.round.id };
}

/**
 * Share every group's round that has no live link yet, and put each group's code in the game, so
 * every phone in one group's round can read the others'. Returns how many groups have a link.
 */
export async function shareGroups(tripId) {
  const s = getState();
  const big = bigOf(s, tripId);
  if (!big || !syncConfigured) return 0;
  const codes = {};
  for (const g of big.groups) {
    const r = g.roundId ? s.rounds[g.roundId] : null;
    if (!r) continue;
    if (codeOf(r)) { codes[g.id] = codeOf(r); continue; }
    try { codes[g.id] = await shareRound(r.id); } catch { /* no signal: try again from the game's page */ }
  }
  const changed = big.groups.some(g => codes[g.id] && codes[g.id] !== g.code);
  if (changed) editBig(tripId, b => ({ ...b, groups: b.groups.map(g => ({ ...g, code: codes[g.id] || g.code })) }));
  return Object.keys(codes).length;
}

/**
 * Delete a game that hasn't started (the organizer only): no group's round made yet, so nobody else
 * has it. Returns false when it can't go.
 */
export function deleteBig(tripId) {
  const s = getState();
  const big = bigOf(s, tripId);
  if (!big || !isOrganizer(s, tripOf(s, tripId)) || big.groups.some(g => g.roundId)) return false;
  update(st => { delete st.trips[tripId]; });
  return true;
}

/** Whether this phone still has a group's card to hand to someone (it's the host phone and keeps it). */
export function keepsCard(state, round) {
  const k = keeperOf(round);
  return !!round?.shared?.host && !!k && k.id === null;
}
