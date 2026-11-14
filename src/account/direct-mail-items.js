import {context,denied,validReward} from '../../server/common.mjs';
import * as E from './equip.js';
import {seeded} from './rewarditems.js';
import {isHidden,DEFAULT_HERO} from '../data/heroes.js';
import {reservedItemIds} from './direct-drops.js';
import {packTypedItem,unpackGearItem} from './direct-gear.js';
import {mailCapacity} from './direct-mail-capacity.js';

export const mailItemId=(uid,mail,index)=>uid+'~mailitem~'+mail+'~'+index;
export function checkMailReward(reward){if(!validReward(reward))throw Object.assign(Error('Invalid trusted mail reward; reconciliation required'),{code:'DIRECT_INVALID_MAIL'});}
// A bounded per-item grant avoids Firestore Rules' expression/write limits for
// ten-item legacy mail. Each item+receipt is atomic; the final claimed flag and
// currency commit require every receipt. Pending mail is retried by the existing
// account journal, never by generating a new entitlement.
export async function grantMailItems(store,user,args,options){
 const mail=await store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();const m=await c.get('mail',args.p_mail_id);
  if(!m||m.user_id!==c.uid||m.revoked&&!m.claimed)denied('mail unavailable');
  if(!m.claimed)checkMailReward(m.reward);return m;
 });
 if(mail.claimed)return;
 const items=mail.reward?.items||[];
 for(let index=0;index<items.length;index++){
  const deferred=await store.transaction(async tx=>{
  const c=await context(tx,user,options);c.requirePlayer();const m=await c.get('mail',args.p_mail_id);
  if(!m||m.user_id!==c.uid||m.revoked)denied('mail unavailable');checkMailReward(m.reward);
  const id=mailItemId(c.uid,m.id,index),prior=await c.get('growth_investments',id);
  if(prior)return;
  if(m.claimed||JSON.stringify(m.reward)!==JSON.stringify(mail.reward))denied('mail changed');
  const spec=items[index],p=await c.get('progress',c.uid);if(!p)denied('missing save');
   const wallet=await c.get('dungeon_wallet',c.uid),capacity=mailCapacity(p.data,m.reward,index,wallet?.earned||0);
   if(!capacity.ok)return capacity;
  const save=structuredClone(p.data),it=E.makeItem(spec.s,spec.s==='weapon'?(isHidden(spec.h)?DEFAULT_HERO:spec.h):undefined,spec.g,seeded(`${m.id}:${index}`),spec.set||spec.c);
  // Compact, account-scoped ID survives cleanItem's 16-character limit, including
  // legacy numeric mail IDs near MAX_SAFE_INTEGER. Never collide with chests.
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id));
  it.id='m'+Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('').slice(0,15);
  const reserved=reservedItemIds(save);
  for(let n=0;reserved.has(it.id);n++){if(n===32)denied('item ID collision');it.id=c.uuid().replaceAll('-','').slice(0,16);}
  delete it.u;const u=E.legendKey(it);if(u)it.u=u;
  const [entry]=E.addChests(save,[{it,src:'chest'}]);
  const typed=packTypedItem(it),result={action:'mail_item',mail:m.id,index,it:typed,entry:{...entry,it:typed}};
  await c.put('progress',{...p,data:save,updated_at:new Date(Math.max(c.now,Date.parse(p.updated_at)+1)).toISOString()});
   for(const part of ['steel','crystal']){
    const budget=c.uid+'~mailbudget~'+m.id+'~'+index+'~'+part;
    await c.put('growth_investments',{id:budget,user_id:c.uid,body:'mail-capacity-v1',at:c.iso,result:{action:'mail_budget',mail:m.id,index,part}});
   }
  await c.put('growth_investments',{id,user_id:c.uid,body:JSON.stringify(spec),at:c.iso,result});
  });
  if(deferred)return deferred;
 }
}
export async function mailItemsResult(c,m){
 const out=[];
 for(let i=0;i<(m.reward?.items?.length||0);i++){
  const row=await c.get('growth_investments',mailItemId(c.uid,m.id,i));
  if(row?.result?.entry)out.push({...row.result.entry,it:unpackGearItem(row.result.entry.it)});
 }
 return out;
}
