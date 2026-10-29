// What's riding on the hole, in a few words, for the trial tops that say it rather than show the
// game's panel for it (D's scoreboard tile and E's sentence). Display only: every number comes from
// the same functions the game panels use. Null for a game with nothing short to say (its panel says it).
import { GAMES, bankerPress, bankerPressAll, matchScored, nassauWinners, nassauAmounts, playersOn, posOf, roundLegs, settingsAt, vegasTable, wolfCarryBefore } from '../../../lib/round.js';
import { nassauBets } from '../../../lib/golf.js';
import { unitFmt } from '../../../lib/play-for.js';
import { onTheLine } from '../../../lib/play-screen.js';
import { skinsWorth } from '../hole-info.js';

const first = n => (n || '').split(' ')[0];
/** "a, b and c" */
export const listWords = xs => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * `main` is the main game's round. Returns { label, big, sub, sentence, tap } where `label` names the
 * tile ("Riding"), `big` is its one number or name, `sub` the line under it, `sentence` the plain words
 * and `tap` says what tapping it opens ('bets' for the skins price), or null.
 */
export function holeStakes({ main, hole, game, banker, wolf }) {
  const fmt = unitFmt(main);
  if (game === 'skins') {
    const w = skinsWorth(main, hole);
    const p = w.parts[0];
    const skins = x => `${x.skins} skin${x.skins > 1 ? 's' : ''}`;
    const more = w.parts.length > 1 ? `${p.tag} ${skins(p)}${p.money ? `, ${p.money}` : ''} · ${w.parts.slice(1).map(x => `${x.tag} ${skins(x)}`).join(' · ')}` : null;
    return {
      label: 'Riding',
      big: p.money || skins(p),
      sub: more || (p.money ? `${skins(p)} · ${w.price}` : w.price),
      sentence: `${listWords(w.parts.map(x => `${x.tag ? `${x.tag.toLowerCase()} ` : ''}${skins(x)}${x.money ? `, ${x.money}` : ''}`))} riding.`.replace(/^./, c => c.toUpperCase()),
      tap: 'bets',
    };
  }
  if (game === 'nassau' || game === 'match' || (matchScored(main) && game !== 'sixes')) {
    const LEGS = roundLegs(main);
    const pos = posOf(main, hole);
    const bets = nassauBets(nassauWinners(main), main.presses || [], nassauAmounts(main), LEGS);
    const live = bets.filter(b => pos >= b.start && pos <= b.end && !b.status.closed);
    if (!live.length) return { label: 'Riding', big: 'None', sub: 'Every bet is settled', sentence: 'Every bet is settled.' };
    const name = b => (b.press ? (b.bye ? 'the bye' : 'a press') : LEGS[b.leg].label.toLowerCase());
    const presses = live.filter(b => b.press).length;
    const legs = live.filter(b => !b.press).map(b => LEGS[b.leg].label);
    const same = live.every(b => b.amount === live[0].amount);
    return {
      label: 'Riding',
      big: `${live.length} bet${live.length > 1 ? 's' : ''}`,
      sub: [...legs, ...(presses ? [`${presses} press${presses > 1 ? 'es' : ''}`] : [])].join(' · ') + (same ? ` · ${fmt(live[0].amount)} each` : ''),
      sentence: `${listWords(live.map(name)).replace(/^./, c => c.toUpperCase())} ${live.length > 1 ? 'are' : 'is'} live${same ? `, ${fmt(live[0].amount)} each` : ''}.`,
    };
  }
  if (game === 'wolf' && wolf) {
    const w = main.players.find(p => p.id === wolf.wolf);
    const cfg = settingsAt(main, posOf(main, hole)).wolf;
    const carried = wolfCarryBefore(main, hole);
    return {
      label: 'Wolf',
      big: first(w?.name),
      sub: `${fmt(cfg.point)} a point${carried ? ` · pays ${carried + 1}×` : ''}`,
      sentence: `${first(w?.name)} is the wolf, ${fmt(cfg.point)} a point${carried ? `, and it pays ${carried + 1}×` : ''}.`,
    };
  }
  if (game === 'banker' && banker) {
    const b = main.players.find(p => p.id === banker.banker);
    const f = bankerPress(main, hole);
    const rule = bankerPressAll(main, hole);
    const others = playersOn(main, hole).filter(p => p.id !== banker.banker);
    const all = !!rule && (others.some(p => banker.doubled[p.id]) || rule === 'any');
    const line = fmt(onTheLine(banker, f, all));
    return { label: 'On the line', big: line, sub: `${first(b?.name)} banks`, sentence: `${first(b?.name)} is the bank, ${line} on the line.` };
  }
  if (game === 'vegas') {
    const point = main.settings.vegas.point;
    const total = vegasTable(main).filter(r => r.played).reduce((a, r) => a + r.diff, 0);
    const teams = main.teams || [];
    const match = total === 0 ? 'all square' : `${teams[total > 0 ? 0 : 1]?.name} +${Math.abs(total)}`;
    return { label: 'A point', big: fmt(point), sub: `Match ${match}`, sentence: `${fmt(point)} a point. The match is ${match}.` };
  }
  return { label: 'Game', big: GAMES[game]?.name || '', sub: '', sentence: null };
}
