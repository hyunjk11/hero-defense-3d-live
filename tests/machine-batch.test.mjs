import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=vm.createContext({...THREE,THREE,scene:new THREE.Scene(),G:{t:0}});
const utils=read('lib/addons/utils/BufferGeometryUtils.js').replace(/import[\s\S]*?from ['"]three['"];?/,'').replace(/export\s*\{[\s\S]*?\};?/g,'');
vm.runInContext(utils,ctx);
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/export\s*\{[\s\S]*?\};?/g,'').replaceAll('export ','');
vm.runInContext(clean(read('src/render/toon.js'))+';this.disposer=disposeOwned;',ctx);
vm.runInContext(clean(read('src/render/machine-batch.js'))+';this.batch=batchMachineParts;',ctx);
vm.runInContext(clean(read('src/data/chapters/machine.js'))+';this.types=MACHINE_ENEMIES;',ctx);
vm.runInContext(clean(read('src/render/machine-monsters.js')).replace('batchMachineParts(inner);','if(this.useBatch)batchMachineParts(inner);')+';this.factory=makeMachineEnemy;',ctx);
function leaves(m){const groups=[];m.g.traverse(o=>{if(!o.isMesh)groups.push(o);});const rows=[];for(let k=0;k<groups.length;k++)for(const o of groups[k].children){if(!o.isMesh||o.userData.ol)continue;const base={group:k,geo:o.geometry.uuid,mat:o.material.uuid};if(o.isInstancedMesh){for(let i=0;i<o.count;i++){const a=new THREE.Matrix4();o.getMatrixAt(i,a);rows.push({...base,matrix:a.elements});}}else{o.updateMatrix();rows.push({...base,matrix:o.matrix.elements});}}return rows;}
function sorted(m){return leaves(m).sort((a,b)=>a.group-b.group||a.geo.localeCompare(b.geo)||a.mat.localeCompare(b.mat)||a.matrix.join(',').localeCompare(b.matrix.join(',')));}
function counts(m){let mesh=0,inst=0;m.g.traverse(o=>{if(o.isMesh)mesh++;if(o.isInstancedMesh)inst++;});return {mesh,inst};}
for(const [name,E]of Object.entries(ctx.types))test(name+' preserves local transforms, material ownership, animated groups and bounds',()=>{
 ctx.useBatch=false;const m=ctx.factory(E);ctx.useBatch=true;const built=ctx.factory(E);assert.ok(m.inner.scale.distanceTo(built.inner.scale)<1e-10);assert.ok(m.inner.position.distanceTo(built.inner.position)<1e-10);
 const before=leaves(m),bounds=new THREE.Box3().setFromObject(m.g),count=counts(m).mesh;
 const animated=[...m.legs,...m.arms,...m.panels,...m.wheels,...m.rotors,...m.wings];ctx.batch(m.inner);const after=leaves(m);assert.equal(after.length,before.length);
 // Match each original part within its unchanged animated parent/material/geometry.
 const remaining=after.slice();for(const a of before){const i=remaining.findIndex(b=>a.group===b.group&&a.geo===b.geo&&a.mat===b.mat&&a.matrix.every((v,k)=>Math.abs(v-b.matrix[k])<1e-6));assert.ok(i>=0,'lost part transform');remaining.splice(i,1);}assert.equal(remaining.length,0);
 const box=new THREE.Box3().setFromObject(m.g);assert.ok(box.min.x<=bounds.min.x+1e-5&&box.max.x>=bounds.max.x-1e-5); // Conservative instance bounds may grow, never cull real parts.
assert.ok(counts(m).mesh<count);
 const e={g:m.g,E,flash:0,hp:10};m.anim(e,.1);e.g.position.x+=.5;e.machineCast={t:.5,duration:1};m.anim(e,.1);e.machineRecover=1;m.anim(e,.1);e.dying=.8;m.anim(e,.1);
 for(const group of animated)assert.ok(group.parent,'animated parent was detached');
 const eb={...e,g:built.g};built.anim(eb,.1);eb.g.position.x+=.5;eb.machineCast={t:.5,duration:1};built.anim(eb,.1);eb.machineRecover=1;built.anim(eb,.1);eb.dying=.8;built.anim(eb,.1);
 ctx.disposer(built.g);
 m.g.traverse(o=>{if(o.isInstancedMesh){assert.equal(o.userData.ol?o.castShadow:!o.castShadow,false);if(o.userData.ol){o.visible=false;assert.equal(o.visible,false);}else assert.ok(m.mats.includes(o.material));}});
 const material=m.mats.find(x=>leaves(m).some(y=>y.mat===x.uuid));material.emissive.setHex(0xffffff);assert.ok(leaves(m).some(x=>x.mat===material.uuid));
 let released=0;const n=counts(m).inst;m.g.traverse(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>released++);});ctx.disposer(m.g);assert.equal(released,n);
 console.log(name+' mesh '+count+' -> '+counts(m).mesh);
});

test('factory batching preserves every part, outline thickness and fan parent',()=>{
 const deps=vm.runInContext('({mk,toon,shareGeo,shareMat})',ctx),scene=new THREE.Scene();
 const env=vm.createContext({...deps,THREE,scene,STAGE:{ch:8},T:{FOREST:1},GW:20,GH:14,NT:280,tileX:x=>x,tileZ:x=>x,batchMachineParts:()=>{}});
 vm.runInContext(clean(read('src/render/machine-environment.js'))+';this.build=machineDeco;this.update=updateMachineDeco;',env);env.build();const root=scene.getObjectByName('machine-factory'),m={g:root};
 const before=leaves(m),meshBefore=counts(m).mesh;const groupBefore=[];root.traverse(o=>{if(!o.isMesh)groupBefore.push(o);});
 const outlineMaterials=new Set();root.traverse(o=>{if(o.userData.ol)outlineMaterials.add(o.material);});ctx.batch(root);const after=leaves(m),remaining=after.slice();assert.equal(before.length,after.length);
 for(const a of before){const i=remaining.findIndex(b=>a.group===b.group&&a.geo===b.geo&&a.mat===b.mat&&a.matrix.every((v,k)=>Math.abs(v-b.matrix[k])<1e-6));assert.ok(i>=0);remaining.splice(i,1);}
 root.traverse(o=>{if(o.userData.ol)assert.ok(outlineMaterials.has(o.material));});env.update(10);for(const group of groupBefore)assert.ok(group===root||group.parent);assert.equal(groupBefore.filter(g=>Math.abs(g.rotation.y-8)<1e-9).length,8);
 assert.ok(counts(m).mesh<meshBefore);console.log('factory mesh '+meshBefore+' -> '+counts(m).mesh);ctx.disposer(root);
});

test('all moving parent transforms match through walk, windup, exposed, awakened and dying states',()=>{
 const groups=m=>{m.g.updateMatrixWorld(true);const out=[];m.g.traverse(o=>{if(!o.isMesh)out.push(o.matrixWorld.elements.slice());});return out;};
 for(const E of Object.values(ctx.types)){
  ctx.useBatch=false;const a=ctx.factory(E);ctx.useBatch=true;const b=ctx.factory(E);
  const ea={g:a.g,E,flash:0},eb={g:b.g,E,flash:0};
  for(let n=0;n<12;n++){
   ctx.G.t=n*.1;for(const e of [ea,eb]){e.g.position.x=n*.07;e.g.rotation.y=n*.03;if(n===3)e.machineCast={t:.7,duration:1};if(n===5)e.machineRecover=1;if(n===7){e.machineAwakened=true;e.machineCast=null;}if(n===9)e.dying=.8;}
   a.anim(ea,.1);b.anim(eb,.1);const ga=groups(a),gb=groups(b);assert.equal(ga.length,gb.length);for(let j=0;j<ga.length;j++)for(let k=0;k<16;k++)assert.ok(Math.abs(ga[j][k]-gb[j][k])<1e-10);
   assert.deepEqual(a.mats.map(m=>[m.emissive.getHex(),m.emissiveIntensity]),b.mats.map(m=>[m.emissive.getHex(),m.emissiveIntensity]));
  }
  ctx.disposer(a.g);ctx.disposer(b.g);
 }
});
