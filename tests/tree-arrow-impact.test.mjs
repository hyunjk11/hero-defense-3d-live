import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as THREE from '../lib/three.module.js';
import {ADV} from '../src/data/advance.js';import * as T from '../src/data/skill-tree.js';
const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8'),strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'');
function fixture(branch,{pierce=false,finish=true,crit=false,line=false}={}){
 const hits=[],no=()=>{},G={t:10,ups:{atk:0,spd:0,rng:0,skill:0},enemies:[],fxs:[],projs:[],mK:0},scene=new THREE.Scene();let trees={},rolls=0;
 if(pierce)trees=T.changeTree(trees,'archer',branch,50,0,15,'pierce');if(finish||line)trees=T.changeTree(trees,'archer',branch,50,0,50,line?'line':'finish');
 const hero={cls:'archer',C:{dmg:100,range:10,cd:10},eq:{crit:crit?100:0},g:new THREE.Group(),adv:ADV.archer[branch],treeMods:T.treeMods(T.treeBuild(trees,'archer',branch,50)),hp:1000,max:1000,dead:0};G.curHero=hero;
 const target=(id,hp=1000,z=3,armor=0,x=0)=>{const e={id,hp,max:1000,E:{armor},g:new THREE.Group(),dead:false};e.g.position.set(x,0,z);G.enemies.push(e);return e;};
 const toon=vm.createContext({THREE,scene,mergeVertices:g=>g});vm.runInContext(strip(read('render/toon.js'))+';this.api={glow,shareGeo,shareMat,disposeOwned}',toon);
 const projectile=vm.createContext({THREE,G,scene,...toon.api,rand:()=>.5,emit:no,debris:no,ringFx:no,later:no,P:{},PB:{},Q:{},Snd:{play:no},enemyAim:e=>e.g.position.clone(),hurt:(e,d,_c,_b,_src,ap)=>{const loss=d*(ap?1:1-e.E.armor);e.hp-=loss;hits.push({id:e.id,d:loss,ap:!!ap,kind:_src?.kind==='ranged'?'arrow':'pierce'});if(e.hp<=0)e.dead=true;}});
 vm.runInContext(strip(read('combat/projectiles.js'))+';this.api={shoot,makeArrow,updProjs}',projectile);
 const math=Object.assign(Object.create(Math),{random:()=>{rolls++;return 0;}});
 const env=vm.createContext({THREE,G,hero,scene,...T,Math:math,advAtkMul:()=>1,dgm:()=>({dmg:1,crit:0,critD:0,rate:1,range:1,cd:1}),heroTip:()=>hero.g.position.clone(),Snd:{play:no},...projectile.api,alive:()=>G.enemies.filter(e=>!e.dead),d2:(e,x,z)=>(e.g.position.x-x)**2+(e.g.position.z-z)**2,cnt:no});
 const src=read('heroes/hero.js'),adv=read('heroes/advfx.js');vm.runInContext(src.slice(src.indexOf('const stat ='),src.indexOf('function spawnHero'))+'\n'+adv.slice(adv.indexOf('export function advArrow'),adv.indexOf('// 루나:')).replace('export function','function')+'\n'+adv.slice(adv.indexOf('function treePierce('))+'\n'+src.slice(src.indexOf('function attack('),src.indexOf('export { heroHud'))+';this.attack=attack;',env);
 const drain=()=>{for(let i=0;i<200&&G.projs.length;i++){G.t+=.01;projectile.api.updProjs(.01);}assert.equal(G.projs.length,0);assert.equal(scene.children.length,0);};
 return {G,hero,hits,target,fire:env.attack,drain,rolls:()=>rolls};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('actual basic → advancement → arrow/pierce uses each hit target HP with armor and both branches',()=>{
 for(const branch of ['wind','hawk'])for(const pierce of [false,true])for(const finish of [false,true])for(const hp of [[350,1000],[1000,350]])for(const armor of [0,.5]){
  const f=fixture(branch,{pierce,finish}),a=f.target('a',hp[0],3,armor),b=f.target('b',hp[1],5,armor);f.fire(a);f.drain();
  const base=100*(pierce?.92:1),factor=h=>finish?(h<=350?1.25:.96):1;
  near(hp[0]-a.hp,base*factor(hp[0])*(branch==='hawk'?1:1-armor));
  // When wind's extra arrow hits before a later piercing arrow, its own damage
  // can cross the HP threshold. Each individual hit must observe that moment.
  let remaining=hp[1],expected=0;for(const hit of f.hits.filter(h=>h.id==='b')){const k=hit.kind==='arrow'?.7:.45;const loss=base*factor(remaining)*k*(1-armor);near(hit.d,loss);remaining-=loss;expected+=loss;}
  const count=(branch==='wind'?1:0)+(pierce?1:0);assert.equal(f.hits.filter(h=>h.id==='b').length,count);near(hp[1]-b.hp,expected);
 }
});
test('HP crossing after firing is evaluated at impact, crit rolled once and no dead-target pierce',()=>{
 for(const [before,after] of [[1000,350],[350,1000]]){const f=fixture('wind',{crit:true}),a=f.target('a',before),b=f.target('b',before,5);f.fire(a);a.hp=b.hp=after;f.drain();near(after-a.hp,150*(after<=350?1.25:.96));near(after-b.hp,105*(after<=350?1.25:.96));assert.equal(f.rolls(),1);}
 const f=fixture('hawk',{pierce:true}),a=f.target('a',350),b=f.target('b',350,5);f.fire(a);a.dead=true;f.drain();assert.deepEqual(f.hits,[]);assert.equal(b.hp,350);
});
test('actual arrow additions retain original range and cap, with no repeated targets or recursion',()=>{
 for(const line of [false,true]){const f=fixture('hawk',{pierce:true,finish:!line,line}),a=f.target('a',350),b=f.target('b',1000,5),c=f.target('c',350,7),d=f.target('outside',1000,11);f.fire(a);f.drain();assert.equal(f.hits.filter(h=>h.id==='a').length,1);assert.equal(f.hits.filter(h=>h.id==='b').length,1);assert.equal(f.hits.filter(h=>h.id==='c').length,line?1:0);assert.equal(d.hp,1000);}
});
