import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Icon, Numpad, Screen, Segmented, Sheet, useUI } from '../components/ui.jsx';
import { RulesSheet } from '../components/Rules.jsx';
import { DEFAULT_SETTINGS, getState, update, useStore } from '../lib/store.js';
import {
  GAMES, addPlayerProblem, bankerHoleSetup, canLeave, defaultNine, holeComplete, leftRule, livePreview, nassauPressOptions, playersLeft, playersOn, playsHole, pressMode,
  resizeRound, roundLegs, roundResults, scoredHolesDropped, scorers, skinsKinds, skinsTable, strokesFor, wolfHoleSetup, changeBets, wholeRoundOnly,
  gameView, sideGamesOf, holeFixOf, gameKeys, gameKeyLabel, settingsAt, wolfCarryBefore, posOf,
} from '../lib/round.js';
import { SIDE_GAMES } from '../lib/round.js';
import { CourseTeeSheet, FixHoleSheet } from '../components/FixHole.jsx';
import { courseTeeLabel, keepsDraft } from '../lib/hole-fix.js';
import { markUsualPlayed } from '../lib/usuals.js';
import { findCourse } from '../lib/courses.js';
import { money, netScoreName, scoreName, pickupGross } from '../lib/golf.js';
import {
  BBBPicker, DotsRow, HammerPanel, MatchPanel, MoneyPanel, PointsPanel, RabbitPanel, ScramblePanel, SixesPanel, SnakePanel, SnakePicker, TotalsPanel, VegasPanel,
} from '../components/GamePanels.jsx';
import { GameOptions } from '../components/GameOptions.jsx';
import { ScrambleDrivesPicker } from '../components/ScrambleDrives.jsx';
import { drivesNeeded } from '../lib/scramble-drives.js';
import { optionsProblem, roundStakeLines, sideBetLine, stakeSummary } from '../lib/stakes.js';
import { buzz, confettiFrom } from '../lib/delight.js';
import { useNav } from '../lib/nav.js';
import { Scorecard } from './RoundDetail.jsx';
import { LivePill, ShareSheet } from '../components/Live.jsx';
import { syncConfigured, useSeatRequests } from '../lib/sync.js';
import { AddPlayerSheet } from '../components/AddPlayer.jsx';
import { firstName, gameLabel, holeMoneyLine } from '../lib/format.js';
import { countsMoney, inUnits, unitFmt } from '../lib/play-for.js';
import { leaveRound, roundsInProgress } from '../lib/rounds.js';
import { RoundsInProgressSheet } from '../components/RoundsInProgress.jsx';
import { ByGameTable, SideGamesSetup } from '../components/SideGames.jsx';
import { MatchMoments } from '../components/Moments.jsx';
import { nassauOpenNote, sideExample } from '../lib/side-games.js';
import {
  ASK_MS, askForCard, askLeft, canEdit, canTakeCard, clearAsk, clockText, declineAsk, declinedAsk, handOff, handOffChoices, hostKeeper, isKeeper,
  keeperMe, keeperName, keeperOf, keeperSaved, openAsk, seatTaken, shouldLeaveHole, takeCard as takeCardPatch, tookFromMe,
} from '../lib/keeper.js';

export default function Play({ id }) {
  const round = useStore(s => s.rounds[id]);
  const nav = useNav();
  const { showToast } = useUI();
  // The round you open is the one the play button brings you back to
  const inPlay = round?.status === 'active';
  useEffect(() => {
    if (inPlay && getState().activeRoundId !== id) update(s => { s.activeRoundId = id; });
  }, [inPlay, id]);
  // The keeper finished a shared round: the other phones leave the hole (it would turn editable, since
  // any player can fix a finished round) for the same reveal, settle up and share the keeper sees.
  // Watching it finish here plays the reveal; a round that was already done when opened just shows its results.
  const startedActive = useRef(round?.status === 'active');
  const leave = shouldLeaveHole(round, { finishedHere: FINISHED_HERE.has(id) });
  useEffect(() => {
    if (!leave) return;
    for (const k of DRAFTS.keys()) if (k.startsWith(`${id}:`)) DRAFTS.delete(k);
    if (startedActive.current) {
      showToast(`${keeperName(getState().rounds[id])} finished the round`);
      nav.reset('history', ['roundDetail', { id, celebrate: true }]);
    } else nav.reset('history', ['roundDetail', { id }]);
  }, [leave, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (leave) return <Screen />;
  if (!round) {
    return (
      <Screen>
        <Empty title="Round not found" text="It may have been deleted." action={<button className="ec" onClick={() => nav.reset('upnext')}>Back to Up next</button>} />
      </Screen>
    );
  }
  // Remount when this hole changes on another phone so the fresh scores show
  const cur = round.holes[Math.min(round.current, round.holes.length - 1)];
  // ...and when someone leaves or comes back, so the score boxes match who's playing
  const left = Object.entries(round.left || {}).map(e => e.join('@')).sort().join(',');
  // ...or someone is added partway through
  const joined = `${round.players.length}:${Object.entries(round.joined || {}).map(e => e.join('@')).sort().join(',')}`;
  // ...and when this hole's par is fixed, so an untouched score starts from the new par
  // ...and when a side game is added, so Junk's dots have somewhere to go
  const games = (round.sideGames || []).map(sg => sg.game).join('+');
  // A match won before the last hole: the keeper can end the round there (the holes played count)
  const finishHere = () => {
    FINISHED_HERE.add(id);
    for (const k of DRAFTS.keys()) if (k.startsWith(`${id}:`)) DRAFTS.delete(k);
    update(s => { const rr = s.rounds[id]; rr.status = 'done'; rr.finishedAt = Date.now(); markUsualPlayed(s, rr, rr.finishedAt); leaveRound(s, id); });
    nav.reset('history', ['roundDetail', { id, celebrate: true }]);
  };
  const keeps = canEdit(round, keeperMe(round, { me: getState().me }), !!round.shared?.host);
  return (
    <>
      <PlayRound key={`${games}:${round.holesCount}:${round.current}:${round._remote?.[cur?.no] || 0}:${left}:${joined}:${cur?.par}`} round={round} />
      {/* Outside the hole, which remounts on every save, so it sees the hole that was just scored */}
      <MatchMoments round={round} onFinish={keeps ? finishHere : null} />
    </>
  );
}

// Rounds finished (or fixed) on this phone, so it doesn't follow itself to the results a second time
const FINISHED_HERE = new Set();
// Keeper handoffs this phone has already announced ("roundId:since"), so a remount doesn't say it twice
const HANDED = new Set();
/** The time now, ticking every `ms` (0: never ticks). */
function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function useWakeLock() {
  useEffect(() => {
    let lock = null, dead = false;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch { /* not allowed */ } };
    get();
    const vis = () => document.visibilityState === 'visible' && !dead && get();
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release?.().catch(() => {}); };
  }, []);
}

// Unsaved scores per hole ("roundId:holeNo"), kept while moving between holes so nothing typed is lost
const DRAFTS = new Map();

function PlayRound({ round }) {
  useWakeLock();
  const nav = useNav();
  const { ask, showToast } = useUI();
  const idx = Math.min(round.current, round.holes.length - 1);
  const hole = round.holes[idx];
  const isLast = idx === round.holes.length - 1;
  const game = round.game;
  const units = scorers(round, hole); // players still playing, or teams in a scramble
  // The main game's own round: without anyone who's only in the side games, so they never enter a
  // wolf rotation, the banker's bets, the Sixes pairings or a head-to-head's sides
  const main = useMemo(() => gameView(round, 'main'), [round]);
  // Who keeps score (shared rounds): only that phone edits, the other players read (see keeper.js)
  const stateMe = useStore(s => s.me);
  const me = keeperMe(round, { me: stateMe });
  const isHost = !!round.shared?.host;
  const editable = canEdit(round, me, isHost);

  // Draft scores for this hole: saved scores, else par (shown muted until touched)
  const saved = round.scores[hole.no] || {};
  const draftKey = `${round.id}:${hole.no}`;
  const kept = DRAFTS.get(draftKey);
  // Edits you made but haven't saved win over the saved score; otherwise the saved score (which may have come from another phone) wins.
  // Only scores you actually changed count as edits, so a score saved on another phone isn't reset to par.
  const wasDirty = !!kept?.dirty;
  // A score confirmed at par also stays when the hole's par was fixed before saving (see keepsDraft)
  const mine = id => keepsDraft(kept, id, saved, hole.par);
  const [dirty, setDirty] = useState(wasDirty);
  const [base] = useState(() => Object.fromEntries(units.map(p => [p.id, mine(p.id) ? kept.base[p.id] : saved[p.id] ?? hole.par])));
  const [draft, setDraft] = useState(() => Object.fromEntries(units.map(p => [p.id, mine(p.id) ? kept.draft[p.id] : saved[p.id] ?? hole.par])));
  const [touched, setTouched] = useState(() => Object.fromEntries(units.map(p => [p.id, saved[p.id] != null || (wasDirty && !!kept.touched[p.id])])));
  const emptyMarks = { bbb: { bingo: null, bango: null, bongo: null }, snake: { snake: [] }, hammer: { hammers: [], conceded: null } }[game] || {};
  // Junk as a side game: its dots are saved in the same marks object as the main game's marks
  const junk = useMemo(() => (sideGamesOf(round).some(sg => sg.game === 'dots') ? gameView(round, 'dots') : null), [round]);
  // ...and Snake as a side game: its three-putts go in there too, under `snake`
  const snakeSide = useMemo(() => (sideGamesOf(round).some(sg => sg.game === 'snake') ? gameView(round, 'snake') : null), [round]);
  const [marks, setMarks] = useState(() => {
    // A scramble playing for minimum drives saves whose drive each team used in the marks too
    if (!GAMES[game].marks && !junk && !snakeSide && !drivesNeeded(round)) return null;
    const m = (wasDirty && kept.marks) || structuredClone(round.marks?.[hole.no] || emptyMarks);
    return snakeSide && !m.snake ? { ...m, snake: [] } : m;
  });
  useEffect(() => { DRAFTS.set(draftKey, { draft, base, touched, dirty, marks }); }, [draftKey, draft, base, touched, dirty, marks]);
  const [banker, setBanker] = useState(() => (game === 'banker' ? structuredClone(bankerHoleSetup(main, idx)) : null));
  const [phase, setPhase] = useState(() => (game === 'banker' && editable && !holeComplete(round, hole) ? 'bets' : 'scores'));
  const [wolf, setWolf] = useState(() => (game === 'wolf' ? wolfHoleSetup(main, idx) : null));
  const [menu, setMenu] = useState(false);
  const [leftSheet, setLeftSheet] = useState(false);
  const [card, setCard] = useState(false);
  // Which game's rules are open ('main' or a side game's key); the key stays while the sheet closes
  const [rules, setRules] = useState({ key: 'main', open: false });
  const [betPad, setBetPad] = useState(null);
  const [bankerPick, setBankerPick] = useState(false);
  const [live, setLive] = useState(false);
  const [holesSheet, setHolesSheet] = useState(false);
  const [betsSheet, setBetsSheet] = useState(false);
  const [gamesSheet, setGamesSheet] = useState(false);
  const [switching, setSwitching] = useState(false);
  const others = useStore(s => roundsInProgress(s).filter(r => r.id !== round.id).length);
  const [addSheet, setAddSheet] = useState(null); // true, or the seat request being answered
  const [handSheet, setHandSheet] = useState(false);
  const [fixSheet, setFixSheet] = useState(null); // 'hole' | 'tee'
  const localCourse = useStore(s => findCourse(s, round.course.id));
  const holeFixed = !!holeFixOf(round, hole.no);
  const requests = useSeatRequests(round.id);
  const numRefs = useRef({});

  // --- Keeping score in a shared round ---
  const keeper = keeperOf(round);
  const sharedLive = !!round.shared && !round.shared.ended;
  const amKeeper = sharedLive && isKeeper(round, me, isHost);
  const inRound = !!me && round.players.some(p => p.id === me);
  const cardAsk = openAsk(round);
  // A second tick while an ask is open (the countdown), else every 30 seconds for the notes
  const now = useNow(sharedLive && keeper ? (cardAsk ? 1000 : 30000) : 0);
  const left = sharedLive && inRound ? askLeft(round, me, now) : null;
  const declined = sharedLive && inRound ? declinedAsk(round, me, now) : null;
  const tookBy = sharedLive ? tookFromMe(round, me, isHost, now) : null;
  const tookName = tookBy ? firstName(round.players.find(p => p.id === tookBy)?.name || '') : '';
  const holderName = keeperName(round);
  // A round shared before keepers existed: the host phone takes the card when it opens it
  useEffect(() => {
    if (!round.shared?.host || round.shared.ended || round.status !== 'active' || keeperOf(round)) return;
    update(s => { const r = s.rounds[round.id]; if (r && !keeperOf(r)) Object.assign(r, hostKeeper(), seatTaken(r, s.me)); });
  }, [round]);
  // Someone handed this phone the card: say so, and go to the hole they were on
  useEffect(() => {
    // The phone that started the round holds the card from sharing (id null, by null): nobody handed it over
    if (!amKeeper || !keeper?.since || keeper.id == null || keeper.by === me || HANDED.has(`${round.id}:${keeper.since}`)) return;
    HANDED.add(`${round.id}:${keeper.since}`);
    if (Date.now() - keeper.since > 30 * 60000) return;
    const from = keeper.by ? firstName(round.players.find(p => p.id === keeper.by)?.name || '') : round.hostName ? firstName(round.hostName) : '';
    const at = keeper.hole != null ? round.holes.findIndex(h => h.no === keeper.hole) : -1;
    const no = at >= 0 ? keeper.hole : hole.no;
    showToast(`${from || 'The scorekeeper'} handed you the card. You’re on hole ${no}.`);
    if (at >= 0 && at !== idx) update(s => { s.rounds[round.id].current = at; });
  }, [amKeeper, keeper?.id, keeper?.since, keeper?.by, keeper?.hole, me, round, idx, hole.no, showToast]);
  const askCard = () => { update(s => { Object.assign(s.rounds[round.id], askForCard(me)); }); showToast(`Asked ${holderName} for the card`); };
  const takeBack = () => update(s => { Object.assign(s.rounds[round.id], clearAsk()); });
  // The keeper didn't answer in 2 minutes: one tap takes it. Taken, not handed: `by` is the taker,
  // so nobody is told they were handed it, and `from` lets the old keeper's phone say who took it
  const takeCard = () => {
    update(s => { const r = s.rounds[round.id]; if (r && canTakeCard(r, me, Date.now())) Object.assign(r, takeCardPatch(r, me, Date.now(), hole.no)); });
    showToast('You’re keeping score');
    buzz(20);
  };
  // The card was taken from this phone: say who took it, once
  useEffect(() => {
    if (!tookBy || !keeper?.since || HANDED.has(`${round.id}:took:${keeper.since}`)) return;
    HANDED.add(`${round.id}:took:${keeper.since}`);
    showToast(`${tookName || 'Someone'} took the card`);
  }, [tookBy, tookName, keeper?.since, round.id, showToast]);
  const giveCard = pid => {
    setHandSheet(false);
    update(s => { const r = s.rounds[round.id]; if (r && isKeeper(r, me, isHost)) Object.assign(r, handOff(pid, me ?? null, Date.now(), hole.no)); });
    const who = firstName(round.players.find(p => p.id === pid)?.name || '');
    showToast(`${who} is keeping score now`);
  };
  const keepCard = () => update(s => { Object.assign(s.rounds[round.id], declineAsk(s.rounds[round.id])); });

  const setMarksDirty = m => { setDirty(true); setMarks(m); };
  const setScore = (pid, v) => {
    setDirty(true);
    setDraft(d => ({ ...d, [pid]: v }));
    setTouched(t => ({ ...t, [pid]: true }));
    buzz(8);
    if (v !== 'X' && v <= hole.par - 1 && (draft[pid] === 'X' || v < draft[pid])) {
      const name = scoreName(v, hole.par);
      showToast(`${name}!`);
      confettiFrom(numRefs.current[pid], v <= hole.par - 2 ? 60 : 30);
      buzz([20, 40, 20]);
    }
  };


  // Where "Save" takes you: the next hole, or the first unscored hole after this one when fixing an earlier score
  const nextIdx = useMemo(() => {
    if (isLast) return idx;
    const later = round.holes.findIndex((h, i) => i > idx && !holeComplete(round, h));
    return later === -1 ? idx + 1 : later;
  }, [round, idx, isLast]);

  const saveHole = async () => {
    if (!editable) return;
    if (game === 'wolf' && wolf.partner === undefined) { showToast(`Pick ${round.players.find(p => p.id === wolf.wolf)?.name.split(' ')[0] || 'the wolf'}’s partner, or go lone wolf`); return; }
    const scores = Object.fromEntries(units.map(p => [p.id, draft[p.id]]));
    DRAFTS.delete(draftKey);
    const moneyLine = holeMoneyLine(round, hole, livePreview(round, hole, { scores, banker, wolf, marks }).delta);
    // The last hole's line would sit over the reveal's buttons, so it only shows if the round does not finish
    if (!isLast) showToast(moneyLine);
    update(s => {
      const r = s.rounds[round.id];
      r.scores[hole.no] = scores;
      if (game === 'banker') r.banker[hole.no] = banker;
      if (game === 'wolf') r.wolf[hole.no] = wolf;
      if (marks) { if (!r.marks) r.marks = {}; r.marks[hole.no] = marks; }
      if (!isLast) r.current = nextIdx;
      // The keeper's phone saved a hole (kept for the record of who's been scoring)
      if (isKeeper(r, me, isHost)) Object.assign(r, keeperSaved(r));
      // Auto presses before the next hole
      if (pressMode(r) === 'auto' && !isLast) {
        const next = nextIdx + 1; // playing position of the hole we're going to
        // The main game's own players: a side-only player is never on a side
        for (const o of nassauPressOptions(gameView(r, 'main'), next)) {
          r.presses.push({ id: `auto-${o.leg}-${next}`, leg: o.leg, start: next, by: o.trailing, auto: true });
        }
      }
    });
    if (pressMode(round) === 'auto' && !isLast) {
      const r = getState().rounds[round.id];
      const legs = roundLegs(r);
      const fresh = r.presses.filter(p => p.start === nextIdx + 1);
      if (fresh.length) showToast(game === 'nassau' ? `Auto press on the ${fresh.map(p => legs[p.leg].label.replace(/^[A-Z]/, c => c.toLowerCase())).join(' and ')}` : 'Auto press!');
    }
    if (isLast && !(await finish())) showToast(moneyLine);
  };

  const finish = async () => {
    const r = getState().rounds[round.id];
    // Fixing a finished round: it never stopped counting, so just go back to the results
    if (r.editing && r.status === 'done') { doneEditing(); return; }
    const missing = r.holes.filter(h => !holeComplete(r, h));
    if (missing.length) {
      const one = missing.length === 1;
      const go = await ask({
        title: `${missing.length} hole${one ? '' : 's'} not fully scored`,
        text: `Hole${one ? '' : 's'} ${missing.map(h => h.no).join(', ')} ${one ? 'is' : 'are'} missing scores and won’t count for money. Finish anyway? You can fix scores later from the results.`,
        actions: [{ label: 'Finish round', value: 'finish' }, { label: 'Go to first missing hole', value: 'goto', secondary: true }],
      });
      if (go === 'goto') { update(s => { s.rounds[round.id].current = r.holes.indexOf(missing[0]); }); return; }
      if (go !== 'finish') return;
    }
    FINISHED_HERE.add(round.id);
    update(s => {
      const rr = s.rounds[round.id];
      rr.status = 'done'; rr.finishedAt = Date.now();
      markUsualPlayed(s, rr, rr.finishedAt);
      leaveRound(s, round.id);
    });
    nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
    return true;
  };
  const doneEditing = () => {
    setMenu(false);
    FINISHED_HERE.add(round.id);
    update(s => { delete s.rounds[round.id].editing; });
    nav.reset('history', ['roundDetail', { id: round.id }]);
  };

  const endEarly = async () => {
    setMenu(false);
    const played = round.holes.filter(h => holeComplete(round, h)).length;
    const choice = await ask({
      title: 'End this round?',
      text: played ? `${played} of ${round.holes.length} holes scored.` : 'No holes have been scored yet.',
      actions: [
        ...(played ? [{ label: 'Finish and count holes played', value: 'finish' }] : []),
        { label: 'Delete round', value: 'discard', danger: true },
      ],
      cancelLabel: 'Keep playing',
    });
    if (choice === 'finish') {
      FINISHED_HERE.add(round.id);
      update(s => { const rr = s.rounds[round.id]; rr.status = 'done'; rr.finishedAt = Date.now(); markUsualPlayed(s, rr, rr.finishedAt); leaveRound(s, round.id); });
      nav.reset('history', ['roundDetail', { id: round.id, celebrate: true }]);
    }
    if (choice === 'discard') {
      const sure = await ask({ title: 'Delete this round?', text: 'Scores and bets from this round will be gone for good.', confirmLabel: 'Delete round', danger: true });
      if (!sure) return;
      update(s => { delete s.rounds[round.id]; leaveRound(s, round.id); });
      nav.reset('upnext');
    }
  };

  const goHole = i => update(s => { s.rounds[round.id].current = i; });

  const results = useMemo(() => roundResults(round), [round]);
  // Money with this hole counted as it's being entered, so totals move with every tap
  const preview = useMemo(() => {
    const counting = phase === 'scores' && dirty && !(game === 'wolf' && wolf.partner === undefined);
    return livePreview(round, hole, counting ? { scores: draft, banker, wolf, marks } : null);
  }, [round, hole, phase, dirty, game, draft, banker, wolf, marks]);

  return (
    <Screen className="play">
      <div className="play-top">
        <button className="header-close" onClick={() => nav.pop()} aria-label="Leave round (it stays saved)"><Icon name="caret-down" /></button>
        <div className="play-title">
          <div className="play-course">{round.course.name}</div>
          <div className="play-progress">{gameLabel(round)} · Hole {idx + 1} of {round.holes.length} {round.shared && <button className="pill-link" onClick={() => setLive(true)}><LivePill round={round} /></button>}</div>
        </div>
        <button className="header-close" onClick={() => setMenu(true)} aria-label="Round menu"><Icon name="dots-three" /></button>
      </div>
      <MoneyBar round={round} hole={hole} preview={preview} />
      {sharedLive && keeper && round.status === 'active' && !round.editing && (
        <div className="seat-req keeper-bar" role="status">
          <Icon name="pencil-simple" fill />
          <span className="sr-text">
            {amKeeper ? 'You’re keeping score' : tookBy && left == null && !declined ? <><strong>{tookName}</strong> took the card</> : <><strong>{holderName}</strong> is keeping score</>}
            {!amKeeper && left > 0 && <span className="sr-sub">Asked. {holderName} can say yes or no. <button className="link-btn inline" onClick={takeBack}>Undo<span className="sr-only">: take back asking {holderName} for the card</span></button></span>}
            {!amKeeper && left == null && declined && <span className="sr-sub">{holderName} said no, so they’re keeping it.</span>}
          </span>
          {amKeeper
            ? <button className="pill-btn" onClick={() => setHandSheet(true)}>Hand off</button>
            : inRound && (left === 0
              ? <button className="pill-btn" onClick={takeCard}>Take the card</button>
              : left > 0
                ? <button className="pill-btn ghost" disabled aria-live="off" aria-label={`You can take the card in ${Math.ceil(left / 1000)} seconds if ${holderName} doesn’t answer`}>Take the card in <span className="sr-clock">{clockText(left)}</span></button>
                : <button className="pill-btn" onClick={askCard}>{declined ? 'Ask again' : 'Ask for it'}</button>)}
        </div>
      )}
      {amKeeper && cardAsk && round.status === 'active' && (
        <div className="seat-req" role="status">
          <Icon name="hand-grabbing" fill />
          <span className="sr-text">
            <strong>{firstName(round.players.find(p => p.id === cardAsk.by)?.name || '')}</strong> asked for the card. Hand it over?
            <span className="sr-sub">With no answer, they can take it in {clockText(Math.max(0, cardAsk.at + ASK_MS - now))}.</span>
          </span>
          <button className="pill-btn" disabled={dirty} onClick={() => giveCard(cardAsk.by)}>Yes<span className="sr-only">, hand it over</span></button>
          <button className="pill-btn ghost" onClick={keepCard}>No<span className="sr-only">, keep it</span></button>
        </div>
      )}
      {round.editing && editable && (
        <button className="finished-banner" onClick={doneEditing}>
          <Icon name="pencil-simple" fill /> Fixing scores. The tab updates as you save. Done <Icon name="arrow-right" />
        </button>
      )}
      {requests[0] && round.status === 'active' && editable && (
        <div className="seat-req" role="status">
          <Icon name="user-plus" fill />
          <span className="sr-text"><strong>{requests[0].name}</strong> wants to join{requests.length > 1 ? ` (+${requests.length - 1} more)` : ''}</span>
          <button className="pill-btn" onClick={() => setAddSheet(requests[0])}>{addPlayerProblem(round) ? 'See why' : 'Let in'}</button>
        </div>
      )}
      {round.status === 'done' && !round.editing && (
        <button className="finished-banner" onClick={() => nav.reset('history', ['roundDetail', { id: round.id }])}>
          <Icon name="flag-checkered" fill /> The scorekeeper finished this round. See results <Icon name="arrow-right" />
        </button>
      )}
      <div className="hole-meta" onClick={() => setCard(true)} role="button" tabIndex={0} aria-label={holeFixed ? `Open scorecard. Hole ${hole.no}’s par or HCP was fixed for this round` : 'Open scorecard'}>
        {holeFixed && <span className="fixed-tag" aria-hidden="true">Fixed</span>}
        <div className="mc"><span className="ml">Hole</span><span className="mv">{hole.no}</span></div>
        <div className="mc"><span className="ml">Par</span><span className="mv">{hole.par}</span></div>
        <div className="mc"><span className="ml">HCP</span><span className="mv">{hole.hdcp ?? '–'}</span></div>
        {round.useHandicaps && (() => {
          // Who gets a stroke here, up top, so a birdie that doesn't move the money makes sense
          const getting = units.filter(u => strokesFor(round, u, hole) > 0).map(u => u.team ? u.name : u.name.split(' ')[0]);
          return (
            <div className="mc strokes-cell"><span className="ml">Strokes</span>
              <span className="mv">{getting.length ? <><span className="stroke-dots" aria-hidden="true">●</span>{getting.join(', ')}</> : 'None'}</span>
            </div>
          );
        })()}
      </div>

      {game === 'banker' && (
        <BankerPanel round={main} readOnly={!editable} banker={banker} setBanker={setBanker} phase={phase} setPhase={setPhase}
          onPick={() => setBankerPick(true)} onBet={pid => setBetPad(pid)} draft={draft} hole={hole} />
      )}
      {(game === 'nassau' || game === 'match') && <MatchPanel round={main} hole={hole} readOnly={!editable} />}
      {game === 'skins' && <SkinsPanel round={main} hole={hole} onChange={editable ? () => setBetsSheet(true) : null} />}
      {game === 'wolf' && <WolfPanel round={main} hole={hole} wolf={wolf} setWolf={editable ? setWolf : null} />}
      {game === 'vegas' && <VegasPanel round={main} hole={hole} draft={draft} touched={touched} />}
      {game === 'sixes' && <SixesPanel round={main} hole={hole} />}
      {(game === 'stroke' || game === 'stableford' || game === 'quota') && <TotalsPanel round={main} />}
      {(game === 'nines' || game === 'bbb' || game === 'dots') && <PointsPanel round={main} />}
      {game === 'scramble' && <ScramblePanel round={main} />}
      {game === 'aces' && <MoneyPanel round={main} results={results} icon="spade" label="Aces & deuces so far" />}
      {game === 'rabbit' && <RabbitPanel round={main} hole={hole} />}
      {game === 'snake' && <SnakePanel round={main} hole={hole} marks={marks} />}
      {game === 'hammer' && phase === 'scores' && <HammerPanel round={main} hole={hole} marks={marks} setMarks={setMarksDirty} readOnly={!editable} />}

      {phase === 'scores' && (
        <div className="scroll">
          {!editable && sharedLive && <p className="field-help" style={{ padding: '0 20px' }}>{round.status === 'active' ? `Scores as ${holderName} saves them. Browse any hole.` : 'Only the players in this round can fix its scores.'}</p>}
          {game === 'bbb' && editable && <BBBPicker round={main} hole={hole} marks={marks} setMarks={setMarksDirty} />}
          {game === 'scramble' && <ScrambleDrivesPicker round={main} hole={hole} marks={marks} setMarks={editable ? setMarksDirty : null} />}
          {game === 'snake' && editable && <SnakePicker round={main} hole={hole} marks={marks} setMarks={setMarksDirty} />}
          {snakeSide && editable && <SnakePicker round={snakeSide} hole={hole} marks={marks} setMarks={setMarksDirty} />}
          {!editable && units.map(p => {
            const st = round.useHandicaps ? strokesFor(round, p, hole) : 0;
            const v = saved[p.id];
            return (
              <div key={p.id} className="pcard score-row">
                <div className="row-main">
                  <div className="pname">{p.name}</div>
                  <div className="ps">
                    {st > 0 && <span className="stroke-dots">{'●'.repeat(st)} Gets {st} stroke{st > 1 ? 's' : ''}</span>}
                    {v != null && v !== 'X' && <span className={`score-name s${Math.max(-2, Math.min(2, v - hole.par))}`}> {scoreName(v, hole.par)}</span>}
                    {v === 'X' && <span> Picked up</span>}
                  </div>
                </div>
                <div className="score-ctrl">
                  <span className={`sc-num ${v == null ? 'untouched' : ''}`}>
                    <span className="sr-only">{p.name} </span>{v == null ? <><span aria-hidden="true">–</span><span className="sr-only">no score yet</span></> : v === 'X' ? pickupGross(hole.par, st) : v}
                  </span>
                </div>
              </div>
            );
          })}
          {editable && units.map(p => {
            const st = round.useHandicaps ? strokesFor(round, p, hole) : 0;
            const v = draft[p.id];
            const isBanker = banker?.banker === p.id;
            const isWolf = wolf?.wolf === p.id;
            const shown = v === 'X' ? pickupGross(hole.par, st) : v;
            return (
              <div key={p.id} className={`pcard score-row ${game === 'dots' || junk ? 'with-dots' : ''} ${isBanker || isWolf ? 'bkr' : ''}`}>
                <div className="row-main">
                  <div className="pname" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.name}
                    {isBanker && <span className="bkr-badge"><Icon name="bank" fill /> Banker</span>}
                    {isWolf && <span className="bkr-badge"><Icon name="paw-print" fill /> Wolf</span>}
                    {round.teams && !p.team && <span className={`side-tag ${round.teams.findIndex(t => t.players.includes(p.id)) === 0 ? 'a' : 'b'}`}>{['A', 'B', 'C', 'D'][round.teams.findIndex(t => t.players.includes(p.id))]}</span>}
                  </div>
                  {p.team && <div className="ps">{p.players.map(pid => round.players.find(x => x.id === pid)?.name.split(' ')[0]).join(', ')} · team handicap {p.courseHc ?? 0}</div>}
                  <div className="ps">
                    {st > 0 && <span className="stroke-dots" aria-label={`Gets ${st} stroke${st > 1 ? 's' : ''}`}>{'●'.repeat(st)} Gets {st} stroke{st > 1 ? 's' : ''}</span>}
                    {st < 0 && <span className="stroke-dots">Gives back {-st} stroke{st < -1 ? 's' : ''}</span>}
                    {game === 'banker' && !isBanker && <span> Bet {money(banker.bets[p.id] || 0)}{banker.doubled[p.id] ? (banker.doubleBack ? ' · 4×' : ' · 2×') : ''}</span>}
                    {touched[p.id] && v !== 'X' && <span className={`score-name s${Math.max(-2, Math.min(2, v - hole.par))}`}> {scoreName(v, hole.par)}{st !== 0 && `, ${netScoreName(v - st, hole.par)}`}</span>}
                  </div>
                  <button className={`pickup-btn ${v === 'X' ? 'on' : ''}`} onClick={() => setScore(p.id, v === 'X' ? hole.par : 'X')} aria-pressed={v === 'X'}>
                    <Icon name="hand-grabbing" /> {v === 'X' ? `Picked up (counts ${shown})` : 'Picked up'}
                  </button>
                </div>
                <div className="score-ctrl">
                  <button className="sc-btn" aria-label={`${p.name} one less`} disabled={v !== 'X' && v <= 1}
                    onClick={() => setScore(p.id, v === 'X' ? hole.par : Math.max(1, v - 1))}><Icon name="minus" /></button>
                  <span ref={el => { numRefs.current[p.id] = el; }} className={`sc-num ${touched[p.id] ? '' : 'untouched'} ${v !== 'X' && v < hole.par ? 'birdie' : ''}`} aria-live="polite" aria-atomic="true">
                    <span className="sr-only">{p.name} </span>{v === 'X' ? <><span aria-hidden="true">X</span><span className="sr-only">picked up</span></> : v}
                  </span>
                  <button className="sc-btn" aria-label={`${p.name} one more`} disabled={v !== 'X' && v >= 15}
                    onClick={() => setScore(p.id, v === 'X' ? hole.par + 1 : Math.min(15, v + 1))}><Icon name="plus" /></button>
                </div>
                {game === 'dots' && main.players.some(x => x.id === p.id) && <DotsRow round={main} player={p} hole={hole} marks={marks} setMarks={setMarksDirty} gross={touched[p.id] ? v : null} />}
                {junk && junk.players.some(x => x.id === p.id) && <DotsRow round={junk} player={p} hole={hole} marks={marks} setMarks={setMarksDirty} gross={touched[p.id] ? v : null} label={`${firstName(p.name)}’s junk`} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="cta-wrap play-cta">
        {!editable ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="full-btn outline" style={{ width: 64, flex: 'none' }} disabled={idx === 0} onClick={() => goHole(idx - 1)} aria-label="Previous hole"><Icon name="arrow-left" /></button>
            <button className="full-btn outline" style={{ flex: 1 }} disabled={isLast} onClick={() => goHole(idx + 1)}>{isLast ? 'Last hole' : <>Next hole <Icon name="arrow-right" /></>}</button>
          </div>
        ) : phase === 'bets' ? (
          <button className="full-btn" onClick={() => setPhase('scores')}>Bets are in, enter scores <Icon name="arrow-right" /></button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="full-btn outline" style={{ width: 64, flex: 'none' }} disabled={idx === 0} onClick={() => goHole(idx - 1)} aria-label="Previous hole"><Icon name="arrow-left" /></button>
            <button className="full-btn" style={{ flex: 1 }} onClick={saveHole}>
              {isLast ? <>Finish round <Icon name="flag-pennant" fill /></> : nextIdx !== idx + 1 ? <>Save &amp; back to hole {round.holes[nextIdx].no} <Icon name="arrow-right" /></> : <>Save &amp; next hole <Icon name="arrow-right" /></>}
            </button>
          </div>
        )}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Round">
        {/* Feedback first and loud: early on, every bug report counts */}
        <button className="sheet-item feedback-cta" onClick={() => { setMenu(false); nav.push('suggest', { roundId: round.id }); }}>
          <span><Icon name="megaphone" fill /> <span className="fb-words"><strong>Report a bug or send an idea</strong><small>This round’s details come along</small></span></span><Icon name="caret-right" />
        </button>
        <div className="menu-sec">This hole</div>
        <button className="sheet-item" onClick={() => { setMenu(false); setCard(true); }}><span><Icon name="table" /> Scorecard</span><Icon name="caret-right" /></button>
        {editable && <button className="sheet-item" onClick={() => { setMenu(false); setFixSheet('hole'); }}><span><Icon name="wrench" /> Fix par or HCP · hole {hole.no}</span><Icon name="caret-right" /></button>}
        <div className="menu-sec">Games and bets</div>
        {/* Changing the game is for the phone keeping score (see keeper.js) */}
        {editable && <>
        <button className="sheet-item" onClick={() => { setMenu(false); setBetsSheet(true); }}>
          <span><Icon name="coins" /> Bets · {roundStakeLines(round).map(l => l.line).join(' + ')}</span><Icon name="caret-right" />
        </button>
        {game !== 'scramble' && (
          <button className="sheet-item" onClick={() => { setMenu(false); setGamesSheet(true); }}>
            <span><Icon name="plus-circle" /> {sideGamesOf(round).length ? `Side games · ${sideGamesOf(round).length}` : 'Add a side game'}</span><Icon name="caret-right" />
          </button>
        )}
        </>}
        {gameKeys(round).map(k => (
          <button key={k} className="sheet-item" onClick={() => { setMenu(false); setRules({ key: k, open: true }); }}>
            <span><Icon name="book-open" /> {k === 'main' ? GAMES[game].name : SIDE_GAMES[k].label} rules</span><Icon name="caret-right" />
          </button>
        ))}
        <div className="menu-sec">Players</div>
        {syncConfigured && (
          <button className="sheet-item" onClick={() => { setMenu(false); setLive(true); }}>
            <span><Icon name="broadcast" /> {round.shared ? `Live · code ${round.shared.code}` : 'Invite the group'}</span><Icon name="caret-right" />
          </button>
        )}
        {editable && <>
        <button className="sheet-item" onClick={() => { setMenu(false); setAddSheet(true); }}>
          <span><Icon name="user-plus" /> Add a player</span><Icon name="caret-right" />
        </button>
        <button className="sheet-item" onClick={() => { setMenu(false); setLeftSheet(true); }}>
          <span><Icon name="user-minus" /> {playersLeft(round).length ? `A player left · ${playersLeft(round).map(x => x.player.name.split(' ')[0]).join(', ')}` : 'A player left'}</span><Icon name="caret-right" />
        </button>
        </>}
        <div className="menu-sec">Round</div>
        {editable && <>
        <button className="sheet-item" onClick={() => { setMenu(false); setHolesSheet(true); }}>
          <span><Icon name="flag-pennant" /> Round length · {round.holesCount} holes</span><Icon name="caret-right" />
        </button>
        <button className="sheet-item" onClick={() => { setMenu(false); setFixSheet('tee'); }}>
          <span><Icon name="sliders-horizontal" /> Course and tee{courseTeeLabel(round, localCourse) ? ` · ${courseTeeLabel(round, localCourse)}` : ''}</span><Icon name="caret-right" />
        </button>
        </>}
        {round.status === 'active' && (
          <button className="sheet-item" onClick={() => { setMenu(false); setSwitching(true); }}>
            <span><Icon name="stack" /> {others ? `Rounds in progress · ${others + 1}` : 'Start another round'}</span><Icon name="caret-right" />
          </button>
        )}
        {editable && (round.editing
          ? <button className="sheet-item" onClick={doneEditing}><span><Icon name="check-circle" /> Done fixing scores</span><Icon name="caret-right" /></button>
          : <button className="sheet-item" onClick={endEarly}><span><Icon name="flag-checkered" /> End round</span><Icon name="caret-right" /></button>)}
      </Sheet>
      {gamesSheet && <GamesSheet round={round} onClose={() => setGamesSheet(false)} />}
      <RoundsInProgressSheet open={switching} onClose={() => setSwitching(false)} currentId={round.id} />
      {holesSheet && <HolesSheet round={round} onClose={() => setHolesSheet(false)} />}
      {betsSheet && <BetsSheet round={round} onClose={() => setBetsSheet(false)} />}
      {handSheet && <HandOffSheet round={round} me={me} dirty={dirty} onPick={giveCard} onClose={() => setHandSheet(false)} />}
      {addSheet && <AddPlayerSheet round={round} request={addSheet === true ? null : addSheet} onClose={() => setAddSheet(null)} />}
      {leftSheet && <LeftSheet round={round} idx={idx} onClose={() => setLeftSheet(false)} onEnd={() => { setLeftSheet(false); endEarly(); }} />}
      <Sheet open={card} onClose={() => setCard(false)} title="Scorecard" className="sc-sheet">
        <p className="sheet-text">{editable ? 'Tap a hole to jump to it and fix scores.' : 'Tap a hole to jump to it.'}</p>
        <Scorecard round={round} current={hole.no} onHole={no => { setCard(false); goHole(round.holes.findIndex(h => h.no === no)); }} />
        {editable && (
          <button className="quiet-row fix-link" onClick={() => { setCard(false); setFixSheet('hole'); }}>
            <Icon name="wrench" /> <span><u>Wrong par or HCP?</u> Fix hole {hole.no}</span>
          </button>
        )}
      </Sheet>
      {fixSheet === 'hole' && editable && <FixHoleSheet round={round} holeNo={hole.no} me={me} onClose={() => setFixSheet(null)} />}
      {fixSheet === 'tee' && editable && <CourseTeeSheet round={round} me={me} onClose={() => setFixSheet(null)} />}
      <RulesSheet game={rules.key === 'main' ? game : rules.key} open={rules.open} onClose={() => setRules(r => ({ ...r, open: false }))}
        title={rules.key === 'dots' ? `How to play ${SIDE_GAMES.dots.label}` : undefined}
        sub={rules.key === 'dots' ? 'A side game · Dots, garbage, trash' : undefined} />
      <ShareSheet round={round} open={live} onClose={() => setLive(false)} />
      {game === 'banker' && (
        <>
          <Sheet open={bankerPick} onClose={() => setBankerPick(false)} title={`Banker · Hole ${hole.no}`}>
            {playersOn(main, hole).map(p => (
              <button key={p.id} className={`sheet-item ${banker.banker === p.id ? 'selected' : ''}`} aria-pressed={banker.banker === p.id}
                onClick={() => {
                  const bets = {};
                  const def = round.settings.banker.defaultBet;
                  for (const q of playersOn(main, hole)) if (q.id !== p.id) bets[q.id] = banker.bets[q.id] ?? def;
                  setBanker({ ...banker, banker: p.id, bets, doubled: {}, doubleBack: false });
                  setBankerPick(false);
                }}>
                {p.name}<span style={{ fontSize: 13 }}>{p.plays ? `Gets ${p.plays} stroke${p.plays > 1 ? 's' : ''}` : 'No strokes'}</span>
              </button>
            ))}
          </Sheet>
          <Numpad open={!!betPad} title={`${round.players.find(p => p.id === betPad)?.name}'s bet`} prefix="$"
            initial={betPad ? banker.bets[betPad] : ''} min={round.settings.banker.min} max={round.settings.banker.max}
            onClose={() => setBetPad(null)} onDone={v => { setBanker({ ...banker, bets: { ...banker.bets, [betPad]: v } }); setBetPad(null); }} />
        </>
      )}
    </Screen>
  );
}

// --------------------------- Round length ---------------------------------

/** Switch a round in progress between 9 and 18 holes. Mounted only while open so it starts fresh each time. */
function HolesSheet({ round, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const [count, setCount] = useState(round.holesCount);
  const [nine, setNine] = useState(() => defaultNine(round));
  const g = GAMES[round.game];
  const changed = count !== round.holesCount;
  const preview = useMemo(() => (course && changed ? resizeRound(round, course, count, nine) : null), [round, course, changed, count, nine]);
  const dropped = preview ? scoredHolesDropped(round, preview.holes) : [];
  const hcChanges = preview && round.useHandicaps
    ? round.players.map((p, i) => ({ name: p.name.split(' ')[0], from: p.plays, to: preview.players[i].plays })).filter(c => c.from !== c.to)
    : [];
  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      Object.assign(r, resizeRound(r, course, count, nine));
    });
    onClose();
    showToast(`Now playing ${count} holes`);
    buzz(20);
  };
  return (
    <Sheet open onClose={onClose} title="Round length">
      <p className="sheet-text">Scores you’ve entered stay put. Par, handicaps and strokes are worked out again for the new length.</p>
      <div style={{ padding: '0 20px 12px' }}>
        <Segmented label="Round length" value={count} onChange={setCount}
          options={[9, 18].map(n => ({ value: n, label: `${n} holes`, disabled: !g.holes.includes(n) }))} />
      </div>
      {changed && course && count === 9 && course.holes.length === 18 && (
        <div style={{ padding: '0 20px 12px' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Which nine</div>
          <Segmented label="Which nine" value={nine} onChange={setNine} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
        </div>
      )}
      {!course && <p className="hint-card"><Icon name="info" fill /> This phone doesn’t have {round.course.name} saved, so the round length can’t be changed here.</p>}
      {course && count === 18 && course.holes.length === 9 && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
      {dropped.length > 0 && (
        <p className="hint-card"><Icon name="warning" fill /> Scores on hole{dropped.length === 1 ? '' : 's'} {dropped.map(h => h.no).join(', ')} won’t count. They’re kept if you switch back.</p>
      )}
      {hcChanges.length > 0 && (
        <p className="hint-card"><Icon name="scales" fill /> Strokes: {hcChanges.map(c => `${c.name} ${c.from} → ${c.to}`).join(', ')}</p>
      )}
      {preview && round.presses.length > 0 && (
        <p className="hint-card"><Icon name="lightning" fill /> Presses so far will be removed, since the bets change with the length.</p>
      )}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!preview} onClick={apply}>
          {changed ? <>Switch to {count} holes <Icon name="arrow-right" /></> : 'No change'}
        </button>
      </div>
    </Sheet>
  );
}

// --------------------------- A player left ---------------------------------

/**
 * Mark a player as gone after a hole, or bring them back. Holes they played keep counting;
 * from the next hole on they have no score box and the money is worked out without them.
 * Mounted only while open so it starts fresh each time.
 */
function LeftSheet({ round, idx, onClose, onEnd }) {
  const { showToast } = useUI();
  const gone = playersLeft(round);
  const staying = round.players.filter(p => round.left?.[p.id] == null);
  const [pid, setPid] = useState(null);
  // Default: the last hole they finished. The hole on screen if it's fully scored, else the one before
  const [pos, setPos] = useState(() => (holeComplete(round, round.holes[idx]) ? idx + 1 : idx));
  const first = n => n.split(' ')[0];
  const person = round.players.find(p => p.id === pid);
  const afterNo = pos === 0 ? 0 : round.holes[pos - 1].no;
  const nobody = !staying.some(p => canLeave(round, p.id));
  // Holes to pick from: up to the one on screen, or further if later holes already have scores (fixing a round)
  const upto = Math.max(idx, round.holes.reduce((a, h, i) => (round.scores[h.no] ? i : a), -1));
  const effect = pid ? leftRule({ ...round, left: { ...round.left, [pid]: afterNo } }, pid) : null;

  const apply = () => {
    update(s => { const r = s.rounds[round.id]; r.left = { ...(r.left || {}), [pid]: afterNo }; });
    onClose();
    showToast(pos === 0 ? `${first(person.name)} is out of the round` : `${first(person.name)} left after hole ${afterNo}`);
    buzz(20);
  };
  const undo = p => {
    update(s => { const r = s.rounds[round.id]; const next = { ...(r.left || {}) }; delete next[p.id]; r.left = next; });
    const later = round.holes.filter((h, i) => i >= (gone.find(g => g.player.id === p.id)?.pos ?? 0) && holeComplete(round, h));
    onClose();
    showToast(later.length ? `${first(p.name)} is back. Add their scores for holes ${later.map(h => h.no).join(', ')}` : `${first(p.name)} is back`);
  };

  return (
    <Sheet open onClose={onClose} title="A player left">
      <p className="sheet-text">Holes they played still count. From the next hole on they have no score box, and the money is worked out among the players still playing.</p>
      {gone.length > 0 && (
        <>
          <div className="eyebrow" style={{ padding: '0 20px 8px' }}>Already left</div>
          {gone.map(g => (
            <div key={g.player.id} className="leg-row">
              <div className="leg-winner">{g.player.name}<div className="li-sub">{g.after === 0 ? 'Before the first hole' : `After hole ${g.after}`}</div></div>
              <button className="pill-btn sm" onClick={() => undo(g.player)}><Icon name="arrow-counter-clockwise" /> They’re back</button>
            </div>
          ))}
        </>
      )}
      {nobody ? (
        <>
          <p className="hint-card"><Icon name="info" fill /> At least two {round.game === 'scramble' ? 'teams' : 'players'} have to stay to keep the game going. To stop here, end the round: the holes played still count.</p>
          <div className="cta-wrap"><button className="full-btn" onClick={onEnd}><Icon name="flag-checkered" /> End round</button></div>
        </>
      ) : (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Who left</div>
            <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label="Who left">
              {staying.map(p => (
                <button key={p.id} role="radio" aria-checked={pid === p.id} disabled={!canLeave(round, p.id)} className={`pill-btn ${pid === p.id ? 'on' : ''}`} onClick={() => setPid(p.id)}>{p.name}</button>
              ))}
            </div>
          </div>
          {pid && (
            <div style={{ padding: '0 20px 12px' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Last hole they finished</div>
              <div className="chip-row" style={{ padding: 0 }} role="radiogroup" aria-label="Last hole they finished">
                <button role="radio" aria-checked={pos === 0} className={`pill-btn ${pos === 0 ? 'on' : ''}`} onClick={() => setPos(0)}>None</button>
                {round.holes.slice(0, upto + 1).map((h, i) => (
                  <button key={h.no} role="radio" aria-checked={pos === i + 1} className={`pill-btn ${pos === i + 1 ? 'on' : ''}`} onClick={() => setPos(i + 1)}>{h.no}</button>
                ))}
              </div>
            </div>
          )}
          {effect && <p className="hint-card"><Icon name="scales" fill /> {effect}</p>}
          <div className="cta-wrap">
            <button className="full-btn" disabled={!pid} onClick={apply}>
              {pid ? (pos === 0 ? `${first(person.name)} didn’t play` : `${first(person.name)} left after hole ${afterNo}`) : 'Pick who left'}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

// --------------------------- Bets & stakes --------------------------------

/**
 * Side games mid-round: add Skins, Junk or a Birdie pot without setting the round up again. The course,
 * players and scores stay; a new game counts every hole already scored, so the money catches up at once.
 * Any change to a game's bets here covers the whole round, so it drops that game's earlier bet
 * changes; the Bets sheet is where a bet changes from the next hole.
 */
function GamesSheet({ round, onClose }) {
  const { showToast } = useUI();
  const [list, setList] = useState(() => structuredClone(sideGamesOf(round)));
  const edit = fn => setList(l => fn(sideGamesOf({ game: round.game, sideGames: l })));
  const bad = list.some(sg => optionsProblem(sg.game, { [sg.game]: sg.settings }));
  const changed = JSON.stringify(list) !== JSON.stringify(sideGamesOf(round));
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  const save = () => {
    const before = Object.fromEntries(sideGamesOf(round).map(sg => [sg.game, sg]));
    // A game whose bets changed here is played for them on every hole
    const cleared = [];
    const out = list.map(sg => {
      if (!sg.betHistory || JSON.stringify(before[sg.game]?.settings) === JSON.stringify(sg.settings)) return sg;
      cleared.push(gameKeyLabel(round, sg.game));
      const { betHistory: _, ...rest } = sg;
      return rest;
    });
    update(s => {
      const r = s.rounds[round.id];
      if (out.length) r.sideGames = structuredClone(out); else delete r.sideGames;
    });
    onClose();
    // Say so when a bet that changed mid-round now covers every hole, since earlier holes' money moves
    showToast(cleared.length ? `${cleared.join(' and ')} ${cleared.length === 1 ? 'bet now covers' : 'bets now cover'} the whole round`
      : out.length ? `Playing ${gameLabel({ ...round, sideGames: out })}` : `Back to ${GAMES[round.game].name} only`);
    buzz(20);
  };
  return (
    <Sheet open onClose={onClose} title="Side games" className="sc-sheet">
      <p className="sheet-text">Same course, same players, same scores. {played ? `A new game counts the ${played} hole${played === 1 ? '' : 's'} already scored too.` : 'Every game reads the one scorecard.'}</p>
      {played > 0 && sideGamesOf(round).length > 0 && <p className="field-help pad">Changes here cover the whole round. To change a bet from the next hole, use Bets.</p>}
      <SideGamesSetup game={round.game} sideGames={list} setSideGames={edit} defaults={round.settings} players={round.players.length} />
      <div className="cta-wrap">
        <button className="full-btn" disabled={!changed || bad} onClick={save}>{changed ? 'Save games' : 'No changes'}</button>
      </div>
    </Sheet>
  );
}

/**
 * Change the bets in a round that's under way, so the group doesn't have to discard the round
 * when they agree a different bet on the 10th tee. By default the new bets count from the next
 * hole to play on, and holes already played keep what they were played for; "Whole round"
 * reprices every hole. A pot covers the whole round, so a pot's bet always changes for all of it.
 * With side games on, a switcher at the top picks the game: each game's bet changes on its own.
 */
function BetsSheet({ round, onClose }) {
  const { showToast } = useUI();
  const sides = sideGamesOf(round);
  const [pick, setPick] = useState('main');
  const gameKey = pick === 'main' || sides.some(sg => sg.game === pick) ? pick : 'main';
  const side = gameKey !== 'main';
  // A side game is edited on its own view: its settings (and bet history) in place of the main game's
  const view = side ? gameView(round, gameKey) : round;
  const game = view.game;
  // Rabbit rounds from before "set free" have no mode: they play the old steal rule
  // Skins and Nassau rounds from before their house rules have none saved: fill in the defaults,
  // which play the old way, so the options show a choice and a switch to a pot has an amount
  const current = useMemo(() => {
    const st = view.settings;
    if (game === 'rabbit' && !st.rabbit.mode) return { ...st, rabbit: { ...st.rabbit, mode: 'steal' } };
    // Snake rounds from before the cap have none saved: they play with no cap, so show No cap
    if (game === 'snake' && st.snake && st.snake.cap == null) return { ...st, snake: { ...st.snake, cap: 0 } };
    if (game === 'skins' || game === 'nassau') return { ...st, [game]: { ...DEFAULT_SETTINGS[game], ...st[game] } };
    return st;
  }, [game, view.settings]);
  const [opts, setOpts] = useState(() => structuredClone(current));
  const [scope, setScope] = useState('next');
  // Switching games starts from that game's bets (a change not yet saved is dropped)
  const [shown, setShown] = useState(gameKey);
  const [pad, setPad] = useState(null); // { path, title, min, max }
  if (shown !== gameKey) { setShown(gameKey); setOpts(structuredClone(current)); setScope('next'); return null; }
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  const get = path => path.split('.').reduce((t, k) => t?.[k], opts);
  const problem = optionsProblem(game, opts);
  const changed = JSON.stringify(opts[game]) !== JSON.stringify(current[game]);
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  // The next hole to play: the one after the last hole with scores in
  const lastPlayed = round.holes.reduce((a, h, i) => (holeComplete(round, h) ? i + 1 : a), 0);
  const fromPos = lastPlayed + 1;
  const fromHole = round.holes[fromPos - 1];
  const canSplit = played > 0 && !!fromHole && !wholeRoundOnly(game, current[game], opts[game]);
  const whole = !canSplit || scope === 'whole';
  // Why a change can't start from the next hole, when it isn't a pot: net, gross or both is read
  // once for the round, and so is a snake split into nines
  const pot = game === 'scramble' || game === 'birdies' || current[game]?.payout === 'pot' || opts[game]?.payout === 'pot';
  const layout = game === 'snake' ? 'Each nine or one snake is set' : 'Net, gross or both is set';
  const label = gameKeyLabel(round, gameKey);
  const apply = () => {
    update(s => {
      s.rounds[round.id] = changeBets(s.rounds[round.id], opts[game], whole ? null : fromPos, gameKey);
      // The agreed bet is next time's default too
      s.settings = { ...s.settings, [game]: structuredClone(opts[game]) };
    });
    onClose();
    // A points or reward round reads in points
    showToast(inUnits(round, side
      ? `${label} bet updated${whole ? '' : ` from hole ${fromHole.no}`} · ${sideBetLine(game, opts[game])}`
      : `Bets updated${whole ? '' : ` from hole ${fromHole.no}`} · ${stakeSummary(game, opts)}`));
    buzz(20);
  };
  const legs = game === 'nassau' || game === 'match' || game === 'rabbit' || game === 'snake' || (game === 'sixes' && opts.sixes.mode === 'match');
  // A snake or rabbit is played for the bet in force when its leg started: one leg for the round, or
  // one a nine. Say when the new bet starts counting, or that only "Whole round" changes it
  const legStarts = game === 'snake' || game === 'rabbit'
    ? ((game === 'snake' ? settingsAt(view, 1).snake?.nines : true) && round.holes.length === 18 ? [1, 10] : [1]) : null;
  const nextLeg = legStarts?.find(x => x >= fromPos);
  const legNote = !legStarts ? 'A bet already under way, like a leg or a match, keeps what it started with.'
    : nextLeg === fromPos ? ''
      : nextLeg ? `The ${game} under way keeps what it started with, so the new bet starts on hole ${round.holes[nextLeg - 1].no}.`
        : `The ${game} under way keeps what it started with to the last hole. Pick Whole round to change it.`;
  // The snake or rabbit under way runs to the last hole, so a change from the next hole would pay nothing
  const stuck = !whole && !!legStarts && !nextLeg;
  return (
    <>
      <Sheet open={!pad} onClose={onClose} title="Bets" className="sc-sheet">
        {sides.length > 0 && (
          <div className="block">
            <Segmented label="Which game" className="press-mode-row game-pick" btn="pm-btn" value={gameKey} onChange={setPick}
              options={gameKeys(round).map(k => ({ value: k, label: gameKeyLabel(round, k) }))} />
            <p className="field-help">Each game’s bet changes on its own.</p>
          </div>
        )}
        <p className="sheet-text">
          {!played ? 'Change what’s on the line before the first hole is scored.'
            : canSplit ? `${played} hole${played === 1 ? '' : 's'} played. Pick when the new bets start.`
              : !fromHole ? 'Every hole is played, so a change covers the whole round.'
                : !pot ? `${layout} for the whole round, so a change counts for every hole.`
                  : 'The pot covers the whole round, so a change counts for every hole.'}
        </p>
        {canSplit && (
          <div className="block">
            <Segmented label="When the new bets start" value={scope} onChange={setScope}
              options={[{ value: 'next', label: `From hole ${fromHole.no} on` }, { value: 'whole', label: 'Whole round' }]} />
            <p className="field-help">
              {whole
                ? `Every hole is worked out again at the new bets, including the ${played} already played.`
                : `The ${played} hole${played === 1 ? '' : 's'} already played keep${played === 1 ? 's' : ''} ${played === 1 ? 'its' : 'their'} bets.${legs && legNote ? ` ${legNote}` : ''}`}
            </p>
          </div>
        )}
        {game === 'birdies' ? (
          // The Birdie pot is a side game only, so it has no main-game options: just what each player puts in
          <>
            <div className="nassau-bet-row">
              <div className="nassau-bet-lbl">Each player puts in</div>
              <button className="nassau-bet-btn" aria-label={`Each player puts in: ${money(get('birdies.stake') ?? 0)}. Change`}
                onClick={() => setPad({ path: 'birdies.stake', title: 'Each player puts in', min: 1, max: 500 })}>{money(get('birdies.stake') ?? 0)}</button>
            </div>
            <p className="field-help pad">{sideExample('birdies', opts.birdies, view.players.length)}</p>
          </>
        ) : (
          <GameOptions game={game} get={get} set={set} onAmount={(path, title, o) => setPad({ path, title, ...o })} holesCount={round.holesCount}
            players={view.players.length} firstName={game === 'banker' ? round.players[0]?.name : null} />
        )}
        {game === 'banker' && <p className="hint-card"><Icon name="info" fill /> The default bet fills in from the next hole. Bets on this hole are set from the Bets button.</p>}
        {!side && (game === 'nassau' || game === 'match') && round.presses.length > 0 && whole && <p className="hint-card"><Icon name="lightning" fill /> Presses already made pay at the new amounts too.</p>}
        {problem && <p className="field-error">{problem}</p>}
        <div className="cta-wrap">
          <button className="full-btn" disabled={!changed || !!problem || stuck} onClick={apply}>
            {!changed ? 'No changes yet' : stuck ? 'Pick Whole round to change it' : <>Update bets <Icon name="arrow-right" /></>}
          </button>
        </div>
      </Sheet>
      <Numpad open={!!pad} title={pad?.title} prefix="$" initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
    </>
  );
}

/** Everyone's money, pinned under the header from the first hole, updating as scores go in. */
function MoneyBar({ round, hole, preview }) {
  // Holes counted besides this one, so going back to a saved hole doesn't count it twice ("Thru 3 + this one" on hole 3)
  const saved = holeComplete(round, hole);
  const played = round.holes.filter(h => holeComplete(round, h)).length - (saved ? 1 : 0);
  const pending = saved || Object.values(preview.delta).some(Boolean);
  const top = Math.max(...Object.values(preview.balances));
  // Pop the amounts that just changed
  const [prev, setPrev] = useState(preview.balances);
  const [changed, setChanged] = useState([]);
  if (prev !== preview.balances) {
    setChanged(round.players.filter(p => prev[p.id] !== preview.balances[p.id]).map(p => p.id));
    setPrev(preview.balances);
  }
  // With side games the bar is one total per person, and a tap shows each game's money
  const byGame = preview.byGame || null;
  const [open, setOpen] = useState(false);
  // A points or reward round counts the same numbers as points (never money)
  const fmt = unitFmt(round);
  const word = countsMoney(round) ? 'Money' : 'Points';
  const thru = played ? (pending ? `Thru ${played} + this hole` : `Thru ${played} hole${played === 1 ? '' : 's'}`) : pending ? 'This hole' : `Everyone starts at ${fmt(0)}`;
  const Box = byGame ? 'button' : 'div';
  const boxProps = byGame
    ? { type: 'button', className: 'money-bar mb-tap', 'aria-label': `${word} so far. Show by game`, 'aria-haspopup': 'dialog', onClick: () => setOpen(true) }
    : { className: 'money-bar', role: 'group', 'aria-label': `${word} so far` };
  // Not a live region: it changes on every tap. The saved hole's result is announced by the toast.
  return (
    <>
    <Box {...boxProps}>
      <div className="mb-head">
        <span>{word}</span>
        <span>{byGame ? `${thru} · Tap for games` : thru}</span>
      </div>
      <div className="mb-items" style={{ gridTemplateColumns: `repeat(${round.players.length}, minmax(0, 1fr))` }}>
        {round.players.map(p => {
          const v = preview.balances[p.id];
          const d = preview.delta[p.id];
          return (
            <div key={p.id} className={`mb-item ${top > 0 && v === top ? 'lead' : ''}`}>
              <div className="mb-p">{p.name.split(' ')[0]}</div>
              <div key={changed.includes(p.id) ? v : 'same'} className={`mb-a ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''} ${changed.includes(p.id) ? 'bump' : ''}`}>{fmt(v, { sign: true })}</div>
              <div className="mb-d">{d ? `${fmt(d, { sign: true })} this hole` : round.left?.[p.id] != null ? 'Left' : round.joined?.[p.id] != null && !playsHole(round, p.id, hole) ? `From hole ${round.joined[p.id]}` : '\u00a0'}</div>
            </div>
          );
        })}
      </div>
    </Box>
    {byGame && (
      <Sheet open={open} onClose={() => setOpen(false)} title="By game" className="sc-sheet">
        <p className="sheet-text">{word} so far ({thru.toLowerCase()}). Every game adds up into one total each.</p>
        <ByGameTable round={round} byGame={byGame} total={preview.balances} fmt={fmt} />
        {nassauOpenNote(round, byGame) && <p className="field-help" style={{ padding: '0 20px' }}>{nassauOpenNote(round, byGame)}</p>}
        <div className="cta-wrap"><button className="full-btn outline" onClick={() => setOpen(false)}>Close</button></div>
      </Sheet>
    )}
    </>
  );
}

// --------------------------- Banker ---------------------------------------

function BankerPanel({ round, banker, setBanker, phase, setPhase, onPick, onBet, hole, readOnly = false }) {
  const b = round.players.find(p => p.id === banker.banker);
  const others = playersOn(round, hole).filter(p => p.id !== banker.banker);
  const anyDoubled = others.some(p => banker.doubled[p.id]);
  const canPick = round.settings.banker.rotation === 'choice' || true;
  return (
    <>
      <div className="banker-bar">
        <div><div className="bl">Banker this hole</div><div className="bn"><Icon name="bank" fill /> {b?.name}</div></div>
        {readOnly ? null : phase === 'bets'
          ? canPick && <button className="change-btn" onClick={onPick}>Change</button>
          : <button className="change-btn" onClick={() => setPhase('bets')}><Icon name="coins" /> Bets</button>}
      </div>
      {phase === 'bets' && (
        <div className="scroll">
          <div style={{ padding: '6px 20px 8px' }}><div className="eyebrow">Step 1 of 2: Bets &amp; doubles</div></div>
          {others.map(p => (
            <div key={p.id} className="pcard">
              <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 10px' }}>
                <div style={{ flex: 1 }}><div className="pname">{p.name}</div><div className="ps">{p.plays ? `Gets ${p.plays} stroke${p.plays > 1 ? 's' : ''} on the round` : 'No strokes'}</div></div>
                <button className="amt-btn" onClick={() => onBet(p.id)} aria-label={`${p.name}'s bet, ${money(banker.bets[p.id])}`}>{money(banker.bets[p.id] || 0)}</button>
              </div>
              <div style={{ padding: '0 16px 16px', display: 'flex' }}>
                <button className={`dbl-btn ${banker.doubled[p.id] ? 'on' : ''}`} style={{ flex: 1, height: 52, fontSize: 17 }} aria-pressed={!!banker.doubled[p.id]}
                  onClick={() => {
                    const doubled = { ...banker.doubled, [p.id]: !banker.doubled[p.id] };
                    const still = others.some(o => doubled[o.id]);
                    setBanker({ ...banker, doubled, doubleBack: still ? banker.doubleBack : false });
                  }}>
                  <Icon name="lightning" fill /> {banker.doubled[p.id] ? `Doubled · ${money(banker.bets[p.id] * (banker.doubleBack ? 4 : 2))}` : 'Double it'}
                </button>
              </div>
            </div>
          ))}
          <div className="block" style={{ background: 'var(--surface)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{b?.name} can double back</div>
            <button className={`dbl-btn ${banker.doubleBack ? 'on' : ''}`} style={{ width: '100%', height: 52, fontSize: 17 }} disabled={!anyDoubled} aria-pressed={banker.doubleBack}
              onClick={() => setBanker({ ...banker, doubleBack: !banker.doubleBack })}>
              <Icon name="lightning" fill /> {anyDoubled ? (banker.doubleBack ? 'Doubled back · 4×' : 'Double back to 4×') : 'Unlocks when someone doubles'}
            </button>
          </div>
          <BetExposure round={round} banker={banker} />
        </div>
      )}
    </>
  );
}

function BetExposure({ banker }) {
  const total = Object.entries(banker.bets).reduce((a, [pid, v]) => a + v * (banker.doubled[pid] ? (banker.doubleBack ? 4 : 2) : 1), 0);
  return <p className="hint-card"><Icon name="scales" fill /> Banker has {money(total)} riding on this hole.</p>;
}

// --------------------------- Skins ----------------------------------------

function SkinsPanel({ round, hole, onChange }) {
  const money = unitFmt(round); // points in a points or reward round
  const kinds = skinsKinds(round);
  const cfg = round.settings.skins;
  const pot = cfg.payout === 'pot';
  const counts = Object.fromEntries(round.players.map(p => [p.id, 0]));
  // What this hole is worth, per kind: skins, plus the money when each skin has a price
  const worth = kinds.map(kind => {
    const t = skinsTable(round, kind);
    t.rows.filter(r => r.winner).forEach(r => { counts[r.winner] += r.skins; });
    const row = t.rows.find(r => r.hole.no === hole.no);
    const n = row?.pot ?? 1;
    const skins = `${n} skin${n > 1 ? 's' : ''}`;
    const tag = kinds.length > 1 ? `${kind === 'net' ? 'Net' : 'Gross'} ` : '';
    return pot ? `${tag}${skins}` : `${tag}${skins} · ${money(row?.purse ?? t.value * (round.players.length - 1))}`;
  });
  return (
    <div className="banker-bar" style={{ background: 'var(--lav)' }}>
      <div>
        <div className="bl">This hole is worth</div>
        <div className="bn"><Icon name="coins" fill /> {worth.join(' · ')}</div>
      </div>
      <div className="skin-counts">
        {round.players.map(p => <span key={p.id} className="press-chip">{p.name.split(' ')[0]} {Math.round(counts[p.id] * 10) / 10}</span>)}
        {onChange && <button className="change-btn" onClick={onChange}>{pot ? `${money(cfg.stake ?? cfg.value)} each in` : `${money(cfg.value)} a skin`}</button>}
      </div>
    </div>
  );
}

// --------------------------- Wolf -----------------------------------------

function WolfPanel({ round, hole, wolf, setWolf }) {
  const w = round.players.find(p => p.id === wolf.wolf);
  const others = playersOn(round, hole).filter(p => p.id !== wolf.wolf);
  // The bets in force on this hole, so a mid-round change counts from the hole it starts on
  const cfg = settingsAt(round, posOf(round, hole)).wolf;
  const mult = cfg.loneMultiplier;
  const blindMult = cfg.blindMultiplier ?? 3;
  // Ties carry: tied holes since the last one won ride on this hole
  const carried = wolfCarryBefore(round, hole);
  // Blind wolf is honor system. It's offered whenever the rule is on for this hole (a round from before
  // it has no blind key, so no button), including on a saved hole, so a mis-tap can be fixed. A hole
  // saved blind keeps its button even if the rule was turned off later, and so does this pick while
  // it's being edited (tapping a partner by mistake never loses the way back).
  const blind = !!wolf.blind && wolf.partner === null;
  const offerBlind = blind || !!round.wolf?.[hole.no]?.blind || !!cfg.blind;
  // Picking a partner or plain lone wolf clears blind; the saved record only carries blind when it's on
  const pick = (partner, isBlind = false) => {
    const { blind: _was, ...rest } = wolf;
    setWolf(isBlind ? { ...rest, partner: null, blind: true } : { ...rest, partner });
  };
  return (
    <div className="wolf-panel">
      <div className="bl" style={{ marginBottom: setWolf ? 8 : 0 }}><Icon name="paw-print" fill /> <strong>{w?.name}</strong> is the wolf.{' '}
        {setWolf ? 'Pick a partner after the tee shots, or go it alone.'
          : wolf.partner === undefined ? 'No partner picked yet.' : blind ? 'Blind wolf.' : wolf.partner === null ? 'Lone wolf.' : `Partner: ${round.players.find(p => p.id === wolf.partner)?.name || '?'}.`}
      </div>
      {setWolf && <div className="chip-row" style={{ padding: 0 }}>
        {others.map(p => (
          <button key={p.id} className={`pill-btn ${wolf.partner === p.id ? 'on' : ''}`} aria-pressed={wolf.partner === p.id}
            onClick={() => pick(p.id)}>{p.name}</button>
        ))}
        <button className={`pill-btn lone ${wolf.partner === null && !blind ? 'on' : ''}`} aria-pressed={wolf.partner === null && !blind}
          onClick={() => pick(null)}><Icon name="paw-print" fill /> Lone wolf {mult}×</button>
        {offerBlind && <button className={`pill-btn lone ${blind ? 'on' : ''}`} aria-pressed={blind}
          onClick={() => pick(null, true)}><Icon name="eye-slash" fill /> Blind wolf {blindMult}×</button>}
      </div>}
      {setWolf && offerBlind && <p className="wolf-note">Blind wolf: call it before anyone tees off.</p>}
      {carried > 0 && <p className="wolf-note">{carried === 1 ? 'A tied hole is' : `${carried} tied holes are`} riding on this one: it pays {carried + 1}×.</p>}
    </div>
  );
}


// --------------------------- Hand off the card -----------------------------

/**
 * The keeper hands the card to another player. Only players whose phone took their seat can keep
 * score; watchers are never listed. Mounted only while open.
 */
function HandOffSheet({ round, me, dirty, onPick, onClose }) {
  const choices = handOffChoices(round).filter(c => c.id !== me);
  return (
    <Sheet open onClose={onClose} title="Hand off the card">
      <p className="sheet-text">Only players in this round can keep score.</p>
      {dirty && <p className="hint-card"><Icon name="info" fill /> Save this hole first, so your scores go with the card.</p>}
      {choices.map(c => (
        <button key={c.id} className="sheet-item" disabled={dirty || !c.onApp} onClick={() => onPick(c.id)}
          aria-label={c.onApp ? `Hand the card to ${c.name}` : `${c.name}, not on the app yet`}>
          <span><Icon name="user-circle" fill /> {c.name}</span>
          <span style={{ fontSize: 13 }}>{c.onApp ? <Icon name="caret-right" /> : 'Not on the app yet'}</span>
        </button>
      ))}
      <div className="cta-wrap"><button className="full-btn outline" onClick={onClose}>Keep the card</button></div>
    </Sheet>
  );
}
