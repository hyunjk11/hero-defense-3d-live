import { skillAllowed } from '../../src/data/hard-party.js';
import {treeESkill,treeCooldown,treeSkillUsed} from '../../src/data/skill-tree.js';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../lib/three.module.js';
import { LSK } from '../../src/account/equip.js';
import { eSkillFor, eKeyFor } from '../../src/data/hero-e.js';
import { procTargets } from '../../src/data/legend-procs.js';
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
export function fixture(cls='mage',level=10,lsk=null,baseline=false) {
  const no=()=>{},G={t:0,phase:'wave',enemies:[],fxs:[],legendForce:true},scene=new THREE.Scene(),hits=[],casts=[],timers=[];
  const hero={cls,C:{level},eq:{},lsk,licd:0,lcd:0,dead:0,face:0,g:new THREE.Group(),ch:{acts:{}},path:[]};
  const FX=[];
  const env=vm.createContext({skillAllowed,THREE,G,hero,scene,LSK,eSkillFor,eKeyFor,procTargets,treeESkill,treeCooldown,treeSkillUsed,QS:{get:()=>null},mulberry32:()=>()=>.1,addEventListener:no,
    heroFx:()=>FX,asSkill:(f,...args)=>f(...args),later:(time,f)=>timers.push({time,f}),
    stat:{dmg:()=>100,skillMul:()=>1,range:()=>10},heroTip:()=>hero.g.position.clone(),mouseGround:new THREE.Vector3(),passAt:()=>true,groundY:()=>0,
    hurt0:(e,d)=>{if(e.dead)return;const loss=Math.min(e.hp,d*(1-(e.E.armor||0)));e.hp-=loss;hits.push({target:e.id,loss});if(e.hp<=0)e.dead=true;},
    glow:c=>new THREE.MeshBasicMaterial({color:c}),disposeOwned:o=>o.traverse(n=>{n.geometry?.dispose();n.material?.dispose();}),
    makeArrow:()=>new THREE.Group(),P:{},PB:{},emit:no,ringFx:no,debris:no,play:()=>true,banner:no,Snd:{play:no,whoosh:no},
    ricochet:no,overdrill:no,pawstorm:no,pawCanProc:(t,a)=>!!t&&!t.dead&&(!t.E.fly||a?.mode==='ranged'),
    rosebarrage:s=>casts.push(s.key),gigahammer:s=>casts.push(s.key),tigerdash:s=>casts.push(s.key),updGun:no,updMechFx:no,updFtFx:no,gunFlash:no});
  const path=baseline?new URL('../../../candidate-fighter-visuals/src/heroes/legend.js',import.meta.url):new URL('../../src/heroes/legend.js',import.meta.url);
  vm.runInContext(strip(fs.readFileSync(path,'utf8'))+'\nthis.api={legendProc,legendActive,legendCd,castLegend,updLegend,updLegendHero,updLeap};',env);
  const target=(x=0,z=2,extra={})=>{const e={id:G.enemies.length,g:new THREE.Group(),E:{armor:0,...extra},hp:10000,max:10000,stunT:0,slowT:0,dead:false};e.g.position.set(x,0,z);G.enemies.push(e);return e;};
  const tick=(seconds,dt=.01)=>{for(let i=0;i<Math.ceil(seconds/dt);i++){G.t+=dt;for(let j=timers.length-1;j>=0;j--){timers[j].time-=dt;if(timers[j].time<=0){const t=timers.splice(j,1)[0];t.f();}}env.api.updLegend(dt);if(hero.leap)env.api.updLeap(dt);}};
  return {G,hero,scene,hits,casts,timers,FX,api:env.api,target,tick,THREE};
}
