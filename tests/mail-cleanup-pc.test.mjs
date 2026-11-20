import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import { CLOUD } from '../src/config/cloud.js';
import { SHOP } from '../src/config/shop.js';

const mem=new Map();
globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
globalThis.addEventListener=()=>{};
globalThis.document={addEventListener(){},visibilityState:'visible'};
globalThis.location=new URL('https://hyunjk11.github.io/hero-defense-3d-live/');
const A='mail-cleanup-pc-a',B='mail-cleanup-pc-b';
let account=A,lateRead,snapshotPause,writePause,pauseWriteN=0,badCandidate=false,failNth=0,writeN=0;
const messages=new Map([[A,new Map()],[B,new Map()]]);
const calls=[];
const add=(id,fields={},owner=A)=>messages.get(owner).set(id,{id,claimed:true,archived:false,reward:null,created_at:new Date(1e6+id*1000).toISOString(),...fields});
const rows=(owner,archived)=>[...messages.get(owner).values()].filter(x=>x.archived===archived).sort((a,b)=>b.id-a.id);
const deferred=()=>{let release,started;const wait=new Promise(r=>release=r),seen=new Promise(r=>started=r);return {release,seen,wait,started};};
const profile={nickname:'Fixture'};
const client={atomicMail:true,auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user:{id:account,email:'fixture@example.invalid'}}}),signOut:async()=>({})},
 from(table){let user=account,archived,limit=Infinity;const q={select:()=>q,eq(k,v){if(k==='user_id')user=v;if(k==='archived')archived=v;return q;},order:()=>q,limit(n){limit=n;return q;},maybeSingle:async()=>({data:table===CLOUD.tables.profiles?profile:{merged:true,updated_at:'stamp-0',data:{...P.empty(),nick:'Fixture'}}}),
 then(resolve,reject){const query=async()=>{
  if(table!==SHOP.tables.mail)return {data:[]};
  const data=structuredClone(rows(user,archived).slice(0,limit));
  if(lateRead&&archived===false){const h=lateRead;lateRead=null;h.started();await h.wait;}
  return {data};
 };return query().then(resolve,reject);}};return q;},
 async rpc(name,args){
  if(name==='hd3d_my_status')return {data:{admin:false,owner:false,banned:false}};
  const user=account,restore=args.p_restore===true;
  if(name==='hd3d_mail_archive_candidates'){
   calls.push({name,user,args:structuredClone(args)});
   if(badCandidate)return {error:{code:'NETWORK_ERROR',message:'snapshot failed'}};
   const ids=rows(user,restore).filter(x=>restore||x.claimed).map(x=>x.id);
   if(snapshotPause){const h=snapshotPause;snapshotPause=null;h.started();await h.wait;}
   return {data:{ok:true,ids}};
  }
  if(name==='hd3d_mail_archive'){
   calls.push({name,user,args:structuredClone(args)});assert.ok(args.p_ids.length>0&&args.p_ids.length<=100);writeN++;
   if(writePause&&writeN===pauseWriteN){const h=writePause;writePause=null;h.started();await h.wait;}
   if(writeN===failNth)return {error:{code:'NETWORK_ERROR',message:'archive failed'}};
   const ids=[],skipped=[];
   for(const id of args.p_ids){const row=messages.get(user).get(id);if(!row||row.archived!==restore||!restore&&!row.claimed){skipped.push(id);continue;}row.archived=!restore;ids.push(id);}
   return {data:{ok:true,ids,skipped,restored:restore}};
  }
  if(name==='hd3d_claim_mail')return {data:{ok:false,deferred:true,reason:'capacity',got:[],serverSaved:true}};
  throw Error('Unexpected RPC '+name);
 }};
globalThis.window={__hd3dCloudMock:()=>client};
const Acc=await import('../src/account/account.js');
const Shop=await import('../src/account/shop.js');
const login=async u=>{account=u;await Acc.signIn('fixture@example.invalid','unused');await Shop.refresh();};
const pendingKey=CLOUD.storagePrefix+'_mailpend_'+A;
const writes=()=>calls.filter(c=>c.name==='hd3d_mail_archive');
const reset=()=>{writeN=failNth=0;calls.length=0;};
for(let i=1;i<=221;i++)add(i);
add(222,{claimed:false});add(223,{claimed:true});add(224,{claimed:false,revoked:true});
add(997,{archived:true});add(800,{archived:true},B);
await login(A);assert.equal(Shop.S.mail.length,100,'bounded UI page');
mem.set(pendingKey,JSON.stringify([223]));
const stale=deferred(),snap=deferred();lateRead=stale;snapshotPause=snap;
const before=Shop.refresh();await stale.seen;
const deleting=Shop.cleanupMail();await snap.seen;
assert.equal((await Shop.cleanupMail()).ok,false,'second click must not create another batch');
add(225);const secondBatch=deferred();writePause=secondBatch;pauseWriteN=2;snap.release();
await secondBatch.seen;
stale.release();await before;
assert.ok(Shop.S.mail.every(m=>!messages.get(A).get(m.id).archived),'late read resurrected an already archived receipt before the next batch');
secondBatch.release();
assert.equal((await deleting).ok,true);await before;
mem.delete(pendingKey);
assert.equal(calls.filter(c=>c.name==='hd3d_mail_archive_candidates').length,1,'exactly one fixed candidate snapshot');
const ids=writes().flatMap(c=>c.args.p_ids);
assert.equal(ids.length,221);assert.equal(new Set(ids).size,221);assert.ok(writes().length>=3);
for(const id of [222,223,224,225]){assert.ok(!ids.includes(id));assert.equal(messages.get(A).get(id).archived,false);}
assert.equal(rows(A,true).length,222);
assert.deepEqual(new Set(Shop.S.mail.map(m=>m.id)),new Set([222,223,224,225]),'obsolete same-account read must not resurrect archived IDs');
assert.equal(Acc.load().souls,0);
console.log('PASS PC cleanup takes a fixed 221-ID snapshot, excludes pending and leaves newly arrived receipts intact');

reset();
assert.equal((await Shop.cleanupMail(true)).ok,true);
assert.ok(writes().length>=3);assert.equal(rows(A,true).length,1);
assert.ok(writes().every(c=>c.args.p_restore));assert.deepEqual(Shop.S.archivedIds,[997]);
console.log('PASS Undo restores all 221 IDs from this cleanup without touching an older archive');

reset();badCandidate=true;
assert.equal((await Shop.cleanupMail()).ok,false);assert.equal(writes().length,0);assert.equal(rows(A,true).length,1);assert.equal(Shop.S.mailAction,null);
badCandidate=false;reset();failNth=2;
assert.equal((await Shop.cleanupMail()).ok,false);assert.equal(writes().length,2,'stop after failed batch');assert.equal(rows(A,true).length,1+writes()[0].args.p_ids.length);assert.equal(Shop.S.mailAction,null);
reset();
assert.equal((await Shop.cleanupMail()).ok,true);assert.ok(writes().length>=2);assert.equal(rows(A,true).length,224);
console.log('PASS candidate error does not write; partial archive stops after error and retries remaining receipts');

reset();const handoff=deferred();snapshotPause=handoff;
add(300);const old=Shop.cleanupMail();await handoff.seen;
await Acc.signOut();await login(B);handoff.release();
assert.equal((await old).ok,false);assert.equal(writes().length,0);assert.deepEqual(Shop.S.archivedIds,[800]);assert.equal(Shop.S.mailAction,null);
console.log('PASS late A snapshot cannot dispatch writes against B');
await Acc.signOut();
