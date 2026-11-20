import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import path from 'node:path';
const root=process.argv[2]?pathToFileURL(path.resolve(process.argv[2])+path.sep):new URL('../',import.meta.url),mod=p=>import(new URL(p,root));
const {MemoryStore}=await mod('server/memory-store.mjs'),{execute}=await mod('server/operations.mjs'),P=await mod('src/account/progress.js'),H=await mod('src/data/hero-growth.js');
const {runEconomyOperation}=await mod('server/economy.mjs');
const values=new Map();globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.addEventListener=()=>{};globalThis.document={addEventListener(){},visibilityState:'visible'};globalThis.location={hostname:'localhost',search:''};globalThis.fetch=()=>{throw Error('NETWORK FORBIDDEN');};globalThis.setTimeout=()=>0;globalThis.clearTimeout=()=>{};
let tail=Promise.resolve();Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_key,fn)=>{const p=tail.then(fn);tail=p.catch(()=>{});return p;}}}});
const A=await mod('src/account/account.js'),C=await mod('src/account/hero-growth.js'),{settleNavigation}=await mod('src/account/navigation-save.js');
const key='hd3d_live',now=Date.parse('2026-10-29T00:00:00Z');let serial=0;
function fixture(){
 const uid='settlement-'+(++serial),users={a:{id:uid,email:'a@example.invalid'},b:{id:uid+'-b',email:'b@example.invalid'}};
 const save=P.empty();save.st['10-6']=3;save.souls=1000;save.stats.kills=9389;save.nick='Test';save.adv.mage={b:'flame',n:1};
 const wallet={...H.initialGrowth(save),user_id:uid};wallet.xp.mage=H.totalXP(20);
 const db=new MemoryStore({hd3d_progress:[{user_id:uid,data:save,merged:true,updated_at:new Date(now).toISOString()},{user_id:users.b.id,data:{...P.empty(),souls:1000},merged:true,updated_at:new Date(now).toISOString()}],hd3d_profiles:Object.values(users).map(u=>({id:u.id,nickname:'Test'})),hd3d_growth_wallet:[wallet]});
 const control={offline:true,hold:false,lose:false,failBefore:false,clock:now+60000,calls:[]};let release=()=>{},seen=()=>{};
 const run=(user,op)=>control.bonusContract?runEconomyOperation(db,user,op,{now:control.clock}):db.transaction(tx=>execute(tx,user,op,{now:control.clock}));
 class Query{
  constructor(table){this.q={kind:'query',table,action:'select',filters:{}};}
  select(columns){this.q.columns=columns;this.q.returning=true;return this;}eq(k,v){this.q.filters[k]=v;return this;}update(values){this.q.action='update';this.q.values=values;return this;}insert(values){this.q.action='insert';this.q.values=values;return this;}upsert(values){this.q.action='upsert';this.q.values=values;return this;}maybeSingle(){this.q.single=true;return this;}
  then(a,b){control.calls.push(this.q);if(control.failHydrate&&this.q.table==='hd3d_progress'&&this.q.action==='select'){control.failHydrate=false;return Promise.resolve({error:{code:'503',message:'hydration read unavailable'}}).then(a,b);}return run({...A.A.user},this.q).then(a,b);}
 }
 const sb={auth:{onAuthStateChange(){},signOut:async()=>{},signInWithPassword:async({email})=>({data:{user:users[email[0]]},error:null})},from:t=>new Query(t),rpc:async(name,args)=>{
  const user={...A.A.user};control.calls.push({name,args});
  if(name==='hd3d_growth_progress'&&(control.offline||control.failBefore)){control.failBefore=false;throw Error('offline before request');}
  const r=await run(user,{kind:'rpc',name,args});
  if(name==='hd3d_growth_progress'&&r.data?.hardSaved){if(control.hold){seen();await new Promise(r=>release=r);control.hold=false;}if(control.lose){control.lose=false;throw Error('response lost after commit');}}
  return r;
 }};
 globalThis.window={__hd3dCloudMock:async()=>sb};Object.assign(A.A,{user:users.a,mode:'account',hydrated:true,tables:'ok',sync:'saved',banned:false,conflict:null,sb});values.set(key+'_uid',uid);values.set(key+'_save',JSON.stringify(save));values.set(key+'_merged_'+uid,'1');values.set(key+'_cloud_ts_'+uid,new Date(now).toISOString());for(const f of A.A.listeners)f();
 return {uid,users,db,control,run,sb,save,release:()=>release(),watch:()=>new Promise(r=>seen=r),cloud:()=>db.tables.hd3d_progress.find(x=>x.user_id===uid).data,
 async queue(){await C.refresh();await db.transaction(tx=>execute(tx,users.a,{kind:'rpc',name:'hd3d_growth_start',args:{p_id:uid+'-run',p_stage:'hard-1-1',p_mode:'campaign',p_hero:'mage'}},{now}));await C.checkpoint({owner:uid,session:A.sessionId(),token:uid+'-run',stage:'hard-1-1'},10,true,true,3,11);await tail;assert.equal(C.HG.pending,1);assert.equal(JSON.parse(values.get('hd3d_live_growth_v1_'+uid+'_outbox')).rewards[uid+'-run'].p_kills,11);}
 };
}
function purchase(){return A.update(d=>P.buyPerm(d,'mage','hp')[0]);}
function receipt(f,expected=1560,hp=0){assert.equal(f.cloud().souls,expected);assert.equal(f.cloud().heroLv.mage.hp,hp);assert.equal(f.cloud().chests.length,3);assert.equal(f.cloud().hardRewardSeq,1);assert.equal(f.cloud().stats.kills,9400);assert.equal(f.db.tables.hd3d_growth_wallet[0].earned,600);}
test('offline hard retry serializes purchases; no fake success and purchase works after confirmation',async()=>{
 const f=fixture();await f.queue();assert.equal(await settleNavigation(A,C,{xpPendingWrite:Promise.resolve(true)},()=>{}),false); // Keep the existing result until its receipt is confirmed.
 f.control.offline=false;f.control.hold=true;const seen=f.watch(),pending=C.retry();await seen;
 let blocked;try{purchase();}catch(e){blocked=e;}finally{f.release();}await pending;
 assert.equal(blocked?.code,'server_save_pending');assert.equal(A.load().heroLv.mage.hp,0);assert.equal(A.A.conflict,null);assert.equal(C.HG.pending,0);assert.equal(A.serverSaveState(),null);receipt(f);
 purchase();assert.equal(await A.flush(),true);receipt(f,1530,1);assert.equal(A.load().souls,1530);
});
test('commit response loss keeps a durable guard and retries the same award once',async()=>{
 const f=fixture();await f.queue();f.control.offline=false;f.control.lose=true;assert.equal(await C.retry(),false);receipt(f);assert.equal(A.serverSaveState().busy,false);assert.throws(purchase,{code:'server_save_pending'});
 assert.equal(await C.refresh(),true);assert.equal(A.serverSaveState(),null);assert.equal(C.HG.pending,0);purchase();await A.flush();receipt(f,1530,1);await C.refresh();receipt(f,1530,1);
});
test('account switch during a committed reply preserves A recovery and never blocks or overwrites B',async()=>{
 const f=fixture();await f.queue();f.control.offline=false;f.control.hold=true;const seen=f.watch(),pending=C.retry();await seen;
 try{await A.signOut();await A.signIn('b@example.invalid','RAM-only');assert.equal(A.serverSaveState(),null);purchase();await A.flush();assert.equal(A.load().souls,970);}finally{f.release();}await pending;assert.equal(A.A.user.id,f.users.b.id);assert.equal(A.load().souls,970);assert.equal(C.HG.growth,null);
 await A.signOut();await A.signIn('a@example.invalid','RAM-only');assert.ok(A.serverSaveState());await C.refresh();assert.equal(A.serverSaveState(),null);receipt(f);assert.equal(A.load().souls,1560);
});
test('failure before commit preserves prior purchase and resumes without a phantom award',async()=>{
 const f=fixture();purchase();await A.flush();await f.queue();assert.equal(f.cloud().souls,970);assert.equal(f.cloud().heroLv.mage.hp,1);assert.throws(purchase,{code:'server_save_pending'});
 f.control.offline=false;assert.equal(await C.retry(),true);receipt(f,1530,1);assert.equal(C.HG.pending,0);
});
test('stale hard sequence cannot offer an impossible local conflict retry',async()=>{
 const f=fixture();await f.queue();f.control.offline=false;await C.retry();const row=f.db.tables.hd3d_progress.find(x=>x.user_id===f.uid);
 A.A.conflict={local:f.save,cloud:f.cloud(),updatedAt:row.updated_at};assert.equal(A.canResolveLocal(),false);await assert.rejects(A.resolveConflict('local'),/서버 보상/);receipt(f);
 assert.equal(await A.resolveConflict('cloud'),true);assert.equal(A.A.conflict,null);receipt(f);
});

test('failed authoritative read after hard commit recovers through retry without reload or duplicate reward',async()=>{
 const f=fixture();await f.queue();f.control.offline=false;f.control.failHydrate=true;
 assert.equal(await C.retry(),false);receipt(f);assert.equal(A.A.tables,'error');assert.equal(A.serverSaveState().busy,false);assert.throws(purchase,{code:'server_save_pending'});
 assert.equal(await C.refresh(),true);assert.equal(A.serverSaveState(),null);assert.equal(C.HG.pending,0);assert.equal(A.A.tables,'ok');receipt(f);purchase();await A.flush();receipt(f,1530,1);
});

test('lost commit reply plus failed recovery read preserves guard and succeeds on the next retry',async()=>{
 const f=fixture();await f.queue();f.control.offline=false;f.control.lose=true;assert.equal(await C.retry(),false);receipt(f);
 f.control.failHydrate=true;assert.equal(await C.refresh(),true);assert.equal(A.A.tables,'error');assert.ok(A.serverSaveState());receipt(f);
 await C.refresh();assert.equal(A.serverSaveState(),null);assert.equal(C.HG.pending,0);receipt(f);
});
test('nonmodal waiting cannot start a second run, invest, change build, claim mail or spend daily entries',async()=>{
 const f=fixture();await f.queue();const n=f.control.calls.length;
 assert.equal(await C.startRun('1-1','mage'),null);assert.equal((await C.invest('mage',21)).ok,false);
 assert.equal((await C.changeBuild('mage','flame',0,15,'bad',true)).ok,false);
 const D=await mod('src/account/dungeon.js'),S=await mod('src/account/spire.js'),Shop=await mod('src/account/shop.js');
 assert.equal((await D.dgStart()).blocked,true);assert.equal((await S.spStart(1)).blocked,true);assert.equal((await Shop.claim(1)).ok,false);
 assert.equal(f.control.calls.length,n);assert.equal(A.load().souls,1000);assert.equal(A.load().heroLv.mage.hp,0);
 f.control.offline=false;await C.refresh();receipt(f);assert.equal(A.serverSaveState(),null);
});
test('first-clear boss waves survive offline checkpoint, journal merge and lost committed reply',async()=>{
 const f=fixture();f.control.bonusContract=true;const run=await C.startRun('hard-1-1','mage');assert.equal(run?.hardFirstBonus,1);
 f.control.clock+=120000;
 const call=f.control.calls.find(x=>x.name==='hd3d_growth_start');assert.equal(call.args.p_hardFirstBonus,1);
 await C.checkpoint(run,5,false,false,1,5,[5]);await tail;
 const read=()=>JSON.parse(values.get('hd3d_live_growth_v1_'+f.uid+'_outbox')).rewards[run.token];
 assert.equal(Object.hasOwn(read(),'p_bossKills'),false);
 await C.checkpoint(run,10,true,true,3,11,[10,5,5,0,11,'5']);await tail;
 await C.checkpoint(run,10,true,true,3,11,[]);await tail;
 assert.deepEqual(read().p_bossKills,[5,10]);
 f.control.offline=false;f.control.lose=true;
 assert.equal(await C.retry(),false);
 const paid=structuredClone(f.cloud()),requests=()=>f.control.calls.filter(x=>x.name==='hd3d_growth_progress'&&x.args.p_finish);
 assert.equal(await C.refresh(),true);
 assert.deepEqual(f.cloud(),paid);assert.equal(read(),undefined);
 assert.deepEqual(requests().at(-1).args.p_bossKills,[5,10]);assert.equal(C.HG.hardRewards[run.token].chests,paid.chests.length);
});
