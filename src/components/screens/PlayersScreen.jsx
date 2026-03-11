import { useState } from 'react'
import { ChevronLeft, UserPlus, X, ArrowRight, Save } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getCrews, addCrew, getPastPlayers } from '../../storage'

export default function PlayersScreen() {
  const {
    go,
    players,
    selectedGames,
    addPlayer,
    addPlayerWithProfile,
    removePlayer,
    setPlayerName,
    setPlayerHcp,
    loadCrew,
    initial,
  } = useRound()
  const [useCrewValue, setUseCrewValue] = useState('')
  const crews = getCrews()
  const pastPlayers = getPastPlayers()
  const currentNames = new Set(players.map((p) => (p.name || '').trim().toLowerCase()))
  const pastToShow = pastPlayers.filter((p) => !currentNames.has((p.name || '').toLowerCase()))

  const canRemove = players.length > 2
  const showAdd = players.length < 6
  const needTwo = players.length < 2
  const wolfNeedsFour = selectedGames.includes('wolf') && players.length !== 4
  const note = needTwo
    ? 'Need at least 2 players.'
    : wolfNeedsFour
      ? 'Wolf requires exactly 4 players.'
      : ''

  const handleUseCrew = (e) => {
    const id = e.target.value
    setUseCrewValue(id)
    if (!id) return
    const crew = crews.find((c) => c.id === id)
    if (crew) loadCrew(crew.players)
  }

  const handleSaveAsCrew = () => {
    if (players.length < 2) return
    const name = players.map((p) => (p.name || '—').trim()).join(', ')
    addCrew(name, players)
    setUseCrewValue('')
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('games')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Players</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Who&apos;s Playing?</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '66%' }} />
      </div>
      {crews.length > 0 && (
        <div className="banker-pick-row">
          <label className="banker-pick-label">Use a crew</label>
          <select
            className="banker-pick-select"
            value={useCrewValue}
            onChange={handleUseCrew}
          >
            <option value="">Choose a crew…</option>
            {crews.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}
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
      <div className="players-note">{note}</div>
      <div style={{ marginTop: 20 }}>
        <button className="btn-primary" onClick={() => go('course')}>
          Let&apos;s Play <ArrowRight size={20} />
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => go('stakes')}
        >
          Set stakes (optional)
        </button>
      </div>
    </div>
  )
}
