import { useEffect, useRef, useState } from 'react';
import { Header, Icon, Screen, Steps, useUI } from '../components/ui.jsx';
import { Stage } from '../components/Stage.jsx';
import { useStore } from '../lib/store.js';
import { playFromSearch } from '../lib/rule-links.js';
import { defaultTee as firstTee, findCourse } from '../lib/courses.js';
import { GAMES } from '../lib/round.js';
import { pickedCheck } from '../lib/just-playing.js';
import { HANDICAPS_STEP, OVERVIEW, PLAY_FOR_STEP, canCreate, nextStep, overviewRows } from '../lib/setup-overview.js';
import { fitHoles, setupTeams } from '../lib/setup-round.js';
import { useNav } from '../lib/nav.js';
import { nowMs, setupBack } from '../lib/setup-back.js';
import { matchingUsual } from '../lib/usuals.js';
import { CountForTrip, StartTripLink } from '../components/Trips.jsx';
import { CupRoundSetup } from '../components/Cup.jsx';
import { listNames } from '../lib/setup-screen.js';
// The steps and what setup keeps and does, one file each (src/screens/newround/)
import { useSetupBets, useSetupState } from './newround/useSetupState.js';
import { useSetupTrip } from './newround/useSetupTrip.js';
import { useLoadSetup, usePlanActions, useStartRound } from './newround/useSetupActions.js';
import { ReadyStep } from './newround/ReadyStep.jsx';
import { GameStep } from './newround/GameStep.jsx';
import { CourseStep } from './newround/CourseStep.jsx';
import { PlayersStep, QuickAddPlayer } from './newround/PlayersStep.jsx';
import { SetupStep } from './newround/SetupStep.jsx';
import { InviteStep, VoteStep } from './newround/PlanSteps.jsx';
import { HandicapsStep, OverviewStep, PlayForStep } from './newround/OverviewStep.jsx';
import { HolesPicker, WhenPicker } from './newround/Pickers.jsx';
import PlanAsk from './plan/PlanAsk.jsx';

// The Big Game's setup (BigGameSetup.jsx) uses the course step and Add a player too
export { CourseStep, QuickAddPlayer };

const STEPS = ['Game', 'Course', 'Players', 'Bets'];
const QUESTIONS = ['What are you playing?', 'Where are you playing?', 'Who’s in?', 'What’s on the line?'];
// The two choices only the overview opens on their own (setup-overview.js)
const OWN_QUESTIONS = { [HANDICAPS_STEP]: 'Playing with handicaps?', [PLAY_FOR_STEP]: 'What are you playing for?' };
// "Schedule for later": plan the round now, and the group answers and votes during the week
const PLAN_STEPS = ['Game', 'When', 'Who', 'Vote'];
const PLAN_QUESTIONS = ['What are you playing?', 'When are you playing?', 'Who’s invited?', 'What’s up for a vote?'];

/**
 * `edit`: change a planned round's day, tee time, course or holes (only the When step shows).
 * `ahead`: plan it for later. `game` and `ballot`: a game already picked and other games to put
 * up for a vote (from organizer onboarding). `onboarding`: this is the end of organizer onboarding,
 * so finishing lands on the plan with the paywall on top (when it's on), and cancelling drops
 * back to whatever is underneath. `reschedule`: a round set up but not played yet, turned into a
 * plan with the same setup (the round goes once the plan is made). `trip`: started from a trip's
 * page, so it counts for that trip.
 */
export default function NewRound(props) {
  // "Plan ahead" and Up next's "Get a round going" open the one-screen ask (plan/PlanAsk.jsx). A plan
  // for a trip, the end of organizer onboarding (a game already picked) and anything carried over
  // from a setup keep the full steps.
  const { ahead = false, trip = null, onboarding = false, game = null, edit = null, reschedule = null, fromPlan = null, rematch = null, play = null } = props;
  if (ahead && !trip && !onboarding && !game && !edit && !reschedule && !fromPlan && !rematch && !play) return <PlanAsk />;
  return <NewRoundSetup {...props} />;
}

function NewRoundSetup({ rematch, fromPlan, present, edit = null, ahead = false, game: gameIn = null, play = null, ballot = [], onboarding = false, reschedule = null, trip: tripId = null }) {
  const nav = useNav();
  const { ask } = useUI();
  const state = useStore();
  // "Play this now" on a rule page (?play=wolf): that game picked, or a side-only game added
  const fromPlay = play ? playFromSearch(`play=${encodeURIComponent(play)}`) : null;
  const preGame = gameIn ?? fromPlay?.game ?? null;
  const preSide = fromPlay?.side ?? null;
  // Setup's picks, kept with your place so a reload comes back to them (useSetupState.js)
  const setup = useSetupState({ state, edit, rematch, reschedule, fromPlan, present, ahead, tripId, fromPlay, preGame, preSide });
  const {
    editing, setMode, replaces, setBuilt, planning, date, setDate, teeTime, setTeeTime, invited, setInvited, step, reached, setReached, setStep, passDone, setPassDone,
    game, setGame, holesCount, setHolesCount, courseId, setCourseId, nine, setNine, picked, setPicked, tees, setTees, hcOverride, setHcOverride,
    opts, setOpts, useHc, setUseHc, startHole, setStartHole, teams, setTeams, setJustPlaying, casualIds, betting, setBetting, sidesFor, editSides,
    createdId, usual, missing, planSides, lostCourse, playFor, setPlayFor,
  } = setup;
  // The course editor over the course step: {} for a blank course, or { name, city } from a search.
  // Held here, not in the course step, so setup's Back knows it's open (see setup-back.js).
  const [editor, showEditor] = useState(null);
  const editorClose = useRef(null); // drops the editor's history entry, so the phone's back closes it first
  const editorClosedAt = useRef(-Infinity);
  const openEditor = prefill => {
    showEditor(prefill);
    editorClose.current = nav.layer ? nav.layer(() => { editorClose.current = null; editorClosedAt.current = nowMs(); showEditor(null); }) : null;
  };
  const closeEditor = () => {
    editorClose.current?.();
    editorClose.current = null;
    editorClosedAt.current = nowMs();
    showEditor(null);
  };
  // Leaving setup with the editor still open (an error, say) doesn't leave its history entry behind
  useEffect(() => () => editorClose.current?.(), []);
  // Side bets made here, and agreed challenges among the players picked (useSetupState.js)
  const bets = useSetupBets({ state, pre: setup.pre, fromPlan, planning, game, holesCount, nine, courseId, startHole, playFor, betting, teams });
  const { shownBets, editBets } = bets;

  const course = findCourse(state, courseId);
  // Counting it for a trip, and a team points trip's matches (useSetupTrip.js)
  const trip = useSetupTrip({ state, tripId, fromPlan, planning, date, invited, picked, betting, game, teams, setTeams });
  const { tripOn, countOn, setCountTrip, tripPick, tripCup, foursomes, cupPlayers, cupStart, cupPairs, roundCup, onCup } = trip;
  const cupRow = tripCup ? <CupRoundSetup trip={tripPick} players={cupPlayers} value={roundCup} names={tripCup.names} game={game} onChange={onCup} /> : null;
  const tripRow = tripOn && !editing ? <><CountForTrip trip={tripOn} on={countOn} onChange={setCountTrip} />{cupRow}</> : null;
  const tripLink = !tripOn && !editing && !fromPlan ? <StartTripLink /> : null;
  // Names from the usual still not saved here (adding one by the same name clears it from the hint)
  const savedNames = new Set(Object.values(state.players || {}).map(p => String(p?.name || '').trim().toLowerCase()));
  const stillMissing = missing.filter(n => !savedNames.has(String(n).trim().toLowerCase()));

  // A round to play now has the overview (OverviewStep.jsx); planning keeps its steps as they were
  const hub = !planning;
  // Screens slide in from the overview and back out to it (Stage.jsx): 'push' going on, 'pop' coming back
  const [stageDir, setStageDir] = useState('push');

  const close = async () => {
    if (editing) return nav.pop();
    if ((step === 0 || step === OVERVIEW) && !game) return nav.pop();
    if (planning) {
      if (await ask({ title: 'Cancel this plan?', text: 'Nothing gets sent until you finish.', confirmLabel: 'Cancel plan', cancelLabel: 'Keep planning', danger: true })) nav.pop();
      return;
    }
    if (await ask({ title: 'Cancel this round?', text: 'Your setup won’t be saved.', confirmLabel: 'Cancel round', cancelLabel: 'Keep setting up', danger: true })) nav.pop();
  };
  const back = () => {
    const b = setupBack({ step, editing: !!editing, editorOpen: !!editor, closedAt: editorClosedAt.current, hub, passDone });
    if (b.to === 'editor') return closeEditor();
    if (b.to === 'close') return close();
    if (b.to === 'step' && b.step === OVERVIEW) return toOverview();
    if (b.to === 'step') goTo(b.step);
  };
  // New or changed players get fresh teams, and so does a game that takes another number of teams
  // (setup-round.js setupTeams). On a team points trip the partners start from the trip's teams
  const fitTeams = () => {
    const next = setupTeams({ game, teams, betting, foursomes, tripCup: !!tripCup, cupTeams: () => cupPairs(cupStart) });
    if (next !== teams) setTeams(next);
  };
  // Players to Bets: the teams fitted first
  const toBets = () => {
    fitTeams();
    setStep(3);
  };
  // Back to the overview: from a step opened there it comes back the way it went ('pop'); the end of the first pass goes on to it ('push')
  const toOverview = (dir = 'pop') => {
    setStageDir(dir);
    setStep(OVERVIEW);
  };
  // A step's main button: on to the next step the first time through, else straight back to the
  // overview (a new game or new players get their teams fitted on the way, as the Bets step would)
  const advance = i => {
    if (passDone || i > 3) {
      if (i === 0 || i === 2) fitTeams();
      return toOverview();
    }
    if (i === 2) return toBets();
    if (i === 3) { setPassDone(true); return toOverview('push'); }
    setStep(i + 1);
  };
  // A row on the overview: that step (the Bets step with its teams fitted), sliding in
  const openStep = i => {
    setStageDir('push');
    if (i === 3) return toBets();
    setStep(i);
  };
  // Step bar taps: any earlier step, or a later one already reached whose earlier steps are still filled in
  const canGo = i => {
    if (i <= step) return true;
    if (i > reached || !game || (!course && !planning)) return false;
    if (planning) return true;
    return i < 3 || pickedCheck(game, picked, casualIds).valid;
  };
  const goTo = i => {
    if (!canGo(i)) return;
    if (planning && i === 0 && !ahead && !replaces) { setMode('round'); setReached(0); }
    if (!planning && i === 3) return toBets();
    setStep(i);
  };
  // Picking a game keeps the holes, unless the game can't be played over them
  const pickGame = gm => { setGame(gm); setHolesCount(h => fitHoles(gm, h)); };
  // Schedule for later from the game step: the game picked, then When
  const planIt = () => { setStageDir('push'); setMode('plan'); setBuilt(false); setReached(0); setStep(1); };

  const created = createdId ? state.rounds[createdId] : null;

  const defaultTee = firstTee(course)?.name || null;
  const orderedPicked = picked;
  const g = game ? GAMES[game] : null;

  // Plan it, start it, or load a setup (useSetupActions.js)
  const { makePlan, savePlan, later } = usePlanActions({ ...setup, ...bets, course, tripPick, onboarding });
  const { start } = useStartRound({ ...setup, ...trip, ...bets, course, orderedPicked, defaultTee, fromPlan });
  const { repeatUsual, pickUsual, planUsual } = useLoadSetup({ ...setup, state, setPairBets: bets.setPairBets });

  // The overview's rows (setup-overview.js): the steps the first pass has finished count as done
  const rows = hub ? overviewRows({
    game, course, holesCount, nine, startHole, picked, casualIds, betting, tees, defaultTee, teams, opts, sides: sidesFor(game), bets: shownBets, useHc, playFor,
    names: Object.fromEntries(picked.map(pid => [pid, state.players[pid]?.name || '?'])), done: passDone ? [0, 1, 2, 3] : [0, 1, 2, 3].filter(i => i < reached),
  }) : [];
  // Run it back on the overview: last time's round, through its saved usual when it matches one (so "Last played" moves)
  const savedUsual = hub && usual ? matchingUsual(state, usual.round) : null;
  const onAgain = () => (savedUsual ? pickUsual(savedUsual) : repeatUsual());
  // Schedule for later from the overview: the whole setup once it's been through, else the game picked so far
  const laterFromOverview = fromPlan ? null : passDone && course ? () => { setStageDir('push'); later(); } : planIt;

  // What's on stage: the overview, a step opened from it, the first pass, the plan's steps or Round ready
  const opened = hub && step !== OVERVIEW && step !== 4 && (passDone || step > OVERVIEW);
  const stageId = !hub ? 'plan' : step === 4 ? 'ready' : step === OVERVIEW ? 'overview' : opened ? `open-${step}` : 'pass';
  const lostHint = !course && lostCourse && (
    <p className="hint-card"><Icon name="map-pin" fill /> {lostCourse} isn’t on this phone any more. Pick the course below, or add it again.</p>
  );
  const missingHint = !planning && stillMissing.length > 0 && (
    <p className="hint-card"><Icon name="user-plus" fill /> {listNames(stillMissing)} {stillMissing.length === 1 ? 'isn’t' : 'aren’t'} saved on this phone yet. Add them to play with the whole group.</p>
  );

  return (
    <Stage id={stageId} dir={stageDir}>
    <Screen key={stageId}>
      {step !== 4 ? (
        <>
          <Header title={editing ? 'Edit plan' : planning ? 'Plan a round' : 'New round'} onBack={back} onClose={editing ? null : close} />
          {!editing && (planning || (!passDone && step <= 3)) && <Steps steps={planning ? PLAN_STEPS : STEPS} current={step} canGo={canGo} onGo={goTo} />}
          {step !== OVERVIEW && <h2 className="step-q d">{(planning ? PLAN_QUESTIONS : QUESTIONS)[step] || OWN_QUESTIONS[step]}</h2>}
          {step === 1 && lostHint}
          {step === 2 && planning && stillMissing.length > 0 && (
            <p className="hint-card"><Icon name="user-plus" fill /> {listNames(stillMissing)} {stillMissing.length === 1 ? 'isn’t' : 'aren’t'} saved on this phone yet. Add {stillMissing.length === 1 ? 'their name' : 'their names'} below, or send the group link.</p>
          )}
          {step === 2 && missingHint}
        </>
      ) : <Header title="Round ready" small onClose={() => nav.reset('upnext')} />}
      {step === OVERVIEW && hub && (
        <OverviewStep rows={rows} passDone={passDone} next={nextStep(rows)} ready={canCreate(rows)} again={passDone ? null : usual} onAgain={onAgain}
          onOpen={openStep} onNext={() => openStep(nextStep(rows) ?? 3)} onCreate={() => { setStageDir('push'); start(); }}
          onLater={laterFromOverview} laterOk={!!game} hints={<>{lostHint}{missingHint}</>} tripRow={passDone ? tripRow : null} />
      )}
      {step === 0 && <GameStep usual={null} onUsual={repeatUsual} onPickUsual={planning ? planUsual : pickUsual} planning={planning} onPlan={fromPlan ? null : planIt}
        game={game} setGame={pickGame} onNext={() => (planning ? setStep(1) : advance(0))} nextLabel={opened ? 'Done' : null} />}
      {step === 1 && planning && (
        <CourseStep editor={editor} openEditor={openEditor} closeEditor={closeEditor} courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={editing ? savePlan : () => setStep(2)}
          nextLabel={editing ? 'Save changes' : 'Next: Who’s invited'} nextIcon={editing ? 'check' : 'arrow-right'}
          onSkip={editing ? savePlan : () => setStep(2)} skipLabel={editing ? 'Save without a course' : 'Decide the course later'}
          top={<>
            <WhenPicker date={date} setDate={setDate} teeTime={teeTime} setTeeTime={setTeeTime} />
            <HolesPicker game={g} holesCount={holesCount} setHolesCount={setHolesCount} />
            <p className="field-help pad">{course ? 'The course is picked below. Change it if you need to.' : 'Then pick the course below, or decide it later: the plan says the course is still to be set.'}</p>
          </>} />
      )}
      {step === 2 && planning && <InviteStep invited={invited} setInvited={setInvited} onNext={() => setStep(3)} />}
      {step === 3 && planning && <VoteStep game={game} holesCount={holesCount} opts={opts} onPlan={makePlan} ballot={ballot} initialSides={planSides.length ? planSides : sidesFor(game).map(sg => sg.game)} playFor={playFor} setPlayFor={setPlayFor} tripRow={tripRow} />}
      {step === 1 && !planning && <CourseStep editor={editor} openEditor={openEditor} closeEditor={closeEditor} courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); }} holesCount={holesCount} nine={nine} setNine={setNine}
        game={g} setHolesCount={setHolesCount} startHole={startHole} setStartHole={setStartHole} onNext={() => advance(1)} {...(opened ? { nextLabel: 'Done', nextIcon: 'check' } : {})} />}
      {step === 2 && !planning && course && (
        <PlayersStep game={g} gameKey={game} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          tees={tees} setTees={setTees} hcOverride={hcOverride} setHcOverride={setHcOverride}
          justPlaying={casualIds} setJustPlaying={setJustPlaying}
          useHc={useHc} setUseHc={setUseHc} noHandicaps={game === 'bbb'} onNext={() => advance(2)} nextLabel={opened ? 'Done' : null} />
      )}
      {step === 3 && !planning && course && (
        <SetupStep game={game} course={course} holesCount={holesCount} nine={nine} picked={betting} setPicked={setBetting} casual={casualIds}
          opts={opts} setOpts={setOpts} useHc={useHc} setUseHc={setUseHc} startHole={startHole} setStartHole={setStartHole} onStart={() => advance(3)} onLater={null}
          startLabel={opened ? 'Done' : 'Next: Look it over'} startIcon={opened ? 'check' : 'arrow-right'}
          teams={teams} setTeams={setTeams} sideGames={sidesFor(game)} setSideGames={editSides} playFor={playFor} setPlayFor={setPlayFor}
          tees={tees} hcOverride={hcOverride} defaultTee={defaultTee} pairBets={shownBets} setPairBets={editBets}
          tripRow={tripRow} tripLink={tripLink} />
      )}
      {step === HANDICAPS_STEP && hub && game && (
        <HandicapsStep game={game} teams={teams} players={betting.length} opts={opts} setOpts={setOpts} useHc={useHc} setUseHc={setUseHc}
          sideGames={sidesFor(game)} setSideGames={editSides} onDone={() => advance(HANDICAPS_STEP)} />
      )}
      {step === PLAY_FOR_STEP && hub && <PlayForStep playFor={playFor} setPlayFor={setPlayFor} onDone={() => advance(PLAY_FOR_STEP)} />}
      {step === 4 && created && <ReadyStep round={created} onStart={() => nav.reset('upnext', ['play', { id: created.id }])} onLater={fromPlan || created.shared ? null : () => later(created.id)} />}
    </Screen>
    </Stage>
  );
}
