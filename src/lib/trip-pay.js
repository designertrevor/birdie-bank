// Payments made from "Settle the trip" (see trips.js). Their id names the trip, so every phone that
// gets one (from its round's payment rows, or the account sync) knows it's trip money, with no new
// column on the server: "trip:<tripId>:<from>><to>:<when>". No imports, so the Tab's own files
// (pair-debts.js, shared-tab.js) can use it without a loop.

const PREFIX = 'trip:';

/** The id for one trip payment. `at` keeps two payments between the same two people apart. */
export function tripPaymentId(tripId, from, to, at) {
  return `${PREFIX}${tripId}:${from}>${to}:${Number(at || 0).toString(36)}`;
}

/** The trip a payment settled, or null for any other payment. */
export function tripOfPayment(s) {
  const id = String(s?.id || '');
  if (!id.startsWith(PREFIX)) return null;
  const end = id.indexOf(':', PREFIX.length);
  return end > PREFIX.length ? id.slice(PREFIX.length, end) : null;
}

export const isTripPayment = s => tripOfPayment(s) != null;

/**
 * Trips being settled as one: some payment from "Settle the trip" is on this phone. From then on
 * the trip's rounds are squared across the whole trip in the fewest payments, so the Tab stops
 * keeping their shared-round money between the two people in each (pair-debts.js).
 */
export function settlingTrips(state) {
  const out = new Set();
  for (const s of state?.settlements || []) {
    const t = tripOfPayment(s);
    if (t) out.add(t);
  }
  return out;
}

/** A round of a trip that's being settled as one. */
export function inSettlingTrip(round, settling) {
  return !!round?.trip?.id && settling.has(round.trip.id);
}
