// "Want a heads-up?": our own ask for notifications, right after you plan a round or join one
// (push-client.js notifyMoment, notify-ask.js decides when). Turn them on goes on to the browser's
// own prompt; Not now backs off. Mounted once in App.jsx; shows nothing without push switched on.
import { useEffect } from 'react';
import { Icon, Sheet, useUI } from './ui.jsx';
import { Spot } from './Spot.jsx';
import { ASK_PREVIEW, answerAsk, bootPush, pushConfigured, useNotify } from '../lib/push-client.js';

const WHAT = [
  ['hand-waving', 'Who’s in, as your group answers'],
  ['flag-checkered', 'When a round you’re in finishes'],
  ['money', 'When someone pays you'],
];

/** A phone's lock screen with one of ours on it, so it's clear what you'd get (no amounts, as promised). */
function LockScreenPreview() {
  return (
    <div className="lock-preview" aria-hidden="true">
      <div className="lp-time d">9:41</div>
      <div className="lp-note">
        <span className="lp-app"><Spot kind="tee" size={30} /></span>
        <span className="lp-words"><b>Birdie Bank</b><span>Mike paid you. You’re all square.</span></span>
        <span className="lp-now">now</span>
      </div>
      <div className="lp-note dim">
        <span className="lp-app"><Spot kind="tee" size={30} /></span>
        <span className="lp-words"><b>Birdie Bank</b><span>Dave and Sam are in for Saturday</span></span>
      </div>
    </div>
  );
}

function NotifySheet() {
  const { asking, busy } = useNotify();
  const { showToast } = useUI();
  useEffect(() => { bootPush(); }, []);
  const answer = async a => {
    const r = await answerAsk(a);
    if (r === 'on') showToast('Notifications are on. Change it any time in Settings');
    else if (r === 'denied') showToast('No problem. You can allow them later in your browser settings');
  };
  return (
    <Sheet open={!!asking} onClose={() => answer('later')} title="Want a heads-up?">
      <p className="sheet-text notify-lede">{asking === 'joined' ? 'We’ll let you know when your round moves, without you checking the app.' : 'We’ll let you know when your group answers, without you checking the app.'}</p>
      <LockScreenPreview />
      <ul className="notify-what">
        {WHAT.map(([icon, text]) => <li key={icon}><Icon name={icon} />{text}</li>)}
      </ul>
      <p className="notify-fine">Invites and tee times too. No amounts on your lock screen, and you can turn them off in Settings.</p>
      <div className="notify-acts">
        <button className="full-btn" disabled={busy} onClick={() => answer('on')}>Turn on notifications</button>
        <button className="link-btn center" onClick={() => answer('later')}>Not now</button>
      </div>
    </Sheet>
  );
}

export function NotifyAsk() {
  return pushConfigured || ASK_PREVIEW ? <NotifySheet /> : null;
}
