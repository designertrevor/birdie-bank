// Everything setup keeps while a round is set up or planned (NewRound.jsx), kept with your place so
// a reload comes back to the same step with the same picks (useKept). Moved out of NewRound.jsx
// unchanged when it was split up.
import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, getState, uid } from '../../lib/store.js';
import { useKept } from '../../lib/kept.js';
import { GAMES, SIDE_GAMES, holesInPlay, oneBall, sideGamesOf } from '../../lib/round.js';
import { canJustPlay } from '../../lib/just-playing.js';
import { fitSetupBets } from '../../lib/pair-bets.js';
import { findCourse } from '../../lib/courses.js';
import { rematchSetup } from '../../lib/rematch.js';
import { rescheduleSetup } from '../../lib/plan-setup.js';
import { usualRound } from '../../lib/rounds.js';
import { moneyOff } from '../../lib/age.js';
import { tripOf, tripPlanDay } from '../../lib/trips.js';
import { challengeIdOfBet, challengesForRound } from '../../lib/challenges.js';
import { nextSaturday, planSetup, withBets } from '../../lib/setup-screen.js';
import { OVERVIEW } from '../../lib/setup-overview.js';

/**
 * Setup's picks: the game, course, players, bets and the rest, started from NewRound's props (`edit`,
 * `rematch`, `reschedule`, `fromPlan` and the rest, see NewRound) and a "Play this now" link
 * (`fromPlay`, `preGame`, `preSide`).
 */
export function useSetupState({ state, edit, rematch, reschedule, fromPlan, present, ahead, tripId, fromPlay, preGame, preSide }) {
  // "Run it back" opens setup already filled in like an earlier round
  const [editing] = useState(() => (edit ? getState().plans?.[edit] || null : null));
  const [pre] = useState(() => (editing ? { game: editing.game, holesCount: editing.holesCount, courseId: findCourse(getState(), editing.course?.id)?.id ?? null, nine: editing.nine, step: 1 }
    : rematch ? rematchSetup(getState(), getState().rounds[rematch])
      : reschedule ? rescheduleSetup(getState(), getState().rounds[reschedule])
        : fromPlan ? planSetup(getState(), fromPlan, present, () => uid('p_')) : null));
  const [mode, setMode] = useKept('setup:mode', ahead || editing || (reschedule && pre) ? 'plan' : 'round'); // 'plan': schedule for later
  // A round already set up that the plan takes the place of
  const [replaces, setReplaces] = useKept('setup:replaces', reschedule && pre ? reschedule : null);
  // Scheduled from the Bets step or Round ready: the setup was built first, so the plan keeps it
  const [built, setBuilt] = useKept('setup:built', false);
  const planning = mode === 'plan';
  // Planned from a trip's page: a day of the trip, not next Saturday
  const [date, setDate] = useKept('setup:date', () => editing?.date || (tripId && tripPlanDay(tripOf(getState(), tripId))) || nextSaturday());
  const [teeTime, setTeeTime] = useKept('setup:teeTime', editing?.teeTime || '');
  const [invited, setInvited] = useKept('setup:invited', () => (reschedule && pre ? pre.picked.filter(pid => pid !== getState().me) : []));
  // A round to play now opens on the overview (setup-overview.js): filled in from Run it back or a
  // plan it lands there with the first pass done, else on whichever step still needs something
  const startsPlanning = !!(ahead || editing || (reschedule && pre));
  const [step, showStep] = useKept('setup:step', startsPlanning ? pre?.step ?? (ahead && GAMES[preGame] ? 1 : 0) : pre?.step != null && pre.step < 3 ? pre.step : OVERVIEW);
  // The first pass through the steps is done: from here a step opened from the overview goes back to it
  const [passDone, setPassDone] = useKept('setup:passDone', !startsPlanning && pre?.step === 3);
  // The furthest step reached, so a tap on the step bar can go forward again after going back
  const [reached, setReached] = useKept('setup:reached', () => (reschedule && pre?.step ? 3 : pre?.step ?? (ahead && GAMES[preGame] ? 1 : 0)));
  // Only the four steps count as reached: the overview and its own choices aren't on the step bar
  const setStep = n => { showStep(n); if (n <= 3) setReached(r => Math.max(r, n)); };
  const [game, setGame] = useKept('setup:game', pre?.game ?? (GAMES[preGame] ? preGame : null));
  const [holesCount, setHolesCount] = useKept('setup:holesCount', pre?.holesCount ?? (GAMES[preGame]?.holes.includes(18) === false ? GAMES[preGame].holes[0] : 18));
  const [courseId, setCourseId] = useKept('setup:courseId', pre?.courseId ?? null);
  const [nine, setNine] = useKept('setup:nine', pre?.nine ?? 'front');
  const [picked, setPicked] = useKept('setup:picked', () => pre?.picked ?? (state.me ? [state.me] : []));
  const [tees, setTees] = useKept('setup:tees', pre?.tees ?? {});          // pid -> tee name
  const [hcOverride, setHcOverride] = useKept('setup:hcOverride', pre?.hcOverride ?? {}); // pid -> number
  // A "Play this now" name with a house rule in it (/?play=rolling-quota) turns that rule on
  const [opts, setOpts] = useKept('setup:opts', () => {
    const o = withBets(structuredClone(state.settings), pre);
    for (const [g, on] of Object.entries(fromPlay?.rules || {})) o[g] = { ...(o[g] || {}), ...on };
    return o;
  });
  // Off for a brand new setup: a missing handicap must never quietly play as scratch. Run it back,
  // a usual or a plan keeps the group's own choice
  const [useHc, setUseHc] = useKept('setup:useHc', pre?.useHc ?? false);
  const [startHole, setStartHole] = useKept('setup:startHole', pre?.startHole ?? null);
  const [teams, setTeams] = useKept('setup:teams', pre?.teams ?? null); // arrays of player ids, for team games
  // Players marked "Just playing, no bet" (just-playing.js): on the card, out of every game. Only the
  // betting players count for the game's numbers, its teams, its order and its side bets
  const [justPlaying, setJustPlaying] = useKept('setup:justPlaying', () => pre?.justPlaying ?? []);
  const casualIds = canJustPlay(game) ? picked.filter(pid => justPlaying.includes(pid)) : [];
  const betting = casualIds.length ? picked.filter(pid => !casualIds.includes(pid)) : picked;
  // The playing order and teams change only the betting players: anyone just playing keeps their place after them
  const setBetting = fn => setPicked(p => {
    const jp = p.filter(pid => casualIds.includes(pid));
    const next = typeof fn === 'function' ? fn(p.filter(pid => !jp.includes(pid))) : fn;
    return [...next, ...jp];
  });
  // Side games on top of the main game: [{ game, settings }] (start-now setup only, not plans)
  // "Play this now" on a side game's rule page (Closest to the pin, say) starts with it added, from your usual settings
  const [sideGames, setSideGames] = useKept('setup:sideGames', () => structuredClone(pre?.sideGames
    || (SIDE_GAMES[preSide] && !GAMES[preSide] ? [{ game: preSide, settings: { ...(DEFAULT_SETTINGS[preSide] || {}), ...(state.settings?.[preSide] || {}) } }] : [])));
  // Only the side games that still fit the main game (a Skins main game drops a Skins side game)
  const sidesFor = gm => sideGamesOf({ game: gm, sideGames });
  // Setup edits the list it shows, so an index always points at the side game on screen (a side game
  // hidden by a change of main game is dropped by the edit rather than changed by mistake)
  const editSides = fn => setSideGames(list => fn(sideGamesOf({ game, sideGames: list })));
  const [createdId, setCreatedId] = useKept('setup:createdId', null); // the round, once it's set up
  const usual = useMemo(() => usualRound(state), [state]);
  // The saved usual this setup was loaded from, and anyone in it who isn't saved on this phone
  const [usualId, setUsualId] = useKept('setup:usualId', () => pre?.usualId ?? null);
  const [missing, setMissing] = useKept('setup:missing', () => pre?.missing || []);
  // Planning from a saved usual: its side games start picked on the ballot
  const [planSides, setPlanSides] = useKept('setup:planSides', []);
  // A usual whose course isn't on this phone any more: its name, so the course step can say so
  const [lostCourse, setLostCourse] = useKept('setup:lostCourse', null);
  // What it's played for: null is money (as every round before it), else points or a reward
  // Someone who said they're under 18 (age.js) starts on points rather than money
  const [playFor, setPlayFor] = useKept('setup:playFor', () => pre?.playFor ?? (moneyOff(getState()) ? { kind: 'points' } : null));

  return {
    editing, pre, mode, setMode, replaces, setReplaces, built, setBuilt, planning, date, setDate, teeTime, setTeeTime, invited, setInvited,
    step, showStep, passDone, setPassDone, reached, setReached, setStep, game, setGame, holesCount, setHolesCount, courseId, setCourseId, nine, setNine, picked, setPicked,
    tees, setTees, hcOverride, setHcOverride, opts, setOpts, useHc, setUseHc, startHole, setStartHole, teams, setTeams, justPlaying, setJustPlaying,
    casualIds, betting, setBetting, sideGames, setSideGames, sidesFor, editSides, createdId, setCreatedId, usual, usualId, setUsualId,
    missing, setMissing, planSides, setPlanSides, lostCourse, setLostCourse, playFor, setPlayFor,
  };
}

/**
 * The two-player side bets made in setup, and the agreed challenges between players picked, shown
 * as side bets of their own (challenges.js). `shownBets` is both; `editBets` changes them.
 */
export function useSetupBets({ state, pre, fromPlan, planning, game, holesCount, nine, courseId, startHole, playFor, betting, teams }) {
  // Two-player side bets (pair-bets.js): this round's only, so Run it back and usuals never bring them back
  // (a round rescheduled or a plan's roll call keeps the ones it was set up with)
  // Stamped with the holes they start on, so changing the course or holes later puts a bet on some
  // of the holes back on the whole round, like one made here (fitSetupBets)
  const [pairBets, setPairBets] = useKept('setup:pairBets', () => structuredClone(pre?.pairBets || []).map(b => ({ ...b, shape: `${holesCount}|${nine}|${courseId ?? ''}|${startHole ?? ''}` })));
  // A change to the holes played puts a bet on some of the holes back on the whole round (fitSetupBets)
  const betShape = `${holesCount}|${nine}|${courseId ?? ''}|${startHole ?? ''}`;
  const setupBets = fitSetupBets(pairBets, betShape);
  // Agreed challenges between two players picked (challenges.js) show up as side bets of their own.
  // One taken off here stays off for this round only; it's still on for the next round together
  const [chOff, setChOff] = useKept('setup:chOff', []);
  const challengeBets = (() => {
    const c = findCourse(state, courseId);
    if (planning || !c || !GAMES[game] || !Object.keys(state.challenges || {}).length) return [];
    const draft = {
      game, holes: holesInPlay(c, holesCount, nine, startHole), playFor, bets: setupBets, betsGone: chOff,
      players: betting.map(pid => ({ id: pid, name: state.players[pid]?.name || '?' })), ...(oneBall(game) && teams ? { teams } : {}),
    };
    return challengesForRound(state, draft, { planId: fromPlan || null, idOf: pre?.idOf || null }).map(f => f.bet);
  })();
  const shownBets = [...setupBets, ...challengeBets];
  const editBets = fn => {
    const next = fn(shownBets);
    const gone = shownBets.filter(b => challengeIdOfBet(b.id) && !next.some(x => x.id === b.id)).map(b => b.id);
    if (gone.length) setChOff(l => [...l, ...gone]);
    setPairBets(next.map(b => ({ ...b, shape: betShape })));
  };
  return { setPairBets, setupBets, shownBets, editBets };
}
