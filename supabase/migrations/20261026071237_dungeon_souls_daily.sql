-- Soul dungeon: one daily entry and an atomic, retryable 2,000-soul clear receipt.
-- Existing run history, wallets, Morvia drops and shop inventory are retained.
alter table public.hd3d_dungeon_runs add column if not exists soul_reward jsonb;

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
  return jsonb_build_object('ok', true, 'day', v_day, 'limit', 1, 'used', v_used, 'left', greatest(0, 1 - v_used),
    'medals', coalesce(w.medals, 0), 'titles', to_jsonb(coalesce(w.titles, '{}'::text[])), 'banned', public.hd3d_is_banned());
end $function$;

CREATE OR REPLACE FUNCTION hd3d_private.hd3d_dungeon_start()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_me uuid := auth.uid(); v_day date := public.hd3d_kst_day(); v_used int; v_tok uuid;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  perform pg_advisory_xact_lock(hashtext('hd3d_dungeon:' || v_me::text)); -- 같은 계정 동시 호출 직렬화
  select count(*) into v_used from public.hd3d_dungeon_runs r where r.user_id = v_me and r.day = v_day;
  if v_used >= 1 then return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'limit', 1, 'used', v_used, 'left', 0); end if;
  -- 진행 중이던 판(새로고침·창 닫기 등)은 포기 처리 → 계정당 진행 중 판은 항상 1개
  update public.hd3d_dungeon_runs set status = 'abandoned', finished_at = now(), floors = 0, win = false where user_id = v_me and status = 'active';
  insert into public.hd3d_dungeon_runs (user_id, day) values (v_me, v_day) returning token into v_tok;
  return jsonb_build_object('ok', true, 'token', v_tok, 'limit', 1, 'used', v_used + 1, 'left', 1 - v_used - 1);
end $function$;

create or replace function hd3d_private.hd3d_dungeon_finish(p_token uuid, p_floors integer, p_win boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid(); r public.hd3d_dungeon_runs%rowtype;
  v_sec numeric; v_fl int; v_win boolean; v_m int; v_tot int; v_souls int; v_mail bigint; v_receipt jsonb;
begin
  if v_me is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if public.hd3d_is_banned() then raise exception 'banned' using errcode = '42501', hint = 'banned'; end if;
  perform pg_advisory_xact_lock(hashtext('hd3d_dungeon:' || v_me::text));
  select * into r from public.hd3d_dungeon_runs x where x.token = p_token and x.user_id = v_me for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'bad_token'); end if;
  -- A lost response can be retried; neither souls nor medals are minted again.
  if r.status = 'done' and r.soul_reward is not null then
    select medals into v_tot from public.hd3d_dungeon_wallet where user_id = v_me;
    return r.soul_reward || jsonb_build_object('total', coalesce(v_tot,0));
  end if;
  -- Runs completed before this migration never receive retroactive rewards.
  if r.status <> 'active' then return jsonb_build_object('ok', false, 'reason', 'used'); end if;
  v_sec := greatest(0, extract(epoch from now() - r.started_at));
  if v_sec > 3 * 3600 then
    update public.hd3d_dungeon_runs set status = 'abandoned', finished_at = now(), floors = 0, win = false where id = r.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  v_fl := least(greatest(coalesce(p_floors, 0), 0), 5);
  v_fl := least(v_fl, floor(v_sec / 20)::int);
  v_win := coalesce(p_win, false) and v_fl = 5;
  v_m := v_fl * 2 + case when v_win then 5 else 0 end;
  v_souls := (array[0,150,400,700,1100,1700])[v_fl+1] + case when v_win then 300 else 0 end;
  insert into public.hd3d_dungeon_wallet(user_id,medals,earned) values(v_me,v_m,v_m)
    on conflict(user_id) do update set medals=least(1000000,public.hd3d_dungeon_wallet.medals+excluded.medals),
      earned=public.hd3d_dungeon_wallet.earned+excluded.earned,updated_at=now()
    returning medals into v_tot;
  if v_souls > 0 then
    insert into public.hd3d_mail(user_id,title,body,reward)
      values(v_me,'영혼석 던전',v_fl::text || '층 돌파',jsonb_build_object('souls',v_souls)) returning id into v_mail;
  end if;
  v_receipt := jsonb_build_object('ok',true,'souls',v_souls,'mail',v_mail,'medals',v_m,'total',v_tot,
    'floors',v_fl,'win',v_win,'capped',v_fl < least(greatest(coalesce(p_floors,0),0),5));
  update public.hd3d_dungeon_runs set status='done',finished_at=now(),floors=v_fl,win=v_win,medals=v_m,soul_reward=v_receipt where id=r.id;
  return v_receipt;
end $$;
