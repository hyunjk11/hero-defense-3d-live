import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clean=s=>s.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene()});
vm.runInContext(clean(read('lib/addons/utils/BufferGeometryUtils.js')),ctx);
vm.runInContext(clean(read('lib/addons/geometries/RoundedBoxGeometry.js')),ctx);
vm.runInContext(clean(read('src/render/toon.js'))+';this.deps={mk,toon,shareGeo,shareMat,RoundedBoxGeometry,mergeGeometries};',ctx);
const batch=vm.createContext({THREE,mergeGeometries:ctx.deps.mergeGeometries});
vm.runInContext(clean(read('src/render/tower-body-batch.js'))+';this.batch=batchTowerBodies;',batch);
const models=vm.createContext({THREE,...ctx.deps,batchTowerBodies:batch.batch});
vm.runInContext(clean(read('src/render/tower-models.js'))+';this.factory=towerModel;',models);
function setup(){const scene=new THREE.Scene();const env=vm.createContext({THREE,scene,towerModel:models.factory,G:{},GW:2,GH:2,S:2});vm.runInContext(clean(read('src/ui/preview.js'))+';this.api={setGhost,hidePreview,get:()=>({ghost,ghostType,ghostMats})};',env);return {scene,api:env.api};}
test('120 tower preview changes dispose every owned clone once, preserving cached model resources',()=>{
 const {scene,api}=setup(),live=models.factory('arrow',1),shared=new Set();live.g.traverse(o=>{if(o.geometry)shared.add(o.geometry);if(o.material)shared.add(o.material);});let sharedDisposed=0;for(const r of shared)r.addEventListener('dispose',()=>sharedDisposed++);
 let created=0,released=0;const base=scene.children.length;
 for(let i=0;i<120;i++){api.setGhost(['arrow','cannon','magic'][i%3]);const current=api.get();for(const m of current.ghostMats){created++;m.addEventListener('dispose',()=>released++);}assert.equal(scene.children.length,base+1);if(i%4===0){const before=released,old=current.ghost;api.setGhost(current.ghostType);assert.equal(api.get().ghost,old);assert.equal(released,before);}assert.equal(released,created-current.ghostMats.length);}
 api.setGhost(null);assert.equal(released,created);assert.equal(api.get().ghostMats.length,0);assert.equal(scene.children.length,base);api.setGhost(null);assert.equal(released,created);assert.equal(sharedDisposed,0);
 console.log(`preview clones ${created}, released ${released}, shared disposed ${sharedDisposed}`);
});
test('hide/show retains bounded current preview without disposal or visual property changes',()=>{const {api}=setup();api.setGhost('arrow');const {ghost,ghostMats}=api.get();let n=0;ghostMats.forEach(m=>m.addEventListener('dispose',()=>n++));api.hidePreview();assert.equal(ghost.visible,false);api.setGhost('arrow');assert.equal(api.get().ghost,ghost);assert.equal(n,0);for(const m of ghostMats){assert.equal(m.opacity,.7);assert.equal(m.transparent,true);assert.equal(m.depthWrite,false);}const count=ghostMats.length;api.setGhost(null);assert.equal(n,count);});
