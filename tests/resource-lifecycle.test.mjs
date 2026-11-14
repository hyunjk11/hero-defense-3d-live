// Actual resource/teardown bodies, real Three objects; no browser, account or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'');
const no=()=>{},scene=new THREE.Scene();
const toon=vm.createContext({THREE,scene,mergeVertices:g=>g});
vm.runInContext(strip(read('render/toon.js'))+'\nthis.api={mk,toon,glow,shareGeo,shareMat,disposeObj,disposeOwned};',toon);
const api=toon.api;
const G={ups:{bar:0},projs:[]};
const bars=vm.createContext({THREE,G,scene,camera:new THREE.PerspectiveCamera()});
vm.runInContext(strip(read('render/hpbars.js'))+'\nthis.api={hpBar,BARS};',bars);
const bar=vm.createContext({THREE,G,scene,...api,hpBar:bars.api.hpBar,barHpAt:()=>100,
  T:{CARVED:4},inGrid:()=>true,tileX:x=>x,tileZ:z=>z,enterCost:()=>1,tileAt:()=>({}),
  refreshTile:no,computeDist:no,select:no,debris:no,emit:no,P:{},banner:no,Snd:{play:no}});
vm.runInContext(strip(read('world/barricades.js'))+'\nthis.api={addBarricade,removeBarricade,woodM,woodD};',bar);
function counts(root){const geos=new Set(),mats=new Set();root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of [o.material].flat())if(m&&!o.userData.ol)mats.add(m);});const result={geo:0,mat:0};geos.forEach(g=>g.addEventListener('dispose',()=>result.geo++));mats.forEach(m=>m.addEventListener('dispose',()=>result.mat++));return result;}
let passed=0,failed=0;function test(n,f){try{f();passed++;console.log('PASS '+n);}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}}
test('barricade removes all 29 owned geometries, five owned materials and HP bar',()=>{
  const t={c:1,r:1},base=bars.api.BARS.length,b=bar.api.addBarricade(t),c=counts(b.g);
  bar.api.removeBarricade(t,false);assert.equal(b.g.parent,null);assert.equal(t.bar,null);assert.equal(bars.api.BARS.length,base);assert.equal(c.geo,29);assert.equal(c.mat,5);
  bar.api.removeBarricade(t,false);assert.equal(c.geo,29);
});
test('removing one barricade preserves materials used by its live neighbor',()=>{
  const a={c:2,r:1},b={c:3,r:1};bar.api.addBarricade(a);const live=bar.api.addBarricade(b);let disposed=0;
  const on=()=>disposed++;bar.api.woodM.addEventListener('dispose',on);bar.api.woodD.addEventListener('dispose',on);
  bar.api.removeBarricade(a,true);assert.equal(disposed,0);assert.equal(live.g.parent,scene);bar.api.removeBarricade(b,false);
  bar.api.woodM.removeEventListener('dispose',on);bar.api.woodD.removeEventListener('dispose',on);
});
test('completed comet releases both owned resources and its callback',()=>{
  const FX=[],s=read('heroes/advfx.js'),body=s.slice(s.indexOf('function comet('),s.indexOf('function updSanct('));
  const env=vm.createContext({THREE,...api,scene,FX,P:{},emit:no,near:()=>[],hit:no,cnt:no,ringFx:no,Snd:{play:no}});
  vm.runInContext(body+'\ncomet(new THREE.Vector3(),1);',env);const m=scene.children.at(-1),c=counts(m);
  assert.equal(FX.pop()(1),false);assert.equal(m.parent,null);assert.equal(c.geo,1);assert.equal(c.mat,1);assert.equal(FX.length,0);
});
const source=read('combat/projectiles.js');
const proj=vm.createContext({THREE,...api,G,scene});
vm.runInContext(source.slice(source.indexOf('const arrowGeo'),source.indexOf('function shoot('))+'\n'+source.slice(source.indexOf('function killProj('),source.indexOf('// 피해 미터: 투사체'))+'\nthis.api={makeArrow,killProj};',proj);
test('piercing arrow does not dispose cached resources of another live arrow',()=>{
  const live=proj.api.makeArrow(0xd0ffd0),dead=proj.api.makeArrow(0xd0ffd0),c=counts(live);scene.add(live,dead);G.projs=[{kind:'pierce',m:dead}];proj.api.killProj(0);
  assert.equal(c.geo,0);assert.equal(c.mat,0);assert.equal(dead.parent,null);assert.equal(live.parent,scene);assert.equal(G.projs.length,0);scene.remove(live);
});
test('owned cannon/meteor/piercing meshes still release their resources',()=>{
  for(const kind of ['ball','meteor','pierce']){const m=new THREE.Mesh(new THREE.SphereGeometry(),api.glow(0xff0000)),c=counts(m);scene.add(m);G.projs=[{kind,m}];proj.api.killProj(0);assert.equal(c.geo,1);assert.equal(c.mat,1);assert.equal(m.parent,null);}
});
test('one owner disposes each geometry and skeleton once even with duplicate mesh references',()=>{
  const root=new THREE.Group(),geo=new THREE.BoxGeometry(),mat=api.toon(0xffffff);let bones=0;const skeleton={dispose(){bones++;}};
  for(let i=0;i<3;i++){const m=new THREE.SkinnedMesh(geo,mat);m.skeleton=skeleton;root.add(m);}const c=counts(root);api.disposeOwned(root);assert.equal(c.geo,1);assert.equal(c.mat,1);assert.equal(bones,1);
});
test('shared geometry/material/texture remain available after an owner is removed',()=>{
  const tex=new THREE.Texture(),geo=api.shareGeo(new THREE.BoxGeometry()),mat=api.shareMat(new THREE.MeshBasicMaterial({map:tex}));let textures=0;tex.addEventListener('dispose',()=>textures++);
  const root=new THREE.Group();root.add(new THREE.Mesh(geo,mat));const c=counts(root);api.disposeOwned(root);assert.equal(c.geo,0);assert.equal(c.mat,0);assert.equal(textures,0);
});
console.log(`${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
