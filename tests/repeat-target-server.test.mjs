import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../server/memory-store.mjs';
import { execute } from '../server/operations.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import * as H from '../src/data/hero-growth.js';
import { REPEAT_ROWS, targetGear } from '../src/data/repeat-target.js';
const user={id:'repeat-qa-a',email:'repeat-a@example.invalid'},other={id:'repeat-qa-b',email:'repeat-b@example.invalid'};
function fixture(repeat=true){
 let now=1793500000000;const save=P.clean({...P.empty(),souls:1000,st:{'10-6':3,'1-1':3}});
 const wallet={...H.initialGrowth(save),user_id:user.id,hard:{version:1,st:repeat?{'hard-1-1':3}:{}}};
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[wallet]});
 const rpc=(name,args={},u=user)=>db.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>.5})).then(x=>x.data);
 return {db,rpc,tick:()=>now+=120000,save,start:(id,target,stage='hard-1-1')=>rpc('start',{p_id:id,p_mode:'campaign',p_stage:stage,p_hero:'mage',...(target===undefined?{}:{p_target:target})}),finish:(id,win=true,n=10)=>rpc('progress',{p_token:id,p_completed:n,p_win:win,p_finish:true,p_stars:3,p_kills:11})};
}

test('all seven targets validated and snapshotted; target paid weapon does not unlock or require paid hero',async()=>{
 const f=fixture();assert.equal((await f.rpc('status')).features.repeatTarget,1);
 for(const [i,row] of REPEAT_ROWS.entries()){
  const id='row-run-'+i,a=await f.start(id,row);assert.equal(a.target,row);assert.equal(a.repeat,true);
  assert.equal((await f.start(id,row)).target,row);assert.equal((await f.start(id,row==='armor'?'acc':'armor')).reason,'id_reused');
  f.tick();const before=f.db.tables.hd3d_progress[0].data.chests.length;
  const r=await f.finish(id);assert.equal(r.ok,true);const added=f.db.tables.hd3d_progress[0].data.chests.slice(before);
  assert.equal(added.length,4);assert.equal(added[0].it.s,targetGear(row).s);assert.equal(added[0].it.h,targetGear(row).h);
 }
 assert.equal(f.db.tables.hd3d_owned?.length||0,0);
});

test('atomic duplicate finish, lost response retry, simultaneous legitimate runs and account isolation',async()=>{
 const f=fixture();await f.start('parallel-run-01','fighter');await f.start('parallel-run-02','armor');f.tick();
 const results=await Promise.all([f.finish('parallel-run-01'),f.finish('parallel-run-01'),f.finish('parallel-run-02')]);assert.ok(results.every(x=>x.ok));
 const p=f.db.tables.hd3d_progress[0].data;assert.equal(p.chests.length,8);assert.equal(p.hardRewardSeq,2);assert.equal(p.stats.runs,2);assert.equal(p.stats.kills,22);
 assert.equal(p.chests[0].it.h,'fighter');assert.equal(p.chests[4].it.s,'armor');
 const committed=structuredClone(f.db.tables);assert.equal((await f.finish('parallel-run-01')).already,true);assert.deepEqual(f.db.tables,committed);
 assert.equal((await f.rpc('progress',{p_token:'parallel-run-01',p_completed:10,p_win:true,p_finish:true},other)).reason,'bad_token');
 assert.deepEqual(f.db.tables.hd3d_progress[0].data,p);
 const opened=P.clean(p);E.openChests(opened);assert.ok(P.codexBits(opened,1,'fighter'));assert.ok(P.codexBits(opened,1,'armor'));assert.deepEqual(P.clean(JSON.parse(JSON.stringify(opened))).inv,opened.inv);
});

test('first-clear snapshot stays unselected, epic guarantee and partial return remain unchanged',async()=>{
 const f=fixture(false),a=await f.start('first-clear-01','fighter');assert.equal(a.target,null);assert.equal(a.repeat,false);f.tick();await f.finish('first-clear-01');
 let p=f.db.tables.hd3d_progress[0].data;assert.equal(p.chests.length,3);assert.equal(p.chests.at(-1).it.g,3);
 await f.start('partial-run-01','fighter');f.tick();await f.finish('partial-run-01',false,5);
 p=f.db.tables.hd3d_progress[0].data;assert.equal(p.chests.length,4);assert.notEqual(p.chests.at(-1).it.h,'fighter');
});

test('invalid inputs, H6 locked, legacy starts and same display stage in different modes stay distinct',async()=>{
 const f=fixture();for(const value of ['mechanic',4,{},['mage'],'__proto__','legend'])assert.equal((await f.start('invalid-target-'+String(value),value)).reason,'invalid');
 assert.equal((await f.start('not-released-06','mage','hard-6-1')).reason,'locked');
 const old=await f.start('legacy-start-01');assert.equal(old.ok,true);assert.equal(old.target,null);
 const normal=await f.start('normal-stage-01','gunner','1-1');assert.equal(normal.target,'gunner');assert.equal(normal.repeat,true);
 assert.equal((await f.start('normal-stage-01','gunner','hard-1-1')).reason,'id_reused');
 const challenge=await f.rpc('start',{p_id:'challenge-target-1',p_mode:'challenge',p_hero:'mage',p_target:'armor'});assert.equal(challenge.target,null);assert.equal(challenge.repeat,false);
});

test('transaction exception before commit leaves no partial reward and can retry safely',async()=>{
 const f=fixture();await f.start('failed-commit-01','gunner');f.tick();const before=structuredClone(f.db.tables);
 await assert.rejects(f.db.transaction(async tx=>{await execute(tx,user,{kind:'rpc',name:'hd3d_growth_progress',args:{p_token:'failed-commit-01',p_completed:10,p_win:true,p_finish:true}},{now:1793500120000});throw Error('commit failed');}));
 assert.deepEqual(f.db.tables,before);await f.finish('failed-commit-01');assert.equal(f.db.tables.hd3d_progress[0].data.chests.length,4);assert.equal(f.db.tables.hd3d_progress[0].data.chests[0].it.h,'gunner');
});
