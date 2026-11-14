import test from 'node:test';
import {absorbEShield} from '../src/data/hero-e.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {treeBuild,changeTree,treeMods,basicTreeMul,treeTaken,treeCooldown,treeSkillUsed} from '../src/data/skill-tree.js';
import {fixture as fighter} from './support/tree-upper-basic.mjs';
const read=f=>fs.readFileSync(new URL('../src/heroes/'+f,import.meta.url),'utf8');
const build=(h,b,cs)=>{let t={};for(const [l,c] of Object.entries(cs))t=changeTree(t,h,b,50,0,+l,c);return treeBuild(t,h,b,50);};
function fixture(cls,branch,choices){
 const no=()=>{},G={t:10,ups:{atk:0,spd:0,rng:0,skill:0},enemies:[],fxs:[],gunN:{shots:0}},hits=[],scene=new THREE.Scene();
 const hero={cls,g:new THREE.Group(),C:{dmg:100,range:10,armor:0,cd:10},adv:{atk:{},col:0xffffff},treeMods:treeMods(build(cls,branch,choices)),face:0,hp:1000,max:1000,ch:{acts:{}},dead:0};
 const hurt=(e,d)=>{e.hp-=d*(1-e.E.armor);hits.push({e,d:d*(1-e.E.armor)});};
 const env=vm.createContext({THREE,G,hero,scene,absorbEShield,basicTreeMul,treeTaken,treeCooldown,dgm:()=>({dmg:1,crit:0,critD:0,rate:1,range:1,cd:1}),advAtkMul:()=>1,heroTip:()=>hero.g.position.clone(),Snd:{play:no,whoosh:no,gun:no},P:{},emit:no,hurt,shoot:(_k,_p,t,d)=>hurt(t,d),advArrow:(t,_p,d)=>hurt(t,d),advOrb:(t,_p,d)=>hurt(t,d),advBullet:()=>({}),advLeech:no,advOnHurt:no,play:no,muzzle:()=>hero.g.position.clone(),flash:no,shell:no});
 const s=read('hero.js');vm.runInContext(s.slice(s.indexOf('const stat ='),s.indexOf('function spawnHero'))+s.slice(s.indexOf('function attack('),s.indexOf('export { heroHud'))+s.slice(s.indexOf('function heroDamage('),s.indexOf('const heroPass ='))+';this.attack=attack;this.damage=heroDamage;',env);
 const gun=read('gunner.js');vm.runInContext('let side=0;'+gun.slice(gun.indexOf('export function gunAttack'),gun.indexOf('// 직선 탄환')).replace('export function','function')+';this.gun=gunAttack;',env);
 const target=(z=2,hp=1000,flags={})=>{const e={hp,max:1000,E:{armor:.2,...flags},g:new THREE.Group(),dead:false};e.g.position.z=z;G.enemies.push(e);return e;};
 return {G,hero,hits,target,attack:env.attack,gun:env.gun,damage:env.damage};
}
test('real hero attack dispatch respects mage range and warrior elite capstones once',()=>{
 const m=fixture('mage','frost',{50:'siege'}),near=m.target(3),far=m.target(8);m.attack(near);m.attack(far);assert.deepEqual(m.hits.map(x=>+x.d.toFixed(6)),[72,96]);
 const w=fixture('warrior','berserk',{50:'pressure'}),normal=w.target(),elite=w.target(3,1000,{boss:true});w.attack(normal);assert.deepEqual(w.hits.map(x=>+x.d.toFixed(6)),[75.2,100]);
});
test('real gunner basic dispatch counts same target, resets on switch and applies moving choice once',()=>{
 const g=fixture('gunner','duel',{50:'sustain'}),a=g.target(),b=g.target(3);for(let i=0;i<4;i++)g.gun(a);g.gun(b);assert.deepEqual(g.hits.map(x=>+x.d.toFixed(6)),[72,80,80,96,72]);
 const m=fixture('gunner','duel',{50:'mobile'}),e=m.target();m.gun(e);m.hero.treeMoving=true;m.gun(e);assert.deepEqual(m.hits.map(x=>+x.d.toFixed(6)),[75.2,94.4]);
});
test('real damage path composes armor and capped low-health defense once',()=>{
 const f=fixture('warrior','paladin',{15:'guard',40:'stable',50:'lastguard'});f.hero.C.armor=.2;f.hero.hp=390;f.damage(100);assert.equal(f.hero.hp,330);f.hero.hp=400;f.damage(100);assert.ok(Math.abs(f.hero.hp-(400-80*.94*.94))<1e-8);
});
test('real fighter swings/orbs use pursuit and flow windows without changing equipment proc damage',()=>{
 for(const branch of ['tiger','dragon'])for(const id of ['pursuit','flow']){
  const run=(tree,trigger)=>{const f=fighter(branch,tree);f.hero.lsk=null;const e=f.target(2);f.G.t=10;if(trigger==='e')treeSkillUsed(f.hero,'e',10);if(trigger==='ranged')basicTreeMul(f.hero,e,'ranged',10);f.attack(.5);return f.hits.reduce((n,h)=>n+h.d,0);};
  const base=run(null),t=build('fighter',branch,{50:id}),after=run(t,id==='pursuit'?'e':'ranged');assert.ok(base>0);assert.ok(Math.abs(after/base-(id==='pursuit'?(branch==='dragon'?.92:1.3):1.2))<1e-8);
  const f=fighter(branch,t);f.G.t=10;treeSkillUsed(f.hero,'e',10);const e=f.target(2);f.legend(e,{mode:'melee'});f.tick(2);assert.ok(Math.abs(f.hits.reduce((n,h)=>n+h.d,0)-270)<1e-8);
 }
});
