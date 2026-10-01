// One Supabase client for the whole app: live rounds, accounts, cloud data and feedback.
import { deviceSecret } from './device.js';
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(URL_ && KEY_);
/** The project URL, for telling the app's own storage links apart (avatars.js photoAllowed). */
export const supabaseUrl = supabaseConfigured ? URL_ : null;

let clientPromise = null;
/** Resolves to the client, or null when no Supabase keys are set (npm run dev without .env.local). */
export function getSupabase() {
  if (!supabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_, KEY_, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'bb-auth' },
      // This phone's device key, so the server can tell the scorekeeper's phone (supabase/2026-09-30-keeper-lock.sql)
      global: { headers: { 'x-bb-device': deviceSecret() } },
    }));
  }
  return clientPromise;
}
