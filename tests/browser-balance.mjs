// Isolated progression diagnostics: ordinary costs, damage and XP; accelerated time.
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8785'||G.gear.Acc.A.mode!=='guest'||G.gear.Acc.A.user)throw Error('Disposable guest only');};
export function seed(profile='fixed',chapter=5){guard();const{Acc,E,P}=G.gear;let n=42;const r=()=> (n=n*16807%2147483647)/2147483647,s=P.empty();s.hero='mage';s.heroLv.mage.hp=s.heroLv.mage.atk=10;s.settings.audio={...G.Snd.cfg,bgmOn:false,sfxOn:false};const trained=profile==='trained',gear=profile==='fixed'?4:chapter-1;for(const slot of E.SLOT_KEYS){const it=E.makeItem(slot,'mage',3,r,gear);it.e=5;s.inv.push(it);s.eq.mage[slot]=it.id;}for(const row of Object.values(s.research)){row.atk=profile==='fixed'?3:Math.min(10,(trained?5:3)+(chapter-5)*2);row.rng=profile==='fixed'?1:Math.min(5,chapter-(trained?3:4));row.spd=profile==='fixed'?2:chapter-(trained?2:3);row.efficiency=trained?Math.max(0,chapter-5):0;}for(let c=1;c<=8;c++)for(let i=1;i<=6;i++)s.st[`${c}-${i}`]=3;Acc.update(()=>s);sessionStorage.setItem('qa_balance_profile',JSON.stringify({profile,chapter,gear,research:s.research,heroLv:s.heroLv.mage,equipmentBonus:E.bonus(s,'mage'),grade:3,enhance:5}));return s;}
export function state(){return{stage:G.stage.id,wave:G.wave,phase:G.phase,core:G.coreHp,gold:Math.floor(G.gold),hero:Math.round(G.hero.hp),enemies:G.enemies.filter(e=>!e.dead).length,queue:G.spawnQ?.length,towers:G.towers.map(t=>({c:t.c,r:t.r,type:t.type,lvl:t.lvl,xp:Math.floor(t.xp),branch:t.branch,hp:Math.round(t.hp)})),stats:structuredClone(G.stats)};}
export function prepare(){guard();G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();G.setAutoSkill(true,true);G.qaRun=[];G.qaActions=[];return state();}
// Place towers around the final approach. Each purchase uses the normal game API.
export function shop(){guard();
 const spread=JSON.parse(sessionStorage.getItem('qa_balance_profile')).profile.endsWith('-spread');
 for(const t of G.towers) if(t.hp<t.max*.6)G.repairTower(t);
 for(const t of G.towers){if(t.branchPending)G.chooseBranch(t,t.type==='magic'?(G.towers.some(q=>q.branch==='frost')?'storm':'frost'):t.type==='arrow'?'snipe':'blast');}
 const [cc,rr]=G.CORE;
 const routes=[];for(const sp of G.SPAWNS){let p=sp,seen=new Set();for(let i=0;i<400;i++){const key=p.join();if(seen.has(key))break;seen.add(key);routes.push(p);if(p[0]===cc&&p[1]===rr)break;p=G.nextStep(...p);if(!p)break;}}
 const air=[];for(const sp of G.SPAWNS)for(let i=0;i<=16;i++)air.push([sp[0]+(cc-sp[0])*i/16,sp[1]+(rr-sp[1])*i/16]);
 const candidates=[];for(let c=0;c<G.GW;c++)for(let r=0;r<G.GH;r++){const d=Math.hypot(c-cc,r-rr);if(d<1.5||d>5||(spread&&G.towers.some(t=>Math.hypot(c-t.c,r-t.r)<1.9)))continue;const clear=!!G.buildReason(c,r,'magic');if(clear&&(G.gold<160||G.buildReason(c,r,'clear')))continue;const coverage=routes.reduce((sum,p)=>sum+(Math.hypot(c-p[0],r-p[1])<3.7?1:0),0);const airCoverage=air.reduce((sum,p)=>sum+(Math.hypot(c-p[0],r-p[1])<3.7?1:0)/(1+G.towers.filter(t=>Math.hypot(t.c-p[0],t.r-p[1])<3.7).length),0);const crowd=G.towers.reduce((sum,t)=>sum+(Math.hypot(c-t.c,r-t.r)<2.2?4:0),0);candidates.push({c,r,clear,score:coverage*.7+airCoverage*3-d-crowd-(clear?2:0)});}candidates.sort((a,b)=>b.score-a.score);
 if(G.towers.length<3 || (G.towers.length<9&&G.wave>3&&G.gold>(spread?140:200))) {
  const type=G.towers.length%3===1?'arrow':'magic',best=candidates.find(p=>p.clear||!G.buildReason(p.c,p.r,type));
  if(best?.clear&&G.build(best.c,best.r,'clear'))G.qaActions.push({wave:G.wave,clear:[best.c,best.r]});
  if(best&&G.build(best.c,best.r,type))G.qaActions.push({wave:G.wave,build:[best.c,best.r,type]});
 }
 for(const t of [...G.towers].sort((a,b)=>b.xp-a.xp))if(t.lvl<5&&G.gold>(spread&&G.towers.length<5?180:120)&&!G.GROW.upgradeBlock(t,G.gold)){if(G.upgradeTower(t))G.qaActions.push({wave:G.wave,upgrade:[t.c,t.r,t.lvl]});}
 if(G.gold>200&&G.towers.length>=5)for(const k of ['atk','skill','spd'])if(G.ups[k]<(k==='atk'?4:2)){const before=G.ups[k];document.querySelector(`.up[data-up="${k}"]`).click();if(G.ups[k]>before)G.qaActions.push({wave:G.wave,heroUpgrade:k});break;}
 const [x,z]=G.tileXZ(cc,rr);if(G.phase==='build')G.heroGoTo(x,z);return state();
}
export function advance(seconds=12){guard();G.manual=true;for(let i=0;i<seconds*2;i++){if(G.phase!=='wave')break;G.sim(.5);if(G.hero.hp<G.hero.max*.35&&G.hero.warpCd<=0)G.startWarp();}const s=state();if(s.phase!=='wave')G.qaRun.push(s);return s;}
export function result(){return{...state(),waves:G.qaRun,actions:G.qaActions,muted:!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn,baseline:JSON.parse(sessionStorage.getItem('qa_balance_profile')),strategy:JSON.parse(sessionStorage.getItem('qa_balance_profile')).profile.endsWith('-spread')?'spread-reserve':'fixed-cluster',time:G.t,upgrades:{...G.ups},waveLog:structuredClone(G.waveLog),clear:G.coreHp>0&&G.wave===G.stage.waves&&G.phase==='over',bossKilled:G.runBossKills};}

export function wave(){guard();shop();shop();shop();if(G.phase==='build')G.startWave();for(let t=0;t<360&&G.phase==='wave';t+=6){advance(6);shop();}return state();}

export async function run(){prepare();for(let w=0;w<G.stage.waves&&G.phase!=='over';w++){shop();shop();shop();if(G.phase==='build')G.startWave();for(let t=0;t<600&&G.phase==='wave';t+=6){advance(6);shop();await new Promise(r=>setTimeout(r,0));}parent.qaProgress?.(state());if(G.phase==='wave')throw Error('Wave stalled after 600 simulated seconds');await new Promise(r=>setTimeout(r,0));}return result();}
