// Changing trips on this phone: making one, editing its name, dates and who's going, saying
// you're done playing, counting a round for it or taking it out, deleting it (all the organizer's),
// and hiding it from your own Tab and Up next (anyone's). The math is in trips.js.
import { getState, uid, update } from './store.js';
import { editPlan } from './plan-sync.js';
import { cleanPeople, isOrganizer, newTrip, tripOf, tripStamp } from './trips.js';
import { publishDeleted, refreshPlans } from './trip-plan-sync.js';

/** Make a trip and keep it on this phone (it syncs with your account). Returns it. */
export function makeTrip({ name, start, end, where, people = [] }) {
  const s = getState();
  const trip = newTrip({ id: uid('t_'), name, start, end, where, by: s.me, people });
  update(st => { st.trips = { ...(st.trips || {}), [trip.id]: trip }; });
  return trip;
}

/** The record for a trip, made from what the rounds say when this phone only knows it from them. */
function recordOf(s, id) {
  const t = tripOf(s, id);
  if (!t) return null;
  const { derived: _derived, ...rest } = t;
  return { createdAt: Date.now(), ...rest };
}

/**
 * Change a trip's name, dates, place or who's going (the organizer only). The rounds and plans on
 * this phone that carry it get the new stamp, so a round being played (and a shared plan) shows
 * the change on everyone's phone.
 */
export function editTrip(id, patch) {
  const s = getState();
  const base = recordOf(s, id);
  if (!base || !isOrganizer(s, tripOf(s, id))) return;
  const trip = { ...base, ...patch, updatedAt: Date.now() };
  if (patch.people) trip.people = cleanPeople(patch.people, trip.by);
  if (trip.end < trip.start) trip.end = trip.start;
  const stamp = tripStamp(trip);
  update(st => {
    st.trips = { ...(st.trips || {}), [id]: trip };
    for (const r of Object.values(st.rounds)) if (r.trip?.id === id) r.trip = stamp;
  });
  // Only the organizer's plans: a friend's copy follows the organizer's
  for (const p of Object.values(getState().plans || {})) if (p.host && p.trip?.id === id) editPlan(p.id, x => { x.trip = stamp; });
}

/**
 * "Done playing" (the organizer only): the trip opens to settle now, before its last day. It rides
 * in the published plan, so every phone on the trip opens it too.
 */
export function endTrip(id, ended = true) {
  const s = getState();
  const base = recordOf(s, id);
  if (!base || !isOrganizer(s, tripOf(s, id))) return;
  const trip = { ...base, updatedAt: Date.now() };
  if (ended) trip.endedAt = Date.now();
  else delete trip.endedAt;
  update(st => { st.trips = { ...(st.trips || {}), [id]: trip }; });
  refreshPlans();
}

/** Count a round for a trip (`trip`), or take it off (`null`). A shared round sends the change. */
export function setRoundTrip(roundId, trip) {
  update(st => {
    const r = st.rounds[roundId];
    if (!r) return;
    if (trip) r.trip = tripStamp(trip);
    else delete r.trip;
  });
}

/**
 * Delete a trip (the organizer only, and only before any trip money is paid, see trips.js
 * canDeleteTrip): its rounds and plans here stop carrying it, and with trip plans on the server
 * every friend's phone hears it's gone. Their money is on the Tab as before, so nothing is lost.
 * Returns false when it wasn't deleted.
 */
export async function deleteTrip(id, { everywhere = false } = {}) {
  const s = getState();
  if (!isOrganizer(s, tripOf(s, id))) return false;
  // A trip with rounds shared live: friends' phones keep its stamp, so they hear it's deleted from the server
  if (everywhere && !(await publishDeleted(id))) return false;
  update(st => {
    if (st.trips) delete st.trips[id];
    for (const r of Object.values(st.rounds)) if (r.trip?.id === id) delete r.trip;
  });
  for (const p of Object.values(getState().plans || {})) if (p.host && p.trip?.id === id) editPlan(p.id, x => { delete x.trip; });
  return true;
}

/** "Hide this trip" (or the card's x): off your own Tab and Up next. Rounds and money stay as they are. */
export function hideTrip(id, hidden = true) {
  update(st => {
    st.tripHidden = { ...(st.tripHidden || {}) };
    if (hidden) st.tripHidden[id] = Date.now();
    else delete st.tripHidden[id];
  });
}

/** You've seen the trip plan's newest version, so it stops saying "Updated". */
export function seenTripPlan(id, version) {
  if (!version || getState().tripPlanSeen?.[id] === version) return;
  update(st => { st.tripPlanSeen = { ...(st.tripPlanSeen || {}), [id]: version }; });
}
