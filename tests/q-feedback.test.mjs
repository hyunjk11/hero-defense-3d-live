import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
const src=fs.readFileSync(new URL('../src/render/q-feedback.js',import.meta.url),'utf8').split('const qCues=')[0].replace(/^import .*;.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const env=vm.createContext({THREE});vm.runInContext(src+';this.create=createQFeedback;',env);
function fixture(perf=false){const scene=new THREE.Scene(),G={phase:'wave',screen:'game',tiles:[],heroes:[]},pool=env.create(scene,()=>1,()=>G,()=>perf);const hero=cls=>{const h={cls,g:new THREE.Group(),dead:0,face:0};scene.add(h.g);G.heroes.push(h);return h};return{scene,G,pool,hero};}
test('six Q classes have distinct signature geometry, with no runtime RNG or gameplay mutation',()=>{
 const f=fixture(),geos=new Set();for(const cls of ['archer','mage','warrior','gunner','mechanic','fighter']){const h=f.hero(cls);const original=Math.random;Math.random=()=>{throw Error('Q visual consumed RNG')};try{assert.equal(f.pool.show(h,{x:2,z:4}),true);f.pool.update(.1);}finally{Math.random=original}const g=f.scene.children.filter(o=>o.name==='q-signature').at(-1);geos.add(g.children[0].geometry);assert.equal(h.dead,0);assert.equal(h.g.position.x,0);assert.ok(g.children[0].material.opacity<=.72);}
 assert.equal(geos.size,6);assert.equal(f.pool.active(),6);f.pool.update(1);assert.equal(f.pool.active(),0);f.pool.dispose();
});
test('performance mode uses one visible mesh per Q, caps simultaneous casts and reuses owner slots',()=>{
 const f=fixture(true),heroes=Array.from({length:7},()=>f.hero('mage'));for(let i=0;i<6;i++)assert.equal(f.pool.show(heroes[i],{x:0,z:0}),true);assert.equal(f.pool.show(heroes[6],{x:0,z:0}),false);assert.equal(f.pool.show(heroes[0],{x:1,z:1}),true);assert.equal(f.pool.active(),6);
 for(const g of f.scene.children.filter(o=>o.name==='q-signature'))assert.equal(g.children.filter(m=>m.visible).length,1);f.pool.dispose();
});
for(const reason of ['death','warp','town','map','removed','over'])test(`Q signature cleans on ${reason}`,()=>{const f=fixture(),h=f.hero('warrior');f.G.hero=h;f.pool.show(h);if(reason==='death')h.dead=1;if(reason==='warp')h.warpT=1;if(reason==='town')f.G.screen='town';if(reason==='map')f.G.tiles=[];if(reason==='removed'){f.G.hero=null;f.G.heroes=[];}if(reason==='over')f.G.phase='over';f.pool.update(.1);assert.equal(f.pool.active(),0);assert.equal(f.scene.children.filter(o=>o.name==='q-signature').length,0);f.pool.dispose();});
test('caster-linked signature follows caster, target signature stays at target; no state writes',()=>{const f=fixture(),h=f.hero('fighter'),m=f.hero('mage');f.pool.show(h);f.pool.show(m,{x:8,z:9});h.g.position.set(3,4,5);m.g.position.set(9,8,7);f.pool.update(.1);const gs=f.scene.children.filter(o=>o.name==='q-signature');assert.deepEqual(gs.map(g=>[g.position.x,g.position.y,g.position.z]),[[3,1.28,5],[8,1.28,9]]);f.pool.dispose();});
