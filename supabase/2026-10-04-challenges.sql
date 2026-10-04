-- Challenges (added 2026-10-04). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again. Run it after 2026-09-28-upcoming.sql (a challenge on a planned
-- round points at its plan).
--
-- "Dave challenges Mike to a $20 match on Saturday." One row per challenge (what was offered, who
-- to, and the plan it's for when there is one) and one row per answer on it: accept, decline,
-- counter with a new amount, called off, or put into a round. The app plays the answers back in
-- order, so the rows only ever get added: nobody can change or take back what someone else said.
-- Like planned rounds, anyone with a challenge's 6-letter code (or its plan's code) can read it and
-- answer, signed in or not, so a friend answers from a text with no install and no account.
--
-- Until this runs, challenges stay on the phone that made them: whoever made one marks the other
-- person's answer, and an agreed one still goes into the round as a side bet.
--
-- To undo: drop table public.challenge_moves; drop table public.challenges;

create table if not exists public.challenges (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  plan_code text references public.planned_rounds (code) on delete cascade,
  meta jsonb not null check (jsonb_typeof(meta) = 'object' and length(meta::text) < 4000),
  created_at timestamptz not null default now()
);
create index if not exists challenges_plan_code on public.challenges (plan_code);

create table if not exists public.challenge_moves (
  code text not null references public.challenges (code) on delete cascade,
  -- The plan's code again, so everyone looking at a plan hears new answers live
  plan_code text check (plan_code is null or plan_code ~ '^[A-Z0-9]{6}$'),
  id text not null check (length(id) between 1 and 32),
  side text not null check (side in ('from', 'to', 'keeper')),
  move text not null check (move in ('accept', 'decline', 'counter', 'withdraw', 'on')),
  stake numeric check (stake is null or (stake > 0 and stake <= 500)),
  round_id text check (round_id is null or length(round_id) between 1 and 64),
  at bigint not null,
  created_at timestamptz not null default now(),
  primary key (code, id)
);
create index if not exists challenge_moves_plan_code on public.challenge_moves (plan_code);

-- Read and add only: no update, no delete
revoke update, delete on public.challenges, public.challenge_moves from anon, authenticated;
grant select, insert on public.challenges, public.challenge_moves to anon, authenticated;

alter table public.challenges enable row level security;
alter table public.challenge_moves enable row level security;
drop policy if exists "challenge code holders read" on public.challenges;
drop policy if exists "challenge code holders add" on public.challenges;
drop policy if exists "challenge code holders read" on public.challenge_moves;
drop policy if exists "challenge code holders add" on public.challenge_moves;
create policy "challenge code holders read" on public.challenges for select to anon, authenticated using (true);
create policy "challenge code holders add" on public.challenges for insert to anon, authenticated with check (true);
create policy "challenge code holders read" on public.challenge_moves for select to anon, authenticated using (true);
create policy "challenge code holders add" on public.challenge_moves for insert to anon, authenticated with check (true);

-- Live updates, so an answer shows up on the other phone as it's made
alter table public.challenges replica identity full;
alter table public.challenge_moves replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.challenges;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.challenge_moves;
exception when duplicate_object then null; end $$;

-- Tidy up challenges nobody has touched in 90 days (optional; needs the pg_cron extension)
-- select cron.schedule('challenge-cleanup', '0 4 * * *', $$delete from public.challenges where created_at < now() - interval '90 days'$$);
