// Handicaps and strokes during a round, from the round menu: on or off, each player's tee and
// course handicap, the Strokes given % and half strokes. Everything setup offers, changeable once
// the round is under way. A change counts for every hole, the ones already played too, and the
// sheet says whose strokes and money move before it's saved. The engine is changeHandicaps.
import { useState } from 'react';
import { Icon, Numpad, Sheet, Toggle, useUI } from './ui.jsx';
import { StrokesSetup } from './StrokesSetup.jsx';
import { update, useStore } from '../lib/store.js';
import { findCourse, teeDotStyle } from '../lib/courses.js';
import { changeHandicaps, isJustPlaying, sideGamesOf } from '../lib/round.js';
import { STROKE_SIDE_GAMES } from '../lib/allowances.js';
import { moneyLine, playsLine } from '../lib/hole-fix.js';
import { buzz } from '../lib/delight.js';
import './handicaps-sheet.css';

const hcText = v => (v < 0 ? `+${-v}` : String(v));

/** Mounted only while open, so it starts from the round as it is each time. */
export function HandicapsSheet({ round, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const [useHc, setUseHc] = useState(round.useHandicaps !== false);
  const [opts, setOpts] = useState(() => ({ hcPct: round.hcPct ?? 100, halfStrokes: !!round.halfStrokes }));
  const [sides, setSides] = useState(() => structuredClone(sideGamesOf(round)));
  const [edits, setEdits] = useState({}); // pid -> { tee?, courseHc? }
  const [padFor, setPadFor] = useState(null);
  const set = (path, v) => setOpts(o => ({ ...o, [path]: v }));
  const edit = (pid, patch) => setEdits(e => ({ ...e, [pid]: { ...e[pid], ...patch } }));

  const sidePcts = Object.fromEntries(sides.filter(sg => STROKE_SIDE_GAMES.includes(sg.game)).map(sg => [sg.game, sg.hcPct ?? null]));
  const after = changeHandicaps(round, course, { useHandicaps: useHc, hcPct: opts.hcPct, halfStrokes: opts.halfStrokes, sidePcts, players: edits });
  const same = JSON.stringify({ u: after.useHandicaps, h: after.hcPct, x: !!after.halfStrokes, p: after.players, s: after.sideGames ?? null })
    === JSON.stringify({ u: round.useHandicaps !== false, h: round.hcPct, x: !!round.halfStrokes, p: round.players, s: round.sideGames ?? null });
  const strokes = same ? null : playsLine(round, after);
  const money = same ? null : moneyLine(round, after);
  // Someone just playing gets no strokes, so they have no handicap to set here
  const missing = useHc ? after.players.filter(p => !isJustPlaying(round, p.id) && p.index == null && p.courseHcOverride == null) : [];
  const padPlayer = after.players.find(p => p.id === padFor);
  // The tees: one pick for the group, and a player's own only when it's opened for them
  const [teeOpen, setTeeOpen] = useState(null);
  const playing = after.players.filter(p => !isJustPlaying(round, p.id));
  const manyTees = course?.tees?.length > 1;
  const groupTee = playing.length && playing.every(p => p.tee === playing[0].tee) ? playing[0].tee : null;
  const setAllTees = name => setEdits(e => Object.fromEntries([...Object.entries(e), ...playing.map(p => [p.id, { ...e[p.id], tee: name }])]));

  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      if (r) s.rounds[round.id] = changeHandicaps(r, course, { useHandicaps: useHc, hcPct: opts.hcPct, halfStrokes: opts.halfStrokes, sidePcts, players: edits });
    });
    onClose();
    showToast(useHc !== (round.useHandicaps !== false)
      ? `Handicaps ${useHc ? 'on' : 'off'}. Every hole is worked out again.`
      : 'Handicaps updated. Every hole is worked out again.');
    buzz(20);
  };

  return (
    <>
      <Sheet open={!padFor} onClose={onClose} title="Handicaps" className="sc-sheet">
        <p className="sheet-text">A change here counts for the whole round, holes already played too.</p>
        <div className="toggle-row">
          <div>
            <div className="toggle-lbl" id="hc-use-lbl">Play with handicaps</div>
            <div className="toggle-sub" id="hc-use-sub">{useHc ? 'Better players give strokes on the hardest holes' : 'Everyone plays straight up, no strokes'}</div>
          </div>
          <Toggle on={useHc} onChange={setUseHc} labelledBy="hc-use-lbl" describedBy="hc-use-sub" />
        </div>
        {useHc && (
          <>
            {/* The tees once for the group (most play the same), then a row a player: name, strokes,
                their handicap to edit, and their tees as one chip that opens the choice for them alone */}
            {manyTees && (
              <>
                <div className="sec-label">Tees</div>
                <div className="tee-chips hc-tees" role="radiogroup" aria-label="Everyone’s tees">
                  {course.tees.map(t => (
                    <button key={t.name} role="radio" aria-checked={groupTee === t.name} className={`tee-chip ${groupTee === t.name ? 'active' : ''}`} onClick={() => setAllTees(t.name)}>
                      <span className="tee-dot" style={teeDotStyle(t)} />{t.name}
                    </button>
                  ))}
                </div>
                <p className="field-help pad">{groupTee ? 'Everyone plays these. Tap a player’s tees below to change one.' : 'Not everyone plays the same tees. Tap one to put everyone on it.'}</p>
              </>
            )}
            <div className="sec-label">Players</div>
            <div className="hc-list">
              {playing.map(p => {
                const none = p.index == null && p.courseHcOverride == null;
                const tee = course?.tees?.find(t => t.name === p.tee);
                return (
                  <div key={p.id} className="hc-line">
                    <div className="hc-top">
                      <div className="li-name hc-name">{p.name}</div>
                      <div className="li-sub hc-sub">{p.plays ? `Gets ${p.plays} stroke${p.plays === 1 ? '' : 's'}` : 'No strokes'}</div>
                      {manyTees && (
                        <button className={`hc-chip tee-select ${teeOpen === p.id ? 'open' : ''}`} onClick={() => setTeeOpen(o => (o === p.id ? null : p.id))} aria-expanded={teeOpen === p.id}
                          aria-label={`${p.name}’s tees: ${p.tee || 'none'}. Change them`}>
                          {tee && <span className="tee-dot" style={teeDotStyle(tee)} />}{p.tee || 'Tees'}
                        </button>
                      )}
                      <button className={`hc-chip hc-num ${none ? 'missing' : ''} ${manyTees ? '' : 'alone'}`} onClick={() => setPadFor(p.id)}
                        aria-label={`${p.name}’s ${round.holesCount === 9 ? '9-hole handicap' : 'course handicap'}: ${hcText(p.courseHc ?? 0)}${none ? ', none, plays as 0' : p.courseHcOverride != null ? ', edited' : ''}. Change it`}>
                        <span className="hc-l">{round.holesCount === 9 ? '9-hole' : 'Handicap'}</span> <strong>{hcText(p.courseHc ?? 0)}</strong>{none ? ' · none' : p.courseHcOverride != null ? ' · edited' : ''} <Icon name="pencil-simple" />
                      </button>
                    </div>
                    {manyTees && teeOpen === p.id && (
                      <div className="tee-chips hc-own-tees" role="radiogroup" aria-label={`${p.name}’s tees`}>
                        {course.tees.map(t => (
                          <button key={t.name} role="radio" aria-checked={p.tee === t.name} className={`tee-chip ${p.tee === t.name ? 'active' : ''}`} onClick={() => { edit(p.id, { tee: t.name }); setTeeOpen(null); }}>
                            <span className="tee-dot" style={teeDotStyle(t)} />{t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {missing.length > 0 && (
              <p className="hint-card warn"><Icon name="warning" fill /> {missing.length === after.players.length
                ? 'Nobody has a handicap, so nobody gets strokes. Tap a course handicap to set it.'
                : `${missing.map(p => p.name.split(' ')[0]).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no handicap, so they play as scratch (0) and everyone else gets strokes from them.`}</p>
            )}
            {round.game !== 'bbb' && (
              <StrokesSetup game={round.game} teams={round.teams?.map(t => t.players) || null} players={round.players.length}
                opts={opts} set={set} sideGames={sides} setSideGames={setSides} settings={round.settings?.[round.game]} />
            )}
          </>
        )}
        {(strokes || money) && (
          <div className="hint-card fix-impact" role="status">
            <Icon name="scales" fill />
            <div>
              <div className="eyebrow">What this changes</div>
              {strokes && <p>{strokes}</p>}
              {money && <p><strong>{money}</strong></p>}
            </div>
          </div>
        )}
        <div className="cta-wrap">
          <button className="full-btn" disabled={same} onClick={apply}>{same ? 'No changes yet' : <>Save for the whole round <Icon name="check" /></>}</button>
        </div>
      </Sheet>
      <Numpad open={!!padFor} title={`${padPlayer?.name}’s ${round.holesCount === 9 ? '9-hole ' : ''}course handicap`} initial={padPlayer ? padPlayer.courseHc ?? '' : ''}
        allowNegative min={-10} max={60} onClose={() => setPadFor(null)} onDone={v => { edit(padFor, { courseHc: v }); setPadFor(null); }} />
    </>
  );
}
