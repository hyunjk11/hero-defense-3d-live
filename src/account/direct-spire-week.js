// Weekly awards require an immutable trusted closed-week decision. A player's
// current ranking query is never accepted as proof that they ranked first.
import {context,shiftDay,failure,denied} from '../../server/common.mjs';
import {weeklyReward,weeklyTitle} from '../../server/spire.mjs';
export async function directSpireWeek(store,user,args,options){
 if(Object.keys(args).some(k=>k!=='p_week'))throw Object.assign(Error('Invalid weekly arguments'),{code:'INVALID_ARGUMENT'});
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  const wk=args.p_week??shiftDay(c.week,-7);if(!/^\d{4}-\d{2}-\d{2}$/.test(wk)||!Number.isFinite(Date.parse(wk))||new Date(wk+'T00:00:00Z').getUTCDay()!==1)return {data:failure('bad_week'),error:null};
  if(wk>=c.week)return {data:failure('not_ended'),error:null};
  const receiptId=c.uid+'~spclaim~'+wk,old=await c.get('growth_investments',receiptId);
  if(old)return {data:{...old.result,already:true},error:null};
  const w=await c.get('spire_weeks',c.uid+'~'+wk);if(!w||w.best_floor<=0)return {data:failure('no_record'),error:null};
  if(w.claimed)return {data:failure('claimed'),error:null};
  const grant=await c.get('growth_investments',c.uid+'~spaward~'+wk),a=grant?.result;
  if(!a)return {data:failure('rank_pending'),error:null};
  const reward=weeklyReward(w.best_floor);
  if(a.action!=='spire_week_award'||a.week!==wk||a.floor!==w.best_floor||a.souls!==reward.souls||a.medals!==reward.medals||a.title!==weeklyTitle(a.rank))denied('Weekly award mismatch');
  const last=wk===shiftDay(c.week,-7),title=last?a.title:null;
  await c.put('spire_weeks',{...w,claimed:true});
  const mail=await c.mail(c.uid,'🗼 무한의 탑 주간 보상',wk+' 주 최고 '+w.best_floor+'층',reward);
  if(last){const wallet=await c.wallet();wallet.titles=wallet.titles.filter(x=>!['spire_w1','spire_w10'].includes(x));if(title)wallet.titles.push(title);wallet.titles=[...new Set(wallet.titles)].sort();wallet.updated_at=c.iso;await c.put('dungeon_wallet',wallet);}
  const result={ok:true,action:'spire_claim_week',week:wk,best:w.best_floor,rank:a.rank,...reward,title,mail:mail.id};
  await c.put('growth_investments',{id:receiptId,user_id:c.uid,body:JSON.stringify({week:wk}),at:c.iso,result});
  return {data:result,error:null};
 });
}
