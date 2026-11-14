import assert from 'node:assert/strict';
import {empty} from '../src/account/progress.js';
import {makeItem,chestOf} from '../src/account/equip.js';
import {applyGear,gearArgs} from '../src/account/direct-economy.js';
import {CLOUD} from '../src/config/cloud.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let capacity=false;
let current={id:'gear-ui-a',email:'a@example.invalid'},counter=0,pause=null,loseAt=0,commits=0,failRead=false;
const states=new Map(),receipts=new Map();
function fresh(){const data=empty();data.nick='Tester';return {data,merged:true,updated_at:'stamp-0'};}
const cloud=()=>{if(!states.has(current.id))states.set(current.id,fresh());return states.get(current.id);};
const client={atomicGear:true,auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user:current}}),signOut:async()=>({})},
 from(table){let op='select',values,filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},update(v){op='update';values=v;return q;},insert(v){op='update';values=v;return q;},upsert:async()=>({}),
 maybeSingle:async()=>{if(table===CLOUD.tables.profiles)return {data:{nickname:'Tester'}};if(failRead){failRead=false;return {error:{code:'NETWORK_ERROR',message:'reload lost'}};}return {data:structuredClone(cloud())};},
 then(resolve,reject){let value;if(op==='update'){if(filters.updated_at!==cloud().updated_at)value={data:[]};else{Object.assign(cloud(),values,{updated_at:'stamp-'+(++counter)});value={data:[{updated_at:cloud().updated_at}]};}}else value={data:[]};return Promise.resolve(value).then(resolve,reject);}};return q;},

 async rpc(name,args){
  const uid=current.id;
  if(name==='hd3d_growth_status')return {data:{ok:true,version:1,growth:{version:1,rev:0,xp:{},balance:0}}};
  if(name==='hd3d_normal_pending')return {data:[...receipts.entries()].filter(([k,r])=>k.startsWith(uid+'~')&&!r.hardSaved).map(([,r])=>structuredClone(r))};
  const id=uid+'~'+args.p_token,data=receipts.get(id);assert.ok(data);
  if(name==='hd3d_growth_progress'){
   if(capacity)return {data:{...structuredClone(data),ok:false,reason:'capacity',deferred:true}};
   assert.equal(args.p_finish,true);assert.equal(args.p_completed,data.completed);assert.equal(args.p_kills,data.kills);
   if(!data.hardSaved){data.hardSaved=true;cloud().data.souls+=50;cloud().data.stats.runs++;cloud().data.hardRewardSeq=(cloud().data.hardRewardSeq||0)+1;cloud().updated_at='stamp-'+(++counter);commits++;}
  }else assert.equal(name,'hd3d_normal_status');
  if(pause&&name===pause.at){const p=pause;pause=null;p.started();await p.wait;}
  if(loseAt&&commits===loseAt){loseAt=0;return {error:{code:'NETWORK_ERROR',message:'response lost'}};}
  return {data:structuredClone(data)};
 }
};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(_k,fn)=>fn()}},configurable:true});
globalThis.window={__hd3dCloudMock:()=>client};
const Acc=await import('../src/account/account.js');await Acc.signIn(current.email,'unused');
const Normal=await import('../src/account/direct-normal-client.js');

const journal=()=>memory.get(CLOUD.storagePrefix+'_direct_normal_'+current.id);
const pending=token=>receipts.set(current.id+'~'+token,{kind:'hard',token,ok:true,completed:5,win:false,stars:0,kills:11,hardSaved:false});
let release,started;const seen=new Promise(r=>started=r);pause={at:'hd3d_growth_progress',started,wait:new Promise(r=>release=r)};
pending('hard-client-one');const first=Normal.runDirectNormal();await seen;
assert.ok(Acc.serverSaveState()?.busy);assert.throws(()=>Acc.store({...Acc.load(),hero:'archer'}));await assert.rejects(Normal.runDirectNormal());release();
assert.equal((await first).hardSaved,true);assert.equal(Acc.load().souls,50);assert.equal(Acc.serverSaveState(),null);assert.ok(!journal());
console.log('PASS hard recovery blocks concurrent purchase and duplicate click through reload');
pending('hard-lost-final');loseAt=commits+1;await assert.rejects(Normal.runDirectNormal(),/lost/);memory.delete(CLOUD.storagePrefix+'_direct_normal_'+current.id);
const before=commits;const recovered=await Normal.runDirectNormal();assert.equal(recovered.kind,'hard');assert.equal(recovered.hardSaved,true);assert.equal(commits,before);assert.equal(Acc.serverSaveState(),null);assert.equal(Acc.load().souls,100);
console.log('PASS journal deletion with surviving exact guard resolves final hard receipt without another payment');
pending('hard-before-final');const guard=Acc.beginServerSave('normal:hard-before-final');assert.ok(Acc.markServerSave(guard));Acc.finishServerSave(guard,false);
const recoveredPending=await Normal.runDirectNormal();assert.equal(recoveredPending.hardSaved,true);assert.equal(Acc.load().souls,150);assert.equal(Acc.serverSaveState(),null);
console.log('PASS guard-only pending hard receipt completes payment rather than clearing guard prematurely');
pending('hard-reload-loss');failRead=true;await assert.rejects(Normal.runDirectNormal());assert.ok(journal());await Acc.reloadAuthoritative();const beforeReload=commits;await Normal.runDirectNormal();assert.equal(commits,beforeReload);assert.equal(Acc.serverSaveState(),null);
console.log('PASS failed authoritative reload keeps durable hard recovery and does not repeat payment');
let unblock,onStarted;const seenLate=new Promise(r=>onStarted=r);pause={at:'hd3d_growth_progress',started:onStarted,wait:new Promise(r=>unblock=r)};
pending('hard-account-switch');const late=Normal.runDirectNormal();await seenLate;await Acc.signOut();current={id:'hard-client-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');unblock();await assert.rejects(late);assert.equal(Acc.load().souls,0);assert.equal(Acc.serverSaveState(),null);
await Acc.signOut();current={id:'gear-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');
for(let i=0;i<200&&journal();i++)await new Promise(r=>setTimeout(r,1));
assert.ok(!journal());assert.equal(Acc.load().souls,250);assert.equal(Acc.load().hardRewardSeq,5);assert.equal(Acc.serverSaveState(),null);
console.log('PASS A late hard reply cannot change B; reconnect recovers exactly five final receipts');
capacity=true;pending('hard-capacity-deferred');const beforeCap=commits;
const deferred=await Normal.runDirectNormal();assert.equal(deferred.reason,'capacity');assert.equal(deferred.deferred,true);
assert.equal(Acc.serverSaveState(),null);assert(Acc.saveAllowed());assert(journal());assert.equal(commits,beforeCap);
await new Promise(r=>setTimeout(r,25));assert.equal(commits,beforeCap);
capacity=false;const resumed=await Normal.runDirectNormal();assert(resumed.hardSaved);assert.equal(commits,beforeCap+1);assert(!journal());assert.equal(Acc.serverSaveState(),null);
console.log('PASS confirmed capacity deferral unlocks purchases, retains journal, stops automatic looping and resumes once');
await Acc.signOut();
