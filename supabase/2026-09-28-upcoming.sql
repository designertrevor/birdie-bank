-- Upcoming rounds (added 2026-09-28). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again.
--
-- A planned round (the day, the course, the tee time, what's up for a vote), each person's
-- answer (in, maybe or out) and their votes on the game and the bet. Like live rounds, anyone
-- who has a plan's 6-letter code can read and answer it, signed in or not, so friends answer
-- from the group link with no install and no account.
-- Until this runs, the app plans rounds on the organizer's phone only (they mark who's in
-- themselves) and hides the group link.

create table if not exists public.planned_rounds (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  meta jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_rsvps (
  code text not null references public.planned_rounds (code) on delete cascade,
  who text not null check (length(who) between 1 and 64),
  name text not null check (length(name) between 1 and 40),
  status text not null check (status in ('in', 'maybe', 'out')),
  pay_app text check (pay_app in ('venmo', 'cashapp', 'paypal', 'zelle')),
  pay_handle text check (length(pay_handle) <= 80),
  updated_at timestamptz not null default now(),
  primary key (code, who)
);

create table if not exists public.plan_votes (
  code text not null references public.planned_rounds (code) on delete cascade,
  who text not null check (length(who) between 1 and 64),
  kind text not null check (kind in ('game', 'bet')),
  choice text not null check (length(choice) between 1 and 32),
  updated_at timestamptz not null default now(),
  primary key (code, who, kind)
);

grant select, insert, update, delete on public.planned_rounds, public.plan_rsvps, public.plan_votes to anon, authenticated;

alter table public.planned_rounds enable row level security;
alter table public.plan_rsvps enable row level security;
alter table public.plan_votes enable row level security;
drop policy if exists "plan code holders" on public.planned_rounds;
drop policy if exists "plan code holders" on public.plan_rsvps;
drop policy if exists "plan code holders" on public.plan_votes;
create policy "plan code holders" on public.planned_rounds for all to anon, authenticated using (true) with check (true);
create policy "plan code holders" on public.plan_rsvps for all to anon, authenticated using (true) with check (true);
create policy "plan code holders" on public.plan_votes for all to anon, authenticated using (true) with check (true);

-- Live updates, so the organizer sees answers and votes come in (full rows on delete too)
alter table public.planned_rounds replica identity full;
alter table public.plan_rsvps replica identity full;
alter table public.plan_votes replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.planned_rounds;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.plan_rsvps;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.plan_votes;
exception when duplicate_object then null; end $$;

-- Tidy up plans nobody has touched in 60 days (optional; needs the pg_cron extension)
-- select cron.schedule('bb-plan-cleanup', '0 4 * * *', $$delete from public.planned_rounds where updated_at < now() - interval '60 days'$$);
