-- Trip plans (added 2026-10-03). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again. Run it after 2026-09-30-keeper-lock.sql (it uses that file's
-- bb_writer, bb_obj and bb_str).
--
-- One row per golf trip: the organizer's phone works out the fewest payments that square the
-- trip's rounds shared live (src/lib/trip-plan.js) and publishes them here, with the rounds the
-- plan covers and a version. Every phone on the trip reads the same plan, so Settle the trip and
-- the Tab show the same amounts on every phone. When a round is added or a score fixed, the
-- organizer's phone publishes a new version.
--
-- Who can do what:
--  - Read: the organizer's phone (or account), and the phones of the players in the trip's live
--    rounds (the phone that shared each round, and the phone that took each seat, from the
--    round's meta: hostDev and devs). Those phones are copied onto the row (readers) each time it's
--    published, so they can still read it after a live round stops being shared.
--  - Write: only the organizer. The first phone to publish a trip's plan owns the row (its device
--    key's hash, and its account when signed in); only that phone or account can change or delete it.
--
-- Until this runs, the app settles every trip pair by pair, exactly as before (each pair nets what's
-- between the two of them on their rounds shared live), and a trip with a finished round shared
-- live can't be deleted.
--
-- To undo: drop table public.trip_plans; drop function public.trip_plans_guard();
--          drop function public.bb_trip_reader(text[], text[], text, uuid);
--          drop function public.bb_round_devs(text[]); drop function public.bb_codes_ok(text[]);

-- Six-letter round codes, at most 100 of them
create or replace function public.bb_codes_ok(c text[]) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(cardinality(c) <= 100 and not exists (select 1 from unnest(c) x where x is null or x !~ '^[A-Z0-9]{6}$'), false)
$$;

create table if not exists public.trip_plans (
  trip_id text primary key check (length(trip_id) between 1 and 64),
  codes text[] not null default '{}' check (public.bb_codes_ok(codes)),
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and length(plan::text) < 100000),
  owner_dev text,
  owner_uid uuid,
  readers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The hashes of every phone in these live rounds: the phone that shared each, and each seat's phone
create or replace function public.bb_round_devs(c text[]) returns text[] language plpgsql stable set search_path = '' as $$
declare out text[];
begin
  select coalesce(array_agg(distinct d), '{}') into out from (
    select public.bb_str(r.meta -> 'hostDev') as d from public.live_rounds r where r.code = any(c)
    union
    select public.bb_str(e.value) from public.live_rounds r, jsonb_each(public.bb_obj(r.meta -> 'devs')) e where r.code = any(c)
  ) x where d is not null;
  return out;
end $$;

-- Whether this request may read a plan: the owner, or a phone in one of the trip's live rounds
create or replace function public.bb_trip_reader(c text[], readers text[], owner_dev text, owner_uid uuid) returns boolean language plpgsql stable set search_path = '' as $$
declare w text := public.bb_writer();
begin
  if owner_uid is not null and owner_uid = auth.uid() then return true; end if;
  if w is null then return false; end if;
  return w = owner_dev or w = any(readers) or w = any(public.bb_round_devs(c));
end $$;

-- The owner is set once, by the phone that first publishes; nobody else changes the row
create or replace function public.trip_plans_guard() returns trigger language plpgsql set search_path = '' as $$
declare w text := public.bb_writer();
begin
  if tg_op = 'INSERT' then
    if w is null then raise exception 'A device key is needed to publish a trip plan' using errcode = '42501'; end if;
    new.owner_dev := w;
    new.owner_uid := auth.uid();
    new.readers := public.bb_round_devs(new.codes);
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if not ((w is not null and w = old.owner_dev) or (old.owner_uid is not null and old.owner_uid = auth.uid())) then
      raise exception 'Only the organizer changes a trip plan' using errcode = '42501';
    end if;
    new.trip_id := old.trip_id;
    new.owner_dev := old.owner_dev;
    new.owner_uid := old.owner_uid;
    new.created_at := old.created_at;
    -- Never fewer readers: a phone that could read the plan still can after its round stops being shared
    new.readers := array(select distinct x from unnest(old.readers || public.bb_round_devs(new.codes)) x where x is not null);
    new.updated_at := now();
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trip_plans_guard on public.trip_plans;
create trigger trip_plans_guard before insert or update on public.trip_plans
  for each row execute function public.trip_plans_guard();

grant select, insert, update, delete on public.trip_plans to anon, authenticated;

alter table public.trip_plans enable row level security;
drop policy if exists "trip readers" on public.trip_plans;
drop policy if exists "trip organizer adds" on public.trip_plans;
drop policy if exists "trip organizer changes" on public.trip_plans;
drop policy if exists "trip organizer removes" on public.trip_plans;
create policy "trip readers" on public.trip_plans for select to anon, authenticated
  using (public.bb_trip_reader(codes, readers, owner_dev, owner_uid));
create policy "trip organizer adds" on public.trip_plans for insert to anon, authenticated
  with check (public.bb_writer() is not null);
create policy "trip organizer changes" on public.trip_plans for update to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()))
  with check (true);
create policy "trip organizer removes" on public.trip_plans for delete to anon, authenticated
  using ((public.bb_writer() is not null and public.bb_writer() = owner_dev) or (owner_uid is not null and owner_uid = auth.uid()));
