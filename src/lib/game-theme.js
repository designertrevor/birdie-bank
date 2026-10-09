// A game's theme: the colour its game art sits on (by the game's group), carried from the game
// picker into the round, the reveal and the share card. Pure data from round.js and the art
// palette, so the round, the results and the share image all read the same values.
import { GAMES } from './round.js';
import { INK, OCHRE, PINK, MINT, LAV, PEACH } from './art-palette.js';

/** Each group's colour. GameArt's GROUP_TINT reads this one. */
export const GROUP_TINTS = { Classics: OCHRE, 'Head to head': PINK, Team: MINT, 'Full round': LAV, Points: PEACH };

/** Mix a hex colour toward white (amount 0 to 1). */
export function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = c => Math.round(c + (255 - c) * amount);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * The theme for a game id: `tint` (the art backdrop), `soft` (a pale wash of it for a band or a
 * card behind text in light mode), `ink` (text on the tint, always the palette ink, since every
 * tint is light) and `group`. An unknown game gets Points' peach.
 */
export function gameTheme(game) {
  const group = GAMES[game]?.group || null;
  const tint = GROUP_TINTS[group] || PEACH;
  return { game: game || null, group, tint, soft: lighten(tint, 0.72), ink: INK };
}
