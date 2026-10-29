// Trial top A, "One card": the hole, what it's worth and everyone's money in a single card, read top
// to bottom (the hole, the bet, where it stands). The idea it tests: one container instead of three
// stacked bands of different weights reads as one thing at a glance.
// Pinned: the card scrolls up with the rows until only its money row is left, and that row stays put
// (a sticky card lifted by its own height less the money row's), so the money never leaves the screen.
import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui.jsx';
import { useMoneyStrip } from '../useMoneyStrip.jsx';
import { strokesHere } from '../hole-info.js';
import { Amount } from './MoneyNums.jsx';
import './top-shared.css';
import './top-a.css';

export function Head(t) {
  const { round, hole, units, solo, holeFixed } = t;
  const m = useMoneyStrip(t);
  const card = useRef(null);
  const foot = useRef(null);
  // How far the card lifts before it sticks: its height less the money row's
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setLift(Math.max(0, el.offsetHeight - (foot.current?.offsetHeight || 0)));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const getting = strokesHere(round, hole, units, solo);
  return (
    <section className="ta-card" ref={card} style={{ top: -lift }}>
      <button type="button" className="ta-hole" onClick={t.openCard} aria-label={holeFixed ? `Open scorecard. Hole ${hole.no}’s par or HCP was fixed for this round` : 'Open scorecard'}>
        <span className="ta-no" aria-hidden="true">{hole.no}</span>
        <span className="ta-main">
          <span className="ta-meta">Par {hole.par} · HCP {hole.hdcp ?? '–'}{holeFixed && <span className="fixed-tag">Fixed</span>}</span>
          {getting && (getting.length
            ? <span className="ta-strokes"><span className="stroke-dots" aria-hidden="true">●</span>Strokes: {getting.length > 2 ? `${getting.length} players` : getting.join(', ')}</span>
            : <span className="ta-strokes">No strokes here</span>)}
        </span>
        <span className="ta-cardbtn"><Icon name="table" /> Card</span>
      </button>
      <div className="ta-game top-flat">{t.panels()}</div>
      <button type="button" className="ta-money" ref={foot} aria-haspopup="dialog" onClick={m.show} aria-label={m.label}>
        <span className="ta-items">
          {m.rows.map(r => (
            <span key={r.id} className={`ta-item ${r.lead ? 'lead' : ''}`}>
              <span className="ta-p">{r.name}</span>
              <Amount m={m} r={r} />
            </span>
          ))}
        </span>
        <Icon name="caret-down" className="ta-more" />
      </button>
      {m.sheet}
    </section>
  );
}
