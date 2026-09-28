// The free promise as a sheet: what stays free for everyone, forever. Opened from the Tab and the Season preview.
import { Icon, Sheet } from './ui.jsx';
import { GAMES } from '../lib/round.js';
import { freePromise } from '../lib/paywall.js';

export default function FreePromise({ open, onClose }) {
  const games = Object.keys(GAMES).length;
  return (
    <Sheet open={open} onClose={onClose} title="Free forever, for everyone">
      <div style={{ padding: '4px 20px 20px' }}>
        <ul className="pw-list" style={{ margin: '8px 0 14px' }}>
          {freePromise(games).map(t => <li key={t}><Icon name="check-circle" fill /> {t}</li>)}
        </ul>
        <div className="block pw-free" style={{ margin: '0 0 14px' }}>
          <div style={{ fontWeight: 700 }}>Invited players never see a paywall.</div>
          <p className="li-sub" style={{ marginTop: 4 }}>Nothing on this list ever moves to Pro.</p>
        </div>
        <button className="full-btn outline" onClick={onClose}>Got it</button>
      </div>
    </Sheet>
  );
}
