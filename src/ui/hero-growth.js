// Permanent growth lives beside the selected hero's ability breakdown.
import * as HG from '../account/hero-growth.js';
import * as H from '../data/hero-growth.js';
import * as Acc from '../account/account.js';
import * as Sh from '../account/shop.js';
import * as AD from '../data/advance.js';
import { heroLabel } from '../data/heroes.js';
import { eInfoFor, E_LEVEL } from '../data/hero-e.js';
import { growthPreview, affordableLevel } from './growth-preview.js';
import { esc } from '../core/util.js';
import { G } from '../core/state.js';
import { renderAwakening } from './awakening.js';
import { awakeningLevel } from '../data/awakening.js';
const $ = id => document.getElementById(id), num = x => x.toLocaleString('ko-KR');
let selected, viewKey = '', currentLevel = 0, busy = null, message = '', initialized = false;
const key = () => HG.HG.owner + ':' + Acc.sessionId();
const inTown = () => G.screen === 'town' && !$('statPanel')?.classList.contains('hidden');
export function refreshGrowthUI() {
  const b = $('twStats'); if (b) b.title = HG.available() ? `영웅 능력치 · 레벨업 (C) · 공용 XP ${num(HG.HG.growth.balance)}` : '영웅 능력치 · 레벨업 (C)';
  if (inTown()) refreshCard();
}
export function mountGrowth(hero, save) {
  const host = $('heroGrowth'); if (!host) return;
  const changed = selected !== hero || viewKey !== key(); selected = hero;
  if (!host.firstElementChild) {
    host.innerHTML = `<div class="xpHeader"><div><span class="xpEyebrow">영구 성장</span><h3 id="xpHero"></h3></div><div class="xpWallet"><small>공용 XP</small><strong id="xpBalance">—</strong></div></div>
      <div id="xpControls"><div class="xpChoices" role="group" aria-label="레벨 상승 선택"><button id="xpOne" type="button">+1 레벨</button><button id="xpFive" type="button">+5 레벨</button><button id="xpMax" type="button">가능한 최대</button></div>
      <div class="xpTargetRow"><label for="xpTarget">목표 레벨</label><input id="xpTarget" type="number" min="2" max="50" step="1" inputmode="numeric"><span id="xpNext"></span></div></div>
      <div id="xpPreview"></div><div class="xpActions"><button id="xpConfirm" type="button" class="gbtn main"></button><button id="xpCancel" type="button" class="gbtn">선택 취소</button><button id="xpRetry" type="button" class="gbtn hidden">연결·저장 확인</button></div>
      <p id="xpMessage" class="xpMessage" role="status" aria-live="polite"></p><small class="xpHelp">사용한 XP는 반환하거나 다른 영웅에게 옮길 수 없습니다.</small>
      <section id="awCard" class="awCard hidden" aria-label="각성"></section><details class="xpAdvance"><summary id="xpAdvanceTitle"></summary><div id="xpAdvanceChecks"></div></details>`;
    $('xpTarget').oninput = () => { message = ''; refreshCard(); };
    for (const [id, n] of [['xpOne',1],['xpFive',5],['xpMax',null]]) $(id).onclick = () => {
      message = ''; $('xpTarget').value = n === null ? affordableLevel(HG.HG.growth,selected) : Math.min(H.MAX_LEVEL,HG.level(selected)+n); refreshCard();
    };
    $('xpCancel').onclick = () => { message = '선택을 취소했습니다. XP를 사용하지 않았습니다.'; $('xpTarget').value = Math.min(H.MAX_LEVEL,HG.level(selected)+1); refreshCard(); };
    $('xpConfirm').onclick = confirm;
    $('xpRetry').onclick = async () => {
      if (busy?.key===key()) return; const token={key:key(),hero:selected};busy=token;message='저장 확인 중…';refreshCard();
      try { await HG.refresh(); } finally { if(busy===token)busy=null; if(token.key===key()){message=HG.HG.message || (HG.enabled()?'저장 확인 완료':'연결을 확인하지 못했습니다.');refreshCard();} }
    };
  }
  if (changed) { viewKey=key();currentLevel=HG.level(hero);message='';$('xpTarget').value=Math.min(H.MAX_LEVEL,currentLevel+1); }
  refreshCard(save);
}
function refreshCard(save) {
  if (!$('xpTarget') || !selected || !inTown()) return;
  // Reuse only this synchronous render's snapshot; input/click handlers read afresh.
  save ||= Acc.load();
  if (viewKey!==key()) { message='';viewKey=key();currentLevel=0; }
  renderAwakening(selected,save);
  const ready=HG.available(), level=HG.level(selected), waiting=busy?.key===key(), pending=!!HG.HG.hasInvestment;
  if (level!==currentLevel) { currentLevel=level;$('xpTarget').value=Math.min(H.MAX_LEVEL,level+1); }
  const max=level===H.MAX_LEVEL, locked=waiting||pending||!HG.enabled()||!Sh.heroOwned(selected), target=Number($('xpTarget').value);
  const awakened=HG.awakeningEnabled()&&awakeningLevel(HG.HG.growth,selected,save.adv[selected])!==null;
  $('xpHero').textContent=awakened?heroLabel(selected):`${heroLabel(selected)} · ${ready?'Lv.'+level:'레벨 확인 중'}`;
  $('xpBalance').textContent=ready?num(HG.HG.growth.balance):'—';
  $('xpControls').classList.toggle('hidden',max);
  $('xpTarget').min=Math.min(H.MAX_LEVEL,level+1);$('xpTarget').disabled=locked||max;
  for(const id of ['xpOne','xpFive','xpMax']) $(id).disabled=locked||max;
  $('xpMax').disabled ||= !ready || affordableLevel(HG.HG.growth,selected)<=level;
  $('xpCancel').disabled=locked||max;
  $('xpNext').textContent=ready&&!max?`다음 레벨 ${num(H.nextXP(level))} XP`:'';
  const p=ready?growthPreview(save,HG.HG.growth,selected,target):null,q=p?.quote;
  $('xpPreview').innerHTML=!ready?'<p class="xpHelp">성장 정보 확인 중…</p>':max&&awakened?'':max?'<p class="xpMaxed">최고 레벨 50</p>':!q?.cost?'<p class="xpError">현재보다 높은 정수 레벨을 선택해 주세요. (최대 50)</p>':
    `<div class="xpCost"><b>Lv.${level} → Lv.${target}</b><span>필요 <strong>${num(q.cost)} XP</strong></span><span class="${q.left<0?'xpError':''}">${q.left<0?'부족 '+num(-q.left)+' XP':'투자 후 잔액 '+num(q.left)+' XP'}</span></div><div class="xpDeltas">${[['체력',p.before.hp,p.after.hp],['공격력',p.before.dmg,p.after.dmg],['스킬 피해 계수',p.before.skillMul*100,p.after.skillMul*100]].map(([n,a,b])=>`<div><span>${n}</span><b>${num(Math.round(a*100)/100)}${n==='스킬 피해 계수'?'%':''} → <em>${num(Math.round(b*100)/100)}${n==='스킬 피해 계수'?'%':''}</em></b></div>`).join('')}</div>`;
  const esk=eInfoFor(selected,save.adv[selected]);
  if (ready && esk && !awakened) $('xpPreview').insertAdjacentHTML('beforeend', `<p class="xpHelp">[E] ${esc(esk.n)} · ${level>=E_LEVEL?'해금 완료':q?.ok&&target>=E_LEVEL?'이번 투자로 해금됩니다':`영웅 Lv.${E_LEVEL}에 해금`}</p>`);
  $('xpConfirm').classList.toggle('hidden',awakened);$('xpCancel').classList.toggle('hidden',awakened);
  $('xpConfirm').disabled=locked||!q?.ok||max;
  $('xpConfirm').textContent=waiting?'처리 확인 중…':max?'최고 레벨':q?.ok?`${num(q.cost)} XP로 ${target-level}레벨 올리기`:'XP 투자';
  const needsRetry=!!HG.HG.pending||['offline','missing','error'].includes(HG.HG.status);
  $('xpRetry').classList.toggle('hidden',!needsRetry);$('xpRetry').disabled=waiting;
  $('xpMessage').textContent=waiting?'처리 확인 중… 창을 닫아도 취소되지 않습니다.':(needsRetry || !ready ? HG.HG.message || '성장 기록을 확인하는 중입니다…' : message || (q?.reason==='poor'?`XP가 ${num(-q.left)} 부족합니다.`:''));
  const s=HG.viewSave(save),advanced=AD.advOf(selected,s.adv[selected]);
  $('xpAdvanceTitle').textContent=advanced?`전직 완료 · ${AD.advTitle(selected,s.adv[selected])}`:ready?`전직 조건 · 영웅 Lv.${H.ADV_LEVEL}${level>=H.ADV_LEVEL?' 달성':`까지 ${H.ADV_LEVEL-level}레벨`}`:'전직 조건';
  $('xpAdvanceChecks').innerHTML=advanced?'<p>재전직: 여신의 축복</p>':ready?AD.advChecks(s,selected).map(c=>`<p class="${c.ok?'xpMet':''}">${c.ok?'✓':'○'} ${esc(c.t)}</p>`).join('')+'<p>전직: 여신의 축복</p>':'성장 정보 확인 중…';
}
async function confirm() {
  if(busy?.key===key()||!inTown()||!HG.enabled()||viewKey!==key()||!Sh.heroOwned(selected))return;
  const hero=selected,target=Number($('xpTarget').value),q=H.quote(HG.HG.growth,hero,target);if(!q.ok||HG.HG.hasInvestment)return;
  const token={key:key(),hero};busy=token;message='';refreshCard();
  try {
    const r=await HG.invest(hero,target);
    if(token.key!==key()||selected!==hero)return;
    message=r.ok?`${heroLabel(hero)} Lv.${r.level} 완료 · ${num(r.cost)} XP 사용`:r.reason==='conflict'?'다른 기기에서 잔액이 변경됐습니다. 새 미리보기를 확인해 주세요.':HG.HG.message||`투자하지 못했습니다 (${r.reason}). XP와 레벨을 확인해 주세요.`;
  } finally { if(busy===token)busy=null;refreshCard(); }
}
export function initGrowthUI() { if(initialized)return;initialized=true;HG.onGrowth(refreshGrowthUI);refreshGrowthUI(); }
