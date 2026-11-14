// Direct hard rewards keep the existing formulas, but draw in the browser.
// New rewards use the normal campaign receipt/cursor flow. Existing pending
// mail entitlements retain their original recovery path without conversion.
import {context,denied,failure} from '../../server/common.mjs';
import {growth,growthWallet,growthView} from '../../server/growth.mjs';
import * as H from '../data/hero-growth.js';
import {HARD_STAGES,cleanHard,hardReward} from '../data/hard.js';
import {mailItemsResult} from './direct-mail-items.js';
import {hardNormal,hardNormalId,hardSummary} from './direct-hard-normal.js';
const validInt=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const view=(r,w)=>({ok:true,xp:r.xp,completed:r.completed,win:r.won,hardSaved:!!r.hardSaved,hardReward:r.reward||null,growth:growthView(w),...(r.directReward&&!r.hardSaved?r.directReward.method==='normal'?{directLoot:true}:{directPending:r.directReward.mail}:{})});
export async function directHard(store,user,name,a,options){
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  if(!/^[a-zA-Z0-9-]{8,80}$/.test(a.p_token||''))return {data:failure('invalid'),error:null};
  const r=await c.get('growth_runs',c.uid+'~'+a.p_token),s=r&&HARD_STAGES[r.stage];
  if(name==='growth_progress'&&!s)return {data:await growth(c,'progress',a),error:null};
  if(!s)denied('hard run required');
  const w=await growthWallet(c);
  if(name==='hard_settle'||name==='hard_loot')return {data:await hardNormal(c,r,name,a),error:null};
  if(name==='hard_mail'){
   if(r.directReward?.method==='normal')denied('normal reward has no mail');
   if(!r.done||!r.directReward)denied('pending hard receipt required');
   const z=r.directReward,old=await c.get('mail',z.mail);
   if(old)return {data:{ok:true,id:z.mail},error:null};
   const reward=hardReward(s,r.completed,r.won,z.first,r.hero,c.random,r.won&&!z.first&&r.repeat?r.target:null,z.version);
   await c.insert('mail',{id:z.mail,user_id:c.uid,title:s.no+' 원정 보상',body:'',reward,claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null});
   return {data:{ok:true,id:z.mail},error:null};
  }
  if(name==='hard_finalize'){
   if(r.hardSaved)return {data:view(r,w),error:null};
   if(!r.done||!r.directReward)denied('pending hard receipt required');
   const z=r.directReward;
   if(z.method==='normal'){
    const receipt=await c.get('growth_investments',hardNormalId(c.uid,r.token));
    if(!receipt||receipt.status!=='done'||receipt.result.next!==z.total)denied('incomplete hard grant');
    r.hardSaved=true;r.reward=hardSummary(receipt.result);await c.put('growth_runs',r);
    return {data:view(r,w),error:null};
   }
   const m=await c.get('mail',z.mail);
   if(!m?.claimed||!m.server_applied||m.revoked)denied('unpaid hard receipt');
   const loot=await mailItemsResult(c,m),p=await c.get('progress',c.uid);
   if(loot.length!==z.total||!p)denied('incomplete hard grant');
   if(z.souls||z.total||r.kills){
    const b=p.data.stats||{};
    p.data.stats={...b,runs:(b.runs||0)+1,kills:(b.kills||0)+(r.kills||0),waves:(b.waves||0)+r.completed,souls:(b.souls||0)+z.souls};
    p.data.hardRewardSeq=(p.data.hardRewardSeq||0)+1;
   }
   p.updated_at=new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString();
   r.hardSaved=true;r.reward={souls:z.souls,chests:loot.filter(x=>x.chest).length,steel:loot.reduce((n,x)=>n+(x.y?.steel||0),0),crystal:loot.reduce((n,x)=>n+(x.y?.crystal||0),0)};
   await c.put('progress',p);await c.put('growth_runs',r);
   return {data:view(r,w),error:null};
  }
  if(name!=='growth_progress')denied('invalid hard operation');
  if(r.done)return {data:{...view(r,w),already:true},error:null};
  if(!validInt(a.p_completed,9999)||typeof a.p_win!=='boolean'||typeof a.p_finish!=='boolean'||a.p_kills!==undefined&&!validInt(a.p_kills,1000000)||a.p_completed>s.waves||a.p_win&&a.p_completed!==s.waves)return {data:failure('invalid'),error:null};
  if((c.now-Date.parse(r.started_at))/1000<a.p_completed*2)return {data:failure('too_fast'),error:null};
  const completed=Math.max(r.completed,a.p_completed),win=r.won||a.p_win;
  let xp=H.campaignXP(s,completed,win,false);
  if(win&&!w.first.includes(r.stage)){xp=H.campaignXP(s,completed,true,true);w.first.push(r.stage);r.firstBonus=xp-H.campaignXP(s,completed,true,false);}else xp+=r.firstBonus||0;
  H.credit(w,Math.max(0,xp-r.xp));Object.assign(r,{completed,won:win,xp,done:a.p_finish||win,updated_at:c.iso,kills:Math.max(r.kills||0,a.p_kills||0)});
  if(r.done){
   w.hard=cleanHard(w.hard);const first=!w.hard.st[s.id],stars=win&&validInt(a.p_stars,3)&&a.p_stars>=1?a.p_stars:win?1:0;
   if(win)w.hard.st[s.id]=Math.max(w.hard.st[s.id]||0,stars);
   const version=r.repeat&&a.p_finish?r.hardRewardVersion:1;
   const reward=hardReward(s,completed,win,first,r.hero,()=>.5,win&&!first&&r.repeat?r.target:null,version);
   r.directReward={method:'normal',first,stars,version:version||1,souls:reward.souls,total:reward.items?.length||0};
   r.hardSaved=false;w.rev++;
  }
  await c.put('growth_wallet',w);await c.put('growth_runs',r);
  return {data:view(r,w),error:null};
 });
}
