import assert from 'node:assert/strict';
import {empty} from '../src/account/progress.js';
import {makeItem,chestOf} from '../src/account/equip.js';
import {applyGear,gearArgs} from '../src/account/direct-economy.js';
import {CLOUD} from '../src/config/cloud.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let current={id:'gear-ui-a',email:'a@example.invalid'},counter=0,pause=null,loseAt=0,commits=0,failRead=false;
const states=new Map(),receipts=new Map();
function fresh(){const data=empty();data.nick='Tester';for(let i=0;i<4;i++){const it=makeItem('armor',undefined,i,()=>.4,3);it.id='ui-gear-'+i;data.chests.push(chestOf(it,'chest'));}return {data,merged:true,updated_at:'stamp-0'};}
const cloud=()=>{if(!states.has(current.id))states.set(current.id,fresh());return states.get(current.id);};
const client={atomicGear:true,auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user:current}}),signOut:async()=>({})},
 from(table){let op='select',values,filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},update(v){op='update';values=v;return q;},insert(v){op='update';values=v;return q;},upsert:async()=>({}),
 maybeSingle:async()=>{if(table===CLOUD.tables.profiles)return {data:{nickname:'Tester'}};if(failRead){failRead=false;return {error:{code:'NETWORK_ERROR',message:'reload lost'}};}return {data:structuredClone(cloud())};},
 then(resolve,reject){let value;if(op==='update'){if(filters.updated_at!==cloud().updated_at)value={data:[]};else{Object.assign(cloud(),values,{updated_at:'stamp-'+(++counter)});value={data:[{updated_at:cloud().updated_at}]};}}else value={data:[]};return Promise.resolve(value).then(resolve,reject);}};return q;},
 async rpc(name,args){assert.equal(name,'hd3d_gear_action');const id=current.id+'~'+args.p_id,old=receipts.get(id);let data;
  if(old)data={...old,already:true};else{const input=gearArgs(args);if(input.action==='reroll_apply')input.sub=receipts.get(current.id+'~'+input.source).sub;const r=applyGear(cloud().data,input,()=>.4);data={...r.result,id:args.p_id,action:args.p_action};if(data.ok){cloud().data=r.save;cloud().updated_at='stamp-'+(++counter);receipts.set(id,data);commits++;}}
  if(pause){const p=pause;pause=null;p.started();await p.wait;}
  if(loseAt&&commits===loseAt){loseAt=0;return {error:{code:'NETWORK_ERROR',message:'response lost'}};}
  return {data:structuredClone(data)};
 }
};
globalThis.window={__hd3dCloudMock:()=>client};
const Acc=await import('../src/account/account.js');await Acc.signIn(current.email,'unused');
const Gear=await import('../src/account/direct-gear-client.js');
assert.throws(()=>Acc.store({...Acc.load(),souls:999}),e=>e.code==='DIRECT_ACTION_REQUIRED');
assert.equal(Acc.load().souls,0);console.log('PASS unimplemented direct mutation fails before changing the local save');
const command=i=>({p_action:'open',p_item:'cui-gear-'+i});
let release,started;const seen=new Promise(r=>started=r);pause={started,wait:new Promise(r=>release=r)};
const first=Gear.runDirectGear([command(0)]);await seen;
assert.ok(Acc.serverSaveState()?.busy);assert.throws(()=>Acc.store({...Acc.load(),hero:'archer'}));await assert.rejects(Gear.runDirectGear([command(0)]));release();
assert.equal((await first)[0].ok,true);assert.equal(Acc.load().souls,4);assert.equal(Acc.serverSaveState(),null);assert.equal(commits,1);
console.log('PASS double click and local purchases are guarded until authoritative reload');
loseAt=3;await assert.rejects(Gear.runDirectGear([command(1),command(2)]),/lost/);
assert.equal(Gear.pendingGear().index,1);assert.equal(Acc.load().inv.length,1);assert.equal(states.get(current.id).data.inv.length,3);
const retried=await Gear.runDirectGear();assert.equal(retried.length,2);assert.equal(commits,3);assert.equal(Acc.load().inv.length,3);assert.equal(Acc.load().souls,20);
console.log('PASS partial batch and unknown second commit retain original receipt IDs and recover once');
failRead=true;await assert.rejects(Gear.runDirectGear([{p_action:'store',p_item:'ui-gear-0'}]));assert.ok(Gear.pendingGear());
await Gear.runDirectGear();assert.equal(commits,4);assert.equal(Acc.load().stor.length,1);assert.equal(Acc.serverSaveState(),null);
console.log('PASS failed post-commit reload does not release the save guard or replay the move');
let unblock,onStarted;const pending=new Promise(r=>onStarted=r);pause={started:onStarted,wait:new Promise(r=>unblock=r)};
const late=Gear.runDirectGear([command(3)]);await pending;await Acc.signOut();current={id:'gear-ui-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');unblock();await assert.rejects(late);
assert.equal(Acc.load().souls,0);assert.equal(Acc.load().inv.length,0);assert.equal(Acc.serverSaveState(),null);
await Acc.signOut();current={id:'gear-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');
// Auto recovery on hydration owns the same journal and does not create another.
for(let i=0;i<100&&Gear.pendingGear();i++)await new Promise(r=>setTimeout(r,1));
assert.equal(Gear.pendingGear(),null);assert.equal(Acc.load().souls,36);assert.equal(commits,5);assert.equal(Acc.serverSaveState(),null);
console.log('PASS A response cannot mutate B; returning to A recovers its original journal');
// Paid reroll candidates survive lost responses and remain account-scoped.
cloud().data.mat.steel=1000;await Acc.reloadAuthoritative();
loseAt=commits+1;await assert.rejects(Gear.runDirectGear([{p_action:'reroll',p_item:'ui-gear-2'}]),/lost/);
const beforeRollCommits=commits;await Gear.runDirectGear();assert.equal(commits,beforeRollCommits);
const pendingRoll=Gear.pendingReroll();assert.equal(pendingRoll.id,'ui-gear-2');assert.equal(Acc.load().mat.steel,960);
await Acc.signOut();current={id:'gear-ui-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');assert.equal(Gear.pendingReroll(),null);
await Acc.signOut();current={id:'gear-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');assert.deepEqual(Gear.pendingReroll(),pendingRoll);
const apply=[{p_action:'reroll_apply',p_item:pendingRoll.id,p_source:pendingRoll.source}];
await Gear.runDirectGear(apply);assert.equal(Gear.pendingReroll(),null);assert.deepEqual(Acc.load().inv.find(it=>it.id===pendingRoll.id).sub,pendingRoll.sub);assert.equal(Acc.load().mat.steel,960);
await Gear.runDirectGear(apply);assert.equal(commits,beforeRollCommits+1);assert.equal(Gear.pendingReroll(),null);
await Gear.runDirectGear([{p_action:'reroll',p_item:'ui-gear-2'}]);Gear.keepReroll();assert.equal(Gear.pendingReroll(),null);assert.equal(Acc.load().mat.steel,920);
console.log('PASS paid reroll candidate recovers exactly once, stays isolated across accounts, and keep never refunds');
await Acc.signOut();
