// Avatars: the Ball buddies (the golf ball from the empty states, in a hat, on a backdrop) and the
// critters shelf (birdie, eagle, goose and friends), a photo, or initials on a pastel. Pure, so the picker, every list and the tests share one set of rules.
//
// An avatar as it's saved (state.profile.avatar, a friend's profile, a round player's `avatar`):
//   { kind: 'buddy', id, bg }        a Ball buddy (BUDDIES) on a backdrop (BACKDROPS)
//   { kind: 'photo', url, ... }      a photo (see profile-model.js normalizeAvatar)
//   { kind: 'initials', bg, letters } your initials (1 or 2 letters) on a colour you picked
//   null                              nobody picked: initials on a pastel worked out from the person
// What a screen draws (avatarModel): { kind: 'photo', url, text, bg } | { kind: 'buddy', buddy, bg } |
// { kind: 'initials', text, bg }. The order is photo, then a buddy, then initials.
import { linksOf } from './people-links.js';
import { theirName } from './their-profile.js';
import { normalizeAvatar } from './profile-model.js';

/** The backdrops, in the order the picker shows them. `ink` is the text colour that reads on it. */
export const BACKDROPS = [
  { id: 'mint', hex: '#a4d4c5', ink: '#0a0a0a' },
  { id: 'peach', hex: '#ffb084', ink: '#0a0a0a' },
  { id: 'lav', hex: '#b8a4ed', ink: '#0a0a0a' },
  { id: 'ochre', hex: '#e8b94a', ink: '#0a0a0a' },
  { id: 'pink', hex: '#ff4d8b', ink: '#0a0a0a' },
  { id: 'coral', hex: '#ff6b5a', ink: '#0a0a0a' },
  { id: 'blush', hex: '#ffd6e5', ink: '#0a0a0a' },
  { id: 'teal', hex: '#1a3a3a', ink: '#ffffff' },
];
const BACKDROP = Object.fromEntries(BACKDROPS.map(b => [b.id, b]));
export const backdropOf = id => BACKDROP[id] || BACKDROP.mint;

/** The picker's shelves, in order: the Ball buddies (the ball in a hat) and the critters. */
export const SHELVES = [
  { id: 'buddies', name: 'Ball buddies' },
  { id: 'critters', name: 'Critters' },
];

/**
 * The Ball buddies and critters, in the order the picker shows them, each with the backdrop it
 * starts on and its shelf. All saved as { kind: 'buddy', id, bg }, so an older app that doesn't
 * know a new one shows initials on its backdrop.
 */
export const BUDDIES = [
  { id: 'bucket', name: 'Bucket hat', bg: 'mint' },
  { id: 'visor', name: 'Visor', bg: 'peach' },
  { id: 'snapback', name: 'Snapback', bg: 'lav' },
  { id: 'flatcap', name: 'Flat cap', bg: 'ochre' },
  { id: 'shades', name: 'Shades', bg: 'pink' },
  { id: 'beanie', name: 'Beanie', bg: 'teal' },
  { id: 'sweatband', name: 'Sweatband', bg: 'coral' },
  { id: 'tourcap', name: 'Tour cap', bg: 'blush' },
  { id: 'cowboy', name: 'Cowboy hat', bg: 'lav' },
  { id: 'straw', name: 'Straw hat', bg: 'mint' },
  { id: 'bandana', name: 'Bandana', bg: 'ochre' },
  { id: 'crown', name: 'Crown', bg: 'teal' },
  { id: 'tam', name: 'Tam o’ shanter', bg: 'peach' },
  { id: 'earmuffs', name: 'Earmuffs', bg: 'mint' },
  { id: 'partyhat', name: 'Party hat', bg: 'lav' },
  { id: 'halo', name: 'Halo', bg: 'blush' },
  { id: 'birdie', name: 'Birdie', bg: 'mint', shelf: 'critters' },
  { id: 'eagle', name: 'Eagle', bg: 'teal', shelf: 'critters' },
  { id: 'goose', name: 'Goose', bg: 'lav', shelf: 'critters' },
  { id: 'gopher', name: 'Gopher', bg: 'blush', shelf: 'critters' },
  { id: 'flamingo', name: 'Flamingo', bg: 'ochre', shelf: 'critters' },
  { id: 'frog', name: 'Hazard frog', bg: 'peach', shelf: 'critters' },
  { id: 'tiger', name: 'Tiger headcover', bg: 'pink', shelf: 'critters' },
  { id: 'flag', name: 'Pin flag', bg: 'mint', shelf: 'critters' },
].map(b => ({ shelf: 'buddies', ...b }));
const BUDDY = Object.fromEntries(BUDDIES.map(b => [b.id, b]));
export const buddyOf = id => BUDDY[id] || null;
/** The buddies on one shelf, in picker order. */
export const shelfOf = shelf => BUDDIES.filter(b => b.shelf === shelf);

/** The pastels a person with no avatar gets, picked from who they are so it stays the same. */
export const FALLBACK_TINTS = ['lav', 'peach', 'mint', 'ochre'];

/** A small stable number from a string (FNV-1a), for picking a tint. */
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const tintFor = key => FALLBACK_TINTS[hash(key) % FALLBACK_TINTS.length];

/** "Trevor Nielsen" is T (or TN with two letters), "Bo" is B, nothing is "?". */
export function initialsOf(name, letters = 1) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] || '';
  const last = parts.length > 1 ? [...parts.at(-1)][0] || '' : '';
  return (letters === 2 && last ? first + last : first).toUpperCase() || '?';
}

/** A buddy avatar, cleaned: an unknown backdrop falls back to the buddy's own. */
export function buddyAvatar(id, bg) {
  const b = buddyOf(id);
  if (!b) return null;
  return { kind: 'buddy', id: b.id, bg: BACKDROP[bg] ? bg : b.bg };
}

/** An initials avatar, cleaned. */
export function initialsAvatar(bg, letters = 1) {
  return { kind: 'initials', bg: BACKDROP[bg] ? bg : FALLBACK_TINTS[0], letters: letters === 2 ? 2 : 1 };
}

/**
 * What to draw for an avatar. `name` gives the initials, `key` (the person's id) picks the pastel
 * when nobody chose one, `letters` is how many initials when they didn't say. A buddy this app
 * doesn't know yet (from a newer app) shows as initials on its backdrop.
 */
export function avatarModel(avatar, { name = '', key = '', letters = 1 } = {}) {
  const a = normalizeAvatar(avatar);
  // A photo keeps the initials it falls back to when the picture won't load
  if (a?.kind === 'photo') return { kind: 'photo', url: a.url, text: initialsOf(name, letters), bg: tintFor(key || name) };
  if (a?.kind === 'buddy') {
    const b = buddyOf(a.id);
    const bg = BACKDROP[a.bg] ? a.bg : b?.bg || tintFor(key || name);
    if (b) return { kind: 'buddy', buddy: b.id, bg };
    return { kind: 'initials', text: initialsOf(name, letters), bg };
  }
  if (a?.kind === 'initials') return { kind: 'initials', text: initialsOf(name, a.letters || letters), bg: BACKDROP[a.bg] ? a.bg : tintFor(key || name) };
  return { kind: 'initials', text: initialsOf(name, letters), bg: tintFor(key || name) };
}

/** How the picker labels an avatar: "Visor", "Your photo", "Initials". */
export function avatarLabel(avatar) {
  const a = normalizeAvatar(avatar);
  if (a?.kind === 'photo') return 'Your photo';
  if (a?.kind === 'buddy') return buddyOf(a.id)?.name || 'A character';
  return 'Initials';
}

/**
 * Whether a photo link may be drawn: a picture made on this phone (a data: link), or a photo in the
 * app's own avatars bucket. A round or a profile row can carry any text, so a link to anywhere
 * else (a tracking pixel, someone's server) shows as initials and is never fetched. `host` is the
 * Supabase project URL; with none set (tests, local dev without keys) any https link is allowed.
 */
export function photoAllowed(url, host = null) {
  if (typeof url !== 'string') return false;
  if (/^data:image\/(jpeg|png|webp);base64,/.test(url)) return true;
  if (!/^https:\/\//.test(url)) return false;
  if (!host) return true;
  return url.startsWith(`${String(host).replace(/\/+$/, '')}/storage/v1/object/public/avatars/`);
}

/** An avatar safe to put in a round other phones will read: no photo that only lives on this phone. */
export function shareableAvatar(avatar) {
  const a = normalizeAvatar(avatar);
  if (!a || (a.kind === 'photo' && a.pending)) return null;
  return a;
}

// --------------------------- whose avatar ----------------------------------

const cache = new WeakMap(); // state -> { L, byId: Map }

/** The name an avatar's initials come from: a friend's own profile name wins (as it does in nameOf), else the one given. */
export function avatarName(state, id, name = '') {
  return (state && id && theirName(state, id)) || name;
}

/**
 * The avatar a person picked, by any of their player ids, or null: yours from your profile; a friend's
 * from their account's profile; then one saved on their player card; then one their seat carried in
 * a round (the organizer's avatar on a shared round). `seat` is a round player to fall back to.
 * Worked out once per state, since every row on a screen asks.
 */
export function avatarFor(state, id, seat = null) {
  if (!state || !id) return shareableAvatar(seat?.avatar);
  let c = cache.get(state);
  if (!c) { c = { L: linksOf(state), byId: new Map() }; cache.set(state, c); }
  if (!c.byId.has(id)) c.byId.set(id, findAvatar(state, c.L, id));
  return c.byId.get(id) || shareableAvatar(seat?.avatar);
}

function findAvatar(state, L, id) {
  const person = L.personOf(id);
  if (state.me && person === L.personOf(state.me)) return normalizeAvatar(state.profile?.avatar);
  const group = L.groupOf(person);
  const accountOf = state.accountOf && typeof state.accountOf === 'object' ? state.accountOf : {};
  for (const x of group) {
    const prof = accountOf[x] && state.profiles?.[accountOf[x]];
    const a = prof && shareableAvatar(prof.avatar);
    if (a) return a;
  }
  for (const x of group) {
    const a = shareableAvatar(state.players?.[x]?.avatar);
    if (a) return a;
  }
  const ids = new Set(group);
  const rounds = Object.values(state.rounds || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  for (const r of rounds) {
    for (const p of r?.players || []) {
      if (!ids.has(p?.id)) continue;
      const a = shareableAvatar(p.avatar);
      if (a) return a;
    }
  }
  return null;
}

/** The id a person's fallback pastel comes from: the id kept for them, so all their ids match. */
export function personKey(state, id) {
  if (!state || !id) return id || '';
  let c = cache.get(state);
  if (!c) { c = { L: linksOf(state), byId: new Map() }; cache.set(state, c); }
  return c.L.personOf(id);
}

/**
 * Avatars in one group (a round's seats, a results card), so nobody has a twin: when two people
 * would look the same (the same buddy on the same backdrop, or the same initials on the same
 * colour), the later one shows on another backdrop, only here. Nobody has to change. Photos are
 * left alone. Takes and returns models (avatarModel) in the same order.
 */
export function noTwins(models) {
  const seen = new Set();
  const look = m => (m.kind === 'buddy' ? `b:${m.buddy}:${m.bg}` : m.kind === 'initials' ? `i:${m.text}:${m.bg}` : null);
  return models.map(m => {
    if (!m || m.kind === 'photo') return m;
    let out = m;
    if (seen.has(look(m))) {
      const order = m.kind === 'initials' ? [...FALLBACK_TINTS, ...BACKDROPS.map(b => b.id).filter(b => !FALLBACK_TINTS.includes(b))] : BACKDROPS.map(b => b.id);
      const start = order.indexOf(m.bg);
      for (let i = 1; i <= order.length; i++) {
        const bg = order[(start + i) % order.length];
        const next = { ...m, bg };
        if (!seen.has(look(next))) { out = next; break; }
      }
    }
    seen.add(look(out));
    return out;
  });
}

/**
 * Put the avatars this phone knows on a new round's players (mutates the round), so a friend opening
 * the round link sees them on the seat tiles before their phone knows anyone's profile. Only
 * avatars that can leave the phone; nothing else about a player changes.
 */
export function stampAvatars(state, round) {
  // Worked out fresh, never from the cache: `state` is usually a draft that becomes the next state
  // once this round is in it, and a cache kept on it would miss the round
  const L = state ? linksOf(state) : null;
  for (const p of round?.players || []) {
    if (!p?.id) continue;
    // The avatar this phone knows now wins over one copied in with the player (an older round's)
    const a = (L && shareableAvatar(findAvatar(state, L, p.id))) || shareableAvatar(p.avatar);
    if (a) p.avatar = a; else delete p.avatar;
  }
  return round;
}
