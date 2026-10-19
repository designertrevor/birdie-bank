// Once someone signs in (ops.js loads this after the first paint): save the creator code to their
// account, once (attribution.js), and let usage counts follow the account across phones by a hash
// of its id, never the email. Signing out starts a fresh anonymous id.
import { accountNow, accountsEnabled, onAccount } from './cloud.js';
import { getSupabase } from './supabase.js';
import { saveAttribution } from './attribution.js';
import { identify, reset, track } from './analytics.js';
import { getState } from './store.js';
import { takeSigningIn } from './usage-role.js';

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
    if (withAnalytics) {
      // identify links this phone's anonymous id to the account, so a guest's invite_opened and
      // seat_taken from before land on the same person (PostHog attributes past anonymous events
      // to the identified person, person_profiles 'identified_only' included). Before signed_in,
      // so that one is the account's
      const hashed = await opaqueId(id);
      if (hashed) identify(hashed);
      const signing = takeSigningIn();
      if (signing) {
        const roundsDone = Object.values(getState().rounds || {}).filter(r => r?.status === 'done').length;
        track('signed_in', { ...signing, rounds_done: roundsDone });
      }
    }
    const db = await getSupabase().catch(() => null);
    await saveAttribution({ db, userId: id, storage: localStorage });
  };
  onAccount(() => { check().catch(() => {}); });
  check().catch(() => {});
}
