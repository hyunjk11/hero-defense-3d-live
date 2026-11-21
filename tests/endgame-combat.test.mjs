import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyResearch,resMods,towerStats} from '../src/data/growth.js';
import {beamAttackBonus,startingGoldBonus,endgameTowerMods} from '../src/data/endgame-research.js';

const closeTo=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`expected ${b}, got ${a}`);
test('beam research adds one percentage point per rank without altering cadence, heat or other towers',()=>{
  const research=emptyResearch(), save={research,endgameResearch:{gold:237,beam:1}};
  assert.equal(beamAttackBonus(save),0);
  research.guardian.atk=10;
  const base=resMods(research,'guardian');
  closeTo(base.dmg,1.4);
  closeTo(endgameTowerMods(research,'guardian',undefined,beamAttackBonus(save)).dmg,1.41);
  save.endgameResearch.beam=40;
  const upgraded=endgameTowerMods(research,'guardian',undefined,beamAttackBonus(save));
  closeTo(upgraded.dmg,1.8);
  closeTo(endgameTowerMods(research,'guardian',{dmg:1.2,rate:1,rng:1,splash:1,br:{}},.4).dmg,1.8*1.2);
  for(const branch of [null,'guardian_assault','guardian_bulwark']){
    const before=towerStats('guardian',5,branch,base,3), after=towerStats('guardian',5,branch,upgraded,3);
    closeTo(after.dmg,before.dmg*1.8/1.4);
    assert.deepEqual({...after,dmg:before.dmg},before);
  }
  for(const kind of ['arrow','cannon','magic'])assert.deepEqual(endgameTowerMods(research,kind,undefined,.4),resMods(research,kind));
  assert.equal(startingGoldBonus(save),237);
  assert.equal(startingGoldBonus({}),0);
});
