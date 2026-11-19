import { BASE_CHAPTERS } from './chapters/base.js';
import { hardGearOdds } from './items.js';
import { rollGrade, SLOT_KEYS } from '../account/equip.js';
import { targetGear } from './repeat-target.js';
import { collectionOdds, collectionCount } from './hard-collection.js';
import chapter5 from './chapters/chapter5.js';
import chapter6 from './chapters/chapter6.js';
import chapter7 from './chapters/chapter7.js';
import chapter8 from './chapters/chapter8.js';
import chapter9 from './chapters/chapter9.js';
import chapter10 from './chapters/chapter10.js';
const normalChapters=[...BASE_CHAPTERS,chapter5,chapter6,chapter7,chapter8,chapter9,chapter10];
// All ten campaign chapters have hard variants. Normal chapter definitions remain untouched.
export const HARD_ELITE_CAP=2;
const chapterRules=[
 {n:'각성한 숲',name:'수호의 포효',desc:'정예의 예고 고리를 피하거나 기절로 끊기',rule:'forest-pulse',hp:4.4,attack:1.12},
 {n:'균열의 설원',name:'빙하 균열',desc:'푸른 선을 옆으로 피하거나 기절로 차단',rule:'ice-fracture',hp:4.9,attack:1.13,weights:{icewolf:1.25,frostgolem:1.15,wisp:1.1}},
 {n:'분화의 화산',name:'잔불 분출',desc:'주황 원을 벗어나거나 기절로 차단',rule:'ash-eruption',hp:5.4,attack:1.14,weights:{lavahound:1.25,magmagolem:1.15,firebomber:1.1}},
 {n:'메아리의 폐허',name:'망령의 고리',desc:'보라 띠 안쪽·바깥으로 이동하거나 기절로 차단',rule:'ruin-ring',hp:4.5,attack:1.15,weights:{wraith:1.1,gargoyle:1.1}},
 {n:'포자의 늪지',name:'포자 교차',desc:'초록 십자 사이로 피하거나 기절로 차단',rule:'spore-cross',hpScale:2.1,attack:1.15,weights:{swamp_runner:1.1,swamp_moth:1.05}},
 {n:'사구의 시련',name:'사구 쌍선',desc:'두 열선 사이의 안전 통로로 이동하거나 기절로 중단',rule:'desert-twin',hpScale:2.1,attack:1.15},
 {n:'천둥의 군도',name:'천둥 고리',desc:'푸른 고리의 중심이나 바깥으로 피하기',rule:'storm-ring',hpScale:2.05,attack:1.16},
 {n:'과열된 요새',name:'분쇄 격자',desc:'주황 열선 사이로 이동하거나 기절로 중단',rule:'machine-grid',hpScale:2.05,attack:1.17},
 {n:'심연의 심장',name:'균열 교차',desc:'보라 십자 사이로 피하거나 기절로 중단',rule:'abyss-cross',hpScale:2.05,attack:1.18},
 {n:'멸화의 성채',name:'용화 봉인',desc:'붉은 고리의 중심이나 바깥으로 피하기',rule:'citadel-seal',hpScale:2.05,attack:1.19},
];
export const HARD_CHAPTERS=chapterRules.map((r,j)=>({...normalChapters[j],n:`하드 ${j+1}장 · ${r.n}`,short:r.n,propN:r.name,propD:r.desc,stages:normalChapters[j].stages.map((s,i)=>({...s,id:'hard-'+s.id,no:`H${j+1}-${i+1}`,ch:j+1,idx:i,last:i===5,hard:true,normalId:s.id,hp:s.id==='4-3'?3.95:s.id==='3-3'?4.8:s.id==='3-6'?5.1:s.id==='6-6'?4.94:s.id==='7-5'?3.99:r.hpScale?Number((s.hp*r.hpScale).toFixed(3)):r.hp+i*(j===3?.08:.12),attackMul:r.attack,lvUp:4,rule:r.rule,...(s.id==='4-3'?{enemyCaps:{siege:{until:5,early:1,late:2},ruinroot:{until:5,early:1,late:2}}}:{}),...(r.weights?{enemyWeights:{...s.enemyWeights,...Object.fromEntries(Object.entries(r.weights).map(([k,v])=>[k,v*(s.enemyWeights?.[k]??1)])),...(['3-3','3-6'].includes(s.id)?{siege:.65,firebomber:.9}:{}),...(s.id==='4-3'?{siege:.4,ruinroot:.45}:{})}}:{}),hint:undefined}))}));
export const HARD_STAGES=Object.fromEntries(HARD_CHAPTERS.flatMap(c=>c.stages.map(s=>[s.id,s])));
export const hardOpen=save=>Number(save?.st?.['10-6'])>0;
export function cleanHard(v){const st={};for(const id of Object.keys(HARD_STAGES)){const n=v?.st?.[id];if(Number.isInteger(n)&&n>0)st[id]=Math.min(3,n);}return {version:1,st};}
export function hardUnlocked(save,id){const ids=Object.keys(HARD_STAGES),i=ids.indexOf(id);if(i<0||!hardOpen(save))return false;const st=save.growth?.hard?.st||{};return i===0||st[id]>0||st[ids[i-1]]>0;}
export function eliteQueue(q,wave,types,rule='forest-pulse'){
 const max=Math.min(4,1+Math.floor(wave/4)),preferred=rule==='ice-fracture'?['icewolf','frostgolem','charger']:rule==='ash-eruption'?['lavahound','magmagolem','siege']:rule==='ruin-ring'?['gargoyle','shield','digger']:rule==='spore-cross'?['swamp_runner','swamp_beetle','swamp_spitter']:rule==='desert-twin'?['sand_scout','sand_guard','sand_priest']:rule==='storm-ring'?['storm_runner','storm_pikeman','storm_anchor']:rule==='machine-grid'?['gear_hound','machine_guard','rivet_gunner']:rule==='abyss-cross'?['rift_runner','rift_lancer','void_walker']:rule==='citadel-seal'?['ash_stalker','dragon_guard','cinder_artillery']:[];
 if(!preferred.length){let n=0;return q.map((t,i)=>!types[t]?.boss&&!types[t]?.child&&i%9===4&&n++<max);}
 const eligible=q.map((t,i)=>({t,i})).filter(x=>!types[x.t]?.boss&&!types[x.t]?.child&&(!['desert-twin','storm-ring','machine-grid','abyss-cross','citadel-seal'].includes(rule)||(types[x.t]?.dps>0&&!types[x.t]?.fly&&types[x.t]?.desert?.kind!=='burrow'))),selected=new Set();
 for(const x of [...eligible.filter(x=>preferred.includes(x.t)),...eligible.filter(x=>x.i%9===4)]){if(selected.size>=max)break;if([...selected].every(i=>Math.abs(i-x.i)>=5))selected.add(x.i);}
 return q.map((_,i)=>selected.has(i));
}
export const hardXP=(s,completed,win,first)=>{const n=Math.max(0,Math.min(s.waves,completed|0)),unit=30+4*(s.ch-1),b=n*unit+(win&&n===s.waves?Math.floor(s.waves*unit/3):0);return b+(win&&first?Math.floor(b/2):0);};
export function hardReward(s,completed,win,first,hero,random=()=>.5,target=null,rewardVersion=1){
 const n=Math.max(0,Math.min(s.waves,completed|0)),waveBoxes=Math.floor(n/5),count=waveBoxes+(win&&first?1:0),odds=hardGearOdds(s.ch);
 const items=Array.from({length:count},(_,i)=>{const slot=SLOT_KEYS[Math.floor(random()*SLOT_KEYS.length)],g=i===waveBoxes?3:rollGrade(odds,random),chosen=win&&n===s.waves&&!first&&i===0?targetGear(target):null;return {k:'gear',...(chosen||{s:slot,...(slot==='weapon'?{h:hero}:{})}),g,c:s.ch};});
 // Append after every existing draw and item index; never apply the selected target here.
 for(let i=0;i<collectionCount(s,completed,win,first,rewardVersion);i++){
  const slot=SLOT_KEYS[Math.floor(random()*SLOT_KEYS.length)],g=rollGrade(collectionOdds(s.ch),random);
  items.push({k:'gear',s:slot,...(slot==='weapon'?{h:hero}:{}),g,c:s.ch});
 }
 return {souls:n*(14+2*(s.ch-1))+(win?180+s.idx*20+20*(s.ch-1):0)+(win&&first?240:0),...(items.length?{items}:{})};
}

export function hardEnemy(base,elite,summoned,active,attack=1.12){
  const chosen=!!elite&&!summoned&&!base.boss&&active<HARD_ELITE_CAP;
  return {...base,hp:base.hp*(chosen?1.25:1),dps:base.dps*attack,hardElite:chosen,elite:chosen,gold:summoned?0:base.gold,hardSummoned:!!summoned};
}
// Fixed warning center; movement avoids it, any stun cancels the cast and boss follow-up.
export function pulseStep(e,dt,target,boss=false,rule='forest-pulse'){
  if(e.dead||e.dying!==undefined){e.hardCast=null;return null;}
  if(e.stunT>0){e.hardCast=null;e.hardFollow=false;e.hardCd=Math.max(e.hardCd||0,3);return null;}
  if(rule==='desert-twin'&&(e.desertCast||e.desertTravel||e.desertRecover>0)){e.hardCast=null;return null;}
  // Let native chapter casts, vulnerable recovery and awakening finish uninterrupted.
  if(['storm-ring','machine-grid','abyss-cross','citadel-seal'].includes(rule)&&(e.stormCast||e.machineCast||e.endCast||e.stormRecover>0||e.machineRecover>0||e.endRecover>0)){e.hardCast=null;return null;}
  if(e.hardCast){e.hardCast.t-=dt;if(e.hardCast.t>0)return null;const {p,from,rule:castRule,follow}=e.hardCast;e.hardCast=null;
    e.hardCd=boss&&!e.hardFollow?1.4:10;e.hardFollow=boss&&!e.hardFollow;return {kind:'hit',p,from,rule:castRule,...(hardShape({rule:castRule})?{follow}:{})};}
  e.hardCd=(e.hardCd??5)-dt;
  const shape=hardShape({rule,follow:!!e.hardFollow});
  if(shape&&(e.swampCast||e.statueT>0||e.phaseT>0))return null;
  if(e.hardCd<=0&&target&&!e.cast&&Math.hypot(e.g.position.x-target.x,e.g.position.z-target.z)<=9){const from={x:e.g.position.x,z:e.g.position.z};const p=['ruin-ring','storm-ring','citadel-seal'].includes(rule)?{...from,y:0}:{x:target.x,y:target.y||0,z:target.z};const extra=shape?{follow:!!e.hardFollow}:{};e.hardCast={t:shape?.dur??(rule==='ice-fracture'?1.35:rule==='ash-eruption'?1.5:1.2),p,from,rule,...extra};return {kind:'warn',p,from,rule,...extra};}
  return null;
}

export function hardDirection(event){const x=event.p.x-event.from.x,z=event.p.z-event.from.z,d=Math.hypot(x,z);return d>1e-6?{x:x/d,z:z/d}:{x:0,z:1};}
export function hardShape(event){
 if(event.rule==='storm-ring')return {kind:'annulus',inner:event.follow?1.8:3.2,outer:event.follow?4.8:6.2,dur:1.9,color:0x65ddff};
 if(event.rule==='machine-grid'){const u=event.p&&event.from?hardDirection(event):{x:0,z:1};return {kind:'lanes',width:1.3,length:11,offsets:[-3,0,3],angle:-Math.atan2(u.x,u.z)+(event.follow?Math.PI/2:0),dur:2,color:0xffb85c};}
 if(event.rule==='abyss-cross')return {kind:'cross',width:1.8,length:12,angle:event.follow?Math.PI/4:0,dur:2,color:0xc58aff};
 if(event.rule==='citadel-seal')return {kind:'annulus',inner:event.follow?3.5:2,outer:event.follow?6.5:5,dur:2,color:0xff7655};
 if(event.rule==='desert-twin'){const u=event.p&&event.from?hardDirection(event):{x:0,z:1};return {kind:'lanes',width:1.4,length:10,offsets:[0,4],angle:-Math.atan2(u.x,u.z)+(event.follow?Math.PI/2:0),dur:1.9,color:0xffc46b};}
 if(event.rule==='ruin-ring')return {kind:'annulus',inner:event.follow?2:3,outer:event.follow?6:7,dur:1.6,color:0xbe87ff};
 if(event.rule==='spore-cross')return {kind:'cross',width:2,length:12,angle:event.follow?Math.PI/4:0,dur:1.7,color:0x8fe568};
 return null;
}
export function hardHit(event,pos){
 const shape=hardShape(event);
 if(shape){const x=pos.x-event.p.x,z=pos.z-event.p.z;if(shape.kind==='annulus'){const d=Math.hypot(x,z);return d>=shape.inner&&d<=shape.outer;}
  const c=Math.cos(shape.angle),s=Math.sin(shape.angle),a=x*c+z*s,b=-x*s+z*c;if(shape.kind==='lanes')return Math.abs(b)<=shape.length/2&&shape.offsets.some(offset=>Math.abs(a-offset)<=shape.width/2);return (Math.abs(a)<=shape.width/2&&Math.abs(b)<=shape.length/2)||(Math.abs(b)<=shape.width/2&&Math.abs(a)<=shape.length/2);
 }
 if(event.rule==='ice-fracture'){
  const u=hardDirection(event),x=pos.x-event.from.x,z=pos.z-event.from.z;
  const along=x*u.x+z*u.z,side=Math.abs(x*u.z-z*u.x);return along>=0&&along<=10&&side<=1.35;
 }
 return Math.hypot(pos.x-event.p.x,pos.z-event.p.z)<=(event.rule==='ash-eruption'?3.6:3.2);
}
