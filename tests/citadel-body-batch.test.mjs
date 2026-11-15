import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene(),G:{t:0}});
vm.runInContext(read('lib/addons/utils/BufferGeometryUtils.js').replace(/import[\s\S]*?from ['"]three['"];?/,'').replace(/export\s*\{[\s\S]*?\};?/g,''),ctx);
vm.runInContext(clean(read('src/render/toon.js'))+';this.dispose=disposeObj;this.deps={mk,toon,shareGeo};',ctx);
vm.runInContext(clean(read('src/render/citadel-body-batch.js'))+';this.batch=batchCitadelBodies;',ctx);
vm.runInContext(clean(read('src/data/chapters/endgame.js'))+';this.types=CITADEL_ENEMIES;',ctx);
vm.runInContext(clean(read('src/render/endgame-monsters.js')).replace(' if(!abyss)batchCitadelBodies(inner,{shareGeometry:shareGeo});','')+';this.make=makeEndgameEnemy;',ctx);
const outlines=m=>{const a=[];m.g.updateMatrixWorld(true);m.g.traverse(o=>{if(o.userData.ol)a.push({o,material:o.material,geometry:o.geometry,matrix:o.matrixWorld.clone()});});return a;};
function vertices(m){m.g.updateMatrixWorld(true);const out=[];m.g.traverse(o=>{if(!o.isMesh||o.userData.ol)return;const g=o.geometry,nm=new THREE.Matrix3().getNormalMatrix(o.matrixWorld);for(let i=0;i<(g.index?.count??g.attributes.position.count);i++){const j=g.index?g.index.getX(i):i,p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,j).applyMatrix4(o.matrixWorld),n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,j).applyNormalMatrix(nm);out.push([m.mats.indexOf(o.material),...p.toArray(),...n.toArray()]);}});return out.sort((a,b)=>{for(let i=0;i<a.length;i++){const d=Math.round(a[i]*1e4)-Math.round(b[i]*1e4);if(d)return d;}return 0;});}
function sameVertices(a,b){const x=vertices(a),y=vertices(b);assert.equal(x.length,y.length);for(let i=0;i<x.length;i++)for(let j=0;j<x[i].length;j++)assert.ok(Math.abs(x[i][j]-y[i][j])<2e-5,`vertex ${i}/${j}`);}
for(const [name,E] of Object.entries(ctx.types))test(name+' retains body vertices, normal lighting, outlines, animation and owned disposal',()=>{
 const a=ctx.make(E),b=ctx.make(E),ol=outlines(b),source=[];b.g.traverse(o=>{if(o.geometry)source.push(o.geometry);});
 const result=ctx.batch(b.inner);assert.ok(result.batches>0);b.g.updateMatrixWorld(true);
 for(const before of ol){assert.ok(before.o.parent);assert.equal(before.o.material,before.material);assert.equal(before.o.geometry,before.geometry);before.matrix.elements.forEach((v,i)=>assert.ok(Math.abs(v-before.o.matrixWorld.elements[i])<1e-10));}
 for(let k=0;k<7;k++){
  ctx.G.t=k*.13;for(const m of [a,b]){m.g.position.x=k*.11;m.g.rotation.y=k*.08;const e={g:m.g,flash:k===2?1:0,endCast:{t:.4,duration:1},endRecover:k===3?1:0,endAwakened:k>=4,dying:k===6?.8:undefined};m.anim(e,.13);}sameVertices(a,b);
 }
 for(const material of b.mats)material.emissive.setHex(0xffffff);b.g.traverse(o=>{if(o.userData.citadelBodyBatch)assert.equal(o.material.emissive.getHex(),0xffffff);});
 const merged=[];let released=0;b.g.traverse(o=>{if(o.userData.citadelBodyBatch){assert.ok(!source.includes(o.geometry));merged.push(o.geometry);o.geometry.addEventListener('dispose',()=>released++);}});ctx.dispose(b.g);assert.equal(released,merged.length);ctx.dispose(a.g);
});
test('excluded mesh stays attached and repeat call makes no new batches',()=>{
 const m=ctx.make(Object.values(ctx.types)[0]);let excluded;m.g.traverse(o=>{if(!excluded&&o.isMesh&&!o.userData.ol)excluded=o;});const parent=excluded.parent;ctx.batch(m.inner,{excludeMeshes:new Set([excluded])});assert.equal(excluded.parent,parent);assert.equal(ctx.batch(m.inner,{excludeMeshes:new Set([excluded])}).batches,0);ctx.dispose(m.g);
});
const mergedNodes=m=>{const out=[];m.g.traverse(o=>{if(o.userData.citadelBodyBatch)out.push(o);});return out;};
test('shared cache stabilizes over repeated seven-form spawns without sharing materials',()=>{
 const marked=new Set();let releases=0;const shareGeometry=g=>{marked.add(g);g.addEventListener('dispose',()=>releases++);return ctx.deps.shareGeo(g);};
 const first=new Map();for(let round=0;round<8;round++)for(const [name,E] of Object.entries(ctx.types)){
  const m=ctx.make(E);ctx.batch(m.inner,{shareGeometry});const nodes=mergedNodes(m);
  if(round===0)first.set(name,nodes.map(n=>({geometry:n.geometry,material:n.material})));
  else nodes.forEach((n,i)=>{const old=first.get(name)[i];assert.equal(n.geometry,old.geometry);assert.notEqual(n.material,old.material);const oldColor=old.material.emissive.getHex();n.material.emissive.setHex(0x123456);assert.equal(old.material.emissive.getHex(),oldColor);});
  ctx.dispose(m.g);
 }
 assert.equal(releases,0);assert.ok(marked.size<128);
 const stable=marked.size;for(const E of Object.values(ctx.types)){const m=ctx.make(E);ctx.batch(m.inner,{shareGeometry});ctx.dispose(m.g);}assert.equal(marked.size,stable);
});
test('per-source cache bound falls back to owned geometry, and exact signatures differ',()=>{
 const source=ctx.deps.shareGeo(new THREE.BoxGeometry(1,1,1));let shared=0;
 const shareGeometry=g=>{shared++;return ctx.deps.shareGeo(g);};
 const make=n=>{const g=new THREE.Group(),mat=ctx.deps.toon(0xffffff);for(let i=0;i<2;i++)ctx.deps.mk(source,mat,i+n*1e-8,0,0,g,.012);ctx.batch(g,{shareGeometry});return {g,mat};};
 const geometries=[];for(let n=0;n<34;n++){const {g}=make(n),node=mergedNodes({g})[0];geometries.push(node.geometry);let disposed=0;node.geometry.addEventListener('dispose',()=>disposed++);ctx.dispose(g);assert.equal(disposed,n<32?0:1);}
 assert.equal(shared,32);assert.equal(new Set(geometries).size,34);
 const {g}=make(0);assert.equal(mergedNodes({g})[0].geometry,geometries[0]);ctx.dispose(g);
});
test('total cache cap bounds allocations across source geometries',()=>{
 let shared=0;const shareGeometry=g=>{shared++;return ctx.deps.shareGeo(g);};
 for(let n=0;n<130;n++){const source=ctx.deps.shareGeo(new THREE.BoxGeometry(1,1,1)),g=new THREE.Group(),mat=ctx.deps.toon(0xffffff);for(let i=0;i<2;i++)ctx.deps.mk(source,mat,i,0,0,g,.012);ctx.batch(g,{shareGeometry});const geometry=mergedNodes({g})[0].geometry;let disposed=0;geometry.addEventListener('dispose',()=>disposed++);ctx.dispose(g);assert.equal(disposed,n<128?0:1);}
 assert.equal(shared,128);
});
