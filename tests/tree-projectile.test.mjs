import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'');
function fixture(){
 const no=()=>{},scene=new THREE.Scene(),G={projs:[],enemies:[],mK:0},hits=[];
 const toon=vm.createContext({THREE,scene,mergeVertices:g=>g});vm.runInContext(strip(read('render/toon.js'))+';this.api={glow,shareGeo,shareMat,disposeOwned}',toon);
 const env=vm.createContext({THREE,G,scene,...toon.api,rand:()=>.5,emit:no,debris:no,ringFx:no,later:no,P:{},PB:{},Q:{},Snd:{play:no},enemyAim:e=>e.g.position.clone(),hurt:(e,d,c,b,s,ap)=>{e.hp-=d*(ap?1:1-e.E.armor);hits.push({id:e.id,d,ap});}});
 vm.runInContext(strip(read('combat/projectiles.js'))+';this.api={makeArrow,updProjs}',env);
 const src=read('heroes/advfx.js'),extra=vm.createContext({THREE,G,scene,makeArrow:env.api.makeArrow});vm.runInContext(src.slice(src.indexOf('function treePierce('))+';this.pierce=treePierce',extra);
 const target=(id,z,fly=false)=>{const g=new THREE.Group();g.position.z=z;const e={id,g,E:{armor:.5,fly},hp:1000};G.enemies.push(e);return e;};
 return {G,scene,hits,target,...env.api,pierce:extra.pierce};
}
test('trait arrow hits only nearest extra target, keeps armor, no callback recursion even at slow frame',()=>{
 const f=fixture(),primary=f.target('primary',2),far=f.target('far',8),near=f.target('near',4,true);
 f.pierce(new THREE.Vector3(),new THREE.Vector3(0,1,2),primary,100,10,.45,0xffffff);
 assert.equal(f.G.projs[0].onHit,undefined);f.updProjs(.5);assert.deepEqual(f.hits.map(x=>x.id),['near']);assert.equal(near.hp,977.5);assert.equal(primary.hp,1000);assert.equal(far.hp,1000);assert.equal(f.G.projs.length,0);assert.equal(f.scene.children.length,0);
});
test('trait extension uses remaining original range and never begins at/after range',()=>{
 const f=fixture(),p=f.target('primary',10);f.pierce(new THREE.Vector3(),new THREE.Vector3(0,1,10),p,100,10,.45,0xffffff);assert.equal(f.G.projs.length,0);
 f.pierce(new THREE.Vector3(),new THREE.Vector3(0,1,9),p,100,10,.45,0xffffff);assert.equal(f.G.projs[0].left,1);f.updProjs(1);assert.equal(f.G.projs.length,0);
});
test('twenty cycles release scene/projectile owners while cached arrow resources stay valid',()=>{
 const f=fixture(),live=f.makeArrow(0xffffff);let disposed=0;live.geometry.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<20;i++){f.G.enemies=[];const p=f.target('primary',2);f.target('secondary',4);f.pierce(new THREE.Vector3(),new THREE.Vector3(0,1,2),p,100,10,.45,0xffffff);f.updProjs(.5);assert.equal(f.G.projs.length,0);assert.equal(f.scene.children.length,0);}
 assert.equal(disposed,0);
});
test('Lv50 line adds exactly two targets and retains original range, armor and non-recursive ownership',()=>{
 const f=fixture(),p=f.target('primary',2),a=f.target('one',4),b=f.target('two',6),c=f.target('three',8);
 f.pierce(new THREE.Vector3(),new THREE.Vector3(0,1,2),p,100,10,.35,0xffffff,3);assert.equal(f.G.projs[0].onHit,undefined);f.updProjs(.5);
 assert.deepEqual(f.hits.map(h=>h.id),['one','two']);assert.equal(a.hp,982.5);assert.equal(b.hp,982.5);assert.equal(c.hp,1000);assert.equal(p.hp,1000);assert.equal(f.G.projs.length,0);assert.equal(f.scene.children.length,0);
});
