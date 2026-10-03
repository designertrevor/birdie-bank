-- "Everyone" for who sees your money (added 2026-10-03). Run this once in Supabase: Dashboard,
-- SQL Editor, New query, paste, Run. Safe to run again. Needs 2026-10-01-profiles.sql first.
--
-- What it changes: people_profiles() also sends your net and best round (stats.money) when your
-- privacy money is 'everyone', not only when it's 'played'. Nothing else about the function
-- changes: profiles are still only looked up by people who share a round with you
-- (profile_visible_to_me), so today 'everyone' reaches the same people as 'played'. It's the
-- choice that will also reach people you haven't played with once profiles can be opened that way.
--
-- Until this runs, a profile set to 'everyone' keeps its money to itself (the old function only
-- sends money for 'played'), so nothing shows that you didn't choose; the app works the same.
--
-- To undo: run the people_profiles() definition from 2026-10-01-profiles.sql again.

create or replace function public.people_profiles(p_ids text[])
returns table (
  player_id text, user_id uuid, visible boolean, display_name text, handicap_index numeric,
  home_course jsonb, avatar jsonb, pay_app text, pay_handle text, stats jsonb, updated_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select a.player_id, a.user_id, v.ok,
    case when v.ok then p.display_name end,
    case when v.ok and coalesce(p.privacy ->> 'handicap', 'played') <> 'hidden' then p.handicap_index end,
    case when v.ok and coalesce(p.privacy ->> 'homeCourse', 'played') <> 'hidden' then p.home_course end,
    case when v.ok then p.avatar end,
    case when v.ok then p.pay_app end,
    case when v.ok then p.pay_handle end,
    case
      when not v.ok or p.stats is null or coalesce(p.privacy ->> 'stats', 'played') = 'hidden' then null
      when p.privacy ->> 'money' in ('played', 'everyone') or a.user_id = (select auth.uid()) then p.stats
      else p.stats - 'money'
    end,
    case when v.ok then p.updated_at end
  from public.account_players a
  left join public.profiles p on p.user_id = a.user_id
  cross join lateral (select public.profile_visible_to_me(a.user_id) and p.user_id is not null as ok) v
  where (select auth.uid()) is not null and a.player_id = any (p_ids[1:500])
$$;

-- Only signed-in people call it (never the anon key); create or replace keeps these, set again to be sure
revoke all on function public.people_profiles(text[]) from public, anon;
grant execute on function public.people_profiles(text[]) to authenticated;
