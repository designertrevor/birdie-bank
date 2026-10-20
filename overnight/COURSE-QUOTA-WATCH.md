# The GolfCourseAPI quota watch (2026-10-20)

Course search runs through GolfCourseAPI, which allows a fixed number of calls a day: 35 on the free plan (what we're on), 10,000 on Pro ($9.99 a month), 100,000 on Enterprise. Its responses and docs say nothing about how many calls are left, so the app now counts its own and emails you before they run out.

## What happens

- Every search or scorecard that reaches GolfCourseAPI adds one to today's row in a small Supabase table (`course_api_usage`, one row a day, nobody but the server can read it). Repeats of a search are answered by Vercel's cache and don't count, since they never reach the API.
- You get an email, through the same Resend setup as the feedback emails, once a day for each of these:
  - 80% of the day's calls used (28 of 35 on the free plan).
  - The day's calls all used. Searches then answer "rate limited" until midnight UTC (5 pm or 6 pm in Utah, depending on daylight time); courses already picked keep working.
  - The first time GolfCourseAPI itself answers "over the limit". That means our count and the plan's real limit disagree, so the email says to check the quota setting.
- Counting runs beside the API call, so searches are no slower, and if Supabase or Resend is down the search still works and nothing is emailed.

## What you need to do (one time)

1. **Run the SQL in Supabase.** Open https://supabase.com/dashboard/project/yffribkjqvkncmypexfa, click **SQL Editor** in the left sidebar, click **New query**, paste the whole of `supabase/2026-10-20-course-api-usage.sql`, click **Run**. It says "Success. No rows returned". Safe to run twice.
2. Nothing else. There is no new secret: the Supabase service role key (for push) and the Resend keys (for feedback emails) are already in Vercel, and the watch uses those.

## When you upgrade to Pro

1. Upgrade at https://golfcourseapi.com (sign in, Pricing, Pro).
2. In Vercel, open the birdie-bank project, click **Settings**, then **Environment Variables**, click **Add new** (or **Create new**): Key `GOLFCOURSEAPI_DAILY_QUOTA`, Value `10000`, environments Production and Preview ticked, **Save**.
3. Redeploy so the function sees it: **Deployments**, the three dots on the top deployment, **Redeploy**. Until this is set the watch assumes the free plan's 35, so after an upgrade it would email at 28 calls even though the plan allows 10,000.

## How to check it's working

- After the SQL has run and this branch is on main, search for a course you haven't searched before (a new name, so the cache doesn't answer). In Supabase, **Table Editor**, table `course_api_usage`: today's row shows 1 call.
- To see the email without burning 28 real calls: in Supabase, SQL Editor, run `update public.course_api_usage set calls = 27 where day = current_date;` then do one more new search. The 80% email arrives within a minute. Set it back with `update public.course_api_usage set calls = 0 where day = current_date;` if you like.

## What I could not check from here

- The SQL ran only in my head: there is no Postgres on this Mac and no Supabase key here. It follows the same shape as the push SQL (`2026-10-08-push.sql`). If Supabase shows an error when you run it, paste the error into a chat.
- GolfCourseAPI doesn't say what hour its day resets. The watch counts by UTC day; if the real reset is at another hour, the "over the limit" email catches it and says so.
