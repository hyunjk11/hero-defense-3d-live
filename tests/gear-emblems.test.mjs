import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/advance-e-runtime.mjs';

function proc(cls,key,{mobile=false}={}){
  const f=fixture(cls,null,50,null,null,mobile);
  f.hero.lsk=key;
  const target=f.target(2,5);
  const other=f.target(3,5.1);
  f.api.legendProc(target,{mode:'melee'});
  return {f,target,other};
}
const tiger='pc-gear-tiger-spirit',rose='pc-gear-rose-bloom';
test('tiger pounces into the hit point without moving the hero or adding hits',()=>{
  const {f,target}=proc('fighter','tigerdash');
  const spirit=f.scene.getObjectByName(tiger);
  assert.ok(spirit?.children.every(mesh=>mesh.isInstancedMesh));
  const start=spirit.position.clone();
  const hits=f.hits.length;
  f.tick(.19);
  assert.ok(spirit.position.distanceTo(target.g.position)<start.distanceTo(target.g.position));
  assert.ok(spirit.position.y>start.y);
  f.tick(.13);
  const noseLocal=new f.THREE.Vector3(0,0,1.35);
  const nose=spirit.localToWorld(noseLocal);
  assert.ok(Math.hypot(nose.x-2,nose.z-5)<.15);
  assert.deepEqual(f.hero.g.position.toArray(),[0,0,0]);
  assert.equal(f.hits.length,hits);
  f.tick(.13);
  assert.equal(f.scene.getObjectByName(tiger),undefined);
});
test('rose bloom is anchored to the original primary hit and is visual only',()=>{
  const {f,target,other}=proc('gunner','rosebarrage');
  const effect=f.scene.getObjectByName(rose),[shot,bud,flower]=effect.children;
  assert.deepEqual(f.hits.map(({target})=>target),[0]);
  assert.ok(target.slowT>0);
  assert.equal(other.slowT,0);
  assert.equal(bud.visible,true);
  target.g.position.set(4,0,7);
  f.tick(.06);
  assert.equal(shot.visible,true);
  assert.equal(flower.visible,false);
  f.tick(.16);
  assert.equal(shot.visible,false);
  assert.equal(flower.visible,true);
  assert.equal(flower.position.x,2);
  assert.equal(flower.position.z,5);
  f.G.screen='town';f.tick(.01);
  assert.equal(f.scene.getObjectByName(rose),undefined);
  assert.equal(f.hits.length,1);
});
test('mobile retains previous cues and hits without creating either own emblem',()=>{
  for(const [cls,key,id] of [['gunner','rosebarrage',rose],['fighter','tigerdash',tiger]]){
    const {f}=proc(cls,key,{mobile:true});
    assert.ok(f.legendCues.active()>0);
    assert.ok(f.hits.length>0);
    assert.equal(f.scene.getObjectByName(id),undefined);
  }
});
test('forced overlapping emblems cap at four instances and clean up after a map change',()=>{
  for(const [cls,key,id] of [['gunner','rosebarrage',rose],['fighter','tigerdash',tiger]]){
    const {f,target}=proc(cls,key);
    for(let i=0;i<14;i++){f.hero.licd=0;f.api.legendProc(target,{mode:'melee'});}
    assert.equal(f.scene.children.filter(g=>g.name===id).length,4);
    f.G.tiles=[];f.tick(.01);
    assert.equal(f.scene.getObjectByName(id),undefined);
    assert.equal(f.FX.length,0);
  }
});
