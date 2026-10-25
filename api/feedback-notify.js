// An email for each "Suggest something" message, so feedback doesn't sit unseen in the table.
// Supabase calls this from a Database Webhook on inserts into public.feedback (Dashboard, Database,
// Webhooks: table feedback, event Insert, HTTP POST to https://birdie-bank.vercel.app/api/feedback-notify,
// with an HTTP header x-webhook-secret set to FEEDBACK_WEBHOOK_SECRET).
//
// Sends through Resend (resend.com). Set in Vercel's environment variables:
//   RESEND_API_KEY           the API key
//   FEEDBACK_EMAIL           where it goes (on Resend's free plan without a domain, the account's own email)
//   FEEDBACK_WEBHOOK_SECRET  any long random string, the same one as in the webhook's header
//   FEEDBACK_FROM            optional, once there's a domain; the default is Resend's test sender
// Off, answering 204 and sending nothing, until all three are set.
//
// One-tap reactions ("Great", "Just OK") don't email unless they come with words.

const DASHBOARD = 'https://supabase.com/dashboard/project/yffribkjqvkncmypexfa';
const LABELS = { bug: 'Something’s broken', feature: 'A feature', game: 'A new game', course: 'A course', reaction: 'After the round' };

const empty = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The email for one feedback row: { subject, html, text }. Exported for a quick look in tests. */
export function feedbackEmail(row) {
  const kind = LABELS[row.kind] || row.kind;
  const ctx = row.context || {};
  const r = ctx.round;
  const details = Object.entries(row.details || {}).filter(([, v]) => v != null && v !== '');
  const errors = Array.isArray(ctx.errors) ? ctx.errors.slice(-3) : [];
  const lines = [
    `${kind}${row.contact ? ` from ${row.contact}` : ''}`,
    '',
    row.body || '(no message)',
    '',
    ...details.map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`),
    r ? `Round: ${r.gameName || r.game} at ${r.course || 'a course'}, ${r.players} players, hole ${Number(r.current) + 1} of ${r.holes}, ${r.status}${r.shared ? `, shared ${r.shared}` : ', not shared'}` : '',
    ...errors.map(e => `Error (${e.where}, ${e.at}): ${e.message}${e.code ? ` [${e.code}]` : ''}${e.status ? ` HTTP ${e.status}` : ''}${e.details ? `, ${e.details}` : ''}${e.online === false ? ', offline' : ''}`),
    `App: ${ctx.app || ''}${ctx.path || ''}, ${ctx.screen || ''}, ${ctx.installed ? 'installed' : 'browser'}`,
    `Phone: ${ctx.userAgent || ''}`,
    row.screenshot_path ? `Screenshot: ${DASHBOARD}/storage/buckets/feedback (${row.screenshot_path})` : '',
    `All feedback: ${DASHBOARD}/editor (table feedback)`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
  const text = lines.join('\n');
  const first = String(row.body || '').replace(/\s+/g, ' ').slice(0, 60);
  return {
    subject: `Birdie Bank feedback: ${kind}${first ? `, “${first}”` : ''}`,
    text,
    html: `<pre style="font: 14px/1.5 -apple-system, sans-serif; white-space: pre-wrap">${esc(text)}</pre>`,
  };
}

export default {
  async fetch(request) {
    const { RESEND_API_KEY: key, FEEDBACK_EMAIL: to, FEEDBACK_WEBHOOK_SECRET: secret, FEEDBACK_FROM: from } = process.env;
    if (!key || !to || !secret) return empty(204);
    if (request.method !== 'POST') return empty(405);
    if (request.headers.get('x-webhook-secret') !== secret) return empty(401);
    let payload;
    try { payload = await request.json(); } catch { return empty(400); }
    const row = payload?.record;
    if (payload?.type !== 'INSERT' || !row) return empty(204);
    if (row.kind === 'reaction' && !Object.values(row.details || {}).some(v => typeof v === 'string' && v.trim() && v !== row.details?.reaction)) return empty(204);
    const mail = feedbackEmail(row);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from || 'Birdie Bank <onboarding@resend.dev>', to: [to], subject: mail.subject, text: mail.text, html: mail.html, ...(row.contact && /@/.test(row.contact) ? { reply_to: row.contact } : {}) }),
    });
    // A failure answers 502 so Supabase's webhook log shows it
    return empty(res.ok ? 204 : 502);
  },
};
