// The money line under the hole's headline, or the card bar under the header when everyone is just
// playing (Play.jsx).
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
 * Everyone's money, under the hole's headline from the first hole and updating as scores go in: names
 * over big amounts straight on the page, ruled above and below. It sticks to the top once the hole
 * scrolls away, so the rows get the screen and the money never leaves it. A tap opens the whole
 * picture in a sheet: thru which hole, what this hole moves, each game's money, the side bets for
 * money in a reward round, and who's just playing.
 */
export function MoneyLine({ round, hole, preview }) {
  const m = useMoneyStrip({ round, hole, preview });
  return (
    <>
    <button type="button" className="money-line" aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
      {m.rows.map(r => (
        <span key={r.id} className={`ml-item ${r.lead ? 'lead' : ''}`}>
          <span className="ml-p">{r.name}</span>
          <span key={r.changed ? r.v : 'same'} className={`ml-a ${r.tone} ${r.changed ? 'bump' : ''}`}>{m.fmt(r.v, { sign: true })}</span>
        </span>
      ))}
      <Icon name="caret-down" className="ml-more" />
    </button>
    {m.sheet}
    </>
  );
}
