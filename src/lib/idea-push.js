// "The game you asked for is live" as a push: once a day (api/push-ideas.js, vercel.json crons) the
// server finds ideas sent in through Suggest something (a game, a course or a feature) that have
// shipped and whose sender hasn't had a push about it yet, and sends one. An idea ships either on
// its own (Trevor sets roadmap_status = 'shipped' and shipped_on on its feedback row) or with the
// roadmap item it was folded into (a checked line in ROADMAP.md, with its date). The database picks
// the rows and stamps each one sent, so it never goes twice (push_ideas_due in
// supabase/2026-10-12-idea-push.sql); this file says which roadmap items count and what the push says.
// Pure functions of plain data, so they're easy to test. No storage, no network.
import { pushText } from './push-events.js';
import { ASKED_LINE } from './roadmap.js';

/** A push only for something that shipped in the last this-many days, so a late first run doesn't dig up old news. */
export const IDEA_PUSH_DAYS = 14;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM = /^r-[a-z0-9-]{1,78}$/;
const DAY = 86400000;
const KINDS = ['game', 'course', 'feature'];

const dayMs = iso => (DATE.test(iso || '') ? Date.parse(`${iso}T00:00:00Z`) : NaN);

/**
 * Whether a ship date counts on `today` (both YYYY-MM-DD): on or before today (a day ahead allowed,
 * for a date written in another time zone) and no more than `days` back.
 */
export function freshShip(shipped, today, days = IDEA_PUSH_DAYS) {
  const s = dayMs(shipped);
  const t = dayMs(today);
  if (!Number.isFinite(s) || !Number.isFinite(t)) return false;
  return s <= t + DAY && t - s <= days * DAY;
}

/**
 * The ROADMAP.md items an idea can ship with, for the database: [{ id, title, shipped }], only
 * shipped ones with a fresh date (publicRoadmap's items, so only public titles ever go out).
 * At most 200, newest first.
 */
export function shippedItems(items, today, days = IDEA_PUSH_DAYS) {
  return (Array.isArray(items) ? items : [])
    .filter(i => i && i.status === 'shipped' && ITEM.test(String(i.id || '')) && freshShip(i.shipped, today, days))
    .map(i => ({ id: i.id, title: pushText(i.title, 60), shipped: i.shipped }))
    .sort((a, b) => b.shipped.localeCompare(a.shipped))
    .slice(0, 200);
}

const andList = words => (words.length < 2 ? words[0] || '' : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

const ONE_BODY = {
  game: t => (t ? `${t} is ready for your next round.` : 'It’s ready for your next round.'),
  course: t => (t ? `${t} is ready to pick for your next round.` : 'It’s ready to pick for your next round.'),
  feature: t => (t ? `${t} is in the app now. Thanks for the idea.` : 'It’s in the app now. Thanks for the idea.'),
};

/**
 * What the push says for one person's shipped ideas ([{ kind, title }], as many as shipped for them
 * today): { title, body, url, tag }, or null for none. One idea gets the same line as the "It
 * shipped" note on Up next; several make one push, so nobody gets a pile. Tapping opens Up next,
 * where that note is waiting.
 */
export function ideaPayload(ideas) {
  const list = (Array.isArray(ideas) ? ideas : []).filter(i => i && typeof i === 'object')
    .map(i => ({ kind: KINDS.includes(i.kind) ? i.kind : 'feature', title: pushText(i.title, 48) }));
  if (!list.length) return null;
  let title; let body;
  if (list.length === 1) {
    const [one] = list;
    title = ASKED_LINE[one.kind];
    body = ONE_BODY[one.kind](one.title);
  } else {
    const kinds = new Set(list.map(i => i.kind));
    const only = kinds.size === 1 ? list[0].kind : null;
    title = only === 'game' ? `${list.length} games you asked for are live`
      : only === 'course' ? `${list.length} courses you asked for are in`
        : `${list.length} things you asked for are live`;
    const names = [...new Set(list.map(i => i.title).filter(Boolean))];
    body = names.length === list.length ? pushText(`${andList(names)} are in the app now.`, 140) : 'Tap to see what shipped.';
  }
  return { title, body, url: '/', tag: 'idea-shipped' };
}

/**
 * The pushes for the rows push_ideas_due hands back ({ feedback_id, idea_kind, idea_title, to_user,
 * push_endpoint, push_p256dh, push_auth }, one per idea per subscription): one push per person,
 * covering every idea of theirs that shipped, to each of their subscriptions once.
 * Returns [{ user, payload, rows }].
 */
export function ideaPushes(rows) {
  const people = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.to_user || !r.push_endpoint) continue;
    if (!people.has(r.to_user)) people.set(r.to_user, { ideas: new Map(), subs: new Map() });
    const p = people.get(r.to_user);
    const key = String(r.feedback_id || `${r.idea_kind}|${r.idea_title}`);
    if (!p.ideas.has(key)) p.ideas.set(key, { kind: r.idea_kind, title: r.idea_title });
    if (!p.subs.has(r.push_endpoint)) p.subs.set(r.push_endpoint, r);
  }
  const out = [];
  for (const [user, p] of people) {
    const payload = ideaPayload([...p.ideas.values()]);
    if (payload) out.push({ user, payload, rows: [...p.subs.values()] });
  }
  return out;
}
