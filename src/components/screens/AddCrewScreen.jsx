import { useMemo, useState } from 'react'
import { ChevronLeft, UserPlus, X, Save } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { addCrew, getPastPlayers } from '../../storage'

export default function AddCrewScreen() {
  const { go, navReturnTo, setNavReturnTo, initial } = useRound()
  const [players, setPlayers] = useState([
    { id: 1, name: '', hcp: 18 },
    { id: 2, name: '', hcp: 18 },
    { id: 3, name: '', hcp: 18 },
    { id: 4, name: '', hcp: 18 },
  ])
  const [nextId, setNextId] = useState(5)
  const pastPlayers = getPastPlayers()
  const currentNames = useMemo(
    () => new Set(players.map((p) => (p.name || '').trim().toLowerCase())),
    [players]
  )
  const pastToShow = pastPlayers.filter((p) => !currentNames.has((p.name || '').toLowerCase()))
  const canRemove = players.length > 1
  const showAdd = players.length < 6
  const backTo = navReturnTo || 'settings'

  const addPlayer = () => {
    setPlayers((prev) => [...prev, { id: nextId, name: '', hcp: 18 }])
    setNextId((n) => n + 1)
  }

  const addPlayerWithProfile = (name, hcp) => {
    setPlayers((prev) => [...prev, { id: nextId, name: name ?? '', hcp: hcp ?? 18 }])
    setNextId((n) => n + 1)
  }

  const removePlayer = (id) => setPlayers((prev) => prev.filter((p) => p.id !== id))
  const setPlayerName = (id, name) =>
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  const setPlayerHcp = (id, hcp) =>
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, hcp: parseInt(hcp, 10) || 0 } : p))
    )

  const handleSaveAsCrew = () => {
    if (players.length < 2) return
    const name = players.map((p) => (p.name || '—').trim()).join(', ')
    addCrew(name, players)
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
            setNavReturnTo(null)
            go(backTo)
          }}
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Add crew</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Add players, then save as a crew.</div>
      <div className="players-list">
        {players.map((p) => (
          <div key={p.id} className="player-row">
            <div className="player-avatar">{initial(p.name)}</div>
            <div className="player-input-wrap">
              <input
                className="player-name-input"
                value={p.name}
                placeholder="Player name"
                onChange={(e) => setPlayerName(p.id, e.target.value)}
              />
              <div className="player-hcp-row">
                <span className="player-hcp-label">HCP</span>
                <button
                  type="button"
                  className="player-hcp-btn"
                  onClick={() => setPlayerHcp(p.id, String(Math.max(0, p.hcp - 1)))}
                  aria-label="Decrease handicap"
                >
                  −
                </button>
                <input
                  className="player-hcp-input"
                  type="number"
                  min={0}
                  max={54}
                  value={p.hcp}
                  onChange={(e) => setPlayerHcp(p.id, e.target.value)}
                />
                <button
                  type="button"
                  className="player-hcp-btn"
                  onClick={() => setPlayerHcp(p.id, String(Math.min(54, p.hcp + 1)))}
                  aria-label="Increase handicap"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              className="player-remove"
              onClick={() => removePlayer(p.id)}
              disabled={!canRemove}
              title="Remove"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      {pastToShow.length > 0 && showAdd && (
        <div className="past-players-row">
          <span className="past-players-label">Add from past:</span>
          <div className="past-players-chips">
            {pastToShow.slice(0, 12).map((p) => (
              <button
                key={p.name}
                type="button"
                className="past-player-chip"
                onClick={() => addPlayerWithProfile(p.name, p.hcp)}
              >
                {p.name} {p.hcp !== 18 ? `(HCP ${p.hcp})` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {showAdd && (
        <button type="button" className="add-player-btn" onClick={addPlayer}>
          <UserPlus size={18} /> Add Player
        </button>
      )}
      {players.length >= 2 && (
        <button
          type="button"
          className="btn-save-crew"
          onClick={handleSaveAsCrew}
        >
          <Save size={16} /> Save as crew
        </button>
      )}
      {players.length < 2 && (
        <div className="players-note">Add at least 2 players to save as a crew.</div>
      )}
    </div>
  )
}
