import test from 'node:test';import assert from 'node:assert/strict';
import {fixture as basic} from './support/tree-fighter-runtime.mjs';
import {fixture as q} from './support/tree-q-runtime.mjs';
import {changeTree,treeBuild} from '../src/data/skill-tree.js';
const build=(branch,tier,choice)=>treeBuild(changeTree({},'fighter',branch,20,0,tier,choice),'fighter',branch,20);
test('actual fighter hit bodies apply close/far tradeoff once; proc damage stays independent',()=>{
 for(const branch of ['tiger','dragon'])for(const z of [2,6])for(const choice of ['close','far']){
  const run=tree=>{const f=basic(branch,tree);f.hero.lsk=null;f.target(z);f.attack(3);return f.hits.reduce((s,h)=>s+h.d,0);};
  const before=run(null),after=run(build(branch,15,choice)),ratio=(choice==='close')===(z===2)?1.15:.92;assert.ok(before>0);assert.ok(Math.abs(after-before*ratio)<1e-7,`${branch} ${z} ${choice}: ${before} ${after}`);
  const f=basic(branch,build(branch,15,choice)),t=f.target(z);f.legend(t,{mode:z===2?'melee':'ranged'});f.tick(2);assert.ok(Math.abs(f.hits.reduce((s,h)=>s+h.d,0)-270)<1e-7);
 }
});
test('actual tiger/dragon Q keeps targeting, damage tradeoff, expiry and twenty-cycle cleanup',()=>{
 for(const branch of ['tiger','dragon'])for(const choice of ['wide','dense']){
  const f=q(branch,build(branch,20,choice)),t=f.target(3),far=f.target(40);f.cast();f.tick(5);
  const want=(branch==='tiger'?700:500)*(choice==='wide'?.9:1.2);assert.ok(Math.abs(100000-t.hp-want)<1e-7);assert.equal(far.hp,100000);assert.equal(f.scene.children.length,0);
  for(let i=0;i<20;i++){f.cast();f.tick(5);assert.equal(f.api.FX.length,0);assert.equal(f.G.timers.length,0);assert.equal(f.scene.children.length,0);}
 }
});
