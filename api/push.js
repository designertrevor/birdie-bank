// Web push: the app asks for one of its pushes here (a round or plan invite, who's in, a round
// finished, someone paid you), fire and forget. The caller must be signed in: their Supabase access
// token says who they are, and the database only sends when they're on that round or plan too, and
// only to the others on it, with rate limits (push_targets in supabase/2026-10-08-push.sql). What a
// push says is built here from a fixed template (src/lib/push-events.js), never taken as given.
//
// Off, answering 204 and sending nothing, until VAPID_PRIVATE_KEY, VAPID_SUBJECT and
// SUPABASE_SERVICE_ROLE_KEY are set (src/lib/push-server.js). Make the VAPID keys once with:
//   node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log('VITE_VAPID_PUBLIC_KEY='+c.getPublicKey('base64url')+'\nVAPID_PRIVATE_KEY='+c.getPrivateKey('base64url'))"
import { cleanPushRequest } from '../src/lib/push-events.js';
import { handlePush, pushConfig } from '../src/lib/push-server.js';

// Vercel only hands .env.production to the build, so fall back to the public values the app ships with (as api/join.js does)
const env = () => ({
  VITE_SUPABASE_URL: 'https://yffribkjqvkncmypexfa.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_pLszQwInfvryXP7352OMyQ_rcYSVjtx',
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)),
});

const empty = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(request) {
    if (request.method !== 'POST') return empty(405);
    const cfg = pushConfig(env());
    if (!cfg) return empty(204);
    let body = null;
    try {
      const text = await request.text();
      if (text.length <= 4000) body = JSON.parse(text);
    } catch { body = null; }
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const { status } = await handlePush(cfg, token, cleanPushRequest(body));
    return empty(status);
  },
};
