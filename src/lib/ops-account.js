// Once someone signs in (ops.js loads this after the first paint): save the creator code to their
// account, once (attribution.js), and let usage counts follow the account across phones by a hash
// of its id, never the email. Signing out starts a fresh anonymous id.
import { accountNow, accountsEnabled, onAccount } from './cloud.js';
import { getSupabase } from './supabase.js';
import { saveAttribution } from './attribution.js';
import { identify, reset } from './analytics.js';

/** A one-way hash of the account id: the same on every phone, and it can't be turned back into the id. */
async function opaqueId(id) {
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bb-usage:${id}`));
    return [...new Uint8Array(bytes)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export function watchAccount({ withAnalytics }) {
  if (!accountsEnabled) return;
  let who = null;
  const check = async () => {
    const id = accountNow().user?.id || null;
    if (id === who) return;
    const was = who;
    who = id;
    if (!id) { if (was && withAnalytics) reset(); return; }
    if (withAnalytics) { const hashed = await opaqueId(id); if (hashed) identify(hashed); }
    const db = await getSupabase().catch(() => null);
    await saveAttribution({ db, userId: id, storage: localStorage });
  };
  onAccount(() => { check().catch(() => {}); });
  check().catch(() => {});
}
