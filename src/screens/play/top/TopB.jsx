// Trial top B, "On the page": no cards at all. The money is a line of names and amounts over a hairline,
// the hole is a headline ("Hole 3") with par and HCP under it, and the game's panel is set flat on the
// page under a small label. The idea it tests: type and space do the grouping, so nothing competes as a box.
// Pinned: the money line stays under the header, as today; the hole and the game's part scroll away.
import { Icon } from '../../../components/ui.jsx';
import { useMoneyStrip } from '../useMoneyStrip.jsx';
import { strokesHere } from '../hole-info.js';
import { Amount } from './MoneyNums.jsx';
import './top-shared.css';
import './top-b.css';

export function Pinned(t) {
  const m = useMoneyStrip(t);
  return (
    <>
      <button type="button" className="tb-money" aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
        {m.rows.map(r => (
          <span key={r.id} className={`tb-item ${r.lead ? 'lead' : ''}`}>
            <span className="tb-p">{r.name}</span>
            <Amount m={m} r={r} />
          </span>
        ))}
        <Icon name="caret-down" className="tb-more" />
      </button>
      {m.sheet}
    </>
  );
}

export function Head(t) {
  const { round, hole, units, solo, holeFixed } = t;
  const getting = strokesHere(round, hole, units, solo);
  const meta = [`Par ${hole.par}`, `HCP ${hole.hdcp ?? '–'}`];
  return (
    <div className="tb-head">
      <div className="tb-hole">
        <h2 className="tb-title">Hole {hole.no}</h2>
        <button type="button" className="tb-card" onClick={t.openCard} aria-label={holeFixed ? `Open scorecard. Hole ${hole.no}’s par or HCP was fixed for this round` : 'Open scorecard'}>
          <Icon name="table" /> Scorecard
        </button>
      </div>
      <p className="tb-meta">
        {meta.join(' · ')}{holeFixed && <span className="fixed-tag">Fixed</span>}
        {getting && (getting.length
          ? <span className="tb-strokes"> · <span className="stroke-dots" aria-hidden="true">●</span> Strokes: {getting.length > 2 ? `${getting.length} players` : getting.join(', ')}</span>
          : <span className="tb-strokes"> · No strokes here</span>)}
      </p>
      <div className="tb-game top-flat">{t.panels()}</div>
    </div>
  );
}
