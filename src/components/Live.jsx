import { useState } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { getState } from '../lib/store.js';
import { joinRoute } from '../lib/join.js';
import { fetchShared, shareLink, shareRound, stopSharing, useSyncStatus } from '../lib/sync.js';
import { cleanCode } from '../lib/sync-model.js';
import { GAMES } from '../lib/round.js';
import { useNav } from '../lib/nav.js';

export function LivePill({ round }) {
  const st = useSyncStatus();
  if (!round.shared) return null;
  if (round.shared.ended) return <span className="live-pill ended">Sharing ended</span>;
  const label = st.state === 'offline' ? 'Offline, will sync' : st.state === 'connecting' ? 'Connecting' : 'Live';
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
    const text = `Join my ${GAMES[round.game].name} game at ${round.course.name}. Follow the money live, no download. Code ${code}`;
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
    <Sheet open={open} onClose={onClose} title="Invite the group">
      {!code ? (
        <div style={{ padding: '0 16px' }}>
          <p className="sheet-text" style={{ padding: '0 4px 12px' }}>Let everyone in the group follow along, or keep score from their own phone. Scores sync hole by hole.</p>
          <ul className="onboard-list" style={{ marginTop: 0, marginBottom: 14 }}>
            <li><Icon name="link" fill /> You get a code and a link to send the group.</li>
            <li><Icon name="device-mobile" fill /> Anyone with it can view and enter scores, so only send it to your group.</li>
          </ul>
          <button className="full-btn" disabled={busy} onClick={start}>{busy ? 'Starting…' : <>Get the link <Icon name="broadcast" fill /></>}</button>
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

/**
 * Enter a code, then on to the invite card (the same one a join link opens), where you pick
 * your seat or ask for one. A round already on this phone just opens.
 */
export function JoinSheet({ open, onClose, initialCode = '' }) {
  const nav = useNav();
  const [code, setCode] = useState(cleanCode(initialCode));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const find = async () => {
    setBusy(true); setErr(null);
    const have = joinRoute(getState(), code);
    if (have && have[0] !== 'joinInvite') { setBusy(false); onClose(); nav.push(...have); return; }
    try {
      const remote = await fetchShared(code);
      if (!remote) setErr('No round with that code. Check it with the scorekeeper.');
      else { onClose(); nav.push('joinInvite', { code }); }
    } catch (e) { setErr(e.message || 'Couldn’t reach the server. Check your signal.'); }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Join a round">
      <div style={{ padding: '0 16px' }}>
        <p className="sheet-text" style={{ padding: '0 4px 12px' }}>Ask the scorekeeper for the 6-character code, or open the link they sent.</p>
        <label className="sr-only" htmlFor="join-code">Round code</label>
        <input id="join-code" className="code-input" value={code} onChange={e => { setCode(cleanCode(e.target.value)); setErr(null); }}
          placeholder="ABC123" autoCapitalize="characters" autoCorrect="off" autoComplete="off" inputMode="text" maxLength={8} />
        {err && <p className="field-error" style={{ textAlign: 'center' }}>{err}</p>}
        <div style={{ marginTop: 14 }}><button className="full-btn" disabled={code.length !== 6 || busy} onClick={find}>{busy ? 'Finding…' : 'Find round'}</button></div>
      </div>
    </Sheet>
  );
}
