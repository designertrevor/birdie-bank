import { PlusCircle, Clock, ChevronRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getCrews } from '../../storage'

function formatCrewDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const days = Math.floor((now - d) / (24 * 60 * 60 * 1000))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

export default function HomeScreen() {
  const { go, resetRound, startAddCrew, setSelectedCrewId } = useRound()
  const crews = getCrews()

  const startNewRound = () => {
    resetRound()
    go('games')
  }

  const openCrew = (crew) => {
    setSelectedCrewId(crew.id)
    go('crewDetail')
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
        <div className="section-label-row">
          <span className="section-label">Your Crews</span>
          <button
            type="button"
            className="btn-add-crew"
            onClick={startAddCrew}
          >
            <PlusCircle size={16} /> Add crew
          </button>
        </div>
        {crews.length === 0 ? (
          <div className="crew-empty">No crews yet. Tap Add crew to add players and save.</div>
        ) : (
          crews.map((crew) => (
            <div
              key={crew.id}
              className="crew-card"
              onClick={() => openCrew(crew)}
            >
              <div>
                <div className="crew-names">
                  {crew.players.map((p) => p.name || '—').join(', ')}
                </div>
                <div className="crew-meta">
                  {formatCrewDate(crew.updatedAt)}
                </div>
              </div>
              <div className="crew-chevron">
                <ChevronRight size={18} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
