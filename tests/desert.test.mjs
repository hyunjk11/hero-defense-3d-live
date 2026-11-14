import assert from 'node:assert/strict';
import { DESERT_ENEMIES, DESERT_SET, DESERT_ROSTER } from '../src/data/chapters/desert.js';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { CHSET } from '../src/data/items.js';
import { STAGES } from '../src/data/stages.js';
import { stageWave, waveBoss, previewWave } from '../src/core/roster.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import { desertIcon } from '../src/ui/desert-icons.js';
import { inDesertCircle, inDesertLane } from '../src/monsters/desert-geometry.js';
import { towerCdStep } from '../src/combat/towerstatus.js';
const R = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
assert.equal(CHSET[6], DESERT_SET); assert.equal(ROSTERS[6], DESERT_ROSTER);
assert.equal(new Set(Object.values(DESERT_ENEMIES).map(e => e.form)).size, 8);
for (const [key, e] of Object.entries(DESERT_ENEMIES)) { assert.equal(ETYPES[key],e); assert.equal(e.proc,'desert'); assert.ok(e.hp>0 && e.gold>0); }
for(let s=1;s<=6;s++) for(let w=1;w<=STAGES[`6-${s}`].waves;w++) {
 const stage=STAGES[`6-${s}`], queue=stageWave(stage,w,8+w*3,R(s*100+w));
 assert.ok(queue.every(k=>DESERT_ENEMIES[k]&&!DESERT_ENEMIES[k].child));
 assert.equal(previewWave(stage,w).boss,waveBoss(stage,w));
 if(w%5===0||w===stage.waves) assert.ok(DESERT_ENEMIES[waveBoss(stage,w)]?.boss);
}
assert.equal(waveBoss(STAGES['6-6'],15),'boss_desert'); assert.equal(waveBoss(STAGES['6-1'],5),'sand_sentinel');
for(const [id,t] of [['6-2','sand_burrower'],['6-3','sand_guard'],['6-4','sand_priest'],['6-5','sand_vulture']]) {
 const share=id=>previewWave(STAGES[id],6).list.find(e=>e.t===t).share;
 assert.ok(share(id)>share('6-1')*1.4);
 const queue=stageWave(STAGES[id],6,10000,R(75)); assert.ok(Math.abs(queue.filter(k=>k===t).length/queue.length-share(id))<.02);
}
const a={x:0,z:0},b={x:0,z:10};
assert.ok(inDesertLane({x:1,z:5},a,b,2));assert.ok(!inDesertLane({x:1.01,z:5},a,b,2));
assert.ok(!inDesertLane({x:0,z:-1},a,b,2));assert.ok(!inDesertLane({x:0,z:11},a,b,2));
assert.ok(!inDesertLane({x:3,z:0},a,a,2)); assert.ok(inDesertCircle({x:1.8,z:0},a,1.8));
const names=new Set(),icons=new Set();
for(const [row,ns] of Object.entries(DESERT_SET.names)){assert.equal(ns.length,5);icons.add(desertIcon({c:6,s:['armor','acc'].includes(row)?row:'weapon',h:row,g:3})); for(const n of ns){assert.ok(!names.has(n));names.add(n);}}
assert.equal(names.size,40);assert.equal(icons.size,8);assert.equal(desertIcon({c:5}),null);
let save=P.empty(),rng=R(42);
for(const slot of E.SLOT_KEYS){const it=E.makeItem(slot,'mage',3,rng,6);it.e=5;save.inv.push(it);save.eq.mage[slot]=it.id;}
const raw={};for(const it of save.inv)for(const[k,v]of Object.entries(E.itemStats(it)))raw[k]=(raw[k]||0)+v;
assert.equal(E.bonus(save,'mage').atk,raw.atk+6);assert.equal(E.bonus(save,'mage').critD,(raw.critD||0)+12);
assert.equal(E.setBonuses(save,'mage').length,2);
const rt=P.clean(JSON.parse(JSON.stringify(save))); assert.deepEqual(E.bonus(rt,'mage'),E.bonus(save,'mage'));assert.deepEqual(rt.inv.map(i=>i.id),save.inv.map(i=>i.id));assert.ok(rt.inv.every(it=>it.e===5));
delete save.eq.mage.acc; assert.equal(E.setBonuses(save,'mage').length,1);delete save.eq.mage.armor;assert.equal(E.setBonuses(save,'mage').length,0);
const [cleared,reward]=P.applyStage(P.empty(),'6-1',2,'mage',R(80)); assert.ok(reward.first&&cleared.chests.length>0);
assert.ok(cleared.chests.every(c=>c.it.c===6&&c.it.g>=1&&names.has(c.it.n)));
const[,opened]=E.openChests(cleared);assert.ok(opened.opened.length);const[,repeat]=E.openChests(cleared);assert.equal(repeat.opened.length,0);
const tw={cd:10,sandUntil:5,sandK:.65};towerCdStep(tw,1,4);assert.equal(tw.cd,9.35);towerCdStep(tw,1,5);assert.equal(tw.cd,8.35);
console.log('desert.test ok: eight bespoke forms, six stages, telegraph geometry, gear/rewards/save and sand expiry');
