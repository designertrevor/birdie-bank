// What's new: the app's release notes, made from the shipped part of the public roadmap
// (roadmap-public.js, built from ROADMAP.md), so there's one list to keep. After an update brings
// new shipped items, Up next shows a calm card once (never while a round is going on, see
// app-update.js), and Settings opens the whole list any time.
// This phone remembers which shipped items it has already shown ({ seen: [item ids], at }), kept
// in whats-new-local.js. Pure, so the tests cover the "show once" rules.

/** How many titles the Up next card names before "and N more". */
export const CARD_TITLES = 3;
/** Someone who was already using the app before What's new existed hears about the last this-many days. */
export const RETURNING_DAYS = 14;
const DAY = 86400e3;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const list = v => (Array.isArray(v) ? v : []);
const dayOf = date => { const t = Date.parse(`${date}T12:00:00Z`); return Number.isFinite(t) ? t : null; };

/** A seen record read back from storage: { seen: [ids] | null, at }. null seen means never set up. */
export function cleanSeen(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.seen)) return { seen: null, at: 0 };
  return { seen: raw.seen.filter(id => typeof id === 'string' && id.length <= 80), at: Number(raw.at) || 0 };
}

/** Shipped items, newest first (by ship date, then their order on the roadmap). Undated ones go last. */
export function shippedItems(items) {
  return list(items).filter(i => i?.status === 'shipped' && i.id && i.title)
    .sort((a, b) => (b.shipped || '').localeCompare(a.shipped || '') || (a.order ?? 0) - (b.order ?? 0));
}

/** Shipped items this phone hasn't shown yet, newest first. Nothing before the record is set up. */
export function newSince(items, record) {
  const seen = record?.seen;
  if (!Array.isArray(seen)) return [];
  const had = new Set(seen);
  return shippedItems(items).filter(i => !had.has(i.id));
}

/**
 * The first record on a phone. Someone new to the app has nothing to catch up on, so everything
 * counts as seen. Someone who already has rounds (they had the app before this) hears about what
 * shipped in the last RETURNING_DAYS, once.
 */
export function firstSeen(items, { returning = false, now = Date.now() } = {}) {
  const cutoff = now - RETURNING_DAYS * DAY;
  const seen = shippedItems(items).filter(i => {
    if (!returning) return true;
    const t = dayOf(i.shipped);
    return t == null || t < cutoff;
  }).map(i => i.id);
  return { seen, at: now };
}

/** The record after showing these items (or the whole list): everything shipped so far is seen. */
export function markSeen(items, now = Date.now()) {
  return { seen: shippedItems(items).map(i => i.id), at: now };
}

/**
 * What the Up next card shows: { items, more, ids } (ids: every new item) or null. Never while a round is going on (`safe`
 * false, see updateSafe), and never for a phone with no record yet (set one with firstSeen first).
 */
export function cardNotes(items, record, { safe = true } = {}) {
  if (!safe) return null;
  const fresh = newSince(items, record);
  if (!fresh.length) return null;
  return { items: fresh.slice(0, CARD_TITLES), more: Math.max(0, fresh.length - CARD_TITLES), ids: fresh.map(i => i.id) };
}

/** A month heading for a ship date: "October 2026", or "Earlier" with no date. */
export function monthLabel(date) {
  const t = dayOf(date);
  if (t == null) return 'Earlier';
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The What's new screen: shipped items by month, newest first, each marked `fresh` when it's new
 * since this phone last looked, or when it's one of `freshIds` (what the Up next card just showed,
 * which it has already counted as seen). [{ label, items: [{ ...item, fresh }] }]
 */
export function releaseGroups(items, record, freshIds = null) {
  const fresh = new Set(Array.isArray(freshIds) ? freshIds : newSince(items, record).map(i => i.id));
  const groups = [];
  for (const i of shippedItems(items)) {
    const label = monthLabel(i.shipped);
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
    g.items.push({ ...i, fresh: fresh.has(i.id) });
  }
  return groups;
}
