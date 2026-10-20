-- Tee time reminders in each person's own morning (added 2026-10-20). Run this once in Supabase:
-- Dashboard, SQL Editor, New query, paste, Run. Safe to run again. Needs 2026-10-08-push.sql and
-- 2026-10-08-push-prefs.sql first (both run already). If either of those is ever run again, run
-- this one again after it.
--
-- Goes with a Vercel cron change that ships with the code (vercel.json, nothing to click): the tee
-- time job, api/push-tee.js, ran once a day at 15:00 UTC ("0 15 * * *", the US morning) and now
-- runs every hour ("0 * * * *"). Still the one cron, so the cron count is the same. Each hour it
-- reminds only the organizers whose own clock reads 8 (8:00 to 8:59).
--
-- What it adds:
--  - push_subscriptions.time_zone: the IANA zone each phone saved with its subscription
--    ("America/Denver", "Europe/London"), refreshed when the phone's zone changes. Rows from
--    before get 'America/Denver', since every tester so far is in Utah. A name that isn't a zone's
--    shape is saved as 'America/Denver' instead of failing the save, so a phone never loses pushes.
--  - push_tee_zones(): the zones the subscriptions are in, so the server can tell which of them
--    are at 8 in the morning right now.
--  - push_tee_due(p_days jsonb), next to push_tee_due(text): the server sends the zones at 8
--    o'clock now, each with its own today ({"America/Denver": "2026-10-21", ...}), and each
--    organizer is reminded on the day their newest phone's zone says (the phone saved last, when
--    they have several). The rest is as before: still planned, not booked, not moved, the reminder
--    day has come, the round hasn't gone by, not switched off in Settings (push_prefs), and once
--    per plan (push_sends), so moving zones, or the job running twice in an hour, never sends a
--    plan's reminder again. An organizer with no phone on is skipped and the plan isn't marked
--    sent, so they still get it if they turn notifications on before the round.
--
-- Until this runs, the app and the job keep working: phones save their subscription without the
-- zone (the app retries without it), and the hourly job sends on Utah's day in Utah's 8 o'clock
-- hour through the old push_tee_due(text). That one stays, so this file and the code can land in
-- either order (the old daily job keeps calling it until the new code ships). Once the new code
-- is live it's unused, and can go with: drop function if exists public.push_tee_due(text);
--
-- To see the zones saved:
--   select time_zone, count(*) as phones, max(updated_at) as last_saved
--     from public.push_subscriptions group by time_zone order by phones desc;
--
-- To undo: drop function if exists public.push_tee_due(jsonb);
--          drop function if exists public.push_tee_zones();
--          drop trigger if exists push_subscriptions_zone on public.push_subscriptions;
--          drop function if exists public.push_subscriptions_zone();
--          alter table public.push_subscriptions drop column if exists time_zone;
--          and set the cron in vercel.json back to "0 15 * * *" (push_tee_due(text) is still
--          there; if it was dropped, run 2026-10-08-push-prefs.sql again).

-- --------------------------- each phone's zone -------------------------------

alter table public.push_subscriptions add column if not exists time_zone text not null default 'America/Denver';

-- A zone's shape: "UTC", "Asia/Tokyo", "America/Argentina/Buenos_Aires", "Etc/GMT+7". Anything else
-- (or nothing) keeps the zone the row had, or 'America/Denver' for a new one.
create or replace function public.push_subscriptions_zone() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.time_zone is null or length(new.time_zone) > 64
     or new.time_zone !~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}$' then
    new.time_zone := case when tg_op = 'UPDATE' and old.time_zone is not null then old.time_zone else 'America/Denver' end;
  end if;
  return new;
end $$;
drop trigger if exists push_subscriptions_zone on public.push_subscriptions;
create trigger push_subscriptions_zone before insert or update on public.push_subscriptions
  for each row execute function public.push_subscriptions_zone();

-- Finding each organizer's newest phone
create index if not exists push_subscriptions_user_newest on public.push_subscriptions (user_id, updated_at desc);

-- --------------------------- the zones there are -----------------------------

create or replace function public.push_tee_zones()
returns table (time_zone text)
language sql stable security definer set search_path = '' as $$
  select distinct s.time_zone from public.push_subscriptions s limit 2000;
$$;

-- --------------------------- who's due now -----------------------------------

-- Plans whose tee time reminder is due now and not sent yet, with their organizer's subscriptions.
-- `p_days` is the zones whose clock reads 8 now, each with its today (YYYY-MM-DD): an organizer is
-- picked when their newest phone's zone is one of them, and the plan is due on that day. Each plan
-- is marked sent, so it goes once. One run at a time (the lock), so two runs at once can't both
-- send a plan.
create or replace function public.push_tee_due(p_days jsonb)
returns table (plan_code text, plan_date text, plan_course text, to_user uuid, push_endpoint text, push_p256dh text, push_auth text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  rec record;
begin
  if p_days is null or jsonb_typeof(p_days) <> 'object' then return; end if;
  perform pg_advisory_xact_lock(hashtext('push_tee_due'));
  delete from public.push_sends s where s.kind = 'tee' and s.at < now() - interval '90 days';
  for rec in
    select r.code, r.meta ->> 'date' as d, left(r.meta #>> '{course,name}', 60) as c, h.user_id as host
    from public.planned_rounds r
    join public.plan_hosts h on h.code = r.code
    cross join lateral (
      select p_days ->> z.time_zone as today
      from public.push_subscriptions z
      where z.user_id = h.user_id
      order by z.updated_at desc, z.created_at desc
      limit 1
    ) newest
    where h.user_id is not null
      and newest.today ~ '^\d{4}-\d{2}-\d{2}$'
      and coalesce(r.meta ->> 'status', 'planned') = 'planned'
      and jsonb_typeof(r.meta -> 'booked') is distinct from 'object'
      and jsonb_typeof(r.meta -> 'movedTo') is distinct from 'object'
      and r.meta #>> '{booking,remindOn}' <= newest.today
      and r.meta ->> 'date' >= newest.today
      and not exists (select 1 from public.push_sends s where s.kind = 'tee' and s.code = r.code)
      and not exists (select 1 from public.push_prefs f where f.user_id = h.user_id and 'tee' = any (f.muted))
    limit 500
  loop
    insert into public.push_sends (caller, scope, kind, code) values (rec.host, 'plan', 'tee', rec.code);
    return query
      select rec.code, rec.d, rec.c, s.user_id, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s where s.user_id = rec.host limit 20;
  end loop;
end $$;

-- Only the server (the service role) calls these
revoke all on function public.push_tee_zones() from public, anon, authenticated;
revoke all on function public.push_tee_due(jsonb) from public, anon, authenticated;
grant execute on function public.push_tee_zones() to service_role;
grant execute on function public.push_tee_due(jsonb) to service_role;
