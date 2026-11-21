import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import {runOperation} from '../server/operations.mjs';
import {directGear} from '../src/account/direct-economy.js';
import {packSave} from '../src/account/storage.js';
import * as P from '../src/account/progress.js';
import {endgameLevel,endgameQuote,startingGoldBonus,beamAttackBonus} from '../src/data/endgame-research.js';

const user={id:'endgame-qa',email:'qa@example.invalid'},now=Date.parse('2026-11-21T08:00:00Z'),iso=new Date(now).toISOString();
const args=(id,kind,rank)=>({p_id:id,p_action:'endgame_research',p_stat:kind,p_count:rank});
function fixture(edit=()=>{}){
 const save=P.empty();Object.assign(save,{souls:1700000,mat:{steel:30000,crystal:10000,essence:12},battlePartner:'archer',st:{'1-1':3}});
 save.research.guardian.atk=10;edit(save);
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data:packSave(save),merged:true,updated_at:iso}]});
 const rpc=(name,a,u=user)=>runEconomyOperation(db,u,{kind:'rpc',name:'hd3d_'+name,args:a},{now}).then(r=>r.data);
 const buy=(id,kind,rank)=>rpc('gear_action',args(id,kind,rank));
 const row=()=>db.tables.hd3d_progress[0],current=()=>P.clean(row().data);
 const generic=(data,stamp=row().updated_at)=>runEconomyOperation(db,user,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:stamp},values:{data,merged:true},returning:true},{now}).then(r=>r.data);
 return {db,rpc,buy,row,current,generic};
}
test('gold curve remains uncapped except safe integer, clamps purchase costs before multiplication',()=>{
 const f=fixture(),s=f.current();
 assert.deepEqual(endgameQuote(s,'gold'),{level:0,next:1,cost:{souls:30000,steel:500,crystal:150},reason:null});
 s.endgameResearch={gold:1};
 assert.deepEqual(endgameQuote(s,'gold').cost,{souls:40000,steel:650,crystal:200});
 s.endgameResearch.gold=Number.MAX_SAFE_INTEGER-1;
 assert.deepEqual(endgameQuote(s,'gold'),{level:Number.MAX_SAFE_INTEGER-1,next:Number.MAX_SAFE_INTEGER,cost:{souls:1e9,steel:1e7,crystal:1e7},reason:'poor'});
 s.endgameResearch.gold=Number.MAX_SAFE_INTEGER;
 assert.equal(endgameQuote(s,'gold').reason,'max');
 assert.equal(startingGoldBonus(s),Number.MAX_SAFE_INTEGER);
 assert.equal(endgameLevel(s,'__proto__'),0);
 assert.ok(!Object.hasOwn(P.clean({...s,endgameResearch:{gold:'8',beam:41,extra:9}}),'endgameResearch'));
});
test('beam requires legacy attack 10 and adds 40 percentage points without changing legacy rank',async()=>{
 const f=fixture(s=>{s.research.guardian.atk=9;s.endgameResearch={beam:12};});
 assert.equal(beamAttackBonus(f.current()),0);
 assert.equal(endgameQuote(f.current(),'beam').reason,'locked');
 assert.equal((await f.buy('locked-beam-action','beam',12)).reason,'locked');
 const g=fixture(s=>{s.endgameResearch={beam:39};});
 assert.equal(beamAttackBonus(g.current()),.39);
 assert.ok((await g.buy('last-beam-level','beam',39)).ok);
 assert.equal(beamAttackBonus(g.current()),.40);
 assert.equal(g.current().research.guardian.atk,10);
 assert.deepEqual(endgameQuote(g.current(),'beam'),{level:40,next:null,cost:null,reason:'max'});
 assert.equal((await g.buy('after-max-beam','beam',40)).reason,'max');
});
test('three currencies debited at exact price; receipt retries and changed device quotes cannot double charge',async()=>{
 const f=fixture(),before=f.current();
 const [a,b]=await Promise.all([f.buy('gold-device-one','gold',0),f.buy('gold-device-two','gold',0)]);
 assert.ok(a.ok);assert.equal(b.reason,'conflict');assert.equal(b.level,1);
 assert.equal(a.level,1);assert.deepEqual(a.cost,{souls:30000,steel:500,crystal:150});
 const retry=await f.buy('gold-device-one','gold',0);assert.equal(retry.already,true);
 const x=await f.buy('beam-device-one','beam',0);assert.ok(x.ok);assert.deepEqual(x.cost,{souls:50000,steel:750,crystal:250});
 const expected={...before,souls:before.souls-80000,mat:{...before.mat,steel:before.mat.steel-1250,crystal:before.mat.crystal-400},endgameResearch:{gold:1,beam:1}};
 assert.deepEqual(f.current(),expected);
 await assert.rejects(f.buy('gold-device-one','gold',1),/request ID reused/);
 assert.equal(f.db.tables.hd3d_growth_investments.length,2);
});
test('not available in batches, legacy browser writes, generic or foreign writes; old omission preserves ranks',async()=>{
 const f=fixture(),id='single-purchase',input=args(id,'gold',0);
 const status={kind:'rpc',name:'hd3d_growth_status',args:{}};
 assert.equal((await f.rpc('growth_status',{})).features.endgameResearch,1);
 assert.equal((await runOperation(f.db,user,status,{now})).data.features.endgameResearch,undefined);
 await assert.rejects(f.rpc('gear_batch',{commands:[input]}),{code:'INVALID_ARGUMENT'});
 await assert.rejects(directGear(f.db,user,input,{now}),{code:'DIRECT_UNSUPPORTED'});
 await assert.rejects(f.rpc('gear_action',{...input,p_pay:'anything'}),{code:'INVALID_ARGUMENT'});
 await assert.rejects(f.rpc('gear_action',{...input,p_id:[id]}),{code:'INVALID_ARGUMENT'});
 await assert.rejects(f.rpc('gear_action',input,{id:'foreign-qa'}),/missing save/);
 const old=f.current(),stamp=f.row().updated_at;assert.ok((await f.buy(id,'gold',0)).ok);
 assert.deepEqual(await f.generic(old,stamp),[]);
 const omitted=f.current();delete omitted.endgameResearch;omitted.nick='old session';
 assert.ok((await f.generic(omitted)).length);
 assert.equal(f.current().endgameResearch.gold,1);
 const forged=f.current();forged.endgameResearch.gold=20;
 await assert.rejects(f.generic(forged),{code:'ECONOMY_ACTION_REQUIRED'});
 assert.equal(f.current().endgameResearch.gold,1);
});
test('insufficient resource and interrupted receipt commit do not debit the account',async()=>{
 const f=fixture(s=>{s.mat.crystal=149;}),before=f.current();
 assert.equal((await f.buy('insufficient-rank','gold',0)).reason,'poor');
 assert.deepEqual(f.current(),before);
 const g=fixture(),snapshot=structuredClone(g.db.tables),tx=g.db.transaction.bind(g.db);
 g.db.transaction=fn=>tx(async t=>{
  const put=t.put.bind(t);
  t.put=async(name,row)=>{if(name==='hd3d_growth_investments')throw Error('Injected receipt error');return put(name,row);};return fn(t);
 });
 await assert.rejects(g.buy('failing-receipt','beam',0),/Injected receipt error/);
 assert.deepEqual(g.db.tables,snapshot);
});
