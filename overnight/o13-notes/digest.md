# O13 digest: the weekly feedback digest (roadmap area 20)

## What I picked, and why

An admin-only **Digest screen in the app**, plus a **Monday push** to Trevor that opens it.
No email (SMTP isn't set up), no Slack, no new service. The screen works the moment the SQL runs;
the push works once push is on in Vercel (it already is for the tee time reminder).

- Opens at `/?digest` (that's also where the Monday push goes), or Settings, "Feedback digest"
  (the row shows only for an admin account).
- Lists every "Suggest something" message from the last 7 days (toggle: last 30 days), grouped by
  theme: New games, Courses, Money and the Tab, History and stats, Trips and planning, Friends and
  groups, Invites, Leagues, Notifications, Profiles, Scoring, then Something broken and Everything
  else. Course requests and game and feature ideas are all feedback rows, so "requests" are in it.
  After-round reactions (Great, Just OK) are a one-line count, not items to approve.
- Each idea: what they wrote, the form's second answer (rules, city, why), how long ago, a roadmap
  area picker (pre-filled with the theme's guess), an optional "Note for Claude", and **Approve** or
  **Skip** (with Undo).
- Approved ideas wait in a green card at the top: **Copy for Claude** copies a note grouped by area
  (each line has the idea's words, kind, day, Trevor's note and its id). Paste it into a Claude
  session, which adds each one to ROADMAP.md as a new line in its area with a step tag. Then **Mark
  added** clears them.

There was no admin check anywhere in the app before (Trevor set roadmap columns in the Dashboard),
so this adds one: an `app_admins` table. **Admin access is enforced on the server**: both new tables
are revoked from anon and authenticated, and every digest function is `security definer` and starts
with `digest_admin_check()`, which raises 42501 for anyone not in `app_admins`. Hiding the Settings
row is only a convenience. The digest never returns the contact field or device details (the
Dashboard still has them).

## Files

- `supabase/2026-10-12-feedback-digest.sql`: app_admins, feedback_digest, digest_is_admin,
  digest_feedback, digest_decide, digest_approved, digest_mark_added, push_digest_due.
- `src/lib/digest.js` (themes, grouping, the copy note, the push text), `src/lib/digest.test.js`.
- `src/lib/digest-sync.js` (server calls, the Settings row's admin check).
- `src/screens/Digest.jsx`, `src/screens/digest.css` (lazy chunk, 2.7 kB gzip; first screen unchanged at 380 kB).
- `src/lib/digest-server.js`, `api/push-digest.js`, `vercel.json` (cron `0 15 * * 1`, Mondays 15:00 UTC).
- `src/App.jsx` (the `?digest` link and screen), `src/screens/Settings.jsx` (the admin-only row).

## Steps for Trevor

1. Run `supabase/2026-10-12-feedback-digest.sql` in the SQL Editor.
2. Make yourself the admin. Replace the email with your account's and run:
   `insert into public.app_admins (user_id) select id from auth.users where email = 'YOUR-ACCOUNT-EMAIL' on conflict do nothing;`
   (I kept your email out of the repo on purpose.)
3. Open `/?digest` on your phone, signed in. Until step 1, it says the digest isn't set up yet.
4. Nothing new in Vercel: the Monday push uses the same `CRON_SECRET`, VAPID and service role keys as
   the tee time reminder. To stop the push but keep the screen: `update public.app_admins set weekly_push = false;`

## Decisions made for Trevor

- Delivery: **in-app Digest screen + Monday push** (picked) vs a Slack post (no Slack yet) vs email
  (no SMTP) vs a Claude scheduled task reading Supabase (needs a service key outside Vercel).
- How approved items reach ROADMAP.md: **a "Copy for Claude" note, then Mark added** (picked) vs the
  app editing ROADMAP.md through GitHub (needs a GitHub token on the server, and builders and
  public roadmap ids key on that file, so a person should look first).
- Admin check: **new app_admins table, filled by hand** (picked) vs a hard-coded email in SQL or the
  app (bakes personal data into the repo, harder to change).
- Time window: **last 7 days with a 30-day switch** (picked), so a missed Monday isn't lost.
- Bugs are in the digest too (their own group, area 20 by default); reactions are only counted.

## Not done / notes for the lead

- Not checked in the browser (house rule); the QA agent should open `/?digest` signed out, signed in
  as a non-admin (should say "Not for this account") and, if possible, as the admin.
- `vercel.json` gets a second cron here; the shippush branch adds one too, so merge both lines.
  Vercel Hobby allows only daily-or-slower crons, which a weekly one is.
- Theme grouping is keyword based and rough on purpose; the area picker fixes any wrong guess.
