import { useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { getState, useStore } from '../lib/store.js';
import { fetchShared, joinShared, shareLink, shareRound, stopSharing, useSyncStatus } from '../lib/sync.js';
import { cleanCode } from '../lib/sync-model.js';
import { GAMES } from '../lib/round.js';
import { useNav } from '../lib/nav.js';

export function LivePill({ round }) {
  const st = useSyncStatus();
  if (!round.shared) return null;
  if (round.shared.ended) return <span className="live-pill ended">Sharing ended</span>;
  const label = st.state === 'offline' ? 'Offline — will sync' : st.state === 'connecting' ? 'Connecting' : 'Live';
  return <span className={`live-pill ${st.state}`} role="status"><span className="live-dot" aria-hidden="true" />{label}</span>;
}

/** Share a round live, or show its code if it's already shared. */
export function ShareSheet({ round, open, onClose }) {
  const { showToast, ask } = useUI();
  const [busy, setBusy] = useState(false);
  const code = round.shared?.code;
  const link = code ? shareLink(code) : null;

  const start = async () => {
    setBusy(true);
    try { await shareRound(round.id); }
    catch (e) { showToast(e.message || 'Couldn’t start sharing'); }
    setBusy(false);
  };
  const send = async () => {
    const text = `Join my ${GAMES[round.game].name} round at ${round.course.name} on Birdie Bank — code ${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Join my round', text, url: link }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}\n${link}`); showToast('Link copied'); } catch { showToast(link); }
  };
  const stop = async () => {
    const host = round.shared?.host;
    const ok = await ask({
      title: host ? 'Stop sharing this round?' : 'Leave the shared round?',
      text: host ? 'Other phones keep what they have but stop getting updates. Your copy stays here.' : 'You keep a copy of the scores so far, but stop getting updates.',
      confirmLabel: host ? 'Stop sharing' : 'Leave', danger: true,
    });
    if (!ok) return;
    await stopSharing(round.id);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Live scoring">
      {!code ? (
        <div style={{ padding: '0 16px' }}>
          <p className="sheet-text" style={{ padding: '0 4px 12px' }}>Let everyone in the group follow along — or keep score from their own phone. Scores sync hole by hole.</p>
          <ul className="onboard-list" style={{ marginTop: 0, marginBottom: 14 }}>
            <li><Icon name="link" fill /> You get a code and a link to send the group.</li>
            <li><Icon name="device-mobile" fill /> Anyone with it can view and enter scores.</li>
          </ul>
          <button className="full-btn" disabled={busy} onClick={start}>{busy ? 'Starting…' : <>Share live <Icon name="broadcast" fill /></>}</button>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          <div className="code-card">
            <div className="bl">Round code</div>
            <div className="code-big" aria-label={code.split('').join(' ')}>{code}</div>
            <div className="code-link">{link.replace(/^https?:\/\//, '')}</div>
          </div>
          {round.shared.ended && <p className="field-error" style={{ textAlign: 'center' }}>The scorekeeper stopped sharing this round.</p>}
          <button className="full-btn" onClick={send}><Icon name="share-network" /> Send to the group</button>
          <button className="danger-link" onClick={stop}><Icon name="broadcast" /> {round.shared.host ? 'Stop sharing' : 'Leave shared round'}</button>
        </div>
      )}
    </Sheet>
  );
}

/** Enter a code → preview → pick who you are → join. */
export function JoinSheet({ open, onClose, initialCode = '' }) {
  const nav = useNav();
  const { showToast } = useUI();
  const state = useStore();
  const [code, setCode] = useState(cleanCode(initialCode));
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const find = async () => {
    setBusy(true); setErr(null);
    try {
      const remote = await fetchShared(code);
      if (!remote) setErr('No round with that code. Check it with the scorekeeper.');
      else setFound(remote);
    } catch (e) { setErr(e.message || 'Couldn’t reach the server — check your signal.'); }
    setBusy(false);
  };
  const join = async me => {
    const s = getState();
    const existing = Object.values(s.rounds).find(r => r.shared?.code === code);
    if (existing) { onClose(); nav.push('play', { id: existing.id }); return; }
    if (s.activeRoundId && s.rounds[s.activeRoundId]?.status === 'active') {
      showToast('Finish or end your current round first');
      return;
    }
    const id = await joinShared(code, found, me);
    onClose();
    nav.push(found.meta.status === 'done' ? 'roundDetail' : 'play', { id });
  };

  const meta = found?.meta;
  return (
    <Sheet open={open} onClose={onClose} title={meta ? 'Who are you?' : 'Join a round'}>
      <div style={{ padding: '0 16px' }}>
        {!meta ? (
          <>
            <p className="sheet-text" style={{ padding: '0 4px 12px' }}>Ask the scorekeeper for the 6-letter code, or open the link they sent.</p>
            <label className="sr-only" htmlFor="join-code">Round code</label>
            <input id="join-code" className="code-input" value={code} onChange={e => { setCode(cleanCode(e.target.value)); setErr(null); }}
              placeholder="ABC123" autoCapitalize="characters" autoCorrect="off" autoComplete="off" inputMode="text" maxLength={8} />
            {err && <p className="field-error" style={{ textAlign: 'center' }}>{err}</p>}
            <div style={{ marginTop: 14 }}><button className="full-btn" disabled={code.length !== 6 || busy} onClick={find}>{busy ? 'Finding…' : 'Find round'}</button></div>
          </>
        ) : (
          <>
            <div className="block summary-card" style={{ margin: '0 0 12px' }}>
              <div className="d" style={{ fontSize: 20, fontWeight: 800 }}>{GAMES[meta.game].name} · {meta.course.name}</div>
              <div className="li-sub">{meta.holes.length} holes · {meta.players.map(p => p.name).join(', ')}</div>
            </div>
            {meta.players.map(p => (
              <button key={p.id} className="sheet-item" style={{ margin: '0 0 8px', width: '100%' }} onClick={() => join(p.id)}>
                <span><Icon name="user-circle" fill /> I’m {p.name}</span><Icon name="caret-right" />
              </button>
            ))}
            <button className="sheet-cancel" style={{ width: '100%', margin: '4px 0 0' }} onClick={() => join(null)}>I’m just watching</button>
            {state.me && <p className="field-help" style={{ textAlign: 'center' }}>Picking yourself puts this round in your history and ledger.</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
