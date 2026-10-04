-- One privacy setting for your whole profile (added 2026-10-05). Run this once in Supabase:
-- Dashboard, SQL Editor, New query, paste, Run. Safe to run again. Needs 2026-10-01-profiles.sql
-- and 2026-10-03-privacy-everyone.sql first.
--
-- What it changes: people_profiles() reads the new setting in profiles.privacy:
--   profile    'everyone' | 'played' | 'hidden': who can see your record, stats, handicap and
--              home course. 'hidden' (only you) sends none of them.
--   showMoney  true sends your net and best round (stats.money) too; anything else leaves it out.
-- Your name, avatar and payment app still go to people in your rounds whatever the setting, so
-- they know who you are and can pay you. Profiles are still only looked up by people who share a
-- round with you (profile_visible_to_me), so today 'everyone' reaches the same people as 'played'.
--
-- A row saved without a profile level (a phone that hasn't updated) keeps the per-item rule it had
-- in 2026-10-03-privacy-everyone.sql: handicap, homeCourse and stats 'played' or 'hidden', and money
-- for 'played' or 'everyone'. Nothing about the table changes.
--
-- Until this runs, the app keeps working: it also saves the older per-item keys worked out from the
-- one setting (src/lib/profile-model.js legacyOf), so the function from 2026-10-03 shows exactly
-- the same thing, and a profile that's only you doesn't send its handicap, home course or stats.
--
-- To undo: run the people_profiles() definition from 2026-10-03-privacy-everyone.sql again.

create or replace function public.people_profiles(p_ids text[])
returns table (
  player_id text, user_id uuid, visible boolean, display_name text, handicap_index numeric,
  home_course jsonb, avatar jsonb, pay_app text, pay_handle text, stats jsonb, updated_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select a.player_id, a.user_id, v.ok,
    case when v.ok then p.display_name end,
    case when v.ok and (case when s.lvl is not null then s.lvl <> 'hidden'
      else coalesce(p.privacy ->> 'handicap', 'played') <> 'hidden' end) then p.handicap_index end,
    case when v.ok and (case when s.lvl is not null then s.lvl <> 'hidden'
      else coalesce(p.privacy ->> 'homeCourse', 'played') <> 'hidden' end) then p.home_course end,
    case when v.ok then p.avatar end,
    case when v.ok then p.pay_app end,
    case when v.ok then p.pay_handle end,
    case
      when not v.ok or p.stats is null then null
      when s.lvl = 'hidden' then null
      when s.lvl is null and coalesce(p.privacy ->> 'stats', 'played') = 'hidden' then null
      when a.user_id = (select auth.uid()) then p.stats
      when s.lvl is not null and p.privacy -> 'showMoney' = 'true'::jsonb then p.stats
      when s.lvl is null and p.privacy ->> 'money' in ('played', 'everyone') then p.stats
      else p.stats - 'money'
    end,
    case when v.ok then p.updated_at end
  from public.account_players a
  left join public.profiles p on p.user_id = a.user_id
  cross join lateral (select public.profile_visible_to_me(a.user_id) and p.user_id is not null as ok) v
  -- The one setting, when the row has it ('everyone', 'played' or 'hidden'); null for an older row
  cross join lateral (select case when p.privacy ->> 'profile' in ('everyone', 'played', 'hidden') then p.privacy ->> 'profile' end as lvl) s
  where (select auth.uid()) is not null and a.player_id = any (p_ids[1:500])
$$;

-- Only signed-in people call it (never the anon key); create or replace keeps these, set again to be sure
revoke all on function public.people_profiles(text[]) from public, anon;
grant execute on function public.people_profiles(text[]) to authenticated;
