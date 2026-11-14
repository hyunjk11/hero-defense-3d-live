// Explicit RAM-only engine probes. Not loaded by the product entrypoint.
import {G} from '../src/core/state.js';
import {switchHardHero,toggleHardHold,startHardParty,updateHardParty,prepareHardParty} from '../src/heroes/hard-party.js';
import {keys,mouseGround} from '../src/ui/input.js';
import {withHero,heroGoTo,stat,heroDamage,spawnHero,setControlled} from '../src/heroes/hero.js';
import {castSkill} from '../src/heroes/skills.js';
import {castLegend} from '../src/heroes/legend.js';
import {movementAllowed} from '../src/data/hard-party.js';
import {buyFocus} from '../src/data/hero-growth.js';
import {ADV,advOf} from '../src/data/advance.js';
import {changeTree,treeOptions,treeBuild} from '../src/data/skill-tree.js';
import {disposeHeroModel} from '../src/render/characters.js';
import {camera} from '../src/render/scene.js';
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8990'||!window.__isolatedReview?.memoryOnly)throw Error('RAM QA only');};
const near=(a,b)=>Math.abs(a-b)<1e-6;
const tick=n=>{for(let i=0;i<n;i++)G.sim(1/60,1/60);};
export async function boundaries(){
 guard();if(G.phase!=='build'||G.heroes.length!==2||G.enemies.length)throw Error('empty two-hero build phase required');
 G.manual=true;const out=[],check=(name,ok,data={})=>{out.push({name,ok,data});if(!ok)throw Error(name);};
 const [a,b]=G.heroes;
 try{
  check('duplicate party initialization does not add a third hero',startHardParty(G.xpRun)===false&&G.heroes.length===2);
  keys.w=true;keys.q=true;a.path=[a.g.position.clone().add(new G.THREE.Vector3(-5,0,0))];a.aiTgt={};b.path=[b.g.position.clone()];
  check('switch clears old/new path, held keys and stale target',switchHardHero(1)&&!keys.w&&!keys.q&&!a.path.length&&!b.path.length&&!a.aiTgt);
  check('aim belongs to the newly controlled hero',mouseGround.distanceTo(b.g.position)<=5.00001&&mouseGround.distanceTo(b.g.position)>=4.99999);
  check('hold command succeeds',toggleHardHold(1)&&b.hardHold);
  const at=b.g.position.clone();withHero(b,()=>heroGoTo(at.clone().add(new G.THREE.Vector3(-10,0,0))));keys.a=true;tick(30);keys.a=false;
  check('held controlled hero ignores path and keyboard movement',b.g.position.distanceTo(at)<1e-6&&!b.path.length);
  switchHardHero(0);tick(30);check('hold persists after switching and blocks follower AI',b.hardHold&&b.g.position.distanceTo(at)<1e-6);
  toggleHardHold(1);check('release clears stale AI decisions',movementAllowed(b)&&b.aiT===0&&!b.aiGoal&&!b.aiTgt);
  G.paused=true;check('pause blocks switch and hold',!switchHardHero(1)&&!toggleHardHold(0));G.paused=false;
  a.warpT=.5;a.warpFx={visible:true};toggleHardHold(0);check('hold cancels an uncommitted warp',a.warpT===0&&!a.warpFx.visible);a.warpFx=null;toggleHardHold(0);
  a.skillCd=b.skillCd=10;a.lcd=b.lcd=10;tick(60);
  check('each hero Q and E cooldown ticks exactly once',G.heroes.every(h=>near(h.skillCd,9)&&near(h.lcd,9)),G.heroes.map(h=>({cls:h.cls,q:h.skillCd,e:h.lcd})));
  toggleHardHold(0);const hp=a.hp;heroDamage(a.max*100,a);updateHardParty(.01);
  check('controlled death switches to the living hero',a.dead>0&&G.hero===b&&!switchHardHero(0));
  heroDamage(b.max*100,b);updateHardParty(.01);check('both dead does not select a dead replacement or end the run',b.dead>0&&G.phase==='build'&&!switchHardHero(0));
  tick(302);check('five-second revival preserves per-hero hold',a.dead<=0&&b.dead<=0&&a.hp===a.max&&b.hp===b.max&&a.hardHold&&!b.hardHold);
  switchHardHero(0);toggleHardHold(0);const before=G.heroes.map(h=>withHero(h,()=>({dmg:stat.dmg(),hp:h.hp,q:h.skillCd,e:h.lcd}))),gold=G.gold;
  check('focus purchase uses one existing team cost',buyFocus(G)&&G.gold===gold-40&&G.focus===1);
  check('focus strengthens both without healing or cooldown reset',G.heroes.every((h,i)=>withHero(h,()=>near(stat.dmg()/before[i].dmg,1.04)&&h.hp===before[i].hp&&h.skillCd===before[i].q&&h.lcd===before[i].e)));
  const phase=G.phase;G.phase='over';check('results block party commands',!switchHardHero(1)&&!toggleHardHold(0));G.phase=phase;
  return out;
 }finally{await fetch('/__result',{method:'POST',body:JSON.stringify({case:{device:'party-boundaries'},kind:'RAM injected state; actual modules and fixed 1/60 engine',checks:out,errors:window.__isolatedReview.errors})});}
}

export async function heldCombat(){
 guard();G.manual=true;G.autoSkill=false;G.onXPWave=null;G.onRunEnd=null;
 const h=G.heroes.find(h=>h.cls==='archer');
 if(!h)throw Error('archer fixture required');
 for(const h of G.heroes){if(!h.hardHold)toggleHardHold(G.heroes.indexOf(h));h.cd=0;h.skillCd=1e9;h.lcd=1e9;}
 const positions=G.heroes.map(h=>h.g.position.clone()),before=G.heroes.map(h=>h.dm.tot);
 const p=G.heroes[0].g.position,e=G.spawnEnemy('grunt',10000,{tile:[...G.CORE],x:p.x-2,z:p.z});e.stunT=100;e.hp=e.max=1e9;
 tick(300);
 const result={case:{device:'party-held-combat'},kind:'injected stationary target; actual attacks and engine',heroes:G.heroes.map((h,i)=>({hero:h.cls,distance:h.g.position.distanceTo(positions[i]),damage:h.dm.tot-before[i]}))};
 result.pass=result.heroes.every(h=>h.distance<1e-6&&h.damage>0);
 await fetch('/__result',{method:'POST',body:JSON.stringify(result)});if(!result.pass)throw Error('held attack failed');return result;
}

export async function spellMatrix(){
 guard();G.manual=true;G.autoSkill=false;G.onXPWave=null;G.onRunEnd=null;G.partyAI=null;G.hardParty=null;
 const out=[],resource=[];
 const cleanup=()=>{for(const h of G.heroes)h.dead=1e9;for(const e of [...G.enemies])G.hurt(e,1e15);tick(900);for(const h of G.heroes){h.hb.dispose();disposeHeroModel(h.ch);}G.heroes=[];G.hero=null;};
 const loadout=(h,b,choice)=>{let trees={};if(b)for(const tier of [15,20,30,40,50])trees=changeTree(trees,h,b,50,0,tier,treeOptions(h,b,tier)[choice].id);return{perm:{hp:10,atk:10},equip:{},legend:null,adv:advOf(h,b?{b,n:1}:null),heroLevel:50,heroTree:treeBuild(trees,h,b,50),heroGear:[]};};
 try{
  for(const cls of Object.keys(ADV).filter(h=>h!=='mechanic'))for(const branch of [null,...Object.keys(ADV[cls])])for(const choice of (branch?[0,1]:[0])){
   cleanup();const spare=cls==='warrior'?'mage':'warrior',L=loadout(cls,branch,choice),run={party:[cls,spare],loadouts:{[cls]:L,[spare]:loadout(spare,null,0)}};
   await prepareHardParty(run);const caster=spawnHero(cls,L,false),other=spawnHero(spare,run.loadouts[spare],true);setControlled(caster);G.phase='build';G.screen='game';G.growthEnabled=true;
   for(const h of G.heroes){h.hardHold=true;h.cd=1e9;}other.skillCd=other.lcd=1e9;
   const p=caster.g.position,targets=[-1,0,1].map(d=>{const e=G.spawnEnemy('grunt',10000,{tile:[...G.CORE],x:p.x-2,z:p.z+d});e.hp=e.max=1e9;e.stunT=100;return e;}),aim=targets[1].g.position.clone();
   // A released caster uses Q and E, then the other actor becomes controlled before effects land.
   caster.hardHold=false;caster.skillCd=0;withHero(caster,()=>castSkill(aim));const qCast=caster.skillCd>0;setControlled(other);tick(360);
   const qDamage=caster.dm.sk,qWrong=other.dm.sk;caster.lcd=0;caster.atkT=0;caster.autoSkillUntil=0;
   const eCast=withHero(caster,()=>castLegend(aim));setControlled(other);tick(540);
   const row={cls,branch,choice,qCast,eCast,qDamage,eDamage:caster.dm.sk-qDamage,wrongOwner:other.dm.sk,heldControl:other.hardHold,remainingProjectiles:G.projs.length};
   row.pass=qCast&&eCast&&qDamage>0&&row.eDamage>0&&qWrong===0&&row.wrongOwner===0;out.push(row);
   if(!row.pass)throw Error('spell matrix '+JSON.stringify(row));
   cleanup();resource.push({cls,branch,choice,bars:G.BARS.length,scene:G.scene.children.length,projs:G.projs.length,timers:G.timers.length,renderer:{...G.renderer.info.memory}});
   await new Promise(r=>setTimeout(r,0));
  }
  return{checks:out,resource};
 }finally{await fetch('/__result',{method:'POST',body:JSON.stringify({case:{device:'party-spell-matrix'},kind:'RAM constructed Lv50/10+10/no equipment actors; real Q/E and ownership after control switch; not balance play',checks:out,resource,errors:window.__isolatedReview.errors})});}
}

export async function resources(cycles=12){
 guard();G.manual=true;G.phase='build';G.autoSkill=false;G.onXPWave=null;G.onRunEnd=null;G.partyAI=null;G.hardParty=null;
 const rows=[],render=()=>G.renderer.render(G.scene,camera);
 const clean=()=>{for(const h of G.heroes)h.dead=1e9;for(const e of [...G.enemies])G.hurt(e,1e15);tick(1200);for(const h of G.heroes){h.hb.dispose();disposeHeroModel(h.ch);}G.heroes=[];G.hero=null;render();};
 const L=(h,b)=>({perm:{hp:10,atk:10},equip:{},legend:null,adv:advOf(h,{b,n:1}),heroLevel:35,heroTree:null,heroGear:[]});
 const run={party:['mage','fighter'],loadouts:{mage:L('mage','flame'),fighter:L('fighter','dragon')}};await prepareHardParty(run);clean();const baselineBars=G.BARS.length;
 for(let i=0;i<cycles;i++){
  const mage=spawnHero('mage',run.loadouts.mage,false),fighter=spawnHero('fighter',run.loadouts.fighter,true);G.phase='build';G.screen=null;G.growthEnabled=true;setControlled(mage);
  for(const h of G.heroes){h.cd=1e9;h.hardHold=true;}const p=mage.g.position,aim=p.clone();aim.x-=3;
  for(const d of [-1,0,1]){const e=G.spawnEnemy('grunt',10000,{tile:[...G.CORE],x:aim.x,z:aim.z+d});e.hp=e.max=1e9;e.stunT=100;}
  const casts=[];for(const h of G.heroes)withHero(h,()=>{castSkill(aim);casts.push({hero:h.cls,q:h.skillCd>0});});tick(45);render();tick(315);
  for(const [j,h] of G.heroes.entries())withHero(h,()=>{casts[j].e=castLegend(aim);});tick(45);render();const peak={...G.renderer.info.memory};tick(600);clean();
  rows.push({cycle:i+1,casts,peak,after:{...G.renderer.info.memory},programs:G.renderer.info.programs.length,dom:document.getElementsByTagName('*').length,scene:G.scene.children.length,bars:G.BARS.length,projs:G.projs.length,timers:G.timers.length});await new Promise(r=>setTimeout(r,0));
 }
 const steady=rows.slice(2),first=steady[0],pass=steady.every(r=>r.casts.every(c=>c.q&&c.e)&&r.after.geometries===first.after.geometries&&r.after.textures===first.after.textures&&r.programs===first.programs&&r.dom===first.dom&&r.scene===first.scene&&r.bars===baselineBars&&!r.projs&&!r.timers);
 const result={case:{device:'party-resource-cycles'},kind:'12 RAM spawn/Q/E/render/cleanup cycles; 2 warmups excluded; existing core/tower bars preserved; no forced GC or production session',baselineBars,pass,rows,errors:window.__isolatedReview.errors};await fetch('/__result',{method:'POST',body:JSON.stringify(result)});return result;
}
