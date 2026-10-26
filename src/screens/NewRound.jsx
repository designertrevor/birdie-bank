import { useEffect, useRef, useState } from 'react';
import { Header, Icon, Screen, Steps, useUI } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { playFromSearch } from '../lib/rule-links.js';
import { defaultTee as firstTee, findCourse } from '../lib/courses.js';
import { GAMES } from '../lib/round.js';
import { pickedCheck } from '../lib/just-playing.js';
import { defaultTeams } from '../lib/teams.js';
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
import { HolesPicker, WhenPicker } from './newround/Pickers.jsx';
import PlanAsk from './plan/PlanAsk.jsx';

// The Big Game's setup (BigGameSetup.jsx) uses the course step and Add a player too
export { CourseStep, QuickAddPlayer };

const STEPS = ['Game', 'Course', 'Players', 'Bets'];
const QUESTIONS = ['What are you playing?', 'Where are you playing?', 'Who’s in?', 'What’s on the line?'];
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
    editing, setMode, replaces, setBuilt, planning, date, setDate, teeTime, setTeeTime, invited, setInvited, step, reached, setReached, setStep,
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

  const close = async () => {
    if (editing) return nav.pop();
    if (step === 0 && !game) return nav.pop();
    if (planning) {
      if (await ask({ title: 'Cancel this plan?', text: 'Nothing gets sent until you finish.', confirmLabel: 'Cancel plan', cancelLabel: 'Keep planning', danger: true })) nav.pop();
      return;
    }
    if (await ask({ title: 'Cancel this round?', text: 'Your setup won’t be saved.', confirmLabel: 'Cancel round', cancelLabel: 'Keep setting up', danger: true })) nav.pop();
  };
  const back = () => {
    const b = setupBack({ step, editing: !!editing, editorOpen: !!editor, closedAt: editorClosedAt.current });
    if (b.to === 'editor') return closeEditor();
    if (b.to === 'close') return close();
    if (b.to === 'step') goTo(b.step);
  };
  // Players to Bets: new or changed players get fresh teams, and so does a game that takes another
  // number of teams (three scramble teams, then a switch to Best ball)
  const toBets = () => {
    const cfg = GAMES[game]?.teams;
    const wrongCount = !!cfg && !!teams && (Array.isArray(cfg.count) ? teams.length < cfg.count[0] || teams.length > cfg.count[1] : teams.length !== cfg.count);
    // On a team points trip: the partners start from the trip's teams, rotated (cup.js), for
    // foursomes and for any game played two against two (a 2 v 2 Nassau)
    const twoTeams = !!cfg && (Array.isArray(cfg.count) ? cfg.count[0] <= 2 && cfg.count[1] >= 2 : cfg.count === 2);
    if (!teams || wrongCount || teams.flat().length !== betting.length || teams.flat().some(pid => !betting.includes(pid))) setTeams(((foursomes || (tripCup && twoTeams)) && cupPairs(cupStart)) || defaultTeams(game, betting));
    setStep(3);
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

  const created = createdId ? state.rounds[createdId] : null;

  const defaultTee = firstTee(course)?.name || null;
  const orderedPicked = picked;
  const g = game ? GAMES[game] : null;

  // Plan it, start it, or load a setup (useSetupActions.js)
  const { makePlan, savePlan, later } = usePlanActions({ ...setup, ...bets, course, tripPick, onboarding });
  const { start } = useStartRound({ ...setup, ...trip, ...bets, course, orderedPicked, defaultTee, fromPlan });
  const { repeatUsual, pickUsual, planUsual } = useLoadSetup({ ...setup, state, setPairBets: bets.setPairBets });

  return (
    <Screen>
      {step < 4 ? (
        <>
          <Header title={editing ? 'Edit plan' : planning ? 'Plan a round' : 'New round'} onBack={back} onClose={editing ? null : close} />
          {!editing && <Steps steps={planning ? PLAN_STEPS : STEPS} current={step} canGo={canGo} onGo={goTo} />}
          <h2 className="step-q d">{(planning ? PLAN_QUESTIONS : QUESTIONS)[step]}</h2>
          {step === 1 && !course && lostCourse && (
            <p className="hint-card"><Icon name="map-pin" fill /> {lostCourse} isn’t on this phone any more. Pick the course below, or add it again.</p>
          )}
          {step === 2 && planning && stillMissing.length > 0 && (
            <p className="hint-card"><Icon name="user-plus" fill /> {listNames(stillMissing)} {stillMissing.length === 1 ? 'isn’t' : 'aren’t'} saved on this phone yet. Add {stillMissing.length === 1 ? 'their name' : 'their names'} below, or send the group link.</p>
          )}
          {step === 2 && !planning && stillMissing.length > 0 && (
            <p className="hint-card"><Icon name="user-plus" fill /> {listNames(stillMissing)} {stillMissing.length === 1 ? 'isn’t' : 'aren’t'} saved on this phone yet. Add them to play with the whole group.</p>
          )}
        </>
      ) : <Header title="Round ready" small onClose={() => nav.reset('upnext')} />}
      {step === 0 && <GameStep usual={planning || (usual && matchingUsual(state, usual.round)) ? null : usual} onUsual={repeatUsual} onPickUsual={planning ? planUsual : pickUsual} planning={planning} onPlan={fromPlan ? null : () => { setMode('plan'); setBuilt(false); setReached(0); setStep(1); }} game={game} setGame={gm => { setGame(gm); if (gm && !GAMES[gm].holes.includes(holesCount)) setHolesCount(GAMES[gm].holes[0]); }} onNext={() => setStep(1)} />}
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
        game={g} setHolesCount={setHolesCount} startHole={startHole} setStartHole={setStartHole} onNext={() => setStep(2)} />}
      {step === 2 && !planning && course && (
        <PlayersStep game={g} gameKey={game} course={course} holesCount={holesCount} nine={nine} picked={picked} setPicked={setPicked}
          tees={tees} setTees={setTees} hcOverride={hcOverride} setHcOverride={setHcOverride}
          justPlaying={casualIds} setJustPlaying={setJustPlaying}
          useHc={useHc} setUseHc={setUseHc} noHandicaps={game === 'bbb'} onNext={toBets} />
      )}
      {step === 3 && !planning && course && (
        <SetupStep game={game} course={course} holesCount={holesCount} nine={nine} picked={betting} setPicked={setBetting} casual={casualIds}
          opts={opts} setOpts={setOpts} useHc={useHc} setUseHc={setUseHc} startHole={startHole} setStartHole={setStartHole} onStart={start} onLater={fromPlan ? null : () => later()}
          teams={teams} setTeams={setTeams} sideGames={sidesFor(game)} setSideGames={editSides} playFor={playFor} setPlayFor={setPlayFor}
          tees={tees} hcOverride={hcOverride} defaultTee={defaultTee} pairBets={shownBets} setPairBets={editBets}
          tripRow={tripRow} tripLink={tripLink} />
      )}
      {step === 4 && created && <ReadyStep round={created} onStart={() => nav.reset('upnext', ['play', { id: created.id }])} onLater={fromPlan || created.shared ? null : () => later(created.id)} />}
    </Screen>
  );
}
