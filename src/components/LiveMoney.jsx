// The group's live view (Layout Lab A's money race with C's hole by hole): what a phone that isn't
// keeping score shows while the round is on, and the story on a friend's round. One bar per player
// around zero, what the next hole is worth, a Scorecard button, then each hole as a line, newest
// first. Display only: the amounts are roundResults' and the holes' livePreview (hole-story.js).
import { useMemo } from 'react';
import { Icon } from './ui.jsx';
import { AvatarArt } from './Avatar.jsx';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { holeStory, moneyRace, nextUp } from '../lib/hole-story.js';
import { countsMoney, unitFmt } from '../lib/play-for.js';
import './live-money.css';

/** Each player's money as a bar around zero, best first: losses to the left, winnings to the right. */
export function MoneyRace({ round, me = null }) {
  const faces = useGroupAvatars(round.players);
  const race = useMemo(() => moneyRace(round), [round]);
  const fmt = unitFmt(round);
  return (
    <ul className="lm-race" role="list" aria-label={countsMoney(round) ? 'Money so far' : 'Points so far'}>
      {race.rows.map(r => (
        <li key={r.id} className="lm-row">
          <div className="lm-who">
            {faces.get(r.id) && <AvatarArt model={faces.get(r.id)} size="sm" />}
            <span className="lm-name">{r.name.split(' ')[0]}{r.id === me ? ' (you)' : ''}</span>
            <span className={`lm-amt ${r.amount > 0 ? 'pos' : r.amount < 0 ? 'neg' : ''}`}>{fmt(r.amount, { sign: true })}</span>
          </div>
          <div className="lm-track" aria-hidden="true">
            <span className="lm-half lm-left">{r.amount < 0 && <i style={{ width: `${Math.max(4, r.share * 100)}%` }} />}</span>
            <span className="lm-half lm-right">{r.amount > 0 && <i style={{ width: `${Math.max(4, r.share * 100)}%` }} />}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Each scored hole as a line, newest first. `onHole(no)` makes a line open that hole; `limit` shows the latest few. */
export function HoleStory({ round, onHole = null, limit = null }) {
  const story = useMemo(() => holeStory(round), [round]);
  const fmt = unitFmt(round);
  if (!story.length) return <p className="lm-empty">Nothing scored yet. Each hole lands here as it’s saved.</p>;
  const shown = limit ? story.slice(0, limit) : story;
  return (
    <ol className="lm-story" aria-label="Hole by hole, newest first">
      {shown.map(s => {
        const body = (
          <>
            <span className="lm-no"><span className="sr-only">Hole </span>{s.no}</span>
            <span className="lm-line">
              <span className="lm-title">{s.title}</span>
              {s.text && <span className="lm-text">{s.text}</span>}
            </span>
            {s.moved && <span className="lm-won">{fmt(s.amount, { sign: true })}</span>}
          </>
        );
        return (
          <li key={s.no} className={`lm-hole ${s.moved ? 'moved' : ''}`}>
            {onHole ? <button type="button" className="lm-hole-btn" onClick={() => onHole(s.no)}>{body}</button> : <div className="lm-hole-btn">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The whole live view for a phone watching the round: the race, the next hole, the Scorecard and This
 * hole buttons, and the story. `holderName` is whoever has the card.
 */
export function LiveMoney({ round, me, holderName, onCard, onHole, onThisHole }) {
  const next = useMemo(() => nextUp(round), [round]);
  return (
    <div className="scroll lm-scroll">
      <MoneyRace round={round} me={me} />
      {next && (
        <div className="lm-next">
          <div className="lm-next-main">
            <span className="lm-next-l">Now · Hole {next.hole.no} · Par {next.hole.par}</span>
            <span className="lm-next-v">{next.worth ? `Worth ${next.worth}` : `Waiting on ${holderName || 'the scorekeeper'}’s card`}</span>
          </div>
          {next.carried > 0 && <span className="lm-next-c">{next.carried} carried</span>}
        </div>
      )}
      <div className="lm-actions">
        <button type="button" className="lm-btn" onClick={onCard}><Icon name="table" /> Scorecard</button>
        <button type="button" className="lm-btn" onClick={onThisHole}><Icon name="flag" /> This hole</button>
      </div>
      <div className="sec-label">Hole by hole</div>
      <HoleStory round={round} onHole={onHole} />
    </div>
  );
}
