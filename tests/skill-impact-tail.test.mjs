import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three.module.js';
import {fixture,createSkillCues} from './support/advance-e-runtime.mjs';

for(const [cls,branch] of [['archer','hawk'],['gunner','thorn']])
 for(const distance of [5,15,20,23]) for(const fps of [30,60])
 test(`${branch}: ${distance} range at ${fps}fps retains impact after final projectile`,()=>{
  const f=fixture(cls,branch),dt=1/fps;
  f.target(0,distance);assert.equal(f.api.castLegend(new THREE.Vector3(0,0,distance)),true);
  let frames=0;
  while(!f.hits.length&&frames++<fps*3)f.tick(dt,dt);
  assert.equal(f.hits.length,1,'hit occurs once');
  assert.ok(f.cues.active()>0,'impact survives its creation frame');
  assert.ok(f.FX.length>0,'owner remains until its presentation tail expires');
  for(let i=0;i<Math.floor(.25*fps);i++)f.tick(dt,dt);
  assert.ok(f.cues.active()>0,'impact retains its intended lifetime');
  f.tick(1,dt);
  assert.equal(f.hits.length,1,'retaining presentation never adds damage');
  assert.equal(f.cues.active(),0);assert.equal(f.FX.length,0);
 });
test('owner tail does not wait on unrelated effects',()=>{
 const pool=createSkillCues(new THREE.Scene()),a={},b={};
 pool.show(a,'impact',{x:0,y:0,z:0},0xffffff,1,.28);
 pool.show(b,'impact',{x:0,y:0,z:0},0xffffff,1,2);
 pool.update(a,.3);assert.equal(pool.has(a),false);assert.equal(pool.has(b),true);
 pool.clear(a);assert.equal(pool.has(b),true);pool.clear(b);assert.equal(pool.active(),0);pool.dispose();
});
