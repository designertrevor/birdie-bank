// Your stats, deeper: results and net by game and by course, how your Nassau and match play
// presses went, skins won and your biggest wins, over any set of finished rounds. Pure, so every
// number is tested in one place, and nothing here changes any amount: it reads roundResults() and
// tabResults() the same way History, the profile and the Tab do.
//
// Honest units:
//  • Dollars come only from rounds played for money, plus a lunch (reward) round's side bets for
//    money, which are on the Tab (tabResults). Nothing else is ever dollars.
//  • Points and reward rounds are counted in points (one for each dollar the bets would make),
//    kept apart from the dollars so the two never add up into one number.
//  • Won, lost and even are by each game's own result, whatever it was played for.
// Your seat in a round is the same one the profile uses: this phone's "me" for the round when it's
// one of yours, otherwise any id that is you (people-links.js).
import { GAMES, SIDE_GAMES, BETS_LABEL, gameView, isJustPlaying, playsGame, roundResults, sides } from './round.js';
import { countsMoney, onTab, playForOf, rewardNoun, tabResults } from './play-for.js';
import { betsOf, isCashBet } from './pair-bets.js';
import { linksOf } from './people-links.js';
import { meFor } from './format.js';
import { roundTime } from './history.js';
import { bigNoMoney, countsAsDone, withBigMoney } from './big-money.js';

const cents = v => Math.round(v * 100) / 100 || 0;
const EPS = 0.004;
const sign = v => (v > EPS ? 1 : v < -EPS ? -1 : 0);
const blankRecord = () => ({ won: 0, lost: 0, even: 0 });
const tally = (rec, v) => { const s = sign(v); if (s > 0) rec.won++; else if (s < 0) rec.lost++; else rec.even++; };
/** How many of your biggest wins the stats list. */
export const BIGGEST_WINS = 3;

/** Every id that is you on this phone: your person's ids and the seats you took. */
export function myIdSet(state) {
  const L = linksOf(state);
  const mine = new Set(state?.me ? L.groupOf(state.me) : []);
  for (const r of Object.values(state?.rounds || {})) if (r?.localMe) mine.add(r.localMe);
  return mine;
}

/** Your seat in a round, or null when you weren't playing in it. */
export function seatIn(round, state, mine = myIdSet(state)) {
  if (!Array.isArray(round?.players)) return null;
  const local = meFor(round, state);
  if (mine.has(local) && round.players.some(p => p.id === local)) return local;
  return round.players.find(p => mine.has(p.id))?.id || null;
}

/** What a game is called on a stats line: the main game's name, or the side game's label. */
function gameName(key) {
  if (key === 'bets') return BETS_LABEL;
  // A side game that goes by another name than the main game with its key (Junk, played as Dots)
  if (key.startsWith('side:')) return SIDE_GAMES[key.slice(5)]?.label || key.slice(5);
  return GAMES[key]?.name || SIDE_GAMES[key]?.label || key;
}

/**
 * A stats line's key for a game in a round: the main game's key, or a side game's. A side game
 * that has a main game's key under another name (Junk is the side game of Dots) gets a line of
 * its own, so it's never listed as the main game. Skins is Skins either way, so it's one line.
 */
function partKey(round, key) {
  if (key === 'main') return round.game;
  return GAMES[key] && SIDE_GAMES[key] && GAMES[key].name !== SIDE_GAMES[key].label ? `side:${key}` : key;
}

/** Whether your seat had a side bet in the round (only then does the side bets line count it). */
const inBets = (round, seat, pred = () => true) => betsOf(round).some(b => pred(b) && b.sides.includes(seat));

/**
 * Your dollars in a round, as the Tab has them: a money round's net, a lunch round's side bets for
 * money when you had one, or null (no money for you in it).
 */
export function dollarsIn(round, seat, res = roundResults(round)) {
  if (countsMoney(round)) return cents(res.balances[seat] || 0);
  if (onTab(round) && inBets(round, seat, b => isCashBet(round, b))) return cents(tabResults(round, res).balances[seat] || 0);
  return null;
}

/**
 * Each game you played in a round with your result in it: [{ key, dollars, points }]. `key` is the
 * game ('nassau', 'skins', ...), the same game as a main game or a side game counting as one line,
 * and 'bets' for the side bets between two players. Exactly one of dollars and points is set, except
 * a lunch round's side bets when you had both kinds (points bets and money bets).
 */
export function gameParts(round, seat, res = roundResults(round)) {
  const money = countsMoney(round);
  const parts = [];
  const byGame = res.detail?.byGame;
  if (!byGame) {
    const v = res.balances[seat] || 0;
    parts.push({ key: round.game, dollars: money ? cents(v) : null, points: money ? null : cents(v) });
  } else {
    for (const [key, g] of Object.entries(byGame)) {
      if (key === 'bets') {
        if (!inBets(round, seat, b => !isCashBet(round, b))) continue;
      } else if (!playsGame(round, seat, key)) continue;
      const v = g.balances?.[seat] || 0;
      const game = key === 'bets' ? key : partKey(round, key);
      parts.push({ key: game, dollars: money ? cents(v) : null, points: money ? null : cents(v) });
    }
  }
  // A lunch round's side bets for money are dollars on the Tab, on the side bets line
  if (!money && onTab(round) && inBets(round, seat, b => isCashBet(round, b))) {
    const d = cents(tabResults(round, res).balances[seat] || 0);
    const bets = parts.find(p => p.key === 'bets');
    if (bets) bets.dollars = d;
    else parts.push({ key: 'bets', dollars: d, points: null });
  }
  return parts;
}

/**
 * Your presses in a Nassau or match play round: { made, against } as won, lost and halved. A press
 * is yours when your side called it (or it went on for your side automatically); "against" is a
 * press the other side called on you. A press still level when the round ended is halved; one
 * whose holes were never played (the round finished before it started) isn't counted at all.
 */
export function pressesIn(round, seat, res = roundResults(round)) {
  const out = { made: { won: 0, lost: 0, halved: 0 }, against: { won: 0, lost: 0, halved: 0 } };
  if (round.game !== 'nassau' && round.game !== 'match') return out;
  if (!playsGame(round, seat, 'main')) return out;
  const view = gameView(round, 'main') || round;
  const mySide = sides(view).findIndex(s => s.includes(seat));
  if (mySide < 0) return out;
  const lines = res.detail?.lines || res.detail?.byGame?.main?.detail?.lines || [];
  for (const l of lines) {
    // A press none of whose holes were played (the round ended first) never had a result
    if (!l.press || !l.status?.played) continue;
    const rec = l.by === mySide ? out.made : out.against;
    const leader = l.status?.leader;
    if (leader == null) rec.halved++;
    else if (leader === mySide) rec.won++;
    else rec.lost++;
  }
  return out;
}

/** Skins you won in a round, main game and side Skins together: { skins, dollars } (dollars only for money). */
export function skinsIn(round, seat, res = roundResults(round)) {
  let skins = 0, amount = 0, played = false;
  const add = d => {
    if (!d) return;
    played = true;
    const w = d.skinsWon?.[seat];
    if (w) { skins += w.skins || 0; amount += w.amount || 0; }
  };
  const byGame = res.detail?.byGame;
  if (byGame) {
    if (round.game === 'skins' && byGame.main && playsGame(round, seat, 'main')) add(byGame.main.detail);
    if (byGame.skins && playsGame(round, seat, 'skins')) add(byGame.skins.detail);
  } else if (round.game === 'skins') add(res.detail);
  return { played, skins: Math.round(skins * 100) / 100, dollars: countsMoney(round) ? cents(amount) : null };
}

/** Rounds you played in, oldest first (watched rounds and rounds that won't add up are left out). */
function yourRounds(state, rounds) {
  const mine = myIdSet(state);
  const out = [];
  for (const r of rounds) {
    if (!r || !countsAsDone(state, r) || !Array.isArray(r.players)) continue;
    const seat = seatIn(r, state, mine);
    if (!seat) continue;
    let res;
    // A Big Game's round has your money from the whole game on the one round it goes on, as History does
    try { res = withBigMoney(state, r, roundResults(r)); } catch { continue; }
    // A round you were just playing is a round played, never a money or points round of yours
    out.push({ r, seat, res, noMoney: bigNoMoney(state, r) || isJustPlaying(r, seat) });
  }
  return out.sort((a, b) => roundTime(a.r) - roundTime(b.r));
}

const blankLine = (key, name) => ({ key, name, rounds: 0, record: blankRecord(), dollars: { net: 0, rounds: 0 }, points: { net: 0, rounds: 0 } });
function addTo(line, { dollars, points }) {
  line.rounds++;
  if (dollars != null) { line.dollars.net = cents(line.dollars.net + dollars); line.dollars.rounds++; }
  if (points != null) { line.points.net = cents(line.points.net + points); line.points.rounds++; }
  // Won or lost by dollars when there are some, otherwise by points
  tally(line.record, dollars != null ? dollars : points ?? 0);
}
/** Most rounds first, then the bigger money, then the name. */
const byRounds = (a, b) => b.rounds - a.rounds || b.dollars.net - a.dollars.net || b.points.net - a.points.net || a.name.localeCompare(b.name);

/**
 * Your deeper stats over these finished rounds (any order; usually roundsInRange from History):
 * {
 *   rounds, record: { won, lost, even },
 *   dollars: { net, rounds }, points: { net, rounds }, lunchDollars: rounds where a lunch round's money bets counted,
 *   games:   [{ key, name, rounds, record, dollars: { net, rounds }, points: { net, rounds } }],
 *   courses: [{ key, name, place, rounds, record, dollars, points, last }],
 *   presses: { rounds, made: { won, lost, halved }, against: { won, lost, halved } },
 *   skins:   { rounds, won, dollars: { net, rounds }, best: { id, skins, at, course } | null },
 *   biggest: [{ id, amount, at, course, game, lunch, reward }] your biggest wins in dollars, biggest first
 *            (`lunch` for a reward round's side bets for money, `reward` what it was played for: "lunch", "a drink"),
 * }
 */
export function deepStats(state, rounds = Object.values(state?.rounds || {})) {
  const record = blankRecord();
  const dollars = { net: 0, rounds: 0 }, points = { net: 0, rounds: 0 };
  let lunchDollars = 0;
  const games = new Map(), courses = new Map();
  const presses = { rounds: 0, made: { won: 0, lost: 0, halved: 0 }, against: { won: 0, lost: 0, halved: 0 } };
  const skins = { rounds: 0, won: 0, dollars: { net: 0, rounds: 0 }, best: null };
  const wins = [];
  const list = yourRounds(state, rounds);
  for (const { r, seat, res, noMoney } of list) {
    const at = roundTime(r);
    const total = res.balances[seat] || 0;
    // A Big Game's round with no money on it is a round played, never an even money round
    const cash = noMoney ? null : dollarsIn(r, seat, res);
    const pts = noMoney || countsMoney(r) ? null : cents(total);
    if (!noMoney) tally(record, total);
    if (cash != null) { dollars.net = cents(dollars.net + cash); dollars.rounds++; if (!countsMoney(r)) lunchDollars++; }
    if (pts != null) { points.net = cents(points.net + pts); points.rounds++; }

    for (const part of noMoney ? [] : gameParts(r, seat, res)) {
      const line = games.get(part.key) || blankLine(part.key, gameName(part.key));
      addTo(line, part);
      games.set(part.key, line);
    }

    const cname = r.course?.name || 'No course';
    const ckey = r.course?.id ? `id:${r.course.id}` : `name:${cname.toLowerCase()}`;
    const c = courses.get(ckey) || { ...blankLine(ckey, cname), place: r.course?.city || '', last: 0 };
    c.rounds++;
    if (!noMoney) tally(c.record, total);
    if (cash != null) { c.dollars.net = cents(c.dollars.net + cash); c.dollars.rounds++; }
    if (pts != null) { c.points.net = cents(c.points.net + pts); c.points.rounds++; }
    if (at >= c.last) { c.last = at; c.name = cname; if (r.course?.city) c.place = r.course.city; }
    courses.set(ckey, c);

    const p = pressesIn(r, seat, res);
    const n = Object.values(p.made).concat(Object.values(p.against)).reduce((a, v) => a + v, 0);
    if (n) {
      presses.rounds++;
      for (const side of ['made', 'against']) for (const k of ['won', 'lost', 'halved']) presses[side][k] += p[side][k];
    }

    const s = skinsIn(r, seat, res);
    if (s.played) {
      skins.rounds++;
      skins.won = Math.round((skins.won + s.skins) * 100) / 100;
      if (s.dollars != null) { skins.dollars.net = cents(skins.dollars.net + s.dollars); skins.dollars.rounds++; }
      if (s.skins > 0 && (!skins.best || s.skins >= skins.best.skins)) skins.best = { id: r.id, skins: s.skins, at, course: r.course?.name || '' };
    }

    if (cash != null && cash > EPS) {
      const pf = playForOf(r);
      wins.push({ id: r.id, amount: cash, at, course: r.course?.name || '', game: gameName(r.game), lunch: pf.kind === 'reward', reward: pf.kind === 'reward' ? rewardNoun(pf.reward) : null });
    }
  }
  // Biggest first; the same amount goes to the more recent round
  wins.sort((a, b) => b.amount - a.amount || b.at - a.at);
  return {
    rounds: list.length, record, dollars, points, lunchDollars,
    games: [...games.values()].sort(byRounds),
    courses: [...courses.values()].sort((a, b) => byRounds(a, b) || b.last - a.last),
    presses, skins,
    biggest: wins.slice(0, BIGGEST_WINS),
  };
}

/** A press record's total: how many presses it counts. */
export const pressCount = rec => (rec ? rec.won + rec.lost + rec.halved : 0);

/** The share of presses won, as a whole percent (halved ones count as not won), or null with none. */
export function winRate(rec) {
  const n = pressCount(rec);
  return n ? Math.round((rec.won / n) * 100) : null;
}

/**
 * The line that's best: the most dollars won (at least one money round, and ahead), or with no
 * money ahead, the best record by wins over rounds (at least two rounds). Null when nothing stands out.
 */
export function bestOf(lines) {
  const money = lines.filter(l => l.dollars.rounds && l.dollars.net > EPS).sort((a, b) => b.dollars.net - a.dollars.net)[0];
  if (money) return { line: money, by: 'dollars' };
  const rate = l => l.record.won / l.rounds;
  const rec = lines.filter(l => l.rounds >= 2 && l.record.won > l.record.lost).sort((a, b) => rate(b) - rate(a) || b.rounds - a.rounds)[0];
  return rec ? { line: rec, by: 'record' } : null;
}

// --------------------------- how the stats read ------------------------------

const EMPTY = '–';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Skins can split on a tie: 4, 4½, 1.3. */
export function skinsText(n) {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return String(v);
  const whole = Math.floor(v);
  if (Math.abs(v - whole - 0.5) < 0.01) return `${whole || ''}½`;
  return v.toFixed(1);
}

/**
 * A line's money as it reads on the right: { text, tone, unit } in dollars when it has money rounds,
 * otherwise in points, otherwise an en dash. `fmt` is { money, points } (golf.js money, play-for.js points).
 */
export function lineAmount(line, fmt) {
  if (line.dollars.rounds) return { text: fmt.money(line.dollars.net, { sign: true }), tone: line.dollars.net > EPS ? 'pos' : line.dollars.net < -EPS ? 'neg' : '', unit: 'dollars' };
  if (line.points.rounds) return { text: fmt.points(line.points.net, { sign: true }), tone: '', unit: 'points' };
  return { text: EMPTY, tone: '', unit: null };
}

/** "4 rounds · 3–1", with the even ones when there are some ("3–1–1"), and "2 for points" when money and points mix. */
export function lineSub(line, fmt) {
  const r = line.record;
  const rec = (r.even ? [r.won, r.lost, r.even] : [r.won, r.lost]).join(EMPTY);
  const parts = [plural(line.rounds, 'round'), rec];
  if (line.dollars.rounds && line.points.rounds) parts.push(`${fmt.points(line.points.net, { sign: true })} in ${line.points.rounds} for points`);
  return parts.join(' · ');
}

/** "2 won, 1 lost, 1 halved" (only the parts there are), or "None yet". */
export function pressText(rec) {
  if (!pressCount(rec)) return 'None yet';
  const parts = [`${rec.won} won`];
  if (rec.lost) parts.push(`${rec.lost} lost`);
  if (rec.halved) parts.push(`${rec.halved} halved`);
  return parts.join(', ');
}

/** The best line in a few words: "Nassau, +$40" by the money, "Nassau, 3–1" by the record, or an en dash. */
export function bestText(best, moneyFmt) {
  if (!best) return EMPTY;
  const { line, by } = best;
  const r = line.record;
  return `${line.name}, ${by === 'dollars' ? moneyFmt(line.dollars.net, { sign: true }) : (r.even ? [r.won, r.lost, r.even] : [r.won, r.lost]).join(EMPTY)}`;
}
