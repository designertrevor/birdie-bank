-- Rate limits (added 2026-10-20). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again.
--
-- The shared half of the rate limits on api/courses.js, api/join.js and the feedback emails
-- (src/lib/rate-limit.js, ROADMAP area 25). Vercel runs many copies of each function and each
-- one forgets everything when it stops, so a count kept in memory only slows a flood that keeps
-- landing on one copy. This keeps one count for all of them:
--  • rate_limits: one row per key ("courses:ip:203.0.113.7", "courses:all", ...) holding the
--    current window's start, when it ends and its hit count. UNLOGGED, since a count that is lost
--    in a crash costs nothing and skipping the write-ahead log makes each hit cheaper. Only the
--    service role can touch it.
--  • rate_hit(p_key, p_max, p_window_seconds): counts one hit in the key's current fixed window
--    (windows start on the epoch, so a 60 second window runs :00 to :59 of each minute) and
--    returns true while the count is at most p_max, false once it's over. Only the service role
--    (the Vercel functions, with SUPABASE_SERVICE_ROLE_KEY) may call it: anyone with the app's
--    public key could otherwise fill "courses:all" and lock course search for everyone.
--    A call with odd arguments returns true, so a bug here never locks anyone out.
--  • rate_limits_cleanup(): deletes the rows whose window ended more than a minute ago. pg_cron
--    runs it every hour (the block at the end turns pg_cron on and schedules it). rate_hit also
--    runs it on about 1 call in 500, so the table stays small even without pg_cron.
--
-- The functions fail open: until this runs, or whenever Supabase can't be reached, every request
-- goes through and the function logs it once. Nothing in the app needs this to work.
--
-- To undo: select cron.unschedule('rate-limits-cleanup');
--          drop function if exists public.rate_hit(text, integer, integer);
--          drop function if exists public.rate_limits_cleanup();
--          drop table if exists public.rate_limits;

create unlogged table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  expires_at timestamptz not null,
  hits integer not null default 0
);
create index if not exists rate_limits_expires_at on public.rate_limits (expires_at);

revoke all on public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

create or replace function public.rate_limits_cleanup()
returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_gone integer;
begin
  delete from public.rate_limits where expires_at < now() - interval '1 minute';
  get diagnostics v_gone = row_count;
  return v_gone;
end;
$$;

revoke all on function public.rate_limits_cleanup() from public, anon, authenticated;
grant execute on function public.rate_limits_cleanup() to service_role;

create or replace function public.rate_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_start timestamptz;
  v_hits integer;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200
     or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    return true;
  end if;
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, expires_at, hits)
  values (p_key, v_start, v_start + make_interval(secs => p_window_seconds), 1)
  on conflict (key) do update
    -- A new window starts the count again; a flood stops counting at a million (it's over by then)
    set hits = case when r.window_start = excluded.window_start then least(r.hits + 1, 1000000) else 1 end,
        window_start = excluded.window_start,
        expires_at = excluded.expires_at
  returning r.hits into v_hits;
  if random() < 0.002 then perform public.rate_limits_cleanup(); end if;
  return v_hits <= p_max;
end;
$$;

revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- The hourly cleanup. pg_cron comes with Supabase (Dashboard, Integrations, Cron); this turns it on
-- if it's off and (re)schedules the job at 17 minutes past each hour. If pg_cron can't be turned on
-- here, it says so in the output and rate_hit's own sweeps keep the table tidy.
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron is not available (%); rate_hit cleans up by itself instead', sqlerrm;
    return;
  end;
  execute $q$ select cron.unschedule(jobid) from cron.job where jobname = 'rate-limits-cleanup' $q$;
  execute $q$ select cron.schedule('rate-limits-cleanup', '17 * * * *', 'select public.rate_limits_cleanup()') $q$;
end $$;

-- To look: select * from public.rate_limits order by hits desc limit 20;
--          select * from cron.job where jobname = 'rate-limits-cleanup';
