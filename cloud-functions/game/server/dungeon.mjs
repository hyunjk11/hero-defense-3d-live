import { abyssalRoll } from '../src/data/boss-sets.js';
import { growthWallet, creditMode } from './growth.mjs';
import { dungeonXP } from '../src/data/hero-growth.js';
import { failure, integer } from './common.mjs';
export const dungeonItems = {
  dg_steel: { price: 5, name: '강철 꾸러미', reward: { steel: 40 } },
  dg_souls: { price: 6, name: '영혼석 주머니', reward: { souls: 400 } },
  dg_crystal: { price: 8, name: '마력석 꾸러미', reward: { crystal: 10 } },
  dg_essence: { price: 15, name: '전직 정수', reward: { essence: 3 } },
  dg_title: { price: 60, name: '칭호 · 망령 사냥꾼', title: 'lich_hunter' },
};
for (const h of ['warrior','archer','mage','gunner','fighter']) dungeonItems['dg_morvia_' + h] = { price: 45, name: '모르비아의 무기', reward: { items: [{ k: 'gear', s: 'weapon', g: 3, set: 'morvia', h }] } };
for (const [s, price] of [['armor',40],['acc',35]]) dungeonItems['dg_morvia_' + s] = { price, name: '모르비아의 장비', reward: { items: [{ k: 'gear', s, g: 3, set: 'morvia' }] } };
export async function dungeon(c, name, a) {
  const runs = async (filter={}) => {
    try{return await c.list('dungeon_runs', { user_id: c.uid, ...filter });}
    catch(e){
      if(e.code!=='FAILED_PRECONDITION'||!Object.keys(filter).length)throw e;
      // Equality-index rollout must not prevent daily entry or hide old records.
      return (await c.list('dungeon_runs',{user_id:c.uid})).filter(r=>Object.entries(filter).every(([k,v])=>r[k]===v));
    }
  };
  if (name === 'status') {
    const [r, w] = await Promise.all([runs({day:c.day}), c.wallet()]); const used = r.filter(x => x.day === c.day).length;
    return { ok: true, day: c.day, maxFloors: 10, floors_limit: 10, limit: 1, used, left: Math.max(0, 1 - used), medals: w.medals, titles: w.titles, banned: !!c.ban };
  }
  c.requirePlayer();
  if (name === 'start') {
    const today = await runs({day:c.day}), used = today.length;
    if (used >= 1) return failure('daily_limit', { limit: 1, used, left: 0 });
    for (const old of await runs({status:'active'})) await c.put('dungeon_runs', { ...old, status: 'abandoned', finished_at: c.iso, floors: 0, win: false });
    if(a.p_growth===1)await growthWallet(c);
    const token = c.uuid(), maxFloors = a.p_max_floors === 10 ? 10 : 5;
    await c.insert('dungeon_runs', { user_id: c.uid, day: c.day, token, floors_limit: maxFloors, growth: a.p_growth===1, status: 'active', started_at: c.iso, finished_at: null, floors: null, win: null, medals: 0, uq: null, boss_reward: null, soul_reward: null });
    return { ok: true, token, maxFloors, floors_limit: maxFloors, limit: 1, used: used + 1, left: 0 };
  }
  if (name === 'buy') {
    const it = Object.hasOwn(dungeonItems, a.p_item) ? dungeonItems[a.p_item] : null; if (!it) return failure('bad_item'); const w = await c.wallet();
    if (it.title && w.titles.includes(it.title)) return failure('already', { medals: w.medals });
    if (w.medals < it.price) return failure('not_enough', { medals: w.medals, price: it.price });
    w.medals -= it.price; w.spent += it.price; if (it.title) w.titles.push(it.title); w.updated_at = c.iso; await c.put('dungeon_wallet', w);
    const mail = it.reward ? await c.mail(c.uid, '🏪 던전 상점 구매품', it.name, it.reward) : null;
    await c.insert('dungeon_buys', { user_id: c.uid, item: a.p_item, price: it.price, mail_id: mail?.id || null });
    return { ok: true, item: a.p_item, price: it.price, medals: w.medals, mail: mail?.id || null, titles: w.titles };
  }
  if (!['finish','boss_drop','ping'].includes(name)) return null;
  const r = (await c.list('dungeon_runs', { user_id: c.uid, token: a.p_token }))[0];
  if (!r) return failure('bad_token'); const maxFloors = r.floors_limit === 10 ? 10 : 5; const seconds = Math.max(0, (c.now - Date.parse(r.started_at)) / 1000);
  if (name === 'ping') {
    if (!r.growth) return failure('unsupported');
    const want = integer(a.p_floors, 0, maxFloors);
    if (r.status === 'done') return { ok: true, already: true, ...await creditMode(c,'dungeon',r.token,dungeonXP(r.floors, r.win, maxFloors)) };
    if (r.status !== 'active') return failure('used');
    if (seconds > 10800) return failure('expired');
    if (seconds < want * 20) return failure('too_fast');
    r.xp_floors = Math.max(r.xp_floors || 0, want); await c.put('dungeon_runs', r);
    return { ok: true, floors: r.xp_floors, ...await creditMode(c,'dungeon',r.token,dungeonXP(r.xp_floors, false, maxFloors)) };
  }
  if (name === 'boss_drop') {
    if (!['warrior','archer','mage','gunner','fighter'].includes(a.p_hero)) return failure('bad_item');
    if (r.boss_reward) return { ...r.boss_reward, ok: true };
    if (r.status !== 'active' && !(r.status === 'done' && r.floors >= 4 && c.now - Date.parse(r.finished_at) < 600000)) return failure('used');
    if (seconds > 10800) return failure('expired'); if (seconds < 100) return failure('too_early');
    let item = null, mail = null;
    if (c.random() < .30) { const s = ['weapon','armor','acc'][Math.floor(c.random() * 3)]; item = { k: 'gear', s, g: 3, set: 'morvia' }; if (s === 'weapon') item.h = a.p_hero; mail = await c.mail(c.uid, '♛ 모르비아의 전리품', '망령 여왕 모르비아 처치 보상', { items: [item] }); }
    r.boss_reward = { item, mail: mail?.id || null }; await c.put('dungeon_runs', r); return { ...r.boss_reward, ok: true };
  }
  const w = await c.wallet();
  if (r.status === 'done' && r.soul_reward) return { ...r.soul_reward, total: w.medals };
  if (r.status !== 'active') return failure('used');
  if (seconds > 10800) { await c.put('dungeon_runs', { ...r, status: 'abandoned', finished_at: c.iso, floors: 0, win: false }); return failure('expired'); }
  const want = integer(a.p_floors, 0, maxFloors), floors = Math.min(want, Math.floor(seconds / 20)), win = a.p_win === true && floors === maxFloors;
  const medals = floors * 2 + (win ? 5 : 0), souls = [0,150,400,700,1100,1700,2400,3200,4100,5100,6300][floors] + (win ? 300 : 0);
  w.medals = Math.min(1000000, w.medals + medals); w.earned += medals; w.updated_at = c.iso; await c.put('dungeon_wallet', w);
  const item = win && maxFloors === 10 ? { k: 'gear', ...abyssalRoll(['warrior','archer','mage','gunner','fighter'].includes(a.p_hero) ? a.p_hero : ['warrior','archer','mage','gunner','fighter'][Math.min(4,Math.floor(c.random()*5))], c.random) } : null;
  const mail = souls ? await c.mail(c.uid, '영혼석 던전', floors + '층 돌파', { souls, ...(item ? { items: [item] } : {}) }) : null;
  const xp = r.growth ? await creditMode(c,'dungeon',r.token,dungeonXP(floors,win,maxFloors)) : {};
  const receipt = { ...xp, ok: true, souls, ...(item ? { item } : {}), mail: mail?.id || null, medals, total: w.medals, floors, win, capped: floors < want };
  await c.put('dungeon_runs', { ...r, status: 'done', finished_at: c.iso, floors, win, medals, soul_reward: receipt }); return receipt;
}
