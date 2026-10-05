// The time control History uses, shared with Your stats: Season, Month or Custom (and All time
// where a screen offers it), with arrows to step back and forward and two dates for Custom.
import { Icon, Segmented } from './ui.jsx';
import { DateRangePicker } from './DatePicker.jsx';
import { isLatest, rangeLabel, rangeOfKind, shiftRange } from '../lib/history.js';

const LABELS = { all: 'All time', season: 'Season', month: 'Month', custom: 'Custom' };

export function RangeBar({ range, onChange, kinds = ['season', 'month', 'custom'] }) {
  const label = rangeLabel(range);
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
