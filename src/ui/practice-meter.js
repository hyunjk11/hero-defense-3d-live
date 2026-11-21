import { towerMeterIdentity } from '../combat/meter.js';
import { TOWERS } from '../data/towers.js';
import { heroLabel } from '../data/heroes.js';

const active = s => !s.paused && !s.navigating && s.phase==='wave';
const visible = s => s.practiceSandbox && ['build','wave','over'].includes(s.phase);
const dmg = n => Number.isFinite(n) ? Math.max(0,n) : 0;
const heroMeters = s => [...new Set([...(s.heroes||[]),s.hero].filter(h=>h?.dm))];
const heroStats = m => ({damage:dmg(m.tot),skill:dmg(m.sk),kills:dmg(m.kills)});
function towerStats(state){
 const rows=new Map();
 for(const tw of new Set([...(state.dmTowers||[]),...(state.towers||[])].map(t=>t?.dmRecord||t))){
  if(!tw?.type||!Object.hasOwn(TOWERS,tw.type))continue;
  rows.set(towerMeterIdentity(tw),{type:tw.type,damage:dmg(tw.dmT),kills:dmg(tw.dmK),level:tw.lvl,retired:!!tw.dead});
 }
 return rows;
}
function delta(value,base,key){return Math.max(0,(value[key]||0)-(base?.[key]||0));}
const rank=(a,b)=>b.damage-a.damage||b.kills-a.kills||a.name.localeCompare(b.name,'ko');

// A practice display owns only clock/observation state; gameplay meters are never mutated.
export function createPracticeMeter(){
 let lastTime=null,lastActive=false,time=0,baseHeroes=new Map(),observedHeroes=new Map(),baseTowers=new Map();
 let heroIds=new WeakMap(),towerNumbers=new Map();
 function clear(){
  lastTime=null;lastActive=false;time=0;baseHeroes.clear();observedHeroes.clear();baseTowers.clear();heroIds=new WeakMap();towerNumbers.clear();
 }
 function observe(s,scan=true){
  if(!visible(s)){clear();return;}
  const t=Number.isFinite(s.t)?s.t:0;
  if(lastTime!==null&&t<lastTime)clear();
  if(lastTime!==null&&lastActive&&active(s))time+=t-lastTime;
  lastTime=t;lastActive=active(s);
  if(scan)for(const h of heroMeters(s)){
   let id=heroIds.get(h);if(!id){id={};heroIds.set(h,id);}
   observedHeroes.set(id,{name:heroLabel(h.cls),...heroStats(h.dm)});
  }
 }
 function reset(s){
  if(!visible(s)||!['build','wave'].includes(s.phase)||s.navigating)return false;
  observe(s);time=0;
  baseHeroes=new Map(observedHeroes);baseTowers=towerStats(s);return true;
 }
 function read(s){
  observe(s);const perSecond=value=>time>0?value/time:0,heroes=[],towers=[];
  for(const [h,current] of observedHeroes){
   const start=baseHeroes.get(h),damage=delta(current,start,'damage'),skill=Math.min(damage,delta(current,start,'skill'));
   heroes.push({name:current.name,damage,dps:perSecond(damage),basic:damage-skill,skill,kills:delta(current,start,'kills')});
  }
  const groups=new Map();
  for(const [id,current] of towerStats(s)){
   if(!towerNumbers.has(id))towerNumbers.set(id,towerNumbers.size+1);
   const start=baseTowers.get(id),damage=delta(current,start,'damage'),kills=delta(current,start,'kills');
   if(current.retired&&!damage&&!kills)continue;
   const name=TOWERS[current.type].n,group=groups.get(current.type)||{name,damage:0,kills:0,basic:null,skill:null,towers:[]};
   group.damage+=damage;group.kills+=kills;
   group.towers.push({name:'#'+towerNumbers.get(id)+(current.level?' Lv.'+current.level:'')+(current.retired?' · 제거':''),damage,dps:perSecond(damage),kills,basic:null});
   groups.set(current.type,group);
  }
  for(const group of groups.values()){group.dps=perSecond(group.damage);group.towers.sort(rank);towers.push(group);}
  heroes.sort(rank);towers.sort(rank);
  const rows=[...heroes,...towers],damage=rows.reduce((n,r)=>n+r.damage,0),kills=rows.reduce((n,r)=>n+r.kills,0);
  return {seconds:time,damage,dps:perSecond(damage),kills,heroes,towers};
 }
 return {observe,reset,read};
}

const meter=createPracticeMeter();
const integer=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});
const decimal=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1,minimumFractionDigits:1});
let panel=null,shown=false,renderAt=-Infinity,scanAt=-Infinity,phase=null,battle=null;
function makePanel(state){
 const section=document.createElement('section');section.id='practiceMeter';
 section.innerHTML='<button type="button" class="gbtn sm pm-toggle" aria-expanded="false" aria-controls="practiceMeterDetails">전투 통계</button><div id="practiceMeterDetails" hidden><div class="pm-top"><b></b><button class="gbtn sm" type="button">초기화</button></div><div class="pm-rows"></div></div>';
 section.addEventListener('pointerdown',e=>e.stopPropagation());
 section.addEventListener('wheel',e=>e.stopPropagation());
 section.querySelector('.pm-toggle').onclick=()=>{shown=!shown;renderAt=-Infinity;updatePracticeMeter(battle||state);};
 section.querySelector('.pm-top button').onclick=()=>{if(meter.reset(battle||state)){renderAt=-Infinity;updatePracticeMeter(battle||state);}};
 document.body.append(section);
 return section;
}
function appendGroup(out,label,rows){
 if(!rows.length)return;
 const group=document.createElement('div');group.className='pm-group';
 const title=document.createElement('span');title.className='pm-label';title.textContent=label;group.append(title);
 for(const r of rows){
  const line=document.createElement('div');line.className='pm-line';
  const name=document.createElement('b'),values=document.createElement('span');name.textContent=r.name;
  values.textContent=integer.format(r.damage)+' · '+decimal.format(r.dps)+'/초 · '+integer.format(r.kills)+'킬';
  line.append(name,values);
  if(r.basic!==null){const breakdown=document.createElement('small');breakdown.textContent='기본 '+integer.format(r.basic)+' · 스킬 '+integer.format(r.skill);line.append(breakdown);}
  group.append(line);
  for(const item of r.towers||[]){
   const detail=document.createElement('small');detail.className='pm-tower';
   detail.textContent=item.name+' · '+integer.format(item.damage)+' · '+decimal.format(item.dps)+'/초 · '+integer.format(item.kills)+'킬';
   group.append(detail);
  }
 }
 out.append(group);
}
// Call each frame with the sandbox state. Browser redraws are capped at 4/s.
export function updatePracticeMeter(state){
 const on=visible(state);
 if(!on){
  if(panel){panel.remove();panel=null;shown=false;battle=null;phase=null;scanAt=renderAt=-Infinity;meter.observe(state);}
  return;
 }
 if(typeof document==='undefined'||!document.body)return;
 panel||=makePanel(state);battle=state;
 const t=Number.isFinite(state.t)?state.t:0,was=phase;
 const scan=was!==state.phase||t<scanAt||t>=scanAt+.25;
 meter.observe(state,scan);if(scan)scanAt=t;
 if(t<renderAt)renderAt=-Infinity;
 phase=state.phase;
 panel.querySelector('.pm-toggle').setAttribute('aria-expanded',String(shown));
 const details=panel.querySelector('#practiceMeterDetails');details.hidden=!shown;
 if(!shown||t<renderAt+.25&&was===phase)return;
 renderAt=t;
 const v=meter.read(state);
 details.querySelector('.pm-top b').textContent='전투 '+decimal.format(v.seconds)+'초 · '+integer.format(v.damage)+' 피해 · '+decimal.format(v.dps)+' DPS';
 details.querySelector('.pm-top button').disabled=!['build','wave'].includes(state.phase)||!!state.navigating;
 const rows=details.querySelector('.pm-rows');rows.replaceChildren();
 appendGroup(rows,'영웅',v.heroes);appendGroup(rows,'타워',v.towers);
}
