// One bounded preparation turn. Uses the same actions, prices and route checks
// as the player's tool buttons; no forced stats, rewards or placement rules.
import { G } from '../core/state.js';
import { CORE, SPAWNS, GW, GH, S, T, isBlock, inGrid, toTile } from '../core/grid.js';
import { canBuild, clearCost, occupied } from '../combat/build.js';
import { TOWERS } from '../data/towers.js';
import { towerStats } from '../data/growth.js';
import { endgameTowerMods } from '../data/endgame-research.js';
import { advTowerMods } from '../data/advance.js';
import { tileAt } from '../world/terrain.js';
import { dijkstra, nextStep } from '../world/pathfinding.js';
import { chooseBranch } from '../world/growth.js';
import { repairCost, repairTower, upgradeTower } from '../world/towers.js';
import { towerAvailable, towerSpecializable, towerUpgradeBlock, towerUpgradeCost } from '../world/tower-rules.js';
import { build } from './input.js';

const TYPES=['arrow','magic','cannon','guardian'], MAX_ACTIONS=4, MAX_PROBES=22;
const CORE_BUILD_RADIUS_SQ=9;
const key=(c,r)=>c*GH+r;
const branches={arrow:'snipe',magic:'storm',cannon:'blast',guardian:'guardian_bulwark'};

function traceRoutes() {
  const points=[];
  for(const [lane,[startC,startR]] of SPAWNS.entries()){
    const route=[],seen=new Set();
    let c=startC,r=startR;
    for(let i=0;i<GW*GH&&inGrid(c,r)&&!seen.has(key(c,r));i++){
      seen.add(key(c,r));route.push([c,r]);
      if(c===CORE[0]&&r===CORE[1])break;
      const next=nextStep(c,r); if(!next)break;
      [c,r]=next;
    }
    if(route.length<2)continue;
    for(const [i,[x,z]] of route.entries())points.push({x,z,lane,weight:(.76+.62*i/(route.length-1))/Math.max(1,SPAWNS.length)});
  }
  return points;
}
function coverage(c,r,range,points,towers) {
  let score=0;const lim=range/S,rr=lim*lim;
  for(const {x,z,weight} of points){
    const d=(x-c)**2+(z-r)**2;if(d>=rr)continue;
    let nearby=0;
    for(const tw of towers){const ar=(tw.S?.range || TOWERS[tw.type].range[0])/S;if((tw.c-x)**2+(tw.r-z)**2<ar*ar)nearby++;}
    score+=weight*(1-.45*d/rr)/(1+.12*nearby);
  }
  return score;
}
function clusterFit(c,r,range,points,live,served) {
  if(!live.length)return 1;
  let near=Infinity,underserved=0;
  for(const tw of live)near=Math.min(near,(tw.c-c)**2+(tw.r-r)**2);
  const rr=(range/S)**2;
  for(const {x,z,weight,lane} of points)if(!served[lane]&&(x-c)**2+(z-r)**2<rr)underserved+=weight;
  // Prefer a defensible cluster over scattered towers, but give an uncovered
  // second lane precedence over crowding the original approach.
  return 1+.46/(1+near*.13)+Math.min(.68,underserved*.27);
}
function siteOptions(points, live, gold) {
  const types=TYPES.filter(type=>towerAvailable(type,G)&&gold>=TOWERS[type].cost);
  const count=Object.fromEntries(TYPES.map(type=>[type,live.filter(tw=>tw.type===type).length]));
  const n=live.length, early=G.wave<3, out=[];
  const served=SPAWNS.map((_p,lane)=>points.some(p=>p.lane===lane&&live.some(tw=>{
    const r=(tw.S?.range||TOWERS[tw.type].range[0])/S;
    return (tw.c-p.x)**2+(tw.r-p.z)**2<r*r;
  })));
  for(const type of types){
    const D=TOWERS[type],mods=endgameTowerMods(G.research,type,G.adv?advTowerMods(G.adv,type):undefined,G.beamAttackResearch);
    const stats=towerStats(type,1,null,mods,1);
    // Cheap reliable air coverage first; slow and AoE are more valuable when
    // they supplement something that already covers the lane.
    const need=type==='arrow'?(n===0?1.52:count.arrow===0?1.36:1.02)
      :type==='magic'?(count.magic===0?(n?1.47:1.02):1.11)
      :type==='cannon'?(count.cannon===0&&n>=2?1.40:early?.84:1.08)
      :count.guardian===0&&n>=3?1.34:.83;
    const strength=Math.pow(Math.max(1,stats.dmg*stats.rate)/(D.dmg[0]*D.rate[0]),.35);
    for(let c=0;c<GW;c++)for(let r=0;r<GH;r++){
      const t=tileAt(c,r), ground=t.t===T.GRASS;
      if(t.tower||t.bar||(!ground&&!isBlock(t.t)))continue;
      const clear=ground?0:clearCost(t);
      if(D.cost+clear>gold||(!ground&&!towerAvailable('clear',G)))continue;
      const cover=coverage(c,r,stats.range,points,live);
      if(cover<=0)continue;
      const overlap=live.reduce((sum,tw)=>sum+((tw.c-c)**2+(tw.r-r)**2<=1 ? .065 : 0),0);
      const cluster=clusterFit(c,r,stats.range,points,live,served);
      const priority=cover*need*strength*cluster/(1+.14*count[type]+overlap+clear/(D.cost*2.4));
      const coreDistance=(c-CORE[0])**2+(r-CORE[1])**2;
      const zone=coreDistance<=CORE_BUILD_RADIUS_SQ?(ground?0:1):2;
      out.push({c,r,t,type,clear,priority,coreDistance,zone});
    }
  }
  // Build on nearby open land first. If those slots are unusable, open a
  // nearby block before spreading out. Coverage still decides equal distances.
  return out.sort((a,b)=>a.zone-b.zone||a.coreDistance-b.coreDistance||b.priority-a.priority||a.clear-b.clear||a.c-b.c||a.r-b.r||TYPES.indexOf(a.type)-TYPES.indexOf(b.type));
}

function keepsRoutes(t) {
  const D=dijkstra(t), reaches=([c,r])=>Number.isFinite(D[key(c,r)]);
  return SPAWNS.every(reaches)&&G.enemies.every(e=>e.dead||e.E.fly||reaches(e.tile)&&(!e.next||reaches(e.next)));
}
function use(tool,c,r) {
  const previous=G.tool;
  try { G.tool=tool; return build(c,r); }
  finally { G.tool=previous; }
}
function tryPlace(points,live,budget,gold) {
  const rejected=new Set(), party=new Set();
  for(const h of G.heroes||[])if(h?.g&&h.dead<=0){
    const [c,r]=toTile(h.g.position.x,h.g.position.z);if(inGrid(c,r))party.add(key(c,r));
  }
  for(const site of siteOptions(points,live,gold)){
    if(budget.probes>=MAX_PROBES)return null;
    const {c,r,t,type,clear}=site;
    const k=key(c,r);if(rejected.has(k)||party.has(k)||occupied(c,r))continue;
    budget.probes++;
    if(clear){
      // Check the *final* occupied terrain before paying to clear; no clear
      // for a chokepoint that would strand a portal or an existing enemy.
      if(!canBuild(c,r,'clear')||!keepsRoutes(t)){rejected.add(k);continue;}
      if(!use('clear',c,r))continue;
      if(!use(type,c,r))return {built:0,cleared:1};
      return {built:1,cleared:1};
    }
    if(!canBuild(c,r,type)||(G.enemies.length&&!keepsRoutes(t))){rejected.add(k);continue;}
    if(use(type,c,r))return {built:1,cleared:0};
  }
  return null;
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
  const cash=G.gold-cashReserve(live);
  if(cash<55||!growthTarget(live,cash))return null;
  const choice=strategicUpgrade(traceRoutes(),live,cash);
  return choice&&upgradeTower(choice)?'upgrade':null;
}
export function autoBuildStage() {
  const out={built:0,cleared:0,upgraded:0,specialized:0,repaired:0,probes:0};
  if(!G.stage?.id||G.phase!=='build'||G.practice||G.practiceSandbox||G.dungeon||G.coreHp<=0||G.paused||G.navigating||!G.D)return out;
  let points=traceRoutes(),live=G.towers.filter(liveTower),spend=0;
  if(protectTower(live,null,0)){out.repaired++;spend++;}
  while(out.specialized<MAX_ACTIONS&&selectSpec(live))out.specialized++;
  for(;spend<MAX_ACTIONS;spend++){
    const cash=G.gold-(live.length>=2?cashReserve(live):0);
    // Anchor early defense with two towers. Afterwards upgrade a proven lane
    // tower before buying another Lv1. Keep a modest combat repair purse.
    const upgrade=live.length>=2?strategicUpgrade(points,live,cash):null;
    if(upgrade&&upgradeTower(upgrade)){
      out.upgraded++;
      if(out.specialized<MAX_ACTIONS&&towerSpecializable(upgrade,false)&&chooseBalanced(upgrade,live))out.specialized++;
      continue;
    }
    const result=tryPlace(points,live,out,prepCash(live));
    if(result){
      out.built+=result.built;out.cleared+=result.cleared;
      points=traceRoutes();live=G.towers.filter(liveTower);continue;
    }
    const fallback=live.length===1?strategicUpgrade(points,live,G.gold-cashReserve(live)):null;
    if(fallback&&upgradeTower(fallback)){out.upgraded++;continue;}
    break;
  }
  return out;
}
