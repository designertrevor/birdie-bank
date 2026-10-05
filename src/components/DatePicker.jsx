// The app's own date and tee time pickers, in place of the phone's native ones. Each is a field
// that opens a bottom sheet: a month calendar (tap the month to zoom out to months, then years)
// with quick picks for the days golfers reach for, a two-ended version for a range, and an hour
// and minute picker for tee times. Values are the strings the native inputs gave, "YYYY-MM-DD" and
// "HH:MM", "" when empty, so nothing that reads them changes. The logic is in lib/date-pick.js.
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, PickChip, Segmented, Sheet } from './ui.jsx';
import {
  canStepMonth, hoursFor, nudgeTime, clampISO, dayLook, dayParts, from24, fromISO, inBounds, longDateLabel, minuteChoices, monthCells,
  monthGrid, monthTitle, moveCursor, parseTime, quickDays, rangePresets, rangeTap, timeTap, toISO, yearCells,
} from '../lib/date-pick.js';
import { timeLabel } from '../lib/plans.js';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A bottom sheet on top of everything, even another sheet (the tee time inside the Booked sheet):
 * it renders at the device frame, so the sheet it's opened from can't clip or cover it.
 */
export function PickSheet({ open, onClose, title, children }) {
  if (!open) return null;
  const host = document.querySelector('.device') || document.body;
  return createPortal(<Sheet open onClose={onClose} title={title} className="sheet pick-sheet">{children}</Sheet>, host);
}

/** Open and close a picker, and hand focus back to its field when it closes. */
function usePicker() {
  const [openAt, setOpenAt] = useState(null);
  const fieldRef = useRef(null);
  const returnTo = useRef(null);
  const was = useRef(false);
  useEffect(() => {
    if (openAt) { was.current = true; return; }
    if (was.current) { was.current = false; (returnTo.current || fieldRef.current)?.focus({ preventScroll: true }); }
  }, [openAt]);
  // `now` is when the sheet opened, so Today and the quick picks hold still while it's up.
  // `el` is the field to go back to when it isn't the one in fieldRef (a range has two).
  const show = el => { returnTo.current = el || null; setOpenAt(new Date()); };
  return { open: !!openAt, now: openAt, show, close: () => setOpenAt(null), fieldRef };
}

/** The field a picker opens from: the value (or a placeholder) and an icon, styled like the inputs around it. */
export function PickField({ id, fieldRef, className, icon, main, sub, placeholder, said, open, onOpen, disabled }) {
  return (
    <button ref={fieldRef} id={id} type="button" className={`${className} pick-field ${main ? '' : 'empty'}`} onClick={onOpen} disabled={disabled}
      aria-haspopup="dialog" aria-expanded={open} aria-label={said}>
      <span className="pf-text">
        <span className="pf-main">{main || placeholder}</span>
        {sub && <span className="pf-sub">{sub}</span>}
      </span>
      <Icon name={icon} className="pf-icon" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------

/**
 * A month of days, with arrows for the month either side and the title to zoom out to months and
 * years. The arrow keys move a day or a week, Page Up and Page Down a month, Home and End the week.
 * `rangeStart` and `rangeEnd` shade the days between them.
 */
function Calendar({ value, onPick, min, max, rangeStart, rangeEnd, now, label, autoFocus = true }) {
  const today = toISO(now);
  const [cursor, setCursor] = useState(() => {
    const seed = [value, rangeEnd, rangeStart].find(v => fromISO(v)) || today;
    return clampISO(seed, min, max);
  });
  const [view, setView] = useState('days');
  const [slide, setSlide] = useState('');
  const gridRef = useRef(null);
  // The cursor day takes focus when the sheet opens and after a key moves it, not after an arrow tap
  const focusCursor = useRef(autoFocus);
  const d = fromISO(cursor);
  const y = d.getFullYear(), m = d.getMonth();

  useEffect(() => {
    if (view !== 'days' || !focusCursor.current) return;
    focusCursor.current = false;
    gridRef.current?.querySelector('[data-cursor="true"]')?.focus({ preventScroll: true });
  }, [cursor, view]);

  const go = (iso, dir) => {
    setSlide(dir < 0 ? 'from-left' : dir > 0 ? 'from-right' : '');
    setCursor(clampISO(iso, min, max));
  };
  const stepMonth = dir => {
    const first = new Date(y, m + dir, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    go(toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last))), dir);
  };
  const onKey = e => {
    const next = moveCursor(cursor, e.key);
    if (!next) return;
    e.preventDefault();
    if (!inBounds(next, min, max)) return;
    focusCursor.current = true;
    const nd = fromISO(next);
    go(next, nd.getFullYear() * 12 + nd.getMonth() - (y * 12 + m));
  };
  const zoomIn = iso => { focusCursor.current = true; setSlide('zoom'); setCursor(clampISO(iso, min, max)); setView('days'); };

  let head, body;
  if (view === 'days') {
    const weeks = monthGrid(y, m, { min, max, today });
    head = (
      <>
        <button type="button" className="icon-btn" onClick={() => stepMonth(-1)} disabled={!canStepMonth(y, m, -1, min, max)} aria-label="Previous month"><Icon name="caret-left" /></button>
        <button type="button" className="cal-title" onClick={() => { setSlide('zoom'); setView('months'); }} aria-label={`${monthTitle(y, m)}. Pick a month`}>
          {monthTitle(y, m)} <Icon name="caret-down" />
        </button>
        <button type="button" className="icon-btn" onClick={() => stepMonth(1)} disabled={!canStepMonth(y, m, 1, min, max)} aria-label="Next month"><Icon name="caret-right" /></button>
      </>
    );
    body = (
      <>
        <div className="cal-dow" aria-hidden="true">{DOW.map((x, i) => <span key={i}>{x}</span>)}</div>
        <div key={`${y}-${m}`} ref={gridRef} className={`cal-days cal-anim ${slide}`} role="group" aria-label={monthTitle(y, m)} onKeyDown={onKey}>
          {weeks.flat().map(c => {
            const { on, mid, start, end } = dayLook(c.iso, { value, rangeStart, rangeEnd });
            const isCursor = c.iso === cursor;
            return (
              <button key={c.iso} type="button" data-cursor={isCursor} data-autofocus={isCursor && autoFocus ? 'true' : undefined} tabIndex={isCursor ? 0 : -1}
                className={`cal-day${c.outside ? ' out' : ''}${on ? ' on' : ''}${mid ? ' mid' : ''}${start ? ' start' : ''}${end ? ' end' : ''}${c.today ? ' today' : ''}`}
                aria-pressed={on} aria-current={c.today ? 'date' : undefined} aria-disabled={c.disabled || undefined}
                aria-label={`${longDateLabel(c.iso)}${c.today ? ', today' : ''}`}
                onClick={() => { if (c.disabled) return; setCursor(c.iso); onPick(c.iso); }}>
                <span className="cd-num">{c.day}</span>
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (view === 'months') {
    const picked = (value || '').slice(0, 7);
    head = (
      <>
        <button type="button" className="icon-btn" onClick={() => go(`${y - 1}-${String(m + 1).padStart(2, '0')}-01`, -1)} disabled={!inBounds(String(y - 1), min, max)} aria-label="Previous year"><Icon name="caret-left" /></button>
        <button type="button" className="cal-title" onClick={() => { setSlide('zoom'); setView('years'); }} aria-label={`${y}. Pick a year`}>{y} <Icon name="caret-down" /></button>
        <button type="button" className="icon-btn" onClick={() => go(`${y + 1}-${String(m + 1).padStart(2, '0')}-01`, 1)} disabled={!inBounds(String(y + 1), min, max)} aria-label="Next year"><Icon name="caret-right" /></button>
      </>
    );
    body = (
      <div key={`m${y}`} className={`cal-cells cal-anim ${slide}`} role="group" aria-label={`Months of ${y}`}>
        {monthCells(y, { min, max }).map(c => (
          <button key={c.ym} type="button" className={`cal-cell${c.ym === picked ? ' on' : ''}${c.ym === today.slice(0, 7) ? ' now' : ''}`} disabled={c.disabled}
            aria-pressed={c.ym === picked} aria-label={`${monthTitle(y, c.month)}`} onClick={() => zoomIn(c.ym === picked ? value : `${c.ym}-01`)}>{c.label}</button>
        ))}
      </div>
    );
  } else {
    const years = yearCells(y, { min, max });
    const first = years[0].year, last = years[years.length - 1].year;
    head = (
      <>
        <button type="button" className="icon-btn" onClick={() => go(`${y - 12}-${String(m + 1).padStart(2, '0')}-01`, -1)} disabled={!inBounds(String(first - 1), min, max)} aria-label="Earlier years"><Icon name="caret-left" /></button>
        <span className="cal-title static">{first} to {last}</span>
        <button type="button" className="icon-btn" onClick={() => go(`${y + 12}-${String(m + 1).padStart(2, '0')}-01`, 1)} disabled={!inBounds(String(last + 1), min, max)} aria-label="Later years"><Icon name="caret-right" /></button>
      </>
    );
    body = (
      <div key={`y${first}`} className={`cal-cells cal-anim ${slide}`} role="group" aria-label={`${first} to ${last}`}>
        {years.map(c => (
          <button key={c.year} type="button" className={`cal-cell${String(c.year) === (value || '').slice(0, 4) ? ' on' : ''}${String(c.year) === today.slice(0, 4) ? ' now' : ''}`}
            disabled={c.disabled} aria-pressed={String(c.year) === (value || '').slice(0, 4)}
            onClick={() => { setSlide('zoom'); setCursor(clampISO(`${c.year}-${String(m + 1).padStart(2, '0')}-01`, min, max)); setView('months'); }}>{c.year}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="cal" aria-label={label} role="group">
      <div className="cal-head">{head}</div>
      {body}
      <span className="sr-only" aria-live="polite">{view === 'days' ? monthTitle(y, m) : view === 'months' ? String(y) : ''}</span>
    </div>
  );
}

/** The days golfers reach for, as the same day chips the round setup uses. */
function QuickDays({ now, value, min, max, onPick }) {
  const id = useId();
  const days = quickDays(now, { min, max });
  if (!days.length) return null;
  return (
    <div className="pick-section">
      <span className="eyebrow" id={id}>Quick picks</span>
      <div className="day-strip" role="radiogroup" aria-labelledby={id}>
        {days.map(q => (
          <button key={q.iso} type="button" role="radio" aria-checked={q.iso === value} aria-label={q.said}
            className={`day-chip ${q.iso === value ? 'on' : ''}`} onClick={() => onPick(q.iso)}>
            <span className="dc-top">{q.top}</span><span className="dc-bottom">{q.bottom}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One day
// ---------------------------------------------------------------------------

/**
 * A day field. Tapping a day (or a quick pick) sets it and closes the sheet. `rangeStart` and
 * `rangeEnd` shade a span the day belongs to (a trip's first and last days). `quick` shows Today,
 * Tomorrow and the coming weekend; `clearable` adds a way to empty it.
 */
export function DatePicker({
  id, label, value = '', onChange, min, max, rangeStart, rangeEnd, quick = false, clearable = false,
  placeholder = 'Pick a day', className = 'text-input', weekday = true, disabled,
}) {
  const p = usePicker();
  const [now] = useState(() => new Date());
  const parts = dayParts(value, now, { weekday });
  const pick = iso => { if (iso !== value) onChange(iso); p.close(); };
  return (
    <>
      <PickField id={id} fieldRef={p.fieldRef} className={className} icon="calendar-blank" main={parts.main} sub={parts.year} placeholder={placeholder}
        said={`${label}: ${value ? longDateLabel(value) : 'not set'}`} open={p.open} onOpen={() => p.show()} disabled={disabled} />
      <PickSheet open={p.open} onClose={p.close} title={label}>
        {p.open && (
          <div className="pick-body">
            {quick && <QuickDays now={p.now} value={value} min={min} max={max} onPick={pick} />}
            <Calendar value={value} onPick={pick} min={min} max={max} rangeStart={rangeStart} rangeEnd={rangeEnd} now={p.now} label={label} />
            {clearable && value && (
              <div className="pick-foot one">
                <button type="button" className="full-btn outline" onClick={() => pick('')}>Clear the date</button>
              </div>
            )}
          </div>
        )}
      </PickSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// A range
// ---------------------------------------------------------------------------

/**
 * From and To fields side by side that open one sheet: pick which end you're setting, tap a day
 * (From moves on to To), or start from a recent range. Nothing changes until Done.
 */
export function DateRangePicker({ from = '', to = '', onChange, min, max, title = 'Custom dates', labels = ['From', 'To'], className = 'text-input' }) {
  const p = usePicker();
  const uidBase = useId();
  const [now] = useState(() => new Date());
  const [draft, setDraft] = useState({ from, to });
  const [editing, setEditing] = useState('from');
  // A new key re-seeds the calendar on the end being set (when you switch ends or take a preset)
  const [jump, setJump] = useState(0);
  // The calendar takes focus when the sheet opens, but not when you switch ends or take a preset
  const [focusGrid, setFocusGrid] = useState(true);
  const reseed = () => { setFocusGrid(false); setJump(j => j + 1); };
  // Focus goes back to the field the sheet was opened from
  const endRefs = useRef({});
  const openOn = end => { setDraft({ from, to }); setEditing(end); setFocusGrid(true); setJump(j => j + 1); p.show(endRefs.current[end]); };
  const tap = iso => { const r = rangeTap(draft, iso, editing); setDraft(r.range); setEditing(r.editing); };
  const done = () => {
    let { from: a, to: b } = draft;
    if (a && b && a > b) [a, b] = [b, a];
    if (a !== from || b !== to) onChange({ from: a, to: b });
    p.close();
  };
  const presets = p.open ? rangePresets(p.now).filter(r => inBounds(r.from, min, max) && inBounds(r.to, min, max)) : [];
  const ends = [['from', labels[0]], ['to', labels[1]]];
  return (
    <>
      <div className="range-dates">
        {ends.map(([k, text]) => {
          const v = k === 'from' ? from : to;
          const parts = dayParts(v, now, { weekday: false });
          return (
            <div key={k} className="rd-end">
              <label className="eyebrow" htmlFor={`${uidBase}-${k}`}>{text}</label>
              <PickField id={`${uidBase}-${k}`} fieldRef={el => { endRefs.current[k] = el; }} className={className} icon="calendar-blank"
                main={parts.main} sub={parts.year} placeholder="Any day" said={`${text}: ${v ? longDateLabel(v) : 'any day'}`}
                open={p.open && editing === k} onOpen={() => openOn(k)} />
            </div>
          );
        })}
      </div>
      <PickSheet open={p.open} onClose={p.close} title={title}>
        {p.open && (
          <div className="pick-body">
            <Segmented label="Which date you’re setting" className="rg-ends" btn="rg-end" value={editing}
              onChange={k => { setEditing(k); reseed(); }}
              options={ends.map(([k, text]) => {
                const v = draft[k];
                return {
                  value: k, aria: `${text}: ${v ? longDateLabel(v) : 'any day'}`,
                  label: <><span className="eyebrow">{text}</span><strong className={v ? '' : 'empty'}>{v ? dayParts(v, p.now, { weekday: false }).main : 'Any day'}</strong></>,
                };
              })} />
            {presets.length > 0 && (
              <div className="pick-presets" role="group" aria-label="Recent ranges">
                {presets.map(r => {
                  const on = r.from === draft.from && r.to === draft.to;
                  return (
                    <PickChip key={r.key} on={on}
                      onClick={() => { setDraft({ from: r.from, to: r.to }); setEditing('to'); reseed(); }}>
                      {r.label}
                    </PickChip>
                  );
                })}
              </div>
            )}
            <Calendar key={jump} value={draft[editing]} onPick={tap} min={min} max={max} rangeStart={draft.from} rangeEnd={draft.to} now={p.now}
              label={editing === 'from' ? labels[0] : labels[1]} autoFocus={focusGrid} />
            <div className="pick-foot">
              <button type="button" className="full-btn outline" onClick={() => { setDraft({ from: '', to: '' }); setEditing('from'); }} disabled={!draft.from && !draft.to}>Clear</button>
              <button type="button" className="full-btn" onClick={done}>Done</button>
            </div>
          </div>
        )}
      </PickSheet>
    </>
  );
}

// ---------------------------------------------------------------------------
// A tee time
// ---------------------------------------------------------------------------

/**
 * A tee time field. The sheet has AM and PM, the hours and the minutes on the step the native
 * input had (5 minutes for a tee sheet). Picking an hour gives :00 straight away, so one tap is a
 * time; each tap saves, and Done closes. `clearable` adds a way to take the time off.
 */
export function TimePicker({ id, label, value = '', onChange, step = 300, clearable = true, placeholder = 'Add a time', className = 'text-input', disabled }) {
  const p = usePicker();
  const t = parseTime(value);
  const [half, setHalf] = useState(() => (t ? from24(t.h).half : 'am'));
  const showHalf = t ? from24(t.h).half : half;
  const set = v => { if (v !== value) onChange(v); };
  return (
    <>
      <PickField id={id} fieldRef={p.fieldRef} className={className} icon="clock" main={timeLabel(value)} placeholder={placeholder}
        said={`${label}: ${timeLabel(value) || 'not set'}`} open={p.open} onOpen={() => p.show()} disabled={disabled} />
      <PickSheet open={p.open} onClose={p.close} title={label}>
        <div className="pick-body">
          {/* A minute either way, for a booked time off the 5 minute grid (tee sheets run 7 to 10 minutes apart) */}
          <div className="tp-value-row">
            {t && <button type="button" className="icon-btn tp-nudge" onClick={() => set(nudgeTime(value, -1))} aria-label="One minute earlier"><Icon name="minus" /></button>}
            <div className={`tp-value ${t ? '' : 'empty'}`} aria-live="polite">{timeLabel(value) || 'Pick the hour'}</div>
            {t && <button type="button" className="icon-btn tp-nudge" onClick={() => set(nudgeTime(value, 1))} aria-label="One minute later"><Icon name="plus" /></button>}
          </div>
          <Segmented label="Morning or afternoon" className="holes-toggle tp-half" btn="holes-btn" value={showHalf}
            onChange={h => { setHalf(h); set(timeTap(value, 'half', h)); }}
            options={[{ value: 'am', label: 'AM' }, { value: 'pm', label: 'PM' }]} />
          <div className="pick-section">
            <span className="eyebrow" aria-hidden="true">Hour</span>
            <Segmented label="Hour" className="tp-grid" btn="tp-chip" value={t ? from24(t.h).h12 : null}
              onChange={h => set(timeTap(value, 'hour', h, showHalf))}
              options={hoursFor(showHalf).map(h => ({ value: h, label: String(h), aria: `${h} ${showHalf === 'am' ? 'AM' : 'PM'}` }))} />
          </div>
          <div className="pick-section">
            <span className="eyebrow" aria-hidden="true">Minutes</span>
            <Segmented label="Minutes" className="tp-grid" btn="tp-chip" value={t ? t.m : null}
              onChange={n => set(timeTap(value, 'minute', n))}
              options={minuteChoices(step, value).map(n => ({ value: n, label: `:${String(n).padStart(2, '0')}`, aria: `${n} minutes past`, disabled: !t }))} />
            {!t && <p className="field-help">Pick the hour first.</p>}
          </div>
          <div className={`pick-foot ${clearable && value ? '' : 'one'}`}>
            {clearable && value && <button type="button" className="full-btn outline" onClick={() => set('')}>Clear</button>}
            <button type="button" className="full-btn" onClick={p.close}>Done</button>
          </div>
        </div>
      </PickSheet>
    </>
  );
}
