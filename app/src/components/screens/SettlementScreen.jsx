import {
  ChevronLeft,
  Landmark,
  CircleDollarSign,
  Trophy,
  Users,
  ArrowRight,
  Home,
  Share2,
} from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { computeMinTransfers } from '../../logic/settlement'

const GAME_ICONS = {
  banker: Landmark,
  skins: CircleDollarSign,
  nassau: Trophy,
  wolf: Users,
}

function formatSettleAmt(n) {
  if (n > 0) return `+$${n}`
  if (n < 0) return `−$${Math.abs(n)}`
  return '$0'
}

export default function SettlementScreen() {
  const { go, players, selectedGames, totalHoles, getBankerRunningTotals } = useRound()
  const gameOrder = ['banker', 'skins', 'nassau', 'wolf']

  const bankerTotals = selectedGames.includes('banker') ? getBankerRunningTotals(totalHoles) : {}
  const hasBankerTotals = Object.keys(bankerTotals).length > 0

  const totalsByPlayer = {}
  players.forEach((p) => {
    const banker = hasBankerTotals ? (bankerTotals[p.id] ?? 0) : null
    const total = banker != null ? banker : 0
    totalsByPlayer[p.id] = {
      name: p.name || 'Player',
      total,
      banker: banker != null ? formatSettleAmt(banker) : null,
      skins: null,
      nassau: null,
      wolf: null,
    }
  })

  const payRows = hasBankerTotals
    ? computeMinTransfers(players, bankerTotals).map((t) => ({
        from: players.find((p) => p.id === t.fromId)?.name || '—',
        to: players.find((p) => p.id === t.toId)?.name || '—',
        amt: `$${t.amount}`,
      }))
    : []

  const displayOrder = [...players]
    .sort(
      (a, b) => (totalsByPlayer[b.id]?.total ?? 0) - (totalsByPlayer[a.id]?.total ?? 0)
    )
    .map((p) => p.id)

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('hole')}>
          <ChevronLeft size={16} /> Hole 18
        </button>
        <div className="topbar-title">Settle Up</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="settle-hero">
        <h1>Round Over</h1>
        <div className="settle-sub">Oct 12 · Pebble Creek · 18 holes</div>
      </div>
      <div className="settle-cards">
        {displayOrder.map((pid) => {
          const m = totalsByPlayer[pid]
          const total = m?.total ?? 0
          const isWin = total > 0
          const badge = total > 0 ? 'Up' : total < 0 ? 'Down' : 'Even'
          return (
            <div key={pid} className={`settle-card ${isWin ? 'winner' : 'loser'}`}>
              <div className="settle-name">
                {m?.name ?? 'Player'}{' '}
                <span className={`settle-badge ${isWin ? 'w' : 'l'}`}>{badge}</span>
              </div>
              <div className={`settle-total ${isWin ? 'win' : 'lose'}`}>
                {formatSettleAmt(total)}
              </div>
              <div className="settle-lines">
                {gameOrder
                  .filter((g) => selectedGames.includes(g))
                  .map((g) => {
                    const Icon = GAME_ICONS[g]
                    const v = m?.[g] ?? '$0'
                    const vc =
                      typeof v === 'string' && v.startsWith('+')
                        ? 'pos'
                        : typeof v === 'string' && v.startsWith('−')
                          ? 'neg'
                          : 'zero'
                    return (
                      <div key={g} className="settle-line">
                        <span className="settle-line-lbl">
                          <Icon size={12} />
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </span>
                        <span className={vc}>{v ?? '$0'}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="pay-block">
        <div className="pay-title">Who Pays Who</div>
        {payRows.length > 0 ? (
          payRows.map((row, i) => (
            <div key={i} className="pay-row">
              <div className="pay-from">{row.from}</div>
              <div className="pay-arrow">
                <ArrowRight size={16} />
              </div>
              <div className="pay-to">{row.to}</div>
              <div className="pay-amt">{row.amt}</div>
            </div>
          ))
        ) : (
          <div className="pay-row" style={{ color: 'var(--muted)', fontSize: 13 }}>
            No transfers (everyone even) or enter scores for all 18 holes to settle.
          </div>
        )}
      </div>
      <button className="btn-primary" onClick={() => go('home')}>
        <Home size={20} /> Back to Home
      </button>
      <div style={{ marginTop: 12 }}>
        <button className="btn-secondary" onClick={() => go('home')}>
          <Share2 size={18} /> Share Results
        </button>
      </div>
    </div>
  )
}
