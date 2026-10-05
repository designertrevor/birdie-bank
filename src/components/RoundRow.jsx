import { isJustPlaying, roundResults } from '../lib/round.js';
import { JUST_PLAYING_TAG, niceRound } from '../lib/just-playing.js';
import { gameLabel, meFor, roundDate } from '../lib/format.js';
import { myNet, roundTime } from '../lib/history.js';
import { useNav } from '../lib/nav.js';
import { money as dollars } from '../lib/golf.js';
import { hasCashBet, playForOf, playForShort, rewardOutcome, tabMoneyOf, unitFmt } from '../lib/play-for.js';
import { countsLine, roundTalkCounts } from '../lib/talk-counts.js';
import { TalkCount } from './TalkCount.jsx';

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
  // A reward round's side bets for money are on the Tab, so the month's total counts them: say so here
  const me = amount == null ? null : meFor(round, state);
  const cash = pf.kind === 'reward' && hasCashBet(round, me) ? tabMoneyOf(round, me) : null;
  const cashText = cash == null ? '' : `. ${cash ? `${dollars(cash, { sign: true })} on side bets` : 'Side bets square'}`;
  // Its trash talk, in a few characters (talk.js)
  const talk = countsLine(roundTalkCounts(state, round));
  // A Big Game's group round goes by the game's name; the game's money is on its own page (big-money.js)
  const game = round.trip?.format === 'big' ? round.trip.name : gameLabel(round);
  // A round you were just playing shows your score, never money you weren't playing for
  const seat = meFor(round, state);
  const casual = round.players.some(p => p.id === seat) && isJustPlaying(round, seat);
  const nice = casual ? niceRound(round, seat) : null;
  const label0 = casual
    ? `${round.course.name}, ${game}, ${roundDate(round)}. ${nice ? `You shot ${nice.score}, ${nice.toParWords}` : 'No scores'}. ${JUST_PLAYING_TAG}`
    : amount == null
    ? `${round.course.name}, ${game}, ${roundDate(round)}. ${top ? `${top.name} ${money(top.amount, { sign: true })}` : ''}${sub ? `. ${sub}` : ''}`
    : `${round.course.name}, ${game}, ${roundDate(round)}. You ${money(amount, { sign: true })}${sub ? `. ${sub}` : ''}${cashText}`;
  const label = talk ? `${label0}. ${talk}` : label0;
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
