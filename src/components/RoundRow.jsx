import { roundResults } from '../lib/round.js';
import { gameLabel, roundDate } from '../lib/format.js';
import { myNet, roundTime } from '../lib/history.js';
import { useNav } from '../lib/nav.js';
import { playForOf, playForShort, rewardOutcome, unitFmt } from '../lib/play-for.js';

function dayLabel(t, withYear) {
  const d = new Date(t);
  const year = withYear && d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year });
}

/**
 * One finished round on one line: the day, the course and game, and what you made.
 * A round you only kept score for shows who came out on top instead. `withYear` adds the year to
 * the day when it isn't this one (History's month headers already say it; Up next has no header).
 */
export function RoundRow({ round, state, className = '', withYear = false }) {
  const nav = useNav();
  const amount = myNet(round, state);
  const top = amount == null ? roundResults(round).standings[0] : null;
  // A points or reward round shows points (a reward round names the reward), never dollars
  const money = unitFmt(round);
  const pf = playForOf(round);
  const sub = pf.kind === 'reward' ? rewardOutcome(round, roundResults(round)).win.replace(/\.$/, '') : pf.kind === 'points' ? 'For bragging rights' : null;
  const label = amount == null
    ? `${round.course.name}, ${gameLabel(round)}, ${roundDate(round)}. ${top ? `${top.name} ${money(top.amount, { sign: true })}` : ''}${sub ? `. ${sub}` : ''}`
    : `${round.course.name}, ${gameLabel(round)}, ${roundDate(round)}. You ${money(amount, { sign: true })}${sub ? `. ${sub}` : ''}`;
  return (
    <button className={`hist-row ${className}`} onClick={() => nav.push('roundDetail', { id: round.id })} aria-label={label}>
      <span className="hr-day">{dayLabel(roundTime(round), withYear)}</span>
      <span className="hr-main">
        <span className="hr-course">{round.course.name}</span>
        <span className="hr-game">{gameLabel(round)}</span>
      </span>
      {/* The play-for label sits under the amount, so a 375px row keeps the course name readable */}
      <span className="hr-end">
        {amount != null
          ? <span className={`hr-amt ${amount > 0 ? 'pos' : amount < 0 ? 'neg' : ''}`}>{money(amount, { sign: true })}</span>
          : <span className="hr-amt other">{top ? `${top.name.split(' ')[0]} ${money(top.amount, { sign: true })}` : '–'}</span>}
        {pf.kind === 'reward' && <span className="hr-for" aria-hidden="true">{playForShort(round)}</span>}
      </span>
    </button>
  );
}
