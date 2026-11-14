// Customer purchase requests only. Does not approve payment or grant anything.
// Trusted migration supplies the global counter and legacy pending-item guards.
import {assertDirectConfig,encodeFields,decodeFields} from './direct-store.js';
const fail=code=>Object.assign(Error(code),{code});
export function createOrderTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID()}={}){
 const {root,endpoint}=assertDirectConfig(config);let busy=false;
 return async(q,user)=>{
  const item=q.values?.item;if(!q.values||Object.keys(q.values).join()!=='item'||!['hero_gunner','hero_mechanic','hero_fighter'].includes(item))throw fail('23514');
  const columns=q.columns&&q.columns!=='*'?q.columns.split(',').map(x=>x.trim()):null;if(columns?.some(x=>!/^[a-z_]+$/.test(x)))throw fail('23514');
  const present=row=>({data:q.returning?(q.single?(columns?Object.fromEntries(columns.map(k=>[k,row[k]??null])):row):[columns?Object.fromEntries(columns.map(k=>[k,row[k]??null])):row]):null,error:null});
  if(!storage||busy)throw fail('DIRECT_ORDER_PENDING');busy=true;let job,clear=false,snapshot,call;
  const key=(config.storagePrefix||'hd3d_live')+'_order_pending_'+user.uid,current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};
  try{
   current();const token=await user.getIdToken();current();
   call=async(p,b)=>{if(!p.endsWith(':rollback'))current();const r=await fetcher(endpoint+'/v1/'+root+p,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(b)});const v=await r.json();if(!p.endsWith(':rollback'))current();if(!r.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR'),{status:r.status,message:v.error?.message});return v;};
   const read=async paths=>{const ds=await call(':batchGet',{documents:paths.map(p=>root+'/'+p),...(snapshot?{transaction:snapshot}:{})});return paths.map(p=>ds.find(x=>x.found?.name===root+'/'+p)?.found||null);};
   try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ORDER_PENDING');}if(job&&job.uid!==user.uid)throw fail('DIRECT_ORDER_PENDING');
   // An unknown reply can leave the old item disabled by its now-pending order
   // in the shop. Confirm its immutable receipt before accepting another item;
   // never require another click on that disabled item or replay the old write.
   if(job&&job.item!==item){
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(job.request)||!['hero_gunner','hero_mechanic','hero_fighter'].includes(job.item))throw fail('DIRECT_ORDER_PENDING');
    const old=(await read(['hd3d_live_order_requests/'+user.uid+'~'+job.request]))[0],r=old?decodeFields(old.fields):null;
    if(!r||r.uid!==user.uid||r.request!==job.request||r.item!==job.item)throw fail('DIRECT_ORDER_PENDING');
    if(storage.getItem(key)!==JSON.stringify(job))throw fail('DIRECT_ORDER_PENDING');
    storage.removeItem(key);job=null;
   }
   if(!job)job={uid:user.uid,item,request:uuid()};if(!/^[A-Za-z0-9_-]{8,64}$/.test(job.request))throw fail('INVALID_REQUEST');storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');
   const receipt='hd3d_live_order_requests/'+user.uid+'~'+job.request,prior=(await read([receipt]))[0];if(prior){const r=decodeFields(prior.fields);if(r.item!==item)throw fail('REQUEST_REUSED');clear=true;return present(r.row);}
   snapshot=(await call(':beginTransaction',{options:{readOnly:{}}})).transaction;if(!snapshot)throw fail('SNAPSHOT_MISSING');
   const pre=`hd3d_live/${user.uid}/`,guard=pre+'hd3d_sequences/order-pending-'+item;
   const paths=['hd3d_live_order_counter/main',pre+'hd3d_sequences/_revision',pre+'hd3d_sequences/hd3d_orders',guard,pre+'hd3d_profiles/'+user.uid,pre+'hd3d_owned/'+user.uid+'~'+item];
   const ds=await read(paths),[counter,rev,seq,pending,profile,owned]=ds.map(d=>d?decodeFields(d.fields):null);
   if(!counter||!rev||!pending)throw fail('MIGRATION_REQUIRED');
   if(owned){clear=true;throw fail('23505');}
   if(pending.row.value){const d=(await read([pre+'hd3d_orders/'+pending.row.value]))[0];if(!d)throw fail('MISSING_PENDING_ORDER');if(decodeFields(d.fields).row.status==='pending'){clear=true;throw fail('23505');}}
   const id=counter.value+1,revision=rev.row.value+1;if(!Number.isSafeInteger(id)||id<1||id<=(seq?.row.value||0))throw fail('ORDER_SEQUENCE_INVALID');
   const row={id,user_id:user.uid,email:user.email,nickname:profile?.row.nickname||'용사',item,status:'pending',decided_at:null,refunded_at:null,note:null,refund_note:null};
   const doc=(p,data,old)=>({update:{name:root+'/'+p,fields:encodeFields(data)},currentDocument:old?{updateTime:old.updateTime}:{exists:false}});
   const scoped=(p,r,old)=>doc(p,{owner:user.uid,version:1,row:r,commitRevision:revision},old);
   const order=scoped(pre+'hd3d_orders/'+id,row,null);order.updateTransforms=[{fieldPath:'row.created_at',setToServerValue:'REQUEST_TIME'}];
   const proof={op:'order_create',request:job.request,token:item,hero:'',level:0,stat:''};
   const record=doc(receipt,{uid:user.uid,request:job.request,item,order:id,row},null);record.updateTransforms=[{fieldPath:'at',setToServerValue:'REQUEST_TIME'},{fieldPath:'row.created_at',setToServerValue:'REQUEST_TIME'}];
   const writes=[order,doc(paths[0],{value:id},ds[0]),scoped(paths[1],{id:'_revision',value:revision,proof},ds[1]),scoped(paths[2],{id:'hd3d_orders',value:id},ds[2]),scoped(guard,{id:'order-pending-'+item,value:id},ds[3]),record];
   await call(':commit',{writes});await call(':rollback',{transaction:snapshot});snapshot=null;
   // Resolve the committed server timestamp/row, never invent a local success.
   const confirmed=(await read([receipt]))[0];if(!confirmed)throw fail('ORDER_RESULT_UNKNOWN');clear=true;return present(decodeFields(confirmed.fields).row);
  }finally{if(snapshot&&call)try{await call(':rollback',{transaction:snapshot});}catch{}if(clear&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);busy=false;}
 };
}
