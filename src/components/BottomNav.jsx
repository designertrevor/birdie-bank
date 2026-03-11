import { Clock, Play, Settings } from 'lucide-react'

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <button
        type="button"
        className={`bn-item ${active === 'history' ? 'on' : ''}`}
        onClick={() => onNavigate('history')}
      >
        <Clock size={18} />
        <span>History</span>
      </button>

      <button
        type="button"
        className={`bn-play ${active === 'play' ? 'on' : ''}`}
        onClick={() => onNavigate('play')}
        aria-label="Play"
      >
        <Play size={20} />
        <span>PLAY</span>
      </button>

      <button
        type="button"
        className={`bn-item ${active === 'settings' ? 'on' : ''}`}
        onClick={() => onNavigate('settings')}
      >
        <Settings size={18} />
        <span>Settings</span>
      </button>
    </nav>
  )
}

