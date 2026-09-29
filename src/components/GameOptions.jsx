import { Icon, Segmented, Toggle } from './ui.jsx';
import { GAMES } from '../lib/round.js';
import { DOT_KINDS, SCRAMBLE_ALLOWANCE, sixesPairings } from '../lib/games.js';
import { money } from '../lib/golf.js';
import { teamsProblem } from '../lib/teams.js';

/**
 * Bets and options for every game. Used by the round setup step, the Game defaults screen
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
  const payout = (path, unit) => seg(path, [{ value: 'pot', label: 'Winner takes the pot' }, { value: 'per', label: `Pay per ${unit}` }], 'Payout');
  const potExample = path => `With ${n} players the pot is ${money(get(path) * n)}, so the winner is up ${money(get(path) * others)}.`;
  const perExample = (path, unit) => `Each ${unit} wins ${money(get(path))} from every other player: finish 3 ${unit}s better than someone and you're up ${money(get(path) * 3)} on them.`;
  const presses = prefix => (
    <div className="block">
      {seg(`${prefix}.pressMode`, [{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }])}
      {get(`${prefix}.pressMode`) !== 'off' && seg(`${prefix}.threshold`, [1, 2, 3].map(n => ({ value: n, label: `${n} hole${n > 1 ? 's' : ''}` })), 'Can press when down by')}
      {help({ off: 'Just the one bet.', manual: `A Press button shows up when a side is ${get(`${prefix}.threshold`) || 2} down.`, auto: `A press starts by itself when a side is ${get(`${prefix}.threshold`) || 2} down.` }[get(`${prefix}.pressMode`)])}
    </div>
  );

  switch (game) {
    case 'banker': {
      const b = get('banker') || {};
      const rangeBad = b.min > b.max || b.defaultBet < b.min || b.defaultBet > b.max;
      return <>
        {label('Bets')}
        {amount('banker.defaultBet', 'Default bet', { max: 999 })}
        {amount('banker.min', 'Minimum bet', { max: 999 })}
        {amount('banker.max', 'Maximum bet', { max: 999 })}
        {example(`Beat the banker on a ${money(get('banker.defaultBet'))} bet and you're up ${money(get('banker.defaultBet'))}; lose and you're down ${money(get('banker.defaultBet'))}. The banker plays everyone.`)}
        {rangeBad && <p className="field-error" style={{ margin: '0 20px 8px' }}>Default bet needs to be between the min and max.</p>}
        {label('Banker rotation')}
        <div className="block">
          {seg('banker.rotation', [{ value: 'rotate', label: 'Rotate' }, { value: 'low', label: 'Low' }, { value: 'nine', label: 'Each 9' }, { value: 'fixed', label: 'Fixed' }, { value: 'choice', label: 'Pick' }])}
          {help(`${{ rotate: 'Banker moves to the next player every hole.', low: 'Lowest score on the last hole banks the next. A tie stays with the banker.', nine: 'One banker per nine, in playing order.', fixed: 'The first player banks every hole.', choice: 'Choose the banker at the start of each hole.' }[b.rotation]}${firstName ? ` ${firstName} banks first.` : ''}`)}
        </div>
        {label('Ties')}
        <div className="block">
          {seg('banker.ties', [{ value: 'push', label: 'Push' }, { value: 'banker', label: 'Banker wins' }])}
        </div>
        {label('Birdies double')}
        <div className="block">
          {seg('banker.birdies', [{ value: 'off', label: 'Off' }, { value: 'gross', label: 'Real birdie' }, { value: 'net', label: 'Net birdie' }])}
          {help({ off: 'A birdie pays the same as any win.', gross: 'Win with a real birdie and your bet doubles. An eagle doubles it again (4×). Strokes don’t make a birdie.', net: 'Win with a birdie after strokes and your bet doubles. A net eagle doubles it again (4×).' }[b.birdies || 'off'])}
        </div>
      </>;
    }
    case 'nassau':
      return <>
        {label('Bets')}
        {amount('nassau.front', holesCount === 9 ? 'First 4' : 'Front 9')}
        {amount('nassau.back', holesCount === 9 ? 'Last 5' : 'Back 9')}
        {amount('nassau.total', holesCount === 9 ? 'All 9' : 'Total 18')}
        {example(`Win all three and you're up ${money((get('nassau.front') || 0) + (get('nassau.back') || 0) + (get('nassau.total') || 0))}. Halve a bet and nobody pays it.`)}
        {label('Presses')}
        <div className="block">
          {seg('nassau.pressMode', [{ value: 'off', label: 'Off' }, { value: 'manual', label: 'Manual' }, { value: 'auto', label: 'Auto' }])}
          {get('nassau.pressMode') !== 'off' && seg('nassau.threshold', [1, 2, 3].map(n => ({ value: n, label: `${n} hole${n > 1 ? 's' : ''}` })), 'Can press when down by')}
          {help({ off: 'Just the three bets.', manual: `A Press button shows up when someone is ${get('nassau.threshold') || 2} down.`, auto: `A press starts by itself when someone is ${get('nassau.threshold') || 2} down.` }[get('nassau.pressMode')])}
        </div>
        {toggle('nassau.turnPress', 'Press at the turn', `Whoever lost the ${holesCount === 9 ? 'first 4' : 'front 9'} can press the ${holesCount === 9 ? 'last 5' : 'back 9'}, however far down`)}
        {get('nassau.pressMode') !== 'off' && toggle('nassau.noLastPress', 'No press on the last hole', holesCount === 9 ? 'Nobody can start a press on the 4th or the 9th' : 'Nobody can start a press on the 9th or the 18th')}
      </>;
    case 'skins': {
      const pot = get('skins.payout') === 'pot';
      const both = get('skins.kind') === 'both';
      const stake = get('skins.stake') ?? get('skins.value');
      return <>
        {label('Skins')}
        {pot
          ? amount('skins.stake', both ? 'Each player puts in, per pot' : 'Each player puts in', { label: both ? 'Each puts in, per pot' : 'Each player puts in' })
          : amount('skins.value', 'Per skin', { label: 'Value per skin' })}
        {example(pot
          ? `With ${n} players the pot is ${money(stake * n)}${both ? ' for net and again for gross' : ''}. Win 2 of 8 skins and you take a quarter of it, ${money(stake * n / 4)}.`
          : `Win a skin: up ${money(get('skins.value') * others)}, ${each(get('skins.value'))}.`)}
        <div className="block">
          {seg('skins.payout', [{ value: 'per', label: 'Per skin' }, { value: 'pot', label: 'Pot' }], 'Payout', true)}
          {help(pot ? 'Everyone puts in, and the pot is split by skins won. No skins won, everyone gets theirs back.' : 'Every other player pays the winner for each skin.')}
          {seg('skins.kind', [{ value: 'net', label: 'Net' }, { value: 'gross', label: 'Gross' }, { value: 'both', label: 'Both' }], 'Scores')}
          {help({ net: 'Net scores, with handicap strokes.', gross: 'Gross scores, no strokes.', both: 'A net skin and a gross skin on every hole, each with its own carryovers.' }[get('skins.kind') || 'net'])}
        </div>
        {toggle('skins.carryover', 'Carryovers', 'Tied holes roll the skin to the next hole')}
        {get('skins.carryover') && (
          <div className="block">
            {seg('skins.lastCarry', [{ value: 'void', label: 'Nobody' }, { value: 'split', label: 'Split' }, { value: 'playoff', label: 'Playoff' }], 'Still carried after the last hole', true)}
            {help({ void: 'Skins still carried after the last hole go unclaimed.', split: 'The players tied on the last hole share them.', playoff: 'The players tied on the last hole play off for them. Pick the winner on the results.' }[get('skins.lastCarry') || 'void'])}
          </div>
        )}
      </>;
    }
    case 'wolf':
      return <>
        {label('Points')}
        {amount('wolf.point', 'Per point', { label: 'Value per point' })}
        {example(`Every loser pays every winner a point. Win with a partner: up ${money(get('wolf.point') * 2)} each. Lone wolf win: up ${money(get('wolf.point') * (get('wolf.loneMultiplier') || 2) * 3)}.`)}
        <div className="block">
          {seg('wolf.loneMultiplier', [2, 3].map(n => ({ value: n, label: `${n}×` })), 'Lone wolf pays or wins', true)}
        </div>
      </>;
    case 'match':
      return <>
        {label('Bet')}
        {amount('match.stake', 'Stake per player', { label: 'Per player' })}
        {example(`Win 2 v 2 and you're each up ${money(get('match.stake'))}. Lose and you're each down ${money(get('match.stake'))}.`)}
        {note(`Each winner gets ${money(get('match.stake'))} from the losing side. Playing 1 v 3? The loner plays each of the three for ${money(get('match.stake'))}.`)}
        {label('Presses')}
        {presses('match')}
      </>;
    case 'hammer': {
      const max = get('hammer.max') ?? 3;
      return <>
        {label('Bets')}
        {amount('hammer.stake', 'Per hole', { label: 'Each hole starts at' })}
        {example(`Win a ${money(get('hammer.stake'))} hole after one hammer and you're up ${money(get('hammer.stake') * 2)}. Fold after a hammer and you're down ${money(get('hammer.stake'))}.`)}
        <div className="block">
          {seg('hammer.max', [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 0, label: 'No limit' }], 'Most hammers on a hole', true)}
          {help(max ? `A hole can go up to ${money(get('hammer.stake') * 2 ** max)}.` : 'Hammer back and forth as long as you like. Brave.')}
          {seg('hammer.who', [{ value: 'either', label: 'Either side' }, { value: 'trailing', label: 'Side behind' }], 'Who throws the first hammer')}
          {help(get('hammer.who') === 'trailing' ? 'Only the side behind can throw the first hammer on a hole (either side when it’s level). Then it goes back and forth.' : 'Either side can throw the first hammer. Then it goes back and forth: nobody hammers twice in a row.')}
        </div>
        {note('Each hole goes to the lower net score (best ball with partners). Hammer to double the hole. The other side plays on at double, or folds and pays what it was worth before.')}
      </>;
    }
    case 'vegas':
      return <>
        {label('Bets')}
        {amount('vegas.point', 'Per point', { label: 'Per point' })}
        {example(`Win a hole 45 to 47: up ${money(get('vegas.point') * 2)} each.`)}
        {toggle('vegas.birdieFlip', 'Birdies flip', 'A birdie flips the other team’s number (45 becomes 54)')}
        {note('Each hole, each player on the losing team pays the point difference.')}
      </>;
    case 'sixes':
      return <>
        {label('Bets')}
        {amount('sixes.stake', 'Per match', { label: get('sixes.mode') === 'holes' ? 'Per hole won' : 'Per match' })}
        {example(get('sixes.mode') === 'holes'
          ? `Finish a match 2 up and you're each up ${money(get('sixes.stake') * 2)} on it.`
          : `Win two of the three matches and lose one: you're up ${money(get('sixes.stake'))}.`)}
        <div className="block">
          {seg('sixes.mode', [{ value: 'match', label: 'Per match' }, { value: 'holes', label: 'Per hole' }])}
          {help(get('sixes.mode') === 'holes' ? `Each ${holesCount === 9 ? 'three' : 'six'}-hole match pays the bet for every hole a team finishes up.` : `Each ${holesCount === 9 ? 'three' : 'six'}-hole match pays the bet to each winner. Halved matches push.`)}
        </div>
      </>;
    case 'scramble':
      return <>
        {label('Bets')}
        {amount('scramble.stake', 'Each player puts in', { label: 'Each player puts in' })}
        {example(`With ${n} players the pot is ${money(get('scramble.stake') * n)}, and the winning team splits it.`)}
        {note(`Everyone puts in the same amount. The team with the lowest net total splits the pot; tied teams share it. Team handicaps use the WHS allowances: ${pct(SCRAMBLE_ALLOWANCE[2])}% for pairs, ${pct(SCRAMBLE_ALLOWANCE[3])}% for threes, ${pct(SCRAMBLE_ALLOWANCE[4])}% for fours.`)}
      </>;
    case 'stroke':
      return <>
        {label('Bets')}
        {amount('stroke.stake', get('stroke.payout') === 'pot' ? 'Each player puts in' : 'Per stroke', { label: get('stroke.payout') === 'pot' ? 'Each player puts in' : 'Per stroke' })}
        {example(get('stroke.payout') === 'pot' ? potExample('stroke.stake') : perExample('stroke.stake', 'stroke'))}
        <div className="block">
          {payout('stroke.payout', 'stroke')}
          {help(get('stroke.payout') === 'pot' ? 'Lowest net total takes the pot; ties split it.' : 'Every pair settles the difference in their net totals.')}
        </div>
      </>;
    case 'stableford':
      return <>
        {label('Bets')}
        {amount('stableford.stake', get('stableford.payout') === 'pot' ? 'Each player puts in' : 'Per point', { label: get('stableford.payout') === 'pot' ? 'Each player puts in' : 'Per point' })}
        {example(get('stableford.payout') === 'pot' ? potExample('stableford.stake') : perExample('stableford.stake', 'point'))}
        <div className="block">
          {payout('stableford.payout', 'point')}
          {seg('stableford.modified', [{ value: false, label: 'Standard' }, { value: true, label: 'Modified' }], 'Points')}
          {help(get('stableford.modified') ? 'Modified: double bogey −3, bogey −1, par 0, birdie 2, eagle 5, albatross 8.' : 'Standard: double bogey 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5. Uses net scores.')}
        </div>
      </>;
    case 'quota':
      return <>
        {label('Bets')}
        {amount('quota.stake', get('quota.payout') === 'pot' ? 'Each player puts in' : 'Per point', { label: get('quota.payout') === 'pot' ? 'Each player puts in' : 'Per point' })}
        {example(get('quota.payout') === 'pot' ? potExample('quota.stake') : perExample('quota.stake', 'point'))}
        <div className="block">
          {payout('quota.payout', 'point')}
          {help('Your quota is 36 minus your course handicap (18 minus it over nine). Gross scores earn bogey 1, par 2, birdie 4, eagle 8. Best finish against quota wins. Stop early and the quota shrinks to the holes played.')}
        </div>
      </>;
    case 'nines':
      return <>
        {label('Bets')}
        {amount('nines.point', 'Per point', { label: 'Per point' })}
        {example(`Every point above or below ${holesCount === 9 ? 27 : 54} is worth ${money(get('nines.point'))}: finish on ${(holesCount === 9 ? 27 : 54) + 6} and you're up ${money(get('nines.point') * 6)}.`)}
        {note('Nine points a hole: 5 for low, 3 for middle, 1 for high. Ties share the points.')}
      </>;
    case 'aces':
      return <>
        {label('Bets')}
        {amount('aces.ace', 'Ace: low score wins from each player', { label: 'Ace: low score wins from each player' })}
        {amount('aces.deuce', 'Deuce: high score pays each player', { label: 'Deuce: high score pays each player' })}
        {example(`Outright low: up ${money(get('aces.ace') * others)}. Outright high: down ${money(get('aces.deuce') * others)}.`)}
        {note('Only an outright low or high counts. Ties for low or high pay nothing.')}
      </>;
    case 'bbb':
      return <>
        {label('Bets')}
        {amount('bbb.value', 'Per point', { label: 'Per point' })}
        {example(`Each point wins ${money(get('bbb.value'))} from every other player: take one and you're up ${money(get('bbb.value') * others)}.`)}
        {note('Three points a hole: first on the green, closest once everyone is on, first in the hole. Every pair settles the difference in points. Handicaps don’t matter, so anyone can win.')}
      </>;
    case 'dots':
      return <>
        {label('Bets')}
        {amount('dots.value', 'Per dot', { label: 'Per dot' })}
        {example(`Each dot wins ${money(get('dots.value'))} from every other player: one dot and you're up ${money(get('dots.value') * others)}.`)}
        {toggle('dots.auto', 'Birdies count automatically', 'A birdie is a dot and an eagle is two, from the scores.')}
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
        {label('Bets')}
        {amount('rabbit.stake', 'Per rabbit', { label: 'Per rabbit' })}
        {example(`Hold it ${holesCount === 9 ? 'after the last hole' : 'at the turn'}: up ${money(get('rabbit.stake') * others)}, ${each(get('rabbit.stake'))}.`)}
        <div className="block">
          {seg('rabbit.mode', [{ value: 'free', label: 'Set it free' }, { value: 'steal', label: 'Steal it' }], 'When someone else wins a hole', true)}
          {help((get('rabbit.mode') || 'steal') === 'free' ? 'They set the rabbit free, and the next outright winner catches it.' : 'They take the rabbit straight from the holder.')}
        </div>
        {toggle('rabbit.tiesFree', 'Ties set it loose', 'Off, a halved hole changes nothing')}
        {note(holesCount === 9 ? 'Whoever holds the rabbit after the last hole wins the bet from everyone. Stop early and whoever holds it then is paid.' : 'Whoever holds the rabbit after hole 9 and again after hole 18 wins the bet from everyone. Stop early and whoever holds it then is paid.')}
      </>;
    case 'snake': {
      const growth = get('snake.growth') || 'flat';
      const v = get('snake.stake');
      // Most doubles; 0 or unset is no cap (a round saved before the cap existed has none)
      const cap = get('snake.cap') || 0;
      const steps = k => Array.from({ length: k }, (_, i) => money(v * 2 ** i)).join(', ');
      return <>
        {label('Bets')}
        {amount('snake.stake', growth === 'grow' ? 'Per three-putt' : 'Snake', { label: growth === 'grow' ? 'Per three-putt' : growth === 'double' ? 'First three-putt' : 'The snake' })}
        {example(growth === 'flat'
          ? `Hold the snake at the end: down ${money(v * others)}, ${money(v)} to each of the other ${others}.`
          : growth === 'grow'
            ? `Five three-putts make it ${money(v * 5)}: hold it at the end and you pay that to each of the other ${others}.`
            : cap
              ? `It doubles with every three-putt: ${steps(cap + 1)}, then it stays at ${money(v * 2 ** cap)}. Hold it at the end and pay that to each player.`
              : `It doubles with every three-putt: ${steps(4)} and so on, with no cap. Hold it at the end and pay that to each player.`)}
        <div className="block">
          {seg('snake.growth', [{ value: 'flat', label: 'Same all round' }, { value: 'grow', label: 'Grows' }, { value: 'double', label: 'Doubles' }], 'The snake', true)}
          {growth === 'double' && <>
            <div className="eyebrow" style={{ margin: '14px 0 8px' }}>Most doubles</div>
            <Segmented label="Most doubles" className="press-mode-row" btn="pm-btn" value={cap} onChange={x => set('snake.cap', x)}
              options={[{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' }, { value: 5, label: '5' }, { value: 0, label: 'No cap' }]} />
            {help(cap ? `The snake tops out at ${money(v * 2 ** cap)}. More three-putts still pass it on, but it stops doubling.` : 'It keeps doubling as long as people keep three-putting. Brave.')}
          </>}
        </div>
        {holesCount === 18 && toggle('snake.nines', 'Each nine', 'Settle the snake at the turn, then a fresh one for the back')}
        {note('Three-putt and you take the snake. The next three-putt takes it off you. Whoever holds it at the end pays everyone.')}
      </>;
    }
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
