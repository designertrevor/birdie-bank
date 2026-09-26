import { useState } from 'react';
import { Icon, Sheet } from './ui.jsx';
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from '../lib/cloud.js';

/** Sign in with Google or an emailed link / code. */
export function SignInSheet({ open, onClose, title = 'Save your rounds', text = 'Sign in to keep your rounds, players and tab safe, and pick up on any phone or computer.' }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const run = async fn => {
    setBusy(true); setErr(null);
    try { await fn(); }
    catch (e) { setErr(friendly(e)); }
    setBusy(false);
  };
  const google = () => run(signInWithGoogle); // leaves the page and comes back signed in
  const send = () => run(async () => { await sendEmailCode(email.trim()); setSentTo(email.trim()); });
  const verify = () => run(async () => { await verifyEmailCode(sentTo, code); onClose(); });

  return (
    <Sheet open={open} onClose={onClose} title={sentTo ? 'Check your email' : title}>
      <div style={{ padding: '0 16px' }}>
        {!sentTo ? (
          <>
            <p className="sheet-text" style={{ padding: '0 4px 12px' }}>{text}</p>
            <button className="full-btn outline" disabled={busy} onClick={google}><Icon name="google-logo" /> Continue with Google</button>
            <div className="or-rule" aria-hidden="true"><span>or</span></div>
            <label className="sr-only" htmlFor="si-email">Email</label>
            <input id="si-email" className="text-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="off" value={email}
              onChange={e => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" maxLength={120} />
            <div style={{ marginTop: 10 }}>
              <button className="full-btn" disabled={!validEmail || busy} onClick={send}>{busy ? 'Sending…' : <>Email me a sign-in link <Icon name="envelope-simple" /></>}</button>
            </div>
          </>
        ) : (
          <>
            <p className="sheet-text" style={{ padding: '0 4px 12px' }}>We sent a sign-in link to <strong>{sentTo}</strong>. Tap it on this device. If the email has a 6-digit code, you can enter it here instead.</p>
            <label className="sr-only" htmlFor="si-code">Code</label>
            <input id="si-code" className="code-input" value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(null); }}
              placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            <div style={{ marginTop: 10 }}>
              <button className="full-btn" disabled={code.length !== 6 || busy} onClick={verify}>{busy ? 'Checking…' : 'Sign in'}</button>
            </div>
            <button className="sheet-cancel" style={{ width: '100%', margin: '8px 0 0' }} onClick={() => { setSentTo(null); setCode(''); setErr(null); }}>Use a different email</button>
          </>
        )}
        {err && <p className="field-error" style={{ textAlign: 'center' }}>{err}</p>}
      </div>
    </Sheet>
  );
}

function friendly(e) {
  const m = e?.message || '';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/expired|invalid/i.test(m)) return 'That code didn’t work. Check it, or send a new one.';
  if (/provider is not enabled/i.test(m)) return 'Google sign-in isn’t switched on yet. Use email for now.';
  if (!navigator.onLine || /fetch|network/i.test(m)) return 'No signal. Try again when you’re back online.';
  return m || 'Something went wrong. Try again.';
}

/** One line about where your data lives, for Settings. */
// eslint-disable-next-line react-refresh/only-export-components
export function syncLabel(acct) {
  if (acct.state === 'syncing') return 'Saving…';
  if (acct.state === 'offline') return acct.pending ? `Offline, ${acct.pending} change${acct.pending === 1 ? '' : 's'} will sync` : 'Offline, will sync';
  if (acct.state === 'error') return 'Couldn’t sync. Will keep trying.';
  if (acct.pending) return `${acct.pending} change${acct.pending === 1 ? '' : 's'} to save`;
  return 'Saved to your account';
}

