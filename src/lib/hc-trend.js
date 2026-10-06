// Your handicap trend: a rough index worked out from your own finished rounds, shown next to the
// official index you entered, as a guide. It's never an official index (that comes from GHIN or
// your club) and it never changes a course handicap, a stroke or any money: nothing reads it but
// the Stats screen.
//
// In the spirit of the World Handicap System, simplified:
//  • Each round you played every hole of gets a score differential: your adjusted gross (each hole
//    capped at net double bogey, a pick-up counts as that too) against the tee's course rating and
//    slope, (adjusted gross - rating) x 113 / slope. A tee with no rating or slope falls back to
//    strokes over par, which is the same sum with rating = par and slope = 113.
//  • A 9-hole round's differential is doubled into an 18-hole one.
//  • The guide is the average of your best few of your last 20, by the WHS table (best 1 of 3 less
//    2, up to best 8 of 20), and it waits for 3 rounds.
// Rounds played for points or a reward count the same as money rounds: it's about the scores.
// One-ball team games (scramble, alternate shot, Chapman) and Shamble aren't your own ball all the
// way round, so they never count. Pure functions of plain data, so they're easy to test.
import { fixedCourse, oneBall } from './round.js';
import { strokesOnHole } from './golf.js';
import { findCourse } from './courses.js';
import { myIdSet, seatIn } from './deep-stats.js';
import { roundTime } from './history.js';
import { countsAsDone } from './big-money.js';

/** Rounds before the guide shows. */
export const TREND_MIN_ROUNDS = 3;
/** The most recent rounds the guide looks at. */
export const TREND_WINDOW = 20;
/** The label everywhere the guide shows. */
export const TREND_LABEL = 'A guide from your rounds, not an official index';

const tenth = v => Math.round(v * 10) / 10 || 0;

/** Games where the score on the card isn't your own ball, hole after hole. */
const notYourBall = game => oneBall(game) || game === 'shamble';

// WHS: how many of your lowest differentials count, and the adjustment, by how many you have
const TABLE = [
  [3, 1, -2], [4, 1, -1], [5, 1, 0], [6, 2, -1], [7, 2, 0], [8, 2, 0], [9, 3, 0], [10, 3, 0], [11, 3, 0],
  [12, 4, 0], [13, 4, 0], [14, 4, 0], [15, 5, 0], [16, 5, 0], [17, 6, 0], [18, 6, 0], [19, 7, 0], [20, 8, 0],
];

/**
 * The rating and slope for the holes this round played from a player's tee, or null when the tee
 * has neither. Ratings on 9-hole cards are 9-hole ratings; an 18-hole rating halves for a 9.
 */
export function ratingFor(round, course, teeName) {
  const tee = course?.tees?.find(t => t.name === teeName) || null;
  if (!tee || tee.rating == null || tee.slope == null) return null;
  const nineCard = (course.holes?.length || 18) === 9;
  const nine = round.holes.length <= 9;
  const rating = nineCard ? (nine ? tee.rating : tee.rating * 2) : (nine ? tee.rating / 2 : tee.rating);
  return { rating, slope: tee.slope };
}

/**
 * Your adjusted gross for a round: every hole scored, each capped at net double bogey (par + 2 +
 * the strokes your course handicap gets there). Null when a hole has no score from you.
 */
export function adjustedGross(round, pid) {
  const p = round.players?.find(x => x.id === pid);
  if (!p || !round.holes?.length) return null;
  const hc = Number.isFinite(p.courseHc) ? p.courseHc : 0;
  let total = 0;
  for (const h of round.holes) {
    const g = round.scores?.[h.no]?.[pid];
    if (g == null || !Number.isFinite(h.par)) return null;
    const cap = h.par + 2 + strokesOnHole(hc, h.rank, round.holes.length);
    if (g === 'X') total += cap;
    else if (typeof g === 'number' && g > 0) total += Math.min(g, cap);
    else return null;
  }
  return total;
}

/**
 * One round's differential for player `pid`: { diff, by: 'rating' | 'par', holes, gross } with
 * `diff` as an 18-hole figure, or null when the round doesn't count (not finished, a hole missing,
 * not your own ball). `course` is the course as you have it (rating and slope live there, not on
 * the round).
 */
export function roundDifferential(round, pid, course = null, done = round?.status === 'done') {
  if (!round || !done || notYourBall(round.game) || !round.holes?.length) return null;
  const gross = adjustedGross(round, pid);
  if (gross == null) return null;
  const holes = round.holes.length <= 9 ? 9 : 18;
  const p = round.players.find(x => x.id === pid);
  const rs = ratingFor(round, course ? fixedCourse(course, round) : null, p?.tee);
  const par = round.holes.reduce((a, h) => a + h.par, 0);
  const raw = rs ? ((gross - rs.rating) * 113) / rs.slope : gross - par;
  return { diff: tenth(holes === 9 ? raw * 2 : raw), by: rs ? 'rating' : 'par', holes, gross };
}

/** The guide from differentials, oldest first: WHS best few of the last 20, or null under 3. */
export function guideFrom(diffs) {
  const last = diffs.slice(-TREND_WINDOW);
  const row = TABLE.find(([n]) => n === last.length);
  if (!row) return null;
  const [, best, adj] = row;
  const low = [...last].sort((a, b) => a - b).slice(0, best);
  return tenth(low.reduce((a, v) => a + v, 0) / best + adj);
}

/**
 * Your trend over every finished round you have a full card in, oldest first:
 *  { points: [{ id, t, diff, by, holes, guide }], guide, rounds, needed, official, used, byPar }
 * Each point's `guide` is the guide as it stood after that round (null before 3), which is what
 * the chart draws. `used` is how many recent rounds the latest guide looked at, `needed` how many
 * more rounds before it shows, `byPar` how many counted rounds had no rating to go on.
 */
export function handicapTrend(state, rounds = Object.values(state?.rounds || {})) {
  const mine = myIdSet(state);
  const rows = [];
  for (const r of rounds) {
    if (!r) continue;
    const seat = seatIn(r, state, mine);
    if (!seat) continue;
    const d = roundDifferential(r, seat, findCourse(state || {}, r.course?.id), countsAsDone(state, r));
    if (d) rows.push({ id: r.id, t: roundTime(r), ...d });
  }
  rows.sort((a, b) => a.t - b.t);
  const diffs = [];
  const points = rows.map(row => { diffs.push(row.diff); return { ...row, guide: guideFrom(diffs) }; });
  const official = state?.players?.[state?.me]?.index ?? null;
  return {
    points,
    guide: points.length ? points.at(-1).guide : null,
    rounds: points.length,
    used: Math.min(points.length, TREND_WINDOW),
    needed: Math.max(0, TREND_MIN_ROUNDS - points.length),
    official: Number.isFinite(official) ? official : null,
    byPar: points.slice(-TREND_WINDOW).filter(p => p.by === 'par').length,
  };
}

/** How the guide compares with the official index, in words, or null without both. */
export function trendVsOfficial(guide, official) {
  if (guide == null || official == null) return null;
  const gap = tenth(guide - official);
  if (Math.abs(gap) < 0.5) return 'About the same as your official index';
  return gap < 0 ? `${Math.abs(gap).toFixed(1)} better than your official index` : `${gap.toFixed(1)} higher than your official index`;
}

/** The line under the guide while it waits for rounds. */
export function trendEmptyText(needed) {
  if (needed <= 0) return '';
  const n = TREND_MIN_ROUNDS - needed;
  return `Finish ${needed} more round${needed === 1 ? '' : 's'} with a score on every hole and your trend shows here. ${n ? `${n} so far.` : 'Scramble and alternate shot rounds don’t count.'}`;
}
