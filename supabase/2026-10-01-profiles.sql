-- Profiles and claimed seats (added 2026-10-01). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again.
--
-- What it adds:
--  • profiles: one row per account (name, handicap index, home course, avatar, payment app and
--    handle, privacy settings, basic stats). Only you can read or write your own row directly.
--    People you've played a round with read it through people_profiles(), which leaves out what
--    your privacy settings hide (money stays hidden unless you choose to show it).
--  • account_players: which player ids are which account. When you take a seat from a round's
--    link, that seat's id is linked to your account, so every phone that has the seat sees the
--    same person and nobody has to merge anyone by hand. Rows are only ever written by
--    link_my_players(), from what the server can see: your own player id (your profile in
--    user_docs), the seats your saved rounds say you played as, and the seats you claimed in live
--    rounds. The first account to link a player id keeps it, and a seat you no longer hold (you
--    switched seats, or deleted that round) comes off your account on the next run.
--  • avatars: a storage bucket for profile photos (256px JPEGs), one folder per account. Only you
--    can add, change or remove files in your folder; anyone with a photo's link can see it, the
--    same as a photo in a group chat.
--  • delete_my_account(): "Delete your account" in Settings. Removes your profile, your linked
--    player ids, your photos and your saved data, then the account itself. Other people's rounds
--    are theirs and stay as they are: their copies keep your name and every amount.
--
-- Until this runs, the app keeps your profile on your phone (and in your account's saved data),
-- links seats from round claims as before, and says "Delete your account" isn't available yet.
--
-- To undo: drop function public.delete_my_account(boolean); drop function public.people_profiles(text[]);
--          drop function public.link_my_players(); drop function public.profile_visible_to_me(uuid);
--          drop function public.profile_round_ids(jsonb);
--          drop table public.account_players; drop table public.profiles;

-- --------------------------- profiles --------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade
);
-- Each column on its own, so a profiles table made some other way picks up what's missing
alter table public.profiles add column if not exists player_id text check (length(player_id) between 1 and 64);
alter table public.profiles add column if not exists display_name text check (length(display_name) between 1 and 40);
alter table public.profiles add column if not exists handicap_index numeric(4,1) check (handicap_index between -10 and 54);
alter table public.profiles add column if not exists home_course jsonb check (home_course is null or jsonb_typeof(home_course) = 'object');
alter table public.profiles add column if not exists avatar jsonb check (avatar is null or jsonb_typeof(avatar) = 'object');
alter table public.profiles add column if not exists pay_app text check (pay_app in ('venmo', 'cashapp', 'paypal', 'zelle'));
alter table public.profiles add column if not exists pay_handle text check (length(pay_handle) <= 80);
alter table public.profiles add column if not exists privacy jsonb not null
  default '{"money": "hidden", "stats": "played", "handicap": "played", "homeCourse": "played"}'::jsonb
  check (jsonb_typeof(privacy) = 'object');
alter table public.profiles add column if not exists stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object');
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

grant select, insert, update, delete on public.profiles to authenticated;
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- --------------------------- linked player ids ------------------------------

create table if not exists public.account_players (
  player_id text primary key check (length(player_id) between 1 and 64),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists account_players_user on public.account_players (user_id);

grant select on public.account_players to authenticated;
alter table public.account_players enable row level security;
drop policy if exists "own player ids" on public.account_players;
create policy "own player ids" on public.account_players for select to authenticated
  using ((select auth.uid()) = user_id);

-- The player ids a jsonb array of round players uses ('[]' when it isn't an array)
create or replace function public.profile_round_ids(players jsonb) returns setof text language sql immutable set search_path = '' as $$
  select x ->> 'id' from jsonb_array_elements(case when jsonb_typeof(players) = 'array' then players else '[]'::jsonb end) x
  where jsonb_typeof(x) = 'object' and length(x ->> 'id') between 1 and 64
$$;

-- Whether the signed-in account has played a round with `owner` (or is `owner`): a round saved in
-- either account has a player linked to the other, or a live round has players linked to both.
create or replace function public.profile_visible_to_me(owner uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.uid()) is not null and owner is not null and (
    (select auth.uid()) = owner
    or exists (
      select 1 from public.user_docs d
      cross join lateral public.profile_round_ids(d.data -> 'players') pid
      join public.account_players a on a.player_id = pid
      where d.user_id = (select auth.uid()) and d.kind = 'round' and not d.deleted and a.user_id = owner
    )
    or exists (
      select 1 from public.user_docs d
      cross join lateral public.profile_round_ids(d.data -> 'players') pid
      join public.account_players a on a.player_id = pid
      where d.user_id = owner and d.kind = 'round' and not d.deleted and a.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.live_rounds r
      where exists (select 1 from public.profile_round_ids(r.meta -> 'players') pid join public.account_players a on a.player_id = pid where a.user_id = (select auth.uid()))
        and exists (select 1 from public.profile_round_ids(r.meta -> 'players') pid join public.account_players a on a.player_id = pid where a.user_id = owner)
    )
  ), false)
$$;

-- Link the signed-in account's player ids, from what the server can see now. Returns every player
-- id the account has. Each run starts from the evidence again: a seat you no longer hold (you
-- took the wrong one and switched, or deleted that round) comes off your account, so a mis-tap
-- never joins a friend to you for good. Ids another account linked first stay theirs.
create or replace function public.link_my_players() returns setof text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_player text;
  ids text[];
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select d.data ->> 'me' into my_player from public.user_docs d
    where d.user_id = me and d.kind = 'profile' and d.id = 'me' and not d.deleted;
  if my_player is null or length(my_player) not between 1 and 64 then
    select p.player_id into my_player from public.profiles p where p.user_id = me;
  end if;
  select coalesce(array_agg(distinct x.id), '{}'::text[]) into ids from (
    -- You
    select my_player as id where my_player is not null
    -- The seat you played as in each round saved in your account
    union select d.data ->> 'localMe' from public.user_docs d
      where d.user_id = me and d.kind = 'round' and not d.deleted and length(d.data ->> 'localMe') between 1 and 64
    -- Seats you claimed in live rounds (a round's claims map is seat id -> the claimer's own id)
    union select c.key from public.live_rounds r
      cross join lateral jsonb_each(case when jsonb_typeof(r.meta -> 'claims') = 'object' then r.meta -> 'claims' else '{}'::jsonb end) c
      where my_player is not null and c.value = to_jsonb(my_player) and length(c.key) between 1 and 64
        and c.key in (select public.profile_round_ids(r.meta -> 'players'))
  ) x
  where x.id is not null;
  delete from public.account_players a where a.user_id = me and not (a.player_id = any (ids));
  insert into public.account_players (player_id, user_id)
  select u.id, me from unnest(ids) as u(id)
  on conflict (player_id) do nothing;
  return query select a.player_id from public.account_players a where a.user_id = me;
end $$;

-- For the player ids on a phone (up to 500): which account each one is, and that account's profile
-- when the signed-in account has played with them. What their privacy settings hide comes back empty.
create or replace function public.people_profiles(p_ids text[])
returns table (
  player_id text, user_id uuid, visible boolean, display_name text, handicap_index numeric,
  home_course jsonb, avatar jsonb, pay_app text, pay_handle text, stats jsonb, updated_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select a.player_id, a.user_id, v.ok,
    case when v.ok then p.display_name end,
    case when v.ok and coalesce(p.privacy ->> 'handicap', 'played') <> 'hidden' then p.handicap_index end,
    case when v.ok and coalesce(p.privacy ->> 'homeCourse', 'played') <> 'hidden' then p.home_course end,
    case when v.ok then p.avatar end,
    case when v.ok then p.pay_app end,
    case when v.ok then p.pay_handle end,
    case
      when not v.ok or p.stats is null or coalesce(p.privacy ->> 'stats', 'played') = 'hidden' then null
      when p.privacy ->> 'money' = 'played' or a.user_id = (select auth.uid()) then p.stats
      else p.stats - 'money'
    end,
    case when v.ok then p.updated_at end
  from public.account_players a
  left join public.profiles p on p.user_id = a.user_id
  cross join lateral (select public.profile_visible_to_me(a.user_id) and p.user_id is not null as ok) v
  where (select auth.uid()) is not null and a.player_id = any (p_ids[1:500])
$$;

-- --------------------------- avatar photos ----------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatar owners read" on storage.objects;
drop policy if exists "avatar owners add" on storage.objects;
drop policy if exists "avatar owners change" on storage.objects;
drop policy if exists "avatar owners remove" on storage.objects;
create policy "avatar owners read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar owners add" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar owners change" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar owners remove" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- --------------------------- delete your account ----------------------------

-- p_check = true only says the function is here (the app asks before it shows the last step).
-- The app removes your photos through Storage first; this removes any it missed where the
-- database allows it.
create or replace function public.delete_my_account(p_check boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_check then return 'ready'; end if;
  begin
    perform set_config('storage.allow_delete_query', 'true', true);
    delete from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = me::text;
  exception when others then
    null; -- Storage may refuse a direct delete; the app already removed the photos through Storage
  end;
  delete from public.account_players where user_id = me;
  delete from public.profiles where user_id = me;
  delete from public.user_docs where user_id = me;
  -- Live rounds, plans and shared Tab rows belong to everyone in them, so they stay: other phones
  -- keep their copies, with your name and every amount as it was.
  delete from auth.users where id = me;
  return 'deleted';
end $$;

-- Only signed-in people call these (never the anon key)
revoke all on function public.profile_visible_to_me(uuid) from public, anon;
revoke all on function public.link_my_players() from public, anon;
revoke all on function public.people_profiles(text[]) from public, anon;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.profile_visible_to_me(uuid) to authenticated;
grant execute on function public.link_my_players() to authenticated;
grant execute on function public.people_profiles(text[]) to authenticated;
grant execute on function public.delete_my_account(boolean) to authenticated;
