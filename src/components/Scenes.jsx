// Full-bleed scenes: the Ball buddies somewhere, drawn edge to edge for the top of a screen
// (onboarding, a trip). Each is a 400 by 240 drawing that crops from the sky down, so the ground
// and whoever stands on it stay in view at any width. Colours that make the setting (sky, grass,
// walls) come from --sc-* tokens, so the dark theme gets dusk instead of a pasted-on day.
import { BuddyFigure } from './BuddyArt.jsx';

const INK = '#0a0a0a';
const BALL = '#fbf7ec';
const PINK = '#ff4d8b';
const DEEP = '#d42a6b';
const OCHRE = '#e8b94a';
const TEAL = '#1a3a3a';
const CORAL = '#ff6b5a';
const line = { stroke: INK, strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

const Sun = ({ cx = 322, cy = 54 }) => <circle cx={cx} cy={cy} r="26" fill="var(--sc-sun)" />;
const Cloud = ({ x, y, s = 1 }) => (
  <g fill="var(--sc-cloud)" transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="0" rx="34" ry="11" /><ellipse cx="18" cy="-9" rx="20" ry="12" /><ellipse cx="-14" cy="-6" rx="16" ry="10" />
  </g>
);
const Tree = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-3" y="-6" width="6" height="22" rx="2" fill="var(--sc-trunk)" />
    <circle cx="0" cy="-16" r="16" fill="var(--sc-tree)" /><circle cx="-11" cy="-8" r="11" fill="var(--sc-tree)" /><circle cx="11" cy="-8" r="11" fill="var(--sc-tree)" />
  </g>
);
const Flag = ({ x, y, h = 56 }) => (
  <g>
    <path d={`M${x} ${y} V${y + h}`} {...line} strokeWidth="3.5" />
    <path d={`M${x} ${y} L${x + 26} ${y + 9} L${x} ${y + 18}Z`} fill={PINK} />
  </g>
);
const Bag = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <g {...line} strokeWidth="3" stroke={TEAL}><path d="M8 -18 L2 2" /><path d="M14 -20 L10 2" /><path d="M20 -16 L18 2" /></g>
    <g fill={OCHRE}><circle cx="8" cy="-18" r="4" /><circle cx="14" cy="-21" r="4" /><circle cx="20" cy="-17" r="4" /></g>
    <rect x="0" y="0" width="26" height="46" rx="8" fill={TEAL} />
    <rect x="0" y="14" width="26" height="9" fill={PINK} />
    <path d="M26 6 Q40 14 26 30" {...line} strokeWidth="3" stroke={TEAL} />
  </g>
);
/** Buddies standing in a row, feet on `ground`, spread around `cx`. */
// A phone shows the middle 290 or so of the 400, so the people and the pin stay inside x 56 to 344
function Row({ ids, cx = 110, ground = 216, size = null, gap = 8 }) {
  const n = ids.length;
  size = size || (n >= 5 ? 42 : n === 4 ? 48 : 56);
  const w = size * n + gap * (n - 1);
  const left = cx - w / 2;
  return ids.map((id, i) => <BuddyFigure key={`${id}${i}`} id={id} x={left + i * (size + gap)} y={ground - size * 0.91 + (i % 2 ? 0 : -6)} size={size} />);
}

const SCENES = {
  // The first tee: a fairway to the green, a bunker, and the group on the tee box with a bag
  course: ({ ids }) => (<>
    <rect width="400" height="240" fill="var(--sc-sky)" />
    <Sun />
    <Cloud x={96} y={58} /><Cloud x={252} y={40} s={0.7} />
    <path d="M0 150 Q70 108 150 138 T290 122 T400 134 V240 H0Z" fill="var(--sc-hill)" />
    <Tree x={44} y={140} s={0.9} /><Tree x={76} y={132} /><Tree x={352} y={126} /><Tree x={382} y={138} s={0.8} /><Tree x={300} y={136} s={0.7} />
    <path d="M0 166 Q200 150 400 160 V240 H0Z" fill="var(--sc-rough)" />
    <path d="M0 190 Q140 170 260 180 T400 178 V240 H0Z" fill="var(--sc-grass)" />
    <ellipse cx="236" cy="212" rx="36" ry="9" fill="var(--sc-sand)" />
    <ellipse cx="302" cy="190" rx="50" ry="14" fill="var(--sc-green)" />
    <ellipse cx="302" cy="191" rx="4.5" ry="1.8" fill={INK} opacity=".55" />
    <Flag x={302} y={132} />
    <ellipse cx="150" cy="220" rx="96" ry="13" fill="var(--sc-green)" />
    <Bag x={262} y={176} />
    <Row ids={ids} cx={ids.length >= 4 ? 158 : 150} />
  </>),
  // The 19th hole: the clubhouse patio, an umbrella table, the money squared up
  clubhouse: ({ ids }) => (<>
    <rect width="400" height="240" fill="var(--sc-sky)" />
    <Sun cx={60} cy={50} />
    <Cloud x={300} y={48} s={0.8} />
    <rect x="0" y="92" width="400" height="90" fill="var(--sc-wall)" />
    <path d="M-10 94 L200 58 L410 94 Z" fill={TEAL} />
    <rect x="0" y="90" width="400" height="7" fill={TEAL} />
    <g fill="var(--sc-sky)" stroke={TEAL} strokeWidth="4">
      <rect x="40" y="112" width="60" height="48" rx="4" /><rect x="300" y="112" width="60" height="48" rx="4" />
    </g>
    <g stroke={TEAL} strokeWidth="3"><path d="M70 112 V160 M40 136 H100" /><path d="M330 112 V160 M300 136 H360" /></g>
    <g>
      <rect x="150" y="104" width="100" height="78" rx="4" fill={TEAL} />
      <rect x="158" y="112" width="84" height="70" rx="3" fill="var(--sc-door)" />
      <circle cx="232" cy="150" r="3.5" fill={OCHRE} />
    </g>
    <g>{[20, 60, 100, 140, 220, 260, 300, 340].map((x, i) => <path key={x} d={`M${x} 104 Q${x + 20} 118 ${x + 40} 104Z`} fill={i % 2 ? PINK : BALL} />)}</g>
    <rect x="0" y="100" width="400" height="6" fill={PINK} />
    <rect x="0" y="180" width="400" height="60" fill="var(--sc-stone)" />
    <g stroke="rgba(10,10,10,.08)" strokeWidth="2">{[196, 212, 228].map(y => <path key={y} d={`M0 ${y} H400`} />)}</g>
    <path d="M200 128 V226" {...line} strokeWidth="4" />
    <path d="M120 150 Q200 92 280 150 Q240 142 200 150 Q160 142 120 150Z" fill={PINK} />
    <path d="M140 150 Q200 110 260 150 Q230 144 200 150 Q170 144 140 150Z" fill={BALL} opacity=".55" />
    <ellipse cx="200" cy="204" rx="56" ry="12" fill={OCHRE} />
    <ellipse cx="200" cy="200" rx="56" ry="12" fill="#f2cf6a" />
    <g><circle cx="186" cy="198" r="7" fill="#c99a30" /><circle cx="186" cy="196" r="7" fill={OCHRE} /><circle cx="212" cy="201" r="7" fill="#c99a30" /><circle cx="212" cy="199" r="7" fill={OCHRE} /></g>
    <g><rect x="228" y="180" width="12" height="18" rx="2" fill="var(--sc-sky)" stroke={INK} strokeWidth="2" /><rect x="229" y="186" width="10" height="11" fill={CORAL} /></g>
    <Row ids={ids.slice(0, 2)} cx={112} ground={226} size={60} gap={10} />
    <Row ids={ids.slice(2, 4)} cx={288} ground={226} size={60} gap={10} />
  </>),
  // The road trip: the car packed with bags and the group, mountains ahead
  roadtrip: ({ ids }) => (<>
    <rect width="400" height="240" fill="var(--sc-sky)" />
    <Sun cx={70} cy={56} />
    <Cloud x={200} y={44} s={0.8} /><Cloud x={340} y={70} s={0.6} />
    <path d="M0 150 L60 96 L120 140 L190 84 L260 136 L330 92 L400 142 V240 H0Z" fill="var(--sc-hill)" />
    <path d="M176 96 L190 84 L204 96 Z M316 104 L330 92 L344 104Z M46 108 L60 96 L74 108Z" fill="var(--sc-snow)" />
    <path d="M0 158 Q200 144 400 156 V240 H0Z" fill="var(--sc-rough)" />
    <Tree x={30} y={170} s={0.7} /><Tree x={370} y={168} s={0.7} />
    <path d="M0 240 L0 204 Q200 186 400 202 V240Z" fill="var(--sc-road)" />
    <path d="M0 222 Q200 206 400 220" stroke={OCHRE} strokeWidth="4" strokeDasharray="18 14" fill="none" />
    <g fill="var(--sc-cloud)" opacity=".8"><circle cx="78" cy="206" r="8" /><circle cx="64" cy="210" r="6" /><circle cx="52" cy="206" r="4" /></g>
    <g {...line} strokeWidth="3" stroke={TEAL}><path d="M118 120 L112 90" /><path d="M130 122 L130 92" /><path d="M300 118 L306 90" /><path d="M288 120 L286 92" /></g>
    <g fill={OCHRE}><circle cx="112" cy="90" r="5" /><circle cx="130" cy="91" r="5" /><circle cx="306" cy="90" r="5" /><circle cx="286" cy="91" r="5" /></g>
    <rect x="104" y="112" width="36" height="22" rx="7" fill={TEAL} /><rect x="278" y="112" width="36" height="22" rx="7" fill={TEAL} />
    <rect x="96" y="130" width="226" height="8" rx="4" fill={PINK} />
    <path d="M116 138 Q124 106 160 106 H258 Q292 106 302 138Z" fill={DEEP} />
    <rect x="90" y="136" width="238" height="54" rx="16" fill={PINK} />
    <path d="M90 164 H328" stroke={DEEP} strokeWidth="4" />
    <g fill="var(--sc-glass)"><path d="M126 138 Q132 114 160 114 H200 V138Z" /><path d="M210 114 H256 Q284 114 292 138 H210Z" /></g>
    <g>{ids.slice(0, 2).map((id, i) => <BuddyFigure key={`${id}${i}`} id={id} x={[150, 222][i]} y={98} size={40} />)}</g>
    <rect x="80" y="160" width="14" height="12" rx="3" fill={OCHRE} /><rect x="324" y="160" width="14" height="12" rx="3" fill={CORAL} />
    <g><circle cx="134" cy="192" r="16" fill={INK} /><circle cx="134" cy="192" r="7" fill={BALL} /><circle cx="284" cy="192" r="16" fill={INK} /><circle cx="284" cy="192" r="7" fill={BALL} /></g>
  </>),
};

const DEFAULT_IDS = ['visor', 'snapback', 'bucket', 'flatcap', 'beanie'];

/** A scene's drawing alone (400 by 240 units). */
export function SceneArt({ kind = 'course', ids = DEFAULT_IDS }) {
  const Scene = SCENES[kind] || SCENES.course;
  return <Scene ids={ids?.length ? ids : DEFAULT_IDS} />;
}

/**
 * One full-bleed scene. `kind` picks the setting ('course', 'clubhouse', 'roadtrip'); `ids` the
 * buddies in it. The SVG fills its box and crops from the top. Decorative: screen readers skip it.
 */
export function Scene({ kind = 'course', ids = DEFAULT_IDS, className = '' }) {
  return (
    <svg className={`scene ${className}`.trim()} viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <SceneArt kind={kind} ids={ids} />
    </svg>
  );
}

/** The scenes there are, for the gallery. */
// eslint-disable-next-line react-refresh/only-export-components
export const SCENE_KINDS = Object.keys(SCENES);
