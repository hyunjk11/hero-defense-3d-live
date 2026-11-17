import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import {CLOUD} from '../src/config/cloud.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const never=()=>new Promise(()=>{});
function fixture(fetch,token=async()=>'mock'){
 const user={uid:'timeout-qa',email:'qa@example.invalid',getIdToken:token};
 const auth={currentUser:user,authStateReady:async()=>{}};
 const sdk={getApps:()=>[{name:'hero-defense-live',options:CLOUD.firebase}],getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:{},onAuthStateChanged:()=>()=>{},signInWithEmailAndPassword:async()=>({user:auth.currentUser}),signOut:async()=>{auth.currentUser=null;}};
 return {user,auth,sdk,fetch,client:()=>createFirebaseClient(CLOUD,{sdk,fetch,requestTimeoutMs:25})};
}
test('never-ending fetch expires, aborts, drains, and fences writes queued before timeout',async()=>{
 let calls=0,signal;const f=fixture(async(_u,o)=>{calls++;signal=o.signal;return never();}),c=await f.client();
 const a=c.rpc('write-first'),b=c.rpc('write-second'),d=c.drain();
 assert.equal((await a).error.code,'REQUEST_TIMEOUT');assert.equal((await b).error.code,'REQUEST_TIMEOUT');await d;
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});
test('deadline includes body read and ignores late success without transport replay',async()=>{
 let release,calls=0;const c=await fixture(async()=>{calls++;return {ok:true,status:200,json:()=>new Promise(r=>release=r)};}).client();
 const result=await c.rpc('write');assert.equal(result.data,null);assert.equal(result.error.uncertain,true);
 release({data:{ok:true}});await sleep(5);assert.equal(result.error.code,'REQUEST_TIMEOUT');assert.equal(calls,1);
});
test('late token cannot send after timeout; read request remains available for recovery',async()=>{
 let release,calls=0;const f=fixture(async()=>{calls++;return Response.json({data:{ok:true}});},()=>new Promise(r=>release=r)),c=await f.client();
 assert.equal((await c.rpc('write')).error.code,'REQUEST_TIMEOUT');release('late');await sleep(5);assert.equal(calls,0);
 f.user.getIdToken=async()=>'mock';assert.equal((await c.from('hd3d_progress').select()).data.ok,true);
});
test('ordinary queued writes retain ordering, deadlines are cleared and next write works',async()=>{
 let release,calls=[];const c=await fixture(async(_u,o)=>{const name=JSON.parse(o.body).name;calls.push(name);if(name==='first')await new Promise(r=>release=r);return Response.json({data:{ok:true}});}).client();
 const a=c.rpc('first'),b=c.rpc('second');await sleep(5);assert.deepEqual(calls,['first']);release();assert.equal((await a).data.ok,true);assert.equal((await b).data.ok,true);
 await sleep(30);assert.equal((await c.rpc('third')).data.ok,true);assert.deepEqual(calls,['first','second','third']);
});
test('late old-account response and queued writes never mutate or send as new account',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return never();}),c=await f.client();const a=c.rpc('first'),b=c.rpc('second');await sleep(5);
 f.auth.currentUser={uid:'other',getIdToken:async()=>'other'};
 assert.equal((await a).error.code,'ACCOUNT_CHANGED');assert.equal((await b).error.code,'ACCOUNT_CHANGED');assert.equal(calls,1);
});
test('real account/gear journal survives timed-out committed batch and replays same receipt exactly once',async()=>{
 const {FirestoreStore}=await import('../server/firestore.mjs');
 const {FirestoreTransport}=await import('./support/firestore-transport.mjs');
 const {runEconomyOperation}=await import('../server/economy.mjs');
 const P=await import('../src/account/progress.js'),E=await import('../src/account/equip.js');
 const {packSave}=await import('../src/account/storage.js');
 const mem=new Map();globalThis.localStorage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
 globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.addEventListener=()=>{};globalThis.location={hostname:'localhost',search:''};
 let now=1800000000000,drop=false,hold=false,entered,release,ids=[];
 const save=P.empty();save.nick='QA';for(let i=0;i<2;i++){const it=E.makeItem('armor',null,0,()=>.4,1);it.id='timeout-item-'+i;save.chests.push(E.chestOf(it,'chest'));}
 const db=new FirestoreTransport({hd3d_progress:[{user_id:'timeout-qa',data:packSave(save),merged:true,updated_at:new Date(now).toISOString()}],hd3d_profiles:[{id:'timeout-qa',nickname:'QA'}]}),store=new FirestoreStore(db.request);
 const f=fixture(async(_u,o)=>{
   const op=JSON.parse(o.body);if(op.name==='hd3d_gear_batch')ids.push(op.args.commands.map(c=>c.p_id));
   if(hold&&op.name==='hd3d_gear_batch'){hold=false;entered();await new Promise(r=>release=r);if(o.signal.aborted)throw Error('aborted before dispatch');}
   const r=await runEconomyOperation(store,{id:f.auth.currentUser.uid,email:'qa@example.invalid'},op,{now:++now});
   if(drop&&op.name==='hd3d_gear_batch'){drop=false;return never();}return Response.json(r);
 });
 const client=await createFirebaseClient(CLOUD,{sdk:f.sdk,fetch:f.fetch,requestTimeoutMs:100});
 globalThis.window={__hd3dCloudMock:()=>client};const Acc=await import('../src/account/account.js');await Acc.signIn('qa@example.invalid','unused');const Gear=await import('../src/account/direct-gear-client.js');
 const commands=i=>[{p_action:'open',p_item:'ctimeout-item-'+i}];
 drop=true;await assert.rejects(Gear.runDirectGear(commands(0)),e=>e.code==='REQUEST_TIMEOUT');
 assert.equal(Acc.serverSaveState().busy,false);assert.equal(Gear.pendingGear().index,0);assert.equal(Acc.load().inv.length,0);assert.equal(P.clean(db.rows('hd3d_progress')[0].data).inv.length,1);
 // Existing recovery repeats the original journal, never a newly generated ID.
 await Gear.runDirectGear();assert.deepEqual(ids[0],ids[1]);assert.equal(Acc.load().inv.length,1);assert.equal(db.rows('hd3d_growth_investments').length,1);assert.equal(Acc.serverSaveState(),null);
 const begun=new Promise(r=>entered=r);hold=true;const first=Gear.runDirectGear(commands(1));await begun;
 await assert.rejects(Gear.runDirectGear(commands(1)));await assert.rejects(first,e=>e.code==='REQUEST_TIMEOUT');
 assert.equal(Acc.serverSaveState().busy,false);assert.equal(P.clean(db.rows('hd3d_progress')[0].data).inv.length,1);release();await sleep(5);
 await Gear.runDirectGear();assert.deepEqual(ids[2],ids[3]);assert.equal(Acc.load().inv.length,2);assert.equal(db.rows('hd3d_growth_investments').length,2);assert.equal(Acc.serverSaveState(),null);assert.equal(Gear.pendingGear(),null);
 await Acc.signOut();
});
