// One finished round as History tells it on a card (overhaul, Layout Lab C): who came out on top,
// and the round's best moment when it had one ("Mike takes 5 skins", hole 6). Reads only: the
// winner is roundResults' standings, the moment is recap.js recapMoments, the same lines the
// day-after recap shows. Your own money stays where RoundRow always got it (history.js myNet).
// Pure, tested in round-story.test.js.
import { isJustPlaying, roundResults } from './round.js';
import { gameLabel, meFor, roundDate } from './format.js';
import { myNet } from './history.js';
import { money as dollars } from './golf.js';
import { JUST_PLAYING_TAG, niceRound } from './nice-round.js';
import { countsLine, roundTalkCounts } from './talk-counts.js';
import { recapMoments } from './recap.js';
import { PRIORITY } from './moments.js';
import { hasCashBet, playForOf, rewardOutcome, tabMoneyOf, unitFmt } from './play-for.js';
import { canonicalOf } from './pair-debts.js';

const EPS = 0.005;

/** "Oct 10", with the year when `withYear` and it isn't this one. */
export function dayLabel(t, withYear) {
  const d = new Date(t);
  const year = withYear && d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year });
}

/**
 * What a finished round's row or card shows (moved here from RoundRow.jsx so History's card and
 * the one-line row read the same): your amount (null when you weren't playing for anything), the
 * round's top player otherwise, the units (points and reward rounds never show dollars), a reward
 * round's side bets for money, its talk, the game's name, and the friendly finish for a round you
 * were just playing. `label` is the screen reader line.
 */
export function roundFacts(round, state) {
  const amount = myNet(round, state);
  const top = amount == null ? roundResults(round).standings[0] : null;
  // A points or reward round shows points (a reward round names the reward), never dollars
  const money = unitFmt(round);
  const pf = playForOf(round);
  const sub = pf.kind === 'reward' ? rewardOutcome(round, roundResults(round)).win.replace(/\.$/, '') : pf.kind === 'points' ? 'For bragging rights' : null;
  // A reward round's side bets for money are on the Tab, so the month's total counts them: say so here
  const me = amount == null ? null : meFor(round, state);
  const cash = pf.kind === 'reward' && hasCashBet(round, me) ? tabMoneyOf(round, me) : null;
  const cashText = cash == null ? '' : `. ${cash ? `${dollars(cash, { sign: true })} on side bets` : 'Side bets square'}`;
  // Its trash talk, in a few characters (talk.js)
  const talk = countsLine(roundTalkCounts(state, round));
  // A Big Game's group round goes by the game's name; the game's money is on its own page (big-money.js)
  const game = round.trip?.format === 'big' ? round.trip.name : gameLabel(round);
  // A round you were just playing shows your score, never money you weren't playing for
  const seat = meFor(round, state);
  const casual = round.players.some(p => p.id === seat) && isJustPlaying(round, seat);
  const nice = casual ? niceRound(round, seat) : null;
  const label0 = casual
    ? `${round.course.name}, ${game}, ${roundDate(round)}. ${nice ? `You shot ${nice.score}, ${nice.toParWords}` : 'No scores'}. ${JUST_PLAYING_TAG}`
    : amount == null
    ? `${round.course.name}, ${game}, ${roundDate(round)}. ${top ? `${top.name} ${money(top.amount, { sign: true })}` : ''}${sub ? `. ${sub}` : ''}`
    : `${round.course.name}, ${game}, ${roundDate(round)}. You ${money(amount, { sign: true })}${sub ? `. ${sub}` : ''}${cashText}`;
  const label = talk ? `${label0}. ${talk}` : label0;
  return { amount, top, money, pf, sub, cash, talk, game, casual, nice, label };
}

const firstOf = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';

/**
 * Who came out on top: { text, you } where `you` says it was you. "You won", "Mike won", "Mike and
 * Dave tied for the top", "All square", or a reward round's line ("Sam buys lunch"). Two of your own
 * ids in one round (a seat you took) are you either way.
 */
export function roundWinner(round, state, res = roundResults(round)) {
  if (playForOf(round).kind === 'reward') {
    const win = rewardOutcome(round, res).win;
    return win ? { text: win.replace(/\.$/, ''), you: false } : null;
  }
  const rows = res.standings || [];
  const top = rows[0];
  if (!top || !(top.amount > EPS)) return rows.length ? { text: 'All square', you: false } : null;
  const who = canonicalOf(state);
  const me = meFor(round, state);
  const isMe = id => id === me || (state.me && who(id) === who(state.me));
  const tied = rows.filter(r => Math.abs(r.amount - top.amount) < EPS);
  if (tied.length > 1) {
    const names = tied.map(r => (isMe(r.id) ? 'You' : firstOf(r.name)));
    const you = tied.some(r => isMe(r.id));
    return { text: tied.length === 2 ? `${names[0]} and ${names[1]} tied for the top` : `${tied.length}-way tie for the top`, you };
  }
  return isMe(top.id) ? { text: 'You won', you: true } : { text: `${firstOf(top.name)} won`, you: false };
}

// A round's moments mean replaying it hole by hole, so each is worked out once per version of its
// scores and kept here (the store clones the rounds on every change, so this keys on the content)
const cache = new Map();
const CACHE_MAX = 500;

/**
 * The round's best moment worth a line on its card: { hole, title, text }, or null. Everyday ones
 * (a lone skin, an early lead) aren't enough: only what ranks above the money lead (moments.js).
 */
export function roundHighlight(round) {
  if (!round?.holes?.length) return null;
  const key = `${round.id}|${round.game}|${JSON.stringify(round.scores || {})}|${JSON.stringify(round.marks || {})}|${JSON.stringify(round.presses || {})}`;
  if (cache.has(key)) return cache.get(key);
  let m = null;
  try { m = recapMoments(round, { limit: 1 })[0] || null; } catch { m = null; }
  const out = m && (PRIORITY[m.kind] ?? 0) > PRIORITY.money ? { hole: m.hole, title: m.title, text: m.text } : null;
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, out);
  return out;
}

/**
 * Which rounds get the bigger card: your best win in each month (money rounds only, and only a
 * win), so the good days stand out. `groups` is history.js monthGroups(); `amountOf` is myNet.
 * Returns a Set of round ids.
 */
export function bigDays(groups, amountOf) {
  const out = new Set();
  for (const g of groups) {
    let best = null, bestAmt = 0;
    for (const r of g.rounds) {
      if (playForOf(r).kind !== 'money') continue;
      const a = amountOf(r);
      if (a != null && a > bestAmt + EPS) { best = r; bestAmt = a; }
    }
    if (best && g.rounds.length > 1) out.add(best.id);
  }
  return out;
}
