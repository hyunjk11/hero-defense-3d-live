// Current towerStats(type,level,branch,mods,stars); archived original used retired arguments.
import assert from 'node:assert/strict';
import * as G from '../src/data/growth.js';
import * as P from '../src/account/progress.js';
import {TOWERS} from '../src/data/towers.js';
for(const type of G.TTYPES){
 for(let level=1;level<=5;level++){
  const t=G.towerStats(type,level);
  assert.equal(t.dmg,TOWERS[type].dmg[level-1]);assert.equal(t.rate,TOWERS[type].rate[level-1]);
  assert.equal(t.range,TOWERS[type].range[level-1]);
  for(let stars=1;stars<=3;stars++){
   const actual=G.towerStats(type,level,null,null,stars),scale=G.STAR[stars-1];
   assert.equal(actual.dmg,t.dmg*scale.dmg);assert.equal(actual.rate,t.rate*scale.rate);assert.equal(actual.range,t.range*scale.rng);
  }
 }
 const s=P.empty();s.souls=1e8;s.mat.steel=1e6;s.mat.crystal=1e6;
 for(const key of G.RKEYS){
  for(let lv=0;lv<G.RES[key].max;lv++){
   const cost=G.resCost(key,lv),souls=s.souls,mat=s.mat[G.RES[key].mat];
   assert.equal(G.buyResearch(s,type,key),true);
   assert.equal(s.souls,souls-cost.souls);assert.equal(s.mat[G.RES[key].mat],mat-cost[G.RES[key].mat]);
  }
  const before=JSON.stringify(s);assert.equal(G.buyResearch(s,type,key),false);assert.equal(JSON.stringify(s),before);
 }
 assert.deepEqual(P.clean(JSON.parse(JSON.stringify(P.clean(s)))),P.clean(s));
}
assert.deepEqual(G.cleanResearch({arrow:{start:4,atk:3}}).arrow,{atk:3,rng:0,spd:0,efficiency:4});
assert.equal(G.cleanResearch({arrow:{start:4,efficiency:2}}).arrow.efficiency,2);
assert.equal(G.upgradeCost('arrow',4,G.resMods({arrow:{atk:0,rng:0,spd:0,efficiency:4}},'arrow')),152);
console.log('PASS: tower call contract, research exact charges/caps and legacy migration');
