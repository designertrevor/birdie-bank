// Settings: turn notifications on or off on this phone (push-client.js). Hidden without push
// switched on or where web push can't work; on an iPhone in the browser it says how to get them.
import { Toggle, useUI } from './ui.jsx';
import { notifyRow, pushConfigured, turnOff, turnOn, useNotify } from '../lib/push-client.js';

function Row({ signedIn }) {
  const { busy } = useNotify();
  const { showToast } = useUI();
  const row = notifyRow(signedIn);
  if (!row.show) return null;
  const change = async on => {
    if (!on) { await turnOff(); return; }
    const r = await turnOn();
    if (r === 'denied') showToast('Your browser said no. Allow notifications for this site in its settings');
    else if (r === 'failed') showToast('Couldn’t turn them on here. Try again in a bit');
  };
  return (
    <>
      <div className="sec-label">Notifications</div>
      <div className="toggle-row">
        <div><div className="toggle-lbl" id="notify-lbl">On this phone</div><div className="toggle-sub" id="notify-sub">{row.sub}</div></div>
        <Toggle on={row.on} disabled={row.disabled || busy} onChange={change} labelledBy="notify-lbl" describedBy="notify-sub" />
      </div>
    </>
  );
}

export function NotifyRow({ signedIn }) {
  return pushConfigured ? <Row signedIn={signedIn} /> : null;
}
