// Who can open the Season view on the Tab, and on what terms. Pure, so it's easy to test.
// Until launch nothing is held back: with the paywall flag off (production today) everyone who has
// played gets the full Season view, no Pro labels. Early testers help shape the app, so they get it
// all (Trevor, 2026-09-29). The Pro split for launch is PRO_FEATURES in paywall.js; with the flag on,
// the gated version below (organizer preview, invited players nothing) is still here to design with.
// Early testers keep Pro for life (lifetime-pro.js, read after sign-in by pro-client.js): they are
// 'pro' everywhere and never see the paywall.
import { DEFAULT_PLAN, PLANS, isOrganizer } from './paywall.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The plan this phone's owner is on, for the plan screen (Settings, Your plan):
 * - 'lifetime': Pro for life, an early tester. Nothing to pay and nothing to cancel.
 * - 'annual' | 'monthly': a paid plan. Never tonight: `subscription` is what the payment
 *   provider will say ({ plan: 'annual' | 'monthly', renews: ms }), and nothing passes one yet.
 *   TODO(pro): pass the account's subscription once Stripe is wired up.
 * - 'trial': the trial preview from the paywall, with the plan they picked and the days left.
 * - 'free': everyone else.
 * Returns { id, pro, plan, daysLeft, ends, renews }: `pro` is whether Pro is on, `plan` the PLANS
 * entry that comes after (or is) it, `cancel` whether there's anything to cancel.
 */
export function currentPlan(state, { lifetime = false, subscription = null, now = Date.now() } = {}) {
  if (lifetime) return { id: 'lifetime', pro: true, plan: null, cancel: false };
  if (subscription && PLANS[subscription.plan]) {
    return { id: subscription.plan, pro: true, plan: PLANS[subscription.plan], renews: subscription.renews ?? null, cancel: true };
  }
  const p = state?.paywall;
  if (p?.choice === 'trial' && p.trialEnds > now) {
    const daysLeft = Math.max(1, Math.ceil((p.trialEnds - now) / DAY));
    return { id: 'trial', pro: true, plan: PLANS[p.plan] || PLANS[DEFAULT_PLAN], daysLeft, ends: p.trialEnds, cancel: true };
  }
  return { id: 'free', pro: false, plan: null, cancel: false };
}

/** Whether Pro is on for this phone's owner: Pro for life or a paid plan. The trial preview isn't. */
export function isPro(state, { lifetime = false, subscription = null } = {}) {
  const id = currentPlan(state, { lifetime, subscription }).id;
  return id === 'lifetime' || id === 'annual' || id === 'monthly';
}

/**
 * Whether an organizer of any of these rounds has Pro, so the round's group sees the season
 * for those rounds. Always false tonight.
 * TODO(pro): real entitlements. Look up each round's organizer (the phone that created it, or the
 * live round's host) and return true when that organizer has an active Pro plan. Open question for
 * Trevor before this turns on: does the group see everyone's season amounts, or only their own?
 * Decision 1 keeps amounts between the two people, and roadmap area 9 keeps dollar amounts private by default.
 */
// eslint-disable-next-line no-unused-vars
export function groupHasPro(rounds) {
  return false;
}

/**
 * Season access for this phone. `gated` is the paywall flag: off, everyone gets 'open'.
 * - 'open': no paywall yet, so the whole Season view with no Pro labels
 * - 'pro': this phone's owner has Pro: Pro for life (an early tester), or a paid plan later
 * - 'group': an organizer of these rounds has Pro, so their group sees it for those rounds (never tonight)
 * - 'preview': an organizer without Pro sees a preview of their own season
 * - 'none': invited players, who never see anything Pro
 */
export function seasonAccess(state, rounds = Object.values(state?.rounds || {}), { gated = true, lifetime = false, subscription = null } = {}) {
  if (!gated) return { access: 'open' };
  // Pro for life, or (once payments are wired up) an active paid plan. The trial preview isn't one.
  if (isPro(state, { lifetime, subscription })) return { access: 'pro' };
  if (groupHasPro(rounds)) return { access: 'group' };
  if (isOrganizer(state)) return { access: 'preview' };
  return { access: 'none' };
}
