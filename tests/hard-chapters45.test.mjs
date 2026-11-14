import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {HARD_CHAPTERS,HARD_STAGES,hardUnlocked,hardXP,hardReward,eliteQueue,hardEnemy,pulseStep,hardHit,hardDirection,hardShape} from '../src/data/hard.js';
import {STAGES,nextStage} from '../src/data/stages.js';import {ETYPES} from '../src/data/monsters.js';
import {MemoryStore} from '../server/memory-store.mjs';import {execute} from '../server/operations.mjs';import * as P from '../src/account/progress.js';import * as H from '../src/data/hero-growth.js';
import * as E from '../src/account/equip.js';

test('hard4 preserves all six layouts, start gold and stage-specific roster identity',()=>{
 const stages=HARD_CHAPTERS.slice(3,4).flatMap(c=>c.stages);assert.equal(stages.length,6);
 for(const s of stages){const normal=STAGES[s.normalId];for(const k of ['waves','core','spawns','q','bed','seed','walls','startGold','boss'])assert.deepEqual(s[k],normal[k],s.id+':'+k);}
 const save={st:{'10-6':3},growth:{hard:{st:{'hard-3-4':1}}}};
 for(const s of stages){assert.equal(hardUnlocked(save,s.id),true);save.growth.hard.st[s.id]=1;}
 assert.equal(nextStage(save,'hard-3-4'),'hard-4-1');assert.equal(nextStage(save,'hard-4-4'),'hard-5-1');assert.ok(HARD_STAGES['hard-5-1']);assert.equal(hardUnlocked(save,'hard-5-1'),true);assert.equal(hardUnlocked(save,'hard-6-1'),false);
});

test('annulus has safe inner/outer zones; cross has diagonal safe zones and exact inclusive borders',()=>{
 const ring={rule:'ruin-ring',p:{x:10,z:-5}};
 for(const [x,z,hit]of [[0,0,false],[2.99,0,false],[3,0,true],[7,0,true],[7.01,0,false]])assert.equal(hardHit(ring,{x:x+10,z:z-5}),hit);
 assert.equal(hardHit({...ring,follow:true},{x:12.5,z:-5}),true);assert.equal(hardHit({...ring,follow:true},{x:16.5,z:-5}),false);
 const cross={rule:'spore-cross',p:{x:0,z:0}};
 for(const [x,z,hit]of [[0,0,true],[1,6,true],[1.01,6,false],[6,1,true],[6.01,0,false],[2,2,false]])assert.equal(hardHit(cross,{x,z}),hit);
 assert.equal(hardHit({...cross,follow:true},{x:3,z:3}),true);assert.equal(hardHit({...cross,follow:true},{x:4,z:0}),false);
});

test('new casts snapshot direction/center, defer to native abilities and bound boss follow-ups',()=>{
 for(const rule of ['ruin-ring','spore-cross']){
  const e={g:{position:{x:0,z:0}},hardCd:0},target={x:5,z:0};
  for(const block of ['swampCast','statueT','phaseT']){e[block]=1;assert.equal(pulseStep(e,.1,target,true,rule),null);delete e[block];}
  const a=pulseStep(e,.1,target,true,rule);assert.equal(a.follow,false);const saved=structuredClone(a.p);target.x=9;e.g.position.x=2;
  assert.equal(pulseStep(e,hardShape(a).dur-.01,target,true,rule),null);const h=pulseStep(e,.02,target,true,rule);assert.deepEqual(h.p,saved);assert.equal(h.follow,false);
  const b=pulseStep(e,1.5,target,true,rule);assert.equal(b.follow,true);pulseStep(e,hardShape(b).dur+.01,target,true,rule);assert.equal(e.hardFollow,false);assert.equal(e.hardCd,10);
  e.hardCd=0;pulseStep(e,.01,target,true,rule);e.stunT=.2;pulseStep(e,.1,target,true,rule);assert.equal(e.hardCast,null);assert.equal(e.hardFollow,false);
 }
});

function runtime(rule){
 const scene=new THREE.Scene(),G={heroes:[],fxs:[],enemies:[],t:0},hits=[];
 const hero={g:new THREE.Group(),dead:0,hp:1000};hero.g.position.x=5;G.hero=hero;
 const env=vm.createContext({THREE,scene,G,STAGE:{hard:true,rule},hardEnemy,pulseStep,hardHit,hardDirection,hardShape,ringFx:()=>{throw Error('new shape must render its own footprint');},heroDamage:(n,h)=>{h.hp-=n;hits.push(n);}});
 const source=fs.readFileSync(new URL('../src/monsters/hard.js',import.meta.url),'utf8').replace(/^import .*;.*$/gm,'').replace(/export /g,'');
 const vfx=fs.readFileSync(new URL('../src/render/vfx.js',import.meta.url),'utf8');const fx=vfx.slice(vfx.indexOf('function updFx('),vfx.indexOf('\nexport {',vfx.indexOf('function updFx(')));
 vm.runInContext(source+fx+';this.api={hardTick,updFx}',env);
 const e={E:hardEnemy(ETYPES.grunt,true,false,0,1.15),g:new THREE.Group(),hardCd:0};return{scene,G,hero,e,hits,...env.api};
}
test('actual runtime damages inside, allows movement and stun, never multiplies cross intersection damage',()=>{
 for(const rule of ['ruin-ring','spore-cross'])for(const mode of ['hit','move','stun']){
  const f=runtime(rule);f.hardTick(f.e,.01);assert.equal(f.hits.length,0);
  if(mode==='move')f.hero.g.position.set(rule==='ruin-ring'?0:7,0,rule==='ruin-ring'?0:2);
  if(mode==='stun')f.e.stunT=.5;
  f.hardTick(f.e,2);assert.equal(f.hits.length,mode==='hit'?1:0);if(mode==='hit')assert.equal(f.hits[0],ETYPES.grunt.dps*1.15*1.2);
 }
});
test('actual overlay geometry matches projected hit footprint; cancel/death/return disposes each owned mesh once',()=>{
 for(const rule of ['ruin-ring','spore-cross']){
  const f=runtime(rule);let disposed=0,created=0;
  for(let i=0;i<30;i++){
   Object.assign(f.e,{hardCd:0,hardCast:null,dead:false,dying:undefined,stunT:0});f.hardTick(f.e,.01);
   const cast={...f.e.hardCast};for(const fx of f.G.fxs){created++;fx.m.geometry.addEventListener('dispose',()=>disposed++);assert.equal(fx.m.material.depthTest,false);fx.m.updateMatrixWorld();
    const q=new THREE.Vector3(rule==='ruin-ring'?4:0,0,0).applyMatrix4(fx.m.matrixWorld);assert.equal(hardHit(cast,q),true);
   }
   if(i%3===0){f.e.stunT=.1;f.hardTick(f.e,.01);f.updFx(.01);}else if(i%3===1){f.e.dead=true;f.updFx(.01);}else f.updFx(2);
   assert.equal(f.G.fxs.length,0);assert.equal(f.scene.children.length,0);
  }assert.equal(disposed,created);assert.equal(created,rule==='ruin-ring'?30:60);
 }
});

test('both rendered cross arms and boss rotation match their near/far side collision boundaries',()=>{
 for(const rule of ['ruin-ring','spore-cross'])for(const follow of [false,true]){
  const f=runtime(rule);f.e.E.boss=true;f.e.hardFollow=follow;f.hardTick(f.e,.01);const event={...f.e.hardCast},shape=hardShape(event);
  for(const fx of f.G.fxs){const m=fx.m;m.updateMatrixWorld();
   const probes=shape.kind==='annulus'?[[shape.inner+.001,0,true],[shape.outer-.001,0,true],[shape.inner-.001,0,false],[shape.outer+.001,0,false]]:[[.999,5.999,true],[1.001,5.999,false],[.999,6.001,false],[-.999,-5.999,true],[-1.001,-5.999,false]];
   for(const [x,y,hit]of probes)assert.equal(hardHit(event,new THREE.Vector3(x,y,0).applyMatrix4(m.matrixWorld)),hit,JSON.stringify({rule,follow,x,y}));
  }f.updFx(2);assert.equal(f.scene.children.length,0);
 }
});

test('new elite lists respect wave/active caps; summoned guards and larvae never mint gold',()=>{
 for(const rule of ['ruin-ring','spore-cross'])for(let wave=1;wave<=20;wave++){
  const q=Array.from({length:100},(_,i)=>['gargoyle','shield','swamp_runner','swamp_beetle','swamp_spitter','boss_swamp','swamp_larva','ruin_guard'][i%8]);
  const marks=eliteQueue(q,wave,ETYPES,rule);assert.ok(marks.filter(Boolean).length<=4);for(let i=0;i<q.length;i++)if(marks[i]){assert.ok(!ETYPES[q[i]].child&&!ETYPES[q[i]].boss);for(let j=i+1;j<Math.min(i+5,q.length);j++)assert.equal(marks[j],false);}
 }
 for(const type of ['ruin_guard','swamp_larva']){const e=hardEnemy(ETYPES[type],true,true,0,1.15);assert.equal(e.gold,0);assert.equal(e.hardElite,false);assert.equal(e.hardSummoned,true);}
 assert.equal(hardEnemy(ETYPES.gargoyle,true,false,2,1.15).hardElite,false);
});

test('all six new stages settle first/repeat/partial rewards once under concurrent replay and stale clients',async()=>{
 const user={id:'hard45-qa',email:'hard45@example.invalid'},now=Date.parse('2026-10-30T00:00:00Z');let clock=now;
 const save={...P.empty(),st:{'10-6':3},souls:1000},wallet={...H.initialGrowth(save),user_id:user.id,hard:{version:1,st:{'hard-3-4':1}}};
 const store=new MemoryStore({hd3d_progress:[{user_id:user.id,data:save,merged:true,updated_at:new Date(now).toISOString()}],hd3d_growth_wallet:[wallet]});
 const rpc=(n,a)=>store.transaction(tx=>execute(tx,user,{kind:'rpc',name:'hd3d_growth_'+n,args:a},{now:clock})).then(r=>r.data);
 for(const s of HARD_CHAPTERS.slice(3,4).flatMap(c=>c.stages))for(const [tag,n,win]of [['first',s.waves,true],['repeat',s.waves,true],['retreat',5,false]]){
  const id='h45-'+s.id+'-'+tag,before=structuredClone(store.tables),start=await rpc('start',{p_id:id,p_mode:'campaign',p_stage:s.id,p_hero:'mage'});assert.equal(start.ok,true);clock+=120000;
  const args={p_token:id,p_completed:n,p_win:win,p_finish:true,p_stars:2,p_kills:17};const out=await Promise.all([rpc('progress',args),rpc('progress',args)]);
  for(const r of out){assert.equal(r.ok,true);assert.equal(r.xp,hardXP(s,n,win,tag==='first'));assert.equal(r.hardSaved,true);}
  const row=store.tables.hd3d_progress[0],old=before.hd3d_progress[0];assert.equal(row.data.souls-old.data.souls,hardReward(s,n,win,tag==='first','mage').souls);assert.equal(row.data.stats.kills-old.data.stats.kills,17);assert.equal(row.data.hardRewardSeq,(old.data.hardRewardSeq||0)+1);
  const chests=row.data.chests.slice(old.data.chests.length);assert.equal(chests.length,Math.floor(n/5)+(tag==='first'?1:tag==='repeat'?2:0));
   if(tag==='first')assert.equal(chests.at(-1).it.g,3,'first-clear bonus remains epic after concurrent settlement');
  const [opened,result]=E.openChests({...P.empty(),chests:structuredClone(chests)});assert.equal(result.opened.length,chests.length);assert.equal(opened.inv.length,chests.length);
  for(const [index,item] of opened.inv.entries()){assert.equal(item.c,s.ch);assert.ok(E.SLOT_KEYS.includes(item.s));assert.equal(item.h,item.s==='weapon'?'mage':undefined);assert.ok((tag==='repeat'&&index>=Math.floor(n/5)?[0,1,2]:E.obtainableGrades(s.ch)).includes(item.g));assert.ok(item.n&&item.id);assert.ok(P.codexBits(opened,s.ch,item.s==='weapon'?item.h:item.s)&(1<<item.g));}
  assert.deepEqual(P.clean(opened).inv,opened.inv);const [again,duplicate]=E.openChests(opened);assert.equal(duplicate.opened.length,0);assert.deepEqual(again.inv,opened.inv);
  const committed=structuredClone(store.tables);await rpc('progress',args);assert.deepEqual(store.tables,committed);
  const stale={...row.data,souls:0,hardRewardSeq:0};const rejected=await store.transaction(tx=>execute(tx,user,{kind:'query',table:'hd3d_progress',action:'update',filters:{user_id:user.id,updated_at:row.updated_at},values:{data:stale,merged:true},returning:true},{now:clock}));assert.deepEqual(rejected.data,[]);assert.deepEqual(store.tables,committed);
  assert.deepEqual(row.data.st,{'10-6':3});
 }
 assert.equal((await rpc('start',{p_id:'hard6-hidden',p_mode:'campaign',p_stage:'hard-6-1',p_hero:'mage'})).reason,'locked');
});

test('server refuses skipped chapter boundaries and separates the other account without changing existing assets',async()=>{
 const now=1793318400000,a={id:'boundary-a'},b={id:'boundary-b'},save={...P.empty(),st:{'10-6':3},souls:4321};
 save.nick='unchanged';save.mat={steel:77,crystal:8};save.adv.mage={b:'frost',n:1};
 const store=new MemoryStore({hd3d_progress:[a,b].map(u=>({user_id:u.id,data:structuredClone(save),merged:true,updated_at:new Date(now).toISOString()})),hd3d_growth_wallet:[a,b].map(u=>({...H.initialGrowth(save),user_id:u.id,hard:{version:1,st:{'hard-3-6':3}}}))});
 const start=(u,stage,id)=>store.transaction(tx=>execute(tx,u,{kind:'rpc',name:'hd3d_growth_start',args:{p_id:'boundary-'+id,p_mode:'campaign',p_stage:stage,p_hero:'mage'}},{now})).then(r=>r.data);
 assert.equal((await start(a,'hard-4-1','locked4')).reason,'locked');
 store.tables.hd3d_growth_wallet.find(w=>w.user_id===a.id).hard.st['hard-3-4']=1;
 assert.equal((await start(a,'hard-4-1','open4')).ok,true);assert.equal((await start(b,'hard-4-1','other4')).reason,'locked');
 assert.equal((await start(a,'hard-5-1','locked5')).reason,'locked');
 store.tables.hd3d_growth_wallet.find(w=>w.user_id===a.id).hard.st['hard-4-4']=1;
 assert.equal((await start(a,'hard-5-1','open5')).ok,true);assert.equal((await start(a,'hard-5-6','skip5')).reason,'locked');
 for(const row of store.tables.hd3d_progress)assert.deepEqual(row.data,save);
});
