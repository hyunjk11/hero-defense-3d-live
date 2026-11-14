import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../server/memory-store.mjs';
import { execute } from '../server/operations.mjs';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import * as H from '../src/data/hero-growth.js';
import { HARD_STAGES } from '../src/data/hard.js';
const user={id:'collect-a',email:'a@example.invalid'},other={id:'collect-b',email:'b@example.invalid'};
function fixture(repeat=true){
 let now=1793600000000;const data=P.clean({...P.empty(),souls:1000,st:{'10-6':3,'1-1':3}});
 const wallet={...H.initialGrowth(data),user_id:user.id,hard:{version:1,st:Object.fromEntries(Object.keys(HARD_STAGES).map(id=>[id,3]))}};
 if(!repeat)delete wallet.hard.st['hard-5-1'];
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[wallet]});
 const call=(name,args={},u=user)=>db.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>.1})).then(r=>r.data);
 const start=(id,stage='hard-5-1',extra={})=>call('start',{p_id:id,p_mode:'campaign',p_stage:stage,p_hero:'mage',p_target:'gunner',...extra});
 const finish=(id,stage='hard-5-1',extra={})=>call('progress',{p_token:id,p_completed:HARD_STAGES[stage].waves,p_win:true,p_finish:true,p_stars:3,p_kills:11,...extra});
 return {db,call,start,finish,tick:()=>now+=120000,save:()=>db.tables.hd3d_progress[0].data};
}

test('server stamps the reward contract and all released stages award exactly base+2 with target only once',async()=>{
 const f=fixture();assert.equal((await f.call('status')).features.hardCollection,1);
 for(const [i,s] of Object.values(HARD_STAGES).entries()){
  const id='collection-'+i;await f.start(id,s.id);assert.equal(f.db.tables.hd3d_growth_runs.at(-1).hardRewardVersion,2);
  f.tick();const before=f.save().chests.length,r=await f.finish(id,s.id),newBoxes=f.save().chests.slice(before);
  assert.equal(r.ok,true);assert.equal(r.hardReward.chests,Math.floor(s.waves/5)+2);
  assert.equal(newBoxes[0].it.h,'gunner');assert.ok(newBoxes.slice(1).every(x=>x.it.h==='mage'));
  assert.ok(newBoxes.slice(-2).every(x=>x.it.g===0&&x.it.c===s.ch));
 }
});

test('duplicate/concurrent finishes and response loss give one economic effect per legitimate run',async()=>{
 const f=fixture();await f.start('duplicate-one');await f.start('duplicate-two');f.tick();
 const r=await Promise.all([f.finish('duplicate-one'),f.finish('duplicate-one'),f.finish('duplicate-two')]);assert.ok(r.every(x=>x.ok));
 const count=Math.floor(HARD_STAGES['hard-5-1'].waves/5)+2;assert.equal(f.save().chests.length,count*2);assert.equal(f.save().hardRewardSeq,2);assert.equal(f.save().stats.kills,22);
 const before=structuredClone(f.db.tables);assert.equal((await f.finish('duplicate-one')).already,true);assert.deepEqual(f.db.tables,before);
 assert.equal((await f.call('progress',{p_token:'duplicate-one',p_completed:10,p_win:true,p_finish:true},other)).reason,'bad_token');
 for(const table of ['hd3d_progress','hd3d_growth_wallet','hd3d_growth_runs','hd3d_mail'])assert.deepEqual(f.db.tables[table],before[table]);
});

test('simultaneous first departures remain first-contract runs, never become repeat extras at settlement',async()=>{
 const f=fixture(false);await Promise.all([f.start('first-collection-a'),f.start('first-collection-b')]);f.tick();
 const rs=await Promise.all([f.finish('first-collection-a'),f.finish('first-collection-b')]);const base=Math.floor(HARD_STAGES['hard-5-1'].waves/5);
 assert.deepEqual(rs.map(x=>x.hardReward.chests),[base+1,base]);assert.equal(f.save().chests[base].it.g,3);
 assert.ok(f.db.tables.hd3d_growth_runs.every(r=>r.repeat===false));
});

test('legacy unfinished run, legacy completed receipt and forged fields do not add or re-roll extras',async()=>{
 const f=fixture();await f.start('legacy-collection-a');delete f.db.tables.hd3d_growth_runs[0].hardRewardVersion;
 const replay=await f.start('legacy-collection-a','hard-5-1',{p_reward_version:2});assert.equal(replay.ok,true);assert.equal(f.db.tables.hd3d_growth_runs[0].hardRewardVersion,undefined);
 f.tick();const r=await f.finish('legacy-collection-a','hard-5-1',{p_reward_version:2,p_repeat:true,p_target:'fighter',p_items:[{k:'gear',g:4,s:'weapon',h:'fighter',c:5}],p_chests:200});
 assert.equal(r.hardReward.chests,Math.floor(HARD_STAGES['hard-5-1'].waves/5));assert.equal(f.save().chests[0].it.h,'gunner');
 const before=structuredClone(f.db.tables);await f.finish('legacy-collection-a');assert.deepEqual(f.db.tables,before);
 // Old clients need not send new fields; newly issued runs are server-versioned.
 await f.start('old-client-new-run');f.tick();const fresh=await f.finish('old-client-new-run');assert.equal(fresh.hardReward.chests,r.hardReward.chests+2);
});

test('failed, partial and non-finishing wins cannot claim collection extras; H6 remains locked',async()=>{
 const f=fixture();for(const [i,args] of [{p_completed:5,p_win:false},{p_win:false},{p_finish:false}].entries()){
  const id='non-clear-'+i;await f.start(id);f.tick();const r=await f.finish(id,'hard-5-1',args);assert.equal(r.hardReward.chests,Math.floor((args.p_completed??HARD_STAGES['hard-5-1'].waves)/5));
 }
 assert.equal((await f.start('future-hard-six','hard-6-1')).reason,'locked');
 assert.equal((await f.start('normal-contract','1-1')).ok,true);assert.equal(f.db.tables.hd3d_growth_runs.at(-1).hardRewardVersion,undefined);
});

test('commit failure is atomic; subsequent retry stores the same target and only one receipt',async()=>{
 const f=fixture();await f.start('failed-collection');f.tick();const before=structuredClone(f.db.tables);
 await assert.rejects(f.db.transaction(async tx=>{await execute(tx,user,{kind:'rpc',name:'hd3d_growth_progress',args:{p_token:'failed-collection',p_completed:HARD_STAGES['hard-5-1'].waves,p_win:true,p_finish:true}},{now:1793600120000,random:()=>.1});throw Error('QA commit failure');}));
 assert.deepEqual(f.db.tables,before);await f.finish('failed-collection');assert.equal(f.save().hardRewardSeq,1);assert.equal(f.db.tables.hd3d_mail.length,1);
 const ready=P.clean(JSON.parse(JSON.stringify(f.save())));E.openChests(ready);assert.ok(P.codexBits(ready,5,'mage')&1);assert.deepEqual(P.clean(JSON.parse(JSON.stringify(ready))),ready);
});

test('200 full boxes returns zero stored boxes and materials; retry never grants codex or more materials',async()=>{
 const f=fixture();for(let i=0;i<200;i++){const it=E.makeItem('armor','mage',3,()=>.1,1);it.id='old-'+i;E.addChests(f.save(),[{it,src:'chest'}]);}
 const old=structuredClone(f.save().chests);await f.start('full-collection');f.tick();const r=await f.finish('full-collection');assert.equal(r.hardReward.chests,0);assert.ok(r.hardReward.steel>0);assert.deepEqual(f.save().chests,old);assert.equal(P.codexBits(f.save(),5,'mage')&1,0);
 const saved=structuredClone(f.db.tables);await f.finish('full-collection');assert.deepEqual(f.db.tables,saved);
});
