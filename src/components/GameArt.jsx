// Game art: one small drawing per game (and per side game) in the Ball buddies' palette, on a
// backdrop coloured by its group, so the game picker reads as a shelf of stickers instead of a
// column of icons. Drawn on a 64 by 64 square; `GameArt` wraps one in an SVG with a rounded
// backdrop, `GameScene` gives the drawing alone to place inside a bigger drawing.
import { GAMES } from '../lib/round.js';
import { ArtImage } from './ArtFile.jsx';
import { artFile } from '../lib/art-files.js';
import { INK, BALL, PINK, DEEP, OCHRE, GOLD, COIN, TEAL, MINT, CORAL, LAV, PEACH } from '../lib/art-palette.js';

const line = { stroke: INK, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

/** Each group gets a colour, so a shelf of tiles shows its sections at a glance. */
// eslint-disable-next-line react-refresh/only-export-components
export const GROUP_TINT = { Classics: OCHRE, 'Head to head': PINK, Team: MINT, 'Full round': LAV, Points: PEACH };

/** A small ball, face optional: the game's players. */
function Ball({ cx, cy, r = 9, face = true, grin = false }) {
  const k = r / 9;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BALL} />
      <circle cx={cx} cy={cy} r={r - 0.5} fill="none" stroke="rgba(10,10,10,.16)" strokeWidth="1.2" />
      {face && <g fill={INK}><circle cx={cx - 3.2 * k} cy={cy - 1 * k} r={1.5 * k} /><circle cx={cx + 3.2 * k} cy={cy - 1 * k} r={1.5 * k} /></g>}
      {face && (grin
        ? <path d={`M${cx - 3.4 * k} ${cy + 2.4 * k} Q${cx} ${cy + 6.5 * k} ${cx + 3.4 * k} ${cy + 2.4 * k}Z`} fill={INK} />
        : <path d={`M${cx - 3 * k} ${cy + 2.6 * k} Q${cx} ${cy + 5.2 * k} ${cx + 3 * k} ${cy + 2.6 * k}`} {...line} strokeWidth={1.8 * k} />)}
    </g>
  );
}
/** A pin flag: pole and pennant. */
function Flag({ x, y, h = 26, color = PINK, flip = false, big = false }) {
  const d = flip ? -1 : 1, w = big ? 17 : 13, t = big ? 7 : 5;
  return (
    <g>
      <path d={`M${x} ${y} V${y + h}`} {...line} />
      <path d={`M${x} ${y} L${x + w * d} ${y + t} L${x} ${y + 2 * t}Z`} fill={color} />
    </g>
  );
}
// Coins are a shade lighter than the ochre backdrop they sit on, with an ink edge, so they read
const COIN_EDGE = '#b8862b';
/** A coin, with a dollar on the face. */
function Coin({ cx, cy, r = 8, color = COIN, edge = COIN_EDGE }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={edge} stroke={INK} strokeWidth="1.4" />
      <circle cx={cx} cy={cy - 1.4} r={r} fill={color} stroke={INK} strokeWidth="1.4" />
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize={r * 1.3} fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>$</text>
    </g>
  );
}
/** A die, pips given as [[x,y]] in a 3 by 3 grid. */
function Die({ x, y, s = 20, color = '#fff', pips, rot = 0 }) {
  const u = s / 4;
  return (
    <g transform={`rotate(${rot} ${x + s / 2} ${y + s / 2})`}>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.22} fill={color} stroke="rgba(10,10,10,.22)" strokeWidth="1.2" />
      <g fill={INK}>{pips.map(([px, py]) => <circle key={`${px}${py}`} cx={x + u + px * u} cy={y + u + py * u} r={s * 0.09} />)}</g>
    </g>
  );
}

const SCENES = {
  // Classics
  // Banker: the ball in a top hat on a pile of coins
  banker: () => (<>
    <Coin cx={18} cy={50} r={7} /><Coin cx={46} cy={50} r={7} /><Coin cx={32} cy={53} r={7} />
    <Ball cx={32} cy={33} r={11} grin />
    <rect x="19" y="18" width="26" height="4" rx="2" fill={TEAL} />
    <rect x="23" y="6" width="18" height="14" rx="2" fill={TEAL} />
    <rect x="23" y="15" width="18" height="3" fill={PINK} />
  </>),
  // Nassau: three pennants, front, back and the whole round
  nassau: () => (<>
    <ellipse cx="32" cy="55" rx="22" ry="3.5" fill="rgba(10,10,10,.12)" />
    <Flag x={14} y={22} h={32} color={PINK} big />
    <Flag x={32} y={10} h={44} color={TEAL} big />
    <Flag x={52} y={22} h={32} color={CORAL} flip big />
  </>),
  // Skins: a stack of coins, one slid off the top
  skins: () => (<>
    <g>{[52, 46, 40, 34].map(y => <g key={y}><ellipse cx="30" cy={y + 2} rx="15" ry="5" fill={COIN_EDGE} stroke={INK} strokeWidth="1.4" /><ellipse cx="30" cy={y} rx="15" ry="5" fill={COIN} stroke={INK} strokeWidth="1.4" /></g>)}</g>
    <g transform="rotate(-14 44 24)"><ellipse cx="44" cy="26" rx="15" ry="5" fill={DEEP} /><ellipse cx="44" cy="24" rx="15" ry="5" fill={PINK} /><text x="44" y="27" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>$</text></g>
  </>),
  // Wolf: the wolf's head, ears up, under a full moon
  wolf: () => (<>
    <circle cx="49" cy="14" r="9" fill={BALL} />
    <circle cx="49" cy="14" r="9" fill="none" stroke="rgba(10,10,10,.18)" strokeWidth="1.2" />
    <path d="M17 32 L13 9 L29 25Z" fill={TEAL} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M47 32 L51 9 L35 25Z" fill={TEAL} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M18.5 27 L16.5 15 L26 24.5Z" fill={PINK} /><path d="M45.5 27 L47.5 15 L38 24.5Z" fill={PINK} />
    <path d="M13 32 Q13 56 32 58 Q51 56 51 32 Q42 25 32 25.5 Q22 25 13 32Z" fill={TEAL} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M21 46 Q32 58 43 46 Q39 40 32 40.5 Q25 40 21 46Z" fill={BALL} />
    <ellipse cx="32" cy="42" rx="3.6" ry="2.6" fill={INK} />
    <path d="M32 44.5 V48 M27.5 49 Q32 52 36.5 49" {...line} strokeWidth="1.8" />
    <g><circle cx="24.5" cy="35" r="3" fill={OCHRE} /><circle cx="39.5" cy="35" r="3" fill={OCHRE} /><circle cx="25" cy="35.3" r="1.5" fill={INK} /><circle cx="40" cy="35.3" r="1.5" fill={INK} /></g>
  </>),
  // Head to head
  // Match play: two balls squared up, a bolt between them
  match: () => (<>
    <Ball cx={17} cy={38} r={12} grin />
    <Ball cx={47} cy={38} r={12} />
    <path d="M36 8 L28 26 L35 26 L29 42" {...line} stroke={OCHRE} strokeWidth="3.4" />
  </>),
  // Hammer: the hammer, mid swing
  hammer: () => (<>
    <path d="M22 52 L40 30" stroke={OCHRE} strokeWidth="7" strokeLinecap="round" />
    <path d="M22 52 L40 30" {...line} strokeWidth="1.6" stroke={GOLD} />
    <g transform="rotate(40 46 22)"><rect x="32" y="14" width="28" height="16" rx="5" fill={TEAL} /><rect x="32" y="14" width="10" height="16" rx="5" fill={PINK} /></g>
    <g {...line} strokeWidth="2.2" stroke={PINK}><path d="M14 22 L18 26" /><path d="M10 34 L15 34" /></g>
  </>),
  // Vegas: a pair of dice
  vegas: () => (<>
    <Die x={10} y={22} s={22} color={OCHRE} pips={[[0, 0], [2, 2], [1, 1], [0, 2], [2, 0]]} rot={-12} />
    <Die x={32} y={28} s={22} pips={[[0, 0], [2, 2], [0, 2], [2, 0]]} rot={10} />
  </>),
  // Sixes: partners swap round a six
  sixes: () => (<>
    <path d="M32 12 A20 20 0 1 1 13 26" {...line} strokeWidth="3.2" stroke={TEAL} />
    <path d="M13 26 L10 16 M13 26 L22 24" {...line} strokeWidth="3.2" stroke={TEAL} />
    <Ball cx={32} cy={34} r={10} />
    <circle cx="48" cy="18" r="9" fill={OCHRE} />
    <text x="48" y="21.5" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>6</text>
  </>),
  // Team
  // Scramble: the whole team on one ball, headed for the flag
  scramble: () => (<>
    <Flag x={48} y={8} h={30} color={PINK} flip />
    <ellipse cx="48" cy="40" rx="8" ry="3" fill={TEAL} />
    <Ball cx={14} cy={46} r={8} /><Ball cx={30} cy={46} r={8} grin /><Ball cx={22} cy={34} r={8} />
    <g {...line} strokeWidth="2" stroke={TEAL} strokeDasharray="2 3"><path d="M34 38 Q42 28 46 36" /></g>
  </>),
  // Best ball: two balls, the better one with a star
  bestball: () => (<>
    <Ball cx={20} cy={40} r={11} />
    <Ball cx={44} cy={40} r={11} grin />
    <path d="M44 8 L47 16 L56 16.5 L49 22 L51.5 31 L44 26 L36.5 31 L39 22 L32 16.5 L41 16Z" fill={OCHRE} stroke={GOLD} strokeWidth="1.4" strokeLinejoin="round" />
  </>),
  // Shamble: pick the best drive, then every ball flies its own way
  shamble: () => (<>
    <path d="M12 50 L18 54 L24 50Z" fill={CORAL} />
    <Ball cx={18} cy={42} r={9} />
    <g {...line} strokeWidth="2.2" stroke={TEAL}>
      <path d="M28 36 Q40 10 54 14" /><path d="M28 40 Q42 30 56 32" /><path d="M28 44 Q40 54 54 50" />
    </g>
    <g fill={PINK}><circle cx="54" cy="14" r="3.5" /><circle cx="56" cy="32" r="3.5" /><circle cx="54" cy="50" r="3.5" /></g>
  </>),
  // Alternate shot: one ball, two players taking turns
  altshot: () => (<>
    <Ball cx={15} cy={42} r={11} grin />
    <Ball cx={49} cy={42} r={11} />
    <circle cx="32" cy="18" r="7" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1.2" />
    <g {...line} strokeWidth="2.8" stroke={PINK}><path d="M22 30 Q26 20 30 18" /><path d="M42 30 Q38 20 34 18" /><path d="M30 18 L25 19 M30 18 L29 23" /></g>
  </>),
  // Chapman: both drive, then swap
  chapman: () => (<>
    <Ball cx={16} cy={44} r={10} />
    <Ball cx={48} cy={44} r={10} grin />
    <g {...line} strokeWidth="2.8" stroke={PINK}><path d="M18 28 Q32 6 46 28" /><path d="M46 28 L47 20 M46 28 L39 26" /></g>
    <g {...line} strokeWidth="2.8" stroke={TEAL}><path d="M44 34 Q32 46 20 34" transform="translate(0 -4)" /><path d="M20 30 L19 38 M20 30 L27 32" /></g>
  </>),
  // Full round
  // Stroke play: the card with the total circled
  stroke: () => (<>
    <g transform="rotate(-6 32 34)">
      <rect x="14" y="10" width="36" height="48" rx="5" fill="#fff" stroke="rgba(10,10,10,.2)" strokeWidth="1.4" />
      <rect x="14" y="10" width="36" height="9" rx="5" fill={TEAL} />
      <g stroke="rgba(10,10,10,.16)" strokeWidth="1.4">{[26, 33, 40].map(y => <path key={y} d={`M19 ${y} H45`} />)}</g>
      <text x="32" y="53" textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>72</text>
      <ellipse cx="32" cy="49.5" rx="10" ry="6.5" fill="none" stroke={PINK} strokeWidth="2.2" />
    </g>
  </>),
  // Stableford: a star with a 2 on it
  stableford: () => (<>
    <path d="M32 6 L38.5 23 L57 24 L42.5 35.5 L47.5 53 L32 42.5 L16.5 53 L21.5 35.5 L7 24 L25.5 23Z" fill={COIN} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
    <text x="32" y="38" textAnchor="middle" fontSize="15" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>2</text>
  </>),
  // Quota: your number on a target
  quota: () => (<>
    <circle cx="32" cy="34" r="24" fill={PINK} /><circle cx="32" cy="34" r="17" fill={BALL} /><circle cx="32" cy="34" r="10" fill={PINK} />
    <text x="32" y="38" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>36</text>
  </>),
  // Points
  // Nines: nine points split 5, 3 and 1
  nines: () => (<>
    <circle cx="32" cy="34" r="24" fill={BALL} stroke="rgba(10,10,10,.18)" strokeWidth="1.4" />
    <path d="M32 34 L32 10 A24 24 0 1 1 11.2 46Z" fill={TEAL} />
    <path d="M32 34 L11.2 46 A24 24 0 0 1 9.4 24Z" fill={PINK} />
    <text x="40" y="36" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill="#fff">5</text>
    <text x="21" y="32" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>3</text>
    <text x="22" y="46" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>1</text>
  </>),
  // Aces and deuces: the ace, with the two peeking out
  aces: () => (<>
    <g transform="rotate(12 44 34)"><rect x="32" y="12" width="24" height="34" rx="4" fill="#fff" stroke="rgba(10,10,10,.2)" strokeWidth="1.4" /><text x="44" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={PINK}>2</text></g>
    <g transform="rotate(-10 24 36)">
      <rect x="12" y="14" width="24" height="34" rx="4" fill="#fff" stroke="rgba(10,10,10,.2)" strokeWidth="1.4" />
      <path d="M24 22 Q19 30 24 32 Q29 30 24 22Z M24 29 L22 36 H26Z" fill={INK} />
      <text x="16" y="24" fontSize="7" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={INK}>A</text>
    </g>
  </>),
  // Bingo Bango Bongo: three balls, three prizes
  bbb: () => (<>
    <Ball cx={14} cy={44} r={8} /><Ball cx={32} cy={44} r={8} grin /><Ball cx={50} cy={44} r={8} />
    {[[14, PINK, '1'], [32, TEAL, '2'], [50, PINK, '3']].map(([x, c, n]) => (
      <g key={n}><circle cx={x} cy={20} r="9" fill={c} /><text x={x} y={24} textAnchor="middle" fontSize="11" fontWeight="800" fontFamily="'Bricolage Grotesque', Inter, sans-serif" fill={c === TEAL ? '#fff' : INK}>{n}</text></g>
    ))}
  </>),
  // Dots: the junk, as dots on a card
  dots: () => (<>
    <rect x="10" y="16" width="44" height="34" rx="6" fill="#fff" stroke="rgba(10,10,10,.2)" strokeWidth="1.4" />
    <g stroke="rgba(10,10,10,.14)" strokeWidth="1.4"><path d="M10 28 H54" /><path d="M10 39 H54" /><path d="M25 16 V50" /><path d="M40 16 V50" /></g>
    <circle cx="17.5" cy="22" r="3.5" fill={PINK} /><circle cx="32.5" cy="33.5" r="3.5" fill={TEAL} /><circle cx="47" cy="22" r="3.5" fill={OCHRE} /><circle cx="17.5" cy="44.5" r="3.5" fill={CORAL} />
  </>),
  // Rabbit: the ball with rabbit ears
  rabbit: () => (<>
    <path d="M22 30 Q16 6 26 6 Q32 10 28 30Z" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1.4" />
    <path d="M42 30 Q48 6 38 6 Q32 10 36 30Z" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1.4" />
    <path d="M23 26 Q20 12 25 11 Q28 14 26 26Z" fill={PINK} /><path d="M41 26 Q44 12 39 11 Q36 14 38 26Z" fill={PINK} />
    <Ball cx={32} cy={40} r={14} />
    <path d="M29 44 H35 M32 44 V48" {...line} strokeWidth="1.8" />
  </>),
  // Snake: the three-putt snake, with the fangs
  snake: () => (<>
    <path d="M8 44 Q16 28 26 40 Q36 52 46 36 Q50 30 52 28" stroke={TEAL} strokeWidth="7" fill="none" strokeLinecap="round" />
    <path d="M8 44 Q16 28 26 40 Q36 52 46 36 Q50 30 52 28" stroke={MINT} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeDasharray="1 6" />
    <circle cx="52" cy="24" r="8" fill={TEAL} />
    <g fill="#fff"><circle cx="50" cy="22" r="2" /><circle cx="56" cy="22" r="2" /></g>
    <path d="M52 32 L50 38 M52 32 L54 38" {...line} strokeWidth="2" stroke={PINK} />
  </>),
  // Side games with no game of the same name
  // Birdie pot: the birdie critter on a pot
  birdies: () => (<>
    <ellipse cx="32" cy="52" rx="16" ry="5" fill={GOLD} /><rect x="16" y="40" width="32" height="12" rx="4" fill={OCHRE} />
    <circle cx="32" cy="30" r="12" fill={PINK} />
    <path d="M20 30 Q12 36 14 24Z" fill={DEEP} />
    <path d="M42 28 L50 30 L42 33Z" fill={OCHRE} />
    <g fill={INK}><circle cx="36" cy="27" r="1.8" /></g>
  </>),
  // Closest to the pin: the flag in the bullseye
  ctp: () => (<>
    <circle cx="32" cy="38" r="20" fill={PINK} /><circle cx="32" cy="38" r="13" fill={BALL} /><circle cx="32" cy="38" r="6" fill={PINK} />
    <Flag x={32} y={8} h={30} color={TEAL} />
    <circle cx="44" cy="50" r="4" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1.2" />
  </>),
  // Long drive: the ball flying off the tee
  drive: () => (<>
    <path d="M10 50 L16 56 L22 50Z" fill={CORAL} />
    <circle cx="16" cy="44" r="6" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1.2" />
    <path d="M22 40 Q36 8 56 14" {...line} strokeWidth="3" stroke={TEAL} />
    <path d="M56 14 L50 10 M56 14 L52 20" {...line} strokeWidth="3" stroke={TEAL} />
    <g {...line} strokeWidth="2.4" stroke="#fff"><path d="M22 30 L30 26" /><path d="M26 37 L34 34" /></g>
  </>),
};

/** The games that have art, for the design check. */
export const GAME_ART_KINDS = Object.keys(SCENES);

/** A game's drawing on its own, as a group to place inside a bigger drawing (64 by 64 units). */
export function GameScene({ game }) {
  const Scene = SCENES[game] || SCENES.stroke;
  return <Scene />;
}

/**
 * One game's art on its group's backdrop, as an SVG that fills its box. `game` is a GAMES key or a
 * side game's. `tint` overrides the backdrop. Decorative: screen readers get the name from the row.
 */
export function GameArt({ game, tint = null, size = null, className = '' }) {
  const Scene = SCENES[game] || SCENES.stroke;
  const bg = tint || GROUP_TINT[GAMES[game]?.group] || PEACH;
  // An outside drawing (src/art/games/<game>.svg) sits on the same backdrop
  const file = artFile('games', game);
  return (
    <svg className={`game-art ${className}`.trim()} viewBox="0 0 64 64" width={size || undefined} height={size || undefined} aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="18" fill={bg} />
      {file ? <ArtImage file={file} w={64} h={64} /> : <Scene />}
    </svg>
  );
}
