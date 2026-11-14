import { growthWallet, growthView, creditMode } from './growth.mjs';
import { spireXP } from '../src/data/hero-growth.js';
import { failure, integer, shiftDay } from './common.mjs';
export const minSeconds = (from, top) => top < from ? 0 : 25 * (top - from + 1) + 15 * (Math.floor(top / 5) - Math.floor((from - 1) / 5));
export const weeklyReward = n => ({ souls: Math.min(1500, Math.max(0, n) * 30), medals: Math.min(25, Math.floor(Math.max(0, n) / 5) * 2) });
export const weeklyTitle = rank => rank === 1 ? 'spire_w1' : rank >= 2 && rank <= 10 ? 'spire_w10' : null;
export const rankSort = (a,b) => b.best_floor - a.best_floor || String(a.best_at || '~').localeCompare(String(b.best_at || '~')) || a.user_id.localeCompare(b.user_id);
export async function ranking(c, kind, week) {
  const [rows, bans] = await Promise.all([c.list(kind === 'week' ? 'spire_weeks' : 'spire_best', kind === 'week' ? { week } : {}), c.list('bans')]);
  const excluded = new Set(bans.map(x => x.user_id)); return rows.filter(x => x.best_floor > 0 && !excluded.has(x.user_id)).sort(rankSort);
}
export async function record(c, r, top) {
  let b = await c.get('spire_best', c.uid) || { user_id: c.uid, best_floor: 0, best_at: null, cleared_bosses: 0, updated_at: c.iso };
  const isNew = top > b.best_floor; if (isNew) { b.best_floor = top; b.best_at = c.iso; }
  r.top_floor = Math.max(r.top_floor, top); await c.put('spire_runs', r);
  let w = await c.get('spire_weeks', c.uid + '~' + r.week);
  if (top >= r.from_floor && (!w || top > w.best_floor)) { w = { user_id: c.uid, week: r.week, best_floor: top, best_at: c.iso, claimed: w?.claimed || false }; await c.put('spire_weeks', w); }
  const reward = { floors: [], souls: 0, medals: 0, titles: [], mail: null };
  if (top >= b.cleared_bosses + 5) {
    for (let n = b.cleared_bosses + 5; n <= top; n += 5) {
      if (n > 100 && n % 10) continue; reward.floors.push(n); if (n <= 100) reward.souls += 300 + 100 * Math.floor(n / 5);
      if (n % 10 === 0) reward.medals += n <= 100 ? 5 + n / 10 : 10;
      if (n === 30 || n === 50) reward.titles.push('spire_' + n);
    }
    b.cleared_bosses = Math.floor(top / 5) * 5;
    if (reward.souls || reward.medals) { const rw = {}; if (reward.souls) rw.souls = reward.souls; if (reward.medals) rw.medals = reward.medals; reward.mail = (await c.mail(c.uid, '🗼 무한의 탑 첫 돌파', reward.floors.join('·') + '층 첫 돌파', rw)).id; }
    if (reward.titles.length) { const wallet = await c.wallet(); wallet.titles = [...new Set([...wallet.titles, ...reward.titles])]; wallet.updated_at = c.iso; await c.put('dungeon_wallet', wallet); }
  }
  b.updated_at = c.iso; await c.put('spire_best', b);
  const xp = r.growth ? await creditMode(c,'spire',r.token,spireXP(r.from_floor,r.top_floor)) : {};
  return { ...xp, top: r.top_floor, best: b.best_floor, new_best: isNew, week_best: w?.best_floor || 0, reward };
}
export async function spire(c, name, a) {
  const runs = () => c.list('spire_runs', { user_id: c.uid });
  if (name === 'rank') {
    const kind = a.p_kind ?? 'week', wk = a.p_week ?? c.week; if (!['week','all'].includes(kind)) return failure('bad_kind');
    const ranked = await ranking(c, kind, wk); const at = ranked.findIndex(x => x.user_id === c.uid);
    const top = await Promise.all(ranked.slice(0,50).map(async (x,i) => ({ rank: i+1, nick: (await c.get('profiles', x.user_id))?.nickname || '용사', floor: x.best_floor, at: x.best_at, me: x.user_id === c.uid })));
    return { ok: true, kind, week: kind === 'week' ? wk : null, top, me: at < 0 ? null : { rank: at + 1, floor: ranked[at].best_floor } };
  }
  if (name === 'status') {
    const [r,b,wallet,weeks] = await Promise.all([runs(), c.get('spire_best',c.uid), c.wallet(), c.list('spire_weeks',{user_id:c.uid})]);
    const used = r.filter(x=>x.day === c.day).length, best = b?.best_floor || 0, current = weeks.find(x=>x.week===c.week), ranks = await ranking(c,'week',c.week);
    const checkpoints = [1]; for(let n=5;n<=best;n+=5) checkpoints.push(n+1);
    const unclaimed = await Promise.all(weeks.filter(x=>x.week<c.week&&!x.claimed&&x.best_floor>0).sort((a,b)=>b.week.localeCompare(a.week)).slice(0,8).map(async x=>{ const ranked=await ranking(c,'week',x.week), rank=ranked.findIndex(y=>y.user_id===c.uid)+1; return {week:x.week,best:x.best_floor,rank:rank||null,title:x.week===shiftDay(c.week,-7)?weeklyTitle(rank):null,...weeklyReward(x.best_floor)}; }));
    return {ok:true,day:c.day,week:c.week,limit:30,used,left:Math.max(0,30-used),best,best_at:b?.best_at||null,cleared:b?.cleared_bosses||0,checkpoints,week_best:current?.best_floor||0,week_rank:ranks.findIndex(x=>x.user_id===c.uid)+1||null,banned:!!c.ban,active:r.some(x=>x.status==='active'),unclaimed,titles:wallet.titles.filter(x=>x.startsWith('spire_')).sort()};
  }
  c.requirePlayer();
  if(name === 'start') {
    const from=integer(a.p_from,0,100000), b=await c.get('spire_best',c.uid), best=b?.best_floor||0;
    if(!(from===1 || from>1&&from%5===1&&from-1<=best)) return failure('bad_from',{best});
    const rows=await runs(),used=rows.filter(x=>x.day===c.day).length;if(used>=30)return failure('daily_limit',{limit:30,used,left:0});
    for(const r of rows.filter(x=>x.status==='active')) await c.put('spire_runs',{...r,status:'abandoned',finished_at:c.iso});
    if(a.p_growth===1)await growthWallet(c);
    const token=c.uuid();await c.insert('spire_runs',{user_id:c.uid,token,day:c.day,week:c.week,from_floor:from,top_floor:from-1,growth:a.p_growth===1,status:'active',started_at:c.iso,last_ping_at:null,last_ping_floor:null,finished_at:null,capped:false,summary:null});
    return {ok:true,token,from,best,limit:30,used:used+1,left:29-used};
  }
  if(name === 'claim_week') {
    const wk=a.p_week??shiftDay(c.week,-7);if(!/^\d{4}-\d{2}-\d{2}$/.test(wk)||new Date(wk+'T00:00:00Z').getUTCDay()!==1)return failure('bad_week');
    if(wk>=c.week)return failure('not_ended',{week:wk});const w=await c.get('spire_weeks',c.uid+'~'+wk);if(!w||w.best_floor<=0)return failure('no_record',{week:wk});if(w.claimed)return failure('claimed',{week:wk});
    const ranks=await ranking(c,'week',wk),rank=ranks.findIndex(x=>x.user_id===c.uid)+1||null,rw=weeklyReward(w.best_floor),last=wk===shiftDay(c.week,-7),title=last?weeklyTitle(rank):null;
    await c.put('spire_weeks',{...w,claimed:true});const reward={};if(rw.souls)reward.souls=rw.souls;if(rw.medals)reward.medals=rw.medals;
    const mail=Object.keys(reward).length?await c.mail(c.uid,'🗼 무한의 탑 주간 보상',wk+' 주 최고 '+w.best_floor+'층',reward):null;
    if(last){const wallet=await c.wallet();wallet.titles=wallet.titles.filter(x=>!['spire_w1','spire_w10'].includes(x));if(title)wallet.titles.push(title);wallet.titles=[...new Set(wallet.titles)].sort();wallet.updated_at=c.iso;await c.put('dungeon_wallet',wallet);}
    return {ok:true,week:wk,best:w.best_floor,rank,...rw,title,mail:mail?.id||null};
  }
  if(!['ping','finish'].includes(name))return null;
  const r=(await c.list('spire_runs',{user_id:c.uid,token:a.p_token}))[0];if(!r)return failure('bad_token');if(name==='finish'&&r.finish_receipt)return {...r.finish_receipt,already:true,growth:growthView(await growthWallet(c))};if(name==='ping'&&r.growth&&r.status==='done'&&Number.isInteger(a.p_floor)&&a.p_floor>=r.from_floor&&a.p_floor<=r.top_floor)return {...r.finish_receipt,ok:true,floor:a.p_floor,already:true,growth:growthView(await growthWallet(c))};if(r.status!=='active')return failure('used',{status:r.status,top:r.top_floor});
  const seconds=(c.now-Date.parse(r.started_at))/1000;if(seconds>10800){await c.put('spire_runs',{...r,status:'abandoned',finished_at:c.iso});return failure('expired',{top:r.top_floor});}
  if(name==='ping'){
    const floor=integer(a.p_floor,0,100000),last=r.last_ping_floor??r.from_floor-1;
    if(r.growth&&floor<=last&&floor>=r.from_floor)return {ok:true,floor,already:true,...await record(c,r,r.top_floor)};
    if((!r.growth&&floor%5!==0)||floor<=last||floor>r.from_floor+29)return failure('bad_floor',{last});
    const since=(c.now-Date.parse(r.last_ping_at||r.started_at))/1000;if(seconds<minSeconds(r.from_floor,floor)||since<125*Math.floor((floor-last)/5))return failure('too_fast',{last});
    r.last_ping_at=c.iso;r.last_ping_floor=floor;return {ok:true,floor,...await record(c,r,floor)};
  }
  const requested=Math.max(integer(a.p_top,0,100000),r.from_floor-1),want=Math.min(requested,r.from_floor+29);let allowed=r.from_floor-1;
  for(let n=r.from_floor;n<=want&&minSeconds(r.from_floor,n)<=seconds;n++)allowed=n;
  const top=Math.max(allowed,r.top_floor);r.status='done';r.finished_at=c.iso;r.capped=top<requested;r.summary=a.p_summary&&typeof a.p_summary==='object'&&!Array.isArray(a.p_summary)&&JSON.stringify(a.p_summary).length<=4096?a.p_summary:null;
  const result={ok:true,capped:r.capped,from:r.from_floor,...await record(c,r,top)}; if(r.growth){r.finish_receipt=result;await c.put('spire_runs',r);} return result;
}
