import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { GAME_CFG, GAME_KEYS } from '../../constants'

export default function PlayGamesScreen() {
  const { go, players, selectedGames, toggleGame, stakeVals, setStake } = useRound()

  const hasGames = selectedGames.length > 0
  const wolfOn = selectedGames.includes('wolf')
  const wolfBadCount = wolfOn && players.length !== 4

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('playPlayers')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Choose Games</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="step-label">Step 3 of 3</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '100%' }} />
      </div>

      <div className="list" style={{ marginTop: 10 }}>
        {GAME_KEYS.map((g) => {
          const cfg = GAME_CFG[g]
          const selected = selectedGames.includes(g)
          const val = stakeVals[g] ?? 1
          return (
            <div key={g} className="game-row">
              <button
                type="button"
                className={`game-row-main ${selected ? 'on' : ''}`}
                onClick={() => toggleGame(g)}
              >
                <div className="game-row-left">
                  <div className="game-row-name">{cfg.label}</div>
                </div>
                <div className="game-row-right">{selected ? `$${val}` : ''}</div>
              </button>

              {selected && (
                <div className="game-row-stake">
                  <button type="button" className="stake-btn" onClick={() => setStake(g, -1)}>
                    −
                  </button>
                  <div className="stake-val">${val}</div>
                  <button type="button" className="stake-btn" onClick={() => setStake(g, 1)}>
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!hasGames && <div className="players-note">Must select at least 1 game to proceed.</div>}
      {wolfBadCount && (
        <div className="players-note">
          <AlertTriangle size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> Wolf
          requires exactly 4 players.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => go('hole')}
          disabled={!hasGames}
        >
          Start Round
        </button>
      </div>
    </div>
  )
}

