// "Any side bets on this hole?" (ROADMAP area 5): a light card on the Play screen that helps a group
// find two-player side bets (pair-bets.js). It asks on a few holes a round at most, where a bet fits:
// the first hole (a match for the round), the first par 3 after it (closest to the pin) and, in an
// 18-hole round, the turn (a match for the second nine). One tap opens the side bet editor filled in,
// one tap puts it away for the round, and "Don't ask again" turns it off (a switch in Settings too).
// It never asks on a phone that's only watching, while a moment banner shows, on a hole already
// scored or being scored, or when nobody this phone can make a bet for could have that kind of bet
// (two teammates in a scramble share one score, so they can't have a match). Pure, unit tested.
import { holeComplete, playersOn } from './round.js';
import { MAX_BETS, betRange, betsOf, kindFits, nextPos, nineRange } from './pair-bets.js';
import { withAsks } from './bet-asks.js';

/** The most holes a round asks on. */
export const PROMPT_MAX = 3;

/**
 * The holes a round asks on, by playing position, in order: [{ pos, why }], why 'first', 'par3' or
 * 'turn'. The first hole always; the turn (position 10) in an 18-hole round; and the first par 3
 * after the first hole that isn't the turn. Never more than PROMPT_MAX.
 */
export function promptSpots(round) {
  const holes = round?.holes || [];
  const n = holes.length;
  if (n < 2) return [];
  const turn = n === 18 ? 10 : null;
  const spots = [{ pos: 1, why: 'first' }];
  const par3 = holes.findIndex((h, i) => i > 0 && i + 1 !== turn && h.par === 3);
  if (par3 >= 0) spots.push({ pos: par3 + 1, why: 'par3' });
  if (turn) spots.push({ pos: turn, why: 'turn' });
  return spots.sort((a, b) => a.pos - b.pos).slice(0, PROMPT_MAX);
}

/**
 * The kind of bet a spot suggests: closest to the pin at the par 3 spot, a match at the first hole
 * and the turn, even when that hole is a par 3 (the par 3 spot is then the next one, so a round never
 * asks about closest to the pin twice and always gets its match asks).
 */
export function spotKind(why) {
  return why === 'par3' ? 'ctp' : 'match';
}

/**
 * Which nine the turn starts, by hole number: 'back', or 'front' when the round started on 10, or
 * null when the last nine holes aren't a nine in a row (a shotgun start on another hole).
 */
function nineName(round, pos) {
  const n = round.holes.length;
  for (const which of ['front', 'back']) {
    const r = nineRange(round, which);
    if (r && r[0] === pos && r[1] === n) return which;
  }
  return null;
}

/**
 * The bet a spot's "Add a side bet" starts the editor on: { kind, holes }. The first hole's match is
 * for the whole round; a par 3's closest to the pin and the turn's match run from that hole on.
 */
export function spotDraft(round, spot) {
  const n = round.holes.length;
  const kind = spotKind(spot.why);
  return { kind, holes: spot.why === 'first' ? [1, n] : [spot.pos, n] };
}

/** The card's words for a spot: { title, text }. */
export function spotCopy(round, spot) {
  const kind = spotKind(spot.why);
  if (kind === 'ctp') return { title: 'Closest to the pin?', text: 'A par 3. Two of you can bet on who lands it closest.' };
  if (spot.why === 'turn') return { title: `A side bet for the ${nineName(round, spot.pos) ?? 'last'} nine?`, text: 'A fresh match for the last nine holes, just between two of you.' };
  return { title: 'Any side bets this round?', text: 'Two of you can play your own match on top of the game.' };
}

/** Whether a bet of the same sort already covers this hole for these players (closest to the pin, or a match or per-hole bet). */
function covered(round, kind, pos, who) {
  const sort = k => (k === 'ctp' ? 'ctp' : k === 'match' || k === 'hole' ? 'match' : 'custom');
  return betsOf(round).some(b => {
    if (sort(b.kind) !== sort(kind)) return false;
    if (who && !b.sides.includes(who)) return false;
    const [f, t] = betRange(round, b);
    return pos >= f && pos <= t;
  });
}

/**
 * The card to show on the hole at playing position `pos`, or null. `me` is this phone's player (or
 * null); `editable` whether this phone keeps score. `on` is the Settings switch; `seen` this phone's
 * record for the round ({ skip, done: [pos] }, see markPrompt); `moment` whether a moment banner is up;
 * `scoring` whether scores are being typed on this hole.
 * Returns { pos, why, kind, holes, title, text }.
 */
export function betPromptFor(round, pos, { me = null, editable = false, on = true, seen = null, moment = false, scoring = false } = {}) {
  if (!on || moment || scoring || !round || round.status !== 'active' || round.editing) return null;
  if (seen?.skip || (Array.isArray(seen?.done) && seen.done.includes(pos))) return null;
  const player = !!me && round.players.some(p => p.id === me);
  // A phone that's only watching can't make a bet
  if (!editable && !player) return null;
  const spot = promptSpots(round).find(s => s.pos === pos);
  if (!spot) return null;
  const hole = round.holes[pos - 1];
  // Only the next hole to play, before it's scored (browsing back or ahead asks nothing)
  if (!hole || holeComplete(round, hole) || nextPos(round) !== pos) return null;
  // A player's own bets still on their way to the keeper's phone count already (bet-asks.js)
  const view = editable ? round : withAsks(round);
  if (betsOf(view).length >= MAX_BETS) return null;
  const kind = spotKind(spot.why);
  // A player who isn't keeping score can only make a bet they're in
  const mine = !editable ? me : null;
  if (covered(view, kind, pos, mine)) return null;
  // Someone this phone can make the bet for has someone to make it with (a scramble's match needs the two on different teams)
  const here = playersOn(round, hole).map(p => p.id);
  const fits = here.some((a, i) => here.some((b, j) => j > i && (!mine || a === mine || b === mine) && kindFits(round, kind, [a, b])));
  if (!fits) return null;
  return { pos, why: spot.why, ...spotDraft(round, spot), ...spotCopy(round, spot) };
}

/**
 * Record on this phone that a round's card was answered: `skip` puts it away for the rest of the
 * round, else the hole at `pos` is done (the editor was opened from it). Entries for rounds that are
 * gone or finished are dropped as it goes, so the record stays small. Mutates `s.betPrompts`.
 */
export function markPrompt(s, roundId, { pos = null, skip = false } = {}) {
  const all = { ...(s.betPrompts || {}) };
  for (const id of Object.keys(all)) if (id !== roundId && s.rounds?.[id]?.status !== 'active') delete all[id];
  const cur = all[roundId] || {};
  all[roundId] = skip ? { ...cur, skip: true } : { ...cur, done: [...new Set([...(cur.done || []), pos])].filter(x => x != null) };
  s.betPrompts = all;
}
