// "Can't find it? Request this course": shown in the course picker when a search finds nothing.
// One tap sends the name they typed (city and a scorecard photo are optional) as a missing-course
// suggestion. It goes through the feedback queue, so no signal just means it sends later, and
// the same phone never asks for the same course twice. "Add it yourself for now" opens the
// course editor with the name filled in, so the round isn't held up waiting on us.
import { useId, useState } from 'react';
import { Icon, useUI } from './ui.jsx';
import { getState, STORE_KEY } from '../lib/store.js';
import { shrinkImage, submitFeedback } from '../lib/feedback.js';
import { canRequestCourse, cleanCourseName, findCourseRequest, requestCourse } from '../lib/course-request.js';

// One list per dev profile, so ?profile=b acts like a second phone
const REQUESTS_KEY = `bb-course-requests:${STORE_KEY}`;
const storage = {
  getItem: k => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage full or blocked */ } },
};

function askedOn(at) {
  const d = new Date(at);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'earlier today';
  const opts = { month: 'short', day: 'numeric', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) };
  return `on ${d.toLocaleDateString(undefined, opts)}`;
}

export default function RequestCourse({ query, onAddYourself, roundId = null }) {
  const { showToast } = useUI();
  const ids = useId();
  const name = cleanCourseName(query);
  const [city, setCity] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  // What this card just sent: { status, entry }. A different search starts over
  const [done, setDone] = useState(null);
  const shown = done && done.entry.name === name ? done : null;
  const earlier = shown ? null : findCourseRequest(storage, REQUESTS_KEY, name);
  const sendable = canRequestCourse(name);

  const pickPhoto = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setImage(await shrinkImage(f)); } catch { showToast('Couldn’t read that image'); }
  };

  const send = async () => {
    if (busy || !sendable) return;
    setBusy(true);
    const me = getState().players[getState().me];
    const res = await requestCourse({
      storage, storageKey: REQUESTS_KEY, submit: submitFeedback,
      name, city, query, from: me?.name || null, image, roundId,
    });
    setDone(res);
    setBusy(false);
    setImage(null);
  };

  const addYourself = (
    <button className="full-btn outline rc-btn" onClick={() => onAddYourself({ name, city: city.trim() })}>
      <Icon name="pencil-simple" /> Add it yourself for now
    </button>
  );

  if (shown || earlier) {
    const status = shown ? shown.status : 'already';
    const text = status === 'sent' ? `We’ll add ${name} for everyone. No need to wait on us: add it yourself for now and play today.`
      : status === 'queued' ? 'No signal right now, so your request is saved on this phone and sends by itself when you’re back online.'
        : `You asked for ${earlier.name} ${askedOn(earlier.at)}, so it’s already on our list. Add it yourself for now if you’re playing it soon.`;
    return (
      <div className="block rc-card" role="status">
        <div className="rc-done-icon" aria-hidden="true"><Icon name="check-circle" fill /></div>
        <div className="rc-title">{status === 'already' ? 'Already requested' : 'Thanks, we’ll add it'}</div>
        <p className="rc-text">{text}</p>
        {addYourself}
      </div>
    );
  }

  return (
    <div className="block rc-card">
      <div className="rc-title">Can’t find it?</div>
      <p className="rc-text">{sendable ? <>No course matches “{name}”. Ask us to add it for everyone, or add it yourself in a minute from the scorecard.</> : 'Type a bit more of the course name, then ask us to add it.'}</p>
      <label className="field-label" htmlFor={`${ids}-city`}>City and state <span className="opt">optional</span></label>
      <input id={`${ids}-city`} className="text-input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Smithfield, UT" maxLength={120} autoComplete="address-level2" />
      <label className="field-label">Scorecard photo <span className="opt">optional</span></label>
      {image ? (
        <div className="fb-photo">
          <img src={image} alt="Scorecard" />
          <button className="hc-chip" onClick={() => setImage(null)}><Icon name="x" /> Remove</button>
        </div>
      ) : (
        <label className="hc-chip" htmlFor={`${ids}-photo`} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}>
          <Icon name="camera" /> Add a photo
        </label>
      )}
      <input id={`${ids}-photo`} type="file" accept="image/*" hidden onChange={pickPhoto} />
      <div className="rc-actions">
        <button className="full-btn rc-btn" disabled={busy || !sendable} onClick={send} aria-busy={busy || undefined}>
          {busy ? 'Sending…' : <><Icon name="paper-plane-tilt" fill /> Request this course</>}
        </button>
        {addYourself}
      </div>
    </div>
  );
}
