import assert from 'node:assert/strict';
import {reconcileDirectSave} from '../src/account/direct-save-view.js';
import {empty,clean} from '../src/account/progress.js';
const raw=empty();raw.souls=1000;raw.keepLegacy={array:[1,2],text:'retained'};raw.research.arrow={atk:10,rng:2,spd:0,start:1};
for(const missing of [false,true]){
 const source=structuredClone(raw);if(missing)delete source.research;const frozen=structuredClone(source),view=clean(source);view.nick='새 이름';
 const next=reconcileDirectSave(source,view);assert.deepEqual(source,frozen);assert.deepEqual(next.keepLegacy,source.keepLegacy);assert.deepEqual(next.research,source.research);assert.equal(next.nick,view.nick);
 view.souls-=30;view.heroLv.mage.hp++;const upgraded=reconcileDirectSave(source,view);assert.equal(upgraded.souls,970);assert.equal(upgraded.heroLv.mage.hp,1);assert.deepEqual(upgraded.keepLegacy,source.keepLegacy);assert.deepEqual(upgraded.research,source.research);
 for(const change of [s=>s.souls++,s=>s.mat.steel++,s=>s.st['10-6']=3,s=>s.codex['1']={mage:31},s=>s.research.magic.atk++]){const bad=clean(source);change(bad);assert.throws(()=>reconcileDirectSave(source,bad),e=>e.code==='DIRECT_ACTION_REQUIRED');}
}
console.log('PASS raw legacy fields/absence/alias retained through normalized no-op, cosmetic save and paid training; arbitrary economic edits rejected');
