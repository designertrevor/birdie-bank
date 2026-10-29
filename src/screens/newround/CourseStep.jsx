// Setup's course step (NewRound.jsx, and the Big Game's setup): the holes and where to tee off, then
// the course search, favorites, near you, recent and all courses, and the course editor over it.
import { lazy, Suspense, useRef, useState } from 'react';
import { Icon, PickMark, Segmented, useUI } from '../../components/ui.jsx';
import NearYou from '../../components/NearYou.jsx';
import RequestCourse from '../../components/RequestCourse.jsx';
import { update, useStore } from '../../lib/store.js';
import { allCourses, coursePar, coursePickerSections, courseTag, isStarred, toggleStarred } from '../../lib/courses.js';
import { getCourse, LIMITED_COPY } from '../../lib/courseApi.js';
import { useCourseSearch } from '../../lib/useCourseSearch.js';
import { useNearbyCourses } from '../../lib/useNearbyCourses.js';
import { mergeNear, milesLabel } from '../../lib/nearby.js';
import { holesInPlay } from '../../lib/round.js';
import { plainHoles, teeCount } from '../../lib/setup-screen.js';
import { HolesPicker, TeeOffPicker } from './Pickers.jsx';

// The course editor opens over setup instead of as its own screen, so the game, holes and anything
// else already picked stay put (only the top screen is mounted). Loaded with Settings on first use.
const CourseEdit = lazy(() => import('../Settings.jsx').then(m => ({ default: m.CourseEdit })));

/**
 * `onSkip`: planning ahead, the course can wait ("Course to be set" on the plan), so the way
 * forward never depends on knowing it yet.
 */
export function CourseStep({ editor, openEditor, closeEditor, courseId, setCourseId, holesCount, nine, setNine, game = null, setHolesCount = null, startHole = null, setStartHole = null, onNext, top = null, nextLabel = 'Next: Players', nextIcon = 'arrow-right', onSkip = null, skipLabel = 'Decide the course later' }) {
  const state = useStore();
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  const courses = allCourses(state);
  const needle = q.trim().toLowerCase();
  // Starred, then recently played, then the rest; a search shows only what matches
  const sections = coursePickerSections(state, needle);
  const { recentLabel, hint } = sections;
  // The picked course heads the list as "Your course", so it never hides in the sections below
  const notPicked = c => c.id !== courseId;
  const starred = sections.starred.filter(notPicked);
  // Near you sits under Favorites: saved courses show as usual rows, new ones as "add" rows.
  // A course only shows once, so near ones leave Recent and All courses.
  const near = useNearbyCourses();
  const starredIds = new Set(starred.map(c => c.id));
  const nearRows = needle || !near.pos ? [] : mergeNear(near.courses, courses, near.pos).filter(x => !x.c || (!starredIds.has(x.c.id) && notPicked(x.c)));
  const nearMiles = new Map(nearRows.filter(x => x.c).map(x => [x.c.id, x.miles]));
  const recent = sections.recent.filter(c => !nearMiles.has(c.id) && notPicked(c));
  const rest = (needle ? sections.all : sections.all.filter(c => !nearMiles.has(c.id))).filter(notPicked);
  const matches = needle ? rest : courses;
  // Picking a course clears the search, so the typed letters don't sit in a box that's gone quiet,
  // and goes back to the top: the holes and where you tee off whole, then the search and "Your course"
  // (scrolling the search to the top cut the tee-off choice in half under the title)
  const pick = id => {
    setCourseId(id);
    if (!id) return;
    setQ('');
    requestAnimationFrame(() => searchRef.current?.closest('.scroll')?.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  // Starring moves the row to another section, so a short toast says where it went
  const star = c => {
    const was = isStarred(state, c);
    update(s => { s.starredCourses = toggleStarred(s, c.id); });
    if (!needle) showToast(was ? `${c.name} taken off Favorites` : `${c.name} added to Favorites`);
  };
  const course = courses.find(c => c.id === courseId);
  const tooShort = course && holesCount === 18 && course.holes.length === 9;
  // Course database results, minus any this phone already has saved
  const { showToast } = useUI();
  const api = useCourseSearch(q);
  const saved = new Set(courses.map(c => c.apiId).filter(Boolean));
  const more = api.results.filter(r => !saved.has(r.apiId));
  const [loadingId, setLoadingId] = useState(null);
  const pickApi = async r => {
    if (loadingId) return;
    setLoadingId(r.apiId);
    try {
      const c = await getCourse(r.apiId);
      // Saved like a custom course: works offline, syncs to the account, and can be corrected
      update(s => {
        s.customCourses[c.id] = { ...c, savedAt: Date.now() };
        s.favorites = [c.id, ...s.favorites.filter(f => f !== c.id)].slice(0, 6);
      });
      pick(c.id);
    } catch (e) {
      showToast(e?.limited ? LIMITED_COPY : 'Couldn’t load that scorecard. You can add it yourself.');
    } finally {
      setLoadingId(null);
    }
  };
  const apiRow = r => (
    <button key={r.apiId} className="list-item pick" onClick={() => pickApi(r)} aria-busy={loadingId === r.apiId} aria-label={[`Add ${r.name}`, r.miles != null ? `${milesLabel(r.miles)} away` : null, r.city, r.teeCount ? teeCount(r.teeCount) : null].filter(Boolean).join(', ')}>
      <div className="row-main">
        <div className="li-name">{r.name}</div>
        <div className="li-sub">{[r.miles != null ? milesLabel(r.miles) : null, r.city, r.teeCount ? teeCount(r.teeCount) : null].filter(Boolean).join(' · ')}</div>
      </div>
      <PickMark busy={loadingId === r.apiId} />
    </button>
  );

  // The row picks the course, tap again to unselect; the star is its own button and never picks it
  const row = c => {
    const on = isStarred(state, c);
    const picked = c.id === courseId;
    return (
      <div key={c.id} className={`list-item pick course-row ${picked ? 'on' : ''}`} onClick={() => pick(picked ? null : c.id)}>
        <button className="course-pick" aria-pressed={picked}
          aria-label={[c.name, nearMiles.has(c.id) ? `${milesLabel(nearMiles.get(c.id))} away` : null, c.city, `${c.holes.length} holes`, `par ${coursePar(c)}`, teeCount(c.tees?.length || 0), courseTag(c)?.text].filter(Boolean).join(', ')}>
          <div className="li-name">{c.name}</div>
          <div className="li-sub">{[nearMiles.has(c.id) ? milesLabel(nearMiles.get(c.id)) : null, c.city, `${c.holes.length} holes`, `Par ${coursePar(c)}`, teeCount(c.tees?.length || 0)].filter(Boolean).join(' · ')}</div>
          {courseTag(c) && <div className={`warn-tag ${courseTag(c).soft ? 'soft' : ''}`}><Icon name={courseTag(c).soft ? 'database' : 'warning'} fill /> {courseTag(c).text}</div>}
        </button>
        <button className={`course-star ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`Favorite ${c.name}`} onClick={e => { e.stopPropagation(); star(c); }}>
          <Icon name="star" fill={on} />
        </button>
        <PickMark on={picked} add={false} />
      </div>
    );
  };

  return (
    <>
      <div className="scroll">
        {top}
        {/* How much of the course: up top, so a back-nine round is set before anything else (Trevor's round, 2026-10-14) */}
        {setHolesCount && <HolesPicker game={game} holesCount={holesCount} setHolesCount={n => { setHolesCount(n); setStartHole?.(null); }} />}
        {holesCount === 9 && (!course || course.holes.length === 18) && (
          <div className="block">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Which nine?</div>
            <Segmented label="Which nine" value={nine} onChange={v => { setNine(v); setStartHole?.(null); }} options={[{ value: 'front', label: 'Front 9' }, { value: 'back', label: 'Back 9' }]} />
          </div>
        )}
        {/* Where the group tees off, right under the holes: 1, 10, or any hole for a shotgun start (Trevor 2026-10-14) */}
        {/* Before a course is picked the holes are just numbers, and the start stays put when one is */}
        {setStartHole && <TeeOffPicker holes={course ? holesInPlay(course, holesCount, nine) : plainHoles(holesCount, nine)} canTen={holesCount === 18} startHole={startHole} setStartHole={setStartHole} />}
        {tooShort && <p className="hint-card"><Icon name="info" fill /> {course.name} has 9 holes, so you’ll play it twice for 18.</p>}
        <div style={{ padding: '4px 16px 8px' }}>
          <label className="sr-only" htmlFor="course-q">Search courses</label>
          <input id="course-q" ref={searchRef} className="search-box" type="search" placeholder="Search courses or cities" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {course && <><div className="sec-label">Your course</div><div style={{ padding: '0 16px' }}>{row(course)}</div></>}
        {starred.length > 0 && <><div className="sec-label">Favorites</div><div style={{ padding: '0 16px' }}>{starred.map(row)}</div></>}
        {hint && <p className="course-star-hint"><Icon name="star" /> Tap the star to keep a course at the top</p>}
        {!needle && <NearYou near={near} count={nearRows.length}>{nearRows.map(x => (x.c ? row(x.c) : apiRow({ ...x.r, miles: x.miles })))}</NearYou>}
        {recent.length > 0 && <><div className="sec-label">{recentLabel}</div><div style={{ padding: '0 16px' }}>{recent.map(row)}</div></>}
        {rest.length > 0 && <><div className="sec-label">{needle ? `${rest.length} result${rest.length === 1 ? '' : 's'}` : 'All courses'}</div><div style={{ padding: '0 16px' }}>{rest.map(row)}</div></>}
        {needle && more.length > 0 && <><div className="sec-label">More courses{api.loading ? ' · searching' : ''}</div><div style={{ padding: '0 16px' }}>{more.map(apiRow)}</div></>}
        {/* Over the course search rate limit (src/lib/rate-limit.js): a calm wait, not "no such course" */}
        {needle && api.limited && <p className="hint-card"><Icon name="info" fill /> {LIMITED_COPY}</p>}
        {matches.length === 0 && more.length === 0 && !api.loading && !api.limited && <RequestCourse query={q} onAddYourself={openEditor} />}
        <button className="add-row" aria-label="Add a course" onClick={() => openEditor({})}><span className="add-ci" aria-hidden="true"><Icon name="plus" /></span><span className="add-lbl">Add a course</span></button>
      </div>
      <div className="cta-wrap">
        {course
          ? <button className="full-btn" onClick={onNext}>{nextLabel} <Icon name={nextIcon} /></button>
          // Waiting on a course, like the game step's Pick a game: the search is right there above
          : <button className="full-btn" disabled>Pick a course</button>}
        {!course && onSkip && <button className="text-link centered" onClick={onSkip}><Icon name="calendar-check" /> {skipLabel}</button>}
      </div>
      {editor && (
        <Suspense fallback={<div className="screen active" aria-busy="true" />}>
          <CourseEdit prefill={editor} onDone={id => {
            closeEditor();
            // A saved course is picked for this round straight away
            if (id) { setCourseId(id); setQ(''); }
          }} />
        </Suspense>
      )}
    </>
  );
}
