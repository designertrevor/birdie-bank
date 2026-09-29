// Who can open the Season view on the Tab, and on what terms. Pure, so it's easy to test.
// Until launch nothing is held back: with the paywall flag off (production today) everyone who has
// played gets the full Season view, no Pro labels. Early testers help shape the app, so they get it
// all (Trevor, 2026-09-29). The Pro split for launch is PRO_FEATURES in paywall.js; with the flag on,
// the gated version below (organizer preview, invited players nothing) is still here to design with.
import { isOrganizer } from './paywall.js';

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
 * - 'pro': this phone's owner has Pro (never tonight, see TODO below)
 * - 'group': an organizer of these rounds has Pro, so their group sees it for those rounds (never tonight)
 * - 'preview': an organizer without Pro sees a preview of their own season
 * - 'none': invited players, who never see anything Pro
 */
export function seasonAccess(state, rounds = Object.values(state?.rounds || {}), { gated = true } = {}) {
  if (!gated) return { access: 'open' };
  // TODO(pro): real entitlements. Return 'pro' when state has an active paid plan (the trial preview isn't one).
  if (groupHasPro(rounds)) return { access: 'group' };
  if (isOrganizer(state)) return { access: 'preview' };
  return { access: 'none' };
}
