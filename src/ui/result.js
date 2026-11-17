import { targetLabel } from '../data/repeat-target.js';
// ================= 판 결과: 스테이지 클리어 화면 · 패배/귀환 보상 저장 · 마을 귀환 (C-9, ui/flow.js 에서 이동 — 동작 불변) =================
import { Snd } from '../audio/audio.js';
import { $ } from '../core/util.js';
import { go } from '../core/nav.js';
import { G } from '../core/state.js';
import * as HG from '../account/hero-growth.js';
import * as Acc from '../account/account.js';
import {runDirectNormal} from '../account/direct-normal-client.js';
import {directGearEnabled} from '../account/direct-gear-client.js';
import * as P from '../account/progress.js';
import * as E from '../account/equip.js';
import * as ST from '../data/stages.js';
import { STAGE } from '../core/grid.js';
// 재도전·다음 스테이지 출정은 flow.js 의 departStage (출정 중복 방지 상태 공유) — initResult 로 받음
let H = { departStage: () => {} };
export function initResult(h) { H = h; }
// 출정 시 장비 보너스 배너: 큰 값 3개만 + '외 N개' (전부 나열하면 화면 밖으로 넘쳤음)
export function equipLine(eq) { const e = Object.entries(eq || {}).sort((a, b) => b[1] - a[1]); if (!e.length) return ''; return '⚔ 장비 · ' + e.slice(0, 3).map(([k, v]) => `${E.STAT[k]} +${v}%`).join(' · ') + (e.length > 3 ? ` 외 ${e.length - 3}개` : ''); }
G.onStageClear = () => {
  if (G.practice || new URLSearchParams(location.search).get('practice') === '1') return;
  if(STAGE?.hard){hardClear();return;}
  if(directGearEnabled()){void directReturn('clear');return;}
  if (G.runSaved) return; G.runSaved = true; G.xpPendingWrite = HG.checkpoint(G.xpRun, G.completedWaves || 0, true, true); G.phase = 'over'; const wave = G.wave, kills = sumKills(), stars = ST.starsFor(G.coreHp, G.coreMax); let got = 0, loot = [], info = null, best = false;
  Acc.update(d => { const [n, g, l] = P.applyRun(d, { wave, kills, drops: G.runDrops || [], hero: G.hero ? G.hero.cls : undefined, stage: true, ch: STAGE.ch, repeatTarget:G.xpRun?.repeat?G.xpRun.target:null, repeatStage:STAGE.id, repeatWin:true, bossKills: G.runBossKills || [] }); let [n2, inf] = P.applyStage(n, STAGE.id, stars, G.hero ? G.hero.cls : undefined); got = g; loot = [...l, ...inf.loot]; info = inf; return n2; }); Acc.flush();
  sessionStorage.setItem('hd3d_live_lastRun', JSON.stringify({ reason: 'clear', resultShown:true, wave, kills, got: got + info.souls, best: false, loot, stage: STAGE.id, stars, first: info.first, unlocked: info.unlocked }));
  renderNormalClear({wave,kills,got,loot,info,stars});
};
function normalClearReward({got,loot,info}){
  return `${G.growthEnabled ? '<span id=runXP>XP 저장 중…</span><br>' : ''}영혼석 <b>+${got + info.souls}</b>${repeatRewardText(G.xpRun,loot[0])}${loot.filter(x => x.chest).length ? ` · 상자 <b>${loot.filter(x => x.chest).length}</b>개` : ''}${lootLines(loot.filter(x => x.src === 'essence'))}${info.unlocked.length ? `<br>🔓 새 스테이지 해금: ${info.unlocked.map(ST.stageNo).join(', ')}` : ''}`;
}
function normalClearActions(pending){
  const save=STAGE.hard&&HG.viewSave?HG.viewSave():Acc.load();
  const nx=ST.nextStage(save,STAGE.id),town=$('scTown'),retry=$('scRetry'),next=$('scNext');
  town.disabled=retry.disabled=next.disabled=!!pending;
  town.textContent='🏡 마을로 귀환';town.onclick=()=>{Snd.play('confirm');goTown();};
  retry.onclick=()=>H.departStage(STAGE.id);
  next.hidden=!nx;next.title=nx?`${ST.stageNo(nx)} ${(ST.STAGES[nx]||ST.HARD_STAGES?.[nx])?.n||''}`:'';
  next.onclick=()=>{if(nx)H.departStage(nx);};
}
function renderNormalClear({got=0,loot=[],info={souls:0,unlocked:[]},stars,pending=false,hard=false}){
  Snd.setMusic('none'); Snd.play('victory', { force: true, exact: true });
  const el = $('stageClear'); el.innerHTML = `<div class="scBox"><div class="scT">${hard?'하드 클리어!':'스테이지 클리어!'}</div><div class="scS">${STAGE.no} · ${STAGE.n}</div><div class="scStars">${[0, 1, 2].map(i => `<i class="${i < stars ? 'on' : ''}" style="animation-delay:${(350 + i * 350) / 1000}s">★</i>`).join('')}</div>
    <div class="scConds">${ST.STAR_D.map((d, i) => `<div class="${i < stars ? 'got' : ''}">${i < stars ? '✓' : '·'} ${d}</div>`).join('')}</div>
    <div class="scRw" id="directReward" role="status" aria-live="polite">${hard?'<span id="runXP">보상 저장 중…</span>':pending?'저장 중…':normalClearReward({got,loot,info})}</div><div class="scBtns"><button class="gbtn" id="scRetry" title="같은 스테이지 다시">↻ 재도전</button><button class="gbtn" id="scNext">▶ 다음 스테이지</button><button class="gbtn main" id="scTown">🏡 마을로 귀환</button></div></div>`;
  el.classList.remove('hidden');normalClearActions(pending);
  // Schedule once when the card mounts. Save acknowledgements/retries only update rewards.
  const card=el.firstElementChild,run=G.xpRun,session=Acc.sessionId(),uid=Acc.A.user?.id;
  [0,1,2].forEach(i=>{if(i>=stars)return;setTimeout(()=>{
    if(el.firstElementChild!==card||el.classList.contains('hidden')||G.phase!=='over'
      ||G.xpRun!==run||Acc.sessionId()!==session||Acc.A.user?.id!==uid)return;
    Snd.play('coin',{force:true,rate:1+i*.2});
  },400+i*350);});
  if (G.endStatsShow) G.endStatsShow('clear');
  refreshRunXP();
}
function finishNormalClear(result){
  // Keep the existing card, stars and statistics mounted while the receipt settles.
  $('directReward').innerHTML=normalClearReward(result);
  normalClearActions(false);refreshRunXP();
}
export function lootLines(L) { const ch = L.filter(x => x.chest), ess = L.reduce((a, x) => a + (x.src === 'essence' ? x.essence : 0), 0);
  return (ch.length ? `<br>획득 보상 상자 <b>${ch.length}</b>개 <small>(🎁 상자 보관함)</small>` : '') + (ess ? `<br>◆ 전직 정수 +${ess}` : ''); }
const sumKills = () => Object.values(G.stats.kills || {}).reduce((a, b) => a + b, 0);
// 판 종료(패배/귀환) → 보상 저장 후 마을로
export function onRunEnd(reason) {
  if (G.practice || new URLSearchParams(location.search).get('practice') === '1') return;
  if(STAGE?.hard){hardEnd(reason);return;}
  if(directGearEnabled()){void directReturn(reason);return;}
  if (G.runSaved) return; G.runSaved = true; G.xpPendingWrite = HG.checkpoint(G.xpRun, G.completedWaves || 0, false, true); const wave = G.wave, kills = sumKills(); let got = 0, best = false, loot = [];
  Acc.update(d => { best = !STAGE && wave > d.bestWave; const [n, g, l] = P.applyRun(d, { wave, kills, drops: G.runDrops || [], hero: G.hero ? G.hero.cls : undefined, stage: !!STAGE, ch: STAGE ? STAGE.ch : 'open', bossKills: G.runBossKills || [] }); got = g; loot = l; return n; }); Acc.flush();
  sessionStorage.setItem('hd3d_live_lastRun', JSON.stringify({ reason, wave, kills, got, best, loot, stage: STAGE ? STAGE.id : undefined }));
  const btn = $('overTown'); if (btn) { btn.classList.remove('hidden'); $('overReward').innerHTML = `${G.growthEnabled ? '<span id=runXP>XP 정산 중…</span><br>' : ''}획득 영혼석 <b>+${got}</b>${loot.filter(x => x.chest).length ? ` · 장비 <b>${loot.filter(x => x.chest).length}</b>개` : ''}${lootLines(loot.filter(x => x.src === 'essence'))}`; }
  if (reason === 'retreat') goTown();
}
// Direct mode confirms an immutable run receipt before leaving this existing
// result screen. A failed/unknown commit keeps its journal and retries the ID.
let directReturnJob=null,directClearView=null;
async function directReturn(reason){
 if(directReturnJob)return directReturnJob;
 if(G.runSaved)return;
 const run=G.xpRun,session=Acc.sessionId(),uid=Acc.A.user?.id,stage=STAGE;
 const current=()=>Acc.A.user?.id===uid&&Acc.sessionId()===session&&G.xpRun?.token===run?.token;
 const wave=G.wave,kills=sumKills();G.phase='over';
 const clear=reason==='clear',stars=clear?ST.starsFor(G.coreHp,G.coreMax):0;
 let button,reward;
 if(clear){
  if(!directClearView||directClearView.run!==run||directClearView.session!==session||directClearView.uid!==uid||directClearView.button!==$('scTown')){
   renderNormalClear({stars,pending:true});
   directClearView={run,session,uid,button:$('scTown')};
  }
  normalClearActions(true);button=$('scTown');reward=$('directReward');
 }else{
  button=$('overTown');reward=$('overReward');$('overTitle').textContent=reason==='retreat'?'전투 종료':'전투 결과';
  $('overTxt').textContent=`${stage?.no||''} · 완료 웨이브 ${G.completedWaves||0} · 처치 ${kills}`;
  $('over').classList.remove('hidden');button?.classList.remove('hidden');G.endStatsShow?.('over');
 }
 if(button){button.disabled=true;button.onclick=()=>directReturn(reason);}
 reward.textContent='저장 중…';
 const job=(async()=>{
  try{
   if(!run)throw new Error('출정 기록을 확인하지 못했습니다.');
   const r=await runDirectNormal({challenge:!stage,args:{p_token:run.token,p_wave:wave,p_kills:kills,p_stars:stars,p_drops:Acc.A.sb?.serverEconomy?[]:G.runDrops||[],...(!stage||Acc.A.sb?.serverEconomy?{p_bossKills:G.runBossKills||[]}: {})},checkpoint:{run,completed:G.completedWaves||0,win:clear,stars}});
   if(!current())return;if(!r?.ok)throw new Error('보상 저장을 확인하지 못했습니다.');
   G.runSaved=true;G.xpPendingWrite=Promise.resolve(true);
   sessionStorage.setItem('hd3d_live_lastRun',JSON.stringify({reason,resultShown:clear,wave,kills,got:r.souls,best:!!r.best,loot:r.loot,stage:stage?.id,stars,first:r.first,unlocked:r.unlocked}));
   reward.textContent=`획득 영혼석 +${r.souls}`;
   if(clear)finishNormalClear({got:r.souls,loot:r.loot,info:{souls:0,first:r.first,unlocked:r.unlocked}});else if(button){button.disabled=false;button.onclick=goTown;}
   if(reason==='retreat')goTown();
  }catch(e){if(current()){G.runSaved=false;reward.textContent=e.message||Acc.SAVE_WAIT_MESSAGE;if(button){button.disabled=false;button.textContent='다시 저장';button.onclick=()=>directReturn(reason);}}}
 })();directReturnJob=job;
 try{await job;}finally{if(directReturnJob===job)directReturnJob=null;}
}
export async function goTown() { if (G.xpPendingWrite && !await G.xpPendingWrite) { const run = G.xpRun; G.xpPendingWrite = HG.checkpoint(run, G.completedWaves || 0, !!(STAGE && G.completedWaves >= STAGE.waves), true, STAGE?.hard?ST.starsFor(G.coreHp,G.coreMax):1,sumKills()); if (!await G.xpPendingWrite) { alert('XP 완료 기록을 기기에 저장하지 못했습니다. 공간을 확인하고 귀환을 다시 눌러 주세요.'); return; } } go({ town: 1 }, 400); }

function repeatRewardText(run, result) {
  if (!run?.repeat || !run.target || !result) return '';
  return result.chest ? ` · ${targetLabel(run.target)} 상자 1개` : result.auto ? ` · ${targetLabel(run.target)} 자동 분해` : '';
}
function refreshRunXP() {
  const el=document.getElementById('runXP'),xp=HG.HG.rewardXP[G.xpRun?.token],reward=HG.HG.hardRewards[G.xpRun?.token];
  if(!el||xp===undefined)return;
  // Hard target is the first reward box. Display its acknowledged storage outcome,
  // never the selection alone; partial/failed runs do not apply the target.
  const target=reward&&STAGE?.hard&&G.completedWaves>=STAGE.waves?repeatRewardText(G.xpRun,{chest:reward.chests>0,auto:!!(reward.steel||reward.crystal)}):'';
  el.textContent=`공용 XP +${xp}${reward?`\n영혼석 +${reward.souls} · 상자 ${reward.chests}개${target}${reward.steel||reward.crystal?"\n보관함 초과분 재료 전환":""}`:''}`;
  if(STAGE?.hard&&G.completedWaves>=STAGE.waves&&$('scNext'))normalClearActions(false);
}
HG.onGrowth(refreshRunXP);

function hardClear(){
  if(G.runSaved)return;G.runSaved=true;G.phase='over';const stars=ST.starsFor(G.coreHp,G.coreMax);
  G.xpPendingWrite=HG.checkpoint(G.xpRun,G.completedWaves||0,true,true,stars,sumKills());
  renderNormalClear({stars,hard:true});
}
function hardEnd(reason){
  if(G.runSaved)return;G.runSaved=true;G.xpPendingWrite=HG.checkpoint(G.xpRun,G.completedWaves||0,false,true,1,sumKills());
  const b=$('overTown');if(b){b.classList.remove('hidden');$('overReward').innerHTML='<span id="runXP">보상 저장 중…</span>';}
  if(reason==='retreat'){
    G.phase='over';$('overTitle').textContent='전투 종료';
    $('overTxt').textContent=`${STAGE.no} · 완료 웨이브 ${G.completedWaves||0} · 처치 ${sumKills()}`;
    $('over').classList.remove('hidden');G.endStatsShow?.('over');
    goTown();
  }
}
