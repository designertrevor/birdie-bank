// Honest stroke dots when games in a round count strokes differently (Overnight 6).
// The dots on the scorecard and the Play screen are always the main game's strokes. A side game with
// its own Strokes given % (sideGames[i].hcPct) or with half strokes where the main game has full ones
// counts something else, so these say what that side game counts, without a second set of dots.
import { gameKeyLabel, gameView, playsHole, popsFor, sideGamesOf } from './round.js';
import { gamePct, halfStrokesOn, pctWords } from './allowances.js';

const firstName = n => (n || '').split(' ')[0];

/** Side games whose strokes are not the dots: [{ key, label, pct, half, view }]. Empty with handicaps off. */
export function otherStrokeGames(round) {
  if (!round?.useHandicaps) return [];
  const mainHalf = halfStrokesOn(round);
  const out = [];
  for (const sg of sideGamesOf(round)) {
    const view = gameView(round, sg.game);
    if (!view) continue;
    const half = halfStrokesOn(view);
    const pct = gamePct(round, sg.game);
    const pctDiff = pct !== gamePct(round);
    // A side game that doesn't count strokes at all (Snake) has nothing to say
    if (!pctDiff && half === mainHalf) continue;
    if (!view.players.some(p => round.holes.some(h => popsFor(view, p, h) !== 0))) continue;
    out.push({ key: sg.game, label: gameKeyLabel(round, sg.game), pct: pctDiff ? pct : null, half: half !== mainHalf ? half : null, view });
  }
  return out;
}

/** A player's strokes over the round in one game's view, counting only holes they play. */
function roundStrokes(view, p) {
  return view.holes.reduce((a, h) => a + (playsHole(view, p.id, h) ? popsFor(view, p, h) : 0), 0);
}

/**
 * The key lines under the scorecard, one per side game that counts strokes differently:
 * "Skins plays off 85% of strokes: Ann 6, Bo 1" or "Skins counts each stroke as half".
 * The first line, `dots`, names whose strokes the dots are, and is only set when there are other lines.
 */
export function strokeKey(round) {
  const others = otherStrokeGames(round);
  if (!others.length) return { dots: '', lines: [] };
  const lines = others.map(g => {
    const how = [g.pct != null ? `plays off ${pctWords(g.pct)}` : '', g.half === true ? 'counts each stroke as half' : g.half === false ? 'counts full strokes' : ''].filter(Boolean).join(' and ');
    // The counts only change with the %, not with half strokes (the same strokes, each worth half)
    const who = g.pct != null ? g.view.players.map(p => ({ name: firstName(p.name), n: roundStrokes(g.view, p) })).filter(x => x.n !== 0) : [];
    return { key: g.key, text: `${g.label} ${how}${who.length ? `: ${who.map(x => `${x.name} ${x.n}`).join(', ')}` : ''}` };
  });
  return { dots: `Dots are strokes in ${gameKeyLabel(round, 'main')}`, lines };
}

/**
 * On one hole, for one player, the side games where the strokes differ from the dots:
 * [{ key, label, n, half }]. With the same count and the same full or half, nothing is listed.
 */
export function holeStrokeNotes(round, player, hole) {
  if (!round?.useHandicaps || player?.team) return [];
  const main = popsFor(round, player, hole);
  const mainHalf = halfStrokesOn(round);
  const out = [];
  for (const g of otherStrokeGames(round)) {
    const p = g.view.players.find(x => x.id === player.id);
    if (!p) continue;
    const n = popsFor(g.view, p, hole);
    const half = halfStrokesOn(g.view);
    if (n === main && (half === mainHalf || n === 0)) continue;
    out.push({ key: g.key, label: g.label, n, half });
  }
  return out;
}

/** "Skins: none", "Skins: 1 half stroke", "Skins: 2 strokes". */
export function holeStrokeNoteText(x) {
  if (!x.n) return `${x.label}: none`;
  const n = Math.abs(x.n);
  const words = `${n} ${x.half ? 'half ' : ''}stroke${n === 1 ? '' : 's'}`;
  return `${x.label}: ${x.n < 0 ? `gives back ${words}` : words}`;
}
