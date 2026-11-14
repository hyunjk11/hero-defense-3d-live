import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import * as F from '../src/data/fighter.js';
import { ADV } from '../src/data/advance.js';

const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/^export \{.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
const scene=new THREE.Scene(),toon=vm.createContext({THREE,scene,mergeVertices:g=>g});
vm.runInContext(strip(read('render/toon.js'))+'\nthis.api={toon,disposeOwned};',toon);
const visual=vm.createContext({THREE});
vm.runInContext(strip(read('render/fighter-spirits.js'))+'\nthis.api={drawTigerFace,createDragonHead,createDragonSegment};',visual);
let checks=0;
const ok=(test,msg)=>{assert.ok(test,msg);checks++;};
const canvasContext=new Proxy({}, {get:(o,k)=>o[k]??(String(k).startsWith('create')?()=>({addColorStop(){}}):()=>{})});
visual.api.drawTigerFace(canvasContext);checks++;

for(const low of [false,true]) {
  const n=low?9:16,roots=[visual.api.createDragonHead(0x40dcff,1.6),...Array.from({length:n},(_,i)=>visual.api.createDragonSegment(i,n,1.6,low))];
  const head=roots[0],nose=head.getObjectByName('nose'),skull=head.getObjectByName('skull');
  ok(nose.position.z>skull.position.z,'muzzle points in flight direction +Z');
  ok(head.children.filter(o=>o.name==='antler').length===2,'two antlers');
  ok(head.children.filter(o=>o.name==='whisker').length===2,'two swept whiskers');
  ok(roots.at(-1).getObjectByName('tail-tip').position.z<0,'tail trails -Z');
  const geometry=new Set(),material=new Set(),calls=new Map();
  for(const root of roots){scene.add(root);root.traverse(o=>{
    ok(o.position.toArray().concat(o.quaternion.toArray(),o.scale.toArray()).every(Number.isFinite),'finite visual transform');
    if(o.geometry)geometry.add(o.geometry);if(o.material)material.add(o.material);
  });}
  for(const r of [...geometry,...material])r.addEventListener('dispose',()=>calls.set(r,(calls.get(r)||0)+1));
  for(const root of roots){root.removeFromParent();toon.api.disposeOwned(root);}
  ok(calls.size===geometry.size+material.size,'all owned resources released');
  ok([...calls.values()].every(n=>n===1),'shared materials released once');
  ok(scene.children.length===0,'no scene attachments retained');
}

function fixture(branch,low=false,face=0,source=read('heroes/fighter.js')) {
  const noop=()=>{},scene=new THREE.Scene(),hits=[],G={t:0,phase:'wave',timers:[],enemies:[],fxs:[],stats:{},mK:1};
  const hero={cls:'fighter',g:new THREE.Group(),face,dead:0,cd:0,atkT:0,path:[],C:{atkSpd:1,rate:2.08},hp:760,max:760,adv:ADV.fighter[branch],ch:{root:new THREE.Group(),acts:{PalmS:{},SlamS:{}}}};
  G.hero=G.curHero=hero;
  const state=vm.createContext({window:{G},QS:{has:()=>false}}),stateSource=read('core/state.js');
  vm.runInContext('const G=window.G;'+stateSource.slice(stateSource.indexOf('const later =')).replace(/export \{.*;/,'')+'\nthis.api={later,runTimer,heroFx};',state);
  const env=vm.createContext({THREE,G,scene,camera:new THREE.PerspectiveCamera(),...F,...state.api,...toon.api,...visual.api,hero,Q:{perf:low},P:{},PB:{},
    document:{createElement:()=>({width:0,height:0,getContext:()=>canvasContext})},
    stat:{dmg:()=>100,range:()=>2.6,rate:()=>2.08,skillMul:()=>1},play:()=>true,groundY:()=>0,passAt:()=>true,
    banner:noop,emit:noop,debris:noop,ringFx:noop,knock:noop,legendProc:noop,Snd:{play:noop,whoosh:noop},
    hurt0:(e,d)=>{if(e.dead)return;const loss=d*(1-e.E.armor);e.hp-=loss;hits.push({id:e.id,d:loss,t:Math.round(G.t*1000)});if(e.hp<=0)e.dead=true;}});
  vm.runInContext(strip(source)+'\nthis.api={fighterInit,fighterSkill,updFtLeap,updFtFx,ftStop,FX};',env);env.api.fighterInit(hero);
  function target(z,{x=0,fly=false,boss=false,armor=0,hp=100000,immT=0}={}) {
    const g=new THREE.Group();g.position.set(x*Math.cos(face)+z*Math.sin(face),0,z*Math.cos(face)-x*Math.sin(face));
    const e={id:G.enemies.length,g,E:{fly,boss,armor},hp,dead:false,immT};G.enemies.push(e);return e;
  }
  function step(dt=.01){G.t+=dt;for(let i=G.timers.length-1;i>=0;i--){const t=G.timers[i];t.t-=dt;if(t.t<=0){G.timers.splice(i,1);state.api.runTimer(t);}}
    if(hero.ft.leap)env.api.updFtLeap(dt);env.api.updFtFx(dt);}
  function tick(t){for(let i=0;i<Math.ceil(t/.01);i++)step();}
  const cast=()=>env.api.fighterSkill(new THREE.Vector3(Math.sin(face)*10,0,Math.cos(face)*10),1);
  return {G,hero,scene,hits,target,tick,cast,api:env.api};
}

const traces=[];
for(const low of [false,true])for(const face of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const branch of ['tiger','dragon']) {
  const f=fixture(branch,low,face),a=f.target(3),b=f.target(5,{boss:true,armor:.2}),air=f.target(3,{x:1,fly:true}),outer=f.target(8),far=f.target(40),inv=f.target(2,{immT:99});
  f.cast();f.tick(4);
  const sum=e=>f.hits.filter(h=>h.id===e.id).reduce((n,h)=>n+h.d,0);
  ok(sum(a)===(branch==='tiger'?700:500),branch+' total damage unchanged');
  ok(sum(b)===(branch==='tiger'?560:400),'armor preserved');
  ok(sum(air)===(branch==='tiger'?0:500),'air targeting preserved');
  ok(sum(outer)===(branch==='tiger'?200:500),'outer radius/path preserved');
  ok(sum(far)===0&&sum(inv)===0,'range and invulnerability preserved');
  ok(a.stunT===(branch==='tiger'?.8:1),'normal stun preserved');
  ok(branch==='tiger'?!b.stunT:b.slowT===2&&b.slowAmt===.25,'boss treatment preserved');
  ok(!f.G.timers.length&&!f.api.FX.length&&!f.G.ftN.tqLive&&!f.G.ftN.dwLive,'all effects expire');
  ok(f.scene.children.length===0,'owned effect roots removed');
  traces.push({branch,low,face,hits:f.hits,states:f.G.enemies.map(e=>({hp:e.hp,stun:e.stunT,slow:e.slowT,slowAmt:e.slowAmt}))});
}
// The comparison artifact can run this same harness against the untouched v19
// source; this optional path is read-only and never used by production code.
if(process.env.SPIRIT_BASELINE){const baseline=fs.readFileSync(process.env.SPIRIT_BASELINE,'utf8');for(const row of traces){
 const f=fixture(row.branch,row.low,row.face,baseline);f.target(3);f.target(5,{boss:true,armor:.2});f.target(3,{x:1,fly:true});f.target(8);f.target(40);f.target(2,{immT:99});f.cast();f.tick(4);
 assert.deepEqual(f.hits,row.hits,'v19 damage amounts, target order and hit timestamps');
 assert.deepEqual(f.G.enemies.map(e=>({hp:e.hp,stun:e.stunT,slow:e.slowT,slowAmt:e.slowAmt})),row.states);checks+=2;
}}
// Ending/cancelling the owner during wind-up cannot leave the new visuals alive.
for(const branch of ['tiger','dragon']){const f=fixture(branch);f.cast();f.tick(.1);f.hero.dead=1;f.api.ftStop();f.tick(4);ok(!f.api.FX.length&&!f.G.timers.length&&!f.G.ftN.dwLive&&!f.G.ftN.tqLive,'cancelled wind-up drains');}
{
 const f=fixture('dragon');f.cast();f.tick(1.18);
 const head=f.scene.getObjectByName('celestial-dragon-head'),shared=head.getObjectByName('skull').material,start=shared.opacity;
 f.tick(.15);ok(shared.opacity>0&&shared.opacity<start,'visible gradual end fade');
 f.tick(.5);ok(f.scene.children.length===0,'end fade removes the full dragon');
}
console.log(JSON.stringify({checks,combatCases:traces.length,baselineCompared:!!process.env.SPIRIT_BASELINE,passed:true}));
