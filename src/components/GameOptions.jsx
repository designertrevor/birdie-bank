import { Icon, Segmented, Toggle } from './ui.jsx';
import { GAMES } from '../lib/round.js';
import { DOT_KINDS, sixesPairings } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { teamsProblem } from '../lib/teams.js';
import { SCRAMBLE_ALLOWANCE } from '../lib/games.js';

/**
 * Stakes and options for every game. Used by the round setup step, the Game defaults screen
 * and the mid-round bets sheet, so they all stay in sync.
 * `get(path)` reads a setting, `set(path, v)` writes one, `onAmount(path, title, {min,max})` opens a numpad.
 * `players` is how many are playing, for the worked example under each bet (a foursome when unknown).
 */
export function GameOptions({ game, get, set, onAmount, holesCount = 18, compact = false, firstName = null, players = null }) {
  const n = players || Math.min(Math.max(4, GAMES[game]?.min || 2), GAMES[game]?.max || 4);
  const others = n - 1;
  const each = v => `${money(v)} from each of the other ${others}`;
  // One worked line under a bet, so "a point" means the same thing to everyone before the first tee
  const example = t => <p className="field-help pad">{t}</p>;
  const pct = w => w.map(x => Math.round(x * 100)).join('/');
  const amount = (path, title, { min = 1, max = 500, label } = {}) => (
    <div className="nassau-bet-row" key={path}>
      <div className="nassau-bet-lbl">{label || title}</div>
      <button className="nassau-bet-btn" aria-label={`${label || title}: ${money(get(path))}. Change`} onClick={() => onAmount(path, title, { min, max })}>{money(get(path))}</button>
    </div>
  );
  const seg = (path, options, eyebrow, first = false) => (
    <div key={path}>
      {eyebrow && <div className="eyebrow" style={{ margin: first ? '0 0 10px' : '14px 0 8px' }}>{eyebrow}</div>}
      <Segmented label={eyebrow} className="press-mode-row" btn="pm-btn" value={get(path)} onChange={v => set(path, v)} options={options} />
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
  const payout = (path, unit) => seg(path, [{ value: 'pot', label: 'Winner takes pot' }, { value: 'per', label: `Per ${unit}` }], 'Payout');
  const potExample = path => `With ${n} players the pot is ${money(get(path) * n)}, so the winner is up ${money(get(path) * others)}.`;
  const perExample = (path, unit) => `Each ${unit} wins ${money(get(path))} from every other player: finish 3 ${unit}s better than someone and you're up ${money(get(path) * 3)} on them.`;
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
        {example(`Win a skin: up ${money(get('skins.value') * others)}, ${each(get('skins.value'))}.`)}
        {toggle('skins.carryover', 'Carryovers', 'Tied holes roll the skin to the next hole')}
      </>;
    case 'wolf':
      return <>
        {label('Points')}
        {amount('wolf.point', 'Per point', { label: 'Value per point' })}
        {example(`Every loser pays every winner a point. Win with a partner: up ${money(get('wolf.point') * 2)} each. Lone wolf win: up ${money(get('wolf.point') * (get('wolf.loneMultiplier') || 2) * 3)}.`)}
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
        {example(`Win a hole 45 to 47: up ${money(get('vegas.point') * 2)} each.`)}
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
        {amount('scramble.stake', 'Each player puts in', { label: 'Each player puts in' })}
        {note(`Everyone puts in. The team with the lowest net total splits the pot; tied teams share it. Team handicaps use the WHS allowances: ${pct(SCRAMBLE_ALLOWANCE[2])}% for pairs, ${pct(SCRAMBLE_ALLOWANCE[3])}% for threes, ${pct(SCRAMBLE_ALLOWANCE[4])}% for fours.`)}
      </>;
    case 'stroke':
      return <>
        {label('Stakes')}
        {amount('stroke.stake', get('stroke.payout') === 'pot' ? 'Each player puts in' : 'Per stroke', { label: get('stroke.payout') === 'pot' ? 'Each player puts in' : 'Per stroke' })}
        {example(get('stroke.payout') === 'pot' ? potExample('stroke.stake') : perExample('stroke.stake', 'stroke'))}
        <div className="block">
          {payout('stroke.payout', 'stroke')}
          {help(get('stroke.payout') === 'pot' ? 'Lowest net total takes the pot; ties split it.' : 'Every pair settles the difference in their net totals.')}
        </div>
      </>;
    case 'stableford':
      return <>
        {label('Stakes')}
        {amount('stableford.stake', get('stableford.payout') === 'pot' ? 'Each player puts in' : 'Per point', { label: get('stableford.payout') === 'pot' ? 'Each player puts in' : 'Per point' })}
        {example(get('stableford.payout') === 'pot' ? potExample('stableford.stake') : perExample('stableford.stake', 'point'))}
        <div className="block">
          {payout('stableford.payout', 'point')}
          {seg('stableford.modified', [{ value: false, label: 'Standard' }, { value: true, label: 'Modified' }], 'Points')}
          {help(get('stableford.modified') ? 'Modified: double bogey −3, bogey −1, par 0, birdie 2, eagle 5, albatross 8.' : 'Standard: double bogey 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5. Net scores.')}
        </div>
      </>;
    case 'quota':
      return <>
        {label('Stakes')}
        {amount('quota.stake', get('quota.payout') === 'pot' ? 'Each player puts in' : 'Per point', { label: get('quota.payout') === 'pot' ? 'Each player puts in' : 'Per point' })}
        {example(get('quota.payout') === 'pot' ? potExample('quota.stake') : perExample('quota.stake', 'point'))}
        <div className="block">
          {payout('quota.payout', 'point')}
          {help('Your quota is 36 minus your course handicap (18 minus it over nine). Gross scores earn bogey 1, par 2, birdie 4, eagle 8. Best finish against quota wins. Stop early and the quota shrinks to the holes played.')}
        </div>
      </>;
    case 'nines':
      return <>
        {label('Stakes')}
        {amount('nines.point', 'Per point', { label: 'Per point' })}
        {example(`Every point above or below ${holesCount === 9 ? 27 : 54} is worth ${money(get('nines.point'))}: finish on ${(holesCount === 9 ? 27 : 54) + 6} and you're up ${money(get('nines.point') * 6)}.`)}
        {note('Nine points a hole: 5 for low, 3 for middle, 1 for high. Ties share the points.')}
      </>;
    case 'aces':
      return <>
        {label('Stakes')}
        {amount('aces.ace', 'Ace (low wins from each)', { label: 'Ace · low wins from each' })}
        {amount('aces.deuce', 'Deuce (high pays each)', { label: 'Deuce · high pays each' })}
        {example(`Outright low: up ${money(get('aces.ace') * others)}. Outright high: down ${money(get('aces.deuce') * others)}.`)}
        {note('Only an outright low or high counts. Ties for low or high pay nothing.')}
      </>;
    case 'bbb':
      return <>
        {label('Stakes')}
        {amount('bbb.value', 'Per point', { label: 'Per point' })}
        {example(`Each point wins ${money(get('bbb.value'))} from every other player: take one and you're up ${money(get('bbb.value') * others)}.`)}
        {note('Three points a hole: first on the green, closest once everyone is on, first in the hole. Every pair settles the difference in points. Handicaps don’t matter, so it’s a great leveller.')}
      </>;
    case 'dots':
      return <>
        {label('Stakes')}
        {amount('dots.value', 'Per dot', { label: 'Per dot' })}
        {example(`Each dot wins ${money(get('dots.value'))} from every other player: one dot and you're up ${money(get('dots.value') * others)}.`)}
        {toggle('dots.auto', 'Birdies count', 'A natural birdie is a dot, an eagle is two, straight from the scores')}
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
        {example(`Hold it ${holesCount === 9 ? 'after the last hole' : 'at the turn'}: up ${money(get('rabbit.stake') * others)}, ${each(get('rabbit.stake'))}.`)}
        <div className="block">
          {seg('rabbit.mode', [{ value: 'free', label: 'Set it free' }, { value: 'steal', label: 'Steal it' }], 'When someone else wins a hole', true)}
          {help((get('rabbit.mode') || 'steal') === 'free' ? 'They set the rabbit free, and the next outright winner catches it.' : 'They take the rabbit straight from the holder.')}
        </div>
        {toggle('rabbit.tiesFree', 'Ties set it loose', 'Off, a halved hole changes nothing')}
        {note(holesCount === 9 ? 'Whoever holds the rabbit after the last hole wins the stake from everyone. Stop early and whoever holds it then is paid.' : 'Whoever holds the rabbit after hole 9 and again after hole 18 wins the stake from everyone. Stop early and whoever holds it then is paid.')}
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
          <Segmented label="Number of teams" value={count} onChange={setCount} options={Array.from({ length: cfg.count[1] - cfg.count[0] + 1 }, (_, i) => cfg.count[0] + i).filter(n => n <= picked.length).map(n => ({ value: n, label: String(n) }))} />
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
        <p className="field-help" style={{ padding: '0 20px' }}>{teams.map((t, i) => `${LETTERS[i]}: ${t.map(pid => names[pid]?.split(' ')[0]).join(' & ') || '–'}`).join(' · ')}</p>
      )}
    </>
  );
}
