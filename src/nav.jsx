import { Icon } from './components/ui.jsx';
import { useStore } from './lib/store.js';
import { useNav } from './lib/nav.js';

export function BottomNav() {
  const nav = useNav();
  // Only a round that's still being played: never resume one that was finished or discarded
  const active = useStore(s => (s.activeRoundId && s.rounds[s.activeRoundId]?.status === 'active' ? s.activeRoundId : null));
  const item = (t, icon, label) => (
    <button className={`nav-btn ${nav.tab === t ? 'active' : ''}`} onClick={() => nav.setTab(t)} aria-current={nav.tab === t ? 'page' : undefined}>
      <Icon name={icon} fill /><span className="nav-lbl">{label}</span>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {item('upnext', 'house-simple', 'Up next')}
      {item('ledger', 'receipt', 'Tab')}
      <button className="nav-btn center" aria-label={active ? 'Resume round' : 'Start a round'}
        onClick={() => active ? nav.push('play', { id: active }) : nav.push('newRound')}>
        <div className="nav-play"><Icon name={active ? 'play' : 'golf'} fill /></div>
      </button>
      {item('history', 'clock-counter-clockwise', 'History')}
      {item('people', 'users-three', 'Players')}
    </nav>
  );
}

/** Initials for the avatar: "Trevor Nielsen" is TN, "Bo" is B. */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

/** Your initials at the top right of a main tab. Opens Settings. */
export function AvatarButton() {
  const nav = useNav();
  const name = useStore(s => s.players[s.me]?.name);
  const mark = initials(name);
  return (
    <button className="avatar-btn" onClick={() => nav.push('settings')} aria-label="Settings">
      {mark ? <span aria-hidden="true">{mark}</span> : <Icon name="gear-six" fill />}
    </button>
  );
}
