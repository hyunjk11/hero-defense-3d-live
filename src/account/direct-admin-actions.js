// Local direct-storage prototype. Privileged transitions reuse the legacy
// implementation. One target revision fences concurrent player claims/saves;
// immutable request receipts make an unknown commit recoverable after reload.
import {assertDirectConfig,encodeFields,decodeFields,unpackRow} from './direct-store.js';
import {week} from '../../server/common.mjs';
import {admin,owner} from '../../server/admin.mjs';
import {stable} from './direct-authority.js';
import {adminDirectory} from './direct-admin-directory.js';
const names=new Set(['admin_spire_reset','admin_approve','admin_reject','admin_refund','admin_grant_hero','admin_revoke_hero','owner_add_admin','owner_remove_admin']);
const fail=code=>Object.assign(Error(code),{code});
export const isAdminAction=op=>names.has(op.name?.replace(/^hd3d_/,''));
export function createAdminActionTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID(),clock=Date.now}={}){
 const {root,endpoint}=assertDirectConfig(config);let busy=false;
 return async(op,user)=>{
  const action=op.name.replace(/^hd3d_/,''),a=op.args||{},signature=stable({action,args:a});
  if(!names.has(action)||signature.length>2048)throw fail('INVALID_ARGUMENT');
  const fields=action==='admin_spire_reset'?['p_user','p_reason']:action.startsWith('owner_')?['p_email']:action.endsWith('_hero')?['p_user','p_item','p_reason']:['p_order_id','p_reason'];
  if(Object.keys(a).some(k=>!fields.includes(k)))throw fail('INVALID_ARGUMENT');
  if(!storage||busy)throw fail('DIRECT_ADMIN_PENDING');busy=true;
  const key=(config.storagePrefix||'hd3d_live')+'_admin_action_pending_'+user.uid;
  const current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};let job,clear=false,snapshot;
  let call;
  try{
   current();const token=await user.getIdToken();current();
   call=async(p,b,rollback=false)=>{if(!rollback)current();const r=await fetcher(endpoint+'/v1/'+root+p,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(b)});const v=await r.json();if(!rollback)current();if(!r.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR'),{status:r.status,message:v.error?.message});return v;};
   await call(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_accounts'}],limit:1}});
   try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ADMIN_PENDING');}
   if(job&&(job.uid!==user.uid||job.signature!==signature))throw fail('DIRECT_ADMIN_PENDING');
   if(!job)job={uid:user.uid,signature,request:uuid()};
   if(!/^[A-Za-z0-9_-]{8,64}$/.test(job.request))throw fail('INVALID_REQUEST');
   const save=()=>{storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');};save();
   const ap='hd3d_live_admin_actions/'+user.uid+'~'+job.request;
   const read=async paths=>{const ds=await call(':batchGet',{documents:paths.map(p=>root+'/'+p),...(snapshot?{transaction:snapshot}:{})});return paths.map(p=>ds.find(x=>x.found?.name===root+'/'+p)?.found||null);};
   const prior=(await read([ap]))[0];if(prior){const d=decodeFields(prior.fields);if(d.signature!==signature)throw fail('REQUEST_REUSED');clear=true;return {data:{...d.result,already:true},error:null};}
   snapshot=(await call(':beginTransaction',{options:{readOnly:{}}})).transaction;if(!snapshot)throw fail('SNAPSHOT_MISSING');
   const scan=async(uid,table)=>{let after;const out=[];for(;;){const q={from:[{collectionId:table}],limit:100,orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],...(after?{startAt:{values:[{referenceValue:after}],before:false}}:{})};const ds=(await call((uid?'/hd3d_live/'+uid:'')+':runQuery',{structuredQuery:q,transaction:snapshot})).filter(x=>x.document).map(x=>x.document);out.push(...ds);if(ds.length<100)return out;if(ds.at(-1).name===after)throw fail('INVALID_CURSOR');after=ds.at(-1).name;}};
   if(!job.target){
    if(action.endsWith('_hero')||action==='admin_spire_reset')job.target=a.p_user;
    else{
     const accounts=await adminDirectory({scan,read,decodeFields});const hits=[];
     if(action.startsWith('owner_')){for(const d of accounts)if(d.email===String(a.p_email||'').trim().toLowerCase())hits.push(d.id);}
     else for(const d of accounts){const p=`hd3d_live/${d.id}/hd3d_orders/${a.p_order_id}`;if((await read([p]))[0])hits.push(d.id);}
     if(!hits.length){clear=true;return {data:{ok:false,reason:action.startsWith('owner_')?'no_user':'not_pending'},error:null};}
     if(hits.length!==1)throw fail('AMBIGUOUS_ACCOUNT');job.target=hits[0];
    }
    if(!/^[-A-Za-z0-9_]{1,128}$/.test(job.target||''))throw fail('INVALID_ARGUMENT');save();
   }
   const uid=job.target,prefix=`hd3d_live/${uid}/`,cache=new Map(),writes=new Map();
   const get=async(t,id)=>{const k=prefix+'hd3d_'+t+'/'+id;if(writes.has(k))return writes.get(k)?.row||null;if(!cache.has(k))cache.set(k,(await read([k]))[0]);const d=cache.get(k);return d?unpackRow('hd3d_'+t,decodeFields(d.fields).row):null;};
   const put=async(t,row)=>{const id=t==='owned'?row.user_id+'~'+row.item:['admins','spire_best'].includes(t)?row.user_id:t==='spire_weeks'?row.user_id+'~'+row.week:row.id;const k=prefix+'hd3d_'+t+'/'+id;await get(t,id);writes.set(k,{table:t,row});return row;};
   const remove=async(t,id)=>{await get(t,id);writes.set(prefix+'hd3d_'+t+'/'+id,null);};
   const list=async(t,filters={})=>{if(t==='users')return [await get(t,uid)].filter(x=>x&&Object.entries(filters).every(([k,v])=>x[k]===v));const ds=await scan(uid,'hd3d_'+t);for(const d of ds)cache.set(d.name.slice(root.length+1),d);return ds.map(d=>decodeFields(d.fields).row).filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));};
   const oldRev=await get('sequences','_revision');if(!oldRev)throw fail('MIGRATION_REQUIRED');const revision=oldRev.value+1,iso=new Date(clock()).toISOString();
   let detail=null,logAction='',mail=0;
   const insert=async(t,row)=>{row={created_at:iso,...row};if(t==='mail'){const s=await get('sequences','hd3d_mail');if(!s)throw fail('MISSING_MAIL_SEQUENCE');mail=s.value+1;if(!Number.isSafeInteger(mail))throw fail('MAIL_SEQUENCE_OVERFLOW');await put('sequences',{id:'hd3d_mail',value:mail});row.id=mail;}return put(t,row);};
   const c={uid:user.uid,user:{id:user.uid,email:user.email},iso,now:clock(),week:week(clock()),get,list,put,remove,insert,
    requireAdmin:()=>{},requireOwner:()=>{},log:async(n,target,d=null)=>{logAction=n;detail=d;},
    mail:(id,title,body,reward=null,extra={})=>{if(id!==uid)throw fail('INVALID_TARGET');return insert('mail',{user_id:id,title,body,reward,claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:null,...extra});}};
   const result=action.startsWith('owner_')?await owner(c,action.slice(6),a):await admin(c,action.slice(6),a);
   if(!result?.ok){clear=true;return {data:result,error:null};}
   const order=action.endsWith('_hero')||action.startsWith('owner_')||action==='admin_spire_reset'?0:Number(a.p_order_id),item=a.p_item||(order?(await get('orders',order))?.item:'')||'';
   const audit={actor:user.uid,request:job.request,target:uid,action,signature,revision,item,order,mail,reason:String(a.p_reason||'').trim().slice(0,200),email:String(a.p_email||'').trim().toLowerCase(),result,detail,logAction,...(action==='admin_spire_reset'?{week:c.week}:{})};
   await put('sequences',{id:'_revision',value:revision,proof:{op:'admin_action',request:job.request,token:user.uid,hero:'',level:0,stat:''}});
   if(writes.size>400)throw fail('ADMIN_ATOMIC_LIMIT');
   const batch=[...writes].map(([p,w])=>{const before=cache.get(p),pre=before?{updateTime:before.updateTime}:{exists:false};if(!w)return {delete:root+'/'+p,currentDocument:pre};const fields=encodeFields({owner:uid,version:1,row:w.row,commitRevision:revision});for(const k of ['issuedAt','pingAt','closedAt'])if(before?.fields[k])fields[k]=before.fields[k];return {update:{name:root+'/'+p,fields},currentDocument:pre};});
   if(action==='admin_spire_reset'){
    const paths=['hd3d_live_spire_resets/'+uid,'hd3d_live_ranks/all~all~'+uid,'hd3d_live_ranks/week~'+c.week+'~'+uid];
    const prior=await read(paths);batch.push({update:{name:root+'/'+paths[0],fields:encodeFields({uid,actor:user.uid,request:job.request,revision,week:c.week})},currentDocument:prior[0]?{updateTime:prior[0].updateTime}:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]});
    for(let i=1;i<paths.length;i++)if(prior[i])batch.push({delete:root+'/'+paths[i],currentDocument:{updateTime:prior[i].updateTime}});
   }
   if(batch.length>400)throw fail('ADMIN_ATOMIC_LIMIT');
   batch.push({update:{name:root+'/'+ap,fields:encodeFields(audit)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]});
   await call(':commit',{writes:batch});clear=true;return {data:result,error:null};
  }finally{
   if(snapshot&&call)try{await call(':rollback',{transaction:snapshot},true);}catch{/* Read-only snapshot cleanup cannot change a known commit outcome. */}
   if(clear&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);busy=false;
  }
 };
}
