import { ChevronLeft, CircleSlash, Flag } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { GAME_CFG, GAME_KEYS } from '../../constants'

export default function StakesScreen() {
  const { go, selectedGames, stakeVals, setStake } = useRound()
  const hasGames = selectedGames.length > 0

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('players')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Stakes</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Step 3 of 3 — Set the Money</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '100%' }} />
      </div>
      <div className="stakes-list">
        {!hasGames && (
          <div className="no-games-msg">
            <CircleSlash size={32} />
            No games selected.
            <br />
            Go back and pick at least one game.
          </div>
        )}
        {hasGames &&
          GAME_KEYS.map((g) => {
            if (!selectedGames.includes(g)) return null
            const cfg = GAME_CFG[g]
            const Icon = cfg.icon
            const val = stakeVals[g] ?? 1
            return (
              <div key={g} className="stakes-row">
                <div className="stakes-left">
                  <div className="stakes-icon">
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="stakes-name">{cfg.label}</div>
                    <div className="stakes-sub">{cfg.sub}</div>
                  </div>
                </div>
                <div className="stakes-picker">
                  <button
                    type="button"
                    className="stake-btn"
                    onClick={() => setStake(g, -1)}
                  >
                    −
                  </button>
                  <div className="stake-val">${val}</div>
                  <button
                    type="button"
                    className="stake-btn"
                    onClick={() => setStake(g, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
      </div>
      <div style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={() => go('hole')}>
          <Flag size={20} /> Let&apos;s Play
        </button>
      </div>
    </div>
  )
}
