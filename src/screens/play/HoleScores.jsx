// The hole's scrolling middle (Play.jsx): the notes and cards over the scores (the Calcutta's
// auction, "Any side bets?", this hole's side bets), the game's pickers, and a row per player or team
// with its par chips (ParChips.jsx), or the saved scores when this phone isn't keeping score.
import { Fragment, useEffect, useState } from 'react';
import { Icon } from '../../components/ui.jsx';
import { BuddyArt } from '../../components/BuddyArt.jsx';
import { AvatarArt } from '../../components/Avatar.jsx';
import { BBBPicker, DotsRow, PotPicker, SnakePicker } from '../../components/GamePanels.jsx';
import { ScrambleDrivesPicker } from '../../components/ScrambleDrives.jsx';
import { HoleBets } from '../../components/PairBets.jsx';
import { bankerPress, bankerPressAllNow, calcuttaSalesOf, isJustPlaying, popsFor, roundStarted, sideGamesOf, strokesFor } from '../../lib/round.js';
import { JUST_PLAYING_TAG } from '../../lib/just-playing.js';
import { netScoreName, pickupGross, scoreName } from '../../lib/golf.js';
import { halfStrokesOn, strokesWords } from '../../lib/allowances.js';
import { holeStrokeNotes, holeStrokeNoteText } from '../../lib/stroke-key.js';
import { DRIVE_GAMES } from '../../lib/scramble-drives.js';
import { unitFmt } from '../../lib/play-for.js';
import { firstName } from '../../lib/format.js';
import { ParChipRow, ScorePadSheet } from './ParChips.jsx';

/**
 * `entry` is useHoleDraft's state for the hole; `prompt` is useBetPrompt's. `faces` are the players'
 * avatars and `shortRowNames` their names as short as the rows need. `onRunAuction` opens Side games.
 */
export function HoleScores({ round, main, hole, game, solo, editable, sharedLive, holderName, me, units, faces, shortRowNames, entry, banker, wolf, prompt, onRunAuction }) {
  const { saved, draft, touched, counting, junk, snakeSide, pots, potHere, marks, setMarksDirty, numRefs, tapped, setScore } = entry;
  const { betPrompt, promptAdd, promptLater, promptSkip, promptOff } = prompt;
  // Whose number pad is up (a box's id), or null
  const [pad, setPad] = useState(null);
  // Two teams (Vegas, a 2 v 2): the rows sit together by side under the side's name, each with the
  // side's colour down its edge, so the scorer sees who's with whom. Anyone on no side goes last
  const sideOf = pid => round.teams?.length === 2 ? round.teams.findIndex(t => t.players.includes(pid)) : -1;
  const bySide = round.teams?.length === 2 && !units.some(u => u.team);
  const rows = bySide ? [...units].sort((a, b) => (sideOf(a.id) < 0 ? 9 : sideOf(a.id)) - (sideOf(b.id) < 0 ? 9 : sideOf(b.id))) : units;
  return (
    <div className="scroll">
      {!editable && sharedLive && <p className="field-help" style={{ padding: '0 20px' }}>{round.status === 'active' ? `Scores as ${holderName} saves them. Browse any hole.` : 'Only the players in this round can fix its scores.'}</p>}
      {/* A Calcutta's auction is before the first tee: until two lots are sold, say where to run it */}
      {editable && !solo && !roundStarted(round) && sideGamesOf(round).some(sg => sg.game === 'calcutta') && Object.keys(calcuttaSalesOf(round)).length < 2 && (
        <p className="hint-card calcutta-due"><Icon name="gavel" fill /> The Calcutta’s auction is before the first tee. <button className="link-btn inline" onClick={onRunAuction}>Run the auction</button></p>
      )}
      {betPrompt && <BetPromptCard prompt={betPrompt} onAdd={promptAdd} onLater={betPrompt.later ? promptLater : null} onSkip={promptSkip} onOff={promptOff} />}
      {!solo && <HoleBets round={round} hole={hole} editable={editable} me={me} />}
      {game === 'bbb' && editable && !solo && <BBBPicker round={main} hole={hole} marks={marks} setMarks={setMarksDirty} />}
      {DRIVE_GAMES.includes(game) && !solo && <ScrambleDrivesPicker round={main} hole={hole} marks={marks} setMarks={editable ? setMarksDirty : null} />}
      {game === 'snake' && editable && !solo && <SnakePicker round={main} hole={hole} marks={marks} setMarks={setMarksDirty} />}
      {snakeSide && editable && <SnakePicker round={snakeSide} hole={hole} marks={marks} setMarks={setMarksDirty} />}
      {potHere && <PotPicker pots={pots} hole={hole} marks={editable ? marks : round.marks?.[hole.no]} setMarks={setMarksDirty} readOnly={!editable} />}
      {!editable && units.map(p => {
        // Whole pops for the dots; with half strokes each counts as half (strokesWords says so). Nobody
        // just playing has a game to get strokes in
        const casual = isJustPlaying(round, p.id);
        const st = round.useHandicaps && !casual ? popsFor(round, p, hole) : 0;
        const v = saved[p.id];
        return (
          <div key={p.id} className="pcard score-row">
            {!p.team && faces.get(p.id) && <AvatarArt model={faces.get(p.id)} />}
            <div className="row-main">
              <div className="pname">{p.name}{casual && !solo && <span className="jp-tag">{JUST_PLAYING_TAG}</span>}{counting.includes(p.id) && <span className="counts-tag">Counts</span>}</div>
              <div className="ps">
                {st > 0 && <span className="stroke-dots"><span aria-hidden="true">{'●'.repeat(st)}</span> Gets {strokesWords(st, halfStrokesOn(round))}</span>}
                {!casual && holeStrokeNotes(round, p, hole).map(x => <span key={x.key} className="stroke-note"> · {holeStrokeNoteText(x)}</span>)}
                {v != null && v !== 'X' && <span className={`score-name s${Math.max(-2, Math.min(2, v - hole.par))}`}> {scoreName(v, hole.par)}</span>}
                {v === 'X' && <span> Picked up</span>}
              </div>
            </div>
            <div className="score-ctrl">
              <span className={`sc-num pc-num ${v == null ? 'untouched' : ''}`}>
                <span className="sr-only">{p.name} </span>{v == null ? <><span aria-hidden="true">–</span><span className="sr-only">no score yet</span></> : v === 'X' ? pickupGross(hole.par, st) : v}
              </span>
            </div>
          </div>
        );
      })}
      {editable && rows.map((p, i) => {
        const casual = isJustPlaying(round, p.id);
        const side = bySide ? sideOf(p.id) : -1;
        const sideHead = side >= 0 && (i === 0 || sideOf(rows[i - 1].id) !== side);
        // First names on the score rows (a last initial only when two share one), so a name
        // never wraps to two lines beside the buddy and the number
        const short = p.team ? p.name : shortRowNames.get(p.id) || p.name;
        const st = round.useHandicaps && !casual ? popsFor(round, p, hole) : 0;
        // Best ball and Shamble: whose score counts for the team, once the team's scores are all in
        const counts = counting.includes(p.id);
        const counted = round.useHandicaps && !casual ? strokesFor(round, p, hole) : 0;
        const v = draft[p.id];
        const isBanker = banker?.banker === p.id;
        const isWolf = wolf?.wolf === p.id;
        // The wolf's partner wears a tag too, so the score rows show the side, not just the wolf
        const isPartner = !!wolf?.partner && wolf.partner === p.id;
        const shown = v === 'X' ? pickupGross(hole.par, st) : v;
        return (
          <Fragment key={p.id}>
          {sideHead && <div className="side-head"><span className={`side-tag ${side ? 'b' : 'a'}`}>{side ? 'B' : 'A'}</span> {round.teams[side].name}</div>}
          <div className={`pcard score-row pc-row ${game === 'dots' || junk ? 'with-dots' : ''} ${isBanker || isWolf || isPartner ? 'bkr' : ''} ${side >= 0 ? `on-side side-${side ? 'b' : 'a'}` : ''}`}>
            <div className="pc-head">
              {!p.team && faces.get(p.id) && <AvatarArt model={faces.get(p.id)} />}
              <div className="row-main">
                <div className="pname" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {short}
                  {isBanker && <span className="bkr-badge"><Icon name="bank" fill /> Banker</span>}
                  {isWolf && <span className="bkr-badge"><Icon name="paw-print" fill /> Wolf</span>}
                  {isPartner && <span className="bkr-badge"><Icon name="handshake" fill /> Partner</span>}
                  {casual && !solo && <span className="jp-tag">{JUST_PLAYING_TAG}</span>}
                  {/* Only someone on a team gets its letter: anyone just playing (or only in the side games) is on none */}
                  {round.teams && !p.team && round.teams.some(t => t.players.includes(p.id)) && <span className={`side-tag ${round.teams.findIndex(t => t.players.includes(p.id)) === 0 ? 'a' : 'b'}`}>{['A', 'B', 'C', 'D'][round.teams.findIndex(t => t.players.includes(p.id))]}</span>}
                  {counts && <span className="counts-tag">Counts</span>}
                </div>
                {p.team && <div className="ps">{p.players.map(pid => round.players.find(x => x.id === pid)?.name.split(' ')[0]).join(', ')}{round.useHandicaps ? ` · team handicap ${p.courseHc ?? 0}` : ''}</div>}
                <div className="ps">
                  {st > 0 && <span className="stroke-dots"><span aria-hidden="true">{'●'.repeat(st)}</span> Gets {strokesWords(st, halfStrokesOn(round))}</span>}
                  {st < 0 && <span className="stroke-dots">Gives back {strokesWords(-st, halfStrokesOn(round))}</span>}
                  {!casual && holeStrokeNotes(round, p, hole).map(x => <span key={x.key} className="stroke-note"> · {holeStrokeNoteText(x)}</span>)}
                  {game === 'banker' && !isBanker && !casual && <span> Bet {unitFmt(round)(banker.bets[p.id] || 0)}{banker.doubled[p.id] ? ` · ${bankerPress(round, hole) ** (banker.doubleBack ? 2 : 1)}×` : banker.doubleBack && bankerPressAllNow(round, hole, banker) ? ` · ${bankerPress(round, hole)}×` : ''}</span>}
                  {touched[p.id] && v !== 'X' && <span className={`score-name s${Math.max(-2, Math.min(2, v - hole.par))}`}> {scoreName(v, hole.par)}{counted !== 0 && `, ${netScoreName(v - counted, hole.par)}`}</span>}
                  {v === 'X' && <span className="score-name pu"> Picked up, counts {shown}</span>}
                </div>
              </div>
              {/* The live region is the number alone, so the critter coming and going never re-reads the score.
                  Ink from the start: an untouched box is par, and it saves as par, so it reads like any score.
                  Who's still to tap shows on the chips (Par outlined, not filled), not in the number's colour */}
              <span ref={el => { numRefs.current[p.id] = el; }} className={`sc-num pc-num ${v !== 'X' && v < hole.par ? 'birdie' : ''}`}>
                <span aria-live="polite" aria-atomic="true">
                  <span className="sr-only">{p.name} </span>{v === 'X' ? <><span aria-hidden="true">X</span><span className="sr-only">picked up</span></> : v}
                </span>
                <ScoreCritter score={v} par={hole.par} fresh={tapped.has(p.id)} />
              </span>
            </div>
            <ParChipRow name={p.name} v={v} par={hole.par} touched={!!touched[p.id]} onScore={n => setScore(p.id, n)} onPad={() => setPad(p.id)} />
            {game === 'dots' && main.players.some(x => x.id === p.id) && <DotsRow round={main} player={p} hole={hole} marks={marks} setMarks={setMarksDirty} gross={touched[p.id] ? v : null} />}
            {junk && junk.players.some(x => x.id === p.id) && <DotsRow round={junk} player={p} hole={hole} marks={marks} setMarks={setMarksDirty} gross={touched[p.id] ? v : null} label={`${firstName(p.name)}’s junk`} />}
          </div>
          </Fragment>
        );
      })}
      {editable && units.length > 0 && <p className="pc-help">Everyone starts at par. Tap only what changed, or + for anything else.</p>}
      {editable && (() => {
        // The pad for one box, and Next through the rest in the order they're shown
        const at = rows.findIndex(u => u.id === pad);
        const unit = rows[at];
        const after = rows[at + 1];
        const casual = unit && isJustPlaying(round, unit.id);
        return (
          <ScorePadSheet open={!!unit} unit={unit} hole={hole} v={unit ? draft[unit.id] : null}
            strokes={unit && round.useHandicaps && !casual ? popsFor(round, unit, hole) : 0}
            onScore={n => setScore(unit.id, n)} next={after ? (after.team ? after.name : shortRowNames.get(after.id) || after.name) : null}
            onNext={() => setPad(after.id)} onClose={() => setPad(null)} />
        );
      })()}
    </div>
  );
}

// How long the birdie critter stays beside the score (the CSS pop and fade run the same length)
const CRITTER_MS = 2400;
/**
 * The birdie (or the eagle, for two under or better) beside a score the moment it's tapped under
 * par: it pops in, holds a beat and fades out, so it celebrates the tap instead of sitting on the
 * number. Only a score tapped on this phone brings it (`fresh`): one that was already there when
 * the hole opened doesn't, and the hole remounts on every save, so one birdie never pops twice.
 * A new score starts it over, so a birdie that becomes an eagle pops again.
 */
function ScoreCritter({ score, par, fresh = false }) {
  const [gone, setGone] = useState(false);
  const [at, setAt] = useState(score);
  if (at !== score) { setAt(score); setGone(false); }
  const up = fresh && !gone && typeof score === 'number' && score < par;
  useEffect(() => {
    if (!up) return;
    const t = setTimeout(() => setGone(true), CRITTER_MS);
    return () => clearTimeout(t);
  }, [up, score]);
  if (!up) return null;
  const eagle = score <= par - 2;
  return <span key={score} className="sc-critter" aria-hidden="true"><BuddyArt id={eagle ? 'eagle' : 'birdie'} bg={null} px={28} /></span>;
}

// --------------------------- Any side bets? -------------------------------

/**
 * "Any side bets on this hole?" (bet-prompt.js), folded to a chip over the scores so the players
 * keep the room: the chip opens the card, which says what it suggests, with one tap to add it (the
 * side bet editor opens filled in), one to put it off to later in the round (`onLater`, only when
 * the round has a later hole to ask on), one to put it away for the round, and a way to turn it off.
 * The chip's × puts it off the same way Not this hole does (or Not this round, with no later hole).
 */
function BetPromptCard({ prompt, onAdd, onLater = null, onSkip, onOff }) {
  // Put away, the card folds up and fades (bp-out) before the answer lands and it goes; adding a bet
  // opens the editor over it straight away instead
  const [out, setOut] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const away = fn => () => { if (out) return; setOut(true); setTimeout(fn, BP_OUT_MS); };
  if (!openCard) {
    return (
      <div className={`bp-wrap ${out ? 'out' : ''}`}>
        <div className="bp-chip-row" role="group" aria-labelledby="bp-title">
          <button type="button" className="bp-chip" aria-expanded="false" onClick={() => setOpenCard(true)}>
            <Icon name={prompt.kind === 'ctp' ? 'target' : 'hand-coins'} fill />
            <span id="bp-title">{prompt.title}</span>
            <Icon name="caret-down" />
          </button>
          <button type="button" className="bp-chip-x" aria-label={onLater ? 'Not this hole' : 'Not this round'} onClick={away(onLater || onSkip)}><Icon name="x" /></button>
        </div>
      </div>
    );
  }
  return (
    <div className={`bp-wrap ${out ? 'out' : ''}`}>
      <div className="bet-prompt" role="group" aria-labelledby="bp-title">
        <div className="bp-ic" aria-hidden="true"><Icon name={prompt.kind === 'ctp' ? 'target' : 'hand-coins'} fill /></div>
        <div className="bp-main">
          <div className="bp-title" id="bp-title">{prompt.title}</div>
          <div className="bp-text">{prompt.text}</div>
          <div className="bp-actions">
            <button className="pill-btn on" onClick={onAdd}><Icon name="plus" /> Add a side bet</button>
            {onLater && <button className="pill-btn ghost" onClick={away(onLater)}>Not this hole</button>}
            <button className="pill-btn ghost" onClick={away(onSkip)}>Not this round</button>
          </div>
          <button className="link-btn bp-off" onClick={away(onOff)}>Don’t ask again</button>
        </div>
      </div>
    </div>
  );
}
// How long the card takes to fold away: the row's 260ms fold in styles.css plus a beat, so it lands at nothing before it goes
const BP_OUT_MS = 300;
