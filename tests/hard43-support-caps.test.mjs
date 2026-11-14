import test from 'node:test';
import assert from 'node:assert/strict';
import {stageWave,capStageWave} from '../src/core/roster.js';
import {HARD_STAGES} from '../src/data/hard.js';
import {STAGES} from '../src/data/stages.js';
const stage=HARD_STAGES['hard-4-3'];
test('H4-3 first wave cannot roll a full siege group while retaining count and one threat',()=>{
 const q=stageWave(stage,1,11,()=>.999);
 assert.equal(q.length,11);assert.equal(q.filter(t=>t==='siege').length,1);assert.equal(q.filter(t=>t==='grunt').length,10);
});
test('captured eleven-enemy opener with three siege units is bounded without moving the other enemies',()=>{
 const q=['digger','siege','shield','siege','gargoyle','grunt','wraith','gargoyle','grunt','siege','shield'];
 const bounded=capStageWave(q,stage,1);
 assert.deepEqual(bounded,['digger','siege','shield','grunt','gargoyle','grunt','wraith','gargoyle','grunt','grunt','shield']);
 assert.equal(q.filter(x=>x==='siege').length,3);
});
test('only H4-3 receives limits; W5 to W6 moves one to two independently for both support types',()=>{
 assert.equal(stage.hp,3.95);assert.equal(stage.attackMul,1.15);assert.deepEqual(stage.spawns,STAGES['4-3'].spawns);
 const q=['siege','ruinroot','siege','ruinroot','siege','ruinroot','boss'];
 for(const wave of [1,5,6,15]){const cap=wave<=5?1:2,out=capStageWave(q,stage,wave);assert.equal(out.length,q.length);assert.equal(out.filter(t=>t==='siege').length,cap);assert.equal(out.filter(t=>t==='ruinroot').length,cap);assert.equal(out.at(-1),'boss');}
 for(const s of [...Object.values(STAGES),...Object.values(HARD_STAGES).filter(s=>s.id!=='hard-4-3')]){assert.equal(s.enemyCaps,undefined,s.id);assert.equal(capStageWave(q,s,1),q,s.id);}
});
test('capping uses no additional random draws and leaves HP, attack, count and boss policy outside roster unchanged',()=>{
 const without={...stage};delete without.enemyCaps;
 for(let wave=1;wave<=15;wave++)for(let seed=1;seed<=40;seed++){
  const random=()=>{let x=seed,n=0;const fn=()=>{n++;x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};return {fn,calls:()=>n};};
  const a=random(),b=random(),old=stageWave(without,wave,11+3*(wave-1),a.fn),next=stageWave(stage,wave,11+3*(wave-1),b.fn);
  assert.equal(a.calls(),b.calls());assert.equal(next.length,old.length);
  for(let i=0;i<next.length;i++)assert.ok(next[i]===old[i]||(['siege','ruinroot'].includes(old[i])&&next[i]==='grunt'));
 }
});
