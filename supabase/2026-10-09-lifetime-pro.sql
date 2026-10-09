-- Pro for life for early testers (added 2026-10-09). Run this once in Supabase: Dashboard, SQL
-- Editor, New query, paste, Run. Safe to run again. Needs nothing else first, and nothing needs it.
--
-- Trevor's promise: everyone who tests with him before launch keeps Pro free, forever. This file
-- writes that down on each account before the paywall turns on, so nobody has to remember who was
-- early.
--
-- What it adds:
--  • pro_settings: one row holding the "early testers open" switch. While it's on, every account
--    that exists and every new account gets Pro for life. Only the SQL editor (or the service role)
--    reads or changes it; the app never sees it.
--  • entitlements: one row per account that has something Pro. Today that's only `lifetime`.
--    Each person can read their own row and nobody else's. Nobody writes it from the app: rows come
--    from the backfill and the trigger below (and later from the payment provider's webhook on the
--    server). The app reads it after sign-in (src/lib/pro-client.js); a lifetime holder never sees
--    the paywall, and with the paywall flag on Settings says "Pro for life. Thanks for testing early".
--  • A backfill: every account that exists gets Pro for life, while the switch is on.
--  • A trigger on new accounts: each one gets Pro for life the moment it's made, while the switch
--    is on. If the grant ever fails, the sign-up still goes through.
--
-- AT LAUNCH, turn early testers off (run this one line before the paywall goes live):
--     update public.pro_settings set early_testers_open = false, updated_at = now() where id;
-- Everyone who already has Pro for life keeps it. New accounts from then on start on Free.
-- Running this whole file again after that changes nothing: the backfill and the trigger both
-- check the switch, and the switch row is never reset by this file.
--
-- Until this runs, the app works exactly as before: the read after sign-in fails quietly and
-- nobody is treated as Pro (and with the paywall flag off, which is production today, nobody sees
-- anything about plans at all).
--
-- To undo: drop trigger if exists grant_early_tester on auth.users;
--          drop function if exists public.grant_early_tester();
--          drop table if exists public.entitlements; drop table if exists public.pro_settings;

-- --------------------------- the switch -------------------------------------

create table if not exists public.pro_settings (
  id boolean primary key default true check (id), -- only ever one row
  early_testers_open boolean not null default true,
  updated_at timestamptz not null default now()
);
-- The one row, on (the switch starts open). Never touched again by this file, so a switch Trevor
-- turned off stays off.
insert into public.pro_settings (id) values (true) on conflict (id) do nothing;

revoke all on public.pro_settings from public, anon, authenticated;
grant select, update on public.pro_settings to service_role;
alter table public.pro_settings enable row level security;
-- No policies: nobody reads or writes it through the API. The SQL editor and the service role skip RLS.

-- --------------------------- who has Pro ------------------------------------

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lifetime boolean not null default false,
  lifetime_since timestamptz,
  lifetime_reason text check (lifetime_reason is null or lifetime_reason in ('early tester', 'gift')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.entitlements from public, anon, authenticated;
grant select on public.entitlements to authenticated;
grant select, insert, update, delete on public.entitlements to service_role;
alter table public.entitlements enable row level security;
drop policy if exists "own entitlements read" on public.entitlements;
create policy "own entitlements read" on public.entitlements for select to authenticated
  using ((select auth.uid()) = user_id);
-- No insert, update or delete policy, and no grant for them: the app can only read its own row.

-- --------------------------- the backfill ------------------------------------

-- Every account that exists today, while the switch is on. An account that already has a row keeps
-- its first "since" date; one that had a row without lifetime gets it.
insert into public.entitlements (user_id, lifetime, lifetime_since, lifetime_reason)
  select u.id, true, now(), 'early tester'
  from auth.users u
  where (select s.early_testers_open from public.pro_settings s where s.id)
on conflict (user_id) do update
  set lifetime = true,
      lifetime_since = coalesce(public.entitlements.lifetime_since, excluded.lifetime_since),
      lifetime_reason = coalesce(public.entitlements.lifetime_reason, excluded.lifetime_reason),
      updated_at = now()
  where not public.entitlements.lifetime;

-- --------------------------- new accounts -----------------------------------

-- Each new account, the moment it's made, while the switch is on. Security definer so it can write
-- the table nobody else can; any error is swallowed so a sign-up never fails because of this.
create or replace function public.grant_early_tester() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin
    if coalesce((select s.early_testers_open from public.pro_settings s where s.id), false) then
      insert into public.entitlements (user_id, lifetime, lifetime_since, lifetime_reason)
        values (new.id, true, now(), 'early tester')
        on conflict (user_id) do nothing;
    end if;
  exception when others then
    null; -- never block a sign-up
  end;
  return new;
end $$;
revoke all on function public.grant_early_tester() from public, anon, authenticated;

drop trigger if exists grant_early_tester on auth.users;
create trigger grant_early_tester after insert on auth.users
  for each row execute function public.grant_early_tester();
