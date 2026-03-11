import { ChevronLeft, Check, ArrowRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { GAME_CFG } from '../../constants'

export default function GameSelectScreen() {
  const { go, selectedGames, toggleGame } = useRound()

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('home')}>
          <ChevronLeft size={16} /> Back
        </button>
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
            <div
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
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={() => go('players')}>
          Next: Add Players <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
