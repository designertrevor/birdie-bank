import { useEffect, useMemo, useRef, useState } from 'react';
import { Empty, Icon, Screen, Sheet, useUI } from '../components/ui.jsx';
import { useGroupAvatars } from '../lib/useAvatars.js';
import { RulesSheet } from '../components/Rules.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { roundProps, track } from '../lib/analytics.js';
import { SIDE_GAMES, bankerHoleSetup, cardOnly, gameView, holeComplete, holeFixOf, livePreview, potMarksFor, roundResults, scorers, wolfHoleSetup } from '../lib/round.js';
import { CourseTeeSheet, FixHoleSheet } from '../components/FixHole.jsx';
import { HandicapsSheet } from '../components/HandicapsSheet.jsx';
import { LineupSheet } from '../components/LineupSheet.jsx';
import { PlayForSheet } from '../components/PlayForSheet.jsx';
import { markUsualPlayed } from '../lib/usuals.js';
import { strokesRulesLines } from '../lib/allowances.js';
import { useNav } from '../lib/nav.js';
import { dropKept, useKept, useKeptScope } from '../lib/kept.js';
import { Scorecard } from '../components/Scorecard.jsx';
import { ShareSheet } from '../components/Live.jsx';
import { useSeatRequests } from '../lib/sync.js';
import { AddPlayerSheet } from '../components/AddPlayer.jsx';
import { shortNames } from '../lib/short-names.js';
import { leaveRound } from '../lib/rounds.js';
import { RoundsInProgressSheet } from '../components/RoundsInProgress.jsx';
import { PairBetsSheet } from '../components/PairBets.jsx';
import { BIG_FORMAT } from '../lib/big-game.js';
import { pushRoundFinished } from '../lib/push-client.js';
import { useBigSync } from '../lib/big-sync.js';
import { RoundMoments } from '../components/Moments.jsx';
import { roundTheme, themeVars } from '../lib/round-theme.js';
import { FirstTeeSheet } from '../components/FirstTee.jsx';
import { canEdit, keeperMe, keeperName, shouldLeaveHole } from '../lib/keeper.js';
import { holeMountKey, nextHoleIdx } from '../lib/play-screen.js';
// The pieces of the round in progress, one file each (src/screens/play/)
import { FINISHED_HERE, dropDrafts, useWakeLock } from './play/shared.js';
import { useHoleDraft } from './play/useHoleDraft.js';
import { useBetPrompt, useFirstTee } from './play/useHoleCards.js';
import { useKeeperCard } from './play/useKeeperCard.js';
import { useHoleSave } from './play/useHoleSave.js';
import { HoleMeta, PlayBanners, PlayHeader } from './play/PlayTop.jsx';
import { BankerSheets, HolePanels } from './play/HolePanels.jsx';
import { HoleScores } from './play/HoleScores.jsx';
import { RoundMenu } from './play/RoundMenu.jsx';
import { HandOffSheet, HolesSheet, LeftSheet } from './play/RoundSheets.jsx';
import { BetsSheet, GamesSheet } from './play/BetsSheets.jsx';

export default function Play({ id }) {
  const round = useStore(s => s.rounds[id]);
  const nav = useNav();
  const { showToast } = useUI();
  // A Big Game's group round: the other groups' scores keep coming in for the board (big-sync.js)
  useBigSync({ live: round?.trip?.format === BIG_FORMAT && round?.status === 'active' });
  // Whether a moment banner is up, so the "Any side bets?" card waits for it (it outlives the hole's remount)
  const [momentUp, setMomentUp] = useState(false);
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
    dropDrafts(id);
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
  // A match won before the last hole: the keeper can end the round there (the holes played count)
  const finishHere = () => {
    FINISHED_HERE.add(id);
    dropDrafts(id);
    update(s => { const rr = s.rounds[id]; rr.status = 'done'; rr.finishedAt = Date.now(); markUsualPlayed(s, rr, rr.finishedAt); leaveRound(s, id); });
    pushRoundFinished(getState().rounds[id]);
    track('round_finished', roundProps(getState().rounds[id], { early: true }));
    nav.reset('history', ['roundDetail', { id, celebrate: true }]);
  };
  const keeps = canEdit(round, keeperMe(round, { me: getState().me }), !!round.shared?.host);
  // Remount when this hole changes on another phone so the fresh scores show, when someone leaves,
  // comes back or is added partway through, when a side game is added, when the playing order or the
  // sides change, and when this hole's par is fixed (see holeMountKey)
  const mount = holeMountKey(round);
  return (
    <>
      <PlayRound key={mount} mount={mount} round={round} momentUp={momentUp} />
      {/* Outside the hole, which remounts on every save, so it sees the hole that was just scored */}
      <RoundMoments round={round} onFinish={keeps ? finishHere : null} onShowing={setMomentUp} />
    </>
  );
}

/**
 * The hole on screen. It remounts on every save (and on the changes holeMountKey lists), so its
 * state starts fresh for each hole; what's open on it is kept by `mount` so a reload brings it back.
 */
function PlayRound({ round, mount, momentUp = false }) {
  useWakeLock();
  // What's open on this hole comes back after a reload (the hole remounts on every save, which closes it)
  const scope = useKeptScope();
  const at = `hole:${mount}:`;
  useEffect(() => { if (scope != null) dropKept(scope, 'hole:', at); }, [scope, at]);
  const useHole = (name, initial) => useKept(at + name, initial);
  const { showToast } = useUI();
  const idx = Math.min(round.current, round.holes.length - 1);
  const hole = round.holes[idx];
  const isLast = idx === round.holes.length - 1;
  const game = round.game;
  const units = scorers(round, hole); // players still playing, or teams in a one-ball game (scramble, alternate shot, Chapman)
  const faces = useGroupAvatars(round.players);
  const shortRowNames = useMemo(() => shortNames(round.players.map(p => [p.id, p.name])), [round.players]);
  // The main game's own round: without anyone who's only in the side games, so they never enter a
  // wolf rotation, the banker's bets, the Sixes pairings or a head-to-head's sides
  const main = useMemo(() => gameView(round, 'main'), [round]);
  // Everyone just playing (a card kept from an invite): no game, no money, no panels, just the card
  const solo = cardOnly(round);
  // The main game's theme, carried in from Round ready: the money bar's band, the hole tile and the
  // progress line take its colour (a card only round has none and keeps the plain look)
  const theme = roundTheme(round);
  // Who keeps score (shared rounds): only that phone edits, the other players read (see keeper.js)
  const stateMe = useStore(s => s.me);
  const me = keeperMe(round, { me: stateMe });
  const isHost = !!round.shared?.host;
  const editable = canEdit(round, me, isHost);

  // The scores and marks being entered, before Save (useHoleDraft.js)
  const entry = useHoleDraft({ round, hole, units, main, game, editable, showToast });
  const { dirty, draft, touched, marks, setMarksDirty } = entry;
  const [banker, setBanker] = useHole('banker', () => (game === 'banker' ? structuredClone(bankerHoleSetup(main, idx)) : null));
  const [phase, setPhase] = useHole('phase', () => (game === 'banker' && editable && !holeComplete(round, hole) ? 'bets' : 'scores'));
  const [wolf, setWolf] = useHole('wolf', () => (game === 'wolf' ? wolfHoleSetup(main, idx) : null));
  const [menu, setMenu] = useHole('menu', false);
  const [leftSheet, setLeftSheet] = useHole('leftSheet', false);
  const [card, setCard] = useHole('card', false);
  // Which game's rules are open ('main' or a side game's key); the key stays while the sheet closes
  const [rules, setRules] = useHole('rules', { key: 'main', open: false });
  const [betPad, setBetPad] = useHole('betPad', null);
  const [bankerPick, setBankerPick] = useHole('bankerPick', false);
  const [live, setLive] = useHole('live', false);
  const [holesSheet, setHolesSheet] = useHole('holesSheet', false);
  const [betsSheet, setBetsSheet] = useHole('betsSheet', false);
  const [gamesSheet, setGamesSheet] = useHole('gamesSheet', false);
  const [pairSheet, setPairSheet] = useHole('pairSheet', false);
  // A new side bet started from the "Any side bets?" card: { kind, holes }
  const [pairStart, setPairStart] = useHole('pairStart', null);
  const [switching, setSwitching] = useHole('switching', false);
  const [addSheet, setAddSheet] = useState(null); // true, or the seat request being answered
  const [handSheet, setHandSheet] = useHole('handSheet', false);
  const [fixSheet, setFixSheet] = useHole('fixSheet', null); // 'hole' | 'tee' | 'hc' | 'lineup' | 'playFor'
  const holeFixed = !!holeFixOf(round, hole.no);
  const requests = useSeatRequests(round.id);

  // The first-tee rules card, then "Any side bets on this hole?" (useHoleCards.js)
  const tee = useFirstTee({ round, at, editable, solo, me, showToast });
  // Never over the first-tee card, which comes first on hole 1
  const cardUp = tee.firstTee || tee.watchCard || !!tee.agreedSheet;
  const prompt = useBetPrompt({ round, idx, me, editable, momentUp, cardUp, dirty, showToast, onAdd: setPairStart });

  // Keeping score in a shared round (useKeeperCard.js)
  const keeping = useKeeperCard({ round, me, isHost, hole, idx, showToast, onHandedOff: () => setHandSheet(false) });

  // Where "Save" takes you: the next hole, or the first unscored hole after this one when fixing an earlier score
  const nextIdx = useMemo(() => nextHoleIdx(round, idx), [round, idx]);
  const { saveHole, doneEditing, endEarly } = useHoleSave({
    round, hole, isLast, nextIdx, units, game, editable, me, isHost, solo, draftKey: entry.draftKey, dirty, draft, marks, banker, wolf, closeMenu: () => setMenu(false),
  });

  const goHole = i => update(s => { s.rounds[round.id].current = i; });

  const results = useMemo(() => roundResults(round), [round]);
  // Money with this hole counted as it's being entered, so totals move with every tap
  const preview = useMemo(() => {
    const counting = phase === 'scores' && dirty && !(game === 'wolf' && wolf.partner === undefined);
    return livePreview(round, hole, counting ? { scores: draft, banker, wolf, marks: potMarksFor(round, hole, marks) } : null);
  }, [round, hole, phase, dirty, game, draft, banker, wolf, marks]);

  return (
    <Screen className={`play ${theme ? 'themed' : ''}`} style={themeVars(theme)}>
      <PlayHeader round={round} idx={idx} hole={hole} game={game} solo={solo} theme={theme} preview={preview} onLive={() => setLive(true)} onMenu={() => setMenu(true)} />
      <PlayBanners round={round} card={keeping} editable={editable} dirty={dirty} requests={requests} doneEditing={doneEditing} onLetIn={setAddSheet} />
      <HoleMeta round={round} hole={hole} units={units} solo={solo} holeFixed={holeFixed} onOpen={() => setCard(true)} />

      {!solo && (
        <HolePanels main={main} game={game} hole={hole} editable={editable} banker={banker} setBanker={setBanker} phase={phase} setPhase={setPhase}
          wolf={wolf} setWolf={setWolf} draft={draft} touched={touched} marks={marks} setMarks={setMarksDirty} results={results}
          onBankerPick={() => setBankerPick(true)} onBet={pid => setBetPad(pid)} onSkinsBet={() => setBetsSheet(true)} />
      )}

      {phase === 'scores' && (
        <HoleScores round={round} main={main} hole={hole} game={game} solo={solo} editable={editable} sharedLive={keeping.sharedLive} holderName={keeping.holderName} me={me}
          units={units} faces={faces} shortRowNames={shortRowNames} entry={entry} banker={banker} wolf={wolf} prompt={prompt} onRunAuction={() => setGamesSheet(true)} />
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

      <RoundMenu open={menu} onClose={() => setMenu(false)} round={round} hole={hole} game={game} editable={editable} solo={solo} me={me} amKeeper={keeping.amKeeper}
        onCard={() => setCard(true)} onBets={() => setBetsSheet(true)} onLive={() => setLive(true)} onFix={setFixSheet} onGames={() => setGamesSheet(true)}
        onPairs={() => setPairSheet(true)} onAgreed={tee.setAgreedSheet} onRules={k => setRules({ key: k, open: true })} onHand={() => setHandSheet(true)}
        onAdd={() => setAddSheet(true)} onLeft={() => setLeftSheet(true)} onHoles={() => setHolesSheet(true)} onSwitch={() => setSwitching(true)}
        doneEditing={doneEditing} endEarly={endEarly} />
      {gamesSheet && <GamesSheet round={round} onClose={() => setGamesSheet(false)} />}
      {(pairSheet || pairStart) && (
        <PairBetsSheet key={pairStart ? 'start' : 'menu'} round={round} editable={editable} me={me} start={pairStart}
          onClose={() => { setPairSheet(false); setPairStart(null); }} />
      )}
      <RoundsInProgressSheet open={switching} onClose={() => setSwitching(false)} currentId={round.id} />
      {holesSheet && <HolesSheet round={round} onClose={() => setHolesSheet(false)} />}
      {betsSheet && <BetsSheet round={round} onClose={() => setBetsSheet(false)} />}
      {handSheet && <HandOffSheet round={round} me={me} dirty={dirty} onPick={keeping.giveCard} onClose={() => setHandSheet(false)} />}
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
      {fixSheet === 'hc' && editable && <HandicapsSheet round={round} onClose={() => setFixSheet(null)} />}
      {fixSheet === 'lineup' && editable && <LineupSheet round={round} onClose={() => setFixSheet(null)} />}
      {fixSheet === 'playFor' && editable && <PlayForSheet round={round} onClose={() => setFixSheet(null)} />}
      <RulesSheet game={rules.key === 'main' ? game : rules.key} open={rules.open} onClose={() => setRules(r => ({ ...r, open: false }))}
        title={rules.key === 'dots' ? `How to play ${SIDE_GAMES.dots.label}` : undefined}
        sub={rules.key === 'dots' ? 'A side game · Dots, garbage, trash' : undefined} strokes={strokesRulesLines(round, rules.key)} />
      <ShareSheet round={round} open={live} onClose={() => setLive(false)} />
      {(tee.firstTee || tee.agreedSheet === 'lock') && (
        <FirstTeeSheet key="lock" round={round} open mode="lock" canEdit initial={getState().firstTee} onLock={tee.lockIn} onSkip={tee.skipCard} />
      )}
      {(tee.agreedSheet === 'view' || tee.watchCard) && (
        <FirstTeeSheet key="view" round={round} open mode="view" canEdit={editable} me={me} onCalls={tee.setCalls} onClose={tee.closeView} />
      )}
      {game === 'banker' && (
        <BankerSheets round={round} main={main} hole={hole} banker={banker} setBanker={setBanker} picking={bankerPick} setPicking={setBankerPick} betPad={betPad} setBetPad={setBetPad} />
      )}
    </Screen>
  );
}
