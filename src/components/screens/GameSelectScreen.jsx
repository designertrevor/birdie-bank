import { ChevronLeft, Check, ArrowRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { GAME_CFG } from '../../constants'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function GameSelectScreen() {
  const { go, selectedGames, toggleGame } = useRound()

  return (
    <div className="screen active">
      <div className="topbar">
        <Button type="button" className="back-btn" onClick={() => go('home')}>
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="topbar-title">New Round</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Step 1 of 3 — Pick Games</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '33%' }} />
      </div>
      <div className="game-grid">
        {Object.entries(GAME_CFG).map(([key, cfg]) => {
          const Icon = cfg.icon
          const selected = selectedGames.includes(key)
          return (
            <Card
              key={key}
              role="button"
              tabIndex={0}
              className={`game-tile ${selected ? 'selected' : ''}`}
              onClick={() => toggleGame(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleGame(key)
                }
              }}
            >
              <div className="game-tile-check">
                <Check size={13} />
              </div>
              <div className="game-tile-icon">
                <Icon size={26} />
              </div>
              <div className="game-tile-name" style={{ color: '#ffffff' }}>
                {cfg.label}
              </div>
              <div className="game-tile-desc">{cfg.sub}</div>
            </Card>
          )
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <Button className="btn-primary" onClick={() => go('players')}>
          Next: Add Players <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  )
}
