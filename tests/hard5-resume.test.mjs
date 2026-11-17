import test from 'node:test';import assert from 'node:assert/strict';
import * as hard from '../src/data/hard.js';
import {STAGES,nextStage} from '../src/data/stages.js';
import baseline from './fixtures/hard5-v25-baseline.json' with {type:'json'};
import {MemoryStore} from '../server/memory-store.mjs';import {execute} from '../server/operations.mjs';
import * as P from '../src/account/progress.js';import * as H from '../src/data/hero-growth.js';import * as E from '../src/account/equip.js';

test('v25 normal and hard1-4 definitions and reward RNG remain identical',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(STAGES)),baseline.stages);assert.deepEqual(JSON.parse(JSON.stringify(hard.HARD_CHAPTERS.slice(0,4))),baseline.hardChapters);
 for(const row of baseline.rewards){const s=hard.HARD_STAGES[row.stage];
  assert.deepEqual(hard.hardReward(s,s.waves,true,true,'fighter',()=>row.random),row.result);
 }
});
test('H5 six layouts retain normal economy, sequential locks and native chapter identity',()=>{
 const stages=hard.HARD_CHAPTERS[4].stages;assert.equal(stages.length,6);
 const s={st:{'10-6':3},growth:{hard:{st:{'hard-4-4':1}}}};
 assert.equal(nextStage(s,'hard-4-4'),'hard-5-1');
 for(const a of stages){for(const k of ['waves','core','spawns','q','bed','seed','walls','startGold','boss'])assert.deepEqual(a[k],STAGES[a.normalId][k]);
  assert.equal(a.rule,'spore-cross');assert.equal(hard.hardUnlocked(s,a.id),true);s.growth.hard.st[a.id]=3;
 }
 assert.equal(nextStage(s,'hard-5-6'),'hard-6-1');assert.equal(hard.hardUnlocked(s,'hard-6-1'),true);
});
test('H5 real server settlement is atomic on first/repeat/partial, replay, codex and old chest preservation',async()=>{
 const user={id:'h5-resume',email:'h5@example.invalid'};let now=1793510400000;
 const old=E.makeItem('weapon','mage',4,()=>.5,10);
 const save=P.clean({...P.empty(),st:{'10-6':3},souls:1234,chests:[{id:'c'+old.id,it:old,src:'stage',souls:0}]});
 const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:structuredClone(save),merged:true,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[{...H.initialGrowth(save),user_id:user.id,hard:{version:1,st:{'hard-4-4':3}}}]});
 const rpc=(name,args)=>store.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_growth_'+name,args},{now})).then(r=>r.data);
 assert.equal((await rpc('start',{p_id:'h5-illegal-skip',p_mode:'campaign',p_stage:'hard-5-2',p_hero:'mage'})).reason,'locked');
 for(const st of hard.HARD_CHAPTERS[4].stages)for(const [tag,n,win]of [['first',st.waves,true],['repeat',st.waves,true],['retreat',5,false]]){
  const before=structuredClone(store.tables),id=st.id+'-'+tag;
  assert.equal((await rpc('start',{p_id:id,p_mode:'campaign',p_stage:st.id,p_hero:'mage'})).ok,true);now+=120000;
  const args={p_token:id,p_completed:n,p_win:win,p_finish:true,p_stars:2,p_kills:23};
  for(const r of await Promise.all([rpc('progress',args),rpc('progress',args)])){assert.equal(r.ok,true);assert.equal(r.hardSaved,true);assert.equal(r.xp,hard.hardXP(st,n,win,tag==='first'));}
  const after=store.tables.hd3d_progress[0].data,prev=before.hd3d_progress[0].data;
  assert.equal(after.souls-prev.souls,hard.hardReward(st,n,win,tag==='first','mage').souls);assert.equal(after.stats.kills-(prev.stats.kills||0),23);assert.equal(after.hardRewardSeq,(prev.hardRewardSeq||0)+1);
  assert.deepEqual(after.chests[0],save.chests[0]);assert.deepEqual(after.st,save.st);
  const added=after.chests.slice(prev.chests.length);assert.equal(added.length,Math.floor(n/5)+(tag==='first'?1:tag==='repeat'?2:0));if(tag==='first')assert.equal(added.at(-1).it.g,3);
  const [opened,result]=E.openChests({...P.empty(),chests:structuredClone(added)});assert.equal(result.opened.length,added.length);
  for(const [index,item] of opened.inv.entries()){assert.equal(item.c,5);assert.ok((tag==='repeat'&&index>=Math.floor(n/5)?[0,1,2]:E.obtainableGrades(5)).includes(item.g));assert.ok(P.codexBits(opened,5,item.s==='weapon'?item.h:item.s)&(1<<item.g));}
  assert.deepEqual(P.clean(opened).inv,opened.inv);assert.equal(E.openChests(opened)[1].opened.length,0);
  const committed=structuredClone(store.tables);await rpc('progress',args);assert.deepEqual(store.tables,committed);
 }
 assert.equal((await rpc('start',{p_id:'h7-not-made-yet',p_mode:'campaign',p_stage:'hard-11-1',p_hero:'mage'})).reason,'locked');
});
