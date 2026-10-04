// The house rules added 2026-09-30 and 2026-10-03, in a few words each for the bet line ("$2 a point ·
// lone wolf 2× · ties carry"). Only rules that are on say anything, so a round without them reads as it always did.
// The money for each lives with its game in round.js (and scramble-drives.js, which moves none).

/** Short words for a game's newer house rules that are on, '' when none are. */
export function houseRulesLine(game, gs) {
  if (!gs) return '';
  const on = [];
  if (game === 'wolf' && gs.carry) on.push('ties carry');
  if (game === 'vegas' && gs.birdieDouble) on.push('birdies double');
  if (game === 'sixes' && gs.carry && gs.mode !== 'holes') on.push('halved matches carry');
  if (game === 'scramble' && gs.drives) on.push(`${gs.drives} drives each`);
  if (game === 'stroke' && gs.cap) on.push('net double bogey max');
  if (game === 'nines' && gs.sweep) on.push('win by 2 takes all 9');
  if (game === 'aces' && gs.carry) on.push('ties carry');
  if (game === 'bbb' && gs.sweep) on.push('sweep doubles');
  // Added 2026-10-03: one more per game, and three for Quota
  if (game === 'quota' && gs.minus) on.push('double bogey −1');
  if ((game === 'quota' || game === 'stroke' || game === 'stableford') && gs.nassau && gs.payout === 'pot') on.push('front, back and total');
  if (game === 'quota' && gs.split === 'over' && gs.payout === 'pot') on.push('everyone over quota shares');
  if (game === 'banker' && gs.par3Triple) on.push('par 3 presses triple');
  if ((game === 'nassau' || game === 'match' || game === 'sixes') && gs.teamScore === 'total') on.push('both balls count');
  if (game === 'skins' && gs.backDouble && gs.payout !== 'pot') on.push('back nine doubles');
  if (game === 'wolf' && gs.lastWolf) on.push('last place is wolf on 17 and 18');
  if (game === 'hammer' && gs.birdie) on.push('birdie hammer');
  if (game === 'vegas' && gs.daytona) on.push('Daytona');
  if (game === 'scramble' && gs.second) on.push('second gets its money back');
  if (game === 'nines' && gs.birdie) on.push('birdie wins 7');
  if (game === 'bbb' && gs.netBongo) on.push('Bongo is low net');
  if (game === 'dots' && gs.greenieCarry) on.push('greenies carry');
  if (game === 'rabbit' && gs.sixes) on.push('three rabbits');
  if (game === 'snake' && gs.fourPutt && (gs.growth || 'flat') !== 'flat') on.push('four-putts count twice');
  return on.join(' · ');
}
