import { JUST_PLAYING_TAG } from '../lib/nice-round.js';
import { roundTime } from '../lib/history.js';
import { useNav } from '../lib/nav.js';
import { money as dollars } from '../lib/golf.js';
import { playForShort } from '../lib/play-for.js';
import { dayLabel, roundFacts } from '../lib/round-story.js';
import { TalkCount } from './TalkCount.jsx';

/**
 * One finished round on one line: the day, the course and game, and what you made.
 * A round you only kept score for shows who came out on top instead. `withYear` adds the year to
 * the day when it isn't this one (History's month headers already say it; Up next has no header).
 * What it shows is round-story.js roundFacts, shared with History's round card.
 */
export function RoundRow({ round, state, className = '', withYear = false }) {
  const nav = useNav();
  const { amount, top, money, pf, cash, talk, game, casual, nice, label } = roundFacts(round, state);
  return (
    <button className={`hist-row ${className}`} onClick={() => nav.push('roundDetail', { id: round.id })} aria-label={label}>
      <span className="hr-day">{dayLabel(roundTime(round), withYear)}</span>
      <span className="hr-main">
        <span className="hr-course">{round.course.name}</span>
        <span className="hr-game">{game}</span>
        {talk && <TalkCount rows={state.talk?.[`round:${round.id}`]} />}
      </span>
      {/* The play-for label sits under the amount, so a 375px row keeps the course name readable */}
      <span className="hr-end">
        {casual ? <>
          <span className="hr-amt other">{nice ? `${nice.score} (${nice.toPar})` : '–'}</span>
          <span className="hr-for" aria-hidden="true">{JUST_PLAYING_TAG}</span>
        </> : amount != null
          ? <span className={`hr-amt ${amount > 0 ? 'pos' : amount < 0 ? 'neg' : ''}`}>{money(amount, { sign: true })}</span>
          : <span className="hr-amt other">{top ? `${top.name.split(' ')[0]} ${money(top.amount, { sign: true })}` : '–'}</span>}
        {pf.kind === 'reward' && !casual && <span className="hr-for" aria-hidden="true">{playForShort(round)}{cash != null && cash !== 0 && <> · <span className={cash > 0 ? 'pos' : 'neg'}>{dollars(cash, { sign: true })}</span></>}</span>}
      </span>
    </button>
  );
}
