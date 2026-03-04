import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'

const MOCK_ROUNDS = [
  {
    title: 'Pebble Creek · Oct 12',
    meta: 'Mike · Dave · Connor · You · ',
    result: 'You +$12',
    resultClass: 'green',
  },
  {
    title: 'Riverview GC · Sep 28',
    meta: 'Mike · Dave · Connor · You · ',
    result: 'You −$31',
    resultClass: 'red',
  },
  {
    title: 'The Meadows · Sep 14',
    meta: 'Work Trip · 4 players · ',
    result: 'You +$8',
    resultClass: 'green',
  },
]

export default function HistoryScreen() {
  const { go } = useRound()

  return (
    <div className="screen active">
      <div className="topbar">
        <button type="button" className="back-btn" onClick={() => go('home')}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="topbar-title">Past Rounds</div>
        <div style={{ width: 60 }} />
      </div>
      {MOCK_ROUNDS.map((r, i) => (
        <div key={i} className="crew-card" onClick={() => go('settle')}>
          <div>
            <div className="crew-names">{r.title}</div>
            <div className="crew-meta">
              {r.meta}
              <span
                style={{
                  color: r.resultClass === 'green' ? 'var(--green-light)' : 'var(--red)',
                }}
              >
                {r.result}
              </span>
            </div>
          </div>
          <div className="crew-chevron">
            <ChevronRight size={18} />
          </div>
        </div>
      ))}
    </div>
  )
}
