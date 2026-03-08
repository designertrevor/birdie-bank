import { ChevronLeft, Landmark } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getBankerIndexForHole } from '../../logic/banker'

const PAR = 4

function scoreClass(score) {
  const d = score - PAR
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0) return 'par'
  if (d === 1) return 'bogey'
  return 'double'
}

function formatTallyAmount(n) {
  if (n > 0) return `+$${n}`
  if (n < 0) return `−$${Math.abs(n)}`
  return '$0'
}

export default function HoleScreen() {
  const {
    go,
    players,
    selectedGames,
    currentHole,
    setCurrentHole,
    courseName,
    totalHoles,
    stakeVals,
    bankerStartIndex,
    playerDoubled,
    bankerDoubledBack,
    getScore,
    setScore,
    getBet,
    setBet,
    getBankerRunningTotals,
    togglePlayerDoubled,
    toggleBankerDoubledBack,
    wolfPartnerThisHole,
    setWolfPartner,
    initial,
  } = useRound()

  const bankerMin = stakeVals.banker ?? 2
  const maxBet = bankerMin * 4
  const bankerIndex = getBankerIndexForHole(currentHole, players.length, bankerStartIndex)
  const bankerPlayer = players[bankerIndex]
  const isBankerDoubledThisHole = !!bankerDoubledBack[currentHole]
  const wolfIndex = (currentHole - 1) % players.length
  const wolfPlayer = players[wolfIndex]
  const otherPlayers = players.filter((_, i) => i !== wolfIndex)

  const bankerTotals = getBankerRunningTotals(currentHole)
  const tallyRows =
    selectedGames.includes('banker') && Object.keys(bankerTotals).length > 0
      ? players.map((p) => {
          const n = bankerTotals[p.id] ?? 0
          return {
            name: p.name || 'Player',
            amt: formatTallyAmount(n),
            cls: n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero',
          }
        })
      : players.map((p) => ({
          name: p.name || 'Player',
          amt: '—',
          cls: 'zero',
        }))

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('course')}>
          <ChevronLeft size={16} /> Setup
        </button>
        <div className="topbar-title">Scoring</div>
        <button type="button" className="topbar-action" onClick={() => go('settle')}>
          Finish
        </button>
      </div>
      <div className="hole-hdr">
        <div>
          <div className="hole-num">{currentHole}</div>
          <div className="hole-num-label">Hole</div>
        </div>
        <div className="hole-meta">
          <div className="hole-par">
            {courseName ? `${courseName} · ` : ''}Par 4 · {totalHoles} holes
          </div>
          <div className="game-chips">
            {['banker', 'skins', 'nassau', 'wolf'].map((g) => (
              <div key={g} className={`chip ${selectedGames.includes(g) ? 'on' : ''}`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedGames.includes('wolf') && players.length === 4 && (
        <div className="wolf-block">
          <div className="wolf-block-hdr">
            <div className="wolf-block-title">
              Wolf this hole: <span>{wolfPlayer?.name || 'Wolf'}</span>
            </div>
            <div className="wolf-block-sub">Pick a partner after each tee shot</div>
          </div>
          <div className="wolf-opts">
            {otherPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`wolf-opt ${wolfPartnerThisHole === p.id ? 'selected' : ''}`}
                onClick={() => setWolfPartner(p.id)}
              >
                {p.name || 'Player'}
              </button>
            ))}
            <button
              type="button"
              className={`wolf-opt lone ${wolfPartnerThisHole === 'lone' ? 'selected' : ''}`}
              onClick={() => setWolfPartner('lone')}
            >
              Lone Wolf (×2)
            </button>
          </div>
        </div>
      )}

      {selectedGames.includes('banker') && (
        <div className="banker-notice">
          <Landmark size={14} />
          <div className="banker-notice-txt">
            Banker: <strong>{bankerPlayer?.name || '—'}</strong> — tees off last · max bet{' '}
            <strong>${maxBet}</strong>
            {bankerPlayer && (
              <button
                type="button"
                className={`banker-double-back-btn ${isBankerDoubledThisHole ? 'on' : ''}`}
                onClick={() => toggleBankerDoubledBack()}
              >
                {isBankerDoubledThisHole ? '2× Back' : 'Double back'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="score-cards">
        {players.map((p, idx) => {
          const isBanker = selectedGames.includes('banker') && idx === bankerIndex
          const score = getScore(p.id)
          const bet = getBet(p.id)
          const cls = scoreClass(score)
          return (
            <div key={p.id} className={`score-card ${isBanker ? 'is-banker' : ''}`}>
              <div className="sc-left">
                <div className="sc-av">{initial(p.name)}</div>
                <div className="sc-info">
                  <div className="sc-name">
                    {p.name || 'Player'}
                    {isBanker && <span className="sc-banker-tag">Banker</span>}
                  </div>
                  <div className="sc-sub">
                    HCP {p.hcp}
                    {!isBanker && selectedGames.includes('banker') && (
                      <>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <div className="bet-picker">
                          <button
                            type="button"
                            className="bbet-btn"
                            onClick={() => setBet(p.id, -1)}
                          >
                            −
                          </button>
                          <span className="bbet-val">${bet}</span>
                          <button
                            type="button"
                            className="bbet-btn"
                            onClick={() => setBet(p.id, 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`sc-double-btn ${playerDoubled[`${currentHole}-${p.id}`] ? 'on' : ''}`}
                          onClick={() => togglePlayerDoubled(p.id)}
                        >
                          {playerDoubled[`${currentHole}-${p.id}`] ? '2×' : 'Double'}
                        </button>
                        <span style={{ color: 'var(--muted)' }}>vs banker</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="sc-picker">
                <button
                  type="button"
                  className="sc-btn"
                  onClick={() => setScore(p.id, -1)}
                >
                  −
                </button>
                <div className={`sc-score ${cls}`}>{score}</div>
                <button
                  type="button"
                  className="sc-btn"
                  onClick={() => setScore(p.id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selectedGames.includes('skins') && (
        <div className="skins-block">
          <div className="skins-hdr">Skin Pot</div>
          <div className="skins-row">
            <div className="skin-chip won">H1 · Mike $3</div>
            <div className="skin-chip carry">H2 · Carry $6</div>
            <div className="skin-chip">H3 · ?</div>
          </div>
        </div>
      )}

      <div className="tally">
        <div className="tally-hdr">Running Total</div>
        {tallyRows.map((t) => (
          <div key={t.name} className="tally-row">
            <span className="tally-name">{t.name}</span>
            <span className={`tally-amt ${t.cls}`}>{t.amt}</span>
          </div>
        ))}
      </div>

      <div className="hole-dots">
        {totalHoles === 9 ? (
          <div className="hole-dots-row">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                type="button"
                className={`h-dot ${h < currentHole ? 'done' : h === currentHole ? 'cur' : ''}`}
                onClick={() => setCurrentHole(h)}
              >
                {h}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="hole-dots-row">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`h-dot ${h < currentHole ? 'done' : h === currentHole ? 'cur' : ''}`}
                  onClick={() => setCurrentHole(h)}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="hole-dots-row">
              {Array.from({ length: 9 }, (_, i) => i + 10).map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`h-dot ${h < currentHole ? 'done' : h === currentHole ? 'cur' : ''}`}
                  onClick={() => setCurrentHole(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="hole-nav">
        <button
          type="button"
          className="hnav-btn"
          onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
          disabled={currentHole <= 1}
        >
          <ChevronLeft
            size={16}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
          />{' '}
          H{Math.max(1, currentHole - 1)}
        </button>
        <button
          type="button"
          className="hnav-btn next"
          onClick={() => setCurrentHole(Math.min(totalHoles, currentHole + 1))}
        >
          Save & Next Hole
        </button>
      </div>
    </div>
  )
}
