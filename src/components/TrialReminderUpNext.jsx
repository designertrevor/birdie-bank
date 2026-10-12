// The trial reminder on Up next (paywall rules, roadmap area 11): from the reminder day, at least two
// days before the trial ends, a calm card with the end date and the price after it, so nothing is a
// surprise. Never while a round is live (upsell-guard.js), and only with the paywall flag on.
// In-app only: the trial lives on this phone, so there's no server job to push it from yet.
import { useEffect, useState } from 'react';
import { Icon, useFoldAway } from './ui.jsx';
import { useStackCard } from './CardStack.jsx';
import { useNav } from '../lib/nav.js';
import { update, useStore } from '../lib/store.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { useLifetimePro } from '../lib/pro-client.js';
import { upsellAllowed } from '../lib/upsell-guard.js';
import { markReminded, putReminderAway, trialReminder } from '../lib/trial.js';

export function TrialReminderUpNext() {
  const nav = useNav();
  const state = useStore();
  const { lifetime } = useLifetimePro();
  const [now] = useState(() => Date.now());
  const allowed = PAYWALL_ON && upsellAllowed(state, { now });
  const r = PAYWALL_ON ? trialReminder(state, now, { lifetime: lifetime === true, allowed }) : null;
  // When it first showed, kept for the "never a surprise charge" rule (safeToCharge in trial.js)
  const shown = !!r;
  useEffect(() => {
    if (shown && !state.paywall?.remindedAt) update(st => { st.paywall = markReminded(st.paywall); });
  }, [shown, state.paywall?.remindedAt]);
  const waiting = useStackCard({ at: 0, showing: shown });
  const [out, away] = useFoldAway();
  if (!r) return null;
  return (
    <div className={`fold-away ${out ? 'out' : ''}`}>
      <div className={`remind-card trial-rc${waiting ? ' cs-wait' : ''}`} role="status">
        <div className="rc-head">
          <span className="rc-ic" aria-hidden="true"><Icon name="bell" fill /></span>
          <div className="row-main">
            <div className="eyebrow">Your plan</div>
            <div className="rc-title d">{r.title}</div>
            <div className="rc-sub">{r.text}</div>
          </div>
        </div>
        <div className="rc-acts">
          <button className="rc-btn ink" onClick={() => nav.push('yourPlan')}><Icon name="star" /> See your plan</button>
          <button className="rc-btn ghost" onClick={away(() => update(st => { st.paywall = putReminderAway(st.paywall); }))}>Got it</button>
        </div>
      </div>
    </div>
  );
}
