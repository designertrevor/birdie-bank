-- Course API usage (added 2026-10-20). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again.
--
-- GolfCourseAPI (course search) allows a fixed number of calls a day (35 on the free plan,
-- 10,000 on Pro) and tells us nothing about how many are left: no header, no account endpoint.
-- So api/courses.js counts every call it makes here, one row a day, and emails Trevor when the
-- day is 80% used and again when it runs out (src/lib/course-quota.js, ROADMAP area 25).
--  • course_api_usage: one row per UTC day with the number of calls and when the API first
--    answered 429 (over the limit) that day. Only the service role can read or change it.
--  • course_api_call(p_day, p_add, p_limited): adds p_add calls (1, or 0 to only note a 429) to
--    the day's row and returns the new count plus whether a 429 had already been seen that day,
--    so each email goes out once. Only the service role (the Vercel function) can call it.
--
-- To undo: drop function if exists public.course_api_call(date, integer, boolean);
--          drop table if exists public.course_api_usage;

create table if not exists public.course_api_usage (
  day date primary key,
  calls integer not null default 0,
  limited_at timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on public.course_api_usage from public, anon, authenticated;
grant select, insert, update, delete on public.course_api_usage to service_role;
alter table public.course_api_usage enable row level security;

drop function if exists public.course_api_call(date, boolean);
drop function if exists public.course_api_call(date, integer, boolean);
create or replace function public.course_api_call(p_day date, p_add integer default 1, p_limited boolean default false)
returns table (calls integer, limited_before boolean)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_calls integer;
  v_limited_at timestamptz;
begin
  insert into public.course_api_usage as u (day, calls, limited_at, updated_at)
  values (p_day, greatest(p_add, 0), case when p_limited then now() end, now())
  on conflict (day) do update
    set calls = u.calls + greatest(p_add, 0),
        limited_at = coalesce(u.limited_at, case when p_limited then now() end),
        updated_at = now()
  returning u.calls, u.limited_at into v_calls, v_limited_at;
  -- now() is the start of this transaction, so a time before it was set by an earlier call
  return query select v_calls, (v_limited_at is not null and v_limited_at < now());
end;
$$;

revoke all on function public.course_api_call(date, integer, boolean) from public, anon, authenticated;
grant execute on function public.course_api_call(date, integer, boolean) to service_role;

-- Old days only show the pattern; nothing reads them. Clear them whenever you like:
--   delete from public.course_api_usage where day < current_date - 90;
