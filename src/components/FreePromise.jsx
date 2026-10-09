// The free promise as a sheet: what stays free for everyone, forever. Opened from the Tab and the Season preview.
// Held in production until Trevor says so: it only shows with the paywall preview flag (dev, ?paywall=on).
import { Icon, Sheet } from './ui.jsx';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { GAMES } from '../lib/round.js';
import { freePromise } from '../lib/paywall.js';

/** The list on its own, for a screen that shows it in place (the cancel screen, Your plan). */
export function FreePromiseList({ className = '', style }) {
  const games = Object.keys(GAMES).length;
  return (
    <ul className={`pw-list ${className}`.trim()} style={style}>
      {freePromise(games).map(t => <li key={t}><Icon name="check-circle" fill /> {t}</li>)}
    </ul>
  );
}

export default function FreePromise({ open, onClose }) {
  if (!PAYWALL_ON) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Free forever, for everyone">
      <div style={{ padding: '4px 20px 20px' }}>
        <FreePromiseList style={{ margin: '8px 0 14px' }} />
        <div className="block pw-free" style={{ margin: '0 0 14px' }}>
          <div style={{ fontWeight: 700 }}>Invited players never see a paywall.</div>
          <p className="li-sub" style={{ marginTop: 4 }}>Nothing on this list ever moves to Pro.</p>
        </div>
        <button className="full-btn outline" onClick={onClose}>Got it</button>
      </div>
    </Sheet>
  );
}
