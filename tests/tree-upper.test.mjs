import test from 'node:test';import assert from 'node:assert/strict';
import {treeOptions,treeBuild,treeMods,changeTree,basicTreeMul,treeTaken,treeCooldown,treeQBonus,treeSkillUsed,cleanTrees} from '../src/data/skill-tree.js';
import {ADV} from '../src/data/advance.js';import {fixture} from './support/tree-upper-runtime.mjs';
const heroes=['archer','mage','warrior','gunner','fighter'];
const build=(h,b,choices,lv=50)=>{let t={};for(const [l,c] of Object.entries(choices))t=changeTree(t,h,b,lv,0,+l,c);return treeBuild(t,h,b,lv);};
test('29/30 39/40 49/50 gates, high level, two presets and every advancement',()=>{
 for(const h of heroes)for(const b of Object.keys(ADV[h]))for(const l of [30,40,50])for(const o of treeOptions(h,b,l)){
  assert.equal(changeTree({},h,b,l-1,0,l,o.id),null);let t=changeTree({},h,b,l,1,l,o.id);t=changeTree(t,h,b,l,1,null,null);
  assert.equal(treeBuild(t,h,b,l).choices[l],o.id);assert.equal(treeBuild(t,h,b,l-1).choices[l],undefined);
  assert.equal(treeBuild(t,h,'invalid',50).choices[l],undefined);assert.deepEqual(cleanTrees(JSON.parse(JSON.stringify(t))),t);
 }
});
test('320 complete builds remain finite and bounded without mutating snapshot or stacking on reload',()=>{
 for(const h of heroes)for(const b of Object.keys(ADV[h]))for(let bits=0;bits<32;bits++){
  const cs=Object.fromEntries([15,20,30,40,50].map((l,i)=>[l,treeOptions(h,b,l)[bits>>i&1].id]));const t=build(h,b,cs),m=treeMods(t);
  assert.deepEqual(treeMods(t),m);assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.choices));
  for(const [k,v]of Object.entries(m))if(typeof v==='number')assert.ok(Number.isFinite(v)&&v>0,`${h}/${b}/${k}`);
  assert.ok(m.qCd>=.7&&m.eCd>=.7&&m.qCC<=1.25&&m.qMul<=1.5&&m.eMul<=1.5);
  assert.ok(treeCooldown(4,20,m.qCd)>=4);assert.ok(treeCooldown(12,20,m.qCd)>=8);
 }
});
test('every E specialization dispatches independently of gear; capstone combo only follows successful E',()=>{
 for(const h of heroes)for(const b of Object.keys(ADV[h]))for(const o of treeOptions(h,b,30)){
  const f=fixture(h,50,null);f.hero.treeMods=treeMods(build(h,b,{30:o.id,40:'assault'}));f.target();
  const s=f.api.legendActive();assert.ok(s);assert.equal(f.api.castLegend(new f.THREE.Vector3(0,0,2)),true);
  assert.ok(Math.abs(f.hero.lcd-s.cd*(o.eCd||1)*.94)<1e-8);assert.equal(f.api.castLegend(),false);assert.equal(f.hero.licd,0);
 }
});
test('actual archer E width and damage tradeoff hits edge only with wide choice',()=>{
 for(const [id,want,edge]of [['sweep',270,true],['needle',360,false]]){
  const f=fixture('archer',50);f.hero.treeMods=treeMods(build('archer','wind',{30:id}));const a=f.target(0,5),b=f.target(1.5,5);
  f.api.castLegend(new f.THREE.Vector3(0,0,10));f.tick(2);assert.ok(Math.abs(10000-a.hp-want)<1e-6);assert.equal(b.hp<10000,edge);assert.equal(f.hero.licd,0);
 }
});
test('actual mage and warrior E damage uses tree multiplier once and respects armor',()=>{
 for(const [h,b,id,k]of [['mage','frost','spread',.88],['mage','flame','center',1.2],['warrior','paladin','quakewide',1],['warrior','berserk','quakestrike',1.2]]){
  const run=withTree=>{const f=fixture(h,50);if(withTree)f.hero.treeMods=treeMods(build(h,b,{30:id}));const t=f.target(0,2,{armor:.5});f.api.castLegend(new f.THREE.Vector3(0,0,2));f.tick(5);return 10000-t.hp;};
  const base=run(false),after=run(true);assert.ok(base>0);assert.ok(Math.abs(after/base-k)<1e-7,`${h} ${id} ${base} ${after}`);
 }
});
test('conditional capstones have explicit windows, switch resets and health/distance boundaries',()=>{
 const make=(h,b,id)=>({treeMods:treeMods(build(h,b,{50:id})),hp:100,max:100,g:{position:{x:0,z:0}}});const t={hp:35,max:100,E:{},g:{position:{x:0,z:8}}};
 let h=make('archer','wind','finish');assert.equal(basicTreeMul(h,t),1.25);t.hp=36;assert.equal(basicTreeMul(h,t),.96);
 h=make('mage','flame','weave');treeSkillUsed(h,'e',10);assert.equal(treeQBonus(h,15.999),1.25);assert.equal(treeQBonus(h,16),1);treeSkillUsed(h,'q',11);assert.equal(treeQBonus(h,12),1);
 h=make('mage','frost','siege');assert.equal(basicTreeMul(h,t),1.2);t.g.position.z=3;assert.equal(basicTreeMul(h,t),.9);
 h=make('warrior','paladin','lastguard');h.hp=39;assert.equal(treeTaken(h),.8);h.hp=40;assert.equal(treeTaken(h),1);
 h=make('warrior','berserk','pressure');assert.equal(basicTreeMul(h,t),.94);assert.equal(basicTreeMul(h,{E:{boss:true}}),1.25);
 h=make('gunner','duel','sustain');assert.deepEqual([1,2,3,4,5].map(()=>basicTreeMul(h,t)),[.9,1,1,1.2,1.2]);assert.equal(basicTreeMul(h,{E:{}}),.9);
 h=make('gunner','thorn','mobile');assert.equal(basicTreeMul(h,t),.94);h.treeMoving=true;assert.equal(basicTreeMul(h,t),1.18);
 h=make('fighter','tiger','pursuit');assert.equal(basicTreeMul(h,t,'melee',1),1);treeSkillUsed(h,'e',1);assert.equal(basicTreeMul(h,t,'melee',6),1.3);assert.equal(basicTreeMul(h,t,'melee',7),1);assert.equal(basicTreeMul(h,t,'ranged',6),.92);
 h=make('fighter','dragon','flow');assert.equal(basicTreeMul(h,t,'ranged',1),.96);assert.equal(basicTreeMul(h,t,'melee',4),1.2);assert.equal(basicTreeMul(h,t,'melee',5),.96);
});
test('capstone defense and attack combinations remain bounded, extra hits never create a proc',()=>{
 const h={treeMods:treeMods(build('warrior','paladin',{15:'guard',40:'stable',50:'lastguard'})),hp:1,max:100};assert.equal(treeTaken(h),.75);
 const m=treeMods(build('archer','wind',{15:'pierce',50:'line'}));assert.equal(m.pierce,.45);assert.equal(m.pierceCount,3);assert.equal(m.basic,.92*.92);
});
