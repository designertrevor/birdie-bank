import { PlusCircle, Clock, ChevronRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'

export default function HomeScreen() {
  const { go, resetRound } = useRound()

  const startNewRound = () => {
    resetRound()
    go('games')
  }

  return (
    <div className="screen active">
      <div className="home-hdr">
        <div className="logo">Birdie Bank</div>
        <div className="logo-sub">Golf Betting Scorecard</div>
      </div>
      <div className="home-actions">
        <button className="btn-primary" onClick={startNewRound}>
          <PlusCircle size={20} /> New Round
        </button>
        <button className="btn-secondary" onClick={() => go('history')}>
          <Clock size={18} /> Past Rounds
        </button>
      </div>
      <div className="crew-section">
        <div className="section-label">Your Crews</div>
        <div className="crew-card" onClick={() => go('games')}>
          <div>
            <div className="crew-names">The Saturday Boys</div>
            <div className="crew-meta">
              Mike · Dave · Connor · You &nbsp;·&nbsp; 3 days ago
            </div>
          </div>
          <div className="crew-chevron">
            <ChevronRight size={18} />
          </div>
        </div>
        <div className="crew-card" onClick={() => go('games')}>
          <div>
            <div className="crew-names">Work Trip</div>
            <div className="crew-meta">4 players &nbsp;·&nbsp; 2 weeks ago</div>
          </div>
          <div className="crew-chevron">
            <ChevronRight size={18} />
          </div>
        </div>
      </div>
    </div>
  )
}
