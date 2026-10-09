// The results image's character reaction (shareImage.js draws it): the winner's Ball buddy in a
// crown with both arms up, confetti round them, or everyone level on top side by side. Drawn here
// as an SVG, hidden on the page, and handed to the canvas as a picture (lib/useArtSrc.js), the way the
// profile and rivalry cards take their buddies.
import { BuddyFigure } from './BuddyArt.jsx';
import { INK, BALL, PINK, OCHRE, MINT, CORAL, LAV } from '../lib/art-palette.js';

const CELL = 96, H = 112, EDGE = 8;
const ARM = { stroke: INK, strokeWidth: 3, fill: 'none', strokeLinecap: 'round' };
// Confetti round each buddy, clear of the crown: [dx, y, colour, kind]
const BITS = [[-40, 26, PINK, 'r'], [37, 20, OCHRE, 'r'], [-27, 8, MINT, 'c'], [24, 6, CORAL, 'c'], [-42, 62, LAV, 'c'], [42, 58, MINT, 'r'], [-8, 10, OCHRE, 'r']];

/** The crown from Podium.jsx, as a group: `w` wide with its top centre at (x, y), tipped a little. */
function CrownMark({ x, y, w }) {
  const k = w / 64;
  return (
    <g transform={`translate(${x - w / 2} ${y}) rotate(-8 ${w / 2} ${18 * k}) scale(${k})`}>
      <path d="M6 32 L10 6 L22 20 L32 2 L42 20 L54 6 L58 32Z" fill="#e8b94a" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="28" width="52" height="8" rx="3" fill="#c99a30" stroke={INK} strokeWidth="2" />
      <circle cx="32" cy="20" r="4" fill="#ff4d8b" /><circle cx="17" cy="24" r="3" fill="#ff4d8b" /><circle cx="47" cy="24" r="3" fill="#ff4d8b" />
    </g>
  );
}

/** One buddy cheering: both arms up, a crown when they won, a shadow under them. */
function Cheer({ cx, buddy, crowned, i }) {
  // Every other buddy leans the other way, so a pair reads as two people celebrating, not a copy
  const tilt = i % 2 ? 4 : -4;
  return (
    <g>
      {crowned && BITS.map(([dx, y, c, kind], j) => (kind === 'r'
        ? <rect key={j} x={cx + dx - 3} y={y} width="6" height="9" rx="1.5" fill={c} transform={`rotate(${(j * 37) % 70 - 35} ${cx + dx} ${y + 4})`} />
        : <circle key={j} cx={cx + dx} cy={y + 4} r="3.2" fill={c} />))}
      <ellipse cx={cx} cy={106} rx="21" ry="3.6" fill="rgba(10,10,10,.18)" />
      <g transform={`rotate(${tilt} ${cx} 100)`}>
        {/* Arms up behind the ball, a hand at the end of each */}
        <path d={`M${cx - 18} 78 Q${cx - 31} 68 ${cx - 33} 50`} {...ARM} />
        <path d={`M${cx + 18} 78 Q${cx + 31} 68 ${cx + 33} 50`} {...ARM} />
        <circle cx={cx - 33} cy={48} r="4.6" fill={BALL} stroke={INK} strokeWidth="1.8" />
        <circle cx={cx + 33} cy={48} r="4.6" fill={BALL} stroke={INK} strokeWidth="1.8" />
        <BuddyFigure id={buddy} x={cx - 32} y={44} size={64} />
        {crowned && <CrownMark x={cx} y={36} w={38} />}
      </g>
    </g>
  );
}

/**
 * The reaction as an SVG with its own size (so a canvas can draw it in every browser). `buddies` is
 * one to four buddy ids; `crowned` puts the crown and the confetti on (off for all square).
 */
export function CheerArt({ buddies, crowned = true }) {
  const n = Math.max(1, Math.min(4, buddies.length));
  const w = CELL * n + EDGE * 2;
  return (
    <svg viewBox={`0 0 ${w} ${H}`} width={w * 4} height={H * 4} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      {buddies.slice(0, 4).map((b, i) => <Cheer key={`${b}-${i}`} cx={EDGE + CELL / 2 + CELL * i} buddy={b} crowned={crowned} i={i} />)}
    </svg>
  );
}
