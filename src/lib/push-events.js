// The pushes: what the app asks the server to send (api/push.js), who each one goes to, and
// what it says. Shared by the app and the server, so both read a request the same way.
// Pure functions of plain data, so they're easy to test. No storage, no network.
//
// A request: { kind, scope: 'round' | 'plan' | 'challenge', code, players?, topic?, results?, data: { name, day, course, status } }
//   invite    a round or plan you share: everyone on it with an account, but you
//   rsvp      you answered a plan: its organizer
//   finished  you finished a shared round: everyone in it, but you. With `results` (seat id: 'won',
//             'lost', 'square' or a place, never an amount), each person's push says how they did
//   paid      you marked a payment: the person you paid (players: [their seat in the round])
//   carry     you asked to roll a balance to next time: the other person, to agree (players: [their seat])
//   talk      you posted trash talk on a round, plan or challenge: everyone on it, but you. Never
//             what you wrote, only that you wrote something, and at most one every 10 minutes
//   tee       the tee time reminder: the plan's organizer, sent by the daily job, never by the app
// Who counts as "on it" is the server's call (supabase/2026-10-08-push.sql push_targets): it only
// sends when the caller is on that round, plan or challenge too, and only to people on it.
//
// What a push says never has an amount in it: it shows on a lock screen, and money stays hidden
// unless you open the app (the same default as the results image).

export const PUSH_KINDS = {
  invite: { scopes: ['round', 'plan'], to: 'all' },
  rsvp: { scopes: ['plan'], to: 'host' },
  finished: { scopes: ['round'], to: 'all' },
  paid: { scopes: ['round'], to: 'players' },
  carry: { scopes: ['round'], to: 'players' },
  talk: { scopes: ['round', 'plan', 'challenge'], to: 'all' },
  tee: { scopes: ['plan'], to: 'host', server: true },
};

const CODE = /^[A-Z0-9]{4,8}$/;
const ID = /^[\w-]{1,64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['in', 'maybe', 'out'];
const RESULTS = ['won', 'lost', 'square'];
/** The most seats a round finished push carries results for; a bigger map is dropped whole. */
export const MAX_RESULTS = 32;

/** Short plain text for a push: no control characters, single spaces, at most `max` characters. */
export function pushText(v, max = 40) {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim(); // eslint-disable-line no-control-regex
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

/**
 * A request as the server accepts it from the app, or null. Only the kinds above, a real code, and
 * short plain text; `to` comes from the kind, never from the request. The tee reminder only ever
 * comes from the daily job.
 */
export function cleanPushRequest(body, { fromServer = false } = {}) {
  if (!body || typeof body !== 'object') return null;
  const spec = PUSH_KINDS[body.kind];
  if (!spec || (spec.server && !fromServer)) return null;
  if (!spec.scopes.includes(body.scope)) return null;
  const code = String(body.code || '').toUpperCase();
  if (!CODE.test(code)) return null;
  const players = Array.isArray(body.players) ? [...new Set(body.players.map(String).filter(p => ID.test(p)))].slice(0, 8) : [];
  if (spec.to === 'players' && !players.length) return null;
  const d = body.data && typeof body.data === 'object' ? body.data : {};
  const data = {};
  const name = pushText(d.name, 24);
  if (name) data.name = name;
  if (DATE.test(d.day || '')) data.day = d.day;
  const course = pushText(d.course, 48);
  if (course) data.course = course;
  if (STATUSES.includes(d.status)) data.status = d.status;
  if (body.kind === 'rsvp' && !data.status) return null;
  const out = {
    kind: body.kind, scope: body.scope, code, to: spec.to,
    players: spec.to === 'players' ? players : [],
    topic: pushText(body.topic, 120),
    data,
  };
  if (body.kind === 'finished') {
    const results = cleanResults(body.results);
    if (results) out.results = results;
  }
  return out;
}

/**
 * A round finished push's results as the server accepts them, or null: a plain object of at most
 * MAX_RESULTS seat ids, each 'won', 'lost', 'square' or a whole place from 1 to MAX_RESULTS.
 * Anything else in it is dropped, so no free text or amount ever gets through.
 */
export function cleanResults(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const entries = Object.entries(v);
  if (!entries.length || entries.length > MAX_RESULTS) return null;
  const out = {};
  for (const [seat, r] of entries) {
    if (!ID.test(seat)) continue;
    if (RESULTS.includes(r)) out[seat] = r;
    else if (Number.isInteger(r) && r >= 1 && r <= MAX_RESULTS) out[seat] = r === 1 ? 'won' : r;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Each seat's result in a finished round from its balances (money, points or the reward's points),
 * for the round finished push: the top 'won' (all of them on a tie), anyone else up their place,
 * 'square' at even and 'lost' when down. Never the amounts. {} with fewer than two seats or more
 * than MAX_RESULTS.
 */
export function finishResults(balances, ids) {
  const list = [...new Set(ids || [])].map(id => [id, Math.round((Number(balances?.[id]) || 0) * 100)]);
  if (list.length < 2 || list.length > MAX_RESULTS) return {};
  const out = {};
  for (const [id, v] of list) {
    if (v === 0) out[id] = 'square';
    else if (v < 0) out[id] = 'lost';
    else {
      const place = 1 + list.filter(([, w]) => w > v).length;
      out[id] = place === 1 ? 'won' : place;
    }
  }
  return out;
}

/** One person's result from a request's results, by the seats the server knows are theirs, or null. */
export function recipientResult(results, seats) {
  if (!results || !Array.isArray(seats)) return null;
  for (const seat of seats) if (typeof seat === 'string' && Object.hasOwn(results, seat)) return results[seat];
  return null;
}

/** 2nd, 3rd, 11th, 22nd. */
export function ordinal(n) {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Saturday" for a YYYY-MM-DD day, or '' (the day as written, wherever the server is). */
export function weekday(iso) {
  if (!DATE.test(iso || '')) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(t.getTime()) ? '' : WEEKDAYS[t.getUTCDay()];
}

/** Where tapping the push opens: the plan, the round or the challenge by its link, or Up next (the Tab's pushes). */
export function pushUrl(req) {
  if (req.kind === 'paid' || req.kind === 'carry') return '/';
  if (req.scope === 'challenge') return `/?challenge=${req.code}`;
  return req.scope === 'plan' ? `/?plan=${req.code}` : `/?join=${req.code}`;
}

const when = data => [weekday(data.day), data.course].filter(Boolean).join(' at ');

/**
 * What the push says: { title, body, url, tag }. `tag` groups them, so a second push about the same
 * round or plan replaces the first on the lock screen instead of piling up. `result` is the
 * recipient's own result for a round finished push (recipientResult), chosen per person by the server.
 */
export function pushPayload(req, { result = null } = {}) {
  const { kind, data = {} } = req;
  const who = data.name || 'Someone';
  const at = when(data);
  let title; let body;
  switch (kind) {
    case 'invite':
      if (req.scope === 'plan') {
        title = `${who} invited you to play`;
        body = `${at || 'A round coming up'}. Tap to say if you’re in.`;
      } else {
        title = `${who} started a round with you`;
        body = `${data.course || 'The round is live'}. Tap to follow the scores.`;
      }
      break;
    case 'rsvp':
      title = `${who} ${data.status === 'in' ? 'is in' : data.status === 'maybe' ? 'is a maybe' : 'is out'}`;
      body = at ? `For ${at}.` : 'For your round coming up.';
      break;
    case 'finished':
      if (result === 'won') {
        title = data.course ? `You won the ${data.course} round` : 'You won the round';
        body = 'See how everyone did.';
      } else if (result === 'square' || (Number.isInteger(result) && result > 1)) {
        title = result === 'square' ? 'You finished square' : `You finished ${ordinal(result)}`;
        body = `${data.course ? `${data.course}: ` : ''}see how everyone did.`;
      } else {
        // Down, or no result for you: no rubbing it in
        title = 'Round finished';
        body = `${data.course ? `${data.course}: ` : ''}see how everyone did.`;
      }
      break;
    case 'paid':
      title = `${who} paid you`;
      body = 'It’s marked paid on the Tab.';
      break;
    case 'carry':
      title = `${who} asked to roll it to next time`;
      body = 'Agree, or say you’d rather get paid, on the Tab.';
      break;
    case 'talk':
      title = 'New trash talk';
      body = `${who} posted on ${req.scope === 'challenge' ? 'your challenge' : req.scope === 'plan' ? (at ? `the round ${at}` : 'your round coming up') : data.course ? `the ${data.course} round` : 'your round'}. Tap to read it.`;
      break;
    case 'tee':
      title = 'Book your tee time';
      body = `${at || 'Your round coming up'}. Tee times fill up, so grab one.`;
      break;
    default:
      return null;
  }
  return { title, body, url: pushUrl(req), tag: `${req.scope}-${req.code}-${kind}` };
}

/** A key for one push, so the app never asks for the same one twice in a session. */
export function pushKey(req) {
  return [req.kind, req.scope, req.code, req.topic || '', (req.players || []).join('.')].join('|');
}

/**
 * The "paid you" pushes for payment rows just marked on the shared Tab (tab-sync.js): one per
 * person paid, and only when the payer marked it themselves (not "I got it", and not a third
 * phone marking two other people square).
 */
export function paidPushes(rows, name = '') {
  const out = [];
  const seen = new Set();
  for (const r of rows || []) {
    if (r?.kind !== 'payment' || r.status !== 'paid' || !r.code || !r.to || !r.by || r.by !== r.from || seen.has(r.to)) continue;
    seen.add(r.to);
    out.push({ kind: 'paid', scope: 'round', code: r.code, players: [r.to], topic: r.id, data: { name } });
  }
  return out;
}

/**
 * The "roll it to next time" pushes for carry-over rows just asked for on the shared Tab
 * (tab-sync.js): one per person asked, and only when one of the two asked it themselves. A carry
 * split over several rounds is one push. The topic is the ask's moment, so asking again after
 * taking one back is a new push.
 */
export function carryPushes(rows, name = '') {
  const out = [];
  const seen = new Set();
  for (const r of rows || []) {
    if (r?.kind !== 'carry' || r.status !== 'asked' || !r.code || !r.from || !r.to || !r.by) continue;
    if (r.by !== r.from && r.by !== r.to) continue;
    const other = r.by === r.from ? r.to : r.from;
    if (seen.has(other)) continue;
    seen.add(other);
    out.push({ kind: 'carry', scope: 'round', code: r.code, players: [other], topic: `${r.from}>${r.to}@${r.at || ''}`, data: { name } });
  }
  return out;
}

/**
 * The "new trash talk" push for a comment just posted in a thread whose target is `t` (talk-sync.js
 * threadTarget: { scope, code }), or null when the thread can't reach anyone yet. `id` is the
 * comment's, so each one is asked for; the server sends at most one every 10 minutes per thread.
 */
export function talkPush(t, { id, name = '', course = '', day = '' } = {}) {
  if (!t?.code || !['round', 'plan', 'challenge'].includes(t.scope) || !id) return null;
  const data = { name };
  if (course && t.scope !== 'challenge') data.course = course;
  if (day && t.scope === 'plan') data.day = day;
  return { kind: 'talk', scope: t.scope, code: t.code, topic: String(id), data };
}
