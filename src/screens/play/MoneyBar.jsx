// The money strip under the round's header, or the card bar when everyone is just playing (Play.jsx).
import { Icon } from '../../components/ui.jsx';
import './play.css';
import { holeComplete } from '../../lib/round.js';
import { niceRound } from '../../lib/just-playing.js';
import { useMoneyStrip } from './useMoneyStrip.jsx';

/**
 * A card kept with no game (everyone just playing): each player's score so far and to par, where the
 * money bar would be. Nothing here is money.
 */
export function CardBar({ round }) {
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  return (
    <div className="money-bar card-bar" role="group" aria-label="Your card so far">
      <div className="mb-head">
        <span>Just keeping score</span>
        <span>{played ? `Thru ${played} hole${played === 1 ? '' : 's'}` : 'No holes yet'}</span>
      </div>
      <div className="mb-items" style={{ gridTemplateColumns: `repeat(${round.players.length}, minmax(0, 1fr))` }}>
        {round.players.map(p => {
          const n = niceRound(round, p.id);
          return (
            <div key={p.id} className="mb-item">
              <div className="mb-p">{p.name.split(' ')[0]}</div>
              <div className={`mb-a card-par ${n ? n.tone : ''}`}>{n ? n.toPar : 'E'}</div>
              <div className="mb-d">{n ? `${n.score} so far` : '\u00a0'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Everyone's money, pinned under the header from the first hole, updating as scores go in: one thin
 * strip of names and amounts (Layout Lab A), so the score rows get the room. A tap opens the whole
 * picture in a sheet: thru which hole, what this hole moves, each game's money, the side bets for
 * money in a reward round, and who's just playing.
 */
export function MoneyBar({ round, hole, preview, themed = false }) {
  const m = useMoneyStrip({ round, hole, preview });
  return (
    <>
    <button type="button" className={`money-strip ${themed ? 'themed' : ''}`} aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
      {/* The round's theme is the strip's colour alone: the game's art was too small here to add anything */}
      <span className="ms-items">
        {m.rows.map(r => (
          <span key={r.id} className={`ms-item ${r.lead ? 'lead' : ''}`}>
            <span className="ms-p">{r.name}</span>
            <span key={r.changed ? r.v : 'same'} className={`ms-a ${r.tone} ${r.changed ? 'bump' : ''}`}>{m.fmt(r.v, { sign: true })}</span>
          </span>
        ))}
      </span>
      <Icon name="caret-down" className="ms-more" />
    </button>
    {m.sheet}
    </>
  );
}

