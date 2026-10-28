// Setup's small pickers (NewRound.jsx and its steps): 9 or 18 holes, the hole to tee off on, the
// starting hole sheet, and the day and tee time of a planned round.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Segmented, Sheet } from '../../components/ui.jsx';
import { DateSheet, TimePicker } from '../../components/DatePicker.jsx';
import { dayChoices, isoDate } from '../../lib/plans.js';
import { dayName } from '../../lib/setup-screen.js';

/** 9 or 18 holes, with the lengths the game can't be played over switched off. */
export function HolesPicker({ game, holesCount, setHolesCount }) {
  return (
    <div className="block">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Holes</div>
      <Segmented label="Holes" value={holesCount} onChange={setHolesCount}
        options={[9, 18].map(n => ({ value: n, label: String(n), disabled: game && !game.holes.includes(n) }))} />
      {game && game.holes.length === 1 && <p className="field-help">{game.name} is played over {game.holes[0]} holes.</p>}
    </div>
  );
}

/** Tee off on: the first hole, hole 10 on an 18, or any other hole from the hole sheet. */
export function TeeOffPicker({ holes, canTen, startHole, setStartHole }) {
  const [picking, setPicking] = useState(false);
  const first = holes[0].no;
  const ten = canTen && holes.some(h => h.no === 10) ? 10 : null;
  // A start that isn't on these holes any more (the nine changed) is the first hole
  const at = holes.some(h => h.no === startHole) ? startHole : first;
  const other = at !== first && at !== ten;
  const options = [{ value: first, label: `Hole ${first}` }, ...(ten ? [{ value: ten, label: 'Hole 10' }] : []),
    { value: 'other', label: other ? `Hole ${at}` : 'Other', aria: other ? `Hole ${at}, change it` : 'Another hole' }];
  return (
    <div className="block">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Tee off on</div>
      <Segmented label="Tee off on" value={other ? 'other' : at} onChange={v => (v === 'other' ? setPicking(true) : setStartHole(v === first ? null : v))} options={options} />
      <p className="field-help">{other ? `Shotgun start on hole ${at}. The round wraps around from there.` : 'Shotgun start? Tap Other to pick any hole.'}</p>
      <HolePicker open={picking} holes={holes} value={at} onClose={() => setPicking(false)} onPick={no => { setStartHole(no === first ? null : no); setPicking(false); }} />
    </div>
  );
}

/** Two-column bottom sheet for choosing a hole. */
export function HolePicker({ open, holes, value, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="Starting hole">
      <p className="sheet-text">Pick where the group tees off. The round runs from there and wraps around.</p>
      <div className="hole-grid-pick" role="listbox" aria-label="Starting hole" style={{ gridTemplateRows: `repeat(${Math.ceil(holes.length / 2)}, auto)` }}>
        {[...holes].sort((a, b) => a.no - b.no).map(h => (
          <button key={h.no} role="option" aria-selected={h.no === value} className={`hole-opt ${h.no === value ? 'on' : ''}`} onClick={() => onPick(h.no)}>
            <strong>{h.no}</strong>{h.par != null && <span>Par {h.par}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** The day (next two weeks) and the tee time, above the course list. */
export function WhenPicker({ date, setDate, teeTime, setTeeTime }) {
  const [picking, setPicking] = useState(false);
  // A day further out than two weeks (picked from the calendar, or an edited plan's) leads the strip, picked
  const days = useMemo(() => {
    const list = dayChoices(new Date(), 14);
    if (!date || list.some(d => d.iso === date)) return list;
    const [y, m, d] = date.split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const extra = { ...dayChoices(day, 1)[0], top: day.toLocaleDateString('en-US', { weekday: 'short' }) };
    return [extra, ...list];
  }, [date]);
  // The picked day starts in view (an edited plan's day can sit past the right edge), the strip only
  const strip = useRef(null);
  useEffect(() => {
    const el = strip.current;
    const on = el?.querySelector('.day-chip.on');
    if (on) el.scrollLeft = Math.max(0, on.offsetLeft - el.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
  }, []);
  return (
    <div className="block when-block">
      <div className="eyebrow" id="when-day" style={{ marginBottom: 10 }}>Day</div>
      <div className="day-strip" role="radiogroup" aria-labelledby="when-day" ref={strip}>
        {days.map(d => (
          <button key={d.iso} role="radio" aria-checked={d.iso === date} aria-label={dayName(d.iso)} className={`day-chip ${d.iso === date ? 'on' : ''}`} onClick={() => setDate(d.iso)}>
            <span className="dc-top">{d.top}</span><span className="dc-bottom">{d.bottom}</span>
          </button>
        ))}
        <button type="button" className="day-chip more" onClick={() => setPicking(true)} aria-haspopup="dialog">
          <Icon name="calendar-blank" /><span className="dc-bottom">Pick a date</span>
        </button>
      </div>
      <DateSheet open={picking} onClose={() => setPicking(false)} title="Day" value={date} min={isoDate()} onPick={setDate} />
      <label className="field-label" htmlFor="when-time" style={{ marginTop: 14 }}>Tee time <span className="opt">optional</span></label>
      <TimePicker id="when-time" label="Tee time" className="name-input time-input" value={teeTime} onChange={setTeeTime} step={300} placeholder="Add a tee time" />
    </div>
  );
}
