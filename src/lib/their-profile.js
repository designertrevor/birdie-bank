// A friend's own profile, by any of their player ids: the profile of the account one of their seats
// is linked to (state.accountOf, state.profiles, filled in by profiles.js). Their name and payment
// app from it win over what you saved for them on this phone (nameOf in ledger.js, payInfoFor in
// pay.js); what you saved is the fallback when their profile has none. Never yours: your own name
// and app are your player card. Kept apart from profile-model.js so pay.js and ledger.js can use
// it without importing the round engine.
import { linksOf } from './people-links.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Worked out once per state (like avatars.js), since every name and pay button on a screen asks
const cache = new WeakMap(); // state -> Map(id -> profile | null)

/** The friend's own profile ({ name, payApp, payHandle, ... } as profile-model.js fromRow keeps it), or null. */
export function theirProfile(state, id) {
  if (!state || !id || !isObj(state.profiles) || !isObj(state.accountOf)) return null;
  let byId = cache.get(state);
  if (!byId) { byId = new Map(); cache.set(state, byId); }
  if (byId.has(id)) return byId.get(id);
  const L = linksOf(state);
  const person = L.personOf(id);
  let found = null;
  if (!(state.me && person === L.personOf(state.me))) {
    for (const x of L.groupOf(person)) {
      const acct = state.accountOf[x];
      const prof = acct && state.profiles[acct];
      if (isObj(prof)) { found = prof; break; }
    }
  }
  byId.set(id, found);
  return found;
}

/** The name on a friend's own profile, or null when they have none (or it's you). */
export function theirName(state, id) {
  const n = theirProfile(state, id)?.name;
  return typeof n === 'string' && n.trim() ? n.trim().slice(0, 40) : null;
}
