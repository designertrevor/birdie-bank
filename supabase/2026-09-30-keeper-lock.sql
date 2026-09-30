-- Keeper lock for live shared rounds (added 2026-09-30). Run this once in Supabase: Dashboard,
-- SQL Editor, New query, paste, Run. Safe to run again.
--
-- Until now anyone with a round's 6-letter code could write any of it. After this runs:
--  • A round in progress: only the scorekeeper's phone changes it. Any other phone can still take
--    its seat, set how it gets paid, ask for the card, and take the card once an ask has stood for
--    90 seconds with no answer. The phone that just handed the card off can still send the holes it
--    saved before. Anything else another phone sends is left out: the server keeps its own copy,
--    and that phone hears the server's copy back.
--  • A finished round: any player's phone (or the phone that shared it) can fix it.
--  • A round shared before this (or by an older copy of the app), or one whose keeper is on an older
--    copy, stays open to everyone with the code, as before.
--  • Seat requests (negative hole numbers) stay open to anyone with the link.
--
-- How the server knows which phone is which: each phone makes a secret device key and sends it with
-- every request (the x-bb-device header). The round's meta carries only hashes of those keys:
-- hostDev (the phone that shared it) and devs ({ seat: hash }, the phone that took each seat).
-- src/lib/keeper-lock.js is the same rules in JavaScript, with tests; keep the two in step.
--
-- To undo: drop trigger live_rounds_lock on public.live_rounds;
--          drop trigger live_holes_lock on public.live_holes;

alter table public.live_rounds add column if not exists prev_keeper_dev text;  -- the phone that last handed off
alter table public.live_rounds add column if not exists ask_seen_at timestamptz; -- when the current ask for the card arrived

-- The hash of the device key this request came with, or null (an older app sends none)
create or replace function public.bb_writer() returns text language plpgsql stable set search_path = '' as $$
declare h text;
begin
  begin
    h := (nullif(current_setting('request.headers', true), '')::json) ->> 'x-bb-device';
  exception when others then
    return null;
  end;
  if h is null or h !~ '^[0-9a-f]{32,128}$' then return null; end if;
  return encode(sha256(convert_to(h, 'UTF8')), 'hex');
end $$;

create or replace function public.bb_obj(j jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'object' then j else '{}'::jsonb end
$$;

create or replace function public.bb_str(j jsonb) returns text language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'string' and length(j #>> '{}') > 0 then j #>> '{}' end
$$;

-- The keeper's seat, or null (no keeper, or the host phone keeps score)
create or replace function public.bb_keeper_seat(m jsonb) returns text language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(m -> 'keeper') = 'object' then public.bb_str(m -> 'keeper' -> 'id') end
$$;

-- The hash of the keeper's phone, or null when there's no keeper or its phone isn't known
create or replace function public.bb_keeper_dev(m jsonb) returns text language sql immutable set search_path = '' as $$
  select case
    when coalesce(jsonb_typeof(m -> 'keeper'), '') <> 'object' then null
    when public.bb_keeper_seat(m) is not null then public.bb_str(public.bb_obj(m -> 'devs') -> public.bb_keeper_seat(m))
    else public.bb_str(m -> 'hostDev')
  end
$$;

-- Whether w is one of the round's players' phones, or the host phone
create or replace function public.bb_is_player_dev(m jsonb, w text) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(w is not null and (
    w = public.bb_str(m -> 'hostDev')
    or exists (select 1 from jsonb_each(public.bb_obj(m -> 'devs')) e where public.bb_str(e.value) = w)
  ), false)
$$;

-- Whether w may change anything in a round whose server meta is m
create or replace function public.bb_full(m jsonb, w text) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  if m is null or public.bb_str(m -> 'hostDev') is null then return true; end if; -- shared before the lock
  if m ->> 'status' = 'done' then return public.bb_is_player_dev(m, w); end if;
  k := public.bb_keeper_dev(m);
  if k is null then return true; end if; -- the keeper's phone isn't known: open, as before
  return w is not null and w = k;
end $$;

-- The meta the server keeps when w writes nxt over prior (null for a new round)
create or replace function public.bb_locked_meta(prior jsonb, nxt jsonb, w text, asked timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  is_full boolean := public.bb_full(prior, w);
  devs jsonb := public.bb_obj(prior -> 'devs');
  kseat text := case when prior ->> 'status' = 'done' then null else public.bb_keeper_seat(prior) end;
  seat_src jsonb;
  res jsonb;
  mine text[];
  s text;
  v jsonb;
  onapp jsonb;
  plist jsonb;
  oa jsonb;
  na jsonb;
  nk jsonb;
begin
  if coalesce(jsonb_typeof(nxt), '') <> 'object' then return nxt; end if;

  -- Seats point at a phone: only ever added, only to the writer's own hash, and never the keeper's
  -- seat from a phone without the card (a finished round has no card to take)
  if w is not null and jsonb_typeof(nxt -> 'devs') = 'object' then
    seat_src := case when is_full then nxt -> 'players' else prior -> 'players' end;
    if coalesce(jsonb_typeof(seat_src), '') <> 'array' then seat_src := '[]'::jsonb; end if;
    for s, v in select e.key, e.value from jsonb_each(nxt -> 'devs') e loop
      if public.bb_str(v) is distinct from w or public.bb_str(devs -> s) is not distinct from w then continue; end if;
      if not exists (select 1 from jsonb_array_elements(seat_src) x where public.bb_str(x -> 'id') = s) then continue; end if;
      if not is_full and s = kseat then continue; end if;
      devs := devs || jsonb_build_object(s, w);
    end loop;
  end if;

  if is_full then
    res := nxt;
  else
    res := prior;
    select coalesce(array_agg(e.key), '{}') into mine from jsonb_each(devs) e where public.bb_str(e.value) = w;

    -- On the app: this phone's own seats
    if jsonb_typeof(nxt -> 'onApp') = 'object' and cardinality(mine) > 0 then
      onapp := public.bb_obj(prior -> 'onApp');
      foreach s in array mine loop
        if nxt -> 'onApp' -> s is not null and nxt -> 'onApp' -> s <> 'null'::jsonb then
          onapp := onapp || jsonb_build_object(s, nxt -> 'onApp' -> s);
        end if;
      end loop;
      res := jsonb_set(res, '{onApp}', onapp);
    end if;

    -- How this phone's own seats get paid
    if jsonb_typeof(prior -> 'players') = 'array' and jsonb_typeof(nxt -> 'players') = 'array' and cardinality(mine) > 0 then
      select coalesce(jsonb_agg(
        case when jsonb_typeof(pl.value) = 'object' and public.bb_str(pl.value -> 'id') = any(mine) and jsonb_typeof(nx.value) = 'object'
          then (pl.value - 'payApp' - 'payHandle' - 'venmo')
            || coalesce((select jsonb_object_agg(f.key, f.value) from jsonb_each(nx.value) f where f.key in ('payApp', 'payHandle', 'venmo')), '{}'::jsonb)
          else pl.value end
        order by pl.ord), '[]'::jsonb)
      into plist
      from jsonb_array_elements(prior -> 'players') with ordinality as pl(value, ord)
      left join lateral (
        select y.value from jsonb_array_elements(nxt -> 'players') with ordinality as y(value, ord)
        where jsonb_typeof(y.value) = 'object' and y.value ->> 'id' = pl.value ->> 'id' order by y.ord limit 1
      ) nx on true;
      res := jsonb_set(res, '{players}', plist);
    end if;

    -- Seat claims stay open to every phone with the code, as before
    if nxt ? 'claims' then res := jsonb_set(res, '{claims}', nxt -> 'claims'); else res := res - 'claims'; end if;

    -- Asking for the card (for this phone's seat), or taking the ask back
    oa := prior -> 'cardAsk';
    na := nxt -> 'cardAsk';
    if coalesce(oa, 'null'::jsonb) is distinct from coalesce(na, 'null'::jsonb) then
      if coalesce(
        (jsonb_typeof(na) = 'object' and public.bb_str(na -> 'by') = any(mine) and coalesce(na ->> 'no', 'false') <> 'true')
        or (coalesce(jsonb_typeof(na), 'null') <> 'object' and jsonb_typeof(oa) = 'object' and public.bb_str(oa -> 'by') = any(mine)),
        false) then
        res := jsonb_set(res, '{cardAsk}', case when jsonb_typeof(na) = 'object' then na else 'null'::jsonb end);
      end if;
    end if;

    -- Taking the card after an ask nobody answered
    nk := nxt -> 'keeper';
    if coalesce(
      coalesce(prior -> 'keeper', 'null'::jsonb) is distinct from coalesce(nk, 'null'::jsonb)
      and jsonb_typeof(nk) = 'object' and public.bb_str(nk -> 'id') = any(mine)
      and coalesce(prior ->> 'status', '') <> 'done'
      and jsonb_typeof(oa) = 'object' and oa ->> 'by' = nk ->> 'id' and coalesce(oa ->> 'no', 'false') <> 'true'
      and asked is not null and now() - asked >= interval '90 seconds',
      false) then
      res := jsonb_set(res, '{keeper}', nk);
      res := jsonb_set(res, '{cardAsk}', case when jsonb_typeof(na) = 'object' then na else 'null'::jsonb end);
    end if;
  end if;

  if devs <> '{}'::jsonb or coalesce(prior ? 'devs', false) then res := jsonb_set(res, '{devs}', devs); else res := res - 'devs'; end if;

  -- The host phone is set once, by the host phone itself, and never changes
  if public.bb_str(prior -> 'hostDev') is not null then
    res := jsonb_set(res, '{hostDev}', prior -> 'hostDev');
  elsif not coalesce(w is not null and public.bb_str(res -> 'hostDev') = w, false) then
    res := res - 'hostDev';
  end if;
  return res;
end $$;

create or replace function public.live_rounds_lock() returns trigger language plpgsql set search_path = '' as $$
declare
  w text := public.bb_writer();
  was text;
  now_is text;
  oa text;
  na text;
begin
  if tg_op = 'INSERT' then
    new.meta := public.bb_locked_meta(null, new.meta, w, null);
    new.prev_keeper_dev := null;
    new.ask_seen_at := case when jsonb_typeof(new.meta -> 'cardAsk') = 'object' then now() end;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Stop sharing: the host phone or the keeper
    if public.bb_full(old.meta, w) or (w is not null and w = public.bb_str(old.meta -> 'hostDev')) then return old; end if;
    return null;
  end if;
  new.code := old.code;
  new.meta := public.bb_locked_meta(old.meta, new.meta, w, old.ask_seen_at);
  was := public.bb_keeper_dev(old.meta);
  now_is := public.bb_keeper_dev(new.meta);
  new.prev_keeper_dev := case when was is distinct from now_is then was else old.prev_keeper_dev end;
  oa := case when jsonb_typeof(old.meta -> 'cardAsk') = 'object' then concat(old.meta -> 'cardAsk' ->> 'by', '|', old.meta -> 'cardAsk' ->> 'at') end;
  na := case when jsonb_typeof(new.meta -> 'cardAsk') = 'object' then concat(new.meta -> 'cardAsk' ->> 'by', '|', new.meta -> 'cardAsk' ->> 'at') end;
  new.ask_seen_at := case when oa is distinct from na then (case when na is not null then now() end) else old.ask_seen_at end;
  return new;
end $$;

create or replace function public.live_holes_lock() returns trigger language plpgsql set search_path = '' as $$
declare
  w text;
  m jsonb;
  prev text;
  c text;
  n int;
  had jsonb;
  ok boolean;
begin
  if tg_op = 'DELETE' then c := old.code; n := old.hole_no; else c := new.code; n := new.hole_no; end if;
  select r.meta, r.prev_keeper_dev into m, prev from public.live_rounds r where r.code = c;
  -- Seat requests are open to anyone with the link; a round that's gone (or being deleted) has no lock
  if n < 0 or not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  w := public.bb_writer();
  ok := public.bb_full(m, w)
    or (w is not null and w = prev and coalesce(m ->> 'status', '') <> 'done')
    or (tg_op = 'DELETE' and w is not null and w = public.bb_str(m -> 'hostDev'));
  if ok then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  -- Not this phone's to change: the server keeps its copy, and an update still goes out so the
  -- phone that sent it hears the server's copy back. (An upsert runs the insert trigger first, so
  -- the existing row's data goes into the insert, and the update below keeps it.)
  if tg_op = 'UPDATE' then
    new.data := old.data;
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    select h.data into had from public.live_holes h where h.code = c and h.hole_no = n;
    if found then new.data := had; return new; end if;
  end if;
  return null;
end $$;

drop trigger if exists live_rounds_lock on public.live_rounds;
create trigger live_rounds_lock before insert or update or delete on public.live_rounds
  for each row execute function public.live_rounds_lock();

drop trigger if exists live_holes_lock on public.live_holes;
create trigger live_holes_lock before insert or update or delete on public.live_holes
  for each row execute function public.live_holes_lock();
