// "Suggest something": pick what kind, then a short form that asks for what's useful.
import { Fragment, useState } from 'react';
import { Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { FEEDBACK_KINDS, shrinkImage, submitFeedback } from '../lib/feedback.js';
import { useNav } from '../lib/nav.js';

// Each kind's fields. The first is the main message and is required.
const FORMS = {
  game: {
    photo: null,
    fields: [
      { key: 'name', label: 'What’s the game called?', placeholder: 'e.g. Hammer', required: true },
      { key: 'rules', label: 'How is it played?', placeholder: 'Teams, who tees off, how a hole is won…', area: true, required: true },
      { key: 'money', label: 'How does the money work?', placeholder: 'Points, carryovers, presses, who pays whom…', area: true },
    ],
  },
  course: {
    photo: 'Scorecard photo',
    fields: [
      { key: 'name', label: 'Course name', placeholder: 'e.g. Birch Creek Golf Course', required: true },
      { key: 'city', label: 'City and state', placeholder: 'e.g. Smithfield, UT', required: true },
      { key: 'note', label: 'Anything wrong or missing?', placeholder: 'Missing tees, wrong par on 7…', area: true },
    ],
  },
  feature: {
    photo: null,
    fields: [
      { key: 'idea', label: 'What would you like Birdie Bank to do?', placeholder: 'Describe it in your own words', area: true, required: true },
      { key: 'why', label: 'When would you use it?', placeholder: 'e.g. Every Saturday when we split into two groups', area: true },
    ],
  },
  bug: {
    photo: 'Screenshot',
    fields: [
      { key: 'what', label: 'What happened?', placeholder: 'What you tapped and what went wrong', area: true, required: true },
      { key: 'expected', label: 'What did you expect?', placeholder: 'Optional', area: true },
    ],
  },
};

/**
 * Opened from Settings with no params, or from elsewhere in the app already on a form:
 * `kind` picks the form, `prefill` fills its fields, `lead` is a short line above the form,
 * `extra` rides along in the details, and `roundId` attaches that round as context.
 */
export default function Suggest({ kind: initialKind = null, prefill = null, lead = null, extra = null, roundId = null }) {
  const nav = useNav();
  const { showToast } = useUI();
  const me = useStore(s => s.players[s.me]);
  const [kind, setKind] = useState(initialKind);
  const [values, setValues] = useState(() => ({ ...(prefill || {}) }));
  const [contact, setContact] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState(null);

  if (sent) {
    return (
      <Screen className="onboard">
        <div className="scroll onboard-body">
          <div className="onboard-badge"><Icon name="check-circle" fill /></div>
          <h1 className="onboard-title" style={{ fontSize: 34 }}>Thanks{me ? `, ${me.name}` : ''}</h1>
          <p className="onboard-text">
            {sent === 'sent' ? 'Got it. Every suggestion gets read, and the most asked-for ones get built first.' : 'No signal right now, so it’s saved on your phone and will send by itself when you’re back online.'}
          </p>
        </div>
        <div className="cta-wrap"><button className="full-btn" onClick={nav.pop}>Done</button></div>
      </Screen>
    );
  }

  if (!kind) {
    return (
      <Screen>
        <Header title="Suggest something" onBack={nav.pop} />
        <div className="scroll">
          <p className="hint-card"><Icon name="chat-circle-dots" fill /> Birdie Bank is built around what golfers ask for. What’s on your mind?</p>
          {Object.entries(FEEDBACK_KINDS).map(([k, v]) => (
            <button key={k} className="set-row" onClick={() => setKind(k)}>
              <div className="set-icon"><Icon name={v.icon} fill /></div>
              <div className="row-main"><div className="set-name">{v.title}</div><div className="set-sub">{v.sub}</div></div>
              <span className="chevron"><Icon name="caret-right" /></span>
            </button>
          ))}
        </div>
      </Screen>
    );
  }

  const form = FORMS[kind];
  const missing = form.fields.filter(f => f.required && !(values[f.key] || '').trim());
  const set = (k, v) => setValues(x => ({ ...x, [k]: v }));

  const pickPhoto = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setImage(await shrinkImage(f)); } catch { showToast('Couldn’t read that image'); }
  };

  const submit = async () => {
    setTried(true);
    if (missing.length) return;
    setBusy(true);
    const [main, ...rest] = form.fields;
    const details = { from: me?.name || null, ...(extra || {}) };
    for (const f of rest) if ((values[f.key] || '').trim()) details[f.key] = values[f.key].trim();
    // For games and courses the name is short, so fold the next field into the message too
    const body = kind === 'game' ? `${values.name.trim()}\n\n${values.rules.trim()}`
      : kind === 'course' ? `${values.name.trim()}, ${values.city.trim()}`
      : values[main.key];
    try { setSent(await submitFeedback({ kind, body, details: { ...details, [main.key]: values[main.key].trim() }, contact, image, roundId })); }
    catch { setSent('queued'); }
    setBusy(false);
  };

  return (
    <Screen>
      <Header title={FEEDBACK_KINDS[kind].title} onBack={() => (initialKind ? nav.pop() : setKind(null))} small />
      <div className="scroll">
        {lead && <p className="hint-card"><Icon name="chat-circle-dots" fill /> {lead}</p>}
        <div className="block">
          {form.fields.map(f => {
            const err = tried && f.required && !(values[f.key] || '').trim();
            const props = { id: `fb-${f.key}`, className: `text-input ${f.area ? 'area' : ''}`, value: values[f.key] || '', placeholder: f.placeholder, maxLength: f.area ? 2000 : 120, onChange: e => set(f.key, e.target.value), 'aria-invalid': err || undefined };
            return (
              <Fragment key={f.key}>
                <label className="field-label" htmlFor={props.id}>{f.label}{!f.required && <span className="opt"> optional</span>}</label>
                {f.area ? <textarea rows={4} {...props} /> : <input {...props} />}
                {err && <p className="field-error">Add this so we can help.</p>}
              </Fragment>
            );
          })}
          {form.photo && (
            <>
              <label className="field-label">{form.photo} <span className="opt">optional</span></label>
              {image ? (
                <div className="fb-photo">
                  <img src={image} alt={form.photo} />
                  <button className="hc-chip" onClick={() => setImage(null)}><Icon name="x" /> Remove</button>
                </div>
              ) : (
                <label className="hc-chip" htmlFor="fb-photo" role="button" tabIndex={0}><Icon name="camera" /> Add a photo</label>
              )}
              <input id="fb-photo" type="file" accept="image/*" hidden onChange={pickPhoto} />
            </>
          )}
          <label className="field-label" htmlFor="fb-contact">Email for a reply <span className="opt">optional</span></label>
          <input id="fb-contact" className="text-input" type="email" inputMode="email" autoComplete="email" value={contact} onChange={e => setContact(e.target.value)} placeholder="We’ll tell you when it ships" maxLength={120} />
          {(kind === 'bug' || roundId) && <p className="field-help">Your device and {roundId ? 'this round’s' : 'current round'} details come along automatically, so you don’t have to explain your setup.</p>}
        </div>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" disabled={busy} onClick={submit}>{busy ? 'Sending…' : <>Send <Icon name="paper-plane-tilt" fill /></>}</button>
      </div>
    </Screen>
  );
}
