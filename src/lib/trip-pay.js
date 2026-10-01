// Payments made from "Settle the trip" for the trip's rounds that only this phone has (see trips.js).
// Their id names the trip, so the account sync knows it's trip money, with no new column:
// "trip:<tripId>:<from>><to>:<when>". The trip's shared rounds are paid on their own round
// transfers instead, like any Tab payment, so both phones of every pair see it. No imports, so the
// Tab's own files (pair-debts.js, shared-tab.js) can use it without a loop.

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
 * A payment row's reason when it was made from "Settle the trip": the whole trip once it's over,
 * or someone's part when they leave early (`part`). It rides on the trip's shared round transfers,
 * so every phone in that round knows the trip is being settled.
 */
export const tripReason = (tripId, part = false) => `${part ? 'trip-part' : 'trip'}:${tripId}`;

/** What a payment says about the trip it settled: { id, part }, or null for any other payment. */
export function tripSettleOf(s) {
  const r = String(s?.reason || '');
  const m = /^(trip|trip-part):(.+)$/.exec(r);
  if (m) return { id: m[2], part: m[1] === 'trip-part' };
  const id = tripOfPayment(s);
  return id ? { id, part: !!s.tripPart } : null;
}
