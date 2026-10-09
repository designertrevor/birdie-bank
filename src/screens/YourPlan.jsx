// Your plan (Settings, with the paywall flag on): the plan you're on, your receipts and Cancel plan,
// and the cancel screen, which shows the group its own numbers before anyone goes (the way Strava's
// does). UI only: there are no payments yet, so nothing here calls a payment provider, the receipts
// list is empty and "Cancel anyway" only explains that nothing is charged.
// TODO(pro): once Stripe is wired up, pass the account's subscription to currentPlan, list its
// receipts, and have "Cancel anyway" end the plan at the end of what's paid for.
import { useMemo } from 'react';
import { Empty, Header, Icon, Screen, useUI } from '../components/ui.jsx';
import { StatTile } from '../components/DataCards.jsx';
import { FreePromiseList } from '../components/FreePromise.jsx';
import { update, useStore } from '../lib/store.js';
import { useNav } from '../lib/nav.js';
import { PAYWALL_ON } from '../lib/paywall-flag.js';
import { PLANS, PRICES_ARE_PLACEHOLDERS, REMIND_DAY, priceLabel } from '../lib/paywall.js';
import { currentPlan } from '../lib/entitlements.js';
import { useLifetimePro } from '../lib/pro-client.js';
import { LIFETIME_LINE, sinceLine } from '../lib/lifetime-pro.js';
import { RIVALRY_ROUNDS, bestMomentTile, groupNumbers, numbersLine } from '../lib/plan-numbers.js';
import { money } from '../lib/golf.js';

const DASH = '–';
const day = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function Off({ title }) {
  const nav = useNav();
  return (
    <Screen>
      <Header title={title} onBack={nav.pop} />
      <div className="scroll"><Empty illo="sleep" title="Nothing to see here yet" text="Plans come later. Everything’s on for you until then." /></div>
    </Screen>
  );
}

/** What the plan card says for each plan. */
function planCopy(p, ent) {
  if (p.id === 'lifetime') return { title: 'Pro for life', tag: 'Early tester', text: `${LIFETIME_LINE}. Nothing to pay, ever.`, fine: sinceLine(ent) };
  if (p.id === 'trial') {
    return {
      title: 'Pro trial',
      tag: `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'} left`,
      text: `Then ${p.plan.label} at ${priceLabel(p.plan)}, from ${day(p.ends)}. We remind you on day ${REMIND_DAY}.`,
      fine: 'Nothing is charged yet.',
    };
  }
  if (p.id === 'annual' || p.id === 'monthly') {
    return { title: `Pro ${p.plan.label}`, tag: null, text: priceLabel(p.plan), fine: p.renews ? `Renews ${day(p.renews)}` : null };
  }
  return { title: 'Free', tag: null, text: 'Every game, live scores, the Tab and settling up. Free for good.', fine: null };
}

export default function YourPlan() {
  const nav = useNav();
  const state = useStore();
  const ent = useLifetimePro();
  const p = currentPlan(state, { lifetime: ent.lifetime });
  if (!PAYWALL_ON) return <Off title="Your plan" />;
  const c = planCopy(p, ent);
  // The trial's plan can change before it starts; Pro for life and Free have nothing to switch
  const other = p.id === 'trial' ? Object.values(PLANS).find(x => x.id !== p.plan.id) : null;
  return (
    <Screen className="your-plan">
      <Header title="Your plan" onBack={nav.pop} />
      <div className="scroll">
        <div className={`block yp-card ${p.pro ? 'pro' : ''}`}>
          <div className="yp-top">
            <span className="yp-badge" aria-hidden="true"><Icon name={p.id === 'free' ? 'flag-pennant' : 'star'} fill /></span>
            {c.tag && <span className="yp-tag">{c.tag}</span>}
          </div>
          <div className="yp-title d">{c.title}</div>
          <p className="yp-text">{c.text}</p>
          {c.fine && <p className="yp-fine">{c.fine}</p>}
          {p.id === 'free' && <button className="pill-btn dark yp-act" onClick={() => nav.push('paywall', { source: 'settings' })}>See what Pro adds <Icon name="arrow-right" /></button>}
        </div>
        {other && (
          <button className="set-row" onClick={() => update(st => { st.paywall = { ...(st.paywall || {}), plan: other.id }; })}>
            <div className="set-icon"><Icon name="arrows-left-right" fill /></div>
            <div className="row-main"><div className="set-name">Switch to {other.label}</div><div className="set-sub">{priceLabel(other)} after the trial</div></div>
            <span className="chevron"><Icon name="caret-right" /></span>
          </button>
        )}

        <div className="sec-label">Receipts</div>
        <div className="block yp-empty">
          <span className="yp-empty-ic" aria-hidden="true"><Icon name="receipt" /></span>
          <div className="row-main">
            <div className="yp-empty-title">No receipts yet</div>
            <div className="li-sub">Nothing has been charged. Each payment shows here once plans start.</div>
          </div>
        </div>
        {PRICES_ARE_PLACEHOLDERS && p.id !== 'lifetime' && <p className="field-help pad">Preview: prices aren’t final and nothing is charged.</p>}
        {p.cancel && <button className="link-btn yp-cancel" onClick={() => nav.push('cancelPlan')}>Cancel plan</button>}
      </div>
    </Screen>
  );
}

/**
 * Before anyone cancels: the group's own numbers from the rounds on this phone, what they keep on
 * Free, "Keep my plan" first and a quiet "Cancel anyway".
 */
export function CancelPlan() {
  const nav = useNav();
  const state = useStore();
  const { ask } = useUI();
  const n = useMemo(() => groupNumbers(state), [state]);
  if (!PAYWALL_ON) return <Off title="Cancel plan" />;
  const line = numbersLine(n);
  const best = bestMomentTile(n.best);
  const s = n.settled;
  const cancelAnyway = () => ask({
    title: 'Nothing to cancel yet',
    text: 'Payments aren’t set up, so nothing has been charged and nothing will be. Once they are, this ends your plan at the end of what you’ve paid for, and everything on the free list stays.',
    actions: [], cancelLabel: 'OK',
  });
  return (
    <Screen className="cancel-plan">
      <Header title="Cancel plan" onBack={nav.pop} />
      <div className="scroll">
        <div className="cp-hero">
          <div className="eyebrow">Your group so far</div>
          <h1 className="cp-title d">{line ? `${line}.` : 'Your group’s just getting going.'}</h1>
          <p className="cp-lead">{line ? 'All of it stays, whatever you pick.' : 'Your rounds, rivalries and settle-ups show here as you play.'}</p>
        </div>
        <div className="stat-grid">
          <StatTile label="Rounds" value={String(n.rounds)} sub="Finished, on this phone" />
          <StatTile label="Rivalries" value={String(n.rivalries)} sub={`Friends with ${RIVALRY_ROUNDS}+ rounds together`} />
          <StatTile label="Settled" value={!s.count ? DASH : s.shown ? money(s.cents / 100) : String(s.count)}
            sub={!s.count ? 'Payments squared on the Tab' : s.shown ? `${s.count} ${s.count === 1 ? 'payment' : 'payments'}` : `${s.count === 1 ? 'Payment' : 'Payments'}. Your money is hidden in Privacy`} />
          <StatTile label="Best moment" long value={best ? best.value : DASH} sub={best ? best.sub : 'A low round or a big skins day'} />
        </div>
        <div className="sec-label">What you keep on Free</div>
        <div className="block">
          <FreePromiseList />
        </div>
      </div>
      <div className="cta-wrap">
        <button className="full-btn" onClick={nav.pop}>Keep my plan</button>
        <button className="link-btn center" onClick={cancelAnyway}>Cancel anyway</button>
      </div>
    </Screen>
  );
}
