// What one of the app's links points at, read from its address: a round (?join=CODE), a plan
// (?plan=CODE, &p=WHO for one person's own), a challenge (?challenge=CODE) or a captain's draft
// (?draft=TRIP&c=0|1). Routing Middleware uses it to send link-preview bots to api/join.js, which
// uses it again to look the thing up. No imports, so the middleware stays small.

const code = v => {
  const s = String(v ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(s) ? s : null;
};
const tripId = v => {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
};
const who = v => {
  const s = String(v ?? '').trim();
  return s && s.length <= 64 && /^[\w-]+$/.test(s) ? s : null;
};

/**
 * { kind: 'join', code } | { kind: 'plan', code, who } | { kind: 'challenge', code } |
 * { kind: 'draft', tripId, seat } from a URLSearchParams or a query string, or null. A join link
 * wins when a link somehow has two, the way the app opens it.
 */
export function linkTarget(params) {
  let q;
  try { q = params instanceof URLSearchParams ? params : new URLSearchParams(params || ''); } catch { return null; }
  const join = code(q.get('join'));
  if (join) return { kind: 'join', code: join };
  const plan = code(q.get('plan'));
  if (plan) return { kind: 'plan', code: plan, who: who(q.get('p')) };
  const challenge = code(q.get('challenge'));
  if (challenge) return { kind: 'challenge', code: challenge };
  const draft = tripId(q.get('draft'));
  if (draft) return { kind: 'draft', tripId: draft, seat: q.get('c') === '1' ? 1 : 0 };
  return null;
}

/** The query string for a target, as the app's own link writes it ("join=AB12CD"). */
export function targetQuery(t) {
  if (!t) return '';
  if (t.kind === 'join') return `join=${t.code}`;
  if (t.kind === 'plan') return `plan=${t.code}${t.who ? `&p=${encodeURIComponent(t.who)}` : ''}`;
  if (t.kind === 'challenge') return `challenge=${t.code}`;
  if (t.kind === 'draft') return `draft=${encodeURIComponent(t.tripId)}&c=${t.seat === 1 ? 1 : 0}`;
  return '';
}

/** Where middleware sends a preview bot for a target: "/api/join?plan=AB12CD". */
export const previewApiPath = t => (t ? `/api/join?${targetQuery(t)}` : null);

/** The link itself, for og:url: "https://…/?plan=AB12CD". */
export const targetUrl = (origin, t) => (t ? `${origin}/?${targetQuery(t)}` : `${origin}/`);
