import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './support/advance-e-runtime.mjs';
import {ADV_E,HERO_E,eSkillFor,eDescription,grantEShield,absorbEShield} from '../src/data/hero-e.js';
import {treeOptions,changeTree,treeBuild,treeMods,treeESkill,cleanTrees,basicTreeMul,treeSkillUsed} from '../src/data/skill-tree.js';
import {legendShape,autoTarget,skillBusy} from '../src/core/autoskill.js';
const branches=Object.entries(ADV_E).flatMap(([h,bs])=>Object.keys(bs).map(b=>[h,b]));
const choices=(h,b,tier,id)=>treeMods(treeBuild(changeTree({},h,b,50,0,tier,id),h,b,50));
const damage=f=>f.hits.reduce((n,x)=>n+x.loss,0);
const cast=f=>f.api.castLegend(new f.THREE.Vector3(0,0,2));

for(const [h,b] of branches)test(`${h}/${b}: actual E dispatch, armor, ticks, cooldown, no equipment proc`,()=>{
 const f=fixture(h,b),e=f.target(0,2,{armor:.2}),s=ADV_E[h][b];
 assert.equal(f.api.legendActive().key,s.key);assert.equal(cast(f),true);assert.equal(cast(f),false);assert.equal(f.hero.lcd,s.cd);
 f.tick(8);const count=s.kind==='fan'?1:(s.ticks||1),want=100*s.mul*count*.8;
 assert.ok(Math.abs(damage(f)-want)<1e-6,`${damage(f)} != ${want}`);assert.equal(f.hits.length,count);assert.equal(f.hero.licd,0);assert.deepEqual(Object.keys(f.G.legendN),[]);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);
});

test('all Lv30 choices and all 320 saved combinations resolve finite branch effects without changing preset IDs',()=>{
 for(const [h,b] of branches){
  for(let bits=0;bits<32;bits++){let raw={};for(const [i,tier] of [15,20,30,40,50].entries())raw=changeTree(raw,h,b,50,0,tier,treeOptions(h,b,tier)[bits>>i&1].id);assert.deepEqual(cleanTrees(JSON.parse(JSON.stringify(raw))),raw);const m=treeMods(treeBuild(raw,h,b,50)),s=treeESkill(ADV_E[h][b],m);assert.ok(eDescription(s));assert.ok(Number.isFinite(s.mul)&&s.mul>0);assert.ok(m.eCd>=.7);}
  for(const o of treeOptions(h,b,30)){const f=fixture(h,b),e=f.target(0,2,{armor:.2});f.hero.treeMods=choices(h,b,30,o.id);cast(f);f.tick(.4);if(b==='paladin')assert.equal(f.hero.eShield.value,1000*.35*(o.eShield||1));f.tick(8);const want=100*ADV_E[h][b].mul*(ADV_E[h][b].kind==='fan'?1:(ADV_E[h][b].ticks||1))*.8*(o.eMul||1);assert.ok(Math.abs(damage(f)-want)<1e-6,`${b}/${o.id} ${damage(f)}/${want}`);}
 }
});

test('Lv9/10 gates and unadvanced E remain independent of gear; reclassing drops old branch effect',()=>{
 for(const [h,b] of branches){assert.equal(eSkillFor(h,9,b),null);assert.equal(eSkillFor(h,10,b),ADV_E[h][b]);assert.ok(Object.values(HERO_E).includes(eSkillFor(h,10,null)));const f=fixture(h,b,9);assert.equal(cast(f),false);assert.equal(f.FX.length,0);f.hero.C.level=10;assert.equal(cast(f),true);f.hero.adv=null;assert.ok(Object.values(HERO_E).includes(f.api.legendActive()));}
});

test('shield absorbs after armor, expires, replaces without healing, caps amount and duration',()=>{
 const f=fixture('warrior','paladin');cast(f);f.tick(.4);assert.equal(f.hero.hp,600);assert.equal(absorbEShield(f.hero,200,f.G.t),0);assert.equal(f.hero.eShield.value,150);assert.equal(absorbEShield(f.hero,250,f.G.t),100);assert.equal(f.hero.eShield??null,null);
 const s={...ADV_E.warrior.paladin,shieldMul:20,durationMul:20};grantEShield(f.hero,s,10);assert.equal(f.hero.eShield.value,500);assert.equal(f.hero.eShield.until,18);absorbEShield(f.hero,100,11);grantEShield(f.hero,ADV_E.warrior.paladin,12);assert.equal(f.hero.eShield.value,350);assert.equal(f.hero.hp,600);assert.equal(absorbEShield(f.hero,100,18),100);assert.equal(f.hero.eShield??null,null);
});

test('ground-only, air, boss CC, target death and no recursive proc',()=>{
 for(const [h,b] of branches){const f=fixture(h,b),s=ADV_E[h][b],e=f.target(0,2,{fly:true,boss:true});cast(f);f.tick(5);assert.equal(damage(f)>0,!s.ground);if(b==='frost'){assert.equal(e.slowAmt,.2);assert.equal(e.stunT,.2);}}
 const f=fixture('mage','frost');f.hero.treeMods={eCC:99};const e=f.target(0,2,{boss:true});cast(f);f.tick(5);assert.equal(e.stunT,.25);
 const d=fixture('gunner','duel'),a=d.target(),b=d.target(0,2.5);a.hp=1;cast(d);d.tick(3);assert.equal(a.dead,true);assert.ok(b.hp<10000);assert.equal(d.hits.length,6);
});

test('range/target caps, one fan hit per enemy and first-hit sniper',()=>{
 for(const b of ['hawk','thorn']){const h=b==='hawk'?'archer':'gunner',f=fixture(h,b),a=f.target(0,2),behind=f.target(0,4);cast(f);f.tick(3);assert.ok(a.hp<10000);assert.equal(behind.hp,10000);}
 const f=fixture('fighter','dragon'),en=[2,4,6,8].map(z=>f.target(0,z)),far=f.target(0,18.1),side=f.target(5,3);cast(f);f.tick(3);assert.deepEqual(en.map(e=>10000-e.hp),[300,300,300,0]);assert.equal(far.hp,10000);assert.equal(side.hp,10000);
 const a=fixture('archer','wind'),near=a.target(0,.5);cast(a);a.tick(3);assert.equal(a.hits.length,1);
});

test('each effect cancels before damage on death, warp, new map, town and removed hero; no retained geometry/material',()=>{
 for(const [h,b] of branches)for(const kind of ['death','warp','map','town','remove']){
  const f=fixture(h,b);f.target();cast(f);const gs=new Set(),ms=new Set(),count=new Map();f.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});for(const x of [...gs,...ms])x.addEventListener('dispose',()=>count.set(x,(count.get(x)||0)+1));
  if(kind==='death')f.hero.dead=5;if(kind==='warp')f.hero.warpT=1;if(kind==='map')f.G.tiles=[];if(kind==='town')f.G.screen='town';if(kind==='remove'){f.G.heroes=[];f.G.hero=null;}
  f.tick(1);assert.equal(damage(f),0);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);assert.equal(f.hero.eShield??null,null);for(const x of [...gs,...ms])assert.equal(count.get(x),1,`${h}/${b}/${kind}`);
 }
});

test('20 repeated casts per branch clean transient effects and enforce cast busy',()=>{
 for(const [h,b] of branches){const f=fixture(h,b);for(let i=0;i<20;i++){f.hero.lcd=0;assert.equal(cast(f),true);assert.ok(skillBusy(f.hero));f.tick(9);assert.equal(f.scene.children.length,1);assert.equal(f.FX.length,0);assert.equal(f.hero.eShield??null,null);}}
});

test('dragon Lv50 ranged pursuit preserves stored ID and boosts ranged only during window',()=>{
 const h={treeMods:choices('fighter','dragon',50,'pursuit')},target={E:{}};treeSkillUsed(h,'e',10);assert.equal(basicTreeMul(h,target,'ranged',15.9),1.25);assert.equal(basicTreeMul(h,target,'melee',15.9),.92);assert.equal(basicTreeMul(h,target,'ranged',16),1);
});

test('auto aim uses branch and tree-adjusted reach, cones aim at targets instead of self',()=>{
 const s=treeESkill(ADV_E.fighter.dragon,{eReach:.75,eRadius:1.2}),shape=legendShape(s);assert.equal(shape.reach,13.5);assert.equal(shape.w,1.2);
 const cone=legendShape(ADV_E.fighter.tiger),t=autoTarget(cone,{x:0,z:0,dmg:10},[{x:2,z:0,hp:100,max:100,boss:true}]);assert.equal(t.x,2);
});
