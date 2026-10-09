// A round's theme: the main game's colours (lib/game-theme.js), carried from Round ready into the
// round itself (the money bar, the hole header, the big hole moments and the halfway sheet). Several
// games in one round all wear the main game's theme. A card kept with no game (everyone just playing)
// has no theme, so it keeps the plain look. Pure, so the contrast checks run in the tests.
import { gameTheme } from './game-theme.js';
import { GAMES, cardOnly, sideGamesOf } from './round.js';

/** The theme for a round, or null when nobody's playing a game (a card only round) or the game is unknown. */
export function roundTheme(round) {
  if (!round || !GAMES[round.game] || cardOnly(round)) return null;
  return gameTheme(round.game);
}

/**
 * The theme as CSS custom properties for a `style` prop: `--gt` (the tint), `--gt-soft` (its pale
 * wash, light mode only) and `--gt-ink` (text on the tint). Nothing for no theme, so the CSS
 * fallbacks keep the plain look.
 */
export function themeVars(theme) {
  if (!theme) return undefined;
  return { '--gt': theme.tint, '--gt-soft': theme.soft, '--gt-ink': theme.ink };
}

/** Every game in the round with art to show, the main game first: for the stickers on Round ready. */
export function roundGameIds(round) {
  if (!round || cardOnly(round)) return [];
  return [round.game, ...sideGamesOf(round).map(sg => sg.game)].filter(Boolean);
}

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
