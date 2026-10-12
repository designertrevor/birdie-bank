# Paywall rules (task 3, roadmap area 11)

Branch `o13/paywall`. Everything here is behind the paywall flag (`?paywall=on`); with it off the app
behaves as before (the guard returns "allowed", the reminder card never renders, Your plan stays the
"Nothing to see here yet" screen).

## What's built

- **One entitlement check** in `src/lib/entitlements.js`:
  - `hasPro(state, { lifetime, subscription, now })`: true on the trial, a paid plan or Pro for life.
  - `canUsePro(state, { gated, lifetime, subscription, now })`: the feature gate. Always true with the
    flag off (`gated` false), else `hasPro`. `gated` defaults to true so a caller that forgets the flag
    never unlocks Pro by mistake.
  - React: `useCanUsePro()` in `src/lib/pro-client.js` (fills in `PAYWALL_ON` and Pro for life).
    Outside React: `canUseProNow()` / `hasProNow()` there too.
  - `seasonAccess` now reads `hasPro`, so the trial gets the whole Season (was the preview).
    `isPro` stays as "paid or lifetime" for the plan screens only.
  - **For split and records:** gate with `useCanUsePro()` (or `canUsePro(state, { gated: PAYWALL_ON, lifetime })`).
- **Trial timeline in Your plan** (`src/lib/trial.js` `trialProgress`, `screens/YourPlan.jsx`): "Day N of
  14" with a bar and days left, then Day 1, the reminder day and Day 14 with its date and "Then $49.99 a
  year, unless you cancel". The plan card's fine print is the charge notice (end date and price).
- **Reminder before the end** (`trialReminder`, `components/TrialReminderUpNext.jsx`): a card at the
  front of Up next's pile from day 12 (never later than 2 days before the end, `REMIND_LEAD_DAYS`) until
  the trial ends: "Your Pro trial ends in 2 days", the end date and the price, See your plan or Got it
  (put away for this trial only). Never while a round is live, never with Pro for life.
- **Upsell guard** (`src/lib/upsell-guard.js`, tested): `upsellAllowed(state, { gated })` is false while
  any round is live. `App.jsx` runs every `push`, `replace`, `reset` and the restored-after-cold-start
  stack through it, dropping `paywall` (the `UPSELL_ROUTES` set; add any new Pro sheet there). Season
  hides "Try free for 14 days" and Your plan hides "See what Pro adds" while a round is live, so no tap
  silently does nothing.
- **Never a surprise charge**: `chargeNotice` (always the end date and price) and `safeToCharge(paywall,
  now)`: false until the trial has ended AND the reminder was shown at least 2 days before the end
  (`remindedAt`, saved when the card first shows). A TODO(pro) for the Stripe side to read it.
- Small: `readFlag` moved to `src/lib/paywall-read-flag.js` (re-exported from paywall.js) so App.jsx and
  Up next can read the flag without loading paywall.js. First screen 381.1 kB of 481 kB (379.7 before).

## How to see it

`?paywall=on`, onboard as an organizer, pick "Start 14 days free". Settings, Your plan shows the
timeline. For the reminder, set `paywall.trialEnds` in the saved state to under 2 days from now (or wait
until day 12). Start a round: the Season "Try free" button and Your plan's "See what Pro adds" go away
and the paywall can't open until the round is finished.

## Decisions made for Trevor

1. **Push for the reminder**: options were (a) a server cron push, (b) a local notification from the
   service worker, (c) in-app only. **Picked (c).** The trial lives only on the phone (no payments, no
   account row), so a server job has nothing to read; a local notification only fires with the app open,
   which is what the card already does. When Stripe lands, its `trial_will_end` webhook (3 days before)
   is the natural trigger for a real push.
2. **What counts as "a round is live"**: (a) any round marked active, forever, (b) active or being fixed,
   started in the last 24 hours. **Picked (b)** (`LIVE_HOURS = 24`), so a forgotten round from last
   week doesn't hide Pro for good.
3. **Does the guard block user taps too, or only pop-ups?** **Picked: both** (the brief asks for any
   paywall, upsell or Pro sheet); the buttons hide during a round so nothing looks broken.
4. **Trial gets the whole Season** instead of the "Preview" banner, since the trial unlocks everything.
5. **Reminder spot**: the front of Up next's card pile (before tee-time and payment reminders), since it
   is about money.
6. **If the reminder never showed** (the phone wasn't opened), `safeToCharge` says wait; the payment side
   should push the trial's end back rather than charge.

## Not done

- No push for the reminder (see decision 1).
- The Settings line still says "Pro trial preview · N days left" (unchanged copy).
- No SQL, no Vercel steps.
