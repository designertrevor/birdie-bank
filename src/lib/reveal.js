// The end-of-round reveal: turns a round's results into short, ordered steps (each bet resolving,
// or each player's skins, points or totals) that play before everyone's money lands. Pure: no DOM.
import { holeAtPos, roundLegs, sideNames, sides } from './round.js';
import { matchLabel, sideSplit } from './games.js';
import { money } from './golf.js';
import { betPeople, betStatusText } from './pair-bets.js';

const first = n => (n || '').split(' ')[0];
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** Winner text for a match status: "Ann 2 up", "Ann & Bo 3&2", "Halved". */
function matchWho(s, names) {
  if (s.leader === null) return s.left === 0 ? 'Halved' : 'All square';
  return matchLabel(s, names[s.leader]);
}

/** Up to three holes with the biggest single win, in playing order. rows: [{ no, deltas, text(pid) }]. */
function biggestHoles(rows, max = 3) {
  const best = rows.map((r, i) => {
    const [pid, amt] = Object.entries(r.deltas).reduce((a, e) => (e[1] > a[1] ? e : a), [null, 0]);
    // Everyone who won that much on the hole (partners, or the pack against a wolf)
    const tops = Object.entries(r.deltas).filter(e => Math.abs(e[1] - amt) < 0.005).map(e => e[0]);
    return { r, i, pid, amt, tops };
  }).filter(x => x.pid && x.amt > 0);
  return best
    .sort((a, b) => b.amt - a.amt || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map(x => ({ key: `h${x.r.no}`, label: `Hole ${x.r.no}`, text: x.r.text(x.pid, x.tops), amount: x.amt }));
}

/**
 * Ordered reveal steps for a finished (or partial) round.
 * Returns { title, steps } where each step is { key, label, text, amount?, value?, tie?, money? }:
 * `amount` is money to count up, `value` is a plain label (skins, points), `tie` marks a push.
 * `money` marks a reward round's side bet played for money, whose amount reads in dollars while
 * the rest read in points. Games with nothing worth breaking down return no steps, so the totals
 * play on their own.
 */
export function revealSteps(round, res) {
  const out = gameSteps(round, res);
  // A reward round's side bets for money come last, in dollars (see roundResults' `cash`)
  const cash = (res?.cash?.list || []).map(b => ({ ...betStep(round, b), label: `${b.label} · ${betPeople(round, b.bet)} · For money`, money: true }));
  return cash.length ? { title: out.steps.length ? out.title : 'The bets', steps: [...out.steps, ...cash] } : out;
}

function gameSteps(round, res) {
  const main = mainRevealSteps(round, res);
  const byGame = res?.detail?.byGame;
  if (!byGame) return main;
  // Several games: the main game's steps, then one summary step per side game
  const players = round.players || [];
  const name = id => first(players.find(p => p.id === id)?.name) || '?';
  const extra = Object.entries(byGame).filter(([key]) => key !== 'main')
    .flatMap(([key, g]) => (key === 'bets' ? (g.detail?.bets || []).map(b => betStep(round, b)) : [sideStep(key, g, name, players)]));
  return { title: main.steps.length ? main.title : 'The games', steps: [...main.steps, ...extra] };
}

/** One side bet between two players: "Match · Preston v Tyler", where it stands, and what it paid. */
function betStep(round, r) {
  const label = `${r.label} · ${betPeople(round, r.bet)}`;
  const text = betStatusText(round, r);
  return r.amount ? { key: `bet-${r.id}`, label, text, amount: Math.abs(r.amount) } : { key: `bet-${r.id}`, label, text, tie: true };
}

/** One side game's reveal step: who did best in it and what it brought them, or a push. */
function sideStep(key, g, name, players) {
  const ids = players.map(p => p.id);
  const best = ids.reduce((a, id) => ((g.balances[id] || 0) > (g.balances[a] || 0) ? id : a), ids[0]);
  const amount = g.balances[best] || 0;
  const d = g.detail || {};
  if (amount <= 0) {
    const text = { skins: 'No skins won', dots: 'No dots', birdies: 'No birdies, nobody pays', ctp: 'Nobody won a par 3, nobody pays', drive: 'No long drive won, nobody pays' }[key] || 'All square';
    return { key: `side-${key}`, label: g.label, text, tie: true };
  }
  let text = `${name(best)} comes out ahead`;
  if (key === 'skins' && d.skinsWon?.[best]) text = `${name(best)} won ${plural(Math.round(d.skinsWon[best].skins * 10) / 10, 'skin')}`;
  if (key === 'dots' && d.points) text = `${name(best)} had ${plural(d.points[best] || 0, 'dot')}`;
  if (key === 'birdies' && d.birdies) text = `${name(best)} took ${plural(d.birdies.shares[best] || 0, 'share')} of the pot`;
  // Closest to the pin and long drive: who took the most of the pot, and on which holes
  if ((key === 'ctp' || key === 'drive') && d.pot?.won?.[best]) {
    const nos = d.pot.won[best].holes;
    const where = `${nos.length === 1 ? 'hole' : 'holes'} ${nos.length > 1 ? `${nos.slice(0, -1).join(', ')} and ${nos.at(-1)}` : nos[0]}`;
    text = key === 'ctp' ? `${name(best)} was closest on ${where}` : `${name(best)} had the long drive on ${where}`;
  }
  return { key: `side-${key}`, label: g.label, text, amount };
}

/** The main game's steps (a round's only game before side games). */
function mainRevealSteps(round, res) {
  const d = res?.detail || {};
  const players = round.players || [];
  const name = id => first(players.find(p => p.id === id)?.name) || '?';

  if ((round.game === 'nassau' || round.game === 'match') && d.lines) {
    const LEGS = roundLegs(round);
    const sn = round.teams ? sideNames(round) : sideNames(round).map(first);
    const lines = d.lines.filter(l => l.status.played > 0);
    const steps = lines.map(l => {
      const s = l.status;
      const legLabel = LEGS[l.leg]?.label || l.leg;
      const label = l.press
        ? `${round.game === 'nassau' ? `${legLabel} press` : 'Press'} from H${holeAtPos(round, l.start)}`
        : legLabel;
      return s.leader === null
        ? { key: l.key, label, text: matchWho(s, sn), tie: true }
        : { key: l.key, label, text: matchWho(s, sn), amount: Math.abs(l.value) };
    });
    return { title: round.game === 'match' && !lines.some(l => l.press) ? 'The match' : 'The bets', steps };
  }

  if (round.game === 'skins' && d.skins) {
    const n = players.length;
    let won = d.skinsWon;
    if (!won) {
      // Rounds scored before the skins house rules: work it out from the rows
      won = {};
      for (const r of d.skins.rows) {
        if (!r.winner) continue;
        won[r.winner] ??= { skins: 0, holes: [], amount: 0 };
        won[r.winner].skins += r.skins;
        // Each skin is worth the bet on the hole it came from, paid by the others on the winning hole
        won[r.winner].amount += (r.worth ?? r.skins * d.skins.value) * ((r.field?.length ?? n) - 1);
        won[r.winner].holes.push(r.hole.no);
      }
    }
    // Holes read H4, or H4 net and H4 gross when both kinds are in play
    const holeTag = h => (typeof h === 'string' ? `H${h.slice(0, -1)} ${h.endsWith('g') ? 'gross' : 'net'}` : `H${h}`);
    const count = v => (Number.isInteger(v) ? plural(v, 'skin') : `${Math.round(v * 10) / 10} skins`);
    const steps = players
      .filter(p => won[p.id]?.skins)
      .sort((a, b) => won[b.id].skins - won[a.id].skins)
      .map(p => ({
        key: p.id, label: name(p.id), text: won[p.id].holes.map(holeTag).join(', '),
        value: count(won[p.id].skins), amount: won[p.id].amount,
      }));
    const unclaimed = (d.skins.unclaimed || 0) + (d.skinsGross?.unclaimed || 0);
    const end = d.skins.end || d.skinsGross?.end;
    if (steps.length && unclaimed > 0) {
      const text = end?.rule === 'playoff' ? 'Playoff to come' : unclaimed === 1 ? 'Nobody claimed it' : 'Nobody claimed them';
      steps.push({ key: 'carry', label: 'Carried over', text, value: plural(unclaimed, 'skin'), tie: true });
    }
    return { title: 'Skins won', steps };
  }

  if (round.game === 'hammer' && d.hammer) {
    const sn = round.teams ? sideNames(round) : sideNames(round).map(first);
    const [a, b] = sides(round);
    const rows = d.hammer.filter(r => r.value > 0 && r.winner != null).map(r => {
      // The same split as the money: with uneven sides the lone player wins or pays for both
      const [ea, eb] = sideSplit(r.value, a.length, b.length, r.winner);
      const deltas = {};
      for (const pid of a) deltas[pid] = ea;
      for (const pid of b) deltas[pid] = eb;
      const how = r.conceded != null ? ', the other side folded' : r.hammers.length ? `, hammered ${r.hammers.length}×` : '';
      return { no: r.hole.no, deltas, text: () => `${sn[r.winner]}${how}` };
    });
    return { title: 'Biggest holes', steps: biggestHoles(rows) };
  }

  if ((round.game === 'banker' || round.game === 'wolf') && d.holes) {
    const rows = d.holes.map(h => ({
      no: h.no, deltas: h.deltas,
      text: (pid, tops = [pid]) => {
        const names = tops.map(name).join(' & ');
        if (round.game === 'banker') return pid === h.banker ? `${name(pid)} as banker` : `${names} beat${tops.length > 1 ? '' : 's'} the banker`;
        const w = round.wolf?.[h.no];
        if (w && w.partner === null && pid === w.wolf) return `${name(pid)}, ${w.blind ? 'blind' : 'lone'} wolf`;
        // The pack beating a lone or blind wolf, or a wolf and partner winning together
        if (w && w.partner === null && !tops.includes(w.wolf)) return `The pack beats ${name(w.wolf)}`;
        return tops.length > 1 ? names : pid === w?.wolf ? `${name(pid)}, the wolf` : names;
      },
    }));
    return { title: 'Biggest holes', steps: biggestHoles(rows) };
  }

  if (round.game === 'vegas' && d.vegas) {
    const t = round.teams || [];
    const rows = d.vegas.filter(r => r.played).map(r => ({
      no: r.hole.no, deltas: r.deltas,
      text: () => `${t[r.diff > 0 ? 0 : 1]?.name || '?'} by ${plural(Math.abs(r.diff), 'point')}`,
    }));
    return { title: 'Biggest holes', steps: biggestHoles(rows) };
  }

  if (round.game === 'aces' && d.holes) {
    const count = Object.fromEntries(players.map(p => [p.id, { ace: 0, deuce: 0 }]));
    for (const h of d.holes) {
      if (h.ace) count[h.ace].ace++;
      if (h.deuce) count[h.deuce].deuce++;
    }
    const steps = d.holes.length ? [...players]
      .sort((a, b) => count[b.id].ace - count[a.id].ace || count[a.id].deuce - count[b.id].deuce)
      .map(p => ({ key: p.id, label: name(p.id), text: plural(count[p.id].deuce, 'deuce'), value: plural(count[p.id].ace, 'ace') })) : [];
    return { title: 'Aces and deuces', steps };
  }

  if (round.game === 'sixes' && d.matches) {
    const pair = side => side.map(name).join(' & ');
    const steps = d.matches.filter(m => m.status.played > 0).map(m => {
      const s = m.status;
      const text = matchWho(s, m.sides.map(pair));
      return m.net === 0 ? { key: `m${m.index}`, label: m.seg.label, text, tie: true } : { key: `m${m.index}`, label: m.seg.label, text, amount: Math.abs(m.net) };
    });
    return { title: 'Three matches', steps };
  }

  if (round.game === 'rabbit' && d.rabbit) {
    // Every leg with holes played pays, finished or not (like a Nassau leg)
    const steps = d.rabbit.legs.filter(l => l.played ?? l.done).map(l => (l.pays ?? l.holder
      ? { key: l.seg.label, label: l.seg.label, text: `${name(l.holder)} holds the rabbit`, amount: l.amount ?? (round.settings?.rabbit?.stake || 0) * (players.length - 1) }
      : { key: l.seg.label, label: l.seg.label, text: 'Loose at the end, no payout', tie: true }));
    return { title: 'The rabbit', steps };
  }

  if (round.game === 'snake' && d.snake) {
    const steps = d.snake.legs.filter(l => l.played).map(l => (l.holder && l.value
      ? { key: l.seg.label, label: d.snake.legs.length > 1 ? l.seg.label : 'The snake', text: `${name(l.holder)} ${l.done ? 'held' : 'holds'} it, so pays ${money(l.value)} a player`, amount: l.value * l.others.length }
      : { key: l.seg.label, label: d.snake.legs.length > 1 ? l.seg.label : 'The snake', text: 'Nobody three-putted', tie: true }));
    return { title: 'The snake', steps };
  }

  if ((round.game === 'nines' || round.game === 'bbb' || round.game === 'dots') && d.points) {
    if (!d.rows?.length) return { title: 'Points', steps: [] };
    const dots = round.game === 'dots';
    const steps = [...players]
      .sort((a, b) => (d.points[b.id] || 0) - (d.points[a.id] || 0))
      .map(p => ({ key: p.id, label: name(p.id), text: '', value: dots ? plural(d.points[p.id] || 0, 'dot') : plural(d.points[p.id] || 0, 'point') }));
    return { title: dots ? 'Dots' : 'Points', steps };
  }

  if (['stroke', 'stableford', 'quota', 'scramble'].includes(round.game) && d.totals) {
    const rows = d.totals.filter(x => x.played);
    const lowerWins = round.game === 'stroke' || round.game === 'scramble';
    const sorted = [...rows].sort((a, b) => (lowerWins ? a.total - b.total : round.game === 'quota' ? b.vsQuota - a.vsQuota : b.total - a.total));
    const toPar = v => (v === 0 ? 'E' : v > 0 ? `+${v}` : String(v));
    const steps = sorted.map(x => {
      const label = round.game === 'scramble' ? x.name : first(x.name);
      if (round.game === 'quota') return { key: x.id, label, text: `${x.total} pts, quota ${x.target ?? x.quota}`, value: `${toPar(x.vsQuota)}` };
      if (round.game === 'stableford') return { key: x.id, label, text: '', value: plural(x.total, 'pt', 'pts') };
      return { key: x.id, label, text: `Net ${x.total}`, value: toPar(x.toPar) };
    });
    return { title: round.game === 'scramble' ? 'Team totals' : 'Totals', steps };
  }

  return { title: '', steps: [] };
}

/**
 * Timing for the reveal, in ms. Steps share a budget so the whole moment stays near four seconds,
 * then the player totals count up with a short stagger, losers first and the winner last.
 */
export function revealTiming(stepCount, playerCount) {
  const gap = stepCount ? Math.min(420, Math.round(2000 / stepCount)) : 0;
  const stepsEnd = stepCount ? gap * stepCount + 250 : 0;
  const stagger = stepCount ? 120 : 180;
  // A touch shorter than the first cut (900 / 1100): each total now lands with a small pop, which reads as the finish
  const count = stepCount ? 800 : 1000;
  const landed = stepsEnd + stagger * Math.max(0, playerCount - 1) + count;
  return { gap, stepsEnd, stagger, count, landed };
}
