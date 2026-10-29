// Round setup's overview (NewRound.jsx, Layout Lab A "Summary first"): every choice on one screen,
// each a row with what's picked and Change. The first time through, the steps run in order from
// here and land back on it; after that a row opens just its step, which comes straight back.
// Run it back sits on top while nothing is set up yet. The rows come from setup-overview.js.
// Also here: the two choices only the overview opens on their own, handicaps and what it's played for.
import { Icon, Segmented } from '../../components/ui.jsx';
import { Spot } from '../../components/Spot.jsx';
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
// An amount stays with the words it goes with ("$2 default bet", "$5 a skin"), so a wrap never leaves "$2" on one line and its words on the next
const keepWhole = line => line.replace(/(\$[\d.,]+) (default bet|a skin|a side|a point|a hole|each)/g, (m, a, w) => `${a}\u00a0${w.replace(/ /g, '\u00a0')}`);

export function OverviewStep({ rows, passDone, next, ready, again = null, onAgain, onOpen, onNext, onCreate, onLater = null, laterOk = false, hints = null, tripRow = null }) {
  const u = again?.round;
  // A row that can't open yet says what it waits on ("Pick the game first"), instead of fading out unexplained
  const waitOn = rows.find(r => r.open && r.state === 'todo');
  return (
    <>
      <div className="scroll">
        {u && !passDone && (
          <button className="ov-again" onClick={onAgain}>
            <span className="ov-again-text">
              <span className="eyebrow">Run it back</span>
              <span className="ov-again-title">{gameLabel(u)} · {again.course.name}</span>
              <span className="ov-again-sub">{u.players.map(p => p.name.split(' ')[0]).join(', ')} · {u.holesCount} holes · {roundStakeLines(u, { since: false }).map(l => keepWhole(l.line)).join(' + ')}</span>
              <span className="ov-again-btn"><Icon name="arrow-counter-clockwise" /> Set it up again</span>
            </span>
            <GameArt game={u.game} className="ov-again-art" />
          </button>
        )}
        {/* Under Run it back, starting fresh is the second way in, a section heading rather than the page's
            biggest line. Look it over needs no lede: every row carries its own Change */}
        <div className="ov-head">
          <h2 className={`ov-title ${u && !passDone ? 'second' : ''}`}>{passDone ? 'Look it over' : u ? 'Or start fresh' : 'Set up a round'}</h2>
          {!passDone && <p className="ov-lede">Pick the game first. The rest follows in order, then comes back here.</p>}
        </div>
        {hints}
        <div className="ov-list">
          {rows.map(r => (
            <button key={r.key} className={`ov-row ${r.state}`} disabled={!r.open} onClick={() => onOpen(r.step)}
              aria-label={`${r.label}: ${r.value || 'not set yet'}${r.note ? `. ${r.note}` : ''}. ${r.state === 'todo' ? 'Pick' : 'Change'}`}>
              <span className="ov-main">
                <span className="ov-label">{r.label}</span>
                <span className="ov-value">{r.value || <span className="ov-empty">Not set yet</span>}</span>
                {r.note ? <span className="ov-note"><Icon name="warning-circle" fill /> {r.note}</span>
                  : !r.open && waitOn ? <span className="ov-sub">Pick the {waitOn.label.toLowerCase()} first</span>
                  : r.sub && <span className="ov-sub">{r.sub}</span>}
              </span>
              {/* A row waiting on the game has no chip: it isn't tappable yet, and its sub line says what it waits on */}
              {r.open && <span className="ov-change">{r.state === 'todo' ? 'Pick' : r.state === 'fix' ? 'Fix' : 'Change'}</span>}
            </button>
          ))}
        </div>
        {tripRow && <div className="trip-in-setup">{tripRow}</div>}
      </div>
      <div className="cta-wrap">
        {passDone
          ? <button className="full-btn" disabled={!ready} onClick={onCreate}>Create round <Icon name="arrow-right" /></button>
          : <button className="full-btn" onClick={onNext}>{NEXT[next ?? 3]} <Icon name="arrow-right" /></button>}
        {/* Once there's a game to schedule; before that it was a faded link that read as broken */}
        {onLater && laterOk && <button className="text-link cta-link" onClick={onLater}><Icon name="calendar-plus" /> Schedule for later</button>}
      </div>
    </>
  );
}

/** Handicaps on their own, from the overview's Handicaps row: on or off, and the strokes given. */
export function HandicapsStep({ game, teams, players, opts, setOpts, useHc, setUseHc, sideGames, setSideGames, onDone, onPlayers = null }) {
  // The same path setter as the Bets step's (SetupStep.jsx), so the strokes read and save the same
  const set = (path, v) => setOpts(o => { const n = structuredClone(o); const k = path.split('.'); let t = n; for (const x of k.slice(0, -1)) t = t[x]; t[k.at(-1)] = v; return n; });
  return (
    <>
      <div className="scroll">
        {/* The same choice, the same control, as on the Players step */}
        <div className="block hc-choice">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Play with handicaps?</div>
          <Segmented label="Play with handicaps" value={useHc ? 'on' : 'off'} onChange={v => setUseHc(v === 'on')}
            options={[{ value: 'off', label: 'No, play even' }, { value: 'on', label: 'Yes' }]} />
          <p className="field-help">{!useHc ? 'Everyone plays straight up, no strokes.' : game === 'quota' ? 'Sets each player’s quota from their course handicap.' : 'Better players give strokes to the others on the hardest holes.'}</p>
        </div>
        {useHc && <StrokesSetup game={game} teams={teams} players={players} opts={opts} set={set} sideGames={sideGames} setSideGames={setSideGames} />}
        {/* A way there, not just a mention, once there's a course for the players' tees */}
        <p className="field-help pad">Each player’s handicap and tees are on {onPlayers ? <button type="button" className="link-btn inline" onClick={onPlayers}>Players</button> : 'Players'}.</p>
        {/* A drawing in the room under the one card, so the step reads calm, not unfinished */}
        {!useHc && <Spot kind="tee" size={120} className="ov-step-spot" />}
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
        {/* The step's title asks the question, so no PLAY FOR eyebrow inside the card repeating it */}
        <PlayForPicker value={playFor} onChange={setPlayFor} label={false} />
        <Spot kind="coinstack" size={120} className="ov-step-spot" />
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onDone}>Done <Icon name="check" /></button>
      </div>
    </>
  );
}
