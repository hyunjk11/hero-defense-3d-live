import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryStore} from '../server/memory-store.mjs';import {execute} from '../server/operations.mjs';
import {ADV} from '../src/data/advance.js';import {treeOptions} from '../src/data/skill-tree.js';
import * as H from '../src/data/hero-growth.js';import * as P from '../src/account/progress.js';
const user={id:'upper-tree-a',email:'upper@example.invalid'},now=1793270000000;
function fixture(hero,branch,level){const save={...P.empty(),st:{'10-6':3},adv:{[hero]:{b:branch,n:1}},souls:1234};
 const wallet={...H.initialGrowth(save),user_id:user.id,balance:10000};wallet.xp[hero]=H.totalXP(level);
 const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,updated_at:new Date(now).toISOString(),merged:true}],hd3d_growth_wallet:[wallet],hd3d_owned:['gunner','fighter'].map(h=>({user_id:user.id,item:'hero_'+h}))});
 const rpc=(n,args={},u=user)=>store.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+n,args},{now})).then(r=>r.data);
 return{store,rpc};}
test('upper tier server boundaries, advancement, preset switching and frozen run for all ten branches',async()=>{
 for(const [hero,branches]of Object.entries(ADV)){
  if(hero==='mechanic')continue;
  for(const branch of Object.keys(branches))for(const tier of [30,40,50]){
   const f=fixture(hero,branch,tier-1),[a,b]=treeOptions(hero,branch,tier),args={p_id:`upper-${hero}-${branch}-${tier}-a`,p_revision:0,p_hero:hero,p_branch:branch,p_preset:0,p_tier:tier,p_choice:a.id};
   assert.equal((await f.rpc('build',args)).reason,'locked');
   const invested=await f.rpc('invest',{p_id:`level-${hero}-${branch}-${tier}`,p_revision:0,p_hero:hero,p_level:tier});assert.equal(invested.ok,true);
   const r=await f.rpc('build',{...args,p_revision:1});assert.equal(r.ok,true);assert.equal(r.growth.trees[hero][branch].presets[0][tier],a.id);
   assert.equal((await f.rpc('build',{...args,p_revision:1})).already,true);
   const s=await f.rpc('start',{p_id:`run-${hero}-${branch}-${tier}`,p_mode:'campaign',p_stage:'hard-1-1',p_hero:hero});assert.equal(s.ok,true);assert.equal(s.build.choices[tier],a.id);
   assert.equal((await f.rpc('build',{...args,p_id:args.p_id+'b',p_revision:2,p_preset:1,p_choice:b.id})).ok,true);
   assert.equal((await f.rpc('build',{...args,p_id:args.p_id+'c',p_revision:3,p_preset:1,p_tier:null,p_choice:null})).ok,true);
   const replay=await f.rpc('start',{p_id:`run-${hero}-${branch}-${tier}`,p_mode:'campaign',p_stage:'hard-1-1',p_hero:hero});assert.equal(replay.build.choices[tier],a.id);
   const restored=await f.rpc('status');assert.equal(restored.growth.trees[hero][branch].active,1);assert.equal(restored.growth.trees[hero][branch].presets[1][tier],b.id);
   assert.equal(restored.growth.balance,10000-H.nextXP(tier-1));assert.equal(f.store.tables.hd3d_progress[0].data.souls,1234);
   assert.equal((await f.rpc('status',{}, {id:'upper-tree-b',email:'other@example.invalid'})).growth.trees,undefined);
   f.store.tables.hd3d_progress[0].data.adv[hero].b=Object.keys(branches).find(x=>x!==branch);
   assert.equal((await f.rpc('build',{...args,p_id:args.p_id+'d',p_revision:4})).reason,'advancement');
  }
 }
});
