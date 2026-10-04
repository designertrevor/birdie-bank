-- Tighter seat links (added 2026-10-04). Run this once in Supabase: Dashboard, SQL Editor, New
-- query, paste, Run. Safe to run again. Needs 2026-09-30-keeper-lock.sql (bb_writer() and the
-- round's devs map) and 2026-10-01-profiles.sql (account_players), both already run.
--
-- link_my_players() links player ids to the signed-in account, so a friend's seat shows their own
-- profile on every phone. Until now it took the account's word for it: your profile's player id
-- and the seat each saved round says you played as are written by your own phone, so someone who
-- knew a player id could put it in their own saved data and link it to their account first. That
-- matters before launch: a linked id shows that account's name, photo and payment app to everyone
-- who has that player in their rounds.
--
-- From now on an id is linked only from what the server saw for itself, with the phone told apart
-- by the device key every request carries (keeper-lock.js):
--  1. A seat you took in a live round. The round's devs map says which phone took each seat, and
--     only that phone can ever put itself there, once (the keeper lock enforces it). The seat is
--     linked when this request comes from that phone and the round's claims say it's your seat
--     now (claims follow a switch to another seat, so a mis-tap doesn't stay linked).
--  2. Your own player id, when this phone holds it as a seat in a live round (the round you shared
--     and play in has devs[your id] = this phone).
--  3. Your own player id when nobody else could know it yet: no other account's saved rounds have
--     it, and no live round has it as a seat that isn't this phone's.
-- Each saved round's localMe is no longer used: it's your phone's own word, nothing confirms it.
-- Seat claims alone aren't enough either: any phone with a round's link can write them.
--
-- Two more checks on 1 and 2, because anyone can share a round of their own with any player ids
-- in it and take those seats:
--  • The round is sealed: its host phone was on it from the moment it was shared. A round shared
--    before the keeper lock, or by an app older than it, has no host phone on record, and the first
--    phone to write to it could make itself the host phone and take any seat, so its devs prove
--    nothing. Rounds already on the server when this runs, with a host phone, count as sealed (it's
--    before launch, so nobody has posed as one).
--  • The seat belongs to that round's group: everyone else whose saved rounds have that player id
--    has also saved a round shared from the same host phone (they play with that organizer, or they
--    are the organizer). A player id from another group, put in a round someone made up, fails.
--    The cost is a friend now and then not linked automatically (say a player only ever saved in a
--    round from the organizer's old phone); "Same person as..." still joins them by hand.
--
-- What happens to links:
--  • Links made before this ran stay as they are. If one of them was made from your own word and
--    another account later shows the server's evidence for that id (1 or 2 above), the id moves to
--    that account.
--  • Otherwise the first account to link an id keeps it, as before.
--  • A seat linked from a live round comes off your account when that round still exists and its
--    claims no longer give you that seat (you switched seats). Once the round itself is gone the
--    link stays, so links don't fade as old rounds are tidied away.
--  • Links are only checked from the phone that made them (account_players.dev), so signing in on
--    another phone never removes what your first phone linked.
--
-- src/lib/seat-links.js is the same rules in JavaScript, with tests; keep the two in step.
--
-- To undo: run the link_my_players() from 2026-10-01-profiles.sql again, and
--          drop trigger live_rounds_seal on public.live_rounds;
-- The new columns, seat_in_group() and the indexes can stay.

alter table public.account_players add column if not exists dev text;        -- the phone that confirmed it (null: linked before 2026-10-04)
alter table public.account_players add column if not exists round_code text; -- the live round that confirmed it, for a seat

-- Sealed live rounds (see the top). The first run marks the rounds already there; after that only
-- a new round can be sealed, by having its host phone on it when it's shared
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'live_rounds' and column_name = 'sealed') then
    alter table public.live_rounds add column sealed boolean not null default false;
    update public.live_rounds set sealed = true where public.bb_str(meta -> 'hostDev') is not null;
  end if;
end $$;

-- Runs after the keeper lock (triggers run in name order), so hostDev is only there when the phone
-- sharing the round is the one it names. No phone can change it after that
create or replace function public.live_rounds_seal() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.sealed := public.bb_str(new.meta -> 'hostDev') is not null;
  else
    new.sealed := old.sealed;
  end if;
  return new;
end $$;
drop trigger if exists live_rounds_seal on public.live_rounds;
create trigger live_rounds_seal before insert or update on public.live_rounds
  for each row execute function public.live_rounds_seal();

-- So "who else has this player id?" doesn't read every round
create index if not exists user_docs_round_players on public.user_docs using gin ((data -> 'players') jsonb_path_ops) where kind = 'round';
create index if not exists user_docs_round_host on public.user_docs (user_id, (data ->> 'hostDev')) where kind = 'round';
create index if not exists live_rounds_players on public.live_rounds using gin ((meta -> 'players') jsonb_path_ops);

-- Whether everyone but p_me who has p_id in their saved rounds has also saved a round shared from
-- the phone p_host (see "the seat belongs to that round's group" at the top)
create or replace function public.seat_in_group(p_id text, p_host text, p_me uuid) returns boolean language sql stable set search_path = '' as $$
  select p_host is not null and not exists (
    select 1 from public.user_docs d
    where d.kind = 'round' and not d.deleted and d.user_id <> p_me
      and d.data -> 'players' @> jsonb_build_array(jsonb_build_object('id', p_id))
      and not exists (
        select 1 from public.user_docs e
        where e.user_id = d.user_id and e.kind = 'round' and not e.deleted and e.data ->> 'hostDev' = p_host
      )
  )
$$;

create or replace function public.link_my_players() returns setof text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  w text := public.bb_writer();
  my_player text;
  strong_ids text[];
  strong_codes text[];
  own_ok boolean := false;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select d.data ->> 'me' into my_player from public.user_docs d
    where d.user_id = me and d.kind = 'profile' and d.id = 'me' and not d.deleted;
  if my_player is null or length(my_player) not between 1 and 64 then
    select p.player_id into my_player from public.profiles p where p.user_id = me;
  end if;
  if my_player is not null and length(my_player) not between 1 and 64 then my_player := null; end if;

  -- 1 and 2: seats this phone took in sealed live rounds of the seat's own group, one round per id
  select coalesce(array_agg(e.id order by e.id), '{}'::text[]), coalesce(array_agg(e.code order by e.id), '{}'::text[])
  into strong_ids, strong_codes
  from (
    select distinct on (x.id) x.id, x.code from (
      -- A seat you took: the claims say it's yours and devs says this phone took it
      select c.key as id, r.code, r.meta from public.live_rounds r
        cross join lateral jsonb_each(public.bb_obj(r.meta -> 'claims')) c
        where r.sealed and w is not null and my_player is not null
          and c.value = to_jsonb(my_player)
          and length(c.key) between 1 and 64
          and public.bb_str(public.bb_obj(r.meta -> 'devs') -> c.key) = w
          and c.key in (select public.profile_round_ids(r.meta -> 'players'))
      union all
      -- Your own id as this phone's seat
      select my_player, r.code, r.meta from public.live_rounds r
        where r.sealed and w is not null and my_player is not null
          and r.meta -> 'players' @> jsonb_build_array(jsonb_build_object('id', my_player))
          and public.bb_str(public.bb_obj(r.meta -> 'devs') -> my_player) = w
    ) x
    where public.seat_in_group(x.id, public.bb_str(x.meta -> 'hostDev'), me)
    order by x.id, x.code
  ) e;

  -- 3: your own id, when nobody else could know it yet
  if my_player is not null and not (my_player = any (strong_ids)) then
    own_ok := not exists (
        select 1 from public.user_docs d
        where d.kind = 'round' and d.user_id <> me and not d.deleted
          and d.data -> 'players' @> jsonb_build_array(jsonb_build_object('id', my_player))
      )
      and not exists (
        select 1 from public.live_rounds r
        where r.meta -> 'players' @> jsonb_build_array(jsonb_build_object('id', my_player))
          and (w is null or public.bb_str(public.bb_obj(r.meta -> 'devs') -> my_player) is distinct from w)
      );
  end if;

  -- A seat this phone linked from a round that still exists, and whose claims don't give it to you
  -- any more (you switched seats), comes off. Your own id stays: devs never changes
  if w is not null and my_player is not null then
    delete from public.account_players a
    where a.user_id = me and a.dev = w and a.round_code is not null and a.player_id <> my_player
      and exists (
        select 1 from public.live_rounds r
        where r.code = a.round_code
          and (public.bb_obj(r.meta -> 'claims') -> a.player_id) is distinct from to_jsonb(my_player)
      );
  end if;

  -- The server's evidence: a new link, or one made before from someone's own word (yours or another account's)
  insert into public.account_players (player_id, user_id, dev, round_code)
  select u.id, me, w, u.code from unnest(strong_ids, strong_codes) as u(id, code)
  on conflict (player_id) do update set user_id = excluded.user_id, dev = excluded.dev, round_code = excluded.round_code
    where public.account_players.dev is null or public.account_players.user_id = excluded.user_id;

  -- Your own id with nobody else to know it: only when nobody has it yet (or it's already yours)
  if own_ok then
    insert into public.account_players (player_id, user_id, dev, round_code) values (my_player, me, w, null)
    on conflict (player_id) do update set dev = coalesce(public.account_players.dev, excluded.dev)
      where public.account_players.user_id = excluded.user_id;
  end if;

  return query select a.player_id from public.account_players a where a.user_id = me;
end $$;

-- Only signed-in people link (never the anon key); seat_in_group is only for link_my_players
revoke all on function public.link_my_players() from public, anon;
grant execute on function public.link_my_players() to authenticated;
revoke all on function public.seat_in_group(text, text, uuid) from public, anon, authenticated;
