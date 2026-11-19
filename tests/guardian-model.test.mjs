import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');const clean=s=>s.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene()});vm.runInContext(clean(read('lib/addons/utils/BufferGeometryUtils.js')),ctx);vm.runInContext(clean(read('lib/addons/geometries/RoundedBoxGeometry.js')),ctx);vm.runInContext(clean(read('src/render/toon.js'))+';this.api={mk,toon,shareGeo,shareMat,disposeOwned,RoundedBoxGeometry,mergeGeometries};',ctx);
const batch=vm.createContext({THREE,mergeGeometries:ctx.api.mergeGeometries});vm.runInContext(clean(read('src/render/tower-body-batch.js'))+';this.batch=batchTowerBodies;',batch);
const model=vm.createContext({THREE,...ctx.api,batchTowerBodies:(...args)=>model.merge?batch.batch(...args):null});vm.runInContext(clean(read('src/render/tower-models.js'))+';this.make=towerModel;',model);

test('beam tower has five bounded distinct models',()=>{
 model.merge=true;const heights=[];
 for(let level=1;level<=5;level++){
  const m=model.make('guardian',level),b=new THREE.Box3().setFromObject(m.g);heights.push(b.max.y);
  assert.ok(b.max.x-b.min.x<3);assert.ok(b.max.z-b.min.z<3);assert.ok(m.muzzle);const tip=m.muzzle.getWorldPosition(new THREE.Vector3());assert.ok(tip.z>.6,'beam begins at forward lens');m.head.rotation.y=Math.PI/2;const turned=m.muzzle.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(turned.x-tip.z)<1e-6,'lens follows aim');assert.ok(m.anim.gem?.parent);ctx.api.disposeOwned(m.g);
 }assert.equal(new Set(heights).size,5);
});
test('beam controls preserve existing shortcuts and expose sustained DPS',()=>{
 assert.match(read('index.html'),/data-tool="guardian"/);
 assert.match(read('src/ui/input.js'),/\['arrow', 'cannon', 'magic', 'barricade', 'clear', 'guardian'\]/);
 assert.match(read('src/ui/hud.js'),/초당 피해/);
 assert.match(read('src/ui/lab.js'),/guardian: '#73d9bf'/);assert.doesNotMatch(read('src/ui/lab.js'),/기존 수호탑 연구 계승/);assert.doesNotMatch(read('src/ui/hud.js'),/재소환|병사 탐지 범위/);assert.doesNotMatch(read('src/ui/help.js'),/최대 예열/);
});

const beam=vm.createContext({THREE,...ctx.api,scene:ctx.scene});vm.runInContext(clean(read('src/render/beam.js'))+';this.api={createBeamVisual,drawBeam,disposeBeamVisual};',beam);
test('continuous beam reuses geometry, grows visibly and frees owned materials',()=>{const v=beam.api.createBeamVisual(),from=new THREE.Vector3(0,2,0),to=new THREE.Vector3(0,1,5);const geo=v.core.geometry;let gd=0,md=0;geo.addEventListener('dispose',()=>gd++);v.core.material.addEventListener('dispose',()=>md++);beam.api.drawBeam(v,from,to,{heat:1});const width=v.core.scale.x;beam.api.drawBeam(v,from,to,{heat:2.5});assert.ok(v.core.scale.x>width*2);assert.equal(v.core.geometry,geo);assert.equal(v.g.children.length,3);beam.api.disposeBeamVisual(v);assert.equal(v.g.parent,null);assert.equal(gd,0);assert.equal(md,1);});

test('50 actual beam lifetimes dispose materials without destroying shared buffers',()=>{let freed=0,geoFreed=0;const before=ctx.scene.children.length;for(let i=0;i<50;i++){const v=beam.api.createBeamVisual();for(const mesh of [v.halo,v.core,v.tip])mesh.material.addEventListener('dispose',()=>freed++);if(i===0)v.core.geometry.addEventListener('dispose',()=>geoFreed++);beam.api.drawBeam(v,new THREE.Vector3(),new THREE.Vector3(3,1,5),{heat:2});beam.api.disposeBeamVisual(v);}assert.equal(freed,150);assert.equal(geoFreed,0);assert.equal(ctx.scene.children.length,before);});

test('beam HUD shows cold-to-hot DPS and range, without operation instructions',()=>{
 const hud=read('src/ui/hud.js');assert.match(hud,/초당 피해 .* → .*beamMaxHeat.*사거리/);assert.doesNotMatch(hud,/재조준 0.45초|목표 변경 시 초기화/);assert.match(read('src/ui/help.js'),/\['6', '광선탑'\]/);
});

test('heat smoothly changes the visible core, halo and tip to red on both branches',()=>{
 for(const color of [0x72e4ff,0xc18bff]){
  const v=beam.api.createBeamVisual(),from=new THREE.Vector3(),to=new THREE.Vector3(0,0,4);
  for(const charge of [0,.25,.5,.75,1]){
   beam.api.drawBeam(v,from,to,{charge,color});
   assert.equal(v.core.material.blending,THREE.NormalBlending);assert.equal(v.halo.material.blending,THREE.AdditiveBlending);
   const expected=new THREE.Color(color).lerp(new THREE.Color(0xff2312),charge);
   for(const mesh of [v.halo,v.core,v.tip])assert.equal(mesh.material.color.getHex(),expected.getHex());
  }
  beam.api.disposeBeamVisual(v);
 }
});
