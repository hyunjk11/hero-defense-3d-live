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
const key=(c,r)=>c*GH+r;
const branches={arrow:'snipe',magic:'storm',cannon:'blast',guardian:'guardian_bulwark'};

function traceRoutes() {
  const points=[];
  for(const [startC,startR] of SPAWNS){
    const route=[],seen=new Set();
    let c=startC,r=startR;
    for(let i=0;i<GW*GH&&inGrid(c,r)&&!seen.has(key(c,r));i++){
      seen.add(key(c,r));route.push([c,r]);
      if(c===CORE[0]&&r===CORE[1])break;
      const next=nextStep(c,r); if(!next)break;
      [c,r]=next;
    }
    if(route.length<2)continue;
    for(const [i,[x,z]] of route.entries())points.push({x,z,weight:(.76+.62*i/(route.length-1))/Math.max(1,SPAWNS.length)});
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
function siteOptions(points, live) {
  const types=TYPES.filter(type=>towerAvailable(type,G)&&G.gold>=TOWERS[type].cost);
  const count=Object.fromEntries(TYPES.map(type=>[type,live.filter(tw=>tw.type===type).length]));
  const n=live.length, early=G.wave<3, out=[];
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
      if(D.cost+clear>G.gold||(!ground&&!towerAvailable('clear',G)))continue;
      const cover=coverage(c,r,stats.range,points,live);
      if(cover<=0)continue;
      const overlap=live.reduce((sum,tw)=>sum+((tw.c-c)**2+(tw.r-r)**2<=1 ? .065 : 0),0);
      const priority=cover*need*strength/(1+.14*count[type]+overlap+clear/(D.cost*2.4));
      out.push({c,r,t,type,clear,priority});
    }
  }
  return out.sort((a,b)=>b.priority-a.priority||a.clear-b.clear||a.c-b.c||a.r-b.r||TYPES.indexOf(a.type)-TYPES.indexOf(b.type));
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
function tryPlace(points,live,budget) {
  const rejected=new Set(), party=new Set();
  for(const h of G.heroes||[])if(h?.g&&h.dead<=0){
    const [c,r]=toTile(h.g.position.x,h.g.position.z);if(inGrid(c,r))party.add(key(c,r));
  }
  for(const site of siteOptions(points,live)){
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
function bestUpgrade(points,live) {
  let best=null,score=0;
  for(const tw of live){
    if(towerUpgradeBlock(tw,G.gold,false))continue;
    const cost=towerUpgradeCost(tw,false);
    if(!Number.isFinite(cost)||cost<0||cost>G.gold)continue;
    const before=tw.S||towerStats(tw.type,tw.lvl,tw.branch,tw.mods,tw.stars);
    const after=towerStats(tw.type,tw.lvl+1,tw.branch,tw.mods,tw.stars);
    const gain=after.dmg*after.rate-Math.max(0,before.dmg*before.rate*(tw.type==='guardian'&&before.beamHeavy?1/.35:1));
    const value=coverage(tw.c,tw.r,after.range,points,[])*(1+Math.max(0,gain))/(cost+30);
    if(value>score){score=value;best=tw;}
  }
  return best;
}

export function autoBuildStage() {
  const out={built:0,cleared:0,upgraded:0,specialized:0,repaired:0,probes:0};
  if(!G.stage?.id||G.phase!=='build'||G.practice||G.practiceSandbox||G.dungeon||G.coreHp<=0||G.paused||G.navigating||!G.D)return out;
  let points=traceRoutes(), live=G.towers.filter(t=>!t.dead), spend=0;
  // Preserve a lead tower rather than abandoning the gold already invested.
  const damaged=live.filter(t=>t.hp<t.max*.54&&repairCost(t)<=Math.min(80,G.gold*.44))
    .sort((a,b)=>a.hp/a.max-b.hp/b.max)[0];
  if(damaged&&repairTower(damaged,true)>0){out.repaired++;spend++;}
  for(const tw of live){
    if(out.specialized>=MAX_ACTIONS)break;
    if(towerSpecializable(tw,false)&&chooseBranch(tw,branches[tw.type]))out.specialized++;
  }
  for(;spend<MAX_ACTIONS;spend++){
    // Start wide. Once a defended lane and a few tower roles exist, invest in
    // those towers when XP and price allow rather than only adding level ones.
    const upgradeFirst=live.length>=3&&(out.upgraded===0||live.length>=9);
    let upgrade=upgradeFirst?bestUpgrade(points,live):null;
    if(upgrade&&upgradeTower(upgrade)){out.upgraded++;continue;}
    const result=tryPlace(points,live,out);
    if(result){
      out.built+=result.built;out.cleared+=result.cleared;
      points=traceRoutes();live=G.towers.filter(t=>!t.dead);continue;
    }
    upgrade=upgradeFirst?null:bestUpgrade(points,live);
    if(upgrade&&upgradeTower(upgrade)){out.upgraded++;continue;}
    break; // Empty budget or unavailable terrain never prevents the next wave.
  }
  return out;
}
