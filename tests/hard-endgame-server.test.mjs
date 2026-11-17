import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {MemoryStore} from '../server/memory-store.mjs';
import {execute} from '../server/operations.mjs';
import {HARD_STAGES,cleanHard,hardReward,hardXP} from '../src/data/hard.js';
import {collectionCount,collectionOdds,optionalCollectionGrade} from '../src/data/hard-collection.js';
import {nextStage} from '../src/data/stages.js';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import * as H from '../src/data/hero-growth.js';
const user={id:'hard-endgame-qa',email:'hard-endgame@example.invalid'};
const newStages=Object.values(HARD_STAGES).filter(s=>s.ch>=7);
function fixture(ch=7){
 let now=1793600000000;
 const data=P.clean({...P.empty(),souls:300,st:{'10-6':3,'1-1':3}});
 const hard={version:1,st:Object.fromEntries(Object.values(HARD_STAGES).filter(s=>s.ch<ch).map(s=>[s.id,3]))};
 const db=new MemoryStore({hd3d_progress:[{user_id:user.id,data,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[{...H.initialGrowth(data),user_id:user.id,hard}]});
 const call=(name,args,u=user)=>db.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_'+name,args},{now,random:()=>0})).then(r=>r.data);
 const start=(id,stage,extra={})=>call('start',{p_id:id,p_mode:'campaign',p_stage:stage,p_hero:'mage',...extra});
 const finish=(id,stage,extra={})=>call('progress',{p_token:id,p_completed:HARD_STAGES[stage].waves,p_win:true,p_finish:true,p_stars:3,p_kills:7,...extra});
 return {db,call,start,finish,tick:()=>now+=120000,save:()=>db.tables.hd3d_progress[0].data,wallet:()=>db.tables.hd3d_growth_wallet[0]};
}
test('24 new stages, cross-chapter gates and final endpoint preserve normal progress',async()=>{
 assert.equal(newStages.length,24);const f=fixture(),oldNormal=structuredClone(f.save().st);
 delete f.wallet().hard.st['hard-6-6'];assert.equal((await f.start('endgame-locked-7','hard-7-1')).reason,'locked');f.wallet().hard.st['hard-6-6']=3;
 for(const s of newStages){
  const next=newStages[newStages.indexOf(s)+1];
  if(next)assert.equal((await f.start('future-'+next.id,next.id)).reason,'locked');
  const id='complete-'+s.id;assert.equal((await f.start(id,s.id)).ok,true);f.tick();assert.equal((await f.finish(id,s.id)).ok,true);
  assert.equal(nextStage({...f.save(),growth:H.cleanGrowth(f.wallet())},s.id),next?.id??null);
 }
 assert.equal((await f.start('endgame-forged-11','hard-11-1')).reason,'locked');
 assert.equal((await f.start('endgame-forged-107','hard-10-7')).reason,'locked');
 assert.deepEqual(f.save().st,oldNormal);assert.equal(Object.keys(cleanHard(f.wallet().hard).st).length,60);
});
test('every H7–10 first/repeat clear settles exactly once with first epic, XP and no-white collection',async()=>{
 for(let ch=7;ch<=10;ch++){
  const f=fixture(ch),oldGear=E.makeItem('weapon','mage',0,()=>.1,ch);oldGear.id='retained-white';f.save().inv.push(oldGear);f.save().codex[ch]={mage:1};
  const oldInv=structuredClone(f.save().inv),oldCodex=structuredClone(f.save().codex);
  for(const s of newStages.filter(s=>s.ch===ch)){
   const id='first-'+s.id;assert.equal((await f.start(id,s.id)).ok,true);const earned=f.wallet().earned;f.tick();
   let count=f.save().chests.length;const r=await f.finish(id,s.id),boxes=f.save().chests.slice(count);
   assert.equal(r.ok,true);assert.equal(r.hardSaved,true);assert.equal(boxes.length,Math.floor(s.waves/5)+1);assert.equal(boxes.at(-1).it.g,3);assert.ok(boxes.every(x=>x.it.c===ch&&x.it.g>=1));
   assert.equal(f.wallet().earned-earned,hardXP(s,s.waves,true,true));assert.equal(f.wallet().hard.st[s.id],3);
   let before=structuredClone(f.db.tables);assert.equal((await f.finish(id,s.id)).already,true);assert.deepEqual(f.db.tables,before);
   const rid='repeat-'+s.id;assert.equal((await f.start(rid,s.id,{p_target:'armor',p_partner:'warrior',p_partyVersion:1})).ok,true);assert.equal(f.db.tables.hd3d_growth_runs.at(-1).hardRewardVersion,2);f.tick();count=f.save().chests.length;
   const results=await Promise.all([f.finish(rid,s.id),f.finish(rid,s.id)]);assert.ok(results.every(x=>x.ok));assert.equal(results.filter(x=>x.already).length,1);
   const repeat=f.save().chests.slice(count);assert.equal(repeat.length,Math.floor(s.waves/5)+2);assert.equal(repeat[0].it.s,'armor');assert.ok(repeat.every(x=>x.it.c===ch&&x.it.g>=1));assert.ok(repeat.slice(-2).every(x=>x.it.g===1));
   before=structuredClone(f.db.tables);assert.equal((await f.finish(rid,s.id,{p_stars:1})).already,true);assert.deepEqual(f.db.tables,before);
  }
  assert.deepEqual(f.save().inv,oldInv);assert.deepEqual(f.save().codex,oldCodex);assert.equal(f.save().stats.runs,12);
 }
});
test('H7–10 defeat/partial and old reward versions cannot grant collection extras',async()=>{
 for(let ch=7;ch<=10;ch++)for(const legacy of [false,true]){
  const f=fixture(ch),s=HARD_STAGES[`hard-${ch}-1`];f.wallet().hard.st[s.id]=3;const id=`partial-${ch}-${legacy}`;
  await f.start(id,s.id);if(legacy)delete f.db.tables.hd3d_growth_runs[0].hardRewardVersion;f.tick();
  const r=await f.finish(id,s.id,legacy?{p_reward_version:2,p_chests:200}:{p_completed:5,p_win:false});
  assert.equal(r.hardReward.chests,Math.floor((legacy?s.waves:5)/5));assert.equal(f.wallet().hard.st[s.id],3);
 }
});
test('all new gear opens into existing chapter codex without removing legacy white bits',()=>{
 for(let ch=7;ch<=10;ch++){
  let save=P.empty();save.codex[ch]={mage:1};const s=HARD_STAGES[`hard-${ch}-1`];
  [save]=P.applyMail(save,700+ch,hardReward(s,s.waves,true,false,'mage',()=>0,null,2));
  assert.equal(P.codexBits(save,ch,'mage'),1);E.openChests(save);assert.equal(P.codexBits(save,ch,'mage'),3);
  assert.equal(P.codexState(save,ch).total,28);assert.equal(optionalCollectionGrade(ch,0),true);
  assert.deepEqual(P.clean(JSON.parse(JSON.stringify(save))),P.clean(save));assert.deepEqual(collectionOdds(ch),[0,70,30,0,0]);
  assert.equal(collectionCount(s,s.waves,true,false,2),2);
 }
});
test('H1–6 stage and reward results stay equal to pre-expansion production source',async()=>{
 const source=execFileSync('git',['show','1d38bcb:src/data/hard.js'],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_,p)=>`from '${new URL('../src/data/'+p,import.meta.url).href}'`);
 const old=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 for(const s of Object.values(old.HARD_STAGES)){
  assert.deepEqual(HARD_STAGES[s.id],s);
  for(const first of [false,true])for(const win of [false,true])for(const version of [1,2]){
   let a=0,b=0;assert.deepEqual(hardReward(s,s.waves,win,first,'mage',()=>((a++*17)%97)/97,'armor',version),old.hardReward(s,s.waves,win,first,'mage',()=>((b++*17)%97)/97,'armor',version));assert.equal(a,b);
  }
 }
});
