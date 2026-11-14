import {setDmgCap} from '/src/render/vfx.js';
// Isolated progression diagnostics: ordinary costs, damage and XP; accelerated time.
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8990'||!window.__isolatedReview?.memoryOnly)throw Error('RAM QA only');};
export function state(){if(!Number.isFinite(G.hero.hp)||!Number.isFinite(G.coreHp)||G.enemies.some(e=>!Number.isFinite(e.hp)))throw Error('Invalid combat HP');return{stage:G.stage.id,wave:G.wave,phase:G.phase,core:G.coreHp,gold:Math.floor(G.gold),hero:Math.round(G.hero.hp),enemies:G.enemies.filter(e=>!e.dead).length,queue:G.spawnQ?.length,towers:G.towers.map(t=>({c:t.c,r:t.r,type:t.type,lvl:t.lvl,xp:Math.floor(t.xp),branch:t.branch,hp:Math.round(t.hp)})),stats:structuredClone(G.stats)};}
function originalPrepare({settle=false}={}){guard();if(!settle){G.onXPWave=null;G.onRunEnd=null;}const m=JSON.parse(sessionStorage.getItem('qa_balance_profile'));if(m.deterministic){let seed=(+new URLSearchParams(location.search).get('rng')||12345)^0x9e3779b9;Math.random=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};setDmgCap(-1);}G.qaInitial={hero:G.hero.cls,max:G.hero.max,dmg:G.hero.C.dmg,rate:G.hero.C.rate,range:G.hero.C.range,perm:structuredClone(G.perm),equip:structuredClone(G.equip),research:structuredClone(G.research),adv:G.adv?.k||null,core:G.coreHp,gold:G.gold};G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();G.setAutoSkill(true,true);G.pauseRender=true;G.qaRun=[];G.qaActions=[];G.qaPeakElite=0;return state();}
// Place towers around the final approach. Each purchase uses the normal game API.
export function shop(){guard();
 const strategy=JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy||'spread',spread=!['cluster','control'].includes(strategy);
 for(const t of G.towers) if(t.hp<t.max*.6)G.repairTower(t);
 for(const t of G.towers){if(t.branchPending)G.chooseBranch(t,t.type==='magic'?(G.towers.some(q=>q.branch==='frost')?'storm':'frost'):t.type==='arrow'?(strategy==='mobile'?'multi':'snipe'):(strategy==='bastion'?'pierce':'blast'));}
 const [cc,rr]=G.CORE;
 const routes=[];for(const sp of G.SPAWNS){let p=sp,seen=new Set();for(let i=0;i<400;i++){const key=p.join();if(seen.has(key))break;seen.add(key);routes.push(p);if(p[0]===cc&&p[1]===rr)break;p=G.nextStep(...p);if(!p)break;}}
 const air=[];for(const sp of G.SPAWNS)for(let i=0;i<=16;i++)air.push([sp[0]+(cc-sp[0])*i/16,sp[1]+(rr-sp[1])*i/16]);
 const candidates=[];for(let c=0;c<G.GW;c++)for(let r=0;r<G.GH;r++){const d=Math.hypot(c-cc,r-rr);if(d<1.5||d>5||(spread&&G.towers.some(t=>Math.hypot(c-t.c,r-t.r)<1.9)))continue;const clear=!!G.buildReason(c,r,'magic');if(clear&&(G.gold<160||G.buildReason(c,r,'clear')))continue;const coverage=routes.reduce((sum,p)=>sum+(Math.hypot(c-p[0],r-p[1])<3.7?1:0),0);const airCoverage=air.reduce((sum,p)=>sum+(Math.hypot(c-p[0],r-p[1])<3.7?1:0)/(1+G.towers.filter(t=>Math.hypot(t.c-p[0],t.r-p[1])<3.7).length),0);const crowd=G.towers.reduce((sum,t)=>sum+(Math.hypot(c-t.c,r-t.r)<2.2?4:0),0);candidates.push({c,r,clear,score:coverage*.7+airCoverage*3-d-crowd-(clear?2:0)});}candidates.sort((a,b)=>b.score-a.score);
 if(G.towers.length<3 || (G.towers.length<9&&G.wave>3&&G.gold>(spread?140:200))) {
  const type=strategy==='control'?(G.towers.length%4===3?'cannon':'magic'):strategy==='mobile'?(G.towers.length%3===0?'magic':'arrow'):['mixed','defend','intercept','bastion'].includes(strategy)?['magic','arrow','cannon'][G.towers.length%3]:G.towers.length%3===1?'arrow':'magic',best=candidates.find(p=>p.clear||!G.buildReason(p.c,p.r,type));
  if(best?.clear&&G.build(best.c,best.r,'clear'))G.qaActions.push({wave:G.wave,clear:[best.c,best.r]});
  if(best&&G.build(best.c,best.r,type))G.qaActions.push({wave:G.wave,build:[best.c,best.r,type]});
 }
 for(const t of [...G.towers].sort((a,b)=>b.xp-a.xp))if(t.lvl<5&&G.gold>(spread&&G.towers.length<5?180:120)&&!G.GROW.upgradeBlock(t,G.gold)){if(G.upgradeTower(t))G.qaActions.push({wave:G.wave,upgrade:[t.c,t.r,t.lvl]});}
 if(G.growthEnabled&&G.gold>200&&G.towers.length>=5&&G.focus<3){const n=G.focus;document.querySelector('.up[data-up=focus]').click();if(G.focus>n)G.qaActions.push({wave:G.wave,focus:G.focus});}
 const [x,z]=G.tileXZ(cc,rr);if(G.phase==='build')G.heroGoTo(x,z);return state();
}
export function advance(seconds=12){guard();if(window.qaDisableE)G.hero.lcd=1e9;G.manual=true;for(let i=0;i<seconds*2;i++){if(G.phase!=='wave')break;if(JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy&&['mobile','bastion'].includes(JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy)&&G.hero.dead<=0&&G.hero.warpT<=0&&G.hero.hp>G.hero.max*.35){const cp=new G.THREE.Vector3(...[G.tileXZ(...G.CORE)[0],0,G.tileXZ(...G.CORE)[1]]);const threat=G.enemies.filter(e=>!e.dead&&!e.E.fly&&e.g.position.distanceTo(cp)<16).sort((a,b)=>a.g.position.distanceTo(cp)-b.g.position.distanceTo(cp))[0];if(threat)G.heroGoTo(threat.g.position.x,threat.g.position.z);}if(JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy==='focus'&&G.hero.dead<=0&&G.hero.warpT<=0&&G.hero.skillCd<=0&&G.hero.atkT<=0){const support=G.enemies.filter(e=>!e.dead&&e.state!=='spawn'&&['swamp_mender','repair_drone','sand_priest','storm_caller'].includes(e.type)&&e.g.position.distanceTo(G.hero.g.position)<=16).sort((a,b)=>a.g.position.distanceTo(G.hero.g.position)-b.g.position.distanceTo(G.hero.g.position))[0];if(support){G.castSkill(support.g.position);G.qaActions.push({wave:G.wave,focus:support.type,time:G.t});}}if(JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy==='defend'&&G.hero.dead<=0&&G.hero.warpT<=0){
 const cp=new G.THREE.Vector3(G.tileXZ(...G.CORE)[0],0,G.tileXZ(...G.CORE)[1]);
 const target=G.enemies.filter(e=>!e.dead&&e.state!=='spawn'&&!e.E.fly).sort((a,b)=>{const score=e=>e.g.position.distanceTo(cp)-(e.type==='siege'||e.type==='magmagolem'?8:0);return score(a)-score(b);})[0];
 if(target){const p=target.g.position,from=G.hero.g.position,d=p.distanceTo(from);if(d>6)G.heroGoTo(p.x,p.z);if(d<=16&&G.hero.skillCd<=0&&G.hero.atkT<=0)G.castSkill(p);if(d<=14&&G.hero.lcd<=0&&G.hero.atkT<=0)G.castLegend(p);}
 }
 if(JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy==='intercept'&&G.hero.dead<=0&&G.hero.warpT<=0){
  const cp=new G.THREE.Vector3(G.tileXZ(...G.CORE)[0],0,G.tileXZ(...G.CORE)[1]),from=G.hero.g.position;
  const warning=G.enemies.find(e=>e.hardCast&&Math.hypot(from.x-e.hardCast.p.x,from.z-e.hardCast.p.z)<4.3);
  if(warning){const p=warning.hardCast.p,dx=from.x-p.x,dz=from.z-p.z,len=Math.hypot(dx,dz)||1;G.heroGoTo(p.x+(dx||1)/len*5,p.z+dz/len*5);}
  else {const target=G.enemies.filter(e=>!e.dead&&e.state!=='spawn'&&(!e.E.fly||G.hero.cls!=='warrior')).sort((a,b)=>{const score=e=>e.g.position.distanceTo(cp)-(['siege','firebomber'].includes(e.type)?10:0);return score(a)-score(b);})[0];
   if(target){const p=target.g.position,d=p.distanceTo(from);if(d>(G.hero.cls==='warrior'?2.5:6))G.heroGoTo(p.x,p.z);if(d<=16&&G.hero.skillCd<=0&&G.hero.atkT<=0)G.castSkill(p);if(d<=14&&G.hero.lcd<=0&&G.hero.atkT<=0)G.castLegend(p);}
  }
 }for(let frame=0;frame<30;frame++)G.sim(1/60,1/60);G.qaPeakElite=Math.max(G.qaPeakElite,G.enemies.filter(e=>!e.dead&&e.E.hardElite).length);if(G.hero.hp<G.hero.max*.35&&G.hero.warpCd<=0)G.startWarp();}const s=state();if(s.phase!=='wave')G.qaRun.push(s);return s;}
export function result(){return{...state(),initial:G.qaInitial,survivors:G.enemies.filter(e=>!e.dead).map(e=>({type:e.type,hp:Math.round(e.hp),max:Math.round(e.max),x:e.g.position.x,z:e.g.position.z,state:e.state})),waves:G.qaRun,actions:G.qaActions,muted:!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn,baseline:JSON.parse(sessionStorage.getItem('qa_balance_profile')),strategy:JSON.parse(sessionStorage.getItem('qa_balance_profile')).strategy||'spread',tree:G.hero.tree,hardPulseHits:G.hardPulseHits||0,peakElite:G.qaPeakElite,equipmentProc:G.hero.lsk,legendProcs:{...G.legendN},harness:'hard-tree-2-counter',deterministic:!!JSON.parse(sessionStorage.getItem('qa_balance_profile')).deterministic,time:G.t,upgrades:{...G.ups},focus:G.focus,level:G.hero.C.level||1,completedWaves:G.completedWaves,waveLog:structuredClone(G.waveLog),clear:G.coreHp>0&&G.wave===G.stage.waves&&G.phase==='over',bossKilled:G.runBossKills};}

export function wave(){guard();shop();shop();shop();if(G.phase==='build')G.startWave();for(let t=0;t<360&&G.phase==='wave';t+=6){advance(6);shop();}return state();}

export async function run(options){originalPrepare(options);for(let w=0;w<G.stage.waves&&G.phase!=='over';w++){shop();shop();shop();if(G.phase==='build')G.startWave();for(let t=0;t<600&&G.phase==='wave';t+=6){advance(6);shop();await new Promise(r=>setTimeout(r,0));}parent.qaProgress?.(state());if(G.phase==='wave')throw Error('Wave stalled after 600 simulated seconds');await new Promise(r=>setTimeout(r,0));}return result();}

export async function fixture({count=2,seed=12345}={}){
 guard();if(G.phase!=='build'||G.wave!==0||G.heroes.length!==2)throw Error('fresh initialized two-hero stage required');G.manual=true;G.t=0;G.onXPWave=null;G.onRunEnd=null;G.onStageClear=()=>{G.phase='over';};
 const [{prepareHardParty,startHardParty},{spawnHero,setControlled},{disposeHeroModel},E,AD,T]=await Promise.all([import('/src/heroes/hard-party.js'),import('/src/heroes/hero.js'),import('/src/render/characters.js'),import('/src/account/equip.js'),import('/src/data/advance.js'),import('/src/data/skill-tree.js')]);
 const profile=await (await fetch('/tests/hard-party-profile.json')).json(),s=profile.save;
 for(const h of G.heroes){h.hb.dispose();disposeHeroModel(h.ch);}G.heroes=[];G.hardParty=null;G.partyAI=null;
 let trees={};for(const tier of [15,20,30])trees=T.changeTree(trees,'mage','flame',31,0,tier,T.treeOptions('mage','flame',tier)[0].id);
 const main={perm:s.heroLv.mage,equip:E.bonus(s,'mage'),legend:E.legendOf(s,'mage'),adv:AD.advOf('mage',{b:'flame',n:1}),heroLevel:31,heroTree:T.treeBuild(trees,'mage','flame',31),heroGear:s.inv.filter(x=>Object.values(s.eq.mage||{}).includes(x.id))};
 const sub={perm:{hp:0,atk:0},equip:{},legend:null,adv:null,heroLevel:15,heroTree:null,heroGear:[]};
 const run={party:['mage','fighter'],loadouts:{mage:main,fighter:sub}};await prepareHardParty(run);Object.assign(G,main);G.research=structuredClone(s.research);G.focus=0;G.advBar=AD.advBarMul(main.adv);spawnHero('mage',main,false);if(count===2)startHardParty(run);G.growthEnabled=true;
 const baseline={...profile.baseline,deterministic:true,strategy:'mixed',count,seed,sub:{hero:'fighter',level:15,perm:sub.perm,equip:{},adv:null},xp:{main:20400,sub:5040,total:25440,sourceBudget:27662},assumptions:'normal54-clears generated gear/research; unlocked hard and mage flame advancement assumed; subLv15 naked/0+0. No live save or reward. Same main/towers/strategy in solo and duo.'};
 sessionStorage.setItem('qa_balance_profile',JSON.stringify(baseline));return baseline;
}
export async function runCase(spec){
 const baseline=await fixture(spec),initial=structuredClone(G.heroes.map(h=>({cls:h.cls,max:h.max,C:h.C,equipment:h.eq,legend:h.lsk,adv:h.adv,tree:h.tree}))),wall=performance.now();
 const r=await run({settle:false});r.wallMs=performance.now()-wall;r.initialActors=initial;r.actors=G.heroes.map(h=>({cls:h.cls,hp:h.hp,deaths:h.dm.deaths,damage:structuredClone(h.dm)}));r.case={...spec,stage:G.stage.id,device:`exact-impact-${G.stage.id}-${spec.count}-${spec.seed}`};r.harness='exact 1/60 engine frames; actual damage/costs; headless render; seeded post-init RNG; setup injected RAM; not normal-time human play';
 r.url=location.href;r.fixedInitialTime=0;await fetch('/__result',{method:'POST',body:JSON.stringify(r)});return r;
}
export async function waitRunCase(spec){
 for(let i=0;i<200;i++){if(G.phase==='build'&&G.heroes.length===2)return runCase(spec);await new Promise(r=>setTimeout(r,50));}
 throw Error('QA stage initialization timeout; no battle started');
}
