CREATE OR REPLACE FUNCTION hd3d_private.hd3d_dungeon_buy(p_item text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); v_it jsonb := public.hd3d_dungeon_item(p_item); v_price int; v_title text; w public.hd3d_dungeon_wallet%rowtype; v_mid bigint;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  if v_it is null then return jsonb_build_object('ok', false, 'reason', 'bad_item'); end if;
  v_price := (v_it ->> 'price')::int; v_title := v_it ->> 'title';
  perform pg_advisory_xact_lock(hashtext('hd3d_dungeon:' || v_me::text)); -- 정산(드롭)과 직렬화
  select * into w from public.hd3d_dungeon_wallet x where x.user_id = v_me for update;
  if v_title is not null and found and v_title = any(w.titles) then return jsonb_build_object('ok', false, 'reason', 'already', 'medals', w.medals); end if;
  if not found or w.medals < v_price then return jsonb_build_object('ok', false, 'reason', 'not_enough', 'medals', coalesce(w.medals, 0), 'price', v_price); end if;
  update public.hd3d_dungeon_wallet set medals = medals - v_price, spent = spent + v_price,
    titles = case when v_title is null then titles else titles || v_title end,
    updated_at = now() where user_id = v_me returning * into w;
  if v_it ? 'reward' then
    insert into public.hd3d_mail (user_id, title, body, reward)
      values (v_me, '🏪 던전 상점 구매품', (v_it ->> 'name') || ' — 던전 메달 ' || v_price || '개로 구매했습니다. ''받기''를 눌러 수령하세요.', v_it -> 'reward') returning id into v_mid;
  end if;
  insert into public.hd3d_dungeon_buys (user_id, item, price, mail_id) values (v_me, p_item, v_price, v_mid);
  return jsonb_build_object('ok', true, 'item', p_item, 'price', v_price, 'medals', w.medals, 'mail', v_mid, 'titles', to_jsonb(w.titles));
end $function$;

CREATE OR REPLACE FUNCTION hd3d_private.hd3d_dungeon_finish(p_token uuid, p_floors integer, p_win boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); r public.hd3d_dungeon_runs%rowtype; v_sec numeric; v_fl int; v_win boolean; v_m int; v_tot int;
  w public.hd3d_dungeon_wallet%rowtype;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  perform pg_advisory_xact_lock(hashtext('hd3d_dungeon:' || v_me::text));
  select * into r from public.hd3d_dungeon_runs x where x.token = p_token and x.user_id = v_me for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'bad_token'); end if;
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'used', 'status', r.status, 'medals', r.medals); end if; -- token 당 한 번
  v_sec := extract(epoch from now() - r.started_at);
  if v_sec > 3 * 3600 then
    update public.hd3d_dungeon_runs set status = 'abandoned', finished_at = now(), floors = 0, win = false where id = r.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  v_fl := least(greatest(coalesce(p_floors, 0), 0), 5);
  v_fl := least(v_fl, floor(v_sec / 20)::int);            -- 층당 최소 20초 (2배속 기준으로도 넉넉함) — 비정상적으로 빠른 완료는 층 수를 깎음
  v_win := coalesce(p_win, false) and v_fl = 5;
  v_m := v_fl * 2 + case when v_win then 5 else 0 end;    -- 메달 = 층당 2 + 완주(보스) 보너스 5 → 판당 최대 15, 하루 최대 45
  update public.hd3d_dungeon_runs set status = 'done', finished_at = now(), floors = v_fl, win = v_win, medals = v_m where id = r.id;
  insert into public.hd3d_dungeon_wallet (user_id, medals, earned) values (v_me, v_m, v_m)
    on conflict (user_id) do update set medals = least(1000000, public.hd3d_dungeon_wallet.medals + excluded.medals), earned = public.hd3d_dungeon_wallet.earned + excluded.earned, updated_at = now()
    returning * into w;
  v_tot := w.medals;
  return jsonb_build_object('ok', true, 'medals', v_m, 'total', v_tot, 'floors', v_fl, 'win', v_win, 'capped', v_fl < least(greatest(coalesce(p_floors, 0), 0), 5));
end $function$;

CREATE OR REPLACE FUNCTION hd3d_private.hd3d_dungeon_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); v_day date := public.hd3d_kst_day(); v_used int; w public.hd3d_dungeon_wallet%rowtype;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select count(*) into v_used from public.hd3d_dungeon_runs r where r.user_id = v_me and r.day = v_day;
  select * into w from public.hd3d_dungeon_wallet x where x.user_id = v_me;
  return jsonb_build_object('ok', true, 'day', v_day, 'limit', 3, 'used', v_used, 'left', greatest(0, 3 - v_used),
    'medals', coalesce(w.medals, 0), 'titles', to_jsonb(coalesce(w.titles, '{}'::text[])), 'banned', public.hd3d_is_banned());
end $function$;

CREATE OR REPLACE FUNCTION public.hd3d_dungeon_buy(p_item text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select hd3d_private.hd3d_dungeon_buy(p_item);
$function$;

CREATE OR REPLACE FUNCTION public.hd3d_dungeon_finish(p_token uuid, p_floors integer, p_win boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select hd3d_private.hd3d_dungeon_finish(p_token, p_floors, p_win);
$function$;

CREATE OR REPLACE FUNCTION public.hd3d_dungeon_item(p_item text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_item
    when 'dg_steel'   then '{"price": 5,  "name": "강철 꾸러미",   "reward": {"steel": 40}}'::jsonb
    when 'dg_souls'   then '{"price": 6,  "name": "영혼석 주머니", "reward": {"souls": 400}}'::jsonb
    when 'dg_crystal' then '{"price": 8,  "name": "마력석 꾸러미", "reward": {"crystal": 10}}'::jsonb
    when 'dg_essence' then '{"price": 15, "name": "전직 정수",     "reward": {"essence": 3}}'::jsonb
    when 'dg_title'   then '{"price": 60, "name": "칭호 · 망령 사냥꾼", "title": "lich_hunter"}'::jsonb
    else null end;
$function$;

CREATE OR REPLACE FUNCTION public.hd3d_dungeon_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select hd3d_private.hd3d_dungeon_status();
$function$;



CREATE OR REPLACE FUNCTION hd3d_private.hd3d_admin_user(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c jsonb;
begin
  if not public.hd3d_is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  c := public.hd3d_user_card(p_user);
  if c is null then return jsonb_build_object('ok', false, 'reason', 'no_user'); end if;
  return jsonb_build_object('ok', true, 'user', c,
    'orders', coalesce((select jsonb_agg(to_jsonb(o) order by o.created_at desc) from (select * from public.hd3d_orders where user_id = p_user order by created_at desc limit 30) o), '[]'::jsonb),
    'mail', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'reward', m.reward, 'claimed', m.claimed, 'revoked', m.revoked, 'created_at', m.created_at) order by m.created_at desc)
                        from (select * from public.hd3d_mail where user_id = p_user order by created_at desc limit 30) m), '[]'::jsonb),
    'log', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from (select * from public.hd3d_admin_log where target_user = p_user order by created_at desc limit 20) l), '[]'::jsonb),
    'dungeon', jsonb_build_object( -- 2026-10-23 던전 5단계: 메달 · 오늘(KST) 입장 수 · 전체 판 수
      'medals', coalesce((select w.medals from public.hd3d_dungeon_wallet w where w.user_id = p_user), 0),
      'earned', coalesce((select w.earned from public.hd3d_dungeon_wallet w where w.user_id = p_user), 0),
      'spent', coalesce((select w.spent from public.hd3d_dungeon_wallet w where w.user_id = p_user), 0),
      'today', (select count(*) from public.hd3d_dungeon_runs r where r.user_id = p_user and r.day = (now() at time zone 'Asia/Seoul')::date),
      'runs', (select count(*) from public.hd3d_dungeon_runs r where r.user_id = p_user)),
    'spire', public.hd3d_admin_spire_card(p_user)); -- 2026-10-24 무한의 탑 T-9 (탑 절 실행 전이면 null)
end $function$;

CREATE OR REPLACE FUNCTION hd3d_private.hd3d_claim_mail(p_mail_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m public.hd3d_mail%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  update public.hd3d_mail set claimed = true, claimed_at = now() where id = p_mail_id and user_id = auth.uid() and not claimed and not revoked returning * into m;
  if not found then
    select * into m from public.hd3d_mail where id = p_mail_id and user_id = auth.uid();
    if found and m.revoked and not m.claimed then raise exception 'mail revoked' using errcode = 'P0002', hint = 'revoked'; end if;
    if found then
      return jsonb_build_object('ok', true, 'already', true, 'id', m.id, 'reward', m.reward);
    end if;
    raise exception 'mail not found' using errcode = 'P0002';
  end if;
  if m.reward ? 'hero' then
    insert into public.hd3d_owned (user_id, item, source_mail) values (m.user_id, 'hero_' || (m.reward ->> 'hero'), m.id) on conflict do nothing;
  end if;
  -- 던전 메달(2026-10-23): 세이브가 아니라 서버 지갑에 (이 분기는 우편당 한 번만 실행됨)
  if coalesce((m.reward ->> 'medals')::int, 0) > 0 then
    insert into public.hd3d_dungeon_wallet (user_id, medals, earned) values (m.user_id, (m.reward ->> 'medals')::int, (m.reward ->> 'medals')::int)
      on conflict (user_id) do update set medals = least(1000000, public.hd3d_dungeon_wallet.medals + excluded.medals), earned = public.hd3d_dungeon_wallet.earned + excluded.earned, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'already', false, 'id', m.id, 'reward', m.reward);
end $function$;
-- Retired uniques are removed at the database boundary, including writes from old clients.
create or replace function public.hd3d_without_unique(x jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb; v jsonb; p jsonb; k text; t text;
begin
  if x is null then return null; end if;
  t := jsonb_typeof(x);
  if t = 'object' then
    if x ? 'uq' or x ->> 'k' = 'uq' or left(coalesce(x ->> 'id',''),2) = 'u_' then return null; end if;
    result := '{}'::jsonb;
    for k,v in select key,value from jsonb_each(x) loop
      if k in ('uqLog','uqPity') then continue; end if;
      p := public.hd3d_without_unique(v);
      if p is not null then result := result || jsonb_build_object(k,p); end if;
    end loop;
    if result -> 'items' = '[]'::jsonb then result := result - 'items'; end if;
    return result;
  elsif t = 'array' then
    result := '[]'::jsonb;
    for v in select value from jsonb_array_elements(x) loop
      p := public.hd3d_without_unique(v);
      if p is not null then result := result || jsonb_build_array(p); end if;
    end loop;
    return result;
  elsif t = 'string' then
    if left(x #>> '{}',2) = 'u_' then return null; end if;
    if left(x #>> '{}',1) = '[' then
      begin p := (x #>> '{}')::jsonb; exception when invalid_text_representation then return x; end;
      if jsonb_typeof(p) = 'array' then
        if jsonb_array_length(p) = 3 or left(coalesce(p ->> 0,''),2) = 'u_' then return null; end if;
      end if;
    end if;
  end if;
  return x;
end $$;

create or replace function public.hd3d_strip_retired_progress()
returns trigger language plpgsql set search_path = '' as $$
begin new.data := public.hd3d_without_unique(new.data); return new; end $$;
create trigger hd3d_strip_retired_progress before insert or update of data on public.hd3d_progress
for each row execute function public.hd3d_strip_retired_progress();

update public.hd3d_progress set data = public.hd3d_without_unique(data)
where data is distinct from public.hd3d_without_unique(data);
update public.hd3d_mail set reward = public.hd3d_without_unique(reward)
where reward is distinct from public.hd3d_without_unique(reward);
update public.hd3d_broadcasts set reward = public.hd3d_without_unique(reward)
where reward is distinct from public.hd3d_without_unique(reward);
update public.hd3d_dungeon_wallet set uniques = '{}', uq_pity = 0
where cardinality(uniques) > 0 or uq_pity > 0;
-- Old ownership columns are retained empty for historical schema compatibility.
drop function public.hd3d_dungeon_uq_roll(integer, double precision);

CREATE OR REPLACE FUNCTION public.hd3d_valid_item(x jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$

  select coalesce(jsonb_typeof(x) = 'object' and case x ->> 'k'

    when 'gear' then not exists (select 1 from jsonb_object_keys(x) k where k not in ('k', 's', 'h', 'g', 'c'))

      and x ->> 's' in ('weapon', 'armor', 'acc')

      and jsonb_typeof(x -> 'g') = 'number' and x ->> 'g' in ('0', '1', '2', '3', '4')

      and case when x ->> 's' = 'weapon' then x ->> 'h' in ('archer', 'mage', 'warrior', 'gunner', 'mechanic', 'fighter') else not (x ? 'h') end

      and (not (x ? 'c') or (jsonb_typeof(x -> 'c') = 'number' and x ->> 'c' in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')))

    else false end, false);

$function$;