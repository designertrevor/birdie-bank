-- Lock down upcoming rounds (added 2026-10-04). Run this once in Supabase: Dashboard, SQL Editor,
-- New query, paste, Run. Safe to run again. Needs 2026-09-28-upcoming.sql and
-- 2026-09-30-keeper-lock.sql (for bb_writer(), the device key check), both already run.
--
-- Until now anyone with a plan's 6-letter code could change any of it. After this runs:
--  • The plan itself (the day, the course, the ballot, calling it off, deleting it): only the
--    organizer. That's the phone that shared it (its device key) or, once they're signed in, their
--    account from any phone.
--  • Each answer (in, maybe or out, and the votes on the game and the bet): only whoever made it.
--    The first phone to answer for a name owns that answer; friends without an account answer
--    from the RSVP link and are known by their phone's device key, so no sign-in is needed.
--  • The organizer can still mark someone who told them in person. That answer stays open: the
--    person's own answer from the link replaces it, and from then on it's theirs. Once someone has
--    answered from their own phone, the organizer can't change it.
--  • The organizer's own answer is theirs alone.
--  • A plan shared before this ran (or by an older copy of the app that sends no device key) stays
--    open to everyone with the code, as before. Answers made before this ran stay open too.
--  • Anything a phone isn't allowed to change is left as the server has it: no error, and the
--    phone hears the server's copy on its next look. plan_rsvps.by_self tells the organizer's
--    phone which answers came from the person's own phone, so it doesn't offer to change them.
--  • The database itself (the SQL editor, a cleanup job, the service role) isn't locked.
--
-- Who made what is kept in two tables nobody can read or write through the API (plan_hosts and
-- plan_answer_owners): only the device key hashes and account ids, never the keys themselves.
-- src/lib/plan-lock.js is the same rules in JavaScript, with tests; keep the two in step.
--
-- To undo: drop trigger planned_rounds_lock on public.planned_rounds;
--          drop trigger planned_rounds_host on public.planned_rounds;
--          drop trigger plan_rsvps_lock on public.plan_rsvps;
--          drop trigger plan_votes_lock on public.plan_votes;

-- --------------------------- who made what ----------------------------------

create table if not exists public.plan_hosts (
  code text primary key references public.planned_rounds (code) on delete cascade,
  dev text,      -- the hash of the organizer's device key (null from an older app)
  user_id uuid,  -- the organizer's account, once known
  created_at timestamptz not null default now()
);

create table if not exists public.plan_answer_owners (
  code text not null references public.planned_rounds (code) on delete cascade,
  who text not null,
  dev text,
  user_id uuid,
  by_host boolean not null default false, -- the organizer marked it, so the person's own answer can replace it
  updated_at timestamptz not null default now(),
  primary key (code, who)
);

-- Row security on with no policies, and no grants: nothing reaches these through the API
alter table public.plan_hosts enable row level security;
alter table public.plan_answer_owners enable row level security;
revoke all on public.plan_hosts, public.plan_answer_owners from anon, authenticated;

-- Which answers came from the person's own phone (the organizer's phone reads it)
alter table public.plan_rsvps add column if not exists by_self boolean not null default false;

-- --------------------------- the rules --------------------------------------

-- Whether this write came through the API as a person (the lock applies), not from the database
-- itself or the service role
create or replace function public.plan_lock_applies() returns boolean language plpgsql stable set search_path = '' as $$
declare claims jsonb;
begin
  if nullif(current_setting('request.headers', true), '') is null then return false; end if;
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := null;
  end;
  return coalesce(claims ->> 'role', '') <> 'service_role';
end $$;

-- Whether this request is the plan's organizer, or the plan has no organizer on record (shared
-- before the lock, or by an older app): either way it may change the plan
create or replace function public.plan_host_ok(p_code text) returns boolean language plpgsql set search_path = '' as $$
declare
  w text := public.bb_writer();
  u uuid := auth.uid();
  h public.plan_hosts%rowtype;
begin
  select * into h from public.plan_hosts x where x.code = p_code;
  if not found then return true; end if;
  if not ((h.dev is not null and h.dev = w) or (h.user_id is not null and h.user_id = u)) then return false; end if;
  -- The organizer signed in since sharing it: their account can change it from another phone too
  if h.user_id is null and u is not null then
    update public.plan_hosts set user_id = u where code = p_code;
  end if;
  return true;
end $$;

-- Who is writing `p_who`'s answer on plan `p_code`: 'open' (no lock on it), 'host' (the organizer),
-- 'self' (the person's own phone or account), or null when it isn't theirs to change.
-- `p_take`: an RSVP write, which takes an answer nobody owns yet (or one the organizer marked).
-- Votes never take an answer: they follow the RSVP, which the app always writes first.
create or replace function public.plan_answer_writer(p_code text, p_who text, p_take boolean) returns text language plpgsql set search_path = '' as $$
declare
  w text := public.bb_writer();
  u uuid := auth.uid();
  m jsonb;
  h public.plan_hosts%rowtype;
  o public.plan_answer_owners%rowtype;
  is_host boolean;
  has_owner boolean;
begin
  select r.meta into m from public.planned_rounds r where r.code = p_code;
  if not found then return 'open'; end if; -- no such plan (the write fails on its own), or it's being deleted
  select * into h from public.plan_hosts x where x.code = p_code;
  if not found then return 'open'; end if; -- shared before the lock, or by an older copy of the app
  is_host := (h.dev is not null and h.dev = w) or (h.user_id is not null and h.user_id = u);

  -- The organizer's own answer is theirs alone
  if p_who = coalesce(public.bb_str(m -> 'hostWho'), 'host') then
    return case when is_host then 'host' end;
  end if;

  select * into o from public.plan_answer_owners x where x.code = p_code and x.who = p_who;
  has_owner := found and (o.dev is not null or o.user_id is not null);

  -- The person's own answer: only their phone or their account
  if has_owner and not o.by_host then
    if not ((o.dev is not null and o.dev = w) or (o.user_id is not null and o.user_id = u)) then return null; end if;
    if o.user_id is null and u is not null then
      update public.plan_answer_owners set user_id = u, updated_at = now() where code = p_code and who = p_who;
    end if;
    return 'self';
  end if;

  -- Nobody's yet, or the organizer marked it: the organizer can change it, and the person's own
  -- answer takes it over
  if is_host then
    if p_take and not has_owner then
      insert into public.plan_answer_owners (code, who, dev, user_id, by_host) values (p_code, p_who, w, u, true)
      on conflict (code, who) do update set dev = excluded.dev, user_id = excluded.user_id, by_host = true, updated_at = now();
    end if;
    return 'host';
  end if;
  if not p_take then
    -- A vote for an answer the organizer marked, before the person's own RSVP took it over
    return case when has_owner then null else 'open' end;
  end if;
  if w is null and u is null then return 'open'; end if; -- an older app: nothing to know it by
  insert into public.plan_answer_owners (code, who, dev, user_id, by_host) values (p_code, p_who, w, u, false)
  on conflict (code, who) do update set dev = excluded.dev, user_id = excluded.user_id, by_host = false, updated_at = now();
  return 'self';
end $$;

-- --------------------------- the triggers -----------------------------------

create or replace function public.planned_rounds_lock() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.plan_lock_applies() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not public.plan_host_ok(old.code) then return null; end if; -- not the organizer's: left as it is
  if tg_op = 'DELETE' then return old; end if;
  new.code := old.code;
  return new;
end $$;

-- A new plan: note which phone (and account) shared it
create or replace function public.planned_rounds_host() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  w text := public.bb_writer();
  u uuid := auth.uid();
begin
  if public.plan_lock_applies() and (w is not null or u is not null) then
    insert into public.plan_hosts (code, dev, user_id) values (new.code, w, u) on conflict (code) do nothing;
  end if;
  return null;
end $$;

create or replace function public.plan_rsvps_lock() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  if not public.plan_lock_applies() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    r := public.plan_answer_writer(old.code, old.who, false);
    if r is null then return null; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then new.code := old.code; new.who := old.who; end if;
  -- (An upsert runs this for the insert first, which takes the answer, then for the update)
  r := public.plan_answer_writer(new.code, new.who, true);
  if r is null then return null; end if; -- someone else's answer: left as it is
  new.by_self := r = 'self';
  return new;
end $$;

create or replace function public.plan_votes_lock() returns trigger language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  if not public.plan_lock_applies() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    r := public.plan_answer_writer(old.code, old.who, false);
    if r is null then return null; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then new.code := old.code; new.who := old.who; new.kind := old.kind; end if;
  r := public.plan_answer_writer(new.code, new.who, false);
  if r is null then return null; end if;
  return new;
end $$;

drop trigger if exists planned_rounds_lock on public.planned_rounds;
create trigger planned_rounds_lock before update or delete on public.planned_rounds
  for each row execute function public.planned_rounds_lock();

drop trigger if exists planned_rounds_host on public.planned_rounds;
create trigger planned_rounds_host after insert on public.planned_rounds
  for each row execute function public.planned_rounds_host();

drop trigger if exists plan_rsvps_lock on public.plan_rsvps;
create trigger plan_rsvps_lock before insert or update or delete on public.plan_rsvps
  for each row execute function public.plan_rsvps_lock();

drop trigger if exists plan_votes_lock on public.plan_votes;
create trigger plan_votes_lock before insert or update or delete on public.plan_votes
  for each row execute function public.plan_votes_lock();

-- The rules are only for the triggers above, never called through the API
revoke all on function public.plan_lock_applies() from public, anon, authenticated;
revoke all on function public.plan_host_ok(text) from public, anon, authenticated;
revoke all on function public.plan_answer_writer(text, text, boolean) from public, anon, authenticated;
