// Current five-level specialization contract; original awakening test is archived.
import assert from 'node:assert/strict';
import * as G from '../src/data/growth.js';
assert.equal('AWK' in G,false);
assert.equal(G.MAX_TOWER_LEVEL,5);
const before=JSON.stringify(G.BRANCH);
const expected={multi:{targets:5},snipe:{dmg:3},blast:{cluster:5},pierce:{dmg:2.7},storm:{chainAdd:6,falloff:.98},frost:{freezeEvery:3},guardian_bulwark:{guardianPulse:true,soldierHp:2},guardian_assault:{guardianCharge:true,guardianCleave:true,dmg:1.6}};
let branches=0;
for(const type of G.TTYPES) for(const branch of Object.keys(G.BRANCH[type])){
 branches++;
 for(const [key,value] of Object.entries(expected[branch])) assert.equal(G.branchFor(type,branch,null,5)[key],value);
 for(let level=1;level<=5;level++) for(let stars=1;stars<=3;stars++){
  const actual=G.towerStats(type,level,branch,null,stars);
  for(const key of ['dmg','rate','range']) assert.ok(Number.isFinite(actual[key])&&actual[key]>0);
 }
 const tower={type,lvl:3,xp:2399};assert.equal(G.canSpecialize(tower),false);
 assert.notEqual(G.upgradeBlock(tower,1e9),null);
 tower.xp=2400;assert.equal(G.canSpecialize(tower),true);
 assert.notEqual(G.upgradeBlock(tower,1e9),null);
 tower.branch=branch;assert.equal(G.upgradeBlock(tower,1e9),null);
 tower.lvl=5;assert.notEqual(G.upgradeBlock(tower,1e9),null);
}
assert.equal(branches,8);assert.equal(JSON.stringify(G.BRANCH),before);
assert.deepEqual([G.starsFor(599),G.starsFor(600),G.starsFor(2399),G.starsFor(2400)],[1,2,2,3]);
console.log('PASS: eight specialization paths, star boundaries and five-level cap');
