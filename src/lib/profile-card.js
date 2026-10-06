// Your profile card (ROADMAP area 12): a square card for the group chat with your name and avatar,
// your handicap, this season's record, your nemesis and your favorite game. Only ever your own:
// it reads state.me and nothing else, so there's no way to make one for somebody else.
//
// It reads the numbers the rest of the app already has, so they always agree:
//  • the handicap index is the official one you entered on your profile, and the trend next to it
//    is hc-trend.js's guide from your own rounds, labelled as a guide everywhere it shows;
//  • the season (rounds, won, lost, even and the money) is wrapped.js yearInReview, the same as
//    your year in review and Season;
//  • the favorite game is your profile's (profile-model.js profileStats), all time;
//  • the nemesis is rivalry.js nemesis, money rounds only, the one on Players.
//
// The card goes outside the group, so the nemesis is a first name only, and a nemesis whose profile
// is Only you (share.js keepsMoneyPrivate, the rule wrapped.js uses for your most-played partner)
// is "your nemesis" with no name. With Show amounts off (the one remembered switch, off until you
// turn it on) no dollar figure appears anywhere: the image, its alt text or the text. Pure.
import { yearInReview } from './wrapped.js';
import { handicapTrend } from './hc-trend.js';
import { nemesis } from './rivalry.js';
import { profileStats } from './profile-model.js';
import { recordText } from './profile-view.js';
import { myIdSet } from './deep-stats.js';
import { keepsMoneyPrivate } from './share.js';
import { shortUrl } from './share-cards.js';
import { avatarFor, avatarModel, backdropOf, personKey } from './avatars.js';
import { formatIndex } from './format.js';
import { money } from './golf.js';
import { APP_NAME } from './app-name.js';

const EMPTY = '–';
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** The trend's label on the card: it's never an official index. */
export const GUIDE_LABEL = 'Trend guide, not official';
/** The line that says so in full, under the tiles and in the text. */
export const GUIDE_NOTE = 'The trend is a guide from my own rounds, not an official index.';

/**
 * What your card is made of, from this phone:
 * { name, avatar: avatarModel, index: number | null (the official one you entered),
 *   guide: number | null (hc-trend.js, null until it has 3 rounds),
 *   season: { year, rounds, record: { won, lost, even }, money: { net, rounds } | null },
 *   favoriteGame: { id, name, rounds } | null,
 *   nemesis: { id, name: first name | null (null keeps them unnamed), rounds, won, lost, even, net } | null }
 */
export function profileCard(state, { year = new Date().getFullYear() } = {}) {
  const me = state?.players?.[state?.me] || null;
  const name = me?.name || '';
  const y = yearInReview(state, year);
  const trend = handicapTrend(state);
  const stats = profileStats(state);
  const n = state?.me ? nemesis(state, myIdSet(state)) : null;
  return {
    name,
    avatar: avatarModel(avatarFor(state, state?.me), { name, key: personKey(state, state?.me) || name, letters: 2 }),
    index: typeof me?.index === 'number' && Number.isFinite(me.index) ? me.index : null,
    guide: trend.guide,
    season: { year: y.year, rounds: y.rounds, record: y.record, money: y.money ? { net: y.money.net, rounds: y.money.rounds } : null },
    favoriteGame: stats.favoriteGame,
    nemesis: n && {
      id: n.id, name: keepsMoneyPrivate(state, n.id) ? null : first(n.name) || null,
      rounds: n.rounds, won: n.won, lost: n.lost, even: n.even, net: n.net,
    },
  };
}

/** The nemesis in words: "Bo, 2–5 over 7 money rounds", or "down $40" with amounts on. */
export function nemesisText(n, showAmounts = false) {
  if (!n) return null;
  const who = n.name || 'Your nemesis';
  const how = showAmounts ? `down ${money(-n.net)}` : recordText(n);
  return `${who}, ${how} over ${plural(n.rounds, 'money round')}`;
}

/**
 * The card: { eyebrow, title, meta, avatar: { text, bg, ink, src }, tiles: [{ value, label }] (six),
 * sections: [{ label, lines }], note, footer, alt, text }.
 * `avatarSrc` is a picture the screen can draw (your photo, or your buddy as an SVG data link);
 * without one the image draws your initials on your colour.
 */
export function profileCardModel(card, { showAmounts = false, link = null, avatarSrc = null } = {}) {
  const { season, nemesis: n } = card;
  const rec = season.record;
  const played = rec.won + rec.lost + rec.even;
  const tiles = [
    { value: formatIndex(card.index), label: 'Handicap index' },
    { value: card.guide == null ? EMPTY : formatIndex(card.guide), label: GUIDE_LABEL },
    { value: String(season.rounds), label: `Rounds in ${season.year}` },
    { value: played ? recordText(rec) : EMPTY, label: rec.even ? `${season.year}: won, lost, even` : `${season.year}: won, lost` },
    { value: card.favoriteGame?.name || EMPTY, label: 'Favorite game' },
    { value: n ? n.name || 'Your nemesis' : 'None yet', label: !n ? 'Nemesis' : showAmounts ? `Nemesis, down ${money(-n.net)}` : `Nemesis, ${recordText(n)}` },
  ];
  const sections = [];
  if (showAmounts && season.money) {
    sections.push({ label: `${season.year} money`, lines: [`${money(season.money.net, { sign: true })} over ${plural(season.money.rounds, 'round')}`] });
  }
  const bg = backdropOf(card.avatar.bg);
  const m = {
    eyebrow: 'Player card',
    title: card.name || 'My player card',
    meta: `${APP_NAME} · ${season.year} season`,
    avatar: { text: card.avatar.text || '?', bg: bg.hex, ink: bg.ink, src: avatarSrc || null },
    tiles,
    sections,
    note: card.guide == null ? null : GUIDE_NOTE,
    footer: shortUrl(link) || APP_NAME,
  };
  const alt = [
    `Player card: ${m.title}`,
    m.tiles.map(t => `${t.label} ${t.value}`).join(', '),
    ...m.sections.map(s => `${s.label}: ${s.lines.join('; ')}`),
    m.note,
  ].filter(Boolean).join('. ');
  const text = [
    `${m.title}, player card`,
    '',
    `Handicap index: ${formatIndex(card.index)}`,
    card.guide == null ? null : `Trend from my rounds: ${formatIndex(card.guide)} (a guide, not an official index)`,
    `${season.year} season: ${plural(season.rounds, 'round')}${played ? `, ${recordText(rec)} (${rec.even ? 'won, lost, even' : 'won, lost'})` : ''}`,
    card.favoriteGame ? `Favorite game: ${card.favoriteGame.name}` : null,
    n ? `Nemesis: ${nemesisText(n, showAmounts)}` : null,
    ...m.sections.map(s => `${s.label}: ${s.lines.join('; ')}`),
  ].filter(v => v != null).join('\n').trim();
  return { ...m, alt, text };
}
