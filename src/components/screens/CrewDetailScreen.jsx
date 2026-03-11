import { useEffect } from 'react'
import { ChevronLeft, Trash2, ChevronRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getCrews, deleteCrew } from '../../storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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

export default function CrewDetailScreen() {
  const { go, loadCrew, selectedCrewId, setSelectedCrewId, navReturnTo, setNavReturnTo } = useRound()
  const crews = getCrews()
  const crew = crews.find((c) => c.id === selectedCrewId)
  const backTo = navReturnTo || 'settings'

  useEffect(() => {
    if (!selectedCrewId || !crew) {
      go(backTo)
    }
  }, [selectedCrewId, crew, go, backTo])

  if (!crew) return null

  const handleUseCrew = () => {
    loadCrew(crew.players)
    setSelectedCrewId(null)
    setNavReturnTo(null)
    go('playPlayers')
  }

  const handleDelete = () => {
    if (window.confirm('Delete this crew?')) {
      deleteCrew(crew.id)
      setSelectedCrewId(null)
      setNavReturnTo(null)
      go(backTo)
    }
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <Button
          type="button"
          className="back-btn"
          onClick={() => {
            setSelectedCrewId(null)
            setNavReturnTo(null)
            go(backTo)
          }}
        >
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="topbar-title">Crew</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="crew-detail-body">
        <div className="crew-detail-names">
          {crew.players.map((p) => p.name || '—').join(', ')}
        </div>
        <div className="crew-detail-meta">{formatCrewDate(crew.updatedAt)}</div>
        <Card className="crew-detail-list">
          {crew.players.map((p) => (
            <div key={p.name} className="crew-detail-player">
              <span className="crew-detail-player-name">{p.name || '—'}</span>
              <span className="crew-detail-player-hcp">HCP {p.hcp ?? 18}</span>
            </div>
          ))}
        </Card>
        <Button type="button" className="btn-primary" onClick={handleUseCrew}>
          Use this crew <ChevronRight size={20} />
        </Button>
        <Button
          type="button"
          className="btn-delete-crew"
          onClick={handleDelete}
        >
          <Trash2 size={16} /> Delete crew
        </Button>
      </div>
    </div>
  )
}
