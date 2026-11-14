import test from 'node:test';
import assert from 'node:assert/strict';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
globalThis.localStorage=storage;globalThis.sessionStorage={...storage};globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={search:'',hostname:'localhost'};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_k,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}},configurable:true});
const Acc=await import('../src/account/account.js'),Client=await import('../src/account/hero-growth.js'),Pref=await import('../src/account/repeat-target.js');
test('actual client target preference is account/chapter scoped and storage failure is visible',()=>{
 Acc.playGuest();assert.equal(Pref.writeTarget('1-1','fighter'),true);assert.equal(Pref.readTarget('1-6'),'fighter');assert.equal(Pref.readTarget('2-1'),null);
 Acc.A.user={id:'qa-a'};assert.equal(Pref.readTarget('1-1'),null);assert.equal(Pref.writeTarget('1-1','armor'),true);
 Acc.A.user={id:'qa-b'};assert.equal(Pref.readTarget('1-1'),null);Pref.writeTarget('1-1','acc');
 Acc.A.user={id:'qa-a'};assert.equal(Pref.readTarget('1-1'),'armor');
 Acc.A.user=null;assert.equal(Pref.readTarget('1-1'),'fighter');
 const old=storage.setItem;storage.setItem=()=>{throw Error('full');};assert.equal(Pref.writeTarget('1-1','mage'),false);storage.setItem=old;assert.equal(Pref.readTarget('1-1'),'fighter');
});
test('actual client run snapshots target; partial/duplicate settlement and account switching keep identity',async()=>{
 Acc.playGuest();Acc.update(s=>({...s,st:{'1-1':3}}));await Client.refresh();assert.equal(Client.HG.features.repeatTarget,1);
 Pref.writeTarget('1-1','fighter');const run=await Client.startRun('1-1','mage');assert.equal(run.repeat,true);assert.equal(run.target,'fighter');
 Pref.writeTarget('1-1','armor');assert.equal(run.target,'fighter');
 assert.equal(await Client.checkpoint(run,3,false,true),true);await Client.retry();const before=structuredClone(Client.HG.growth);
 await Client.checkpoint(run,3,false,true);await Client.retry();assert.deepEqual(Client.HG.growth,before);
 Acc.A.user={id:'qa-b'};assert.equal(await Client.checkpoint(run,10,true,true),false);assert.equal(Client.enabled(),false);
 Acc.A.user=null;await Client.refresh();const next=await Client.startRun('1-1','mage');assert.equal(next.target,'armor');assert.notEqual(next.token,run.token);
 Pref.writeTarget('1-2','gunner');const first=await Client.startRun('1-2','mage');assert.equal(first.target,null);assert.equal(first.repeat,false);
});

test('old server feature omission disables target; lost start replies reuse ID; late A response cannot affect B',async()=>{
 const H=await import('../src/data/hero-growth.js'),wallet=H.initialGrowth();let features={trees:1,hard:1},lose=false,hold=false,release,seen;
 const calls=[],sb={rpc:async(name,args)=>{
  calls.push({name,args:structuredClone(args)});
  if(name==='hd3d_growth_status')return{data:{ok:true,version:1,features,growth:wallet}};
  if(name==='hd3d_growth_start'){
   if(lose){lose=false;throw Error('lost committed start response');}
   if(hold){seen();await new Promise(r=>release=r);}
   return{data:{ok:true,token:args.p_id,repeat:true,target:args.p_target,growth:wallet}};
  }
  throw Error(name);
 }};
 Object.assign(Acc.A,{user:{id:'legacy-a'},mode:'account',sb,hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null});for(const f of Acc.A.listeners)f();
 Pref.writeTarget('1-1','gunner');await Client.refresh();let r=await Client.startRun('1-1','mage');
 assert.equal(r.target,null);assert.equal(r.repeat,false);assert.equal(Object.hasOwn(calls.find(c=>c.name==='hd3d_growth_start').args,'p_target'),false);
 features={trees:1,hard:1,repeatTarget:1};lose=true;const from=calls.length;r=await Client.startRun('1-1','mage');
 const retry=calls.slice(from).filter(c=>c.name==='hd3d_growth_start');assert.equal(retry.length,2);assert.deepEqual(retry[0].args,retry[1].args);assert.equal(r.target,'gunner');
 hold=true;const reached=new Promise(r=>seen=r),pending=Client.startRun('1-1','mage');await reached;
 Acc.A.user={id:'legacy-b'};for(const f of Acc.A.listeners)f();release();assert.equal(await pending,null);assert.equal(Client.HG.growth,null);assert.equal(Pref.readTarget('1-1'),null);
});
