// Released explicit hard IDs and unchanged reward contracts; old hst/UQ_DROP test archived.
import assert from 'node:assert/strict';
import * as H from '../src/data/hard.js';
import {COLLECTION_ODDS} from '../src/data/hard-collection.js';
const ids=Object.keys(H.HARD_STAGES);assert.equal(ids.length,36);
const save={st:{},growth:{hard:{st:{}}}};
for(const id of ids)assert.equal(H.hardUnlocked(save,id),false);
save.st['10-6']=1;
for(let i=0;i<ids.length;i++){
 const id=ids[i],s=H.HARD_STAGES[id];assert.equal(H.hardUnlocked(save,id),true);
 if(ids[i+1])assert.equal(H.hardUnlocked(save,ids[i+1]),false);
 save.growth.hard.st[id]=1;
 const n=Math.floor(s.waves/5),first=H.hardReward(s,s.waves,true,true,'mage',()=>0,null,2);
 assert.equal(first.items.length,n+1);assert.equal(first.items.at(-1).g,3);
 const repeat=H.hardReward(s,s.waves,true,false,'mage',()=>0,null,2);
 assert.equal(repeat.items.length,n+2);assert.deepEqual(repeat.items.slice(-2).map(x=>x.g),s.ch>=3?[1,1]:[0,0]);
 assert.ok(repeat.items.every(x=>x.c===s.ch&&x.k==='gear'));
 const old=H.hardReward(s,s.waves,true,false,'mage',()=>0,null,1);
 assert.deepEqual(repeat.items.slice(0,n),old.items);assert.equal(repeat.souls,old.souls);
 const partial=H.hardReward(s,s.waves-1,false,false,'mage',()=>0,null,2);
 assert.equal((partial.items||[]).length,Math.floor((s.waves-1)/5));
 const unit=30+4*(s.ch-1),xp=s.waves*unit+Math.floor(s.waves*unit/3);
 assert.equal(H.hardXP(s,s.waves,true,false),xp);assert.equal(H.hardXP(s,s.waves,true,true),xp+Math.floor(xp/2));
}
assert.equal(H.hardUnlocked(save,'hard-7-1'),false);
assert.deepEqual(COLLECTION_ODDS,[50,35,15,0,0]);
assert.deepEqual(H.cleanHard({st:{'hard-1-1':9,'hard-5-6':2,'hard-6-1':3,'hard-7-1':3,'hard-1-2':-1}}).st,{'hard-1-1':3,'hard-5-6':2,'hard-6-1':3});
console.log('PASS: 36 stage unlocks, first guarantee, repeat/partial/version rewards and XP');
