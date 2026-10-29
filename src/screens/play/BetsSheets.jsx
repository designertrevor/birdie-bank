// The round menu's sheets for the money (Play.jsx): side games mid-round, and changing the bets in
// a round that's under way.
import { useMemo, useState } from 'react';
import { Icon, Numpad, Segmented, Sheet, useUI } from '../../components/ui.jsx';
import { DEFAULT_SETTINGS, update } from '../../lib/store.js';
import { GAMES, POT_GAMES, calcuttaEntriesOf, changeBets, gameKeyLabel, gameKeys, gameView, holeComplete, isTeamGame, matchScored, roundStarted, settingsAt, sideGamesOf, wholeRoundOnly } from '../../lib/round.js';
import { GameOptions } from '../../components/GameOptions.jsx';
import { SideGamesSetup } from '../../components/SideGames.jsx';
import { optionsProblem, sideBetLine, stakeSummary } from '../../lib/stakes.js';
import { countsMoney, inUnits, padUnit, unitFmt } from '../../lib/play-for.js';
import { gameLabel } from '../../lib/format.js';
import { potCatchUpNotes, sideExample } from '../../lib/side-games.js';
import { buzz } from '../../lib/delight.js';

// --------------------------- Bets & stakes --------------------------------

/**
 * Side games mid-round: add Skins, Junk or a Birdie pot without setting the round up again. The course,
 * players and scores stay; a new game counts every hole already scored, so the money catches up at once.
 * Any change to a game's bets here covers the whole round, so it drops that game's earlier bet
 * changes; the Bets sheet is where a bet changes from the next hole.
 */
export function GamesSheet({ round, onClose }) {
  const { showToast } = useUI();
  const [list, setList] = useState(() => structuredClone(sideGamesOf(round)));
  const edit = fn => setList(l => fn(sideGamesOf({ game: round.game, sideGames: l })));
  const bad = list.some(sg => optionsProblem(sg.game, { [sg.game]: sg.settings }));
  const changed = JSON.stringify(list) !== JSON.stringify(sideGamesOf(round));
  const played = round.holes.filter(h => holeComplete(round, h)).length;
  // The Calcutta's lots and buyers, as the round would play them with the games being edited
  const calView = list.some(sg => sg.game === 'calcutta') ? gameView({ ...round, sideGames: list }, 'calcutta') : null;
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
      <SideGamesSetup label={false} game={round.game} sideGames={list} setSideGames={edit} defaults={round.settings} players={round.players.length} playFor={round.playFor} holes={round.holes} holesCount={round.holes.length}
        entries={calView ? calcuttaEntriesOf(calView) : []} buyers={calView ? calView.players.map(p => ({ id: p.id, name: p.name })) : []} started={roundStarted(round)} />
      {/* A pot added partway: its holes already played count once the winner is tapped */}
      {potCatchUpNotes(round, list).map(t => <p key={t} className="field-help pad">{t}</p>)}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!changed || bad} onClick={save}>{changed ? 'Save games' : 'No changes yet'}</button>
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
export function BetsSheet({ round, onClose }) {
  const { showToast } = useUI();
  // The Calcutta's bets are its auction, kept under Side games, so it has no bet to change here
  const sides = sideGamesOf(round).filter(sg => sg.game !== 'calcutta');
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
  const pot = game === 'scramble' || game === 'birdies' || POT_GAMES.includes(game) || current[game]?.payout === 'pot' || opts[game]?.payout === 'pot';
  const layout = game === 'snake' ? 'Each nine or one snake is set' : isTeamGame(game) ? 'How the game is played (the bets, the scoring, the scores that count) is set' : 'Net, gross or both is set';
  const label = gameKeyLabel(round, gameKey);
  const apply = () => {
    update(s => {
      // A bet changed mid-round stays with this round: next time's defaults are the ones setup saved
      s.rounds[round.id] = changeBets(s.rounds[round.id], opts[game], whole ? null : fromPos, gameKey);
    });
    onClose();
    // A points or reward round reads in points
    showToast(inUnits(round, side
      ? `${label} bet updated${whole ? '' : ` from hole ${fromHole.no}`} · ${sideBetLine(game, opts[game])}`
      : `Bets updated${whole ? '' : ` from hole ${fromHole.no}`} · ${stakeSummary(game, opts, round.holes.length)}`));
    buzz(20);
  };
  const legs = game === 'nassau' || game === 'match' || game === 'rabbit' || game === 'snake' || (game === 'sixes' && opts.sixes.mode === 'match')
    || (isTeamGame(game) && opts[game]?.format !== 'hole');
  // A snake or rabbit is played for the bet in force when its leg started: one leg for the round, or
  // one a nine (or with "three rabbits", one every six holes). Say when the new bet starts counting, or
  // that only "Whole round" changes it
  const legStarts = game === 'snake' || game === 'rabbit'
    ? (round.holes.length !== 18 ? [1]
      : game === 'rabbit' && settingsAt(view, 1).rabbit?.sixes ? [1, 7, 13]
        : (game === 'snake' ? settingsAt(view, 1).snake?.nines : true) ? [1, 10] : [1]) : null;
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
              options={gameKeys(round).filter(k => k !== 'calcutta').map(k => ({ value: k, label: gameKeyLabel(round, k) }))} />
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
        {game === 'birdies' || POT_GAMES.includes(game) ? (
          // The Birdie, closest to the pin and long drive pots are side games only, so they have no
          // main-game options: just what each player puts in (the rest is under Side games)
          <>
            <div className="nassau-bet-row">
              <div className="nassau-bet-lbl">Each player puts in</div>
              <button className="nassau-bet-btn" aria-label={`Each player puts in: ${unitFmt(round)(get(`${game}.stake`) ?? 0)}. Change`}
                onClick={() => setPad({ path: `${game}.stake`, title: 'Each player puts in', min: 1, max: 500 })}>{unitFmt(round)(get(`${game}.stake`) ?? 0)}</button>
            </div>
            <p className="field-help pad">{inUnits(round, sideExample(game, opts[game], view.players.length, round.holes))}</p>
          </>
        ) : (
          <GameOptions game={game} get={get} set={set} onAmount={(path, title, o) => setPad({ path, title, ...o })} holesCount={round.holesCount}
            players={view.players.length} firstName={game === 'banker' ? round.players[0]?.name : null} inPoints={!countsMoney(round)}
            teamSize={!side && round.teams?.length ? Math.min(...round.teams.map(t => t.players.length)) : null} canTeam={!side && (round.teams?.length ?? 0) >= 2} />
        )}
        {game === 'banker' && <p className="hint-card"><Icon name="info" fill /> The default bet fills in from the next hole. Bets on this hole are set from the Bets button.</p>}
        {/* A team game played another way (changeBets clears the presses on the old legs) */}
        {!side && matchScored(round) && round.presses.length > 0 && whole && (isTeamGame(game) && wholeRoundOnly(game, current[game], opts[game])
          ? <p className="hint-card"><Icon name="lightning" fill /> The presses made so far go, since the bets are played another way.</p>
          : <p className="hint-card"><Icon name="lightning" fill /> Presses already made pay at the new amounts too.</p>)}
        {problem && <p className="field-error">{problem}</p>}
        <div className="cta-wrap">
          <button className="full-btn" disabled={!changed || !!problem || stuck} onClick={apply}>
            {!changed ? 'No changes yet' : stuck ? 'Pick Whole round to change it' : <>Update bets <Icon name="arrow-right" /></>}
          </button>
        </div>
      </Sheet>
      <Numpad open={!!pad} title={pad?.title} {...padUnit(round)} initial={pad ? get(pad.path) : ''} min={pad?.min} max={pad?.max}
        onClose={() => setPad(null)} onDone={v => { set(pad.path, v); setPad(null); }} />
    </>
  );
}
