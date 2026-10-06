// Your year in review (ROADMAP areas 8 and 12): a free card anyone can share, sized for Stories.
// Rounds, courses, your low round, favorite game, who you played with most, the moment of the year
// and, only when you choose to show amounts, your money. Pure, so every number is tested in one
// place, and nothing here changes any amount: it reads the rounds the way your profile and Season do.
//
// Honest units: the money is the Tab's dollars (money rounds, and a reward round's side bets for
// money, with a Big Game's money on its round), the same as Season. Points and reward rounds count
// as rounds played and for the record, never as dollars.
//
// The card goes outside the group (Stories), so it carries first names only, the money only with
// Show amounts on (the one remembered switch, off until you turn it on), and never the name of a
// friend whose profile is Only you (share.js keepsMoneyPrivate): they're "your most-played partner".
import { GAMES, isJustPlaying, oneBall, roundResults } from './round.js';
import { countsMoney, hasCashBet, onTab, tabResults } from './play-for.js';
import { myIdSet, seatIn } from './deep-stats.js';
import { roundTime } from './history.js';
import { linksOf } from './people-links.js';
import { nameOf } from './ledger.js';
import { money } from './golf.js';
import { bigNoMoney, countsAsDone, withBigMoney } from './big-money.js';
import { keepsMoneyPrivate } from './share.js';
import { shortUrl } from './share-cards.js';
import { APP_NAME } from './app-name.js';

const cents = v => Math.round(v * 100) / 100 || 0;
const EPS = 0.004;
const first = n => String(n || '').trim().split(/\s+/)[0] || '';
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
/** Fewer rounds than this in a year and there's no card to make yet. */
export const MIN_ROUNDS = 1;

/** Your score over every hole of a round, or null (a hole not scored, or a one-ball game's team score). */
function grossOf(r, seat) {
  if (oneBall(r.game) || !Array.isArray(r.holes) || !r.holes.length) return null;
  let total = 0;
  for (const h of r.holes) {
    const s = r.scores?.[h.no]?.[seat];
    if (typeof s !== 'number' || !(s > 0)) return null;
    total += s;
  }
  return total;
}

/** Your holes under par in a round: { aces, eagles, birdies } (an ace on a par 4 or 5 counts as an ace, not an eagle). */
function underPar(r, seat) {
  const out = { aces: [], eagles: 0, birdies: 0 };
  if (oneBall(r.game)) return out;
  for (const h of r.holes || []) {
    const s = r.scores?.[h.no]?.[seat];
    if (typeof s !== 'number' || !(s > 0) || !h.par) continue;
    if (s === 1) out.aces.push(h.no);
    else if (s <= h.par - 2) out.eagles++;
    else if (s === h.par - 1) out.birdies++;
  }
  return out;
}

/**
 * Your year, from the finished rounds you played in it (not ones you only watched):
 * { year, rounds, holes, courses: { count, top: { name, rounds } | null },
 *   low: { strokes, holes, course, at } | null  your low score over a full round (18 when you've played one, else 9),
 *   favoriteGame: { id, name, rounds } | null  the main game you played most,
 *   partner: { id, rounds } | null  who you played the most rounds with (one person, whichever ids),
 *   record: { won, lost, even }  by your own result in each round, points and rewards too,
 *   birdies, eagles, aces,
 *   moment: { kind: 'ace' | 'eagle' | 'birdies' | 'streak', n, course, at, hole? } | null  the year's best moment,
 *   money: { net, rounds, best: { amount, course, at } | null } | null  the Tab's dollars, null with no money round }
 */
export function yearInReview(state, year = new Date().getFullYear()) {
  const mine = myIdSet(state);
  const L = linksOf(state);
  const meKey = state?.me ? L.personOf(state.me) : null;
  const done = Object.values(state?.rounds || {})
    .filter(r => r && Array.isArray(r.players) && countsAsDone(state, r) && new Date(roundTime(r)).getFullYear() === year)
    .sort((a, b) => roundTime(a) - roundTime(b) || String(a.id).localeCompare(String(b.id)));
  const record = { won: 0, lost: 0, even: 0 };
  const courses = new Map(), games = new Map(), partners = new Map();
  const lows = { 18: null, 9: null };
  let rounds = 0, holes = 0, birdies = 0, eagles = 0;
  const aces = [];
  let bestBirdies = null, run = 0, bestRun = null;
  let net = 0, moneyRounds = 0, best = null;
  for (const r of done) {
    const seat = seatIn(r, state, mine);
    if (!seat) continue;
    rounds++;
    holes += r.holes?.length || 0;
    const at = roundTime(r);
    const course = r.course?.name || '';
    if (course) courses.set(course, (courses.get(course) || 0) + 1);
    for (const p of r.players) {
      const k = L.personOf(p.id);
      if (mine.has(p.id) || k === meKey) continue;
      partners.set(k, (partners.get(k) || 0) + 1);
    }
    const g = grossOf(r, seat);
    const n = r.holes?.length;
    if (g != null && (n === 18 || n === 9) && (!lows[n] || g <= lows[n].strokes)) lows[n] = { strokes: g, holes: n, course, at };
    const u = underPar(r, seat);
    birdies += u.birdies; eagles += u.eagles;
    for (const hole of u.aces) aces.push({ hole, course, at });
    if (u.birdies >= 2 && (!bestBirdies || u.birdies >= bestBirdies.n)) bestBirdies = { n: u.birdies, course, at };
    // Someone just playing had no bet, so no result and no money of their own
    if (isJustPlaying(r, seat) || bigNoMoney(state, r)) continue;
    if (GAMES[r.game]) {
      const gm = games.get(r.game) || { id: r.game, name: GAMES[r.game].name, rounds: 0, last: 0 };
      gm.rounds++; gm.last = at;
      games.set(r.game, gm);
    }
    const res = withBigMoney(state, r, roundResults(r));
    const amt = res.balances?.[seat] || 0;
    if (amt > EPS) record.won++; else if (amt < -EPS) record.lost++; else record.even++;
    // A run of rounds you came out on top of, any kind of round
    const vals = r.players.filter(p => !isJustPlaying(r, p.id)).map(p => res.balances?.[p.id] || 0);
    const top = Math.max(...vals);
    run = amt > EPS && top - amt < EPS ? run + 1 : 0;
    if (run >= 2 && (!bestRun || run >= bestRun.n)) bestRun = { n: run, course, at };
    // The Tab's dollars: a money round's net, or a reward round's side bets for money when you had one
    const cash = countsMoney(r) ? amt : onTab(r) && hasCashBet(r, seat) ? withBigMoney(state, r, tabResults(r)).balances?.[seat] || 0 : null;
    if (cash != null) {
      moneyRounds++;
      net = cents(net + cash);
      if (cash > EPS && (!best || cash > best.amount)) best = { amount: cents(cash), course, at };
    }
  }
  const topCourse = [...courses].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const fav = [...games.values()].sort((a, b) => b.rounds - a.rounds || b.last - a.last)[0];
  const partner = [...partners].sort((a, b) => b[1] - a[1] || nameOf(state, a[0]).localeCompare(nameOf(state, b[0])) || a[0].localeCompare(b[0]))[0];
  const ace = aces.at(-1);
  const moment = ace ? { kind: 'ace', n: aces.length, ...ace }
    : eagles ? { kind: 'eagle', n: eagles, ...lastEagle(done, state, mine) }
      : bestRun && bestRun.n >= 3 ? { kind: 'streak', ...bestRun }
        : bestBirdies ? { kind: 'birdies', ...bestBirdies }
          : bestRun ? { kind: 'streak', ...bestRun }
            : null;
  return {
    year, rounds, holes,
    courses: { count: courses.size, top: topCourse ? { name: topCourse[0], rounds: topCourse[1] } : null },
    low: lows[18] || lows[9],
    favoriteGame: fav ? { id: fav.id, name: fav.name, rounds: fav.rounds } : null,
    partner: partner ? { id: partner[0], rounds: partner[1] } : null,
    record, birdies, eagles, aces: aces.length,
    moment,
    money: moneyRounds ? { net, rounds: moneyRounds, best } : null,
  };
}

/** Where your last eagle of the year was: { course, at }. */
function lastEagle(done, state, mine) {
  for (const r of [...done].reverse()) {
    const seat = seatIn(r, state, mine);
    if (seat && underPar(r, seat).eagles) return { course: r.course?.name || '', at: roundTime(r) };
  }
  return {};
}

/** The moment, in words for the card: "A hole in one on 7 at Oak Hollow". */
export function momentText(m) {
  if (!m) return null;
  const at = m.course ? ` at ${m.course}` : '';
  if (m.kind === 'ace') return m.n > 1 ? `${m.n} holes in one, the last on ${m.hole}${at}` : `A hole in one on ${m.hole}${at}`;
  if (m.kind === 'eagle') return m.n > 1 ? `${m.n} eagles, the last${at}` : `An eagle${at}`;
  if (m.kind === 'streak') return `${m.n} rounds won in a row`;
  return `${m.n} birdies in one round${at}`;
}

/**
 * The card: { eyebrow, title, meta, headline, sub, tiles: [{ value, label }] (up to six), sections, footer, alt, text }.
 * With `showAmounts` off no dollar figure appears anywhere, in the image, its alt text or the text.
 */
export function wrappedCardModel(state, y, { showAmounts = false, link = null } = {}) {
  const me = state?.players?.[state?.me]?.name;
  const partnerName = y.partner && !keepsMoneyPrivate(state, y.partner.id) ? first(nameOf(state, y.partner.id)) : null;
  const rec = y.record;
  const tiles = [
    { value: String(y.rounds), label: y.rounds === 1 ? 'Round' : 'Rounds' },
    { value: String(y.courses.count), label: y.courses.count === 1 ? 'Course' : 'Courses' },
    { value: y.low ? String(y.low.strokes) : '–', label: y.low ? `Low ${y.low.holes}` : 'Low round' },
    { value: `${rec.won}–${rec.lost}${rec.even ? `–${rec.even}` : ''}`, label: rec.even ? 'Won, lost, even' : 'Won, lost' },
  ];
  if (y.birdies || y.eagles) tiles.push({ value: String(y.birdies), label: y.birdies === 1 ? 'Birdie' : 'Birdies' });
  if (y.favoriteGame) tiles.push({ value: y.favoriteGame.name, label: 'Favorite game' });
  const lines = [];
  if (y.partner) lines.push(partnerName ? `${partnerName}, ${plural(y.partner.rounds, 'round')} together` : `Your most-played partner, ${plural(y.partner.rounds, 'round')} together`);
  if (y.courses.top && y.courses.count > 1) lines.push(`${y.courses.top.name}, ${plural(y.courses.top.rounds, 'round')}`);
  const sections = [
    ...(lines.length ? [{ label: 'Most played', lines }] : []),
    ...(y.moment ? [{ label: 'Moment of the year', lines: [momentText(y.moment)] }] : []),
  ];
  let sub = `${plural(y.holes, 'hole')} played`;
  if (showAmounts && y.money) {
    sections.push({ label: 'The money', lines: [`${money(y.money.net, { sign: true })} over ${plural(y.money.rounds, 'round')}${y.money.best ? `, best day ${money(y.money.best.amount, { sign: true })}` : ''}`] });
  }
  if (!y.rounds) sub = 'No rounds yet';
  const m = {
    eyebrow: 'Year in review',
    title: me ? `${first(me)}’s ${y.year} in golf` : `My ${y.year} in golf`,
    meta: `${APP_NAME} · ${y.year}`,
    headline: plural(y.rounds, 'round'),
    sub,
    tiles,
    sections,
    footer: shortUrl(link) || APP_NAME,
  };
  const alt = [
    `Year in review card: ${m.title}`,
    `${m.headline}, ${m.sub}`,
    m.tiles.map(t => `${t.label} ${t.value}`).join(', '),
    ...m.sections.map(s => `${s.label}: ${s.lines.join('; ')}`),
  ].join('. ');
  const text = [m.title, `${m.headline} · ${m.sub}`, '', ...m.tiles.map(t => `${t.label}: ${t.value}`), ...m.sections.flatMap(s => ['', `${s.label}:`, ...s.lines])].join('\n').trim();
  return { ...m, alt, text };
}
