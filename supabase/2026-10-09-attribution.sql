-- Which creator sent each person (added 2026-10-09). Run this once in Supabase: Dashboard, SQL
-- Editor, New query, paste, Run. Safe to run again. It needs nothing else first and nothing else
-- needs it, so it can go in any order with the other files.
--
-- What it adds:
--  • attribution: one row per signed-in person who first opened the app from a creator's link
--    (?ref=CODE or ?via=CODE, see src/lib/attribution.js). The code (a short slug like
--    "goodgood"), the page they landed on (a path such as "/" or "/rules/wolf", plus the kind of
--    app link it was, like "/?join", never the code in it), when the phone first saw it, and
--    whether the phone was new to the app then. First touch wins: the app only ever adds the row
--    and never changes it, so a later link can't take the credit. Each person can add and read
--    only their own row; nobody can change or remove one through the API, and nobody else can see
--    it. Trevor reads them all from the dashboard (the SQL Editor runs as the owner).
--
-- Until this runs, the app works the same as before: the code is still kept on the phone and still
-- rides on every usage event (PostHog), the save to the account fails quietly and tries again on
-- the next launch.
--
-- Reading it (in the SQL Editor): sign-ups each creator sent, new phones only:
--   select code, count(*) as people, min(first_seen) as first, max(first_seen) as last
--   from public.attribution where new_phone group by code order by people desc;
--
-- To undo: drop table if exists public.attribution;

create table if not exists public.attribution (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  landing text not null default '/' check (char_length(landing) <= 64),
  first_seen timestamptz not null default now(),
  new_phone boolean not null default true,
  created_at timestamptz not null default now()
);

-- A phone's clock can be off, but never by more than a day into the future
alter table public.attribution drop constraint if exists attribution_first_seen_sane;
alter table public.attribution add constraint attribution_first_seen_sane
  check (first_seen <= created_at + interval '1 day');

create index if not exists attribution_code on public.attribution (code);

revoke all on public.attribution from anon;
revoke all on public.attribution from authenticated;
grant select, insert on public.attribution to authenticated;
alter table public.attribution enable row level security;
drop policy if exists "own attribution read" on public.attribution;
drop policy if exists "own attribution add" on public.attribution;
create policy "own attribution read" on public.attribution for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own attribution add" on public.attribution for insert to authenticated
  with check ((select auth.uid()) = user_id);
