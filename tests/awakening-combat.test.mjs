import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/advance-e-runtime.mjs';
import { awakeningESpec } from '../src/heroes/awakening-e.js';
import { awakeningMods } from '../src/data/awakening.js';
import { legendShape } from '../src/core/autoskill.js';
import { absorbEShield,eSkillFor,eDescription } from '../src/data/hero-e.js';
test('Lv0 uses awakened names, identical base cooldown/key and no stat increase; opted out restores original E',()=>{
 assert.deepEqual(awakeningMods(0),{dmg:1,hp:1});assert.deepEqual(awakeningMods(50),{dmg:1.3,hp:1.2});
 for(const [cls,b,name] of [['warrior','paladin','쌍성 방벽'],['mage','frost','빙결 수렴'],['fighter','dragon','묘왕파']]){
  const s=eSkillFor(cls,50,b),a=awakeningESpec({awakeningLevel:0},s);
  assert.equal(eDescription(a),name);assert.equal(a.key,s.key);assert.equal(a.cd,s.cd);
  assert.equal(awakeningESpec({awakeningLevel:null},s),s);
  assert.equal(awakeningESpec({awakeningLevel:50,awakeningUseE:false},s),s);
  if(b==='dragon')assert.equal(legendShape(a).w,1.65);
 }
});
for(const mobile of [false,true]) {
 const mode=mobile?'mobile':'desktop';
 const setup=(hero,branch)=>fixture(hero,branch,50,null,null,mobile);
 test(mode+' actual Paladin shares nearest living hero only, not core; ally shield cleans on map exit',()=>{
  const f=setup('warrior','paladin');f.hero.awakeningLevel=0;
  const makeAlly=(x,extras={})=>{const g=new f.THREE.Group();g.position.x=x;f.scene.add(g);return {g,hp:100,max:100,dead:0,ch:{},...extras};};
  const ally=makeAlly(2),far=makeAlly(5),dead=makeAlly(.5,{hp:0}),core=makeAlly(1,{ch:null});f.G.heroes.push(far,dead,core,ally);
  assert.ok(f.api.castLegend());assert.equal(f.api.castLegend(),false);
  f.tick(.36);assert.equal(ally.eShield.value,35);assert.equal(far.eShield,undefined);assert.equal(core.eShield,undefined);
  assert.equal(absorbEShield(f.hero,9999,f.G.t)>0,true);f.tick(.1);assert.equal(ally.eShield.value,35);
  f.G.tiles=[];f.tick(.1);assert.equal(ally.eShield,null);assert.equal(f.FX.length,0);
 });
 test(mode+' actual Frost closes ice with original field damage and original boss freeze',()=>{
  function run(awake){
   const f=setup('mage','frost');if(awake)f.hero.awakeningLevel=0;
   const boss=f.target(0,2,{boss:true});assert.ok(f.api.castLegend(boss.g.position));f.tick(4.28);
   const ring=f.scene.children.find(o=>o.userData.awakening==='frost')?.children.find(o=>o.material?.color?.getHex()===0xd2f9ff);
   if(awake){assert.ok(ring?.visible);assert.ok(ring.scale.x<1);}
   f.tick(.5);assert.equal(f.FX.length,0);
   return {hp:boss.hp,stun:boss.stunT,frozen:boss.frozen,hits:f.hits.length};
  }
  const frost=run(true);assert.deepEqual(frost,run(false));assert.equal(frost.stun,.2);
 });
 test(mode+' actual Dragon releases a straight wave for eight unique hits, including air, without moving caster',()=>{
  const f=setup('fighter','dragon');f.hero.awakeningLevel=0;
  const behind=f.target(-.75,0),off=f.target(3,2),air=f.target(1,.5,{fly:true}),line=Array.from({length:10},(_,i)=>f.target(2+i,.4));
  assert.ok(f.api.castLegend(new f.THREE.Vector3(12,0,0)));f.tick(1.5);
  assert.equal(f.FX.length,0);assert.deepEqual(f.hero.g.position.toArray(),[0,0,0]);
  assert.deepEqual(f.hits.map(hit=>hit.target),[air.id,...line.slice(0,7).map(e=>e.id)]);
  assert.equal(behind.hp,10000);assert.equal(off.hp,10000);
 });
}
test('Aura is a child, below warning and hidden on death, result and town',()=>{
 const f=fixture('mage','frost');f.hero.awakeningLevel=0;
 const ring=f.hero.awakeningAura=f.aura.addAwakeningAura(f.hero.g,'frost');
 f.aura.updateAwakeningAura(f.hero,f.G);assert.equal(ring.visible,true);
 assert.equal(ring.parent,f.hero.g);assert.ok(ring.children.every(m=>m.renderOrder<20));
 f.hero.dead=1;f.aura.updateAwakeningAura(f.hero,f.G);assert.equal(ring.visible,false);
 f.hero.dead=0;f.G.phase='over';f.aura.updateAwakeningAura(f.hero,f.G);assert.equal(ring.visible,false);
 f.G.phase='build';f.G.screen='town';f.aura.updateAwakeningAura(f.hero,f.G);assert.equal(ring.visible,false);
});
