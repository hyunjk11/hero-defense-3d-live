// Local durable START intent only. Finished/ping rewards keep the existing HG
// journal. No token from another device is guessed from an active-run list.
import * as Acc from './account.js';
import {CLOUD} from '../config/cloud.js';
import {durableSet} from './durable.js';
import {ls} from '../core/store.js';
const key=u=>CLOUD.storagePrefix+'_spire_entry_'+u;
export const directEntryEnabled=()=>!!Acc.A.user&&!!Acc.A.sb?.atomicGear;
let busy=null;
function read(u){const t=ls.get(key(u));if(!t)return null;const v=JSON.parse(t);if(v===null)return null;if(v?.uid!==u||!/^[-A-Za-z0-9_]{8,64}$/.test(v.request)||!Number.isInteger(v.from)||v.from<1||v.from>100000||![0,1].includes(v.growth))throw Error('입장 정보를 확인하지 못했습니다.');return v;}
// Only a validated, current-account intent can reopen the exhausted-entry UI.
export function pendingDirectEntry(){
 if(!directEntryEnabled())return null;try{const j=read(Acc.A.user.id);return j?{from:j.from}:null;}catch{return null;}
}
const blocked=(message='입장 확인 중입니다. 다시 시도해 주세요.')=>({blocked:true,pending:true,msg:message});
export async function startDirectEntry(rpc,from,growth,saveToken){
 const uid=Acc.A.user?.id,epoch=Acc.sessionId();
 const run=()=>Acc.A.user?.id===uid&&Acc.sessionId()===epoch?startLocked(rpc,from,growth,saveToken):blocked('계정이 변경되었습니다.');
 // Serialize intent allocation across tabs where Web Locks is available.
 return globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(key(uid),run):run();
}
async function startLocked(rpc,from,growth,saveToken){
 const uid=Acc.A.user.id,epoch=Acc.sessionId(),current=()=>Acc.A.user?.id===uid&&Acc.sessionId()===epoch;
 if(busy)return blocked();const work={};busy=work;
 try{
  let journal=read(uid);
  if(!journal){journal={uid,request:crypto.randomUUID(),from,growth};durableSet(key(uid),JSON.stringify(journal));}
  const {data,error}=await rpc('hd3d_spire_start',{p_id:journal.request,p_from:journal.from,p_growth:journal.growth});
  if(!current())return blocked('계정이 변경되었습니다.');
  // Unknown or denied replies retain the same intent. Never fall back to a
  // practice run and never generate a second ID to hide an uncertain outcome.
  if(error||!data)return blocked();
  if(!data.ok){
   if(['bad_from','daily_limit','used','expired'].includes(data.reason)){durableSet(key(uid),'null');ls.del(key(uid));}
   return {data};
  }
  if(typeof data.token!=='string'||!/^[-0-9a-f]{36}$/i.test(data.token)||data.request!==journal.request||data.from!==journal.from)return blocked();
  journal={...journal,token:data.token};durableSet(key(uid),JSON.stringify(journal));
  saveToken({t:data.token,u:uid,from:data.from,best:data.best||0,cleared:0,at:Date.now(),request:journal.request});
  return {data};
 }catch(e){return blocked(e.code==='LOCAL_WRITE_FAILED'?'입장 정보를 저장하지 못했습니다.':undefined);}
 finally{if(busy===work)busy=null;}
}
export function consumeDirectEntry(entry){
 if(!entry?.request||!entry.u)return;
 const j=read(entry.u);if(j?.request!==entry.request||j.token!==entry.t)throw Error('Tower entry intent mismatch');
 durableSet(key(entry.u),'null');ls.del(key(entry.u));
}
