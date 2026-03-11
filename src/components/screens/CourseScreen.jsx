import { ChevronLeft, ArrowRight } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function CourseScreen() {
  const {
    go,
    players,
    selectedGames,
    courseName,
    totalHoles,
    setCourse,
    bankerStartIndex,
    setBankerStartIndex,
  } = useRound()

  return (
    <div className="screen active">
      <div className="topbar">
        <Button type="button" className="back-btn" onClick={() => go('players')}>
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="topbar-title">Course</div>
        <div style={{ width: 60 }} />
      </div>
      <div className="step-label">Where are you playing?</div>
      <div className="prog-bar">
        <div className="prog-fill" style={{ width: '100%' }} />
      </div>
      <div className="course-row">
        <label className="banker-pick-label">Course name (optional)</label>
        <Input
          className="course-name-input"
          type="text"
          placeholder="e.g. Pebble Beach"
          value={courseName}
          onChange={(e) => setCourse(e.target.value, totalHoles)}
        />
        <label className="banker-pick-label">Holes</label>
        <div className="course-holes-toggle">
          <Button
            type="button"
            className={totalHoles === 9 ? 'course-holes-btn on' : 'course-holes-btn'}
            onClick={() => setCourse(courseName, 9)}
          >
            9 holes
          </Button>
          <Button
            type="button"
            className={totalHoles === 18 ? 'course-holes-btn on' : 'course-holes-btn'}
            onClick={() => setCourse(courseName, 18)}
          >
            18 holes
          </Button>
        </div>
      </div>
      {selectedGames.includes('banker') && players.length >= 2 && (
        <Card className="banker-pick-row">
          <label className="banker-pick-label">Banker on hole 1</label>
          <select
            className="banker-pick-select"
            value={bankerStartIndex}
            onChange={(e) => setBankerStartIndex(Number(e.target.value))}
          >
            {players.map((p, i) => (
              <option key={p.id} value={i}>{p.name || `Player ${i + 1}`}</option>
            ))}
          </select>
        </Card>
      )}
      <div style={{ marginTop: 24 }}>
        <Button className="btn-primary" onClick={() => go('hole')}>
          Start round <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  )
}
