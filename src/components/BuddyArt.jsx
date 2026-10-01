// The Ball buddies: the golf ball from the empty states, each in its own hat with its own face,
// on a backdrop. Drawn on a 64 by 64 square; the avatar circle around it does the clipping.
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
};

/** One Ball buddy on its backdrop, as an SVG that fills its box. */
export function BuddyArt({ id, bg, className = '' }) {
  const Hat = ART[id] || ART.bucket;
  return (
    <svg className={`buddy-art ${className}`} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" fill={backdropOf(bg).hex} />
      <Ball />
      <Hat />
    </svg>
  );
}
