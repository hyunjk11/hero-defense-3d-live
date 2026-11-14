import assert from 'node:assert/strict';
import { STORM_ENEMIES, STORM_SET, STORM_ROSTER } from '../src/data/chapters/storm.js';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { CHSET } from '../src/data/items.js';
import { STAGES } from '../src/data/stages.js';
import { stageWave,waveBoss,previewWave } from '../src/core/roster.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import { stormIcon } from '../src/ui/storm-icons.js';
import { inStormCircle,inStormRing,stormChain } from '../src/monsters/storm-geometry.js';
import { towerCdStep } from '../src/combat/towerstatus.js';
const R=seed=>()=> (seed=seed*16807%2147483647)/2147483647;
assert.equal(CHSET[7],STORM_SET);assert.equal(ROSTERS[7],STORM_ROSTER);
assert.equal(new Set(Object.values(STORM_ENEMIES).map(e=>e.form)).size,8);
for(const[key,e]of Object.entries(STORM_ENEMIES)){assert.equal(ETYPES[key],e);assert.equal(e.proc,'storm');assert.ok(e.hp>0&&e.gold>0);}
for(let s=1;s<=6;s++)for(let w=1;w<=STAGES[`7-${s}`].waves;w++){
 const stage=STAGES[`7-${s}`],queue=stageWave(stage,w,8+w*3,R(s*100+w));assert.ok(queue.every(k=>STORM_ENEMIES[k]&&!STORM_ENEMIES[k].child));assert.equal(previewWave(stage,w).boss,waveBoss(stage,w));
 if(w%5===0||w===stage.waves)assert.ok(STORM_ENEMIES[waveBoss(stage,w)]?.boss);
}
assert.equal(waveBoss(STAGES['7-6'],15),'boss_storm');assert.equal(waveBoss(STAGES['7-1'],5),'storm_sentinel');
for(const[id,type]of [['7-2','storm_splitter'],['7-3','storm_pikeman'],['7-4','storm_caller'],['7-5','storm_anchor']]){
 const share=id=>previewWave(STAGES[id],8).list.find(e=>e.t===type).share;assert.ok(share(id)>share('7-1')*1.4);
 const queue=stageWave(STAGES[id],8,10000,R(75));assert.ok(Math.abs(queue.filter(k=>k===type).length/queue.length-share(id))<.02);
}
const origin={x:0,z:0};assert.ok(!inStormRing(origin,origin,1.6,4.6));assert.ok(!inStormRing({x:1.59,z:0},origin,1.6,4.6));assert.ok(inStormRing({x:1.6,z:0},origin,1.6,4.6));assert.ok(inStormRing({x:4.6,z:0},origin,1.6,4.6));assert.ok(!inStormRing({x:4.61,z:0},origin,1.6,4.6));assert.ok(inStormCircle({x:1.15,z:0},origin,1.15));
const list=[{id:1,x:0,z:0},{id:2,x:2,z:0},{id:3,x:4,z:0},{id:4,x:8,z:0}];
assert.deepEqual(stormChain(list[0],list,2.8,2,new Set([1])).map(t=>t.id),[2,3]);
assert.deepEqual(stormChain(list[0],list,2.8,5,new Set([1])).map(t=>t.id),[2,3]);
assert.deepEqual(stormChain(list[0],list,2.8,5,new Set([1,2])),[]); // A previously hit neighbor cannot bridge a second chain.
assert.deepEqual(stormChain(list[0],list,2.8,0,new Set([1])),[]);
const names=new Set(),icons=new Set();for(const[row,ns]of Object.entries(STORM_SET.names)){assert.equal(ns.length,5);icons.add(stormIcon({c:7,s:['armor','acc'].includes(row)?row:'weapon',h:row,g:3}));for(const n of ns){assert.ok(!names.has(n));names.add(n);}}
assert.equal(names.size,40);assert.equal(icons.size,8);assert.equal(stormIcon({c:6}),null);
let save=P.empty(),rng=R(42);for(const slot of E.SLOT_KEYS){const it=E.makeItem(slot,'mage',3,rng,7);it.e=5;save.inv.push(it);save.eq.mage[slot]=it.id;}
const raw={};for(const it of save.inv)for(const[k,v]of Object.entries(E.itemStats(it)))raw[k]=(raw[k]||0)+v;
assert.equal(E.bonus(save,'mage').spd,(raw.spd||0)+6);assert.equal(E.bonus(save,'mage').rng,(raw.rng||0)+8);assert.equal(E.setBonuses(save,'mage').length,2);
const rt=P.clean(JSON.parse(JSON.stringify(save)));assert.deepEqual(E.bonus(rt,'mage'),E.bonus(save,'mage'));assert.deepEqual(rt.inv.map(i=>i.id),save.inv.map(i=>i.id));assert.ok(rt.inv.every(it=>it.e===5));
delete save.eq.mage.acc;assert.equal(E.setBonuses(save,'mage').length,1);delete save.eq.mage.armor;assert.equal(E.setBonuses(save,'mage').length,0);
const[cleared,reward]=P.applyStage(P.empty(),'7-1',2,'mage',R(80));assert.ok(reward.first&&cleared.chests.length>0);assert.ok(cleared.chests.every(c=>c.it.c===7&&c.it.g>=1&&names.has(c.it.n)));
const[,opened]=E.openChests(cleared);assert.ok(opened.opened.length);const[,repeat]=E.openChests(cleared);assert.equal(repeat.opened.length,0);
const tw={cd:10,stormUntil:5,stormK:.7};towerCdStep(tw,1,4);assert.equal(tw.cd,9.3);towerCdStep(tw,1,5);assert.equal(tw.cd,8.3);
console.log('storm.test ok: roster, stage composition, ring dodge, chain exclusion, gear/rewards/save, gust expiry');
