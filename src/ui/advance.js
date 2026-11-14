import { eInfoFor } from '../data/hero-e.js';
// 여신탑 '전직' 탭 (여신의 축복 창 #twBless): 조건 체크리스트 + 분기 카드 2장(미리보기: 마을 영웅 발밑 링 색) + 확인 창 → 전직/재전직
// 소유권은 서버(hd3d_owned) 기준 Sh.heroOwned — 세이브 값은 믿지 않음
import { Snd } from '../audio/audio.js';
import { $, setH } from '../core/util.js';
import { CLASSES } from '../data/heroes.js';
import * as AD from '../data/advance.js';
import * as HG from '../account/hero-growth.js';
import * as Acc from '../account/account.js';
import * as P from '../account/progress.js';
import * as Sh from '../account/shop.js';
import { banner } from './hud.js';
import {directGearEnabled,runDirectGear} from '../account/direct-gear-client.js';
let buying=false;
let hooks = { onChange() {}, cheer() {}, preview() {} }, pv = null, pend = null;
export function initAdv(h) { hooks = { ...hooks, ...h }; $('advConfirm').addEventListener('click', e => { if (e.target.id === 'advConfirm') closeConfirm(); }); }
export const resetPreview = () => { pv = null; };
export function renderAdv() {
  const s = HG.viewSave(), h = Sh.usableHero(s.hero), C = CLASSES[h], el = $('twAdv'), cur = AD.advOf(h, s.adv[h]), owned = Sh.heroOwned(h);
  if (!AD.ADV_HEROES.includes(h)) { setH(el, `<div class="advCur advSoon">${C.icon} <b>${C.nm}</b> · 전직 준비 중</div>`); return; } // 분기 없는 영웅(현재 없음 · 새 영웅 대비): '준비 중'
  const mats = `<div class="advMats"><span>🔮 영혼석 <b>${s.souls}</b></span><span>💎 마력석 <b>${s.mat.crystal}</b></span><span>◆ 전직 정수 <b>${s.mat.essence || 0}</b></span></div>`;
  const head = cur ? `<div class="advCur" style="--ac:${cur.c}">${cur.icon} <b>${C.nm} · ${cur.n}</b><br><small>영구 강화 상한 ${AD.PERM_MAX_ADV} · 재전직 영혼석 ${AD.ADV_SWITCH.souls}</small></div>`
    : `<ul class="advChk">${AD.advChecks(s, h).map(x => `<li class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✓' : '✗'} ${x.t}</li>`).join('')}</ul>`;
  const cards = AD.branchesOf(h).map(b => { const A = AD.ADV[h][b], why = AD.advBlock(s, h, b, owned), isCur = cur && cur.k === b;
    const lbl = isCur ? '현재 분기' : cur ? `재전직 <small>🔮 ${AD.ADV_SWITCH.souls}</small>` : '전직';
    return `<div class="advCard ${isCur ? 'cur' : ''} ${pv === b ? 'pv' : ''}" data-b="${b}" style="--ac:${A.c}"><h4>${A.icon} ${A.n}${isCur ? '<small>✔ 전직함</small>' : ''}</h4><div>${A.d}</div>
      <div class="q">[Q] <b>${A.sk}</b> — ${A.sd}</div><div class="q">[E] <b>${eInfoFor(h,b).icon} ${eInfoFor(h,b).n}</b> — ${eInfoFor(h,b).d.replace('[E] ','')}</div><div class="tw">🏰 타워 연동: <b>${A.td}</b> (연구와 곱)</div>${why && !isCur ? `<div class="why">🔒 ${why}</div>` : ''}
      <button class="gbtn advBtn" data-b="${b}" ${why || isCur ? 'disabled' : ''}>${lbl}</button></div>`; }).join('');
  setH(el, mats + head + cards);
  el.querySelectorAll('.advCard').forEach(c => c.onclick = e => { if (e.target.classList.contains('advBtn')) return; pv = c.dataset.b; Snd.play('select'); hooks.preview(AD.ADV[h][pv]); renderAdv(); });
  el.querySelectorAll('.advBtn').forEach(btn => btn.onclick = () => openConfirm(h, btn.dataset.b));
}
function openConfirm(h, b) { const s = HG.viewSave(), A = AD.ADV[h][b], cur = AD.advOf(h, s.adv[h]), C = CLASSES[h]; pend = { h, b }; Snd.play('ui');
  const cost = cur ? `🔮 영혼석 <b>${AD.ADV_SWITCH.souls}</b>` : `🔮 영혼석 <b>${AD.ADV_COST.souls}</b> · 💎 마력석 <b>${AD.ADV_COST.crystal}</b> · ◆ 전직 정수 <b>${AD.ADV_COST.essence}</b>`;
  const box = $('advConfirm'); box.style.setProperty('--ac', A.c);
  box.querySelector('.acBox').innerHTML = `<div class="acIco">${A.icon}</div><h3>${cur ? '재전직' : '전직'}: ${C.nm} · ${A.n}</h3><div>${cur ? `${cur.icon} ${cur.n} → ${A.icon} ${A.n}` : `새 칭호: <b>${C.nm} · ${A.n}</b>`}</div>
    <div class="acCost">소모: ${cost}</div><div class="acBtns"><button class="gbtn main" id="acOk">${cur ? '재전직' : '전직'}</button><button class="gbtn" id="acNo">취소</button></div>`;
  box.classList.remove('hidden'); $('acOk').onclick = () => doAdv(); $('acNo').onclick = () => closeConfirm(); }
export function closeConfirm() { $('advConfirm').classList.add('hidden'); pend = null; }
async function doAdv() { if (!pend||buying) return; const { h, b } = pend,epoch=Acc.sessionId(); let ok = false; closeConfirm();buying=true;
  try {if(directGearEnabled()){const [r]=await runDirectGear([{p_action:'advance',p_hero:h,p_branch:b}]);ok=r.ok;}
    else Acc.update(d => { const [n, o] = P.buyAdv(HG.viewSave(d), h, b, Sh.heroOwned(h)); ok = o; return n; });
  }catch{}finally{buying=false;}if(epoch!==Acc.sessionId())return;
  if (ok) { const A = AD.ADV[h][b]; Snd.play('levelUp', { force: true }); Snd.play('meteorCast', { vol: .5 }); banner(`${A.icon} ${CLASSES[h].nm} · ${A.n}!`, A.c, 2200); pv = null; hooks.preview(A); hooks.cheer(); }
  else Snd.play('error'); hooks.onChange(); renderAdv(); }
