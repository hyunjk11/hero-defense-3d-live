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
let archiveReadFail=false;const archives=new Map();const archiveCalls=[];const claimed=new Set(),deferred=new Set();
const client={atomicMail:true,
 auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user:current}}),signOut:async()=>({})},
 from(table){let op='select',values,filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},update(v){op='update';values=v;return q;},insert(v){op='update';values=v;return q;},upsert:async()=>({}),
 maybeSingle:async()=>{if(table===CLOUD.tables.profiles)return {data:{nickname:'Tester'}};if(failRead){failRead=false;return {error:{code:'NETWORK_ERROR',message:'reload lost'}};}return {data:structuredClone(cloud())};},
 then(resolve,reject){let value;if(op==='update'){if(filters.updated_at!==cloud().updated_at)value={data:[]};else{Object.assign(cloud(),values,{updated_at:'stamp-'+(++counter)});value={data:[{updated_at:cloud().updated_at}]};}}else if(filters.archived===true){value=archiveReadFail?{error:{message:'archive read lost'}}:{data:(archives.get(filters.user_id)||[]).map(id=>({id}))};archiveReadFail=false;}else value={data:[]};return Promise.resolve(value).then(resolve,reject);}};return q;},
 async rpc(name,args){if(name==='hd3d_my_status')return {data:{admin:false,owner:false,banned:false}};
  if(name==='hd3d_mail_archive'){archiveCalls.push(args);const old=archives.get(current.id)||[];archives.set(current.id,args.p_restore?old.filter(id=>!args.p_ids.includes(id)):[...new Set([...old,...args.p_ids])]);return {data:{ok:true,restored:args.p_restore,ids:args.p_ids,skipped:[]}};}
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
const mail=(id,claimed=false)=>({id,claimed,reward:{souls:200}});
Shop.S.mail=[mail(7000),mail(7001),mail(7002,true)];
let release,started;const seen=new Promise(r=>started=r);pause={started,wait:new Promise(r=>release=r)};
const all=Shop.claimAll();await seen;
assert.equal((await Shop.claimAll()).ok,false);
assert.equal((await Shop.claim(7003)).busy,true);
assert.equal((await Shop.cleanupMail()).ok,false);
release();const r=await all;assert.equal(r.received,2);assert.equal(grants,2);assert.equal(Acc.load().souls,1400);assert.equal(Shop.S.mailAction,null);
deferred.add(7011);Shop.S.mail=[mail(7010),mail(7011),mail(7012)];
const partial=await Shop.claimAll();assert.equal(partial.received,1);assert.equal(partial.failed.length,1);assert.equal(partial.remaining,1);assert.equal(grants,3);assert.equal(Acc.load().souls,1600);assert.equal(Shop.pendingClaims().length,0);
Shop.S.mail=[mail(7020),mail(7021,true),mail(7022,true)];const before=Acc.load().souls;
const cleaned=await Shop.cleanupMail();assert.equal(cleaned.ok,true);assert.deepEqual(archiveCalls[0].p_ids,[7021,7022]);assert.equal(archiveCalls[0].p_restore,false);assert.equal(Acc.load().souls,before);
assert.deepEqual(Shop.S.archivedIds,[7021,7022]);Shop.S.archivedIds=[];await Shop.refresh();assert.deepEqual(Shop.S.archivedIds,[7021,7022]);archiveReadFail=true;const oldMail=Shop.S.mail;await Shop.refresh();assert.equal(Shop.S.status,'error');assert.equal(Shop.S.mail,oldMail);assert.deepEqual(Shop.S.archivedIds,[7021,7022]);await Shop.refresh();assert.equal(Shop.S.status,'ok');assert.equal((await Shop.cleanupMail(true)).ok,true);assert.equal(archiveCalls[1].p_restore,true);assert.deepEqual(Shop.S.archivedIds,[]);
Shop.S.mail=[mail(7030),mail(7031)];let done,start;const begun=new Promise(r=>start=r);pause={started:start,wait:new Promise(r=>done=r)};
const changed=Shop.claimAll();await begun;await Acc.signOut();current={id:'mail-ui-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');done();await changed;
assert.equal(Acc.load().souls,1000);assert.equal(Shop.S.mailAction,null);assert.equal(grants,4);assert.deepEqual(Shop.S.archivedIds,[]);
console.log('PASS receive-all serial receipts, duplicate clicks, capacity stop, received-only cleanup/undo, unchanged balance and account-switch isolation');

console.log('PASS archived IDs recover from server after memory reset; failed archive read preserves prior mail/undo state');
