import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
import {towerStats,branchFor} from '../src/data/growth.js';import {BEAM_STEP,beamHeatIntegral,beamTouches,beamSweepAt} from '../src/combat/beam.js';import {towerRateK} from '../src/combat/towerstatus.js';
function harness(branch=null,lvl=1,source=null){const G={t:0,enemies:[]},hits=[],visuals=[],sounds=[];let disposed=0;
 const ctx=vm.createContext({THREE,G,BEAM_STEP,beamHeatIntegral,beamTouches,beamSweepAt,towerRateK,Snd:{play:(...args)=>sounds.push(args)},createBeamVisual:()=>{const v={g:{visible:false}};visuals.push(v);return v;},drawBeam:(v,from,to,opt)=>{v.g.visible=true;v.last={from:from.clone(),to:to.clone(),...opt};},disposeBeamVisual:()=>disposed++,hurt:(e,n)=>{e.hp-=n;hits.push({e,n});if(e.hp<=0)e.dead=true;}});
 vm.runInContext((source??fs.readFileSync(new URL('../src/world/beam.js',import.meta.url),'utf8')).replace(/^import .*;\s*$/gm,'').replaceAll('export ','')+';this.api={updBeam,clearBeam};',ctx);
 const g=new THREE.Group(),head=new THREE.Group(),muzzle=new THREE.Object3D();g.add(head);head.add(muzzle);muzzle.position.set(0,1,0.7);
 const tw={type:'guardian',lvl,branch,shots:0,S:towerStats('guardian',lvl,branch),B:branchFor('guardian',branch,null,lvl),m:{g,head,muzzle}};
 const enemy=(x=0,z=4,extra={})=>({hp:1e6,state:'walk',E:{h:2,...extra},g:{position:new THREE.Vector3(x,0,z)},m:{inner:{position:{y:3}}}});
 const tick=(dt,n=1,can=true)=>{for(let i=0;i<n;i++){G.t+=dt;ctx.api.updBeam(tw,dt,can);}};
 return {G,tw,enemy,tick,hits,visuals,sounds,clear:()=>ctx.api.clearBeam(tw),disposed:()=>disposed};}
for(const hz of [10,30,60,144])test(`fixed beam DPS and warmup at ${hz} FPS`,()=>{const h=harness(),e=h.enemy();h.G.enemies=[e];h.tick(1/hz,10*hz);assert.ok(Math.abs((1e6-e.hp)-24*beamHeatIntegral(0,10,h.tw.S.beamWarmup,h.tw.S.beamMaxHeat))<1e-6);assert.equal(h.visuals.length,1);assert.ok(h.hits.length<=51);assert.ok(h.tw.beam.age>9.9);});
test('target switch, out of range, spawn/immune and disabled reset every accumulator',()=>{const h=harness(),a=h.enemy(),b=h.enemy(2,4);h.G.enemies=[a,b];h.tick(.1,23);assert.equal(h.tw.beam.target,a);a.dead=true;h.tick(.1);assert.equal(h.tw.beam.target,b);assert.equal(h.tw.beam.age,0);assert.ok(b.hp===1e6);h.tick(.1);assert.ok(b.hp<1e6);h.tick(.1,1,false);assert.equal(h.tw.beam.age,0);assert.equal(h.tw.beam.acc,0);assert.equal(h.tw.beam.visual.g.visible,false);b.immT=99;h.tick(.2);assert.equal(h.tw.beam.target,null);b.immT=0;b.state='spawn';h.tick(.2);assert.equal(h.tw.beam.target,null);b.state='walk';b.g.position.z=99;h.tick(.2);assert.equal(h.tw.beam.target,null);});
test('slow applies once to damage and heating, and focus burst needs continuous four seconds',()=>{const h=harness(),e=h.enemy();h.G.enemies=[e];h.tw.frostT=100;h.tw.frostK=.5;h.tick(.1,100);assert.ok(Math.abs(1e6-e.hp-24*beamHeatIntegral(0,5,h.tw.S.beamWarmup,h.tw.S.beamMaxHeat))<1e-6);
 const f=harness('guardian_bulwark',5),a=f.enemy();f.G.enemies=[a];f.tick(.1,39);assert.equal(f.sounds.length,0);f.tick(.1);assert.equal(f.sounds.length,1);const b=f.enemy(1,4);a.dead=true;f.G.enemies.push(b);f.tick(.1,39);assert.equal(f.sounds.length,1);});
test('cutting beam intersects multiple ground enemies; return beam stays on during reverse',()=>{const h=harness('guardian_assault',3),a=h.enemy(0,4),b=h.enemy(.7,4);h.G.enemies=[a,b];h.tick(.1,60);assert.ok(a.hp<1e6&&b.hp<1e6);assert.equal(beamSweepAt(2.6,false).active,false);assert.equal(beamSweepAt(2.6,true).active,true);assert.ok(beamSweepAt(2.6,true).offset>beamSweepAt(3.8,true).offset);});
test('base beam tracks flying enemies and upgraded model, releases visual on sale repeatedly',()=>{const h=harness(),e=h.enemy(0,4,{fly:true});h.G.enemies=[e];h.tick(.1,10);assert.equal(h.visuals[0].last.to.y,3);const before=e.hp;h.tw.m.head.position.y=2;h.tick(.2);assert.ok(e.hp<before);assert.ok(h.visuals[0].last.from.y>2);for(let i=0;i<50;i++){h.clear();h.tick(.2);}h.clear();assert.equal(h.disposed(),51);assert.equal(h.tw.beam,null);});
test('beam geometry ignores distant/off-line targets and respects segment ends',()=>{const a={x:0,y:1,z:0},b={x:0,y:1,z:5};assert.ok(beamTouches(a,b,{x:.3,y:1,z:3}));assert.ok(!beamTouches(a,b,{x:2,y:1,z:3}));assert.ok(!beamTouches(a,b,{x:0,y:1,z:7}));});
// Use production meshes/muzzle transforms: the earlier 1m stub hid close-range misses.
const readModel=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cleanModel=s=>s.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const modelCtx=vm.createContext({...THREE,THREE,scene:new THREE.Scene()});
for(const p of ['lib/addons/utils/BufferGeometryUtils.js','lib/addons/geometries/RoundedBoxGeometry.js','src/render/toon.js','src/render/tower-body-batch.js','src/render/tower-models.js'])vm.runInContext(cleanModel(readModel(p)),modelCtx);
vm.runInContext('this.make=towerModel;this.dispose=disposeOwned;',modelCtx);
for(const level of [3,5])for(const distance of [1.3,2.5,4,7])for(const fly of [false,true])test(`real Lv${level} cutting muzzle hits ${fly?'air':'ground'} targets at ${distance}m`,()=>{
 const h=harness('guardian_assault',level);h.tw.m=modelCtx.make('guardian',level);
 const a=h.enemy(0,distance,{h:1.4,fly}),b=h.enemy(.45,distance,{h:1.4,fly});h.G.enemies=[a,b];
 h.tick(.05,120);assert.ok(a.hp<1e6,'primary target damaged');assert.ok(b.hp<1e6,'nearby target damaged');assert.ok(h.visuals[0].last.to.y>=.119,'visible beam never below ground');
 modelCtx.dispose(h.tw.m.g);
});
test('focus acquisition ranks boss, current HP, then distance; base/cut remain nearest',()=>{
 for(const branch of [null,'guardian_assault','guardian_bulwark']){
  const h=harness(branch,5),near=h.enemy(0,2),tank=h.enemy(0,3),boss=h.enemy(0,5,{boss:true});
  near.hp=100;tank.hp=10000;boss.hp=10;h.G.enemies=[tank,near,boss];h.tick(.1);
  assert.equal(h.tw.beam.target,branch==='guardian_bulwark'?boss:near);
 }
 const h=harness('guardian_bulwark',5),a=h.enemy(0,5,{boss:true}),b=h.enemy(0,4,{boss:true}),c=h.enemy(0,3,{boss:true});a.hp=200;b.hp=c.hp=100;h.G.enemies=[a,b,c];h.tick(.1);assert.equal(h.tw.beam.target,a);a.dead=true;h.tick(.1);assert.equal(h.tw.beam.target,c);
});
test('valid focus lock is never preempted; invalid lock reacquires and resets heat/charge',()=>{
 const h=harness('guardian_bulwark',5),a=h.enemy(0,2),boss=h.enemy(0,4,{boss:true});h.G.enemies=[a];h.tick(.1,25);const age=h.tw.beam.age;h.G.enemies.push(boss);h.tick(.1);assert.equal(h.tw.beam.target,a);assert.ok(h.tw.beam.age>=age);
 a.immT=99;h.tick(.1);assert.equal(h.tw.beam.target,boss);assert.equal(h.tw.beam.age,0);assert.equal(h.tw.beam.burst,0);assert.equal(h.tw.beam.acc,.1);
 h.tick(.1,1,false);assert.equal(h.tw.beam.target,null);assert.equal(h.tw.beam.acc,0);h.tick(.1);assert.equal(h.tw.beam.target,boss);
});

for(const branch of [null,'guardian_bulwark','guardian_assault'])for(const fps of [30,60,144])test(`8s heat/damage frame parity ${branch} ${fps}`,()=>{
 const run=hz=>{const h=harness(branch,5),e=h.enemy();h.G.enemies=[e];h.tick(1/hz,8*hz);return [e.hp,h.tw.shots,h.tw.beam.age,h.sounds.length];};
 assert.deepEqual(run(fps),run(10));
});
test('cold beam gives up short damage but outgrows previous hot DPS on prolonged locks at all levels',()=>{
 for(const [lvl,old] of [[1,32],[2,52],[3,76],[4,104],[5,140]]){
  for(const branch of lvl<3?[null]:[null,'guardian_bulwark','guardian_assault']){
   const h=harness(branch,lvl),e=h.enemy();h.G.enemies=[e];h.tick(.2,5);
   const d=h.tw.S.dmg*h.tw.S.rate,cut=branch==='guardian_assault',focus=branch==='guardian_bulwark';
   const previousCold=old*(cut?2:focus?1.2:1),previousMax=previousCold*(cut?1:focus?3.05:2.5);
   assert.ok(d<previousCold);assert.ok(d*h.tw.S.beamMaxHeat>previousMax);
   if(!cut)assert.ok(Math.abs(1e6-e.hp-d*beamHeatIntegral(0,1,6,focus?5.6:4.8))<1e-5);
   h.tick(.2,55);assert.equal(h.visuals[0].last.charge,1);
   if(cut){assert.ok(h.hits.length>=2);assert.ok(Math.abs(h.hits.at(-1).n-d*.2*2.2)<1e-6);}
  }
 }
});
test('sweep carries heat across uninterrupted targets, cools on idle and disable',()=>{
 const h=harness('guardian_assault',5),a=h.enemy(),b=h.enemy(.5,4);h.G.enemies=[a,b];h.tick(.2,15);const age=h.tw.beam.age;
 a.dead=true;h.tick(.2);assert.equal(h.tw.beam.target,b);assert.ok(h.tw.beam.age>age);
 b.dead=true;h.tick(.2);assert.equal(h.tw.beam.age,0);assert.equal(h.tw.beam.visual.g.visible,false);
 b.dead=false;h.tick(.2);assert.ok(h.visuals[0].last.charge<.05);h.tick(.2,1,false);assert.equal(h.tw.beam.age,0);
});


const heavy=(branch=null,lvl=1)=>{
 const h=harness(branch,lvl);h.tw.S.dmg*=.35;h.tw.S.beamMaxHeat*=1.5/.35;h.tw.S.beamHeavy=true;
 return h;
};
test('Hard beam retargets trash to an elite, but never interrupts a valid heavy lock',()=>{
 for(const branch of [null,'guardian_bulwark','guardian_assault']){
  const h=heavy(branch,5),near=h.enemy(0,2),elite=h.enemy(0,4,{elite:true}),boss=h.enemy(0,6,{boss:true});
  near.hp=1e7;h.G.enemies=[near];h.tick(.2,10);assert.equal(h.tw.beam.age,0);
  h.G.enemies.push(elite);h.tick(.2,10);assert.equal(h.tw.beam.target,elite);assert.ok(h.tw.beam.age>1);
  h.G.enemies.push(boss);h.tick(.2);assert.equal(h.tw.beam.target,elite);
  elite.dead=true;h.tick(.2);assert.equal(h.tw.beam.target,boss);assert.ok(h.tw.beam.age<=.2);
 }
});
test('Hard beam stays cold against trash, starts weak against elite, and reaches 150% of legacy hot damage',()=>{
 const h=heavy(),elite=h.enemy(0,4,{elite:true}),trash=h.enemy(0,4);h.G.enemies=[trash];h.tick(.2,35);
 const cold=24*.35*.2;assert.ok(h.hits.every(x=>Math.abs(x.n-cold)<1e-9));
 assert.equal(h.visuals[0].last.charge,0);
 h.G.enemies=[elite];trash.dead=true;h.tick(.2);
 const first=h.hits.at(-1).n;assert.ok(first>cold&&first<24*.2*.4);
 h.tick(.2,35);assert.equal(h.visuals[0].last.charge,1);
 assert.ok(Math.abs(h.hits.at(-1).n-24*4.8*1.5*.2)<1e-7);
 assert.ok(h.hits.at(-1).n/first>19);
});
test('Hard sweep does not transfer heavy heat into adjacent targets and Hard focus never flashes on trash',()=>{
 const h=heavy('guardian_assault',5),a=h.enemy(0,2,{boss:true}),b=h.enemy(.2,2),c=h.enemy(.3,2,{elite:true});
 h.G.enemies=[b,c,a];h.tick(.2,36);
 for(const e of [b,c]){
  const hits=h.hits.filter(x=>x.e===e);assert.ok(hits.length>0);
  assert.ok(hits.every(x=>Math.abs(x.n-h.tw.S.dmg*h.tw.S.rate*.2)<1e-8));
 }
 assert.equal(h.visuals[0].last.charge,1);
 const f=heavy('guardian_bulwark',5);f.G.enemies=[f.enemy()];f.tick(.2,40);assert.equal(f.sounds.length,0);
 f.G.enemies.push(f.enemy(0,4,{elite:true}));f.tick(.2,20);assert.equal(f.sounds.length,1);
});
test('Hard quadratic heat integral is continuous, capped, and stable across frame rates',()=>{
 const a=beamHeatIntegral(0,6,6,7,true);
 assert.equal(a,18);assert.ok(Math.abs(beamHeatIntegral(0,5.9,6,7,true)+beamHeatIntegral(5.9,.3,6,7,true)-beamHeatIntegral(0,6.2,6,7,true))<1e-8);
 assert.equal(beamHeatIntegral(6,2,6,7,true),14);
 const run=hz=>{const h=heavy(),e=h.enemy(0,4,{elite:true});h.G.enemies=[e];h.tick(1/hz,8*hz);return [e.hp,h.tw.shots,h.tw.beam.age];};
 assert.deepEqual(run(144),run(10));
});
