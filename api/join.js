// Link previews for the app's links: a round's (https://birdie-bank.vercel.app/?join=CODE), a
// plan's (?plan=CODE, &p=WHO), a challenge's (?challenge=CODE) and a captain's draft (?draft=TRIP).
// Middleware sends only link-preview bots here (iMessage, WhatsApp, Slack and friends), so people
// opening the link never wait on this. It reads the round, plan or challenge with the public anon
// key (the same one the app ships with), naming its code in the header the app sends for it
// (x-round-code, x-plan-code or x-challenge-code, see supabase/2026-10-06-round-codes.sql), and
// swaps what it is into the page's preview tags. Anything goes wrong: the plain page.
import { cleanCode } from '../src/lib/sync-model.js';
import { challengePreview, draftPreview, injectMeta, joinPreview, planPreview } from '../src/lib/og.js';
import { linkTarget, targetQuery, targetUrl } from '../src/lib/link-target.js';

// Vercel only hands .env.production to the build, not to functions at runtime, so fall back to
// the same public values the app ships with.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx';

// Each kind of link: its table and the header that names its code
const LOOKUP = {
  join: { table: 'live_rounds', header: 'x-round-code' },
  plan: { table: 'planned_rounds', header: 'x-plan-code' },
  challenge: { table: 'challenges', header: 'x-challenge-code' },
};

/** The meta of the round, plan or challenge with this code, or null. */
async function metaFor(kind, code) {
  const l = LOOKUP[kind];
  if (!l || !SUPABASE_URL || !ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/${l.table}?select=meta&code=eq.${encodeURIComponent(code)}&limit=1`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, [l.header]: code }, signal: AbortSignal.timeout(2500) });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.meta || null;
}

/** The preview text for a link, or null to keep the page's own. */
export async function previewFor(target, lookup = metaFor) {
  if (!target) return null;
  if (target.kind === 'draft') return draftPreview();
  const meta = await lookup(target.kind, target.code).catch(() => null);
  if (target.kind === 'join') return joinPreview(meta);
  if (target.kind === 'plan') return planPreview(meta, target.who);
  if (target.kind === 'challenge') return challengePreview(meta);
  return null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Older middleware sent ?code= for a join link
    const old = cleanCode(url.searchParams.get('code'));
    const target = linkTarget(url.searchParams) || (old ? { kind: 'join', code: old } : null);
    const query = targetQuery(target);
    const plain = new URL(query ? `/index.html?${query}` : '/index.html', url.origin);
    try {
      const pageRes = await fetch(new URL('/index.html', url.origin), { signal: AbortSignal.timeout(2500) });
      if (!pageRes.ok) throw new Error(`index.html ${pageRes.status}`);
      let html = await pageRes.text();
      const preview = await previewFor(target);
      if (preview) html = injectMeta(html, { ...preview, url: targetUrl(url.origin, target) });
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        },
      });
    } catch {
      // The static page carries the default preview card
      return Response.redirect(plain.toString(), 307);
    }
  },
};
