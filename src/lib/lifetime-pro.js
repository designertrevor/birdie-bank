// Pro for life for early testers: the row the server keeps for each account (entitlements,
// supabase/2026-10-09-lifetime-pro.sql) read into plain data, and this phone's copy of it, so a
// lifetime holder is still Pro with no signal. Pure functions of plain data, so they're easy to test.
// The network side (reading the row after sign-in) is pro-client.js.

/** Nothing Pro: no row, no table yet, signed out, or a row without lifetime. */
export const NO_PRO = Object.freeze({ lifetime: false, since: null });

/** The Settings line and the plan screen's thanks for a lifetime holder. */
export const LIFETIME_LINE = 'Pro for life. Thanks for testing early';

/**
 * A row as it comes back from `entitlements` ({ lifetime, lifetime_since }) as { lifetime, since }.
 * Anything else (null, an error's leftovers, a string) is NO_PRO. Only a real `true` counts.
 */
export function readEntitlement(row) {
  if (!row || typeof row !== 'object' || row.lifetime !== true) return NO_PRO;
  const at = row.lifetime_since ? Date.parse(row.lifetime_since) : NaN;
  return { lifetime: true, since: Number.isNaN(at) ? null : at };
}

/** What this phone keeps: the account it belongs to and what the server said. */
export function toSaved(uid, ent, now = Date.now()) {
  if (!uid) return null;
  return { uid, lifetime: ent?.lifetime === true, since: ent?.lifetime ? ent.since ?? null : null, at: now };
}

/**
 * This phone's copy, for the account signed in now: only when it was saved for the same account,
 * so a phone handed to someone else (or signed out) never carries Pro over. NO_PRO otherwise.
 */
export function savedFor(saved, uid) {
  if (!uid || !saved || typeof saved !== 'object' || saved.uid !== uid) return NO_PRO;
  if (saved.lifetime !== true) return NO_PRO;
  return { lifetime: true, since: Number.isFinite(saved.since) ? saved.since : null };
}

/** "Since Oct 9, 2026", or null when the day isn't known. */
export function sinceLine(ent) {
  if (!ent?.lifetime || !Number.isFinite(ent.since)) return null;
  return `Since ${new Date(ent.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
