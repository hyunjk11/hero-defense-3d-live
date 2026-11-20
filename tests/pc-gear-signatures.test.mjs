import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/advance-e-runtime.mjs';

const signatures=f=>f.scene.children.filter(g=>g.name==='pc-gear-signature');
for (const [h,key] of [['archer','pierce'],['warrior','quake'],['mage','meteorstorm']]) {
 test(key+' has a bounded PC-only visual and identical damage/status on mobile',()=>{
   const launch=mobile=>{
     const f=fixture(h,null,50,null,null,mobile);
     f.hero.lsk=key;
     const t=f.target(1,4), other=f.target(1.5,4);
     f.api.legendProc(t);
     return {f,t,other};
   };
   const {f,t,other}=launch(false), m=launch(true);
   const [cue]=signatures(f);
   assert.equal(cue.userData.gearSignature,key);
   assert.equal(cue.children.length,3);
   assert.equal(signatures(m.f).length,0);
   assert.deepEqual([t.hp,t.slowAmt,t.slowT,other.hp],[m.t.hp,m.t.slowAmt,m.t.slowT,m.other.hp]);
   for(let i=0;i<60;i++){f.hero.licd=0;f.api.legendProc(t);}
   assert.ok(signatures(f).length<=12);
   f.G.screen='town';f.tick(.05);
   assert.equal(signatures(f).length,0);
 });
}
