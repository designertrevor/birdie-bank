// The winner's moment: their Ball buddy in a crown, and the top three on a podium. Used by the round
// results and the season's hall of fame, so a win looks the same everywhere.
import { AvatarArt } from './Avatar.jsx';
import { placeLabel } from '../lib/format.js';
import { lighten } from '../lib/game-theme.js';

/** A crown, drawn to sit on top of an avatar circle. */
export function Crown({ className = 'crown-art' }) {
  return (
    <svg className={className} viewBox="0 0 64 36" aria-hidden="true" focusable="false">
      <path d="M6 32 L10 6 L22 20 L32 2 L42 20 L54 6 L58 32Z" fill="#e8b94a" />
      <rect x="6" y="28" width="52" height="8" rx="3" fill="#c99a30" />
      <circle cx="32" cy="20" r="4" fill="#ff4d8b" /><circle cx="17" cy="24" r="3" fill="#ff4d8b" /><circle cx="47" cy="24" r="3" fill="#ff4d8b" />
    </svg>
  );
}

/** Someone's avatar with the crown on. `size` is the circle's width in px. */
export function CrownedFace({ model, size = 96 }) {
  if (!model) return null;
  return (
    <span className="crowned" style={{ '--face': `${size}px` }}>
      <Crown />
      <AvatarArt model={model} />
    </span>
  );
}

/**
 * The top three on steps (second, first, third from left), each with their buddy, name and amount.
 * `standings` is sorted best first; `faces` maps id to an avatar model; `fmt` formats an amount.
 */
export function Podium({ standings, faces, fmt, tint = null }) {
  const top = standings.slice(0, 3).map((p, i) => ({ ...p, label: placeLabel(standings, i), i }));
  const order = top.length === 3 ? [top[1], top[0], top[2]] : top;
  // `tint` (a game's colour, game-theme.js) builds the steps in it: first place in the full colour,
  // second and third in paler washes of it, so the podium reads as that game's
  const steps = tint ? { '--pod-1': tint, '--pod-2': lighten(tint, 0.38), '--pod-3': lighten(tint, 0.6) } : undefined;
  return (
    <div className={`podium ${tint ? 'themed' : ''}`.trim()} style={steps} role="list" aria-label="Top three">
      {order.map(p => (
        <div key={p.id} className={`pod pod-${p.i + 1}`} role="listitem">
          <span className="pod-face">{p.i === 0 && faces.get(p.id) ? <CrownedFace model={faces.get(p.id)} size={64} /> : faces.get(p.id) && <AvatarArt model={faces.get(p.id)} />}</span>
          <span className="pod-name">{p.name.split(' ')[0]}</span>
          <span className={`pod-amt ${p.amount > 0 ? 'pos' : p.amount < 0 ? 'neg' : ''}`}>{fmt(p.amount, { sign: true })}</span>
          <span className="pod-step d"><span className="sr-only">Place </span>{p.label}</span>
        </div>
      ))}
    </div>
  );
}
