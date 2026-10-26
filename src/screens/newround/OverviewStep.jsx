// Round setup's overview (NewRound.jsx, Layout Lab A "Summary first"): every choice on one screen,
// each a row with what's picked and Change. The first time through, the steps run in order from
// here and land back on it; after that a row opens just its step, which comes straight back.
// Run it back sits on top while nothing is set up yet. The rows come from setup-overview.js.
// Also here: the two choices only the overview opens on their own, handicaps and what it's played for.
import { Icon, Toggle } from '../../components/ui.jsx';
import { GameArt } from '../../components/GameArt.jsx';
import { StrokesSetup } from '../../components/StrokesSetup.jsx';
import PlayForPicker from '../../components/PlayFor.jsx';
import { gameLabel } from '../../lib/format.js';
import { roundStakeLines } from '../../lib/stakes.js';
import './overview.css';

const NEXT = ['Pick a game', 'Pick a course', 'Pick the players', 'Set the bets'];

/**
 * `rows`: overviewRows. `passDone`: the first pass is through, so the main button makes the round.
 * `again`: the last round to Run it back ({ round, course }), shown while nothing is set up.
 * `next`: the step the first pass goes on with. `onLater`: Schedule for later (null hides it).
 */
export function OverviewStep({ rows, passDone, next, ready, again = null, onAgain, onOpen, onNext, onCreate, onLater = null, laterOk = false, hints = null, tripRow = null }) {
  const u = again?.round;
  return (
    <>
      <div className="scroll">
        {u && !passDone && (
          <button className="ov-again" onClick={onAgain}>
            <span className="ov-again-text">
              <span className="eyebrow">Run it back</span>
              <span className="ov-again-title">{gameLabel(u)} · {again.course.name}</span>
              <span className="ov-again-sub">{u.players.map(p => p.name.split(' ')[0]).join(', ')} · {u.holesCount} holes · {roundStakeLines(u, { since: false }).map(l => l.line).join(' + ')}</span>
              <span className="ov-again-btn"><Icon name="arrow-counter-clockwise" /> Set it up again</span>
            </span>
            <GameArt game={u.game} className="ov-again-art" />
          </button>
        )}
        <div className="ov-head">
          <h2 className="ov-title">{passDone ? 'Look it over' : u ? 'Or start fresh' : 'Set up a round'}</h2>
          <p className="ov-lede">{passDone ? 'Tap any line to change it.' : 'Pick the game first. The rest follows in order, then comes back here.'}</p>
        </div>
        {hints}
        <div className="ov-list" role="list">
          {rows.map(r => (
            <button key={r.key} role="listitem" className={`ov-row ${r.state}`} disabled={!r.open} onClick={() => onOpen(r.step)}
              aria-label={`${r.label}: ${r.value || 'not set yet'}${r.note ? `. ${r.note}` : ''}. ${r.state === 'todo' ? 'Pick' : 'Change'}`}>
              <span className="ov-main">
                <span className="ov-label">{r.label}</span>
                <span className="ov-value">{r.value || <span className="ov-empty">Not set yet</span>}</span>
                {r.note ? <span className="ov-note"><Icon name="warning-circle" fill /> {r.note}</span> : r.sub && <span className="ov-sub">{r.sub}</span>}
              </span>
              <span className="ov-change">{r.state === 'todo' ? 'Pick' : r.state === 'fix' ? 'Fix' : 'Change'}</span>
            </button>
          ))}
        </div>
        {tripRow && <div className="trip-in-setup">{tripRow}</div>}
      </div>
      <div className="cta-wrap">
        {passDone
          ? <button className="full-btn" disabled={!ready} onClick={onCreate}>Create round <Icon name="arrow-right" /></button>
          : <button className="full-btn" onClick={onNext}>{NEXT[next ?? 3]} <Icon name="arrow-right" /></button>}
        {onLater && <button className="text-link cta-link" disabled={!laterOk} onClick={onLater}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
    </>
  );
}

/** Handicaps on their own, from the overview's Handicaps row: on or off, and the strokes given. */
export function HandicapsStep({ game, teams, players, opts, setOpts, useHc, setUseHc, sideGames, setSideGames, onDone }) {
  // The same path setter as the Bets step's (SetupStep.jsx), so the strokes read and save the same
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  return (
    <>
      <div className="scroll">
        <div className="toggle-row">
          <div><div className="toggle-lbl" id="ov-hc-lbl">Use handicaps</div><div className="toggle-sub">{game === 'quota' ? 'Sets each player’s quota from their course handicap' : 'Better players give strokes to the others on the hardest holes'}</div></div>
          <Toggle on={useHc} onChange={setUseHc} labelledBy="ov-hc-lbl" />
        </div>
        {useHc && <StrokesSetup game={game} teams={teams} players={players} opts={opts} set={set} sideGames={sideGames} setSideGames={setSideGames} />}
        <p className="field-help pad">Each player’s handicap and tees are on Players.</p>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onDone}>Done <Icon name="check" /></button>
      </div>
    </>
  );
}

/** What it's played for on its own, from the overview's Playing for row. */
export function PlayForStep({ playFor, setPlayFor, onDone }) {
  return (
    <>
      <div className="scroll">
        <PlayForPicker value={playFor} onChange={setPlayFor} />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onDone}>Done <Icon name="check" /></button>
      </div>
    </>
  );
}
