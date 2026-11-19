import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
import{applyTowerSlow,tickTowerSlow,enemySlow,enemySlowAmount}from'../src/combat/tower-slow.js';
import{bossDebuffs}from'../src/ui/boss-debuffs.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const enemy=()=>({E:{boss:true,fly:true,h:2,spd:1},g:{position:new THREE.Vector3(),rotation:{y:0}},m:{proc:'endgame',inner:{position:new THREE.Vector3(),rotation:{}}},hb:{set(){}},hp:100,max:100,slowT:0,slowAmt:0,state:'walk',ai:'basic',tile:[0,0]});
for(const order of [0,1])test(`independent tower durations and weak fallback, order ${order}`,()=>{
 const e=enemy();for(const [a,t]of order?[[.35,3],[.7,2]]:[[.7,2],[.35,3]])applyTowerSlow(e,a,t);
 assert.deepEqual(enemySlow(e),{amount:.7,time:2});tickTowerSlow(e,1.5);applyTowerSlow(e,.35,3);
 near(enemySlow(e).time,.5);tickTowerSlow(e,.5);assert.deepEqual(enemySlow(e),{amount:.35,time:2.5});tickTowerSlow(e,2.5);assert.deepEqual(enemySlow(e),{amount:0,time:0});assert.equal(e.towerSlows,undefined);
});
test('same strength refresh is bounded; expired strong entries never leak into new weak application',()=>{
 const e=enemy();applyTowerSlow(e,.7,2);tickTowerSlow(e,1);applyTowerSlow(e,.7,2);applyTowerSlow(e,.7,.3);assert.equal(e.towerSlows.length,1);near(enemySlow(e).time,2);tickTowerSlow(e,2);e.slowAmt=.9;e.slowT=-2;applyTowerSlow(e,.35,1.3);assert.equal(enemySlow(e).amount,.35);
});
test('legacy meteor overwrite/max refresh cannot absorb tower strength; HUD uses a pure shared read',()=>{
 const e=enemy();applyTowerSlow(e,.7,2);e.slowT=1.5;e.slowAmt=.45; // actual generic meteor writer
 assert.equal(enemySlow(e).amount,.7);tickTowerSlow(e,1);e.slowT=Math.max(e.slowT,3);e.slowAmt=Math.max(e.slowAmt,.4); // existing hero refresh
 assert.equal(e.slowAmt,.45);const before=JSON.stringify(e);const hud=bossDebuffs(e).find(x=>x.id==='slow');assert.equal(hud.detail,'70%');near(hud.time,1);assert.equal(JSON.stringify(e),before);
 tickTowerSlow(e,1);assert.equal(enemySlow(e).amount,.45);e.slowT=0;assert.deepEqual(enemySlow(e),{amount:0,time:0});
 e.slowT=3;e.slowAmt=.8;applyTowerSlow(e,.7,2);assert.equal(enemySlow(e).amount,.8);
});
function ai(e,flags={}){
 const G={enemies:[e],frameN:0,heroes:[],dungeon:!!flags.dungeon};
 const context=vm.createContext({THREE,G,STAGE:null,enemySlowAmount,tickTowerSlow,core:{position:{x:100,z:0}},hardTick:()=>!!flags.hard,abilityTick:()=>!!flags.ability,dgBossTick:()=>!!flags.dungeon,updAbilities(){},flashCh(){},emit(){},P:{},toTile:()=>[0,0],inGrid:()=>false,tileAt:()=>({t:0}),T:{CARVED:1},reachCore(){},removeEnemy(){},setEnemyShadows(){}});
 let source=fs.readFileSync('src/monsters/ai.js','utf8').replace(/^import .*;\s*$/gm,'').replace(/^export \{.*\};?\s*$/gm,'');
 vm.runInContext(source+';this.update=updEnemies;',context);return dt=>context.update(dt);
}
test('actual AI movement takes max, preserves spawn/stun pause and freeze duration',()=>{
 const e=enemy();applyTowerSlow(e,.7,2);e.slowT=3;e.slowAmt=.35;const update=ai(e);update(.5);near(e.g.position.x,.15);near(enemySlow(e).time,1.5);
 e.stunT=.4;e.frozen=true;update(.2);near(e.stunT,.2);near(enemySlow(e).time,1.5);update(.2);assert.equal(e.frozen,false);near(enemySlow(e).time,1.5);
 e.state='spawn';e.spawnT=1;update(.5);near(enemySlow(e).time,1.5);e.state='walk';update(1.5);assert.equal(enemySlow(e).amount,.35);near(e.slowT,1);
});
test('all existing AI decrement branches retain exact timing including legacy dungeon double tick',()=>{
 for(const flags of [{hard:true},{ability:true},{dungeon:true}]){const e=enemy();e.E.fly=false;e.E.ab={};e.E.dgBoss=true;e.slowT=3;e.slowAmt=.35;applyTowerSlow(e,.7,2);const update=ai(e,flags);update(.25);const elapsed=flags.dungeon?.5:.25;near(e.slowT,3-elapsed);near(enemySlow(e).time,2-elapsed);}
});
test('actual tower chain applies per-hop slow without altering damage or boss freeze',()=>{
 const src=fs.readFileSync('src/world/towers.js','utf8');const fn=src.slice(src.indexOf('function chainLightning('),src.indexOf('\nfunction bolt('));
 const e=enemy(),hits=[],ctx=vm.createContext({applyTowerSlow,G:{enemies:[e]},enemyAim:e=>e.g.position.clone(),bolt(){},hurt:(e,n)=>hits.push(n),emit(){},P:{},PB:{},ringFx(){},Snd:{play(){},crackle(){}}});vm.runInContext(fn+';this.chain=chainLightning;',ctx);
 const from=new THREE.Vector3(),S={falloff:.85,hop:3.8};ctx.chain(from,e,100,1,.7,{shots:4},S,{slowT:2,freezeEvery:4,freezeBoss:.4,freezeT:1.2});assert.equal(e.stunT,.4);assert.equal(e.frozen,true);ctx.chain(from,e,100,1,.35,{shots:1},S,null);assert.deepEqual(hits,[100,100]);assert.equal(enemySlow(e).amount,.7);assert.equal(e.slowT,0);assert.equal(e.slowAmt,0);
});
test('actual meteor AoE writer cannot overwrite frost; weak expired effects do not revive',()=>{
 const e=enemy();e.E.fly=false;applyTowerSlow(e,.7,2);
 const src=fs.readFileSync('src/combat/projectiles.js','utf8'),fn=src.slice(src.indexOf('function aoe('),src.indexOf('function clusterBombs('));
 const ctx=vm.createContext({G:{enemies:[e]},hurt(){}});vm.runInContext(fn+';this.aoe=aoe;',ctx);ctx.aoe(e.g.position,2,10,'white',{slow:true});
 assert.equal(e.slowAmt,.45);assert.equal(e.slowT,1.5);assert.equal(enemySlowAmount(e),.7);
 e.slowT-=1.5;tickTowerSlow(e,1.5);assert.equal(enemySlowAmount(e),.7);tickTowerSlow(e,.5);assert.equal(enemySlowAmount(e),0);
 applyTowerSlow(e,.35,1.3);applyTowerSlow(e,.7,2);tickTowerSlow(e,1.3);assert.equal(enemySlowAmount(e),.7);tickTowerSlow(e,.7);assert.equal(enemySlowAmount(e),0);
});
