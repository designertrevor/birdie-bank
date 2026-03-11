import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Save } from 'lucide-react'
import { useRound } from '../../context/RoundContext'
import { addCourse, getCourses, updateCourse } from '../../storage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function CourseEditScreen() {
  const { go, editCourseId, setEditCourseId, navReturnTo, setNavReturnTo } = useRound()
  const courses = getCourses()

  const existing = useMemo(() => {
    if (editCourseId == null || editCourseId === 'new') return null
    return courses.find((c) => c.id === editCourseId) ?? null
  }, [courses, editCourseId])

  const [name, setName] = useState(existing?.name ?? '')
  const [starred, setStarred] = useState(existing?.starred ?? true)

  useEffect(() => {
    setName(existing?.name ?? '')
    setStarred(existing?.starred ?? true)
  }, [existing])

  const backTo = navReturnTo || 'settings'

  const save = () => {
    const n = (name || '').trim()
    if (!n) return
    if (editCourseId === 'new' || editCourseId == null) addCourse(n, starred)
    else updateCourse(editCourseId, { name: n, starred })

    setEditCourseId(null)
    setNavReturnTo(null)
    go(backTo)
  }

  return (
    <div className="screen active">
      <div className="topbar">
        <Button
          type="button"
          className="back-btn"
          onClick={() => {
            setEditCourseId(null)
            go(backTo)
          }}
        >
          <ChevronLeft size={16} /> Back
        </Button>
        <div className="topbar-title">{existing ? 'Edit Course' : 'Add Course'}</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="form">
        <label className="banker-pick-label">Course name</label>
        <Input
          className="course-name-input"
          value={name}
          placeholder="Pebble Creek"
          onChange={(e) => setName(e.target.value)}
        />

        <label className="banker-pick-label">Favorite</label>
        <div className="course-holes-toggle">
          <Button
            type="button"
            className={starred ? 'course-holes-btn on' : 'course-holes-btn'}
            onClick={() => setStarred(true)}
          >
            ★ Starred
          </Button>
          <Button
            type="button"
            className={!starred ? 'course-holes-btn on' : 'course-holes-btn'}
            onClick={() => setStarred(false)}
          >
            Not starred
          </Button>
        </div>
      </div>

      <Button type="button" className="btn-primary" onClick={save}>
        <Save size={20} /> Save
      </Button>
    </div>
  )
}

