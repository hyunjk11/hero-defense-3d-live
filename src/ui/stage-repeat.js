import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { startWave } from '../core/waves.js';
import { runSupportAI } from '../heroes/hard-party.js';
import { withHero } from '../heroes/hero.js';
import { mobileApp } from './mobile-mode.js';
import * as Acc from '../account/account.js';
import * as HG from '../account/hero-growth.js';
import { directGearEnabled } from '../account/direct-gear-client.js';
import { CHEST_CAP } from '../account/equip.js';
import { clearOrders } from '../data/hard-party.js';
import { getStage, stars } from '../data/stages.js';
import { repeatHandoff, repeatStarDelay, REPEAT_QUERY } from '../core/stage-repeat.js';
let loop=null, stop=null;
const auth = () => !mobileApp && !!Acc.A.user?.id && Acc.ready() && Acc.A.sb?.serverEconomy === true && directGearEnabled();
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
  if(mobileApp)return false;
  const url=new URL(location.href),nonce=url.searchParams.get(REPEAT_QUERY);
  if(!nonce)return false;
  url.searchParams.delete(REPEAT_QUERY);
  try { history.replaceState(history.state,'',url.href); } catch {}
  try { return disk().take(nonce,actor(),id)&&canLoop()&&repeatOffered(id); } catch { return false; }
}
export function activateStageRepeat(id) {
  const run=G.xpRun, session=Acc.sessionId();
  if(!canLoop()||!run?.token||run.owner!==actor()||run.session!==session||run.stage!==id||run.repeat!==true)return false;
  loop={stage:id,owner:actor(),session,token:run.token,waveBusy:false,timer:0};
  stop=document.createElement('button');stop.id='repeatStop';stop.type='button';stop.className='gbtn sm';
  stop.textContent='■';stop.title='자동 반복 중지';stop.setAttribute('aria-label','자동 반복 중지');
  stop.onpointerdown=e=>e.stopPropagation();stop.onclick=e=>{e.stopPropagation();stopStageRepeat();};
  $('cam').appendChild(stop);return true;
}
export const hasStageRepeat = () => !!loop;
export function stopStageRepeat() {
  if(loop?.timer)clearTimeout(loop.timer);
  if(loop&&G.hero)clearOrders(G.hero);
  loop=null;stop?.remove();stop=null;
}
export function showRepeatStopInResult() {
  if(!loop || !stop)return false;
  $('stageClear').querySelector('.scBtns')?.appendChild(stop);
  stop.textContent='반복 중지';return true;
}
export function continueStageRepeat(stars,depart) {
  const l=loop;
  if(!l||!same(l)||!canLoop()){stopStageRepeat();return false;}
  if(l.continuing)return true;
  l.continuing=true;
  l.timer=setTimeout(async()=>{
    if(!same(l)||!canLoop()||G.phase!=='over'||$('stageClear').classList.contains('hidden')){stopStageRepeat();return;}
    if(!await depart(l.stage,()=>same(l)&&canLoop())&&same(l))stopStageRepeat();
  },Math.max(0,(l.resultAt||performance.now())+repeatStarDelay(stars)-performance.now()));
  return true;
}
export function markRepeatResult() { if(loop)loop.resultAt=performance.now(); }

export function updateStageRepeat(dt,clearBonus) {
  const l=loop;if(!l)return false;
  // The active hard settlement legitimately holds a save lock while results
  // are mounted. Its existing receipt code determines continuation.
  if(!same(l)||!auth()||navigator.onLine===false){stopStageRepeat();return false;}
  if(G.phase==='over'||G.paused||G.navigating||G.chooseWait||!G.hero)return true;
  if(G.phase==='wave'){
    const h=G.hero;if(h.dead<=0)withHero(h,()=>runSupportAI(h,dt));
  }else if(G.phase==='build'&&G.wave<G.stage.waves&&!l.waveBusy){
    l.waveBusy=true;
    void Promise.resolve(G.xpPendingWrite).then(ok=>{
      l.waveBusy=false;if(!same(l))return;
      if(ok===false||!canLoop()){stopStageRepeat();return;}
      if(G.phase==='build'&&!G.paused&&!G.navigating&&G.coreHp>0&&G.wave<G.stage.waves)
        startWave(clearBonus);
    }).catch(()=>{if(same(l))stopStageRepeat();});
  }
  return true;
}
