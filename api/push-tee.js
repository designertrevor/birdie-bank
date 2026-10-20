// The tee time reminder as a push: every hour (vercel.json crons, "0 * * * *") this sends "Book
// your tee time" to the organizer of each plan whose reminder day has come and that isn't booked
// yet, in the hour their own clock reads 8 (the zone their newest phone saved, push-zones.js), once
// per plan (push_tee_due in supabase/2026-10-20-push-timezones.sql). Up next still shows the card.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Off, answering 204 and sending
// nothing, until CRON_SECRET is set and push is on (see api/push.js for the rest).
// "Today" is the organizer's own day, the same day their phone shows the card.
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
    await handleTee(cfg, new Date());
    return empty(204);
  },
};
