// Setting up a Big Game (big-game.js): the day and the name, the course, who's playing (8 to 20 is
// usual, up to 24), the groups (balanced by handicap, or by hand) with who keeps score in each,
// what's played across the field (the pot and its places, field skins, team best ball) and any side
// bets between two players. On the day it starts the groups straight away: one live round a
// group, each with its own link. Set up for another day, it waits on Up next until then.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Header, Icon, Numpad, Screen, Segmented, Sheet, Steps, Toggle, useUI } from '../components/ui.jsx';
import { CourseStep, QuickAddPlayer } from './NewRound.jsx';
import { BigBetSheet, BetsList } from '../components/BigGame.jsx';
import { useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { allCourses, defaultTee as firstTee, teeDotStyle } from '../lib/courses.js';
import { effectiveCourseHc, holesInPlay } from '../lib/round.js';
import { formatIndex, playerLabel, sortedPlayers } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { dayChoices, isoDate } from '../lib/plans.js';
import { allowanceHint, suggestedAllowance } from '../lib/allowances.js';
import {
  BIG_MAX_PLAYERS, BIG_MAX_STAKE, BIG_MIN_PLAYERS, BIG_NAME, GROUP_MAX, PLACES, POT_KINDS, balanceGroups, balanceTeams, bigField, bigResults,
  cleanBig, defaultBig, groupCount, groupsProblem, moveTo, placesLabel,
} from '../lib/big-game.js';
import { saveBigGame, startGroups } from '../lib/big-store.js';

const STEPS = ['Day', 'Course', 'Players', 'Groups', 'Games', 'Bets'];
const QUESTIONS = ['When’s the Big Game?', 'Where are you playing?', 'Who’s playing?', 'How are the groups?', 'What’s on the line?', 'Any side bets?'];
const first = n => String(n || '').trim().split(/\s+/)[0] || 'Player';
const PCTS = [100, 95, 90, 85, 80];

/** `id`: change a game that hasn't started yet. */
export default function BigGameSetup({ id = null }) {
  const nav = useNav();
  const state = useStore();
  const { ask, showToast } = useUI();
  const was = id ? state.trips?.[id] : null;
  const init = useMemo(() => (was ? cleanBig(was.big) : defaultBig()), [was]);
  const [step, showStep] = useState(0);
  const [reached, setReached] = useState(was ? STEPS.length - 1 : 0);
  const setStep = n => { showStep(n); setReached(r => Math.max(r, n)); };
  const [name, setName] = useState(was?.name || BIG_NAME);
  const [day, setDay] = useState(was?.start || isoDate());
  const [holesCount, setHolesCount] = useState(was?.setup?.holesCount || 18);
  const [nine, setNine] = useState(was?.setup?.nine || 'front');
  const [courseId, setCourseId] = useState(was?.setup?.courseId || null);
  const [picked, setPicked] = useState(() => (was ? init.groups.flatMap(g => g.players) : state.me ? [state.me] : []));
  const [tees, setTees] = useState(was?.setup?.tees || {});
  const [hcOverride, setHcOverride] = useState(was?.setup?.hcOverride || {});
  const [useHc, setUseHc] = useState(init.useHandicaps);
  const [hcPct, setHcPct] = useState(init.hcPct);
  const [groups, setGroups] = useState(() => (was ? init.groups.map(g => [...g.players]) : null));
  const [keepers, setKeepers] = useState(() => (was ? init.groups.map(g => g.keeper) : []));
  const [byHand, setByHand] = useState(!!was);
  const [pot, setPot] = useState(init.pot);
  const [skins, setSkins] = useState(init.skins);
  const [teams, setTeams] = useState(init.teams);
  const [bets, setBets] = useState(init.bets);
  const [busy, setBusy] = useState(false);

  // The course editor over the course step, as in round setup: the phone's back closes it first
  const [editor, showEditor] = useState(null);
  const editorClose = useRef(null);
  const openEditor = prefill => {
    showEditor(prefill);
    editorClose.current = nav.layer ? nav.layer(() => { editorClose.current = null; showEditor(null); }) : null;
  };
  const closeEditor = () => { editorClose.current?.(); editorClose.current = null; showEditor(null); };
  useEffect(() => () => editorClose.current?.(), []);

  const course = allCourses(state).find(c => c.id === courseId) || null;
  const holes = useMemo(() => (course ? holesInPlay(course, holesCount, nine) : []), [course, holesCount, nine]);
  const courseHc = pid => {
    const p = state.players[pid];
    if (!course || !p) return { value: 0, source: 'none' };
    const tee = course.tees?.find(t => t.name === (tees[pid] || firstTee(course)?.name));
    return effectiveCourseHc(p.index, tee, course, holes, holesCount, hcOverride[pid]);
  };
  const people = Object.fromEntries(picked.filter(pid => state.players[pid]).map(pid => [pid, { name: state.players[pid].name, hc: useHc ? courseHc(pid).value : 0 }]));
  const pool = picked.filter(pid => people[pid]).map(pid => ({ id: pid, hc: people[pid].hc }));
  const nameOf = pid => (pid === state.me ? 'You' : first(people[pid]?.name || state.players[pid]?.name));

  // The groups: balanced by handicap unless they're being made by hand; anyone picked since goes in the smallest
  const count = groups?.length || groupCount(pool.length);
  const fitted = fitGroups(groups, byHand, pool, count);
  const groupList = fitted.map((ids, i) => {
    const k = keepers[i];
    return { id: `g${i + 1}`, name: `Group ${i + 1}`, players: ids, keeper: ids.includes(k) ? k : ids.includes(state.me) ? state.me : ids[0] || null };
  });
  const teamsNow = { ...teams, list: teams.list.map(t => ({ ...t, players: t.players.filter(x => people[x]) })).filter(t => t.players.length) };
  const big = cleanBig({ ...init, hcPct, useHandicaps: useHc, people, groups: groupList.map((g, i) => ({ ...g, roundId: init.groups[i]?.roundId || null, code: init.groups[i]?.code || null })), pot, skins: { ...skins, out: skins.out.filter(x => people[x]) }, teams: teamsNow, bets: bets.filter(b => b.sides.every(x => people[x])) });
  const problem = groupsProblem(big);
  const today = day <= isoDate();

  const canGo = i => i <= reached && (i < 2 || course) && (i < 3 || pool.length >= BIG_MIN_PLAYERS);
  const back = () => (step > 0 ? showStep(step - 1) : nav.pop());
  const close = async () => {
    if (!(await ask({ title: was ? 'Leave without saving?' : 'Leave the Big Game setup?', text: 'What you’ve set up so far won’t be kept.', confirmLabel: 'Leave', cancelLabel: 'Keep going' }))) return;
    nav.pop();
  };

  const finish = async () => {
    if (problem) { showToast(problem); return; }
    setBusy(true);
    const setup = { courseId, courseName: course?.name || null, holesCount, nine, tees, hcOverride };
    const trip = saveBigGame({ id, name: name.trim() || BIG_NAME, day, setup, big });
    if (!trip) { setBusy(false); showToast('Only the organizer changes the game'); return; }
    if (today && !was) {
      const res = await startGroups(trip.id);
      setBusy(false);
      if (!res.ok) showToast(res.why);
      else showToast(res.shared === big.groups.length ? 'The groups are on. Send them their links' : 'The groups are on. Share the links once there’s signal');
    } else {
      setBusy(false);
      showToast(was ? 'Saved' : `${trip.name} is set for ${day === isoDate() ? 'today' : 'the day'}`);
    }
    nav.reset('upnext', ['bigGame', { id: trip.id }]);
  };

  return (
    <Screen>
      <Header title={was ? 'Edit the Big Game' : 'The Big Game'} onBack={back} onClose={close} />
      <Steps steps={STEPS} current={step} canGo={canGo} onGo={setStep} />
      <h2 className="step-q d">{QUESTIONS[step]}</h2>
      {step === 0 && (
        <>
          <div className="scroll">
            <div className="block">
              <label className="field-label" htmlFor="big-name">Name</label>
              <input id="big-name" className="text-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder="Saturday Big Game" />
              <p className="field-help">Several groups, one game: one pot and one leaderboard across every group, settled once when they’re all in.</p>
            </div>
            <DayPicker day={day} setDay={setDay} />
            <div className="block">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Holes</div>
              <Segmented label="Holes" value={holesCount} onChange={setHolesCount} options={[9, 18].map(n => ({ value: n, label: String(n) }))} />
            </div>
          </div>
          <div className="cta-wrap"><button className="full-btn" onClick={() => setStep(1)}>Next: Course <Icon name="arrow-right" /></button></div>
        </>
      )}
      {step === 1 && (
        <CourseStep editor={editor} openEditor={openEditor} closeEditor={closeEditor} courseId={courseId} setCourseId={cid => { setCourseId(cid); setTees({}); }}
          holesCount={holesCount} nine={nine} setNine={setNine} onNext={() => setStep(2)} />
      )}
      {step === 2 && course && (
        <Players picked={picked} setPicked={setPicked} course={course} holesCount={holesCount} tees={tees} setTees={setTees}
          hcOverride={hcOverride} setHcOverride={setHcOverride} useHc={useHc} setUseHc={setUseHc} courseHc={courseHc}
          onNext={() => { if (!groups) setGroups(balanceGroups(pool)); setStep(3); }} />
      )}
      {step === 3 && course && (
        <Groups groups={groupList} byHand={byHand} count={count} pool={pool} nameOf={nameOf} people={people}
          onBalance={n => { setByHand(false); setGroups(balanceGroups(pool, n)); setKeepers([]); }}
          onMove={(pid, to) => { setByHand(true); setGroups(moveTo(fitted, pid, to)); }}
          onKeeper={(i, pid) => setKeepers(k => { const next = [...k]; next[i] = pid; return next; })}
          problem={problem} onNext={() => setStep(4)} />
      )}
      {step === 4 && course && (
        <Games pot={pot} setPot={setPot} skins={skins} setSkins={setSkins} teams={teamsNow} setTeams={setTeams} pool={pool} nameOf={nameOf}
          useHc={useHc} hcPct={hcPct} setHcPct={setHcPct} onNext={() => setStep(5)} />
      )}
      {step === 5 && course && (
        <Bets big={big} setBets={setBets} nameOf={nameOf} today={today} was={was} busy={busy} problem={problem} onFinish={finish} />
      )}
    </Screen>
  );
}

/**
 * The groups as they stand: balanced by handicap, or as moved by hand with anyone picked since put
 * in the smallest group and anyone taken off left out.
 */
function fitGroups(groups, byHand, pool, count) {
  if (!groups || !byHand) return balanceGroups(pool, Math.min(count, Math.max(2, pool.length >> 1)));
  const ids = new Set(pool.map(p => p.id));
  const kept = groups.map(g => g.filter(x => ids.has(x)));
  for (const p of pool) if (!kept.some(g => g.includes(p.id))) kept.reduce((a, g) => (g.length < a.length ? g : a), kept[0]).push(p.id);
  return kept;
}

/** The day, today and the next two weeks. */
function DayPicker({ day, setDay }) {
  const days = dayChoices(new Date(), 14);
  return (
    <div className="block when-block">
      <div className="eyebrow" id="big-day" style={{ marginBottom: 10 }}>Day</div>
      <div className="day-strip" role="radiogroup" aria-labelledby="big-day">
        {days.map(d => (
          <button key={d.iso} role="radio" aria-checked={d.iso === day} className={`day-chip ${d.iso === day ? 'on' : ''}`} onClick={() => setDay(d.iso)}>
            <span className="dc-top">{d.top}</span><span className="dc-bottom">{d.bottom}</span>
          </button>
        ))}
      </div>
      <p className="field-help">On the day you start the groups at the course. Set up for later, it waits on Up next.</p>
    </div>
  );
}

/** Everyone in the game: your players, with their tee and course handicap. */
function Players({ picked, setPicked, course, holesCount, tees, setTees, hcOverride, setHcOverride, useHc, setUseHc, courseHc, onNext }) {
  const state = useStore();
  const { showToast } = useUI();
  const players = sortedPlayers(state);
  const crews = Object.values(state.crews || {});
  const [adding, setAdding] = useState(false);
  const [hcFor, setHcFor] = useState(null);
  const toggle = pid => setPicked(p => {
    if (p.includes(pid)) return p.filter(x => x !== pid);
    if (p.length >= BIG_MAX_PLAYERS) { showToast(`A Big Game takes up to ${BIG_MAX_PLAYERS} players`); return p; }
    return [...p, pid];
  });
  const pickCrew = c => setPicked(p => [...new Set([...p, ...c.playerIds.filter(x => state.players[x])])].slice(0, BIG_MAX_PLAYERS));
  const n = picked.length;
  return (
    <>
      <div className="scroll">
        {crews.length > 0 && (
          <>
            <div className="sec-label">Crews</div>
            <div className="chip-row">{crews.map(c => <button key={c.id} className="pill-btn" onClick={() => pickCrew(c)}><Icon name="users-three" fill /> {c.name}</button>)}</div>
          </>
        )}
        <div className="block hc-choice">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Play with handicaps?</div>
          <Segmented label="Play with handicaps" value={useHc ? 'on' : 'off'} onChange={v => setUseHc(v === 'on')} options={[{ value: 'off', label: 'No, play even' }, { value: 'on', label: 'Yes' }]} />
          <p className="field-help">{useHc ? 'Net scores use each player’s full course handicap across the field, and side bets work out strokes between the two.' : 'Everyone plays straight up, no strokes.'}</p>
        </div>
        <div className="sec-label">Players · {n} picked ({BIG_MIN_PLAYERS}–{BIG_MAX_PLAYERS})</div>
        <div style={{ padding: '0 16px' }}>
          {players.map(p => {
            const on = picked.includes(p.id);
            const hc = on && useHc ? courseHc(p.id) : null;
            return (
              <div key={p.id} className={`list-item pick player-pick ${on ? 'on' : ''}`}>
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
                      <div className="tee-chips" role="radiogroup" aria-label={`${p.name}’s tee`}>
                        {course.tees.map(t => {
                          const active = (tees[p.id] || firstTee(course).name) === t.name;
                          return <button key={t.name} role="radio" aria-checked={active} className={`tee-chip ${active ? 'active' : ''}`} onClick={() => setTees({ ...tees, [p.id]: t.name })}><span className="tee-dot" style={teeDotStyle(t)} />{t.name}</button>;
                        })}
                      </div>
                    )}
                    {hc && <button className={`hc-chip ${hc.source === 'none' ? 'missing' : ''}`} onClick={() => setHcFor(p.id)}>
                      {holesCount === 9 ? '9-hole handicap' : 'Course handicap'} <strong>{hc.value < 0 ? `+${-hc.value}` : hc.value}</strong>{hc.source === 'none' ? ' · none, plays as 0' : hc.source === 'set' ? ' · edited' : ''} <Icon name="pencil-simple" />
                    </button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-row" aria-label="Add a player" onClick={() => setAdding(true)}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a player</span></button>
        <p className="field-help pad">Everyone here goes in a group. Friends join their group’s round from its link on the day and take their seat.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={n < BIG_MIN_PLAYERS} onClick={onNext}>{n < BIG_MIN_PLAYERS ? `Add ${BIG_MIN_PLAYERS - n} more player${BIG_MIN_PLAYERS - n === 1 ? '' : 's'}` : <>Next: Groups <Icon name="arrow-right" /></>}</button>
      </div>
      <QuickAddPlayer open={adding} onClose={() => setAdding(false)} onAdded={pid => { setAdding(false); if (picked.length < BIG_MAX_PLAYERS) setPicked([...picked, pid]); }} />
      <Numpad open={!!hcFor} title={`${state.players[hcFor]?.name}’s ${holesCount === 9 ? '9-hole ' : ''}course handicap`} initial={hcFor ? courseHc(hcFor).value : ''} allowNegative min={-10} max={60}
        onClose={() => setHcFor(null)} onDone={v => { setHcOverride({ ...hcOverride, [hcFor]: v }); setHcFor(null); }} />
    </>
  );
}

/** The groups: how many, balanced by handicap or moved by hand, and who keeps score in each. */
function Groups({ groups, byHand, count, pool, nameOf, people, onBalance, onMove, onKeeper, problem, onNext }) {
  const [moving, setMoving] = useState(null);
  const min = Math.max(2, Math.ceil(pool.length / GROUP_MAX));
  const max = Math.max(min, Math.floor(pool.length / 2));
  return (
    <>
      <div className="scroll">
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>How many groups</div>
          <div className="big-strokes">
            <button type="button" className="icon-btn" aria-label="One group fewer" disabled={count <= min} onClick={() => onBalance(count - 1)}><Icon name="minus" /></button>
            <span className="big-strokes-txt">{count} groups</span>
            <button type="button" className="icon-btn" aria-label="One group more" disabled={count >= max} onClick={() => onBalance(count + 1)}><Icon name="plus" /></button>
            <button type="button" className={`pill-btn sm ${byHand ? '' : 'on'}`} onClick={() => onBalance(count)}>Balance by handicap</button>
          </div>
          <p className="field-help">{byHand ? 'Moved by hand. Balance by handicap deals them out again.' : 'Dealt out best to worst like a draft, so each group gets a low, a high and two in between.'} Tap a player to move them.</p>
        </div>
        {groups.map((g, i) => (
          <div key={g.id} className="block big-setup-group">
            <div className="big-group-head">
              <span className="d">{g.name}</span>
              <span className="tr-sub">{g.players.length} player{g.players.length === 1 ? '' : 's'}{people && g.players.length ? ` · handicaps ${g.players.map(x => people[x]?.hc ?? 0).join(', ')}` : ''}</span>
            </div>
            <div className="chip-row flush">
              {g.players.map(pid => <button key={pid} type="button" className="pill-btn" onClick={() => setMoving({ pid, from: i })}>{nameOf(pid)} <Icon name="arrows-left-right" /></button>)}
            </div>
            {g.players.length > 0 && (
              <>
                <div className="field-label">Keeps score</div>
                <div className="chip-row flush">
                  {g.players.map(pid => <button key={pid} type="button" className={`pill-btn sm ${g.keeper === pid ? 'on' : ''}`} aria-pressed={g.keeper === pid} onClick={() => onKeeper(i, pid)}>{nameOf(pid)}</button>)}
                </div>
              </>
            )}
          </div>
        ))}
        <p className="field-help pad">The card goes to the scorekeeper as soon as their phone takes their seat. Anyone in the group can ask for it later, as in any round.</p>
        {problem && <p className="hint-card warn"><Icon name="warning" fill /> {problem}</p>}
      </div>
      <div className="cta-wrap"><button className="full-btn" disabled={!!problem} onClick={onNext}>Next: Games <Icon name="arrow-right" /></button></div>
      <Sheet open={!!moving} onClose={() => setMoving(null)} title={moving ? `Move ${nameOf(moving.pid)} to` : ''}>
        {moving && groups.map((g, i) => (
          <button key={g.id} className="sheet-item" disabled={i === moving.from || g.players.length >= GROUP_MAX} onClick={() => { onMove(moving.pid, i); setMoving(null); }}>
            <span>{g.name} <span className="tr-sub">{g.players.map(nameOf).join(', ') || 'Nobody yet'}</span></span>
            {g.players.length >= GROUP_MAX && i !== moving.from && <span className="tr-sub">Full</span>}
          </button>
        ))}
      </Sheet>
    </>
  );
}

/** What's on the line across the field: the pot and its places, the skins, the teams, and the handicap %. */
function Games({ pot, setPot, skins, setSkins, teams, setTeams, pool, nameOf, useHc, hcPct, setHcPct, onNext }) {
  const [pad, setPad] = useState(null);
  const [moving, setMoving] = useState(null);
  const n = pool.length;
  const whs = suggestedAllowance('stroke');
  const lists = teams.list.map(t => t.players);
  const setLists = ls => setTeams(t => ({ ...t, list: ls.filter(l => l.length).map((players, i) => ({ id: `T${i + 1}`, name: `Team ${i + 1}`, players })) }));
  const teamOn = on => {
    if (on && !teams.list.length) setTeams(t => ({ ...t, on, list: balanceTeams(pool, t.best === 2 ? 4 : 2).map((players, i) => ({ id: `T${i + 1}`, name: `Team ${i + 1}`, players })) }));
    else setTeams(t => ({ ...t, on }));
  };
  const teamSize = size => setTeams(t => ({ ...t, best: size === 4 ? 2 : 1, list: balanceTeams(pool, size).map((players, i) => ({ id: `T${i + 1}`, name: `Team ${i + 1}`, players })) }));
  const skinsIn = n - skins.out.filter(x => pool.some(p => p.id === x)).length;
  return (
    <>
      <div className="scroll">
        <div className="toggle-row">
          <div><div className="toggle-lbl">The pot</div><div className="toggle-sub">One leaderboard across every group, places paid</div></div>
          <Toggle on={pot.on} onChange={on => setPot(p => ({ ...p, on }))} label="The pot" />
        </div>
        {pot.on && (
          <div className="block">
            <Segmented label="How the pot is played" className="press-mode-row" btn="pm-btn" value={pot.kind} onChange={kind => setPot(p => ({ ...p, kind }))}
              options={Object.entries(POT_KINDS).map(([value, k]) => ({ value, label: k.short, disabled: !useHc && value === 'net' }))} />
            <p className="field-help">{POT_KINDS[pot.kind].blurb}</p>
            <div className="field-label">Each player puts in</div>
            <button type="button" className="amt-btn" onClick={() => setPad('pot')}>{money(pot.stake)}</button>
            <div className="field-label">Places paid</div>
            <Segmented label="Places paid" className="press-mode-row" btn="pm-btn" value={placesLabel(pot.places)} onChange={v => setPot(p => ({ ...p, places: PLACES.find(x => placesLabel(x.places) === v).places }))}
              options={PLACES.filter(x => x.places.length <= Math.max(1, n - 1)).map(x => ({ value: placesLabel(x.places), label: x.places.length === 1 ? 'Winner' : x.places.join('/') }))} />
            <p className="field-help">{n} players make a {money(pot.stake * n)} pot: {pot.places.map((pc, i) => `${['1st', '2nd', '3rd', '4th'][i]} ${money(Math.round(pot.stake * n * pc) / 100)}`).join(', ')}. Ties share the places they cover.</p>
          </div>
        )}
        <div className="toggle-row">
          <div><div className="toggle-lbl">Field skins</div><div className="toggle-sub">One skin a hole across every group: the lowest score alone takes it</div></div>
          <Toggle on={skins.on} onChange={on => setSkins(s => ({ ...s, on }))} label="Field skins" />
        </div>
        {skins.on && (
          <div className="block">
            <Segmented label="Net or gross skins" className="press-mode-row" btn="pm-btn" value={skins.kind} onChange={kind => setSkins(s => ({ ...s, kind }))}
              options={[{ value: 'net', label: 'Net', disabled: !useHc }, { value: 'gross', label: 'Gross' }]} />
            <div className="field-label">Each player in puts in</div>
            <button type="button" className="amt-btn" onClick={() => setPad('skins')}>{money(skins.stake)}</button>
            <div className="toggle-row ap-game">
              <div><div className="toggle-lbl">Ties carry</div><div className="toggle-sub">{skins.carry ? 'Each hole is worth the same part of the pot, a tie carries it on, and what’s carried past the last hole is shared by every skin' : 'The pot is split by skins won, so every skin is worth the same'}</div></div>
              <Toggle on={skins.carry} onChange={carry => setSkins(s => ({ ...s, carry }))} label="Ties carry" />
            </div>
            <div className="field-label">Who’s in · {skinsIn} of {n}</div>
            <div className="chip-row flush">
              {pool.map(p => {
                const on = !skins.out.includes(p.id);
                return <button key={p.id} type="button" className={`pill-btn sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setSkins(s => ({ ...s, out: on ? [...s.out, p.id] : s.out.filter(x => x !== p.id) }))}>{nameOf(p.id)}</button>;
              })}
            </div>
            <p className="field-help">{money(skins.stake * skinsIn)} in the skins pot.</p>
          </div>
        )}
        <div className="toggle-row">
          <div><div className="toggle-lbl">Team best ball</div><div className="toggle-sub">Partners can be in different groups. The best ball on each hole counts</div></div>
          <Toggle on={teams.on} onChange={teamOn} label="Team best ball" />
        </div>
        {teams.on && (
          <div className="block">
            <Segmented label="Team size" className="press-mode-row" btn="pm-btn" value={teams.best === 2 ? 4 : 2} onChange={teamSize}
              options={[{ value: 2, label: 'Twos, best ball' }, { value: 4, label: 'Fours, best two', disabled: n < 8 }]} />
            <div className="field-label">Each player puts in</div>
            <button type="button" className="amt-btn" onClick={() => setPad('teams')}>{money(teams.stake)}</button>
            <div className="field-label">The teams</div>
            {teams.list.map((t, i) => (
              <div key={t.id} className="big-team-row">
                <span className="tr-sub">{t.name}</span>
                <div className="chip-row flush">
                  {t.players.map(pid => <button key={pid} type="button" className="pill-btn sm" onClick={() => setMoving({ pid, from: i })}>{nameOf(pid)} <Icon name="arrows-left-right" /></button>)}
                </div>
              </div>
            ))}
            <button type="button" className="pill-btn sm" onClick={() => teamSize(teams.best === 2 ? 4 : 2)}>Balance by handicap</button>
            <p className="field-help">Balanced pairs the best player with the worst, the second best with the second worst, and so on. Winning team takes the pot, ties split it.</p>
          </div>
        )}
        {useHc && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Strokes given</div>
            <div className="chip-row flush">
              {PCTS.map(p => <button key={p} type="button" className={`pill-btn sm ${hcPct === p ? 'on' : ''}`} aria-pressed={hcPct === p} onClick={() => setHcPct(p)}>{p}%</button>)}
            </div>
            <p className="field-help">{allowanceHint(whs)} Every player gets their own strokes, never off the low player, so groups don’t matter.</p>
          </div>
        )}
      </div>
      <div className="cta-wrap"><button className="full-btn" disabled={!pot.on && !skins.on && !teams.on} onClick={onNext}>{!pot.on && !skins.on && !teams.on ? 'Turn on at least one' : <>Next: Side bets <Icon name="arrow-right" /></>}</button></div>
      <Numpad open={!!pad} title={pad === 'pot' ? 'Into the pot, each' : pad === 'skins' ? 'Into the skins, each' : 'Team best ball, each'} prefix="$" min={1} max={BIG_MAX_STAKE} quick={[5, 10, 20, 50]}
        initial={pad === 'pot' ? pot.stake : pad === 'skins' ? skins.stake : teams.stake} onClose={() => setPad(null)}
        onDone={v => { if (pad === 'pot') setPot(p => ({ ...p, stake: v })); else if (pad === 'skins') setSkins(s => ({ ...s, stake: v })); else setTeams(t => ({ ...t, stake: v })); setPad(null); }} />
      <Sheet open={!!moving} onClose={() => setMoving(null)} title={moving ? `Move ${nameOf(moving.pid)} to` : ''}>
        {moving && [...lists, []].map((l, i) => (
          <button key={i} className="sheet-item" disabled={i === moving.from} onClick={() => { setLists(moveTo([...lists, []], moving.pid, i)); setMoving(null); }}>
            <span>{i < lists.length ? `Team ${i + 1}` : 'A new team'} <span className="tr-sub">{l.map(nameOf).join(', ')}</span></span>
          </button>
        ))}
      </Sheet>
    </>
  );
}

/** Side bets between any two players, then start (or save) the game. */
function Bets({ big, setBets, nameOf, today, was, busy, problem, onFinish }) {
  const [editing, setEditing] = useState(null);
  const bs = { big, results: bigResults(big, bigField(big, () => null)), final: false };
  return (
    <>
      <div className="scroll">
        <BetsList bs={bs} name={nameOf} onEdit={setEditing} />
        <button className="add-row" onClick={() => setEditing('new')}><div className="add-ci"><Icon name="plus" /></div><span className="add-lbl">Add a side bet</span></button>
        <p className="field-help pad">Optional. You can add more once the groups are out, from the game’s page.</p>
        {problem && <p className="hint-card warn"><Icon name="warning" fill /> {problem}</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn pink" disabled={busy || !!problem} onClick={onFinish}>
          {busy ? 'Starting…' : was ? <>Save changes <Icon name="check" /></> : today ? <>Start the groups <Icon name="flag-pennant" fill /></> : <>Save the Big Game <Icon name="check" /></>}
        </button>
      </div>
      {editing && (
        <BigBetSheet open big={big} bet={editing === 'new' ? null : editing} name={nameOf} onClose={() => setEditing(null)}
          onSave={b => setBets(list => [...list.filter(x => x.id !== b.id), b])}
          onRemove={editing !== 'new' ? () => { setBets(list => list.filter(x => x.id !== editing.id)); setEditing(null); } : null} />
      )}
    </>
  );
}
