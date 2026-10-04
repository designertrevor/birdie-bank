// Changing a team points trip on this phone (cup.js has the math): a round's matches, and the
// stake's "I paid" marks. Picking the teams goes through the trip's own edit (trip-store.js).
import { getState, update } from './store.js';
import { cleanRoundCup, cupCounts, defaultRoundCup, stakePaymentId } from './cup.js';
import { canRecount, tripOf } from './trips.js';
import { payKey, refreshCup } from './cup-sync.js';

/**
 * A round's matches to start with when it counts for a team points trip, or null for a money trip.
 * Each round after the first turns the pairings, so partners and opponents rotate over the trip.
 */
export function startingCup(state, round, trip) {
  if (!trip || !cupCounts(round.game)) return null;
  const before = Object.values(state.rounds || {}).filter(r => r?.trip?.id === trip.id && r.cup && r.id !== round.id).length;
  return defaultRoundCup(state, trip, round.players, null, { rotate: before, game: round.game });
}

/**
 * Change a round's matches (`cup` { kind, sides }), on a round this phone can still change for
 * everyone in it (trips.js canRecount). A round being played live sends it to every phone.
 */
export function setRoundCup(roundId, cup) {
  const s = getState();
  const r = s.rounds[roundId];
  if (!r || !canRecount(s, r)) return false;
  const clean = cleanRoundCup({ ...r, cup });
  update(st => {
    if (clean) st.rounds[roundId].cup = clean;
    else delete st.rounds[roundId].cup;
  });
  refreshCup();
  return true;
}

/** The matches a round would start with now, from the trip's teams (for "Start over"). */
export function resetRoundCup(roundId) {
  const s = getState();
  const r = s.rounds[roundId];
  const trip = r?.trip?.id ? tripOf(s, r.trip.id) : null;
  const cup = r && trip ? startingCup(s, r, trip) : null;
  return cup ? setRoundCup(roundId, cup) : false;
}

/** Your first name, so friends' phones can say who marked a payment. */
const myName = s => String(s.players?.[s.me]?.name || '').trim().split(/\s+/)[0] || null;

/** This phone's own row of marks as the server will have it, so an undone mark never shows as someone else's meanwhile. */
function ownRow(st, tripId) {
  const key = payKey();
  if (!key || !st.cupRemote?.[tripId]?.[key]) return;
  st.cupRemote = { ...st.cupRemote, [tripId]: { ...st.cupRemote[tripId], [key]: { byName: myName(st), pays: st.cupPaid[tripId] } } };
}

/**
 * Mark one of the stake's payments paid (all that's open on it). It goes to the server so every
 * phone on the trip sees it. Returns the mark, or null when nothing's open on the line.
 */
export function markStake(tripId, line, { now = Date.now() } = {}) {
  const amount = (line.open ?? Math.round(line.amount * 100)) / 100;
  if (!(amount > 0)) return null;
  const s = getState();
  const mark = { id: stakePaymentId(tripId, line.key, now), key: line.key, from: line.from, to: line.to, amount, at: now, byName: myName(s) };
  update(st => {
    st.cupPaid = { ...(st.cupPaid || {}) };
    st.cupPaid[tripId] = [...(Array.isArray(st.cupPaid[tripId]) ? st.cupPaid[tripId] : []), mark];
    ownRow(st, tripId);
  });
  refreshCup();
  return mark;
}

/** Take back a stake payment marked on this phone. */
export function undoStake(tripId, id) {
  update(st => {
    const list = Array.isArray(st.cupPaid?.[tripId]) ? st.cupPaid[tripId] : [];
    st.cupPaid = { ...(st.cupPaid || {}), [tripId]: list.filter(m => m.id !== id) };
    ownRow(st, tripId);
  });
  refreshCup();
}
