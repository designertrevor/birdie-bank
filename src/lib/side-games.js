// Side games in words: worked examples, the by-game line and the Nassau note. Pure, so tests can load it.
import { GAMES } from './round.js';
import { DOT_KINDS } from './games.js';
import { money } from './golf.js';

const PLURAL = { greenie: 'greenies', sandy: 'sandies', barkie: 'barkies', chipin: 'chip-ins', polie: 'polies', arnie: 'arnies' };

/** "a foursome" for 4, else "3 players". */
const groupOf = n => (n === 4 ? 'a foursome' : n === 3 ? 'a threesome' : `${n} players`);

/** The worked example under a side game's bet, for `n` players. */
export function sideExample(game, settings, n = 4) {
  const others = Math.max(1, n - 1);
  const s = settings || {};
  if (game === 'skins') {
    if (s.payout === 'pot') {
      const stake = s.stake ?? s.value;
      return `Each player puts in ${money(stake)}, so the pot is ${money(stake * n)}. It’s split by skins won.${s.carryover ? ' Ties carry.' : ''}`;
    }
    return `Win a hole outright, win the skin.${s.carryover ? ' Ties carry.' : ''} Win 3 skins in ${groupOf(n)} and the other ${others} each pay you ${money(s.value * 3)}.`;
  }
  if (game === 'dots') {
    const on = Object.keys(DOT_KINDS).filter(k => s.kinds?.[k]);
    const list = on.length ? `${on.slice(0, 3).map(k => PLURAL[k]).join(', ')}${on.length > 3 ? ' and more' : ''}` : 'birdies';
    const one = on.includes('greenie') ? 'greenie' : on.length ? DOT_KINDS[on[0]].name.toLowerCase() : 'birdie';
    return `${list[0].toUpperCase()}${list.slice(1)}. One ${one} in ${groupOf(n)}: the other ${others} each pay you ${money(s.value)}.`;
  }
  if (game === 'birdies') {
    const eagle = s.eagleShares ?? 2;
    return `Every net birdie takes a share of the ${money((s.stake || 0) * n)} pot${eagle > 1 ? `, and a net eagle takes ${eagle}` : ''}. No birdies, nobody pays.`;
  }
  if (game === 'snake') {
    return `Three-putt and you take the snake. Hold it at the end and you pay the other ${others} ${money(s.stake)} each${s.growth === 'flat' ? '' : ', more as it grows'}.`;
  }
  if (game === 'rabbit') {
    return `Win a hole outright to catch the rabbit. Hold it after 9 (and again after 18) and the other ${others} each pay you ${money(s.stake)}.`;
  }
  return '';
}

/**
 * Skins house rules in one line, for a side game in setup: net or gross, the bet, and what
 * happens to skins still carried after the last hole. "Net · $2 a skin · last carry unclaimed".
 */
export function skinsRulesLine(settings) {
  const s = settings || {};
  const kind = { net: 'Net', gross: 'Gross', both: 'Net and gross' }[s.kind || 'net'] || 'Net';
  const bet = s.payout === 'pot' ? `${money(s.stake ?? s.value ?? 0)} each in the pot` : `${money(s.value ?? 0)} a skin`;
  const last = !s.carryover ? 'no carryovers'
    : { void: 'last carry unclaimed', split: 'last carry split', playoff: 'last carry played off' }[s.lastCarry || 'void'] || 'last carry unclaimed';
  return `${kind} · ${bet} · ${last}`;
}

/** Each game's money for one player in small type: "Nassau +$5 · Skins +$12 · Junk $0". */
export function gamesLine(byGame, pid, fmt = money) {
  if (!byGame) return '';
  return Object.values(byGame).map(g => `${g.label} ${fmt(g.balances[pid] || 0, { sign: true })}`).join(' · ');
}

/**
 * A line under the by-game table while a Nassau or match bet is still being played: its money so
 * far goes to whoever is ahead on the holes played, as the Nassau always has. Null otherwise.
 */
export function nassauOpenNote(round, byGame) {
  if (round.game !== 'nassau' && round.game !== 'match') return null;
  const lines = byGame?.main?.detail?.lines || [];
  if (!lines.some(l => l.status && !l.status.done)) return null;
  return `${GAMES[round.game].name}: a bet still being played counts for whoever is ahead on it right now.`;
}
