// Normal-style hard settlement: one durable currency/telemetry receipt and
// one atomic chest/cursor write per item. Draws remain client-side, as normal.
import {denied} from '../../server/common.mjs';
import {HARD_STAGES,hardReward} from '../data/hard.js';
import * as E from './equip.js';
import {packTypedItem} from './direct-gear.js';
import {reservedItemIds} from './direct-drops.js';
export const hardNormalId=(uid,token)=>uid+'~hard~'+token;
export function hardSummary(z){return {souls:z.souls,chests:z.loot.filter(x=>x.chest).length,steel:z.loot.reduce((n,x)=>n+(x.y?.steel||0),0),crystal:z.loot.reduce((n,x)=>n+(x.y?.crystal||0),0)};}
export async function hardNormal(c,run,name,a){
 const entitlement=run.directReward;
 if(!run.done||entitlement?.method!=='normal')denied('normal-style hard receipt required');
 const id=hardNormalId(c.uid,run.token),prior=await c.get('growth_investments',id);
 if(name==='hard_settle'){
  if(Object.keys(a).some(k=>k!=='p_token'))denied('invalid hard settlement');
  if(prior)return {...prior.result,already:true};
  const p=await c.get('progress',c.uid);if(!p)denied('missing save');
  const save=structuredClone(p.data),reward=hardReward(HARD_STAGES[run.stage],run.completed,run.won,entitlement.first,run.hero,c.random,run.won&&!entitlement.first&&run.repeat?run.target:null,entitlement.version);
  const specs=reward.items||[];
  if(reward.souls!==entitlement.souls||specs.length!==entitlement.total)denied('hard entitlement mismatch');
  // Fail before any grant when this sealed draw cannot fit currency/material
  // limits. This is a preflight only; Rules enforce every committed delta too.
  const auto=specs.slice(Math.max(0,200-(save.chests?.length||0)));
  if((save.souls||0)+reward.souls>1e9||(save.mat?.steel||0)+auto.reduce((n,x)=>n+E.dismantleYield({g:x.g,e:0}).steel,0)>1e9||(save.mat?.crystal||0)+auto.reduce((n,x)=>n+E.dismantleYield({g:x.g,e:0}).crystal,0)>1e9)return {ok:false,reason:'capacity',deferred:true};
  if(entitlement.souls||entitlement.total||run.kills){
   const b=save.stats||{};save.souls=(save.souls||0)+reward.souls;
   save.stats={...b,runs:(b.runs||0)+1,kills:(b.kills||0)+(run.kills||0),waves:(b.waves||0)+run.completed,souls:(b.souls||0)+reward.souls};
   save.hardRewardSeq=(save.hardRewardSeq||0)+1;
  }
  const result={ok:true,souls:reward.souls,total:specs.length,next:0,loot:[],specs};
  await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
  await c.put('growth_investments',{id,user_id:c.uid,body:run.token,at:c.iso,action:'hard_settle',status:result.total?'pending':'done',token:run.token,result});
  return result;
 }
 if(name!=='hard_loot'||Object.keys(a).some(k=>!['p_token','p_index'].includes(k))||!Number.isSafeInteger(a.p_index)||a.p_index<0||!prior)denied('invalid hard cursor');
 const i=a.p_index,z=prior.result;
 if(i<z.next)return {...z,already:true};
 if(i!==z.next||i>=z.total)denied('hard cursor mismatch');
 const p=await c.get('progress',c.uid),save=structuredClone(p.data),spec=z.specs[i],it=E.makeItem(spec.s,spec.h,spec.g,c.random,spec.c);
 const reserved=reservedItemIds(save);
 for(let n=0;n<32;n++){it.id=c.uuid().replaceAll('-','').slice(0,16);if(!reserved.has(it.id))break;if(n===31)denied('item ID collision');}
 const yieldAtCapacity=E.dismantleYield(it);
 if(save.chests.length>=200&&((save.mat?.steel||0)+yieldAtCapacity.steel>1e9||(save.mat?.crystal||0)+yieldAtCapacity.crystal>1e9))return {ok:false,reason:'capacity',deferred:true};
 const [entry]=E.addChests(save,[{it,src:'chest'}]);
 const result={...z,next:i+1,loot:[...z.loot,entry],last:{it:packTypedItem(it),src:'chest'}};
 await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
 await c.put('growth_investments',{...prior,result,status:result.next===result.total?'done':'pending'});
 return result;
}
