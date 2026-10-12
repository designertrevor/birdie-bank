-- The shipped-idea push (added 2026-10-12): "The game you asked for is live", once a day, to the
-- person who sent the idea in. Run this once in Supabase: Dashboard, SQL Editor, New query, paste,
-- Run. Safe to run again. Needs, run first:
--   2026-10-07-roadmap.sql      (feedback.user_id, roadmap_status, roadmap_item, shipped_on)
-- Safe to run before or after 2026-10-08-push.sql and 2026-10-08-push-prefs.sql: until both of those
-- have run, push_ideas_due finds nothing (so nobody who switched "Your ideas" off on a phone before
-- the account could save it gets a push), and push-prefs.sql already allows 'shipped'.
--
-- What it adds:
--  • feedback.pushed_at: when the sender got the push about that idea. Set here, once, so an idea
--    never goes twice.
--  • push_prefs may hold 'shipped' (the "Your ideas" switch in Settings, Notifications, Which ones),
--    so switching it off saves to the account like the other switches.
--  • push_ideas_due(today, items): the ideas whose sender should hear today, each with the sender's
--    subscriptions. Only the server (api/push-ideas.js, a daily Vercel cron) calls it. An idea counts
--    when it came from a signed-in account (a phone-only idea has nobody to push; Up next still tells
--    that phone), it's a game, course or feature, it hasn't been pushed, the sender didn't switch
--    "Your ideas" off, they have push on somewhere, and it shipped in the last 14 days, either:
--      on its own        roadmap_status = 'shipped' and shipped_on set (set both, as for the roadmap note)
--      folded into an item on ROADMAP.md: roadmap_item is one of `items`, the checked lines the
--                        server read from the deployed ROADMAP.md, with their dates
--      folded into another idea: roadmap_item is 'q-' and that idea's id, and that one shipped
--    Someone who switched it off, or has no push yet, isn't stamped, so they still hear if they
--    switch it on within the 14 days.
--
-- Until this runs, the daily job finds nothing and sends nothing, and the switch in Settings saves
-- on the phone only (the account save fails quietly, as before).
--
-- To undo: drop function if exists public.push_ideas_due(text, jsonb);
--          alter table public.feedback drop column if exists pushed_at;
--          and put the push_prefs check back as 2026-10-08-push-prefs.sql has it.

alter table public.feedback add column if not exists pushed_at timestamptz;
create index if not exists feedback_ship_push on public.feedback (roadmap_item)
  where pushed_at is null and user_id is not null;

-- The "Your ideas" switch saves to the account (when push_prefs isn't there yet, push-prefs.sql
-- creates it with this same check)
do $$
begin
  if to_regclass('public.push_prefs') is not null then
    alter table public.push_prefs drop constraint if exists push_prefs_muted_check;
    alter table public.push_prefs add constraint push_prefs_muted_check
      check (coalesce(array_length(muted, 1), 0) <= 16
             and muted <@ array['invite', 'rsvp', 'finished', 'paid', 'carry', 'carried', 'talk', 'tee', 'shipped']::text[]);
  end if;
end $$;

-- p_today is YYYY-MM-DD. p_items is [{ "id": "r-…", "title": "…", "shipped": "YYYY-MM-DD" }]: the
-- public roadmap items shipped lately (idea-push.js shippedItems), never anything private.
create or replace function public.push_ideas_due(p_today text, p_items jsonb default '[]'::jsonb)
returns table (feedback_id uuid, idea_kind text, idea_title text, to_user uuid, push_endpoint text, push_p256dh text, push_auth text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  today date;
  rec record;
begin
  if p_today is null or p_today !~ '^\d{4}-\d{2}-\d{2}$' then return; end if;
  -- Nothing until the switches and the subscriptions are on the account (push-prefs.sql, push.sql),
  -- so a "Your ideas" switched off is always seen
  if to_regclass('public.push_prefs') is null or to_regclass('public.push_subscriptions') is null then return; end if;
  today := p_today::date;
  for rec in
    with items as (
      select left(i ->> 'id', 80) as id, left(btrim(coalesce(i ->> 'title', '')), 60) as title, (i ->> 'shipped')::date as shipped
      from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) as e(i)
      where jsonb_typeof(i) = 'object'
        and coalesce(i ->> 'id', '') ~ '^r-[a-z0-9-]{1,78}$'
        and coalesce(i ->> 'shipped', '') ~ '^\d{4}-\d{2}-\d{2}$'
      limit 200
    ), ideas as (
      select f.id, f.kind, f.user_id,
        case
          when f.roadmap_item is null then f.roadmap_title
          when f.roadmap_item like 'r-%' then (select it.title from items it where it.id = f.roadmap_item limit 1)
          else (select o.roadmap_title from public.feedback o where 'q-' || o.id::text = f.roadmap_item limit 1)
        end as title,
        case
          when f.roadmap_item is null then (case when f.roadmap_status = 'shipped' then f.shipped_on end)
          when f.roadmap_item like 'r-%' then (select it.shipped from items it where it.id = f.roadmap_item limit 1)
          else (select o.shipped_on from public.feedback o
                where 'q-' || o.id::text = f.roadmap_item and o.roadmap_status = 'shipped' limit 1)
        end as shipped
      from public.feedback f
      where f.pushed_at is null and f.user_id is not null
        and f.kind in ('game', 'course', 'feature')
        and (f.roadmap_item is not null or f.roadmap_status = 'shipped')
    )
    select d.id, d.kind, left(btrim(coalesce(d.title, '')), 60) as title, d.user_id
    from ideas d
    where d.shipped is not null and d.shipped <= today + 1 and d.shipped >= today - 14
      and not exists (select 1 from public.push_prefs p where p.user_id = d.user_id and 'shipped' = any (p.muted))
      and exists (select 1 from public.push_subscriptions s where s.user_id = d.user_id)
    limit 500
  loop
    -- Stamp it, and only send when this call is the one that did: two runs at once (a retried
    -- cron) can both pick the same idea, but the second waits here and then finds it stamped
    update public.feedback set pushed_at = now() where id = rec.id and pushed_at is null;
    if not found then continue; end if;
    return query
      select rec.id, rec.kind, rec.title, s.user_id, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s where s.user_id = rec.user_id limit 20;
  end loop;
end $$;

-- Only the server (the service role) calls it
revoke all on function public.push_ideas_due(text, jsonb) from public, anon, authenticated;
grant execute on function public.push_ideas_due(text, jsonb) to service_role;
