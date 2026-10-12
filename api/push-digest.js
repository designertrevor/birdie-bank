// The weekly feedback digest push: every Monday (vercel.json crons) this tells Trevor how many ideas
// from the week wait for a yes or a no, and opens the Digest screen (?digest). Only accounts in
// app_admins get it (push_digest_due in supabase/2026-10-12-feedback-digest.sql), and only when at
// least one idea waits.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Off, answering 204 and sending
// nothing, until CRON_SECRET is set and push is on (see api/push.js for the rest).
import { pushConfig } from '../src/lib/push-server.js';
import { handleDigest } from '../src/lib/digest-server.js';

const env = () => ({
  VITE_SUPABASE_URL: 'https://yffribkjqvkncmypexfa.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx',
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)),
});

const empty = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request) {
    const e = env();
    if (!e.CRON_SECRET) return empty(204);
    if (request.headers.get('authorization') !== `Bearer ${e.CRON_SECRET}`) return empty(401);
    const cfg = pushConfig(e);
    if (!cfg) return empty(204);
    await handleDigest(cfg);
    return empty(204);
  },
};
