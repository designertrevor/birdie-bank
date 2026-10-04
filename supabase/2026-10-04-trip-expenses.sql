-- Trip expenses (added 2026-10-04). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again. Run it after 2026-10-03-trip-plans.sql (it uses that file's
-- trip_plans table and bb_round_devs, and the keeper lock's bb_writer).
--
-- One row per trip expense (gas, dinner, the house): what it was, how much, who paid and how it's
-- split, as the app keeps it (src/lib/trip-expenses.js), so every phone on the trip has the same
-- expenses, the trip's published plan counts them, and Settle the trip and the Tab agree on every
-- phone. A deleted expense stays as a small stub ({ deleted: true }), so every phone hears it's gone.
--
-- Who can do what:
--  - Read: anyone on the trip. That's the phone (or account) that added any of its expenses, the
--    organizer's phone that publishes its plan, and the phones of the players in the trip's live
--    rounds (the phone that shared each round and the phone that took each seat, from the round's
--    meta), from every round code filed for the trip, on its plan or its expenses. Those phones are
--    copied onto each row (readers) when it's saved, so they can still read it after a live round
--    stops being shared.
--  - Add: any phone with a device key.
--  - Change or delete: only the phone (or account) that added it.
--
-- Until this runs, each expense stays on the phone that added it and its account, and counts there
-- the same way: on the Trip page, the Tab and Settle the trip. Nothing else changes.
--
-- To undo: drop table public.trip_expenses; drop function public.trip_expenses_guard();
--          drop function public.bb_trip_member(text);

create table if not exists public.trip_expenses (
  trip_id text not null check (length(trip_id) between 1 and 64),
  id text not null check (length(id) between 1 and 64),
  codes text[] not null default '{}' check (public.bb_codes_ok(codes)),
  expense jsonb not null check (jsonb_typeof(expense) = 'object' and length(expense::text) < 20000),
  owner_dev text,
  owner_uid uuid,
  readers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, id)
);

create index if not exists trip_expenses_trip on public.trip_expenses (trip_id);

-- Whether this request is on the trip: it added one of its expenses, publishes its plan, reads its
-- plan, or is a phone in one of the trip's live rounds. Security definer, so it can look across the
-- trip's rows without running into the row rules it's part of; it only ever answers yes or no.
create or replace function public.bb_trip_member(t text) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  w text := public.bb_writer();
  u uuid := auth.uid();
  c text[];
begin
  if exists (select 1 from public.trip_expenses e where e.trip_id = t
      and ((u is not null and e.owner_uid = u) or (w is not null and (e.owner_dev = w or w = any(e.readers))))) then
    return true;
  end if;
  if exists (select 1 from public.trip_plans p where p.trip_id = t
      and ((u is not null and p.owner_uid = u) or (w is not null and (p.owner_dev = w or w = any(p.readers))))) then
    return true;
  end if;
  if w is null then return false; end if;
  select coalesce(array_agg(distinct x), '{}') into c from (
    select unnest(p.codes) as x from public.trip_plans p where p.trip_id = t
    union
    select unnest(e.codes) from public.trip_expenses e where e.trip_id = t
  ) y where x is not null;
  return w = any(public.bb_round_devs(c));
end $$;

-- The owner is set once, by the phone that adds it; only that phone or account changes it after
create or replace function public.trip_expenses_guard() returns trigger language plpgsql set search_path = '' as $$
declare w text := public.bb_writer();
begin
  if tg_op = 'INSERT' then
    if w is null then raise exception 'A device key is needed to add a trip expense' using errcode = '42501'; end if;
    new.owner_dev := w;
    new.owner_uid := auth.uid();
    new.readers := public.bb_round_devs(new.codes);
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not ((w is not null and w = old.owner_dev) or (old.owner_uid is not null and old.owner_uid = auth.uid())) then
      raise exception 'Only the person who added a trip expense changes it' using errcode = '42501';
    end if;
    new.trip_id := old.trip_id;
    new.id := old.id;
    new.owner_dev := old.owner_dev;
    new.owner_uid := old.owner_uid;
    new.created_at := old.created_at;
    -- Never fewer readers: a phone that could read it still can after its round stops being shared
    new.readers := array(select distinct x from unnest(old.readers || public.bb_round_devs(new.codes)) x where x is not null);
    new.updated_at := now();
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trip_expenses_guard on public.trip_expenses;
create trigger trip_expenses_guard before insert or update on public.trip_expenses
  for each row execute function public.trip_expenses_guard();

grant select, insert, update, delete on public.trip_expenses to anon, authenticated;

alter table public.trip_expenses enable row level security;
drop policy if exists "trip people read" on public.trip_expenses;
drop policy if exists "trip people add" on public.trip_expenses;
drop policy if exists "adder changes" on public.trip_expenses;
drop policy if exists "adder removes" on public.trip_expenses;
create policy "trip people read" on public.trip_expenses for select to anon, authenticated
  using (public.bb_trip_member(trip_id));
create policy "trip people add" on public.trip_expenses for insert to anon, authenticated
  with check (public.bb_writer() is not null);
create policy "adder changes" on public.trip_expenses for update to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()))
  with check (true);
create policy "adder removes" on public.trip_expenses for delete to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()));
