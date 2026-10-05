// The Big Game in words for the screens (big-game.js has the math): a score to par, where you
// stand, your money from it, and who's who between the game's ids and yours. Pure.
import { canonicalOf } from './pair-debts.js';
import { BIG_FORMAT, bigName, bigSummary, cleanBig } from './big-game.js';

const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** "−2", "E", "+3": a score to par. */
export const toParText = v => (v == null ? '–' : v === 0 ? 'E' : v > 0 ? `+${v}` : `−${-v}`);

/** Who's who on this phone: the game's ids (the organizer's) against yours. */
export function bigWho(state, big) {
  const who = canonicalOf(state);
  const me = who(state.me);
  const isMe = id => who(id) === me;
  return { who, me, isMe, name: id => (isMe(id) ? 'You' : bigName(big, id)) };
}

/** "You’re tied 3rd of 12, −2" (or "18 points" in Stableford), where you stand in the pot, or null when you're not in it or nothing's in. */
export function myPlaceLine(bs, isMe) {
  const row = bs.results.pot.find(r => isMe(r.id));
  if (!row || row.place === '–' || !row.thru) return null;
  const n = bs.results.pot.length;
  const place = row.place.startsWith('T') ? `tied ${ordinal(Number(row.place.slice(1)))}` : ordinal(Number(row.place));
  return `You’re ${place} of ${n}, ${bs.big.pot.kind === 'stableford' ? `${row.points} points` : toParText(row.toPar)}`;
}

/** Your money from the game once it's decided, in dollars, or null (not decided, or you're not playing in it). */
export function myBigMoney(bs, isMe) {
  if (!bs?.final || !Object.keys(bs.big.people).some(isMe)) return null;
  let c = 0;
  for (const [id, v] of Object.entries(bs.results.balances)) if (isMe(id)) c += v;
  return c / 100;
}

/**
 * What's still to settle on the decided game, from Settle the game's lines (tripStatus plan), in
 * dollars: { mine, others }. `mine` is what's still between you and anyone (positive: owed to you),
 * so a line paid comes off it; `others` is what's still to pay between other people.
 */
export function bigLeft(plan, isMe) {
  let mine = 0, others = 0;
  for (const l of plan || []) {
    const c = Math.round((Number(l.amount) || 0) * 100);
    if (isMe(l.to)) mine += c;
    else if (isMe(l.from)) mine -= c;
    else others += c;
  }
  return { mine: mine / 100, others: others / 100 };
}

/**
 * A group's round on the invite card: the game's name and the group, what's on the line across the
 * field, and your strokes (in full, from your course handicap, never off the low player), or null
 * when the round isn't part of a Big Game. `fmt` formats dollars.
 */
export function bigInvite(meta, fmt, seatId = null) {
  if (meta?.trip?.format !== BIG_FORMAT) return null;
  const big = cleanBig(meta.trip.big);
  if (!big) return null;
  const group = big.groups.find(g => g.roundId === meta.id || (meta.shareCode && g.code === meta.shareCode)) || null;
  const seat = seatId ? meta.players?.find(p => p.id === seatId) : null;
  const plays = seat && big.useHandicaps ? Math.round((Number(seat.courseHc) || 0) * (big.hcPct / 100)) : null;
  return {
    title: `${meta.trip.name}${group ? ` · ${group.name}` : ''}`,
    bets: bigSummary(big, fmt) || 'Played for fun',
    groups: big.groups.length,
    players: Object.keys(big.people).length,
    strokes: plays == null ? null : plays > 0 ? `You play off ${plays} across the whole field` : plays < 0 ? `You give ${-plays} back across the whole field` : 'You play off scratch across the whole field',
  };
}
