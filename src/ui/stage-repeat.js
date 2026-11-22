import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { startWave } from '../core/waves.js';
import * as Acc from '../account/account.js';
import * as HG from '../account/hero-growth.js';
import { directGearEnabled } from '../account/direct-gear-client.js';
import { CHEST_CAP } from '../account/equip.js';
import { getStage, stars } from '../data/stages.js';
import { autoBuildStage, autoMaintainStageTowers } from './stage-auto-build.js';
import { runStageAutoCombat, clearStageAutoCombat } from './stage-auto-combat.js';
import { repeatHandoff, REPEAT_QUERY } from '../core/stage-repeat.js';
let loop=null, stop=null, control=null, manualRun=null;
const auth = () => !!Acc.A.user?.id && Acc.ready() && Acc.A.sb?.serverEconomy === true && directGearEnabled();
const actor = () => Acc.A.user?.id;
const disk = () => repeatHandoff(globalThis.sessionStorage);
const same = l => loop===l && actor()===l.owner && Acc.sessionId()===l.session && G.xpRun?.token===l.token && G.stage?.id===l.stage;
const canLoop = () => auth() && !Acc.serverSaveState() && navigator.onLine!==false && (Acc.load().chests?.length||0)<CHEST_CAP;
export function repeatOffered(id) {
  if(!auth())return false;
  const st=getStage(id);return !!st && stars(st.hard?HG.viewSave():Acc.load(),id)>0;
}
export const repeatAvailable = id => canLoop()&&repeatOffered(id);
export function makeRepeatHandoff(id) {
  if(!canLoop() || !repeatOffered(id))return null;
  const nonce=crypto.randomUUID(),owner=actor(),session=Acc.sessionId();
  return {nonce,save:() => {
    if(!canLoop()||owner!==actor()||session!==Acc.sessionId()||!repeatOffered(id))return false;
    try { return disk().arm(nonce,owner,id); } catch { return false; }
  }};
}
export function receiveStageRepeat(id) {
  const url=new URL(location.href),nonce=url.searchParams.get(REPEAT_QUERY);
  if(!nonce)return false;
  url.searchParams.delete(REPEAT_QUERY);
  try { history.replaceState(history.state,'',url.href); } catch {}
  try { return disk().take(nonce,actor(),id)&&canLoop()&&repeatOffered(id); } catch { return false; }
}
export function activateStageRepeat(id) {
  const run=G.xpRun, session=Acc.sessionId();
  if(loop||!canLoop()||!repeatOffered(id)||!run?.token||run.owner!==actor()||run.session!==session||run.stage!==id||run.repeat!==true)return false;
  loop={stage:id,owner:actor(),session,token:run.token,waveBusy:false,builtWave:null};
  stop=document.createElement('button');stop.id='repeatStop';stop.type='button';stop.className='gbtn sm';
  stop.textContent='수동 플레이';
  const opened=loop;
  stop.onpointerdown=e=>e.stopPropagation();
  stop.onclick=e=>{
    e.stopPropagation();
    if(loop!==opened)return;
    if(same(opened)){
      manualRun=loop;
      G.autoWaveAt=0;
      const wave=$('startWave');
      if(wave)delete wave.dataset.auto;
    }
    stopStageRepeat();
  };
  control=document.createElement('div');control.id='repeatControl';
  const status=document.createElement('span');status.setAttribute('role','status');status.textContent='자동 진행 중';
  control.appendChild(status);control.appendChild(stop);
  $('hud').appendChild(control);
  return true;
}
export function stageManualOverride() {
  return !!manualRun&&(G.phase==='build'||G.phase==='wave')&&actor()===manualRun.owner&&
    Acc.sessionId()===manualRun.session&&G.xpRun?.token===manualRun.token&&G.stage?.id===manualRun.stage;
}
export const hasStageRepeat = () => !!loop;
export function stopStageRepeat() {
  if(loop)clearStageAutoCombat();
  loop=null;stop?.remove();stop=null;control?.remove();control=null;
}
export function updateStageRepeat(dt,clearBonus) {
  const l=loop;if(!l)return false;
  if(G.phase==='over'||!same(l)||!auth()||navigator.onLine===false){stopStageRepeat();return false;}
  if(G.paused||G.navigating||G.chooseWait||!G.hero)return true;
  if(G.phase==='wave'){
    autoMaintainStageTowers(dt);
    runStageAutoCombat(dt);
  }else if(G.phase==='build'&&G.wave<G.stage.waves&&!l.waveBusy){
    clearStageAutoCombat();
    l.waveBusy=true;
    void Promise.resolve(G.xpPendingWrite).then(ok=>{
      l.waveBusy=false;if(!same(l))return;
      if(ok===false||!canLoop()){stopStageRepeat();return;}
      if(G.phase==='build'&&!G.paused&&!G.navigating&&G.coreHp>0&&G.wave<G.stage.waves){
        if(l.builtWave!==G.wave){l.builtWave=G.wave;autoBuildStage();}
        if(same(l))startWave(clearBonus);
      }
    }).catch(()=>{if(same(l))stopStageRepeat();});
  }
  return true;
}
