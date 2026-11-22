import * as THREE from 'three';
import { G } from '../core/state.js';
import { CORE, DIRS, GW, GH, inGrid, tileX, tileZ, toTile } from '../core/grid.js';
import { clearOrders } from '../data/hard-party.js';
import { FT, ftSkillId } from '../data/fighter.js';
import { dungeonRole } from '../data/dungeon.js';
import { skillBusy } from '../core/autoskill.js';
import { withHero, heroGoTo, passAt, stat } from '../heroes/hero.js';
import { useAutoSkill } from '../heroes/autoskill.js';

const THINK=.45, SEP=2.4, SLACK=.24, AIM_REACH=24;
const d2=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const dist=(a,b)=>Math.sqrt(d2(a,b));
const pos=o=>o.g.position;
const alive=h=>h&&h.dead<=0;
const tickable=e=>!e.dead&&e.dying===undefined&&!(e.immT>G.t)&&e.state!=='spawn';
const inside=(p,c,r)=>d2(p,c)<=r*r;
const xy=([c,r])=>({x:tileX(c),y:0,z:tileZ(r)});
let active=null;
const wave=()=>G.phase==='wave'&&G.screen!=='town'&&!G.practice&&!G.dungeon&&!!G.stage;
const pair=()=>G.stage?.hard&&G.hardParty&&G.heroes?.length===2&&G.heroes.includes(G.hero);
const sameStage=a=>a&&a.stage===G.stage&&a.tiles===G.tiles;
export const stageAutoOwnsHardPair=()=>!!(sameStage(active)&&active.pair&&pair()&&wave());
function release(h,o){
  if(o.path===h.path&&o.path)clearOrders(h);
  else{
    if(h.aiTgt===o.focus)h.aiTgt=null;
    if(h.aiGoal===o.goal)h.aiGoal=null;
    h.aiT=0;
  }
}
export function clearStageAutoCombat(){
  const old=active;active=null;
  if(!sameStage(old))return;
  for(const [h,o] of old.orders)
    if(h===G.hero||old.pair&&G.heroes.includes(h))release(h,o);
}
export function trackStageAutoRepath(h,oldPath){
  if(!sameStage(active)||!wave())return;
  const o=active.orders.get(h);
  if(o?.path!==oldPath)return;
  // Native unstuck keeps the same auto order; never adopt a newly clicked path.
  if(o.zone&&(!legalRoute(h.path,pos(h),active.core,o.zone,o.state)||!attainsOrder(h.path,o,o.goal)))h.path=[];
  o.path=h.path;
}
function remember(h,o){o.path=h.path;o.focus=h.aiTgt;o.goal=h.aiGoal;}

function setupMap(){
  const c=xy(CORE),portals=(G.stage.spawns||[]).map(xy);
  const p=portals.reduce((near,x)=>!near||d2(x,c)<d2(near,c)?x:near,null);
  let x=(p?.x??c.x-1)-c.x,z=(p?.z??c.z)-c.z,len=Math.hypot(x,z);
  if(len<.1){x=-1;z=0;len=1;}
  return {core:c,lane:{x:x/len,z:z/len},laneAt:-Infinity,mapLimit:Math.max(4,len>1?len-2.6:14)};
}
function zoneFor(range,hard,mapLimit){
  const outer=Math.min(mapLimit,hard?13:11,Math.max(6.6,4.8+range*.55+(hard?1.0:0)));
  return {outer,enter:Math.max(2.2,outer-1.65)};
}
function homes(formation,ranged,zone,side){
  const {core,lane}=formation,lead=Math.min(zone.outer*(ranged?.61:.70),zone.enter*.86);
  const lateral=side*Math.min(1.9,zone.enter*.56);
  const points=[1,.65,.38].flatMap(f=>[1,.60,1.30].map(k=>({
    x:core.x+lane.x*lead*f-lane.z*lateral*k,y:0,z:core.z+lane.z*lead*f+lane.x*lateral*k
  }))).filter(p=>inside(p,core,zone.enter)&&passAt(p.x,p.z));
  return points.length?points:passAt(core.x,core.z)?[core]:[];
}
function threat(e,core,prior,now){
  const p=pos(e),range=dist(p,core),next=e.next?xy(e.next):null;
  const speed=(e.E.spd||0)*(e.spdK||1);
  const radial=next||e.E.fly&&!e.flyTo?(range-dist(next||core,core))/Math.max(.1,dist(p,next||core))*speed:0;
  const observed=prior&&now>prior.t?(prior.range-range)/(now-prior.t):0;
  const approach=Math.max(radial,observed,0);
  if(e.tile?.[0]===CORE[0]&&e.tile?.[1]===CORE[1]||range<=1.25)return {e,rank:0,range,approach};
  if(e.next?.[0]===CORE[0]&&e.next?.[1]===CORE[1]||range<=3.25||approach>0&&range/approach<1.35)return {e,rank:1,range,approach};
  return {e,rank:approach>=2.6?2:3,range,approach};
}
// Observed enemy positions carry the actual attack approach after terrain
// routing. A tiny tower bias keeps the defenders in support, without making
// them chase an isolated tower/portal or flipping lanes every tick.
function updateDefenseLane(best){
  if(G.t<active.laneAt+1.35)return;
  active.laneAt=G.t;
  const {core,lane}=active,p=best?pos(best.e):null;
  let dx=p?p.x-core.x:lane.x,dz=p?p.z-core.z:lane.z,l=Math.hypot(dx,dz);
  if(l<.1)return;
  dx/=l;dz/=l;
  let tower=null,value=-Infinity;
  for(const tw of G.towers||[]){
    const q=tw.m?.g?.position;
    if(tw.dead||!q)continue;
    const x=q.x-core.x,z=q.z-core.z,length=Math.hypot(x,z);
    if(length<3||length>Math.min(12,active.mapLimit)||length<.1)continue;
    const vx=x/length,vz=z/length,dot=dx*vx+dz*vz;
    if(dot<.20)continue;
    const score=dot*2-Math.abs(length-6)*.12;
    if(score>value){tower={x:vx,z:vz};value=score;}
  }
  if(tower){dx=dx*.78+tower.x*.22;dz=dz*.78+tower.z*.22;}
  if(best){dx=lane.x*.25+dx*.75;dz=lane.z*.25+dz*.75;}
  l=Math.hypot(dx,dz);if(l>.1)active.lane={x:dx/l,z:dz/l};
}
function pick(h,available,other){
  let result=null,score=Infinity;
  for(const candidate of available){
    const {e,rank,range,approach}=candidate;
    if(h.cls==='warrior'&&e.E.fly)continue;
    const v=range+dist(pos(h),pos(e))*.35-approach*.2+(rank>=2&&e===other?3.2:0);
    if(!result||rank<result.rank||rank===result.rank&&v<score){result=candidate;score=v;}
  }
  return result;
}
function legalRoute(path,from,core,zone,state){
  if(!path.length)return false;
  const escaped=!inside(from,core,zone.outer),limit=escaped&&state==='RETURN'?dist(from,core)+2.2:zone.outer;
  let entered=!escaped;
  for(const p of path){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!inside(p,core,entered?zone.outer:limit))return false;
    if(inside(p,core,zone.outer))entered=true;
  }
  // Never start a detour from outside unless its endpoint returns within the inner line.
  return (!escaped||state==='RETURN')&&(state!=='RETURN'||inside(path.at(-1),core,zone.enter));
}
function attainsOrder(path,o,goal){
  const end=path.at(-1);
  return !!end&&(!goal||inside(end,goal,.9))&&
    (o.state!=='ENGAGE'||!o.foe||inside(end,pos(o.foe),o.reach*.97));
}
function stopPath(h){if(h.path.length)h.path=[];h.aiGoal=null;}
// Native A* can return a closest-but-unusable endpoint, or go round a
// wall outside the defense circle. Try a bounded tile search only when
// the cheap normal route fails, using the same hero collision clearance.
function boundedRoute(from,goals,core,zone,state){
  const [sc,sr]=toTile(from.x,from.z),key=(c,r)=>c*GH+r;
  if(!inGrid(sc,sr))return null;
  const start=key(sc,sr),dest=new Map();
  for(const p of goals){
    const [c,r]=toTile(p.x,p.z);
    if(inGrid(c,r)&&!dest.has(key(c,r)))dest.set(key(c,r),p);
  }
  if(!dest.size)return null;
  const outer=zone.outer,limit=state==='RETURN'?Math.max(outer,dist(from,core)+2.2):outer;
  const parent=new Int32Array(GW*GH).fill(-1),queue=[start];
  parent[start]=start;
  for(let index=0;index<queue.length;index++){
    const current=queue[index],c=Math.floor(current/GH),r=current%GH;
    const at=dest.get(current);
    if(at){
      const path=[];let step=current;
      while(step!==start){
        path.push(new THREE.Vector3(tileX(Math.floor(step/GH)),0,tileZ(step%GH)));step=parent[step];
      }
      path.reverse();path.push(new THREE.Vector3(at.x,0,at.z));
      if(legalRoute(path,from,core,zone,state))return {path,at};
    }
    const fromInside=current===start?inside(from,core,outer):inside(xy([c,r]),core,outer);
    for(const [dx,dz] of DIRS){
      const nc=c+dx,nr=r+dz,k=key(nc,nr);
      if(!inGrid(nc,nr)||parent[k]!==-1)continue;
      const p=xy([nc,nr]);
      if(!inside(p,core,fromInside?outer:limit)||!passAt(p.x,p.z))continue;
      parent[k]=current;queue.push(k);
    }
  }
  return null;
}
function order(h,o,candidates){
  const p=pos(h),core=active.core;
  if(!candidates.length){stopPath(h);return;}
  const goals=candidates.filter((g,i)=>candidates.findIndex(x=>d2(x,g)<.01)===i).slice(0,4);
  const at=goals[0],valid=(path,goal)=>legalRoute(path,p,core,o.zone,o.state)&&attainsOrder(path,o,goal);
  if(d2(p,at)<.52**2){stopPath(h);return;}
  if(h.path.length&&h.aiGoal&&goals.some(q=>d2(h.aiGoal,q)<1.2**2&&valid(h.path,q)))return;
  if(o.failedAt&&o.retryAt>G.t&&d2(o.failedAt,at)<1.2**2){stopPath(h);return;}
  heroGoTo(at);
  if(valid(h.path,at)){h.aiGoal=at;o.failedAt=null;return;}
  const bounded=boundedRoute(p,goals,core,o.zone,o.state);
  if(bounded){h.path=bounded.path;h.aiGoal=bounded.at;o.failedAt=null;return;}
  o.failedAt=at;o.retryAt=G.t+1.2;
  stopPath(h);
}
function engagePoints(h,ally,e,ranged,reach,core,zone,side){
  const p=pos(h),t=pos(e),friend=alive(ally)?pos(ally):null;
  const stacked=!!(ranged&&friend&&d2(p,friend)<SEP**2);
  if(inside(p,t,reach*.93)&&!stacked)return [];
  const r=reach*(stacked?.73:.88),dx=p.x-t.x,dz=p.z-t.z;
  const toward=(stacked?Math.atan2(core.z-t.z,core.x-t.x):Math.atan2(dz,dx))+(stacked?side*.64:0);
  return [0,.30,-.30,.62,-.62,1.04,-1.04,1.52,-1.52,2.36,-2.36,Math.PI]
    .map(a=>({x:t.x+Math.cos(toward+a)*r,y:0,z:t.z+Math.sin(toward+a)*r}))
    .filter(q=>inside(q,core,zone.outer-SLACK)&&(!stacked||d2(q,friend)>=SEP**2)&&passAt(q.x,q.z))
    .sort((a,b)=>d2(a,p)-d2(b,p));
}
function allowDefenseCast(h,zone,key,skill,target){
  if(!target||!inside(target,active.core,AIM_REACH))return false;
  const ft=key==='Q'&&h.cls==='fighter'?ftSkillId(skill):null;
  const movement=key==='Q'?h.cls==='fighter'&&ft!=='tigerquake'&&ft!=='dragonwave':!skill?.kind&&['quake','tigerdash'].includes(skill?.key);
  if(!movement)return true;
  // Verified native leap/dash endpoints are clamped and interpolated along a
  // segment inside this convex circle; blocked terrain shortens that segment.
  return inside(pos(h),active.core,zone.outer-SLACK)&&inside(target,active.core,zone.outer-SLACK);
}
function defend(){
  const heroes=active.pair?G.heroes:[G.hero],core=active.core;
  const enemies=[],aim=[],eligibleRadius=Math.min(active.mapLimit,13),sampleLane=G.t>=active.laneAt+1.35;
  let approach=null,approachScore=Infinity;
  for(const e of G.enemies){
    if(!tickable(e))continue;
    const local=inside(pos(e),core,eligibleRadius);
    if(!local&&!inside(pos(e),core,AIM_REACH))continue;
    const t=threat(e,core,active.seen.get(e),G.t);
    active.seen.set(e,{range:t.range,t:G.t});
    if(local)enemies.push(t);
    // Passive aiming has a wider cone of interest than the movement leash;
    // native Q/E shapes still decide real range, air coverage and aim.
    const dot=(pos(e).x-core.x)*active.lane.x+(pos(e).z-core.z)*active.lane.z;
    if(t.approach>.35&&dot>=-.22*t.range)aim.push(t);
    if(sampleLane&&t.range>3.5&&t.range<eligibleRadius+9){
      const score=t.range/(2+Math.min(6,t.approach));
      if(score<approachScore){approach=t;approachScore=score;}
    }
  }
  if(sampleLane)updateDefenseLane(approach);
  let previous=null;
  heroes.forEach((h,i)=>{
    if(!alive(h)||h.warpT>0)return;
    withHero(h,()=>{
      const o=active.orders.get(h)||{state:'DEFEND'};
      active.orders.set(h,o);
      if(skillBusy(h)||h.ft?.jp)return; // Native palm charge and casts must finish.
      const role=dungeonRole(h.cls,h.adv),ranged=role==='ranged'||role==='caster';
      const dragon=h.cls==='fighter'&&h.adv?.k==='dragon';
      const simpleRange=stat.range(),range=dragon?FT.jpRange:simpleRange;
      const zone=o.zone=zoneFor(range,!!G.stage.hard,active.mapLimit);
      const local=enemies.filter(p=>p.range<=zone.outer);
      // A fresh incoming threat can be intercepted at the perimeter, but a
      // contact that just left must cross the inner band before reacquisition.
      if(o.foe&&!inside(pos(o.foe),core,zone.outer))(o.edge??=new WeakSet()).add(o.foe);
      const reachable=local.filter(p=>{
        if(!o.edge?.has(p.e))return true;
        if(p.rank>1&&p.range>zone.outer-.8)return false;
        o.edge.delete(p.e);return true;
      });
      const picked=pick(h,reachable,previous),foe=picked?.e;
      o.foe=foe;o.reach=h.cls==='fighter'&&foe?.E.fly?FT.jpRange:range;
      if(foe)previous=foe;
      const current=dist(pos(h),core);
      if(current>zone.outer)o.state='RETURN';
      else if(o.state!=='RETURN'||current<=zone.enter)o.state=foe?'ENGAGE':'DEFEND';
      h.aiTgt=foe||null;
      const side=active.pair?(i===0?-1:1):0,ally=active.pair?heroes[1-i]:null;
      if(h.hardHold){stopPath(h);}
      else if(o.state==='RETURN'||o.state==='DEFEND')order(h,o,homes(active,ranged,zone,side));
      else{
        order(h,o,engagePoints(h,ally,foe,ranged,o.reach,core,zone,side));
      }
      if(o.state!=='RETURN')useAutoSkill(h,{
        enemies:[...local,...aim.filter(t=>t.range>zone.outer)].map(t=>t.e),
        priorityTarget:picked?.rank<=1||picked?.approach>0&&picked.range/picked.approach<=2.2?foe:null,
        allowCast:(k,s,t)=>allowDefenseCast(h,zone,k,s,t)
      });
      remember(h,o);
    });
  });
}
export function runStageAutoCombat(dt){
  if(!wave()){clearStageAutoCombat();return false;}
  if(G.paused||G.navigating||G.chooseWait||G.coreHp<=0||!G.hero||!Number.isFinite(dt)||dt<=0)return false;
  const both=!!pair(),h=G.hero;
  if(!sameStage(active)||active.pair!==both||!both&&active.hero!==h){
    clearStageAutoCombat();
    active={...setupMap(),hero:h,pair:both,stage:G.stage,tiles:G.tiles,until:0,orders:new Map(),seen:new WeakMap()};
  }
  active.until-=dt;
  if(active.until>0)return false;
  active.until=THINK;
  defend();
  return true;
}
