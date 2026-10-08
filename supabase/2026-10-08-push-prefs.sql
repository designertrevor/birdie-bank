-- Which pushes you get (added 2026-10-08). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again. Needs 2026-10-08-push.sql first (it replaces the two
-- functions from there, with the same columns).
--
-- What it adds:
--  • push_prefs: one row per signed-in person who switched a kind of push off in Settings
--    (Notifications, then Which ones): the kinds they don't want (muted), by the names in
--    src/lib/push-events.js. No row, or an empty list, means every push. Each person reads, adds,
--    changes and removes only their own row; nobody else can see it through the API, and the
--    server only ever reads it inside the two functions below.
--  • push_targets() and push_tee_due(), again: a muted kind is left out for that person. Who's on
--    a round or plan, the rate limits and the once-per-plan tee reminder are as before.
--
-- Until this runs, the app works the same as before: the switches in Settings still show and
-- keep their state on the phone, the save to the account fails quietly, and every push goes.
--
-- To undo: run 2026-10-08-push.sql again (its functions send every push and don't read the
--          table), then drop table if exists public.push_prefs;

-- --------------------------- what you switched off ---------------------------

create table if not exists public.push_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  muted text[] not null default '{}'
    check (coalesce(array_length(muted, 1), 0) <= 16
           and muted <@ array['invite', 'rsvp', 'finished', 'paid', 'carry', 'carried', 'talk', 'tee']::text[]),
  updated_at timestamptz not null default now()
);

revoke all on public.push_prefs from anon;
grant select, insert, update, delete on public.push_prefs to authenticated;
grant select on public.push_prefs to service_role;
alter table public.push_prefs enable row level security;
drop policy if exists "own push prefs read" on public.push_prefs;
drop policy if exists "own push prefs add" on public.push_prefs;
drop policy if exists "own push prefs change" on public.push_prefs;
drop policy if exists "own push prefs remove" on public.push_prefs;
create policy "own push prefs read" on public.push_prefs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own push prefs add" on public.push_prefs for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own push prefs change" on public.push_prefs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own push prefs remove" on public.push_prefs for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at is when the row last changed, so a phone that saved while offline knows which copy is newer
create or replace function public.push_prefs_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists push_prefs_touch on public.push_prefs;
create trigger push_prefs_touch before update on public.push_prefs
  for each row execute function public.push_prefs_touch();

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
-- Someone who switched this kind off in Settings (push_prefs) is left out; the send is still
-- logged, so the rate limits and "only on a change of answer" work the same for them.
-- The same columns as before, so the copy from 2026-10-08-push.sql is replaced in place.
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
      and not exists (select 1 from public.push_prefs f where f.user_id = s.user_id and p_kind = any (f.muted))
    limit 200;
end $$;

-- Plans whose tee time reminder is due on `p_today` (YYYY-MM-DD) and not sent yet, with their
-- organizer's subscriptions: still planned, not booked, not moved, the reminder day has come and
-- the round hasn't gone by. Each plan is marked sent, so it goes once. An organizer who switched
-- the reminder off in Settings (push_prefs) is skipped, and the plan isn't marked, so the reminder
-- still goes if they switch it back on before the round.
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
      and not exists (select 1 from public.push_prefs f where f.user_id = h.user_id and 'tee' = any (f.muted))
    limit 500
  loop
    insert into public.push_sends (caller, scope, kind, code) values (rec.host, 'plan', 'tee', rec.code);
    return query
      select rec.code, rec.d, rec.c, s.user_id, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s where s.user_id = rec.host limit 20;
  end loop;
end $$;

-- Only the server (the service role) calls these (as 2026-10-08-push.sql says; given again, so this file stands alone)
revoke all on function public.push_targets(uuid, text, text, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.push_tee_due(text) from public, anon, authenticated;
grant execute on function public.push_targets(uuid, text, text, text, text, text[], text) to service_role;
grant execute on function public.push_tee_due(text) to service_role;
