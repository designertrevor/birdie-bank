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
