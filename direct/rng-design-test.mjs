// Threat demonstration, not permission to accept client-generated outcomes.
// Pure product functions only; no database, network or actual player's save.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
const rich=()=>{const s=P.empty();s.souls=100000;s.mat={steel:100000,crystal:100000,essence:100};return s;};
const results={scope:'pure product function threat demonstration; NOT an accepted Rules write',enhancement:[],craft:[],reroll:null,battle:null};
for(let e=0;e<10;e++){
 const s=rich(),it=E.makeItem('armor',undefined,4,()=>.4,1);it.id='example';it.e=e;s.inv=[it];
 const cost=E.enhCost(it),[a,ra]=E.enhance(structuredClone(s),it.id,()=>0),[b,rb]=E.enhance(structuredClone(s),it.id,()=>.999999);
 assert.equal(ra,'ok');assert.equal(a.inv[0].e,e+1);assert.equal(rb,e===0?'ok':'fail');
 assert.equal(a.souls,b.souls);assert.deepEqual(a.mat,b.mat);assert.equal(s.souls-a.souls,cost.souls);
 results.enhancement.push({from:e,to:e+1,intendedPercent:E.ENH_RATE[e],forcedSuccess:ra,forcedHighRoll:rb,cost});
}
for(const recipe of E.RECIPES){
 const s=rich(),[a,ra,lo]=E.craft(structuredClone(s),recipe.k,'weapon','mage',()=>0,1),[b,rb,hi]=E.craft(structuredClone(s),recipe.k,'weapon','mage',()=>.999999,1);
 assert.equal(ra,'ok');assert.equal(rb,'ok');assert.equal(a.souls,b.souls);assert.deepEqual(a.mat,b.mat);assert.ok(hi.g>lo.g);
 results.craft.push({recipe:recipe.k,cost:E.craftCost(recipe,1),low:lo.g,chosenHigh:hi.g,sameCost:true});
}
{
 const s=rich(),it=E.makeItem('armor',undefined,4,()=>.4,1);it.id='reroll';s.inv=[it];
 const best=[['atk',E.subRange(4,'atk')[1]],['critD',E.subRange(4,'critD')[1]]];
 assert.equal(E.validSubs(it,best),true);const [spent,status]=E.reroll(s,it.id,()=>.4);assert.equal(status,'ok');const [,applied]=E.applySubs(spent,it.id,best);assert.equal(applied,true);
 results.reroll={syntacticallyValidChosenMaximum:best,acceptedByShapeValidator:true,cost:E.rerollCost(it),conclusion:'cost plus allowed ranges does not attest the sampled result'};
}
{
 const s=rich();const [a,ga,la]=P.applyRun(s,{wave:5,kills:20,hero:'mage',stage:true,ch:1},()=>0);
 const [b,gb,lb]=P.applyRun(s,{wave:5,kills:20,hero:'mage',stage:true,ch:1},()=>.999999);
 assert.equal(ga,gb);assert.equal(la.length,lb.length);assert.ok(lb[0].it.g>la[0].it.g);
 results.battle={sameWave:5,sameKills:20,sameSoulReward:ga,chests:la.length,lowGrade:la[0].it.g,chosenHighGrade:lb[0].it.g};
}
await fs.writeFile(new URL('../../direct-firestore-evidence-22/rng-design-results.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify({enhancement:results.enhancement.length,craft:results.craft.length,reroll:1,battle:1,pass:true,scope:results.scope}));
