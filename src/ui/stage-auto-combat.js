import { G } from '../core/state.js';
import { CORE, tileX, tileZ } from '../core/grid.js';
import { clearOrders } from '../data/hard-party.js';
import { FT } from '../data/fighter.js';
import { dungeonRole } from '../data/dungeon.js';
import { skillBusy } from '../core/autoskill.js';
import { withHero, heroGoTo, passAt, stat } from '../heroes/hero.js';
import { runSupportAI } from '../heroes/hard-party.js';
import { useAutoSkill } from '../heroes/autoskill.js';

const THINK = .45, SEP = 2.4;
const d2 = (a,b) => (a.x-b.x)**2+(a.z-b.z)**2;
const pos = o => o.g.position;
const alive = h => h && h.dead <= 0;
let active = null;

const wave = () => G.phase==='wave' && G.screen!=='town' && !G.practice && !G.dungeon && !!G.stage;
const pair = () => G.stage?.hard && G.hardParty && G.heroes?.length===2 && G.heroes.includes(G.hero);
const sameStage = a => a && a.stage===G.stage && a.tiles===G.tiles;
export const stageAutoOwnsHardPair = () => !!(sameStage(active) && active.pair && pair() && wave());

function release(h,old) {
  // A manual move after the last decision may have replaced this array.
  if(h.path===old.path)clearOrders(h);
  else{
    if(h.aiTgt===old.focus)h.aiTgt=null;
    if(h.aiGoal===old.goal)h.aiGoal=null;
    h.aiT=0;
  }
}
export function clearStageAutoCombat() {
  const old=active;active=null;
  if(!sameStage(old))return;
  for(const [h,orders] of old.orders)
    if(h===G.hero||(old.pair&&G.heroes.includes(h)))release(h,orders);
}
// An unstuck replan is the same order, unlike a new manual click.
export function trackStageAutoRepath(h, oldPath) {
  if(!stageAutoOwnsHardPair())return;
  const orders=active.orders.get(h);
  if(orders?.path===oldPath)orders.path=h.path;
}
function remember(h) {
  active.orders.set(h,{path:h.path,focus:h.aiTgt,goal:h.aiGoal});
}
function order(h,at) {
  if(!at){h.path=[];h.aiGoal=null;return;}
  if(!h.path.length||!h.aiGoal||d2(h.aiGoal,at)>1.2**2){
    heroGoTo(at);h.aiGoal=at;
  }
}
function selectThreat(h,enemies,other,core) {
  let best=null,score=Infinity;
  for(const e of enemies){
    if(h.cls==='warrior'&&e.E.fly)continue; // No ground melee chase against an air-only wave.
    const point=pos(e),dupe=e===other?19:0;
    // Protect enemies heading into the core, but avoid chasing an opposite
    // lane if a nearer attackable target needs attention immediately.
    const value=d2(point,pos(h))*.55+d2(point,core)*.8+dupe;
    if(value<score){best=e;score=value;}
  }
  return best;
}
function tacticalPoint(h,ally,e,ranged,range,core,side){
  if(!e)return null;
  const from=pos(h),target=pos(e),near=alive(ally)?pos(ally):null,dist=d2(from,target);
  const tooNear=ranged&&dist<Math.min(3,range*.42)**2;
  const stacked=!!(ranged&&near&&d2(from,near)<SEP**2);
  if(!tooNear&&!stacked&&dist<(range*.88)**2)return null;
  let ax=core.x-target.x,az=core.z-target.z,l=Math.hypot(ax,az);
  if(l<.1){ax=from.x-target.x;az=from.z-target.z;l=Math.hypot(ax,az);}
  if(l<.1){ax=1;az=0;l=1;}
  ax/=l;az/=l;
  const radius=range*.72,angles=ranged?[.52,.90,.18,1.28,0]:[.46,.78,.16,1.1,0];
  let fallback=null;
  for(const angle of angles){
    const c=Math.cos(angle),s=Math.sin(angle)*side;
    const p={x:target.x+radius*(ax*c-az*s),y:0,z:target.z+radius*(az*c+ax*s)};
    if(!passAt(p.x,p.z))continue;
    fallback??=p;
    if(!ranged||!near||d2(near,p)>=SEP**2)return p;
  }
  return fallback??{x:target.x,y:0,z:target.z}; // Native pathfinding finds a reachable nearby tile.
}
function runPair(){
  const heroes=G.heroes,core={x:tileX(CORE[0]),z:tileZ(CORE[1])};
  const enemies=G.enemies.filter(e=>!e.dead&&e.dying===undefined&&!(e.immT>G.t)&&e.state!=='spawn');
  let previous=null;
  for(const [i,h] of heroes.entries()){
    if(!alive(h)||h.warpT>0)continue;
    withHero(h,()=>{
      if(h.hardHold){clearOrders(h);useAutoSkill(h);remember(h);return;}
      if(skillBusy(h)||h.ft?.jp)return; // Keep a native palm charge stationary until released.
      const ally=heroes[1-i],role=dungeonRole(h.cls,h.adv);
      const dragon=h.cls==='fighter'&&h.adv?.k==='dragon';
      const ranged=role==='ranged'||role==='caster';
      const target=selectThreat(h,enemies,previous,core);
      const range=(dragon||h.cls==='fighter'&&target?.E.fly)?FT.jpRange:stat.range();
      if(target)previous=target;
      h.aiTgt=target;
      order(h,tacticalPoint(h,ally,target,ranged,range,core,i===0?-1:1));
      useAutoSkill(h);
      remember(h);
    });
  }
}

export function runStageAutoCombat(dt) {
  if(!wave()){clearStageAutoCombat();return false;}
  if(G.paused||G.navigating||G.chooseWait||G.coreHp<=0||!G.hero||!Number.isFinite(dt)||dt<=0)return false;
  const both=!!pair(),h=G.hero;
  if(!sameStage(active)||active.pair!==both||!both&&active.hero!==h){
    clearStageAutoCombat();
    active={hero:h,pair:both,stage:G.stage,tiles:G.tiles,until:0,orders:new Map()};
  }
  if(!both&&(!alive(h)||h.warpT>0))return false;
  active.until-=dt;
  if(active.until>0)return false;
  active.until=THINK;
  if(both)runPair();
  else{
    h.aiT=0;
    withHero(h,()=>runSupportAI(h,dt));
    remember(h);
  }
  return true;
}
