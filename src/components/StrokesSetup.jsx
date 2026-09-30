// Setup: Strokes given (one % for the round, or "Set by game" for a % per game) and Half strokes.
// The logic lives in lib/allowances.js; this is only the rows.
import { useState } from 'react';
import { Segmented, Toggle } from './ui.jsx';
import { GAMES, SIDE_GAMES } from '../lib/round.js';
import { STROKE_SIDE_GAMES, allowanceHint, halfStrokesOffered, strokesGivenOptions, suggestedAllowance } from '../lib/allowances.js';

/** One Strokes given choice with its WHS hint and the one-tap pill. */
function PctPicker({ label, value, onChange, whs }) {
  return (
    <>
      <Segmented label={label} className="press-mode-row" btn="pm-btn" value={value} onChange={onChange}
        options={strokesGivenOptions(whs, value).map(n => ({ value: n, label: n === 100 ? 'Full' : `${n}%` }))} />
      {whs ? (
        <div className="whs-hint">
          <p className="field-help">{allowanceHint(whs)}</p>
          {(value ?? 100) !== whs.pct && (
            <button className="pill-btn sm" onClick={e => {
              // The pill goes away once used, so keep focus on the choice it just made
              const group = e.currentTarget.closest('.pct-game') || e.currentTarget.closest('.block');
              onChange(whs.pct);
              setTimeout(() => group?.querySelector('[role="radio"][aria-checked="true"]')?.focus(), 0);
            }}>Use {whs.pct === 100 ? 'full strokes' : `${whs.pct}%`}</button>
          )}
        </div>
      ) : null}
    </>
  );
}

/**
 * `opts.hcPct` is the round's % (the main game's), `sideGames[i].hcPct` a side game's own. With
 * "Set by game" off no side game has its own, so every game plays off the one %, as rounds always did.
 */
export function StrokesSetup({ game, teams, players, opts, set, sideGames = [], setSideGames }) {
  const withStrokes = sideGames.filter(sg => STROKE_SIDE_GAMES.includes(sg.game));
  const [byGame, setByGame] = useState(() => withStrokes.some(sg => sg.hcPct != null));
  const whs = suggestedAllowance(game, { teams: GAMES[game].teams ? teams : null, players });
  const split = byGame && withStrokes.length > 0;
  const setSide = (key, v) => setSideGames(list => list.map(sg => (sg.game === key ? { ...sg, hcPct: v } : sg)));
  const toggleByGame = () => {
    const on = !byGame;
    setByGame(on);
    // On: each game starts from the round's %. Off: back to one % for every game
    setSideGames(list => list.map(sg => {
      const { hcPct: _own, ...rest } = sg;
      return on && STROKE_SIDE_GAMES.includes(sg.game) ? { ...rest, hcPct: opts.hcPct ?? 100 } : rest;
    }));
  };
  const half = !!opts.halfStrokes;

  return (
    <>
      <div className="block strokes-setup">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Strokes given</div>
        {!split ? (
          <>
            <PctPicker label="Strokes given" value={opts.hcPct} onChange={v => set('hcPct', v)} whs={whs} />
            {!whs && <p className="field-help">Many groups use 90% or 80% so the better player still has a chance.</p>}
          </>
        ) : (
          <>
            <div className="pct-game">
              <div className="pct-game-name">{GAMES[game].name}</div>
              <PctPicker label={`Strokes given in ${GAMES[game].name}`} value={opts.hcPct} onChange={v => set('hcPct', v)} whs={whs} />
            </div>
            {withStrokes.map(sg => (
              <div key={sg.game} className="pct-game">
                <div className="pct-game-name">{SIDE_GAMES[sg.game].label}</div>
                <PctPicker label={`Strokes given in ${SIDE_GAMES[sg.game].label}`} value={sg.hcPct ?? opts.hcPct}
                  onChange={v => setSide(sg.game, v)} whs={suggestedAllowance(sg.game, { players })} />
              </div>
            ))}
          </>
        )}
        {withStrokes.length > 0 && (
          <button className="text-link-btn pct-split-btn" onClick={toggleByGame} aria-expanded={split}>
            {split ? 'Same for every game' : 'Set by game'}
          </button>
        )}
      </div>
      {halfStrokesOffered(game, sideGames) && (
        <div className="toggle-row">
          <div>
            <div className="toggle-lbl" id="half-strokes-lbl">Half strokes</div>
            <div className="toggle-sub" id="half-strokes-sub">Each stroke counts as half a shot in the matches and skins. A 5 with a stroke is a net 4½, so it beats a 5 and loses to a 4.</div>
          </div>
          <Toggle on={half} onChange={v => set('halfStrokes', v)} labelledBy="half-strokes-lbl" describedBy="half-strokes-sub" />
        </div>
      )}
    </>
  );
}
