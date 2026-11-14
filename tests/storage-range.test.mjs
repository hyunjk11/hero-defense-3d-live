import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../lib/three.module.js';
import * as E from '../src/account/equip.js';
import * as SG from '../src/account/storage.js';
import { STORAGE_SORTS, sortStorageItems } from '../src/ui/storage-sort.js';
const source = fs.readFileSync(new URL('../src/render/hero-range.js', import.meta.url), 'utf8');
const {createHeroRange} = new Function('THREE', source.replace(/^import.*;\r?\n/, '').replace('export function', 'function') + '\nreturn {createHeroRange};')(THREE);
let seed=17;const rng=()=>((seed=seed*16807%2147483647)/2147483647);
const items=[E.makeItem('acc','mage',4,rng),E.makeItem('weapon','mage',0,rng),E.makeItem('armor','mage',2,rng),E.makeItem('weapon','archer',3,rng),E.makeItem('weapon','mage',4,rng),E.makeItem('weapon','mage',4,rng)];
items[4].e=2;delete items[5].e;
const before=JSON.stringify(items),byId=new Map(items.map(x=>[x.id,x]));
const grouped=sortStorageItems(items);
assert.deepEqual(grouped.map(x=>x.id),[items[3],items[4],items[5],items[1],items[2],items[0]].map(x=>x.id));
for(const mode of Object.keys(STORAGE_SORTS)){
 const list=sortStorageItems(items,mode);assert.equal(list.length,items.length);assert.equal(new Set(list.map(x=>x.id)).size,items.length);
 assert.ok(list.every(x=>byId.get(x.id)===x));assert.equal(JSON.stringify(items),before);
 if(mode!=='group'&&mode!=='set')assert.deepEqual(list,SG.sortItems(items,mode));
 assert.deepEqual(sortStorageItems([],mode),[]);
}
assert.deepEqual(sortStorageItems([items[4],{...items[4],id:'tie'}]).map(x=>x.id),[items[4].id,'tie']);
const setItems=[E.makeItem('weapon','mage',2,rng,10),E.makeItem('acc','mage',2,rng,2),E.makeItem('armor','mage',2,rng,10)];assert.deepEqual(sortStorageItems(setItems,'set').map(x=>x.c),[2,10,10]);
const filtered=items.filter(x=>SG.matches(x,{slot:'weapon',grade:4}));assert.deepEqual(sortStorageItems(filtered).map(x=>x.id),[items[4].id,items[5].id]);
const scene=new THREE.Scene(),view=createHeroRange(scene),ring=view.ring;
const hero={dead:0,hp:100,g:{position:{x:3,y:5,z:-8}}};
assert.equal(scene.children.length,1);assert.equal(ring.visible,false);assert.equal(ring.material.depthWrite,false);assert.equal(ring.material.opacity,.32);
const geom=ring.geometry,mat=ring.material,random=Math.random;Math.random=()=>{throw Error('render update consumed game RNG')};
try{
 for(const radius of [1.8,2.7,6,8,9.6,12,6*1.45*1.25*1.15]){
  view.update(hero,radius,'wave');assert.equal(ring.visible,true);assert.equal(ring.scale.x,radius);assert.equal(ring.scale.y,radius);assert.equal(ring.position.x,3);assert.equal(ring.position.z,-8);assert.equal(ring.position.y,.09);
 }
 for(const phase of ['loading','select','town','menu','over']){view.update(hero,6,phase);assert.equal(ring.visible,false);}
 for(const [h,r,n] of [[null,6,false],[{...hero,dead:1},6,false],[{...hero,hp:0},6,false],[hero,NaN,false],[hero,Infinity,false],[hero,0,false],[hero,6,true]]){view.update(h,r,'build',n);assert.equal(ring.visible,false);}
 const other={...hero,g:{position:{x:-4,y:0,z:2}}};view.update(other,2.7,'build');assert.equal(ring.position.x,-4);assert.equal(ring.scale.x,2.7);
 for(let i=0;i<10000;i++)view.update(hero,6,'wave');assert.equal(scene.children.length,1);assert.equal(ring.geometry,geom);assert.equal(ring.material,mat);
 assert.equal(ring.raycast({}),undefined);
}finally{Math.random=random;}
let disposed=0;geom.addEventListener('dispose',()=>disposed++);mat.addEventListener('dispose',()=>disposed++);view.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,2);
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');assert.ok(main.includes('heroRange.update(G.hero, G.hero ? stat.range() : 0, G.phase, G.navigating)'));
console.log('OK storage identity/order/filter + actual Three.js ring radius/lifecycle/RNG/10000 updates');
