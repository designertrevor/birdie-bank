import { ChevronLeft, PlusCircle, Check, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useRound } from '../../context/RoundContext'
import { getCrews, getPlayers } from '../../storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

function nameKey(name) {
  return (name || '').trim().toLowerCase()
}

export default function PlayPlayersScreen() {
  const {
    go,
    players,
    selectedGames,
    loadCrew,
    addPlayerWithProfile,
    removePlayer,
    setNavReturnTo,
    setEditPlayerId,
  } = useRound()

  const crews = getCrews()
  const allPlayers = getPlayers()

  const selectedByName = useMemo(() => {
    const set = new Set()
    for (const p of players) set.add(nameKey(p.name))
    return set
  }, [players])

  const minTwo = players.length >= 2
  const wolfNeedsFour = selectedGames.includes('wolf') && players.length !== 4
  const nassauBadCount =
    selectedGames.includes('nassau') && (players.length < 2 || players.length > 4)
  const note = !minTwo
    ? 'Minimum 2 players to proceed.'
    : wolfNeedsFour
      ? 'Wolf requires exactly 4 players.'
      : nassauBadCount
        ? 'Nassau requires 2–4 players.'
        : ''

  const togglePlayer = (prof) => {
    const key = nameKey(prof.name)
    if (!key) return
    const existing = players.find((p) => nameKey(p.name) === key)
    if (existing) removePlayer(existing.id)
    else addPlayerWithProfile(prof.name, prof.hcp ?? 18)
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <Button type="button" className="back-btn" onClick={() => go('playCourse')}>
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="topbar-title">Choose Players</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="step-label">Step 2 of 3</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '66%' }} />
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="section-label">My Crews</div>
        <div className="list">
          {crews.map((c) => (
            <Card
              key={c.id}
              className="list-row"
              onClick={() => {
                loadCrew(c.players)
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
            </Card>
          ))}
          <Button
            type="button"
            className="list-row"
            onClick={() => {
              setNavReturnTo('playPlayers')
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
        <div className="section-label">All Players</div>
        <div className="list">
          {allPlayers.map((p) => {
            const checked = selectedByName.has(nameKey(p.name))
            return (
              <Button
                key={p.id}
                type="button"
                className={`list-row ${checked ? 'checked' : ''}`}
                onClick={() => togglePlayer(p)}
              >
                <div className="list-left">
                  <span className="list-title">{p.name || 'Player'}</span>
                  <span className="list-sub">HCP {p.hcp ?? 18}</span>
                </div>
                <div className="list-right">
                  {checked && <Check size={18} />}
                </div>
              </Button>
            )
          })}
          <Button
            type="button"
            className="list-row"
            onClick={() => {
              setNavReturnTo('playPlayers')
              setEditPlayerId('new')
              go('playerEdit')
            }}
          >
            <div className="list-left">
              <PlusCircle size={16} />
              <span className="list-title">Add new player</span>
            </div>
          </Button>
        </div>
      </div>

      <div className="players-note">{note}</div>

      <div style={{ marginTop: 16 }}>
        <Button
          type="button"
          className="btn-primary"
          onClick={() => go('playGames')}
          disabled={!minTwo}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

