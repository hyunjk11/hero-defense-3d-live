import {challengeId,challengeView} from './direct-challenge.js';
// Normal campaign settlement. Currency/progression and recoverable chest
// entitlements commit once; each chest has a monotonic, acknowledged cursor.
// This preserves v34's CLIENT draw, not proof of fair randomness or combat.
import {context,denied} from '../../server/common.mjs';
import {STAGES,stageReward,stageUnlocked,STAR_STEP} from '../data/stages.js';
import {waveBoss} from '../core/roster.js';
import {reward,stageTier} from './progress.js';
import * as E from './equip.js';
import {seeded} from './rewarditems.js';
import {targetGear} from '../data/repeat-target.js';
import {packTypedItem,unpackGearItem} from './direct-gear.js';
import {normalDropsValid,validNormalDrop,reservedItemIds} from './direct-drops.js';
const fail=()=>{throw Object.assign(new Error('Invalid normal settlement'),{code:'INVALID_ARGUMENT'});};
const rid=(uid,token)=>uid+'~normal~'+token;
async function digest(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
export function normalInput(a){
 if(!a||Object.keys(a).some(k=>!['p_token','p_wave','p_kills','p_stars','p_drops'].includes(k))||
 !/^[A-Za-z0-9_-]{8,64}$/.test(a.p_token||'')||!Number.isInteger(a.p_wave)||a.p_wave<0||a.p_wave>50||
 !Number.isInteger(a.p_kills)||a.p_kills<0||a.p_kills>1000000||!Number.isInteger(a.p_stars)||a.p_stars<0||a.p_stars>3||
 !Array.isArray(a.p_drops)||a.p_drops.length>10)fail();
 // Shape conversion is followed by contextual validation before any grant.
 const drops=a.p_drops.map(packTypedItem);
 if(JSON.stringify(drops).length>12000)fail();
 return {wave:a.p_wave,kills:a.p_kills,stars:a.p_stars,drops};
}
export function normalPlan(save,run,input){
 const s=STAGES[run.stage];
 if(input.wave===0&&input.kills!==0)denied('zero-wave kills');
 if(!s||run.mode!=='campaign'||!run.done||input.wave>s.waves||input.wave>run.completed+1||
 (run.won?(input.wave!==s.waves||run.completed!==s.waves||input.stars<1):input.stars!==0)||
 input.drops.length>Array.from({length:input.wave},(_,i)=>i+1).filter(n=>waveBoss(s,n)).length)denied('finished normal run required');
 if(!normalDropsValid(input.drops,s.ch,run.hero,save))denied('invalid contextual drop');
 const next=structuredClone(save),prev=save.st?.[s.id]||0,first=run.won&&!prev;
 const souls=reward(input.wave,input.kills)+(run.won?stageReward(s.id,first):0);
 const starFrom=save.starRw||0;
 if(run.won){next.st={...save.st,[s.id]:Math.max(prev,input.stars)};
  const old=save.hq?.[run.hero]||{};next.hq={...save.hq,[run.hero]:{...old,clr:(old.clr||0)+1,boss:(old.boss||0)+(s.boss?1:0)}};
  next.starRw=Math.max(starFrom,Math.floor(Object.values(next.st).reduce((n,v)=>n+v,0)/STAR_STEP));}
 next.souls=(save.souls||0)+souls;next.stats={...save.stats,runs:(save.stats?.runs||0)+1,kills:(save.stats?.kills||0)+input.kills,waves:(save.stats?.waves||0)+input.wave,souls:(save.stats?.souls||0)+souls};
 const base=Math.floor(input.wave/5),starTo=next.starRw||0,total=base+input.drops.length+(first?1:0)+starTo-starFrom;
 const unlocked=run.won?Object.keys(STAGES).filter(id=>!stageUnlocked(save,id)&&stageUnlocked(next,id)):[];
 return {save:next,result:{ok:true,stage:s.id,hero:run.hero,ch:s.ch,wave:input.wave,kills:input.kills,won:run.won,stars:input.stars,prev,first,souls,base,starFrom,starTo,total,next:0,loot:[],drops:input.drops,unlocked}};
}
export function normalChest(result,run,index,random){
 const s=STAGES[result.stage];let it,src;
 if(index<result.base){src='chest';it=E.randomItem(run.hero,E.chestOdds(index+1),random,undefined,s.ch);
  const t=run.won&&run.repeat&&index===0&&targetGear(run.target);
  if(t){const id=it.id;it=E.makeItem(t.s,t.h,it.g,seeded('repeat:'+id),s.ch);it.id=id;}}
 else if(index<result.base+result.drops.length){src='boss';it=unpackGearItem(result.drops[index-result.base]);}
 else if(result.first&&index===result.base+result.drops.length){src='stage';it=E.randomItem(run.hero,E.chestOdds(stageTier(s)),random,undefined,s.ch);}
 else {src='star';const n=result.starFrom+1+index-result.base-result.drops.length-(result.first?1:0);it=E.randomItem(run.hero,E.chestOdds(2+n),random,undefined,s.ch);}
 return {it,src};
}
export async function directNormal(store,user,name,args,options){
 let dropRefs=[],dropManifest='';
 if(name==='normal_settle'&&args.p_drops?.length){
  const input=normalInput(args),body=JSON.stringify(input);
  const ready=await store.transaction(async tx=>{
   const c=await context(tx,user,options);c.requirePlayer();
   const prior=await c.get('growth_investments',rid(c.uid,args.p_token));
   if(prior){if(prior.body!==body)denied('request ID reused');return {prior};}
   const run=await c.get('growth_runs',c.uid+'~'+args.p_token),p=await c.get('progress',c.uid);
   if(!run||!p)denied('missing run or save');normalPlan(p.data,run,input);return {};
  });
  if(ready.prior)return {data:{...ready.prior.result,already:true},error:null};
  // Rules can validate at most 1,000 expressions in one write. Validate each
  // immutable item separately, without granting assets; settlement checks these
  // exact receipts in its atomic currency/progression commit. A lost preflight
  // response is safe to reconcile by the immutable, bounded per-run slot.
  for(const [index,drop] of input.drops.entries()){
   const text=JSON.stringify(drop),ref=await digest(text);
   await store.transaction(async tx=>{
    const c=await context(tx,user,options);c.requirePlayer();
    const id=c.uid+'~drop~'+args.p_token+'~'+index,prior=await c.get('growth_investments',id);
    if(prior){if(prior.body!==text)denied('drop receipt mismatch');return;}
    await c.put('growth_investments',{id,user_id:c.uid,body:text,at:c.iso,result:{ok:true,action:'normal_drop',token:args.p_token,drop,ref,index}});
   });
   dropRefs.push(ref);
  }
  if(input.drops.length){
   dropManifest=await digest(JSON.stringify({drops:input.drops,refs:dropRefs}));
   await store.transaction(async tx=>{
    const c=await context(tx,user,options);c.requirePlayer();const id=c.uid+'~drops~'+args.p_token;
    const prior=await c.get('growth_investments',id);if(prior){if(prior.body!==dropManifest)denied('manifest receipt mismatch');return;}
    await c.put('growth_investments',{id,user_id:c.uid,body:dropManifest,at:c.iso,result:{ok:true,action:'normal_manifest',token:args.p_token,drops:input.drops,refs:dropRefs,ref:dropManifest}});
   });
  }
 }
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  if(name==='normal_pending'){if(Object.keys(args).length)fail();const pending=await c.list('growth_investments',{action:'normal_settle',status:'pending'});const challenge=await c.list('growth_investments',{action:'challenge_settle',status:'pending'});const hard=await c.list('growth_runs',{status:'direct-hard-pending'});return {data:[...challenge.map(r=>challengeView(r.result)),...pending.map(r=>({token:r.token,...r.result})),...hard.filter(r=>r.done&&!r.hardSaved&&r.directReward).map(r=>({kind:'hard',token:r.token,completed:r.completed,win:r.won,stars:r.directReward.stars,kills:r.kills||0}))],error:null};}
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(args.p_token||''))fail();
  const id=rid(c.uid,args.p_token),prior=await c.get('growth_investments',id);
  if(name==='normal_status'){
   if(Object.keys(args).length!==1)fail();
   if(prior)return {data:prior.result,error:null};
   const challenge=await c.get('growth_investments',challengeId(c.uid,args.p_token));if(challenge)return {data:challengeView(challenge.result),error:null};
   // A durable guard can outlive its local journal, including a lost final
   // acknowledgement. Resolve that exact owned run, never a new entitlement.
   const run=await c.get('growth_runs',c.uid+'~'+args.p_token);
   if(!run?.done||!run.directReward)fail();
   return {data:{kind:'hard',token:run.token,completed:run.completed,win:run.won,stars:run.directReward.stars,kills:run.kills||0,hardSaved:run.hardSaved===true},error:null};
  }
  if(name==='normal_settle'){
   const input=normalInput(args),body=JSON.stringify(input);
   if(prior){if(prior.body!==body)denied('request ID reused');return {data:{...prior.result,already:true},error:null};}
   if(await c.get('growth_investments',c.uid+'~gear~run-'+args.p_token))denied('run already settled');
   const run=await c.get('growth_runs',c.uid+'~'+args.p_token);if(!run)denied('missing run');
   const p=await c.get('progress',c.uid);if(!p)denied('missing save');
   const {save,result}=normalPlan(p.data,run,input);result.dropManifest=dropManifest;
   await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
   await c.put('growth_investments',{id,user_id:c.uid,body,at:c.iso,action:'normal_settle',status:result.total?'pending':'done',token:args.p_token,result});
   return {data:result,error:null};
  }
  if(name!=='normal_loot'||Object.keys(args).some(k=>!['p_token','p_index'].includes(k))||!Number.isInteger(args.p_index)||args.p_index<0||!prior)fail();
  const i=args.p_index;if(i<prior.result.next)return {data:{...prior.result,already:true},error:null};
  if(i!==prior.result.next||i>=prior.result.total)denied('loot cursor mismatch');
  const run=await c.get('growth_runs',c.uid+'~'+args.p_token),p=await c.get('progress',c.uid),save=structuredClone(p.data);
   const dropIndex=i-prior.result.base,drop=prior.result.drops[dropIndex];
   if(dropIndex>=0&&dropIndex<prior.result.drops.length&&(!validNormalDrop(drop,prior.result.ch,prior.result.hero)||reservedItemIds(save).has(drop.id))){
     // Recovery for a previously sealed, unpayable entry. Advance exactly this
     // cursor with no currency, item or codex change; immutable prior grants stay.
     const skipped={src:'boss',skipped:true,reason:'invalid_drop'};
     const result={...prior.result,next:i+1,loot:[...prior.result.loot,skipped],last:skipped};
     await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
     await c.put('growth_investments',{...prior,result,status:result.next===result.total?'done':'pending'});
     return {data:result,error:null};
   }
  const chest=normalChest(prior.result,run,i,c.random);
  // cleanItem/cleanEquip retain at most 16 characters. A longer identifier would
  // be shortened in the town UI and no longer address its stored chest.
   if(chest.src!=='boss'){
     const reserved=reservedItemIds(save);for(const it of prior.result.drops)reserved.add(it.id);
     for(let n=0;n<32;n++){chest.it.id=c.uuid().replaceAll('-','').slice(0,16);if(!reserved.has(chest.it.id))break;if(n===31)denied('item ID collision');}
   }
  const [entry]=E.addChests(save,[chest]);
  const result={...prior.result,next:i+1,loot:[...prior.result.loot,entry]};
  // Rules need the item even when capacity automatically dismantles it.
  result.last={it:packTypedItem(chest.it),src:chest.src};
  await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
  await c.put('growth_investments',{...prior,result,status:result.next===result.total?'done':'pending'});
  return {data:result,error:null};
 });
}
