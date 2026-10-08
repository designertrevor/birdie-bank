// Spot illustrations: the smiley ball from the empty states with one prop, for callouts, empty
// states and the small moments (feedback, invites, a winner, nothing yet, a trip). Drawn on a
// 120 by 120 square with no backdrop, so they sit on any surface in both themes. The crowd scenes
// use the Ball buddies themselves (BuddyFigure).
import { BuddyFigure } from './BuddyArt.jsx';
import { ArtImage } from './ArtFile.jsx';
import { artFile } from '../lib/art-files.js';
import { INK, BALL, PINK, DEEP, OCHRE, GOLD, TEAL, MINT, CORAL, LAV, PEACH, BLUSH } from '../lib/art-palette.js';

const line = { stroke: INK, strokeWidth: 3.4, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

// The plate: a soft blob of colour behind the scene, so the white ball never sits on a white card.
// Each scene has its own colour; `plate={false}` drops it where the spot already sits on colour.
const PLATES = { mint: MINT, lav: LAV, peach: PEACH, blush: BLUSH, ochre: OCHRE };
const PLATE_OF = {
  tee: 'mint', megaphone: 'blush', bulb: 'lav', link: 'mint', crown: 'blush', cup: 'peach', sleep: 'lav', suitcase: 'peach',
  wallet: 'blush', card: 'lav', calendar: 'blush', bell: 'peach', gift: 'blush', shades: 'mint', crowd: 'mint', highfive: 'peach',
  'face-great': 'mint', 'face-ok': 'peach', 'face-off': 'lav',
};
const Plate = ({ color }) => <path d="M14 68 C12 38 34 18 62 20 C90 22 108 42 106 70 C104 98 84 112 58 110 C32 108 16 96 14 68Z" fill={PLATES[color] || MINT} opacity=".9" />;

/** The ball: body, dimples and a face. `cx`, `cy` and `r` place it; `face` picks the expression. */
function Ball({ cx = 60, cy = 66, r = 30, face = 'smile' }) {
  const k = r / 30;
  const at = (dx, dy) => [cx + dx * k, cy + dy * k];
  const [lx, ly] = at(-10, -2), [rx, ry] = at(10, -2);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={BALL} />
      <circle cx={cx} cy={cy} r={r - 0.8} fill="none" stroke="rgba(10,10,10,.16)" strokeWidth="1.6" />
      <g fill="rgba(10,10,10,.09)">
        {[[-17, 14], [17, 14], [-8, 22], [8, 22], [0, -20], [-16, -14], [16, -14]].map(([dx, dy]) => { const [x, y] = at(dx, dy); return <circle key={`${dx},${dy}`} cx={x} cy={y} r={2.4 * k} />; })}
      </g>
      <g fill={PINK} opacity=".35"><circle cx={at(-17, 7)[0]} cy={at(-17, 7)[1]} r={3.6 * k} /><circle cx={at(17, 7)[0]} cy={at(17, 7)[1]} r={3.6 * k} /></g>
      {face === 'sleep' ? (
        <g {...line} strokeWidth={3 * k}><path d={`M${lx - 4 * k} ${ly} Q${lx} ${ly + 4 * k} ${lx + 4 * k} ${ly}`} /><path d={`M${rx - 4 * k} ${ry} Q${rx} ${ry + 4 * k} ${rx + 4 * k} ${ry}`} /></g>
      ) : face === 'happy' ? (
        <g {...line} strokeWidth={3 * k}><path d={`M${lx - 4 * k} ${ly + 1.5 * k} Q${lx} ${ly - 3.5 * k} ${lx + 4 * k} ${ly + 1.5 * k}`} /><path d={`M${rx - 4 * k} ${ry + 1.5 * k} Q${rx} ${ry - 3.5 * k} ${rx + 4 * k} ${ry + 1.5 * k}`} /></g>
      ) : (
        <g fill={INK}><circle cx={lx} cy={ly} r={3.6 * k} /><circle cx={rx} cy={ry} r={3.6 * k} /></g>
      )}
      {face === 'wow' ? <ellipse cx={cx} cy={at(0, 11)[1]} rx={4 * k} ry={5 * k} fill={INK} />
        : face === 'sleep' ? <path d={`M${cx - 3 * k} ${at(0, 11)[1]} H${cx + 3 * k}`} {...line} strokeWidth={3 * k} />
        : face === 'flat' ? <path d={`M${cx - 8 * k} ${at(0, 12)[1]} H${cx + 8 * k}`} {...line} strokeWidth={3.4 * k} />
        : face === 'worried' ? <path d={`M${cx - 9 * k} ${at(0, 16)[1]} Q${cx} ${at(0, 8)[1]} ${cx + 9 * k} ${at(0, 16)[1]}`} {...line} strokeWidth={3.4 * k} />
        : face === 'happy' ? <path d={`M${cx - 10 * k} ${at(0, 8)[1]} Q${cx} ${at(0, 21)[1]} ${cx + 10 * k} ${at(0, 8)[1]}Z`} fill={INK} />
        : <path d={`M${cx - 10 * k} ${at(0, 9)[1]} Q${cx} ${at(0, 18)[1]} ${cx + 10 * k} ${at(0, 9)[1]}`} {...line} strokeWidth={3.4 * k} />}
    </g>
  );
}
const Shadow = ({ cx = 60, cy = 108, rx = 26 }) => <ellipse cx={cx} cy={cy} rx={rx} ry="4.5" fill="rgba(10,10,10,.09)" />;
const Hand = ({ x, y }) => <circle cx={x} cy={y} r="5.5" fill={BALL} stroke="rgba(10,10,10,.22)" strokeWidth="1.6" />;

const SCENES = {
  // The ball on a tee, as on the first empty states
  tee: () => (<>
    <Shadow cy={110} rx={20} />
    <path d="M50 92 L60 112 L70 92Z" fill={CORAL} />
    <Ball cy={58} r={32} />
  </>),
  // Feedback: the ball with a megaphone
  megaphone: () => (<>
    <Shadow />
    <Ball cx={52} face="wow" />
    <path d="M78 60 L104 42 L104 86 L78 70Z" fill={PINK} />
    <ellipse cx="104" cy="64" rx="5" ry="22" fill={DEEP} />
    <rect x="72" y="58" width="9" height="14" rx="3" fill={TEAL} />
    <Hand x={80} y={76} />
    <g {...line} strokeWidth="3" stroke={TEAL}><path d="M112 50 Q117 64 112 78" /></g>
  </>),
  // An idea: the ball under a light bulb
  bulb: () => (<>
    <Shadow />
    <Ball cy={72} face="wow" />
    <circle cx="60" cy="22" r="14" fill={OCHRE} />
    <rect x="53" y="33" width="14" height="8" rx="2" fill={TEAL} />
    <g {...line} strokeWidth="3" stroke={OCHRE}><path d="M36 14 L30 9" /><path d="M84 14 L90 9" /><path d="M32 28 L25 28" /><path d="M88 28 L95 28" /></g>
  </>),
  // Inviting the group: the ball holding up a phone with a link and a live dot
  link: () => (<>
    <Shadow cx={50} />
    <Ball cx={48} />
    <rect x="74" y="34" width="34" height="58" rx="8" fill={TEAL} />
    <rect x="78" y="42" width="26" height="40" rx="4" fill={MINT} />
    <g {...line} strokeWidth="3.2" stroke={TEAL}><path d="M86 66 L84 68 A4 4 0 0 1 78.5 62.5 L82 59" transform="translate(4 0)" /><path d="M92 58 L94 56 A4 4 0 0 1 99.5 61.5 L96 65" transform="translate(-4 0)" /><path d="M86 64 L92 60" /></g>
    <circle cx="104" cy="36" r="7" fill={PINK} />
    <circle cx="104" cy="36" r="2.6" fill="#fff" />
    <Hand x={76} y={80} />
  </>),
  // A winner: the ball in a crown
  crown: () => (<>
    <Shadow />
    <Ball cy={70} face="happy" />
    <path d="M36 40 L40 18 L50 30 L60 12 L70 30 L80 18 L84 40Z" fill={OCHRE} />
    <rect x="36" y="38" width="48" height="7" rx="3" fill={GOLD} />
    <g fill={PINK}><circle cx="60" cy="30" r="3.4" /><circle cx="45" cy="34" r="2.6" /><circle cx="75" cy="34" r="2.6" /></g>
  </>),
  // A trophy: the ball holding a cup
  cup: () => (<>
    <Shadow cx={54} />
    <Ball cx={48} face="happy" />
    <path d="M80 32 H108 V44 Q108 62 94 64 Q80 62 80 44Z" fill={OCHRE} />
    <path d="M80 38 Q70 38 72 48 Q74 54 82 54" {...line} strokeWidth="3" stroke={GOLD} />
    <path d="M108 38 Q118 38 116 48 Q114 54 106 54" {...line} strokeWidth="3" stroke={GOLD} />
    <rect x="90" y="63" width="8" height="12" fill={GOLD} />
    <rect x="82" y="74" width="24" height="7" rx="2" fill={TEAL} />
    <Hand x={80} y={78} />
  </>),
  // Nothing yet: the ball asleep
  sleep: () => (<>
    <Shadow />
    <Ball cy={70} face="sleep" />
    <g fill={TEAL} fontFamily="'Bricolage Grotesque', Inter, sans-serif" fontWeight="800">
      <text x="82" y="38" fontSize="18">z</text><text x="94" y="24" fontSize="14">z</text><text x="104" y="13" fontSize="10">z</text>
    </g>
  </>),
  // A golf trip: the ball with a suitcase
  suitcase: () => (<>
    <Shadow cx={64} rx={34} />
    <Ball cx={46} cy={66} />
    <rect x="72" y="62" width="40" height="42" rx="6" fill={CORAL} />
    <rect x="84" y="54" width="16" height="10" rx="4" fill="none" stroke={TEAL} strokeWidth="4" />
    <rect x="72" y="76" width="40" height="7" fill={OCHRE} />
    <circle cx="80" cy="106" r="3" fill={TEAL} /><circle cx="104" cy="106" r="3" fill={TEAL} />
  </>),
  // The Tab with nothing on it: an empty wallet the ball peeks out of
  wallet: () => (<>
    <Shadow rx={38} />
    <Ball cy={54} r={28} face="wow" />
    <rect x="22" y="70" width="76" height="38" rx="8" fill={TEAL} />
    <path d="M22 78 H98" stroke="#2c5a5a" strokeWidth="3" />
    <rect x="76" y="82" width="26" height="14" rx="7" fill={MINT} />
    <circle cx="84" cy="89" r="3" fill={TEAL} />
  </>),
  // History with nothing in it: a blank scorecard and a pencil
  card: () => (<>
    <Shadow cx={54} />
    <Ball cx={44} />
    <g transform="rotate(8 92 66)">
      <rect x="72" y="36" width="38" height="56" rx="5" fill="#fff" stroke="rgba(10,10,10,.18)" strokeWidth="1.6" />
      <rect x="72" y="36" width="38" height="10" rx="5" fill={MINT} />
      <g stroke="rgba(10,10,10,.14)" strokeWidth="1.4">{[56, 66, 76, 86].map(y => <path key={y} d={`M76 ${y} H106`} />)}<path d="M88 50 V90" /></g>
    </g>
    <path d="M70 92 L96 70" stroke={OCHRE} strokeWidth="6" strokeLinecap="round" />
    <path d="M70 92 L66 96" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <Hand x={72} y={88} />
  </>),
  // Planning ahead: the ball with a calendar
  calendar: () => (<>
    <Shadow cx={54} />
    <Ball cx={44} />
    <rect x="72" y="38" width="40" height="44" rx="7" fill="#fff" stroke="rgba(10,10,10,.18)" strokeWidth="1.6" />
    <rect x="72" y="38" width="40" height="13" rx="7" fill={PINK} />
    <rect x="72" y="45" width="40" height="6" fill={PINK} />
    <g fill="rgba(10,10,10,.16)">{[0, 1, 2].map(r => [0, 1, 2, 3].map(c => <circle key={`${r}${c}`} cx={79 + c * 9} cy={58 + r * 8} r="2" />))}</g>
    <circle cx="97" cy="66" r="4.6" fill={OCHRE} />
  </>),
  // A heads-up: the ball and a little bell
  bell: () => (<>
    <Shadow cx={54} />
    <Ball cx={46} />
    <path d="M84 70 Q84 44 96 42 Q108 44 108 70 L112 76 H80Z" fill={OCHRE} />
    <circle cx="96" cy="80" r="4.5" fill={TEAL} />
    <circle cx="96" cy="40" r="3" fill={OCHRE} />
    <g {...line} strokeWidth="3" stroke={PINK}><path d="M114 48 Q118 54 116 60" /><path d="M78 48 Q74 54 76 60" /></g>
  </>),
  // Faces for "How was it?": great, just OK, something was off. On a plate (the setup guide)
  // the ball sits smaller, so the colour shows round it and the ball never melts into the page
  'face-great': ({ plated }) => <Ball cy={plated ? 64 : 60} r={plated ? 34 : 44} face="happy" />,
  'face-ok': ({ plated }) => <Ball cy={plated ? 64 : 60} r={plated ? 34 : 44} face="flat" />,
  'face-off': ({ plated }) => <Ball cy={plated ? 64 : 60} r={plated ? 34 : 44} face="worried" />,
  // Something you asked for shipped: the ball with a wrapped present
  gift: () => (<>
    <Shadow cx={56} />
    <Ball cx={46} face="happy" />
    <rect x="74" y="58" width="36" height="34" rx="4" fill={PINK} />
    <rect x="70" y="50" width="44" height="12" rx="3" fill={DEEP} />
    <rect x="88" y="50" width="8" height="42" fill={OCHRE} />
    <path d="M92 50 Q80 36 76 44 Q74 50 92 50 Q104 36 108 44 Q110 50 92 50Z" fill={OCHRE} />
    <Hand x={74} y={80} />
  </>),
  // Keeping it private: the ball in sunglasses
  shades: () => (<>
    <Shadow />
    <Ball cy={68} />
    <path d="M32 58 H88" stroke={INK} strokeWidth="3.4" />
    <rect x="35" y="57" width="20" height="12" rx="5" fill={INK} />
    <rect x="65" y="57" width="20" height="12" rx="5" fill={INK} />
  </>),
};

// Scenes made of Ball buddies. `ids` picks who; the defaults are a mixed group.
const GROUP = ['visor', 'bucket', 'snapback', 'flatcap', 'beanie'];

function Crowd({ ids }) {
  const who = (ids?.length ? ids : GROUP).slice(0, 5);
  const n = who.length;
  const size = n <= 2 ? 62 : n === 3 ? 54 : 48;
  const step = n <= 1 ? 0 : Math.min(size * 0.8, (124 - size) / (n - 1));
  const left = (120 - (size + step * (n - 1))) / 2;
  // Every other one stands a little in front, so it reads as a group
  const order = who.map((id, i) => ({ id, i })).sort((a, b) => (a.i % 2) - (b.i % 2));
  return (<>
    <Shadow cy={100} rx={52} />
    {order.map(({ id, i }) => <BuddyFigure key={`${id}${i}`} id={id} x={left + step * i} y={(i % 2 ? 46 : 36) + (62 - size) / 2} size={size} />)}
  </>);
}

// Two buddies leaning in, arms up to one clap in the middle: the arms and ink motion lines say
// high five, and a pink star marks the slap (on the peach plate, ochre lines vanished)
function HighFive({ ids }) {
  const [a, b] = ids?.length >= 2 ? ids : ['visor', 'snapback'];
  return (<>
    <Shadow cy={104} rx={50} />
    <g transform="rotate(10 30 90)"><BuddyFigure id={a} x={-4} y={40} size={62} /></g>
    <g transform="rotate(-10 90 90)"><BuddyFigure id={b} x={62} y={40} size={62} /></g>
    <g {...line} strokeWidth="4"><path d="M38 70 Q50 52 56 40" /><path d="M82 70 Q70 52 64 40" /></g>
    <Hand x={56} y={38} /><Hand x={64} y={38} />
    <g {...line} strokeWidth="3"><path d="M60 26 V14" /><path d="M46 30 L37 20" /><path d="M74 30 L83 20" /></g>
    <path d="M60 6 L62.4 10.6 L67.5 11.3 L63.8 14.9 L64.7 20 L60 17.6 L55.3 20 L56.2 14.9 L52.5 11.3 L57.6 10.6Z" fill={PINK} />
  </>);
}

/** A scene's drawing on its own, as a group, to place inside a bigger drawing (120 by 120 units). */
export function SpotScene({ kind = 'tee' }) {
  const Scene = SCENES[kind] || SCENES.tee;
  return <Scene />;
}

/**
 * One spot illustration. `kind` picks the scene (see SCENES, plus 'crowd' and 'highfive', which
 * draw the buddies in `ids`). Decorative: screen readers skip it.
 */
export function Spot({ kind = 'tee', ids = null, size = 96, className = '', plate = 'auto' }) {
  const Scene = SCENES[kind];
  // An outside drawing (src/art/spots/<kind>.svg) takes the whole box, plate and all
  const file = artFile('spots', kind);
  // Small spots (inline, in a row) stay plain; a card-sized one gets its colour
  const color = plate === false ? null : plate === 'auto' ? (size >= 56 ? PLATE_OF[kind] : null) : plate;
  return (
    <svg className={`spot ${className}`.trim()} viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
      {file ? <ArtImage file={file} w={120} h={120} /> : <>
        {color && <Plate color={color} />}
        {kind === 'crowd' ? <Crowd ids={ids} /> : kind === 'highfive' ? <HighFive ids={ids} /> : Scene ? <Scene plated={!!color} /> : <SCENES.tee />}
      </>}
    </svg>
  );
}

/** The scenes there are, for the design check. */
// eslint-disable-next-line react-refresh/only-export-components
export const SPOT_KINDS = [...Object.keys(SCENES), 'crowd', 'highfive'];
