// Who can open the Season view on the Tab, and on what terms. Pure, so it's easy to test.
// Pro entitlements don't exist yet (nothing is charged and no payment provider is wired up),
// so for now every organizer gets the preview and everyone else gets nothing Pro at all.
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
 * Season access for this phone:
 * - 'pro': this phone's owner has Pro (never tonight, see TODO below)
 * - 'group': an organizer of these rounds has Pro, so their group sees it for those rounds (never tonight)
 * - 'preview': an organizer without Pro sees a preview of their own season
 * - 'none': invited players, who never see anything Pro
 */
export function seasonAccess(state, rounds = Object.values(state?.rounds || {})) {
  // TODO(pro): real entitlements. Return 'pro' when state has an active paid plan (the trial preview isn't one).
  if (groupHasPro(rounds)) return { access: 'group' };
  if (isOrganizer(state)) return { access: 'preview' };
  return { access: 'none' };
}
