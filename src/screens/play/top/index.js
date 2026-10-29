// Five trial tops for the scoring screen (n5/top, 2026-10-29): the money, the hole and its scorecard
// button, and what the hole is worth, laid out five ways. Pick one with ?top=a to e (kept in
// localStorage bb-top by main.jsx, which sets <html data-top>); with none set, Play shows today's top.
// Each variant is its own file (TopA.jsx and top-a.css, ...), so the four that lose delete cleanly.
//
// A variant exports any of three parts, which Play.jsx places:
//   Header  replaces the screen's header (PlayHeader), money strip and all
//   Pinned  sits under the header and stays put (where today's money strip is)
//   Head    rides at the top of the hole's scroll (where today's hole line and game panel are)
// Each gets the same props (see `top` in Play.jsx). The banker's bets list always comes after Head,
// so each variant holds just the banker's bar (`panels()` gives the game's panel with that split).
import * as A from './TopA.jsx';
import * as B from './TopB.jsx';
import * as C from './TopC.jsx';
import * as D from './TopD.jsx';
import * as E from './TopE.jsx';

export const TOPS = { a: A, b: B, c: C, d: D, e: E };

/** The trial top this phone asked for ('a' to 'e'), or null for today's. */
export function topVariant() {
  try { return TOPS[document.documentElement.dataset.top] ? document.documentElement.dataset.top : null; } catch { return null; }
}
