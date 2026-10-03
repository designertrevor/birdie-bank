// What a profile screen shows, and to whom. Pure, so the privacy rules are tested in one place.
//
// The rules:
//  • Your own phone always shows your own money (net and best round), marked "Only you" while it's
//    hidden from everyone else.
//  • Someone else's numbers from their profile show only when their profile carries them. The
//    server already leaves out what their privacy hides (people_profiles(), see
//    supabase/2026-10-01-profiles.sql), and this checks again, so a hidden part never shows even
//    from an older or odd row: money needs stats.money, the record needs stats, a handicap or home
//    course needs the value.
//  • Nothing here changes any amount: the stats are worked out by profile-model.js profileStats.
import { GAMES } from './round.js';
import { money } from './golf.js';
import { PRIVACY_KEYS, normalizePrivacy, shows } from './profile-model.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const EMPTY = '–';

/** The privacy choices, as the profile screen lists them. */
export const PRIVACY_ROWS = [
  { key: 'money', title: 'Your money', help: 'Your net and your best round.' },
  { key: 'stats', title: 'Your record', help: 'Rounds played, won and lost, and your favorite game.' },
  { key: 'handicap', title: 'Your handicap', help: 'The index on your profile.' },
  { key: 'homeCourse', title: 'Your home course', help: 'Where you usually play.' },
];

/** Who sees one part of your profile, in words: "Only you", "People you’ve played with" or "Everyone". */
export function whoSees(privacy, key) {
  const level = normalizePrivacy(privacy)[key];
  if (level === 'everyone') return 'Everyone';
  return shows(privacy, key) ? 'People you’ve played with' : 'Only you';
}

/** The choices for who sees your money, in the order the profile screen shows them. */
export const MONEY_CHOICES = [
  { value: 'hidden', label: 'Only you' },
  { value: 'played', label: 'People you’ve played with' },
  { value: 'everyone', label: 'Everyone' },
];

/**
 * The line under "Who sees your money", honest about who that is today: profiles only open for
 * people who share a round with you, so "Everyone" reaches the same people as "People you’ve
 * played with" until profiles can be opened more widely, and then it reaches them too.
 */
export function moneyHelp(privacy) {
  const p = normalizePrivacy(privacy);
  if (p.money === 'hidden') return 'Your net and best round stay on your phone. Nobody else sees them.';
  if (p.stats !== 'played') return 'Your net and best round go out with your record, which is hidden, so nobody else sees them yet.';
  if (p.money === 'everyone') return 'Anyone who opens your profile sees your net and your best round. For now that’s people who’ve been in a round with you. When people you haven’t played with can open profiles, they’ll see it too.';
  return 'People you’ve played a round with see your net and your best round.';
}

/** One line for the privacy section: what people you've played with can see. */
export function privacySummary(privacy) {
  const p = normalizePrivacy(privacy);
  // Money goes out with your record (shareableStats), so a hidden record keeps it in too
  const moneyOut = p.money !== 'hidden' && p.stats === 'played';
  // Money open to everyone gets its own sentence, so it isn't listed as only for people you've played with
  const seen = PRIVACY_KEYS.filter(k => p[k] !== 'hidden' && (k !== 'money' || (moneyOut && p.money === 'played')));
  if (!seen.length) return 'Everything on your profile is only for you.';
  const words = { money: 'money', stats: 'record', handicap: 'handicap', homeCourse: 'home course' };
  const list = ['name', 'avatar', ...seen.map(k => words[k])];
  const joined = `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  const tail = p.money === 'hidden' ? ' Your money is only for you.' : !moneyOut ? ' Your money shows only with your record, so it’s only for you too.'
    : p.money === 'everyone' ? ' Your money is open to anyone who opens your profile.' : '';
  return `People you’ve played with see your ${joined}.${tail}`;
}

/** "12–8–3" for won, lost, even (even left off when there's none), like the rivalry card's score. */
export function recordText(record) {
  if (!isObj(record)) return EMPTY;
  const w = num(record.won) || 0, l = num(record.lost) || 0, e = num(record.even) || 0;
  return (e ? [w, l, e] : [w, l]).join(EMPTY);
}

/** The favorite game's name, from a stats object (a known game, or the name it was sent with). */
function favoriteName(fav) {
  if (!isObj(fav)) return null;
  return GAMES[fav.id]?.name || (typeof fav.name === 'string' ? fav.name.slice(0, 30) : null);
}

/**
 * The stat tiles for a profile: [{ key, label, value, sub?, onlyYou? }].
 * `mine`: your own profile (money always shows, flagged onlyYou while it's hidden).
 * Someone else's: only what their stats carry. Points and reward rounds never count as money.
 */
export function statTiles(stats, { mine = false, privacy = null } = {}) {
  if (!isObj(stats)) return [];
  const tiles = [];
  const rounds = num(stats.rounds);
  // A friend whose record is hidden sends no stats at all; an empty object shows nothing
  if (rounds == null) return [];
  const statsHidden = mine && !shows(privacy, 'stats');
  tiles.push({ key: 'rounds', label: 'Rounds', value: String(rounds), onlyYou: statsHidden });
  tiles.push({ key: 'record', label: 'Record', value: recordText(stats.record), sub: isObj(stats.record) && stats.record.even ? 'won, lost, even' : 'won, lost', onlyYou: statsHidden });
  const fav = favoriteName(stats.favoriteGame);
  tiles.push({ key: 'game', label: 'Favorite game', value: fav || EMPTY, onlyYou: statsHidden });
  // Someone else's money is only in their stats when they chose to show it
  const m = isObj(stats.money) ? stats.money : null;
  if (m) {
    // Money goes out with your record, so it's yours alone while either is hidden
    const moneyHidden = mine && (!shows(privacy, 'money') || !shows(privacy, 'stats'));
    const best = num(m.best);
    const net = num(m.net);
    const played = num(m.rounds) || 0;
    tiles.push({ key: 'best', label: 'Best round', value: best == null ? EMPTY : money(best, { sign: true }), onlyYou: moneyHidden });
    tiles.push({ key: 'net', label: 'All time', value: played && net != null ? money(net, { sign: true }) : EMPTY, sub: played ? `${played} round${played === 1 ? '' : 's'} for money` : 'No money rounds yet', tone: !played || !net ? '' : net > 0 ? 'pos' : 'neg', onlyYou: moneyHidden });
  }
  return tiles;
}

/**
 * What a friend's card shows from their profile (already privacy-filtered by the server, and
 * checked again here): { avatar, homeCourse, index, tiles, since }. Null for no profile.
 * `saved` is the player card on this phone: a handicap you saved for them wins over theirs.
 */
export function friendView(profile, saved = null) {
  if (!isObj(profile) || profile.mine) return null;
  const stats = isObj(profile.stats) ? profile.stats : null;
  const home = isObj(profile.homeCourse) && profile.homeCourse.name ? profile.homeCourse : null;
  const ownIndex = num(saved?.index);
  const theirIndex = num(profile.index);
  return {
    homeCourse: home,
    index: ownIndex ?? theirIndex,
    indexFromProfile: ownIndex == null && theirIndex != null,
    // Their money only when their profile carries it (they chose to show it)
    tiles: statTiles(stats),
    since: num(stats?.since),
  };
}

/** "Playing since Sep 2026", from the first round on record. */
export function sinceText(at) {
  if (!num(at)) return null;
  return `Playing since ${new Date(at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

/** The line under your name: "Index 12.4 · Birch Creek". */
export function profileSubline(profile, formatIndex) {
  const parts = [];
  if (num(profile?.index) != null) parts.push(`Index ${formatIndex(profile.index)}`);
  else parts.push('No handicap index');
  if (profile?.homeCourse?.name) parts.push(profile.homeCourse.name);
  return parts.join(' · ');
}
