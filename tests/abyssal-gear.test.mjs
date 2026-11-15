import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
// Real Three object graph, actual ownership helpers and cosmetic module; no DOM/GPU.
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'').replace(/^export \{.*$/gm,'');
const env=vm.createContext({THREE,scene:new THREE.Scene(),mergeVertices:g=>g});
vm.runInContext(strip(fs.readFileSync(new URL('../src/render/toon.js',import.meta.url),'utf8'))+';this.helpers={mk,toon,shareGeo,disposeObj};',env);
const cosmetic=vm.createContext({THREE,...env.helpers});
vm.runInContext(strip(fs.readFileSync(new URL('../src/render/abyssal-gear.js',import.meta.url),'utf8'))+';this.update=updateAbyssalGear;',cosmetic);
const update=cosmetic.update;
const make=()=>{const root=new THREE.Group();root.scale.setScalar(.012);for(const name of ['LeftArm','RightArm','LeftHand','RightHand','Spine02']){const bone=new THREE.Bone();bone.name=name;root.add(bone);}const base=new THREE.MeshBasicMaterial();return{root,mats:[base],base,tip:root.getObjectByName('RightHand')};};
let checks=0;
for(const h of ['warrior','archer','mage','gunner','fighter']){
 const ch=make(),items=['weapon','armor','acc'].map(s=>({id:s,s,set:'abyssal',g:4,...(s==='weapon'?{h}:{})}));const snapshot=JSON.stringify(items);
 update(ch,items);assert.ok(ch.abyssalGearNodes.length>=5);assert.equal(ch.mats.length,4); if(h==='mage')assert.equal(ch.abyssalGearNodes.find(n=>n.name==='abyssal-weapon-mage').parent.name,'RightHand');
 const nodes=[...ch.abyssalGearNodes],mats=ch.mats.slice(1);let disposed=0,geoDisposed=0,baseDisposed=0;
 ch.base.addEventListener('dispose',()=>baseDisposed++);mats.forEach(m=>m.addEventListener('dispose',()=>disposed++));
 const geometries=new Set();nodes.forEach(n=>n.traverse(o=>{if(o.geometry)geometries.add(o.geometry);assert.ok(o.position.toArray().every(Number.isFinite));}));geometries.forEach(g=>g.addEventListener('dispose',()=>geoDisposed++));
 update(ch,[...items].reverse());assert.equal(ch.abyssalGearNodes[0],nodes[0]);assert.equal(disposed,0);
 const moving=ch.root.getObjectByName('RightHand');moving.rotation.z=.7;ch.root.updateMatrixWorld(true);assert.ok(ch.abyssalGearNodes.every(n=>n.parent));
 update(ch,[]);assert.equal(ch.mats.length,1);assert.equal(disposed,3);assert.equal(geoDisposed,0);assert.equal(baseDisposed,0);assert.ok(nodes.every(n=>n.parent===null));
 update(ch,[]);assert.equal(disposed,3);
 for(let i=0;i<30;i++){update(ch,items);assert.equal(ch.mats.length,4);update(ch,[]);assert.equal(ch.mats.length,1);}assert.equal(JSON.stringify(items),snapshot);checks+=12;
}
const bare={root:new THREE.Group(),mats:[]};update(bare,[{set:'abyssal',g:4,s:'armor',id:'x'}]);assert.equal(bare.mats.length,0);assert.equal(bare.abyssalGearNodes.length,0);
const wrong=make();update(wrong,[{set:'morvia',g:3,s:'armor',id:'m'},{set:'abyssal',g:3,s:'armor',id:'bad'}]);assert.equal(wrong.mats.length,1);
assert.match(fs.readFileSync(new URL('../src/render/chapter-gear.js',import.meta.url),'utf8'),/updateAbyssalGear\(ch, items\)/);
console.log('abyssal gear: five weapon shapes, armor/accessory mounts, signature no-op, 150 cleanup cycles, shared resources and save immutability passed ('+checks+' core assertions)');
