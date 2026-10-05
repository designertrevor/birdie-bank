import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Header, Icon, Numpad, PickChip, PickMark, PickRow, Screen, Segmented, Sheet, Steps, Toggle, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { TimePicker } from '../components/DatePicker.jsx';
import { DEFAULT_SETTINGS, getState, update, uid, useStore } from '../lib/store.js';
import { playFromSearch } from '../lib/rule-links.js';
import { allCourses, coursePar, coursePickerSections, courseTag, defaultTee as firstTee, isStarred, teeDotStyle, toggleStarred } from '../lib/courses.js';
import { getCourse } from '../lib/courseApi.js';
import { useCourseSearch } from '../lib/useCourseSearch.js';
import { useNearbyCourses } from '../lib/useNearbyCourses.js';
import { mergeNear, milesLabel } from '../lib/nearby.js';
import NearYou from '../components/NearYou.jsx';
import RequestCourse from '../components/RequestCourse.jsx';
import { GAMES, GAME_GROUPS, MAX_GAMES, SIDE_GAMES, bettors, createRound, effectiveCourseHc, holesInPlay, isJustPlaying, oneBall, sideGamesOf } from '../lib/round.js';
import { JUST_PLAYING, canJustPlay, cantJustPlay, maxPicked, pickedCheck, pickedLine } from '../lib/just-playing.js';
import { SideGamesSetup } from '../components/SideGames.jsx';
import { PairBetsSetup } from '../components/PairBets.jsx';
import { betsOf, cleanBet, fitSetupBets } from '../lib/pair-bets.js';
import { GameOptions, SixesPreview, TeamPicker } from '../components/GameOptions.jsx';
import { optionsProblem, roundStakeLines, sideBetLine, stakeSummary } from '../lib/stakes.js';
import { syncConfigured } from '../lib/sync.js';
import { ShareSheet } from '../components/Live.jsx';
import { defaultTeams, teamsProblem } from '../lib/teams.js';
import { rematchSetup } from '../lib/rematch.js';
import { halfStrokesOffered, pctsDiffer } from '../lib/allowances.js';
import { StrokesSetup } from '../components/StrokesSetup.jsx';
import { useNav } from '../lib/nav.js';
import { useKept } from '../lib/kept.js';
import { nowMs, setupBack } from '../lib/setup-back.js';
import { addRound, holesScored, leaveRound, roundsInProgress, usualRound } from '../lib/rounds.js';
import { formatIndex, gameLabel, hcPctLabel, playerLabel, sortedPlayers } from '../lib/format.js';
import { money } from '../lib/golf.js';
import { findCourse } from '../lib/courses.js';
import { BET_LADDER, MAX_BALLOT_GAMES, betChoices, betLabel, betOf, betUnitLabel, dayChoices, isoDate, newPlan, planStart } from '../lib/plans.js';
import { rescheduleSetup, setupForPlan } from '../lib/plan-setup.js';
import { PLAN_LOCKED, editPlan } from '../lib/plan-sync.js';
import { rebookIfMoved } from '../lib/tee-reminders.js';
import { shouldShowPaywall } from '../lib/paywall.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { matchingUsual, planFromUsual, setupFromUsual, usualsOf } from '../lib/usuals.js';
import { SaveUsualButton, UsualsList } from '../components/Usuals.jsx';
import PlayForPicker from '../components/PlayFor.jsx';
import { useAgeCheck } from '../components/AgeCheck.jsx';
import { moneyOff, needsAgeCheck } from '../lib/age.js';
import { countsMoney, inUnits, padUnit, playForLine, playForShort } from '../lib/play-for.js';
import { CountForTrip, StartTripLink } from '../components/Trips.jsx';
import { CupRoundSetup } from '../components/Cup.jsx';
import { startingCup } from '../lib/cup-store.js';
import { planCupFor, scheduledCupFor, withSessionWorth } from '../lib/trip-templates.js';
import { FOURSOMES_GAME, cleanRoundCup, cupCounts, cupOf } from '../lib/cup.js';
import { countsByDefault, tripOf, tripOnDay, tripPlanDay, tripStamp } from '../lib/trips.js';
import { challengeIdOfBet, challengesForRound, movedFromFor } from '../lib/challenges.js';
import { challengesBack, markChallengesOn } from '../lib/challenge-sync.js';

const STEPS = ['Game', 'Course', 'Players', 'Bets'];

/** Setup options with an earlier round's bets and handicap percentage laid over them. */
function withBets(opts, pre) {
  if (!pre) return opts;
  return { ...opts, ...(pre.bets ? { [pre.game]: structuredClone(pre.bets) } : {}), hcPct: pre.hcPct ?? opts.hcPct, halfStrokes: !!pre.halfStrokes };
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
  // The tees, handicap edits, starting hole and side bets the plan kept from its setup (plan-setup.js)
  const tees = Object.fromEntries(s.players.filter(p => p.tee).map(p => [p.id, p.tee]));
  const hcOverride = Object.fromEntries(s.players.filter(p => p.courseHcOverride != null).map(p => [p.id, p.courseHcOverride]));
  return {
    game: s.game, holesCount: s.holesCount, courseId: course?.id ?? null, nine: s.nine, picked, missing: [], tees, hcOverride,
    bets: structuredClone(s.settings[s.game]), hcPct: s.hcPct, useHc: s.useHandicaps, teams: s.teams, sideGames: s.sideGames, halfStrokes: s.halfStrokes,
    startHole: s.startHole, pairBets: s.bets,
    usualId: plan.usualId ?? null,
    playFor: s.playFor,
    // Who each person on the plan is here, so the plan's agreed challenges come in as side bets
    idOf: s.idOf,
    step: !course ? 1 : picked.length < g.min || picked.length > g.max ? 2 : 3,
  };
}

/**
 * `edit`: change a planned round's day, tee time, course or holes (only the When step shows).
 * `ahead`: plan it for later. `game` and `ballot`: a game already picked and other games to put
 * up for a vote (from organizer onboarding). `onboarding`: this is the end of organizer onboarding,
 * so finishing lands on the plan with the paywall on top (when it's on), and cancelling drops
 * back to whatever is underneath. `reschedule`: a round set up but not played yet, turned into a
 * plan with the same setup (the round goes once the plan is made). `trip`: started from a trip's
 * page, so it counts for that trip.
 */
export default function NewRound({ rematch, fromPlan, present, edit = null, ahead = false, game: gameIn = null, play = null, ballot = [], onboarding = false, reschedule = null, trip: tripId = null }) {
  const nav = useNav();
  const { ask, showToast } = useUI();
  const checkAge = useAgeCheck();
  const state = useStore();
  // "Play this now" on a rule page (?play=wolf): that game picked, or a side-only game added
  const fromPlay = play ? playFromSearch(`play=${encodeURIComponent(play)}`) : null;
  const preGame = gameIn ?? fromPlay?.game ?? null;
  const preSide = fromPlay?.side ?? null;
  // "Run it back" opens setup already filled in like an earlier round
  const [editing] = useState(() => (edit ? getState().plans?.[edit] || null : null));
  const [pre] = useState(() => (editing ? { game: editing.game, holesCount: editing.holesCount, courseId: findCourse(getState(), editing.course?.id)?.id ?? null, nine: editing.nine, step: 1 }
    : rematch ? rematchSetup(getState(), getState().rounds[rematch])
      : reschedule ? rescheduleSetup(getState(), getState().rounds[reschedule])
        : fromPlan ? planSetup(getState(), fromPlan, present) : null));
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
  const [step, showStep] = useKept('setup:step', pre?.step ?? (ahead && GAMES[preGame] ? 1 : 0));
  // The furthest step reached, so a tap on the step bar can go forward again after going back
  const [reached, setReached] = useKept('setup:reached', () => (reschedule && pre?.step ? 3 : pre?.step ?? (ahead && GAMES[preGame] ? 1 : 0)));
  const setStep = n => { showStep(n); setReached(r => Math.max(r, n)); };
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
  const [game, setGame] = useKept('setup:game', pre?.game ?? (GAMES[preGame] ? preGame : null));
  const [holesCount, setHolesCount] = useKept('setup:holesCount', pre?.holesCount ?? (GAMES[preGame]?.holes.includes(18) === false ? GAMES[preGame].holes[0] : 18));
  const [courseId, setCourseId] = useKept('setup:courseId', pre?.courseId ?? null);
  const [nine, setNine] = useKept('setup:nine', pre?.nine ?? 'front');
  const [picked, setPicked] = useKept('setup:picked', () => pre?.picked ?? (state.me ? [state.me] : []));
  const [tees, setTees] = useKept('setup:tees', pre?.tees ?? {});          // pid -> tee name
  const [hcOverride, setHcOverride] = useKept('setup:hcOverride', pre?.hcOverride ?? {}); // pid -> number
  const [opts, setOpts] = useKept('setup:opts', () => withBets(structuredClone(state.settings), pre));
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

  const course = findCourse(state, courseId);
  // "Count it for the trip?": a trip on the round's day (or the trip it was started from). Yes by
  // default when trip people are in it; the plan's own trip when it came from a planned round
  const fromPlanTrip = fromPlan ? state.plans?.[fromPlan]?.trip : null;
  const tripOn = tripId ? tripOf(state, tripId) : fromPlanTrip ? tripOf(state, fromPlanTrip.id) : tripOnDay(state, planning ? date : isoDate());
  const [countTrip, setCountTrip] = useKept('setup:countTrip', null); // null until changed: the default
  const countOn = countTrip ?? (!!tripOn && (!!tripId || !!fromPlanTrip || countsByDefault(state, tripOn.id, planning ? [state.me, ...invited] : picked)));
  const tripPick = tripOn && countOn ? tripOn : null;
  // A team points trip: the round's matches from the trip's teams, changeable here (cup.js)
  const [cupPick, setCupPick] = useKept('setup:cupPick', null); // { sig, cup } once changed
  const cupPlayers = betting.map(pid => state.players[pid]).filter(Boolean).map(p => ({ id: p.id, name: p.name }));
  const cupSig = `${game}|${betting.join(',')}|${tripPick?.id || ''}`;
  const tripCup = !planning && tripPick ? cupOf(tripPick) : null;
  // Foursomes (an Alternate shot round): the match is the round's two teams, so its partners are the teams
  const foursomes = !!tripCup && game === FOURSOMES_GAME;
  // From a round the trip's schedule planned (trip-templates.js): its group's matches, while they fit
  const planCup = tripCup && fromPlan ? planCupFor(state.plans?.[fromPlan], cupPlayers) : null;
  const fromSession = fromPlan ? state.plans?.[fromPlan]?.session || null : null;
  // Else a group of the trip's schedule today, from the trip's teams (a friend's group teeing off on their own phone)
  const schedHit = tripCup && !planCup && !(fromSession?.trip === tripPick.id) ? scheduledCupFor(state, tripPick, cupPlayers, { date: isoDate(), game, hour: new Date().getHours() }) : null;
  const cupStart = tripCup ? planCup || schedHit?.cup || withSessionWorth(startingCup(state, { game, players: cupPlayers }, tripPick), fromSession, tripPick.id) : null;
  const cupPairs = c => (c && c.sides.every(x => x.length === 2) && c.sides.flat().length === betting.length && c.sides.flat().every(pid => betting.includes(pid)) ? c.sides.map(x => [...x]) : null);
  const roundCup = !tripCup ? null
    : foursomes ? (teams ? cleanRoundCup({ game, players: cupPlayers, teams: teams.map(t => ({ players: t })), cup: cupStart || { kind: 'foursomes', sides: [[], []] } }) : cupStart) || { kind: 'foursomes', sides: [[], []] }
    : cupPick?.sig === cupSig ? cleanRoundCup({ game, players: cupPlayers, cup: cupPick.cup })
    : cupStart || (!cupCounts(game) ? { kind: 'singles', sides: [[], []] } : null);
  const onCup = c => {
    if (!foursomes) return setCupPick({ sig: cupSig, cup: c });
    const pairs = cupPairs(c);
    if (pairs) setTeams(pairs);
  };
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
    if (i > reached || !game || !course) return false;
    if (planning) return true;
    return i < 3 || pickedCheck(game, picked, casualIds).valid;
  };
  const goTo = i => {
    if (!canGo(i)) return;
    if (planning && i === 0 && !ahead && !replaces) { setMode('round'); setReached(0); }
    if (!planning && i === 3) return toBets();
    setStep(i);
  };

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
      if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6);
      if (replaces && st.rounds[replaces]) { delete st.rounds[replaces]; leaveRound(st, replaces); }
    });
    const paywall = onboarding && shouldShowPaywall(getState(), PAYWALL_ON) ? [['paywall', { source: 'onboarding' }]] : [];
    nav.reset('upnext', ['plan', { id }], ...paywall);
  };

  // Save the changed day, time, course or holes on the plan; a shared plan sends them to the group
  const savePlan = () => {
    editPlan(editing.id, p => {
      // A tee time booked for the old day or course comes off (tee-reminders.js)
      rebookIfMoved(p, { date, courseId: course.id });
      p.date = date;
      p.teeTime = teeTime || null;
      p.holesCount = holesCount;
      p.nine = nine || 'front';
      p.course = { id: course.id, name: course.name, city: course.city || null };
    }).then(r => { if (r === 'taken') showToast(PLAN_LOCKED); });
    update(st => { if (!st.favorites.includes(course.id)) st.favorites = [course.id, ...st.favorites].slice(0, 6); });
    showToast(editing.code ? 'Plan updated. Everyone with the link sees the change.' : 'Plan updated');
    nav.pop();
  };

  // A round already in progress is never touched: it stays saved and you can switch back to it
  const start = async () => {
    const s = getState();
    // Only the betting players' handicaps matter: someone just playing gets no strokes
    const noHc = useHc && game !== 'bbb' ? betting.filter(pid => s.players[pid]?.index == null && hcOverride[pid] == null) : [];
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
    const players = orderedPicked.map(pid => ({ ...s.players[pid], tee: tees[pid] || defaultTee, courseHcOverride: hcOverride[pid] }));
    // Share-image choice and the side bet card are personal settings, not part of a round's bets
    // Half strokes are this round's choice, never next time's default
    const { shareAmounts: _personal, betPrompt: _prompt, halfStrokes: _half, ...settings } = structuredClone(opts);
    const sides = sidesFor(game);
    const halfStrokes = !!opts.halfStrokes && halfStrokesOffered(game, sides);
    const round = createRound({
      id, game, course, holesCount, nine, startHole, players, settings, hcPct: opts.hcPct, useHandicaps: useHc && !(noHc.length && noHc.length === betting.length),
      teams: GAMES[game].teams ? teams : null, halfStrokes, justPlaying: casualIds,
    });
    if (sides.length) round.sideGames = structuredClone(sides);
    if (playFor) round.playFor = structuredClone(playFor);
    // Side bets whose two players are both still in the round (setup's list can outlive a change of players),
    // agreed challenges among them
    const bets = betsOf({ ...round, bets: shownBets }).map(b => cleanBet(round, b));
    if (bets.length) round.bets = bets;
    const challengesIn = bets.map(b => challengeIdOfBet(b.id)).filter(Boolean);
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
    // Counted for the trip: the stamp rides in the round to every phone in it (trips.js)
    if (tripPick) round.trip = tripStamp(tripPick);
    // Its matches for a team points trip, as set up here (a scramble or Chapman has none: one ball a
    // team; alternate shot is foursomes between its two teams)
    if (tripCup && roundCup && cupCounts(game)) {
      const c = cleanRoundCup({ game, players: round.players, teams: round.teams, cup: withSessionWorth(roundCup, (fromSession?.trip === tripPick.id ? fromSession : schedHit?.session) || null, tripPick.id) });
      if (c) round.cup = c;
    }
    // A round the trip's schedule planned keeps its place in it (trip-templates.js)
    const planSession = fromPlan ? s.plans?.[fromPlan]?.session : null;
    if (tripPick && planSession?.trip === tripPick.id) round.session = structuredClone(planSession);
    else if (tripPick && schedHit && round.cup) round.session = structuredClone(schedHit.session);
    // Started from a saved usual (still the same game at the same course): finishing it updates "Last played"
    const from = usualId && usualsOf(s).find(u => u.id === usualId);
    if (from && from.game === game && (from.courseId === course.id || findCourse(s, from.courseId)?.id === course.id)) round.usualId = usualId;
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
    setCreatedId(id);
    setStep(4);
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
  const created = createdId ? state.rounds[createdId] : null;

  const defaultTee = firstTee(course)?.name || null;
  const orderedPicked = picked;
  const g = game ? GAMES[game] : null;

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
      {step === 0 && <GameStep usual={planning || (usual && matchingUsual(state, usual.round)) ? null : usual} onUsual={repeatUsual} onPickUsual={planning ? planUsual : pickUsual} planning={planning} onPlan={fromPlan ? null : () => { setMode('plan'); setBuilt(false); setReached(0); setStep(1); }} game={game} setGame={gm => { setGame(gm); if (gm && !GAMES[gm].holes.includes(holesCount)) setHolesCount(GAMES[gm].holes[0]); }} holesCount={holesCount} setHolesCount={setHolesCount} onNext={() => setStep(1)} />}
      {step === 1 && planning && (
        <CourseStep editor={editor} openEditor={openEditor} closeEditor={closeEditor} courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={editing ? savePlan : () => setStep(2)}
          nextLabel={editing ? 'Save changes' : 'Next: Who’s invited'} nextIcon={editing ? 'check' : 'arrow-right'}
          top={<>
            <WhenPicker date={date} setDate={setDate} teeTime={teeTime} setTeeTime={setTeeTime} />
            <HolesPicker game={g} holesCount={holesCount} setHolesCount={setHolesCount} />
            <p className="field-help pad">{course ? 'The course is picked below. Change it if you need to.' : 'Then pick the course below.'}</p>
          </>} />
      )}
      {step === 2 && planning && course && <InviteStep invited={invited} setInvited={setInvited} onNext={() => setStep(3)} />}
      {step === 3 && planning && course && <VoteStep game={game} holesCount={holesCount} opts={opts} onPlan={makePlan} ballot={ballot} initialSides={planSides.length ? planSides : sidesFor(game).map(sg => sg.game)} playFor={playFor} setPlayFor={setPlayFor} tripRow={tripRow} />}
      {step === 1 && !planning && <CourseStep editor={editor} openEditor={openEditor} closeEditor={closeEditor} courseId={courseId} setCourseId={id => { setCourseId(id); setTees({}); setStartHole(null); }} holesCount={holesCount} nine={nine} setNine={setNine} onNext={() => setStep(2)} />}
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

// ---------------------------------------------------------------------------

function GameStep({ usual, onUsual, onPickUsual, planning, onPlan, game, setGame, holesCount, setHolesCount, onNext }) {
  const nav = useNav();
  const [rules, setRules] = useState(null);
  const g = game && GAMES[game];
  const u = usual?.round;
  return (
    <>
      <div className="scroll">
        {onPickUsual && <UsualsList onPick={onPickUsual} />}
        {u && (
          <button className="usual-card" onClick={onUsual}>
            <span className="eyebrow">Your usual</span>
            <span className="uc-title d">{gameLabel(u)} · {usual.course.name}</span>
            <span className="uc-sub">{u.players.map(p => p.name.split(' ')[0]).join(', ')} · {u.holesCount} holes · {roundStakeLines(u, { since: false }).map(l => l.line).join(' + ')}</span>
            <span className="uc-btn"><Icon name="arrow-counter-clockwise" /> Set it up again</span>
          </button>
        )}
        {GAME_GROUPS.map(group => (
          <div key={group}>
            <div className="sec-label">{group}</div>
            {Object.entries(GAMES).filter(([, info]) => info.group === group).map(([key, info]) => (
              <div key={key} className={`game-row ${game === key ? 'selected' : ''}`} role="radio" aria-checked={game === key} tabIndex={0} aria-label={`${info.name}: ${info.players}, ${info.blurb}`}
                onClick={() => setGame(game === key ? null : key)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setGame(game === key ? null : key)}>
                <div className="game-icon"><Icon name={info.icon} fill /></div>
                <div className="row-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="gn">{info.name}</div>
                    <button className="rules-chip" onClick={e => { e.stopPropagation(); setRules(key); }} aria-label={`${info.name} rules`}><Icon name="info" /> Rules</button>
                  </div>
                  <div className="gs">{info.players} · {info.blurb}</div>
                </div>
                <PickMark on={game === key} add={false} />
              </div>
            ))}
          </div>
        ))}
        {/* More than one group (8 to 20 players): one game across every group (BigGameSetup.jsx) */}
        {!planning && (
          <button className="quiet-row" onClick={() => nav.push('bigGameSetup')}>
            <Icon name="users-four" /> <span>More than one group? <u>Set up a Big Game</u></span>
          </button>
        )}
        <button className="quiet-row" onClick={() => nav.push('suggest', { kind: 'game' })}>
          <Icon name="chat-circle-dots" /> <span>Don’t see your game? <u>Tell us how it’s played</u></span>
        </button>
        {!planning && <HolesPicker game={g} holesCount={holesCount} setHolesCount={setHolesCount} />}
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

// The course editor opens over setup instead of as its own screen, so the game, holes and anything
// else already picked stay put (only the top screen is mounted). Loaded with Settings on first use.
const CourseEdit = lazy(() => import('./Settings.jsx').then(m => ({ default: m.CourseEdit })));

export function CourseStep({ editor, openEditor, closeEditor, courseId, setCourseId, holesCount, nine, setNine, onNext, top = null, nextLabel = 'Next: Players', nextIcon = 'arrow-right' }) {
  const state = useStore();
  const [q, setQ] = useState('');
  const courses = allCourses(state);
  const needle = q.trim().toLowerCase();
  // Starred, then recently played, then the rest; a search shows only what matches
  const sections = coursePickerSections(state, needle);
  const { starred, recentLabel, hint } = sections;
  // Near you sits under Favorites: saved courses show as usual rows, new ones as "add" rows.
  // A course only shows once, so near ones leave Recent and All courses.
  const near = useNearbyCourses();
  const starredIds = new Set(starred.map(c => c.id));
  const nearRows = needle || !near.pos ? [] : mergeNear(near.courses, courses, near.pos).filter(x => !x.c || !starredIds.has(x.c.id));
  const nearMiles = new Map(nearRows.filter(x => x.c).map(x => [x.c.id, x.miles]));
  const recent = sections.recent.filter(c => !nearMiles.has(c.id));
  const rest = needle ? sections.all : sections.all.filter(c => !nearMiles.has(c.id));
  const matches = needle ? rest : courses;
  // Starring moves the row to another section, so a short toast says where it went
  const star = c => {
    const was = isStarred(state, c);
    update(s => { s.starredCourses = toggleStarred(s, c.id); });
    if (!needle) showToast(was ? `${c.name} taken off Favorites` : `${c.name} added to Favorites`);
  };
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
    <button key={r.apiId} className="list-item pick" onClick={() => pickApi(r)} aria-busy={loadingId === r.apiId} aria-label={[`Add ${r.name}`, r.miles != null ? `${milesLabel(r.miles)} away` : null, r.city, r.teeCount ? teeCount(r.teeCount) : null].filter(Boolean).join(', ')}>
      <div className="row-main">
        <div className="li-name">{r.name}</div>
        <div className="li-sub">{[r.miles != null ? milesLabel(r.miles) : null, r.city, r.teeCount ? teeCount(r.teeCount) : null].filter(Boolean).join(' · ')}</div>
      </div>
      <PickMark busy={loadingId === r.apiId} />
    </button>
  );

  // The row picks the course, tap again to unselect; the star is its own button and never picks it
  const row = c => {
    const on = isStarred(state, c);
    const picked = c.id === courseId;
    return (
      <div key={c.id} className={`list-item pick course-row ${picked ? 'on' : ''}`} onClick={() => setCourseId(picked ? null : c.id)}>
        <button className="course-pick" aria-pressed={picked}
          aria-label={[c.name, nearMiles.has(c.id) ? `${milesLabel(nearMiles.get(c.id))} away` : null, c.city, `${c.holes.length} holes`, `par ${coursePar(c)}`, teeCount(c.tees?.length || 0), courseTag(c)?.text].filter(Boolean).join(', ')}>
          <div className="li-name">{c.name}</div>
          <div className="li-sub">{[nearMiles.has(c.id) ? milesLabel(nearMiles.get(c.id)) : null, c.city, `${c.holes.length} holes`, `Par ${coursePar(c)}`, teeCount(c.tees?.length || 0)].filter(Boolean).join(' · ')}</div>
          {courseTag(c) && <div className={`warn-tag ${courseTag(c).soft ? 'soft' : ''}`}><Icon name={courseTag(c).soft ? 'database' : 'warning'} fill /> {courseTag(c).text}</div>}
        </button>
        <button className={`course-star ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Favorite ${c.name}`} onClick={e => { e.stopPropagation(); star(c); }}>
          <Icon name="star" fill={on} />
        </button>
        <PickMark on={picked} add={false} />
      </div>
    );
  };

  return (
    <>
      <div className="scroll">
        {top}
        <div style={{ padding: '4px 16px 8px' }}>
          <label className="sr-only" htmlFor="course-q">Search courses</label>
          <input id="course-q" className="search-box" type="search" placeholder="Search courses or cities" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {starred.length > 0 && <><div className="sec-label">Favorites</div><div style={{ padding: '0 16px' }}>{starred.map(row)}</div></>}
        {hint && <p className="course-star-hint"><Icon name="star" /> Tap the star to keep a course at the top</p>}
        {!needle && <NearYou near={near} count={nearRows.length}>{nearRows.map(x => (x.c ? row(x.c) : apiRow({ ...x.r, miles: x.miles })))}</NearYou>}
        {recent.length > 0 && <><div className="sec-label">{recentLabel}</div><div style={{ padding: '0 16px' }}>{recent.map(row)}</div></>}
        {rest.length > 0 && <><div className="sec-label">{needle ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All courses'}</div><div style={{ padding: '0 16px' }}>{rest.map(row)}</div></>}
        {needle && more.length > 0 && <><div className="sec-label">More courses{api.loading ? ' · searching' : ''}</div><div style={{ padding: '0 16px' }}>{more.map(apiRow)}</div></>}
        {matches.length === 0 && more.length === 0 && !api.loading && <RequestCourse query={q} onAddYourself={openEditor} />}
        <button className="add-row" aria-label="Add a course" onClick={() => openEditor({})}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a course</span></button>
        {course && holesCount === 9 && course.holes.length === 18 && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Which nine?</div>
            <Segmented label="Which nine" value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
          </div>
        )}
        {tooShort && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!course} onClick={onNext}>{course ? <>{nextLabel} <Icon name={nextIcon} /></> : 'Pick a course'}</button>
      </div>
      {editor && (
        <Suspense fallback={<div className="screen active" aria-busy="true" />}>
          <CourseEdit prefill={editor} onDone={id => {
            closeEditor();
            // A saved course is picked for this round straight away
            if (id) { setCourseId(id); setQ(''); }
          }} />
        </Suspense>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function PlayersStep({ game, gameKey, course, holesCount, nine, picked, setPicked, tees, setTees, hcOverride, setHcOverride, justPlaying = [], setJustPlaying, useHc, setUseHc, noHandicaps = false, onNext }) {
  const state = useStore();
  const { showToast } = useUI();
  const players = sortedPlayers(state);
  const crews = Object.values(state.crews);
  const [adding, setAdding] = useState(false);
  const [hcFor, setHcFor] = useState(null);
  const holes = useMemo(() => holesInPlay(course, holesCount, nine), [course, holesCount, nine]);
  // Past the game's own cap when the extra people can be just playing (just-playing.js)
  const most = maxPicked(gameKey);
  const casualOk = canJustPlay(gameKey);
  const toggleCasual = pid => setJustPlaying(l => (l.includes(pid) ? l.filter(x => x !== pid) : [...l, pid]));

  const toggle = pid => setPicked(p => {
    if (p.includes(pid)) return p.filter(x => x !== pid);
    // Past the game's own cap the extra people are just playing, so the cap is the round's, not the game's
    if (p.length >= most) { showToast(most > game.max ? `A round is for up to ${most} players` : `${game.name} takes up to ${most} players`); return p; }
    return [...p, pid];
  });
  const pickCrew = c => {
    const ids = c.playerIds.filter(id => state.players[id]);
    const merged = [...new Set([...picked, ...ids])];
    if (merged.length > most) { showToast(game.min === game.max && most === game.max ? `${game.name} is for exactly ${game.max}. Remove someone first` : most > game.max ? `A round is for up to ${most} players. Remove someone first` : `${game.name} takes up to ${most} players. Remove someone first`); return; }
    setPicked(merged);
  };
  const check = pickedCheck(gameKey, picked, justPlaying);
  const valid = check.valid;
  const needText = check.text;

  const showHc = useHc && !noHandicaps;
  // Someone just playing gets no strokes, so their handicap never matters
  const noHc = showHc ? picked.filter(pid => !justPlaying.includes(pid) && courseHc(pid).source === 'none') : [];
  const bettingCount = picked.length - justPlaying.length;
  function courseHc(pid) {
    const p = state.players[pid];
    const tee = course.tees?.find(t => t.name === (tees[pid] || firstTee(course)?.name));
    return effectiveCourseHc(p.index, tee, course, holes, holesCount, hcOverride[pid]);
  }

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
        {!noHandicaps && (
          <div className="block hc-choice">
            <div className="eyebrow" id="hc-q" style={{ marginBottom: 10 }}>Play with handicaps?</div>
            <Segmented label="Play with handicaps" value={useHc ? 'on' : 'off'} onChange={v => setUseHc(v === 'on')}
              options={[{ value: 'off', label: 'No, play even' }, { value: 'on', label: 'Yes' }]} />
            <p className="field-help">{useHc ? 'Better players give strokes on the hardest holes. Check each handicap below.' : 'Everyone plays straight up, no strokes.'}</p>
          </div>
        )}
        <div className="sec-label">Players · {pickedLine(gameKey, picked, justPlaying)}</div>
        {casualOk ? (
          picked.length > 1 && <p className="field-help pad jp-step-help">Someone not up for a bet? Mark them <strong>{JUST_PLAYING}</strong>. They’re on the card with everyone and out of every game.</p>
        ) : cantJustPlay(gameKey) && <p className="field-help pad jp-step-help">{cantJustPlay(gameKey)}</p>}
        <div className="pick-list">
          {players.map(p => {
            const on = picked.includes(p.id);
            const casual = on && justPlaying.includes(p.id);
            const hc = on ? courseHc(p.id) : null;
            const hcNote = hc && { set: ' · edited', index: ' · from index', none: ' · none, plays as 0', whs: '' }[hc.source];
            return (
              <div key={p.id} className={`list-item pick player-pick ${on ? 'on' : ''}`}>
                <button className="pick-main" onClick={() => toggle(p.id)} aria-pressed={on}>
                  <div className="row-main">
                    <div className="li-name">{playerLabel(p, state.me)}</div>
                    <div className="li-sub">{casual ? JUST_PLAYING : p.index == null ? 'No handicap index' : `Index ${formatIndex(p.index)}`}</div>
                  </div>
                  <PickMark on={on} />
                </button>
                {on && (
                  <div className="pick-extra">
                    {course.tees?.length > 0 && (
                      <div className="tee-chips" role="radiogroup" aria-label={`${p.name}’s tee`}>
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
                    {/* Out of every bet: a selection chip like the tee's, filled with a check when it's on */}
                    {casualOk && (bettingCount > 1 || casual) && (
                      <PickChip small className="jp-chip" icon="smiley" on={casual} onClick={() => toggleCasual(p.id)}>{JUST_PLAYING}</PickChip>
                    )}
                    {showHc && !casual && <button className={`hc-chip ${hc.source === 'none' ? 'missing' : ''}`} onClick={() => setHcFor(p.id)}
                      aria-label={`${p.name}’s ${holesCount === 9 ? '9-hole handicap' : 'course handicap'}: ${hc.value < 0 ? `+${-hc.value}` : hc.value}${hcNote ? hcNote.replace(' · ', ', ') : ''}. Change it`}>
                      {holesCount === 9 ? '9-hole handicap' : 'Course handicap'} <strong>{hc.value < 0 ? `+${-hc.value}` : hc.value}</strong>{hcNote} <Icon name="pencil-simple" />
                    </button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="add-row" aria-label="Add a player" onClick={() => setAdding(true)}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a player</span></button>
        {noHc.length > 0 && (
          <p className="hint-card warn"><Icon name="warning" fill /> {noHc.length === picked.length
            ? 'Nobody has a handicap yet, so nobody gets strokes. Tap a course handicap to set it.'
            : `${listNames(noHc.map(pid => state.players[pid]?.name || '?'))} ${noHc.length === 1 ? 'has' : 'have'} no handicap, so they play as scratch (0) and everyone else gets strokes from them. Tap a course handicap to set it.`}</p>
        )}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={!valid} onClick={onNext}>{valid ? <>Next: Bets <Icon name="arrow-right" /></> : needText}</button>
      </div>
      <QuickAddPlayer open={adding} onClose={() => setAdding(false)} onAdded={pid => { setAdding(false); if (picked.length < most) setPicked([...picked, pid]); }} />
      <Numpad open={!!hcFor} title={`${state.players[hcFor]?.name}’s ${holesCount === 9 ? '9-hole ' : ''}course handicap`} initial={hcFor ? courseHc(hcFor).value : ''} allowNegative min={-10} max={60}
        onClose={() => setHcFor(null)} onDone={v => { setHcOverride({ ...hcOverride, [hcFor]: v }); setHcFor(null); }} />
    </>
  );
}

export function QuickAddPlayer({ open, onClose, onAdded }) {
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
          <input id="qa-name" className="name-input" value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Name" autoFocus
            aria-invalid={dup || undefined} aria-describedby={dup ? 'qa-name-err' : undefined} />
          {dup && <p className="field-error" id="qa-name-err" role="status">Someone already has that name. Add an initial.</p>}
          <div className="field-label">Handicap index <span className="opt">optional</span></div>
          <button className="amt-btn" onClick={() => setPad(true)} aria-label={index == null ? 'Handicap index: add one' : `Handicap index ${formatIndex(index)}. Change it`}>{index == null ? 'Add' : formatIndex(index)}</button>
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

/** "Dave and Mike’s challenge is in as a side bet." for the challenges setup brought in. */
function challengeNote(round, bets) {
  const name = id => (round.players.find(p => p.id === id)?.name || '?').split(' ')[0];
  const pairs = bets.filter(b => challengeIdOfBet(b.id) && b.sides.every(id => round.players.some(p => p.id === id))).map(b => `${name(b.sides[0])} and ${name(b.sides[1])}’s`);
  if (!pairs.length) return '';
  const who = pairs.length === 1 ? pairs[0] : `${pairs.slice(0, -1).join(', ')} and ${pairs.at(-1)}`;
  return pairs.length === 1 ? `${who} challenge is in as a side bet. Tap it to change it, or take it off for today.`
    : `${who} challenges are in as side bets. Tap one to change it, or take it off for today.`;
}

function SetupStep({ game, course, holesCount, nine, picked, setPicked, casual = [], opts, setOpts, useHc, setUseHc, startHole, setStartHole, onStart, onLater = null, teams, setTeams, sideGames = [], setSideGames, playFor = null, setPlayFor,
  tees = {}, hcOverride = {}, defaultTee = null, pairBets = [], setPairBets, tripRow = null, tripLink = null }) {
  const state = useStore();
  const [pad, setPad] = useState(null); // {path, title, min, max}
  const [holePick, setHolePick] = useState(false);
  const [more, setMore] = useState(false);
  const holes = holesInPlay(course, holesCount, nine);
  const firstHole = startHole ?? holes[0].no;
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], opts);
  const move = (i, d) => setPicked(p => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const optsBad = !!optionsProblem(game, opts) || sideGames.some(sg => optionsProblem(sg.game, { [sg.game]: sg.settings }));
  const names = Object.fromEntries(picked.map(pid => [pid, state.players[pid]?.name || '?']));
  const teamsBad = !!teamsProblem(game, teams, picked);
  // A round-shaped draft for the side bets: the players picked (with course handicaps, for the
  // strokes it suggests) and the holes in play
  const betRound = useMemo(() => {
    const inPlay = holesInPlay(course, holesCount, nine, startHole);
    const players = picked.map(pid => {
      const p = state.players[pid] || {};
      const tee = course.tees?.find(t => t.name === (tees[pid] || defaultTee)) || course.tees?.[0] || null;
      return { id: pid, name: p.name || '?', index: p.index ?? null, courseHcOverride: hcOverride[pid] ?? null, courseHc: effectiveCourseHc(p.index, tee, course, inPlay, holesCount, hcOverride[pid]).value };
    });
    // A one-ball game's teams (arrays of player ids here), so a match or per-hole bet goes between players on different teams
    return { game, players, holes: inPlay, playFor, ...(oneBall(game) && teams ? { teams } : {}) };
  }, [course, holesCount, nine, startHole, picked, state.players, tees, defaultTee, hcOverride, game, playFor, teams]);
  // Best two only counts with teams of three or four (createRound sets a pairs round back to best ball),
  // so the bet line up top says how it will be played
  const shownOpts = (game === 'bestball' || game === 'shamble') && opts[game]?.count === 2 && teams?.length && Math.min(...teams.map(t => t.length)) < 3
    ? { ...opts, [game]: { ...opts[game], count: 1 } } : opts;
  const orderLabel = { wolf: 'Tee order: the wolf moves down this list', banker: 'Playing order', sixes: 'Order: sets who partners who' }[game] || 'Playing order';

  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">{gameLabel({ game, sideGames })} · {holesCount} holes</div>
          <div className="d stake-big">{inUnits({ playFor }, stakeSummary(game, shownOpts, holesCount))}</div>
          {sideGames.length > 0 && <div className="li-sub">{roundStakeLines({ game, settings: shownOpts, sideGames, playFor }).slice(1).map(l => l.line).join(' + ')}</div>}
          {playForLine({ playFor }) && <div className="li-sub">{playForLine({ playFor })}</div>}
          <div className="li-sub">{course.name}{holesCount === 9 && course.holes.length === 18 ? ` · ${nine === 'front' ? 'Front' : 'Back'} 9` : ''} · Par {holes.reduce((a, h) => a + h.par, 0)} · {picked.length} players{casual.length ? ` + ${casual.length} just playing` : ''}</div>
        </div>
        {casual.length > 0 && (
          <p className="hint-card jp-setup-note"><Icon name="smiley" fill /> {listNames(casual.map(pid => state.players[pid]?.name || '?'))} {casual.length === 1 ? 'is' : 'are'} just playing: on the card, out of the bets below.</p>
        )}

        {/* Play for first, so the bets below are read the right way. Side games follow the round's choice */}
        <PlayForPicker value={playFor} onChange={setPlayFor} />

        {GAMES[game].teams && teams && (
          <>
            <div className="sec-label">{game === 'nassau' || game === 'hammer' ? 'Sides' : 'Teams'}</div>
            {GAMES[game].teams.even && <p className="field-help" style={{ padding: '0 20px' }}>Two teams the same size: 2 v 2, 3 v 3 or 4 v 4.</p>}
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
          players={picked.length || null} firstName={game === 'banker' ? state.players[picked[0]]?.name : null} inPoints={!countsMoney({ playFor })}
          teamSize={teams?.length ? Math.min(...teams.map(t => t.length)) : null} />

        <SideGamesSetup game={game} sideGames={sideGames} setSideGames={setSideGames} defaults={opts} players={picked.length || 4} playFor={playFor} holes={holes} holesCount={holesCount} />

        {setPairBets && pairBets.some(b => challengeIdOfBet(b.id)) && (
          <p className="hint-card ch-setup-note"><Icon name="sword" fill /> {challengeNote(betRound, pairBets)}</p>
        )}
        {setPairBets && <PairBetsSetup round={betRound} bets={pairBets} setBets={setPairBets} />}

        <button className="set-row more-opts" onClick={() => setMore(!more)} aria-expanded={more}>
          <div className="row-main">
            <div className="set-name">More options</div>
            <div className="set-sub">{game === 'bbb' ? '' : useHc ? `Handicaps on (${pctsDiffer({ hcPct: opts.hcPct, sideGames }) ? 'set by game' : hcPctLabel(opts.hcPct).toLowerCase()}${opts.halfStrokes && halfStrokesOffered(game, sideGames) ? ', half strokes' : ''}) · ` : 'Handicaps off · '}Start on hole {firstHole}</div>
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
        {useHc && <StrokesSetup game={game} teams={teams} players={picked.length} opts={opts} set={set} sideGames={sideGames} setSideGames={setSideGames} />}
        </>}

        <div className="sec-label">Starting hole</div>
        <div className="block">
          <button className="hole-pick-btn" onClick={() => setHolePick(true)} aria-label="Starting hole">
            <span>Hole {firstHole} · Par {holes.find(h => h.no === firstHole)?.par}</span><Icon name="caret-down" />
          </button>
          <p className="field-help">Starting somewhere else? Change the first hole.</p>
        </div>
        </>}
        {tripLink}
      </div>
      <div className="cta-wrap">
        {tripRow}
        <button className="full-btn" disabled={optsBad || teamsBad} onClick={onStart}>Create round <Icon name="arrow-right" /></button>
        {onLater && <button className="full-btn outline" disabled={optsBad} onClick={onLater}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
      <Numpad open={!!pad} title={pad?.title} {...padUnit({ playFor })} initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
      <HolePicker open={holePick} holes={holes} value={startHole ?? holes[0].no} onClose={() => setHolePick(false)} onPick={no => { setStartHole(no); setHolePick(false); }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Schedule for later

/** "Saturday, October 3" (today and tomorrow say so), for a day chip's accessible name. */
function dayName(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const full = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const today = isoDate(new Date());
  const tmrw = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1));
  return iso === today ? `Today, ${full}` : iso === tmrw ? `Tomorrow, ${full}` : full;
}

/** The day (next two weeks) and the tee time, above the course list. */
/** "1 tee", "4 tees" */
const teeCount = n => `${n} ${n === 1 ? 'tee' : 'tees'}`;

/** 9 or 18 holes, with the lengths the game can't be played over switched off. */
function HolesPicker({ game, holesCount, setHolesCount }) {
  return (
    <div className="block">
      <div className="eyebrow" style={{ marginBottom: 10 }}>Holes</div>
      <Segmented label="Holes" value={holesCount} onChange={setHolesCount}
        options={[9, 18].map(n => ({ value: n, label: String(n), disabled: game && !game.holes.includes(n) }))} />
      {game && game.holes.length === 1 && <p className="field-help">{game.name} is played over {game.holes[0]} holes.</p>}
    </div>
  );
}

function WhenPicker({ date, setDate, teeTime, setTeeTime }) {
  // An edited plan keeps its day in the strip even when it's further out than two weeks
  const days = useMemo(() => {
    const list = dayChoices(new Date(), 14);
    if (!date || list.some(d => d.iso === date)) return list;
    const [y, m, d] = date.split('-').map(Number);
    const day = new Date(y, m - 1, d);
    const extra = { ...dayChoices(day, 1)[0], top: day.toLocaleDateString('en-US', { weekday: 'short' }) };
    return date < list[0].iso ? [extra, ...list] : [...list, extra];
  }, [date]);
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
      <TimePicker id="when-time" label="Tee time" className="name-input time-input" value={teeTime} onChange={setTeeTime} step={300} placeholder="Add a tee time" />
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
  const [selfNote, setSelfNote] = useState(false);
  const t = newName.trim();
  const addName = e => {
    e.preventDefault();
    if (!t) return;
    // Your own name: you're already in, so don't save a second you
    if (state.players[state.me]?.name.trim().toLowerCase() === t.toLowerCase()) { setNewName(''); setSelfNote(true); return; }
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
            <input id="invite-add-name" aria-label="Add a name" className="name-input" value={newName} onChange={e => { setNewName(e.target.value); setSelfNote(false); }} placeholder="e.g. Dave" autoComplete="off" maxLength={24} enterKeyHint="done" />
            <button type="submit" className="add-name-btn" disabled={!t} aria-label={t ? `Add ${t} and invite them` : 'Add this name'}><Icon name="plus" /> Add</button>
          </div>
          {selfNote && <p className="field-help" role="status">That’s you, and you’re already in.</p>}
        </form>
        <div className="pick-list">
          {players.map(p => {
            const on = invited.includes(p.id);
            return (
              <PickRow key={p.id} on={on} onClick={() => toggle(p.id)} label={`Invite ${p.name}`} lead={<Avatar id={p.id} name={p.name} />}
                title={p.name} sub={p.index == null ? 'No handicap index' : `Index ${formatIndex(p.index)}`} />
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
function VoteStep({ game, holesCount = 18, opts, onPlan, ballot = [], initialSides = [], playFor = null, setPlayFor, tripRow = null }) {
  const start = betOf(game, opts) || 5;
  const [bet, setBet] = useState(start);
  const [others, setOthers] = useState(() => ballot.filter(k => k !== game && GAMES[k]).slice(0, MAX_BALLOT_GAMES - 1));
  const [extraBets, setExtraBets] = useState(() => nearbyBets(start));
  // Side games from a saved usual start picked (the group still says yes or no to each)
  const [sides, setSides] = useState(() => initialSides.filter(k => SIDE_GAMES[k] && k !== game));
  const toggleSide = k => setSides(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]));
  const ladder = [...new Set([...BET_LADDER, start])].sort((a, b) => a - b);
  const toggleGame = k => setOthers(v => (v.includes(k) ? v.filter(x => x !== k) : v.length >= MAX_BALLOT_GAMES - 1 ? v : [...v, k]));
  const toggleBet = b => setExtraBets(v => (v.includes(b) ? v.filter(x => x !== b) : [...v, b]));
  const ballotBets = [...new Set([bet, ...extraBets])].sort((a, b) => a - b);
  return (
    <>
      <div className="scroll">
        <div className="block summary-card">
          <div className="li-sub">You suggest</div>
          <div className="d stake-big">{GAMES[game].name} · {inUnits({ playFor }, betLabel(game, opts, bet, holesCount))}</div>
          {playForLine({ playFor }) && <div className="li-sub">{playForLine({ playFor })}</div>}
          <div className="li-sub">The group votes when they answer. Most votes wins; a tie goes to your suggestion.</div>
        </div>
        {/* Play for first, so the bet chips below read in points when it isn't money */}
        <PlayForPicker value={playFor} onChange={setPlayFor} planning />
        <div className="sec-label">Your bet</div>
        <div className="chip-row" role="radiogroup" aria-label="Your bet">
          {ladder.map(b => (
            <PickChip key={b} radio on={b === bet} onClick={() => { setBet(b); setExtraBets(v => v.filter(x => x !== b)); }}>{inUnits({ playFor }, money(b))}</PickChip>
          ))}
        </div>
        <div className="sec-label">Other bets to vote on</div>
        <div className="chip-row">
          {ladder.filter(b => b !== bet).map(b => (
            <PickChip key={b} small on={extraBets.includes(b)} onClick={() => toggleBet(b)}>{inUnits({ playFor }, money(b))}</PickChip>
          ))}
        </div>
        <p className="field-help pad">{GAMES[game].name} bets on the ballot: {ballotBets.map(b => inUnits({ playFor }, betUnitLabel(game, opts, b))).join(', ')}.</p>
        <div className="sec-label">Other games to vote on <span className="opt">up to {MAX_BALLOT_GAMES - 1}</span></div>
        <div className="chip-row">
          {Object.entries(GAMES).filter(([k]) => k !== game).map(([k, g]) => {
            const on = others.includes(k);
            return (
              <PickChip key={k} small on={on} icon={g.icon} disabled={!on && others.length >= MAX_BALLOT_GAMES - 1} onClick={() => toggleGame(k)}>{g.name}</PickChip>
            );
          })}
        </div>
        {others.length > 0 && (
          <p className="field-help pad">
            {others.map(k => <span key={k} style={{ display: 'block' }}>{GAMES[k].name}: {betChoices(betOf(k, opts)).map(b => betUnitLabel(k, opts, b)).join(', ')}</span>)}
            Each game gets its own bet vote, around your usual bet for it.
          </p>
        )}
        <div className="sec-label">Side games to vote on</div>
        <div className="chip-row">
          {Object.entries(SIDE_GAMES).map(([k, sg]) => {
            const on = sides.includes(k);
            return (
              <PickChip key={k} small on={on} icon={sg.icon} onClick={() => toggleSide(k)}>{sg.label}</PickChip>
            );
          })}
        </div>
        {sides.length > 0 && (
          <p className="field-help pad">
            {sides.map(k => <span key={k} style={{ display: 'block' }}>{SIDE_GAMES[k].label}{opts[k] ? `: ${sideBetLine(k, opts[k])}` : ''}</span>)}
            Everyone says yes or no to each. Roll call adds the ones the group wants{sides.length > MAX_GAMES - 1 ? `, up to ${MAX_GAMES - 1}` : ''}.
          </p>
        )}
        {others.length === 0 && extraBets.length === 0 && sides.length === 0 && <p className="field-help pad">Nothing else on the ballot, so everyone just says if they’re in.</p>}
      </div>
      <div className="cta-wrap">
        {tripRow}
        <button className="full-btn" onClick={() => onPlan({ ballotGames: others, suggestedBet: bet, ballotBets, ballotSides: sides })}>Plan it <Icon name="arrow-right" /></button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/** After setup: invite the group before the first tee, then start. */
function ReadyStep({ round, onStart, onLater }) {
  const [sharing, setSharing] = useState(false);
  const others = useStore(roundsInProgress).filter(r => r.id !== round.id);
  // Anyone just playing has a line of their own: they're on the card, not in the game
  const names = (round.teams || bettors(round)).map(p => p.name.split(' ')[0]);
  const casualNames = round.players.filter(p => isJustPlaying(round, p.id)).map(p => p.name.split(' ')[0]);
  const first = round.holes[0];
  return (
    <>
      <div className="scroll">
        <div className="ready-hero">
          <div className="ready-check"><Icon name="check" /></div>
          <div className="ready-title d">You’re set for {gameLabel(round)}</div>
        </div>
        <div className="block">
          <div className="ready-row"><span>Course</span><b>{round.course.name}{round.nine ? ` · ${round.nine === 'front' ? 'Front' : 'Back'} 9` : ''}</b></div>
          <div className="ready-row"><span>{round.teams ? 'Teams' : 'Players'}</span><b>{round.teams ? round.teams.map(t => t.name).join(' v ') : names.join(', ')}</b></div>
          {casualNames.length > 0 && <div className="ready-row"><span>Just playing</span><b>{casualNames.join(', ')}</b></div>}
          <div className="ready-row"><span>On the line</span><b>{roundStakeLines(round).map(l => l.line).join(' + ')}</b></div>
          {playForLine(round) && <div className="ready-row"><span>Playing for</span><b>{playForShort(round)}</b></div>}
          <div className="ready-row"><span>Handicaps</span><b>{round.useHandicaps ? `${pctsDiffer(round) ? 'Set by game' : hcPctLabel(round.hcPct)}${round.halfStrokes ? ', half strokes' : ''}` : 'Off'}</b></div>
        </div>
        {others.map(o => (
          <p key={o.id} className="hint-card"><Icon name="pause-circle" fill /> Your {gameLabel(o)} round at {o.course.name} ({holesScored(o)} of {o.holes.length} holes) is saved. Switch back any time from Rounds in progress in the round menu.</p>
        ))}
        <div className="usual-save"><SaveUsualButton round={round} className="pill-btn" /></div>
        {syncConfigured && (
          <p className="hint-card"><Icon name="broadcast" fill /> {round.shared ? `The group has the link. They can follow ${countsMoney(round) ? 'the money' : 'the scores'} live.` : `Send the group a link and they can follow ${countsMoney(round) ? 'the money' : 'the scores'} live from their own phones. No download needed.`}</p>
        )}
      </div>
      <div className="cta-wrap">
        {syncConfigured && <button className={`full-btn ${round.shared ? 'outline' : ''}`} onClick={() => setSharing(true)}><Icon name="share-network" /> {round.shared ? 'Send the link again' : 'Invite the group'}</button>}
        <button className={`full-btn ${syncConfigured && !round.shared ? 'outline' : ''}`} onClick={onStart}>Tee off on hole {first.no} <Icon name="arrow-right" /></button>
        {onLater && <button className="text-link" onClick={onLater}><Icon name="calendar-plus" /> Not playing today? Schedule for later</button>}
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

