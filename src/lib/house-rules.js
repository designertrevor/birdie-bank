// The house rules added 2026-09-30, 2026-10-03 and 2026-10-05, in a few words each for the bet line ("$2 a point ·
// lone wolf 2× · ties carry"). Only rules that are on say anything, so a round without them reads as it always did.
// The money for each lives with its game in round.js (and scramble-drives.js, which moves none).
import { PENALTY_DOTS } from './games.js';

/** The penalty dots switched on (they count only when set to true), in DOT_KINDS order. */
export function penaltyDotsOn(kinds) {
  return PENALTY_DOTS.filter(k => kinds?.[k] === true);
}

/**
 * Short words for a game's newer house rules that are on, '' when none are. `holes` is how long the
 * round is: the rules that only work over 18 holes say nothing in a 9-hole round, where they don't play.
 */
export function houseRulesLine(game, gs, holes = 18) {
  if (!gs) return '';
  const on = [];
  const full = holes === 18;
  if (game === 'wolf' && gs.carry) on.push('ties carry');
  if (game === 'vegas' && gs.birdieDouble) on.push('birdies double');
  if (game === 'sixes' && gs.carry && gs.mode !== 'holes') on.push('halved matches carry');
  if ((game === 'scramble' || game === 'shamble') && gs.drives) on.push(`${gs.drives} drives each`);
  if ((game === 'bestball' || game === 'shamble') && gs.count === 2) on.push('best two balls');
  if (game === 'stroke' && gs.cap) on.push('net double bogey max');
  if (game === 'nines' && gs.sweep) on.push('win by 2 takes all 9');
  if (game === 'aces' && gs.carry) on.push('ties carry');
  if (game === 'bbb' && gs.sweep) on.push('sweep doubles');
  // Added 2026-10-03: one more per game, and three for Quota
  if (game === 'quota' && gs.minus) on.push('double bogey −1');
  // Team quota is one pot between the teams, so the pots and shares of the other rules don't play with it
  const teamQ = game === 'quota' && !!gs.team && gs.payout === 'pot';
  if ((game === 'quota' || game === 'stroke' || game === 'stableford') && full && gs.nassau && gs.payout === 'pot' && !teamQ) on.push('front, back and total');
  if (game === 'quota' && gs.split === 'over' && gs.payout === 'pot' && !teamQ) on.push('everyone over quota shares');
  if (game === 'banker' && gs.par3Triple) on.push('par 3 presses triple');
  if ((game === 'nassau' || game === 'match' || game === 'sixes') && gs.teamScore === 'total') on.push('both balls count');
  if (game === 'skins' && full && gs.backDouble && gs.payout !== 'pot') on.push('back nine doubles');
  if (game === 'wolf' && full && gs.lastWolf) on.push('last place is wolf on 17 and 18');
  if (game === 'hammer' && gs.birdie) on.push('birdie hammer');
  if (game === 'vegas' && gs.daytona) on.push('Daytona');
  if (game === 'scramble' && gs.second) on.push('second gets its money back');
  if (game === 'nines' && gs.birdie) on.push('birdie wins 7');
  if (game === 'bbb' && gs.netBongo) on.push('Bongo is low net');
  if (game === 'dots' && gs.greenieCarry) on.push('greenies carry');
  if (game === 'rabbit' && full && gs.sixes) on.push('three rabbits');
  if (game === 'snake' && gs.fourPutt && (gs.growth || 'flat') !== 'flat') on.push('four-putts count twice');
  // Added 2026-10-05 (overnight 9): Quota's three and one more for most games
  if (game === 'quota' && gs.table === 'stableford') on.push('Stableford points');
  if (game === 'quota' && (gs.adjust === 'one' || gs.adjust === 'half')) on.push(gs.adjust === 'one' ? 'quota moves 1 after' : 'quota moves half after');
  if (teamQ) on.push('team quota');
  if (game === 'stableford' && gs.table === 'chicago') on.push('big birdies');
  if (game === 'stroke' && gs.gross && gs.payout === 'pot') on.push('low gross too');
  if (game === 'banker' && gs.pressAll) on.push('banker presses everyone');
  if ((game === 'nassau' || game === 'match') && (gs.bye === 'half' || gs.bye === 'full')) on.push(gs.bye === 'half' ? 'a bye for half' : 'a bye');
  if (game === 'skins' && gs.birdieDouble) on.push('birdies win two skins');
  if (game === 'wolf' && gs.birdieDouble) on.push('birdies double');
  if (game === 'hammer' && gs.carry) on.push('halved holes carry');
  if (game === 'vegas' && gs.max9) on.push('no double digits');
  if (game === 'sixes' && gs.press && gs.mode !== 'holes') on.push('auto press at 2 down');
  if (game === 'dots' && penaltyDotsOn(gs.kinds).length) on.push('penalty dots');
  if (game === 'rabbit' && full && gs.backDouble && !gs.sixes) on.push('back nine rabbit doubles');
  if (game === 'snake' && gs.split) on.push('snake split');
  if (game === 'bbb' && gs.bingoDrive) on.push('Bingo is the longest drive');
  if ((game === 'bestball' || game === 'shamble') && gs.lowTotal && gs.format === 'hole') on.push('low ball and low total');
  return on.join(' · ');
}
