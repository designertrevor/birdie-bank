-- Friends' rounds in the feed (added 2026-10-06). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again. Needs 2026-09-30-keeper-lock.sql, 2026-10-01-profiles.sql,
-- 2026-10-04-comments.sql and 2026-10-05-profile-privacy.sql first (all already run).
--
-- What it adds:
--  • friend_rounds(): the live rounds of people you've played with that you're not in (someone's
--    Tuesday round), going on now or finished in the last 7 days, newest first, at most 30. Each row
--    is the round as a watcher sees it (its meta and hole scores) plus, for each seat linked to an
--    account, whether that person is a friend of yours and whether their money may show to you.
--    A round's code is what lets a phone read it whole, money and all, so a row carries the code
--    only when the round's money may reach you. Otherwise it carries a ref instead (feed_ref: the
--    code hashed with a secret only the server knows), and friend_round(ref) is how the feed fetches
--    that round again, with the same parts kept back.
--  • follow_round(code): "Watch" on a friend's round. It remembers you in round_followers and
--    returns the ids you may write as on the round's own trash talk, or null when you can't follow it.
--  • The four comments policies again (from 2026-10-04-comments.sql), each with one more way in: a
--    friend who may follow the round reads and writes the talk on the round itself (target 'round'),
--    and only that. Settle-up lines and side bets between two players stay the players' alone.
--
-- Who shows up, and what of them (src/lib/friend-feed.js is the same rules in JavaScript, with
-- tests; keep the two in step). Each person's one profile setting (profiles.privacy) decides:
--  • A friend is an account you've played a round with (profile_visible_to_me, the same test as
--    for profiles). Only rounds with at least one friend in them come up.
--  • Only you ('hidden'): nothing. A round with anyone in it set to Only you never comes up for
--    people outside it, so nobody's scores reach people they didn't choose.
--  • People you've played with ('played', the default) and Everyone ('everyone'): the round comes up
--    for that friend's friends. Today both reach the same people, as for profiles.
--  • Money: someone's amounts show only when they turned on Show my money (showMoney), and only to
--    people they've played with: a friend of someone else in the round sees their first name and
--    scores, never their amounts. A guest with no account has no setting, so theirs never shows.
--    The money between a few people adds up to $0, so one hidden amount could be worked out from
--    the rest: a round's money goes out to you only when every seat linked to an account lets it
--    reach you (all or none, as a shared card in the app, share.js amountsRule). Otherwise the
--    round goes without anything that carries its money (feed_meta, feed_hole): the stakes, side
--    games, side bets, what the group agreed, presses and the banker's bets, marked
--    "feedMoney": false. A points round goes whole (points are bragging rights), and a lunch
--    round keeps its game (it says who's buying) but not its side bets.
--  • A round you're in (a seat linked to your account, or this phone's device on it) never comes up:
--    it's already on your phone.
--  • A row saved before the one setting (no profile level) keeps the rule fromLegacy() in
--    profile-model.js has: any of stats, handicap or home course hidden reads as Only you, and money
--    shows when money was 'played' or 'everyone'.
-- Each round's meta goes out without its code (shareCode), the phones' device hashes (devs,
-- hostDev), the seat claims or anyone's payment app and handle: a friend watching doesn't pay anyone. A Big Game's setup on
-- its rounds (trip.big) goes as its groups' names and round ids only: its stakes, its side bets,
-- the whole field's handicaps and the other groups' codes stay with the game.
-- Trash talk from the gallery (follow_round, follow_seats) is only on rounds whose money may reach
-- you: the talk is kept under the round's code, which would hand the money over with it.
--
-- Until this runs, the app's Friends feed shows only what the phone already has (rounds it's
-- watching, plans you're invited to, settle-ups, recaps and trash talk), and Watch follows nothing
-- new. Nothing else changes.
--
-- To undo: drop function public.friend_rounds(); drop function public.friend_round(text);
--          drop function public.friend_rows(text); drop function public.follow_round(text);
--          run the four comments policies from 2026-10-04-comments.sql again, then
--          drop function public.follow_seats(text); drop function public.follow_ids();
--          drop function public.feed_round_ok(jsonb); drop function public.feed_seats(jsonb);
--          drop function public.feed_meta(jsonb, boolean); drop function public.feed_hole(jsonb, jsonb, boolean);
--          drop function public.feed_kind(jsonb); drop function public.feed_money(jsonb);
--          drop function public.feed_level(jsonb); drop function public.feed_keep_money(jsonb);
--          drop function public.feed_ref(text); drop table public.round_followers, public.feed_secret;
-- The index on live_rounds can stay.

-- --------------------------- privacy, as the feed reads it ------------------

-- The one setting from a saved privacy row: 'everyone', 'played' or 'hidden'. No row reads as the default.
create or replace function public.feed_level(p jsonb) returns text language sql immutable set search_path = '' as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then 'played'
    when p ->> 'profile' in ('everyone', 'played', 'hidden') then p ->> 'profile'
    when coalesce(p ->> 'stats', 'played') = 'hidden' or coalesce(p ->> 'handicap', 'played') = 'hidden'
      or coalesce(p ->> 'homeCourse', 'played') = 'hidden' then 'hidden'
    else 'played'
  end
$$;

-- Whether someone's amounts may show: Show my money is on and they aren't Only you
create or replace function public.feed_money(p jsonb) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case
    when p is null or jsonb_typeof(p) <> 'object' then false
    when public.feed_level(p) = 'hidden' then false
    when p ->> 'profile' in ('everyone', 'played', 'hidden') then p -> 'showMoney' = 'true'::jsonb
    else coalesce(p ->> 'money', 'hidden') in ('played', 'everyone')
  end, false)
$$;

-- What a round is played for: 'points', 'reward' or 'money' (play-for.js playForOf)
create or replace function public.feed_kind(m jsonb) returns text language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(m -> 'playFor') = 'object' and m -> 'playFor' ->> 'kind' in ('points', 'reward') then m -> 'playFor' ->> 'kind'
    else 'money'
  end
$$;

-- A round's meta as a friend watching gets it: no device hashes, no seat claims, nobody's payment
-- app, and a Big Game's setup cut to its groups' names (never their codes). With keep_money false, nothing that carries the
-- money either (a points round keeps it all). An earlier draft of this file had a one-argument
-- feed_meta, so that one goes.
drop function if exists public.feed_meta(jsonb);
create or replace function public.feed_meta(m jsonb, keep_money boolean) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  r jsonb;
  k text;
begin
  if m is null or jsonb_typeof(m) <> 'object' then return null; end if;
  -- Nor its code (shareCode): the row says it when the money may go, and only then
  r := m - 'devs' - 'hostDev' - 'claims' - 'shareCode';
  if jsonb_typeof(r -> 'players') = 'array' then
    r := jsonb_set(r, '{players}', coalesce((
      select jsonb_agg(case when jsonb_typeof(x) = 'object' then x - 'payApp' - 'payHandle' else x end order by n)
      from jsonb_array_elements(r -> 'players') with ordinality as t(x, n)
    ), '[]'::jsonb));
  end if;
  if jsonb_typeof(r -> 'trip') = 'object' and jsonb_typeof(r #> '{trip,big}') = 'object' then
    r := jsonb_set(r, '{trip,big}', jsonb_build_object('groups', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', g -> 'id', 'name', g -> 'name', 'roundId', g -> 'roundId')) order by n)
      from jsonb_array_elements(case when jsonb_typeof(r #> '{trip,big,groups}') = 'array' then r #> '{trip,big,groups}' else '[]'::jsonb end)
        with ordinality as t(g, n)
      where jsonb_typeof(g) = 'object'
    ), '[]'::jsonb)));
  end if;
  k := public.feed_kind(r);
  if coalesce(keep_money, false) or k = 'points' then return r; end if;
  r := (r - 'bets' - 'betsGone' - 'agreed') || '{"feedMoney": false}'::jsonb;
  if k = 'reward' then return r; end if;
  return r - 'settings' - 'betHistory' - 'sideGames' - 'gamesFor';
end $$;

-- One hole as a friend watching gets it: a money round's money kept back takes its presses and
-- the banker's bets with it, leaving only who was the banker
create or replace function public.feed_hole(d jsonb, m jsonb, keep_money boolean) returns jsonb
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(d) is distinct from 'object' or coalesce(keep_money, false) or public.feed_kind(m) <> 'money' then d
    else (d - 'presses' - 'banker') || case
      when jsonb_typeof(d -> 'banker') = 'object' and d #> '{banker,banker}' is not null and d #> '{banker,banker}' <> 'null'::jsonb
        then jsonb_build_object('banker', jsonb_build_object('banker', d #> '{banker,banker}'))
      else '{}'::jsonb end
  end
$$;

-- Each seat in a live round's meta that's linked to an account: the seat, the account, its setting
-- and whether its money may show. A draft of this file had another return type, so it goes first.
drop function if exists public.feed_seats(jsonb);
create or replace function public.feed_seats(m jsonb)
returns table (seat text, account uuid, level text, shows_money boolean)
language sql stable security definer set search_path = '' as $$
  select a.player_id, a.user_id, public.feed_level(p.privacy), public.feed_money(p.privacy)
  from public.profile_round_ids(m -> 'players') as x(id)
  join public.account_players a on a.player_id = x.id
  left join public.profiles p on p.user_id = a.user_id
$$;

-- Whether the signed-in account may see the live round with meta m in its feed: nobody in it is
-- Only you, the account isn't in it, and a friend of the account is
create or replace function public.feed_round_ok(m jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.uid()) is not null and jsonb_typeof(m) = 'object'
    and not public.bb_is_player_dev(m, public.bb_writer())
    and not exists (select 1 from public.feed_seats(m) s where s.account = (select auth.uid()) or s.level = 'hidden')
    and exists (select 1 from public.feed_seats(m) s where s.account <> (select auth.uid()) and public.profile_visible_to_me(s.account)), false)
$$;

-- Whether the round with meta m may go to the signed-in account with its money: every seat with an
-- account is a friend of theirs who shows it (all or none)
create or replace function public.feed_keep_money(m jsonb) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.feed_seats(m) fs
    where not (fs.shows_money and public.profile_visible_to_me(fs.account)))
$$;

-- The secret a round's feed ref is made with. Nobody but the functions here reads it.
create table if not exists public.feed_secret (
  id boolean primary key default true check (id),
  secret text not null default gen_random_uuid()::text
);
alter table public.feed_secret enable row level security;
revoke all on public.feed_secret from anon, authenticated;
insert into public.feed_secret (id) values (true) on conflict (id) do nothing;

-- What a round goes by in the feed when its money stays back: six characters from its code and the
-- secret, so it names the round to friend_round() and can't be turned back into the code
create or replace function public.feed_ref(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select upper(substr(md5((select s.secret from public.feed_secret s where s.id) || ':' || p_code), 1, 6))
$$;

-- --------------------------- friends' rounds ---------------------------------

-- Live rounds are found by when they last moved: a hole scored updates live_holes, not the round row
create index if not exists live_rounds_updated on public.live_rounds (updated_at);

-- The feed's rows: every friend's round (p_ref null, at most 30) or the one round with that ref.
-- A row has the round's code only when its money goes along; otherwise its ref and no code.
-- An earlier draft of this file returned other columns from friend_rounds(), so it goes first.
drop function if exists public.friend_rounds();
create or replace function public.friend_rows(p_ref text)
returns table (code text, ref text, meta jsonb, holes jsonb, people jsonb, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null then return; end if;
  return query
  with recent as (
    select r.code, r.meta,
      greatest(r.updated_at, coalesce((select max(h.updated_at) from public.live_holes h where h.code = r.code), r.updated_at)) as moved_at
    from public.live_rounds r
    where r.updated_at > now() - interval '7 days' and jsonb_typeof(r.meta) = 'object'
      and r.meta ->> 'status' in ('active', 'done')
      and (p_ref is null or public.feed_ref(r.code) = p_ref)
  ), shown as (
    -- The money goes along only when every seat with an account is a friend of yours who shows it
    select r.code, r.meta, r.moved_at, public.feed_keep_money(r.meta) as keep_money
    from recent r
    -- A round still going that nobody has touched in 12 hours was left behind, so it's not live news
    where (r.meta ->> 'status' = 'done' or r.moved_at > now() - interval '12 hours')
      and public.feed_round_ok(r.meta)
  )
  select case when c.keep_money then c.code end,
    case when not c.keep_money then public.feed_ref(c.code) end,
    public.feed_meta(c.meta, c.keep_money),
    coalesce((
      select jsonb_object_agg(h.hole_no::text, public.feed_hole(h.data, c.meta, c.keep_money)) from public.live_holes h
      where h.code = c.code and h.hole_no > 0 and h.data is not null
    ), '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(s.seat, jsonb_build_object('friend', s.friend, 'money', s.friend and s.shows_money, 'account', case when s.friend then s.account end))
      from (select fs.seat, fs.account, fs.shows_money, public.profile_visible_to_me(fs.account) as friend from public.feed_seats(c.meta) fs) s
    ), '{}'::jsonb),
    c.moved_at
  from shown c
  order by c.moved_at desc
  limit case when p_ref is null then 30 else 1 end;
end $$;

create or replace function public.friend_rounds()
returns table (code text, ref text, meta jsonb, holes jsonb, people jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.friend_rows(null)
$$;

-- One friend's round by its ref, for a round whose money stays back (it has no code to fetch with)
create or replace function public.friend_round(p_ref text)
returns table (code text, ref text, meta jsonb, holes jsonb, people jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.friend_rows(p_ref) where p_ref ~ '^[0-9A-F]{6}$'
$$;

-- --------------------------- following one -----------------------------------

-- Who followed which round, with the ids they may write as on its talk. Only the functions below
-- read or write it, so a round's talk outlives the live round for the friends who watched it.
create table if not exists public.round_followers (
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  seats text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);
alter table public.round_followers enable row level security;
revoke all on public.round_followers from anon, authenticated;

-- The ids the signed-in account writes as when it follows a round: its linked player ids, and its
-- profile's own player id when no other account has that id
create or replace function public.follow_ids() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct s.id), '{}'::text[]) from (
    select a.player_id as id from public.account_players a where a.user_id = (select auth.uid())
    union
    select p.player_id from public.profiles p
    where p.user_id = (select auth.uid()) and p.player_id is not null
      and not exists (select 1 from public.account_players a where a.player_id = p.player_id and a.user_id <> p.user_id)
  ) s where s.id is not null
$$;

-- The ids the signed-in account may write as on round p_code's own talk as a friend watching, or
-- null when it can't. While the live round is there, everyone's setting decides (feed_round_ok), and
-- only a round whose money may reach them (feed_keep_money: its talk is kept under its code, which
-- would give the money away); once it's gone, a friend who followed it keeps it, as the players keep theirs.
create or replace function public.follow_seats(p_code text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  m jsonb;
  s text[];
begin
  if (select auth.uid()) is null or p_code is null then return null; end if;
  select r.meta into m from public.live_rounds r where r.code = p_code;
  if found then
    if not public.feed_round_ok(m) or not public.feed_keep_money(m) then return null; end if;
    s := public.follow_ids();
  else
    select f.seats into s from public.round_followers f where f.code = p_code and f.user_id = (select auth.uid());
  end if;
  return nullif(s, '{}'::text[]);
end $$;

-- Watch a friend's round: remember this account on it and return the ids it may write as, or null
create or replace function public.follow_round(p_code text) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s text[];
begin
  if me is null or p_code is null or p_code !~ '^[A-Z0-9]{6}$' then return null; end if;
  s := public.follow_seats(p_code);
  if s is not null and exists (select 1 from public.live_rounds r where r.code = p_code) then
    insert into public.round_followers as f (code, user_id, seats) values (p_code, me, s)
    on conflict (code, user_id) do update
      set seats = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(f.seats || excluded.seats) x);
  end if;
  return s;
end $$;

-- --------------------------- the round's talk, for friends watching ---------

-- As in 2026-10-04-comments.sql, plus: a friend who may follow the round reads and writes the talk
-- on the round itself, as one of their own ids. Never a settle-up line's or a side bet's.
drop policy if exists "comment members read" on public.comments;
drop policy if exists "comment members add" on public.comments;
drop policy if exists "comment authors change" on public.comments;
drop policy if exists "comment authors remove" on public.comments;
create policy "comment members read" on public.comments for select to anon, authenticated
  using (public.comment_seats(scope, code) is not null
    or (scope = 'round' and target = 'round' and public.follow_seats(code) is not null));
create policy "comment members add" on public.comments for insert to anon, authenticated
  with check (public.comment_mine(author_dev, author_user) and (
    who = any (public.comment_seats(scope, code))
    or (scope = 'round' and target = 'round' and who = any (public.follow_seats(code)))));
create policy "comment authors change" on public.comments for update to anon, authenticated
  using (public.comment_mine(author_dev, author_user))
  with check (public.comment_mine(author_dev, author_user) and (
    who = any (public.comment_seats(scope, code))
    or (scope = 'round' and target = 'round' and who = any (public.follow_seats(code)))));
create policy "comment authors remove" on public.comments for delete to anon, authenticated
  using (public.comment_mine(author_dev, author_user));

-- --------------------------- who may call what -------------------------------

-- The helpers read account_players and profiles for whatever they're handed, so they only run
-- inside the functions above. Supabase grants every new function to anon and authenticated by
-- itself, so take it back from them too.
revoke all on function public.feed_seats(jsonb) from public, anon, authenticated;
revoke all on function public.feed_round_ok(jsonb) from public, anon, authenticated;
revoke all on function public.follow_ids() from public, anon, authenticated;
revoke all on function public.feed_keep_money(jsonb) from public, anon, authenticated;
revoke all on function public.feed_ref(text) from public, anon, authenticated;
revoke all on function public.friend_rows(text) from public, anon, authenticated;
-- friend_rounds() and follow_round() are for signed-in people; follow_seats() is checked by the
-- comments policies for every request (it says null to anyone not signed in)
revoke all on function public.friend_rounds() from public, anon;
revoke all on function public.friend_round(text) from public, anon;
grant execute on function public.friend_round(text) to authenticated;
revoke all on function public.follow_round(text) from public, anon;
grant execute on function public.friend_rounds() to authenticated;
grant execute on function public.follow_round(text) to authenticated;
grant execute on function public.follow_seats(text) to anon, authenticated;
