import {
  Landmark,
  CircleDollarSign,
  Trophy,
  Users,
  ArrowRight,
  Share2,
} from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { computeMinTransfers } from '../../logic/settlement'
import { getRoundById, saveFinishedRound } from '../../storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
  const {
    go,
    resetRound,
    players,
    selectedGames,
    totalHoles,
    courseName,
    stakeVals,
    getBankerRunningTotals,
    viewingRoundId,
    setViewingRoundId,
  } = useRound()
  const gameOrder = ['banker', 'skins', 'nassau', 'wolf']

  const viewing = viewingRoundId ? getRoundById(viewingRoundId) : null
  const viewingMode = !!viewing

  const bankerTotals = viewingMode
    ? viewing.bankerTotals || {}
    : selectedGames.includes('banker')
      ? getBankerRunningTotals(totalHoles)
      : {}
  const hasBankerTotals = Object.keys(bankerTotals).length > 0

  const totalsByPlayer = {}
  const settlePlayers = viewingMode
    ? (viewing.players || []).map((p, i) => ({
        id: typeof p.id === 'number' ? p.id : i + 1,
        name: p.name,
        hcp: p.hcp ?? 18,
      }))
    : players

  settlePlayers.forEach((p) => {
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
    ? computeMinTransfers(settlePlayers, bankerTotals).map((t) => ({
        from: settlePlayers.find((p) => p.id === t.fromId)?.name || '—',
        to: settlePlayers.find((p) => p.id === t.toId)?.name || '—',
        amt: `$${t.amount}`,
      }))
    : []

  const displayOrder = [...settlePlayers]
    .sort(
      (a, b) => (totalsByPlayer[b.id]?.total ?? 0) - (totalsByPlayer[a.id]?.total ?? 0)
    )
    .map((p) => p.id)

  const subtitle = viewingMode
    ? `${viewing.courseName || 'Casual Round'} · ${viewing.totalHoles || 18} holes`
    : `${courseName || 'Casual Round'} · ${totalHoles} holes`

  const shareText = [
    `Birdie Bank — ${subtitle}`,
    '',
    ...displayOrder.map((pid) => {
      const m = totalsByPlayer[pid]
      const total = m?.total ?? 0
      return `${m?.name ?? 'Player'}  ${formatSettleAmt(total)}`
    }),
    '',
    'Who pays who:',
    ...(payRows.length
      ? payRows.map((r) => `${r.from} → ${r.to}  ${r.amt}`)
      : ['(no transfers)']),
  ].join('\n')

  const canShare = typeof navigator !== 'undefined' && (!!navigator.share || !!navigator.clipboard)

  const handleDone = () => {
    if (viewingMode) {
      setViewingRoundId(null)
      go('history')
      return
    }

    const youPlayer =
      settlePlayers.find((p) => (p.name || '').trim().toLowerCase() === 'you') ?? settlePlayers[0]
    const settleTotals = {
      you: youPlayer ? totalsByPlayer[youPlayer.id]?.total ?? 0 : 0,
    }

    saveFinishedRound({
      id: String(Date.now()),
      createdAt: Date.now(),
      courseName: courseName || '',
      totalHoles,
      players: settlePlayers.map((p) => ({ id: p.id, name: p.name || '', hcp: p.hcp ?? 18 })),
      selectedGames,
      stakeVals,
      bankerTotals,
      settleTotals,
    })

    resetRound()
    go('history')
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <div className="topbar-title">Settle Up</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="settle-hero">
        <h1>Settle Up</h1>
        <div className="settle-sub">{subtitle}</div>
      </div>
      <div className="settle-cards">
        {displayOrder.map((pid) => {
          const m = totalsByPlayer[pid]
          const total = m?.total ?? 0
          const isWin = total > 0
          const badge = total > 0 ? 'Up' : total < 0 ? 'Down' : 'Even'
          return (
            <Card key={pid} className={`settle-card ${isWin ? 'winner' : 'loser'}`}>
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
            </Card>
          )
        })}
      </div>
      <Card className="pay-block">
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
      </Card>
      {!viewingMode && (
        <div style={{ marginBottom: 12 }}>
          <Button
            className="btn-secondary"
            disabled={!canShare}
            onClick={async () => {
              try {
                if (navigator.share) {
                  await navigator.share({ title: 'Birdie Bank', text: shareText })
                  return
                }
                if (navigator.clipboard) {
                  await navigator.clipboard.writeText(shareText)
                }
              } catch {
                // no-op
              }
            }}
          >
            <Share2 size={18} /> Share Results
          </Button>
        </div>
      )}
      <Button className="btn-primary" onClick={handleDone}>
        Done
      </Button>
    </div>
  )
}
