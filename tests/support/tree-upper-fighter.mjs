import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../lib/three.module.js';
import * as F from '../../src/data/fighter.js';
import { ADV } from '../../src/data/advance.js';

const read=f=>fs.readFileSync(new URL('../../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const scene=new THREE.Scene(),toon=vm.createContext({THREE,scene,mergeVertices:g=>g});
vm.runInContext(strip(read('render/toon.js'))+'\nthis.api={toon,disposeOwned};',toon);
const visual=vm.createContext({THREE});
vm.runInContext(strip(read('render/fighter-spirits.js'))+'\nthis.api={drawTigerFace,createDragonHead,createDragonSegment};',visual);
import {treeMods} from '../../src/data/skill-tree.js';
const canvasContext=new Proxy({}, {get:(o,k)=>o[k]??(String(k).startsWith('create')?()=>({addColorStop(){}}):()=>{})});
export function fixture(branch,tree=null,low=false,face=0,source=read('heroes/fighter.js')) {
  const noop=()=>{},scene=new THREE.Scene(),hits=[],G={t:0,phase:'wave',timers:[],enemies:[],fxs:[],stats:{},mK:1};
  const hero={cls:'fighter',g:new THREE.Group(),face,dead:0,cd:0,atkT:0,path:[],C:{atkSpd:1,rate:2.08},hp:760,max:760,adv:ADV.fighter[branch],ch:{root:new THREE.Group(),acts:{PalmS:{},SlamS:{}}}};
  hero.tree=tree;hero.treeMods=treeMods(tree);G.hero=G.curHero=hero;
  const state=vm.createContext({window:{G},QS:{has:()=>false}}),stateSource=read('core/state.js');
  vm.runInContext('const G=window.G;'+stateSource.slice(stateSource.indexOf('const later =')).replace(/export \{.*;/,'')+'\nthis.api={later,runTimer,heroFx};',state);
  const env=vm.createContext({THREE,G,scene,camera:new THREE.PerspectiveCamera(),...F,...state.api,...toon.api,...visual.api,hero,Q:{perf:low},P:{},PB:{},
    document:{createElement:()=>({width:0,height:0,getContext:()=>canvasContext})},
    stat:{dmg:()=>100,range:()=>2.6,rate:()=>2.08,skillMul:()=>1},play:()=>true,groundY:()=>0,passAt:()=>true,
    banner:noop,emit:noop,debris:noop,ringFx:noop,knock:noop,legendProc:noop,Snd:{play:noop,whoosh:noop},
    hurt0:(e,d)=>{if(e.dead)return;const loss=d*(1-e.E.armor);e.hp-=loss;hits.push({id:e.id,d:loss,t:Math.round(G.t*1000)});if(e.hp<=0)e.dead=true;}});
  vm.runInContext(strip(source)+'\nthis.api={fighterInit,fighterSkill,updFtLeap,updFtFx,ftStop,tigerdash,FX};',env);env.api.fighterInit(hero);
  function target(z,{x=0,fly=false,boss=false,armor=0,hp=100000,immT=0}={}) {
    const g=new THREE.Group();g.position.set(x*Math.cos(face)+z*Math.sin(face),0,z*Math.cos(face)-x*Math.sin(face));
    const e={id:G.enemies.length,g,E:{fly,boss,armor},hp,dead:false,immT};G.enemies.push(e);return e;
  }
  function step(dt=.01){G.t+=dt;for(let i=G.timers.length-1;i>=0;i--){const t=G.timers[i];t.t-=dt;if(t.t<=0){G.timers.splice(i,1);state.api.runTimer(t);}}
    if(hero.ft.leap)env.api.updFtLeap(dt);env.api.updFtFx(dt);}
  function tick(t){for(let i=0;i<Math.ceil(t/.01);i++)step();}
  const cast=()=>env.api.fighterSkill(new THREE.Vector3(Math.sin(face)*10,0,Math.cos(face)*10),hero.treeMods.qMul);
  return {G,hero,scene,hits,target,tick,cast,api:env.api};
}
