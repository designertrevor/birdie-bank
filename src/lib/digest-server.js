// The Monday digest push to Trevor (api/push-digest.js): how many ideas from the week still wait for a
// call, sent to each admin's phones through the same web push code as every other push. Server only.
// `fetch` is passed in, so tests run it with no network.
import { sendAll } from './push-server.js';
import { digestPush } from './digest.js';

/** Each admin's subscriptions with the week's waiting count (push_digest_due). [] when the SQL hasn't run or it fails. */
export async function digestDue(cfg, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${cfg.url}/rest/v1/rpc/push_digest_due`, {
      method: 'POST',
      headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

/** Send the Monday push. Returns how many went. Nothing waiting, nothing sent. */
export async function handleDigest(cfg, fetchImpl = fetch) {
  if (!cfg) return 0;
  const rows = await digestDue(cfg, fetchImpl);
  if (!rows.length) return 0;
  const payload = digestPush(Math.max(...rows.map(r => Number(r.waiting) || 0)));
  if (!payload) return 0;
  return (await sendAll(cfg, rows, payload, { topic: 'digest', fetchImpl })).sent;
}
