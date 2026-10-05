-- Round codes (added 2026-10-06). Run this once in Supabase: Dashboard, SQL Editor, New query,
-- paste, Run. Safe to run again.
--
-- Until now live_rounds and live_holes were readable by anyone with the public key, code or not:
-- GET /rest/v1/live_rounds?select=code listed every live round, and each one's meta (names,
-- scores, stakes, side bets, payment handles) came with it. After this runs:
--  • A request sees a round only when it names that round's code in the x-round-code header, so
--    nothing can be listed, and a wrong code sees nothing. The app sends the header on every read
--    and write of these two tables (src/lib/sync-adapters.js), and so do join link previews
--    (api/join.js).
--  • Writes need the header too, on top of the keeper lock (2026-09-30-keeper-lock.sql), which
--    still decides which phone may change what.
--  • Functions that run as the owner (friend_rounds, follow_round, join_comments, link_my_players
--    and the rest) see every round as before. bb_round_devs (2026-10-03-trip-plans.sql) runs as
--    the owner now too, so trip plans, cups, trip expenses and Big Games still find the phones in
--    their rounds when the request doesn't name each round's code.
--  • Realtime can't see request headers, so table changes on these two tables stop reaching phones.
--    The app pokes the round's broadcast channel after each write instead (a nudge with no data)
--    and the other phones fetch with the code, plus a check every 20 seconds while a round is open.
--  • The tables that name a round's or a plan's code are locked the same way, so none of them can
--    be listed to find a code (or undo the friend feed's refs): round_payments needs the round's
--    code in x-round-code (a comma list, since the Tab reads many rounds at once); planned_rounds,
--    plan_rsvps and plan_votes need the plan's code in x-plan-code; challenges and challenge_moves
--    need the challenge's code in x-challenge-code (a comma list too) or their plan's in
--    x-plan-code. The app sends these on every request (tab-sync.js, plan-adapters.js,
--    challenge-adapters.js), and pokes each plan's and challenge's channel after a write, since
--    table changes stop reaching phones here too.
--
-- Run it only once the app that sends x-round-code is live: a copy of the app from before it sees
-- no rounds at all and can't share one. Until it runs, the app works the same as before (the
-- header is just ignored).
--
-- To undo: drop policy if exists "round code in header" on public.live_rounds;
--          drop policy if exists "round code in header" on public.live_holes;
--          create policy "round code holders" on public.live_rounds for all to anon, authenticated using (true) with check (true);
--          create policy "round code holders" on public.live_holes for all to anon, authenticated using (true) with check (true);
--          alter function public.bb_round_devs(text[]) security invoker;
--          drop function public.bb_round_code();
--          and for the other tables, drop each "... in header" policy below and create again the
--          ones 2026-09-29-round-payments.sql, schema.sql and 2026-10-04-challenges.sql made.

-- The round code this request names in its x-round-code header, or null (none, or not a code)
create or replace function public.bb_round_code() returns text language plpgsql stable set search_path = '' as $$
declare c text;
begin
  begin
    c := (nullif(current_setting('request.headers', true), '')::json) ->> 'x-round-code';
  exception when others then
    return null;
  end;
  if c is null or c !~ '^[A-Z0-9]{4,8}$' then return null; end if;
  return c;
end $$;

-- Trip plans, cups, trip expenses and Big Games read the phones in their rounds through this, from
-- policies and triggers that run as the person asking. It reads live_rounds, so it runs as the owner
do $$ begin
  if to_regprocedure('public.bb_round_devs(text[])') is not null then
    alter function public.bb_round_devs(text[]) security definer;
  end if;
end $$;

alter table public.live_rounds enable row level security;
alter table public.live_holes enable row level security;
drop policy if exists "round code holders" on public.live_rounds;
drop policy if exists "round code holders" on public.live_holes;
drop policy if exists "round code in header" on public.live_rounds;
drop policy if exists "round code in header" on public.live_holes;
create policy "round code in header" on public.live_rounds for all to anon, authenticated
  using (code = public.bb_round_code()) with check (code = public.bb_round_code());
create policy "round code in header" on public.live_holes for all to anon, authenticated
  using (code = public.bb_round_code()) with check (code = public.bb_round_code());

-- The codes a request names in a header: one code or a comma list (at most 200), each a code
create or replace function public.bb_header_codes(p_name text) returns text[] language plpgsql stable set search_path = '' as $$
declare v text;
begin
  begin
    v := (nullif(current_setting('request.headers', true), '')::json) ->> p_name;
  exception when others then
    return '{}';
  end;
  if v is null then return '{}'; end if;
  return coalesce((select array_agg(x) from (
    select x from unnest(string_to_array(v, ',')) x where x ~ '^[A-Z0-9]{4,8}$' limit 200
  ) s), '{}');
end $$;

-- Payments and carry-overs: only with the round's code
do $$ begin
  if to_regclass('public.round_payments') is not null then
    execute 'drop policy if exists "round code holders" on public.round_payments';
    execute 'drop policy if exists "round code in header" on public.round_payments';
    execute $p$create policy "round code in header" on public.round_payments for all to anon, authenticated
      using (code = any (public.bb_header_codes('x-round-code'))) with check (code = any (public.bb_header_codes('x-round-code')))$p$;
  end if;
end $$;

-- Plans, their answers and votes: only with the plan's code (the plan lock's triggers run as the owner)
do $$
declare t text;
begin
  foreach t in array array['planned_rounds', 'plan_rsvps', 'plan_votes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "plan code holders" on public.%I', t);
      execute format('drop policy if exists "plan code in header" on public.%I', t);
      execute format($p$create policy "plan code in header" on public.%I for all to anon, authenticated
        using (code = any (public.bb_header_codes('x-plan-code'))) with check (code = any (public.bb_header_codes('x-plan-code')))$p$, t);
    end if;
  end loop;
end $$;

-- Challenges and their moves (added, never changed): with the challenge's code or its plan's
do $$
declare t text;
begin
  foreach t in array array['challenges', 'challenge_moves'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "challenge code holders read" on public.%I', t);
      execute format('drop policy if exists "challenge code holders add" on public.%I', t);
      execute format('drop policy if exists "challenge code in header read" on public.%I', t);
      execute format('drop policy if exists "challenge code in header add" on public.%I', t);
      execute format($p$create policy "challenge code in header read" on public.%I for select to anon, authenticated
        using (code = any (public.bb_header_codes('x-challenge-code')) or plan_code = any (public.bb_header_codes('x-plan-code')))$p$, t);
      execute format($p$create policy "challenge code in header add" on public.%I for insert to anon, authenticated
        with check (code = any (public.bb_header_codes('x-challenge-code')) or plan_code = any (public.bb_header_codes('x-plan-code')))$p$, t);
    end if;
  end loop;
end $$;
