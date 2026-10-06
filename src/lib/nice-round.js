// Someone just playing (just-playing.js), as a finished round's row shows them: the tag next to
// their name and their friendly finish. Split out of just-playing.js (which re-exports it) so Up
// next's first paint doesn't load the setup rules. Pure, unit tested in just-playing-ui.test.js.
import { scoreSummary, scorers } from './round.js';
import { toParOf, toParText, toParWords } from './to-par.js';

/** The short tag next to their name on the card and the money bar. */
export const JUST_PLAYING_TAG = 'Just playing';

export const first = n => String(n || '').trim().split(/\s+/)[0] || 'Someone';
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The friendly finish for someone just playing: their own score, no money.
 * { title, score, toPar, toParWords, line, holes } or null when they have no scores.
 * "Nice round, Sam" · "84" · "+12" · "Through 18 holes, with 2 birdies and 7 pars".
 */
export function niceRound(round, pid) {
  const p = round?.players?.find(x => x.id === pid);
  if (!p) return null;
  const unit = scorers(round).find(x => x.id === pid);
  if (!unit) return null;
  const s = scoreSummary(round, pid);
  if (!s.played) return null;
  const par = toParOf(round, unit).gross;
  const all = s.played === round.holes.length;
  const good = [s.eagles && plural(s.eagles, 'eagle'), s.birdies && plural(s.birdies, 'birdie'), s.pars && plural(s.pars, 'par')].filter(Boolean);
  const holes = all ? `${round.holes.length} holes` : `${s.played} of ${round.holes.length} holes`;
  const tail = good.length ? `, with ${good.length > 1 ? `${good.slice(0, -1).join(', ')} and ${good.at(-1)}` : good[0]}` : '';
  return {
    title: `Nice round, ${first(p.name)}`,
    score: s.gross, toPar: toParText(par), toParWords: toParWords(par), tone: par < 0 ? 'under' : par > 0 ? 'over' : 'even',
    line: `${all ? 'All' : 'Through'} ${holes}${tail}.`,
    holes: s.played,
  };
}
