import {unpackItem} from '../src/account/storpack.js';
import {denied} from './common.mjs';
import {clean} from '../src/account/progress.js';
export function balanceLimits(save){
 const canonical=clean(save),limits=[];
 if(canonical.souls!==save.souls)limits.push('souls');
 for(const k of ['steel','crystal','essence'])if((canonical.mat[k]||0)!==(save.mat[k]||0))limits.push(k);
 return limits;
}
// Check before clean/pack can silently discard a duplicate. The transaction
// rolls back the price, item and receipt together on a collision.
export function assertItemIdentity(save){
 const ids=new Set();
 for(const raw of [...(save.inv||[]),...(save.stor||[]),...(save.chests||[]).map(c=>c.it)]){
  const it=typeof raw==='string'?unpackItem(raw):raw;
  if(!it||typeof it.id!=='string'||ids.has(it.id))denied('Item identity collision','ITEM_ID_COLLISION');
  ids.add(it.id);
 }
}
// Inspect generated entitlements as well as the stored result: addChests treats
// a duplicate ID like overflow, so checking only the resulting save is too late.
export function assertRewardIdentity(before,loot){
 const ids=new Set([...(before.inv||[]),...(before.stor||[]),...(before.chests||[]).map(c=>c.it)].map(raw=>(typeof raw==='string'?unpackItem(raw):raw)?.id));
 for(const entry of loot||[]){
  if(!entry.it)continue;
  if(typeof entry.it.id!=='string'||ids.has(entry.it.id))denied('Reward identity collision','ITEM_ID_COLLISION');
  ids.add(entry.it.id);
 }
}
