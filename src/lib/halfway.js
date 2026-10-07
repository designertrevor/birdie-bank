// Halfway (design review 2026-10-07, item 25): after the ninth hole of an 18-hole round, a bottom
// sheet with every score so far and where things stand, read off what the game engine already
// computes (roundResults and the reveal's own per-game steps). Display only: nothing here touches
// the money. Nine-hole rounds have no halfway; their results are one hole away. Pure, unit tested;
// Moments.jsx shows the sheet, after the hole's own moment banner if there is one.
import { cardOnly, holeComplete, roundResults } from './round.js';
import { revealSteps } from './reveal.js';
import { moneyLeader } from './moments.js';
import { countsMoney, unitFmt } from './play-for.js';
import { BIG_FORMAT } from './big-format.js';

/** The playing position that's halfway: the ninth hole played, in an 18-hole round only. */
export const HALFWAY_POS = 9;

/**
 * Whether the hole just scored (freshHole's { pos, final }) is the ninth of eighteen. Only the hole
 * in play counts (freshHole already says nothing for a burst, an edit or a skipped hole filled in),
 * and a round that finishes on it goes to the reveal instead. Nine-hole rounds: never.
 */
export function atHalfway(round, fresh) {
  return !!fresh && !fresh.final && round?.status === 'active' && round.holes?.length === 18 && fresh.pos === HALFWAY_POS;
}

/**
 * What the sheet shows, or null for a round that isn't 18 holes:
 * { holes, played, title, text, stepsTitle, steps, standings, fmt, money }.
 * `holes` are the first nine, for the scorecard. The headline is the money (or points) leader at
 * the turn. The steps are the reveal's own per-game summary, so "standings" means what each game
 * means by it: a match's legs and their state, each player's skins or points, stroke play's totals,
 * the biggest holes of a Banker, Wolf, Vegas or Hammer round; without their amounts, since the
 * money is listed once underneath. A card with no game, or a Big Game's group round (its money is
 * the trip's), gets the card alone.
 */
export function halfwayFor(round) {
  if (!round || round.holes?.length !== 18) return null;
  const holes = round.holes.slice(0, HALFWAY_POS);
  const played = holes.filter(h => holeComplete(round, h)).length;
  const fmt = unitFmt(round);
  const plain = { holes, played, stepsTitle: '', steps: [], standings: null, fmt, money: countsMoney(round) };
  if (cardOnly(round) || round.trip?.format === BIG_FORMAT) return { ...plain, title: 'Halfway there', text: 'Nine down, nine to go.' };
  const res = roundResults(round);
  const lead = moneyLeader(round, res.balances);
  const title = lead ? `${lead.name} lead${lead.plural ? '' : 's'} at the turn` : 'All square at the turn';
  const text = lead ? `Up ${fmt(lead.amount)} through nine. Nine to go.` : 'Nine down, nine to go, and nobody’s ahead.';
  const { title: stepsTitle, steps } = revealSteps(round, res);
  return {
    ...plain, title, text, stepsTitle,
    steps: steps.map(s => ({ key: s.key, label: s.label, text: s.text || '', value: s.value || null, tie: !!s.tie })),
    standings: res.standings.map(p => ({ id: p.id, name: p.name, amount: p.amount })),
  };
}
