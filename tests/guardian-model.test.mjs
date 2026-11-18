import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');const clean=s=>s.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene()});vm.runInContext(clean(read('lib/addons/utils/BufferGeometryUtils.js')),ctx);vm.runInContext(clean(read('lib/addons/geometries/RoundedBoxGeometry.js')),ctx);vm.runInContext(clean(read('src/render/toon.js'))+';this.api={mk,toon,shareGeo,shareMat,disposeOwned,RoundedBoxGeometry,mergeGeometries};',ctx);
const batch=vm.createContext({THREE,mergeGeometries:ctx.api.mergeGeometries});vm.runInContext(clean(read('src/render/tower-body-batch.js'))+';this.batch=batchTowerBodies;',batch);
const model=vm.createContext({THREE,...ctx.api,batchTowerBodies:(...args)=>model.merge?batch.batch(...args):null});vm.runInContext(clean(read('src/render/tower-models.js'))+';this.make=towerModel;',model);

const soldier=vm.createContext({THREE,...ctx.api,batchTowerBodies:batch.batch});
vm.runInContext(clean(read('src/render/guardian-model.js'))+';this.api={guardianModel,animateGuardian};',soldier);
test('guardian tower has five bounded distinct models',()=>{
 model.merge=true;const heights=[];
 for(let level=1;level<=5;level++){
  const m=model.make('guardian',level),b=new THREE.Box3().setFromObject(m.g);heights.push(b.max.y);
  assert.ok(b.max.x-b.min.x<3);assert.ok(b.max.z-b.min.z<3);assert.ok(m.muzzle);ctx.api.disposeOwned(m.g);
 }assert.equal(new Set(heights).size,5);
});
test('soldiers retain animated joints through batching and support both branches',()=>{
 for(const branch of [null,'guardian_bulwark','guardian_assault'])for(const giant of [false,true]){
  const m=soldier.api.guardianModel({level:5,branch,giant});
  for(const node of [m.body,m.swordArm,m.shieldArm,...m.legs])assert.ok(node.parent);
  soldier.api.animateGuardian(m,{time:.14,moving:true,attacking:true,blocking:true});
  assert.notEqual(m.legs[0].rotation.x,0);assert.equal(m.shieldArm.rotation.x,-.7);
  const b=new THREE.Box3().setFromObject(m.g);assert.ok(Number.isFinite(b.max.y));assert.ok(b.max.y>1);
  ctx.api.disposeOwned(m.g);
 }
});
test('soldier shared assets survive repeated spawn/dispose',()=>{
 const first=soldier.api.guardianModel({level:5,branch:'guardian_bulwark'}),geos=new Set();first.g.traverse(o=>{if(o.geometry)geos.add(o.geometry);});
 let disposed=0;for(const g of geos)g.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<25;i++){const m=soldier.api.guardianModel({level:5,branch:'guardian_bulwark'});ctx.api.disposeOwned(m.g);}
 ctx.api.disposeOwned(first.g);assert.equal(disposed,0);
});
test('guardian controls preserve existing shortcuts and expose summon-specific stats',()=>{
 assert.match(read('index.html'),/data-tool="guardian"/);
 assert.match(read('src/ui/input.js'),/\['arrow', 'cannon', 'magic', 'barricade', 'clear', 'guardian'\]/);
 assert.match(read('src/ui/hud.js'),/병사 탐지 범위/);assert.match(read('src/ui/hud.js'),/대공 불가/);
 assert.match(read('src/ui/lab.js'),/guardian: '#73d9bf'/);
});
