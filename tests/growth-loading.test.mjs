import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import { CLOUD } from '../src/config/cloud.js';
import * as H from '../src/data/hero-growth.js';
const values=new Map();
globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.addEventListener=()=>{}; globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>fn()}},configurable:true});
let user={id:'loading-a',email:'qa@example.invalid'}, writes=0, reads=0, statuses=0, hold=null, fail=false;
let row={data:{...P.empty(),nick:'QA'},updated_at:'v1',merged:true};
const client={auth:{onAuthStateChange(){},signInWithPassword:async()=>({data:{user}}),signOut:async()=>({})},
 from(table){let payload;const q={select(){return q},eq(){return q},limit:async()=>{reads++;return {data:[]}},
 update(v){payload=v;return q},insert(v){payload=v;return q},upsert:async()=>({}),
 maybeSingle:async()=>{reads++;return {data:table===CLOUD.tables.profiles?{nickname:'QA'}:structuredClone(row)}},
 then(resolve,reject){return (async()=>{writes++;if(hold)await hold;if(fail)return {error:{message:'network failure'}};row={...payload,updated_at:'v'+(writes+1)};return {data:[{updated_at:row.updated_at}]};})().then(resolve,reject)}};return q},
 rpc:async()=>{statuses++;return {data:{ok:true,version:1,growth:H.initialGrowth()}}}};
globalThis.window={__hd3dCloudMock:()=>client};
const Acc=await import('../src/account/account.js'),HG=await import('../src/account/hero-growth.js');
await Acc.signIn('unused','unused');
assert.equal(reads,2,'hydration reads each required row once, without empty table probes');
const before=writes;assert.equal(await Acc.flush(),true);assert.equal(writes,before,'clean flush does not write');
await HG.refresh();assert.equal(writes,before,'growth status does not rewrite clean progress');
await HG.refresh({maxAgeMs:30000});assert.equal(statuses,1,'opening the panel reuses fresh acknowledged growth');
Acc.update(s=>({...s,souls:123}));let release;hold=new Promise(r=>release=r);
const f1=Acc.flush(),f2=Acc.flush();await Promise.resolve();await Promise.resolve();
Acc.update(s=>({...s,souls:456}));release();hold=null;
assert.equal(await f1,true);assert.equal(await f2,true);assert.equal(row.data.souls,456,'flush covers edits arriving during a write');
assert.equal(writes,before+2,'concurrent flush does not duplicate the latest snapshot');
fail=true;Acc.update(s=>({...s,souls:789}));assert.equal(await Acc.flush(),false,'write failure cannot report success');
await Acc.signOut();assert.ok(values.get(CLOUD.storagePrefix+'_pending_loading-a'),'failed progress retained under original owner');
user={id:'loading-b',email:'b@example.invalid'};fail=false;row={data:{...P.empty(),nick:'QA'},updated_at:'b1',merged:true};
await Acc.signIn('unused','unused');assert.equal(HG.available(),false);await HG.refresh({maxAgeMs:30000});assert.equal(statuses,2,'freshness cache never crosses accounts');
await Acc.signOut();console.log('Hydration, clean/concurrent/failed flush, growth freshness and account isolation passed.');
