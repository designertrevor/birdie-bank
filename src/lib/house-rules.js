// The house rules added 2026-09-30, in a few words each for the bet line ("$2 a point · lone wolf 2× ·
// ties carry"). Only rules that are on say anything, so a round without them reads as it always did.
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
  return on.join(' · ');
}
