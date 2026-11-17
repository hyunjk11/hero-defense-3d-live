import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
import {HARD_CHAPTERS,HARD_STAGES,hardUnlocked,hardXP,hardReward,eliteQueue,hardEnemy,pulseStep,hardHit,hardDirection,cleanHard} from '../src/data/hard.js';
import {STAGES,nextStage} from '../src/data/stages.js';import {ETYPES} from '../src/data/monsters.js';
import {MemoryStore} from '../server/memory-store.mjs';import {execute} from '../server/operations.mjs';import * as P from '../src/account/progress.js';import * as H from '../src/data/hero-growth.js';
test('released hard order follows stable normal IDs and unlocks across chapter boundaries only',()=>{
 const ids=HARD_CHAPTERS.flatMap(c=>c.stages.map(s=>s.id));assert.equal(ids.length,60);assert.equal(ids[11],'hard-2-4');assert.equal(ids[17],'hard-3-4');
 const s={st:{'10-6':3},growth:{hard:{st:{}}}};for(let i=0;i<ids.length;i++){assert.equal(hardUnlocked(s,ids[i]),true);if(ids[i+1])assert.equal(hardUnlocked(s,ids[i+1]),false);s.growth.hard.st[ids[i]]=1;assert.equal(nextStage(s,ids[i]),ids[i+1]||null);}
 assert.equal(hardUnlocked(s,'hard-11-1'),false);assert.deepEqual(cleanHard({st:{'hard-11-1':3}}).st,{});
 for(const id of ids){const a=HARD_STAGES[id],b=STAGES[a.normalId];for(const k of ['waves','spawns','core','lava','walls','q','bed','seed','boss'])assert.deepEqual(a[k],b[k]);}
});
test('fixed ice line and ash circle allow dodge and stun; boss followup has no endless chain',()=>{
 for(const rule of ['ice-fracture','ash-eruption']){
  const e={g:{position:{x:0,z:0}},hardCd:0},p={x:4,z:4};const warn=pulseStep(e,.01,p,true,rule);p.x=7;
  const hit=pulseStep(e,2,p,true,rule);assert.equal(hit.p.x,4);assert.equal(hardHit(hit,{x:4,z:4}),true);assert.equal(hardHit(hit,{x:8,z:0}),false);
  assert.equal(pulseStep(e,1.5,p,true,rule).kind,'warn');pulseStep(e,2,p,true,rule);assert.equal(e.hardFollow,false);assert.equal(e.hardCd,10);
  e.hardCd=0;pulseStep(e,.1,p,false,rule);e.stunT=.1;assert.equal(pulseStep(e,10,p,false,rule),null);assert.equal(e.hardCast,null);
 }
});
test('coincident ice caster and hero never turns the line into map-wide damage',()=>{
 const event={rule:'ice-fracture',from:{x:2,z:2},p:{x:2,z:2}};
 assert.equal(hardHit(event,{x:200,z:200}),false);assert.equal(hardHit(event,{x:2,z:7}),true);assert.equal(hardHit(event,{x:5,z:7}),false);
});
test('ice warning plane matches the damage line for diagonal and cardinal directions and is owned',()=>{
 const source=fs.readFileSync(new URL('../src/monsters/hard.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/export /g,'');
 for(const [x,z]of [[1,0],[0,1],[1,1],[-1,1],[1,-1],[0,0]]){
  const scene=new THREE.Scene(),G={fxs:[]};const env=vm.createContext({THREE,scene,G,hardDirection});vm.runInContext(source+';this.warning=warning',env);
  const e={rule:'ice-fracture',from:{x:0,z:0},p:{x,z}};env.warning(e);assert.equal(scene.children.length,1);const m=G.fxs[0].m;m.updateMatrixWorld();
  const center=new THREE.Vector3(0,0,0).applyMatrix4(m.matrixWorld);assert.ok(hardHit(e,center));const end=new THREE.Vector3(0,4.99,0).applyMatrix4(m.matrixWorld);assert.ok(hardHit(e,end));
  assert.equal(m.geometry.type,'PlaneGeometry');assert.equal(m.material.depthTest,false);assert.equal(m.renderOrder,20);let disposed=0;m.geometry.addEventListener('dispose',()=>disposed++);m.geometry.dispose();m.material.dispose();m.removeFromParent();assert.equal(disposed,1);assert.equal(scene.children.length,0);
 }
});
test('new elite selection replaces enemies with bounded spacing; summons and boss cannot become elites',()=>{
 for(const rule of ['ice-fracture','ash-eruption'])for(let wave=1;wave<=15;wave++){
  const q=Array.from({length:65},(_,i)=>i%7===0?'boss_snow':i%3?'icewolf':'lavahound');const marks=eliteQueue(q,wave,ETYPES,rule),idx=marks.flatMap((x,i)=>x?[i]:[]);assert.ok(idx.length<=4);for(const i of idx){assert.ok(!ETYPES[q[i]].boss);for(const j of idx)if(i!==j)assert.ok(Math.abs(i-j)>=5);}
  assert.equal(hardEnemy(ETYPES.icewolf,true,true,0).hardElite,false);assert.equal(hardEnemy(ETYPES.icewolf,true,false,2).hardElite,false);
 }
});
test('new warning mesh expires through actual updFx exactly once over 20 cycles',()=>{
 const scene=new THREE.Scene(),G={fxs:[]},source=fs.readFileSync(new URL('../src/monsters/hard.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/export /g,'');
 const vfx=fs.readFileSync(new URL('../src/render/vfx.js',import.meta.url),'utf8');const upd=vfx.slice(vfx.indexOf('function updFx('),vfx.indexOf('\nexport {',vfx.indexOf('function updFx(')));
 const env=vm.createContext({THREE,scene,G,hardDirection});vm.runInContext(source+upd+';this.api={warning,updFx}',env);let geo=0,mat=0;
 for(const rule of ['ice-fracture','ash-eruption'])for(let i=0;i<20;i++){env.api.warning({rule,from:{x:0,z:0},p:{x:3,z:4}});const m=G.fxs[0].m;assert.equal(m.material.depthTest,false);if(rule==='ash-eruption'){assert.equal(m.geometry.parameters.outerRadius,3.6);assert.equal(m.position.x,3);assert.equal(m.position.z,4);}m.geometry.addEventListener('dispose',()=>geo++);m.material.addEventListener('dispose',()=>mat++);env.api.updFx(1.4);env.api.updFx(1.4);assert.equal(G.fxs.length,0);assert.equal(scene.children.length,0);}
 assert.equal(geo,40);assert.equal(mat,40);
});
test('all 12 new stages use the atomic receipt, kills, first/repeat reward and server unlock path',async()=>{
 const now=1793270000000,user={id:'hard23-qa',email:'hard23@example.invalid'},save={...P.empty(),st:{'10-6':3},souls:1000},w={...H.initialGrowth(save),user_id:user.id,hard:{version:1,st:{'hard-1-6':1}}};
 const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,merged:true,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[w]});let clock=now;
 const rpc=(n,a)=>store.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_growth_'+n,args:a},{now:clock})).then(r=>r.data);
 let expected=1000,kills=0;
 for(const s of HARD_CHAPTERS.slice(1,3).flatMap(c=>c.stages)){
  const id='slice2-'+s.id;assert.equal((await rpc('start',{p_id:id,p_mode:'campaign',p_stage:s.id,p_hero:'mage'})).ok,true);clock+=60000;
  const args={p_token:id,p_completed:s.waves,p_win:true,p_finish:true,p_stars:2,p_kills:77};const rs=await Promise.all([rpc('progress',args),rpc('progress',args)]);
  for(const r of rs){assert.equal(r.ok,true);assert.equal(r.hardSaved,true);assert.equal(r.xp,hardXP(s,s.waves,true,true));}
  expected+=hardReward(s,s.waves,true,true,'mage').souls;kills+=77;const data=store.tables.hd3d_progress[0].data;assert.equal(data.souls,expected);assert.equal(data.stats.kills,kills);assert.deepEqual(data.st,{'10-6':3});
  const snapshot=structuredClone(store.tables);await rpc('progress',args);assert.deepEqual(store.tables,snapshot);
 }
 assert.equal(store.tables.hd3d_progress[0].data.hardRewardSeq,12);assert.equal((await rpc('start',{p_id:'slice2-unreleased-seven',p_mode:'campaign',p_stage:'hard-11-1',p_hero:'mage'})).reason,'locked');
});
