// Who this phone is, for usage counts (analytics-core.js): a guest (it joined from a friend's link
// and has no account), a member (it joined from a link and has signed in since) or an organizer
// (it set itself up). Plus the sign-in that's on its way: Google and the email link leave the page,
// so where the sheet was opened from waits here until the phone comes back signed in
// (ops-account.js sends signed_in then). Only slugs and a time, never a name or an email.
const JOINED = 'bb-joined-by-link';
const SIGNING_IN = 'bb-signin-pending';
// A sign-in link opened later than this doesn't count as the same sign-in
const PENDING_FOR = 24 * 60 * 60 * 1000;

const store = () => { try { return localStorage; } catch { return null; } };

/** This phone took a seat from a friend's link before it had a player of its own. */
export function markJoinedByLink(storage = store()) {
  try { storage?.setItem(JOINED, '1'); } catch { /* storage blocked */ }
}

/** Has this phone a Supabase session saved (cloud.js keeps it under bb-auth)? Read without loading Supabase. */
export function hasAccountHint(storage = store()) {
  try {
    for (let i = 0; i < (storage?.length || 0); i++) if (storage.key(i)?.startsWith('bb-auth')) return true;
  } catch { /* storage blocked */ }
  return false;
}

/** 'guest' | 'member' | 'organizer'. `signedIn`: the account is known; otherwise the saved session decides. */
export function usageRole({ signedIn, storage = store() } = {}) {
  let joined = false;
  try { joined = storage?.getItem(JOINED) === '1'; } catch { /* storage blocked */ }
  const account = signedIn ?? hasAccountHint(storage);
  if (!joined) return 'organizer';
  return account ? 'member' : 'guest';
}

/** The sign-in sheet sent the phone off to sign in: `source` (where the sheet opened), `path` (google | email | apple). */
export function noteSigningIn({ source, path, role, now = Date.now(), storage = store() }) {
  try { storage?.setItem(SIGNING_IN, JSON.stringify({ source, path, role, at: now })); } catch { /* storage blocked */ }
}

/** The sign-in that was on its way, once, or null (none, or too old). Clears it. */
export function takeSigningIn({ now = Date.now(), storage = store() } = {}) {
  let v = null;
  try {
    v = JSON.parse(storage?.getItem(SIGNING_IN) || 'null');
    storage?.removeItem(SIGNING_IN);
  } catch { return null; }
  if (!v || typeof v.at !== 'number' || now - v.at > PENDING_FOR || now < v.at) return null;
  return { source: v.source, path: v.path, role: v.role };
}
