-- Talk on challenges (added 2026-10-07). Run this once in Supabase: Dashboard, SQL Editor, New
-- query, paste, Run. Safe to run again. Run it after 2026-10-04-comments.sql and
-- 2026-10-04-challenges.sql (both already run); it doesn't matter whether 2026-10-06-round-codes.sql
-- has run yet.
--
-- "Dave challenges Mike to a match." Now the two of them (and whoever set it up between them) can
-- react, comment and pick a quick jab on the challenge itself, the way they can on a round, a
-- settle-up line and a planned round. The rows go in the same comments table, with scope
-- 'challenge' and the challenge's 6-letter code. (A payment marked paid on the Tab talks on its
-- round's settle-up line, scope 'round', so it needs nothing new here.)
--
-- Who may read and write (src/lib/talk-access.js challengeSeats and seatsFor are the same rules in
-- JavaScript, with tests; keep them in step):
--  • Like the challenge itself, anyone with its code: the two in it and whoever set it up each
--    answer from a link, signed in or not. join_challenge_comments(code) lets a phone (and its
--    account) in and remembers it in comment_members, the way join_comments does for a plan. Rows
--    are read only after joining, so nothing can be listed without the code, the same as the
--    round codes lock: a request sees a challenge's talk only once it has named that code.
--  • They speak only as one of the challenge's people: the ids it was made with, in its meta
--    (from, to, setBy). Each person changes or deletes only their own rows, as before.
--  • The seats are remembered when a phone joins, so the talk outlives the challenge (the optional
--    90-day tidy-up of challenges).
--
-- Until this runs, the app keeps a challenge's talk on each phone and sends it once it has. The
-- rest of the talk works the same either way.
--
-- To undo: drop function public.join_challenge_comments(text); drop function public.comment_challenge_seats(text);
--          delete from public.comments where scope = 'challenge'; delete from public.comment_members where scope = 'challenge';
--          then run comment_seats() from 2026-10-04-comments.sql again and put back the two scope
--          checks as check (scope in ('round', 'plan')).

-- The scope can be a challenge too (the checks are set again each run, so a later list replaces this one)
do $$
declare c record;
begin
  for c in
    select t.relname as tbl, k.conname as name from pg_constraint k
    join pg_class t on t.oid = k.conrelid join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname in ('comments', 'comment_members') and k.contype = 'c'
      and pg_get_constraintdef(k.oid) ilike '%scope%' and pg_get_constraintdef(k.oid) not ilike '%emoji%'
  loop
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
  end loop;
end $$;
alter table public.comments add constraint comments_scope_check check (scope in ('round', 'plan', 'challenge'));
alter table public.comment_members add constraint comment_members_scope_check check (scope in ('round', 'plan', 'challenge'));

-- The people in a challenge (from, to, and whoever set it up), or null when there's no such challenge
create or replace function public.comment_challenge_seats(p_code text) returns text[]
language sql stable security definer set search_path = '' as $$
  select case when c.code is null then null else
    nullif(array(select distinct x from unnest(array[
      public.bb_str(public.bb_obj(c.meta -> 'from') -> 'who'),
      public.bb_str(public.bb_obj(c.meta -> 'to') -> 'who'),
      public.bb_str(public.bb_obj(c.meta -> 'setBy') -> 'who')
    ]) x where x is not null and length(x) <= 64), '{}'::text[])
  end
  from (select 1) one left join public.challenges c on c.code = p_code
$$;

-- As in 2026-10-04-comments.sql, plus a challenge's talk: for the phones and accounts that joined
-- it, as its people (or, once the challenge is gone, the people remembered when they joined)
create or replace function public.comment_seats(p_scope text, p_code text) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  w text := public.bb_writer();
  me uuid := auth.uid();
  keys text[] := array_remove(array['d:' || w, 'u:' || me::text], null);
  m jsonb;
  s text[];
begin
  if p_scope = 'plan' then
    if not exists (select 1 from public.comment_members c where c.scope = 'plan' and c.code = p_code and c.member = any (keys)) then return null; end if;
    return public.comment_plan_seats(p_code);
  end if;
  if p_scope = 'challenge' then
    if not exists (select 1 from public.comment_members c where c.scope = 'challenge' and c.code = p_code and c.member = any (keys)) then return null; end if;
    select array_agg(distinct x) into s from public.comment_members c cross join lateral unnest(c.seats) x
      where c.scope = 'challenge' and c.code = p_code and c.member = any (keys);
    return coalesce(public.comment_challenge_seats(p_code), s, '{}'::text[]);
  end if;
  if p_scope is distinct from 'round' then return null; end if;
  select r.meta into m from public.live_rounds r where r.code = p_code;
  if found then
    s := public.comment_round_seats(m, w, me);
    if s is not null then return s; end if;
  end if;
  select array_agg(distinct x) into s from public.comment_members c cross join lateral unnest(c.seats) x
    where c.scope = 'round' and c.code = p_code and c.member = any (keys);
  return s;
end $$;

-- Let this phone (and its account) in on a challenge's talk, and remember its people. Returns the
-- ids it may speak as, or null when there's no such challenge.
create or replace function public.join_challenge_comments(p_code text) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  s text[];
  k text;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{6}$' then return null; end if;
  s := public.comment_challenge_seats(p_code);
  if s is null then return null; end if;
  foreach k in array array_remove(array['d:' || public.bb_writer(), 'u:' || auth.uid()::text], null) loop
    insert into public.comment_members as c (scope, code, member, seats) values ('challenge', p_code, k, s)
    on conflict (scope, code, member) do update
      set seats = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(c.seats || excluded.seats) x);
  end loop;
  return public.comment_seats('challenge', p_code);
end $$;

-- The helper runs only inside the functions above. Supabase grants every new function to anon and
-- authenticated by itself, so take it back from them too.
revoke all on function public.comment_challenge_seats(text) from public, anon, authenticated;
grant execute on function public.comment_seats(text, text) to anon, authenticated;
grant execute on function public.join_challenge_comments(text) to anon, authenticated;
