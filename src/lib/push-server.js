// The server's side of push (api/push.js and api/push-tee.js): who's asking, who to send to, and
// sending. `fetch` is passed in, so tests run it with no network. Server only.
//
// Push is off (every call answers 204 and sends nothing) until all of these are set in Vercel:
//   VAPID_PRIVATE_KEY          the private half of the VAPID keys (never VITE_, it must stay secret)
//   VAPID_SUBJECT              mailto: or https: address the push services can reach us at
//   SUPABASE_SERVICE_ROLE_KEY  reads who's on a round or plan and their subscriptions (push_targets)
// and the app only asks for a push when VITE_VAPID_PUBLIC_KEY (the public half) is set at build.
import { okEndpoint, pushRequest, vapidKeys } from './web-push.js';
import { pushPayload, pushText } from './push-events.js';

/** The push settings from the environment, or null when push is off. */
export function pushConfig(env = {}) {
  const vapid = vapidKeys(env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!vapid || !serviceKey || !url || !anonKey) return null;
  // The app's public key must be the same pair, or browsers drop every push
  if (env.VITE_VAPID_PUBLIC_KEY && env.VITE_VAPID_PUBLIC_KEY !== vapid.publicKey) return null;
  return { vapid, serviceKey, url: url.replace(/\/$/, ''), anonKey };
}

/** The signed-in account behind a Supabase access token, or null. Asks Supabase, so a forged token gets nothing. */
export async function callerId(cfg, token, fetchImpl = fetch) {
  if (!token || token.length > 4096) return null;
  try {
    const res = await fetchImpl(`${cfg.url}/auth/v1/user`, { headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === 'string' && user.id ? user.id : null;
  } catch { return null; }
}

const service = cfg => ({ apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' });

/** Call one of the push functions as the service role. [] when it isn't there yet (the SQL hasn't run) or fails. */
async function rpc(cfg, name, args, fetchImpl) {
  try {
    const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: service(cfg), body: JSON.stringify(args), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

/**
 * The subscriptions to send a request to: the server checks the caller is on that round or plan,
 * picks who it goes to, leaves the caller out and applies the rate limits (push_targets).
 */
export function pushTargets(cfg, caller, req, fetchImpl = fetch) {
  return rpc(cfg, 'push_targets', {
    p_caller: caller, p_scope: req.scope, p_kind: req.kind, p_code: req.code,
    p_to: req.to, p_players: req.players, p_topic: req.topic,
  }, fetchImpl);
}

/** Plans whose tee time reminder is due today (`today` YYYY-MM-DD), each with its organizer's subscriptions. */
export function teeDue(cfg, today, fetchImpl = fetch) {
  return rpc(cfg, 'push_tee_due', { p_today: today }, fetchImpl);
}

/**
 * Send one payload to each subscription row ({ to_user, push_endpoint, push_p256dh, push_auth }).
 * A subscription the push service says is gone (404, 410) is deleted. Returns { sent, gone }.
 */
export async function sendAll(cfg, rows, payload, { topic = '', fetchImpl = fetch, now = Date.now() } = {}) {
  let sent = 0;
  const gone = [];
  await Promise.all(rows.map(async r => {
    const sub = { endpoint: r.push_endpoint, p256dh: r.push_p256dh, auth: r.push_auth };
    if (!okEndpoint(sub.endpoint)) return;
    try {
      const { url, init } = pushRequest(sub, payload, cfg.vapid, { topic, now });
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(5000) });
      if (res.status === 404 || res.status === 410) gone.push(r);
      else if (res.ok) sent++;
    } catch { /* one bad subscription never stops the rest */ }
  }));
  await Promise.all(gone.map(r => fetchImpl(
    `${cfg.url}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(r.to_user)}&endpoint=eq.${encodeURIComponent(r.push_endpoint)}`,
    { method: 'DELETE', headers: service(cfg), signal: AbortSignal.timeout(4000) },
  ).catch(() => {})));
  return { sent, gone: gone.length };
}

/** One request from the app, start to finish: { status, sent }. Never throws. */
export async function handlePush(cfg, token, req, fetchImpl = fetch) {
  if (!cfg) return { status: 204, sent: 0 };
  if (!req) return { status: 400, sent: 0 };
  const caller = await callerId(cfg, token, fetchImpl);
  if (!caller) return { status: 401, sent: 0 };
  const rows = await pushTargets(cfg, caller, req, fetchImpl);
  if (!rows.length) return { status: 204, sent: 0 };
  const { sent } = await sendAll(cfg, rows, pushPayload(req), { topic: `${req.kind}${req.code}`, fetchImpl });
  return { status: 204, sent };
}

/** The daily tee time reminders: one push per due plan to its organizer. Returns how many went. */
export async function handleTee(cfg, today, fetchImpl = fetch) {
  if (!cfg) return 0;
  const rows = await teeDue(cfg, today, fetchImpl);
  let sent = 0;
  for (const r of rows) {
    const payload = pushPayload({ kind: 'tee', scope: 'plan', code: r.plan_code, data: { day: r.plan_date, course: pushText(r.plan_course, 48) } });
    sent += (await sendAll(cfg, [r], payload, { topic: `tee${r.plan_code}`, fetchImpl })).sent;
  }
  return sent;
}
