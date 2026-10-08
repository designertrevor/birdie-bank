// The art palette: the colours every drawing uses (the Ball buddies, the spots, the game art and
// the scenes), in one place so they can't drift. The components import the names; the art sheet
// (?art) and src/art/README.md show PALETTE. Pure data, so a test pins the values.
export const INK = '#0a0a0a';
export const BALL = '#fbf7ec';
export const PINK = '#ff4d8b';
export const DEEP = '#d42a6b';
export const OCHRE = '#e8b94a';
export const GOLD = '#c99a30';
export const COIN = '#ffd45c';
export const TEAL = '#1a3a3a';
export const MINT = '#a4d4c5';
export const CORAL = '#ff6b5a';
export const LAV = '#b8a4ed';
export const PEACH = '#ffb084';
export const BLUSH = '#ffd6e5';

/** The palette with its names, for the sheet and the README. */
export const PALETTE = [
  ['Ink', INK], ['Ball', BALL], ['Pink', PINK], ['Deep pink', DEEP], ['Ochre', OCHRE], ['Gold', GOLD],
  ['Coin', COIN], ['Teal', TEAL], ['Mint', MINT], ['Coral', CORAL], ['Lavender', LAV], ['Peach', PEACH], ['Blush', BLUSH],
];
