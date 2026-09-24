import { Icon, Segmented, Toggle } from './ui.jsx';
import { GAMES } from '../lib/round.js';
import { DOT_KINDS, sixesPairings } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { teamsProblem } from '../lib/teams.js';

/**
 * Stakes and options for every game. Used by the round setup step, the Game defaults screen
 * and the mid-round bets sheet, so they all stay in sync.
 * `get(path)` reads a setting, `set(path, v)` writes one, `onAmount(path, title, {min,max})` opens a numpad.
 */
export function GameOptions({ game, get, set, onAmount, holesCount = 18, compact = false, firstName = null }) {
  const amount = (path, title, { min = 1, max = 500, label } = {}) => (
    <div className="nassau-bet-row" key={path}>
      <div className="nassau-bet-lbl">{label || title}</div>
      <button className="nassau-bet-btn" onClick={() => onAmount(path, title, { min, max })}>{money(get(path))}</button>
    </div>
  );
  const seg = (path, options, eyebrow, first = false) => (
    <div key={path}>
      {eyebrow && <div className="eyebrow" style={{ margin: first ? '0 0 10px' : '14px 0 8px' }}>{eyebrow}</div>}
      <Segmented className="press-mode-row" btn="pm-btn" value={get(path)} onChange={v => set(path, v)} options={options} />
    </div>
  );
  const toggle = (path, label, sub) => (
    <div className="toggle-row" key={path}>
      <div><div className="toggle-lbl">{label}</div>{sub && <div className="toggle-sub">{sub}</div>}</div>
      <Toggle on={!!get(path)} onChange={v => set(path, v)} label={label} />
    </div>
  );
  const label = t => (compact ? null : <div className="sec-label">{t}</div>);
  const help = t => <p className="field-help">{t}</p>;
  const note = t => <p className="field-help pad">{t}</p>;
  const payout = (path, unit) => seg(path, [{ value: 'per', label: `Per ${unit}` }, { value: 'pot', label: 'Winner takes pot' }], 'Payout');
  const presses = prefix => (
    <div className="block">
      {seg(`${prefix}.pressMode`, [{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }])}
      {get(`${prefix}.pressMode`) !== 'off' && seg(`${prefix}.threshold`, [1, 2, 3].map(n => ({ value: n, label: `${n} hole${n > 1 ? 's' : ''}` })), 'Can press when down by')}
      {help({ off: 'Just the one bet.', manual: 'A Press button appears when a side is eligible.', auto: 'Presses start automatically as soon as a side is eligible.' }[get(`${prefix}.pressMode`)])}
    </div>
  );

  switch (game) {
    case 'banker': {
      const b = get('banker') || {};
      const rangeBad = b.min > b.max || b.defaultBet < b.min || b.defaultBet > b.max;
      return <>
        {label('Stakes')}
        {amount('banker.defaultBet', 'Default bet', { max: 999 })}
        {amount('banker.min', 'Minimum bet', { max: 999 })}
        {amount('banker.max', 'Maximum bet', { max: 999 })}
        {rangeBad && <p className="field-error" style={{ margin: '0 20px 8px' }}>Default bet has to sit between the minimum and maximum.</p>}
        {label('Banker rotation')}
        <div className="block">
          {seg('banker.rotation', [{ value: 'rotate', label: 'Each hole' }, { value: 'nine', label: 'Each 9' }, { value: 'fixed', label: 'Fixed' }, { value: 'choice', label: 'Pick' }])}
          {help(`${{ rotate: 'Banker moves to the next player every hole.', nine: 'One banker per nine, in playing order.', fixed: 'The first player banks every hole.', choice: 'Choose the banker at the start of each hole.' }[b.rotation]}${firstName ? ` ${firstName} banks first.` : ''}`)}
        </div>
        {label('Ties')}
        <div className="block">
          {seg('banker.ties', [{ value: 'push', label: 'Push' }, { value: 'banker', label: 'Banker wins' }])}
        </div>
      </>;
    }
    case 'nassau':
      return <>
        {label('Bets')}
        {amount('nassau.front', holesCount === 9 ? 'First 4' : 'Front 9')}
        {amount('nassau.back', holesCount === 9 ? 'Last 5' : 'Back 9')}
        {amount('nassau.total', holesCount === 9 ? 'All 9' : 'Total 18')}
        {label('Presses')}
        <div className="block">
          {seg('nassau.pressMode', [{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }])}
          {get('nassau.pressMode') !== 'off' && seg('nassau.threshold', [1, 2, 3].map(n => ({ value: n, label: `${n} hole${n > 1 ? 's' : ''}` })), 'Can press when down by')}
          {help({ off: 'Just the three bets.', manual: 'A Press button appears when a player is eligible.', auto: 'Presses start automatically as soon as a player is eligible.' }[get('nassau.pressMode')])}
        </div>
      </>;
    case 'skins':
      return <>
        {label('Skins')}
        {amount('skins.value', 'Per skin', { label: 'Value per skin' })}
        {toggle('skins.carryover', 'Carryovers', 'Tied holes roll the skin to the next hole')}
      </>;
    case 'wolf':
      return <>
        {label('Points')}
        {amount('wolf.point', 'Per point', { label: 'Value per point' })}
        <div className="block">
          {seg('wolf.loneMultiplier', [2, 3].map(n => ({ value: n, label: `${n}×` })), 'Lone wolf pays', true)}
        </div>
      </>;
    case 'match':
      return <>
        {label('Stake')}
        {amount('match.stake', 'Stake per player', { label: 'Per player' })}
        {note('Each player on the winning side wins the stake. With uneven sides the loner plays every opponent for it, so 1 v 3 puts three stakes on the line.')}
        {label('Presses')}
        {presses('match')}
      </>;
    case 'vegas':
      return <>
        {label('Stakes')}
        {amount('vegas.point', 'Per point', { label: 'Per point' })}
        {toggle('vegas.birdieFlip', 'Birdies flip', 'A natural birdie flips the other team’s number (45 becomes 54)')}
        {note('Each hole the difference between the two team numbers is paid, per player, by the losing team.')}
      </>;
    case 'sixes':
      return <>
        {label('Stakes')}
        {amount('sixes.stake', 'Per match', { label: get('sixes.mode') === 'holes' ? 'Per hole won' : 'Per match' })}
        <div className="block">
          {seg('sixes.mode', [{ value: 'match', label: 'Win the match' }, { value: 'holes', label: 'Per hole up' }])}
          {help(get('sixes.mode') === 'holes' ? `Each ${holesCount === 9 ? 'three' : 'six'}-hole match pays the stake for every hole a team finishes up.` : `Each ${holesCount === 9 ? 'three' : 'six'}-hole match pays the stake to each winner. Halved matches push.`)}
        </div>
      </>;
    case 'scramble':
      return <>
        {label('Stakes')}
        {amount('scramble.stake', 'Ante per player', { label: 'Ante per player' })}
        {note('Everyone antes. The team with the lowest net total splits the pot; tied teams share it. Team handicaps use the usual allowances: 35% and 15% for pairs, 20/15/10% for threes, 25/20/15/10% for fours.')}
      </>;
    case 'stroke':
      return <>
        {label('Stakes')}
        {amount('stroke.stake', get('stroke.payout') === 'pot' ? 'Ante per player' : 'Per stroke', { label: get('stroke.payout') === 'pot' ? 'Ante per player' : 'Per stroke' })}
        <div className="block">
          {payout('stroke.payout', 'stroke')}
          {help(get('stroke.payout') === 'pot' ? 'Lowest net total takes the pot; ties split it.' : 'Every pair settles the difference in their net totals.')}
        </div>
      </>;
    case 'stableford':
      return <>
        {label('Stakes')}
        {amount('stableford.stake', get('stableford.payout') === 'pot' ? 'Ante per player' : 'Per point', { label: get('stableford.payout') === 'pot' ? 'Ante per player' : 'Per point' })}
        <div className="block">
          {payout('stableford.payout', 'point')}
          {seg('stableford.modified', [{ value: false, label: 'Standard' }, { value: true, label: 'Modified' }], 'Points')}
          {help(get('stableford.modified') ? 'Modified: double bogey −3, bogey −1, par 0, birdie 2, eagle 5, albatross 8.' : 'Standard: double bogey 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5. Net scores.')}
        </div>
      </>;
    case 'quota':
      return <>
        {label('Stakes')}
        {amount('quota.stake', get('quota.payout') === 'pot' ? 'Ante per player' : 'Per point', { label: get('quota.payout') === 'pot' ? 'Ante per player' : 'Per point' })}
        <div className="block">
          {payout('quota.payout', 'point')}
          {help('Your quota is 36 minus your course handicap (18 minus it over nine). Gross scores earn bogey 1, par 2, birdie 4, eagle 8. Best finish against quota wins.')}
        </div>
      </>;
    case 'nines':
      return <>
        {label('Stakes')}
        {amount('nines.point', 'Per point', { label: 'Per point' })}
        {note('Nine points a hole: 5 for low, 3 for middle, 1 for high. Ties share the points. Each player settles their points above or below average.')}
      </>;
    case 'aces':
      return <>
        {label('Stakes')}
        {amount('aces.ace', 'Ace (low wins from each)', { label: 'Ace · low wins from each' })}
        {amount('aces.deuce', 'Deuce (high pays each)', { label: 'Deuce · high pays each' })}
        {note('Only an outright low or high counts. Ties for low or high pay nothing.')}
      </>;
    case 'bbb':
      return <>
        {label('Stakes')}
        {amount('bbb.value', 'Per point', { label: 'Per point' })}
        {note('Three points a hole: first on the green, closest once everyone is on, first in the hole. Every pair settles the difference in points. Handicaps don’t matter, so it’s a great leveller.')}
      </>;
    case 'dots':
      return <>
        {label('Stakes')}
        {amount('dots.value', 'Per dot', { label: 'Per dot' })}
        {toggle('dots.auto', 'Birdies count', 'A natural birdie is a dot, an eagle is two — straight from the scores')}
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Dots in play</div>
          <div className="chip-row" style={{ padding: 0 }}>
            {Object.entries(DOT_KINDS).map(([k, d]) => (
              <button key={k} className={`pill-btn ${get(`dots.kinds.${k}`) ? 'on' : ''}`} aria-pressed={!!get(`dots.kinds.${k}`)} onClick={() => set(`dots.kinds.${k}`, !get(`dots.kinds.${k}`))}>
                {get(`dots.kinds.${k}`) && <Icon name="check" />} {d.name}
              </button>
            ))}
          </div>
          {help('Every dot is paid by each of the other players. Tap a player’s dots as they happen.')}
        </div>
      </>;
    case 'rabbit':
      return <>
        {label('Stakes')}
        {amount('rabbit.stake', 'Per rabbit', { label: 'Per rabbit' })}
        {toggle('rabbit.tiesFree', 'Ties set it loose', 'A halved hole frees the rabbit; off, the holder keeps it through ties')}
        {note(holesCount === 9 ? 'Whoever holds the rabbit after the last hole wins the stake from everyone.' : 'Whoever holds the rabbit after hole 9 and again after hole 18 wins the stake from everyone.')}
      </>;
    default:
      return null;
  }
}

/** Playing-order preview for Sixes: who partners whom in each match. */
export function SixesPreview({ names, holesCount }) {
  if (names.length !== 4) return null;
  const len = holesCount / 3;
  return (
    <div className="block" style={{ paddingTop: 4 }}>
      {sixesPairings(names).map(([a, b], i) => (
        <div key={i} className="sixes-row">
          <span className="sixes-holes">Holes {i * len + 1}–{(i + 1) * len}</span>
          <span className="sixes-pair">{a.join(' & ')}</span><span className="sixes-v">v</span><span className="sixes-pair">{b.join(' & ')}</span>
        </div>
      ))}
    </div>
  );
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Tap a letter to move a player between teams. */
export function TeamPicker({ game, picked, names, teams, setTeams }) {
  const cfg = GAMES[game]?.teams;
  if (!cfg || !teams) return null;
  const canChooseCount = Array.isArray(cfg.count);
  const count = teams.length;
  const teamOf = pid => teams.findIndex(t => t.includes(pid));
  const move = (pid, to) => setTeams(teams.map((t, i) => (i === to ? [...t.filter(x => x !== pid), pid] : t.filter(x => x !== pid))));
  const setCount = n => {
    const next = Array.from({ length: n }, () => []);
    picked.forEach((pid, i) => next[Math.min(n - 1, teamOf(pid) < 0 ? 0 : teamOf(pid) < n ? teamOf(pid) : Math.floor(i * n / picked.length))].push(pid));
    // Rebalance anything that was on a dropped team
    setTeams(next);
  };
  const problem = teamsProblem(game, teams, picked);
  return (
    <>
      {canChooseCount && (
        <div className="block">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Number of teams</div>
          <Segmented value={count} onChange={setCount} options={Array.from({ length: cfg.count[1] - cfg.count[0] + 1 }, (_, i) => cfg.count[0] + i).filter(n => n <= picked.length).map(n => ({ value: n, label: String(n) }))} />
        </div>
      )}
      {picked.map(pid => (
        <div key={pid} className="set-row static team-row">
          <div className="row-main set-name">{names[pid]}</div>
          <div className="team-letters" role="radiogroup" aria-label={`${names[pid]}'s team`}>
            {teams.map((_, i) => (
              <button key={i} role="radio" aria-checked={teamOf(pid) === i} className={`team-letter t${i} ${teamOf(pid) === i ? 'on' : ''}`} onClick={() => move(pid, i)}>{LETTERS[i]}</button>
            ))}
          </div>
        </div>
      ))}
      {problem ? <p className="field-error" style={{ margin: '0 20px 8px' }}>{problem}</p> : (
        <p className="field-help" style={{ padding: '0 20px' }}>{teams.map((t, i) => `${LETTERS[i]}: ${t.map(pid => names[pid]?.split(' ')[0]).join(' & ') || '—'}`).join(' · ')}</p>
      )}
    </>
  );
}
