import { useMemo, useState } from 'react';
import { Empty, Header, Icon, Numpad, Screen, Segmented, Sheet, Steps, Toggle, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { getState, update, uid, useStore } from '../lib/store.js';
import { allCourses, coursePar, courseTag, defaultTee as firstTee, teeDotStyle } from '../lib/courses.js';
import { getCourse } from '../lib/courseApi.js';
import { useCourseSearch } from '../lib/useCourseSearch.js';
import { GAMES, GAME_GROUPS, createRound, effectiveCourseHc, holesInPlay } from '../lib/round.js';
import { GameOptions, SixesPreview, TeamPicker } from '../components/GameOptions.jsx';
import { optionsProblem, stakeSummary } from '../lib/stakes.js';
import { syncConfigured } from '../lib/sync.js';
import { ShareSheet } from '../components/Live.jsx';
import { defaultTeams, teamsProblem } from '../lib/teams.js';
import { rematchSetup } from '../lib/rematch.js';
import { useNav } from '../lib/nav.js';
import { addRound, holesScored, roundsInProgress, usualRound } from '../lib/rounds.js';
import { formatIndex, hcPctLabel, playerLabel, sortedPlayers } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { findCourse } from '../lib/courses.js';
import { BET_LADDER, MAX_BALLOT_GAMES, betChoices, betLabel, betOf, betUnitLabel, dayChoices, isoDate, newPlan, planStart } from '../lib/plans.js';
import { editPlan } from '../lib/plan-sync.js';
import { shouldShowPaywall } from '../lib/paywall.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';

const STEPS = ['Game', 'Course', 'Players', 'Bets'];

/** Setup options with an earlier round's bets and handicap percentage laid over them. */
function withBets(opts, pre) {
  if (!pre) return opts;
  return { ...opts, ...(pre.bets ? { [pre.game]: structuredClone(pre.bets) } : {}), hcPct: pre.hcPct ?? opts.hcPct };
}
const listNames = names => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const QUESTIONS = ['What are you playing?', 'Where are you playing?', 'Who’s in?', 'What’s on the line?'];
// "Schedule for later": plan the round now, and the group answers and votes during the week
const PLAN_STEPS = ['Game', 'When', 'Who', 'Vote'];
const PLAN_QUESTIONS = ['What are you playing?', 'When are you playing?', 'Who’s invited?', 'What’s up for a vote?'];

/** The next Saturday (today when it's Saturday), the usual day to plan for. */
function nextSaturday(now = new Date()) {
  return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay() + 7) % 7)));
}

/** Two amounts either side of the suggestion, for the bet vote. */
function nearbyBets(bet) {
  return betChoices(bet).filter(b => b !== bet);
}

/** Setup filled in from a planned round's roll call ("Change the setup"). */
function planSetup(state, planId, present) {
  const plan = state.plans?.[planId];
  if (!plan) return null;
  const course = findCourse(state, plan.course?.id);
  const s = planStart(state, plan, present || [], { course, newId: () => uid('p_') });
  if (!GAMES[s.game]) return null;
  const picked = s.players.map(p => p.id).filter(id => state.players[id]);
  const g = GAMES[s.game];
  return {
    game: s.game, holesCount: s.holesCount, courseId: course?.id ?? null, nine: s.nine, picked, missing: [], tees: {}, hcOverride: {},
    bets: structuredClone(s.settings[s.game]), hcPct: s.hcPct, useHc: s.useHandicaps, teams: s.teams,
    step: !course ? 1 : picked.length < g.min || picked.length > g.max ? 2 : 3,
  };
}

/**
 * `ahead`: plan it for later. `game` and `ballot`: a game already picked and other games to put
 * up for a vote (from organizer onboarding). `onboarding`: this is the end of organizer onboarding,
 * so finishing lands on the plan with the paywall on top (when it's on), and cancelling drops
 * back to whatever is underneath.
 */
export default function NewRound({ rematch, fromPlan, present, ahead = false, game: preGame = null, ballot = [], onboarding = false }) {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  // "Run it back" opens setup already filled in like an earlier round
  const [pre] = useState(() => (rematch ? rematchSetup(getState(), getState().rounds[rematch]) : fromPlan ? planSetup(getState(), fromPlan, present) : null));
  const [mode, setMode] = useState(ahead ? 'plan' : 'round'); // 'plan': schedule for later
  const planning = mode === 'plan';
  const [date, setDate] = useState(() => nextSaturday());
  const [teeTime, setTeeTime] = useState('');
  const [invited, setInvited] = useState([]);
  const [step, setStep] = useState(pre?.step ?? (ahead && GAMES[preGame] ? 1 : 0));
  const [game, setGame] = useState(pre?.game ?? (GAMES[preGame] ? preGame : null));
  const [holesCount, setHolesCount] = useState(pre?.holesCount ?? 18);
  const [courseId, setCourseId] = useState(pre?.courseId ?? null);
  const [nine, setNine] = useState(pre?.nine ?? 'front');
  const [picked, setPicked] = useState(() => pre?.picked ?? (state.me ? [state.me] : []));
  const [tees, setTees] = useState(pre?.tees ?? {});          // pid -> tee name
  const [hcOverride, setHcOverride] = useState(pre?.hcOverride ?? {}); // pid -> number
  const [opts, setOpts] = useState(() => withBets(structuredClone(state.settings), pre));
  const [useHc, setUseHc] = useState(pre?.useHc ?? true);
  const [startHole, setStartHole] = useState(null);
  const [teams, setTeams] = useState(pre?.teams ?? null); // arrays of player ids, for team games
  const [createdId, setCreatedId] = useState(null); // the round, once it's set up
  const usual = useMemo(() => usualRound(state), [state]);

  const course = allCourses(state).find(c => c.id === courseId) || null;

  const close = async () => {
    if (step === 0 && !game) return nav.pop();
    if (planning) {
      if (await ask({ title: 'Cancel this plan?', text: 'Nothing gets sent until you finish.', confirmLabel: 'Cancel plan', cancelLabel: 'Keep planning', danger: true })) nav.pop();
      return;
    }
    if (await ask({ title: 'Cancel this round?', text: 'Your setup won’t be saved.', confirmLabel: 'Cancel round', cancelLabel: 'Keep setting up', danger: true })) nav.pop();
  };
  const back = () => {
    if (step === 0) return close();
    if (planning && step === 1 && !ahead) setMode('round');
    setStep(step - 1);
  };

  // Plan it: saved on this phone, then the group gets the link from the plan's page
  const makePlan = ({ ballotGames, suggestedBet, ballotBets }) => {
    const s = getState();
    const id = uid('pl_');
    const me = s.players[s.me];
    const plan = newPlan({
      id, hostName: me?.name || 'Me', game, holesCount, nine, date, teeTime, course,
      people: invited.filter(pid => pid !== s.me).map(pid => s.players[pid]).filter(Boolean),
      ballot: { games: ballotGames, bets: ballotBets }, suggestedBet, settings: opts, useHc: true,
    });
    update(st => {
      if (!st.plans) st.plans = {};
      st.plans[id] = plan;
      if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
    });
    const paywall = onboarding && shouldShowPaywall(getState(), PAYWALL_ON) ? [['paywall', { source: 'onboarding' }]] : [];
    nav.reset('upnext', ['plan', { id }], ...paywall);
  };

  // A round already in progress is never touched: it stays saved and you can switch back to it
  const start = () => {
    const s = getState();
    const id = uid('r_');
    const players = orderedPicked.map(pid => ({ ...s.players[pid], tee: tees[pid] || defaultTee, courseHcOverride: hcOverride[pid] }));
    // Share-image choice is a personal setting, not part of a round's bets
    const { shareAmounts: _personal, ...settings } = structuredClone(opts);
    const round = createRound({ id, game, course, holesCount, nine, startHole, players, settings, hcPct: opts.hcPct, useHandicaps: useHc, teams: GAMES[game].teams ? teams : null });
    update(st => {
      addRound(st, round);
      if (fromPlan && st.plans?.[fromPlan]) st.plans[fromPlan].roundId = id;
      // Remember choices as next time's defaults
      st.settings = { ...st.settings, ...settings };
      if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
    });
    if (fromPlan) editPlan(fromPlan, p => { p.status = 'started'; p.roundId = id; });
    setCreatedId(id);
    setStep(4);
  };

  // Load last time's game, course, group and bets, then land on the bets to confirm
  const repeatUsual = () => {
    const p = rematchSetup(state, usual.round);
    setGame(p.game); setHolesCount(p.holesCount); setCourseId(usual.course.id); setNine(p.nine);
    setPicked(p.picked); setTees(p.tees); setHcOverride(p.hcOverride);
    setOpts(o => withBets(o, p));
    setUseHc(p.useHc);
    setStartHole(null);
    setTeams(p.teams);
    setStep(3);
  };
  const created = createdId ? state.rounds[createdId] : null;

  const defaultTee = firstTee(course)?.name || null;
  const orderedPicked = picked;
  const g = game ? GAMES[game] : null;

  return (
    <Screen>
      {step < 4 ? (
        <>
          <Header title={planning ? 'Plan a round' : 'New round'} onBack={back} onClose={close} />
          <Steps steps={planning ? PLAN_STEPS : STEPS} current={step} />
          <h2 className="step-q d">{(planning ? PLAN_QUESTIONS : QUESTIONS)[step]}</h2>
          {step === 2 && pre?.missing.length > 0 && (
            <p className="hint-card"><Icon name="user-plus" fill /> {listNames(pre.missing)} {pre.missing.length === 1 ? 'isn’t' : 'aren’t'} saved on this phone yet. Add them to run it back with the whole group.</p>
          )}
        </>
      ) : <Header title="Round ready" small onClose={() => nav.reset('upnext')} />}
      {step === 0 && <GameStep usual={planning ? null : usual} onUsual={repeatUsual} planning={planning} onPlan={fromPlan ? null : () => { setMode('plan'); setStep(1); }} game={game} setGame={gm => { setGame(gm); if (!GAMES[gm].holes.includes(holesCount)) setHolesCount(GAMES[gm].holes[0]); }} holesCount={holesCount} setHolesCount={setHolesCount} onNext={() => setStep(1)} />}
      {step === 1 && planning && (
        <CourseStep courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={() => setStep(2)}
          nextLabel="Next: Who’s invited" top={<WhenPicker date={date} setDate={setDate} teeTime={teeTime} setTeeTime={setTeeTime} />} />
      )}
      {step === 2 && planning && course && <InviteStep invited={invited} setInvited={setInvited} onNext={() => setStep(3)} />}
      {step === 3 && planning && course && <VoteStep game={game} opts={opts} onPlan={makePlan} ballot={ballot} />}
      {step === 1 && !planning && <CourseStep courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={() => setStep(2)} />}
      {step === 2 && !planning && course && (
        <PlayersStep game={g} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          tees={tees} setTees={setTees} hcOverride={hcOverride} setHcOverride={setHcOverride}
          onNext={() => { if (!teams || teams.flat().length !== picked.length || teams.flat().some(pid => !picked.includes(pid))) setTeams(defaultTeams(game, picked)); setStep(3); }} />
      )}
      {step === 3 && !planning && course && (
        <SetupStep game={game} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          opts={opts} setOpts={setOpts} useHc={useHc} setUseHc={setUseHc} startHole={startHole} setStartHole={setStartHole} onStart={start}
          teams={teams} setTeams={setTeams} />
      )}
      {step === 4 && created && <ReadyStep round={created} onStart={() => nav.reset('upnext', ['play', { id: created.id }])} />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function GameStep({ usual, onUsual, planning, onPlan, game, setGame, holesCount, setHolesCount, onNext }) {
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
          <Segmented label="Holes" value={holesCount} onChange={setHolesCount}
            options={[9, 18].map(n => ({ value: n, label: String(n), disabled: g && !g.holes.includes(n) }))} />
          {g && g.holes.length === 1 && <p className="field-help">{g.name} is played over {g.holes[0]} holes.</p>}
        </div>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!game} onClick={onNext}>{game ? <>{planning ? 'Next: When' : 'Next: Course'} <Icon name="arrow-right" /></> : 'Pick a game'}</button>
        {!planning && onPlan && <button className="full-btn outline" disabled={!game} onClick={onPlan}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
      <RulesSheet game={rules} open={!!rules} onClose={() => setRules(null)} />
    </>
  );
}

// ---------------------------------------------------------------------------

function CourseStep({ courseId, setCourseId, holesCount, nine, setNine, onNext, top = null, nextLabel = 'Next: Players' }) {
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
  // Course database results, minus any this phone already has saved
  const { showToast } = useUI();
  const api = useCourseSearch(q);
  const saved = new Set(courses.map(c => c.apiId).filter(Boolean));
  const more = api.results.filter(r => !saved.has(r.apiId));
  const [loadingId, setLoadingId] = useState(null);
  const pickApi = async r => {
    if (loadingId) return;
    setLoadingId(r.apiId);
    try {
      const c = await getCourse(r.apiId);
      // Saved like a custom course: works offline, syncs to the account, and can be corrected
      update(s => {
        s.customCourses[c.id] = { ...c, savedAt: Date.now() };
        s.favorites = [c.id, ...s.favorites.filter(f => f !== c.id)].slice(0, 6);
      });
      setCourseId(c.id);
    } catch {
      showToast('Couldn’t load that scorecard. You can add it yourself.');
    } finally {
      setLoadingId(null);
    }
  };
  const apiRow = r => (
    <button key={r.apiId} className="list-item" onClick={() => pickApi(r)} aria-busy={loadingId === r.apiId} aria-label={[`Add ${r.name}`, r.city, r.teeCount ? `${r.teeCount} tees` : null].filter(Boolean).join(', ')}>
      <div className="row-main">
        <div className="li-name">{r.name}</div>
        <div className="li-sub">{[r.city, r.teeCount ? `${r.teeCount} tees` : null].filter(Boolean).join(' · ')}</div>
      </div>
      <span className="li-check add"><Icon name={loadingId === r.apiId ? 'circle-notch' : 'plus'} className={loadingId === r.apiId ? 'spin' : ''} /></span>
    </button>
  );

  const row = c => (
    <button key={c.id} className="list-item" onClick={() => setCourseId(c.id)} aria-pressed={c.id === courseId}
      aria-label={[c.name, c.city, `${c.holes.length} holes`, `par ${coursePar(c)}`, `${c.tees?.length || 0} tees`, courseTag(c)?.text].filter(Boolean).join(', ')}>
      <div className="row-main">
        <div className="li-name">{c.name}</div>
        <div className="li-sub">{[c.city, `${c.holes.length} holes`, `Par ${coursePar(c)}`, `${c.tees?.length || 0} tees`].filter(Boolean).join(' · ')}</div>
        {courseTag(c) && <div className={`warn-tag ${courseTag(c).soft ? 'soft' : ''}`}><Icon name={courseTag(c).soft ? 'database' : 'warning'} fill /> {courseTag(c).text}</div>}
      </div>
      <span className={`li-check ${c.id === courseId ? 'on' : 'add'}`}><Icon name={c.id === courseId ? 'check' : 'plus'} /></span>
    </button>
  );

  return (
    <>
      <div className="scroll">
        {top}
        <div style={{ padding: '4px 16px 8px' }}>
          <label className="sr-only" htmlFor="course-q">Search courses</label>
          <input id="course-q" className="search-box" type="search" placeholder="Search courses or cities" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {favs.length > 0 && <><div className="sec-label">Recent</div><div style={{ padding: '0 16px' }}>{favs.map(row)}</div></>}
        {rest.length > 0 && <><div className="sec-label">{needle ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All courses'}</div><div style={{ padding: '0 16px' }}>{rest.map(row)}</div></>}
        {needle && more.length > 0 && <><div className="sec-label">More courses{api.loading ? ' · searching' : ''}</div><div style={{ padding: '0 16px' }}>{more.map(apiRow)}</div></>}
        {matches.length === 0 && more.length === 0 && !api.loading && (
          <Empty illo={false} title={`No courses match “${q.trim()}”`} text="Add it yourself from the scorecard in a minute, or ask us to add it for everyone."
            action={<button className="pill-btn" onClick={() => nav.push('suggest', { kind: 'course', prefill: { name: q.trim() } })}><Icon name="paper-plane-tilt" /> Request this course</button>} />
        )}
        <button className="add-row" aria-label="Add a course" onClick={() => nav.push('courseEdit', {})}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a course</span></button>
        {course && holesCount === 9 && course.holes.length === 18 && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Which nine?</div>
            <Segmented label="Which nine" value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
          </div>
        )}
        {tooShort && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!course} onClick={onNext}>{course ? <>{nextLabel} <Icon name="arrow-right" /></> : 'Pick a course'}</button>
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
    if (p.length >= game.max) { showToast(`${game.name} takes up to ${game.max} players`); return p; }
    return [...p, pid];
  });
  const pickCrew = c => {
    const ids = c.playerIds.filter(id => state.players[id]);
    const merged = [...new Set([...picked, ...ids])];
    if (merged.length > game.max) { showToast(game.min === game.max ? `${game.name} is for exactly ${game.max}. Remove someone first` : `${game.name} takes up to ${game.max} players. Remove someone first`); return; }
    setPicked(merged);
  };
  const count = picked.length;
  const valid = count >= game.min && count <= game.max;
  const needText = count < game.min
    ? `Add ${game.min - count} more player${game.min - count === 1 ? '' : 's'}`
    : count > game.max ? `Remove ${count - game.max} player${count - game.max === 1 ? '' : 's'}` : null;

  const courseHc = pid => {
    const p = state.players[pid];
    const tee = course.tees?.find(t => t.name === (tees[pid] || firstTee(course)?.name));
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
        <div className="sec-label">Players · {count} picked ({game.min === game.max ? game.min : `${game.min}–${game.max}`})</div>
        <div style={{ padding: '0 16px' }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            const hc = on ? courseHc(p.id) : null;
            const hcNote = hc && { set: ' · edited', index: ' · from index', none: ' · none', whs: '' }[hc.source];
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
                          const active = (tees[p.id] || firstTee(course).name) === t.name;
                          return (
                            <button key={t.name} role="radio" aria-checked={active} className={`tee-chip ${active ? 'active' : ''}`} onClick={() => setTees({ ...tees, [p.id]: t.name })}>
                              <span className="tee-dot" style={teeDotStyle(t)} />{t.name}{t.slope ? '' : ' (no slope)'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button className="hc-chip" onClick={() => setHcFor(p.id)}>
                      {holesCount === 9 ? '9-hole handicap' : 'Course handicap'} <strong>{hc.value < 0 ? `+${-hc.value}` : hc.value}</strong>{hcNote} <Icon name="pencil-simple" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-row" aria-label="Add a player" onClick={() => setAdding(true)}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a player</span></button>
        {picked.some(pid => state.players[pid]?.index == null) && (
          <p className="hint-card"><Icon name="info" fill /> Players with no handicap get no strokes. Tap their handicap to set one.</p>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!valid} onClick={onNext}>{valid ? <>Next: Bets <Icon name="arrow-right" /></> : needText}</button>
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
          {dup && <p className="field-error">Someone already has that name. Add an initial.</p>}
          <label className="field-label">Handicap index <span className="opt">optional</span></label>
          <button className="amt-btn" onClick={() => setPad(true)}>{index == null ? 'Add' : formatIndex(index)}</button>
          <p className="field-help">Their 18-hole handicap index. We halve it for 9 holes.</p>
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
  const orderLabel = { wolf: 'Tee order: the wolf moves down this list', banker: 'Playing order', sixes: 'Order: sets who partners who' }[game] || 'Playing order';

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
            <div className="sec-label">{game === 'nassau' || game === 'hammer' ? 'Sides' : 'Teams'}</div>
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
          players={picked.length || null} firstName={game === 'banker' ? state.players[picked[0]]?.name : null} />

        <button className="set-row more-opts" onClick={() => setMore(!more)} aria-expanded={more}>
          <div className="row-main">
            <div className="set-name">More options</div>
            <div className="set-sub">{game === 'bbb' ? '' : useHc ? `Handicaps on (${hcPctLabel(opts.hcPct).toLowerCase()}) · ` : 'Handicaps off · '}Start on hole {firstHole}</div>
          </div>
          <span className="chevron"><Icon name={more ? 'caret-up' : 'caret-down'} /></span>
        </button>
        {more && <>
        {game !== 'bbb' && <>
        <div className="sec-label">Handicaps</div>
        <div className="toggle-row">
          <div><div className="toggle-lbl">Use handicaps</div><div className="toggle-sub">{game === 'quota' ? 'Sets each player’s quota from their course handicap' : 'Better players give strokes to the others on the hardest holes'}</div></div>
          <Toggle on={useHc} onChange={setUseHc} label="Use handicaps" />
        </div>
        {useHc && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Strokes given</div>
            <Segmented label="Strokes given" className="press-mode-row" btn="pm-btn" value={opts.hcPct} onChange={v => set('hcPct', v)}
              options={[100, 90, 80].map(n => ({ value: n, label: n === 100 ? 'Full' : `${n}%` }))} />
            <p className="field-help">Many groups use 90% or 80% so the better player still has a chance.</p>
          </div>
        )}
        </>}

        <div className="sec-label">Starting hole</div>
        <div className="block">
          <button className="hole-pick-btn" onClick={() => setHolePick(true)} aria-label="Starting hole">
            <span>Hole {firstHole} · Par {holes.find(h => h.no === firstHole)?.par}</span><Icon name="caret-down" />
          </button>
          <p className="field-help">Starting somewhere else? Change the first hole.</p>
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
// Schedule for later

/** The day (next two weeks) and the tee time, above the course list. */
/** "Saturday, October 3" (today and tomorrow say so), for a day chip's accessible name. */
function dayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const full = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const today = isoDate(new Date());
  const tmrw = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
  return iso === today ? `Today, ${full}` : iso === tmrw ? `Tomorrow, ${full}` : full;
}

function WhenPicker({ date, setDate, teeTime, setTeeTime }) {
  const days = useMemo(() => dayChoices(new Date(), 14), []);
  return (
    <div className="block when-block">
      <div className="eyebrow" id="when-day" style={{ marginBottom: 10 }}>Day</div>
      <div className="day-strip" role="radiogroup" aria-labelledby="when-day">
        {days.map(d => (
          <button key={d.iso} role="radio" aria-checked={d.iso === date} aria-label={dayName(d.iso)} className={`day-chip ${d.iso === date ? 'on' : ''}`} onClick={() => setDate(d.iso)}>
            <span className="dc-top">{d.top}</span><span className="dc-bottom">{d.bottom}</span>
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor="when-time" style={{ marginTop: 14 }}>Tee time <span className="opt">optional</span></label>
      <input id="when-time" className="name-input time-input" type="time" value={teeTime} onChange={e => setTeeTime(e.target.value)} step={300} />
      <p className="field-help">Then pick the course below.</p>
    </div>
  );
}

/** Who gets asked. Optional: anyone with the group link can answer too. */
function InviteStep({ invited, setInvited, onNext }) {
  const state = useStore();
  const players = sortedPlayers(state).filter(p => p.id !== state.me);
  const toggle = pid => setInvited(v => (v.includes(pid) ? v.filter(x => x !== pid) : [...v, pid]));
  const n = invited.length;
  // A name typed here becomes a saved player and is invited; a name already saved just gets invited
  const [newName, setNewName] = useState('');
  const t = newName.trim();
  const addName = e => {
    e.preventDefault();
    if (!t) return;
    const same = players.find(p => p.name.trim().toLowerCase() === t.toLowerCase());
    const id = same?.id || uid('p_');
    if (!same) update(s => { s.players[id] = { id, name: t, index: null, venmo: '', createdAt: Date.now() }; });
    setInvited(v => (v.includes(id) ? v : [...v, id]));
    setNewName('');
  };
  return (
    <>
      <div className="scroll">
        <p className="hint-card"><Icon name="link" fill /> You’re in. Pick who to ask, or skip this and send one group link: anyone with it can answer.</p>
        <form className="add-name-row" onSubmit={addName}>
          <label className="field-label" htmlFor="invite-add-name">Add a name</label>
          <div className="add-name-line">
            <input id="invite-add-name" aria-label="Add a name" className="name-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Dave" autoComplete="off" maxLength={24} enterKeyHint="done" />
            <button type="submit" className="add-name-btn" disabled={!t} aria-label={t ? `Add ${t} and invite them` : 'Add this name'}><Icon name="plus" /> Add</button>
          </div>
        </form>
        <div style={{ padding: '0 16px' }}>
          {players.map(p => {
            const on = invited.includes(p.id);
            return (
              <button key={p.id} className={`list-item ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on} aria-label={`Invite ${p.name}`}>
                <div className="row-main">
                  <div className="li-name">{p.name}</div>
                  <div className="li-sub">{p.index == null ? 'No handicap index' : `Index ${formatIndex(p.index)}`}</div>
                </div>
                <span className={`li-check ${on ? 'on' : 'add'}`}><Icon name={on ? 'check' : 'plus'} /></span>
              </button>
            );
          })}
        </div>
        {players.length === 0 && <p className="field-help pad">No players saved yet. Add their names above, or send the group link and they’ll show up as they answer.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onNext}>{n ? `Next: Vote (${n} invited)` : 'Skip, I’ll send a link'} <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}

/** The organizer suggests a game and a bet, and picks what else the group can vote for. */
function VoteStep({ game, opts, onPlan, ballot = [] }) {
  const start = betOf(game, opts) || 5;
  const [bet, setBet] = useState(start);
  const [others, setOthers] = useState(() => ballot.filter(k => k !== game && GAMES[k]).slice(0, MAX_BALLOT_GAMES - 1));
  const [extraBets, setExtraBets] = useState(() => nearbyBets(start));
  const ladder = [...new Set([...BET_LADDER, start])].sort((a, b) => a - b);
  const toggleGame = k => setOthers(v => (v.includes(k) ? v.filter(x => x !== k) : v.length >= MAX_BALLOT_GAMES - 1 ? v : [...v, k]));
  const toggleBet = b => setExtraBets(v => (v.includes(b) ? v.filter(x => x !== b) : [...v, b]));
  const ballotBets = [...new Set([bet, ...extraBets])].sort((a, b) => a - b);
  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">You suggest</div>
          <div className="d stake-big">{GAMES[game].name} · {betLabel(game, opts, bet)}</div>
          <div className="li-sub">The group votes when they answer. Most votes wins; a tie goes to your suggestion.</div>
        </div>
        <div className="sec-label">Your bet</div>
        <div className="chip-row" role="radiogroup" aria-label="Your bet">
          {ladder.map(b => (
            <button key={b} role="radio" aria-checked={b === bet} className={`pill-btn ${b === bet ? 'on' : ''}`} onClick={() => { setBet(b); setExtraBets(v => v.filter(x => x !== b)); }}>{money(b)}</button>
          ))}
        </div>
        <div className="sec-label">Other bets to vote on</div>
        <div className="chip-row">
          {ladder.filter(b => b !== bet).map(b => (
            <button key={b} aria-pressed={extraBets.includes(b)} className={`pill-btn sm ${extraBets.includes(b) ? 'on' : ''}`} onClick={() => toggleBet(b)}>{money(b)}</button>
          ))}
        </div>
        <p className="field-help pad">{GAMES[game].name} bets on the ballot: {ballotBets.map(b => betUnitLabel(game, opts, b)).join(', ')}.</p>
        <div className="sec-label">Other games to vote on <span className="opt">up to {MAX_BALLOT_GAMES - 1}</span></div>
        <div className="chip-row">
          {Object.entries(GAMES).filter(([k]) => k !== game).map(([k, g]) => {
            const on = others.includes(k);
            return (
              <button key={k} aria-pressed={on} disabled={!on && others.length >= MAX_BALLOT_GAMES - 1} className={`pill-btn sm ${on ? 'on' : ''}`} onClick={() => toggleGame(k)}>
                <Icon name={g.icon} fill /> {g.name}
              </button>
            );
          })}
        </div>
        {others.length > 0 && (
          <p className="field-help pad">
            {others.map(k => <span key={k} style={{ display: 'block' }}>{GAMES[k].name}: {betChoices(betOf(k, opts)).map(b => betUnitLabel(k, opts, b)).join(', ')}</span>)}
            Each game gets its own bet vote, around your usual bet for it.
          </p>
        )}
        {others.length === 0 && extraBets.length === 0 && <p className="field-help pad">Nothing else on the ballot, so everyone just says if they’re in.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={() => onPlan({ ballotGames: others, suggestedBet: bet, ballotBets })}>Plan it <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/** After setup: invite the group before the first tee, then start. */
function ReadyStep({ round, onStart }) {
  const [sharing, setSharing] = useState(false);
  const others = useStore(roundsInProgress).filter(r => r.id !== round.id);
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
          <div className="ready-row"><span>Handicaps</span><b>{round.useHandicaps ? hcPctLabel(round.hcPct) : 'Off'}</b></div>
        </div>
        {others.map(o => (
          <p key={o.id} className="hint-card"><Icon name="pause-circle" fill /> Your {GAMES[o.game]?.name || ''} round at {o.course.name} ({holesScored(o)} of {o.holes.length} holes) is saved. Switch back any time from Rounds in progress in the round menu.</p>
        ))}
        {syncConfigured && (
          <p className="hint-card"><Icon name="broadcast" fill /> {round.shared ? 'The group has the link. They can follow the money live and enter scores.' : 'Send the group a link and they can follow the money live from their own phones. No download needed.'}</p>
        )}
      </div>
      <div className="cta-wrap">
        {syncConfigured && <button className={`full-btn ${round.shared ? 'outline' : ''}`} onClick={() => setSharing(true)}><Icon name="share-network" /> {round.shared ? 'Send the link again' : 'Invite the group'}</button>}
        <button className={`full-btn ${syncConfigured && !round.shared ? 'outline' : ''}`} onClick={onStart}>Tee off on hole {first.no} <Icon name="arrow-right" /></button>
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

