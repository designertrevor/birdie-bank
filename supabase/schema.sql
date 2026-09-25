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
