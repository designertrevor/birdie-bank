-- The public roadmap: votes, comments and ideas sent in (added 2026-10-07). Run this once in
-- Supabase: Dashboard, SQL Editor, New query, paste, Run. Safe to run again. Needs schema.sql's
-- feedback table, 2026-09-30-keeper-lock.sql (bb_writer) and 2026-10-01-profiles.sql (profiles), all
-- already run.
--
-- The list itself comes from ROADMAP.md when the app is built (src/lib/roadmap-public.js), so
-- nothing here holds the items: a vote or comment names an item by its id ('r-' and a hash of the
-- line's first seven words, or 'q-' and a feedback id for an idea Trevor put on the roadmap).
--
-- What it adds:
--  • roadmap_votes: one vote per account per item. Only signed-in people vote; anyone reads the
--    counts through roadmap_counts(), never who voted.
--  • roadmap_comments: signed-in people comment; everyone reads them through roadmap_comments(item),
--    which never hands out an account id. The name on a comment is worked out as it's read, from the
--    one profile setting: the first name in profiles when it's Everyone, else none ("A golfer"), so
--    changing the setting later changes every old comment too, and nobody posts under a made-up name.
--    Each person takes back only their own (roadmap_delete_comment). Trevor hides one from the
--    Dashboard by setting hidden = true.
--  • Five columns on feedback so an idea can go on the roadmap, set by Trevor in the Dashboard:
--      roadmap_title   the public title (the idea's own words never go out)
--      roadmap_status  'planned', 'progress' (In progress) or 'shipped'; empty keeps it private
--      roadmap_item    an item's id from the list, when the idea is the same as one already on it
--                      (the requester then hears when that item ships)
--      shipped_on      the day it shipped, for the "it's live" note
--    plus user_id and device (who sent it, filled in by the server). roadmap_requests() lists the
--    approved ideas with only their public title and status; roadmap_mine() lets the person who
--    sent an idea (the same account, or the same phone) see what became of it. Nobody can read who
--    asked for what.
--
-- To put an idea on the roadmap: Table Editor, feedback, find the row (kind game or feature), set
-- roadmap_title and roadmap_status = 'planned'. To fold it into an item already listed, set
-- roadmap_item to that item's id instead (open the roadmap with ?roadmap&ids to see them). When it
-- ships, set roadmap_status = 'shipped' and shipped_on.
--
-- Until this runs, the app shows the list read-only with no counts, keeps votes on the phone and
-- sends them once it has run (for a signed-in person), and hides comments.
--
-- To undo: drop function public.roadmap_counts(); drop function public.roadmap_comments(text);
--          drop function public.roadmap_vote(text, boolean); drop function public.roadmap_my_votes();
--          drop function public.roadmap_add_comment(uuid, text, text);
--          drop function public.roadmap_delete_comment(uuid); drop function public.roadmap_requests();
--          drop function public.roadmap_mine(); drop table public.roadmap_votes;
--          drop table public.roadmap_comments; and the feedback columns below.

-- ---------------------------------------------------------------------------------------------
-- Ideas sent in: who sent them (for roadmap_mine) and Trevor's roadmap columns
alter table public.feedback add column if not exists user_id uuid default auth.uid();
alter table public.feedback add column if not exists device text default public.bb_writer();
alter table public.feedback add column if not exists roadmap_title text;
alter table public.feedback add column if not exists roadmap_status text;
alter table public.feedback add column if not exists roadmap_item text;
alter table public.feedback add column if not exists shipped_on date;
alter table public.feedback drop constraint if exists feedback_roadmap_status_check;
alter table public.feedback add constraint feedback_roadmap_status_check check (roadmap_status is null or roadmap_status in ('planned', 'progress', 'shipped'));
alter table public.feedback drop constraint if exists feedback_roadmap_title_check;
alter table public.feedback add constraint feedback_roadmap_title_check check (roadmap_title is null or length(roadmap_title) <= 80);
alter table public.feedback drop constraint if exists feedback_roadmap_item_check;
alter table public.feedback add constraint feedback_roadmap_item_check check (roadmap_item is null or roadmap_item ~ '^[a-z0-9][a-z0-9-]{0,79}$');
create index if not exists feedback_user on public.feedback (user_id) where user_id is not null;
create index if not exists feedback_device on public.feedback (device) where device is not null;

-- Sending stays open to anyone, as before. Nobody sends an idea as someone else or puts it on the
-- roadmap themselves: those columns are the server's and Trevor's.
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (
  status = 'new'
  and roadmap_title is null and roadmap_status is null and roadmap_item is null and shipped_on is null
  and (user_id is null or user_id = (select auth.uid()))
  and (device is null or device = public.bb_writer())
);

-- ---------------------------------------------------------------------------------------------
-- Votes: one per account per item
create table if not exists public.roadmap_votes (
  item text not null check (item ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item, user_id)
);
alter table public.roadmap_votes enable row level security;
revoke all on public.roadmap_votes from anon, authenticated;

-- Comments: signed-in people write, everyone reads through roadmap_comments()
create table if not exists public.roadmap_comments (
  id uuid primary key,
  item text not null check (item ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 500),
  deleted boolean not null default false,
  hidden boolean not null default false,  -- set by Trevor in the Dashboard
  created_at timestamptz not null default now()
);
create index if not exists roadmap_comments_item on public.roadmap_comments (item, created_at);
create index if not exists roadmap_comments_user on public.roadmap_comments (user_id, created_at);
alter table public.roadmap_comments enable row level security;
revoke all on public.roadmap_comments from anon, authenticated;

-- An approved idea's item id, or null while it's private
create or replace function public.roadmap_request_item(f public.feedback) returns text
language sql stable set search_path = '' as $$
  select case
    when f.roadmap_item is not null then f.roadmap_item
    when f.roadmap_status is not null and nullif(btrim(coalesce(f.roadmap_title, '')), '') is not null then 'q-' || f.id::text
  end
$$;

-- Votes and comments for each item on the public list (ROADMAP.md items and approved ideas)
create or replace function public.roadmap_counts() returns table (item text, votes integer, comments integer)
language sql stable security definer set search_path = '' as $$
  with v as (select rv.item, count(*)::int n from public.roadmap_votes rv group by rv.item),
       c as (select rc.item, count(*)::int n from public.roadmap_comments rc where not rc.deleted and not rc.hidden group by rc.item),
       i as (select v.item from v union select c.item from c)
  select i.item, coalesce(v.n, 0), coalesce(c.n, 0)
  from i left join v on v.item = i.item left join c on c.item = i.item
  where i.item like 'r-%'
     or exists (select 1 from public.feedback f where f.roadmap_item is null and public.roadmap_request_item(f) = i.item)
$$;

-- The comments on one item, oldest first, with whether each one is yours. The name is the
-- commenter's first name only while their profile is open to Everyone (profile-model.js), read now
-- rather than when they posted.
create or replace function public.roadmap_comments(p_item text)
returns table (id uuid, name text, body text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = '' as $$
  select rc.id,
    case when p.privacy ->> 'profile' = 'everyone'
      then nullif(left(split_part(regexp_replace(btrim(coalesce(p.display_name, '')), '\s+', ' ', 'g'), ' ', 1), 40), '') end,
    rc.body, rc.created_at, (auth.uid() is not null and rc.user_id = auth.uid())
  from public.roadmap_comments rc
  left join public.profiles p on p.user_id = rc.user_id
  where rc.item = p_item and not rc.deleted and not rc.hidden
  order by rc.created_at
  limit 200
$$;

-- The items your account has voted for
create or replace function public.roadmap_my_votes() returns setof text
language sql stable security definer set search_path = '' as $$
  select rv.item from public.roadmap_votes rv where auth.uid() is not null and rv.user_id = auth.uid()
$$;

-- Vote (p_on true) or take it back (false). Signed in only; a second vote is the same vote.
create or replace function public.roadmap_vote(p_item text, p_on boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to vote' using errcode = '42501'; end if;
  if p_item is null or p_item !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'No such item' using errcode = '22023'; end if;
  if p_on then
    insert into public.roadmap_votes (item, user_id) values (p_item, me) on conflict do nothing;
  else
    delete from public.roadmap_votes where item = p_item and user_id = me;
  end if;
end $$;

-- Add a comment (the phone makes its id, so sending twice adds it once). At most 30 a day each.
create or replace function public.roadmap_add_comment(p_id uuid, p_item text, p_body text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in to comment' using errcode = '42501'; end if;
  if p_item is null or p_item !~ '^[a-z0-9][a-z0-9-]{0,79}$' then raise exception 'No such item' using errcode = '22023'; end if;
  if (select count(*) from public.roadmap_comments rc where rc.user_id = me and rc.created_at > now() - interval '1 day') >= 30 then
    raise exception 'That''s a lot of comments for one day' using errcode = '54000';
  end if;
  insert into public.roadmap_comments (id, item, user_id, body)
  values (p_id, p_item, me, left(btrim(p_body), 500))
  on conflict (id) do nothing;
end $$;

-- Take back your own comment
create or replace function public.roadmap_delete_comment(p_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  update public.roadmap_comments set deleted = true where id = p_id and user_id = me;
end $$;

-- Ideas Trevor put on the roadmap as their own items: public title and status only
create or replace function public.roadmap_requests()
returns table (id text, title text, status text, kind text, shipped_on date, created_on date)
language sql stable security definer set search_path = '' as $$
  select 'q-' || f.id::text, btrim(f.roadmap_title), f.roadmap_status, f.kind, f.shipped_on, f.created_at::date
  from public.feedback f
  where f.roadmap_item is null and f.kind in ('game', 'feature', 'course')
    and public.roadmap_request_item(f) is not null
  order by f.created_at
  limit 200
$$;

-- Your own ideas (this account's, or this phone's) and what became of them
create or replace function public.roadmap_mine()
returns table (id uuid, kind text, item text, status text, title text, shipped_on date)
language sql stable security definer set search_path = '' as $$
  select f.id, f.kind, public.roadmap_request_item(f), f.roadmap_status, f.roadmap_title, f.shipped_on
  from public.feedback f
  where f.kind in ('game', 'feature', 'course')
    and ((auth.uid() is not null and f.user_id = auth.uid())
      or (public.bb_writer() is not null and f.device = public.bb_writer()))
  order by f.created_at desc
  limit 50
$$;

revoke all on function public.roadmap_request_item(public.feedback) from public, anon, authenticated;
grant execute on function public.roadmap_counts() to anon, authenticated;
grant execute on function public.roadmap_comments(text) to anon, authenticated;
grant execute on function public.roadmap_requests() to anon, authenticated;
grant execute on function public.roadmap_mine() to anon, authenticated;
revoke all on function public.roadmap_my_votes() from public, anon;
revoke all on function public.roadmap_vote(text, boolean) from public, anon;
revoke all on function public.roadmap_add_comment(uuid, text, text) from public, anon;
revoke all on function public.roadmap_delete_comment(uuid) from public, anon;
grant execute on function public.roadmap_my_votes() to authenticated;
grant execute on function public.roadmap_vote(text, boolean) to authenticated;
grant execute on function public.roadmap_add_comment(uuid, text, text) to authenticated;
grant execute on function public.roadmap_delete_comment(uuid) to authenticated;
