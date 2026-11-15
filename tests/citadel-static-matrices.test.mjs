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
vm.runInContext(clean(read('src/render/citadel-body-batch.js')),ctx);
const leaves=root=>{root.updateMatrixWorld(true);const a=[];root.traverse(o=>{if(!o.isMesh||o.userData.ol)return;for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){const m=new THREE.Matrix4();if(o.isInstancedMesh)o.getMatrixAt(i,m);const world=o.matrixWorld.clone().multiply(m);a.push({geo:o.geometry,mat:o.material,world:world.elements.slice(),shadow:o.castShadow,receive:o.receiveShadow});}});return a;};
vm.runInContext(clean(read('src/data/chapters/endgame.js'))+';this.types={...ABYSS_ENEMIES,...CITADEL_ENEMIES};',ctx);
ctx.G={t:0};
vm.runInContext(clean(read('src/render/endgame-monsters.js')).replace('if(!abyss)inner.traverse','if(!abyss&&this.freeze)inner.traverse')+';this.factory=makeEndgameEnemy;',ctx);
for(const [name,E] of Object.entries(ctx.types))test(name+' fixed leaf matrices retain walk/cast/strike/recover/awaken/death and flash',()=>{
ctx.freeze=false;const a=ctx.factory(E);ctx.freeze=true;const b=ctx.factory(E);
const ea={g:a.g,E,flash:0},eb={g:b.g,E,flash:0};
for(let n=0;n<16;n++){ctx.G.t=n*.1;for(const e of [ea,eb]){e.g.position.x=n*.08;e.g.rotation.y=n*.11;if(n===2)e.endCast={t:.5,duration:1};if(n===4){e.endCast=null;e.endStrikeT=.4;}if(n===6)e.endRecover=1;if(n===8)e.endAwakened=true;if(n===10)e.flash=.2;if(n===12)e.dying=.7;}
a.anim(ea,.1);b.anim(eb,.1);const pa=leaves(a.g),pb=leaves(b.g);assert.equal(pa.length,pb.length);for(let j=0;j<pa.length;j++){assert.deepEqual(pa[j].world,pb[j].world);assert.equal(pa[j].geo.type,pb[j].geo.type);assert.equal(pa[j].mat.color.getHex(),pb[j].mat.color.getHex());assert.equal(pa[j].mat.emissiveIntensity,pb[j].mat.emissiveIntensity);}}
ctx.api.disposeOwned(a.g);ctx.api.disposeOwned(b.g);
});
