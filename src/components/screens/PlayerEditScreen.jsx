import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Save } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { addPlayerProfile, getPlayers, updatePlayerProfile } from '../../storage'

export default function PlayerEditScreen() {
  const { go, editPlayerId, setEditPlayerId, navReturnTo, setNavReturnTo } = useRound()
  const players = getPlayers()

  const existing = useMemo(() => {
    if (editPlayerId == null || editPlayerId === 'new') return null
    return players.find((p) => p.id === editPlayerId) ?? null
  }, [players, editPlayerId])

  const [name, setName] = useState(existing?.name ?? '')
  const [hcp, setHcp] = useState(existing?.hcp ?? 18)

  useEffect(() => {
    setName(existing?.name ?? '')
    setHcp(existing?.hcp ?? 18)
  }, [existing])

  const backTo = navReturnTo || 'settings'

  const save = () => {
    const n = (name || '').trim()
    if (!n) return
    const h = Math.max(0, Math.min(54, parseInt(String(hcp), 10) || 0))
    if (editPlayerId === 'new' || editPlayerId == null) addPlayerProfile(n, h)
    else updatePlayerProfile(editPlayerId, { name: n, hcp: h })

    setEditPlayerId(null)
    setNavReturnTo(null)
    go(backTo)
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <button
          type="button"
          className="back-btn"
          onClick={() => {
            setEditPlayerId(null)
            go(backTo)
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">{existing ? 'Edit Player' : 'Add Player'}</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="form">
        <label className="banker-pick-label">Name</label>
        <input
          className="course-name-input"
          value={name}
          placeholder="Trevor"
          onChange={(e) => setName(e.target.value)}
        />

        <label className="banker-pick-label">Handicap</label>
        <input
          className="course-name-input"
          type="number"
          min={0}
          max={54}
          value={hcp}
          onChange={(e) => setHcp(e.target.value)}
        />
      </div>

      <button type="button" className="btn-primary" onClick={save}>
        <Save size={20} /> Save
      </button>
    </div>
  )
}

