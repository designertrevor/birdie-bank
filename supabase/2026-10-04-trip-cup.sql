-- Team points trips, Ryder Cup style (added 2026-10-04). Run this once in Supabase: Dashboard,
-- SQL Editor, New query, paste, Run. Safe to run again. Run it after 2026-10-03-trip-plans.sql
-- (it uses that file's bb_round_devs, and 2026-09-30-keeper-lock.sql's bb_writer).
--
-- A trip played for team points has its matches spread over several groups' rounds, each on its
-- own phones. Each phone posts the matches of the trip rounds it keeps (src/lib/cup-sync.js), one
-- row a round, and every phone on the trip reads them all, so the team score and the leaderboard
-- are the same on every phone. Each phone also keeps one row of its own "I paid" marks for the
-- trip's stake. No money is worked out here: the rounds' money stays on the Tab as before.
--
-- Rows (trip_id, key):
--  - key a round's six-letter live code: that round's matches, posted by a phone in that round.
--  - key 'L' + a round id: a round that wasn't shared live, posted by the phone that has it.
--  - key 'P' + the first 20 characters of a phone's device hash: that phone's stake marks.
--
-- Who can do what:
--  - Read: a phone that posted a row for the trip, a phone in one of the trip's live rounds (from
--    the round's meta: hostDev and devs, copied onto the row each time it's posted, so it can still
--    read after a live round stops being shared), or the same account.
--  - Write: a round's row, a phone in that round (or the phone that first posted it); an 'L' row,
--    the phone that first posted it; a 'P' row, only the phone it's named for.
--
-- Until this runs, each phone counts the matches of the rounds it has, so a friend in another
-- group sees only their own group's matches.
--
-- To undo: drop table public.trip_cup; drop function public.trip_cup_guard();
--          drop function public.bb_cup_reader(text); drop function public.bb_cup_writer(text, text, uuid);

create table if not exists public.trip_cup (
  trip_id text not null check (length(trip_id) between 1 and 64),
  key text not null check (key ~ '^([A-Z0-9]{6}|L[A-Za-z0-9_-]{1,63}|P[0-9a-f]{20})$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and length(data::text) < 20000),
  owner_dev text,
  owner_uid uuid,
  readers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, key)
);

-- Whether this request may read a trip's rows: it posted one, it's a phone in one of the trip's
-- live rounds (now, or when a row was posted), or it's the same account
create or replace function public.bb_cup_reader(t text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare w text := public.bb_writer(); u uuid := auth.uid();
begin
  if w is null and u is null then return false; end if;
  return exists (
    select 1 from public.trip_cup c where c.trip_id = t and (
      (u is not null and c.owner_uid = u)
      or (w is not null and (c.owner_dev = w or w = any(c.readers)
        or (c.key ~ '^[A-Z0-9]{6}$' and w = any(public.bb_round_devs(array[c.key])))))
    )
  );
end $$;

-- Whether this request may change a row: its owner, or for a round's row, a phone in that round
create or replace function public.bb_cup_writer(k text, owner_dev text, owner_uid uuid) returns boolean language plpgsql stable set search_path = '' as $$
declare w text := public.bb_writer();
begin
  if owner_uid is not null and owner_uid = auth.uid() then return true; end if;
  if w is null then return false; end if;
  if w = owner_dev then return true; end if;
  return k ~ '^[A-Z0-9]{6}$' and w = any(public.bb_round_devs(array[k]));
end $$;

create or replace function public.trip_cup_guard() returns trigger language plpgsql set search_path = '' as $$
declare
  w text := public.bb_writer();
  code boolean := new.key ~ '^[A-Z0-9]{6}$';
begin
  if w is null then raise exception 'A device key is needed to post trip matches' using errcode = '42501'; end if;
  if tg_op = 'INSERT' then
    if code and not (w = any(public.bb_round_devs(array[new.key]))) then
      raise exception 'Only a phone in that round posts its matches' using errcode = '42501';
    end if;
    if left(new.key, 1) = 'P' and new.key <> ('P' || left(w, 20)) then
      raise exception 'A phone posts only its own marks' using errcode = '42501';
    end if;
    new.owner_dev := w;
    new.owner_uid := auth.uid();
    new.readers := case when code then public.bb_round_devs(array[new.key]) else '{}'::text[] end;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not public.bb_cup_writer(old.key, old.owner_dev, old.owner_uid) then
      raise exception 'Not this phone’s row to change' using errcode = '42501';
    end if;
    new.trip_id := old.trip_id;
    new.key := old.key;
    new.owner_dev := old.owner_dev;
    new.owner_uid := old.owner_uid;
    new.created_at := old.created_at;
    -- Never fewer readers: a phone that could read the trip's matches still can after its round stops being shared
    new.readers := array(select distinct x from unnest(old.readers || case when code then public.bb_round_devs(array[old.key]) else '{}'::text[] end) x where x is not null);
    new.updated_at := now();
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trip_cup_guard on public.trip_cup;
create trigger trip_cup_guard before insert or update on public.trip_cup
  for each row execute function public.trip_cup_guard();

grant select, insert, update, delete on public.trip_cup to anon, authenticated;

alter table public.trip_cup enable row level security;
drop policy if exists "trip cup readers" on public.trip_cup;
drop policy if exists "trip cup adds" on public.trip_cup;
drop policy if exists "trip cup changes" on public.trip_cup;
drop policy if exists "trip cup removes" on public.trip_cup;
create policy "trip cup readers" on public.trip_cup for select to anon, authenticated
  using (public.bb_cup_reader(trip_id) or public.bb_cup_writer(key, owner_dev, owner_uid));
create policy "trip cup adds" on public.trip_cup for insert to anon, authenticated
  with check (public.bb_writer() is not null);
create policy "trip cup changes" on public.trip_cup for update to anon, authenticated
  using (public.bb_cup_writer(key, owner_dev, owner_uid))
  with check (true);
create policy "trip cup removes" on public.trip_cup for delete to anon, authenticated
  using (public.bb_cup_writer(key, owner_dev, owner_uid));
