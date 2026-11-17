import assert from 'node:assert/strict';
import { farmingRoute } from '../src/data/farming-route.js';
import { empty,dropPreview } from '../src/account/progress.js';
import { CHAPTERS,HARD_CHAPTERS,stageUnlocked } from '../src/data/stages.js';
const save=empty(),before=JSON.stringify(save);
assert.equal(farmingRoute(save,3,'armor',0),null);
assert.equal(farmingRoute(save,99,'armor',4),null);
assert.equal(farmingRoute(save,1,'invalid',4),null);
assert.equal(farmingRoute(save,1,'armor',9),null);
const locked=farmingRoute(save,10,'fighter',4,{hard:true,repeat:true});
assert.ok(locked.locked);assert.equal(locked.target,false);
assert.equal(JSON.stringify(save),before);
for(const c of CHAPTERS)for(const s of c.stages)save.st[s.id]=3;
save.growth={hard:{st:Object.fromEntries(HARD_CHAPTERS.flatMap(c=>c.stages.map(s=>[s.id,3])))}};
for(let ch=1;ch<=10;ch++)for(let grade=ch>=3?1:0;grade<=4;grade++){
 const r=farmingRoute(save,ch,'fighter',grade,{hard:true,repeat:true});
 assert.ok(r);assert.ok(stageUnlocked(save,r.id));assert.ok(dropPreview(r.id,save.hero,save).odds[grade]>0);assert.ok(r.target);assert.match(r.label,/등급 무작위/);
}
assert.ok(!farmingRoute(save,1,'mage',4,{hard:false}).id.startsWith('hard-'));
assert.equal(farmingRoute(save,'abyssal','armor',4).dungeon,true);
assert.equal(farmingRoute(save,'abyssal','armor',3),null);
assert.equal(farmingRoute(save,'morvia','archer',3).dungeon,true);
assert.equal(farmingRoute(save,1,'fighter',4,{repeat:false}).target,false);
console.log('PASS farming routes: locks, ownership-neutral targets, grades, no save mutation');
