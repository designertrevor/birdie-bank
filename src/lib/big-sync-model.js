// The pure parts of the Big Game's sync (big-sync.js has the transport): the organizer's record
// as it goes on the server, a fetched round kept as a card, which groups' rounds to read, and the
// cards the organizer's phone hands to each group's scorekeeper. Pure, unit tested.
import { assemble } from './sync-model.js';
import { cleanBig } from './big-game.js';
import { bigOf, bigRounds, cardFor } from './big-money.js';
import { isOrganizer, tripOf } from './trips.js';
import { handOff, keeperOf } from './keeper.js';
import { codeOf } from './pair-debts.js';
import { holeComplete } from './round.js';
import { isoDate } from './plans.js';

const DAY = 864e5;
/** Another group's round is read again until this long after the game's day, for scores fixed after it ended. */
const READ_DAYS = 3;

/** The game record as it goes on the server: { tripId, v, at, big, endedAt, byName }. */
export function gameRecord(state, tripId) {
  const trip = state.trips?.[tripId];
  const big = cleanBig(trip?.big);
  if (!trip || !big) return null;
  const byName = String(state.players?.[state.me]?.name || '').trim().split(/\s+/)[0] || null;
  return { tripId, v: big.v, at: big.at || trip.updatedAt || 0, big, endedAt: trip.endedAt || null, byName };
}

/** A record from the server, tidied, or null. */
export function cleanRecord(r) {
  if (!r || typeof r !== 'object' || typeof r.tripId !== 'string') return null;
  const big = cleanBig(r.big);
  if (!big) return null;
  return { tripId: r.tripId, v: big.v, at: Number(r.at) || 0, big, endedAt: Number(r.endedAt) || null, byName: typeof r.byName === 'string' ? r.byName.slice(0, 40) : null };
}

/** Whether the organizer's phone should put its record up: the server has none, an older one, or another end. */
export function recordDue(mine, theirs) {
  if (!mine) return false;
  if (!theirs) return true;
  return mine.v > theirs.v || (mine.endedAt || null) !== (theirs.endedAt || null);
}

/** A fetched live round, kept as a card: only what the board needs. */
export function toCard(meta, holes, now = Date.now()) {
  const r = assemble(meta, holes);
  return {
    id: r.id, status: r.status, createdAt: r.createdAt || 0, finishedAt: r.finishedAt || null,
    players: (r.players || []).map(p => ({ id: p.id, name: p.name, courseHc: p.courseHc ?? null, plays: p.plays ?? 0, tee: p.tee ?? null })),
    holes: r.holes || [], scores: r.scores || {}, left: r.left || {}, ...(r.joined ? { joined: r.joined } : {}),
    keeper: r.keeper || null, hostName: r.hostName || null, onApp: r.onApp || {}, trip: r.trip || null,
    ...(r.shareCode ? { shareCode: r.shareCode } : {}), fetchedAt: now,
  };
}

/** Which groups' rounds to read: ones with a live code and no round here, still worth reading. */
export function codesToRead(state, tripId, { now = Date.now() } = {}) {
  const big = bigOf(state, tripId);
  if (!big) return [];
  const rounds = bigRounds(state, tripId);
  const trip = tripOf(state, tripId);
  const old = trip?.end && isoDate(new Date(now - READ_DAYS * DAY)) > trip.end;
  const out = [];
  for (const g of big.groups) {
    if (!g.code) continue;
    if (rounds.some(r => r.id === g.roundId || codeOf(r) === g.code)) continue;
    const have = state.bigCards?.[tripId]?.[g.code];
    if (have && old) continue;
    out.push(g.code);
  }
  return out;
}

/**
 * The cards handed to the scorekeeper picked for each group, on the organizer's phone: a group's round
 * this phone still keeps the card for (the host phone), nobody has scored yet, and the player picked
 * has their phone on the round. Returns [{ roundId, patch }].
 */
export function handOffs(state, tripId, now = Date.now()) {
  const big = bigOf(state, tripId);
  const trip = tripOf(state, tripId);
  if (!big || !trip || !isOrganizer(state, trip)) return [];
  const out = [];
  for (const g of big.groups) {
    if (!g.keeper) continue;
    const r = cardFor(state, tripId, g);
    if (!r || !state.rounds?.[r.id] || !r.shared?.host || r.shared.ended || r.status !== 'active') continue;
    const k = keeperOf(r);
    if (!k || k.id !== null || g.keeper === state.me) continue;
    if (!r.onApp?.[g.keeper] || r.holes.some(h => holeComplete(r, h))) continue;
    out.push({ roundId: r.id, patch: handOff(g.keeper, null, now) });
  }
  return out;
}
