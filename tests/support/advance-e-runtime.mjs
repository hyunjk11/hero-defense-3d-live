import { awakeningESpec, awakeningCatHits, AWAKENING_CAT_LIMIT, shareAwakeningShield } from '../../src/heroes/awakening-e.js';
import {createWeaponFeed} from '../../src/ui/weapon-proc-feed.js';
import {createHellfireBurn} from '../../src/data/hellfire-burn.js';
import {abyssalStrike} from '../../src/data/abyssal-set.js';
import {ABYSSAL_PROC} from '../../src/data/boss-sets.js';
import { skillAllowed } from '../../src/data/hard-party.js';
import {treeESkill,treeCooldown,treeSkillUsed} from '../../src/data/skill-tree.js';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../lib/three.module.js';
import { LSK } from '../../src/account/equip.js';
import {ARTILLERY,artilleryTargets,equipProc} from '../../src/data/gear-proc-pc.js';
import { eSkillFor, eKeyFor, grantEShield } from '../../src/data/hero-e.js';
import { procTargets } from '../../src/data/legend-procs.js';
import {catFlight,stepCatFlight} from '../../src/data/cat-flight.js';
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const cueContext=vm.createContext({THREE});
vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/skill-cues.js',import.meta.url),'utf8'))+';this.create=createSkillCues;',cueContext);
export const createSkillCues=cueContext.create;
const emblemContext=vm.createContext({THREE});
vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/gear-emblems.js',import.meta.url),'utf8'))+';this.create=createGearEmblems;',emblemContext);
const createGearEmblems=emblemContext.create;
export function fixture(cls='mage',branch='flame',level=50,advanceSource=null,legendSource=null,mobileApp=false) {
  const no=()=>{},G={t:0,phase:'wave',enemies:[],fxs:[],legendForce:true},scene=new THREE.Scene(),hits=[],casts=[],timers=[];
  const hero={cls,C:{level},eq:{},lsk:null,adv:{k:branch},max:1000,hp:600,atkT:0,licd:0,lcd:0,dead:0,face:0,g:new THREE.Group(),ch:{acts:{}},path:[]};
  scene.add(hero.g);G.hero=hero;G.heroes=[hero];G.tiles=[];G.screen='game';const FX=[];
  const artilleryFx={mark:no,strike:no,update:no,clear:no};
  const env=vm.createContext({mobileApp,awakeningESpec,ARTILLERY,artilleryTargets,equipProc,createGearArtilleryFx:()=>artilleryFx,abyssalStrike,ABYSSAL_PROC,skillAllowed,THREE,G,hero,scene,LSK,eSkillFor,eKeyFor,procTargets,treeESkill,treeCooldown,treeSkillUsed,QS:{get:()=>null},mulberry32:()=>()=>.1,addEventListener:no,
    heroFx:()=>FX,asSkill:(f,...args)=>f(...args),later:(time,f)=>timers.push({time,f}),
    stat:{dmg:()=>100,skillMul:()=>1,range:()=>10},heroTip:()=>hero.g.position.clone(),mouseGround:new THREE.Vector3(),passAt:()=>true,groundY:()=>0,
    hurt0:(e,d)=>{if(e.dead)return;const loss=Math.min(e.hp,d*(1-(e.E.armor||0)));e.hp-=loss;hits.push({target:e.id,loss});if(e.hp<=0)e.dead=true;},
    glow:c=>new THREE.MeshBasicMaterial({color:c}),disposeOwned:o=>o.traverse(n=>{n.geometry?.dispose();n.material?.dispose();}),
    makeArrow:()=>new THREE.Group(),P:{},PB:{},emit:no,ringFx:no,debris:no,play:()=>true,banner:no,Snd:{play:no,whoosh:no,gun:no},
    ricochet:no,overdrill:no,pawstorm:no,pawCanProc:(t,a)=>!!t&&!t.dead&&(!t.E.fly||a?.mode==='ranged'),
    rosebarrage:s=>casts.push(s.key),gigahammer:s=>casts.push(s.key),tigerdash:s=>casts.push(s.key),updGun:no,updateKnockback:no,updMechFx:no,updFtFx:no,gunFlash:no});
  const toon=vm.createContext({THREE,scene,mergeVertices:g=>g});
  vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/toon.js',import.meta.url),'utf8')).replace(/^export \{.*$/gm,'')+';this.dispose=disposeOwned;',toon);
  const cats=vm.createContext({THREE});vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/cat-spirit.js',import.meta.url),'utf8'))+';this.api={createCatSpirit,animateCatSpirit};',cats);
  const aura=vm.createContext({THREE});
  vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/awakening-aura.js',import.meta.url),'utf8'))+';this.api={addAwakeningAura,updateAwakeningAura,pulseAwakeningAura};',aura);
  const adv=vm.createContext({mobileApp,...aura.api,awakeningCatHits,AWAKENING_CAT_LIMIT,shareAwakeningShield,createHellfireBurn,createSkillCues,THREE,G,hero,scene,catFlight,stepCatFlight,...cats.api,disposeOwned:toon.dispose,groundY:()=>0,hurt:env.hurt0,grantEShield,stat:env.stat,play:env.play,Snd:env.Snd,banner:no,knock:(e,x,z,d)=>{e.knock=d;}});
  vm.runInContext(strip(advanceSource??fs.readFileSync(new URL('../../src/heroes/advance-e.js',import.meta.url),'utf8'))+';this.cast=castAdvanceE;this.cues=typeof skillCues===\'undefined\'?null:skillCues;',adv);env.castAdvanceE=adv.cast;
  const feed=createWeaponFeed(),rows=[],root={ownerDocument:{createElement:()=>({remove(){const i=rows.indexOf(this);if(i>=0)rows.splice(i,1);}})},appendChild:n=>rows.push(n)};
  Object.assign(env,{weaponProcFeed:feed,document:{getElementById:()=>root},performance:{now:()=>G.t*1000}});
  const lf=vm.createContext({THREE,mobileApp,weaponProcFeed:feed,document:{getElementById:()=>root},performance:{now:()=>G.t*1000},createSkillCues,createGearEmblems,scene,G,groundY:()=>0,Snd:env.Snd});
  vm.runInContext(strip(fs.readFileSync(new URL('../../src/render/legend-feedback.js',import.meta.url),'utf8'))+';this.feedback=legendFeedback;this.pool=pool;',lf);env.legendFeedback=lf.feedback;
  const path=new URL('../../src/heroes/legend.js',import.meta.url);
  vm.runInContext(strip(legendSource??fs.readFileSync(path,'utf8'))+'\nthis.api={legendProc,legendActive,legendCd,castLegend,updLegend,updLegendHero,updLeap};',env);
  const target=(x=0,z=2,extra={})=>{const e={id:G.enemies.length,g:new THREE.Group(),E:{armor:0,...extra},hp:10000,max:10000,stunT:0,slowT:0,dead:false};e.g.position.set(x,0,z);G.enemies.push(e);return e;};
  const tick=(seconds,dt=.01)=>{for(let i=0;i<Math.ceil(seconds/dt);i++){G.t+=dt;for(let j=timers.length-1;j>=0;j--){timers[j].time-=dt;if(timers[j].time<=0){const t=timers.splice(j,1)[0];t.f();}}env.api.updLegend(dt);if(hero.leap)env.api.updLeap(dt);}};
  return {aura:aura.api,feed,rows,legendCues:lf.pool,cues:adv.cues,G,hero,scene,hits,env,casts,timers,FX,api:env.api,artilleryFx,target,tick,THREE};
}
