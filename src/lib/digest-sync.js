// The Digest screen's server calls (supabase/2026-10-12-feedback-digest.sql). Every one of them is
// checked on the server against app_admins, so only Trevor's account gets anything back; the app
// hiding the row in Settings is a convenience, not the lock.
import { useEffect, useState } from 'react';
import { getSupabase } from './supabase.js';
import { useAccount } from './cloud.js';
import { digestDenied, digestOff } from './digest.js';

const ADMIN = 'bb-digest-admin';

/** 'off' (SQL not run or no server), 'denied', 'offline' or 'error' for a failed call. */
function stateOf(error) {
  if (digestOff(error)) return 'off';
  if (digestDenied(error)) return 'denied';
  return /fetch|network|load failed/i.test(error?.message || '') ? 'offline' : 'error';
}

async function call(name, args) {
  const db = await getSupabase();
  if (!db) return { error: { code: 'PGRST202', message: 'no server' } };
  return db.rpc(name, args);
}

/** The last `days` days of ideas with Trevor's call on each: { rows } or { state }. */
export async function loadDigest(days = 7) {
  const { data, error } = await call('digest_feedback', { p_days: days });
  return error ? { state: stateOf(error) } : { rows: Array.isArray(data) ? data : [] };
}

/** Approved and not yet in ROADMAP.md: { rows } or { state }. */
export async function loadApproved() {
  const { data, error } = await call('digest_approved', {});
  return error ? { state: stateOf(error) } : { rows: Array.isArray(data) ? data : [] };
}

/** Approve ('approve'), skip ('skip') or take back (null). Resolves to an error state or null. */
export async function decide(id, decision, area = null, note = null) {
  const { error } = await call('digest_decide', { p_id: id, p_decision: decision, p_area: area, p_note: note });
  return error ? stateOf(error) : null;
}

/** Mark approved ideas as written into ROADMAP.md. */
export async function markAdded(ids) {
  const { error } = await call('digest_mark_added', { p_ids: ids });
  return error ? stateOf(error) : null;
}

const readAdmin = () => { try { return JSON.parse(localStorage.getItem(ADMIN)) || null; } catch { return null; } };

/**
 * Whether the signed-in account may open the digest, for the Settings row. Remembered on this phone
 * per account so the row doesn't pop in late; the server asks again each time Settings opens.
 */
export function useDigestAdmin() {
  const acct = useAccount();
  const uid = acct.user?.id || null;
  const [admin, setAdmin] = useState(() => { const a = readAdmin(); return !!(uid && a?.uid === uid && a.on); });
  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    call('digest_is_admin', {}).then(({ data, error }) => {
      if (!live || error) return;
      const on = data === true;
      setAdmin(on);
      try { localStorage.setItem(ADMIN, JSON.stringify({ uid, on })); } catch { /* storage blocked */ }
    }).catch(() => {});
    return () => { live = false; };
  }, [uid]);
  return !!uid && admin;
}
