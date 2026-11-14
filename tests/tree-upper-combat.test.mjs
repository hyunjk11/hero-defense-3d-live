import {skillAllowed,movementAllowed} from '../src/data/hard-party.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
import {treeBuild,changeTree,treeMods,treeESkill,treeQBonus,treeSkillUsed} from '../src/data/skill-tree.js';import {eSkillFor} from '../src/data/hero-e.js';
import {fixture as fighter} from './support/tree-upper-fighter.mjs';
const read=f=>fs.readFileSync(new URL('../src/heroes/'+f,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const build=(h,b,cs)=>{let t={};for(const [l,c]of Object.entries(cs))t=changeTree(t,h,b,50,0,+l,c);return treeBuild(t,h,b,50);};
test('actual Q consumes weave once only after a successful cast, with gear and tree damage applied once',()=>{
 const calls=[],hero={cls:'mage',skillCd:0,dead:0,treeMods:treeMods(build('mage','flame',{20:'dense',40:'assault',50:'weave'})),adv:{},g:new THREE.Group()},G={t:10,phase:'wave',focus:2};
 const env=vm.createContext({skillAllowed,THREE,hero,G,treeQBonus,treeSkillUsed,asSkill:(f,...a)=>f(...a),stat:{dmg:()=>200,skillMul:()=>1.5,skillCd:()=>20},advSkill:(_t,m,b)=>{calls.push({m,b});return true;},mouseGround:new THREE.Vector3(0,0,3)});
 vm.runInContext(strip(read('skills.js'))+';this.cast=castSkill',env);treeSkillUsed(hero,'e',10);
 hero.dead=1;env.cast();assert.equal(hero.treeWeaveUntil,16);assert.equal(calls.length,0);hero.dead=0;env.cast();
 assert.ok(Math.abs(calls[0].m-1.5*1.2*1.08*1.25)<1e-10);assert.equal(calls[0].b,200);assert.equal(hero.treeWeaveUntil,0);env.cast();assert.equal(calls.length,1);
 hero.skillCd=0;env.cast();assert.ok(Math.abs(calls[1].m-1.5*1.2*1.08)<1e-10);
});
test('actual movement segment does not grant mobile damage for blocked movement input',()=>{
 const source=read('hero.js'),start=source.indexOf('function updHero(dt)'),end=source.indexOf('  const rng = stat.range();',start),h={g:new THREE.Group(),ch:{mixer:{update(){}}},path:[],stuckT:0,stuckD:1e9,C:{speed:4},treeMods:treeMods(build('gunner','duel',{50:'mobile'})),dead:0},G={hero:h,t:1};let walk=false;
 const env=vm.createContext({movementAllowed,THREE,hero:h,G,cam:{theta:0},keys:{d:true},passAt:()=>walk,heroPassXZ:()=>walk,overlap:()=>1,groundY:()=>0});
 vm.runInContext(source.slice(start,end)+'return h.treeMoving;};this.update=updHero;',env);
 assert.equal(env.update(.1),false);assert.equal(h.g.position.x,0);walk=true;assert.equal(env.update(.1),true);assert.ok(h.g.position.x>0);
});
test('actual fighter E damage/width/expiry and resource ownership for both branches',()=>{
 for(const branch of ['tiger','dragon'])for(const choice of ['dashwide','dashstrike']){
  const f=fighter(branch,build('fighter',branch,{30:choice})),s=treeESkill(eSkillFor('fighter',50),f.hero.treeMods),a=f.target(3),edge=f.target(3,{x:2.5});
  f.api.tigerdash(s,new THREE.Vector3(0,0,9));f.tick(5);assert.ok(Math.abs(100000-a.hp-100*s.mul)<1e-7);assert.equal(edge.hp<100000,choice==='dashwide');
  assert.equal(f.scene.children.length,0);assert.equal(f.api.FX.length,0);
  for(let i=0;i<20;i++){f.hero.g.position.set(0,0,0);f.api.tigerdash(s,new THREE.Vector3(0,0,9));f.tick(5);assert.equal(f.scene.children.length,0);assert.equal(f.api.FX.length,0);assert.equal(f.G.timers.length,0);}
 }
});
test('actual gunner E bloom and fan specialize damage/radius without proc recursion; twenty casts drain all effects',()=>{
 for(const choice of ['fan','beam']){
  const no=()=>{},FX=[],timers=[],scene=new THREE.Scene(),G={t:0,enemies:[],legendDmg:0},hero={g:new THREE.Group(),ch:{},dead:0,path:[]},hits=[];
  const env=vm.createContext({THREE,G,hero,scene,heroFx:()=>FX,later:(t,f)=>timers.push({t,f}),stat:{dmg:()=>100,skillMul:()=>1.5},hurt0:(e,d)=>{e.hp-=d;hits.push(d);},P:{},PB:{},emit:no,ringFx:no,banner:no,play:no,Snd:{play:no,gun:no,whoosh:no}});
  vm.runInContext(strip(read('gunner.js'))+';this.api={rosebarrage,bloom,updGun}',env);
  const s=treeESkill(eSkillFor('gunner',50),treeMods(build('gunner','duel',{30:choice}))),target=x=>{const e={hp:1e6,dead:false,E:{},g:new THREE.Group()};e.g.position.set(x,0,0);G.enemies.push(e);return e;};
  const center=target(0),edge=target(3.8);env.api.bloom(new THREE.Vector3(),s);assert.ok(Math.abs(1e6-center.hp-100*s.mul*2*1.5)<1e-7);assert.equal(edge.hp<1e6,choice==='fan');
  const tick=()=>{for(let i=0;i<700;i++){G.t+=.01;for(let j=timers.length-1;j>=0;j--){timers[j].t-=.01;if(timers[j].t<=0){const t=timers.splice(j,1)[0];t.f();}}env.api.updGun(.01);}};tick();assert.equal(scene.children.length,0);
  for(let i=0;i<20;i++){env.api.rosebarrage(s,new THREE.Vector3(0,0,10));tick();assert.equal(FX.length,0);assert.equal(timers.length,0);assert.equal(scene.children.length,0);}
  assert.equal(G.gunN.barrage,20);assert.equal(G.gunN.ricochet,0);
 }
});
