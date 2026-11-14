import * as Acc from './account.js';
import {CLOUD} from '../config/cloud.js';
import {ls} from '../core/store.js';
import {durableSet} from './durable.js';
const key=uid=>CLOUD.storagePrefix+'_direct_normal_'+uid;
const read=uid=>{const text=ls.get(key(uid));return text?JSON.parse(text):null;};
const fail=()=>{throw Object.assign(new Error(Acc.SAVE_WAIT_MESSAGE),{code:'server_save_pending'});};
const enabled=()=>!!Acc.A.user&&!!Acc.A.sb?.atomicGear;
let active=null;
export async function runDirectNormal(input){
 if(!enabled()||!Acc.ready())fail();
 const uid=Acc.A.user.id,epoch=Acc.sessionId(),current=()=>Acc.A.user?.id===uid&&Acc.sessionId()===epoch;
 if(active?.uid===uid&&active.epoch===epoch)fail();
 let journal=read(uid),job,confirmed=false;
 const work={uid,epoch};active=work;
 const rpc=async(name,args={})=>{if(!current())fail();const {data,error}=await Acc.A.sb.rpc('hd3d_'+name,args);if(!current())fail();if(error)throw Object.assign(new Error(error.message),error);if(!data)fail();return data;};
 try{
  if(!journal&&input){journal={input};durableSet(key(uid),JSON.stringify(journal));}
  let result;
  if(!journal&&Acc.serverSaveState()?.token?.startsWith('normal:')){journal={token:Acc.serverSaveState().token.slice(7)};durableSet(key(uid),JSON.stringify(journal));}
  if(!journal){const pending=await rpc('normal_pending');if(!pending.length)return null;journal={token:pending[0].token,...(pending[0].kind==='hard'?{hard:pending[0]}:{})};durableSet(key(uid),JSON.stringify(journal));result=pending[0];}
  const token=journal.input?.args.p_token||journal.token;
  job=Acc.beginServerSave('normal:'+token);
  if(!await Acc.flush()||!current()||!Acc.markServerSave(job))fail();
  if(journal.input){
   const HG=await import('./hero-growth.js'),cp=journal.input.checkpoint;
   if(!cp||!await HG.refresh({maxAgeMs:1000})||!current())fail();
   if(!await HG.checkpoint({...cp.run,owner:uid,session:epoch},cp.completed,cp.win,true,cp.stars)||!await HG.retry()||!current())fail();
   result=await rpc(journal.input.challenge?'challenge_settle':'normal_settle',journal.input.args);
  }else{
   // Resolve a guard even when the corresponding local journal was lost.
   // A hard receipt needs finalization, not the normal loot cursor.
   result=journal.hard||result||await rpc('normal_status',{p_token:token});
   if(result.kind==='hard'){
    const h=result;result=await rpc('growth_progress',{p_token:token,p_completed:h.completed,p_win:h.win,p_finish:true,p_stars:h.stars,p_kills:h.kills});
    if(result.deferred&&result.reason==='capacity'){
     // Confirmed no-op at the blocked grant. Keep the durable entitlement, but
     // release the purchase guard after reload so capacity can be made available.
     if(!await Acc.reloadAuthoritative()||!current())fail();
     confirmed=true;return result;
    }
    if(!result.ok||!result.hardSaved)fail();
   }
  }
  while(result.next<result.total)result=await rpc(result.kind==='challenge'?'challenge_loot':'normal_loot',{p_token:token,p_index:result.next});
  if(!await Acc.reloadAuthoritative()||!current())fail();
  durableSet(key(uid),'null');ls.del(key(uid));confirmed=true;return result;
 }finally{if(job)Acc.finishServerSave(job,confirmed);if(active===work)active=null;if(!current())recover();}
}
let checked='',scheduled=false;
function recover(){
 if(!enabled()||!Acc.ready()||scheduled||active||Acc.serverSaveState()?.busy)return;
 const k=Acc.A.user.id+':'+Acc.sessionId();if(checked===k)return;checked=k;scheduled=true;
 setTimeout(async()=>{try{while(enabled()&&Acc.ready()&&Acc.A.user.id+':'+Acc.sessionId()===k){const result=await runDirectNormal();if(!result||result.deferred)break;}}catch{/* Durable journal/guard remains for reconnect. */}finally{scheduled=false;recover();}},0);
}
Acc.onChange(recover);
addEventListener('online',()=>{checked='';recover();});
