// What setup does when it's done (NewRound.jsx): make the plan or save a plan's changes, start the
// round (asking about missing handicaps and age first), turn the setup into a plan for later, and load
// last time's setup or a saved usual. Moved out of NewRound.jsx unchanged when it was split up: each
// hook takes setup's picks (useSetupState and the rest) as one object.
import { useRef } from 'react';
import { useUI } from '../../components/ui.jsx';
import { useAgeCheck } from '../../components/AgeCheck.jsx';
import { getState, uid, update } from '../../lib/store.js';
import { roundProps, track } from '../../lib/analytics.js';
import { buildSetupRound, finishSetupRound, noHandicapIds } from '../../lib/setup-round.js';
import { rematchSetup } from '../../lib/rematch.js';
import { addRound, leaveRound } from '../../lib/rounds.js';
import { newPlan } from '../../lib/plans.js';
import { setupForPlan } from '../../lib/plan-setup.js';
import { PLAN_LOCKED, editPlan } from '../../lib/plan-sync.js';
import { rebookIfMoved } from '../../lib/tee-reminders.js';
import { shouldShowPaywall } from '../../lib/paywall.js';
import { PAYWALL_ON } from '../../lib/paywall-flag.js';
import { hasLifetimePro } from '../../lib/pro-client.js';
import { planFromUsual, setupFromUsual } from '../../lib/usuals.js';
import { needsAgeCheck } from '../../lib/age.js';
import { countsMoney } from '../../lib/play-for.js';
import { tripStamp } from '../../lib/trips.js';
import { movedFromFor } from '../../lib/challenges.js';
import { challengesBack, markChallengesOn } from '../../lib/challenge-sync.js';
import { useNav } from '../../lib/nav.js';
import { listNames, withBets } from '../../lib/setup-screen.js';

/** Plan it (`makePlan`), save an edited plan (`savePlan`), or turn this setup into a plan (`later`). */
export function usePlanActions(setup) {
  const nav = useNav();
  const { showToast } = useUI();
  const {
    opts, sidesFor, game, usualId, replaces, built, invited, picked, holesCount, nine, date, teeTime, course, useHc, playFor, tees, hcOverride, teams, startHole,
    setupBets, tripPick, onboarding, editing, setInvited, setReplaces, setBuilt, setMode, setReached, showStep,
  } = setup;

  // Plan it: saved on this phone, then the group gets the link from the plan's page
  const makePlan = ({ ballotGames, suggestedBet, ballotBets, ballotSides = [] }) => {
    const s = getState();
    const id = uid('pl_');
    const me = s.players[s.me];
    // Side games set up on the Bets step go on the ballot with the house rules picked there
    const settings = { ...opts, ...Object.fromEntries(sidesFor(game).map(sg => [sg.game, structuredClone(sg.settings)])) };
    // Set up before it was scheduled (a usual, a round not played yet, or the Bets step): the plan keeps that setup
    const fromSetup = !!(usualId || replaces || built);
    const people = invited.filter(pid => pid !== s.me).map(pid => s.players[pid]).filter(Boolean);
    const group = [s.me, ...people.map(p => p.id)].filter(Boolean);
    const order = [...picked.filter(pid => group.includes(pid)), ...group.filter(pid => !picked.includes(pid))];
    const plan = newPlan({
      id, hostName: me?.name || 'Me', game, holesCount, nine, date, teeTime, course, people,
      ballot: { games: ballotGames, bets: ballotBets, sides: ballotSides }, suggestedBet, settings, useHc: fromSetup ? useHc : false, playFor,
      // From a saved usual: its handicap percentage, and which usual (for "Last played")
      ...(usualId ? { usualId, hcPct: opts.hcPct } : {}),
      // Set up first: its handicap %, half strokes, each side game's own Strokes given %, and the
      // order, teams, tees, handicap edits, starting hole and side bets for the roll call
      ...(fromSetup ? {
        hcPct: opts.hcPct,
        halfStrokes: !!opts.halfStrokes,
        sidePcts: Object.fromEntries(sidesFor(game).filter(sg => sg.hcPct != null).map(sg => [sg.game, sg.hcPct])),
        setup: setupForPlan({ game, courseId: course.id, holesCount, nine, me: s.me, order, teams, tees, hcOverride, startHole, bets: setupBets }),
      } : {}),
    });
    // Planned for a trip: it groups under the trip on everyone's Up next
    if (tripPick) plan.trip = tripStamp(tripPick);
    // A round from a plan, kept for another day: the plan's challenges move to this one (challenges.js)
    const oldPlan = replaces ? Object.values(s.plans || {}).find(p => p?.host && p.roundId === replaces) : null;
    if (oldPlan) { const moved = movedFromFor(oldPlan, plan); if (moved.length) plan.movedFrom = moved; }
    // The old plan says where it went, so friends' phones stop showing it as on (plan-sync.js adds the link once there is one)
    if (oldPlan) editPlan(oldPlan.id, p => { p.movedTo = { id, code: null, date }; });
    // The round it replaces never got played: its challenges are agreed again for the next round together
    if (replaces) challengesBack(getState().rounds[replaces]);
    update(st => {
      if (!st.plans) st.plans = {};
      st.plans[id] = plan;
      if (course && !st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
      if (replaces && st.rounds[replaces]) { delete st.rounds[replaces]; leaveRound(st, replaces); }
    });
    track('plan_created', { game, holes: holesCount, invited: people.length, trip: !!tripPick, from: onboarding ? 'onboarding' : 'setup' });
    const paywall = onboarding && shouldShowPaywall(getState(), PAYWALL_ON, { pro: hasLifetimePro() }) ? [['paywall', { source: 'onboarding' }]] : [];
    nav.reset('upnext', ['plan', { id }], ...paywall);
  };

  // Save the changed day, time, course or holes on the plan; a shared plan sends them to the group
  const savePlan = () => {
    editPlan(editing.id, p => {
      // A tee time booked for the old day or course comes off (tee-reminders.js)
      rebookIfMoved(p, { date, courseId: course?.id ?? null });
      p.date = date;
      p.teeTime = teeTime || null;
      p.holesCount = holesCount;
      p.nine = nine || 'front';
      p.course = course ? { id: course.id, name: course.name, city: course.city || null } : null;
    }).then(r => { if (r === 'taken') showToast(PLAN_LOCKED); });
    update(st => { if (course && !st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6); });
    showToast(editing.code ? 'Plan updated. Everyone with the link sees the change.' : 'Plan updated');
    nav.pop();
  };

  // "Schedule for later" from the Bets step or the Ready step: the same setup becomes a plan, with
  // everyone picked already invited. From the Ready step the round just made goes once the plan is.
  const later = (replaceId = null) => {
    setInvited(picked.filter(pid => pid !== getState().me));
    setReplaces(replaceId);
    setBuilt(true);
    setMode('plan');
    setReached(3);
    showStep(1);
  };

  return { makePlan, savePlan, later };
}

/** Create round: `start`, one at a time. It lands on Round ready (step 4) with the round made. */
export function useStartRound(setup) {
  const { ask, showToast } = useUI();
  const checkAge = useAgeCheck();
  const {
    useHc, game, betting, hcOverride, setStep, setUseHc, orderedPicked, tees, defaultTee, opts, sidesFor, course, holesCount, nine, startHole, teams, casualIds,
    playFor, setPlayFor, shownBets, editBets, tripPick, tripCup, roundCup, fromSession, schedHit, fromPlan, usualId, pre, setCreatedId,
  } = setup;

  // A round already in progress is never touched: it stays saved and you can switch back to it.
  // One start at a time, so a double tap (or one while the handicap or age question is up) makes one round
  const starting = useRef(false);
  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    try { await startRound(); } finally { starting.current = false; }
  };
  const startRound = async () => {
    const s = getState();
    // Only the betting players' handicaps matter: someone just playing gets no strokes
    const noHc = noHandicapIds(s, { useHc, game, betting, hcOverride });
    if (noHc.length) {
      const names = noHc.map(pid => s.players[pid]?.name || '?');
      const all = noHc.length === betting.length;
      const ok = await ask({
        title: all ? 'Nobody has a handicap' : `${listNames(names)} ${noHc.length === 1 ? 'has' : 'have'} no handicap`,
        text: all ? 'Everyone plays as scratch (0), so nobody gets strokes. Add handicaps, or play without them.'
          : `They’d play as scratch (0), so everyone else gets strokes from them. Add ${noHc.length === 1 ? 'a handicap' : 'handicaps'}?`,
        confirmLabel: all ? 'Play without handicaps' : 'Play them as scratch', cancelLabel: 'Add handicaps',
      });
      if (!ok) return setStep(2);
      if (all) setUseHc(false);
    }
    const id = uid('r_');
    // The round itself is built in setup-round.js, so a test can pin what each set of choices saves
    const { round, settings, challengesIn } = buildSetupRound(s, {
      id, game, course, holesCount, nine, startHole, orderedPicked, betting, tees, defaultTee, hcOverride, opts, sides: sidesFor(game), useHc, noHc, teams, casualIds, playFor, shownBets,
    });
    // Money needs a yes to "Are you 18 or older?" once (age.js). Under 18 keeps the round and
    // turns the money off: points instead of money, or a reward round's side bets for points
    if (needsAgeCheck(s, round)) {
      const answer = await checkAge();
      if (answer !== 'adult') {
        if (answer === 'under') {
          // Through editBets, so agreed challenges shown as side bets go to points too and the next
          // Tee off doesn't ask again
          const whole = countsMoney({ playFor });
          if (whole) setPlayFor({ kind: 'points' });
          else editBets(list => list.map(b => (b.playFor === 'points' ? b : { ...b, playFor: 'points' })));
          showToast(whole ? 'Switched to points. Money rounds are for 18 or older.' : 'Side bets set to points. Money is for 18 or older.');
        }
        return;
      }
    }
    // The trip, its matches, the schedule's place and the usual it came from (setup-round.js)
    finishSetupRound(s, round, { game, course, tripPick, tripCup, roundCup, fromSession, schedHit, fromPlan, usualId });
    update(st => {
      addRound(st, round);
      if (fromPlan && st.plans?.[fromPlan]) st.plans[fromPlan].roundId = id;
      // Remember choices as next time's defaults
      st.settings = { ...st.settings, ...settings };
      if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
    });
    // The roll call's keys to player ids, so a round kept for another day carries its challenges to the right people
    if (fromPlan) editPlan(fromPlan, p => { p.status = 'started'; p.roundId = id; if (pre?.idOf && Object.keys(pre.idOf).length) p.rollIds = { ...pre.idOf }; });
    markChallengesOn(challengesIn, id);
    track('round_started', roundProps(round, { from: fromPlan ? 'plan' : 'setup' }));
    setCreatedId(id);
    setStep(4);
  };

  return { start };
}

/** Last time's setup (`repeatUsual`) or a saved usual, for a round now (`pickUsual`) or a plan (`planUsual`). */
export function useLoadSetup(setup) {
  const {
    state, usual, setGame, setHolesCount, setCourseId, setNine, setPicked, setTees, setHcOverride, setOpts, setUseHc, setStartHole, setTeams, setJustPlaying,
    setSideGames, setPlayFor, setMissing, setStep, setUsualId, setLostCourse, setPairBets, setInvited, setPlanSides,
  } = setup;

  // Load a setup (last time's, or a saved usual), then land on the bets to confirm, or on
  // whatever step still needs something (a course or a player not on this phone)
  const loadSetup = p => {
    setGame(p.game); setHolesCount(p.holesCount); setCourseId(p.courseId); setNine(p.nine);
    setPicked(p.picked); setTees(p.tees); setHcOverride(p.hcOverride);
    setOpts(o => withBets(o, p));
    setUseHc(p.useHc);
    setStartHole(null);
    setTeams(p.teams);
    setJustPlaying(p.justPlaying || []);
    setSideGames(structuredClone(p.sideGames || []));
    setPlayFor(p.playFor ?? null);
    setMissing(p.missing || []);
    setStep(p.step ?? 3);
  };
  const repeatUsual = () => {
    loadSetup({ ...rematchSetup(state, usual.round), courseId: usual.course.id, step: 3 });
    setUsualId(null);
    setLostCourse(null);
  };
  const pickUsual = u => {
    const p = setupFromUsual(getState(), u);
    if (!p) return;
    loadSetup(p);
    setUsualId(u.id);
    setLostCourse(p.courseId ? null : u.courseName || null);
  };
  // Planning ahead from a usual: the game, bets, side games, course and group are filled in, and
  // the game and bet still go to the group vote as the organizer's suggestion. It lands on When
  // and Course, since the date always needs picking.
  const planUsual = u => {
    const p = planFromUsual(getState(), u);
    if (!p) return;
    setGame(p.game); setHolesCount(p.holesCount); setNine(p.nine);
    setCourseId(p.courseId); setStartHole(null);
    // The usual's order, teams, tees and handicap edits ride along to the roll call (plan-setup.js)
    setPicked(p.order); setTees(p.tees); setHcOverride(p.hcOverride); setTeams(p.teams);
    // Usuals never bring side bets back, so none made before picking it ride along on the plan
    setPairBets([]);
    setInvited(p.invited);
    setOpts(o => ({ ...o, halfStrokes: false, ...structuredClone(p.opts) }));
    setUseHc(p.useHc);
    setPlanSides(p.sides);
    setSideGames(structuredClone(p.sideGames || []));
    setPlayFor(p.playFor ?? null);
    setMissing(p.missing);
    setUsualId(p.usualId);
    setLostCourse(p.courseId ? null : u.courseName || null);
    setStep(p.step);
  };

  return { repeatUsual, pickUsual, planUsual };
}
