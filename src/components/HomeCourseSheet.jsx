// Picking your home course for your profile: your courses and the course database, or any name
// you type. It's a label on your profile, so a course from the database isn't downloaded here.
import { useState } from 'react';
import { Icon, Sheet } from './ui.jsx';
import { useStore } from '../lib/store.js';
import { coursePickerSections } from '../lib/courses.js';
import { useCourseSearch } from '../lib/useCourseSearch.js';

function Body({ current, onPick }) {
  const state = useStore();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const { starred, recent, all } = coursePickerSections(state, needle);
  const mine = needle ? all : [...starred, ...recent];
  // Every course once: the starred and recent ones aren't listed again under All courses
  const listed = new Set(mine.map(c => c.id));
  const rest = needle ? [] : all.filter(c => !listed.has(c.id));
  const api = useCourseSearch(q);
  const savedApi = new Set([...mine, ...rest].map(c => c.apiId).filter(Boolean));
  const more = api.results.filter(r => !savedApi.has(r.apiId));
  const exact = [...mine, ...more].some(c => c.name.trim().toLowerCase() === needle);

  const row = (key, name, place, course) => {
    const on = current && (current.id ? current.id === course.id : current.name === name);
    return (
      <button key={key} className={`list-item pick ${on ? 'on' : ''}`} aria-pressed={!!on} onClick={() => onPick(course)}>
        <div className="row-main">
          <div className="li-name">{name}</div>
          {place && <div className="li-sub">{place}</div>}
        </div>
        <span className={`li-check ${on ? 'on' : ''}`} aria-hidden="true">{on && <Icon name="check" />}</span>
      </button>
    );
  };
  const local = c => row(c.id, c.name, c.city, { id: c.id, name: c.name, place: c.city || '' });
  return (
    <>
      <div style={{ padding: '4px 16px 8px' }}>
        <label className="sr-only" htmlFor="home-q">Search courses</label>
        <input id="home-q" className="search-box" type="search" placeholder="Search courses or cities" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        {mine.length > 0 && <div className="sec-label flush">{needle ? 'Your courses' : !starred.length ? 'Played lately' : recent.length ? 'Starred and played lately' : 'Starred'}</div>}
        {mine.map(local)}
        {needle && more.length > 0 && <div className="sec-label flush">More courses{api.loading ? ' · searching' : ''}</div>}
        {needle && more.map(r => row(`api:${r.apiId}`, r.name, r.city, { id: `api:${r.apiId}`, name: r.name, place: r.city || '' }))}
        {needle && !exact && q.trim().length >= 3 && row('typed', `Use “${q.trim()}”`, 'Not listed? Your profile shows it as you typed it', { id: null, name: q.trim() })}
        {rest.length > 0 && <div className="sec-label flush">All courses</div>}
        {rest.map(local)}
        {current && (
          <button className="link-btn home-clear" onClick={() => onPick(null)}>No home course</button>
        )}
      </div>
    </>
  );
}

/** The home course picker. `onPick(course | null)`. */
export function HomeCourseSheet({ open, current, onPick, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title="Home course">
      <Body current={current} onPick={onPick} />
    </Sheet>
  );
}
