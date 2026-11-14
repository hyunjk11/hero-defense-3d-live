import assert from 'node:assert/strict';
import {empty} from '../src/account/progress.js';
import {makeItem,chestOf} from '../src/account/equip.js';
import {applyGear,gearArgs} from '../src/account/direct-economy.js';
import {CLOUD} from '../src/config/cloud.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
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
  if(name==='hd3d_growth_progress')return {data:{ok:true,xp:10}};
  if(name==='hd3d_normal_pending')return {data:[...receipts.entries()].filter(([k,r])=>k.startsWith(uid+'~')&&r.next<r.total).map(([,r])=>structuredClone(r))};
  const id=uid+'~'+args.p_token;let data=receipts.get(id);
  if(name==='hd3d_normal_settle'){
   if(!data){data={token:args.p_token,ok:true,next:0,total:2,loot:[]};receipts.set(id,data);cloud().data.souls+=50;cloud().data.stats.runs++;cloud().updated_at='stamp-'+(++counter);commits++;}
  }else if(name==='hd3d_normal_loot'){
   assert.ok(data);if(args.p_index===data.next){data.next++;data.loot.push({id:'loot-'+id+'-'+args.p_index});cloud().data.mat.steel++;cloud().updated_at='stamp-'+(++counter);commits++;}
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
const input=token=>({args:{p_token:token,p_wave:10,p_kills:40,p_stars:3,p_drops:[]},checkpoint:{run:{token,stage:'1-1'},completed:10,win:true,stars:3}});
let release,started;const seen=new Promise(r=>started=r);pause={at:'hd3d_normal_settle',started,wait:new Promise(r=>release=r)};
const first=Normal.runDirectNormal(input('normal-one'));await seen;
assert.ok(Acc.serverSaveState()?.busy);assert.throws(()=>Acc.store({...Acc.load(),hero:'archer'}));await assert.rejects(Normal.runDirectNormal(input('normal-two')));release();
assert.equal((await first).next,2);assert.equal(Acc.load().souls,50);assert.equal(Acc.load().mat.steel,2);assert.equal(Acc.serverSaveState(),null);assert.ok(!journal());
console.log('PASS normal double click and purchase guard stays until all loot and reload acknowledge');
loseAt=commits+1;await assert.rejects(Normal.runDirectNormal(input('normal-loss-root')),/lost/);const afterRoot=commits;assert.ok(journal());await Normal.runDirectNormal();assert.equal(commits,afterRoot+2);assert.equal(Acc.load().souls,100);
console.log('PASS unknown currency commit resumes the same normal root once');
loseAt=commits+2;await assert.rejects(Normal.runDirectNormal(input('normal-loss-loot')),/lost/);const afterLoot=commits;await Normal.runDirectNormal();assert.equal(commits,afterLoot+1);assert.equal(Acc.load().souls,150);
console.log('PASS unknown first loot commit resumes the same cursor without another grant');
// No local journal: an authenticated pending account receipt is sufficient.
loseAt=commits+2;await assert.rejects(Normal.runDirectNormal(input('normal-no-journal')),/lost/);memory.delete(CLOUD.storagePrefix+'_direct_normal_'+current.id);const afterLostJournal=commits;await Normal.runDirectNormal();assert.equal(commits,afterLostJournal+1);assert.equal(Acc.serverSaveState(),null);
console.log('PASS missing local journal recovers through the exact durable guard token');
failRead=true;await assert.rejects(Normal.runDirectNormal(input('normal-read-loss')));assert.ok(journal());await Acc.reloadAuthoritative();const beforeResume=commits;await Normal.runDirectNormal();assert.equal(commits,beforeResume);assert.equal(Acc.serverSaveState(),null);
console.log('PASS final reload failure preserves journal and resolves already-complete receipt');
let unblock,onStarted;const pending=new Promise(r=>onStarted=r);pause={at:'hd3d_normal_loot',started:onStarted,wait:new Promise(r=>unblock=r)};
const late=Normal.runDirectNormal(input('normal-switch'));await pending;await Acc.signOut();current={id:'normal-b',email:'b@example.invalid'};await Acc.signIn(current.email,'unused');unblock();await assert.rejects(late);assert.equal(Acc.load().souls,0);assert.equal(Acc.serverSaveState(),null);
await Acc.signOut();current={id:'gear-ui-a',email:'a@example.invalid'};await Acc.signIn(current.email,'unused');
for(let i=0;i<200&&journal();i++)await new Promise(r=>setTimeout(r,1));
assert.ok(!journal());assert.equal(Acc.load().souls,300);assert.equal(Acc.load().mat.steel,12);assert.equal(Acc.serverSaveState(),null);
console.log('PASS late A response cannot mutate B and A reconnect resumes the same normal receipt');
await Acc.signOut();
