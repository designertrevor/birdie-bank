// The Ball buddies: the golf ball from the empty states, each in its own hat with its own face,
// on a backdrop, and the critters shelf (birdie, eagle, goose and friends) in the same palette. Drawn on a 64 by 64 square; the avatar circle around it does the clipping.
// The list and the names live in lib/avatars.js.
import { backdropOf } from '../lib/avatars.js';

const INK = '#0a0a0a';
const BALL = '#fbf7ec';
const round = { stroke: INK, strokeWidth: 2.6, fill: 'none', strokeLinecap: 'round' };

function Ball() {
  return (
    <>
      <circle cx="32" cy="37" r="21" fill={BALL} />
      <circle cx="32" cy="37" r="20.25" fill="none" stroke="rgba(10,10,10,.14)" strokeWidth="1.5" />
      <g fill="rgba(10,10,10,.1)"><circle cx="18.5" cy="47" r="1.9" /><circle cx="45.5" cy="47" r="1.9" /><circle cx="25" cy="53.5" r="1.9" /><circle cx="39" cy="53.5" r="1.9" /><circle cx="32" cy="55.5" r="1.6" /></g>
    </>
  );
}
const Eyes = () => <g fill={INK}><circle cx="25.5" cy="38.5" r="2.6" /><circle cx="38.5" cy="38.5" r="2.6" /></g>;
const Cheeks = () => <g fill="#ff4d8b" opacity=".35"><circle cx="20.5" cy="43.5" r="2.6" /><circle cx="43.5" cy="43.5" r="2.6" /></g>;
const Smile = () => <path d="M26 45 Q32 50.5 38 45" {...round} />;
const Grin = () => <path d="M25 45 Q32 53 39 45Z" fill={INK} />;

/** Each buddy: the hat, then the face, drawn over the ball. */
const ART = {
  bucket: () => (
    <>
      <path d="M17 27 Q18 11 32 11 Q46 11 47 27Z" fill="#e8b94a" />
      <path d="M17.4 23 Q32 20 46.6 23 L46.9 27 Q32 24 17.1 27Z" fill="#1a3a3a" />
      <path d="M9 29 Q32 20 55 29 Q55 33 51 33 Q32 27 13 33 Q9 33 9 29Z" fill="#c99a30" />
      <Eyes /><Cheeks /><Smile />
    </>
  ),
  visor: () => (
    <>
      <path d="M12 28 Q32 21 52 28 L52 32 Q32 25 12 32Z" fill="#1a3a3a" />
      <path d="M13 30 Q32 24 51 30 Q47 36 32 35 Q17 36 13 30Z" fill="#ff4d8b" />
      <g {...round}><path d="M22.5 40 Q25.5 37 28.5 40" /><path d="M35.5 40 Q38.5 37 41.5 40" /></g>
      <Cheeks /><Grin />
    </>
  ),
  snapback: () => (
    <>
      <path d="M12 32 Q12 13 32 13 Q52 13 52 32 Q32 26 12 32Z" fill="#ff4d8b" />
      <path d="M26.5 29.5 Q32 23 37.5 29.5Z" fill={BALL} />
      <circle cx="32" cy="14" r="2.2" fill="#d42a6b" />
      <path d="M22.5 38.5 Q25.5 36 28.5 38.5" {...round} />
      <circle cx="38.5" cy="38.5" r="2.6" fill={INK} /><Cheeks /><Smile />
      <path d="M33 48 Q35.5 53 38 48Z" fill="#ff4d8b" />
    </>
  ),
  flatcap: () => (
    <>
      <path d="M11 31 Q12 15 31 15 Q47 15 54 26 Q55 30 50 31 Q30 28 11 31Z" fill="#3d5a4f" />
      <path d="M18 22 Q32 17 46 21" stroke="rgba(255,255,255,.3)" strokeWidth="1.5" fill="none" />
      <Eyes />
      <path d="M23 46 Q27.5 41 32 44 Q36.5 41 41 46 Q36.5 48 32 46 Q27.5 48 23 46Z" fill="#6b4a2f" />
    </>
  ),
  shades: () => (
    <>
      <path d="M29 17 Q31 10 37 12" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <g fill={INK}><rect x="17" y="33" width="13" height="8.5" rx="3.5" /><rect x="34" y="33" width="13" height="8.5" rx="3.5" /><rect x="28" y="34.5" width="8" height="2.2" /></g>
      <path d="M20 35.5 L24 35.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M27 47 Q33 50 39 45" {...round} />
    </>
  ),
  beanie: () => (
    <>
      <path d="M13 30 Q13 12 32 12 Q51 12 51 30Z" fill="#ff4d8b" />
      <g stroke="#d42a6b" strokeWidth="1.6"><path d="M24 14 L22 27" /><path d="M32 12 L32 27" /><path d="M40 14 L42 27" /></g>
      <rect x="12" y="25" width="40" height="7.5" rx="3.75" fill="#d42a6b" />
      <circle cx="32" cy="9.5" r="5" fill={BALL} />
      <Eyes /><Cheeks />
      <ellipse cx="32" cy="46.5" rx="3" ry="3.5" fill={INK} />
    </>
  ),
  sweatband: () => (
    <>
      <rect x="13" y="24.5" width="38" height="7" rx="3.5" fill="#1a3a3a" />
      <rect x="13" y="27.2" width="38" height="1.6" fill="#ff4d8b" />
      <g stroke={INK} strokeWidth="2.4" strokeLinecap="round"><path d="M21.5 34 L28 35.5" /><path d="M42.5 34 L36 35.5" /></g>
      <Eyes />
      <rect x="25.5" y="43.5" width="13" height="5.5" rx="2.75" fill={BALL} stroke={INK} strokeWidth="2" />
      <path d="M32 43.5 V49" stroke={INK} strokeWidth="1.4" />
    </>
  ),
  tourcap: () => (
    <>
      <path d="M13 29 Q13 12 32 12 Q51 12 51 29Z" fill="#1a3a3a" />
      <circle cx="32" cy="20.5" r="3.2" fill="#ff4d8b" />
      <path d="M11 28 Q32 23 53 28 Q51 34.5 32 33.5 Q13 34.5 11 28Z" fill="#0f2626" />
      <Eyes /><Cheeks />
      <path d="M25 44 Q32 52 39 44Z" fill={INK} /><path d="M27.5 44.6 H36.5" stroke={BALL} strokeWidth="1.6" />
    </>
  ),
  cowboy: () => (
    <>
      <path d="M20 26 Q19 12 26 11 Q29 14 32 12 Q35 14 38 11 Q45 12 44 26Z" fill="#a8764a" />
      <path d="M20.5 23 Q32 20.5 43.5 23 L43.8 26 Q32 23.5 20.2 26Z" fill="#1a3a3a" />
      <path d="M6 24 Q10 31 32 30 Q54 31 58 24 Q56 33 32 33.5 Q8 33 6 24Z" fill="#8a5c36" />
      <Eyes /><Cheeks /><Smile />
    </>
  ),
  straw: () => (
    <>
      <path d="M18 27 Q18 13 32 13 Q46 13 46 27Z" fill="#f2d48a" />
      <rect x="18" y="22" width="28" height="4.5" fill="#1a3a3a" />
      <path d="M8 28 Q32 21 56 28 Q56 32 52 32 Q32 26.5 12 32 Q8 32 8 28Z" fill="#e8c46a" />
      <g stroke="rgba(10,10,10,.15)" strokeWidth="1"><path d="M24 15 L23 22" /><path d="M32 13.5 V22" /><path d="M40 15 L41 22" /></g>
      <path d="M22.5 38.5 Q25.5 36 28.5 38.5" {...round} />
      <circle cx="38.5" cy="38.5" r="2.6" fill={INK} /><Cheeks /><Smile />
    </>
  ),
  bandana: () => (
    <>
      <path d="M12.5 30 Q13 15 32 15 Q51 15 51.5 30 Q32 25 12.5 30Z" fill="#ff6b5a" />
      <g fill="#fbf7ec" opacity=".8"><circle cx="24" cy="21" r="1.4" /><circle cx="32" cy="19" r="1.4" /><circle cx="40" cy="21" r="1.4" /><circle cx="28" cy="25" r="1.2" /><circle cx="36" cy="25" r="1.2" /></g>
      <path d="M50 26 L58 22 L56 30Z" fill="#e5533f" /><path d="M50 27 L57 33 L52 34Z" fill="#e5533f" />
      <Eyes /><Cheeks /><Grin />
    </>
  ),
  crown: () => (
    <>
      <path d="M17 29 L15 12 L23.5 20 L32 9 L40.5 20 L49 12 L47 29Z" fill="#e8b94a" />
      <rect x="16.5" y="25" width="31" height="5" rx="1.5" fill="#c99a30" />
      <circle cx="32" cy="27.5" r="1.8" fill="#ff4d8b" /><circle cx="23" cy="27.5" r="1.4" fill="#a4d4c5" /><circle cx="41" cy="27.5" r="1.4" fill="#a4d4c5" />
      <g {...round}><path d="M22.5 39 Q25.5 36.5 28.5 39" /><path d="M35.5 39 Q38.5 36.5 41.5 39" /></g>
      <Cheeks />
      <path d="M27 46 Q32 49.5 37 45" {...round} />
    </>
  ),
  // More hats (overnight 6 follow-ups)
  tam: () => (
    <>
      <circle cx="32" cy="10.5" r="4.6" fill="#ff4d8b" />
      <path d="M10 25 Q11 13 32 12.5 Q53 13 54 25 Q50 29.5 32 28.5 Q14 29.5 10 25Z" fill="#1a3a3a" />
      <path d="M15 27 Q32 24.5 49 27 L49 31.5 Q32 29 15 31.5Z" fill="#e8b94a" />
      <g stroke="#ff4d8b" strokeWidth="1.3"><path d="M21 26 V30.5" /><path d="M28 25.3 V29.8" /><path d="M36 25.3 V29.8" /><path d="M43 26 V30.5" /></g>
      <path d="M15 29.2 Q32 26.8 49 29.2" stroke="#1a3a3a" strokeWidth="1" fill="none" />
      <Eyes /><Cheeks /><Smile />
    </>
  ),
  earmuffs: () => (
    <>
      <path d="M13.5 33 Q14 13.5 32 13.5 Q50 13.5 50.5 33" stroke="#1a3a3a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="13" cy="35.5" r="6.4" fill="#ff4d8b" /><circle cx="51" cy="35.5" r="6.4" fill="#ff4d8b" />
      <circle cx="13" cy="35.5" r="3" fill="#ffd6e5" /><circle cx="51" cy="35.5" r="3" fill="#ffd6e5" />
      <Eyes /><Cheeks />
      <ellipse cx="32" cy="46.5" rx="2.6" ry="3" fill={INK} />
    </>
  ),
  partyhat: () => (
    <>
      <path d="M22 23 L32 4 L42 23 Q32 26 22 23Z" fill="#e8b94a" />
      <g fill="#ff4d8b"><circle cx="30" cy="12" r="1.5" /><circle cx="34.5" cy="17" r="1.5" /><circle cx="27.5" cy="19.5" r="1.5" /><circle cx="37.5" cy="21.5" r="1.3" /></g>
      <circle cx="32" cy="4.5" r="3.3" fill="#ff4d8b" />
      <Eyes /><Cheeks /><Grin />
    </>
  ),
  halo: () => (
    <>
      <ellipse cx="32" cy="9.5" rx="12" ry="3.6" fill="none" stroke="#e8b94a" strokeWidth="3" />
      <g {...round}><path d="M22.5 39 Q25.5 41.5 28.5 39" /><path d="M35.5 39 Q38.5 41.5 41.5 39" /></g>
      <Cheeks /><Smile />
    </>
  ),
};

/**
 * The critters shelf: golf in-jokes in the same palette and 64 by 64 square, drawn on the backdrop
 * without the ball (the birdie, the eagle, the goose that owns the 7th green, and friends).
 */
const CRITTERS = {
  birdie: () => (
    <>
      <path d="M30 21 Q27 12 33 13 Q31 16.5 35 19Z" fill="#d42a6b" />
      <circle cx="32" cy="37" r="18" fill="#ff4d8b" />
      <ellipse cx="32" cy="44" rx="10.5" ry="8.5" fill="#ffd6e5" />
      <path d="M14.5 38 Q10 47 20 47Z" fill="#d42a6b" /><path d="M49.5 38 Q54 47 44 47Z" fill="#d42a6b" />
      <g fill={INK}><circle cx="26.5" cy="33" r="2.5" /><circle cx="37.5" cy="33" r="2.5" /></g>
      <path d="M28.5 37 L35.5 37 L32 41.5Z" fill="#e8b94a" />
    </>
  ),
  eagle: () => (
    <>
      <path d="M6 64 Q10 43 32 43 Q54 43 58 64Z" fill="#7a4a2a" />
      <circle cx="32" cy="30" r="15" fill={BALL} />
      <g stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M22 24.5 L29.5 27.5" /><path d="M42 24.5 L34.5 27.5" /></g>
      <g fill={INK}><circle cx="27" cy="31" r="2.3" /><circle cx="37" cy="31" r="2.3" /></g>
      <path d="M26.5 35 Q32 32.5 37.5 35 Q38 42 32 45.5 Q33 40.5 30 39.5 Q27 38.5 26.5 35Z" fill="#e8b94a" />
    </>
  ),
  goose: () => (
    <>
      <ellipse cx="28" cy="64" rx="22" ry="11" fill="#8a6a4a" />
      <path d="M28 58 L29 32" stroke="#2a2a2a" strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="32" cy="25" rx="10" ry="8.5" fill="#2a2a2a" />
      <path d="M40 22 L52 25.5 L40 29Z" fill="#2a2a2a" />
      <path d="M24 26 Q28 35 35 30 Q30 30.5 27.5 24Z" fill={BALL} />
      <circle cx="35.5" cy="22" r="2.6" fill={BALL} /><circle cx="36" cy="22.3" r="1.3" fill={INK} />
      <path d="M31.5 17.5 L39 20" stroke={BALL} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  gopher: () => (
    <>
      <ellipse cx="32" cy="56" rx="22" ry="7" fill="#1a3a3a" />
      <circle cx="19.5" cy="25" r="4.8" fill="#a8764a" /><circle cx="44.5" cy="25" r="4.8" fill="#a8764a" />
      <circle cx="19.5" cy="25" r="2.2" fill="#ffb084" /><circle cx="44.5" cy="25" r="2.2" fill="#ffb084" />
      <path d="M15 57 Q13 23 32 22 Q51 23 49 57Z" fill="#a8764a" />
      <ellipse cx="32" cy="41" rx="8.5" ry="6.5" fill="#e8c9a0" />
      <ellipse cx="32" cy="37.5" rx="2.8" ry="2" fill={INK} />
      <rect x="29.3" y="42.5" width="5.4" height="5.5" rx="1.2" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <path d="M32 42.5 V48" stroke={INK} strokeWidth="1" />
      <g fill={INK}><circle cx="25.5" cy="32" r="2.3" /><circle cx="38.5" cy="32" r="2.3" /></g>
      <path d="M8 56 Q32 63 56 56 L56 64 L8 64Z" fill="#7fb8a6" />
    </>
  ),
  flamingo: () => (
    <>
      <ellipse cx="22" cy="64" rx="18" ry="11" fill="#ff4d8b" />
      <path d="M27 60 Q23 46 32 40 Q41 34 34 25" stroke="#ff4d8b" strokeWidth="7.5" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="21" r="8.5" fill="#ff4d8b" />
      <path d="M38 19 Q48 19 46.5 30 Q44 25 38 25.5Z" fill={BALL} />
      <path d="M45.3 25.8 Q46.8 28 46.5 30 Q44.4 28.4 43.6 26.9Z" fill={INK} />
      <circle cx="34.5" cy="19" r="2" fill={INK} />
    </>
  ),
  frog: () => (
    <>
      <ellipse cx="32" cy="42" rx="23" ry="16" fill="#5fae7a" />
      <circle cx="20.5" cy="28" r="7.5" fill="#5fae7a" /><circle cx="43.5" cy="28" r="7.5" fill="#5fae7a" />
      <circle cx="20.5" cy="27.5" r="4.8" fill={BALL} /><circle cx="43.5" cy="27.5" r="4.8" fill={BALL} />
      <g fill={INK}><circle cx="21.5" cy="28" r="2.4" /><circle cx="42.5" cy="28" r="2.4" /></g>
      <path d="M18 43 Q32 53 46 43" {...round} />
      <g fill="#ff4d8b" opacity=".45"><circle cx="15" cy="41" r="3" /><circle cx="49" cy="41" r="3" /></g>
    </>
  ),
  tiger: () => (
    <>
      <circle cx="17" cy="21" r="6.5" fill="#e8b94a" /><circle cx="47" cy="21" r="6.5" fill="#e8b94a" />
      <circle cx="17" cy="21" r="3" fill="#ffd6e5" /><circle cx="47" cy="21" r="3" fill="#ffd6e5" />
      <circle cx="32" cy="35" r="18.5" fill="#e8b94a" />
      <circle cx="32" cy="14" r="4.5" fill={BALL} />
      <g stroke="#1a3a3a" strokeWidth="2.6" strokeLinecap="round"><path d="M32 18 V24" /><path d="M25.5 19 L27.5 24" /><path d="M38.5 19 L36.5 24" /><path d="M13.8 34 L19 35" /><path d="M14.5 40 L19.5 40" /><path d="M50.2 34 L45 35" /><path d="M49.5 40 L44.5 40" /></g>
      <ellipse cx="32" cy="43" rx="9.5" ry="7" fill={BALL} />
      <path d="M28.8 39 L35.2 39 L32 42.2Z" fill="#d42a6b" />
      <g fill={INK}><circle cx="25" cy="32" r="2.4" /><circle cx="39" cy="32" r="2.4" /></g>
    </>
  ),
  flag: () => (
    <>
      <ellipse cx="32" cy="59" rx="28" ry="9" fill="#7fb8a6" />
      <ellipse cx="29" cy="55" rx="6.5" ry="2.2" fill="#1a3a3a" />
      <rect x="27.5" y="10" width="3" height="45" rx="1.5" fill="#1a3a3a" />
      <path d="M30.5 10.5 L51 18.5 L30.5 26.5Z" fill="#ff4d8b" />
      <g fill={INK}><circle cx="37" cy="17.5" r="1.6" /><circle cx="42" cy="18.5" r="1.6" /></g>
      <circle cx="41" cy="53" r="3.8" fill={BALL} stroke="rgba(10,10,10,.2)" strokeWidth="1" />
    </>
  ),
};

/**
 * A buddy with no backdrop, as a group to place inside a bigger drawing (the spot illustrations).
 * `x` and `y` are its top left and `size` its width, in the parent drawing's units.
 */
export function BuddyFigure({ id, x = 0, y = 0, size = 64 }) {
  const Critter = CRITTERS[id];
  const Hat = ART[id] || ART.bucket;
  return <g transform={`translate(${x} ${y}) scale(${size / 64})`}>{Critter ? <Critter /> : <><Ball /><Hat /></>}</g>;
}

/** One Ball buddy (or critter) on its backdrop, as an SVG that fills its box. */
export function BuddyArt({ id, bg, className = '' }) {
  const Critter = CRITTERS[id];
  const Hat = ART[id] || ART.bucket;
  return (
    <svg className={`buddy-art ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" fill={backdropOf(bg).hex} />
      {Critter ? <Critter /> : <><Ball /><Hat /></>}
    </svg>
  );
}
