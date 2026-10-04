// What a profile screen shows, and to whom. Pure, so the privacy rules are tested in one place.
//
// The rules:
//  • One setting says who sees your profile (profile-model.js normalizePrivacy): everyone, people
//    you've played with, or only you. Money is one more switch on top, off until you turn it on.
//  • Your own phone always shows your own money (net and best round), marked "Only you" while it's
//    hidden from everyone else.
//  • Someone else's numbers from their profile show only when their profile carries them. The
//    server already leaves out what their privacy hides (people_profiles(), see
//    supabase/2026-10-05-profile-privacy.sql), and this checks again, so a hidden part never shows even
//    from an older or odd row: money needs stats.money, the record needs stats, a handicap or home
//    course needs the value.
//  • Nothing here changes any amount: the stats are worked out by profile-model.js profileStats.
import { GAMES } from './round.js';
import { money } from './golf.js';
import { moneyShown, normalizePrivacy, profileShown, publicDeep } from './profile-model.js';
import { pressCount, pressText, skinsText, winRate } from './deep-stats.js';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const EMPTY = '–';

/** Who can see your profile, in the order the profile screen and Settings show them. */
export const PROFILE_CHOICES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'played', label: 'People you’ve played with' },
  { value: 'hidden', label: 'Only you' },
];

/** Who sees your profile, in words: "Everyone", "People you’ve played with" or "Only you". */
export function whoSees(privacy) {
  const level = normalizePrivacy(privacy).profile;
  return PROFILE_CHOICES.find(c => c.value === level).label;
}

/**
 * The line under "Who can see your profile", honest about who that is today: profiles only open
 * for people who share a round with you, so "Everyone" reaches the same people as "People you’ve
 * played with" until profiles can be opened more widely, and then it reaches them too.
 */
export function profileHelp(privacy) {
  const p = normalizePrivacy(privacy);
  if (p.profile === 'hidden') return 'Your record, stats, handicap and home course stay on your phone, and rounds you play stay out of everyone’s feed. People in your rounds still see your name and avatar, so they know it’s you.';
  if (p.profile === 'everyone') return 'Anyone who opens your profile sees your record, stats, handicap and home course. For now that’s people who’ve been in a round with you, the same as People you’ve played with. When people you haven’t played with can open profiles, they’ll see it too. Rounds you play show in the feed of people who’ve played with someone in them: your first name and scores, nothing from your profile.';
  return 'People you’ve played a round with see your record, stats, handicap and home course. Rounds you play show in the feed of people who’ve played with someone in them: your first name and scores, nothing from your profile.';
}

/** The line under "Show my money". */
export function moneyHelp(privacy) {
  const p = normalizePrivacy(privacy);
  if (!moneyShown(p)) return 'Your net and your best round stay on your phone. Nobody else sees them.';
  return `${p.profile === 'everyone' ? 'Anyone who opens your profile sees' : 'People you’ve played with see'} your net and your best round, and your amounts on your rounds in their feed.`;
}

/** One line for the privacy section: what other people see of your profile. */
export function privacySummary(privacy) {
  const p = normalizePrivacy(privacy);
  if (p.profile === 'hidden') return 'Everything on your profile is only for you, except your name and avatar in rounds you play.';
  const who = p.profile === 'everyone' ? 'Anyone who opens your profile sees' : 'People you’ve played with see';
  return moneyShown(p)
    ? `${who} your name, avatar, record, stats, handicap, home course and money.`
    : `${who} your name, avatar, record, stats, handicap and home course. Your money is only for you.`;
}

/**
 * The line at the foot of Your stats: who sees which of these. The records go with your profile
 * (all time, whatever range is on screen); dollars and biggest wins never do, except your net and
 * best round with Show my money on.
 */
export function statsShareLine(privacy) {
  const p = normalizePrivacy(privacy);
  if (p.profile === 'hidden') return 'Only you see this.';
  const who = p.profile === 'everyone' ? 'Anyone who opens your profile sees' : 'People you’ve played with see';
  return `${who} your all-time records by game and course, presses and skins. Dollars and biggest wins stay with you${moneyShown(p) ? ', apart from your net and best round' : ''}.`;
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
  const statsHidden = mine && !profileShown(privacy);
  tiles.push({ key: 'rounds', label: 'Rounds', value: String(rounds), onlyYou: statsHidden });
  tiles.push({ key: 'record', label: 'Record', value: recordText(stats.record), sub: isObj(stats.record) && stats.record.even ? 'won, lost, even' : 'won, lost', onlyYou: statsHidden });
  const fav = favoriteName(stats.favoriteGame);
  tiles.push({ key: 'game', label: 'Favorite game', value: fav || EMPTY, onlyYou: statsHidden });
  // Someone else's money is only in their stats when they chose to show it
  const m = isObj(stats.money) ? stats.money : null;
  if (m) {
    // Money goes out with your profile, so it's yours alone while either is hidden
    const moneyHidden = mine && !moneyShown(privacy);
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
    more: friendMore(stats),
    since: num(stats?.since),
  };
}

/** "4 rounds · 3–1" (with the even ones when there are some) for a game or course line. */
function recordLine(l) {
  return `${l.rounds} round${l.rounds === 1 ? '' : 's'} · ${recordText(l.record)}`;
}

/**
 * A friend's deeper stats from their profile, with no money (they never carry any, and publicDeep
 * checks again): { rows: [{ key, label, value }], games: [{ key, name, sub }], courses: [{ key, name, sub }] },
 * or null when their profile has none (an older phone, or they keep it to themselves).
 */
export function friendMore(stats) {
  const d = publicDeep(isObj(stats) ? stats.deep : null);
  if (!d) return null;
  const rows = [];
  if (pressCount(d.presses.made)) {
    const rate = winRate(d.presses.made);
    rows.push({ key: 'presses', label: 'Presses', value: `${pressText(d.presses.made)}${rate == null ? '' : ` · ${rate}%`}` });
  }
  if (d.skins.rounds) rows.push({ key: 'skins', label: 'Skins won', value: `${skinsText(d.skins.won)} in ${d.skins.rounds} round${d.skins.rounds === 1 ? '' : 's'}` });
  const games = d.games.map(g => ({ key: g.key || g.name, name: g.name || GAMES[g.key]?.name || EMPTY, sub: recordLine(g) }));
  const courses = d.courses.map((c, i) => ({ key: `${c.name}:${i}`, name: c.name, place: c.place || '', sub: recordLine(c) }));
  if (!rows.length && !games.length && !courses.length) return null;
  return { rows, games, courses };
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
