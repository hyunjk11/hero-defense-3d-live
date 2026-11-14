await (async()=>{
 if(!['http://127.0.0.1:8952','http://127.0.0.1:8953'].includes(location.origin)||!window.__isolatedReview?.memoryOnly)throw Error('Isolated QA only');
 const driver=await import('/tests/hard45-balance-driver.mjs');
 window.h43Run=async function(options={}){
  if(G.phase!=='build'||G.wave!==0||G.t!==0||G.timers.length)throw Error('Fresh manual boot required');
  if(options.twoPortals){if(G.stage.id!=='hard-4-3')throw Error('H43 only');G.SPAWNS.splice(0,G.SPAWNS.length,[0,2],[23,14]);}
  if(options.noProc)G.hero.lsk=null;
  if(options.disableStageCaps)delete G.stage.enemyCaps;
  driver.prepare({settle:!!options.settle});window.__combatTrace?.start();
  const initial={driverVersion:7,t:G.t,timers:G.timers.length,hero:{hp:G.hero.hp,max:G.hero.max,cd:G.hero.cd,skillCd:G.hero.skillCd,lcd:G.hero.lcd,atkT:G.hero.atkT,dead:G.hero.dead},stage:G.stage.id,stageSettings:{hp:G.stage.hp,attackMul:G.stage.attackMul,enemyCaps:structuredClone(G.stage.enemyCaps),spawns:structuredClone(G.stage.spawns),startGold:G.gold},seed:new URLSearchParams(location.search).get('rng'),options};
  const events=[],repair=[],queueEvidence=[],check=options.repairEvery||6;
  let held=null,heldUntil=0;
  const {hardHit}=await import('/src/data/hard.js');
  function guard(){
   const h=G.hero;if(h.dead>0||h.warpT>0||h.ft?.leap)return;
   const from=h.g.position,cp=new G.THREE.Vector3(G.tileXZ(...G.CORE)[0],0,G.tileXZ(...G.CORE)[1]);
   const warnings=G.enemies.filter(e=>!e.dead&&e.hardCast).map(e=>e.hardCast);
   if(warnings.some(w=>hardHit(w,from))){
    const safe=[];for(let d=1;d<=8;d+=1)for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:from.x+Math.sin(a)*d,z:from.z+Math.cos(a)*d};if(warnings.every(w=>!hardHit(w,p)))safe.push(p);}
    if(safe[0])G.heroGoTo(safe[0].x,safe[0].z);return;
   }
   const targets=G.enemies.filter(e=>!e.dead&&e.state!=='spawn'&&(!e.E.fly||h.cls!=='warrior'));
   if(!held||held.dead||!targets.includes(held)||G.t>=heldUntil){
    const score=e=>e.g.position.distanceTo(cp)-(e.E.boss?7:['siege','ruinroot','swamp_mender','swamp_spitter'].includes(e.type)?4:0);
    held=targets.sort((a,b)=>score(a)-score(b))[0];heldUntil=G.t+1.5;
   }
   if(!held)return;const p=held.g.position,d=p.distanceTo(from);
   // Do not cancel a current combo/charged palm every half-second.
   if(h.atkT>0||h.ft?.jp)return;
   if(!options.autoOnly&&d<=16&&h.skillCd<=0){G.castSkill(p);return;}
   if(!options.autoOnly&&d<=9&&h.lcd<=0){G.castLegend(p);return;}
   if(d>(h.cls==='warrior'||h.cls==='fighter'&&G.adv?.k!=='dragon'?2.5:6)&&!h.path.length)G.heroGoTo(p.x,p.z);
  }
  window.h43Progress={initial,wave:0};
  function crossShop(){
   for(const t of G.towers)if(t.hp<t.max*.6)G.repairTower(t);
   for(const t of G.towers)if(t.branchPending)G.chooseBranch(t,t.type==='magic'?(G.towers.some(q=>q.branch==='frost')?'storm':'frost'):t.type==='arrow'?'snipe':'pierce');
   const [cc,rr]=G.CORE,plan=[[cc-2,rr,'magic'],[cc+2,rr,'magic'],[cc,rr-2,'arrow'],[cc,rr+2,'arrow'],[cc-3,rr-2,'cannon'],[cc+3,rr+2,'cannon']];
   for(const [pc,pr,type]of plan){
    if(G.towers.some(t=>Math.hypot(t.c-pc,t.r-pr)<1.6))continue;
    const cost=G.TOWERS[type].cost,reserve=G.towers.length>=2?40:0;if(G.gold<cost+reserve)continue;
    const cells=[];for(let c=pc-1;c<=pc+1;c++)for(let r=pr-1;r<=pr+1;r++)if(Math.hypot(c-cc,r-rr)>=1.5&&!G.towers.some(t=>Math.hypot(t.c-c,t.r-r)<1.6)){
      const clear=!!G.buildReason(c,r,type);if(clear&&(G.gold<cost+35+reserve||G.buildReason(c,r,'clear')))continue;cells.push({c,r,clear,d:Math.hypot(c-pc,r-pr)});
    }
    const best=cells.sort((a,b)=>a.d-b.d)[0];if(!best)continue;
    if(best.clear&&!G.build(best.c,best.r,'clear'))continue;
    if(G.build(best.c,best.r,type)){G.qaActions.push({wave:G.wave,crossBuild:[best.c,best.r,type]});break;}
   }
   for(const t of [...G.towers].sort((a,b)=>a.lvl-b.lvl||b.xp-a.xp)){
    const cost=G.GROW.upgradeCost(t.type,t.lvl,t.mods);
    if(t.lvl<5&&G.gold>=cost+40&&!G.GROW.upgradeBlock(t,G.gold)&&G.upgradeTower(t))G.qaActions.push({wave:G.wave,crossUpgrade:[t.c,t.r,t.lvl]});
   }
   if(G.phase==='build'){const [x,z]=G.tileXZ(cc,rr);G.heroGoTo(x,z);}
  }
  function shop(){
   if(options.crossDefense)return crossShop();
   if(options.earlyUpgrade){
    for(const t of G.towers)if(t.branchPending)G.chooseBranch(t,t.type==='magic'?(G.towers.some(q=>q.branch==='frost')?'storm':'frost'):t.type==='arrow'?'snipe':'pierce');
    for(const t of [...G.towers].sort((a,b)=>a.lvl-b.lvl||b.xp-a.xp)){
     const cost=G.GROW.upgradeCost(t.type,t.lvl,t.mods);
     if(t.lvl<5&&G.gold>=cost+40&&!G.GROW.upgradeBlock(t,G.gold)&&G.upgradeTower(t))G.qaActions.push({wave:G.wave,earlyUpgrade:[t.c,t.r,t.lvl],repairReserve:40});
    }
   }
   return driver.shop();
  }
  for(let w=0;w<G.stage.waves&&G.phase!=='over';w++){
   if(options.delayedSupport&&G.stage.id==='hard-4-3'){
    G.stage.enemyWeights.ruinroot=w+1<4?0:.45;
    G.stage.enemyWeights.siege=w+1<6?0:.4;
   }
   shop();shop();shop();if(G.phase==='build')G.startWave();
   if(options.supportCaps){const seen={siege:0,ruinroot:0},cap=G.wave<=5?1:2;G.spawnQ=G.spawnQ.map(type=>Object.hasOwn(seen,type)&&++seen[type]>cap?'grunt':type);}
   queueEvidence.push({wave:G.wave,hpMul:G.hpMul,count:G.spawnQ.length,types:G.spawnQ.slice(),elite:G.spawnE?.slice()});
   for(let step=1;step<=1200&&G.phase==='wave';step++){
    const before={core:G.coreHp,lost:G.stats.towersLost||0,enemies:G.enemies.filter(e=>!e.dead).map(e=>({ref:e,type:e.type,hp:e.hp,core:e.E.core,position:{x:e.g.position.x,z:e.g.position.z}}))};
    if(options.guard)guard();
    if(options.hero==='adaptive'&&G.hero.dead<=0&&G.hero.warpT<=0&&G.hero.hp>G.hero.max*.35){
      const cp=new G.THREE.Vector3(G.tileXZ(...G.CORE)[0],0,G.tileXZ(...G.CORE)[1]);
      const threat=G.enemies.filter(e=>!e.dead&&!e.E.fly&&e.g.position.distanceTo(cp)<16).sort((a,b)=>a.g.position.distanceTo(cp)-b.g.position.distanceTo(cp))[0];
      if(threat)G.heroGoTo(threat.g.position.x,threat.g.position.z);
    }
    driver.advance(.5);
    if(G.coreHp<before.core)events.push({time:G.t,wave:G.wave,before:before.core,after:G.coreHp,lost:G.stats.towersLost||0,removed:before.enemies.filter(e=>!G.enemies.includes(e.ref)).map(({ref,...rest})=>rest)});
    if(step%(check*2)===0&&check<6)for(const t of G.towers)if(t.hp<t.max*.6){const hp=t.hp,gold=G.gold,ok=G.repairTower(t);if(ok)repair.push({t:G.t,w:G.wave,at:[t.c,t.r],hp,gold,cost:gold-G.gold});}
    if(step%12===0){shop();window.h43Progress={wave:G.wave,phase:G.phase,core:G.coreHp,time:G.t,lost:G.stats.towersLost||0};await new Promise(r=>setTimeout(r,0));}
   }
   if(G.phase==='wave')throw Error('Wave exceeded 600 engine seconds');
   await new Promise(r=>setTimeout(r,0));
  }
  const result={...driver.result(),queueEvidence,fighterCounters:G.ftN,controlledInitial:initial,coreLossEvents:events,extraRepair:repair,errors:window.__isolatedReview.errors};
  window.h43Result=result;window.h43Progress={done:true,clear:result.clear,core:result.core,wave:result.wave,time:result.time};return window.h43Progress;
 };
 return 'controlled driver ready';
})()
