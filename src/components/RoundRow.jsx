import { GAMES, roundResults } from '../lib/round.js';
import { money } from '../lib/golf.js';
import { roundDate } from '../lib/format.js';
import { myNet, roundTime } from '../lib/history.js';
import { useNav } from '../lib/nav.js';

/**
 * One finished round on one line: the day, the course and game, and what you made.
 * A round you only kept score for shows who came out on top instead.
 */
export function RoundRow({ round, state, className = '' }) {
  const nav = useNav();
  const amount = myNet(round, state);
  const top = amount == null ? roundResults(round).standings[0] : null;
  const label = amount == null
    ? `${round.course.name}, ${GAMES[round.game]?.name}, ${roundDate(round)}. ${top ? `${top.name} ${money(top.amount, { sign: true })}` : ''}`
    : `${round.course.name}, ${GAMES[round.game]?.name}, ${roundDate(round)}. You ${money(amount, { sign: true })}`;
  return (
    <button className={`hist-row ${className}`} onClick={() => nav.push('roundDetail', { id: round.id })} aria-label={label}>
      <span className="hr-day">{new Date(roundTime(round)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      <span className="hr-main">
        <span className="hr-course">{round.course.name}</span>
        <span className="hr-game">{GAMES[round.game]?.name}</span>
      </span>
      {amount != null
        ? <span className={`hr-amt ${amount > 0 ? 'pos' : amount < 0 ? 'neg' : ''}`}>{money(amount, { sign: true })}</span>
        : <span className="hr-amt other">{top ? `${top.name.split(' ')[0]} ${money(top.amount, { sign: true })}` : '–'}</span>}
    </button>
  );
}
