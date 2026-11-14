// Executes the product fighter/legend bodies with real Three objects. No account,
// network or browser storage. Rendering/audio/AI are inert; hits retain armor.
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../lib/three.module.js';
import * as F from '../../src/data/fighter.js';
import { LSK } from '../../src/account/equip.js';
import {treeMods,basicTreeMul} from '../../src/data/skill-tree.js';
import { ADV } from '../../src/data/advance.js';
const read=f=>fs.readFileSync(new URL('../../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
export function fixture(branch,tree=null) {
  const no=()=>{}, scene=new THREE.Scene(), hits=[], animations=[], random={value:.1,draws:0};
  const G={t:0,phase:'wave',timers:[],enemies:[],fxs:[],legendForce:true,stats:{},mK:0};
  const hero={cls:'fighter',g:new THREE.Group(),face:0,dead:0,cd:0,atkT:0,licd:0,lcd:0,lsk:'pawstorm',path:[],C:{atkSpd:1,rate:2.08},hp:760,max:760,adv:branch?ADV.fighter[branch]:null,ch:{root:new THREE.Group(),acts:{PalmS:{},PunchCombo:{}}}};
  hero.tree=tree;hero.treeMods=treeMods(tree);G.hero=G.curHero=hero;
  const state=vm.createContext({legendFeedback:()=>{},window:{G},QS:{has:()=>false}});
  // Keep the actual owner/timer wrappers without the application's global object.
  vm.runInContext('const G=window.G;'+read('core/state.js').slice(read('core/state.js').indexOf('const later =')).replace(/export \{.*;/,'' )+'\nthis.api={later,runTimer,heroFx,asSkill};',state);
  const toon=vm.createContext({legendFeedback:()=>{},THREE,scene,mergeVertices:g=>g});
  vm.runInContext(strip(read('render/toon.js'))+'\nthis.api={toon,disposeOwned};',toon);
  const env=vm.createContext({legendFeedback:()=>{},THREE,G,scene,camera:new THREE.PerspectiveCamera(),...F,...state.api,...toon.api,hero,Q:{},P:{},PB:{},
    stat:{dmg:(_focus,target,mode)=>100*(mode?basicTreeMul(hero,target,mode,G.t):1),range:()=>2.6,rate:()=>2.08,skillMul:()=>1},
    play:(_ch,name)=>{animations.push(name);return true;},groundY:()=>0,passAt:()=>true,
    banner:no,emit:no,debris:no,ringFx:no,knock:no,Snd:{play:no,whoosh:no},
    hurt0:(e,d,_c,_big,src)=>{if(e.dead)return;const loss=d*(1-(e.E.armor||0));e.hp-=loss;hits.push({e,d:loss,kind:src?.kind,skill:G.mK});if(e.hp<=0)e.dead=true;},
    legendProc:(...a)=>legend.legendProc(...a)});
  vm.runInContext(strip(read('heroes/fighter.js'))+'\nthis.api={fighterInit,fighterTick,updFtFx,ftStop,pawstorm,swing,orb,wave,FX,pawCanProc:typeof pawCanProc === "function" ? pawCanProc : undefined};',env);
  const legend=vm.createContext({legendFeedback:()=>{},G,LSK,hero,...state.api,QS:{get:()=>null},mulberry32:()=>()=>{random.draws++;return random.value;},addEventListener:no,
    pawstorm:env.api.pawstorm,pawCanProc:env.api.pawCanProc,ricochet:no,rosebarrage:no,overdrill:no,gigahammer:no,tigerdash:no});
  // Only the actual dispatch path is needed, not the other heroes' visuals.
  const s=read('heroes/legend.js');
  vm.runInContext(s.slice(s.indexOf('const lr ='),s.indexOf('const FX ='))+'\n'+
    'const count=k=>{G.legendN??={};G.legendN[k]=(G.legendN[k]||0)+1;};\n'+
    strip(s.slice(s.indexOf('export const legendSkill'),s.indexOf('// 목표 지점:')))+'\n'+
    strip(s.slice(s.indexOf('export function legendProc'),s.indexOf('// 멀티샷:')))+'\n'+
    'const multishot=()=>{},frostorb=()=>{},boomerang=()=>{};',legend);
  env.api.fighterInit(hero);
  function target(z=6,{x=0,fly=false,boss=false,hp=100000,armor=0}={}){const g=new THREE.Group();g.position.set(x,0,z);const e={g,E:{fly,boss,armor},hp,dead:false};G.enemies.push(e);return e;}
  function step(dt=.01){G.t+=dt;hero.cd-=dt;hero.atkT-=dt;hero.licd=Math.max(0,hero.licd-dt);for(let i=G.timers.length-1;i>=0;i--){const tm=G.timers[i];tm.t-=dt;if(tm.t<=0){G.timers.splice(i,1);state.api.runTimer(tm);}}env.api.updFtFx(dt);}
  function tick(t){for(let i=0;i<Math.ceil(t/.01);i++)step();}
  function attack(t=3){for(let i=0;i<Math.ceil(t/.01);i++){let melee=null;for(const e of G.enemies)if(!e.dead&&!e.E.fly&&e.g.position.distanceTo(hero.g.position)<2.6){melee=e;break;}env.api.fighterTick(.01,melee,false);step();}}
  return {G,hero,scene,hits,animations,random,api:env.api,target,step,tick,attack,THREE,legend:(...a)=>legend.legendProc(...a),LSK};
}
