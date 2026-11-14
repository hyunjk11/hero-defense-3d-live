// Offline-only index construction from a complete, trusted legacy inventory.
// Never infer absence of pending orders from a client query or overwrite a guard.
import {encodeFields,DEMO_PROJECT,directDocument} from '../src/account/direct-store.js';
export function orderSupportDocuments(accounts,highWater){
 if(!Number.isSafeInteger(highWater)||highWater<0)throw Error('Trusted order high-water required');
 const root=`projects/${DEMO_PROJECT}/databases/(default)/documents`,documents=[{name:root+'/hd3d_live_order_counter/main',fields:encodeFields({value:highWater})}];
 for(const {uid,orders} of accounts){
  if(!/^[-A-Za-z0-9_]{1,128}$/.test(uid)||!Array.isArray(orders))throw Error('Invalid order account inventory');
  for(const item of ['hero_gunner','hero_mechanic','hero_fighter']){
   const pending=orders.filter(r=>r.item===item&&r.status==='pending');if(pending.length>1)throw Error('Multiple historical pending orders require review');
   for(const r of orders)if(r.user_id!==uid||!Number.isSafeInteger(r.id)||r.id<1||r.id>highWater||!['pending','approved','rejected','refunded'].includes(r.status)||!['hero_gunner','hero_mechanic','hero_fighter'].includes(r.item))throw Error('Invalid historical order');
   const id='order-pending-'+item;documents.push(directDocument(DEMO_PROJECT,uid,'hd3d_sequences',id,{id,value:pending[0]?.id||0}));
  }
 }
 return documents;
}
