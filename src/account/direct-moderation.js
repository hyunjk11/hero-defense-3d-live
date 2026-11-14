// Emulator-only moderation: private ban, minimal public exclusion and immutable
// audit commit together. Existing role grants remain read-only to players.
import {assertDirectConfig,encodeFields,decodeFields} from './direct-store.js';
const fail=(code,message=code)=>Object.assign(Error(message),{code});
export const isModerationOperation=op=>['hd3d_admin_ban','hd3d_admin_unban'].includes(op.name);
export function createModerationTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID()}={}){
 const {root,endpoint}=assertDirectConfig(config);let busy=false;
 return async(op,user)=>{
  const action=op.name.replace(/^hd3d_/,''),a=op.args||{};
  if(!['admin_ban','admin_unban'].includes(action)||Object.keys(a).some(k=>!['p_user','p_reason'].includes(k))||!/^[-A-Za-z0-9_]{1,128}$/.test(a.p_user)||typeof a.p_reason!=='string'||a.p_reason.trim().length<1||a.p_reason.trim().length>200)throw fail('INVALID_ARGUMENT');
  if(a.p_user===user.uid)return {data:{ok:false,reason:'self'},error:null};
  const current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};current();const token=await user.getIdToken();current();
  const call=async(path,body,method='POST')=>{current();const res=await fetcher(endpoint+'/v1/'+root+path,{method,headers:{'content-type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});const v=await res.json();current();if(!res.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR',v.error?.message),{status:res.status});return v;};
  const get=async path=>{try{return await call('/'+path,null,'GET');}catch(e){if(e.status===404)return null;throw e;}};
  const role=await get(`hd3d_live/${user.uid}/hd3d_admins/${user.uid}`);if(!role)throw fail('PERMISSION_DENIED');
  const key=(config.storagePrefix||'hd3d_live')+'_moderation_pending_'+user.uid,body=JSON.stringify({action,target:a.p_user,reason:a.p_reason.trim()});
  if(!storage||busy)throw fail('DIRECT_ADMIN_PENDING');let job;try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ADMIN_PENDING');}
  if(job&&(job.uid!==user.uid||job.body!==body))throw fail('DIRECT_ADMIN_PENDING');
  if(!job){job={uid:user.uid,request:uuid(),body};storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');}
  busy=true;let clear=false;
  try{
   const ap='hd3d_live_moderation/'+user.uid+'~'+job.request,prior=await get(ap);
   if(prior){const v=decodeFields(prior.fields);if(v.body!==body||v.actor!==user.uid)throw fail('REQUEST_REUSED');clear=true;return {data:{ok:true,already:true},error:null};}
   const bp=`hd3d_live/${a.p_user}/hd3d_bans/${a.p_user}`,vp='hd3d_live_rank_blocks/'+a.p_user;
   const [ban,view]=await Promise.all([get(bp),get(vp)]);if(action==='admin_unban'&&!ban){clear=true;return {data:{ok:false,reason:'not_banned'},error:null};}
   const expected={ban:ban?.updateTime||null,view:view?.updateTime||null};if(job.expected&&JSON.stringify(job.expected)!==JSON.stringify(expected))throw fail('MODERATION_CONFLICT');job.expected=expected;storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');
   const revision=(view?decodeFields(view.fields).revision:0)+1,banned=action==='admin_ban',now=new Date().toISOString();
   const block={uid:a.p_user,banned,revision,lastRequest:job.request};
   const audit={actor:user.uid,request:job.request,target:a.p_user,action,reason:a.p_reason.trim(),body,revision};
   const writes=[{update:{name:root+'/'+vp,fields:encodeFields(block)},currentDocument:view?{updateTime:view.updateTime}:{exists:false},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},
    {update:{name:root+'/'+ap,fields:encodeFields(audit)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]}];
   if(banned)writes.push({update:{name:root+'/'+bp,fields:encodeFields({owner:a.p_user,version:1,row:{user_id:a.p_user,reason:a.p_reason.trim(),banned_by:user.uid,created_at:now},commitRevision:0})},currentDocument:ban?{updateTime:ban.updateTime}:{exists:false}});
   else writes.push({delete:root+'/'+bp,currentDocument:{updateTime:ban.updateTime}});
   await call(':commit',{writes});clear=true;return {data:{ok:true},error:null};
  }catch(e){if([400,403,409,412].includes(e.status)||e.code==='MODERATION_CONFLICT')clear=true;throw e;}
  finally{if(clear&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);busy=false;}
 };
}
