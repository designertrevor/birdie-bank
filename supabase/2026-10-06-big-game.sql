-- The Big Game (added 2026-10-06). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again. Run it after 2026-10-03-trip-plans.sql (it uses that file's
-- bb_codes_ok, bb_round_devs and bb_trip_reader, and 2026-09-30-keeper-lock.sql's bb_writer).
--
-- A Big Game is several groups playing one game: one pot, one leaderboard, field skins, teams and
-- side bets across the groups (src/lib/big-game.js). Each group keeps score in its own live round,
-- so each group's scores are already on the server, posted by that group's scorekeeper under the
-- keeper lock (live_rounds and live_holes), and every phone in the game reads the other groups'
-- rounds from there by their codes. Nothing about the scores is kept here.
--
-- This table holds the organizer's copy of the game: the groups and their live codes, the pot, the
-- skins, the teams, the side bets (added after tee off too) and whether the organizer closed it
-- early, with a version, so every phone in the game takes the newest copy. One row a game. No money
-- is worked out here: every phone works the game's money out from the same cards.
--
-- Who can do what:
--  - Read: the organizer's phone (or account), and the phones of the players in the game's live
--    rounds (the phone that shared each round, and the phone that took each seat, from the round's
--    meta: hostDev and devs). Those phones are copied onto the row (readers) each time it's saved,
--    so they can still read it after a live round stops being shared.
--  - Write: only the organizer. The first phone to save a game owns the row (its device key's hash,
--    and its account when signed in); only that phone or account can change or delete it.
--
-- Until this runs, each phone keeps the copy of the game its round came with, and the organizer's
-- changes reach a group only through a round the organizer's phone still keeps the card for. The
-- boards and the money work the same either way.
--
-- To undo: drop table public.big_games; drop function public.big_games_guard();

create table if not exists public.big_games (
  trip_id text primary key check (length(trip_id) between 1 and 64),
  codes text[] not null default '{}' check (public.bb_codes_ok(codes)),
  game jsonb not null check (jsonb_typeof(game) = 'object' and length(game::text) < 60000),
  owner_dev text,
  owner_uid uuid,
  readers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The owner is set once, by the phone that first saves the game; nobody else changes the row
create or replace function public.big_games_guard() returns trigger language plpgsql set search_path = '' as $$
declare w text := public.bb_writer();
begin
  if tg_op = 'INSERT' then
    if w is null then raise exception 'A device key is needed to save a Big Game' using errcode = '42501'; end if;
    new.owner_dev := w;
    new.owner_uid := auth.uid();
    new.readers := public.bb_round_devs(new.codes);
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not ((w is not null and w = old.owner_dev) or (old.owner_uid is not null and old.owner_uid = auth.uid())) then
      raise exception 'Only the organizer changes a Big Game' using errcode = '42501';
    end if;
    new.trip_id := old.trip_id;
    new.owner_dev := old.owner_dev;
    new.owner_uid := old.owner_uid;
    new.created_at := old.created_at;
    -- Never fewer readers: a phone that could read the game still can after its round stops being shared
    new.readers := array(select distinct x from unnest(old.readers || public.bb_round_devs(new.codes)) x where x is not null);
    new.updated_at := now();
    return new;
  end if;
  return old;
end $$;

drop trigger if exists big_games_guard on public.big_games;
create trigger big_games_guard before insert or update on public.big_games
  for each row execute function public.big_games_guard();

grant select, insert, update, delete on public.big_games to anon, authenticated;

alter table public.big_games enable row level security;
drop policy if exists "big game members read" on public.big_games;
drop policy if exists "big game organizer adds" on public.big_games;
drop policy if exists "big game organizer changes" on public.big_games;
drop policy if exists "big game organizer removes" on public.big_games;
create policy "big game members read" on public.big_games for select to anon, authenticated
  using (public.bb_trip_reader(codes, readers, owner_dev, owner_uid));
create policy "big game organizer adds" on public.big_games for insert to anon, authenticated
  with check (public.bb_writer() is not null);
create policy "big game organizer changes" on public.big_games for update to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()))
  with check (true);
create policy "big game organizer removes" on public.big_games for delete to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()));
