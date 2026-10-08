// The rivalry on a Player card, and "Your nemesis" on the Players list (see lib/rivalry.js).
import { Icon } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { money } from '../lib/golf.js';
import { gameLabel, roundDate } from '../lib/format.js';
import { useNav } from '../lib/nav.js';
import { useStore } from '../lib/store.js';
import { seriesLine, streakLine } from '../lib/rivalry.js';

const STREAK_ICON = { won: 'fire', lost: 'cloud-rain', even: 'equals' };

/** You against one friend, all time. Nothing shows until you've finished a round together. */
export function RivalryCard({ rv, name, isNemesis, id = null }) {
  const nav = useNav();
  const me = useStore(st => st.me);
  const myName = useStore(st => st.players[st.me]?.name || 'You');
  if (!rv?.rounds) return null;
  const firstName = name.split(' ')[0];
  const streak = streakLine(rv.streak, name);
  const rec = [`${rv.won} won`, `${rv.lost} lost`, rv.even ? `${rv.even} even` : null].filter(Boolean).join(', ');
  const big = (row, label) => row && (
    <button className="ledger-row rv-big" onClick={() => nav.push('roundDetail', { id: row.id })}>
      <div className="lr-info">
        <div className="eyebrow">{label}</div>
        <div className="lr-name" style={{ fontSize: 16 }}>{roundDate(row.round)} · {row.round.course?.name || 'Unknown course'}</div>
        <div className="lr-status">
          {gameLabel(row.round)}
          {row.left === 'them' ? ` · ${firstName} left early` : row.left === 'you' ? ' · you left early' : row.left === 'both' ? ' · you both left early' : ''}
        </div>
      </div>
      <div className={`lr-amt d story-amt ${row.amount > 0 ? 'pos' : 'neg'}`}>{money(row.amount, { sign: true })}</div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
  return (
    <>
      <div className="sec-label">Rivalry</div>
      <div className="rival-card">
        {/* The nemesis tag on the left, and on the right the card for the group text (Share.jsx, kind rivalry) */}
        {(isNemesis || (id && me)) && (
          <div className="rv-head">
            {isNemesis && <div className="rv-tag"><Icon name="skull" fill /> Your nemesis</div>}
            {id && me && (
              <button className="pill-btn sm rv-share" onClick={() => nav.push('share', { kind: 'rivalry', id })} aria-label="Share this rivalry">
                <Icon name="share-network" /> Share
              </button>
            )}
          </div>
        )}
        {/* Face to face, like a fight card: you, the record, them */}
        {id && me && (
          <div className="rv-vs" aria-hidden="true">
            <span className="rv-side"><Avatar id={me} name={myName} size="lg" /><span>You</span></span>
            <span className="rv-score d">{rv.won}<span className="rv-dash">–</span>{rv.lost}</span>
            <span className="rv-side them"><Avatar id={id} name={name} size="lg" /><span>{firstName}</span></span>
          </div>
        )}
        <div className="rv-series d">{seriesLine(rv, name)}</div>
        {streak && <div className={`rv-streak ${rv.streak.result}`}><Icon name={STREAK_ICON[rv.streak.result]} fill /> {streak}</div>}
        <div className="rv-stats">
          <div>
            <div className="eyebrow">All time</div>
            <div className={`st-v d ${rv.net > 0 ? 'pos' : rv.net < 0 ? 'neg' : ''}`}>{rv.moneyRounds ? money(rv.net, { sign: true }) : '–'}</div>
            <div className="st-s">{rv.moneyRounds ? `${rv.moneyRounds} money round${rv.moneyRounds === 1 ? '' : 's'}` : 'No money rounds'}</div>
          </div>
          <div>
            <div className="eyebrow">Rounds</div>
            <div className="st-v d">{rv.rounds}</div>
            <div className="st-s">{rec}</div>
          </div>
          <div>
            <div className="eyebrow">Last played</div>
            <div className="st-v d">{roundDate(rv.last.round)}</div>
            <div className="st-s">{rv.rounds > 1 ? `First ${roundDate(rv.first.round)}` : 'First round together'}</div>
          </div>
        </div>
      </div>
      {big(rv.best, 'Biggest win')}
      {big(rv.worst, 'Biggest loss')}
      {(rv.otherRounds > 0 || rv.leftEarly > 0) && (
        <p className="field-help pad rv-note">
          {rv.otherRounds > 0 && `${rv.otherRounds} round${rv.otherRounds === 1 ? '' : 's'} for points or a reward count in the record, not the money. `}
          {rv.leftEarly > 0 && `When one of you left early, only the holes you both played count.`}
        </p>
      )}
    </>
  );
}

/** "Your nemesis" on the Players list: the friend you're down the most to, with a little trash talk. */
export function NemesisCard({ n }) {
  const nav = useNav();
  if (!n) return null;
  return (
    <button className="nemesis-card" onClick={() => nav.push('person', { id: n.id })}>
      <Avatar id={n.id} name={n.name} />
      <div className="row-main">
        <div className="eyebrow nm-eyebrow"><Icon name="skull" fill /> Your nemesis</div>
        <div className="set-name">{n.name}</div>
        <div className="set-sub">You’re down {money(-n.net)} over {n.rounds} round{n.rounds === 1 ? '' : 's'}</div>
        <div className="nm-line">{n.line}</div>
      </div>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}
