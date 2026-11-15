import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/advance-e-runtime.mjs';
import {createHellfireBurn} from '../src/data/hellfire-burn.js';
import {ADV_E,eDescription} from '../src/data/hero-e.js';
import {treeESkill} from '../src/data/skill-tree.js';
import {bossDebuffs} from '../src/ui/boss-debuffs.js';
const cast=f=>f.api.castLegend(new f.THREE.Vector3(0,0,2));
const total=f=>f.hits.reduce((a,h)=>a+h.loss,0);
test('actual dispatch: ground, air and bosses receive 2700 direct + 450 nonstacked burn; radius 4.2',()=>{
 for(const E of [{},{fly:true},{boss:true},{fly:true,boss:true}]){
  const f=fixture(),e=f.target(4.19,2,E),out=f.target(4.21,2,E);cast(f);f.tick(6);
  assert.equal(10000-e.hp,3150);assert.equal(out.hp,10000);assert(!e.hellfireBurn);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);
 }
});
test('one hit then leave keeps exactly two seconds of burn (650 total); reentry refresh does not reset tick',()=>{
 const f=fixture(),e=f.target();cast(f);f.tick(.61);e.g.position.x=20;f.tick(3);assert.equal(total(f),650);assert(!e.hellfireBurn);
 const b=createHellfireBurn({}),x={};b.add(x,0,100,2);b.step(.4,()=>{});b.add(x,.4,100,2);let damage=0;b.step(.5,(_,d)=>damage+=d);assert.equal(damage,50);assert.equal(x.hellfireBurn.until,2.4);
});
test('same and different casts cannot stack brands; strongest active wins, no tick reset exploit',()=>{
 const a=createHellfireBurn({}),b=createHellfireBurn({}),e={};let damage=0;
 a.add(e,0,100,2);b.add(e,.1,50,2);assert.equal(e.hellfireBurn.dps,100);assert.equal(b.size,0);
 b.add(e,.2,120,2);a.step(.5,(_,d)=>damage+=d);b.step(.5,(_,d)=>damage+=d);assert.equal(damage,60);assert.equal(a.size,0);
 a.clear();assert(e.hellfireBurn);b.clear();assert(!e.hellfireBurn);
});
test('death, town, map, warp and owner removal clean already-burning targets without extra damage',()=>{
 for(const k of ['death','town','map','warp','remove']){
  const f=fixture(),e=f.target();cast(f);f.tick(1.2);assert(e.hellfireBurn);const before=total(f);
  if(k==='death')f.hero.dead=1;if(k==='town')f.G.screen='town';if(k==='map')f.G.tiles=[];if(k==='warp')f.hero.warpT=1;if(k==='remove'){f.G.heroes=[];f.G.hero=null;}
  f.tick(4);assert.equal(total(f),before);assert(!e.hellfireBurn);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);
 }
});
test('dead targets drop burn; armor remains in normal damage pipeline; large dt has bounded exact ticks',()=>{
 const b=createHellfireBurn({}),e={};let n=0;b.add(e,0,100,2);b.step(20,()=>n++);assert.equal(n,4);assert.equal(b.size,0);
 const f=fixture(),x=f.target(0,2,{armor:.5});cast(f);f.tick(6);assert.equal(total(f),1575);
 const g=fixture(),z=g.target();z.hp=500;cast(g);g.tick(6);assert(z.dead);assert.equal(total(g),500);assert(!z.hellfireBurn);
});
test('tree multiplier applies equally to pulse and burn; tooltip and boss timer use actual values',()=>{
 for(const [m,want] of [[{eMul:.88,eRadius:1.2},2772],[{eMul:1.2,eRadius:.8},3780]]){
  const f=fixture();f.hero.treeMods=m;f.target();cast(f);f.tick(6);assert(Math.abs(total(f)-want)<1e-7);
  const s=treeESkill(ADV_E.mage.flame,m);assert(eDescription(s).includes(`초당 ${m.eMul*100}%`));assert(!eDescription(s).includes('undefined'));
 }
 const f=fixture(),e=f.target(0,2,{boss:true});cast(f);f.tick(.7);const d=bossDebuffs(e,f.G.t).find(x=>x.id==='hellfire');assert(d.time>1.8&&d.time<=2);assert(d.detail.includes('100'));f.tick(6);assert.equal(bossDebuffs(e,f.G.t).length,0);
});
test('100 targets and forced recasts remain bounded and dispose all transient marks',()=>{
 const f=fixture();for(let i=0;i<100;i++)f.target();for(let i=0;i<6;i++){f.hero.lcd=0;cast(f);f.tick(.7);}f.tick(8);
 assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);assert(f.G.enemies.every(e=>!e.hellfireBurn));
});

test('removed but non-dead enemy receives no lingering damage',()=>{
 const f=fixture(),e=f.target();cast(f);f.tick(.7);const before=total(f);f.G.enemies.length=0;f.tick(6);assert.equal(total(f),before);assert(!e.hellfireBurn);
});
