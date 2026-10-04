// Handicaps and strokes during a round, from the round menu: on or off, each player's tee and
// course handicap, the Strokes given % and half strokes. Everything setup offers, changeable once
// the round is under way. A change counts for every hole, the ones already played too, and the
// sheet says whose strokes and money move before it's saved. The engine is changeHandicaps.
import { useState } from 'react';
import { Icon, Numpad, Sheet, Toggle, useUI } from './ui.jsx';
import { StrokesSetup } from './StrokesSetup.jsx';
import { update, useStore } from '../lib/store.js';
import { findCourse, teeDotStyle } from '../lib/courses.js';
import { changeHandicaps, sideGamesOf } from '../lib/round.js';
import { STROKE_SIDE_GAMES } from '../lib/allowances.js';
import { moneyLine, playsLine } from '../lib/hole-fix.js';
import { buzz } from '../lib/delight.js';

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
  const missing = useHc ? after.players.filter(p => p.index == null && p.courseHcOverride == null) : [];
  const padPlayer = after.players.find(p => p.id === padFor);

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
            <div className="sec-label">Players</div>
            <div style={{ padding: '0 16px' }}>
              {after.players.map(p => {
                const none = p.index == null && p.courseHcOverride == null;
                return (
                  <div key={p.id} className="list-item player-pick on hc-row">
                    <div className="row-main">
                      <div className="li-name">{p.name}</div>
                      <div className="li-sub">{p.plays ? `Gets ${p.plays} stroke${p.plays === 1 ? '' : 's'}` : 'No strokes'}</div>
                    </div>
                    <div className="pick-extra">
                      {course?.tees?.length > 1 && (
                        <div className="tee-chips" role="radiogroup" aria-label={`${p.name}’s tee`}>
                          {course.tees.map(t => (
                            <button key={t.name} role="radio" aria-checked={p.tee === t.name} className={`tee-chip ${p.tee === t.name ? 'active' : ''}`} onClick={() => edit(p.id, { tee: t.name })}>
                              <span className="tee-dot" style={teeDotStyle(t)} />{t.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <button className={`hc-chip ${none ? 'missing' : ''}`} onClick={() => setPadFor(p.id)}
                        aria-label={`${p.name}’s ${round.holesCount === 9 ? '9-hole handicap' : 'course handicap'}: ${hcText(p.courseHc ?? 0)}${none ? ', none, plays as 0' : p.courseHcOverride != null ? ', edited' : ''}. Change it`}>
                        {round.holesCount === 9 ? '9-hole handicap' : 'Course handicap'} <strong>{hcText(p.courseHc ?? 0)}</strong>{none ? ' · none, plays as 0' : p.courseHcOverride != null ? ' · edited' : ''} <Icon name="pencil-simple" />
                      </button>
                    </div>
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
          <button className="full-btn" disabled={same} onClick={apply}>{same ? 'No change yet' : <>Save for the whole round <Icon name="check" /></>}</button>
        </div>
      </Sheet>
      <Numpad open={!!padFor} title={`${padPlayer?.name}’s ${round.holesCount === 9 ? '9-hole ' : ''}course handicap`} initial={padPlayer ? padPlayer.courseHc ?? '' : ''}
        allowNegative min={-10} max={60} onClose={() => setPadFor(null)} onDone={v => { edit(padFor, { courseHc: v }); setPadFor(null); }} />
    </>
  );
}
