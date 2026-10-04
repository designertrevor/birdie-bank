// Side games in words: worked examples, the by-game line and the Nassau note. Pure, so tests can load it.
import { GAMES, POT_GAMES, SIDE_GAMES, holeComplete, potHoles, potHolesDefault, sideGamesOf } from './round.js';
import { DOT_KINDS } from './games.js';
import { money } from './golf.js';

const PLURAL = { greenie: 'greenies', sandy: 'sandies', barkie: 'barkies', chipin: 'chip-ins', polie: 'polies', arnie: 'arnies', hogan: 'hogans' };

/**
 * What the less familiar dots mean, for setup, when they're on: "Arnie: par or better without ever being
 * on the fairway. Hogan: ...". Empty when neither is on.
 */
export function dotsNote(kinds) {
  const words = {
    arnie: 'Arnie: par or better without ever being on the fairway.',
    hogan: 'Hogan: par or better after hitting the fairway and the green in regulation.',
  };
  const on = Object.keys(words).filter(k => kinds?.[k]);
  return on.length ? `${on.map(k => words[k]).join(' ')} Par 4s and 5s only.` : '';
}

/** "a foursome" for 4, else "3 players". */
const groupOf = n => (n === 4 ? 'a foursome' : n === 3 ? 'a threesome' : `${n} players`);

/** "holes 5, 9 and 14", "hole 18". */
function holesWords(nos) {
  if (nos.length === 1) return `hole ${nos[0]}`;
  return `holes ${nos.slice(0, -1).join(', ')} and ${nos.at(-1)}`;
}

/**
 * Which holes a closest to the pin or long drive pot is played on, in words: "Every par 3 (4 of
 * them)", "Every par 5", "Holes 5, 9 and 14". `holes` are the holes in play (null when the course
 * isn't picked yet).
 */
export function potHolesLine(game, settings, holes = null) {
  if (!holes?.length) {
    if (game === 'ctp') return 'Every par 3';
    return Array.isArray(settings?.holes) && settings.holes.length ? holesWords(settings.holes).replace(/^h/, 'H') : 'Every par 5';
  }
  const list = potHoles({ holes }, game, settings);
  if (!list.length) return game === 'ctp' ? 'No par 3s on this course' : 'No holes picked';
  const count = list.length === 1 ? '' : ` (${list.length} of them)`;
  if (game === 'ctp') return `Every par 3${count}`;
  if (potHolesDefault({ holes }, game, settings)) return `Every par ${list[0].par >= 5 ? 5 : 4}${count}`;
  const w = holesWords(list.map(h => h.no));
  return w[0].toUpperCase() + w.slice(1);
}

/**
 * Adding a closest to the pin or long drive pot partway: a pot hole already played counts only once
 * the keeper goes back and taps who won it, so say which (one line per pot in `list`, the side games
 * about to be saved). A pot already on only gets a line for holes new to it (long drive holes picked
 * partway). Empty when no pot hole is new or none of them is played yet.
 */
export function potCatchUpNotes(round, list) {
  const had = Object.fromEntries(sideGamesOf(round).map(sg => [sg.game, sg]));
  const out = [];
  for (const sg of list) {
    if (!POT_GAMES.includes(sg.game)) continue;
    const before = had[sg.game] ? new Set(potHoles(round, sg.game, had[sg.game].settings).map(h => h.no)) : new Set();
    const nos = potHoles(round, sg.game, sg.settings).filter(h => !before.has(h.no) && holeComplete(round, h) && round.marks?.[h.no]?.[sg.game] == null).map(h => h.no);
    if (!nos.length) continue;
    const where = holesWords(nos);
    const who = sg.game === 'ctp' ? 'was closest' : 'hit it longest';
    out.push(`${where[0].toUpperCase()}${where.slice(1)} ${nos.length === 1 ? 'is' : 'are'} already played. ${SIDE_GAMES[sg.game].label} counts ${nos.length === 1 ? 'it' : 'them'} once you go back and tap who ${who}.`);
  }
  return out;
}

/**
 * A side game's settings as the round plays them next to `sideGames`: Junk next to a closest to the
 * pin pot plays without greenies (the pot pays for being closest, see gameView), so its worked example
 * shouldn't promise one. Anything else comes back as it is.
 */
export function asPlayedWith(game, settings, sideGames = []) {
  // A greenie missing from the kinds still counts in the money (see pointsTable), so only `false` is off
  if (game !== 'dots' || !settings || settings.kinds?.greenie === false || !sideGames.some(sg => sg.game === 'ctp')) return settings;
  return { ...settings, kinds: { ...(settings.kinds || {}), greenie: false } };
}

/** What happens to a pot hole nobody wins, in a sentence, for a closest to the pin or long drive pot. */
export function potUnclaimedLine(game, settings) {
  const hole = game === 'ctp' ? 'A par 3' : 'A long drive hole';
  if (settings?.unclaimed === 'split') return `${hole} nobody wins is split across the holes that were won.`;
  return `${hole} nobody wins carries to the next one. Still carried after the last, it goes back to everyone.`;
}

/** The worked example under a side game's bet, for `n` players. `holes` are the holes in play, when known. */
export function sideExample(game, settings, n = 4, holes = null) {
  const others = Math.max(1, n - 1);
  const s = settings || {};
  if (game === 'ctp' || game === 'drive') {
    const pot = (s.stake || 0) * n;
    const count = holes?.length ? potHoles({ holes }, game, s).length : 0;
    const who = game === 'ctp' ? 'Closest to the pin on each par 3' : 'The longest drive in the fairway on each long drive hole';
    const share = count === 1 ? ' takes the whole pot' : count ? ` takes ${money(Math.round((pot / count) * 100) / 100)}, one of ${count} shares` : ' takes that hole’s share';
    return `Each player puts in ${money(s.stake || 0)}, so the pot is ${money(pot)}. ${who}${share}. ${potUnclaimedLine(game, s)}`;
  }
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
  const fair = [s.canadian && s.kind !== 'gross' && 'Canadian', s.validate && 'validated'].filter(Boolean);
  return [kind, bet, last, ...fair].join(' · ');
}

/** Each game's money for one player in small type: "Nassau +$5 · Skins +$12 · Junk $0". */
export function gamesLine(byGame, pid, fmt = money) {
  if (!byGame) return '';
  // Side bets between two players only show for someone with a bet
  const has = ([key, g]) => key !== 'bets' || (g.detail?.bets || []).some(b => b.sides.includes(pid));
  return Object.entries(byGame).filter(has).map(([, g]) => `${g.label} ${fmt(g.balances[pid] || 0, { sign: true })}`).join(' · ');
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
