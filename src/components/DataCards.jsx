// The pieces the data screens share (the Tab, Your stats, Hall of fame, Season), so they read as one
// system: the one-line insight under a chart, a small score tile, the range pill in a card's corner,
// and a row that folds open one more line. Each is presentation only; the words and numbers come in.
import { useId, useState } from 'react';
import { Icon, Segmented } from './ui.jsx';

const ICONS = { up: 'trend-up', down: 'trend-down', flat: 'minus', wait: 'hourglass-medium' };

/**
 * An arrow, a short label in caps and one plain sentence (data-insights.js). The arrow and its
 * colour follow the kind: up is the win green, down the loss red, steady and early days are quiet.
 */
export function Insight({ insight, className = '' }) {
  if (!insight) return null;
  return (
    <div className={`insight k-${insight.kind} ${className}`}>
      <div className="insight-label"><Icon name={ICONS[insight.kind] || 'minus'} /> {insight.label}</div>
      <p className="insight-text">{insight.text}</p>
    </div>
  );
}

/**
 * A small card with one idea on it: a label, an optional word on the state of it in the tone's
 * colour ("Up"), the number big (`long` wraps a name instead), and a quiet line under it. A
 * tap-through gets a chevron.
 */
export function StatTile({ label, value, state = null, tone = '', sub = null, long = false, onClick = null, aria }) {
  const inner = (
    <>
      <span className="st-top"><span className="eyebrow">{label}</span>{onClick && <Icon name="caret-right" className="st-chev" />}</span>
      {state && <span className={`st-state ${tone}`}>{state}</span>}
      <span className={`st-big d ${tone} ${long ? 'long' : ''}`}>{value}</span>
      {sub && <span className="st-sub">{sub}</span>}
    </>
  );
  if (onClick) return <button type="button" className="stat-tile tap" onClick={onClick} aria-label={aria}>{inner}</button>;
  return <div className="stat-tile">{inner}</div>;
}

/** The small pill in a card's top corner that switches what the card's chart covers. */
export function RangePill({ value, onChange, options, label }) {
  return <Segmented label={label} className="range-pill" btn="rp-btn" value={value} onChange={onChange} options={options} />;
}

/**
 * One row of a list that folds open one more line: a small icon tile, a name with a line under
 * it, the number on the right and a chevron that turns. Opening and closing run the same fold,
 * so what slides down slides back up (Trevor's rule: every entrance gets its exit).
 */
export function FoldRow({ icon, title, sub = null, value, tone = '', children }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className={`fold-row ${open ? 'open' : ''}`}>
      <button type="button" className="fold-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="fold-ic" aria-hidden="true"><Icon name={icon} fill /></span>
        <span className="row-main">
          <span className="fold-title">{title}</span>
          {sub && <span className="fold-sub">{sub}</span>}
        </span>
        <span className={`fold-val d ${tone}`}>{value}</span>
        <span className="fold-chev" aria-hidden="true"><Icon name="caret-down" /></span>
      </button>
      <div className="fold-body" id={id} aria-hidden={!open}>
        <div className="fold-inner">{children}</div>
      </div>
    </li>
  );
}
