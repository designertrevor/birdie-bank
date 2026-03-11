import { ChevronRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getRounds } from '../../storage'

function formatShortDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatMoney(n) {
  if (n > 0) return `You +$${n}`
  if (n < 0) return `You −$${Math.abs(n)}`
  return 'You $0'
}

export default function HistoryScreen() {
  const { go, setViewingRoundId } = useRound()
  const rounds = getRounds()

  return (
    <div className="screen active">
      <div className="tab-hdr">
        <div className="tab-title">History</div>
      </div>

      {rounds.length === 0 ? (
        <div className="empty-state">
          No rounds yet. Tap <strong>Play</strong> to start your first round.
        </div>
      ) : (
        rounds.map((r) => {
          const you = r.settleTotals?.you ?? 0
          const resultText = formatMoney(you)
          const resultColor = you > 0 ? 'var(--green-light)' : you < 0 ? 'var(--red)' : 'var(--muted)'
          const playersText = Array.isArray(r.players)
            ? r.players.map((p) => p.name || '—').join(' · ')
            : ''
          const title = `${r.courseName || 'Casual Round'} · ${formatShortDate(r.createdAt)}`
          return (
            <div
              key={r.id}
              className="history-row"
              onClick={() => {
                setViewingRoundId(r.id)
                go('settle')
              }}
            >
              <div className="history-left">
                <div className="history-title">{title}</div>
                <div className="history-meta">
                  <span className="history-players">{playersText}</span>
                  <span className="history-result" style={{ color: resultColor }}>
                    {resultText}
                  </span>
                </div>
              </div>
              <div className="history-chevron">
                <ChevronRight size={18} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
