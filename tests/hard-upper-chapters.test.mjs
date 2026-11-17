import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as THREE from '../lib/three.module.js';
import * as H from '../src/data/hard.js';
import {CHAPTERS} from '../src/data/chapters/index.js';
import {ETYPES} from '../src/data/monsters.js';
const rules=['storm-ring','machine-grid','abyss-cross','citadel-seal'];
const old=execFileSync('git',['show','1d38bcb:src/data/hard.js'],{encoding:'utf8'}).replace(/from '([^']+)'/g,(_,p)=>`from '${new URL('../src/data/'+p,import.meta.url).href}'`);
const base=await import('data:text/javascript;base64,'+Buffer.from(old).toString('base64'));
test('H1-6 definitions/reward random calls and normal chapters unchanged',()=>{
 assert.deepEqual(H.HARD_CHAPTERS.slice(0,6),base.HARD_CHAPTERS);
 for(const s of Object.values(base.HARD_STAGES))for(const first of [false,true]){let a=0,b=0;assert.deepEqual(H.hardReward(s,s.waves,true,first,'mage',()=>((a++*19)%97)/97,null,2),base.hardReward(s,s.waves,true,first,'mage',()=>((b++*19)%97)/97,null,2));assert.equal(a,b);}
 for(let ch=7;ch<=10;ch++)for(let i=0;i<6;i++){const s=H.HARD_CHAPTERS[ch-1].stages[i],n=CHAPTERS[ch-1].stages[i];assert.equal(s.id,`hard-${ch}-${i+1}`);assert.equal(s.rule,rules[ch-7]);assert.equal(s.hp,Number((n.hp*2.05).toFixed(3)));for(const k of ['waves','core','spawns','q','seed','bed','walls','boss','enemyWeights','startGold'])assert.deepEqual(s[k],n[k]);}
});
test('new elite selection is bounded and excludes children, flyers, support-only enemies',()=>{
 for(let ch=7;ch<=10;ch++){const rule=rules[ch-7],pool=Object.keys(ETYPES).filter(k=>ETYPES[k].ch===ch),q=Array(4).fill(pool.length?pool:Object.keys(ETYPES)).flat();const f=H.eliteQueue(q,14,ETYPES,rule);assert.ok(f.filter(Boolean).length<=4);for(let i=0;i<q.length;i++)if(f[i]){const e=ETYPES[q[i]];assert.ok(!e.boss&&!e.child&&!e.fly&&e.dps>0);}}
});
test('native casts/recovery run without preemption and stun/death cancel hard casts',()=>{
 for(const rule of rules)for(const key of ['stormCast','machineCast','endCast','stormRecover','machineRecover','endRecover']){const e={g:{position:{x:0,z:0}},hardCd:0,[key]:1};assert.equal(H.pulseStep(e,.1,{x:1,z:1},true,rule),null);delete e[key];assert.equal(H.pulseStep(e,.1,{x:1,z:1},true,rule).kind,'warn');e.stunT=1;assert.equal(H.pulseStep(e,.1,{x:1,z:1},true,rule),null);assert.equal(e.hardCast,null);}
 for(const rule of rules){const e={g:{position:{x:0,z:0}},hardCd:0};const p={x:2,z:3};H.pulseStep(e,.1,p,true,rule);p.x=8;assert.equal(e.hardCast.p.x,['storm-ring','citadel-seal'].includes(rule)?0:2);assert.equal(H.pulseStep(e,2.1,p,true,rule).kind,'hit');assert.equal(H.pulseStep(e,1.5,p,true,rule).follow,true);e.dead=true;H.pulseStep(e,.1,p,true,rule);assert.equal(e.hardCast,null);}
});
test('new visible footprints agree with collision and dispose after cancellation',()=>{
 for(const rule of rules)for(const follow of [false,true]){
  const event={kind:'warn',rule,from:{x:0,z:0},p:{x:4,z:3},follow},G={fxs:[]},scene=new THREE.Scene(),owner={hardCast:{}};
  const ctx=vm.createContext({THREE,G,scene,...H});vm.runInContext(fs.readFileSync(new URL('../src/monsters/hard.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','')+';this.warn=chapterWarning;',ctx);ctx.warn(event,owner);scene.updateMatrixWorld(true);
  const shape=H.hardShape(event);assert.equal(H.hardHit(event,event.p),shape.kind!=='annulus');assert.equal(H.hardHit(event,{x:100,z:100}),false);
  for(const f of G.fxs.filter(f=>!f.kind.endsWith('edge'))){assert.equal(f.m.material.depthTest,false);assert.equal(f.live(),true);const positions=f.m.geometry.attributes.position;for(let i=0;i<positions.count;i++){const v=new THREE.Vector3().fromBufferAttribute(positions,i);if(shape.kind==='annulus'){const len=Math.hypot(v.x,v.y);v.multiplyScalar((shape.inner+(shape.outer-shape.inner)*.5)/len);}else v.multiplyScalar(.99);v.applyMatrix4(f.m.matrixWorld);assert.equal(H.hardHit(event,v),true,`${rule}/${follow}/${i}`);}}
  owner.hardCast=null;assert.ok(G.fxs.every(f=>!f.live()));let disposed=0;for(const f of G.fxs)f.m.geometry.addEventListener('dispose',()=>disposed++);const count=G.fxs.length;const fx=fs.readFileSync(new URL('../src/render/vfx.js',import.meta.url),'utf8');vm.runInContext(fx.slice(fx.indexOf('function updFx('),fx.indexOf('export {',fx.indexOf('function updFx(')))+';this.fx=updFx;',ctx);ctx.fx(.01);assert.equal(G.fxs.length,0);assert.equal(scene.children.length,0);assert.equal(disposed,count);
 }
});

test('skill-only minibosses never pause for a zero-damage hard attack',()=>{
 for(const rule of rules){const ctx=vm.createContext({THREE,G:{},STAGE:{hard:true,rule},...H});vm.runInContext(fs.readFileSync(new URL('../src/monsters/hard.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','')+';this.tick=hardTick;',ctx);assert.equal(ctx.tick({E:{boss:true,dps:0}},.1),false);}
});
