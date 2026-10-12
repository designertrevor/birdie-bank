// The weekly feedback digest, for Trevor only (?digest, or Settings when signed in as an admin):
// the ideas sent in over the last week grouped by theme, each with Approve or Skip and the roadmap
// area it goes to. Approved ones wait at the top as a note to copy into a Claude session, which adds
// them to ROADMAP.md; then "Mark added" clears them. The server checks every call against
// app_admins (supabase/2026-10-12-feedback-digest.sql), so nobody else can read anyone's feedback.
import { useCallback, useEffect, useState } from 'react';
import { Empty, Header, Icon, Screen, Segmented, useUI } from '../components/ui.jsx';
import { SignInSheet } from '../components/Account.jsx';
import { useNav } from '../lib/nav.js';
import { useAccount } from '../lib/cloud.js';
import { ROADMAP_AREAS, approvedNote, areaFor, groupDigest, ideaDetail, oneLine, sentAgo } from '../lib/digest.js';
import { decide, loadApproved, loadDigest, markAdded } from '../lib/digest-sync.js';
import './digest.css';

const KIND_ICON = { game: 'cards', course: 'map-trifold', feature: 'lightbulb', bug: 'bug' };
const STATE_TEXT = {
  off: ['The digest isn’t set up yet', 'Run supabase/2026-10-12-feedback-digest.sql in Supabase, then add your account to app_admins (the file says how).'],
  denied: ['Not for this account', 'Only the app’s owner can read the feedback digest.'],
  offline: ['No signal', 'The digest needs a connection. Try again in a moment.'],
  error: ['Couldn’t load the digest', 'Something went wrong on the server. Try again in a moment.'],
};

export default function Digest() {
  const nav = useNav();
  const { showToast, ask } = useUI();
  const acct = useAccount();
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  const [approved, setApproved] = useState([]);
  const [state, setState] = useState(null);
  const [signingIn, setSigningIn] = useState(false);
  const [busy, setBusy] = useState({});
  const signedIn = !!acct.user;

  const load = useCallback(async () => {
    const [d, a] = await Promise.all([loadDigest(days), loadApproved()]);
    if (d.state) { setState(d.state); return; }
    setState(null);
    setRows(d.rows);
    setApproved(a.rows || []);
  }, [days]);

  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    Promise.resolve().then(() => live && load());
    return () => { live = false; };
  }, [signedIn, load]);

  const setCall = async (row, decision, area = areaFor(row), note = row.note || null) => {
    setBusy(b => ({ ...b, [row.id]: true }));
    const err = await decide(row.id, decision, decision ? area : null, decision ? note : null);
    setBusy(b => { const n = { ...b }; delete n[row.id]; return n; });
    if (err) { showToast(err === 'offline' ? 'No signal, so that didn’t save' : 'That didn’t save. Try again'); return; }
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, decision, area: decision ? area : null, note: decision ? note : null, added_on: null } : r)));
    const a = await loadApproved();
    if (a.rows) setApproved(a.rows);
    if (decision) showToast(decision === 'approve' ? 'Approved for the roadmap' : 'Skipped', { label: 'Undo', run: () => setCall(row, null) });
  };

  const copyNote = async () => {
    const text = approvedNote(approved, new Date().toISOString().slice(0, 10));
    try { await navigator.clipboard.writeText(text); showToast('Copied. Paste it into a Claude session'); }
    catch { showToast('Couldn’t copy on this phone'); }
  };

  const clearAdded = async () => {
    const ok = await ask({ title: `Mark ${approved.length} as added?`, text: 'Only once Claude has put them in ROADMAP.md. They leave this list.', confirmLabel: 'Mark added' });
    if (!ok) return;
    const err = await markAdded(approved.map(r => r.id));
    if (err) { showToast('That didn’t save. Try again'); return; }
    setApproved([]);
    setRows(rs => rs?.map(r => (r.decision === 'approve' ? { ...r, added_on: new Date().toISOString().slice(0, 10) } : r)) || rs);
  };

  const digest = rows ? groupDigest(rows) : null;
  const reactions = digest ? Object.entries(digest.reactions) : [];

  return (
    <Screen className="digest">
      <Header title="Feedback digest" onBack={nav.pop} />
      <div className="scroll">
        {!signedIn ? (
          <Empty illo="bulb" title="Sign in first" text="The digest is for the app’s owner, so it needs your account."
            action={<button className="pill-btn dark" onClick={() => setSigningIn(true)}>Sign in</button>} />
        ) : state ? (
          <Empty illo={state === 'denied' ? 'sleep' : 'bulb'} title={STATE_TEXT[state][0]} text={STATE_TEXT[state][1]}
            action={state === 'offline' || state === 'error' ? <button className="pill-btn" onClick={load}>Try again</button> : null} />
        ) : !digest ? (
          <div className="dg-loading" aria-busy="true">Loading the ideas…</div>
        ) : (
          <>
            <p className="dg-intro">
              {digest.total === 0 ? `Nothing sent in the last ${days} days.`
                : `${digest.total} ${digest.total === 1 ? 'idea' : 'ideas'} in the last ${days} days, ${digest.waiting} waiting for a call.`}
              {' '}Approve what belongs on the roadmap; skip the rest.
            </p>
            <div className="dg-days">
              <Segmented label="How far back" className="press-mode-row" btn="pm-btn" value={days} onChange={setDays}
                options={[{ value: 7, label: 'Last 7 days' }, { value: 30, label: 'Last 30 days' }]} />
            </div>

            {approved.length > 0 && (
              <div className="dg-ready">
                <div className="dg-ready-head">
                  <Icon name="check-circle" fill />
                  <span><b>{approved.length} approved</b>, waiting to go into ROADMAP.md</span>
                </div>
                <p className="dg-ready-text">Copy them into a Claude session and it adds each one to its area. Then mark them added.</p>
                <div className="dg-ready-acts">
                  <button className="pill-btn dark" onClick={copyNote}><Icon name="copy" /> Copy for Claude</button>
                  <button className="pill-btn" onClick={clearAdded}>Mark added</button>
                </div>
              </div>
            )}

            {reactions.length > 0 && (
              <p className="dg-reactions">After rounds: {reactions.map(([label, n]) => `${label} ${n}`).join(' · ')}</p>
            )}

            {digest.groups.map(g => (
              <section key={g.id} className="dg-group" aria-label={g.label}>
                <div className="sec-label">{g.label} <span className="dg-n">{g.items.length}</span></div>
                <ul className="dg-list" role="list">
                  {g.items.map(r => <DigestItem key={r.id} row={r} busy={!!busy[r.id]} onCall={setCall} />)}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
      {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} />}
    </Screen>
  );
}

/** One idea: what they sent, when, and Approve or Skip with the roadmap area it goes to. */
function DigestItem({ row, busy, onCall }) {
  const [area, setArea] = useState(() => areaFor(row));
  const [note, setNote] = useState(row.note || '');
  const detail = ideaDetail(row);
  const decided = row.decision;
  return (
    <li className={`dg-item ${decided ? `is-${decided}` : ''}`}>
      <div className="dg-top">
        <Icon name={KIND_ICON[row.kind] || 'chat-circle'} className="dg-kind" />
        <div className="row-main">
          <div className="dg-body">{oneLine(row.body, 400)}</div>
          {detail && <div className="dg-detail">{oneLine(detail, 400)}</div>}
          <div className="dg-meta">
            {sentAgo(row.created_at)}{row.has_photo ? ' · has a photo (Dashboard, Storage)' : ''}{row.roadmap_status ? ' · already on the roadmap' : ''}
          </div>
        </div>
      </div>
      {decided ? (
        <div className="dg-done">
          <span className={`dg-tag ${decided}`}>
            {decided === 'approve' ? `Approved, area ${row.area || area}${row.added_on ? ', in ROADMAP.md' : ''}` : 'Skipped'}
          </span>
          {!row.added_on && <button className="link-btn" disabled={busy} onClick={() => onCall(row, null)}>Undo</button>}
        </div>
      ) : (
        <div className="dg-acts">
          <label className="dg-area">
            <span className="sr-only">Roadmap area</span>
            <select value={area} onChange={e => setArea(e.target.value)}>
              {Object.entries(ROADMAP_AREAS).map(([n, name]) => <option key={n} value={n}>{n}. {name}</option>)}
            </select>
          </label>
          <input className="text-input dg-note" value={note} maxLength={300} placeholder="Note for Claude (optional)"
            aria-label="Note for Claude" onChange={e => setNote(e.target.value)} />
          <div className="dg-btns">
            <button className="pill-btn dark" disabled={busy} onClick={() => onCall(row, 'approve', area, note.trim() || null)}><Icon name="check" /> Approve</button>
            <button className="pill-btn" disabled={busy} onClick={() => onCall(row, 'skip')}>Skip</button>
          </div>
        </div>
      )}
    </li>
  );
}
