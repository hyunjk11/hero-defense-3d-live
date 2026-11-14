// Challenge rewards keep bounded immutable item receipts rather than growing a
// single loot document. This preserves client draws, not proof of fair combat.
import {context,denied} from '../../server/common.mjs';
import {reward,openChapters} from './progress.js';
import * as E from './equip.js';
import {CHAL_ESS} from '../data/items.js';
import {packTypedItem,unpackGearItem} from './direct-gear.js';
import {validNormalDrop,reservedItemIds} from './direct-drops.js';
const fail=()=>{throw Object.assign(new Error('Invalid challenge settlement'),{code:'INVALID_ARGUMENT'});};
export const challengeId=(uid,token)=>uid+'~challenge~'+token;
const dropId=(uid,token,i)=>uid+'~challenge-drop~'+token+'~'+i;
const lootId=(uid,token,i)=>uid+'~challenge-loot~'+token+'~'+i;
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export function challengeInput(a){
 if(!a||Object.keys(a).some(k=>!['p_token','p_wave','p_kills','p_stars','p_drops','p_bossKills'].includes(k))||
 !/^[A-Za-z0-9_-]{8,64}$/.test(a.p_token||'')||!Number.isInteger(a.p_wave)||a.p_wave<0||a.p_wave>10000||
 !Number.isInteger(a.p_kills)||a.p_kills<0||a.p_kills>1e9||a.p_stars!==0||!Array.isArray(a.p_drops)||a.p_drops.length>Math.floor(a.p_wave/5)||
 !Array.isArray(a.p_bossKills)||a.p_bossKills.length>Math.floor(a.p_wave/5)||a.p_bossKills.some((n,i)=>!Number.isInteger(n)||n<=0||n%5!==0||n>a.p_wave||(i>0&&n<=a.p_bossKills[i-1]))||a.p_drops.length>a.p_bossKills.length)fail();
 const drops=a.p_drops.map(packTypedItem);
 return {wave:a.p_wave,kills:a.p_kills,bosses:a.p_bossKills.length,trials:a.p_bossKills.slice(0,999).filter(n=>n>=CHAL_ESS.wave).length,drops};
}
export function challengePlan(save,run,input,random){
 if(run.mode!=='challenge'||!run.done||run.won||input.wave<run.completed||input.wave>run.completed+1||
 input.bosses>Math.floor(input.wave/5)||(input.wave===0&&input.kills!==0))denied('finished challenge required');
 const open=openChapters(save),ids=reservedItemIds(save);
 for(const it of input.drops){if(!open.includes(it.c)||!validNormalDrop(it,it.c,run.hero)||ids.has(it.id))denied('invalid challenge drop');ids.add(it.id);}
 let essence=0;for(let i=0;i<input.trials;i++)if(random()<CHAL_ESS.chance)essence++;
 const next=structuredClone(save),souls=reward(input.wave,input.kills),best=input.wave>(save.bestWave||0);
 next.bestWave=Math.max(save.bestWave||0,input.wave);next.souls=(save.souls||0)+souls;
 next.stats={...save.stats,runs:(save.stats?.runs||0)+1,kills:(save.stats?.kills||0)+input.kills,waves:(save.stats?.waves||0)+input.wave,souls:(save.stats?.souls||0)+souls};
 if(essence)next.mat={...save.mat,essence:(save.mat?.essence||0)+essence};
 return {save:next,result:{ok:true,kind:'challenge',token:run.token,hero:run.hero,wave:input.wave,kills:input.kills,bosses:input.bosses,trials:input.trials,unlock:structuredClone(save.st||{}),dropNext:input.drops[0]?.id||'',lastDrop:input.drops.at(-1)?.id||'',souls,essence,best,bestWave:next.bestWave,
  base:Math.floor(input.wave/5),drops:input.drops.length,total:Math.floor(input.wave/5)+input.drops.length,next:0,stored:0,dismantled:0}};
}
// Existing result/town views only need counts and essence. Full per-item audit
// remains in immutable loot receipts and actual unopened chests, not this array.
export function challengeView(result){return {...result,loot:[...Array.from({length:result.stored},()=>({chest:true})),...(result.essence?[{src:'essence',essence:result.essence}]:[])]};}
export async function directChallenge(store,user,name,args,options){
 if(!/^[A-Za-z0-9_-]{8,64}$/.test(args.p_token||''))fail();
 let input,body;
 if(name==='challenge_settle'){
  input=challengeInput(args);body=await digest(JSON.stringify(input));
  const prior=await store.transaction(async tx=>{const c=await context(tx,user,options);c.requirePlayer();const old=await c.get('growth_investments',challengeId(c.uid,args.p_token));
   if(old){if(old.body!==body)denied('request ID reused');return old;}
   const run=await c.get('growth_runs',c.uid+'~'+args.p_token),p=await c.get('progress',c.uid);if(!run||!p)denied('missing run or save');
   challengePlan(p.data,run,input,()=>1);return null;});
  if(prior)return {data:{...challengeView(prior.result),already:true},error:null};
  // Validate the entire client packet first. Only bounded, asset-free immutable
  // preflights are stored; no partial currency/progression grant precedes them.
  for(const [index,drop] of input.drops.entries())await store.transaction(async tx=>{
   const c=await context(tx,user,options);c.requirePlayer();const id=dropId(c.uid,args.p_token,drop.id),old=await c.get('growth_investments',id);
   if(old){if(old.body!==body)denied('drop receipt mismatch');return;}
      await c.put('growth_investments',{id,user_id:c.uid,body,at:c.iso,result:{action:'challenge_drop',token:args.p_token,index,total:input.drops.length,prev:input.drops[index-1]?.id||'',next:input.drops[index+1]?.id||'',drop}});
  });
 }
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();const id=challengeId(c.uid,args.p_token),prior=await c.get('growth_investments',id);
  if(name==='challenge_settle'){
   if(prior){if(prior.body!==body)denied('request ID reused');return {data:{...challengeView(prior.result),already:true},error:null};}
   const run=await c.get('growth_runs',c.uid+'~'+args.p_token),p=await c.get('progress',c.uid);if(!run||!p)denied('missing run or save');
   const {save,result}=challengePlan(p.data,run,input,c.random);
   await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
   await c.put('growth_investments',{id,user_id:c.uid,body,at:c.iso,action:'challenge_settle',status:result.total?'pending':'done',token:args.p_token,result});
   return {data:challengeView(result),error:null};
  }
  if(name!=='challenge_loot'||Object.keys(args).some(k=>!['p_token','p_index'].includes(k))||!Number.isInteger(args.p_index)||args.p_index<0||!prior)fail();
  const i=args.p_index,z=prior.result;if(i<z.next)return {data:{...challengeView(z),already:true},error:null};
  if(i!==z.next||i>=z.total)denied('loot cursor mismatch');
  const p=await c.get('progress',c.uid),save=structuredClone(p.data),reserved=reservedItemIds(save),src=i<z.base?'chest':'boss';let it,nextDrop=z.dropNext;
  if(src==='boss'){const d=await c.get('growth_investments',dropId(c.uid,args.p_token,z.dropNext));if(!d||d.body!==prior.body)denied('missing validated drop');it=unpackGearItem(d.result.drop);nextDrop=d.result.next;}
  else it=E.randomItem(z.hero,E.chestOdds(i+1),c.random,undefined,openChapters({st:z.unlock}));
  // Preserve a boss ID unless another device acquired the same ID after the
  // asset-free preflight. Re-identify that new unowned reward, never overwrite.
  if(src==='chest'||reserved.has(it.id))for(let n=0;n<32;n++){it.id=c.uuid().replaceAll('-','').slice(0,16);if(!reserved.has(it.id))break;if(n===31)denied('item ID collision');}
  const [entry]=E.addChests(save,[{it,src}]),result={...z,next:i+1,dropNext:nextDrop,stored:z.stored+(entry.chest?1:0),dismantled:z.dismantled+(entry.auto?1:0)};
  await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
  await c.put('growth_investments',{id:lootId(c.uid,args.p_token,i),user_id:c.uid,body:'',at:c.iso,result:{action:'challenge_loot',token:args.p_token,index:i,it:packTypedItem(it),src,entry:{...entry,it:packTypedItem(it)}}});
  await c.put('growth_investments',{...prior,result,status:result.next===result.total?'done':'pending'});
  return {data:challengeView(result),error:null};
 });
}
