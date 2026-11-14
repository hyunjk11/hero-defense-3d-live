import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import {CLOUD} from '../src/config/cloud.js';
const memory=new Map(),handlers={};
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=(k,f)=>(handlers[k]||=[]).push(f);
globalThis.document={addEventListener(){},visibilityState:'visible'};
globalThis.location={search:'',hostname:'localhost'};
let current={id:'mail-ui-a',email:'a@example.invalid'},counter=0,pause=null,lose=false,grants=0,failRead=false;
const states=new Map();const fresh=()=>({data:{...P.empty(),souls:1000,nick:'Tester'},merged:true,updated_at:'stamp-0'});
const cloud=()=>{if(!states.has(current.id))states.set(current.id,fresh());return states.get(current.id);};
const claimed=new Set(),deferred=new Set();
const client={atomicMail:true,
 auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user:current}}),signOut:async()=>({})},
 from(table){let op='select',values,filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},update(v){op='update';values=v;return q;},insert(v){op='update';values=v;return q;},upsert:async()=>({}),
 maybeSingle:async()=>{if(table===CLOUD.tables.profiles)return {data:{nickname:'Tester'}};if(failRead){failRead=false;return {error:{code:'NETWORK_ERROR',message:'reload lost'}};}return {data:structuredClone(cloud())};},
 then(resolve,reject){let value;if(op==='update'){if(filters.updated_at!==cloud().updated_at)value={data:[]};else{Object.assign(cloud(),values,{updated_at:'stamp-'+(++counter)});value={data:[{updated_at:cloud().updated_at}]};}}else value={data:[]};return Promise.resolve(value).then(resolve,reject);}};return q;},
 async rpc(name,args){if(name==='hd3d_my_status')return {data:{admin:false,owner:false,banned:false}};
  assert.equal(name,'hd3d_claim_mail');const owner=current.id,key=owner+'~'+args.p_mail_id,already=claimed.has(key);
  if(deferred.has(args.p_mail_id)){
   if(pause){const p=pause;pause=null;p.started();await p.wait;}
   if(lose){lose=false;return {error:{code:'NETWORK_ERROR',message:'defer response lost'}};}
   return {data:{ok:false,deferred:true,reason:'balance_limit',serverSaved:true,got:[]}};
  }
  if(!already){claimed.add(key);grants++;cloud().data.souls+=200;cloud().updated_at='stamp-'+(++counter);}
  if(pause){const p=pause;pause=null;p.started();await p.wait;}
  if(lose){lose=false;return {error:{code:'NETWORK_ERROR',message:'commit response lost'}};}
  return {data:{ok:true,already,id:args.p_mail_id,reward:null,serverSaved:true}};
 }
};
globalThis.window={__hd3dCloudMock:()=>client};
const Acc=await import('../src/account/account.js');await Acc.signIn(current.email,'unused');
const Shop=await import('../src/account/shop.js');await Shop.refresh();
assert.equal(Acc.load().souls,1000);
let release,started;const seen=new Promise(r=>started=r);pause={started,wait:new Promise(r=>release=r)};
const first=Shop.claim(6000);await seen;
assert.ok(Acc.serverSaveState()?.busy);assert.throws(()=>Acc.store({...Acc.load(),souls:0}));
assert.equal((await Shop.claim(6000)).ok,false);release();assert.equal((await first).ok,true);
assert.equal(Acc.load().souls,1200);assert.equal(Acc.serverSaveState(),null);assert.equal(grants,1);
console.log('PASS actual shop/account modules hold mutations through claim and authoritative reload');
lose=true;assert.equal((await Shop.claim(6001)).ok,false);assert.equal(Acc.load().souls,1200);assert.equal(Acc.serverSaveState().token,'mail:6001');
assert.equal((await Shop.claim(6001)).ok,true);assert.equal(Acc.load().souls,1400);assert.equal(grants,2);assert.equal(Acc.serverSaveState(),null);assert.deepEqual(Shop.pendingClaims(),[]);
console.log('PASS unknown response retains guard; same receipt reloads once without local replay');
failRead=true;assert.equal((await Shop.claim(6003)).ok,false);assert.equal(Acc.load().souls,1400);assert.equal(Acc.serverSaveState().token,'mail:6003');
assert.equal((await Shop.claim(6003)).ok,true);assert.equal(Acc.load().souls,1600);assert.equal(grants,3);assert.equal(Acc.serverSaveState(),null);
console.log('PASS failed post-commit reload remains guarded and recovers without a second award');
let unblock,onStarted;const pending=new Promise(r=>onStarted=r);pause={started:onStarted,wait:new Promise(r=>unblock=r)};
const late=Shop.claim(6002);await pending;await Acc.signOut();current={id:'mail-ui-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');unblock();assert.equal((await late).ok,false);
assert.equal(Acc.load().souls,1000);assert.equal(Acc.serverSaveState(),null);assert.equal(states.get('mail-ui-a').data.souls,1800);
console.log('PASS late A claim cannot replace B balance or marker');
await Acc.signOut();current={id:'mail-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');await Shop.recoverClaims();
assert.equal(Acc.load().souls,1800);assert.equal(Acc.serverSaveState(),null);assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(grants,4);
console.log('PASS returning to A reconciles its durable pending receipt, preserving B');
deferred.add(6010);lose=true;
assert.equal((await Shop.claim(6010)).pending,true);assert.ok(Acc.serverSaveState());
failRead=true;assert.equal((await Shop.claim(6010)).pending,true);assert.ok(Acc.serverSaveState());
const deferredResult=await Shop.claim(6010);assert.equal(deferredResult.deferred,true);assert.equal(deferredResult.pending,false);
assert.equal(Acc.serverSaveState(),null);assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(grants,4);assert.equal(Acc.load().souls,1800);
console.log('PASS lost capacity response and failed reload retain guard until known deferral plus authoritative reload');
deferred.add(6011);let releaseDefer,startedDefer;const deferSeen=new Promise(r=>startedDefer=r);
pause={started:startedDefer,wait:new Promise(r=>releaseDefer=r)};const lateDefer=Shop.claim(6011);await deferSeen;
await Acc.signOut();current={id:'mail-ui-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');releaseDefer();
assert.equal((await lateDefer).ok,false);assert.equal(Acc.load().souls,1000);assert.equal(Acc.serverSaveState(),null);
await Acc.signOut();current={id:'mail-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');await Shop.recoverClaims();
assert.equal(Acc.load().souls,1800);assert.equal(Acc.serverSaveState(),null);assert.deepEqual(Shop.pendingClaims(),[]);assert.equal(grants,4);
console.log('PASS late deferral cannot clear another account guard; A resumes without reward loss or duplicate');
await Acc.signOut();process.exitCode=0;
