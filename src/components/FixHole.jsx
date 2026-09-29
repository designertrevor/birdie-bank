// Fix a hole (par and stroke index) or a tee (rating and slope) for this round, from the round
// menu or the scorecard's "Wrong par or HCP?" link. The fix applies at once, the money recounts,
// and by default a note goes to Birdie Bank so the course gets corrected for the next group. A hole
// fix is also saved to this phone's own copy of the course (only this phone: the one that made it),
// so the next round there starts right.
import { useMemo, useState } from 'react';
import { Icon, Sheet, Toggle, useUI } from './ui.jsx';
import { update, useStore } from '../lib/store.js';
import { courseWithHoleFix, findCourse } from '../lib/courses.js';
import { fixHole, fixTee, hdcpSwapWith, playedTwice } from '../lib/round.js';
import { holeFixFeedback, moneyLine, playsLine, roundTees, strokeImpact, teeFixFeedback, teesInUse } from '../lib/hole-fix.js';
import { submitFeedback } from '../lib/feedback.js';
import { buzz } from '../lib/delight.js';

/** Send a fix to the feedback table without holding up the sheet (it queues when offline). */
function sendFix(msg) {
  submitFeedback(msg).catch(() => { /* queued on the phone, goes out later */ });
}

function Stepper({ id, label, value, min, max, onChange, disabled = false }) {
  return (
    <div className="score-ctrl" role="group" aria-labelledby={id}>
      <button type="button" className="sc-btn" aria-label={`${label} one less`} disabled={disabled || value == null || value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" /></button>
      <span className="sc-num" aria-live="polite" aria-atomic="true"><span className="sr-only">{label} </span>{value ?? '–'}</span>
      <button type="button" className="sc-btn" aria-label={`${label} one more`} disabled={disabled || (value != null && value >= max)} onClick={() => onChange(value == null ? min : value + 1)}><Icon name="plus" /></button>
    </div>
  );
}

function SendSwitch({ on, onChange }) {
  return (
    <div className="toggle-row">
      <div>
        <div className="toggle-lbl" id="fix-send">Send this fix to Birdie Bank</div>
        <div className="toggle-sub" id="fix-send-sub">So the course is right for the next group</div>
      </div>
      <Toggle on={on} onChange={onChange} label="Send this fix to Birdie Bank" describedBy="fix-send-sub" />
    </div>
  );
}

/** The fix sheet for one hole. Mounted only while open so it starts fresh each time. */
export function FixHoleSheet({ round, holeNo, me = null, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const hole = round.holes.find(h => h.no === holeNo) || round.holes[0];
  const [par, setPar] = useState(hole.par);
  const [hdcp, setHdcp] = useState(hole.hdcp ?? null);
  const [send, setSend] = useState(true);
  const twice = playedTwice(round);
  // A 9-hole round numbers its stroke indexes 1 to 9, unless its card uses 18-hole numbers (a nine of an 18)
  const maxHdcp = round.holes.length === 9 && round.holes.every(h => h.hdcp == null || h.hdcp <= 9) ? 9 : 18;
  const after = useMemo(() => fixHole(round, hole.no, { par, hdcp }), [round, hole.no, par, hdcp]);
  const changed = par !== hole.par || (!twice && hdcp !== (hole.hdcp ?? null));
  const swap = !twice && hdcp != null && hdcp !== hole.hdcp ? hdcpSwapWith(round, hole.no, hdcp) : null;
  const lines = round.useHandicaps ? strokeImpact(round, after, hole.no) : ['Handicaps are off for this round, so no one’s strokes change.'];
  const money = changed ? moneyLine(round, after) : null;
  const tees = teesInUse(round);

  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      if (r) s.rounds[round.id] = fixHole(r, hole.no, { par, hdcp }, { by: me });
      // And for next time: this phone's copy of the course (a built-in one becomes your corrected copy)
      const c = findCourse(s, round.course.id);
      const saved = c && courseWithHoleFix(c, hole.courseIdx, { par, hdcp: twice ? null : hdcp }, { builtIn: !s.customCourses?.[c.id] });
      if (saved) {
        s.customCourses = { ...(s.customCourses || {}), [saved.id]: saved.course };
        if (saved.builtInId) s.favorites = (s.favorites || []).map(f => (f === saved.builtInId ? saved.id : f));
      }
    });
    if (send) sendFix(holeFixFeedback(round, course, hole, { par: hole.par, hdcp: hole.hdcp ?? null }, { par, hdcp: twice ? hole.hdcp ?? null : hdcp }));
    onClose();
    showToast(send ? 'Fixed. Thanks, it’s on its way to us.' : 'Fixed for this round');
    buzz(20);
  };

  return (
    <Sheet open onClose={onClose} title={`Fix hole ${hole.no}`}>
      <p className="sheet-text">{round.course.name}{tees ? ` · ${tees} tees` : ''}</p>
      <div className="toggle-row">
        <div className="toggle-lbl" id="fh-par">Par</div>
        <Stepper id="fh-par" label="Par" value={par} min={3} max={6} onChange={setPar} />
      </div>
      <div className="toggle-row">
        <div>
          <div className="toggle-lbl" id="fh-hdcp">Stroke index (HCP)</div>
          {!twice && <div className="toggle-sub">1 is the hardest hole</div>}
        </div>
        <Stepper id="fh-hdcp" label="Stroke index" value={twice ? hole.hdcp : hdcp} min={1} max={maxHdcp} onChange={setHdcp} disabled={twice} />
      </div>
      {twice && <p className="field-help pad">This 9-hole card is played twice. Fix its stroke index in the course editor.</p>}
      {twice && par !== hole.par && <p className="field-help pad">Par changes both times you play it: holes {round.holes.filter(h => h.courseIdx === hole.courseIdx).map(h => h.no).join(' and ')}.</p>}
      {changed && (
        <div className="hint-card fix-impact" role="status">
          <Icon name="scales" fill />
          <div>
            <div className="eyebrow">What this changes</div>
            {swap && <p>Stroke index {hdcp} was hole {swap.no}’s, so the two swap: hole {swap.no} is now {hole.hdcp}.</p>}
            {lines.map(l => <p key={l}>{l}</p>)}
            {money && <p><strong>{money}</strong></p>}
          </div>
        </div>
      )}
      <SendSwitch on={send} onChange={setSend} />
      {course && <p className="field-help pad">Also saved to {round.course.name} on this phone, so your next round there starts right.</p>}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!changed} onClick={apply}>{changed ? <>Fix for this round <Icon name="check" /></> : 'No change yet'}</button>
      </div>
    </Sheet>
  );
}

const num = v => (v === '' || v == null ? null : Number(v));
const ratingOk = v => v != null && Number.isFinite(v) && v >= 25 && v <= 85;
const slopeOk = v => v != null && Number.isInteger(v) && v >= 55 && v <= 155;

/** Rating and slope for the tees in use, for this round. Mounted only while open. */
export function CourseTeeSheet({ round, me = null, onClose }) {
  const { showToast } = useUI();
  const course = useStore(s => findCourse(s, round.course.id));
  const tees = roundTees(round, course).filter(t => t.tee);
  const [vals, setVals] = useState(() => Object.fromEntries(tees.map(t => [t.name, { rating: t.tee.rating ?? '', slope: t.tee.slope ?? '' }])));
  const [send, setSend] = useState(true);
  const set = (name, key, v) => setVals(x => ({ ...x, [name]: { ...x[name], [key]: v } }));
  const edits = tees.map(t => {
    const rating = num(vals[t.name]?.rating);
    const slope = num(vals[t.name]?.slope);
    return { ...t, rating, slope, ok: ratingOk(rating) && slopeOk(slope), changed: rating !== (t.tee.rating ?? null) || slope !== (t.tee.slope ?? null) };
  });
  const bad = edits.some(e => e.changed && !e.ok);
  const changed = edits.some(e => e.changed);
  const after = !course || bad || !changed ? null
    : edits.filter(e => e.changed).reduce((r, e) => fixTee(r, course, e.name, { rating: e.rating, slope: e.slope }, { by: me }), round);
  const strokes = after && round.useHandicaps ? playsLine(round, after) : null;
  const money = after ? moneyLine(round, after) : null;

  const apply = () => {
    update(s => {
      const r = s.rounds[round.id];
      if (!r) return;
      s.rounds[round.id] = edits.filter(e => e.changed).reduce((x, e) => fixTee(x, course, e.name, { rating: e.rating, slope: e.slope }, { by: me }), r);
    });
    if (send) {
      for (const e of edits.filter(x => x.changed)) {
        sendFix(teeFixFeedback(round, course, e.name, { rating: e.tee.rating ?? null, slope: e.tee.slope ?? null }, { rating: e.rating, slope: e.slope }));
      }
    }
    onClose();
    showToast(send ? 'Fixed. Thanks, it’s on its way to us.' : 'Fixed for this round');
    buzz(20);
  };

  return (
    <Sheet open onClose={onClose} title="Course and tee">
      <p className="sheet-text">{round.course.name}. Fix a tee’s rating or slope for this round.</p>
      {!course && <p className="hint-card"><Icon name="info" fill /> This phone doesn’t have {round.course.name} saved, so rating and slope can’t be changed here.</p>}
      {course && !round.useHandicaps && <p className="hint-card"><Icon name="info" fill /> Handicaps are off for this round, so this won’t change anything.</p>}
      {course && edits.map(e => (
        <div key={e.name} className="block tee-fix">
          <div className="eyebrow">{e.name} tees</div>
          <div className="tee-fix-row">
            <div>
              <label className="field-label" htmlFor={`tf-r-${e.name}`}>Rating</label>
              <input id={`tf-r-${e.name}`} className="text-input" inputMode="decimal" value={vals[e.name].rating}
                aria-invalid={e.changed && !ratingOk(e.rating) ? true : undefined} onChange={ev => set(e.name, 'rating', ev.target.value.replace(/[^0-9.]/g, ''))} />
            </div>
            <div>
              <label className="field-label" htmlFor={`tf-s-${e.name}`}>Slope</label>
              <input id={`tf-s-${e.name}`} className="text-input" inputMode="numeric" value={vals[e.name].slope}
                aria-invalid={e.changed && !slopeOk(e.slope) ? true : undefined} onChange={ev => set(e.name, 'slope', ev.target.value.replace(/[^0-9]/g, ''))} />
            </div>
          </div>
          {e.changed && !e.ok && <p className="field-error">Rating is usually 60 to 80 (about half on a 9-hole card) and slope 55 to 155.</p>}
        </div>
      ))}
      {(strokes || money) && (
        <div className="hint-card fix-impact" role="status">
          <Icon name="scales" fill />
          <div>
            <div className="eyebrow">What this changes</div>
            {strokes && <p>{strokes}</p>}
            {money && <p><strong>{money}</strong></p>}
          </div>
        </div>
      )}
      {after && round.useHandicaps && !strokes && <p className="field-help pad">No one’s strokes change.</p>}
      {course && <SendSwitch on={send} onChange={setSend} />}
      <div className="cta-wrap">
        <button className="full-btn" disabled={!after} onClick={apply}>{changed && !bad ? <>Fix for this round <Icon name="check" /></> : 'No change yet'}</button>
      </div>
    </Sheet>
  );
}
