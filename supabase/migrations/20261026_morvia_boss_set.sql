-- Independent project only. Existing RLS, wallet and finish RPC are unchanged.
alter table public.hd3d_dungeon_runs add column if not exists boss_reward jsonb;
-- NULL = not rolled; {item:null,mail:null} = recorded miss. Drop and mail share one transaction.
create or replace function public.hd3d_valid_item(x jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(x) = 'object'
    and x ->> 'k' = 'gear'
    and not exists (select 1 from jsonb_object_keys(x) k where k not in ('k','s','h','g','c','set'))
    and x ->> 's' in ('weapon','armor','acc')
    and jsonb_typeof(x -> 'g') = 'number' and x ->> 'g' in ('0','1','2','3','4')
    and case when x ->> 's' = 'weapon' then x ->> 'h' in ('archer','mage','warrior','gunner','mechanic','fighter') else not (x ? 'h') end
    and (not (x ? 'c') or (jsonb_typeof(x -> 'c') = 'number' and x ->> 'c' in ('1','2','3','4','5','6','7','8','9','10')))
    and (not (x ? 'set') or (x ->> 'set' = 'morvia' and x ->> 'g' = '3' and not (x ? 'c')
      and (x ->> 's' <> 'weapon' or x ->> 'h' in ('warrior','archer','mage','gunner','fighter')))), false);
$$;

create or replace function hd3d_private.hd3d_dungeon_boss_drop(p_token uuid, p_hero text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); r public.hd3d_dungeon_runs%rowtype;
  v_sec numeric; v_slot text; v_item jsonb; v_mail bigint; v_reward jsonb;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  if p_hero is null or p_hero not in ('warrior','archer','mage','gunner','fighter') then
    return jsonb_build_object('ok',false,'reason','bad_item'); end if;
  perform pg_advisory_xact_lock(hashtext('hd3d_dungeon:' || v_me::text));
  select * into r from public.hd3d_dungeon_runs x where x.token = p_token and x.user_id = v_me for update;
  if not found then return jsonb_build_object('ok',false,'reason','bad_token'); end if;
  if r.boss_reward is not null then return r.boss_reward || jsonb_build_object('ok',true); end if;
  -- A recent finished run may retry after a lost response. Abandoned/old runs are ineligible.
  if r.status <> 'active' and not (r.status = 'done' and r.floors >= 4 and r.finished_at > now() - interval '10 minutes') then
    return jsonb_build_object('ok',false,'reason','used'); end if;
  v_sec := extract(epoch from now() - r.started_at);
  if v_sec > 10800 then return jsonb_build_object('ok',false,'reason','expired'); end if;
  if v_sec < 100 then return jsonb_build_object('ok',false,'reason','too_early'); end if;
  if random() < 0.30 then
    v_slot := (array['weapon','armor','acc'])[1 + floor(random() * 3)::int];
    v_item := jsonb_build_object('k','gear','s',v_slot,'g',3,'set','morvia');
    if v_slot = 'weapon' then v_item := v_item || jsonb_build_object('h',p_hero); end if;
    insert into public.hd3d_mail (user_id,title,body,reward)
      values (v_me,'♛ 모르비아의 전리품','망령 여왕 모르비아 처치 보상',jsonb_build_object('items',jsonb_build_array(v_item))) returning id into v_mail;
  end if;
  v_reward := jsonb_build_object('item',v_item,'mail',v_mail);
  update public.hd3d_dungeon_runs set boss_reward = v_reward where id = r.id;
  return v_reward || jsonb_build_object('ok',true);
end $$;
create or replace function public.hd3d_dungeon_boss_drop(p_token uuid, p_hero text) returns jsonb
language sql security invoker set search_path = '' as $$
  select hd3d_private.hd3d_dungeon_boss_drop(p_token,p_hero);
$$;
revoke all on function hd3d_private.hd3d_dungeon_boss_drop(uuid,text), public.hd3d_dungeon_boss_drop(uuid,text) from public, anon, authenticated;
grant execute on function hd3d_private.hd3d_dungeon_boss_drop(uuid,text), public.hd3d_dungeon_boss_drop(uuid,text) to authenticated, service_role;

-- The canonical dungeon shop function is appended by the preparation script.
create or replace function public.hd3d_dungeon_item(p_item text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $$
  select case p_item
    when 'dg_steel'   then '{"price": 5,  "name": "강철 꾸러미",   "reward": {"steel": 40}}'::jsonb
    when 'dg_souls'   then '{"price": 6,  "name": "영혼석 주머니", "reward": {"souls": 400}}'::jsonb
    when 'dg_crystal' then '{"price": 8,  "name": "마력석 꾸러미", "reward": {"crystal": 10}}'::jsonb
    when 'dg_essence' then '{"price": 15, "name": "전직 정수",     "reward": {"essence": 3}}'::jsonb
    when 'dg_title'   then '{"price": 60, "name": "칭호 · 망령 사냥꾼", "title": "lich_hunter"}'::jsonb
    when 'dg_morvia_warrior' then '{"price":45,"name":"모르비아의 장송검","reward":{"items":[{"k":"gear","s":"weapon","g":3,"set":"morvia","h":"warrior"}]}}'::jsonb
    when 'dg_morvia_archer' then '{"price":45,"name":"모르비아의 혼백궁","reward":{"items":[{"k":"gear","s":"weapon","g":3,"set":"morvia","h":"archer"}]}}'::jsonb
    when 'dg_morvia_mage' then '{"price":45,"name":"모르비아의 영혼홀","reward":{"items":[{"k":"gear","s":"weapon","g":3,"set":"morvia","h":"mage"}]}}'::jsonb
    when 'dg_morvia_gunner' then '{"price":45,"name":"모르비아의 망령쌍총","reward":{"items":[{"k":"gear","s":"weapon","g":3,"set":"morvia","h":"gunner"}]}}'::jsonb
    when 'dg_morvia_fighter' then '{"price":45,"name":"모르비아의 귀골권갑","reward":{"items":[{"k":"gear","s":"weapon","g":3,"set":"morvia","h":"fighter"}]}}'::jsonb
    when 'dg_morvia_armor' then '{"price":40,"name":"모르비아의 장막갑주","reward":{"items":[{"k":"gear","s":"armor","g":3,"set":"morvia"}]}}'::jsonb
    when 'dg_morvia_acc' then '{"price":35,"name":"모르비아의 왕관 목걸이","reward":{"items":[{"k":"gear","s":"acc","g":3,"set":"morvia"}]}}'::jsonb
    else null end;
$$;

notify pgrst, 'reload schema';
