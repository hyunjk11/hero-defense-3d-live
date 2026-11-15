import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {ABYSS_ENEMIES,CITADEL_ENEMIES} from '../src/data/chapters/endgame.js';
import * as E from '../src/account/equip.js';
const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const scene=new THREE.Scene(),G={t:0};const toonContext=vm.createContext({THREE,scene,mergeVertices:g=>g});
vm.runInContext(strip(read('render/toon.js'))+'\nthis.api={mk,toon,shareGeo,disposeObj,disposeOwned};',toonContext);
const utils=vm.createContext({...THREE,THREE});vm.runInContext(fs.readFileSync(new URL('../lib/addons/utils/BufferGeometryUtils.js',import.meta.url),'utf8').replace(/import[\s\S]*?from ['"]three['"];?/,'').replace(/export\s*\{[\s\S]*?\};?/g,'')+';this.merge=mergeGeometries;',utils);
const env=vm.createContext({THREE,G,mergeGeometries:utils.merge,...toonContext.api});
vm.runInContext(strip(read('render/citadel-body-batch.js')),env);
vm.runInContext(strip(read('render/endgame-monsters.js'))+'\nthis.api={makeEndgameEnemy};',env);
let modelCount=0;
for(const def of Object.values({...ABYSS_ENEMIES,...CITADEL_ENEMIES})){
 const m=env.api.makeEndgameEnemy(def),e={E:def,g:m.g,m,flash:0};scene.add(m.g);const original=new THREE.Box3().setFromObject(m.g);assert.ok(Number.isFinite(original.min.y));assert.ok(Math.abs(original.max.y-original.min.y-def.h)<.1,def.form+' height');
 for(let i=0;i<20;i++){e.g.position.x+=.02;G.t+=.02;m.anim(e,.02);}
 e.endCast={t:.5,duration:2};m.anim(e,.1);e.endCast=null;e.endStrikeT=.4;e.endRecover=2;m.anim(e,.1);e.endAwakened=true;m.anim(e,.1);e.dying=.5;m.anim(e,.1);
 m.g.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite));assert.ok(o.quaternion.toArray().every(Number.isFinite));});
 const calls=new Map();for(const mat of m.mats)mat.addEventListener('dispose',()=>calls.set(mat,(calls.get(mat)||0)+1));
 m.g.removeFromParent();toonContext.api.disposeObj(m.g);m.mats.forEach(mat=>mat.dispose());assert.equal(calls.size,6);assert.ok([...calls.values()].every(n=>n===1));modelCount++;
}
assert.equal(scene.children.length,0);
const gear=vm.createContext({THREE,...toonContext.api});vm.runInContext(strip(read('render/endgame-gear.js'))+'\nthis.update=updateEndgameGear;',gear);
const root=new THREE.Group();for(const name of ['LeftArm','RightArm','LeftHand','RightHand','Spine02']){const bone=new THREE.Group();bone.name=name;root.add(bone);}const ch={root,mats:[]};
let allMats=[],calls=new Map();
for(let cycle=0;cycle<20;cycle++)for(const hero of ['archer','mage','warrior','gunner','fighter'])for(const chapter of [9,10]){
 const items=E.SLOT_KEYS.map(slot=>E.makeItem(slot,hero,3,()=>.5,chapter));gear.update(ch,items);
 const before=ch.endgameGearNodes.length;gear.update(ch,items);assert.equal(ch.endgameGearNodes.length,before,'idempotent visual update');
 for(const mat of ch.mats){if(allMats.includes(mat))continue;allMats.push(mat);mat.addEventListener('dispose',()=>calls.set(mat,(calls.get(mat)||0)+1));}
}
gear.update(ch,[]);assert.equal(ch.mats.length,0);assert.equal(ch.endgameGearNodes.length,0);assert.equal(root.children.length,5);assert.equal(calls.size,allMats.length);assert.ok([...calls.values()].every(n=>n===1),'shared item materials disposed once across both shoulders/hands');
// Missing bones must still release the item's unused materials.
const missing={root:new THREE.Group(),mats:[]};gear.update(missing,[E.makeItem('weapon','mage',3,()=>.5,9)]);const mats=missing.mats.slice();let disposed=0;mats.forEach(m=>m.addEventListener('dispose',()=>disposed++));gear.update(missing,[]);assert.equal(disposed,mats.length);
console.log(`endgame models: ${modelCount} models and animations; 200 gear sets cycled; ${allMats.length} materials released once; no retained attachments`);
