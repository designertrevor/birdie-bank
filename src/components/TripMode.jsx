// Trip Mode's pieces (trip-templates.js, flights.js, draft.js): "Start from a template" and the
// schedule editor in the trip sheet, and on the trip's page the schedule with its planned rounds,
// the live captains' draft card and the flighted net leaderboard.
import { Icon, PickMark, Segmented, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { TeamDot } from './Cup.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { nameOf } from '../lib/ledger.js';
import { canonicalOf } from '../lib/pair-debts.js';
import { coursePickerSections } from '../lib/courses.js';
import { toParText, toParTone } from '../lib/to-par.js';
import { CUP_KINDS, WORTHS, cupPoints } from '../lib/cup.js';
import {
  MAX_DAYS, MAX_SESSIONS, SESSION_KINDS, TEMPLATE_SIZES, addDay, addSession, removeSession, ryderTemplate, scheduleProblem, schedulePoints,
  scheduledPlans, sessionLabel, sessionMatches, setSession,
} from '../lib/trip-templates.js';
import { flightBoard } from '../lib/flights.js';
import { draftState } from '../lib/draft-sync.js';
import { makeScheduledRounds, setDayCourse } from '../lib/trip-store.js';

const first = name => String(name || '').trim().split(/\s+/)[0] || 'Player';
const plus = (iso, n) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const shortDay = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const pointsLine = p => `${cupPoints(p.total)} point${p.total === 1 ? '' : 's'} · ${cupPoints(p.toWin)} wins the cup`;

// --------------------------- in the trip sheet ---------------------------

/**
 * "Start from a template": a Ryder Cup weekend for 8, 12, 16 or 24, or a trip from scratch.
 * `value`: the size picked, or null for scratch.
 */
export function TemplatePick({ value, onPick }) {
  return (
    <div className="tm-templates" role="radiogroup" aria-label="Start from a template">
      {TEMPLATE_SIZES.map(size => {
        const t = ryderTemplate(size);
        const p = schedulePoints(t, size / 2);
        const on = value === size;
        return (
          <button key={size} type="button" role="radio" aria-checked={on} className={`tm-template ${on ? 'on' : ''}`} onClick={() => onPick(size)}>
            <span className="tm-t-size d">{size}</span>
            <span className="tm-t-main">
              <span className="tm-t-name">Ryder Cup weekend</span>
              <span className="tm-t-sub">{size / 2} a side · {t.days.length} days · {cupPoints(p.total)} points</span>
            </span>
            <PickMark on={on} add={false} />
          </button>
        );
      })}
      <button type="button" role="radio" aria-checked={value == null} className={`tm-template scratch ${value == null ? 'on' : ''}`} onClick={() => onPick(null)}>
        <span className="tm-t-main"><span className="tm-t-name">From scratch</span><span className="tm-t-sub">Pick how it’s played yourself</span></span>
        <PickMark on={value == null} add={false} />
      </button>
    </div>
  );
}

/**
 * The schedule: each day's course (optional) and sessions, what a match is worth and each session's
 * handicap allowance. `perTeam`: players a side, for the matches and points. `start`: the first day.
 */
export function ScheduleEditor({ schedule, onChange, perTeam, start }) {
  const state = useStore();
  const { starred, recent, all } = coursePickerSections(state);
  const pts = schedulePoints(schedule, perTeam);
  const pick = (day, id) => {
    const c = [...starred, ...recent, ...all].find(x => x.id === id);
    onChange({ ...schedule, days: schedule.days.map((d, i) => (i === day ? { ...d, course: c ? { id: c.id, name: c.name } : null } : d)) });
  };
  return (
    <div className="tm-schedule">
      <div className="tm-total" role="status">
        <span className="d">{pointsLine(pts)}</span>
        <span className="tm-total-sub">{pts.matches} match{pts.matches === 1 ? '' : 'es'} with {perTeam} a side, everyone in every session</span>
      </div>
      {schedule.days.map((d, di) => (
        <div key={di} className="block tm-day">
          <div className="tm-day-head">
            <span className="tm-day-name">Day {di + 1}</span>
            <span className="tm-day-date">{shortDay(plus(start, di))}</span>
          </div>
          <label className="field-label" htmlFor={`tm-course-${di}`}>Course <span className="opt">(optional)</span></label>
          <select id={`tm-course-${di}`} className="select" value={d.course?.id || ''} onChange={e => pick(di, e.target.value)}>
            <option value="">Set it later</option>
            {starred.length > 0 && <optgroup label="Starred">{starred.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {recent.length > 0 && <optgroup label="Recent">{recent.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            <optgroup label="All courses">{all.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
          {d.sessions.map((s, si) => (
            <div key={si} className="tm-session">
              <div className="tm-session-head">
                <span className="tm-session-name">{sessionLabel(s.kind, si, d.sessions.length)}</span>
                <span className="tm-session-n">{sessionMatches(s.kind, perTeam)} match{sessionMatches(s.kind, perTeam) === 1 ? '' : 'es'}</span>
                {(schedule.days.length > 1 || d.sessions.length > 1) && (
                  <button type="button" className="icon-btn sm" onClick={() => onChange(removeSession(schedule, di, si))} aria-label={`Take out ${sessionLabel(s.kind, si, d.sessions.length)} on day ${di + 1}`}><Icon name="x" /></button>
                )}
              </div>
              <Segmented label={`Day ${di + 1} session ${si + 1} format`} className="press-mode-row" btn="pm-btn" value={s.kind}
                onChange={kind => onChange(setSession(schedule, di, si, { kind }))}
                options={SESSION_KINDS.map(k => ({ value: k, label: CUP_KINDS[k].name }))} />
              <div className="tm-session-opts">
                <label className="tm-opt">
                  <span>A match is worth</span>
                  <select className="select sm" value={s.worth} onChange={e => onChange(setSession(schedule, di, si, { worth: Number(e.target.value) }))}>
                    {WORTHS.map(w => <option key={w} value={w}>{w} point{w === 1 ? '' : 's'}</option>)}
                  </select>
                </label>
                <label className="tm-opt">
                  <span>Handicaps at</span>
                  <select className="select sm" value={s.pct} onChange={e => onChange(setSession(schedule, di, si, { pct: Number(e.target.value) }))}>
                    {[100, 95, 90, 85, 80, 75, 70, 60, 50].map(p => <option key={p} value={p}>{p}%</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
          {d.sessions.length < MAX_SESSIONS && <button type="button" className="link-btn" onClick={() => onChange(addSession(schedule, di))}><Icon name="plus" /> Add an afternoon session</button>}
        </div>
      ))}
      {schedule.days.length < MAX_DAYS && <button type="button" className="add-row" onClick={() => onChange(addDay(schedule))}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a day</span></button>}
      <p className="field-help">Four-ball is best ball of two against two, played as Best ball. Foursomes is partners taking turns on one ball, played as Alternate shot. Singles is one against one, two matches a group, with Skins for the group. Handicaps start at the WHS allowance: 90% for four-ball, full for singles. Partners and opponents change every session.</p>
    </div>
  );
}

// --------------------------- on the trip's page ---------------------------

/**
 * The trip's schedule on its Cup view: each day's sessions with their points, how many of its rounds
 * are planned, and a way to plan them (or plan them again from the teams, for the organizer).
 * `onRounds` switches the trip's page to its Rounds view.
 */
export function ScheduleCard({ st, onRounds }) {
  const state = useStore();
  const { ask, showToast } = useUI();
  const cup = st.cup.def;
  const schedule = cup.schedule;
  if (!schedule) return null;
  // Players a side: the teams once they're picked, else half of who's going (a draft still to come)
  const per = Math.min(cup.teams[0].length, cup.teams[1].length);
  const perTeam = per > 1 ? per : Math.max(1, Math.floor((st.going?.length || schedule.size || 8) / 2));
  const pts = schedulePoints(schedule, perTeam);
  const planned = scheduledPlans(state, st.trip.id);
  // Groups whose plan is past planning (started, or called off): planning again leaves them be
  const past = Object.values(state.plans || {}).filter(p => p?.host && p.session?.trip === st.trip.id && !p.gone && p.status !== 'planned');
  const started = past.filter(p => p.status === 'started').length;
  const problem = scheduleProblem(schedule, cup.teams.map(t => t.map(p => p.id)));
  const drafting = cup.draft?.live && !draftState(state, st.trip.id).merged?.done && cup.teams.flat().length <= 2;
  const plan = async redo => {
    if (redo && !(await ask({ title: 'Plan the rounds again?', text: 'Rounds not shared yet are planned again from the teams as they are now. Shared ones stay as they are, so friends’ links still work.', confirmLabel: 'Plan them again' }))) return;
    const r = makeScheduledRounds(st.trip.id, { redo });
    if (r.problem) return showToast(r.problem);
    showToast(`${r.made} round${r.made === 1 ? '' : 's'} planned${r.kept ? `, ${r.kept} shared one${r.kept === 1 ? '' : 's'} kept` : ''}. They’re on Up next, day by day.`);
  };
  return (
    <>
      <div className="sec-label">The schedule</div>
      <div className="block tm-sched-card">
        <div className="tm-total"><span className="d">{pointsLine(pts)}</span></div>
        {schedule.days.map((d, di) => (
          <div key={di} className="tm-sched-day">
            <div className="tm-day-head">
              <span className="tm-day-name">Day {di + 1}</span>
              <span className="tm-day-date">{shortDay(plus(st.trip.start, di))}{d.course && !st.organizer ? ` · ${d.course.name}` : ''}</span>
            </div>
            {st.organizer && <DayCourse tripId={st.trip.id} day={di} value={d.course} />}
            {d.sessions.map((s, si) => {
              const n = sessionMatches(s.kind, perTeam);
              return (
                <div key={si} className="tm-sched-row">
                  <span className="row-main">{sessionLabel(s.kind, si, d.sessions.length)}</span>
                  <span className="tm-sched-sub">{n} match{n === 1 ? '' : 'es'}{s.worth > 1 ? ` · ${s.worth} points each` : ''} · {s.pct}%</span>
                </div>
              );
            })}
          </div>
        ))}
        {planned.length > 0 && <p className="field-help">{planned.length} round{planned.length === 1 ? ' is' : 's are'} planned, each with its matches{started ? `, and ${started} started` : ''}. Each one starts from its roll call on Up next.</p>}
        {!planned.length && !past.length && (drafting ? <p className="field-help">The rounds are planned as soon as the draft is done.</p>
          : problem ? <p className="field-help">{problem}</p>
          : st.organizer ? <p className="field-help">Plan every round now: each group gets its day, a tee time and its matches.</p> : null)}
        {st.organizer && !problem && !drafting && (
          <div className="tm-sched-acts">
            {!planned.length && !past.length
              ? <button className="full-btn" onClick={() => plan(false)}><Icon name="calendar-plus" /> Plan the rounds</button>
              : <button className="pill-btn" onClick={() => plan(true)}><Icon name="arrows-clockwise" /> Plan them again from the teams</button>}
            {planned.length > 0 && onRounds && <button className="pill-btn" onClick={onRounds}>See the rounds <Icon name="caret-right" /></button>}
          </div>
        )}
      </div>
    </>
  );
}

/** The organizer sets a day's course on the trip's page: the day's planned rounds move to it too. */
function DayCourse({ tripId, day, value }) {
  const state = useStore();
  const { showToast } = useUI();
  const { starred, recent, all } = coursePickerSections(state);
  const pick = id => {
    const c = [...starred, ...recent, ...all].find(x => x.id === id) || null;
    const n = setDayCourse(tripId, day, c);
    showToast(c ? `Day ${day + 1} is at ${c.name}${n ? `, all ${n} round${n === 1 ? '' : 's'}` : ''}` : `Day ${day + 1}’s course is cleared`);
  };
  return (
    <>
      <label className="sr-only" htmlFor={`tm-day-course-${day}`}>Day {day + 1} course</label>
      <select id={`tm-day-course-${day}`} className="select sm tm-day-course" value={value?.id || ''} onChange={e => pick(e.target.value)}>
        <option value="">Course to be set</option>
        {starred.length > 0 && <optgroup label="Starred">{starred.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
        {recent.length > 0 && <optgroup label="Recent">{recent.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
        <optgroup label="All courses">{all.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
      </select>
    </>
  );
}

/** A live captains' draft still going: who's picked, whose pick it is, and the way in. */
export function DraftCard({ st }) {
  const state = useStore();
  const nav = useNav();
  const cup = st.cup.def;
  const { def, merged } = draftState(state, st.trip.id);
  if (!cup.draft?.live) return null;
  // Done and on the trip: the teams speak for themselves
  if (merged?.done && cup.teams.flat().length > 2) return null;
  if (!def && !st.organizer) return null;
  const n = def ? def.pool.length - 2 : 0;
  const made = merged ? merged.picks.length : 0;
  const turn = merged?.turn;
  const capName = i => first(def?.pool.find(p => p.id === def.captains[i])?.name || nameOf(state, cup.captains[i]));
  return (
    <button className="block tm-draft-card" onClick={() => nav.push('draft', { id: st.trip.id })}>
      <span className="row-main">
        <span className="eyebrow">Captains’ draft{def ? ` · ${made} of ${n} picked` : ''}</span>
        <span className="tm-draft-title d">{!def ? 'Start the draft' : merged?.done ? 'The draft is done' : turn != null ? `${capName(turn)}’s pick for ${cup.names[turn]}` : 'Waiting on the captains'}</span>
        <span className="tm-draft-sub">{[0, 1].map(i => <span key={i}><TeamDot team={i} /> {capName(i)}</span>)}</span>
      </span>
      <span className="chevron"><Icon name="caret-right" /></span>
    </button>
  );
}

/** The flighted net leaderboard: each flight on its own, net to par across the trip's finished rounds. */
export function FlightsView({ st }) {
  const state = useStore();
  const me = canonicalOf(state)(state.me);
  const board = flightBoard(state, st.trip);
  if (!board.length) return null;
  const any = board.some(f => f.rows.some(r => r.rounds));
  return (
    <>
      {board.map(f => (
        <div key={f.flight}>
          <div className="sec-label">{f.flight} flight</div>
          <div className="trip-table">
            {f.rows.map((r, i) => {
              const rank = r.rounds ? f.rows.findIndex(x => x.rounds === r.rounds && x.net === r.net) + 1 : null;
              const mine = canonicalOf(state)(r.id) === me;
              return (
                <div key={r.key} className={`trip-row ${mine ? 'me' : ''}`} style={{ '--i': i }}>
                  <span className="tr-rank">{rank ?? '–'}</span>
                  <Avatar id={state.players?.[r.id] ? r.id : null} name={r.name} />
                  <span className="tr-main">
                    <span className="tr-name">{mine ? 'You' : r.name}</span>
                    <span className="tr-sub">{r.rounds ? `${r.rounds} round${r.rounds === 1 ? '' : 's'}` : 'No round finished yet'}</span>
                  </span>
                  <span className={`tr-amt tm-net ${r.rounds ? toParTone(r.net) : ''}`}>{r.rounds ? toParText(r.net) : '–'}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="field-help pad">{any ? 'Net to par across the trip’s finished rounds, off each player’s full course handicap, whoever was in their group. Someone who missed a round sorts after everyone who played them all.' : 'Each flight fills in as rounds finish: net to par off each player’s full course handicap.'}{st.cup ? ' Other groups’ rounds come from their phones.' : ' From the rounds on this phone.'} Flights were set by handicap when the trip was.</p>
    </>
  );
}
