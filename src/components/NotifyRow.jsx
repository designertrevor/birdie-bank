// Settings: turn notifications on or off on this phone (push-client.js), and under it the Which
// ones row, which opens a screen of switches, one per kind of push (push-prefs.js), saved on your
// account. Hidden without push switched on or where web push can't work; on an iPhone in the
// browser it says how to get them.
import { Header, Icon, Screen, Toggle, useUI } from './ui.jsx';
import { useNav } from '../lib/nav.js';
import { notifyRow, pushConfigured, setMuted, turnOff, turnOn, useNotify } from '../lib/push-client.js';
import { PUSH_GROUPS, groupOn, picksLine, setGroup } from '../lib/push-prefs.js';

function Row({ signedIn }) {
  const nav = useNav();
  const { busy, muted } = useNotify();
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
      {/* Which ones goes with the account, so it shows whenever this phone could get them, on here or not */}
      {signedIn && !row.disabled && (
        <button className="set-row" onClick={() => nav.push('notifyPicks')}>
          <div className="set-icon"><Icon name="bell-ringing" fill /></div>
          <div className="row-main"><div className="set-name">Which ones</div><div className="set-sub">{picksLine(muted)}</div></div>
          <span className="chevron"><Icon name="caret-right" /></span>
        </button>
      )}
    </>
  );
}

export function NotifyRow({ signedIn }) {
  return pushConfigured ? <Row signedIn={signedIn} /> : null;
}

/** Settings, Notifications, Which ones: a switch per kind of push. A pushed screen, so Stage gives it its exit. */
export function NotifyPicks() {
  const nav = useNav();
  const { muted } = useNotify();
  return (
    <Screen>
      <Header title="Which ones" onBack={nav.pop} />
      <div className="scroll">
        <div className="sec-label">Pushes you get</div>
        {PUSH_GROUPS.map(g => (
          <div key={g.id} className="toggle-row">
            <div><div className="toggle-lbl" id={`np-${g.id}-lbl`}>{g.label}</div><div className="toggle-sub" id={`np-${g.id}-sub`}>{g.sub}</div></div>
            <Toggle on={groupOn(muted, g.id)} onChange={on => setMuted(setGroup(muted, g.id, on))} labelledBy={`np-${g.id}-lbl`} describedBy={`np-${g.id}-sub`} />
          </div>
        ))}
        <p className="hint-card"><Icon name="devices" fill /> These hold on every phone you’re signed in on. Turning notifications off on a phone stops all of them there.</p>
      </div>
    </Screen>
  );
}
