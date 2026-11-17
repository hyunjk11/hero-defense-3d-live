// Fresh Functions namespace only. Legacy Worker APIs remain unchanged.
import {runOperation} from './operations.mjs';
import {context,denied,paidHeroes,validReward} from './common.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {packSave} from '../src/account/storage.js';
import {stable} from '../src/account/direct-authority.js';
import {directGear} from '../src/account/direct-economy.js';
import {directDungeonBuy} from '../src/account/direct-dungeon-shop.js';
import {directSpireStart} from '../src/account/direct-spire-start.js';
import {settleNormal} from './normal-economy.mjs';
import {assertItemIdentity,assertRewardIdentity,balanceLimits} from './economy-invariants.mjs';
import {gearBatch} from './gear-batch.mjs';
const cosmetics=new Set(['hero','settings','nick','growth']);
export const economicState=s=>Object.fromEntries(Object.entries(P.clean(s)).filter(([k])=>!cosmetics.has(k)));
const stamp=(now,old)=>new Date(Math.max(now,(Date.parse(old)||0)+1)).toISOString();
const ownHero=async(c,h)=>!paidHeroes.includes(h)||!!await c.get('owned',c.uid+'~hero_'+h);
// Pure domain actions expect unpacked saves. Persist only the canonical existing
// save format; the transport/database namespace and transactions remain intact.
export function economyStore(store,{rejectBalanceTruncation=false}={}){
 const adapt=tx=>({
  ...(tx.mailWindow?{mailWindow:(filter,options)=>tx.mailWindow(filter,options)}:{}),
  get:async(t,id)=>{const r=await tx.get(t,id);return t==='hd3d_progress'&&r?{...r,data:P.clean(r.data)}:r;},
  list:async(t,f)=>{const rows=await tx.list(t,f);return t==='hd3d_progress'?rows.map(r=>({...r,data:P.clean(r.data)})):rows;},
  put:async(t,r)=>{if(t==='hd3d_progress'){
   assertItemIdentity(r.data);const limits=rejectBalanceTruncation?balanceLimits(r.data):[];
   if(limits.length)throw Object.assign(new Error('Currency capacity exceeded'),{code:'BALANCE_LIMIT',limits});
  }return tx.put(t,t==='hd3d_progress'?{...r,data:packSave(P.clean(r.data))}:r);},
  insert:(t,r)=>tx.insert(t,r),remove:(t,id)=>tx.remove(t,id)
 });
 return {userSyncScope:store.userSyncScope||store,timing:store.timing,transaction:(fn,o)=>store.transaction(tx=>fn(adapt(tx)),o),
  ...(store.readOnly?{readOnly:(fn,docs)=>store.readOnly(tx=>fn(adapt(tx)),docs)}:{})};
}
async function saveProgress(store,user,op,options){
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();
  const v=op.values,f=op.filters||{},insert=op.action==='insert';
  if((insert?v?.user_id:f.user_id)!==c.uid)denied('save owner mismatch');
  if(!['insert','update'].includes(op.action)||!v||Object.keys(v).some(k=>!(insert?['user_id','data','merged']:['data','merged']).includes(k))||
    Object.keys(f).some(k=>!['user_id','updated_at'].includes(k))||(insert?v.user_id:f.user_id)!==c.uid||v.merged!==true||!v.data||Array.isArray(v.data)||typeof v.data!=='object'||new TextEncoder().encode(JSON.stringify(v.data)).length>=65536)denied('invalid save','23514');
  const old=await c.get('progress',c.uid);
  if(insert&&old)denied('save already exists','23505');
  if(!insert&&(!old||typeof f.updated_at!=='string'||f.updated_at!==old.updated_at))return {data:[],error:null};
  const before=P.clean(old?.data||P.empty()),after=P.clean(v.data);
  // Old clients do not know these server-owned preferences. Omission is not deletion.
  for(const k of ['lockedGear','battlePresets','battlePartner'])if(!Object.hasOwn(v.data,k)&&Object.hasOwn(before,k))after[k]=structuredClone(before[k]);
  const wanted=stable(economicState(after));
  // Growth cache is never an authority supplied by the caller.
  if(before.growth)after.growth=before.growth;else delete after.growth;
  let allowed=wanted===stable(economicState(before));
  // Debounced/offline UI may batch several clicks. Recompute every increment,
  // ownership, cap and cumulative price; no arbitrary net currency delta passes.
  if(!insert&&!allowed){
   let predicted=before,valid=true;
   for(const hero of ['mage','archer','warrior','gunner','fighter'])for(const stat of ['hp','atk']){
    const increments=after.heroLv[hero][stat]-before.heroLv[hero][stat];
    if(increments<0||increments>15||increments>0&&!await ownHero(c,hero)){valid=false;continue;}
    for(let i=0;i<increments;i++){const [next,ok]=P.buyPerm(predicted,hero,stat);if(!ok){valid=false;break;}predicted=next;}
   }
   allowed=valid&&stable(economicState(predicted))===wanted;
  }
  if(!allowed)denied('Use an authenticated economy action','ECONOMY_ACTION_REQUIRED');
  const row={user_id:c.uid,data:packSave(after),merged:true,created_at:old?.created_at||c.iso,updated_at:stamp(c.now,old?.updated_at)};
  await c.put('progress',row);
  return {data:op.returning?(op.single?row:[row]):null,error:null};
 });
}
async function claimMail(store,user,args,options){
 if(!Number.isSafeInteger(args.p_mail_id)||args.p_mail_id<=0||Object.keys(args).some(k=>k!=='p_mail_id'))denied('invalid mail','23514');
 return store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();const m=await c.get('mail',args.p_mail_id);
  if(!m||m.user_id!==c.uid||m.revoked&&!m.claimed)denied('mail unavailable');
  if(m.claimed)return {data:{ok:true,already:true,id:m.id,reward:null,serverSaved:true,got:m.serverLoot||[]},error:null};
  if(!validReward(m.reward))denied('invalid trusted reward');
  const p=await c.get('progress',c.uid);if(!p)denied('missing save');
  const [save,,got]=P.applyMail(p.data,m.id,m.reward||{});
  assertRewardIdentity(p.data,got);
  // Defer the whole trusted mail before any item, hero, medal or claimed write.
  // Derive current save caps from its canonical cleaner instead of assuming all
  // balances share the souls cap. Automatic dismantle yields count too.
  const limits=balanceLimits(save);
  const wallet=m.reward?.medals>0?await c.wallet():null;
  if(wallet&&(wallet.medals+m.reward.medals>1000000||!Number.isSafeInteger(wallet.earned+m.reward.medals)))limits.push('medals');
  if(limits.length)return {data:{ok:false,reason:'balance_limit',deferred:true,serverSaved:true,limits,got:[]},error:null};
  if(m.reward?.hero){const item='hero_'+m.reward.hero;if(!await c.get('owned',c.uid+'~'+item))await c.insert('owned',{user_id:c.uid,item,source_mail:m.id});}
  if(wallet){wallet.medals+=m.reward.medals;wallet.earned+=m.reward.medals;wallet.updated_at=c.iso;await c.put('dungeon_wallet',wallet);}
  await c.put('progress',{...p,data:save,updated_at:stamp(c.now,p.updated_at)});
  await c.put('mail',{...m,claimed:true,claimed_at:c.iso,server_applied:true,serverLoot:got||[]});
  return {data:{ok:true,id:m.id,reward:null,serverSaved:true,got:got||[]},error:null};
 });
}
export async function runEconomyOperation(rawStore,user,op,options={}){
 const store=economyStore(rawStore);
 if(op?.kind==='query'&&op.table==='hd3d_progress'&&op.action!=='select')return saveProgress(store,user,op,options);
 if(op?.kind==='rpc'){
  const name=op.name?.replace(/^hd3d_/,''),a=op.args||{};
  if(name==='gear_batch')return gearBatch(rawStore,economyStore,user,a,options);
  if(name==='gear_action'){
   if(a.p_action==='run_return')return settleNormal(store,user,'normal_settle',{p_token:a.p_item,p_wave:a.p_wave,p_kills:a.p_kills,p_stars:0,p_drops:[],p_bossKills:[]},options);
   try{return await directGear(economyStore(rawStore,{rejectBalanceTruncation:true}),user,a,options);}
   catch(e){
    // A confirmed atomic no-op lets the existing gear client clear its purchase
    // guard. No consumed item/receipt or unresolved payment is left behind.
    if(e.code==='BALANCE_LIMIT')return {data:{ok:false,reason:'balance_limit',limits:e.limits,serverSaved:true},error:null};
    throw e;
   }
  }
  if(name?.startsWith('normal_')||name?.startsWith('challenge_'))return settleNormal(store,user,name,a,options);
  if(name==='claim_mail')return claimMail(store,user,a,options);
  if(name==='dungeon_buy')return directDungeonBuy(store,user,a,options);
  if(name==='spire_start')return directSpireStart(store,user,a,options);
 }
 return runOperation(store,user,op,options);
}
