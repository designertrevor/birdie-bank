// The tee time reminder as a push: once a day (vercel.json crons) this sends "Book your tee time"
// to the organizer of each plan whose reminder day has come and that isn't booked yet, once per
// plan (push_tee_due in supabase/2026-10-08-push.sql). Up next still shows the card as before.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Off, answering 204 and sending
// nothing, until CRON_SECRET is set and push is on (see api/push.js for the rest).
// The day is the one in the US (Vercel runs it at 15:00 UTC, the morning there), the same day a
// phone in the US shows the card.
import { handleTee, pushConfig } from '../src/lib/push-server.js';

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
    const today = new Date(Date.now() - 7 * 3600000).toISOString().slice(0, 10);
    await handleTee(cfg, today);
    return empty(204);
  },
};
