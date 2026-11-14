// Emulator-only administrative slice. No roles, private users or rewards are
// writable here. Notices and their immutable audit receipts commit together.
import {assertDirectConfig,encodeFields,decodeFields} from './direct-store.js';
const fail=(code,message=code)=>Object.assign(new Error(message),{code});
const copy=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>JSON.stringify(Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))));
const MAX_TIME=253402300799000;
const allowed=new Set(['admin_notice_save','admin_notice_active']);
export const isNoticeOperation=op=>allowed.has(op.name?.replace(/^hd3d_/,''))||op.kind==='query'&&op.table==='hd3d_notices';
function argumentsFor(name,a) {
 const keys=name==='admin_notice_save'?['p_id','p_title','p_body','p_active','p_starts','p_ends']:['p_id','p_active'];
 if(!a||typeof a!=='object'||Object.keys(a).some(k=>!keys.includes(k))||
  (a.p_id!=null&&(!Number.isSafeInteger(a.p_id)||a.p_id<=0))||typeof a.p_active!=='boolean')throw fail('INVALID_ARGUMENT');
 if(name==='admin_notice_active'&&a.p_id==null)throw fail('INVALID_ARGUMENT');
 if(name==='admin_notice_active')return copy(a);
 if(typeof a.p_title!=='string'||!a.p_title.trim()||a.p_title.trim().length>80||typeof a.p_body!=='string'||a.p_body.length>2000)throw fail('INVALID_ARGUMENT');
 const time=x=>x==null?null:new Date(x).getTime();
 const start=time(a.p_starts),end=time(a.p_ends);
 if(start!=null&&(!Number.isFinite(start)||start<0||start>MAX_TIME)||end!=null&&(!Number.isFinite(end)||end<0||end>MAX_TIME)||start!=null&&end!=null&&end<=start)throw fail('INVALID_ARGUMENT');
 return {p_id:a.p_id??null,p_title:a.p_title.trim(),p_body:a.p_body,p_active:a.p_active,p_starts:start==null?null:new Date(start).toISOString(),p_ends:end==null?null:new Date(end).toISOString()};
}
export function createNoticeTransport(config,{auth,fetcher=fetch,storage=globalThis.localStorage,uuid=()=>crypto.randomUUID(),nextId=()=>{const a=crypto.getRandomValues(new Uint32Array(2));return 1+(a[0]&0xfffff)*4294967296+a[1];}}={}) {
 const {root,endpoint}=assertDirectConfig(config);let busy=null;
 const prefix=config.storagePrefix||'hd3d_live';
 return async(op,user)=>{
  const current=()=>{if(auth.currentUser!==user)throw fail('ACCOUNT_CHANGED');};
  current();const token=await user.getIdToken();current();
  const call=async(path,body,method='POST')=>{current();const r=await fetcher(`${endpoint}/v1/${root}${path}`,{method,headers:{'content-type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();current();if(!r.ok)throw Object.assign(fail(v.error?.status||'FIRESTORE_ERROR',v.error?.message),{status:r.status});return v;};
  const get=async path=>{try{return await call('/'+path,null,'GET');}catch(e){if(e.status===404)return null;throw e;}};
  const activation=await get(`hd3d_live/${user.uid}/hd3d_sequences/_activation`);
  if(!activation||decodeFields(activation.fields).row.enabled!==true)throw fail('MIGRATION_REQUIRED');
  const role=await get(`hd3d_live/${user.uid}/hd3d_admins/${user.uid}`),ban=await get(`hd3d_live/${user.uid}/hd3d_bans/${user.uid}`);
  if(ban)throw fail('PERMISSION_DENIED');
  const isAdmin=!!role;
  if(op.kind==='query'){
   if(op.action!=='select'||op.columns!=='*'||Object.keys(op.filters||{}).length||op.single||op.order&&(op.order.field!=='created_at'||op.order.ascending!==false))throw fail('DIRECT_UNSUPPORTED');
   const limit=op.limit??30;if(!Number.isInteger(limit)||limit<1||limit>50)throw fail('INVALID_ARGUMENT');
   // A read snapshot gives a server time for the published-at query. Never use
   // a client clock to make scheduled drafts readable before their start time.
   const snap=await call(':batchGet',{documents:[activation.name]});const now=snap[0]?.readTime;
   if(!now)throw fail('SNAPSHOT_MISSING');
   const filters=[{fieldFilter:{field:{fieldPath:'row.active'},op:'EQUAL',value:{booleanValue:true}}},{fieldFilter:{field:{fieldPath:'startsAt'},op:'LESS_THAN_OR_EQUAL',value:{timestampValue:now}}},{fieldFilter:{field:{fieldPath:'endsAt'},op:'GREATER_THAN',value:{timestampValue:now}}}];
   const q={from:[{collectionId:'hd3d_live_notices'}],...(!isAdmin?{where:{compositeFilter:{op:'AND',filters}}}:{}),orderBy:(isAdmin?['createdAt','__name__']:['startsAt','endsAt','__name__']).map(fieldPath=>({field:{fieldPath},direction:'DESCENDING'})),limit:isAdmin?limit:50};
   // Publication order is not creation order. Page the bounded public query,
   // then preserve the original created_at ordering before applying UI limit.
   const docs=[];let page;
   do{page=(await call(':runQuery',{structuredQuery:q})).filter(x=>x.document).map(x=>x.document);docs.push(...page);
    if(!isAdmin&&page.length===50){const last=page.at(-1);q.startAt={values:[last.fields.startsAt,last.fields.endsAt,{referenceValue:last.name}],before:false};}
   }while(!isAdmin&&page.length===50);
   const list=docs.map(x=>decodeFields(x.fields).row);
   list.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);return {data:list.slice(0,limit),error:null,status:200};
  }
  const name=op.name?.replace(/^hd3d_/,'');if(!allowed.has(name))throw fail('DIRECT_UNSUPPORTED');
  if(!isAdmin)throw fail('PERMISSION_DENIED');
  const args=argumentsFor(name,op.args),body=canonical({name,args}),key=prefix+'_notice_pending_'+user.uid;
  if(!storage||busy)throw fail('DIRECT_ADMIN_PENDING');
  let job;try{job=JSON.parse(storage.getItem(key)||'null');}catch{throw fail('DIRECT_ADMIN_PENDING');}
  if(job&&(job.uid!==user.uid||job.body!==body))throw fail('DIRECT_ADMIN_PENDING','이전 공지 저장 결과를 먼저 확인해 주세요.');
  if(!job){job={uid:user.uid,request:uuid(),notice:args.p_id??nextId(),body};storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');}
  const handle={};busy=handle;let confirmed=false,rejected=false;
  try{
   const rid=user.uid+'~'+job.request,rpath='hd3d_live_notice_audit/'+rid;
   const prior=await get(rpath);
   if(prior){const r=decodeFields(prior.fields);if(r.body!==body||r.actor!==user.uid)throw fail('REQUEST_REUSED');confirmed=true;return {data:{ok:true,id:r.notice,already:true},error:null,status:200};}
   const npath='hd3d_live_notices/'+job.notice,old=await get(npath),before=old?decodeFields(old.fields):null;
   if(args.p_id!=null&&!before){rejected=true;return {data:{ok:false,reason:'not_found'},error:null,status:200};}
   if(args.p_id==null&&before)throw fail('NOTICE_ID_COLLISION');
   // Store the observed revision before sending: an unknown response followed by
   // another editor's commit cannot silently overwrite that editor on recovery.
   const expected=old?.updateTime||null;
   if('expected' in job&&job.expected!==expected)throw fail('NOTICE_CONFLICT');
   job.expected=expected;storage.setItem(key,JSON.stringify(job));if(storage.getItem(key)!==JSON.stringify(job))throw fail('LOCAL_WRITE_FAILED');
   const snap=await call(':batchGet',{documents:[activation.name]});const now=snap[0]?.readTime;if(!now)throw fail('SNAPSHOT_MISSING');
   const row=name==='admin_notice_active'?{...before.row,active:args.p_active,updated_at:now}:{id:job.notice,title:args.p_title,body:args.p_body,active:args.p_active,starts_at:args.p_starts,ends_at:args.p_ends,created_by:before?.row.created_by||user.uid,created_at:before?.row.created_at||now,updated_at:now};
   const next={row,revision:(before?.revision||0)+1,actor:user.uid,lastRequest:job.request};
   const nf=encodeFields(next);nf.startsAt={timestampValue:row.starts_at||new Date(0).toISOString()};nf.endsAt={timestampValue:row.ends_at||new Date(MAX_TIME).toISOString()};nf.createdAt=before?old.fields.createdAt:{timestampValue:now};
   const audit={actor:user.uid,request:job.request,notice:job.notice,body,row,revision:next.revision,action:name};
   await call(':commit',{writes:[{update:{name:root+'/'+npath,fields:nf},currentDocument:old?{updateTime:old.updateTime}:{exists:false},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'},...(!old?[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]:[])]},
    {update:{name:root+'/'+rpath,fields:encodeFields(audit)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}]}]});
   confirmed=true;return {data:{ok:true,id:job.notice},error:null,status:200};
  }catch(e){if([400,403,409,412].includes(e.status)||['NOTICE_CONFLICT','NOTICE_ID_COLLISION'].includes(e.code))rejected=true;throw e;}
  finally{if((confirmed||rejected)&&auth.currentUser===user&&storage.getItem(key)===JSON.stringify(job))storage.removeItem(key);if(busy===handle)busy=null;}
 };
}
