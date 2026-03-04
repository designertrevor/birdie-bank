import { ChevronLeft, UserPlus, X, ArrowRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'

export default function PlayersScreen() {
  const {
    go,
    players,
    selectedGames,
    addPlayer,
    removePlayer,
    setPlayerName,
    setPlayerHcp,
    initial,
  } = useRound()

  const canRemove = players.length > 2
  const showAdd = players.length < 6
  const needTwo = players.length < 2
  const wolfNeedsFour = selectedGames.includes('wolf') && players.length !== 4
  const note = needTwo
    ? 'Need at least 2 players.'
    : wolfNeedsFour
      ? 'Wolf requires exactly 4 players.'
      : ''

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('games')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Players</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Step 2 of 3 — Who&apos;s Playing?</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '66%' }} />
      </div>
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
                <input
                  className="player-hcp-input"
                  type="number"
                  min={0}
                  max={54}
                  value={p.hcp}
                  onChange={(e) => setPlayerHcp(p.id, e.target.value)}
                />
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
      {showAdd && (
        <button type="button" className="add-player-btn" onClick={addPlayer}>
          <UserPlus size={18} /> Add Player
        </button>
      )}
      <div className="players-note">{note}</div>
      <div style={{ marginTop: 20 }}>
        <button className="btn-primary" onClick={() => go('stakes')}>
          Next: Set Stakes <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}
