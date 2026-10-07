// A crew's hall of fame (ROADMAP area 9): the season's money list, its champions, the biggest
// single-round wins and the crew's records, read from the rounds the crew already has. Display only:
// nothing is saved and no amount is worked out a new way. The money comes from the same place as the
// crew's tab and Close the books (crew-tabs.js, books.js seasonTotals): each round's tabResults, with a
// Big Game's money on its round, so the money list adds up to what the crew's tab had before anything
// was paid, person by person, to the cent.
//
// Honest units: dollars come only from rounds on the Tab (money rounds, and a reward round's side
// bets for money). Points rounds are listed in points and reward rounds by who won the reward, each on
// its own, and never added into the money.
//
// The season is the crew's open season: its rounds since the books last closed (all of them before
// any close), the same rounds Close the books would close. The hall of fame (past champions, biggest
// wins and records) goes back over every round the crew has on this phone. One person is one row,
// whichever of their ids a round has (people-links.js through canonicalOf). Pure, unit tested.
import { isJustPlaying, oneBall, roundResults } from './round.js';
import { countsMoney, hasCashBet, onTab, playForOf, rewardOutcome, tabResults } from './play-for.js';
import { crewKey, crewsOf, tabKeyOf } from './crew-tabs.js';
import { booksOf, lastBook } from './books.js';
import { canonicalOf, finishedAt } from './pair-debts.js';
import { nameOf } from './ledger.js';
import { skinsIn } from './deep-stats.js';
import { countsAsDone, withBigMoney } from './big-money.js';
import { tripsOf } from './trips.js';

const cents = v => Math.round((Number(v) || 0) * 100);
const EPS = 0.004;
/** How many of the crew's biggest single-round wins the hall of fame lists. */
export const TOP_WINS = 3;

/** Every finished round of a crew on this phone, any kind, oldest first: the rounds its tab would have if they had money. */
export function crewRounds(state, crewId, { now = Date.now() } = {}) {
  const trips = tripsOf(state), crews = crewsOf(state);
  return Object.values(state?.rounds || {})
    .filter(r => Array.isArray(r?.players) && countsAsDone(state, r) && finishedAt(r) <= now)
    .filter(r => tabKeyOf(state, r, { trips, crews }) === crewKey(crewId))
    .sort((a, b) => finishedAt(a) - finishedAt(b) || String(a.id).localeCompare(String(b.id)));
}

/** A seat had money of their own on the Tab in this round (not just playing, and a reward round only with a side bet for money). */
const inMoney = (r, id) => !isJustPlaying(r, id) && (countsMoney(r) || hasCashBet(r, id));

/** The round's Tab money, as the crew's tab and Close the books count it. */
const moneyOf = (state, r) => withBigMoney(state, r, tabResults(r)).balances || {};

/** Who topped a round's results (a tie at the top shares it), from balances of the seats in it; nobody when nobody came out ahead. */
function toppedBy(balances, seats) {
  const vals = seats.map(id => Number(balances[id]) || 0);
  const top = Math.max(...vals);
  if (!seats.length || top <= EPS) return [];
  return seats.filter((id, i) => top - vals[i] < EPS);
}

/**
 * The crew's open season:
 * - money: [{ id, cents, rounds, wins }] the money list, everyone who played a round on the Tab,
 *   by net, then wins, then rounds. `cents` is what they won or lost in the season's rounds before
 *   anything was paid; `wins` the money rounds they topped.
 * - points: [{ id, points, rounds, wins }] the season's points rounds, in points, by points.
 * - rewards: { names: ['Lunch', ...], rows: [{ id, won, rounds }] } the reward rounds, by rewards won.
 * - champion: the money list's leader when they're up ({ id, cents }), else null.
 * - mostWins: { ids, wins } the most rounds won, money and points rounds together (a tie at the
 *   top of a round shares it, and a tie for most names them all), or null.
 * - rounds: the season's rounds on the Tab, `since` when the season opened (the last close, or null).
 */
export function crewSeason(state, crewId, { now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const since = lastBook(state, crewKey(crewId))?.closedAt || 0;
  const all = crewRounds(state, crewId, { now }).filter(r => finishedAt(r) > since);
  const money = new Map(), points = new Map(), rewards = new Map();
  const row = (m, id, blank) => { if (!m.has(id)) m.set(id, { id, ...blank }); return m.get(id); };
  const rewardNames = [];
  let tabRounds = 0;
  for (const r of all) {
    const seats = r.players.map(p => p.id);
    if (onTab(r)) {
      tabRounds++;
      const bal = moneyOf(state, r);
      const inIt = seats.filter(id => inMoney(r, id));
      // The money of everyone in it, just as the crew's tab adds it up (a just-playing seat is $0)
      for (const [id, v] of Object.entries(bal)) if (cents(v)) row(money, who(id), { cents: 0, rounds: 0, wins: 0 }).cents += cents(v);
      for (const id of inIt) row(money, who(id), { cents: 0, rounds: 0, wins: 0 }).rounds++;
      if (countsMoney(r)) for (const id of toppedBy(bal, inIt)) row(money, who(id), { cents: 0, rounds: 0, wins: 0 }).wins++;
    }
    const pf = playForOf(r);
    if (pf.kind === 'points') {
      const res = roundResults(r);
      const inIt = seats.filter(id => !isJustPlaying(r, id));
      for (const id of inIt) {
        const p = row(points, who(id), { points: 0, rounds: 0, wins: 0 });
        p.points = Math.round((p.points + (Number(res.balances?.[id]) || 0)) * 100) / 100;
        p.rounds++;
      }
      for (const id of toppedBy(res.balances || {}, inIt)) row(points, who(id), { points: 0, rounds: 0, wins: 0 }).wins++;
    } else if (pf.kind === 'reward') {
      const out = rewardOutcome(r, roundResults(r));
      if (!rewardNames.includes(pf.reward)) rewardNames.push(pf.reward);
      for (const id of seats) if (!isJustPlaying(r, id)) row(rewards, who(id), { won: 0, rounds: 0 }).rounds++;
      for (const id of out?.winners || []) row(rewards, who(id), { won: 0, rounds: 0 }).won++;
    }
  }
  const byName = (a, b) => nameOf(state, a.id).localeCompare(nameOf(state, b.id)) || a.id.localeCompare(b.id);
  const moneyRows = [...money.values()].sort((a, b) => b.cents - a.cents || b.wins - a.wins || b.rounds - a.rounds || byName(a, b));
  const pointRows = [...points.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || byName(a, b));
  const rewardRows = [...rewards.values()].sort((a, b) => b.won - a.won || a.rounds - b.rounds || byName(a, b));
  const lead = moneyRows[0];
  // A win is topping a money round or a points round, as Trevor picked
  const winsBy = new Map();
  for (const x of [...moneyRows, ...pointRows]) winsBy.set(x.id, (winsBy.get(x.id) || 0) + x.wins);
  const most = Math.max(0, ...winsBy.values());
  return {
    money: moneyRows,
    points: pointRows,
    rewards: { names: rewardNames, rows: rewardRows },
    champion: lead && lead.cents > 0 ? { id: lead.id, cents: lead.cents } : null,
    mostWins: most ? { ids: [...winsBy].filter(([, n]) => n === most).map(([id]) => id).sort(), wins: most } : null,
    rounds: tabRounds,
    since: since || null,
  };
}

/** Holes a player finished in a round, with every one scored, or null. */
function grossOf(r, id) {
  if (oneBall(r.game) || !Array.isArray(r.holes) || !r.holes.length) return null;
  let total = 0;
  for (const h of r.holes) {
    const s = r.scores?.[h.no]?.[id];
    if (typeof s !== 'number' || !(s > 0)) return null;
    total += s;
  }
  return total;
}

/**
 * The crew's hall of fame, over every round it has on this phone:
 * - seasons: [{ id, name, closedAt, rounds, champion: { id, cents } | null }] its closed seasons, newest first,
 *   each won by the top of its saved final net (only when they finished up).
 * - biggestWins: [{ roundId, id, cents, course, at }] the biggest single-round wins on the Tab, biggest first.
 * - records: { streak, skins, low, regular }, each null when the rounds don't have one:
 *   streak  { id, n } the most money or points rounds won in a row (of the rounds they played), two or more;
 *   skins   { id, skins, roundId, course, at } the most skins in one round;
 *   low     { id, strokes, holes, roundId, course, at } the low score over a full round (18 holes
 *           when the crew has played one, else 9), every hole scored, one-ball games left out;
 *   regular { id, n, ids } the most rounds played (ids: everyone tied on n, id first).
 * - players: how many people played in the crew's rounds.
 */
export function crewHall(state, crewId, { now = Date.now() } = {}) {
  const who = canonicalOf(state);
  const rounds = crewRounds(state, crewId, { now });
  const seasons = booksOf(state, crewKey(crewId)).map(b => {
    const top = (b.totals || [])[0];
    return { id: b.id, name: b.name, closedAt: b.closedAt, rounds: (b.rounds || []).length, champion: top && top.cents > 0 ? { id: who(top.id), cents: top.cents } : null };
  });
  const wins = [];
  const run = new Map(), bestRun = new Map(), played = new Map();
  let skins = null;
  const streakStep = (inIt, bal) => {
    const top = new Set(toppedBy(bal, inIt).map(who));
    for (const id of new Set(inIt.map(who))) {
      const n = top.has(id) ? (run.get(id) || 0) + 1 : 0;
      run.set(id, n);
      if (n > (bestRun.get(id) || 0)) bestRun.set(id, n);
    }
  };
  const lows = { 18: null, 9: null };
  for (const r of rounds) {
    const at = finishedAt(r);
    const course = r.course?.name || '';
    const seats = r.players.map(p => p.id);
    for (const id of seats) if (!isJustPlaying(r, id)) played.set(who(id), (played.get(who(id)) || 0) + 1);
    if (onTab(r)) {
      const bal = moneyOf(state, r);
      for (const id of seats) {
        const c = inMoney(r, id) ? cents(bal[id]) : 0;
        if (c > 0) wins.push({ roundId: r.id, id: who(id), cents: c, course, at });
      }
      if (countsMoney(r)) streakStep(seats.filter(id => inMoney(r, id)), bal);
    }
    const res = roundResults(r);
    // A points round counts toward a win streak too
    if (playForOf(r).kind === 'points') streakStep(seats.filter(id => !isJustPlaying(r, id)), res.balances || {});
    for (const id of seats) {
      if (isJustPlaying(r, id)) continue;
      const s = skinsIn(r, id, res);
      if (s.skins > 0 && (!skins || s.skins > skins.skins)) skins = { id: who(id), skins: s.skins, roundId: r.id, course, at };
      const g = grossOf(r, id);
      const holes = r.holes?.length;
      if (g != null && (holes === 18 || holes === 9) && (!lows[holes] || g < lows[holes].strokes)) lows[holes] = { id: who(id), strokes: g, holes, roundId: r.id, course, at };
    }
  }
  const byName = (a, b) => nameOf(state, a).localeCompare(nameOf(state, b)) || a.localeCompare(b);
  const most = m => {
    const [id, n] = [...m].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))[0] || [];
    return id ? { id, n } : null;
  };
  const streak = most(bestRun);
  // Most rounds ties often (a crew that always plays together), so it names everyone at the top
  const regular = most(played);
  if (regular) regular.ids = [...played].filter(([, n]) => n === regular.n).map(([id]) => id).sort(byName);
  return {
    seasons,
    biggestWins: wins.sort((a, b) => b.cents - a.cents || a.at - b.at || a.id.localeCompare(b.id)).slice(0, TOP_WINS),
    records: {
      streak: streak && streak.n >= 2 ? streak : null,
      skins,
      low: lows[18] || lows[9],
      regular,
    },
    rounds: rounds.length,
    players: played.size,
  };
}

/** Your crews with a hall of fame worth opening: a finished round of the crew's, or a closed season. Smallest crew first. */
export function hallCrews(state, { now = Date.now() } = {}) {
  return crewsOf(state).filter(c => booksOf(state, crewKey(c.id)).length || crewRounds(state, c.id, { now }).length);
}
