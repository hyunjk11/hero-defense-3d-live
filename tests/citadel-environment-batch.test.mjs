import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene()});
vm.runInContext(read('lib/addons/utils/BufferGeometryUtils.js').replace(/import[\s\S]*?from ['"]three['"];?/,'').replace(/export\s*\{[\s\S]*?\};?/g,''),ctx);
vm.runInContext(clean(read('src/render/toon.js'))+';this.api={mk,toon,shareGeo,shareMat,disposeOwned};',ctx);
vm.runInContext(clean(read('src/render/machine-batch.js'))+';this.batch=batchMachineParts;',ctx);
const leaves=root=>{root.updateMatrixWorld(true);const a=[];root.traverse(o=>{if(!o.isMesh||o.userData.ol)return;for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){const m=new THREE.Matrix4();if(o.isInstancedMesh)o.getMatrixAt(i,m);const world=o.matrixWorld.clone().multiply(m);a.push({geo:o.geometry,mat:o.material,world:world.elements.slice(),shadow:o.castShadow,receive:o.receiveShadow});}});return a;};
for(const ch of [9,10])for(const kind of ['deco','pylon'])test('chapter '+ch+' '+kind+' exact geometry transforms, outlines, shadows and disposal',()=>{
const scene=new THREE.Scene();let enabled=false;
const env=vm.createContext({...ctx.api,THREE,scene,STAGE:{ch},T:{FOREST:1},GW:24,GH:16,NT:384,tileX:x=>x*2,tileZ:x=>x*2,batchMachineParts:r=>{if(enabled)ctx.batch(r);}});
vm.runInContext(clean(read('src/render/endgame-environment.js'))+';this.deco=endgameDeco;this.pylon=endgamePylon;',env);
if(kind==='deco')env.deco();else env.pylon(scene,{c:7,r:9});
const root=scene.children[0],before=leaves(root);let oldCount=0;root.traverse(o=>{if(o.isMesh)oldCount++;});
const outlines=new Set();root.traverse(o=>{if(o.userData.ol)outlines.add(o.material);});
if(ch===10)ctx.batch(root);const after=leaves(root),remaining=after.slice();
assert.equal(before.length,after.length);
for(const a of before){const i=remaining.findIndex(b=>a.geo===b.geo&&a.mat===b.mat&&a.shadow===b.shadow&&a.receive===b.receive&&a.world.every((v,k)=>Math.abs(v-b.world[k])<1e-5));assert.ok(i>=0,'original part missing');remaining.splice(i,1);}
let count=0,n=0,disposed=0;root.traverse(o=>{if(o.isMesh)count++;if(o.userData.ol)assert.ok(outlines.has(o.material));if(o.isInstancedMesh){n++;o.addEventListener('dispose',()=>disposed++);}});
if(ch===10)assert.ok(count<oldCount);else assert.equal(count,oldCount);
ctx.api.disposeOwned(root);assert.equal(n,disposed);
console.log(ch,kind,oldCount+' -> '+count);
});
