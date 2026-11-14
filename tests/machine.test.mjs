import assert from 'node:assert/strict';
import { MACHINE_ENEMIES, MACHINE_SET, MACHINE_ROSTER } from '../src/data/chapters/machine.js';
import { ETYPES, ROSTERS } from '../src/data/monsters.js';
import { CHSET } from '../src/data/items.js';
import { STAGES } from '../src/data/stages.js';
import { stageWave,waveBoss,previewWave } from '../src/core/roster.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import { machineIcon } from '../src/ui/machine-icons.js';
import { machineCircle,machineBeam,repairTargets } from '../src/monsters/machine-geometry.js';
import { towerCdStep } from '../src/combat/towerstatus.js';
const R=seed=>()=> (seed=seed*16807%2147483647)/2147483647;
assert.equal(CHSET[8],MACHINE_SET);assert.equal(ROSTERS[8],MACHINE_ROSTER);
assert.equal(new Set(Object.values(MACHINE_ENEMIES).map(e=>e.form)).size,8);
for(const[key,e]of Object.entries(MACHINE_ENEMIES)){assert.equal(ETYPES[key],e);assert.equal(e.proc,'machine');assert.ok(e.hp>0&&e.gold>0);}
for(let s=1;s<=6;s++)for(let w=1;w<=STAGES[`8-${s}`].waves;w++){
 const stage=STAGES[`8-${s}`],queue=stageWave(stage,w,8+w*3,R(s*100+w));assert.ok(queue.every(k=>MACHINE_ENEMIES[k]&&!MACHINE_ENEMIES[k].child));assert.equal(previewWave(stage,w).boss,waveBoss(stage,w));
 if(w%5===0||w===stage.waves)assert.ok(MACHINE_ENEMIES[waveBoss(stage,w)]?.boss);
}
assert.equal(waveBoss(STAGES['8-6'],15),'boss_machine');assert.equal(waveBoss(STAGES['8-1'],5),'foundry_warden');
for(const[id,type]of [['8-2','repair_drone'],['8-3','machine_guard'],['8-4','siege_crawler'],['8-5','coil_wasp']]){
 const share=id=>previewWave(STAGES[id],8).list.find(e=>e.t===type).share;assert.ok(share(id)>share('8-1')*1.4);
 const queue=stageWave(STAGES[id],8,10000,R(75));assert.ok(Math.abs(queue.filter(k=>k===type).length/queue.length-share(id))<.02);
}
const a={x:0,z:0},b={x:0,z:10};assert.ok(machineCircle({x:3,z:4},a,5));assert.ok(!machineCircle({x:3,z:4.01},a,5));
for(const p of [{x:0,z:0},{x:.6,z:5},{x:0,z:10}])assert.ok(machineBeam(p,a,b,.6));
for(const p of [{x:.61,z:5},{x:0,z:-.01},{x:0,z:10.01}])assert.ok(!machineBeam(p,a,b,.6));
assert.ok(machineBeam({x:3,z:3},{x:0,z:0},{x:6,z:6},.2));assert.ok(!machineBeam({x:3,z:4},{x:0,z:0},{x:6,z:6},.2));
const enemy=(hp,x=0,z=0,dead=false)=>({hp,max:100,g:{position:{x,z}},dead});const source=enemy(20),hurt=enemy(5),hurt2=enemy(60),healthy=enemy(100),far=enemy(1,10),dead=enemy(0,0,0,true),near=enemy(30,3,4);
assert.deepEqual(repairTargets(source,[source,hurt,hurt2,healthy,far,dead,near],5,2),[hurt,near]);
assert.deepEqual(repairTargets(source,[source,healthy,far,dead],5,3),[]);
const names=new Set(),icons=new Set();for(const[row,ns]of Object.entries(MACHINE_SET.names)){assert.equal(ns.length,5);icons.add(machineIcon({c:8,s:['armor','acc'].includes(row)?row:'weapon',h:row,g:3}));for(const n of ns){assert.ok(!names.has(n));names.add(n);}}
assert.equal(names.size,40);assert.equal(icons.size,8);assert.equal(machineIcon({c:7}),null);
let save=P.empty(),rng=R(42);for(const slot of E.SLOT_KEYS){const it=E.makeItem(slot,'mage',3,rng,8);it.e=5;save.inv.push(it);save.eq.mage[slot]=it.id;}
const raw={};for(const it of save.inv)for(const[k,v]of Object.entries(E.itemStats(it)))raw[k]=(raw[k]||0)+v;
assert.equal(E.bonus(save,'mage').hp,(raw.hp||0)+8);assert.equal(E.bonus(save,'mage').cdr,(raw.cdr||0)+8);assert.equal(E.setBonuses(save,'mage').length,2);
const rt=P.clean(JSON.parse(JSON.stringify(save)));assert.deepEqual(E.bonus(rt,'mage'),E.bonus(save,'mage'));assert.deepEqual(rt.inv.map(i=>i.id),save.inv.map(i=>i.id));assert.ok(rt.inv.every(it=>it.e===5));
delete save.eq.mage.acc;assert.equal(E.setBonuses(save,'mage').length,1);delete save.eq.mage.armor;assert.equal(E.setBonuses(save,'mage').length,0);
const[cleared,reward]=P.applyStage(P.empty(),'8-1',2,'mage',R(80));assert.ok(reward.first&&cleared.chests.length>0);assert.ok(cleared.chests.every(c=>c.it.c===8&&c.it.g>=1&&names.has(c.it.n)));
const[,opened]=E.openChests(cleared);assert.ok(opened.opened.length);const[,repeat]=E.openChests(cleared);assert.equal(repeat.opened.length,0);
const tw={cd:10,machineUntil:5,machineK:.6};towerCdStep(tw,1,4);assert.equal(tw.cd,9.4);towerCdStep(tw,1,5);assert.equal(tw.cd,8.4);
console.log('machine.test ok: roster, stage mixes, beam dodge, repair filtering, gear/rewards/save, EMP expiry');
