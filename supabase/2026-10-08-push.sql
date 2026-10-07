-- Web push (added 2026-10-08). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again. Needs schema.sql, 2026-10-01-profiles.sql,
-- 2026-10-04-plan-lock.sql and 2026-10-04-comments.sql (all run already). The trash talk push on
-- a challenge also needs 2026-10-07-challenge-talk.sql; until that runs it just finds nobody.
--
-- What it adds:
--  • push_subscriptions: where to send a signed-in person's pushes, one row per browser or
--    installed app they turned notifications on in. Each person reads, adds, changes and removes
--    only their own rows; nobody else can see them through the API.
--  • push_sends: a log of what was sent, for the rate limits and so a tee time reminder goes once.
--    Nothing reaches it through the API.
--  • push_targets() and push_tee_due(): who a push goes to. Only the service role can call them
--    (the server function api/push.js, with SUPABASE_SERVICE_ROLE_KEY), never the app, so nobody
--    can list rounds, plans or anyone's subscriptions through them. For a round finished push
--    push_targets also hands the server each person's seat, so their push can say how they did.
--
-- Rounds and plans stay locked behind their codes (2026-10-06-round-codes.sql): the server only
-- looks a round or plan up by the code the caller sent, only when the caller is on it themselves
-- (a seat linked to their account, the round saved in their account, or an answer or the plan made
-- while signed in; for trash talk also being let in on its talk, the only way onto a challenge),
-- and it sends back nothing about it, only the pushes go out.
--
-- Until this runs, the app works the same as before: turning notifications on keeps the browser's
-- permission and the server function sends nothing.
--
-- To undo: drop function if exists public.push_targets(uuid, text, text, text, text, text[], text);
--          drop function if exists public.push_tee_due(text);
--          drop table if exists public.push_sends;
--          drop table if exists public.push_subscriptions;
--          drop index if exists public.user_docs_share_code;

-- --------------------------- subscriptions ----------------------------------

create table if not exists public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 16 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, delete on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions read" on public.push_subscriptions;
drop policy if exists "own push subscriptions add" on public.push_subscriptions;
drop policy if exists "own push subscriptions change" on public.push_subscriptions;
drop policy if exists "own push subscriptions remove" on public.push_subscriptions;
create policy "own push subscriptions read" on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own push subscriptions add" on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own push subscriptions change" on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own push subscriptions remove" on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.push_subscriptions_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists push_subscriptions_touch on public.push_subscriptions;
create trigger push_subscriptions_touch before update on public.push_subscriptions
  for each row execute function public.push_subscriptions_touch();

-- One browser, one account: when a phone's push address is saved for someone, it stops belonging
-- to anyone else, so on a shared phone the last person signed in is the only one it buzzes for
-- (even when the one before never signed out).
create or replace function public.push_subscriptions_claim() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions s where s.endpoint = new.endpoint and s.user_id <> new.user_id;
  return new;
end $$;
revoke all on function public.push_subscriptions_claim() from public, anon, authenticated;
drop trigger if exists push_subscriptions_claim on public.push_subscriptions;
create trigger push_subscriptions_claim before insert or update of endpoint on public.push_subscriptions
  for each row execute function public.push_subscriptions_claim();

-- --------------------------- what was sent ----------------------------------

create table if not exists public.push_sends (
  id bigint generated always as identity primary key,
  caller uuid not null,
  scope text not null,
  kind text not null,
  code text not null,
  topic text not null default '',
  at timestamptz not null default now()
);
create index if not exists push_sends_caller on public.push_sends (caller, at);
create index if not exists push_sends_code on public.push_sends (code, kind);

-- Row security on with no policies, and no grants: nothing reaches it through the API
alter table public.push_sends enable row level security;
revoke all on public.push_sends from anon, authenticated;

-- Finding the accounts that saved a round by its code (the round's own phones)
create index if not exists user_docs_share_code on public.user_docs ((data ->> 'shareCode')) where kind = 'round';

-- --------------------------- who gets a push --------------------------------

-- The subscriptions a push from `p_caller` goes to, for a round, plan or challenge by its code:
--   p_to 'all'      everyone on it but the caller (an invite, a round finished, new trash talk)
--   p_to 'host'     the plan's organizer (who's in)
--   p_to 'players'  the people in those seats (someone paid you, a carry-over to approve, or
--                   the answer to the one you asked)
-- For trash talk, "on it" also counts the accounts let in on that thread's talk (comment_members,
-- 2026-10-04-comments.sql), and a challenge is only those: anyone with its code, like its talk.
-- Nothing when the caller isn't on it themselves, when the same push went in the last 10 minutes
-- (for trash talk the topic is the comment, so each comment goes once), or when the caller has sent
-- 40 in the last hour.
-- Who's in is about the answer now, not a log of it: its topic is the answer, and it goes when the
-- answer changed since the caller's last one on that plan (in, out, in sends all three), at most 6
-- an hour per plan, so the organizer's newest push always matches the newest answer.
-- For a round finished push each subscription also comes with its person's seats in the round
-- (to_seats), so the server can tell each of them how they did; nothing else about the round.
-- The function's columns grew, so any earlier copy goes first (its grants are given again below)
drop function if exists public.push_targets(uuid, text, text, text, text, text[], text);
create or replace function public.push_targets(p_caller uuid, p_scope text, p_kind text, p_code text,
  p_to text default 'all', p_players text[] default '{}', p_topic text default '')
returns table (to_user uuid, push_endpoint text, push_p256dh text, push_auth text, to_seats text[])
language plpgsql volatile security definer set search_path = '' as $$
declare
  m jsonb;
  members uuid[];
  picked uuid[];
  seats_of jsonb;
  t text := left(coalesce(p_topic, ''), 200);
  seats text[] := coalesce(p_players[1:8], '{}');
begin
  if p_caller is null or p_code is null or p_code !~ '^[A-Z0-9]{4,8}$' then return; end if;
  if not ((p_scope = 'round' and p_kind in ('invite', 'finished', 'paid', 'carry', 'carried', 'talk'))
          or (p_scope = 'plan' and p_kind in ('invite', 'rsvp', 'talk'))
          or (p_scope = 'challenge' and p_kind = 'talk')) then return; end if;
  if p_to is null or p_to not in ('all', 'host', 'players') then return; end if;

  if p_kind = 'rsvp' then
    if (select s.topic from public.push_sends s where s.caller = p_caller and s.scope = p_scope and s.kind = 'rsvp'
        and s.code = p_code order by s.at desc, s.id desc limit 1) = t then return; end if;
    if (select count(*) from public.push_sends s where s.caller = p_caller and s.scope = p_scope and s.kind = 'rsvp'
        and s.code = p_code and s.at > now() - interval '1 hour') >= 6 then return; end if;
  elsif exists (select 1 from public.push_sends s where s.caller = p_caller and s.scope = p_scope and s.kind = p_kind
             and s.code = p_code and s.topic = t and s.at > now() - interval '10 minutes') then return; end if;
  if (select count(*) from public.push_sends s where s.caller = p_caller and s.at > now() - interval '1 hour') >= 40 then return; end if;

  if p_scope = 'round' then
    select r.meta into m from public.live_rounds r where r.code = p_code;
    -- Each account on the round and its seat: seats linked to accounts, and the accounts that saved
    -- the round (their seat is the one they joined as, or their own player when they shared it)
    with on_it as (
      select a.user_id as who, a.player_id as seat
        from public.account_players a
        where a.player_id in (select public.profile_round_ids(m -> 'players'))
      union
      select d.user_id, coalesce(nullif(d.data ->> 'localMe', ''),
          (select pd.data ->> 'me' from public.user_docs pd where pd.user_id = d.user_id and pd.kind = 'profile' and pd.id = 'me' and not pd.deleted))
        from public.user_docs d
        where d.kind = 'round' and not d.deleted and d.data ->> 'shareCode' = p_code
      union
      select substr(c.member, 3)::uuid, null
        from public.comment_members c
        where p_kind = 'talk' and c.scope = 'round' and c.code = p_code and c.member ~ '^u:[0-9a-f-]{36}$'
    )
    , per as (
      select o.who, array_agg(distinct o.seat) filter (where o.seat is not null) as seat_list
        from on_it o group by o.who
    )
    select array_agg(p.who),
           array_agg(p.who) filter (where p_to = 'all' or (p_to = 'players' and p.seat_list && seats)),
           jsonb_object_agg(p.who::text, coalesce(to_jsonb(p.seat_list), '[]'::jsonb))
      into members, picked, seats_of
      from per p;
  elsif p_scope = 'challenge' then
    -- The accounts let in on the challenge's talk (join_challenge_comments)
    select array_agg(distinct substr(c.member, 3)::uuid) into members
      from public.comment_members c
      where c.scope = 'challenge' and c.code = p_code and c.member ~ '^u:[0-9a-f-]{36}$';
    picked := members;
  else
    select r.meta into m from public.planned_rounds r where r.code = p_code;
    if m is null then return; end if;
    -- The organizer, everyone who answered while signed in, and the people on it with an account
    with on_it as (
      select h.user_id as who, true as host from public.plan_hosts h where h.code = p_code and h.user_id is not null
      union
      select o.user_id, o.who = 'host' from public.plan_answer_owners o where o.code = p_code and o.user_id is not null
      union
      select a.user_id, false from public.account_players a where a.player_id in (select public.profile_round_ids(m -> 'people'))
      union
      select substr(c.member, 3)::uuid, false
        from public.comment_members c
        where p_kind = 'talk' and c.scope = 'plan' and c.code = p_code and c.member ~ '^u:[0-9a-f-]{36}$'
    )
    select array_agg(distinct o.who),
           array_agg(distinct o.who) filter (where p_to = 'all' or (p_to = 'host' and o.host))
      into members, picked
      from on_it o;
  end if;

  if members is null or not (p_caller = any (members)) then return; end if;
  insert into public.push_sends (caller, scope, kind, code, topic) values (p_caller, p_scope, p_kind, p_code, t);
  -- Housekeeping: the rate limits only look back an hour (tee time reminders stay, see below)
  delete from public.push_sends s where s.kind <> 'tee' and s.at < now() - interval '2 days';

  return query
    select s.user_id, s.endpoint, s.p256dh, s.auth,
           case when p_kind = 'finished'
             then array(select jsonb_array_elements_text(coalesce(seats_of -> s.user_id::text, '[]'::jsonb)))
             else '{}'::text[] end
    from public.push_subscriptions s
    where s.user_id = any (coalesce(picked, '{}')) and s.user_id <> p_caller
    limit 200;
end $$;

-- Plans whose tee time reminder is due on `p_today` (YYYY-MM-DD) and not sent yet, with their
-- organizer's subscriptions: still planned, not booked, not moved, the reminder day has come and
-- the round hasn't gone by. Each plan is marked sent, so it goes once.
create or replace function public.push_tee_due(p_today text)
returns table (plan_code text, plan_date text, plan_course text, to_user uuid, push_endpoint text, push_p256dh text, push_auth text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  rec record;
begin
  if p_today is null or p_today !~ '^\d{4}-\d{2}-\d{2}$' then return; end if;
  delete from public.push_sends s where s.kind = 'tee' and s.at < now() - interval '90 days';
  for rec in
    select r.code, r.meta ->> 'date' as d, left(r.meta #>> '{course,name}', 60) as c, h.user_id as host
    from public.planned_rounds r
    join public.plan_hosts h on h.code = r.code
    where h.user_id is not null
      and coalesce(r.meta ->> 'status', 'planned') = 'planned'
      and jsonb_typeof(r.meta -> 'booked') is distinct from 'object'
      and jsonb_typeof(r.meta -> 'movedTo') is distinct from 'object'
      and r.meta #>> '{booking,remindOn}' <= p_today
      and r.meta ->> 'date' >= p_today
      and not exists (select 1 from public.push_sends s where s.kind = 'tee' and s.code = r.code)
    limit 500
  loop
    insert into public.push_sends (caller, scope, kind, code) values (rec.host, 'plan', 'tee', rec.code);
    return query
      select rec.code, rec.d, rec.c, s.user_id, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s where s.user_id = rec.host limit 20;
  end loop;
end $$;

-- Only the server (the service role) calls these
revoke all on function public.push_targets(uuid, text, text, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.push_tee_due(text) from public, anon, authenticated;
grant execute on function public.push_targets(uuid, text, text, text, text, text[], text) to service_role;
grant execute on function public.push_tee_due(text) to service_role;
