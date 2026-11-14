import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFirebaseClient} from '../src/account/firebase-client.js';
import * as Nav from '../src/core/nav.js';
import {settleNavigation} from '../src/account/navigation-save.js';
import {deferred,pause} from './support/firestore-transport.mjs';
globalThis.localStorage={setItem(){},removeItem(){}};
const user=uid=>({uid,getIdToken:async()=>uid});
async function client(fetch){const auth={currentUser:user('a'),authStateReady:async()=>{}};const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:'fake'};
 return {auth,client:await createFirebaseClient({firebase:{},apiUrl:'/fake',authStorageKey:'offline-qa'},{sdk,fetch})};}
test('same account mutations are serial; readonly queries remain parallel and drain waits for queued work',async()=>{
 const start=deferred(),release=deferred(),calls=[];const {client:c}=await client(async(_u,o)=>{const op=JSON.parse(o.body);calls.push(op);if(op.name==='hd3d_growth_invest'){start.resolve();await release.promise;}return Response.json({data:true});});
 const first=c.rpc('hd3d_growth_invest',{});await start.promise;const second=c.rpc('hd3d_claim_mail',{});await c.from('hd3d_progress').select();
 try{await pause(5);assert.equal(calls.length,2);assert.equal(calls[1].action,'select');}finally{release.resolve();await Promise.all([first,second]);}
 assert.equal(typeof c.drain,'function');await c.drain();assert.equal(calls.at(-1).name,'hd3d_claim_mail');
});
test('queued account A mutation is never sent as B; B is not blocked by A',async()=>{
 const start=deferred(),release=deferred(),calls=[];const {auth,client:c}=await client(async(_u,o)=>{calls.push(o.headers.Authorization);if(calls.length===1){start.resolve();await release.promise;}return Response.json({data:true});});
 const a=c.rpc('hd3d_growth_invest');await start.promise;const queued=c.rpc('hd3d_claim_mail');await pause(1);auth.currentUser=user('b');
 const b=c.rpc('hd3d_growth_status');const resultB=await b;release.resolve();const [,resultA]=await Promise.all([a,queued]);assert.equal(resultB.data,true);assert.equal(resultA.error?.code,'ACCOUNT_CHANGED');assert.deepEqual(calls,['Bearer a','Bearer b']);
});
test('failed/response-lost mutation is not automatically replayed and does not poison the next operation',async()=>{
 let n=0;const {client:c}=await client(async()=>{if(++n===1)throw Error('response lost');return Response.json({data:2});});
 const [a,b]=await Promise.all([c.rpc('hd3d_claim_mail'),c.rpc('hd3d_growth_status')]);assert.equal(a.status,0);assert.equal(b.data,2);assert.equal(n,2);
});
test('navigation does not cancel pending writes and repeated clicks navigate once',async()=>{
 assert.equal(typeof Nav.configureNavigation,'function');let moved=0,waiting=0;const release=deferred();globalThis.location={search:'?stage=1-1&run=1',pathname:'/game',replace(){moved++;}};
 Nav.configureNavigation({beforeLeave:()=>release.promise,onWaiting:v=>{waiting+=v?1:-1;}});
 const a=Nav.go({town:1},0),b=Nav.go({stage:'1-2'},0);await pause(5);assert.equal(moved,0);assert.equal(waiting,1);release.resolve(true);await Promise.all([a,b]);assert.equal(moved,1);assert.equal(waiting,0);
});
test('unsafe local checkpoint/account change prevents navigation; failure permits a new attempt',async()=>{
 assert.equal(typeof Nav.configureNavigation,'function');let moved=0,errors=0;globalThis.location={search:'',pathname:'/',replace(){moved++;}};
 Nav.configureNavigation({beforeLeave:async()=>false,onCancel:()=>errors++});assert.equal(await Nav.go({town:1},0),false);assert.equal(moved,0);assert.equal(errors,1);
 Nav.configureNavigation({beforeLeave:async()=>true});assert.equal(await Nav.go({town:1},0),true);assert.equal(moved,1);
});
test('navigation waits for local checkpoint, save, XP outbox and network drain in order',async()=>{
 const gate=deferred(),steps=[],Acc={A:{user:{id:'a'},sb:{drain:async()=>steps.push('drain')}},sessionId:()=>1,flush:async()=>{steps.push('save');await gate.promise;return true;}};
 const HG={HG:{pending:0},retry:async()=>{steps.push('xp');return true;}};let moved=false;
 const p=settleNavigation(Acc,HG,{xpPendingWrite:Promise.resolve(true)}).then(x=>{moved=x;});await pause(5);assert.equal(moved,false);assert.deepEqual(steps,['save']);gate.resolve();await p;assert.equal(moved,true);assert.deepEqual(steps,['save','xp','drain']);
});
test('remote 503 is not an acknowledgement; navigation retains journals and reports deferred sync',async()=>{
 const journal={save:{souls:10},xp:{token:'stable-id',completed:1}},before=structuredClone(journal),messages=[];
 const Acc={A:{user:{id:'a'},sb:{drain:async()=>{}}},sessionId:()=>1,flush:async()=>false};const HG={HG:{pending:1},retry:async()=>false};
 assert.equal(await settleNavigation(Acc,HG,{},m=>messages.push(m)),true);assert.equal(messages.length,1);assert.deepEqual(journal,before);
});
test('failed durable checkpoint and an account switch stop remaining work',async()=>{
 let epoch=1,calls=0;const Acc={A:{user:{id:'a'},sb:{drain:async()=>calls++}},sessionId:()=>epoch,flush:async()=>{epoch++;return true;}};const HG={HG:{pending:0},retry:async()=>calls++};
 assert.equal(await settleNavigation(Acc,HG,{xpPendingWrite:Promise.resolve(false)}),false);assert.equal(epoch,1);assert.equal(calls,0);
 assert.equal(await settleNavigation(Acc,HG,{}),false);assert.equal(calls,0);
});

test('visual transition starts after save acknowledgement, never over a delayed or cancelled save',async()=>{
 const release=deferred(),steps=[];globalThis.location={search:'',pathname:'/',replace:()=>steps.push('move')};
 Nav.configureNavigation({beforeLeave:()=>release.promise,onWaiting:v=>steps.push(v?'wait':'done'),onReady:()=>steps.push('fade')});
 const moving=Nav.go({town:1},0);await pause(5);assert.deepEqual(steps,['wait']);release.resolve(true);await moving;assert.deepEqual(steps,['wait','fade','move','done']);
 steps.length=0;Nav.configureNavigation({beforeLeave:async()=>false,onReady:()=>steps.push('fade'),onCancel:()=>steps.push('cancel')});assert.equal(await Nav.go({town:1},0),false);assert.deepEqual(steps,['cancel']);
});

test('actual result return called twice cannot fade over a pending save',async()=>{
 const text=readFileSync(new URL('../src/ui/result.js',import.meta.url),'utf8');
 const body=text.match(/export async function goTown\(\) \{([^\n]+)\}/)[1];
 let faded=false,moved=0;const release=deferred();
 globalThis.location={search:'',pathname:'/',replace:()=>moved++};
 Nav.configureNavigation({beforeLeave:()=>release.promise,onWaiting:v=>{if(v)faded=false;},onReady:()=>{faded=true;}});
 let moving;
 const goTown=new (Object.getPrototypeOf(async()=>{}).constructor)('G','$','go',body);
 const run=()=>goTown({},()=>({classList:{add(){faded=true;}}}),(to)=>moving=Nav.go(to,0));
 try{await run();await pause(1);await run();await pause(1);assert.equal(faded,false);assert.equal(moved,0);}
 finally{release.resolve(true);await moving;}
 assert.equal(faded,true);assert.equal(moved,1);
});

test('uncertain hard settlement retries its existing receipt and keeps result open on persistent failure',async()=>{
 let pending={token:'same-receipt',busy:false},refreshes=0;const steps=[];
 const A={A:{user:{id:'a'},sb:{drain:async()=>steps.push('drain')}},sessionId:()=>1,flush:async()=>true,serverSaveState:()=>pending};
 const H={HG:{pending:1},retry:async()=>false,refresh:async()=>{refreshes++;return false;}};
 assert.equal(await settleNavigation(A,H,{}),false);assert.equal(refreshes,1);assert.ok(pending);
 H.refresh=async()=>{refreshes++;pending=null;H.HG.pending=0;return true;};
 assert.equal(await settleNavigation(A,H,{}),true);assert.equal(refreshes,2);assert.deepEqual(steps,['drain','drain']);
});
