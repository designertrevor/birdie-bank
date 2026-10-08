// Which pushes you get: the switches in Settings (Notifications, then Which ones), each covering
// one or more of the kinds in push-events.js. What's saved is the list of muted kinds, on your
// account (push_prefs, supabase/2026-10-08-push-prefs.sql, where push_targets and push_tee_due
// leave a muted kind out for you) and on this phone, so the switches show with no signal.
// Pure functions of plain data, so they're easy to test. No storage, no network.
import { PUSH_KINDS } from './push-events.js';

/** The switches, in the order they show, each with the kinds it covers. All on by default. */
export const PUSH_GROUPS = [
  { id: 'in', label: 'Who’s in', sub: 'Round and plan invites, and who answered yours', kinds: ['invite', 'rsvp'] },
  { id: 'talk', label: 'Trash talk', sub: 'Each comment on a round, plan or challenge you’re on', kinds: ['talk'] },
  { id: 'finished', label: 'Round finished', sub: 'A shared round is done, and how you did', kinds: ['finished'] },
  { id: 'pay', label: 'Payments', sub: 'Someone paid you, or asked to roll it to next time', kinds: ['paid', 'carry', 'carried'] },
  { id: 'tee', label: 'Tee time reminder', sub: 'A nudge to book, on the day you picked for a round you’re organizing', kinds: ['tee'] },
];

const KINDS = Object.keys(PUSH_KINDS);
/** The most kinds a muted list holds (every kind there is, with room for a few more). */
export const MAX_MUTED = 16;

/** A muted list as saved: only real kinds, each once, in the kinds' own order. Anything else is dropped. */
export function cleanMuted(v) {
  const set = new Set(Array.isArray(v) ? v.filter(k => typeof k === 'string') : []);
  return KINDS.filter(k => set.has(k)).slice(0, MAX_MUTED);
}

/** Whether a group's switch is on for `muted`: off as soon as any of its kinds is muted. */
export function groupOn(muted, groupId) {
  const g = PUSH_GROUPS.find(x => x.id === groupId);
  if (!g) return false;
  const m = new Set(cleanMuted(muted));
  return !g.kinds.some(k => m.has(k));
}

/** The muted list after flipping a group's switch: on clears all its kinds, off mutes all of them. */
export function setGroup(muted, groupId, on) {
  const g = PUSH_GROUPS.find(x => x.id === groupId);
  if (!g) return cleanMuted(muted);
  const set = new Set(cleanMuted(muted));
  for (const k of g.kinds) { if (on) set.delete(k); else set.add(k); }
  return cleanMuted([...set]);
}

/** Whether a push of `kind` should reach someone whose muted list is `muted`. */
export function allowed(muted, kind) {
  return !cleanMuted(muted).includes(kind);
}

/**
 * This phone's prefs and the account's, as one: whichever was saved last wins, and the account's
 * on a tie (it's the one the server reads). Either side may be missing. Returns { muted, at, from }
 * with `from` 'cloud' or 'local', so the caller knows whether the account still needs this phone's.
 * Local is { muted, at: ms }; cloud is { muted, updated_at: ISO } as the row comes back.
 */
export function mergePrefs(local, cloud) {
  const l = local && Array.isArray(local.muted) ? { muted: cleanMuted(local.muted), at: Number(local.at) || 0 } : null;
  const cAt = cloud?.updated_at ? Date.parse(cloud.updated_at) : 0;
  const c = cloud && Array.isArray(cloud.muted) ? { muted: cleanMuted(cloud.muted), at: Number.isNaN(cAt) ? 0 : cAt } : null;
  if (!l && !c) return { muted: [], at: 0, from: 'cloud' };
  if (!c) return { ...l, from: 'local' };
  if (!l) return { ...c, from: 'cloud' };
  return l.at > c.at ? { ...l, from: 'local' } : { ...c, from: 'cloud' };
}

/** The line under the Which ones row in Settings: what's off, in plain words. */
export function picksLine(muted) {
  const off = PUSH_GROUPS.filter(g => !groupOn(muted, g.id)).map(g => g.label);
  if (!off.length) return 'All of them';
  if (off.length === PUSH_GROUPS.length) return 'None of them';
  const words = off.map((w, i) => (i ? w.charAt(0).toLowerCase() + w.slice(1) : w));
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  return `${list} off`;
}
