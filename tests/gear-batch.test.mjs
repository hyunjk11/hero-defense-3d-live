import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FirestoreStore} from '../server/firestore.mjs';
import {FirestoreTransport} from './support/firestore-transport.mjs';
import {runEconomyOperation} from '../server/economy.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import {packSave} from '../src/account/storage.js';
const user={id:'batch-test',email:'qa@example.invalid'},now=1800000000000,iso=new Date(now).toISOString();
function fixture(n=10,edit=()=>{}){const s=P.empty();s.souls=10000;s.mat={steel:1000,crystal:1000};s.nick='QA';for(let i=0;i<n;i++){const it=E.makeItem('armor',null,i%5,()=>.4,1);it.id='batch-item-'+i;s.chests.push(E.chestOf(it,'chest'));}edit(s);const db=new FirestoreTransport({hd3d_progress:[{user_id:user.id,data:packSave(s),merged:true,updated_at:iso}],hd3d_profiles:[{id:user.id,nickname:'QA'}]});return {db,store:new FirestoreStore(db.request)};}
const commands=n=>Array.from({length:n},(_,i)=>({p_id:'batch-open-'+i,p_action:'open',p_item:'cbatch-item-'+i}));
const call=(f,c,u=user)=>runEconomyOperation(f.store,u,{kind:'rpc',name:'hd3d_gear_batch',args:{commands:c}},{now,random:()=>.4});
const state=f=>P.clean(f.db.rows('hd3d_progress')[0].data);
test('1/10/40/200 commands: one snapshot read and one commit; identical existing reward logic',async()=>{
 for(const n of [1,10,40,200]){const f=fixture(n),s=state(f);const expected=E.openChests(s,n)[0];const r=await call(f,commands(n));assert.equal(r.data.results.length,n);assert.deepEqual(state(f),P.clean(expected));assert.deepEqual(P.clean(r.data.snapshot.progress.data),state(f));assert.equal(f.db.calls.length,2);assert.equal(f.db.calls[0].action,'batchGet');assert.deepEqual(f.db.calls[0].body.newTransaction,{readWrite:{}});assert.equal(f.db.calls[1].action,'commit');assert.equal(f.db.txs.size,0);}
});
test('replay and concurrent calls use original individual receipt IDs; newest snapshot wins',async()=>{
 const f=fixture(),c=commands(10),r=await Promise.all([call(f,c),call(f,c)]);assert.equal(state(f).inv.length,10);assert.equal(f.db.rows('hd3d_growth_investments').length,10);assert(r.some(x=>x.data.results.every(y=>y.already)));
 await call(f,[{p_id:'batch-equip-1',p_action:'equip',p_hero:'mage',p_item:state(f).inv[0].id}]);const again=await call(f,c);assert.deepEqual(P.clean(again.data.snapshot.progress.data),state(f));assert(again.data.snapshot.progress.data.eq.mage.armor);
});
test('commit response loss recovers exactly once and keeps current authoritative state',async()=>{
 const f=fixture();f.db.loseCommitResponse=true;await assert.rejects(call(f,commands(10)),/response lost/);const after=state(f);assert.equal(after.inv.length,10);const r=await call(f,commands(10));assert(r.data.results.every(x=>x.already));assert.deepEqual(state(f),after);assert.equal(f.db.rows('hd3d_growth_investments').length,10);
});
test('invalid middle command, receipt reuse, banned user and unowned hero change nothing',async()=>{
 const f=fixture(),before=structuredClone(f.db.docs);
 for(const c of [[...commands(1),{p_id:'invalid-mode',p_action:'run_return',p_item:'x',p_wave:0,p_kills:0}],[commands(1)[0],commands(1)[0]],[{p_id:'unowned-hero',p_action:'equip',p_hero:'fighter',p_item:'x'}]]){await assert.rejects(call(f,c));assert.deepEqual(f.db.docs,before);}
 f.db.seed('hd3d_bans',{user_id:user.id,reason:'test'});const banned=structuredClone(f.db.docs);await assert.rejects(call(f,commands(1)));assert.deepEqual(f.db.docs,banned);f.db.remove('hd3d_bans',user.id);
 await call(f,commands(1));const done=structuredClone(f.db.docs);await assert.rejects(call(f,[{...commands(1)[0],p_item:'different'}]));assert.deepEqual(f.db.docs,done);
});
test('balance overflow rolls back all items and receipts, missing response rows fail closed',async()=>{
 const f=fixture(2,s=>s.souls=1e9-4),before=structuredClone(f.db.docs);const r=await call(f,commands(2));assert(r.data.results.every(x=>x.reason==='balance_limit'));assert.deepEqual(f.db.docs,before);
 const bad=fixture();bad.db.transformBatch=rows=>rows.filter(x=>!x.found?.name.endsWith('/hd3d_progress/'+user.id));await assert.rejects(call(bad,commands(1)),/Incomplete read snapshot/);assert.equal(bad.db.txs.size,0);assert.equal(state(bad).inv.length,0);
});
test('legacy single-action receipt resumes within batch, mixed store/equip/research preserve order and costs',async()=>{
 const f=fixture(3),c=commands(3);await runEconomyOperation(f.store,user,{kind:'rpc',name:'hd3d_gear_action',args:c[0]},{now});const r=await call(f,c);assert(r.data.results[0].already);assert.equal(state(f).inv.length,3);
 const id=state(f).inv[0].id,old=state(f);const x=await call(f,[{p_id:'mixed-equip',p_action:'equip',p_item:id,p_hero:'mage'},{p_id:'mixed-store',p_action:'store',p_item:id},{p_id:'mixed-unequip',p_action:'unequip',p_hero:'mage',p_slot:'armor'},{p_id:'mixed-store2',p_action:'store',p_item:id},{p_id:'mixed-research',p_action:'research',p_type:'arrow',p_stat:'atk'}]);
 assert.deepEqual(x.data.results.map(v=>v.ok),[true,false,true,true,true]);assert.equal(state(f).research.arrow.atk,1);assert.equal(state(f).souls,old.souls-40);assert.equal(state(f).mat.steel,old.mat.steel-2);assert.equal(state(f).stor.length,1);
});
test('foreign identity cannot open the original owner chests or observe its profile',async()=>{const f=fixture(),before=structuredClone(f.db.docs);await assert.rejects(call(f,commands(2),{id:'other',email:'other@example.invalid'}));assert.deepEqual(f.db.docs,before);});
