// Side games: Skins, Junk, a Birdie pot, Snake, Rabbit and the closest to the pin and long drive pots riding along with the main game.
// Setup rows and the add sheet, the by-game money table, and the one-line "games in small type".
import { useState } from 'react';
import { Icon, Numpad, PickChip, Segmented, Sheet, Toggle } from './ui.jsx';
import { RulesSheet } from './Rules.jsx';
import { GAMES, MAX_GAMES, POT_GAMES, SIDE_GAMES, oneBall, potHoles, potHolesDefault, sideGameChoices } from '../lib/round.js';
import { DOT_KINDS } from '../lib/games.js';
import { asPlayedWith, dotsNote, potHolesLine, sideExample, skinsRulesLine } from '../lib/side-games.js';
import { DEFAULT_SETTINGS } from '../lib/store.js';
import { GameOptions } from './GameOptions.jsx';
import { money } from '../lib/golf.js';
import { betChangeNote, optionsProblem, sideBetLine } from '../lib/stakes.js';
import { firstName } from '../lib/format.js';
import { countsMoney, inUnits, padUnit, points, unitFmt, wholeByGame, wholePoints } from '../lib/play-for.js';

/** "Skins, Junk or a Birdie pot": the side games still on offer, in words. */
const orList = xs => {
  const t = xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}` : xs[0] || '';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Where the bet amount lives in a side game's settings. */
const amountKey = (game, s) => (game === 'skins' ? (s?.payout === 'pot' ? 'stake' : 'value') : game === 'dots' ? 'value' : 'stake'); // Snake, Rabbit and the pots: stake

/** "a Birdie pot", "a closest to the pin pot": a side game's name in the "Add a side game" line. */
const offerName = k => ({ birdies: 'a Birdie pot', ctp: 'a closest to the pin pot', drive: 'a long drive pot' }[k] || SIDE_GAMES[k].label);

/**
 * The "Side games" part of the Bets step. `defaults` holds every game's settings (the setup's opts),
 * so a new side game starts from the group's usual Skins or Dots bets. `playFor` is the round's
 * (points and reward rounds read in points).
 */
export function SideGamesSetup({ game, sideGames, setSideGames, defaults, players = 4, playFor = null, holes = null, holesCount = holes?.length ?? 18 }) {
  const fmt = unitFmt({ playFor });
  const u = t => inUnits({ playFor }, t);
  const unit = padUnit({ playFor });
  const [adding, setAdding] = useState(false);
  const [pad, setPad] = useState(null); // index of the side game whose bet is being changed
  const [rules, setRules] = useState(null); // index of the side Skins whose house rules are open
  const [rulePad, setRulePad] = useState(null); // an amount in those rules being changed
  const [howTo, setHowTo] = useState(null); // the side game whose how-to-play sheet is open
  const [picking, setPicking] = useState(false); // the long drive holes picker
  if (!game) return null;
  if (oneBall(game)) {
    return (
      <>
        <div className="sec-label">Side games</div>
        <p className="hint-card"><Icon name="info" fill /> {game === 'scramble' ? 'A scramble' : GAMES[game].name} is scored by team, so side games can’t ride along.</p>
      </>
    );
  }
  const choices = sideGameChoices(game, sideGames);
  const full = sideGames.length >= MAX_GAMES - 1;
  const change = (i, fn) => setSideGames(list => list.map((sg, k) => (k === i ? { ...sg, settings: fn(structuredClone(sg.settings)) } : sg)));
  const remove = i => setSideGames(list => list.filter((_, k) => k !== i));
  const add = key => {
    // A game added since a round was made has nothing in its settings: start from the usual defaults
    const base = structuredClone({ ...(DEFAULT_SETTINGS[key] || {}), ...(defaults?.[key] || {}) });
    setSideGames(list => [...list, { game: key, settings: base }]);
    setAdding(false);
  };
  const hasBirdies = sideGames.some(sg => sg.game === 'birdies');
  // The closest to the pin pot pays for being closest, so Junk's greenies are off next to it (see gameView)
  const hasCtp = sideGames.some(sg => sg.game === 'ctp');
  const driveAt = sideGames.findIndex(sg => sg.game === 'drive');
  const padGame = pad != null ? sideGames[pad] : null;
  return (
    <>
      <div className="sec-label">Side games</div>
      {sideGames.map((sg, i) => {
        const meta = SIDE_GAMES[sg.game];
        const key = amountKey(sg.game, sg.settings);
        const problem = optionsProblem(sg.game, { [sg.game]: sg.settings });
        return (
          <div key={sg.game} className="block side-game">
            <div className="sg-head">
              <Icon name={meta.icon} fill className="sg-icon" />
              <div className="row-main">
                <div className="sg-name"><span className="set-name">{meta.label}</span>
                  <button className="rules-chip" onClick={() => setHowTo(sg.game)} aria-label={`How to play ${meta.label}`}><Icon name="info" /> Rules</button>
                </div>
                <div className="set-sub">{u(sideBetLine(sg.game, sg.settings))}</div>
              </div>
              <button className="nassau-bet-btn" aria-label={`${meta.label} bet: ${fmt(sg.settings[key] ?? 0)}. Change`} onClick={() => setPad(i)}>{fmt(sg.settings[key] ?? 0)}</button>
            </div>
            <p className="field-help">{u(sideExample(sg.game, asPlayedWith(sg.game, sg.settings, sideGames), players, holes))}</p>
            {POT_GAMES.includes(sg.game) && (
              <>
                {sg.game === 'drive' && holes?.length ? (
                  <button className="quiet-row flush sg-rules" onClick={() => setPicking(true)} aria-label={`Long drive holes: ${potHolesLine('drive', sg.settings, holes)}. Change`}>
                    <Icon name="flag" /> <span>{potHolesLine('drive', sg.settings, holes)}</span> <Icon name="caret-right" />
                  </button>
                ) : (
                  <p className="field-help pot-holes"><Icon name="flag" /> {potHolesLine(sg.game, sg.settings, holes)}</p>
                )}
                <div className="pot-unclaimed">
                  <div className="toggle-lbl">{sg.game === 'ctp' ? 'Nobody on the green' : 'Nobody in the fairway'}</div>
                  <Segmented label={`${meta.label}: a hole nobody wins`} className="press-mode-row" btn="pm-btn" value={sg.settings.unclaimed === 'split' ? 'split' : 'carry'}
                    onChange={v => change(i, st => ({ ...st, unclaimed: v }))}
                    options={[{ value: 'carry', label: 'Carries' }, { value: 'split', label: 'Split' }]} />
                </div>
              </>
            )}
            {sg.game === 'skins' && (
              <button className="quiet-row flush sg-rules" onClick={() => setRules(i)} aria-label={`Skins house rules: ${u(skinsRulesLine(sg.settings))}. Change for this round`}>
                <Icon name="sliders-horizontal" /> <span>{u(skinsRulesLine(sg.settings))}</span> <Icon name="caret-right" />
              </button>
            )}
            {sg.game === 'skins' && (
              <div className="toggle-row flush">
                <div><div className="toggle-lbl">Carryovers</div><div className="toggle-sub">Tied holes roll the skin to the next hole</div></div>
                <Toggle on={!!sg.settings.carryover} onChange={v => change(i, s => ({ ...s, carryover: v }))} label="Skins carryovers" />
              </div>
            )}
            {sg.game === 'dots' && (
              <>
                <div className="eyebrow" style={{ margin: '12px 0 8px' }}>Dots that count</div>
                <div className="chip-row" style={{ padding: 0 }} role="group" aria-label="Junk dots that count">
                  {Object.entries(DOT_KINDS).map(([k, d]) => {
                    // Next to a closest to the pin pot the greenie is the pot's, so it can't be on here
                    const off = k === 'greenie' && hasCtp;
                    const on = !off && !!sg.settings.kinds?.[k];
                    return (
                      <PickChip key={k} on={on} title={d.help} disabled={off} onClick={() => change(i, s => ({ ...s, kinds: { ...(s.kinds || {}), [k]: !on } }))}>{d.name}</PickChip>
                    );
                  })}
                </div>
                {hasCtp && <p className="field-help">No greenies in Junk: the closest to the pin pot pays for being closest.</p>}
                {dotsNote(sg.settings.kinds) && <p className="field-help">{dotsNote(sg.settings.kinds)}</p>}
                <div className="toggle-row flush">
                  <div><div className="toggle-lbl">Birdies count automatically</div><div className="toggle-sub">A birdie is a dot and an eagle is two, from the scores</div></div>
                  <Toggle on={!!sg.settings.auto} onChange={v => change(i, s => ({ ...s, auto: v }))} label="Birdies count as junk automatically" />
                </div>
                {hasBirdies && sg.settings.auto && <p className="field-help">Birdies also count as a dot, so a birdie pays in Junk and the Birdie pot.</p>}
              </>
            )}
            {problem && <p className="field-error">{problem}</p>}
            <button className="text-link-btn" onClick={() => remove(i)} aria-label={`Remove ${meta.label}`}>Remove</button>
          </div>
        );
      })}
      {full ? (
        <p className="field-help pad">Up to {MAX_GAMES} games in a round.</p>
      ) : choices.length > 0 && (
        <button className="set-row add-side" onClick={() => setAdding(true)}>
          <div className="set-icon"><Icon name="plus" /></div>
          <div className="row-main"><div className="set-name">Add a side game</div><div className="set-sub">{orList(choices.map(offerName))} on top of {GAMES[game].name}</div></div>
        </button>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a side game">
        <p className="sheet-text">Each side game has its own bet. {countsMoney({ playFor }) ? 'The money adds up' : 'The points add up'} into one total each.</p>
        {choices.map(k => {
          const s = { ...(DEFAULT_SETTINGS[k] || {}), ...(defaults?.[k] || {}) };
          return (
            <div key={k} className="side-choice-wrap">
              <button className="sheet-item side-choice" onClick={() => add(k)} aria-label={`Add ${SIDE_GAMES[k].label}, ${u(sideBetLine(k, s))}`}>
                <div className="set-icon"><Icon name={SIDE_GAMES[k].icon} fill /></div>
                <div className="row-main" style={{ textAlign: 'left' }}>
                  <div className="set-name">{SIDE_GAMES[k].label} · {u(sideBetLine(k, s))}</div>
                  <div className="set-sub">{u(sideExample(k, asPlayedWith(k, s, sideGames), players, holes))}</div>
                </div>
                <Icon name="plus" />
              </button>
              <button className="rules-chip side-choice-rules" onClick={() => setHowTo(k)} aria-label={`How to play ${SIDE_GAMES[k].label}`}><Icon name="info" /> Rules</button>
            </div>
          );
        })}
      </Sheet>
      <RulesSheet game={howTo} open={!!howTo} onClose={() => setHowTo(null)} />
      {picking && driveAt >= 0 && holes?.length > 0 && (
        <DriveHoles settings={sideGames[driveAt].settings} holes={holes} onClose={() => setPicking(false)}
          onChange={nos => change(driveAt, st => ({ ...st, holes: nos }))} />
      )}
      <SkinsRules i={rules} sideGames={sideGames} change={change} players={players} holesCount={holesCount} inPoints={!countsMoney({ playFor })} onClose={() => setRules(null)} onAmount={setRulePad} />
      <Numpad open={rules != null && !!rulePad} title={rulePad?.title || ''} {...unit}
        initial={rulePad && rules != null ? sideGames[rules]?.settings[rulePad.path.split('.')[1]] : ''} min={rulePad?.min} max={rulePad?.max}
        onClose={() => setRulePad(null)} onDone={v => { const key = rulePad.path.split('.')[1]; change(rules, s => ({ ...s, [key]: v })); setRulePad(null); }} />
      <Numpad open={pad != null && !!padGame} title={padGame ? `${SIDE_GAMES[padGame.game].label} bet` : ''} {...unit}
        initial={padGame ? padGame.settings[amountKey(padGame.game, padGame.settings)] : ''} min={1} max={500}
        onClose={() => setPad(null)} onDone={v => { const i = pad; change(i, s => ({ ...s, [amountKey(sideGames[i].game, s)]: v })); setPad(null); }} />
    </>
  );
}

/**
 * Which holes the long drive pot is played on: tap holes on and off. With none picked it's every
 * par 5 (every par 4 on a course with none), which is where it starts.
 */
function DriveHoles({ settings, holes, onChange, onClose }) {
  const dflt = potHolesDefault({ holes }, 'drive', settings);
  const on = new Set(potHoles({ holes }, 'drive', settings).map(h => h.no));
  const toggle = no => {
    const next = holes.filter(h => (h.no === no ? !on.has(no) : on.has(h.no))).map(h => h.no);
    onChange(next.length ? next : null);
  };
  return (
    <Sheet open onClose={onClose} title="Long drive holes">
      <p className="sheet-text">Pick the holes the long drive is played on. The pot is shared out across them.</p>
      <div className="chip-row pot-hole-chips" role="group" aria-label="Long drive holes">
        {holes.map(h => {
          const lit = on.has(h.no);
          return (
            <PickChip key={h.no} small on={lit} label={`Hole ${h.no}, par ${h.par}`} onClick={() => toggle(h.no)}>
              {h.no} <span className="pot-par">Par {h.par}</span>
            </PickChip>
          );
        })}
      </div>
      <p className="field-help pad">{dflt ? `Every par ${holes.some(h => h.par >= 5) ? 5 : 4} until you pick.` : `${on.size} hole${on.size === 1 ? '' : 's'} picked.`}</p>
      <div className="cta-wrap">
        {!dflt && <button className="full-btn outline" onClick={() => onChange(null)}>Back to every par {holes.some(h => h.par >= 5) ? 5 : 4}</button>}
        <button className="full-btn" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

/**
 * A side Skins game's house rules for this round (net or gross, a skin or a pot, carryovers and
 * the last carry), with the same options as Skins as the main game. Starts from what the side
 * game already has, which came from the saved Skins defaults.
 */
function SkinsRules({ i, sideGames, change, players, holesCount, inPoints, onClose, onAmount }) {
  const sg = i != null ? sideGames[i] : null;
  if (!sg || sg.game !== 'skins') return null;
  const key = path => path.split('.').slice(1).join('.');
  const get = path => (path === 'skins' ? sg.settings : sg.settings[key(path)]);
  const set = (path, v) => change(i, s => ({ ...s, [key(path)]: v }));
  return (
    <Sheet open onClose={onClose} title="Skins house rules">
      <p className="sheet-text">For this round only. Your saved Skins defaults stay as they are.</p>
      <GameOptions game="skins" get={get} set={set} onAmount={(path, title, o) => onAmount({ path, title, ...o })} players={players} holesCount={holesCount} inPoints={inPoints} compact />
      <div className="cta-wrap">
        <button className="full-btn" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

/**
 * A table of each game's money: a row per game, a column per player, and a Total row. A game whose
 * bet changed mid-round says so under its name. `fmt` formats the amounts (points for a points or
 * reward round).
 */
export function ByGameTable({ round, byGame, total, fmt = money, caption = null }) {
  const games = Object.entries(byGame);
  // In points, whole points that add up down each player's column to the Total row
  const whole = fmt === points ? wholeByGame(byGame, round.players.map(p => p.id), total) : null;
  const cls = v => (v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero');
  return (
    <div className="money-table-wrap">
      <table className="sc-table money-table by-game">
        <caption className="sr-only">{caption || `${countsMoney(round) ? 'Money' : 'Points'} by game`}</caption>
        <thead>
          <tr><th scope="col" style={{ textAlign: 'left', paddingLeft: 12 }}>Game</th>{round.players.map(p => <th key={p.id} scope="col">{firstName(p.name)}</th>)}</tr>
        </thead>
        <tbody>
          {games.map(([key, g]) => (
            <tr key={key}>
              <th scope="row" className="bg-game">{g.label}{betChangeNote(round, key) && <span className="bg-note">{betChangeNote(round, key)}</span>}</th>
              {round.players.map(p => { const v = whole ? whole[key][p.id] : g.balances[p.id] || 0; return <td key={p.id} className={cls(v)}>{fmt(v, { sign: true })}</td>; })}
            </tr>
          ))}
          <tr className="bg-total">
            <th scope="row" className="bg-game">Total</th>
            {round.players.map(p => { const v = whole ? wholePoints(total[p.id]) : total[p.id] || 0; return <td key={p.id} className={cls(v)}><strong>{fmt(v, { sign: true })}</strong></td>; })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
