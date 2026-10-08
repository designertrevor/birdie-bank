// The rivalry card: a square "Trevor v Mike" card for the group text, from the face-to-face header
// on a friend's screen. It reads rivalry.js, so the record, the streak and the money are the ones
// that screen shows: every round you both finished counts in the record, money rounds only in the
// dollars.
//
// The card goes to the group, so it reads the same to everyone in it: both of you by first name,
// never "You" (share-cards.js), unless this phone has no name for you yet. No dollar figure appears
// anywhere (the image, its alt text or the text) unless Show amounts is on, the one remembered
// switch (share.js), and never when their profile is Only you (keepsMoneyPrivate): the money between
// two people is theirs as much as yours. Pure; the drawing is rivalry-card-image.js.
import { rivalry } from './rivalry.js';
import { myIdSet } from './deep-stats.js';
import { nameOf } from './ledger.js';
import { keepsMoneyPrivate } from './share.js';
import { shortUrl } from './share-cards.js';
import { avatarFor, avatarModel, backdropOf, personKey } from './avatars.js';
import { roundDate } from './format.js';
import { money } from './golf.js';
import { APP_NAME } from './app-name.js';

const EMPTY = '–';
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const initialsOf = n => String(n || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/**
 * You against one friend, from this phone:
 * { you: { id, name, avatar }, them: { id, name, avatar }, rounds, won, lost, even, net, moneyRounds,
 *   otherRounds, streak: { result, count } | null, first: { date } | null,
 *   last: { date, course } | null, private: whether their profile keeps the money off the card }
 * The names are whole here; the model shortens them to first names.
 */
export function rivalryCard(state, other) {
  const me = state?.me || null;
  const myName = state?.players?.[me]?.name || '';
  const theirName = nameOf(state, other);
  const rv = rivalry(state, myIdSet(state), other);
  const when = row => (row ? { date: roundDate(row.round), course: row.round.course?.name || '' } : null);
  return {
    you: { id: me, name: myName, avatar: avatarModel(avatarFor(state, me), { name: myName, key: personKey(state, me) || myName, letters: 2 }) },
    them: { id: other, name: theirName, avatar: avatarModel(avatarFor(state, other), { name: theirName, key: personKey(state, other) || theirName, letters: 2 }) },
    rounds: rv.rounds, won: rv.won, lost: rv.lost, even: rv.even, net: rv.net,
    moneyRounds: rv.moneyRounds, otherRounds: rv.otherRounds,
    streak: rv.streak,
    first: when(rv.first), last: when(rv.last),
    private: keepsMoneyPrivate(state, other),
  };
}

/** "Trevor leads 5–3", "Mike leads 5–3", "All square 4–4" (even rounds left out, as on the screen). */
export function seriesWords(card, you, them) {
  if (card.won > card.lost) return `${you} ${you === 'You' ? 'lead' : 'leads'} ${card.won}–${card.lost}`;
  if (card.lost > card.won) return `${them} leads ${card.lost}–${card.won}`;
  return `All square ${card.won}–${card.lost}`;
}

/** "Trevor has won the last 3", "Mike took the last one", "The last 2 were even". Null with no streak. */
export function streakWords(streak, you, them) {
  if (!streak) return null;
  const { result, count } = streak;
  const won = who => (count === 1 ? `${who} took the last one` : who === 'You' ? `You’ve won the last ${count}` : `${who} has won the last ${count}`);
  if (result === 'won') return won(you);
  if (result === 'lost') return won(them);
  return count === 1 ? 'The last one was even' : `The last ${count} were even`;
}

/** The money between you in words, from whoever is up: "Trevor is up $42 over 6 money rounds". */
export function moneyWords(card, you, them) {
  const over = `over ${plural(card.moneyRounds, 'money round')}`;
  if (card.net > 0) return `${you} ${you === 'You' ? 'are' : 'is'} up ${money(card.net)} ${over}`;
  if (card.net < 0) return `${them} is up ${money(-card.net)} ${over}`;
  return `Square ${over}`;
}

/**
 * The card: { eyebrow, title, meta, headline, sub, you: { name, avatar }, them: { name, avatar },
 * score: { won, lost, even }, tiles: [{ value, label }] (two), sections: [{ label, lines }], note,
 * brand, footer, alt, text }. Each avatar is { text, bg, ink, src, mirror }: `youSrc` and `themSrc`
 * are pictures the screen can draw (a photo, or a buddy as an SVG data link); without one the image
 * draws initials on the person's colour. Their buddy is mirrored so the two face each other, as on
 * the screen; a photo never is.
 */
export function rivalryCardModel(card, { showAmounts = false, link = null, youSrc = null, themSrc = null } = {}) {
  const you = first(card.you.name) || 'You';
  const them = first(card.them.name) || 'Them';
  // Their profile keeps the money private: off, whatever the switch says
  const amounts = !!showAmounts && !card.private && card.moneyRounds > 0;
  const face = (p, src, mirror) => {
    const bg = backdropOf(p.avatar.bg);
    return { text: p.avatar.text || initialsOf(p.name) || '?', bg: bg.hex, ink: bg.ink, src: src || null, mirror: mirror && p.avatar.kind === 'buddy' };
  };
  const headline = card.rounds ? seriesWords(card, you, them) : 'No rounds together yet';
  const sub = streakWords(card.streak, you, them);
  const tiles = [
    { value: String(card.rounds), label: card.rounds === 1 ? 'Round together' : 'Rounds together' },
    { value: card.last ? card.last.date : EMPTY, label: card.last ? card.last.course || 'Last played' : 'Last played' },
  ];
  const sections = [];
  if (amounts) sections.push({ label: 'The money', lines: [moneyWords(card, you, them)] });
  const m = {
    eyebrow: 'Rivalry',
    title: `${you} v ${them}`,
    meta: card.first && card.rounds > 1 ? `Since ${card.first.date}` : card.rounds === 1 ? 'First round together' : '',
    headline, sub,
    you: { name: you, avatar: face(card.you, youSrc, false) },
    them: { name: them, avatar: face(card.them, themSrc, true) },
    score: { won: card.won, lost: card.lost, even: card.even },
    tiles, sections,
    // Points and reward rounds are in the record, not the dollars: said only when the dollars show
    note: amounts && card.otherRounds > 0 ? `${plural(card.otherRounds, 'round')} for points or a reward count in the record, not the money.` : null,
    brand: APP_NAME,
    footer: shortUrl(link) || null,
  };
  const even = card.even ? `, ${plural(card.even, 'even')}` : '';
  const alt = [
    `Rivalry card: ${m.title}`,
    `${m.headline}${even}`,
    m.sub,
    `${m.tiles[0].value} ${m.tiles[0].label.toLowerCase()}`,
    card.last ? `Last played ${card.last.date}${card.last.course ? ` at ${card.last.course}` : ''}` : null,
    ...m.sections.map(s => `${s.label}: ${s.lines.join('; ')}`),
    m.note,
  ].filter(Boolean).join('. ');
  const text = [
    m.title,
    `${m.headline}${even} over ${plural(card.rounds, 'round')}`,
    m.sub,
    card.last ? `Last played ${card.last.date}${card.last.course ? ` at ${card.last.course}` : ''}` : null,
    ...m.sections.flatMap(s => ['', ...s.lines]),
    m.note,
  ].filter(v => v != null).join('\n').trim();
  return { ...m, alt, text };
}
