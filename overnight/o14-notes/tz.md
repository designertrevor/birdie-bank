# Overnight 14: reminders in each person's time zone (roadmap area 25)

Branch `o14/tz`. Not pushed, not shipped.

## What was built

- **Each phone saves its time zone.** When the app saves your push subscription (turning
  notifications on, every launch, every sign-in) it now sends the phone's IANA zone too
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`, checked by `cleanZone`). Whenever the app
  comes back to the front it checks the zone again, and saves once more if it changed (a trip or
  a move). Before the SQL runs the save just goes without the zone, so nobody loses pushes.
  `src/lib/push-client.js`.
- **The tee time job runs every hour** and reminds only the organizers whose own clock reads 8
  (8:00 to 8:59), with "today" as their own calendar says it. It asks the database which zones the
  subscriptions are in (`push_tee_zones`), works out which ones are at 8 right now and what day it
  is there (`teeDays` in `src/lib/push-zones.js`), and hands that to `push_tee_due`, which picks
  each organizer by the zone of their **newest** phone (the one saved last). The once-per-plan
  mark in `push_sends` is unchanged, so moving zones, or the job running twice, never sends a plan
  twice. `src/lib/push-server.js`, `api/push-tee.js`.
- **No more "UTC minus 7".** `api/push-tee.js` used `Date.now() - 7h` as "today". Gone.
- **Before the SQL runs** the hourly job keeps working the old way: Utah's day, in Utah's 8 o'clock
  hour (it was 15:00 UTC, so 9 am in summer and 8 am in winter; now it's 8 am all year).
- Half-hour zones (India, Newfoundland, Adelaide) get it at 8:30, since the job runs on the hour.
- An organizer with no phone on is skipped and the plan isn't marked sent (before, it was marked
  and lost), so turning notifications on before the round still gets the reminder.
- Tests: `src/lib/push-zones.test.js` (11 tests: zones west and east of UTC, Honolulu and
  Kiritimati at 8 at the same moment on different days, Samoa and American Samoa, US, UK, Australia
  and New Zealand DST change days, every zone gets exactly one 8 o'clock hour on each of those
  days, half-hour zones, bad zone names, and the once-per-plan rule: a Tokyo to Denver flight that
  meets a second 8 am, a second run in the same hour, two phones in two zones). Three tests in
  `src/lib/push-server.test.js` replace the old daily one (zones at 8, an hour with nobody at 8,
  the fallback before the SQL). Full suite: 2416 pass. Lint clean.

## SQL to run

`supabase/2026-10-20-push-timezones.sql`, once, in the Supabase SQL Editor. Safe to run again.
It adds `push_subscriptions.time_zone` (default `'America/Denver'`, so every existing row is Utah),
a trigger that turns a malformed zone into the row's old zone or Denver instead of failing the save,
`push_tee_zones()`, and `push_tee_due(p_days jsonb)` next to the old `push_tee_due(text)`, with a
lock so two runs can't overlap. Service role only, like before. If `2026-10-08-push.sql` or
`2026-10-08-push-prefs.sql` is ever run again, run this one again after it.

Order: either is fine. Code first: the hourly job sends on Utah's day and clock until the SQL
runs. SQL first: the old daily job keeps calling `push_tee_due(text)`, which the SQL leaves in
place. Once both are live the old function is unused; the header has the one line to drop it
later.

## The cron change

`vercel.json`: `/api/push-tee` goes from `"0 15 * * *"` (once a day) to `"0 * * * *"` (every
hour). Still one cron, nothing to click in Vercel; it ships with the code. That's 720 runs a
month instead of 30, each a couple of database calls, which sits well inside Vercel Pro's
included usage. The SQL file's header says the same.

## How to check by hand

After the SQL runs and a phone or two have opened the app:

```sql
select time_zone, count(*) as phones, max(updated_at) as last_saved
  from public.push_subscriptions group by time_zone order by phones desc;
```

Each organizer's zone, the one the job uses (their newest phone):

```sql
select distinct on (user_id) user_id, time_zone, updated_at
  from public.push_subscriptions order by user_id, updated_at desc;
```

Reminders sent, newest first: `select code, caller, at from public.push_sends where kind = 'tee' order by at desc limit 20;`

To watch one go: set a plan's reminder day to today, leave it unbooked, and wait for the next
run after 8:00 your time (Vercel, the project, Cron Jobs shows each run and lets you run it now;
a run outside your 8 o'clock hour sends nothing, by design).

## Other time-of-day code I checked

- **Up next's tee time card, the countdowns ("Today, in 3 hours"), the reminder day picker,
  "Tomorrow" on the card, the morning-of text:** all run on the phone with its own clock
  (`new Date()`, local getters in `plan-basics.js`, `countdown.js`, `tee-reminders.js`). Already
  the person's zone. Nothing to fix.
- **A day-after recap push:** doesn't exist yet; nothing to fix.
- **Push text** names the weekday from the plan's date as written (`weekday` in
  `push-events.js`), never "today" or "tomorrow", so the server's zone can't make it wrong.
- Left alone on purpose: `course-quota.js` counts GolfCourseAPI calls by UTC day (the API's own
  day); `feedback.js` files screenshots under a UTC date folder (only Trevor sees it).
- Left alone, small mismatches between the card and the push (both from before): the card treats a
  reminder day set after the round as the day before it, and the push doesn't (it never sends for
  that plan); "Tomorrow" on the card snoozes only the card, the push ignores it.

## Risks

- The job now runs every hour; if a run is skipped (a Vercel hiccup), that zone's reminder waits
  until the next morning, and a plan whose reminder day is the round day misses it. Before, a
  skipped daily run had the same effect for everyone.
- "Newest phone" is the phone that saved last, which is the one opened last. Someone who opens an
  old iPad at home while travelling gets home time. Rare, and it fixes itself next time they
  open the phone.
- If the zones lookup fails in some hour after the SQL has run (a database hiccup), that run
  falls back to the old Utah-day send through `push_tee_due(text)`, but only in Utah's 8 o'clock
  hour. Nothing goes twice (the same sent mark), but an organizer elsewhere could get theirs at
  Utah's 8 that day. Dropping `push_tee_due(text)` once the code is live removes this.
- A zone name Node doesn't know is read on Utah's clock (under its own name), so it still goes,
  just maybe at the wrong hour. Real browsers only report real zones.
- Old browsers can report a legacy alias ("Asia/Calcutta", "US/Mountain"); both Node and Postgres
  accept those, and the tests cover the shape.

## Questions for Trevor

1. **What hour should the tee time reminder land?**
   - a) 8 am **(Suggested)**: before work and before most tee sheets get busy
   - b) 7 am: earlier, but some people sleep through it
   - c) 9 am: gentler, but Saturday morning tee times may already be gone
   - d) Let each organizer pick in Settings (more to build)
2. **Someone with several phones in different zones: whose clock?**
   - a) The phone they opened last **(Suggested, built)**
   - b) The zone of the course they're playing (we'd need the course's zone; better for trips)
   - c) The zone of the phone that made the plan
3. **Should the reminder skip quiet days?** Right now it goes at 8 on the reminder day whatever day that is.
   - a) Keep it simple, 8 am every day **(Suggested)**
   - b) On weekends, 9 am instead
   - c) Never on the round day itself, send the day before instead
