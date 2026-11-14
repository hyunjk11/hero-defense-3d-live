// Frozen recipients + per-recipient immutable delivery receipts. Unlike the
// legacy single batch, an interrupted broadcast resumes its undelivered tail.
// No player assets are changed until the existing claim-mail transaction.
import {assertDirectConfig,encodeFields,decodeFields} from './direct-store.js';
import {createAdminMailTransport} from './direct-admin-mail.js';
import {validReward} from '../../server/common.mjs';
import {stable} from './direct-authority.js';
const fail=code=>Object.assign(Error(code),{code});
export function createBroadcastTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID()}={}){
 const {root,endpoint}=assertDirectConfig(config);let busy=false;
 return async(op,user)=>{
  const a=op.args||{},title=String(a.p_title||'').trim(),body=String(a.p_body||''),reward=a.p_reward&&Object.keys(a.p_reward).length?a.p_reward:null;
  if(Object.keys(a).some(k=>!['p_title','p_body','p_reward','p_expected'].includes(k)))throw fail('INVALID_ARGUMENT');
  if(!title||title.length>60)return {data:{ok:false,reason:'bad_title'},error:null};if(body.length>1000)return {data:{ok:false,reason:'bad_body'},error:null};if(!validReward(reward))return {data:{ok:false,reason:'bad_reward'},error:null};
  if(!storage||busy)throw fail('DIRECT_ADMIN_PENDING');busy=true;let job,clear=false,snapshot,call;
  const key=(config.storagePrefix||'hd3d_live')+'_broadcast_pending_'+user.uid,signature=stable({title,body,reward,expected:a.p_expected}),current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};
  try{
   current();const token=await user.getIdToken();current();
   call=async(p,b,method='POST')=>{if(!p.endsWith(':rollback'))current();const r=await fetcher(endpoint+'/v1/'+root+p,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const v=await r.json();if(!p.endsWith(':rollback'))current();if(!r.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR'),{status:r.status});return v;};
   const get=async p=>{try{return await call('/'+p,null,'GET');}catch(e){if(e.status===404)return null;throw e;}};
   await call(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_accounts'}],limit:1}});
   try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ADMIN_PENDING');}if(job&&(job.uid!==user.uid||job.signature!==signature))throw fail('DIRECT_ADMIN_PENDING');
   if(!job)job={uid:user.uid,signature,request:uuid()};if(!/^[A-Za-z0-9_-]{8,48}$/.test(job.request))throw fail('INVALID_REQUEST');
   const save=()=>{storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');};save();
   const jobKey=user.uid+'~'+job.request,jp='hd3d_live_broadcast_jobs/'+jobKey,cp='hd3d_live_broadcast_control/main';let doc=await get(jp);
   if(!doc){
    snapshot=(await call(':beginTransaction',{options:{readOnly:{}}})).transaction;if(!snapshot)throw fail('SNAPSHOT_MISSING');
    const control=await get(cp),targets=[];let after;
    for(;;){const q={from:[{collectionId:'hd3d_live_accounts'}],limit:100,orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],...(after?{startAt:{values:[{referenceValue:after}],before:false}}:{})};const ds=(await call(':runQuery',{structuredQuery:q,transaction:snapshot})).filter(x=>x.document).map(x=>x.document);
     for(let start=0;start<ds.length;start+=5){const ids=ds.slice(start,start+5).map(d=>decodeFields(d.fields).uid);if(ids.some(x=>!/^[-A-Za-z0-9_]{1,128}$/.test(x)))throw fail('INVALID_ACCOUNT_INDEX');const found=await call(':batchGet',{transaction:snapshot,documents:ids.flatMap(uid=>['hd3d_profiles','hd3d_progress'].map(t=>root+`/hd3d_live/${uid}/${t}/${uid}`))});for(const uid of ids)if(found.some(x=>x.found?.name.startsWith(root+`/hd3d_live/${uid}/`)))targets.push(uid);}
     if(ds.length<100)break;after=ds.at(-1).name;
    }
    if(a.p_expected!==targets.length){clear=true;return {data:{ok:false,reason:'count_mismatch',count:targets.length},error:null};}
    // The single immutable manifest has a strict document-size bound. No
    // partial job is committed for larger sets; a chunked format needs review.
    if(targets.length>5000)throw fail('BROADCAST_MANIFEST_LIMIT');
    const bid=Math.max(Date.now(),(control?decodeFields(control.fields).bid:0)+1);
    const data={actor:user.uid,request:job.request,bid,title,body,reward,targets,signature};
    const writes=[{update:{name:root+'/'+jp,fields:encodeFields(data)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]},
     {update:{name:root+'/'+cp,fields:encodeFields({bid,job:jobKey})},currentDocument:control?{updateTime:control.updateTime}:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]}];
    await call(':commit',{writes});doc=await get(jp);
    await call(':rollback',{transaction:snapshot});snapshot=null;
   }
   const data=decodeFields(doc.fields);if(data.signature!==signature||data.actor!==user.uid)throw fail('REQUEST_REUSED');
   for(let index=0;index<data.targets.length;index++){
    const uid=data.targets[index],delivery=await get('hd3d_live_broadcast_deliveries/'+jobKey+'~'+index);
    const pending=JSON.parse(storage.getItem((config.storagePrefix||'hd3d_live')+'_admin_mail_pending_'+user.uid)||'null');
    if(delivery&&pending?.request!==job.request+'_'+index.toString(36)){if(decodeFields(delivery.fields).target!==uid)throw fail('INVALID_DELIVERY');continue;}
    const u=await get(`hd3d_live/${uid}/hd3d_users/${uid}`);if(!u)throw fail('MISSING_TARGET_USER');
    const broadcast={job:jobKey,index,bid:data.bid,uid};
    const deliver=createAdminMailTransport(config,{auth,fetcher,storage,uuid:()=>job.request+'_'+index.toString(36),broadcast});
    const r=await deliver({name:'hd3d_admin_send_mail',args:{p_email:decodeFields(u.fields).row.email,p_title:title,p_body:body,p_reward:reward}},user);if(!r.data?.ok)throw fail('BROADCAST_DELIVERY_FAILED');
   }
   clear=true;return {data:{ok:true,broadcast:data.bid,count:data.targets.length},error:null};
  }finally{if(snapshot&&call)try{await call(':rollback',{transaction:snapshot});}catch{}if(clear&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);busy=false;}
 };
}
