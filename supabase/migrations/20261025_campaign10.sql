-- Independent project only: xgjbwdmviuhwfhsckdrh
-- Catalog validation and summary only; no data, grants or RLS changes.

create or replace function public.hd3d_valid_item(x jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(x) = 'object' and case x ->> 'k'
    when 'gear' then not exists (select 1 from jsonb_object_keys(x) k where k not in ('k', 's', 'h', 'g', 'c'))
      and x ->> 's' in ('weapon', 'armor', 'acc')
      and jsonb_typeof(x -> 'g') = 'number' and x ->> 'g' in ('0', '1', '2', '3', '4')
      and case when x ->> 's' = 'weapon' then x ->> 'h' in ('archer', 'mage', 'warrior', 'gunner', 'mechanic', 'fighter') else not (x ? 'h') end
      and (not (x ? 'c') or (jsonb_typeof(x -> 'c') = 'number' and x ->> 'c' in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10')))
    when 'uq' then not exists (select 1 from jsonb_object_keys(x) k where k not in ('k', 'u'))
      and x ->> 'u' in ('f_bow', 'f_acc', 'f_arm', 's_staff', 's_arm', 's_acc', 'v_sword', 'v_acc', 'v_arm', 'r_guns', 'r_acc', 'r_arm', 'c_acc', 'c_arm', 'c_ring', 'd_fist', 'ch5_boss', 'ch5_stars', 'ch5_drop', 'ch6_boss', 'ch6_stars', 'ch6_drop', 'ch7_boss', 'ch7_stars', 'ch7_drop', 'ch8_boss', 'ch8_stars', 'ch8_drop', 'ch9_boss', 'ch9_stars', 'ch9_drop', 'ch10_boss', 'ch10_stars', 'ch10_drop')
    else false end, false);
$$;

create or replace function public.hd3d_progress_summary(d jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when d is null or jsonb_typeof(d) <> 'object' then null else jsonb_build_object(
    'stars', public.hd3d_jstars(d -> 'st'),
    'souls', public.hd3d_jnum(d -> 'souls'), 'steel', public.hd3d_jnum(d -> 'mat' -> 'steel'),
    'crystal', public.hd3d_jnum(d -> 'mat' -> 'crystal'), 'essence', public.hd3d_jnum(d -> 'mat' -> 'essence'),
    'bestWave', public.hd3d_jnum(d -> 'bestWave'), 'runs', public.hd3d_jnum(d -> 'stats' -> 'runs'),
    'hero', left(case when jsonb_typeof(d -> 'hero') = 'string' then d ->> 'hero' end, 20),
    'adv', (select coalesce(jsonb_object_agg(left(e.key, 20), left(e.value ->> 'b', 20)), '{}'::jsonb)
              from jsonb_each(case when jsonb_typeof(d -> 'adv') = 'object' then d -> 'adv' else '{}'::jsonb end) e
             where jsonb_typeof(e.value) = 'object' and jsonb_typeof(e.value -> 'b') = 'string'))
  end;
$$;
