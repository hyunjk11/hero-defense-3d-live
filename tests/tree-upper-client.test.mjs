import test from 'node:test';import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';import * as P from '../src/account/progress.js';import {localGrowth} from '../src/account/growth-ledger.js';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.localStorage=storage;globalThis.sessionStorage={...storage};globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}},configurable:true});
const Acc=await import('../src/account/account.js'),C=await import('../src/account/hero-growth.js');
const save=P.empty();save.adv.mage={b:'flame',n:1};const wallets={};let hold=null,release=null,lose=false,calls=0;
function login(id){if(!wallets[id]){const wallet=H.initialGrowth();wallet.xp.mage=H.totalXP(50);wallets[id]={wallet,runs:{},investments:{},modes:{}};}
 Object.assign(Acc.A,{user:{id},mode:'account',hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null,sb:{rpc:async(name,a)=>{const uid=Acc.A.user.id;calls++;const q=localGrowth(wallets[uid],name.replace('hd3d_growth_',''),a,save,()=>true);wallets[uid]=q.doc;if(hold&&name.endsWith('_build')){hold();hold=null;await new Promise(r=>release=r);}if(lose&&name.endsWith('_build')){lose=false;throw Error('response lost after commit');}return {data:q.result,error:null};}}});for(const f of Acc.A.listeners)f();}
test('client build locks double click, disallows battle selection, recovers committed lost response once',async()=>{
 login('upper-client-a');assert.equal(await C.refresh(),true);const base=calls;
 assert.equal((await C.changeBuild('mage','flame',0,50,'weave',false)).ok,false);assert.equal(calls,base);
 const [a,b]=await Promise.all([C.changeBuild('mage','flame',0,50,'weave',true),C.changeBuild('mage','flame',0,50,'siege',true)]);assert.equal(a.ok,true);assert.equal(b.ok,false);assert.equal(wallets['upper-client-a'].wallet.rev,1);
 lose=true;assert.equal((await C.changeBuild('mage','flame',0,50,'siege',true)).reason,'pending');assert.equal(wallets['upper-client-a'].wallet.rev,2);assert.equal(await C.retry(),true);assert.equal(wallets['upper-client-a'].wallet.rev,2);assert.equal(C.HG.growth.trees.mage.flame.presets[0][50],'siege');
});
test('late A build response cannot replace B wallet or clear A durable journal',async()=>{
 login('upper-client-a');await C.refresh();let ready;const started=new Promise(r=>ready=r);hold=ready;
 const pending=C.changeBuild('mage','flame',1,50,'weave',true);await started;login('upper-client-b');release();assert.equal((await pending).reason,'account_changed');
 assert.equal(C.HG.growth,null);await C.refresh();assert.equal(C.HG.owner,'upper-client-b');assert.equal(C.HG.growth.trees,undefined);
 assert.ok(JSON.parse(values.get('hd3d_live_growth_v1_upper-client-a_outbox')).build);
 login('upper-client-a');await C.refresh();assert.equal(wallets['upper-client-a'].wallet.rev,3);assert.equal(C.HG.growth.trees.mage.flame.presets[1][50],'weave');assert.equal(JSON.parse(values.get('hd3d_live_growth_v1_upper-client-a_outbox')).build,null);
});
