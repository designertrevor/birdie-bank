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

grant select, insert, update, delete on public.live_rounds, public.live_holes to anon, authenticated;

-- Anyone who knows a round's 6-letter code can read and write it, signed in or not.
alter table public.live_rounds enable row level security;
alter table public.live_holes enable row level security;
drop policy if exists "round code holders" on public.live_rounds;
drop policy if exists "round code holders" on public.live_holes;
create policy "round code holders" on public.live_rounds for all to anon, authenticated using (true) with check (true);
create policy "round code holders" on public.live_holes for all to anon, authenticated using (true) with check (true);

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

-- "Suggest something" feedback (added 2026-09-25). Anyone can send; nobody can read it
-- back through the app. Read it in the Dashboard: Table Editor → feedback, and
-- Storage → feedback for screenshots and scorecard photos.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('game', 'course', 'feature', 'bug')),
  body text not null check (length(body) between 1 and 5000),
  details jsonb not null default '{}',
  context jsonb not null default '{}',
  contact text check (length(contact) <= 200),
  screenshot_path text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.feedback to anon, authenticated;
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (status = 'new');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "anyone can upload feedback images" on storage.objects;
create policy "anyone can upload feedback images" on storage.objects for insert to anon, authenticated with check (bucket_id = 'feedback');

-- Accounts and cloud data (added 2026-09-25). Each signed-in person's players, crews,
-- courses, rounds, payments and settings, one row per item. Only you can see your rows.
create table if not exists public.user_docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('profile', 'player', 'crew', 'course', 'round', 'settlement')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  client_updated_at bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create index if not exists user_docs_changes on public.user_docs (user_id, updated_at);

-- The server's clock decides updated_at, so phones can ask "what changed since?"
create or replace function public.user_docs_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = clock_timestamp(); return new; end $$;
drop trigger if exists user_docs_touch on public.user_docs;
create trigger user_docs_touch before insert or update on public.user_docs for each row execute function public.user_docs_touch();

grant select, insert, update, delete on public.user_docs to authenticated;
alter table public.user_docs enable row level security;
drop policy if exists "own docs" on public.user_docs;
create policy "own docs" on public.user_docs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Post-round reactions (added 2026-09-27). "How was Birdie Bank today?" saves a one-tap
-- reaction (Great, Just OK, Something was off) as feedback with kind 'reaction'. Safe to run
-- again. Until it runs, the app sends reactions as kind 'feature' with details.sentAs = 'reaction'.
alter table public.feedback drop constraint if exists feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check check (kind in ('game', 'course', 'feature', 'bug', 'reaction'));

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

-- Shared Tab payments and carry-overs (added 2026-09-29). Run this once in Supabase: Dashboard,
-- SQL Editor, New query, paste, Run. Safe to run again.
--
-- One row per round transfer that someone marked paid, netted or asked to roll over, keyed by
-- the live round's 6-letter code. Both phones in a shared round write and read these rows, so
-- "I paid" on one phone shows on the other. Like live rounds and planned rounds, anyone who has
-- a round's code can read and write its rows. Amounts only ever show to the two people involved
-- in the app; the who-is-square strip shows status only.
-- No foreign key to live_rounds: payments outlive the live round (sharing stopped, or the
-- optional 30-day live_rounds cleanup).
-- Until this runs, the app keeps payments on each phone, as before, and hides "Roll to next time".

create table if not exists public.round_payments (
  code text not null check (code ~ '^[A-Z0-9]{6}$'),
  id text not null check (length(id) between 1 and 200),
  kind text not null check (kind in ('payment', 'carry')),
  from_id text not null check (length(from_id) between 1 and 64),
  to_id text not null check (length(to_id) between 1 and 64),
  amount numeric(10,2) not null check (amount >= 0 and amount < 100000),
  status text not null check (status in ('paid', 'undone', 'netted', 'asked', 'agreed', 'declined', 'withdrawn')),
  by_id text check (length(by_id) <= 64),
  reason text check (length(reason) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (code, id)
);

create index if not exists round_payments_code on public.round_payments (code);

grant select, insert, update, delete on public.round_payments to anon, authenticated;

alter table public.round_payments enable row level security;
drop policy if exists "round code holders" on public.round_payments;
create policy "round code holders" on public.round_payments for all to anon, authenticated using (true) with check (true);

-- Live updates, so the other phone sees a payment as it's marked (full rows on delete too)
alter table public.round_payments replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.round_payments;
exception when duplicate_object then null; end $$;
