import assert from 'node:assert/strict';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { STAGES } from '../src/data/stages.js';
import { previewWave, waveBoss } from '../src/core/roster.js';

// Compare shared wave numbers, including shields separately from raw HP.
// Flying attackers use their telegraphed skills; zero contact DPS is intentional.
const average=(stage,wave,key)=>previewWave(stage,wave).list.reduce((n,p)=>n+p.share*(ETYPES[p.t][key]||0),0);
const hp=(stage,wave)=>average(stage,wave,'hp')*stage.hp*1.16**(wave-1);
for(let ch=5;ch<=8;ch++){
 const entry=STAGES[`${ch}-1`],previous=STAGES[ch===5?'4-4':`${ch-1}-1`];
 for(const wave of [1,6,13]){
  assert.ok(hp(entry,wave)>hp(previous,wave),`${ch}: raw wave HP must rise at wave ${wave}`);
  assert.ok(hp(entry,wave)<hp(previous,wave)*2.6,`${ch}: avoid an unbounded entry HP cliff`);
 }
 assert.ok(average(entry,13,'dps')>average(previous,13,'dps'),`${ch}: mature roster contact damage must rise`);
 const mid=ETYPES[waveBoss(entry,5)],oldMid=ETYPES[waveBoss(previous,5)];
 assert.ok(mid.hp*entry.hp>oldMid.hp*previous.hp,`${ch}: miniboss HP must not regress`);
 if(mid.fly){assert.ok(mid.storm?.tower>=100&&mid.storm?.windup>=1.5);}
 else assert.ok(mid.dps>=ETYPES.boss.dps,`${ch}: miniboss contact pressure`);
 const final=STAGES[`${ch}-6`],oldFinal=STAGES[ch===5?'4-4':`${ch-1}-6`];
 const boss=ETYPES[waveBoss(final,final.waves)],oldBoss=ETYPES[waveBoss(oldFinal,oldFinal.waves)];
 assert.ok(boss.hp*final.hp>oldBoss.hp*oldFinal.hp);
 assert.ok(boss.dps>oldBoss.dps);
 for(let i=1;i<=6;i++){
  const s=STAGES[`${ch}-${i}`];
  assert.ok(s.waves>=13&&s.waves<=15);
  assert.ok((s.startGold||0)<=(s.spawns.length>1?60:40),'Extra starting money must reflect a specific map need');
  assert.ok(previewWave(s,1).list.length>=3,'Later chapters open with combined roles');
  const roster=ROSTERS[ch].pool.map(([k])=>ETYPES[k]);
  for(const e of roster){const skill=e.swamp||e.desert||e.storm||e.machine;if(skill?.interrupt)assert.ok(skill.windup>=1.3,'Retain an interruption window');}
 }
}
console.log('campaign-balance: chapter 4 to 8 wave, boss, opening economy and counter windows');
