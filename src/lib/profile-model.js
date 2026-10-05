// Profiles, the pure part: what your profile is made of, what other people may see of it, what a
// server row looks like, and how the server's answer about who-is-which-account lands in the
// state. Pure and unit tested; profiles.js does the talking to the server.
//
// Your profile is your player card (name, handicap index, how you get paid) plus state.profile:
//   avatar      null | { kind: 'buddy', id, ...extra } | { kind: 'photo', url, path?, pending? }
//               | { kind: 'initials', bg?, letters? } (see avatars.js)
//               (a photo still on this phone only has a data: url and pending: true)
//   homeCourse  null | { id, name, place? }
//   privacy     { profile, showMoney, ...older keys }: who can see your profile ('everyone',
//               'played' or 'hidden') and whether your money shows with it (off until you choose).
//               See normalizePrivacy below.
//   updatedAt   ms, when you last changed any of it
// People you've played with are cached on the phone by account (state.profiles), and which
// account each player id is in state.accountOf, which people-links.js uses so two player records
// on one account are one person.
import { GAMES, roundResults } from './round.js';
import { countsMoney, hasCashBet, onTab, tabResults } from './play-for.js';
import { linksOf } from './people-links.js';
import { meFor } from './format.js';
import { payInfo } from './pay.js';
import { normalizeAvatar } from './avatar-model.js';
import { bigNoMoney, countsAsDone, withBigMoney } from './big-money.js';

// The avatar's own rules live in avatar-model.js, so every avatar on screen doesn't load the profile rules
export { normalizeAvatar } from './avatar-model.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const cents = v => Math.round(v * 100) / 100;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Who can see your profile, one setting for all of it (Trevor, Overnight 7): 'everyone' (anyone who
 * opens your profile; today profiles only open for people who share a round with you, so it reaches
 * the same people as 'played' until profiles open wider), 'played' (people you've played a round
 * with, the default) or 'hidden' (only you). It covers your record, stats, handicap and home course.
 * Your name and avatar always show to people in your rounds (they need to know who you are), and
 * how you get paid shows so they can pay you.
 */
export const PROFILE_LEVELS = ['everyone', 'played', 'hidden'];
/**
 * The privacy object: { profile, showMoney } is the setting. showMoney (off until you turn it on)
 * adds your net and best round, and only counts when the profile isn't 'hidden'.
 * The four older keys (money, stats, handicap, homeCourse, each 'played' | 'hidden', money also
 * 'everyone') ride along, worked out from the setting, so a server that hasn't run
 * 2026-10-05-profile-privacy.sql and a phone on an older version apply exactly the same thing.
 */
export const LEGACY_KEYS = ['money', 'stats', 'handicap', 'homeCourse'];
const LEGACY_LEVELS = { money: ['hidden', 'played', 'everyone'], stats: ['played', 'hidden'], handicap: ['played', 'hidden'], homeCourse: ['played', 'hidden'] };
const LEGACY_DEFAULTS = { money: 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' };
/** People you've played with see your profile; money stays with you. */
export const PRIVACY_DEFAULTS = Object.freeze({ profile: 'played', showMoney: false, ...LEGACY_DEFAULTS });

/**
 * The single setting from privacy saved before it existed (the four per-item choices):
 *  • any of record, handicap or home course hidden: 'hidden' (Only you). One setting can't keep
 *    one part hidden and another shown, so it never shows something you chose to hide.
 *  • otherwise 'played', with showMoney on when money was 'played' or 'everyone'. Money that was
 *    open to 'everyone' doesn't widen the rest of the profile to everyone: it reaches the same
 *    people today either way, and you can pick Everyone yourself.
 */
export function fromLegacy(p) {
  const src = isObj(p) ? p : {};
  const old = {};
  for (const k of LEGACY_KEYS) old[k] = LEGACY_LEVELS[k].includes(src[k]) ? src[k] : LEGACY_DEFAULTS[k];
  const hidden = ['stats', 'handicap', 'homeCourse'].some(k => old[k] === 'hidden');
  return { profile: hidden ? 'hidden' : 'played', showMoney: old.money !== 'hidden' };
}

/** The older per-item keys that say the same thing as the setting. */
export function legacyOf(profile, showMoney) {
  if (profile === 'hidden') return { money: 'hidden', stats: 'hidden', handicap: 'hidden', homeCourse: 'hidden' };
  return { money: showMoney ? (profile === 'everyone' ? 'everyone' : 'played') : 'hidden', stats: 'played', handicap: 'played', homeCourse: 'played' };
}

/**
 * A privacy object with every key set: { profile, showMoney, money, stats, handicap, homeCourse }.
 * Saved privacy with a profile level keeps it; older privacy without one is mapped (fromLegacy).
 */
export function normalizePrivacy(p) {
  const src = isObj(p) ? p : {};
  const set = PROFILE_LEVELS.includes(src.profile) ? { profile: src.profile, showMoney: src.showMoney === true } : fromLegacy(src);
  return { ...set, ...legacyOf(set.profile, set.showMoney) };
}

/** Whether people other than you see your profile (record, stats, handicap, home course). */
export function profileShown(privacy) {
  return normalizePrivacy(privacy).profile !== 'hidden';
}

/** Whether people other than you see your money (the switch is on and the profile isn't only you). */
export function moneyShown(privacy) {
  const p = normalizePrivacy(privacy);
  return p.profile !== 'hidden' && p.showMoney;
}

/**
 * What people_profiles() (supabase/2026-10-05-profile-privacy.sql) hands someone you've played with
 * from a saved privacy row, as it reads it: { handicap, homeCourse, stats, money }. A row with a
 * profile level follows the one setting; an older row without one keeps the per-item rule it had
 * (2026-10-03-privacy-everyone.sql), so a phone that hasn't updated works as before. The SQL and
 * this are kept the same, and the tests hold this one to it.
 */
export function serverParts(saved) {
  const p = isObj(saved) ? saved : {};
  if (PROFILE_LEVELS.includes(p.profile)) {
    const shown = p.profile !== 'hidden';
    return { handicap: shown, homeCourse: shown, stats: shown, money: shown && p.showMoney === true };
  }
  const stats = (p.stats ?? 'played') !== 'hidden';
  return { handicap: (p.handicap ?? 'played') !== 'hidden', homeCourse: (p.homeCourse ?? 'played') !== 'hidden', stats, money: stats && ['played', 'everyone'].includes(p.money) };
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
 * up the rounds played for money and reward rounds' side bets for money (the Tab's dollars). Rounds
 * you watched don't count.
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
    .filter(r => r && countsAsDone(state, r) && Array.isArray(r.players))
    .sort((a, b) => (a.finishedAt || a.createdAt || 0) - (b.finishedAt || b.createdAt || 0));
  for (const r of done) {
    // Your seat: this phone's "me" for the round when it's one of yours, otherwise any of the ids
    const local = meFor(r, state);
    const seat = mine.has(local) && r.players.some(p => p.id === local) ? local : r.players.find(p => mine.has(p.id))?.id;
    if (!seat) continue;
    let amt = 0, res;
    // A Big Game's round has your money from the whole game on the one round it goes on, as History does
    try { res = withBigMoney(state, r, roundResults(r)); amt = res.balances[seat] || 0; } catch { continue; }
    // A Big Game's round with no money on it (the game's goes on another, or isn't decided) is a round played, not a result
    const noMoney = bigNoMoney(state, r);
    rounds++;
    const at = r.finishedAt || r.createdAt || null;
    if (at && (since == null || at < since)) since = at;
    if (at && (lastPlayed == null || at > lastPlayed)) lastPlayed = at;
    if (noMoney) { /* no result of its own */ } else if (amt > 0) record.won++; else if (amt < 0) record.lost++; else record.even++;
    // Dollars: a money round's net, or a reward round's side bets for money, as the Tab has them
    const cash = noMoney ? null : countsMoney(r) ? amt : onTab(r) && hasCashBet(r, seat) ? tabResults(r).balances[seat] || 0 : null;
    if (cash != null) {
      moneyRounds++;
      net = cents(net + cash);
      if (best == null || cash > best) best = cents(cash);
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

/** How many game and course lines a profile sends: the ones you've played most. */
export const SHARED_LINES = 8;
const count = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0);
const rec3 = r => ({ won: count(r?.won), lost: count(r?.lost), even: count(r?.even) });
const pressRec = r => ({ won: count(r?.won), lost: count(r?.lost), halved: count(r?.halved) });

/**
 * The deeper stats people may see (deep-stats.js deepStats, or this same shape again), with no
 * money in them: your press record, skins won, and won, lost and even by game and by course.
 * Dollars, points, biggest wins and round ids are never in it. Null when there's nothing to send.
 * { presses: { rounds, made, against }, skins: { rounds, won, best }, games: [{ key, name, rounds, record }],
 *   courses: [{ name, place, rounds, record }] }
 */
export function publicDeep(deep) {
  if (!isObj(deep)) return null;
  const lines = (list, course) => (Array.isArray(list) ? list : []).filter(l => isObj(l) && count(l.rounds) > 0).slice(0, SHARED_LINES).map(l => {
    const out = course ? { name: text(l.name, 80) || 'No course' } : { key: text(l.key, 40), name: text(l.name, 40) };
    if (course && text(l.place, 80)) out.place = text(l.place, 80);
    out.rounds = count(l.rounds);
    out.record = rec3(l.record);
    return out;
  });
  const pr = isObj(deep.presses) ? deep.presses : {};
  const sk = isObj(deep.skins) ? deep.skins : {};
  const best = typeof sk.best === 'number' ? sk.best : isObj(sk.best) ? sk.best.skins : null;
  const out = {
    presses: { rounds: count(pr.rounds), made: pressRec(pr.made), against: pressRec(pr.against) },
    skins: { rounds: count(sk.rounds), won: count(sk.won), best: best == null ? null : count(best) },
    games: lines(deep.games, false),
    courses: lines(deep.courses, true),
  };
  if (!out.presses.rounds && !out.skins.rounds && !out.games.length && !out.courses.length) return null;
  return out;
}

/**
 * Stats as they go to the server: nothing at all when your profile is only you; otherwise your
 * record and the deeper stats with no money in them (publicDeep), plus your net and best round only
 * when Show my money is on. Hidden money never leaves the phone.
 */
export function shareableStats(stats, privacy) {
  if (!stats || !profileShown(privacy)) return {};
  const { money, deep, ...rest } = stats;
  const out = { ...rest };
  const d = publicDeep(deep);
  if (d) out.deep = d;
  if (moneyShown(privacy) && money) out.money = money;
  return out;
}

/**
 * The profiles row for an account (null when there's no name to show yet). A photo still waiting
 * on this phone goes up as no avatar until it's uploaded. A profile that's only you sends no
 * handicap, home course or stats at all (your phone and your account's saved data keep them).
 */
export function toRow(profile, userId, stats = null) {
  const name = text(profile?.name, 40);
  if (!userId || !name) return null;
  const avatar = normalizeAvatar(profile.avatar);
  const shown = profileShown(profile.privacy);
  const index = shown && typeof profile.index === 'number' && profile.index >= -10 && profile.index <= 54 ? Math.round(profile.index * 10) / 10 : null;
  return {
    user_id: userId,
    player_id: profile.playerId ? String(profile.playerId).slice(0, 64) : null,
    display_name: name,
    handicap_index: index,
    home_course: shown ? normalizeHomeCourse(profile.homeCourse) : null,
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
