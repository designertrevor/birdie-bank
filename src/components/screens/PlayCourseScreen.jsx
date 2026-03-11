import { useMemo, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { getCourses, getRounds } from '../../storage'

function uniqByName(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    const key = (it?.name || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

export default function PlayCourseScreen() {
  const { go, setCourse } = useRound()
  const [q, setQ] = useState('')

  const favorites = getCourses().filter((c) => c.starred).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const recentRounds = getRounds()
    .filter((r) => (r.courseName || '').trim())
    .slice(0, 6)
    .map((r) => ({ name: r.courseName, sub: new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }))

  const recent = uniqByName(recentRounds)

  const filteredFavorites = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return favorites
    return favorites.filter((c) => (c.name || '').toLowerCase().includes(s))
  }, [favorites, q])

  const filteredRecent = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return recent
    return recent.filter((c) => (c.name || '').toLowerCase().includes(s))
  }, [recent, q])

  const selectCourse = (name) => {
    setCourse(name || '', 18)
    go('playPlayers')
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <div className="topbar-title">Choose Course</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="step-label">Step 1 of 3</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '33%' }} />
      </div>

      <div className="search-row">
        <Search size={18} />
        <input
          className="search-input"
          placeholder="Search courses"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filteredFavorites.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="section-label">Favorites</div>
          <div className="list">
            {filteredFavorites.map((c) => (
              <button key={c.id} type="button" className="list-row" onClick={() => selectCourse(c.name)}>
                <div className="list-left">
                  <Star size={16} />
                  <span className="list-title">{c.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredRecent.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="section-label">Recent</div>
          <div className="list">
            {filteredRecent.map((c) => (
              <button key={`${c.name}-${c.sub}`} type="button" className="list-row" onClick={() => selectCourse(c.name)}>
                <div className="list-left">
                  <span className="list-title">{c.name}</span>
                </div>
                <div className="list-right">{c.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="btn-secondary" onClick={() => selectCourse('')}>
          Skip — casual round
        </button>
      </div>
    </div>
  )
}

