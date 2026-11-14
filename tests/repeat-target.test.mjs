import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/account/progress.js';
import * as E from '../src/account/equip.js';
import { seeded } from '../src/account/rewarditems.js';
import { STAGES } from '../src/data/stages.js';
import { HARD_STAGES, hardReward } from '../src/data/hard.js';
import { REPEAT_ROWS, cleanTarget, targetGear } from '../src/data/repeat-target.js';
import { localGrowth } from '../src/account/growth-ledger.js';

test('only seven public codex rows; no grades, hidden heroes, prototypes or arbitrary items',()=>{
  assert.equal(REPEAT_ROWS.length,7);
  for(const x of ['mechanic','legend',4,{},[], '__proto__','weapon',undefined])assert.equal(cleanTarget(x),null);
});

test('all normal60 and hard30 stages: target row preserves grade, quantity, other boxes and codex identity',()=>{
  const oldNow=Date.now;Date.now=()=>1793500000000;
  let cases=0;
  try{
    for(const s of Object.values(STAGES))for(const row of REPEAT_ROWS){
      const save=P.clean({...P.empty(),st:{[s.id]:3}}),args={wave:s.waves,kills:123,hero:'mage',stage:true,ch:s.ch,repeatStage:s.id,repeatWin:true};
      const base=P.applyRun(save,args,seeded('normal-'+s.id))[0],next=P.applyRun(save,{...args,repeatTarget:row},seeded('normal-'+s.id))[0];
      assert.equal(next.chests.length,base.chests.length);assert.equal(next.souls,base.souls);assert.deepEqual(next.chests.slice(1),base.chests.slice(1));
      const a=next.chests[0],b=base.chests[0],target=targetGear(row);assert.equal(a.id,b.id);assert.equal(a.it.g,b.it.g);assert.equal(a.it.c,s.ch);assert.equal(a.it.s,target.s);assert.equal(a.it.h,target.h);assert.equal(a.souls,b.souls);
      E.openChests(next);assert.ok(P.codexBits(next,s.ch,row)&(1<<a.it.g));assert.deepEqual(P.clean(next).inv,next.inv);cases++;
    }
    for(const s of Object.values(HARD_STAGES))for(const row of REPEAT_ROWS){
      const base=hardReward(s,s.waves,true,false,'mage',seeded('hard-'+s.id)),next=hardReward(s,s.waves,true,false,'mage',seeded('hard-'+s.id),row);
      assert.equal(next.items.length,base.items.length);assert.equal(next.souls,base.souls);assert.deepEqual(next.items.slice(1),base.items.slice(1));assert.equal(next.items[0].g,base.items[0].g);assert.deepEqual({s:next.items[0].s,...(next.items[0].h?{h:next.items[0].h}:{})},targetGear(row));
      const opened=P.applyMail(P.empty(),101,next)[0];E.openChests(opened);assert.ok(P.codexBits(opened,s.ch,row)&(1<<next.items[0].g));cases++;
    }
  }finally{Date.now=oldNow;}
  assert.equal(cases,630);
});

test('first-clear guarantee, failed/partial runs and legacy requests remain identical',()=>{
  const now=Date.now;Date.now=()=>1793500000000;
  try{
    for(const s of Object.values(HARD_STAGES))for(const [n,win,first] of [[s.waves,true,true],[5,false,false],[s.waves,false,false],[3,true,false]]){
      assert.deepEqual(hardReward(s,n,win,first,'mage',seeded('keep')),hardReward(s,n,win,first,'mage',seeded('keep'),'fighter'));
      if(win&&first)assert.equal(hardReward(s,n,win,first,'mage',seeded('keep'),'fighter').items.at(-1).g,3);
    }
    const s=STAGES['1-1'],save=P.clean({...P.empty(),st:{'1-1':3}}),args={wave:s.waves,kills:20,stage:true,ch:1,hero:'mage'};
    for(const extra of [{},{repeatWin:false,repeatStage:s.id},{repeatWin:true,repeatStage:'1-2'},{repeatWin:true,repeatStage:s.id,wave:5},{repeatWin:true,repeatStage:s.id,ch:2}]){
      assert.deepEqual(P.applyRun(save,{...args,...extra},seeded('keep')),P.applyRun(save,{...args,...extra,repeatTarget:'fighter'},seeded('keep')));
    }
    assert.deepEqual(P.applyRun(P.empty(),{...args,repeatWin:true,repeatStage:s.id},seeded('keep')),P.applyRun(P.empty(),{...args,repeatWin:true,repeatStage:s.id,repeatTarget:'fighter'},seeded('keep')));
  }finally{Date.now=now;}
});

test('existing unopened items remain byte-identical; selecting does not reroll other chests',()=>{
  const save=P.empty(),old=E.makeItem('weapon','mage',4,seeded('old'),10);old.id='old-unopened';E.addChests(save,[{it:old,src:'boss'}]);save.st['1-1']=3;
  const next=P.applyRun(save,{stage:true,ch:1,wave:10,kills:2,hero:'mage',repeatWin:true,repeatStage:'1-1',repeatTarget:'gunner'},seeded('new'))[0];
  assert.deepEqual(next.chests[0],save.chests[0]);assert.deepEqual(P.clean(next).chests,next.chests);
  assert.deepEqual(P.applyRun(save,{stage:true,ch:1,wave:10,kills:2,hero:'mage',repeatWin:true,repeatStage:'1-1',repeatTarget:'gunner'},seeded('new'))[0].chests.map(x=>x.it.g),next.chests.map(x=>x.it.g));
});

test('hard target consumes the same RNG sequence and exact grade draws on a stratified 9800 sample',()=>{
  const s=HARD_STAGES['hard-5-1'];const hist=[0,0,0,0,0];
  for(let i=0;i<9800;i++){
    const seq=()=>{let n=0;return()=>n++%2===0?.2:(i+.5)/9800;};
    const a=hardReward(s,s.waves,true,false,'mage',seq()),b=hardReward(s,s.waves,true,false,'mage',seq(),'armor');
    assert.deepEqual(a.items.map(x=>x.g),b.items.map(x=>x.g));hist[b.items[0].g]++;
  }
  assert.deepEqual(hist,[0,600,1200,6500,1500]);
});

test('guest ledger snapshots selection and repeat eligibility, rejects changing an existing run',()=>{
  const save=P.clean({...P.empty(),st:{'1-1':3}}),args={p_id:'guest-repeat',p_mode:'campaign',p_stage:'1-1',p_hero:'mage',p_target:'fighter'};
  const a=localGrowth(null,'start',args,save,()=>true);assert.equal(a.result.target,'fighter');assert.equal(a.result.repeat,true);
  assert.equal(localGrowth(a.doc,'start',{...args,p_target:'armor'},save,()=>true).result.reason,'id_reused');
  const first=localGrowth(null,'start',args,P.empty(),()=>true);assert.equal(first.result.target,null);assert.equal(first.result.repeat,false);
  const old=localGrowth(null,'start',{...args,p_target:undefined},save,()=>true);assert.equal(old.result.target,null);
});
