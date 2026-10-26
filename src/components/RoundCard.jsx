// History's round card (overhaul, Layout Lab C): each finished round as a small story. The game's
// art, the day and course, the game, who came out on top, your money or points, and the round's
// best moment when it had one, with the faces of who played. `big` is a good day: your best win
// of the month gets the bigger card. Opens the round, like the one-line RoundRow it replaces here.
import { Icon } from './ui.jsx';
import { Avatar } from './Avatar.jsx';
import { GameArt } from './GameArt.jsx';
import { TalkCount } from './TalkCount.jsx';
import { JUST_PLAYING_TAG } from '../lib/nice-round.js';
import { roundTime } from '../lib/history.js';
import { useNav } from '../lib/nav.js';
import { money as dollars } from '../lib/golf.js';
import { playForShort } from '../lib/play-for.js';
import { dayLabel, roundFacts, roundHighlight, roundWinner } from '../lib/round-story.js';

const FACES = 4;

export function RoundCard({ round, state, big = false, withYear = false }) {
  const nav = useNav();
  const { amount, top, money, pf, cash, talk, game, casual, nice, label } = roundFacts(round, state);
  const win = casual ? null : roundWinner(round, state);
  const moment = roundHighlight(round);
  const aria = [label, win && pf.kind !== 'reward' ? win.text : null, moment ? `${moment.title}, hole ${moment.hole}` : null].filter(Boolean).join('. ');
  const faces = round.players.slice(0, FACES);
  const more = round.players.length - faces.length;
  return (
    <button className={`rc-card ${big ? 'big' : ''}`} onClick={() => nav.push('roundDetail', { id: round.id })} aria-label={aria}>
      <GameArt game={round.game} className="rc-art" />
      <span className="rc-main">
        <span className="rc-meta">{dayLabel(roundTime(round), withYear)} · {round.course.name}</span>
        <span className="rc-game">{game}</span>
        {casual
          ? <span className="rc-who">{JUST_PLAYING_TAG}</span>
          : win && <span className={`rc-who ${win.you ? 'you' : ''}`}>{win.you && <Icon name="trophy" fill />}{win.text}</span>}
      </span>
      {/* The same amount the one-line row shows: yours, or the top player's in a round you only kept */}
      <span className="rc-end">
        {casual
          ? <span className="rc-amt other">{nice ? `${nice.score} (${nice.toPar})` : '–'}</span>
          : amount != null
            ? <span className={`rc-amt ${amount > 0 ? 'pos' : amount < 0 ? 'neg' : ''}`}>{money(amount, { sign: true })}</span>
            : <span className="rc-amt other">{top ? `${top.name.split(' ')[0]} ${money(top.amount, { sign: true })}` : '–'}</span>}
        {pf.kind === 'reward' && !casual && <span className="hr-for" aria-hidden="true">{playForShort(round)}{cash != null && cash !== 0 && <> · <span className={cash > 0 ? 'pos' : 'neg'}>{dollars(cash, { sign: true })}</span></>}</span>}
      </span>
      <span className="rc-foot">
        <span className="rc-faces" aria-hidden="true">
          {faces.map(p => <Avatar key={p.id} id={p.id} name={p.name} seat={p} size="sm" />)}
          {more > 0 && <span className="rc-more">+{more}</span>}
        </span>
        {moment
          ? <span className="rc-moment"><Icon name="sparkle" fill /><span className="rc-mt">{moment.title}</span><span className="rc-hole">Hole {moment.hole}</span></span>
          : <span className="rc-moment quiet">{round.players.length} played</span>}
        {talk && <TalkCount rows={state.talk?.[`round:${round.id}`]} />}
      </span>
    </button>
  );
}
