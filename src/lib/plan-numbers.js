// The cancel screen's numbers: what this group has built in the app, worked out from the rounds and
// payments on this phone, the way Strava's cancel screen shows you your own year ("12 rounds,
// 4 rivalries, $640 settled"). Display only: nothing is saved and no money is worked out a new way.
// Pure, unit tested.
//
// - rounds: finished rounds you played (a round you only watched doesn't count), any kind: money,
//   points or a reward.
// - rivalries: friends you've played at least RIVALRY_ROUNDS finished rounds with. One person is one
//   rival, whichever of their ids a round has (people-links.js through canonicalOf).
// - settled: the payments recorded on this phone (the Tab's settle-ups), as a count and in dollars.
//   The dollars only show when your privacy setting shows your money (profile-model.js moneyShown:
//   "Show my money" on, and a profile that isn't Only you). Hidden money is the default, so most
//   people see the count of payments instead.
// - best: the group's best moment, the low round over a full round (18 holes when there is one,
//   else 9), every hole scored, one-ball games left out; with no full card, the most skins in one
//   round. Never money.
import { isJustPlaying, oneBall, roundResults } from './round.js';
import { canonicalOf, finishedAt, played } from './pair-debts.js';
import { nameOf } from './ledger.js';
import { skinsIn } from './deep-stats.js';
import { moneyShown } from './profile-model.js';
import { money } from './golf.js';

/** Rounds together before a friend counts as a rivalry. */
export const RIVALRY_ROUNDS = 2;

const cents = v => Math.round((Number(v) || 0) * 100);

/** The strokes on a full card for one seat, or null when a hole is missing or it's a one-ball game. */
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
 * { rounds, rivalries, settled: { count, cents, shown }, best } for the cancel screen.
 * `privacy` is your profile's privacy (state.profile.privacy when left out).
 */
export function groupNumbers(state, { privacy = state?.profile?.privacy } = {}) {
  const who = canonicalOf(state);
  const done = Object.values(state?.rounds || {})
    .filter(r => r?.status === 'done' && Array.isArray(r.players) && played(r, state))
    .sort((a, b) => finishedAt(a) - finishedAt(b));

  const together = new Map();
  for (const r of done) {
    for (const id of new Set(r.players.map(p => who(p.id)))) {
      if (id === state.me) continue;
      together.set(id, (together.get(id) || 0) + 1);
    }
  }
  const rivalries = [...together.values()].filter(n => n >= RIVALRY_ROUNDS).length;

  const pays = (state?.settlements || []).filter(s => s && Number(s.amount) > 0);
  const settled = { count: pays.length, cents: pays.reduce((t, s) => t + cents(s.amount), 0), shown: moneyShown(privacy) };

  return { rounds: done.length, rivalries, settled, best: bestMoment(state, done, who) };
}

function bestMoment(state, rounds, who) {
  const lows = { 18: null, 9: null };
  let skins = null;
  for (const r of rounds) {
    const at = finishedAt(r);
    const course = r.course?.name || '';
    const holes = r.holes?.length;
    let res = null;
    for (const p of r.players) {
      if (isJustPlaying(r, p.id)) continue;
      const g = grossOf(r, p.id);
      if (g != null && (holes === 18 || holes === 9) && (!lows[holes] || g < lows[holes].strokes)) {
        lows[holes] = { kind: 'low', id: who(p.id), strokes: g, holes, course, at };
      }
      if (r.game === 'skins' || (r.sideGames || []).some(s => s?.game === 'skins')) {
        try {
          res = res || roundResults(r);
          const s = skinsIn(r, p.id, res);
          if (s.skins > 0 && (!skins || s.skins > skins.skins)) skins = { kind: 'skins', id: who(p.id), skins: s.skins, course, at };
        } catch { /* a round that won't add up has no skins to show */ }
      }
    }
  }
  const best = lows[18] || lows[9] || skins;
  return best ? { ...best, name: nameOf(state, best.id), mine: best.id === state.me } : null;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'Someone';

/** "$640 settled" with the money shown, "18 payments settled" without, null with none. */
export function settledText(settled) {
  if (!settled?.count) return null;
  if (settled.shown) return `${money(settled.cents / 100)} settled`;
  return `${plural(settled.count, 'payment')} settled`;
}

/** The headline: "12 rounds, 4 rivalries, $640 settled". Leaves out what's still zero. */
export function numbersLine(n) {
  const parts = [];
  if (n.rounds) parts.push(plural(n.rounds, 'round'));
  if (n.rivalries) parts.push(plural(n.rivalries, 'rivalry', 'rivalries'));
  const s = settledText(n.settled);
  if (s) parts.push(s);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/**
 * The best moment as a tile: { value, sub }. "Your 79" or "Bo’s 79", with where and when under it.
 * Null with no moment yet.
 */
export function bestMomentTile(best) {
  if (!best) return null;
  const whose = best.mine ? 'Your' : `${firstName(best.name)}’s`;
  const day = best.at ? new Date(best.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const where = [best.course, day].filter(Boolean).join(', ');
  if (best.kind === 'skins') return { value: `${whose} ${plural(best.skins, 'skin')}`, sub: where ? `In one round, ${where}` : 'In one round' };
  return { value: `${whose} ${best.strokes}`, sub: [best.holes === 9 ? 'Low 9' : 'Low round', where].filter(Boolean).join(' · ') };
}
