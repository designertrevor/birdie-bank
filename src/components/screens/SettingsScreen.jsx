import { useMemo, useState } from 'react'
import { ChevronRight, PlusCircle } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { DEFAULT_STAKES, GAME_CFG, GAME_KEYS, STAKE_STEPS } from '../../constants'
import { getCourses, getCrews, getDefaultStakes, getPlayers, setDefaultStakes } from '../../storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function stepStake(current, delta) {
  const i = STAKE_STEPS.indexOf(current)
  const next = Math.max(0, Math.min(STAKE_STEPS.length - 1, (i >= 0 ? i : 0) + delta))
  return STAKE_STEPS[next]
}

export default function SettingsScreen() {
  const { go, setSelectedCrewId, setNavReturnTo, setEditPlayerId, setEditCourseId } = useRound()

  const players = getPlayers()
  const crews = getCrews()
  const courses = getCourses().filter((c) => c.starred)

  const initialDefaults = useMemo(() => {
    const stored = getDefaultStakes()
    return stored && typeof stored === 'object' ? { ...DEFAULT_STAKES, ...stored } : DEFAULT_STAKES
  }, [])
  const [defaults, setDefaults] = useState(initialDefaults)

  const changeDefault = (game, delta) => {
    const nextVal = stepStake(defaults[game] ?? DEFAULT_STAKES[game] ?? 1, delta)
    const next = { ...defaults, [game]: nextVal }
    setDefaults(next)
    setDefaultStakes(next)
  }

  return (
    <div className="screen active">
      <div className="tab-hdr">
        <div className="tab-title">Settings</div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="section-label">Players</div>
        <div className="list">
          {players.length === 0 && (
            <div className="empty-state">
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>Add your first players</div>
              <div style={{ marginTop: 6 }}>
                Create at least two players to start a round.
              </div>
            </div>
          )}
          {players.map((p) => (
            <Button
              key={p.id}
              type="button"
              className="list-row"
              onClick={() => {
                setNavReturnTo('settings')
                setEditPlayerId(p.id)
                go('playerEdit')
              }}
            >
              <div className="list-left">
                <span className="list-title">{p.name || 'Player'}</span>
                <span className="list-sub">HCP {p.hcp ?? 18}</span>
              </div>
              <div className="list-right">
                <ChevronRight size={18} />
              </div>
            </Button>
          ))}
          <Button
            type="button"
            className="list-row"
            onClick={() => {
              setNavReturnTo('settings')
              setEditPlayerId('new')
              go('playerEdit')
            }}
          >
            <div className="list-left">
              <PlusCircle size={16} />
              <span className="list-title">Add Player</span>
            </div>
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-label">Crews</div>
        <div className="list">
          {crews.length === 0 && (
            <div className="empty-state">
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No crews yet</div>
              <div style={{ marginTop: 6 }}>
                Save your regular group to set up rounds faster.
              </div>
            </div>
          )}
          {crews.map((c) => (
            <Button
              key={c.id}
              type="button"
              className="list-row"
              onClick={() => {
                setSelectedCrewId(c.id)
                setNavReturnTo('settings')
                go('crewDetail')
              }}
            >
              <div className="list-left">
                <span className="list-title">{c.name}</span>
                <span className="list-sub">
                  {(c.players || []).map((p) => p.name || '—').slice(0, 4).join(' · ') ||
                    `${(c.players || []).length} players`}
                </span>
              </div>
              <div className="list-right">
                <ChevronRight size={18} />
              </div>
            </Button>
          ))}
          <Button
            type="button"
            className="list-row"
            onClick={() => {
              setNavReturnTo('settings')
              go('addCrew')
            }}
          >
            <div className="list-left">
              <PlusCircle size={16} />
              <span className="list-title">New Crew</span>
            </div>
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-label">Courses</div>
        <div className="list">
          {courses.length === 0 && (
            <div className="empty-state">
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>No favorite courses</div>
              <div style={{ marginTop: 6 }}>
                Add a course you play often for one-tap setup.
              </div>
            </div>
          )}
          {courses.map((c) => (
            <Button
              key={c.id}
              type="button"
              className="list-row"
              onClick={() => {
                setNavReturnTo('settings')
                setEditCourseId(c.id)
                go('courseEdit')
              }}
            >
              <div className="list-left">
                <span className="list-title">{c.name}</span>
              </div>
              <div className="list-right">
                <ChevronRight size={18} />
              </div>
            </Button>
          ))}
          <Button
            type="button"
            className="list-row"
            onClick={() => {
              setNavReturnTo('settings')
              setEditCourseId('new')
              go('courseEdit')
            }}
          >
            <div className="list-left">
              <PlusCircle size={16} />
              <span className="list-title">Add Favorite Course</span>
            </div>
          </Button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="section-label">Default Stakes</div>
        <div className="stakes-list">
          {GAME_KEYS.map((g) => {
            const cfg = GAME_CFG[g]
            const val = defaults[g] ?? DEFAULT_STAKES[g] ?? 1
            return (
              <Card key={g} className="stakes-row">
                <div className="stakes-left">
                  <div>
                    <div className="stakes-name">{cfg.label}</div>
                  </div>
                </div>
                <div className="stakes-picker">
                  <Button type="button" className="stake-btn" onClick={() => changeDefault(g, -1)}>
                    −
                  </Button>
                  <div className="stake-val">${val}</div>
                  <Button type="button" className="stake-btn" onClick={() => changeDefault(g, 1)}>
                    +
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

