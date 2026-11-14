import {context,shiftDay} from '../../server/common.mjs';
import {weeklyReward} from '../../server/spire.mjs';
// Private status uses only the caller's rows; rankings use the non-PII view.
// Weekly payout remains fail-closed until a trusted closed-week rank exists.
export async function directSpireStatus(store,user,options,rank){
 const state=await store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  const [runs,b,w,weeks]=await Promise.all([c.list('spire_runs',{user_id:c.uid}),c.get('spire_best',c.uid),c.get('dungeon_wallet',c.uid),c.list('spire_weeks',{user_id:c.uid})]);
  const best=b?.best_floor||0,used=runs.filter(x=>x.day===c.day).length;
  return {day:c.day,week:c.week,limit:30,used,left:Math.max(0,30-used),best,best_at:b?.best_at||null,cleared:b?.cleared_bosses||0,
   checkpoints:[1,...Array.from({length:Math.floor(best/5)},(_,i)=>(i+1)*5+1)],
   week_best:weeks.find(x=>x.week===c.week)?.best_floor||0,banned:false,active:runs.some(x=>x.status==='active'),
   unclaimed:await Promise.all(weeks.filter(x=>x.week<c.week&&!x.claimed&&x.best_floor>0).sort((a,b)=>b.week.localeCompare(a.week)).slice(0,8).map(async x=>{
    const grant=await c.get('growth_investments',c.uid+'~spaward~'+x.week),g=grant?.result;
    const confirmed=g?.action==='spire_week_award'&&g.week===x.week&&g.floor===x.best_floor;
    return {week:x.week,best:x.best_floor,rank:confirmed?g.rank:null,title:confirmed&&x.week===shiftDay(c.week,-7)?g.title:null,...weeklyReward(x.best_floor)};
   })),titles:(w?.titles||[]).filter(x=>x.startsWith('spire_')).sort()};
 });
 const current=(await rank({p_kind:'week',p_week:state.week})).data;
 state.week_rank=current.me?.rank||null;
 return {data:{ok:true,...state},error:null};
}
