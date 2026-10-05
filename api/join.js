// Round-specific link previews for join links (https://birdie-bank.vercel.app/?join=CODE).
// vercel.json sends only link-preview bots here (iMessage, WhatsApp, Slack and friends), so
// people opening the link never wait on this. It reads the shared round with the public anon
// key (the same one the app ships with; a round is readable by its code, sent in the x-round-code
// header the way the app sends it, see supabase/2026-10-06-round-codes.sql) and swaps the round's
// game, course and players into the page's preview tags. Anything goes wrong: the plain page.
import { cleanCode } from '../src/lib/sync-model.js';
import { injectMeta, joinPreview } from '../src/lib/og.js';

// Vercel only hands .env.production to the build, not to functions at runtime, so fall back to
// the same public values the app ships with.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://yffribkjqvkncmypexfa.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx';

async function roundMeta(code) {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const url = `${SUPABASE_URL}/rest/v1/live_rounds?select=meta&code=eq.${encodeURIComponent(code)}&limit=1`;
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'x-round-code': code }, signal: AbortSignal.timeout(2500) });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.meta || null;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const code = cleanCode(url.searchParams.get('code') || url.searchParams.get('join'));
    const plain = new URL(code ? `/index.html?join=${code}` : '/index.html', url.origin);
    try {
      const pageRes = await fetch(new URL('/index.html', url.origin), { signal: AbortSignal.timeout(2500) });
      if (!pageRes.ok) throw new Error(`index.html ${pageRes.status}`);
      let html = await pageRes.text();
      const preview = code ? joinPreview(await roundMeta(code).catch(() => null)) : null;
      if (preview) html = injectMeta(html, { ...preview, url: `${url.origin}/?join=${code}` });
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
