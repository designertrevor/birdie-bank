// One "news" card per visit to Up next: "It shipped" (something you asked for or voted for on the
// roadmap, RoadmapUpNext.jsx) and "What's new" (what landed in this update, WhatsNewUpNext.jsx)
// never show together. The one that isn't shown isn't marked as told or seen, so it waits for a
// later visit. "It shipped" goes first: it's about something you picked yourself.
// The rule is pure (upNextCard); the slot below is this visit's record of it, kept in memory.

/**
 * Which news card this visit shows: 'shipped', 'whatsNew' or null (not yet).
 *   showing   the card already on screen this visit: it keeps the visit, nothing swaps in
 *   shipped   'pending' (still finding out), 'none' (nothing shipped for you) or 'ready'
 *   whatsNew  true when an update brought something new to say
 * What's new waits while It shipped is still finding out, so it never jumps in ahead of it.
 */
export function upNextCard({ showing = null, shipped = 'pending', whatsNew = false } = {}) {
  if (showing) return showing;
  if (shipped === 'ready') return 'shipped';
  if (whatsNew && shipped !== 'pending') return 'whatsNew';
  return null;
}

/** How long What's new waits on It shipped (a slow file, or no signal for the roadmap) before going ahead. */
export const SHIPPED_WAIT_MS = 4000;

const fresh = () => ({ showing: null, shipped: 'pending', whatsNew: false });
let slot = fresh();
const listeners = new Set();
function set(patch) { slot = { ...slot, ...patch }; listeners.forEach(l => l()); }

export const subscribeSlot = l => { listeners.add(l); return () => listeners.delete(l); };
export const getSlot = () => slot;

/** It shipped has nothing to say this visit (or is done waiting on it). */
export function shippedNone() { if (slot.shipped === 'pending') set({ shipped: 'none' }); }

/** A card has something to show: true when it may show it now (and it then holds the visit). */
export function claimCard(card) {
  const next = card === 'shipped' ? { ...slot, shipped: 'ready' } : { ...slot, whatsNew: true };
  const wins = upNextCard(next) === card;
  if (wins) next.showing = card;
  // Only tell the cards when something changed, so asking again while waiting never loops
  if (next.showing !== slot.showing || next.shipped !== slot.shipped || next.whatsNew !== slot.whatsNew) set(next);
  return wins;
}

/** Leaving Up next: the next visit starts over. */
export function endUpNextVisit() { slot = fresh(); listeners.forEach(l => l()); }
