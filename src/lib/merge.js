// Merging duplicate players: "Adam" you added and "Adam" from a round you joined are one person.
// The duplicate keeps its id and points at the player that's kept (`mergedInto`), so rounds are
// never rewritten, the Tab and records add up under one name, and a merge can be undone. Pure.
import { keptId } from './format.js';

/** Players merged into `id`, for "Merged in" on their card. */
export function mergedInto(state, id) {
  return Object.values(state.players).filter(p => p.mergedInto === id);
}

/**
 * Merge `from` into `into` on a draft state. `name` names a duplicate that only exists in joined
 * rounds (it gets a small record so the merge syncs with the account). Never touches you.
 */
export function mergePlayer(s, from, into, { name = '' } = {}) {
  const to = keptId(s, into);
  if (!from || !to || from === to || from === s.me || to === s.me || !s.players[to]) return false;
  const dup = s.players[from];
  if (dup) {
    // What the kept player is missing comes over from the duplicate
    const kept = s.players[to];
    if (kept.index == null && dup.index != null) kept.index = dup.index;
    if (!kept.payApp && dup.payApp) { kept.payApp = dup.payApp; kept.payHandle = dup.payHandle; }
    dup.mergedInto = to;
  } else {
    s.players[from] = { id: from, name, mergedInto: to, stub: true, createdAt: Date.now() };
  }
  // Players already merged into the duplicate move along with it
  for (const p of Object.values(s.players)) if (p.mergedInto === from) p.mergedInto = to;
  for (const c of Object.values(s.crews || {})) {
    if (c.playerIds.includes(from)) c.playerIds = [...new Set(c.playerIds.map(x => (x === from ? to : x)))];
  }
  return true;
}

/** Undo a merge: the duplicate shows up on its own again. */
export function unmergePlayer(s, id) {
  const p = s.players[id];
  if (!p?.mergedInto) return;
  if (p.stub) delete s.players[id];
  else delete p.mergedInto;
}
