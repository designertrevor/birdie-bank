// "The game you asked for is live" as a push: once a day (vercel.json crons) this tells each person
// whose idea (a game, a course or a feature sent in through Suggest something) has shipped, once per
// idea (push_ideas_due in supabase/2026-10-12-idea-push.sql stamps it sent). Up next still shows the
// "It shipped" note as before. Someone who switched "Your ideas" off in Settings is left out.
//
// An idea ships on its own (its feedback row set to shipped, with shipped_on) or with the roadmap
// item it was folded into: a checked line in ROADMAP.md, read here from the deployed copy and cut
// down to the public list (roadmap-public.js), so only public titles and ids reach the database.
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". Off, answering 204 and sending
// nothing, until CRON_SECRET is set and push is on (see api/push.js for the rest), and sending
// nothing until the SQL has run. The day is the one in the US, as in api/push-tee.js.
import { readFileSync } from 'node:fs';
import { handleIdeas, pushConfig } from '../src/lib/push-server.js';
import { publicRoadmap } from '../src/lib/roadmap-public.js';
import { shippedItems } from '../src/lib/idea-push.js';

const env = () => ({
  VITE_SUPABASE_URL: 'https://yffribkjqvkncmypexfa.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx',
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)),
});

const empty = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

/** The roadmap items shipped lately, or [] when the file isn't there (ideas shipped on their own still go). */
function roadmapShipped(today) {
  try {
    return shippedItems(publicRoadmap(readFileSync(new URL('../ROADMAP.md', import.meta.url), 'utf8')), today);
  } catch { return []; }
}

export default {
  async fetch(request) {
    const e = env();
    if (!e.CRON_SECRET) return empty(204);
    if (request.headers.get('authorization') !== `Bearer ${e.CRON_SECRET}`) return empty(401);
    const cfg = pushConfig(e);
    if (!cfg) return empty(204);
    const today = new Date(Date.now() - 7 * 3600000).toISOString().slice(0, 10);
    await handleIdeas(cfg, today, roadmapShipped(today));
    return empty(204);
  },
};
