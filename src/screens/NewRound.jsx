import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, Segmented, Sheet, Steps, Toggle, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { getState, update, uid, useStore } from '../lib/store.js';
import { allCourses, coursePar, teeDotStyle } from '../lib/courses.js';
import { GAMES, GAME_GROUPS, createRound, effectiveCourseHc, holesInPlay } from '../lib/round.js';
import { GameOptions, SixesPreview, TeamPicker } from '../components/GameOptions.jsx';
import { optionsProblem, stakeSummary } from '../lib/stakes.js';
import { syncConfigured } from '../lib/sync.js';
import { ShareSheet } from '../components/Live.jsx';
import { defaultTeams, teamsProblem } from '../lib/teams.js';
import { useNav } from '../lib/nav.js';
import { formatIndex, playerLabel, sortedPlayers } from '../lib/format.js';

const STEPS = ['Game', 'Course', 'Players', 'Setup'];
const QUESTIONS = ['What are you playing?', 'Where are you playing?', 'Who’s in?', 'What’s on the line?'];

/** The last round this phone set up whose course and players still exist, to offer as a one-tap repeat. */
function usualRound(state) {
  const courses = allCourses(state);
  const recent = Object.values(state.rounds).filter(r => !r.localMe && GAMES[r.game]).sort((a, b) => b.createdAt - a.createdAt);
  for (const r of recent) {
    const course = courses.find(c => c.id === r.course.id);
    if (course && r.players.every(p => state.players[p.id])) return { round: r, course };
  }
  return null;
}

export default function NewRound() {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  const [step, setStep] = useState(0);
  const [game, setGame] = useState(null);
  const [holesCount, setHolesCount] = useState(18);
  const [courseId, setCourseId] = useState(null);
  const [nine, setNine] = useState('front');
  const [picked, setPicked] = useState(() => (state.me ? [state.me] : []));
  const [tees, setTees] = useState({});          // pid -> tee name
  const [hcOverride, setHcOverride] = useState({}); // pid -> number
  const [opts, setOpts] = useState(() => structuredClone(state.settings));
  const [useHc, setUseHc] = useState(true);
  const [startHole, setStartHole] = useState(null);
  const [teams, setTeams] = useState(null); // arrays of player ids, for team games
  const [createdId, setCreatedId] = useState(null); // the round, once it's set up
  const usual = useMemo(() => usualRound(state), [state]);

  const course = allCourses(state).find(c => c.id === courseId) || null;

  const close = async () => {
    if (step === 0 && !game) return nav.pop();
    if (await ask({ title: 'Cancel this round?', text: 'Your setup won’t be saved.', confirmLabel: 'Cancel round', cancelLabel: 'Keep setting up', danger: true })) nav.pop();
  };
  const back = () => (step === 0 ? close() : setStep(step - 1));

  const start = async () => {
    const s = getState();
    if (s.activeRoundId && s.rounds[s.activeRoundId]) {
      const ok = await ask({ title: 'You have a round in progress', text: 'Starting a new one ends the current round without saving results.', confirmLabel: 'Discard it and start', danger: true });
      if (!ok) return;
    }
    const id = uid('r_');
    const players = orderedPicked.map(pid => ({ ...s.players[pid], tee: tees[pid] || defaultTee, courseHcOverride: hcOverride[pid] }));
    const settings = structuredClone(opts);
    const round = createRound({ id, game, course, holesCount, nine, startHole, players, settings, hcPct: opts.hcPct, useHandicaps: useHc, teams: GAMES[game].teams ? teams : null });
    update(st => {
      if (st.activeRoundId && st.rounds[st.activeRoundId]?.status === 'active') delete st.rounds[st.activeRoundId];
      st.rounds[id] = round;
      st.activeRoundId = id;
      // Remember choices as next time's defaults
      st.settings = { ...st.settings, ...settings };
      if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
    });
    setCreatedId(id);
    setStep(4);
  };

  // Load last time's game, course, group and bets, then land on the bets to confirm
  const repeatUsual = () => {
    const r = usual.round;
    const pids = r.players.map(p => p.id);
    setGame(r.game); setHolesCount(r.holesCount); setCourseId(usual.course.id); setNine(r.nine || 'front');
    setPicked(pids);
    setTees(Object.fromEntries(r.players.filter(p => p.tee).map(p => [p.id, p.tee])));
    setHcOverride(Object.fromEntries(r.players.filter(p => p.courseHcOverride != null).map(p => [p.id, p.courseHcOverride])));
    setOpts(o => ({ ...o, [r.game]: structuredClone(r.settings[r.game]), hcPct: r.hcPct ?? o.hcPct }));
    setUseHc(r.useHandicaps !== false);
    setStartHole(null);
    setTeams(r.teams ? r.teams.map(t => t.players) : defaultTeams(r.game, pids));
    setStep(3);
  };
  const created = createdId ? state.rounds[createdId] : null;

  const defaultTee = course?.tees?.[0]?.name || null;
  const orderedPicked = picked;
  const g = game ? GAMES[game] : null;

  return (
    <Screen>
      {step < 4 ? (
        <>
          <Header title="New round" onBack={back} onClose={close} />
          <Steps steps={STEPS} current={step} />
          <h2 className="step-q d">{QUESTIONS[step]}</h2>
        </>
      ) : <Header title="Round ready" small onClose={() => nav.reset('history')} />}
      {step === 0 && <GameStep usual={usual} onUsual={repeatUsual} game={game} setGame={gm => { setGame(gm); if (!GAMES[gm].holes.includes(holesCount)) setHolesCount(GAMES[gm].holes[0]); }} holesCount={holesCount} setHolesCount={setHolesCount} onNext={() => setStep(1)} />}
      {step === 1 && <CourseStep courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={() => setStep(2)} />}
      {step === 2 && course && (
        <PlayersStep game={g} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          tees={tees} setTees={setTees} hcOverride={hcOverride} setHcOverride={setHcOverride}
          onNext={() => { if (!teams || teams.flat().length !== picked.length || teams.flat().some(pid => !picked.includes(pid))) setTeams(defaultTeams(game, picked)); setStep(3); }} />
      )}
      {step === 3 && course && (
        <SetupStep game={game} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          opts={opts} setOpts={setOpts} useHc={useHc} setUseHc={setUseHc} startHole={startHole} setStartHole={setStartHole} onStart={start}
          teams={teams} setTeams={setTeams} />
      )}
      {step === 4 && created && <ReadyStep round={created} onStart={() => nav.reset('history', ['play', { id: created.id }])} />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function GameStep({ usual, onUsual, game, setGame, holesCount, setHolesCount, onNext }) {
  const nav = useNav();
  const [rules, setRules] = useState(null);
  const g = game && GAMES[game];
  const u = usual?.round;
  return (
    <>
      <div className="scroll">
        {u && (
          <button className="usual-card" onClick={onUsual}>
            <span className="eyebrow">Your usual</span>
            <span className="uc-title d">{GAMES[u.game].name} · {usual.course.name}</span>
            <span className="uc-sub">{u.players.map(p => p.name.split(' ')[0]).join(', ')} · {u.holesCount} holes · {stakeSummary(u.game, u.settings)}</span>
            <span className="uc-btn"><Icon name="arrow-counter-clockwise" /> Set it up again</span>
          </button>
        )}
        {GAME_GROUPS.map(group => (
          <div key={group}>
            <div className="sec-label">{group}</div>
            {Object.entries(GAMES).filter(([, info]) => info.group === group).map(([key, info]) => (
              <div key={key} className={`game-row ${game === key ? 'selected' : ''}`} role="radio" aria-checked={game === key} tabIndex={0}
                onClick={() => setGame(key)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGame(key)}>
                <div className="game-icon"><Icon name={info.icon} fill /></div>
                <div className="row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="gn">{info.name}</div>
                    <button className="rules-chip" onClick={e => { e.stopPropagation(); setRules(key); }} aria-label={`${info.name} rules`}><Icon name="info" /> Rules</button>
                  </div>
                  <div className="gs">{info.players} · {info.blurb}</div>
                </div>
                <span className="gcheck"><Icon name="check-circle" fill /></span>
              </div>
            ))}
          </div>
        ))}
        <button className="quiet-row" onClick={() => nav.push('suggest', { kind: 'game' })}>
          <Icon name="chat-circle-dots" /> <span>Don’t see your game? <u>Tell us how it’s played</u></span>
        </button>
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Holes</div>
          <Segmented value={holesCount} onChange={setHolesCount}
            options={[9, 18].map(n => ({ value: n, label: String(n), disabled: g && !g.holes.includes(n) }))} />
          {g && g.holes.length === 1 && <p className="field-help">{g.name} is played over {g.holes[0]} holes.</p>}
        </div>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!game} onClick={onNext}>{game ? <>Next: Course <Icon name="arrow-right" /></> : 'Pick a game'}</button>
      </div>
      <RulesSheet game={rules} open={!!rules} onClose={() => setRules(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------

function CourseStep({ courseId, setCourseId, holesCount, nine, setNine, onNext }) {
  const nav = useNav();
  const state = useStore();
  const [q, setQ] = useState('');
  const courses = allCourses(state);
  const needle = q.trim().toLowerCase();
  const matches = courses.filter(c => !needle || c.name.toLowerCase().includes(needle) || (c.city || '').toLowerCase().includes(needle));
  const favs = needle ? [] : state.favorites.map(id => courses.find(c => c.id === id)).filter(Boolean);
  const rest = matches.filter(c => needle || !state.favorites.includes(c.id));
  const course = courses.find(c => c.id === courseId);
  const tooShort = course && holesCount === 18 && course.holes.length === 9;

  const row = c => (
    <button key={c.id} className="list-item" onClick={() => setCourseId(c.id)} aria-pressed={c.id === courseId}>
      <div className="row-main">
        <div className="li-name">{c.name}</div>
        <div className="li-sub">{[c.city, `${c.holes.length} holes`, `Par ${coursePar(c)}`, `${c.tees?.length || 0} tees`].filter(Boolean).join(' · ')}</div>
        {!c.verified && <div className="warn-tag"><Icon name="warning" fill /> {c.custom ? 'Added by you' : 'Scorecard not verified'}</div>}
      </div>
      <span className={`li-check ${c.id === courseId ? 'on' : 'add'}`}><Icon name={c.id === courseId ? 'check' : 'plus'} /></span>
    </button>
  );

  return (
    <>
      <div className="scroll">
        <div style={{ padding: '4px 16px 8px' }}>
          <label className="sr-only" htmlFor="course-q">Search courses</label>
          <input id="course-q" className="search-box" type="search" placeholder="Search courses or cities" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {favs.length > 0 && <><div className="sec-label">Recent</div><div style={{ padding: '0 16px' }}>{favs.map(row)}</div></>}
        {rest.length > 0 && <><div className="sec-label">{needle ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All courses'}</div><div style={{ padding: '0 16px' }}>{rest.map(row)}</div></>}
        {matches.length === 0 && (
          <Empty illo={false} title="No courses found" text={`Nothing matches “${q.trim()}”. Add it yourself from the scorecard, or ask us to add it for everyone.`}
            action={<button className="pill-btn" onClick={() => nav.push('suggest', { kind: 'course', prefill: { name: q.trim() } })}><Icon name="paper-plane-tilt" /> Request this course</button>} />
        )}
        <button className="add-row" onClick={() => nav.push('courseEdit', {})}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a course</span></button>
        {course && holesCount === 9 && course.holes.length === 18 && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Which nine?</div>
            <Segmented value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
          </div>
        )}
        {tooShort && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!course} onClick={onNext}>{course ? <>Next: Players <Icon name="arrow-right" /></> : 'Pick a course'}</button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function PlayersStep({ game, course, holesCount, nine, picked, setPicked, tees, setTees, hcOverride, setHcOverride, onNext }) {
  const state = useStore();
  const { showToast } = useUI();
  const players = sortedPlayers(state);
  const crews = Object.values(state.crews);
  const [adding, setAdding] = useState(false);
  const [hcFor, setHcFor] = useState(null);
  const holes = useMemo(() => holesInPlay(course, holesCount, nine), [course, holesCount, nine]);

  const toggle = pid => setPicked(p => {
    if (p.includes(pid)) return p.filter(x => x !== pid);
    if (p.length >= game.max) { showToast(`${game.name} is ${game.players.toLowerCase()}`); return p; }
    return [...p, pid];
  });
  const pickCrew = c => {
    const ids = c.playerIds.filter(id => state.players[id]);
    const merged = [...new Set([...picked, ...ids])];
    if (merged.length > game.max) { showToast(`Too many for ${game.name} (max ${game.max})`); return; }
    setPicked(merged);
  };
  const count = picked.length;
  const valid = count >= game.min && count <= game.max;
  const needText = count < game.min
    ? `Add ${game.min - count} more player${game.min - count === 1 ? '' : 's'}`
    : count > game.max ? `Remove ${count - game.max}` : null;

  const courseHc = pid => {
    const p = state.players[pid];
    const tee = course.tees?.find(t => t.name === (tees[pid] || course.tees[0]?.name));
    return effectiveCourseHc(p.index, tee, course, holes, holesCount, hcOverride[pid]);
  };

  return (
    <>
      <div className="scroll">
        {crews.length > 0 && (
          <>
            <div className="sec-label">Crews</div>
            <div className="chip-row">
              {crews.map(c => <button key={c.id} className="pill-btn" onClick={() => pickCrew(c)}><Icon name="users-three" fill /> {c.name}</button>)}
            </div>
          </>
        )}
        <div className="sec-label">Players · {count} of {game.min === game.max ? game.min : `${game.min}–${game.max}`}</div>
        <div style={{ padding: '0 16px' }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            const hc = on ? courseHc(p.id) : null;
            const hcNote = hc && { set: ' (set)', index: ' · from index', none: ' · no handicap', whs: '' }[hc.source];
            return (
              <div key={p.id} className={`list-item player-pick ${on ? 'on' : ''}`}>
                <button className="pick-main" onClick={() => toggle(p.id)} aria-pressed={on}>
                  <div className="row-main">
                    <div className="li-name">{playerLabel(p, state.me)}</div>
                    <div className="li-sub">{p.index == null ? 'No handicap index' : `Index ${formatIndex(p.index)}`}</div>
                  </div>
                  <span className={`li-check ${on ? 'on' : 'add'}`}><Icon name={on ? 'check' : 'plus'} /></span>
                </button>
                {on && (
                  <div className="pick-extra">
                    {course.tees?.length > 0 && (
                      <div className="tee-chips" role="radiogroup" aria-label={`${p.name}'s tee`}>
                        {course.tees.map(t => {
                          const active = (tees[p.id] || course.tees[0].name) === t.name;
                          return (
                            <button key={t.name} role="radio" aria-checked={active} className={`tee-chip ${active ? 'active' : ''}`} onClick={() => setTees({ ...tees, [p.id]: t.name })}>
                              <span className="tee-dot" style={teeDotStyle(t)} />{t.name}{t.slope ? '' : ' · no rating'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button className="hc-chip" onClick={() => setHcFor(p.id)}>
                      {holesCount === 9 ? '9-hole HC' : 'Course HC'} <strong>{hc.value < 0 ? `+${-hc.value}` : hc.value}</strong>{hcNote} <Icon name="pencil-simple" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-row" onClick={() => setAdding(true)}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add new player</span></button>
        {picked.some(pid => state.players[pid]?.index == null) && (
          <p className="hint-card"><Icon name="info" fill /> Players without a handicap play off 0 unless you set their course handicap.</p>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!valid} onClick={onNext}>{valid ? <>Next: Setup <Icon name="arrow-right" /></> : needText}</button>
      </div>
      <QuickAddPlayer open={adding} onClose={() => setAdding(false)} onAdded={pid => { setAdding(false); if (picked.length < game.max) setPicked([...picked, pid]); }} />
      <Numpad open={!!hcFor} title={`${state.players[hcFor]?.name}'s ${holesCount === 9 ? '9-hole ' : ''}course handicap`} initial={hcFor ? courseHc(hcFor).value : ''} allowNegative min={-10} max={60}
        onClose={() => setHcFor(null)} onDone={v => { setHcOverride({ ...hcOverride, [hcFor]: v }); setHcFor(null); }} />
    </>
  );
}

function QuickAddPlayer({ open, onClose, onAdded }) {
  const state = useStore();
  const [name, setName] = useState('');
  const [index, setIndex] = useState(null);
  const [pad, setPad] = useState(false);
  const t = name.trim();
  const dup = Object.values(state.players).some(p => p.name.toLowerCase() === t.toLowerCase());
  const add = () => {
    const id = uid('p_');
    update(s => { s.players[id] = { id, name: t, index, venmo: '', createdAt: Date.now() }; });
    setName(''); setIndex(null);
    onAdded(id);
  };
  return (
    <>
      <Sheet open={open && !pad} onClose={onClose} title="Add a player">
        <div style={{ padding: '8px 16px 0' }}>
          <label className="field-label" htmlFor="qa-name">Name</label>
          <input id="qa-name" className="name-input" value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Name" autoFocus />
          {dup && <p className="field-error">That name is taken. Add an initial.</p>}
          <label className="field-label">Handicap index <span className="opt">optional</span></label>
          <button className="amt-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
          <p className="field-help">Their usual 18-hole index. It’s halved automatically for 9-hole games.</p>
          <div style={{ marginTop: 16 }}><button className="full-btn" disabled={!t || dup} onClick={add}>Add to round</button></div>
        </div>
      </Sheet>
      <Numpad open={pad} title="Handicap index" initial={index ?? ''} allowDecimal allowNegative min={-10} max={54}
        onClose={() => setPad(false)} onDone={v => { setIndex(v); setPad(false); }} />
    </>
  );
}

// ---------------------------------------------------------------------------

function SetupStep({ game, course, holesCount, nine, picked, setPicked, opts, setOpts, useHc, setUseHc, startHole, setStartHole, onStart, teams, setTeams }) {
  const state = useStore();
  const [pad, setPad] = useState(null); // {path, title, min, max}
  const [holePick, setHolePick] = useState(false);
  const [more, setMore] = useState(false);
  const holes = holesInPlay(course, holesCount, nine);
  const firstHole = startHole ?? holes[0].no;
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], opts);
  const move = (i, d) => setPicked(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const optsBad = !!optionsProblem(game, opts);
  const names = Object.fromEntries(picked.map(pid => [pid, state.players[pid]?.name || '?']));
  const teamsBad = !!teamsProblem(game, teams, picked);
  const orderLabel = { wolf: 'Tee order (wolf rotates in this order)', banker: 'Playing order', sixes: 'Playing order (sets the partner rotation)' }[game] || 'Playing order';

  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">{GAMES[game].name} · {holesCount} holes</div>
          <div className="d stake-big">{stakeSummary(game, opts)}</div>
          <div className="li-sub">{course.name}{holesCount === 9 && course.holes.length === 18 ? ` · ${nine === 'front' ? 'Front' : 'Back'} 9` : ''} · Par {holes.reduce((a, h) => a + h.par, 0)} · {picked.length} players</div>
        </div>

        {GAMES[game].teams && teams && (
          <>
            <div className="sec-label">{game === 'nassau' ? 'Sides' : 'Teams'}</div>
            <TeamPicker game={game} picked={picked} names={names} teams={teams} setTeams={setTeams} />
          </>
        )}

        {GAMES[game].order && (
          <>
            <div className="sec-label">{orderLabel}</div>
            {picked.map((pid, i) => (
              <div key={pid} className="set-row static">
                <div className="order-num">{i + 1}</div>
                <div className="row-main set-name">{state.players[pid]?.name}</div>
                <button className="icon-btn sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="caret-up" /></button>
                <button className="icon-btn sm" disabled={i === picked.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="caret-down" /></button>
              </div>
            ))}
            {game === 'sixes' && <SixesPreview names={picked.map(pid => names[pid].split(' ')[0])} holesCount={holesCount} />}
          </>
        )}

        <GameOptions game={game} get={get} set={set} onAmount={(path, title, o) => setPad({ path, title, ...o })} holesCount={holesCount}
          firstName={game === 'banker' ? state.players[picked[0]]?.name : null} />

        <button className="set-row more-opts" onClick={() => setMore(!more)} aria-expanded={more}>
          <div className="row-main">
            <div className="set-name">More options</div>
            <div className="set-sub">{useHc ? `Handicaps on · ${opts.hcPct}%` : 'Handicaps off'} · start on hole {firstHole}</div>
          </div>
          <span className="chevron"><Icon name={more ? 'caret-up' : 'caret-down'} /></span>
        </button>
        {more && <>
        <div className="sec-label">Handicaps</div>
        <div className="toggle-row">
          <div><div className="toggle-lbl">Use handicaps</div><div className="toggle-sub">{game === 'quota' ? 'Sets each player’s quota from their course handicap' : game === 'bbb' ? 'Not needed, points don’t depend on score' : 'Strokes off the low player on the hardest holes'}</div></div>
          <Toggle on={useHc} onChange={setUseHc} label="Use handicaps" />
        </div>
        {useHc && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Strokes given</div>
            <Segmented className="press-mode-row" btn="pm-btn" value={opts.hcPct} onChange={v => set('hcPct', v)}
              options={[100, 90, 80].map(n => ({ value: n, label: `${n}%` }))} />
          </div>
        )}

        <div className="sec-label">Starting hole</div>
        <div className="block">
          <button className="hole-pick-btn" onClick={() => setHolePick(true)} aria-label="Starting hole">
            <span>Hole {firstHole} · Par {holes.find(h => h.no === firstHole)?.par}</span><Icon name="caret-down" />
          </button>
          <p className="field-help">Change this for a shotgun start.</p>
        </div>
        </>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={optsBad || teamsBad} onClick={onStart}>Create round <Icon name="arrow-right" /></button>
      </div>
      <Numpad open={!!pad} title={pad?.title} prefix="$" initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
      <HolePicker open={holePick} holes={holes} value={startHole ?? holes[0].no} onClose={() => setHolePick(false)} onPick={no => { setStartHole(no); setHolePick(false); }} />
    </>
  );
}

// ---------------------------------------------------------------------------

/** After setup: invite the group before the first tee, then start. */
function ReadyStep({ round, onStart }) {
  const [sharing, setSharing] = useState(false);
  const names = (round.teams || round.players).map(p => p.name.split(' ')[0]);
  const first = round.holes[0];
  return (
    <>
      <div className="scroll">
        <div className="ready-hero">
          <div className="ready-check"><Icon name="check" /></div>
          <div className="ready-title d">You’re set for {GAMES[round.game].name}</div>
        </div>
        <div className="block">
          <div className="ready-row"><span>Course</span><b>{round.course.name}{round.nine ? ` · ${round.nine === 'front' ? 'Front' : 'Back'} 9` : ''}</b></div>
          <div className="ready-row"><span>{round.teams ? 'Teams' : 'Players'}</span><b>{round.teams ? round.teams.map(t => t.name).join(' v ') : names.join(', ')}</b></div>
          <div className="ready-row"><span>On the line</span><b>{stakeSummary(round.game, round.settings)}</b></div>
          <div className="ready-row"><span>Handicaps</span><b>{round.useHandicaps ? `On · ${round.hcPct}%` : 'Off'}</b></div>
        </div>
        {syncConfigured && (
          <p className="hint-card"><Icon name="broadcast" fill /> {round.shared ? 'The group has the link. They can follow the money live and enter scores.' : 'Send the group a link and they can follow the money live from their own phones. No download needed.'}</p>
        )}
      </div>
      <div className="cta-wrap">
        {syncConfigured && <button className={`full-btn ${round.shared ? 'outline' : ''}`} onClick={() => setSharing(true)}><Icon name="share-network" /> {round.shared ? 'Send the link again' : 'Invite the group'}</button>}
        <button className={`full-btn ${syncConfigured && !round.shared ? 'outline' : ''}`} onClick={onStart}>Start on hole {first.no} <Icon name="arrow-right" /></button>
      </div>
      <ShareSheet round={round} open={sharing} onClose={() => setSharing(false)} />
    </>
  );
}

/** Two-column bottom sheet for choosing a hole. */
function HolePicker({ open, holes, value, onClose, onPick }) {
  return (
    <Sheet open={open} onClose={onClose} title="Starting hole">
      <p className="sheet-text">Pick where the group tees off. The round runs from there and wraps around.</p>
      <div className="hole-grid-pick" role="listbox" aria-label="Starting hole">
        {holes.map(h => (
          <button key={h.no} role="option" aria-selected={h.no === value} className={`hole-opt ${h.no === value ? 'on' : ''}`} onClick={() => onPick(h.no)}>
            <strong>{h.no}</strong><span>Par {h.par}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

