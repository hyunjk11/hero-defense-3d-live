// In-memory transport only. No production requests or account credentials.
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
test('preset save/apply response loss preserves receipts, restores authoritative state and increments revision once',async()=>{
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
   if(drop&&['hd3d_gear_batch','hd3d_gear_action'].includes(op.name)){drop=false;return never();}return Response.json(r);
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

 const {loadoutStamp}=await import('../src/account/loadouts.js');
 const getSave=()=>P.clean(db.rows('hd3d_progress')[0].data), rev=()=>db.rows('hd3d_growth_wallet')[0]?.rev||0;
 drop=true;
 await assert.rejects(Gear.runDirectGear([{p_action:'preset_save',p_count:0,p_hero:'mage',p_partner:'archer',p_expected:loadoutStamp(getSave(),rev())}]),e=>e.code==='REQUEST_TIMEOUT');
 const saveId=Gear.pendingGear().commands[0].p_id;
 assert(getSave().battlePresets[0]);await Gear.runDirectGear();assert.equal(Gear.pendingGear(),null);
 assert.equal(db.rows('hd3d_growth_investments').filter(r=>r.id.endsWith(saveId)).length,1);
 const beforeRev=rev();drop=true;
 await assert.rejects(Gear.runDirectGear([{p_action:'preset_apply',p_count:0,p_expected:loadoutStamp(getSave(),rev())}]),e=>e.code==='REQUEST_TIMEOUT');
 assert.equal(rev(),beforeRev+1);const applyId=Gear.pendingGear().commands[0].p_id;
 await Gear.runDirectGear();assert.equal(rev(),beforeRev+1);assert.equal(Acc.load().battlePartner,'archer');assert.equal(Gear.pendingGear(),null);
 assert.equal(db.rows('hd3d_growth_investments').filter(r=>r.id.endsWith(applyId)).length,1);
 await Acc.signOut();
});
