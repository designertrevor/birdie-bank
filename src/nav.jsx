import { Icon } from './components/ui.jsx';
import { useStore } from './lib/store.js';
import { useNav } from './lib/nav.js';

export function BottomNav() {
  const nav = useNav();
  const active = useStore(s => s.activeRoundId);
  const item = (t, icon, label) => (
    <button className={`nav-btn ${nav.tab === t ? 'active' : ''}`} onClick={() => nav.setTab(t)} aria-current={nav.tab === t ? 'page' : undefined}>
      <Icon name={icon} fill /><span className="nav-lbl">{label}</span>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {item('history', 'clock-counter-clockwise', 'History')}
      {item('ledger', 'receipt', 'Ledger')}
      <button className="nav-btn center" aria-label={active ? 'Resume round' : 'Start a round'}
        onClick={() => active ? nav.push('play', { id: active }) : nav.push('newRound')}>
        <div className="nav-play"><Icon name={active ? 'play' : 'golf'} fill /></div>
      </button>
      {item('people', 'users-three', 'Players')}
      {item('settings', 'gear-six', 'Settings')}
    </nav>
  );
}
