-- Comments and reactions (added 2026-10-04). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again.
--
-- Trash talk on a finished round, its settle-up lines and its side bets between two players, and
-- on an upcoming round: a few emoji reactions, comments, and quick jabs (a jab is a comment whose
-- words came from the app's list). One row per comment, and one per person per emoji per thing.
-- A comment or reaction taken back stays as a row marked deleted, so every phone hears it went.
--
-- Who may read and write (src/lib/talk-access.js is the same rules in JavaScript, with tests; keep
-- the two in step). The server knows a phone by the hash of its device key (the x-bb-device header,
-- public.bb_writer() from 2026-09-30-keeper-lock.sql) and an account by auth.uid().
--  • A round's talk: the phones and accounts of the people in it. A live round's meta says which
--    phone took each seat (devs) and which phone shared it (hostDev); account_players (from
--    2026-10-01-profiles.sql) links seats to accounts. Each one speaks only as its own seat: the
--    seat's own phone, the host phone for the seats nobody took from the link, or the account the
--    seat is linked to. A round shared before the keeper lock (no hostDev) is open to every seat,
--    as everything else in it is. Watchers can't read or write it.
--  • A plan's talk: everyone on the plan, which, like the plan itself until plans are locked down,
--    is anyone with its code: the organizer, the people it lists and anyone who answered.
--  • join_comments(scope, code) lets a phone (and its account) in and remembers it, with its seats,
--    in comment_members. So the talk outlives the live round: sharing stopped, or the optional
--    30-day tidy-up. A plan's talk is read only after joining, so only people with the code see it.
--  • Each person changes or deletes only their own rows: the phone or account that wrote them. Who
--    wrote a row, what it's about and its seat never change after it goes in.
--
-- Until this runs, the app keeps comments and reactions on each phone and sends them once it has.
-- No live updates: phones look again when the round or plan is open and when the app wakes.
--
-- To undo: drop table public.comments; drop table public.comment_members;
--          drop function public.join_comments(text, text); drop function public.comment_seats(text, text);
--          drop function public.comment_round_seats(jsonb, text, uuid); drop function public.comment_plan_seats(text);
--          drop function public.comment_mine(text, uuid); drop function public.comments_keep();

create table if not exists public.comments (
  scope text not null check (scope in ('round', 'plan')),
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  id text not null check (length(id) between 1 and 200),
  target text not null check (length(target) between 1 and 200),
  kind text not null check (kind in ('comment', 'reaction')),
  who text not null check (length(who) between 1 and 64),
  name text check (length(name) <= 40),
  body text check (length(body) <= 280),
  jab text check (length(jab) <= 32),
  emoji text check (emoji in ('clap', 'fire', 'laugh', 'yikes', 'money')),
  deleted boolean not null default false,
  author_dev text,
  author_user uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, code, id),
  constraint comments_reaction_has_emoji check (kind <> 'reaction' or emoji is not null),
  constraint comments_comment_has_words check (kind <> 'comment' or deleted or length(btrim(body)) >= 1)
);

-- Who has been let in, and the seats they had then. Only the functions below read or write it.
create table if not exists public.comment_members (
  scope text not null check (scope in ('round', 'plan')),
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  member text not null check (member ~ '^(d|u):'),  -- 'd:' and a device hash, or 'u:' and an account id
  seats text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (scope, code, member)
);
alter table public.comment_members enable row level security;
revoke all on public.comment_members from anon, authenticated;

-- The seats phone w (or account me) may speak as in a live round with meta m, or null when not in it
create or replace function public.comment_round_seats(m jsonb, w text, me uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select case
    when m is null then null
    when public.bb_str(m -> 'hostDev') is null then array(select public.profile_round_ids(m -> 'players'))
    else nullif(array(
      select pid from public.profile_round_ids(m -> 'players') pid
      where (w is not null and public.bb_str(public.bb_obj(m -> 'devs') -> pid) = w)
         or (w is not null and w = public.bb_str(m -> 'hostDev') and public.bb_str(public.bb_obj(m -> 'devs') -> pid) is null)
         or (me is not null and exists (select 1 from public.account_players a where a.player_id = pid and a.user_id = me))
    ), '{}'::text[])
  end
$$;

-- Everyone on a plan, or null when there's no such plan
create or replace function public.comment_plan_seats(p_code text) returns text[]
language sql stable security definer set search_path = '' as $$
  select case when not exists (select 1 from public.planned_rounds p where p.code = p_code) then null else
    array(select distinct x from (
      select public.bb_str(e -> 'id') as x
        from public.planned_rounds p
        cross join lateral jsonb_array_elements(case when jsonb_typeof(p.meta -> 'people') = 'array' then p.meta -> 'people' else '[]'::jsonb end) e
        where p.code = p_code and jsonb_typeof(e) = 'object'
      union select public.bb_str(p.meta -> 'hostWho') from public.planned_rounds p where p.code = p_code
      union select r.who from public.plan_rsvps r where r.code = p_code
    ) s where x is not null)
  end
$$;

-- The seats the phone and account making this request may speak as, or null when they can't read it
create or replace function public.comment_seats(p_scope text, p_code text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  w text := public.bb_writer();
  me uuid := auth.uid();
  keys text[] := array_remove(array['d:' || w, 'u:' || me::text], null);
  m jsonb;
  s text[];
begin
  if p_scope = 'plan' then
    if not exists (select 1 from public.comment_members c where c.scope = 'plan' and c.code = p_code and c.member = any (keys)) then return null; end if;
    return public.comment_plan_seats(p_code);
  end if;
  if p_scope <> 'round' then return null; end if;
  select r.meta into m from public.live_rounds r where r.code = p_code;
  if found then
    s := public.comment_round_seats(m, w, me);
    if s is not null then return s; end if;
  end if;
  select array_agg(distinct x) into s from public.comment_members c cross join lateral unnest(c.seats) x
    where c.scope = 'round' and c.code = p_code and c.member = any (keys);
  return s;
end $$;

-- Let this phone (and its account) in, and remember the seats it has now. Returns the seats it may
-- speak as, or null when it isn't in that round or plan.
create or replace function public.join_comments(p_scope text, p_code text) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  w text := public.bb_writer();
  me uuid := auth.uid();
  m jsonb;
  s text[];
  k text;
begin
  if p_scope is null or p_scope not in ('round', 'plan') or p_code is null or p_code !~ '^[A-Z0-9]{6}$' then return null; end if;
  if p_scope = 'plan' then
    s := public.comment_plan_seats(p_code);
  else
    select r.meta into m from public.live_rounds r where r.code = p_code;
    if found then s := public.comment_round_seats(m, w, me); end if;
  end if;
  if s is not null then
    foreach k in array array_remove(array['d:' || w, 'u:' || me::text], null) loop
      insert into public.comment_members as c (scope, code, member, seats) values (p_scope, p_code, k, s)
      on conflict (scope, code, member) do update
        set seats = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(c.seats || excluded.seats) x);
    end loop;
  end if;
  return public.comment_seats(p_scope, p_code);
end $$;

-- The row was written by the phone or account making this request
create or replace function public.comment_mine(dev text, usr uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((dev is not null and dev = public.bb_writer()) or (usr is not null and usr = (select auth.uid())), false)
$$;

-- Who wrote a row comes from the request, never from the row sent; on a change, what it's about,
-- its seat and who wrote it stay as they were
create or replace function public.comments_keep() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_dev := public.bb_writer();
    new.author_user := auth.uid();
    return new;
  end if;
  new.scope := old.scope;
  new.code := old.code;
  new.id := old.id;
  new.target := old.target;
  new.kind := old.kind;
  new.who := old.who;
  new.author_dev := old.author_dev;
  new.author_user := old.author_user;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists comments_keep on public.comments;
create trigger comments_keep before insert or update on public.comments
  for each row execute function public.comments_keep();

create index if not exists comments_code on public.comments (code);

grant select, insert, update, delete on public.comments to anon, authenticated;
alter table public.comments enable row level security;
drop policy if exists "comment members read" on public.comments;
drop policy if exists "comment members add" on public.comments;
drop policy if exists "comment authors change" on public.comments;
drop policy if exists "comment authors remove" on public.comments;
create policy "comment members read" on public.comments for select to anon, authenticated
  using (public.comment_seats(scope, code) is not null);
create policy "comment members add" on public.comments for insert to anon, authenticated
  with check (public.comment_mine(author_dev, author_user) and who = any (public.comment_seats(scope, code)));
create policy "comment authors change" on public.comments for update to anon, authenticated
  using (public.comment_mine(author_dev, author_user))
  with check (public.comment_mine(author_dev, author_user) and who = any (public.comment_seats(scope, code)));
create policy "comment authors remove" on public.comments for delete to anon, authenticated
  using (public.comment_mine(author_dev, author_user));

revoke all on function public.comment_round_seats(jsonb, text, uuid) from public;
revoke all on function public.comment_plan_seats(text) from public;
grant execute on function public.comment_seats(text, text) to anon, authenticated;
grant execute on function public.join_comments(text, text) to anon, authenticated;
grant execute on function public.comment_mine(text, uuid) to anon, authenticated;
