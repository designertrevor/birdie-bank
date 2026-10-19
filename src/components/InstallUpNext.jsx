// "Add it to your Home Screen" on Up next, for testers using the app in a phone's browser (the rules
// are in install-card.js). iPhone gets the steps, with "save your rounds first" when the Home
// Screen app would start empty; Android gets Chrome's own Install app when it's ready, else the
// steps. "I've added it" puts it away for good, "Not now" for a week, then a month.
import { useState, useSyncExternalStore } from 'react';
import { Icon, useFoldAway } from './ui.jsx';
import { Spot } from './Spot.jsx';
import { useStackCard } from './CardStack.jsx';
import { SignInSheet } from './Account.jsx';
import { useStore } from '../lib/store.js';
import { accountsEnabled, useAccount } from '../lib/cloud.js';
import { activeRounds } from '../lib/history.js';
import { INSTALL_KEY, installPlatform, iosBrowser, needsSignInFirst, notNow, readPrefs, showInstall } from '../lib/install-card.js';
import { canPrompt, promptInstall, subscribePrompt } from '../lib/install-prompt.js';

const load = () => { try { return readPrefs(localStorage.getItem(INSTALL_KEY)); } catch { return {}; } };
const save = p => { try { localStorage.setItem(INSTALL_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };

function platformNow() {
  if (typeof window === 'undefined') return null;
  const standalone = !!(window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  return installPlatform({ ua: navigator.userAgent, touch: navigator.maxTouchPoints > 1, standalone });
}

export function InstallUpNext() {
  const state = useStore();
  const acct = useAccount();
  const [platform] = useState(platformNow);
  const [prefs, setPrefs] = useState(load);
  const [signingIn, setSigningIn] = useState(false);
  const ready = useSyncExternalStore(subscribePrompt, canPrompt, () => false);
  const showing = showInstall({ platform, onboarded: !!state.onboarded, roundOn: activeRounds(state).length > 0, prefs });
  const waiting = useStackCard({ showing });
  const [out, away] = useFoldAway();
  if (!showing) return null;

  const put = p => { save(p); setPrefs(p); };
  const done = away(() => put({ ...prefs, done: true }));
  const later = away(() => put(notNow(prefs)));
  const hasData = Object.keys(state.rounds || {}).length > 0 || Object.keys(state.players || {}).length > 1;
  const signFirst = needsSignInFirst({ platform, accounts: accountsEnabled, signedIn: !!acct.user, hasData });
  const install = async () => { if ((await promptInstall()) === 'accepted') put({ ...prefs, done: true }); };
  const browser = platform === 'ios' ? iosBrowser(navigator.userAgent) : null;

  const steps = platform === 'ios' ? [
    ...(signFirst ? [{ icon: 'cloud-arrow-up', text: <>Save your rounds first. The Home Screen app starts fresh, so <button className="link-btn" onClick={() => setSigningIn(true)}>sign in</button> to bring them along.</> }] : []),
    { icon: 'export', text: browser === 'chrome' ? <>Tap <b>Share</b> at the top right</> : browser === 'other' ? <>Tap <b>Share</b> in the browser’s menu</> : <>Tap <b>Share</b> at the bottom of Safari</> },
    { icon: 'plus-square', text: <>Scroll down and tap <b>Add to Home Screen</b></> },
    { icon: 'device-mobile', text: <>Open Birdie Bank from your Home Screen</> },
  ] : [
    { icon: 'dots-three-vertical', text: <>Tap the <b>menu</b> at the top right</> },
    { icon: 'download-simple', text: <>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</> },
  ];

  return (
    <div className={`fold-away ${out ? 'out' : ''}`}>
      <div className={`remind-card install-card${waiting ? ' cs-wait' : ''}`} role="status">
        <div className="rc-head">
          <Spot kind="link" size={56} className="rc-spot" />
          <div className="row-main">
            <div className="eyebrow">For your Home Screen</div>
            <div className="rc-title d">Add Birdie Bank to your Home Screen</div>
            <div className="rc-sub">{platform === 'ios'
              ? 'It opens full screen, can send you notifications, and keeps your rounds safe from the browser clearing them.'
              : 'It opens full screen, like any app on your phone.'}</div>
          </div>
        </div>
        {/* Android with Chrome's prompt ready: one tap does it. Otherwise the steps */}
        {platform === 'android' && ready ? null : (
          <ol className="install-steps">
            {steps.map((s, i) => (
              <li key={i}><span className="is-ic" aria-hidden="true"><Icon name={s.icon} /></span><span>{s.text}</span></li>
            ))}
          </ol>
        )}
        <div className="rc-acts">
          {platform === 'android' && ready
            ? <button className="rc-btn ink" onClick={install}><Icon name="download-simple" /> Install app</button>
            : <button className="rc-btn ink" onClick={done}><Icon name="check" /> I’ve added it</button>}
          <button className="rc-btn ghost" onClick={later}>Not now</button>
        </div>
      </div>
      {signingIn && <SignInSheet open onClose={() => setSigningIn(false)} title="Save your rounds" text="Sign in so your rounds, players and the Tab are in the Home Screen app too." />}
    </div>
  );
}
