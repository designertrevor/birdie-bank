// Changing trips on this phone: making one, editing its name, dates and who's going, saying
// you're done playing, counting a round for it or taking it out, deleting it (all the organizer's),
// hiding it from your own Tab and Up next (anyone's), and adding, changing or deleting a trip
// expense (anyone adds one; only its adder changes or deletes it). The math is in trips.js and
// trip-expenses.js.
import { getState, uid, update } from './store.js';
import { editPlan } from './plan-sync.js';
import { nameOf } from './ledger.js';
import { TRIP_FORMATS, cleanPeople, cupOnEdit, isOrganizer, newTrip, tripOf, tripStamp } from './trips.js';
import { canEditExpense, cleanExpense, cleanWhat, personFor } from './trip-expenses.js';
import { publishDeleted, refreshPlans } from './trip-plan-sync.js';
import { CUP_FORMAT, cleanCup } from './cup.js';
import { startingCup } from './cup-store.js';

/** Make a trip and keep it on this phone (it syncs with your account). Returns it. */
export function makeTrip({ name, start, end, where, people = [], format, cup = null }) {
  const s = getState();
  const trip = newTrip({ id: uid('t_'), name, start, end, where, by: s.me, people, format, cup });
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
  if (!TRIP_FORMATS[trip.format]) trip.format = base.format;
  // A team points trip keeps its teams; switched back to money, they're kept for switching again
  if (trip.cup || trip.format === CUP_FORMAT) trip.cup = cleanCup(trip.cup);
  const stamp = tripStamp(trip);
  const cupNow = trip.format === CUP_FORMAT;
  update(st => {
    st.trips = { ...(st.trips || {}), [id]: trip };
    for (const r of Object.values(st.rounds)) {
      if (r.trip?.id !== id) continue;
      r.trip = stamp;
      // Now played for team points: a round this phone can still change for everyone, not finished
      // before the change, gets its matches
      if (cupNow && !r.cup && cupOnEdit(st, r)) {
        const c = startingCup(st, r, trip);
        if (c) r.cup = c;
      }
    }
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
    if (trip) {
      r.trip = tripStamp(trip);
      // On a team points trip it gets its matches from the teams, unless it already has some
      const c = !r.cup && trip.format === CUP_FORMAT ? startingCup(st, r, trip) : null;
      if (c) r.cup = c;
    } else {
      delete r.trip;
      delete r.cup;
    }
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
    for (const r of Object.values(st.rounds)) if (r.trip?.id === id) { delete r.trip; delete r.cup; }
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

/**
 * Add a trip expense, or change one you added (`id`). `amount` is in cents, `payer` and each of
 * `people` ({ id, part }) are ids as this phone knows them: `part` is null for an equal split, cents
 * for a split by amount, or the number of shares. Each person is written with their seat in the
 * trip's rounds shared live, so friends' phones know who they are. Goes to the other phones on the
 * trip right away when there's signal. Returns the expense, or null when it doesn't add up.
 */
export function saveExpense({ id = null, tripId, what, amount, payer, split, people }) {
  const s = getState();
  const old = id ? cleanExpense(s.tripExpenses?.[id]) : null;
  if (id && (!old || old.deleted || !canEditExpense(s, old))) return null;
  // Always newer than the copy it replaces, so every phone takes it even if this phone's clock went back
  const now = Math.max(Date.now(), (old?.updatedAt || 0) + 1);
  const person = x => personFor(s, tripId, x, nameOf(s, x));
  const raw = {
    id: old?.id || uid('x_'), tripId, what: cleanWhat(what), amount: Math.round(amount) / 100, split,
    payer: person(payer),
    people: people.map(p => ({ ...person(p.id), part: split === 'amounts' ? Math.round(p.part) / 100 : split === 'shares' ? p.part : null })),
    by: old?.by || s.me, at: old?.at || now, updatedAt: now,
  };
  const e = cleanExpense(raw);
  if (!e) return null;
  update(st => { st.tripExpenses = { ...(st.tripExpenses || {}), [e.id]: e }; });
  refreshPlans();
  return e;
}

/** Delete a trip expense you added. It stays as a stub so every phone on the trip hears it's gone. */
export function deleteExpense(id) {
  const s = getState();
  const old = cleanExpense(s.tripExpenses?.[id]);
  if (!old || old.deleted || !canEditExpense(s, old)) return false;
  const stub = { id: old.id, tripId: old.tripId, by: old.by, deleted: true, at: old.at, updatedAt: Math.max(Date.now(), old.updatedAt + 1) };
  update(st => { st.tripExpenses = { ...(st.tripExpenses || {}), [id]: stub }; });
  refreshPlans();
  return true;
}

/** Put back an expense you just deleted (the toast's Undo), as a newer copy so every phone takes it. */
export function restoreExpense(expense) {
  const gone = cleanExpense(getState().tripExpenses?.[expense?.id]);
  const e = cleanExpense({ ...expense, updatedAt: Math.max(Date.now(), (gone?.updatedAt || 0) + 1, (Number(expense?.updatedAt) || 0) + 1) });
  if (!e || e.deleted || !canEditExpense(getState(), e)) return null;
  update(st => { st.tripExpenses = { ...(st.tripExpenses || {}), [e.id]: e }; });
  refreshPlans();
  return e;
}
