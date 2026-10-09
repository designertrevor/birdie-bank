// The paywall at the end of organizer onboarding. UI only: nothing is charged and no payment
// provider is wired up yet, so both buttons just record the answer and move on. Each design is
// a variant (see VARIANTS in lib/paywall.js); add a view to VIEWS below to test another one.
import { useEffect, useState } from 'react';
import { Header, Icon, PickMark, Screen, useUI } from '../components/ui.jsx';
import { getState, update } from '../lib/store.js';
import { track } from '../lib/analytics.js';
import { useNav } from '../lib/nav.js';
import { GAMES } from '../lib/round.js';
import { useLifetimePro } from '../lib/pro-client.js';
import { LIFETIME_LINE } from '../lib/lifetime-pro.js';
import {
  DEFAULT_PLAN, PLANS, PRICES_ARE_PLACEHOLDERS, PRO_FEATURES, REMIND_DAY, TRIAL_DAYS, VARIANTS,
  annualSavings, freePromise, paywallAnswer, perMonthLabel, trialCta, trialLine, trialTimeline, variantFor,
} from '../lib/paywall.js';

export default function Paywall({ source = 'onboarding' }) {
  const nav = useNav();
  const { showToast } = useUI();
  // One variant per phone, kept once it's picked, so an A/B test can compare them later
  const [variant] = useState(() => variantFor(getState(), getState().me || 'anon') || 'c');
  useEffect(() => { track('paywall_viewed', { source, variant }); }, [variant, source]);
  useEffect(() => {
    if (getState().paywall?.variant === variant) return;
    update(st => { st.paywall = { ...(st.paywall || {}), variant, shownAt: Date.now(), source }; });
  }, [variant, source]);
  const [plan, setPlan] = useState(DEFAULT_PLAN);

  const answer = choice => {
    update(st => { st.paywall = { ...(st.paywall || {}), ...paywallAnswer({ variant, choice, plan, source }) }; });
    track('plan_picked', { choice, plan, variant, source });
    showToast(choice === 'trial'
      ? (PRICES_ARE_PLACEHOLDERS ? 'Pro trial preview on. Nothing is charged.' : `Pro trial on. We’ll remind you on day ${REMIND_DAY}.`)
      : 'You’re on Free. Your round still works.');
    nav.pop();
  };

  // An early tester with Pro for life never sees the paywall: a thank-you in its place, in case a
  // route still points here (the onboarding check skips it once the account has been read)
  const { lifetime } = useLifetimePro();
  if (lifetime) return <LifetimeThanks onClose={() => nav.pop()} />;

  const View = VIEWS[variant] || VIEWS.c;
  // From Settings or the Season preview it's a look at Pro, so it closes without an answer. After onboarding, "Keep scoring for free" is the way out
  const onClose = source !== 'onboarding' ? () => nav.pop() : null;
  return <View plan={plan} setPlan={setPlan} onClose={onClose} onTrial={() => answer('trial')} onFree={() => answer('free')} freeWayOut={VARIANTS[variant]?.freeWayOut ?? true} />;
}

/**
 * C: "Trial with a free way out". The trial timeline, the plans, the free promise and a full free
 * button. The trial is the same on both plans; the one picked says what comes after it, on its
 * row, on the timeline's last step and under the button.
 */
function TrialWithFreeWayOut({ plan, setPlan, onClose, onTrial, onFree, freeWayOut }) {
  const [start] = useState(() => new Date());
  const picked = PLANS[plan] || PLANS[DEFAULT_PLAN];
  const steps = trialTimeline(start, { planned: Object.values(getState().plans || {}).some(p => p.host), plan: picked });
  const cta = trialCta(picked);
  const save = annualSavings();
  const games = Object.keys(GAMES).length;
  return (
    <Screen className="paywall">
      {onClose && <Header title="" onClose={onClose} />}
      <div className="scroll">
        <div className="pw-hero">
          <div className="pw-badge"><Icon name="star" fill /></div>
          <h1 className="pw-title d">Try Pro free for {TRIAL_DAYS} days</h1>
          <p className="pw-lead">That covers your next round, and the one after.</p>
        </div>

        <div className="block pw-free">
          <div className="eyebrow">Free forever, trial or not</div>
          <ul className="pw-list">
            {freePromise(games).map(t => <li key={t}><Icon name="check-circle" fill /> {t}</li>)}
          </ul>
          <p className="li-sub" style={{ marginTop: 8 }}>Nothing on this list ever moves to Pro. Friends you invite never pay.</p>
        </div>

        <ol className="block pw-timeline" aria-label="How the free trial works">
          {steps.map((s, i) => (
            <li key={s.key} className={`pw-step ${i === 0 ? 'now' : ''}`}>
              <span className="pw-dot"><Icon name={s.icon} fill={i > 0} /></span>
              <div>
                <div className="pw-step-title">{s.title}{s.when && <span className="pw-when"> · {s.when}</span>}</div>
                <div className="li-sub">{s.text}</div>
              </div>
            </li>
          ))}
        </ol>

        <div className="sec-label" id="pw-plans">Pick a plan</div>
        <div role="radiogroup" aria-label="Pick a plan" style={{ padding: '0 16px' }}>
          {Object.values(PLANS).map(p => {
            const on = plan === p.id;
            return (
              <button key={p.id} role="radio" aria-checked={on} aria-label={`${p.label}, ${trialLine(p)}${p.per === 'year' ? `, ${perMonthLabel(p)}, save ${save}%` : ''}`} className={`list-item pick pw-plan ${on ? 'on' : ''}`} onClick={() => setPlan(p.id)}>
                <div className="row-main">
                  <div className="li-name">{p.label} {p.per === 'year' && <span className="pw-save">Save {save}%</span>}</div>
                  <div className="li-sub">{trialLine(p)}{p.per === 'year' ? ` (${perMonthLabel(p)})` : ''}</div>
                </div>
                <PickMark on={on} add={false} />
              </button>
            );
          })}
        </div>

        <div className="sec-label">What Pro adds</div>
        <ul className="block pw-list">
          {PRO_FEATURES.map(f => <li key={f.text}><Icon name={f.icon} fill /> {f.text}</li>)}
        </ul>

        {PRICES_ARE_PLACEHOLDERS && <p className="field-help pad">Preview: prices aren’t final and nothing is charged.</p>}
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={onTrial}>{cta.button} <Icon name="arrow-right" /></button>
        {freeWayOut && <button className="full-btn outline" onClick={onFree}>Keep scoring for free</button>}
        <p className="pw-fine">{cta.fine}</p>
      </div>
    </Screen>
  );
}

const VIEWS = { c: TrialWithFreeWayOut };

/** Pro for life: nothing to pick and nothing to pay. */
function LifetimeThanks({ onClose }) {
  return (
    <Screen className="paywall">
      <Header title="" onClose={onClose} />
      <div className="scroll">
        <div className="pw-hero">
          <div className="pw-badge"><Icon name="star" fill /></div>
          <h1 className="pw-title d">You’ve got Pro for life</h1>
          <p className="pw-lead">{LIFETIME_LINE}. Nothing to pay, ever.</p>
        </div>
      </div>
      <div className="cta-wrap"><button className="full-btn" onClick={onClose}>Back to it</button></div>
    </Screen>
  );
}
