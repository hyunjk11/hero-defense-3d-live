import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {skillAllowed} from '../src/data/hard-party.js';
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
test('delayed base and advancement Q projectiles retain caster and skill attribution after switching',()=>{
 for(const [cls,skill,kind]of [['archer',null,'rain'],['mage',null,'meteor'],['archer','storm','rain'],['mage','meteors','meteor'],['archer','snipe','pierce']]){
  const h={cls,g:new THREE.Group(),C:{},ch:{acts:{}},treeMods:{},skillCd:0,dead:0,adv:skill?{skill,col:0xffaa33,c:'#fff'}:null},other={cls:'fighter'},G={curHero:h,hero:other,phase:'build',t:0,projs:[],enemies:[]},timers=[],no=()=>{};
  let cueN=0;const env=vm.createContext({qFeedback:()=>cueN++,rand:()=>.4,THREE,G,hero:h,skillAllowed,scene:new THREE.Scene(),Snd:{play:no,whoosh:no},play:no,banner:no,ringFx:no,emit:no,P:{},PB:{},heroFx:()=>[],asSkill:(f,...a)=>f(...a),stat:{dmg:()=>100,skillMul:()=>1,skillCd:()=>10},treeQBonus:()=>1,treeSkillUsed:no,mouseGround:new THREE.Vector3(),glow:c=>new THREE.MeshBasicMaterial({color:c}),makeArrow:()=>new THREE.Group(),later:(_t,f)=>{const caster=G.curHero;timers.push(()=>{const old=G.curHero;G.curHero=caster;f();G.curHero=old;});}});
  vm.runInContext(strip(fs.readFileSync(new URL('../src/heroes/advfx.js',import.meta.url),'utf8'))+';this.advSkill=advSkill;',env);
  vm.runInContext(strip(fs.readFileSync(new URL('../src/heroes/skills.js',import.meta.url),'utf8'))+';this.cast=castSkill;',env);
  env.cast(new THREE.Vector3(0,0,5));assert.equal(cueN,1);env.cast(new THREE.Vector3(0,0,5));assert.equal(cueN,1,'cooldown rejected casts add no signature');G.curHero=other;for(const f of timers)f();
  assert.ok(G.projs.length,`${cls}/${skill}`);assert.ok(G.projs.every(p=>p.kind===kind&&p.h===h&&p.mk===1),`${cls}/${skill}: caster or skill attribution missing`);
  assert.equal(G.curHero,other);
 }
});
