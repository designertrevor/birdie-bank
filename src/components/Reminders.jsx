// Reminders on Up next and the plan: "Book your tee time" for a plan you organized, from the day
// you picked (tee-reminders.js), and a friendly payment nudge once someone has owed you a while
// (nudges.js). There's no push yet, so these cards are the reminders.
import { useMemo, useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { Avatar } from './Pay.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { money } from '../lib/golf.js';
import { nameOf } from '../lib/ledger.js';
import { sendReminder } from '../lib/pay.js';
import { timeLabel } from '../lib/plans.js';
import { PLAN_LOCKED, editPlan, planShareLink, sharePlan } from '../lib/plan-sync.js';
import { useRemind } from '../lib/useRemind.js';
import { NUDGES_ON_HOME, noteNudge, nudgeLine, paymentNudges } from '../lib/nudges.js';
import { bookedText, cleanBookingUrl, linkSite, markBooked, planBookingUrl, remindDayChoices, remindOnLabel, setBooking, teeTimeLine, teeTimeReminders, tomorrowIso } from '../lib/tee-reminders.js';

const firstOf = name => String(name || '').trim().split(/\s+/)[0];

/** Up next's reminders: tee times to book first (they have a day), then payment nudges. */
export function RemindersUpNext() {
  const state = useStore();
  const tee = useMemo(() => teeTimeReminders(state), [state]);
  const nudges = useMemo(() => paymentNudges(state).slice(0, NUDGES_ON_HOME), [state]);
  // The Booked sheet lives here, not on the card: once it's booked the card goes, the sheet stays for the text
  const [bookingId, setBookingId] = useState(null);
  const booking = bookingId ? state.plans?.[bookingId] : null;
  return (
    <>
      {(tee.length > 0 || nudges.length > 0) && <div className="sec-label">Reminders</div>}
      {tee.map(p => <TeeTimeCard key={p.id} plan={p} onBooked={() => setBookingId(p.id)} />)}
      {nudges.map(n => <NudgeCard key={n.id} nudge={n} />)}
      {booking && <BookedSheet plan={booking} open onClose={() => setBookingId(null)} />}
    </>
  );
}

/** "Book your tee time": the course's booking page, Booked, or put it off until tomorrow. */
function TeeTimeCard({ plan, onBooked }) {
  const nav = useNav();
  const state = useStore();
  const { showToast } = useUI();
  const url = planBookingUrl(state, plan);
  const later = () => {
    update(s => { const p = s.plans?.[plan.id]; if (p) p.teeSnooze = tomorrowIso(); });
    showToast('Okay, it’s back on Up next tomorrow');
  };
  return (
    <div className="remind-card tee">
      <div className="rc-head">
        <span className="rc-ic" aria-hidden="true"><Icon name="alarm" fill /></span>
        <div className="row-main">
          <div className="eyebrow">Tee time</div>
          <div className="rc-title d">Book your tee time</div>
          <div className="rc-sub">{teeTimeLine(plan)}. The good times go early, so grab one now and tap Booked so the group sees it.</div>
        </div>
      </div>
      <div className="rc-acts">
        {url ? (
          <a className="rc-btn ink" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open the booking page on ${linkSite(url)}`}>
            <Icon name="arrow-square-out" /> Book on {linkSite(url)}
          </a>
        ) : (
          <button className="rc-btn ink" onClick={() => nav.push('plan', { id: plan.id })}><Icon name="link" /> Add the booking link</button>
        )}
        <button className="rc-btn" onClick={onBooked}><Icon name="check-circle" fill /> Booked</button>
        <button className="rc-btn ghost" onClick={later}>Tomorrow</button>
      </div>
    </div>
  );
}

/** "Mike still owes you $18 from Saturday", with the Tab's Remind text one tap away. */
function NudgeCard({ nudge }) {
  const state = useStore();
  const { showToast } = useUI();
  const remind = useRemind();
  const name = nameOf(state, nudge.id);
  const first = firstOf(name);
  const send = async () => {
    // A copied one has its own toast (paste it to them)
    const r = await remind(nudge.id, nudge.amount);
    if (r === 'shared' || r === 'sms') showToast(`Sent. Nothing more about ${first} for a week`);
  };
  const notNow = () => {
    update(s => noteNudge(s, nudge.id));
    showToast(`Okay. Nothing about ${first} for a week`);
  };
  return (
    <div className="remind-card nudge">
      <div className="rc-head">
        <Avatar id={nudge.id} name={name} />
        <div className="row-main">
          <div className="rc-title sm">{nudgeLine(name, nudge.amount, nudge.since, { fmt: money })}</div>
          <div className="rc-sub">A friendly reminder with your pay link, one tap away.</div>
        </div>
      </div>
      <div className="rc-acts">
        <button className="rc-btn ink" onClick={send} aria-label={`Send ${first} a friendly reminder about ${money(nudge.amount)}`}><Icon name="bell-ringing" fill /> Send a reminder</button>
        <button className="rc-btn ghost" onClick={notNow}>Not now</button>
      </div>
    </div>
  );
}

/**
 * Booked: the tee time you got goes on the plan (everyone with the link sees it), then a text for
 * the group. Used from the Up next card and the plan's tee time section.
 */
export function BookedSheet({ plan, open, onClose }) {
  const [done, setDone] = useState(false);
  const close = () => { onClose(); setDone(false); };
  return (
    <Sheet open={open} onClose={close} title={done ? 'Booked' : 'What time did you get?'}>
      {/* Mounted each time it opens, so it starts from the plan's tee time */}
      {open && <BookedBody plan={plan} done={done} onDone={() => setDone(true)} onClose={close} />}
    </Sheet>
  );
}

function BookedBody({ plan, done, onDone, onClose }) {
  const { showToast } = useUI();
  const [time, setTime] = useState(() => getState().plans?.[plan.id]?.teeTime || '');
  const [sending, setSending] = useState(false);
  const save = () => {
    editPlan(plan.id, p => markBooked(p, time || null)).then(r => { if (r === 'taken') showToast(PLAN_LOCKED); });
    onDone();
  };
  const text = async () => {
    setSending(true);
    let link = planShareLink(getState().plans?.[plan.id]);
    // Not shared yet: share it now so the text has the link, or send it without one
    if (!link) {
      try { await sharePlan(plan.id); link = planShareLink(getState().plans?.[plan.id]); } catch { link = null; }
    }
    setSending(false);
    const r = await sendReminder(bookedText(getState().plans?.[plan.id] || plan, link));
    if (r === 'copied') showToast('Copied. Paste it in your group text');
    if (r === 'failed') showToast('Couldn’t share on this device');
    if (r !== 'cancelled' && r !== 'failed') onClose();
  };
  if (!done) {
    return (
      <>
        <p className="sheet-text">It goes on the plan, so everyone with the link sees the tee time.</p>
        <div className="rc-sheet-body">
          <label className="eyebrow" htmlFor="booked-time">Tee time</label>
          <input id="booked-time" className="name-input time-input" type="time" step={300} value={time} onChange={e => setTime(e.target.value)} />
          <button className="full-btn" onClick={save}><Icon name="calendar-check" fill /> {time ? `Booked for ${timeLabel(time)}` : 'Booked'}</button>
        </div>
      </>
    );
  }
  return (
    <>
      <p className="sheet-text">{time ? `${timeLabel(time)} is on the plan.` : 'It’s on the plan.'} Let the group know?</p>
      <div className="rc-sheet-body">
        <button className="full-btn" disabled={sending} onClick={text}><Icon name="chat-circle-text" /> {sending ? 'Getting the link…' : 'Text the group'}</button>
        <button className="full-btn outline" onClick={onClose}>Done</button>
      </div>
    </>
  );
}

/**
 * The plan's tee time, for the organizer: the course's booking page (saved for the course too, so
 * the next plan there has it), the day Up next reminds you to book, and Booked. Once it's booked,
 * the time and a text for the group.
 */
export function TeeTimeSection({ plan }) {
  const state = useStore();
  const { showToast } = useUI();
  const [sheet, setSheet] = useState(false);
  const days = remindDayChoices(plan);
  const remindOn = plan.booking?.remindOn || null;
  const save = fn => editPlan(plan.id, fn).then(r => { if (r === 'taken') showToast(PLAN_LOCKED); });
  const groupText = async () => {
    let link = planShareLink(plan);
    if (!link) { try { await sharePlan(plan.id); link = planShareLink(getState().plans?.[plan.id]); } catch { link = null; } }
    const r = await sendReminder(bookedText(getState().plans?.[plan.id] || plan, link));
    if (r === 'copied') showToast('Copied. Paste it in your group text');
    if (r === 'failed') showToast('Couldn’t share on this device');
  };
  return (
    <>
      <div className="sec-label">Tee time</div>
      <div className="block tee-block">
        {plan.booked ? (
          <>
            <div className="tb-booked">
              <Icon name="calendar-check" fill />
              <div className="row-main">
                <div className="set-name">Booked{plan.teeTime ? ` for ${timeLabel(plan.teeTime)}` : ''}</div>
                <div className="set-sub">Everyone with the link sees the tee time.</div>
              </div>
            </div>
            <div className="rc-acts">
              <button className="rc-btn ink" onClick={groupText}><Icon name="chat-circle-text" /> Text the group</button>
              <button className="rc-btn" onClick={() => setSheet(true)}><Icon name="pencil-simple" /> Change the time</button>
            </div>
          </>
        ) : (
          <>
            <BookingLink key={plan.course?.id || 'none'} plan={plan} state={state} onSave={url => {
              save(p => setBooking(p, { url }));
              const cid = plan.course?.id;
              if (cid) update(s => { s.courseLinks = { ...(s.courseLinks || {}) }; if (url) s.courseLinks[cid] = url; else delete s.courseLinks[cid]; });
              showToast(url ? `Saved for ${plan.course?.name || 'this course'}` : 'Booking link taken off');
            }} />
            {days.length > 0 && (
              <>
                <div className="eyebrow tb-label" id="remind-day">Remind me to book</div>
                <div className="day-strip" role="radiogroup" aria-labelledby="remind-day">
                  <button role="radio" aria-checked={!remindOn} className={`day-chip tb-none ${!remindOn ? 'on' : ''}`} onClick={() => save(p => setBooking(p, { remindOn: null }))}>
                    <span className="dc-top">No</span><span className="dc-bottom">reminder</span>
                  </button>
                  {days.map(d => (
                    <button key={d.iso} role="radio" aria-checked={d.iso === remindOn} className={`day-chip ${d.iso === remindOn ? 'on' : ''}`} onClick={() => save(p => setBooking(p, { remindOn: d.iso }))}>
                      <span className="dc-top">{d.top}</span><span className="dc-bottom">{d.bottom}</span>
                    </button>
                  ))}
                </div>
                <p className="field-help">{remindOn ? `${remindOnLabel(plan)}, with the booking link.` : 'Pick a day and Up next reminds you to book, with the link.'}</p>
              </>
            )}
            <button className="rc-btn tb-done" onClick={() => setSheet(true)}><Icon name="check-circle" fill /> Booked</button>
          </>
        )}
      </div>
      {sheet && <BookedSheet plan={plan} open onClose={() => setSheet(false)} />}
    </>
  );
}

/** The booking page field: the link this phone knows for the course, to open, change or paste in. */
function BookingLink({ plan, state, onSave }) {
  const known = planBookingUrl(state, plan);
  const [draft, setDraft] = useState(known);
  const [bad, setBad] = useState(false);
  const clean = cleanBookingUrl(draft);
  const changed = draft.trim() !== (known || '');
  const commit = () => {
    if (draft.trim() && !clean) { setBad(true); return; }
    setBad(false);
    setDraft(clean);
    if ((clean || '') !== (known || '')) onSave(clean);
  };
  return (
    <>
      <label className="eyebrow tb-label" htmlFor="booking-url">The course’s booking page</label>
      <div className="tb-link-row">
        <input id="booking-url" className="text-input" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder="Paste the tee time link" value={draft}
          onChange={e => { setDraft(e.target.value); setBad(false); }}
          onKeyDown={e => { if (e.key === 'Enter') commit(); }}
          aria-invalid={bad || undefined} aria-describedby="booking-url-help" />
        {changed ? (
          <button className="rc-btn ink" onClick={commit}>Save</button>
        ) : known ? (
          <a className="rc-btn" href={known} target="_blank" rel="noopener noreferrer" aria-label={`Open ${linkSite(known)}`}><Icon name="arrow-square-out" /> Open</a>
        ) : null}
      </div>
      <p className={`field-help ${bad ? 'err' : ''}`} id="booking-url-help">
        {bad ? 'That doesn’t look like a web address. Copy it from the course’s booking page.'
          : known ? `Saved for ${plan.course?.name || 'this course'}, so your next plan there has it too.`
          : 'Where you book tee times online. It’s saved for the course, so you only add it once.'}
      </p>
    </>
  );
}
