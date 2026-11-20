import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/fighter-runtime.mjs';
const find=(f,mode)=>f.scene.children.find(g=>g.name==='pc-gear-pawstorm-'+mode);
for(const [mode,d] of [['melee',2],['ranged',6]])test(mode+' gear-only outline matches hit behavior and is reused',()=>{
 const simulate=(mobile)=>{
   const f=fixture(undefined,mobile),e=f.target(d);
   f.legend(e,{mode}); f.tick(.075);
   const cue=find(f,mode), geometry=cue?.children[0].geometry;
   if(cue)assert.equal(cue.children.length,3);
   if(cue&&mode==='melee') assert.equal(cue.position.z,e.g.position.z);
   f.tick(1.5); assert.equal(find(f,mode),undefined);
   f.legend(e,{mode});f.tick(.075);
   if(!mobile) assert.equal(find(f,mode)?.children[0].geometry,geometry);
   f.tick(1);
   return {count:f.hits.length,color:cue?.children[1].material.color.getHex()};
 };
 const desktop=simulate(false),mobile=simulate(true);
 assert.equal(desktop.count,12);assert.equal(desktop.count,mobile.count);
 assert.equal(desktop.color,0xffedf9);assert.equal(mobile.color,undefined);
});
