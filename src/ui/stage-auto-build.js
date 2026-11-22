// One bounded preparation turn. Uses the same actions, prices and route checks
// as the player's tool buttons; no forced stats, rewards or placement rules.
import { G } from '../core/state.js';
import { CORE, DIRS, SPAWNS, GW, GH, S, T, isBlock, inGrid, toTile } from '../core/grid.js';
import { canBuild, clearCost, occupied } from '../combat/build.js';
import { TOWERS } from '../data/towers.js';
import { towerStats } from '../data/growth.js';
import { endgameTowerMods } from '../data/endgame-research.js';
import { advTowerMods } from '../data/advance.js';
import { tileAt } from '../world/terrain.js';
import { dijkstra, enterCost, nextStep } from '../world/pathfinding.js';
import { chooseBranch } from '../world/growth.js';
import { repairCost, repairTower, upgradeTower } from '../world/towers.js';
import { towerAvailable, towerSpecializable, towerUpgradeBlock, towerUpgradeCost } from '../world/tower-rules.js';
import { build } from './input.js';

const TYPES=['arrow','magic','cannon','guardian'], MAX_ACTIONS=4, MAX_PROBES=22;
const key=(c,r)=>c*GH+r;
const branches={arrow:'snipe',magic:'storm',cannon:'blast',guardian:'guardian_bulwark'};

const clamp01=n=>Math.max(0,Math.min(1,n));
const dist2=(x,z,u,v)=>(x-u)**2+(z-v)**2;
const SITE_MIN=42, GOOD_SITE=58;
let structure=null;
const rangeSq=tw=>((tw.S?.range||TOWERS[tw.type].range[0])/S)**2;

// Routes and buildable geometry are shared by all scoring passes until the
// engine invalidates terrain (build, excavation, enemy digging, destruction).
function traceRoutes(D=G.D,block=null) {
  const points=[], routes=[], prospective=!!block;
  const forward=(c,r)=>{
    if(!prospective)return nextStep(c,r);
    let best=null,cost=Infinity;
    for(const [dc,dr] of DIRS){
      const x=c+dc,z=r+dr;if(!inGrid(x,z))continue;
      const tile=tileAt(x,z);if(tile===block)continue;
      const score=enterCost(tile)+D[key(x,z)];
      if(score<cost){cost=score;best=[x,z];}
    }
    return best;
  };
  for(const [lane,[startC,startR]] of SPAWNS.entries()){
    const route=[],seen=new Set();
    let c=startC,r=startR;
    for(let i=0;i<GW*GH&&inGrid(c,r)&&!seen.has(key(c,r));i++){
      seen.add(key(c,r));route.push([c,r]);
      if(c===CORE[0]&&r===CORE[1])break;
      const next=forward(c,r);if(!next)break;
      [c,r]=next;
    }
    if(route.length<2||c!==CORE[0]||r!==CORE[1])return null;
    const length=route.length-1;routes.push(route);
    for(const [i,[x,z]] of route.entries())points.push({x,z,lane,steps:length-i,weight:(.76+.62*i/length)/Math.max(1,SPAWNS.length)});
  }
  return {points,routes,D};
}
function battlefield() {
  if(structure?.tiles===G.tiles&&structure.D===G.D&&structure.version===G.structVer)return structure;
  const flow=traceRoutes(),sites=[],used=new Set(flow?.points.map(p=>key(p.x,p.z)));
  if(flow)for(let c=0;c<GW;c++)for(let r=0;r<GH;r++){
    if(Math.max(Math.abs(c-CORE[0]),Math.abs(r-CORE[1]))<=1)continue;
    const t=tileAt(c,r),ground=t.t===T.GRASS;
    if(t.tower||t.bar||(!ground&&!isBlock(t.t)))continue;
    sites.push({c,r,t,ground,clear:ground?0:clearCost(t),extend:expansion(c,r),onRoute:used.has(key(c,r))});
  }
  return structure={tiles:G.tiles,D:G.D,version:G.structVer,flow,sites,candidates:new Map()};
}
function coverage(c,r,range,points,towers) {
  let score=0;const lim=range/S,rr=lim*lim;
  for(const {x,z,weight} of points){
    const d=dist2(x,z,c,r);if(d>=rr)continue;
    let nearby=0;
    for(const tw of towers){const ar=(tw.S?.range||TOWERS[tw.type].range[0])/S;if(dist2(tw.c,tw.r,x,z)<ar*ar)nearby++;}
    score+=weight*(1-.45*d/rr)/(1+.12*nearby);
  }
  return score;
}
const reaches=(D,[c,r])=>Number.isFinite(D[key(c,r)]);
function prospect(field,site) {
  const k=key(site.c,site.r);
  if(field.candidates.has(k))return field.candidates.get(k);
  const D=dijkstra(site.t), flow=SPAWNS.every(p=>reaches(D,p))?traceRoutes(D,site.t):null;
  field.candidates.set(k,flow);return flow;
}
function lanePressure(flow,live) {
  const threat=flow.routes.map(path=>1+Math.min(.42,5/Math.max(8,path.length)));
  // Nearby existing enemies tell us where coverage is urgently missing, but
  // never remove other entrances from consideration once the field is quiet.
  for(const e of G.enemies){
    if(e.dead||e.E?.fly||!e.tile)continue;
    let lane=-1,best=10;
    for(const [i,route] of flow.routes.entries())for(const [x,z] of route){
      const d=dist2(x,z,e.tile[0],e.tile[1]);
      if(d<best){lane=i;best=d;}
    }
    if(lane>=0)threat[lane]+=(e.E?.boss||e.elite) ? .32 : .08;
  }
  const lanes=threat.length;
  for(let lane=0;lane<lanes;lane++){
    let covered=0,count=0;
    for(const p of flow.points)if(p.lane===lane&&p.steps>0&&p.steps<=10){
      count++;
      if(live.some(t=>dist2(t.c,t.r,p.x,p.z)<rangeSq(t)))covered++;
    }
    threat[lane]=Math.min(2,threat[lane])*(count?1+.38*(1-covered/count):1);
  }
  const sum=threat.reduce((a,b)=>a+b,0)||1;
  return threat.map(n=>n/sum);
}
function expansion(c,r) {
  let free=0;
  for(const [dc,dr] of DIRS){
    const x=c+dc,z=r+dr;if(!inGrid(x,z)||Math.max(Math.abs(x-CORE[0]),Math.abs(z-CORE[1]))<=1)continue;
    const t=tileAt(x,z);if(t.tower||t.bar)continue;
    if(t.t===T.GRASS)free+=1;
    else if(isBlock(t.t))free+=.48;
  }
  return clamp01(free/3);
}
function role(type,live,n) {
  let same=0,air=0;for(const tw of live){if(tw.type===type)same++;if(TOWERS[tw.type].air)air++;}
  if(!air&&type==='arrow')return 1.3;
  if(!n&&type!=='arrow')return .58;
  if(type==='magic')return same===0?(n===1?1.58:1.32):1.06;
  if(type==='cannon')return same===0&&n>=2?1.2:.89;
  if(type==='guardian')return same===0&&n>=3?1.68:.87;
  return same===0?1.1:n===1?.81:1.02;
}
function fireLanes(flow,ctx){
  let lanes=ctx.overlaps.get(flow);
  if(!lanes){
    const ranges=ctx.live.map(t=>[t.c,t.r,rangeSq(t)]);
    lanes=flow.points.map(p=>{
      let overlap=0;
      for(const [c,r,rr] of ranges)if(dist2(c,r,p.x,p.z)<rr)overlap++;
      return 1/(1+.16*overlap);
    });
    ctx.overlaps.set(flow,lanes);
  }
  return lanes;
}
function evaluate(flow,ctx,site,type) {
  const {live,threat,stats,gold,outer}=ctx, {c,r,clear,extend}=site, S0=stats[type];
  const dc=c-CORE[0],dr=r-CORE[1], core=Math.hypot(dc,dr), rr=(S0.range/S)**2;
  const near=site.near;
  if(core>Math.min(8.2,Math.max(5.5,outer+2.25))||(live.length&&near>20&&core>4))return null;
  let direction=0,nearbyPath=Infinity;
  const hits=Array(threat.length).fill(0);
  const synergy=fireLanes(flow,ctx);
  for(const [i,p] of flow.points.entries()){
    if(p.steps===0)continue;
    const d=dist2(c,r,p.x,p.z);
    if(p.steps>=2&&p.steps<=10&&d<=16){
      const x=p.x-CORE[0],z=p.z-CORE[1],radius=Math.hypot(x,z);
      if(radius){
        const face=(dc*x+dr*z)/(core*radius);
        // A far-away point on another meander is not the entry side here.
        if(face>0.17){direction=Math.max(direction,face*(1-d/23));nearbyPath=Math.min(nearbyPath,d);}
      }
    }
    if(d>=rr)continue;
    hits[p.lane]+=(1-.53*d/rr)*(p.steps<=11?1:.45)*synergy[i];
  }
  // Retreat-side or distant grass is not a valid fallback. Consider a second
  // or third row only while it stays tied to the defended approach.
  if(direction<.14||nearbyPath>9||Math.max(...hits)<1.3)return null;
  const D=TOWERS[type],strength=Math.min(1.26,Math.pow(Math.max(1,S0.dmg*S0.rate)/(D.dmg[0]*D.rate[0]),.34));
  const w=ctx.role[type]*strength;
  const path=hits.reduce((sum,n,i)=>sum+threat[i]*clamp01(n/5),0);
  const front=clamp01(direction), defend=clamp01(1-(core-2)/7);
  const compact=live.length?clamp01(1-(Math.sqrt(near)-1)/4):.65;
  const further=live.length?clamp01((core-outer+1.3)/3):.64;
  const spread=clamp01(.6*extend+.4*further);
  const price=2.2*clamp01((D.cost+clear)/Math.max(130,gold))+10*clamp01(clear/65);
  const isolated=live.length?Math.max(0,(Math.sqrt(near)-2.2)*3):0;
  const pathDefense=.87*clamp01(path*w)+.13*clamp01(w/1.7);
  const score=35*pathDefense+25*defend+20*compact+10*front+10*spread-price-isolated;
  return {score,path,core};
}
function siteOptions(field,live,gold,allowed=TYPES) {
  if(!field.flow)return {good:[],dig:[],fallback:[]};
  const types=allowed.filter(type=>towerAvailable(type,G)&&gold>=TOWERS[type].cost);
  const stats=Object.fromEntries(types.map(type=>{
    const mods=endgameTowerMods(G.research,type,G.adv?advTowerMods(G.adv,type):undefined,G.beamAttackResearch);
    return [type,towerStats(type,1,null,mods,1)];
  }));
  if(!types.length)return {good:[],dig:[],fallback:[]};
  const ctx={live,threat:lanePressure(field.flow,live),stats,gold,overlaps:new Map(),
    outer:live.reduce((max,t)=>Math.max(max,Math.hypot(t.c-CORE[0],t.r-CORE[1])),0),
    role:Object.fromEntries(types.map(k=>[k,role(k,live,live.length)]))};
  const good=[],dig=[],fallback=[],canDig=towerAvailable('clear',G);
  for(const site of field.sites){
    const {ground,clear}=site;
    const near=live.reduce((min,t)=>Math.min(min,dist2(t.c,t.r,site.c,site.r)),Infinity);
    const opts={...site,near};
    for(const type of types){
      // If a useful dig cannot yet be paired with a legal purchase, do not
      // substitute a lower-ranked convenience build. Wait and earn the gold.
      if(!ground&&!canDig)continue;
      const result=evaluate(field.flow,ctx,opts,type);if(!result||result.score<SITE_MIN)continue;
      const row={...opts,...result,score:result.score-(site.onRoute?7:0),type,affordable:TOWERS[type].cost+clear<=gold};
      const atFront=live.length||result.core<=3.15;
      (ground?(row.score>=GOOD_SITE&&atFront?good:fallback):dig).push(row);
    }
  }
  const sort=(a,b)=>b.score-a.score||a.clear-b.clear||a.c-b.c||a.r-b.r||TYPES.indexOf(a.type)-TYPES.indexOf(b.type);
  return {good:good.sort(sort),dig:dig.sort(sort),fallback:fallback.sort(sort),ctx};
}
function use(tool,c,r) {
  const previous=G.tool;
  try { G.tool=tool;return build(c,r); }
  finally { G.tool=previous; }
}
function tryPlace(field,live,budget,gold,allowed) {
  const rejected=new Set(),party=new Set(),{good,dig,fallback,ctx}=siteOptions(field,live,gold,allowed);
  for(const h of G.heroes||[])if(h?.g&&h.dead<=0){
    const [c,r]=toTile(h.g.position.x,h.g.position.z);if(inGrid(c,r))party.add(key(c,r));
  }
  const check=(sites,{unaffordable=false,min=SITE_MIN}={})=>{
    let best=null,checks=0;
    const checked=new Set();
    for(const site of sites){
      if(budget.probes>=MAX_PROBES||checks>=7)break;
      const {c,r,clear,type,affordable}=site,k=key(c,r);
      if(affordable===unaffordable||rejected.has(k)||party.has(k)||occupied(c,r))continue;
      if(best&&site.score<best.score-6)break;
      if(!checked.has(k)){budget.probes++;checks++;checked.add(k);}
      const flow=prospect(field,site);
      if(!flow||G.enemies.some(e=>!e.dead&&!e.E.fly&&(!reaches(flow.D,e.tile)||(e.next&&!reaches(flow.D,e.next))))){rejected.add(k);continue;}
      const after=evaluate(flow,ctx,site,type);if(!after||after.score<SITE_MIN||after.path<site.path*.55)continue;
      let detour=0;
      for(const [i,[x,z]] of SPAWNS.entries()){
        const k=key(x,z),base=field.flow.D[k];
        detour+=ctx.threat[i]*clamp01(Math.max(0,flow.D[k]-base)/Math.max(4,base*.55));
      }
      const score=after.score-14*detour-(site.onRoute?7:0);
      if(score>=min&&(!best||score>best.score))best={...site,score};
    }
    return best;
  };
  // Good already-open frontage first, then a useful excavation. Only use a
  // weaker but defensible existing lot if no useful clearing site remains.
  const best=check(good,{min:GOOD_SITE})||check(dig)||(!check(dig,{unaffordable:true})&&check(fallback));
  if(!best)return null;
  const {c,r,clear,type}=best;
  if(!clear)return use(type,c,r)?{built:1,cleared:0}:null;
  if(!canBuild(c,r,'clear')||!use('clear',c,r))return null;
  // Clearing has changed the engine path. Re-read the real, matching field
  // before handing the tower build back to the same manual tool.
  const fresh=battlefield();
  if(!fresh.flow||!use(type,c,r))return {built:0,cleared:1};
  return {built:1,cleared:1};
}
// The ordinary tools remain the sole authority for prices, health and growth.
const MAINTAIN_INTERVAL=.4, EVOLVE_INTERVAL=1.6;
let maintenance=null, growthPlan=null;
const complements={arrow:'multi',magic:'frost',cannon:'pierce',guardian:'guardian_assault'};
function plan() {
  const token=G.xpRun?.token;
  if(!growthPlan||growthPlan.towers!==G.towers||growthPlan.token!==token)growthPlan={towers:G.towers,token,lead:null,lastXP:0,lastGrowthWave:G.wave};
  return growthPlan;
}
function chooseBalanced(tower,live) {
  const a=branches[tower.type],b=complements[tower.type];
  let na=0,nb=0;
  for(const t of live)if(t.type===tower.type){if(t.branch===a)na++;else if(t.branch===b)nb++;}
  return chooseBranch(tower,na<=nb?a:b);
}
const liveTower=t=>!t.dead&&t.hp>0&&t.max>0;
const needsEarlyMagic=live=>G.wave<=2&&live.some(t=>t.type==='arrow')&&!live.some(t=>t.type==='magic');
const MAGIC_FRONT_BUDGET=TOWERS.magic.cost+35; // one ordinary rock, not a special wall
const enabled=phase=>G.stage?.id&&G.phase===phase&&!G.practice&&!G.practiceSandbox&&!G.dungeon&&G.coreHp>0&&!G.paused&&!G.navigating;
function cashReserve(live) {
  let invested=0;
  for(const t of live)invested=Math.max(invested,t.invest||0);
  return Math.min(120,Math.max(25,Math.ceil(invested*.19)));
}
function protectTower(live,session,clock) {
  const reserve=cashReserve(live), already=session?.spent||0;
  let best=null,bestScore=0;
  for(const tw of live){
    const health=tw.hp/tw.max, critical=health<=.45;
    if(health>(tw.lvl>1?.76:.69))continue;
    const last=session?.repaired.get(tw)??-Infinity;
    if(clock-last<(critical?.8:1.8))continue;
    const cost=repairCost(tw);
    if(!(cost>0)||cost>G.gold-(critical?0:reserve))continue;
    // A tower in immediate danger can use more of the purse, but repeated
    // repairs still cannot drain every kill's income during the same wave.
    if(session&&already+cost>Math.max(35,Math.floor((G.gold+already)*(critical?.68:.44))))continue;
    const value=Math.log2(2+(tw.invest||TOWERS[tw.type].cost)/60);
    const score=(critical?2:0)+(1-health)*2+value*.52
      +(tw.type==='magic'?.42:0)+(tw.branch?.2:0)-cost*.007;
    if(score>bestScore){best=tw;bestScore=score;}
  }
  if(!best)return false;
  const paid=repairTower(best,true);
  if(!(paid>0))return false;
  if(session){session.spent+=paid;session.repaired.set(best,clock);}
  return true;
}
function combatPower(type,stats) {
  let utility=1;
  if(type==='magic')utility=1+.25*Math.min(6,stats.chain-1)+.9*stats.slow;
  else if(type==='cannon')utility=stats.splash?1.25+.13*stats.splash:1.2;
  return stats.dmg*stats.rate*utility;
}
function strategicUpgrade(points,live,cash) {
  const p=plan(), covers=t=>coverage(t.c,t.r,t.S?.range||TOWERS[t.type].range[t.lvl-1],points,[])>0;
  if(live.includes(p.lead)&&p.lead.lvl<5&&covers(p.lead)){
    if((p.lead.xp||0)>p.lastXP){p.lastXP=p.lead.xp;p.lastGrowthWave=G.wave;}
    if(p.lead.lvl>=3&&!p.lead.branch&&!towerSpecializable(p.lead,false)&&G.wave-p.lastGrowthWave>=2)p.lead=null;
  }else p.lead=null;
  if(p.lead){
    // A short cash shortage isn't a reason to spend on a different tower.
    if(!towerUpgradeBlock(p.lead,cash,false))return p.lead;
    // While the lead needs combat XP, put only surplus gold into its backup.
    // The lead remains selected and resumes immediately once it qualifies.
    if(p.lead.lvl<3||p.lead.branch)return null;
    cash-=towerUpgradeCost(p.lead,false);
  }
  let best=null,bestScore=0;
  for(const tw of live){
    if(towerUpgradeBlock(tw,cash,false))continue;
    const target=tw.lvl+1;
    const cost=towerUpgradeCost(tw,false);
    if(!(cost>0&&cost<=cash))continue;
    const from=tw.S||towerStats(tw.type,tw.lvl,tw.branch,tw.mods,tw.stars);
    const to=towerStats(tw.type,target,tw.branch,tw.mods,tw.stars);
    const gain=combatPower(tw.type,to)-combatPower(tw.type,from);
    const role=tw.type==='magic'?(target<=3?1.9:1.45):1;
    const investment=1+.15*(tw.lvl-1)+.06*((tw.stars||1)-1);
    const score=coverage(tw.c,tw.r,to.range,points,[])*(1+Math.max(0,gain))*role*investment/(cost+30);
    if(score>bestScore){best=tw;bestScore=score;}
  }
  if(best&&!p.lead){p.lead=best;p.lastXP=best.xp||0;p.lastGrowthWave=G.wave;}
  return best;
}
function growthTarget(live,cash) {
  return live.some(t=>!towerUpgradeBlock(t,cash,false));
}
function prepCash(live) {
  const reserve=live.length>=2?cashReserve(live):0;
  const lead=plan().lead;
  // Building is a fallback, not a way to spend the lead's next upgrade.
  return G.gold-reserve-(live.includes(lead)&&lead.lvl<5?towerUpgradeCost(lead,false):0);
}
function selectSpec(live) {
  let chosen=null,score=-Infinity;
  for(const tw of live)if(towerSpecializable(tw,false)){
    const priority=(tw===plan().lead?4:0)+(tw.type==='magic'?2:0)+tw.hp/tw.max;
    if(priority>score){chosen=tw;score=priority;}
  }
  return chosen&&chooseBalanced(chosen,live);
}
export function autoMaintainStageTowers(dt) {
  if(!enabled('wave')||!G.D||!(dt>0))return null;
  const token=G.xpRun?.token;
  if(!maintenance||maintenance.towers!==G.towers||maintenance.wave!==G.wave||maintenance.token!==token)
    maintenance={towers:G.towers,token,wave:G.wave,clock:0,check:0,evolve:0,spent:0,repaired:new WeakMap()};
  const m=maintenance;
  m.clock+=dt;
  if(m.clock<m.check)return null;
  m.check=m.clock+MAINTAIN_INTERVAL;
  const live=G.towers.filter(liveTower);
  if(protectTower(live,m,m.clock))return 'repair';
  if(m.clock<m.evolve)return null;
  m.evolve=m.clock+EVOLVE_INTERVAL;
  if(selectSpec(live))return 'specialize';
  const cash=G.gold-cashReserve(live)-(needsEarlyMagic(live)?MAGIC_FRONT_BUDGET:0);
  if(cash<55||!growthTarget(live,cash))return null;
  const choice=strategicUpgrade(battlefield().flow?.points||[],live,cash);
  return choice&&upgradeTower(choice)?'upgrade':null;
}
export function autoBuildStage() {
  const out={built:0,cleared:0,upgraded:0,specialized:0,repaired:0,probes:0};
  if(!G.stage?.id||G.phase!=='build'||G.practice||G.practiceSandbox||G.dungeon||G.coreHp<=0||G.paused||G.navigating||!G.D)return out;
  let field=battlefield(),points=field.flow?.points||[],live=G.towers.filter(liveTower),spend=0;
  if(protectTower(live,null,0)){out.repaired++;spend++;}
  while(out.specialized<MAX_ACTIONS&&selectSpec(live))out.specialized++;
  for(;spend<MAX_ACTIONS;spend++){
    const cash=G.gold-(live.length>=2?cashReserve(live):0);
    const earlyMagic=needsEarlyMagic(live);
    // A cluster needs chain/slow early; a legal cannon can be affordable first
    // on an excavated front, but consumes almost the entire magic budget.
    const magicCash=G.gold-(live.length>=2?15:0);
    let result=earlyMagic?tryPlace(field,live,out,magicCash,['magic']):null;
    // Anchor early defense with two towers. Afterwards upgrade a proven lane
    // tower before buying another Lv1. Keep a modest combat repair purse.
    const upgrade=!result&&live.length>=2?strategicUpgrade(points,live,cash-(earlyMagic?MAGIC_FRONT_BUDGET:0)):null;
    if(upgrade&&upgradeTower(upgrade)){
      out.upgraded++;
      if(out.specialized<MAX_ACTIONS&&towerSpecializable(upgrade,false)&&chooseBalanced(upgrade,live))out.specialized++;
      continue;
    }
    if(!result)result=earlyMagic
      ?(live.length===1?tryPlace(field,live,out,cash,['arrow']):null)
      :tryPlace(field,live,out,prepCash(live));
    if(result){
      out.built+=result.built;out.cleared+=result.cleared;
      field=battlefield();points=field.flow?.points||[];live=G.towers.filter(liveTower);continue;
    }
    const fallback=live.length===1?strategicUpgrade(points,live,G.gold-cashReserve(live)):null;
    if(fallback&&upgradeTower(fallback)){out.upgraded++;continue;}
    break;
  }
  return out;
}
