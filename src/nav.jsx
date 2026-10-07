import { useState } from 'react';
import { Icon } from './components/ui.jsx';
import { Avatar } from './components/Avatar.jsx';
import { RoundsInProgressSheet } from './components/RoundsInProgress.jsx';
import { roundsInProgress } from './lib/rounds-live.js';
import { useStore } from './lib/store.js';
import { useNav } from './lib/nav.js';

export function BottomNav() {
  const nav = useNav();
  // Only a round that's still being played: never resume one that was finished or deleted.
  // With more than one going, the play button asks which.
  const active = useStore(s => roundsInProgress(s)[0]?.id ?? null);
  const several = useStore(s => roundsInProgress(s).length > 1);
  // The hole the round in progress is on, on the button, like a live activity
  const holeNo = useStore(s => { const r = roundsInProgress(s)[0]; return r ? r.holes[Math.min(r.current || 0, r.holes.length - 1)]?.no ?? null : null; });
  const [picking, setPicking] = useState(false);
  const item = (t, icon, label) => (
    <button className={`nav-btn ${nav.tab === t ? 'active' : ''}`} onClick={() => nav.setTab(t)} aria-current={nav.tab === t ? 'page' : undefined}>
      <Icon name={icon} fill /><span className="nav-lbl">{label}</span>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {item('upnext', 'house-simple', 'Up next')}
      {item('ledger', 'receipt', 'Tab')}
      <button className="nav-btn center" aria-label={several ? 'Rounds in progress' : active ? 'Resume round' : 'Start a round'}
        onClick={() => (several ? setPicking(true) : active ? nav.push('play', { id: active }) : nav.push('newRound'))}>
        <div className={`nav-play ${active ? 'live' : ''}`}><Icon name={active ? 'play' : 'golf'} fill />{active && holeNo != null && !several && <span className="np-hole" aria-hidden="true">H{holeNo}</span>}</div>
      </button>
      {several && <RoundsInProgressSheet open={picking} onClose={() => setPicking(false)} />}
      {item('history', 'clock-counter-clockwise', 'History')}
      {item('people', 'users-three', 'Players')}
    </nav>
  );
}

/** Your avatar at the top right of a main tab: your buddy, your photo, or your initials. Opens Settings. */
export function AvatarButton() {
  const nav = useNav();
  const me = useStore(s => s.me);
  const name = useStore(s => s.players[s.me]?.name);
  return (
    <button className="avatar-btn" onClick={() => nav.push('settings')} aria-label="Settings">
      {name ? <Avatar id={me} name={name} letters={2} className="av-in-btn" /> : <Icon name="gear-six" fill />}
    </button>
  );
}
