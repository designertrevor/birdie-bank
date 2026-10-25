-- The weekly feedback digest (added 2026-10-12, Overnight 13). Run this once in Supabase:
-- Dashboard, SQL Editor, New query, paste, Run. Safe to run again. Needs schema.sql's feedback
-- table, 2026-10-07-roadmap.sql (feedback.roadmap_status) and 2026-10-08-push.sql
-- (push_subscriptions), all already run.
--
-- What it adds:
--  • app_admins: the accounts that may read the digest. Nobody else can read other people's
--    feedback: the table and every digest function check it on the server, so hiding the screen
--    is not what keeps it private. Only the Dashboard (or this SQL) can add someone.
--  • feedback_digest: Trevor's call on each idea (approve or skip), the roadmap area he picked,
--    an optional note, and added_on, set once a Claude session has written it into ROADMAP.md.
--  • digest_is_admin(), digest_feedback(days), digest_decide(...), digest_approved(),
--    digest_mark_added(ids): what the Digest screen (?digest) calls. Each one answers only to an
--    account in app_admins.
--  • push_digest_due(): for the Monday push (api/push-digest.js), service role only. It hands back
--    each admin's push subscriptions and how many ideas from the last 7 days are still undecided.
--
-- After it runs, make yourself the admin (sign in to the app once first, with the account you use).
-- Replace the email below with that account's email, then run just this line:
--
--   insert into public.app_admins (user_id) select id from auth.users where email = 'YOUR-ACCOUNT-EMAIL' on conflict do nothing;
--
-- To stop the Monday push and keep the screen: update public.app_admins set weekly_push = false;
--
-- Until this runs, ?digest says the digest isn't set up yet, and nothing else changes.
--
-- To undo: drop function if exists public.push_digest_due(); drop function if exists public.digest_mark_added(uuid[]);
--          drop function if exists public.digest_approved(); drop function if exists public.digest_decide(uuid, text, text, text);
--          drop function if exists public.digest_feedback(integer); drop function if exists public.digest_is_admin();
--          drop table if exists public.feedback_digest; drop table if exists public.app_admins;

-- ---------------------------------------------------------------------------------------------
-- Who may read the digest
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  weekly_push boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

-- Trevor's calls on each idea
create table if not exists public.feedback_digest (
  feedback_id uuid primary key references public.feedback (id) on delete cascade,
  decision text not null check (decision in ('approve', 'skip')),
  area text check (area is null or area ~ '^[0-9]{1,2}$'),
  note text check (note is null or length(note) <= 300),
  decided_at timestamptz not null default now(),
  added_on date
);
alter table public.feedback_digest enable row level security;
revoke all on public.feedback_digest from anon, authenticated;

create or replace function public.digest_admin_check() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.app_admins a where a.user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end $$;
revoke all on function public.digest_admin_check() from public, anon, authenticated;

-- Whether the signed-in account may open the digest (Settings shows the row only then)
create or replace function public.digest_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.app_admins a where a.user_id = auth.uid())
$$;

-- The ideas sent in over the last p_days days (1 to 60), newest first, with Trevor's call on each.
-- Not the device details or the contact field: the Dashboard still has those.
create or replace function public.digest_feedback(p_days integer default 7)
returns table (id uuid, kind text, body text, details jsonb, created_at timestamptz, has_photo boolean,
               roadmap_status text, decision text, area text, note text, added_on date)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.digest_admin_check();
  return query
    select f.id, f.kind, f.body, f.details, f.created_at, f.screenshot_path is not null,
           f.roadmap_status, d.decision, d.area, d.note, d.added_on
    from public.feedback f
    left join public.feedback_digest d on d.feedback_id = f.id
    where f.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 60)))
    order by f.created_at desc
    limit 500;
end $$;

-- Approve or skip an idea (p_decision 'approve' or 'skip'), or take the call back (null)
create or replace function public.digest_decide(p_id uuid, p_decision text, p_area text default null, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.digest_admin_check();
  if p_decision is null then
    delete from public.feedback_digest where feedback_id = p_id;
    return;
  end if;
  if p_decision not in ('approve', 'skip') then raise exception 'Approve or skip' using errcode = '22023'; end if;
  if p_area is not null and p_area !~ '^[0-9]{1,2}$' then raise exception 'No such area' using errcode = '22023'; end if;
  insert into public.feedback_digest (feedback_id, decision, area, note)
  values (p_id, p_decision, p_area, nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  on conflict (feedback_id) do update
    set decision = excluded.decision, area = excluded.area, note = excluded.note, decided_at = now(),
        added_on = case when excluded.decision = 'approve' then public.feedback_digest.added_on end;
end $$;

-- Approved ideas not yet written into ROADMAP.md, any age, oldest first
create or replace function public.digest_approved()
returns table (id uuid, kind text, body text, details jsonb, created_at timestamptz, area text, note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.digest_admin_check();
  return query
    select f.id, f.kind, f.body, f.details, f.created_at, d.area, d.note
    from public.feedback_digest d
    join public.feedback f on f.id = d.feedback_id
    where d.decision = 'approve' and d.added_on is null
    order by d.decided_at
    limit 200;
end $$;

-- After a Claude session added them to ROADMAP.md
create or replace function public.digest_mark_added(p_ids uuid[]) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.digest_admin_check();
  update public.feedback_digest set added_on = current_date
  where feedback_id = any(coalesce(p_ids, '{}')) and decision = 'approve' and added_on is null;
end $$;

-- The Monday push: each admin's subscriptions and how many ideas from the week still wait for a call
create or replace function public.push_digest_due()
returns table (waiting integer, to_user uuid, push_endpoint text, push_p256dh text, push_auth text)
language sql stable security definer set search_path = '' as $$
  with w as (
    select count(*)::int n from public.feedback f
    where f.created_at > now() - interval '7 days'
      and f.kind in ('game', 'course', 'feature', 'bug')
      and not exists (select 1 from public.feedback_digest d where d.feedback_id = f.id)
  )
  select w.n, s.user_id, s.endpoint, s.p256dh, s.auth
  from public.app_admins a
  join public.push_subscriptions s on s.user_id = a.user_id
  cross join w
  where a.weekly_push and w.n > 0
$$;

revoke all on function public.digest_is_admin() from public, anon;
revoke all on function public.digest_feedback(integer) from public, anon;
revoke all on function public.digest_decide(uuid, text, text, text) from public, anon;
revoke all on function public.digest_approved() from public, anon;
revoke all on function public.digest_mark_added(uuid[]) from public, anon;
revoke all on function public.push_digest_due() from public, anon, authenticated;
grant execute on function public.digest_is_admin() to authenticated;
grant execute on function public.digest_feedback(integer) to authenticated;
grant execute on function public.digest_decide(uuid, text, text, text) to authenticated;
grant execute on function public.digest_approved() to authenticated;
grant execute on function public.digest_mark_added(uuid[]) to authenticated;
grant execute on function public.push_digest_due() to service_role;
