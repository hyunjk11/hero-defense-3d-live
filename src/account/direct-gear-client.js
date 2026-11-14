import * as Acc from './account.js';
import {CLOUD} from '../config/cloud.js';
import {ls} from '../core/store.js';
import {durableSet} from './durable.js';
const key=uid=>CLOUD.storagePrefix+'_direct_gear_'+uid;
const rollKey=uid=>CLOUD.storagePrefix+'_direct_roll_'+uid;
const read=uid=>{try{return JSON.parse(ls.get(key(uid))||'null');}catch{return null;}};
const pendingError=()=>Object.assign(new Error(Acc.SAVE_WAIT_MESSAGE),{code:'server_save_pending'});
let active=null;
const batchActions=new Set(['open','dismantle','store','take','equip','unequip','research','bar','expand','exchange']);
let batchUnsupported=false;
export const directGearEnabled=()=>!!Acc.A.user&&!!Acc.A.sb?.atomicGear;
export const pendingGear=()=>Acc.A.user?read(Acc.A.user.id):null;
export function pendingReroll(){try{return Acc.A.user?JSON.parse(ls.get(rollKey(Acc.A.user.id))||'null'):null;}catch{return null;}}
export function keepReroll(){if(Acc.A.user){durableSet(rollKey(Acc.A.user.id),'null');ls.del(rollKey(Acc.A.user.id));}}
// One durable journal, ordered operations in a server batch when supported. Each receipt is replayed
// only by its original ID; interruption never recreates already opened chests.
export async function runDirectGear(commands) {
 if(!directGearEnabled()||!Acc.ready())throw pendingError();
 const uid=Acc.A.user.id,epoch=Acc.sessionId(),current=()=>Acc.A.user?.id===uid&&Acc.sessionId()===epoch;
 if(active?.uid===uid&&active.epoch===epoch)throw pendingError();
 let journal=read(uid),job,confirmed=false,marked=false,snapshot;
 if(!journal&&(!Array.isArray(commands)||!commands.length||commands.length>200))throw Error('Invalid gear batch');
 const token=journal?.token||'gear:'+crypto.randomUUID(),pending=Acc.serverSaveState();
 if(pending&&pending.token!==token)throw pendingError();
 const handle={uid,epoch};active=handle;
 try {
  job=Acc.beginServerSave(token);
  if(!journal){
   // A battle result must survive refresh even while the preceding save/XP
   // acknowledgement is still pending. Store its input before those awaits.
   const next={token,uid,index:0,commands:commands.map(c=>({...c,p_id:c.p_action==='run_return'?'run-'+c.p_item:c.p_action==='reroll_apply'?'apply-'+c.p_source:crypto.randomUUID()})),results:[]};
   if(commands[0]?.p_action==='run_return'){journal=next;durableSet(key(uid),JSON.stringify(journal));}
   if(!await Acc.flush()||!current())throw pendingError();
   journal=next;
   durableSet(key(uid),JSON.stringify(journal));
  }
  if(!current()||!Acc.markServerSave(job))throw pendingError();marked=true;
  while(journal.index<journal.commands.length){
   const rest=journal.commands.slice(journal.index);
   if(Acc.A.sb.serverEconomy&&!batchUnsupported&&rest.every(c=>batchActions.has(c.p_action))){
    const {data,error}=await Acc.A.sb.rpc('hd3d_gear_batch',{commands:rest});
    if(!current())throw pendingError();
    // Explicit unsupported-operation is the only safe fallback. Never replay
    // new IDs or fall through after a timeout/unknown commit.
    if(error?.code==='PGRST202'){batchUnsupported=true;continue;}
    if(error)throw Object.assign(new Error(error.message||Acc.SAVE_WAIT_MESSAGE),{code:error.code,status:error.status});
    if(!data?.ok||!Array.isArray(data.results)||data.results.length!==rest.length||data.results.some(r=>typeof r?.ok!=='boolean'))throw pendingError();
    journal.results.push(...data.results);journal.index=journal.commands.length;durableSet(key(uid),JSON.stringify(journal));snapshot=data.snapshot;
    break;
   }
   const {checkpoint,...command}=journal.commands[journal.index];
   if(command.p_action==='run_return'){
    const HG=await import('./hero-growth.js');
    if(!checkpoint||!await HG.refresh({maxAgeMs:1000})||!current())throw pendingError();
    if(!await HG.checkpoint({...checkpoint.run,owner:uid,session:epoch},checkpoint.completed,false,true)||!await HG.retry()||!current())throw pendingError();
   }
   const {data,error}=command.p_action==='dungeon_buy'?await Acc.A.sb.rpc('hd3d_dungeon_buy',{p_id:command.p_id,p_item:command.p_item}):await Acc.A.sb.rpc('hd3d_gear_action',command);
   if(!current())throw pendingError();
   if(error)throw Object.assign(new Error(error.message||Acc.SAVE_WAIT_MESSAGE),{code:error.code,status:error.status});
   if(!data||typeof data.ok!=='boolean')throw pendingError();
   if(data.ok&&command.p_action==='reroll')durableSet(rollKey(uid),JSON.stringify({id:command.p_item,sub:data.sub,source:data.id}));
   if(data.ok&&command.p_action==='reroll_apply')keepReroll();
   journal.results.push(data);journal.index++;durableSet(key(uid),JSON.stringify(journal));
  }
  if(!(snapshot&&await Acc.acceptEconomySnapshot(snapshot,job))&&!await Acc.reloadAuthoritative()||!current())throw pendingError();
  durableSet(key(uid),'null');ls.del(key(uid));confirmed=true;
  return journal.results;
 }finally{
  // A journal/marker remains for an uncertain response or failed authoritative
  // reload. Logout never rewrites another account or destroys this pending job.
  if(job)Acc.finishServerSave(job,confirmed||!marked&&!journal);
  if(active===handle)active=null;
 }
}
let recoveryKey='';
function recover(){
 if(!directGearEnabled()||!Acc.ready()||!pendingGear()||Acc.serverSaveState()?.busy)return;
 const k=Acc.A.user.id+':'+Acc.sessionId();if(recoveryKey===k)return;recoveryKey=k;
 setTimeout(()=>{if(directGearEnabled()&&Acc.ready()&&pendingGear())runDirectGear().catch(()=>{});},0);
}
Acc.onChange(recover);
addEventListener('online',()=>{recoveryKey='';recover();});
