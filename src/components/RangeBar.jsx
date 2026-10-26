// The time control History uses, shared with Your stats: Season, Month or Custom (and All time
// where a screen offers it), with arrows to step back and forward and two dates for Custom.
import { Icon, Segmented } from './ui.jsx';
import { DateRangePicker } from './DatePicker.jsx';
import { isLatest, rangeLabel, rangeOfKind, shiftRange } from '../lib/history.js';

const LABELS = { all: 'All time', season: 'Season', month: 'Month', custom: 'Custom' };

export function RangeBar({ range, onChange, kinds = ['season', 'month', 'custom'], compact = false }) {
  const label = rangeLabel(range);
  // History's compact bar (overhaul): the range and its arrows on the left, the kinds as a small
  // switch on the right, so the chart and the rounds get the room
  if (compact) {
    // The short form fits beside the switch: "2026", "Oct 2026"
    const short = range.kind === 'season' ? String(range.year)
      : range.kind === 'month' ? new Date(range.year, range.month, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : label;
    return (
      <div className="range-bar compact">
        <div className="rb-row">
          {range.kind === 'custom' || range.kind === 'all' ? <span className="range-label">{label}</span> : (
            <div className="range-step">
              <button className="icon-btn sm" onClick={() => onChange(shiftRange(range, -1))} aria-label={`Previous ${range.kind}`}><Icon name="caret-left" /></button>
              <span className="range-label" aria-live="polite"><span aria-hidden="true">{short}</span><span className="sr-only">{label}</span></span>
              <button className="icon-btn sm" onClick={() => onChange(shiftRange(range, 1))} disabled={isLatest(range)} aria-label={`Next ${range.kind}`}><Icon name="caret-right" /></button>
            </div>
          )}
          <Segmented label="Time range" className="rb-kinds" btn="rb-kind" value={range.kind} onChange={k => onChange(rangeOfKind(k, range))}
            options={kinds.map(k => ({ value: k, label: LABELS[k] }))} />
        </div>
        {range.kind === 'custom' && <DateRangePicker from={range.from} to={range.to} onChange={r => onChange({ ...range, ...r })} />}
      </div>
    );
  }
  return (
    <div className="range-bar">
      <Segmented label="Time range" className="press-mode-row" btn="pm-btn" value={range.kind} onChange={k => onChange(rangeOfKind(k, range))}
        options={kinds.map(k => ({ value: k, label: LABELS[k] }))} />
      {range.kind === 'custom' ? (
        <DateRangePicker from={range.from} to={range.to} onChange={r => onChange({ ...range, ...r })} />
      ) : range.kind === 'all' ? null : (
        <div className="range-step">
          <button className="icon-btn sm" onClick={() => onChange(shiftRange(range, -1))} aria-label={`Previous ${range.kind}`}><Icon name="caret-left" /></button>
          <span className="range-label" aria-live="polite">{label}</span>
          <button className="icon-btn sm" onClick={() => onChange(shiftRange(range, 1))} disabled={isLatest(range)} aria-label={`Next ${range.kind}`}><Icon name="caret-right" /></button>
        </div>
      )}
    </div>
  );
}
