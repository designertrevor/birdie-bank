// Changing trips on this phone: making one, editing its name and dates, saying you're done
// playing, and counting a round for it or taking it out. The math is in trips.js.
import { getState, uid, update } from './store.js';
import { editPlan } from './plan-sync.js';
import { newTrip, tripOf, tripStamp } from './trips.js';

/** Make a trip and keep it on this phone (it syncs with your account). Returns it. */
export function makeTrip({ name, start, end, where }) {
  const s = getState();
  const trip = newTrip({ id: uid('t_'), name, start, end, where, by: s.me });
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
 * Change a trip's name, dates or place. The rounds and plans on this phone that carry it get the
 * new stamp, so a round being played (and a shared plan) shows the change on everyone's phone.
 */
export function editTrip(id, patch) {
  const s = getState();
  const base = recordOf(s, id);
  if (!base) return;
  const trip = { ...base, ...patch, updatedAt: Date.now() };
  if (trip.end < trip.start) trip.end = trip.start;
  const stamp = tripStamp(trip);
  update(st => {
    st.trips = { ...(st.trips || {}), [id]: trip };
    for (const r of Object.values(st.rounds)) if (r.trip?.id === id) r.trip = stamp;
  });
  // Only the organizer's plans: a friend's copy follows the organizer's
  for (const p of Object.values(getState().plans || {})) if (p.host && p.trip?.id === id) editPlan(p.id, x => { x.trip = stamp; });
}

/** "Done playing": the trip opens to settle now, before its last day. */
export function endTrip(id, ended = true) {
  const s = getState();
  const base = recordOf(s, id);
  if (!base) return;
  const trip = { ...base, updatedAt: Date.now() };
  if (ended) trip.endedAt = Date.now();
  else delete trip.endedAt;
  update(st => { st.trips = { ...(st.trips || {}), [id]: trip }; });
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
 * Delete a trip from this phone: its rounds and plans here stop carrying it. Their money is on
 * the Tab as before, so nothing is lost. Only for a trip with no payments made from it.
 */
export function deleteTrip(id) {
  update(st => {
    if (st.trips) delete st.trips[id];
    for (const r of Object.values(st.rounds)) if (r.trip?.id === id) delete r.trip;
  });
  for (const p of Object.values(getState().plans || {})) if (p.host && p.trip?.id === id) editPlan(p.id, x => { delete x.trip; });
}
