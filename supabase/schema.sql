-- Birdie Bank live shared rounds.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.live_rounds (
  code text primary key,
  meta jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_holes (
  code text not null references public.live_rounds(code) on delete cascade,
  hole_no int not null,
  data jsonb,
  updated_at timestamptz not null default now(),
  primary key (code, hole_no)
);

grant select, insert, update, delete on public.live_rounds, public.live_holes to anon;

-- Anyone who knows a round's 6-letter code can read and write it. There are no accounts yet.
alter table public.live_rounds enable row level security;
alter table public.live_holes enable row level security;
drop policy if exists "round code holders" on public.live_rounds;
drop policy if exists "round code holders" on public.live_holes;
create policy "round code holders" on public.live_rounds for all to anon using (true) with check (true);
create policy "round code holders" on public.live_holes for all to anon using (true) with check (true);

-- Live updates (and full rows on delete so other phones hear about it)
alter table public.live_rounds replica identity full;
alter table public.live_holes replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.live_rounds;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.live_holes;
exception when duplicate_object then null; end $$;

-- Tidy up shared rounds nobody has touched in 30 days (optional; needs the pg_cron extension)
-- select cron.schedule('bb-cleanup', '0 4 * * *', $$delete from public.live_rounds where updated_at < now() - interval '30 days'$$);
