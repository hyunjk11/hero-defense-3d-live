import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceWave, practiceWaveNumber, PRACTICE_PRESETS } from '../src/core/practice-wave.js';
import { STAGES, HARD_STAGES } from '../src/data/stages.js';
import { ETYPES } from '../src/data/monsters.js';
import { stageWave, waveBoss } from '../src/core/roster.js';
import { eliteQueue } from '../src/data/hard.js';

test('normal, elite, boss and mixed presets queue only the intended enemy categories',()=>{
  assert.deepEqual(Object.keys(PRACTICE_PRESETS),['normal','elite','boss','mixed','stage']);
  const n=practiceWave('normal'), e=practiceWave('elite'), b=practiceWave('boss'), m=practiceWave('mixed');
  assert.ok(n.queue.every(t=>!ETYPES[t].boss));assert.equal(n.elites,null);assert.equal(n.hard,null);
  assert.ok(e.elites.every(Boolean));assert.ok(e.exclusiveElites);assert.ok(e.queue.every(t=>!ETYPES[t].boss));
  assert.equal(b.queue.length,1);assert.ok(ETYPES[b.queue[0]].boss);
  assert.ok(m.elites.some(Boolean));assert.ok(m.queue.some(t=>ETYPES[t].boss));
  assert.equal(m.queue.find((t,i)=>!ETYPES[t].boss&&!m.elites[i]),'grunt');
  assert.equal(practiceWave('toString'),null);
});
test('every selectable Normal and Hard stage runs an authentic first/final roster, HP and elite queue',()=>{
  for(const stage of [...Object.values(STAGES),...Object.values(HARD_STAGES)]) for(const wave of [1,stage.waves]){
    const n=8+wave*3;
    const source=stageWave(stage,wave,n,()=>.35), b=waveBoss(stage,wave);
    if(b){if(stage.boss&&wave===stage.waves)source.push(b);else source.splice(Math.floor(n/2),0,b);}
    const p=practiceWave('stage',{stage,wave,random:()=>.35});
    assert.deepEqual(p.queue,source,stage.id);
    assert.equal(p.hp,1.16**(wave-1)*stage.hp);
    assert.deepEqual(p.elites,stage.hard?eliteQueue(source,wave,ETYPES,stage.rule):null);
    assert.equal(p.hard,stage.hard?stage:null);
  }
  const s=STAGES['1-1'];
  assert.equal(practiceWaveNumber(s,-1),1);
  assert.equal(practiceWaveNumber(s,999),s.waves);
  assert.equal(practiceWaveNumber(s,NaN),1);
});
