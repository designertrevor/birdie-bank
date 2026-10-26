// The pieces the one-screen ask (PlanAsk.jsx) and the plan page (Plan.jsx) share: a detail's state
// tag, the four detail rows, the day tiles, who's in as seat tiles, the ticket, and the sheets for
// the day, the course and the game and bet. The rules behind them are in lib/plan-open.js.
import { useState } from 'react';
import { Icon, PickChip, PickRow, Segmented, Sheet } from '../../components/ui.jsx';
import { DateSheet, TimePicker } from '../../components/DatePicker.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { Spot } from '../../components/Spot.jsx';
import '../../art-places.css';
import { useStore } from '../../lib/store.js';
import { GAMES } from '../../lib/round.js';
import { coursePickerSections } from '../../lib/courses.js';
import { isoDate } from '../../lib/plan-basics.js';
import { BET_LADDER } from '../../lib/plans.js';
import { money } from '../../lib/golf.js';
import { MAX_DAY_OPTIONS, STATE_LABEL, dayTile, shortDay, soonDays, waitingLine } from '../../lib/plan-open.js';
import './plan.css';

const first = name => String(name || '').trim().split(/\s+/)[0];

/** A detail's state as a tag: Set (with what it is), Up for a vote, Not yet. */
export function StateTag({ s }) {
  return <span className={`st-tag ${s.state}`} title={STATE_LABEL[s.state]}><span className="sr-only">{STATE_LABEL[s.state]}: </span>{s.label}</span>;
}

/**
 * The details as rows, each with its state; a row with `onOpen` is a button. `rows`:
 * [{ key, icon, label, s: { state, label }, onOpen, sub }]
 */
export function DetailRows({ rows }) {
  return (
    <div className="pd-rows">
      {rows.map(r => {
        const inner = (
          <>
            <span className="pd-ic" aria-hidden="true"><Icon name={r.icon} /></span>
            <span className="row-main"><span className="pd-k">{r.label}</span>{r.sub && <span className="pd-sub">{r.sub}</span>}</span>
            <StateTag s={r.s} />
            {r.onOpen && <Icon name="caret-right" className="pd-go" />}
          </>
        );
        return r.onOpen
          ? <button key={r.key} type="button" className="pd-row" onClick={r.onOpen}>{inner}</button>
          : <div key={r.key} className="pd-row">{inner}</div>;
      })}
    </div>
  );
}

/**
 * Day tiles to tick: `days` are the ones to show, `on` the ticked ones. `add` puts a "+" tile at
 * the end that opens the calendar; `counts` puts how many can make each day under it.
 */
export function DayTiles({ days, on, onToggle, onAdd, addLabel = 'Pick', counts = null, radio = false, label }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <div className="pd-days" role={radio ? 'radiogroup' : 'group'} aria-label={label}>
        {days.map(iso => {
          const t = dayTile(iso);
          const picked = on.includes(iso);
          const a11y = radio ? { role: 'radio', 'aria-checked': picked } : { 'aria-pressed': picked };
          return (
            <button key={iso} type="button" className={`pd-day ${picked ? 'on' : ''}`} onClick={() => onToggle(iso)} {...a11y}
              aria-label={`${shortDay(iso)}${counts?.[iso] ? `, ${counts[iso]} can make it` : ''}`}>
              <span className="pdd-top">{t.top}</span><b>{t.bottom}</b>
              <span className="pdd-sub">{counts ? (counts[iso] ? `${counts[iso]} can` : ' ') : t.month}</span>
            </button>
          );
        })}
        {onAdd && (
          <button type="button" className="pd-day add" onClick={() => setPicking(true)}>
            <span className="pdd-top">{addLabel}</span><b><Icon name="plus" /></b><span className="pdd-sub">a day</span>
          </button>
        )}
      </div>
      {onAdd && <DateSheet open={picking} onClose={() => setPicking(false)} title="Pick a day" min={isoDate()} onPick={iso => onAdd(iso)} />}
    </>
  );
}

/** Who's on the plan as seat tiles: their face and their answer. `onAdd`: a "+" tile to ask more. */
export function SeatTiles({ people, me, onTap, onAdd, addLabel = 'Ask more' }) {
  const shown = people.filter(p => p.status !== 'out');
  const out = people.length - shown.length;
  return (
    <div className="pd-seats" role="list" aria-label="Who’s in">
      {shown.map(p => {
        const tile = (
          <>
            <Avatar id={p.who} name={p.name} />
            <span className="ps-name">{p.who === me ? 'You' : first(p.name)}</span>
            <span className={`ps-status ${p.status || 'none'}`}>{p.status === 'in' ? 'In' : p.status === 'maybe' ? 'Maybe' : 'No answer'}</span>
          </>
        );
        return (
          <div key={p.who} role="listitem" className="ps-cell">
            {onTap ? <button type="button" className="pd-seat" onClick={() => onTap(p)}>{tile}</button> : <div className="pd-seat">{tile}</div>}
          </div>
        );
      })}
      {onAdd && (
        <div role="listitem" className="ps-cell">
          <button type="button" className="pd-seat open" onClick={onAdd}>
            <span className="avatar ps-plus"><Icon name="plus" /></span>
            <span className="ps-name">Open</span><span className="ps-status none">{addLabel}</span>
          </button>
        </div>
      )}
      {out > 0 && <p className="ps-out">{out} can’t make it</p>}
    </div>
  );
}

// --------------------------- the When sheet ---------------------------------

/**
 * When: Set a day, A few options, or Not sure yet, and morning or afternoon in place of a tee time.
 * `value`: { mode, date, days, part }. Nothing changes until Done.
 */
export function WhenSheet({ open, value, onDone, onClose }) {
  const [v, setV] = useState(value);
  // A fresh copy each time it opens
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); if (open) setV(value); }
  const soon = soonDays(new Date());
  const extra = [...(v.days || []), v.date].filter(d => d && !soon.includes(d));
  const days = [...new Set([...soon, ...extra])].sort();
  const toggle = iso => setV(x => {
    if (x.mode === 'set') return { ...x, date: x.date === iso ? null : iso };
    const has = x.days.includes(iso);
    if (!has && x.days.length >= MAX_DAY_OPTIONS) return x;
    return { ...x, days: has ? x.days.filter(d => d !== iso) : [...x.days, iso].sort() };
  });
  const add = iso => setV(x => (x.mode === 'set' ? { ...x, date: iso } : { ...x, days: [...new Set([...x.days, iso])].sort().slice(0, MAX_DAY_OPTIONS) }));
  const ok = v.mode === 'open' || (v.mode === 'set' ? !!v.date : v.days.length > 0);
  return (
    <Sheet open={open} onClose={onClose} title="When">
      <div className="pd-sheet">
        <Segmented label="When" className="holes-toggle pd-seg" value={v.mode} onChange={mode => setV({ ...v, mode })}
          options={[{ value: 'set', label: 'Set a day' }, { value: 'options', label: 'A few options' }, { value: 'open', label: 'Not sure yet' }]} />
        {v.mode === 'open' ? (
          <p className="pd-help">No day yet. Friends say when they can play, and you lock it in once a day works for most.</p>
        ) : (
          <>
            <p className="pd-help">{v.mode === 'set' ? 'Tap the day.' : `Tap the days that could work, up to ${MAX_DAY_OPTIONS}. Friends tick theirs and can add a day too.`}</p>
            <DayTiles days={days} on={v.mode === 'set' ? (v.date ? [v.date] : []) : v.days} onToggle={toggle} onAdd={add} radio={v.mode === 'set'} label={v.mode === 'set' ? 'The day' : 'Days that could work'} />
          </>
        )}
        <div className="pd-sub-label" id="pd-part">Morning or afternoon?</div>
        <Segmented label="Morning or afternoon" className="holes-toggle pd-seg" value={v.part || 'either'} onChange={p => setV({ ...v, part: p === 'either' ? null : p })}
          options={[{ value: 'either', label: 'Either' }, { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }]} />
        <p className="pd-help">In place of a tee time. Add the tee time once it’s booked.</p>
        <button type="button" className="full-btn pd-done" disabled={!ok} onClick={() => onDone(v)}>
          {v.mode === 'options' && v.days.length ? `Use ${v.days.length === 1 ? 'this day' : `these ${v.days.length} days`}` : 'Done'}
        </button>
      </div>
    </Sheet>
  );
}

// --------------------------- the Where sheet --------------------------------

/** Where: a course saved on this phone, any name typed in, or Any course. `onPick(course | null)`. */
export function WhereSheet({ open, current, onPick, onClose }) {
  const state = useStore();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const { starred, recent, all } = coursePickerSections(state, needle);
  const list = needle ? all : [...starred, ...recent, ...all].slice(0, 30);
  const exact = list.some(c => c.name.trim().toLowerCase() === needle);
  const pick = c => { onPick(c); setQ(''); };
  return (
    <Sheet open={open} onClose={onClose} title="Where">
      <div className="pd-sheet">
        <label className="sr-only" htmlFor="pd-course-q">Search your courses</label>
        <input id="pd-course-q" className="search-box" type="search" placeholder="Search your courses" value={q} onChange={e => setQ(e.target.value)} />
        <div className="pick-list pd-list">
          <PickRow radio on={!current} onClick={() => pick(null)} title="Any course" sub="Decide it together" />
          {list.map(c => <PickRow key={c.id} radio on={current?.id === c.id} onClick={() => pick({ id: c.id, name: c.name, city: c.city || null })} title={c.name} sub={c.city || ''} />)}
          {needle && !exact && q.trim().length >= 3 && <PickRow radio on={false} onClick={() => pick({ id: null, name: q.trim().slice(0, 60), city: null })} title={`Use “${q.trim()}”`} sub="Add the course itself when you tee off" />}
        </div>
      </div>
    </Sheet>
  );
}

// --------------------------- the Game and bet sheet -------------------------

/**
 * Game and bet: the group picks, or you pick the game and maybe the bet. `value`: { game, bet },
 * each null for the group. `games`: the ones the group would vote between, shown first.
 */
export function GameBetSheet({ open, value, games, onDone, onClose }) {
  const [v, setV] = useState(value);
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); if (open) setV(value); }
  const all = [...new Set([...games, ...Object.keys(GAMES)])].filter(k => GAMES[k]);
  return (
    <Sheet open={open} onClose={onClose} title="Game and bet">
      <div className="pd-sheet">
        <Segmented label="Who picks the game" className="holes-toggle pd-seg" value={v.game ? 'me' : 'group'} onChange={w => setV(w === 'group' ? { game: null, bet: null } : { game: games[0] || 'skins', bet: v.bet })}
          options={[{ value: 'group', label: 'Group picks' }, { value: 'me', label: 'I’ll pick' }]} />
        {!v.game ? (
          <p className="pd-help">Friends vote between {games.map(k => GAMES[k]?.name).filter(Boolean).join(', ')} and on the bet when they answer. Most votes wins.</p>
        ) : (
          <>
            <div className="pd-sub-label">The game</div>
            <div className="chip-row pd-chips" role="radiogroup" aria-label="The game">
              {all.map(k => <PickChip key={k} radio small on={v.game === k} icon={GAMES[k].icon} onClick={() => setV({ ...v, game: k })}>{GAMES[k].name}</PickChip>)}
            </div>
            <div className="pd-sub-label">The bet</div>
            <div className="chip-row pd-chips" role="radiogroup" aria-label="The bet">
              <PickChip radio small on={!v.bet} onClick={() => setV({ ...v, bet: null })}>Group votes</PickChip>
              {BET_LADDER.map(b => <PickChip key={b} radio small on={v.bet === b} onClick={() => setV({ ...v, bet: b })}>{money(b)}</PickChip>)}
            </div>
          </>
        )}
        <button type="button" className="full-btn pd-done" onClick={() => onDone(v)}>Done</button>
      </div>
    </Sheet>
  );
}

// --------------------------- locking in the day -----------------------------

/**
 * The organizer locks in the day: who can make it, who hasn't answered, the tee time if it's
 * booked. `nudge` is lockNudge's read (or the leading day's when it isn't a clear lead yet).
 */
export function LockSheet({ open, options, initial, people, onLock, onClose }) {
  const [iso, setIso] = useState(initial);
  const [tee, setTee] = useState('');
  const [was, setWas] = useState(open);
  if (open !== was) { setWas(open); if (open) { setIso(initial); setTee(''); } }
  const o = options.find(x => x.iso === iso) || options[0];
  if (!o) return null;
  const notOut = people.filter(p => p.status !== 'out');
  const waiting = people.filter(p => !p.status).map(p => p.name);
  const weekday = dayTile(o.iso).top;
  const day = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' }[weekday] || shortDay(o.iso);
  return (
    <Sheet open={open} onClose={onClose} title="Lock in the day">
      <div className="pd-sheet">
        {/* The clock heads the sheet: the day gets locked here, and the tee time with it */}
        <Spot kind="clock" size={64} className="pd-lock-art" />
        <div className="pd-lock-big">{shortDay(o.iso)} works for {o.votes} of {notOut.length}</div>
        <p className="pd-help">{waiting.length ? `${waitingLine(waiting)}. Lock it in and they’ll get the day with everyone else.` : 'Everyone has answered. Lock it in and the group gets the day.'}</p>
        {options.length > 1 && (
          <DayTiles days={options.map(x => x.iso)} on={[o.iso]} onToggle={setIso} radio label="The day" counts={Object.fromEntries(options.map(x => [x.iso, x.votes]))} />
        )}
        <div className="pd-sub-label">Tee time</div>
        <TimePicker id="pd-lock-tee" label="Tee time" value={tee} onChange={setTee} placeholder="Add it once it’s booked" />
        <button type="button" className="full-btn pink pd-done" onClick={() => onLock(o.iso, tee || null)}>Lock in {day}</button>
        <button type="button" className="full-btn outline" onClick={onClose}>{waiting.length === 1 ? `Wait for ${first(waiting[0])}` : 'Wait a bit'}</button>
      </div>
    </Sheet>
  );
}
