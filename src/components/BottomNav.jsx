import { Clock, Play, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <div className="bottom-nav-inner">
        <Button
          type="button"
          className={`bn-item ${active === 'history' ? 'on' : ''}`}
          onClick={() => onNavigate('history')}
        >
          <Clock size={18} />
          <span>History</span>
        </Button>

        <Button
          type="button"
          className={`bn-play ${active === 'play' ? 'on' : ''}`}
          onClick={() => onNavigate('play')}
          aria-label="Play"
        >
          <Play size={20} />
          <span>PLAY</span>
        </Button>

        <Button
          type="button"
          className={`bn-item ${active === 'settings' ? 'on' : ''}`}
          onClick={() => onNavigate('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </Button>
      </div>
    </nav>
  )
}

