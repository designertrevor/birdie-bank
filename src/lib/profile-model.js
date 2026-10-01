// Profiles, the pure part: what your profile is made of, what other people may see of it, what a
// server row looks like, and how the server's answer about who-is-which-account lands in the
// state. Pure and unit tested; profiles.js does the talking to the server.
//
// Your profile is your player card (name, handicap index, how you get paid) plus state.profile:
//   avatar      null | { kind: 'buddy', id, ...extra } | { kind: 'photo', url, path?, pending? }
//               | { kind: 'initials', bg?, letters? } (see avatars.js)
//               (a photo still on this phone only has a data: url and pending: true)
//   homeCourse  null | { id, name, place? }
//   privacy     { money, stats, handicap, homeCourse }: each 'played' (people you've played with
//               see it) or 'hidden' (only you). Money is hidden until you choose to show it.
//   updatedAt   ms, when you last changed any of it
// People you've played with are cached on the phone by account (state.profiles), and which
// account each player id is in state.accountOf, which people-links.js uses so two player records
// on one account are one person.
import { GAMES, roundResults } from './round.js';
import { countsMoney } from './play-for.js';
import { linksOf } from './people-links.js';
import { meFor } from './format.js';
import { payInfo } from './pay.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const cents = v => Math.round(v * 100) / 100;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** What each privacy setting covers, in the order a settings screen lists them. */
export const PRIVACY_KEYS = ['money', 'stats', 'handicap', 'homeCourse'];
/** Who sees each part: 'played' is people you've played a round with, 'hidden' is only you. */
export const PRIVACY_LEVELS = ['played', 'hidden'];
/** Money hidden, everything else seen by people you've played with. */
export const PRIVACY_DEFAULTS = Object.freeze({ money: 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' });

/** A privacy object with every key set: anything missing or unknown falls back to the default. */
export function normalizePrivacy(p) {
  const src = isObj(p) ? p : {};
  const out = {};
  for (const k of PRIVACY_KEYS) out[k] = PRIVACY_LEVELS.includes(src[k]) ? src[k] : PRIVACY_DEFAULTS[k];
  return out;
}

/** Whether people you've played with see this part of your profile. */
export function shows(privacy, key) {
  return normalizePrivacy(privacy)[key] === 'played';
}

/** A clean avatar, or null when it isn't one. Extra fields on a buddy (its colors, say) are kept. */
export function normalizeAvatar(a) {
  if (!isObj(a)) return null;
  if (a.kind === 'buddy') {
    const id = text(a.id, 40);
    return id ? { ...a, kind: 'buddy', id } : null;
  }
  if (a.kind === 'initials') {
    // Initials on a colour you picked (avatars.js): the letters come from your name
    const out = { kind: 'initials' };
    const bg = text(a.bg, 20);
    if (bg) out.bg = bg;
    if (a.letters === 1 || a.letters === 2) out.letters = a.letters;
    return out;
  }
  if (a.kind === 'photo') {
    const url = typeof a.url === 'string' ? a.url : '';
    if (!/^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(url)) return null;
    const out = { kind: 'photo', url };
    if (typeof a.path === 'string' && a.path) out.path = a.path;
    if (a.pending || url.startsWith('data:')) out.pending = true;
    return out;
  }
  return null;
}

/** A clean home course ({ id, name, place? }), or null. */
export function normalizeHomeCourse(c) {
  if (!isObj(c)) return null;
  const name = text(c.name, 80);
  if (!name) return null;
  const out = { id: text(c.id, 80) || null, name };
  const place = text(c.place ?? c.city, 80);
  if (place) out.place = place;
  return out;
}

/**
 * The basic stats a profile shows, from the finished rounds on this phone that any of `ids`
 * played in (yours by default: state.me and the seats you took).
 * { rounds, friends, record: { won, lost, even }, favoriteGame: { id, name, rounds } | null,
 *   since: ms | null, lastPlayed: ms | null, money: { net, best, rounds } }
 * Won, lost and even are by the round's own result (points and reward rounds count too); money adds
 * up only rounds played for money, in dollars. Rounds you watched don't count.
 */
export function profileStats(state, ids = null) {
  const L = linksOf(state);
  let mine;
  if (ids) mine = new Set(ids);
  else {
    mine = new Set(state?.me ? L.groupOf(state.me) : []);
    for (const r of Object.values(state?.rounds || {})) if (r?.localMe) mine.add(r.localMe);
  }
  const record = { won: 0, lost: 0, even: 0 };
  const friends = new Set();
  const games = new Map(); // game -> { rounds, last }
  let rounds = 0, since = null, lastPlayed = null, net = 0, best = null, moneyRounds = 0;
  const done = Object.values(state?.rounds || {})
    .filter(r => r && r.status === 'done' && Array.isArray(r.players))
    .sort((a, b) => (a.finishedAt || a.createdAt || 0) - (b.finishedAt || b.createdAt || 0));
  for (const r of done) {
    // Your seat: this phone's "me" for the round when it's one of yours, otherwise any of the ids
    const local = meFor(r, state);
    const seat = mine.has(local) && r.players.some(p => p.id === local) ? local : r.players.find(p => mine.has(p.id))?.id;
    if (!seat) continue;
    let amt = 0;
    try { amt = roundResults(r).balances[seat] || 0; } catch { continue; }
    rounds++;
    const at = r.finishedAt || r.createdAt || null;
    if (at && (since == null || at < since)) since = at;
    if (at && (lastPlayed == null || at > lastPlayed)) lastPlayed = at;
    if (amt > 0) record.won++; else if (amt < 0) record.lost++; else record.even++;
    if (countsMoney(r)) {
      moneyRounds++;
      net = cents(net + amt);
      if (best == null || amt > best) best = cents(amt);
    }
    for (const p of r.players) if (p.id !== seat && !mine.has(p.id)) friends.add(L.personOf(p.id));
    if (GAMES[r.game]) {
      const g = games.get(r.game) || { rounds: 0, last: 0 };
      g.rounds++; g.last = Math.max(g.last, at || 0);
      games.set(r.game, g);
    }
  }
  let favoriteGame = null;
  for (const [id, g] of games) {
    if (!favoriteGame || g.rounds > favoriteGame.rounds || (g.rounds === favoriteGame.rounds && g.last > favoriteGame.last)) {
      favoriteGame = { id, name: GAMES[id].name, rounds: g.rounds, last: g.last };
    }
  }
  if (favoriteGame) delete favoriteGame.last;
  return { rounds, friends: friends.size, record, favoriteGame, since, lastPlayed, money: { net, best, rounds: moneyRounds } };
}

/**
 * Your whole profile as this phone has it: your player card plus state.profile, cleaned.
 * { playerId, name, index, payApp, payHandle, avatar, homeCourse, privacy, updatedAt }
 */
export function profileOf(state) {
  const me = state?.players?.[state?.me] || null;
  const own = isObj(state?.profile) ? state.profile : {};
  const pay = payInfo(me);
  return {
    playerId: state?.me || null,
    name: me?.name || '',
    index: typeof me?.index === 'number' && Number.isFinite(me.index) ? me.index : null,
    payApp: pay?.app || null,
    payHandle: pay?.handle || null,
    avatar: normalizeAvatar(own.avatar),
    homeCourse: normalizeHomeCourse(own.homeCourse),
    privacy: normalizePrivacy(own.privacy),
    updatedAt: Number(own.updatedAt) || 0,
  };
}

/**
 * Stats as they go to the server: with money left out unless you chose to show it, and nothing at
 * all when stats are hidden. Hidden money never leaves the phone.
 */
export function shareableStats(stats, privacy) {
  if (!stats || !shows(privacy, 'stats')) return {};
  const { money, ...rest } = stats;
  return shows(privacy, 'money') ? { ...rest, money } : rest;
}

/**
 * The profiles row for an account (null when there's no name to show yet). A photo still waiting
 * on this phone goes up as no avatar until it's uploaded.
 */
export function toRow(profile, userId, stats = null) {
  const name = text(profile?.name, 40);
  if (!userId || !name) return null;
  const avatar = normalizeAvatar(profile.avatar);
  const index = typeof profile.index === 'number' && profile.index >= -10 && profile.index <= 54 ? Math.round(profile.index * 10) / 10 : null;
  return {
    user_id: userId,
    player_id: profile.playerId ? String(profile.playerId).slice(0, 64) : null,
    display_name: name,
    handicap_index: index,
    home_course: normalizeHomeCourse(profile.homeCourse),
    avatar: avatar && !avatar.pending ? avatar : null,
    pay_app: profile.payApp || null,
    pay_handle: profile.payApp && profile.payHandle ? String(profile.payHandle).slice(0, 80) : null,
    privacy: normalizePrivacy(profile.privacy),
    stats: shareableStats(stats, profile.privacy),
  };
}

/** One row from people_profiles() as the phone keeps it: { name, index, homeCourse, avatar, payApp, payHandle, stats, updatedAt }. */
export function fromRow(row) {
  const out = {
    name: text(row?.display_name, 40) || null,
    index: row?.handicap_index == null || !Number.isFinite(Number(row.handicap_index)) ? null : Number(row.handicap_index),
    homeCourse: normalizeHomeCourse(row?.home_course),
    avatar: normalizeAvatar(row?.avatar),
    payApp: row?.pay_app || null,
    payHandle: row?.pay_handle || null,
    stats: isObj(row?.stats) ? row.stats : null,
    updatedAt: Date.parse(row?.updated_at) || 0,
  };
  if (out.avatar?.pending) out.avatar = null; // a photo that only lives on someone else's phone
  return out;
}

/**
 * Put the server's answer from people_profiles() into a state draft (mutates): which account each
 * player id is (state.accountOf) and the profiles you may see (state.profiles). `asked` is every id
 * that was asked about, `myAccount` the signed-in account.
 * An id the server no longer links is left as the phone last knew it when its whole account is
 * gone, so people who were one person stay one person (a deleted account keeps its rounds
 * together); when the account is still there, that one id was taken off it and is unlinked here
 * too. A profile the server no
 * longer shows (a deleted account, or one you haven't played with) is dropped.
 */
export function applyPeople(draft, rows, { asked = [], myAccount = null } = {}) {
  if (!isObj(draft.accountOf)) draft.accountOf = {};
  if (!isObj(draft.profiles)) draft.profiles = {};
  const seen = new Set();
  const shown = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.player_id !== 'string' || typeof row.user_id !== 'string') continue;
    seen.add(row.player_id);
    if (draft.accountOf[row.player_id] !== row.user_id) draft.accountOf[row.player_id] = row.user_id;
    // One account comes back once for each of its ids, with the same profile: the first one counts
    if (row.user_id === myAccount || !row.visible || shown.has(row.user_id)) continue;
    shown.add(row.user_id);
    const next = fromRow(row);
    const cur = draft.profiles[row.user_id];
    if (!cur || JSON.stringify(cur) !== JSON.stringify(next)) draft.profiles[row.user_id] = next;
  }
  // An id the server stopped linking while its account still came back for another id was taken
  // off that account (a seat someone switched away from): it goes back to being its own person.
  // When none of an account's ids come back, the account is gone, and its ids stay together.
  const back = new Set();
  for (const row of Array.isArray(rows) ? rows : []) if (row && typeof row.user_id === 'string' && typeof row.player_id === 'string') back.add(row.user_id);
  for (const id of asked) {
    const acct = draft.accountOf[id];
    if (acct && !seen.has(id) && back.has(acct) && id !== draft.me) delete draft.accountOf[id];
  }
  // Accounts asked about this time that came back with nothing to show
  const askedAccounts = new Set(asked.map(id => draft.accountOf[id]).filter(Boolean));
  for (const acct of askedAccounts) if (!shown.has(acct) && acct !== myAccount) delete draft.profiles[acct];
  if (myAccount && draft.me && draft.accountOf[draft.me] !== myAccount) draft.accountOf[draft.me] = myAccount;
  return { linked: seen.size, shown: shown.size };
}

/**
 * The profile behind a player id, for any screen: yours when it's you, otherwise the profile of the
 * account any of this person's ids belong to. Falls back to the player record's own avatar (one
 * the organizer picked). Returns { accountId, name, index, homeCourse, avatar, payApp, payHandle,
 * stats, updatedAt, mine } or null when there's nothing beyond the player card.
 */
export function profileFor(state, id) {
  if (!id) return null;
  const L = linksOf(state);
  const person = L.personOf(id);
  const map = isObj(state?.accountOf) ? state.accountOf : {};
  if (state?.me && person === L.personOf(state.me)) {
    const p = profileOf(state);
    return { accountId: map[state.me] || null, name: p.name || null, index: p.index, homeCourse: p.homeCourse, avatar: p.avatar, payApp: p.payApp, payHandle: p.payHandle, stats: null, updatedAt: p.updatedAt, mine: true };
  }
  for (const x of L.groupOf(person)) {
    const acct = map[x];
    const prof = acct && state?.profiles?.[acct];
    if (prof) return { accountId: acct, ...prof, mine: false };
  }
  for (const x of L.groupOf(person)) {
    const avatar = normalizeAvatar(state?.players?.[x]?.avatar);
    if (avatar) return { accountId: null, name: null, index: null, homeCourse: null, avatar, payApp: null, payHandle: null, stats: null, updatedAt: 0, mine: false };
  }
  return null;
}

/** Every player id this phone knows: saved players, everyone in every round, and the seats claimed. */
export function knownPlayerIds(state) {
  const ids = new Set(Object.keys(state?.players || {}));
  for (const r of Object.values(state?.rounds || {})) {
    for (const p of r?.players || []) if (p?.id) ids.add(p.id);
    if (isObj(r?.claims)) for (const v of Object.values(r.claims)) if (typeof v === 'string' && v) ids.add(v);
  }
  if (state?.me) ids.add(state.me);
  return [...ids].filter(id => typeof id === 'string' && id.length <= 64).sort();
}

/**
 * The server isn't set up for this yet (the SQL hasn't been run): a missing table, function or
 * bucket. Anything else (no signal, a real error) is not this.
 */
export function isNotSetUp(error) {
  if (!error) return false;
  const code = String(error.code || '');
  if (['42P01', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code)) return true;
  if (Number(error.statusCode ?? error.status) === 404 && /bucket/i.test(error.message || '')) return true;
  return /does not exist|schema cache|could not find the function|bucket not found/i.test(error.message || '');
}

/**
 * Where the server stands after a failed call: 'off' (the SQL hasn't been run), 'offline' (no
 * signal) or 'error' (anything else, tried again later).
 */
export function serverStateAfter(error, online = true) {
  if (isNotSetUp(error)) return 'off';
  if (!online || /fetch|network|load failed/i.test(error?.message || '')) return 'offline';
  return 'error';
}

/** Ask a server that said "not set up" at `offAt` again on a load at `now`: after half an hour. */
export const RETRY_OFF_MS = 30 * 60e3;
export function retryOnLoad(offAt, now = Date.now()) {
  return !offAt || now - offAt >= RETRY_OFF_MS;
}

/** The square to crop from a w x h image so it fills a circle: { sx, sy, size }. */
export function cropSquare(w, h) {
  const size = Math.max(0, Math.min(w, h));
  return { sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2), size };
}
