// Emulator-only administrator mail. No player reward/role authority is opened.
// The durable request receipt, immutable audit, mail and sequence commit together.
import {assertDirectConfig,encodeFields,decodeFields} from './direct-store.js';
import {validReward} from '../../server/common.mjs';
import {stable} from './direct-authority.js';
const fail=code=>Object.assign(Error(code),{code});
export const isAdminMailOperation=op=>op.name==='hd3d_admin_send_mail';
export function createAdminMailTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID(),broadcast=null}={}){
 const {root,endpoint}=assertDirectConfig(config);let busy=false;
 return async(op,user)=>{
  const a=op.args||{},email=String(a.p_email||'').trim().toLowerCase(),title=String(a.p_title||'').trim(),body=String(a.p_body||'').slice(0,1000),reward=a.p_reward&&Object.keys(a.p_reward).length?a.p_reward:null;
  if(!isAdminMailOperation(op)||Object.keys(a).some(k=>!['p_email','p_title','p_body','p_reward'].includes(k)))throw fail('INVALID_ARGUMENT');
  if(!validReward(a.p_reward))return {data:{ok:false,reason:'bad_reward'},error:null};
  if(!title||title.length>60)return {data:{ok:false,reason:'bad_title'},error:null};
  if(!email||email.length>254)throw fail('INVALID_ARGUMENT');
  if(!storage||busy)throw fail('DIRECT_ADMIN_PENDING');busy=true;
  const key=(config.storagePrefix||'hd3d_live')+'_admin_mail_pending_'+user.uid,signature=stable(broadcast?{title,body,reward,broadcast}:{email,title,body,reward});let job,clear=false;
  const current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};
  try{
   current();const token=await user.getIdToken();current();
   const call=async(path,b,method='POST')=>{current();const r=await fetcher(endpoint+'/v1/'+root+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const v=await r.json();current();if(!r.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR'),{status:r.status,message:v.error?.message||'FIRESTORE_ERROR'});return v;};
   const get=async p=>{try{return await call('/'+p,null,'GET');}catch(e){if(e.status===404)return null;throw e;}};
   // This query exercises the complete current role/activation/ban/email rule.
   await call(':runQuery',{structuredQuery:{from:[{collectionId:'hd3d_live_accounts'}],limit:1}});
   try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ADMIN_PENDING');}
   if(job&&(job.uid!==user.uid||job.signature!==signature))throw fail('DIRECT_ADMIN_PENDING');
   if(!job){job={uid:user.uid,request:uuid(),signature,...(broadcast?{target:broadcast.uid}:{})};if(!/^[A-Za-z0-9_-]{8,64}$/.test(job.request))throw fail('INVALID_REQUEST');}
   const save=()=>{storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');};save();
   const rp='hd3d_live_admin_requests/'+user.uid+'~'+job.request,prior=await get(rp);
   if(prior){const p=decodeFields(prior.fields);if(p.signature!==signature||p.actor!==user.uid)throw fail('REQUEST_REUSED');clear=true;return {data:{ok:true,mail:p.mail,already:true},error:null};}
   if(!job.target){
    // The existing private account index is bounded and paginated. No email
    // index or public account discovery is introduced for ordinary players.
    let after;const matches=[];
    for(;;){const q={from:[{collectionId:'hd3d_live_accounts'}],orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100,...(after?{startAt:{values:[{referenceValue:after}],before:false}}:{})};
     const ds=(await call(':runQuery',{structuredQuery:q})).filter(x=>x.document).map(x=>x.document);
     const ids=ds.map(d=>decodeFields(d.fields).uid);if(ids.some(uid=>!/^[-A-Za-z0-9_]{1,128}$/.test(uid)))throw fail('INVALID_ACCOUNT_INDEX');
     for(let start=0;start<ids.length;start+=10){const found=await call(':batchGet',{documents:ids.slice(start,start+10).map(uid=>root+`/hd3d_live/${uid}/hd3d_users/${uid}`)});for(const x of found)if(x.found){const row=decodeFields(x.found.fields).row;if(row.email===email)matches.push(row.id);}}
     if(ds.length<100)break;const next=ds.at(-1).name;if(next===after)throw fail('INVALID_CURSOR');after=next;
    }
    if(!matches.length){clear=true;return {data:{ok:false,reason:'no_user'},error:null};}if(matches.length!==1)throw fail('AMBIGUOUS_ACCOUNT');job.target=matches[0];save();
   }
   // Up to ten legacy item specs are prevalidated in small immutable batches.
   // Drafts carry no assets. The final mandatory request receipt checks every
   // item against them, avoiding Rules' 1000-expression request ceiling.
   const specs=reward?.items||[];
   for(let n=0;n<Math.ceil(specs.length/4);n++){
    const p='hd3d_live_mail_specs/'+user.uid+'~'+job.request+'~'+n,prepared={actor:user.uid,request:job.request,chunk:n,items:specs.slice(n*4,n*4+4)},existing=await get(p);
    if(existing){if(stable(decodeFields(existing.fields))!==stable(prepared))throw fail('REQUEST_REUSED');}
    else await call(':commit',{writes:[{update:{name:root+'/'+p,fields:encodeFields(prepared)},currentDocument:{exists:false}}]});
   }
   const uid=job.target,sp=`hd3d_live/${uid}/hd3d_sequences/hd3d_mail`,seq=await get(sp);
   if(!seq)throw fail('MISSING_MAIL_SEQUENCE');const old=decodeFields(seq.fields),id=old.row.value+1;
   if(!Number.isSafeInteger(id)||id<=0)throw fail('MAIL_SEQUENCE_OVERFLOW');
   const row={id,user_id:uid,title,body,reward,claimed:false,claimed_at:null,revoked:false,order_id:null,broadcast_id:broadcast?.bid??null,created_at:new Date().toISOString()};
   const audit={actor:user.uid,request:job.request,target:uid,mail:id,action:'admin_send_mail',signature,email,row,...(broadcast?{broadcast}:{})};
   const receipt={actor:user.uid,request:job.request,target:uid,mail:id,signature};
   const create=(p,d)=>({update:{name:root+'/'+p,fields:encodeFields(d)},currentDocument:{exists:false}});
   const audited=(p,d)=>({...create(p,d),updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]});
   const writes=[create(`hd3d_live/${uid}/hd3d_mail/${id}`,{owner:uid,version:1,row,commitRevision:0}),
    {update:{name:seq.name,fields:encodeFields({...old,commitRevision:old.commitRevision??0,row:{id:'hd3d_mail',value:id}})},currentDocument:{updateTime:seq.updateTime}},
    audited('hd3d_live_mail_audit/'+uid+'~'+id,audit),audited(rp,receipt)];
   if(broadcast)writes.push(audited('hd3d_live_broadcast_deliveries/'+broadcast.job+'~'+broadcast.index,{job:broadcast.job,index:broadcast.index,target:uid,actor:user.uid,request:job.request,mail:id}));
   await call(':commit',{writes});clear=true;return {data:{ok:true,mail:id},error:null};
  }
  // Retain identity on every failed read/write. Even a definite failure of THIS
  // attempt cannot disprove another tab's same-request commit. The next explicit
  // retry reads that receipt, or reuses this ID against the new sequence CAS.
  finally{if(clear&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);busy=false;}
 };
}
