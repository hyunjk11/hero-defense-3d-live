import test from 'node:test';import assert from 'node:assert/strict';
import {validPartner,setHold,clearOrders,movementAllowed,skillAllowed} from '../src/data/hard-party.js';
import {ADV} from '../src/data/advance.js';
test('hold clears orders, preserves HP/cooldowns/death, and release permits new navigation',()=>{
 const h={cls:'fighter',C:{level:10},path:[1],aiGoal:{x:1},aiTgt:{},hp:12,skillCd:5,lcd:7,dead:3};setHold(h,true);assert.equal(movementAllowed(h),false);assert.deepEqual(h.path,[]);assert.equal(h.aiTgt,null);assert.deepEqual([h.hp,h.skillCd,h.lcd,h.dead],[12,5,7,3]);setHold(h,false);assert.equal(movementAllowed(h),true);assert.equal(h.aiT,0);
});
test('hold blocks relocating base Q/E but preserves stationary branch and projectile skills',()=>{
 for(const cls of ['archer','mage','warrior','gunner','fighter'])for(const adv of [null,...Object.values(ADV[cls])]){
  const h={cls,adv,C:{level:30},hardHold:true};assert.equal(skillAllowed(h,'Q'),!(cls==='fighter'&&!adv));assert.equal(skillAllowed(h,'E'),!(['warrior','fighter'].includes(cls)&&!adv));h.hardHold=false;assert.equal(skillAllowed(h,'Q'),true);assert.equal(skillAllowed(h,'E'),true);
 }
});
test('distinct public heroes only; duplicate/hidden/invalid choices rejected',()=>{
 assert.equal(validPartner('mage','warrior'),true);for(const h of ['mage','mechanic',null,{},'unknown'])assert.equal(validPartner('mage',h),false);clearOrders(null);
});
