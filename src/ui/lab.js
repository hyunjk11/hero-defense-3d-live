// 타워 연구소 패널: 타워 종류별 공격력·사거리·공격속도 + 후반 '시작 성장'. 버튼은 한 번만 만들고 글자/비활성만 갱신 (클릭 씹힘 방지)
import { Snd } from '../audio/audio.js';
import { $, setH } from '../core/util.js';
import { definePanel } from './panel.js';
import { G } from '../core/state.js';
import { TOWERS } from '../data/towers.js';
import * as GR from '../data/growth.js';
import * as Acc from '../account/account.js';
import * as P from '../account/progress.js';
import * as SX from '../account/steel.js';
import * as AD from '../data/advance.js';
import * as Sh from '../account/shop.js';
import { labFx } from '../world/town.js';
import { beamAttackBonus, endgameQuote, endgameTowerMods, ENDGAME_RESEARCH_VERSION } from '../data/endgame-research.js';
import * as HG from '../account/hero-growth.js';
import {directGearEnabled,pendingGear,runDirectGear} from '../account/direct-gear-client.js';
let buying=false, pendingRow=null;
let open = false, tab = 'arrow', built = null, hooks = { onChange() {}, cheer() {} };
const TC = { arrow: '#5a9aff', cannon: '#ff9a4a', magic: '#c07aff', guardian: '#73d9bf' };
const END = 'endgame', purchaseKinds = [['gold', '💰', '시작 골드'], ['beam', '⚔', '광선탑 공격력']];
const endgameOn = () => directGearEnabled() && Acc.A.sb?.serverEconomy === true && HG.enabled() && HG.HG.features.endgameResearch === ENDGAME_RESEARCH_VERSION;
const number = new Intl.NumberFormat('ko-KR');
let endgameBody = null;
const shownEndgame = new WeakMap();
const MATN = { steel: '⚙ 강철', crystal: '💎 마력석' };
export function initLab(h) { hooks = { ...hooks, ...h }; $('labClose').onclick = () => closeLab(); }
const LP = definePanel('lab', { id: 'labPanel', z: 40, isOpen: () => open, close: s => closeLab(s) });
export function openLab() { if (G.screen !== 'town') return; if (!open) { Snd.play('confirm'); Snd.play('magic', { vol: .4 }); } open = true; LP.show(); renderLab(); }
export function closeLab(silent) { if (open && !silent) Snd.play('ui'); open = false; LP.hide(); }
function build() {
  $('labTabs').innerHTML = GR.TTYPES.map(t => `<button class="ftab" data-t="${t}"><i style="color:${TC[t]};background:${TC[t]}"></i>${TOWERS[t].n}</button>`).join('') + '<button class="ftab hidden" data-t="endgame" aria-pressed="false" hidden>✦ 심화</button>';
  $('labTabs').querySelectorAll('.ftab').forEach(b => b.onclick = () => { if (tab === b.dataset.t) return; tab = b.dataset.t; Snd.play('ui'); renderLab(); });
  $('labBody').innerHTML = GR.RKEYS.map(k => `<div class="labRow ${GR.RES[k].need ? 'late' : ''}" data-k="${k}"><div class="lrTop"><span class="lrIco">${GR.RES[k].icon}</span><span>${GR.RES[k].n}</span><span class="lrLv"></span></div>
    <div class="lrPips">${'<i></i>'.repeat(GR.RES[k].max)}</div><div class="lrD"></div><button class="gbtn lrBtn"></button><div class="lrLock"></div></div>`).join('');
  $('labBody').querySelectorAll('.labRow').forEach(r => r.querySelector('.lrBtn').onclick = () => buy(r.dataset.k, r)); built = true;
  // 🧱 바리케이드 보강 (2026-10-24, 강철만 · 타워 탭과 무관한 공용 연구, account/steel.js)
  $('labBar').innerHTML = `<div class="lrTop"><span class="lrIco">🧱</span><span>바리케이드 보강</span><small class="lrTag">모든 타워 공용 · 강철 전용</small><span class="lrLv"></span></div><div class="lrPips">${'<i></i>'.repeat(SX.BAR.max)}</div><div class="lrD"></div><button class="gbtn lrBtn" id="labBarBtn"></button><div class="lrLock"></div>`;
  $('labBarBtn').onclick = () => buyBarLv();
  endgameBody = document.createElement('div');
  endgameBody.className = 'labBody hidden';
  endgameBody.innerHTML = purchaseKinds.map(([k, icon, title]) => `<div class="labRow late" data-k="${k}"><div class="lrTop"><span class="lrIco" aria-hidden="true">${icon}</span><span>${title}</span><span class="lrLv"></span></div><div class="lrD"></div><button class="gbtn lrBtn"></button><div class="lrLock" role="status"></div></div>`).join('');
  $('labBody').after(endgameBody);
  endgameBody.querySelectorAll('.labRow').forEach(row => row.querySelector('.lrBtn').onclick = () => buyEndgame(row));
}
let endgameError = null;
let endgameEpoch = -1;
async function buyEndgame(row) {
  if (buying || tab !== END || !endgameOn() || !Acc.ready() || Acc.serverSaveState() || pendingGear()) return;
  const k = row.dataset.k, quote = shownEndgame.get(row), current = endgameQuote(Acc.load(), k);
  if (!quote || quote.reason || !quote.cost || current.reason || current.level !== quote.level) return renderLab();
  const epoch = Acc.sessionId();
  buying = true; pendingRow = END + ':' + k; endgameError = null; renderLab();
  let ok = false;
  try {
    const [receipt] = await runDirectGear([{p_action:'endgame_research',p_stat:k,p_count:quote.level}]);
    ok = receipt?.ok === true && receipt.action === 'endgame_research' && receipt.level === quote.next;
  } catch {} finally { buying = false; pendingRow = null; }
  if (epoch !== Acc.sessionId()) { renderLab(); return; }
  if (ok) {
    Snd.play('upgrade'); Snd.play('levelUp', {vol:.5}); labFx.t = 1.2;
    row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); hooks.cheer();
  } else { Snd.play('error'); endgameError = k; }
  renderLab(); hooks.onChange();
}
function renderEndgame(s) {
  const busy = buying || !!Acc.serverSaveState() || !!pendingGear();
  endgameBody.querySelectorAll('.labRow').forEach(row => {
    const k = row.dataset.k, q = endgameQuote(s, k), beam = k === 'beam', max = q.reason === 'max', locked = q.reason === 'locked';
    shownEndgame.set(row, q);
    const base = beam ? s.research?.guardian?.atk || 0 : 0;
    const rank = locked ? 0 : q.level, actual = beam ? base + rank : rank;
    const value = n => '+' + number.format((beam ? base * 4 : 0) + n) + (beam ? '%' : ' G');
    setH(row.querySelector('.lrLv'), 'Lv.' + number.format(actual) + (beam ? '/50' : ''));
    setH(row.querySelector('.lrD'), q.next == null || max || locked ? `<b>${value(rank)}</b>` : `${value(rank)} → <b>${value(q.next)}</b>`);
    row.classList.toggle('max', max);
    const btn = row.querySelector('.lrBtn');
    setH(btn, q.cost ? `연구 <small>🔮 ${number.format(q.cost.souls)} · ⚙ ${number.format(q.cost.steel)} · 💎 ${number.format(q.cost.crystal)}</small>` : max ? '연구 완료' : '🔒 Lv.10');
    if (q.cost) btn.setAttribute('aria-label', `연구: 영혼석 ${q.cost.souls}, 강철 ${q.cost.steel}, 마력석 ${q.cost.crystal}`);
    else btn.removeAttribute('aria-label');
    btn.disabled = busy || !Acc.ready() || !!q.reason || !q.cost;
    btn.setAttribute('aria-busy', String(pendingRow === END + ':' + k));
    setH(row.querySelector('.lrLock'), endgameError === k ? (Acc.serverSaveState() ? Acc.SAVE_WAIT_MESSAGE : '연구하지 못했습니다.') : '');
  });
}
async function buy(k, row) { if(buying)return;let ok = false;const epoch=Acc.sessionId();buying=true;pendingRow=tab+':'+k;renderLab();
  try { if(directGearEnabled()) {const [r]=await runDirectGear([{p_action:'research',p_type:tab,p_stat:k}]);ok=r.ok;}
    else Acc.update(d => { const [n, o] = P.buyResearch(d, tab, k); ok = o; return n; });
  }catch{}finally{buying=false;pendingRow=null;}if(epoch!==Acc.sessionId())return;
  if (ok) { Snd.play('upgrade'); Snd.play('levelUp', { vol: .5 }); if (k === 'efficiency') Snd.play('meteorCast', { vol: .4 }); labFx.t = 1.2; row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); hooks.cheer(); } else Snd.play('error');
  renderLab(); hooks.onChange(); }
async function buyBarLv() { if(buying)return;let ok = false;const epoch=Acc.sessionId();buying=true;pendingRow='bar';renderLab();
  try {if(directGearEnabled()){const [r]=await runDirectGear([{p_action:'bar'}]);ok=r.ok;}
    else Acc.update(d => { const [n, o] = P.buyBar(d); ok = o; return n; });
  }catch{}finally{buying=false;pendingRow=null;}if(epoch!==Acc.sessionId())return;const row = $('labBar');
  if (ok) { Snd.play('upgrade'); Snd.play('hitArmor', { vol: .5 }); labFx.t = 1.2; row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); hooks.cheer(); } else Snd.play('error'); renderLab(); hooks.onChange(); }
const pct = v => Math.round(v * 100);
export function renderLab() {
  if (!open) return; if (!built) build();
  const epoch = Acc.sessionId(); if (epoch !== endgameEpoch) { endgameEpoch = epoch; endgameError = null; }
  const available = endgameOn(), endTab = $('labTabs').querySelector('[data-t="endgame"]');
  if (endTab) { endTab.hidden = !available; endTab.classList.toggle('hidden', !available); }
  if (!available && tab === END) tab = 'guardian';
  const s = Acc.load(), r = s.research[tab], extra = tab === END;
  for (const id of ['labSum','labBody','labBar']) $(id).classList.toggle('hidden', extra);
  endgameBody?.classList.toggle('hidden', !extra);
  setH($('labMats'), `<span>🔮 영혼석 <b>${s.souls}</b></span><span>${MATN.steel} <b>${s.mat.steel}</b></span><span>${MATN.crystal} <b>${s.mat.crystal}</b></span>`);
  $('labTabs').querySelectorAll('.ftab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  if (endTab) endTab.setAttribute('aria-pressed', String(extra));
  if (extra) { $('labAdv').classList.add('hidden'); renderEndgame(s); return; }
  const m = endgameTowerMods(s.research, tab, undefined, available && tab === 'guardian' ? beamAttackBonus(s) : 0);
  setH($('labSum'), `<b>${TOWERS[tab].n}</b> 현재 연구 효과: 피해 <b>+${pct(m.dmg - 1)}%</b> · 사거리 <b>+${pct(m.rng - 1)}%</b> · 공격속도 <b>+${pct(m.rate - 1)}%</b> · 강화 비용 <b>-${pct(m.discount)}%</b>`);
  { const h = Sh.usableHero(s.hero), A = AD.advOf(h, s.adv[h]), on = !!(A && A.tower && (A.tower[tab] || A.tower.bar)); $('labAdv').classList.toggle('hidden', !on); // 전직 보너스 (출정 영웅의 분기만, 연구와 곱)
    if (on) setH($('labAdv'), `⚜ 전직 보너스 · ${A.icon} ${A.n}: <b>${A.td}</b>`); }
  $('labBody').querySelectorAll('.labRow').forEach(row => { const k = row.dataset.k, R = GR.RES[k], lv = r[k], max = lv >= R.max, why = GR.resBlock(s, tab, k), c = GR.resCost(k, lv);
    setH(row.querySelector('.lrLv'), `Lv.${lv}/${R.max}`); row.querySelectorAll('.lrPips i').forEach((p, i) => p.classList.toggle('on', i < lv)); row.classList.toggle('max', max);
    setH(row.querySelector('.lrD'), max ? `<b>${R.d(lv)}</b> (최대)` : `${lv ? R.d(lv) : '효과 없음'} → <b>${R.d(lv + 1)}</b>`);
    const btn = row.querySelector('.lrBtn'); setH(btn, max ? '연구 완료' : `연구 <small>🔮 ${c.souls} · ${MATN[R.mat]} ${c[R.mat]}</small>`); const dis = !!why||buying; if (btn.disabled !== dis) btn.disabled = dis;btn.setAttribute('aria-busy',String(pendingRow===tab+':'+k));
    setH(row.querySelector('.lrLock'), !max && why && why !== '최대' ? '🔒 ' + why : ''); });
  { const row = $('labBar'), lv = SX.barLv(s), max = lv >= SX.BAR.max, why = SX.barBlock(s), d = l => `바리케이드 체력 +${Math.round(SX.BAR.per * l * 100)}%`;
    setH(row.querySelector('.lrLv'), `Lv.${lv}/${SX.BAR.max}`); row.querySelectorAll('.lrPips i').forEach((p, i) => p.classList.toggle('on', i < lv)); row.classList.toggle('max', max);
    setH(row.querySelector('.lrD'), max ? `<b>${d(lv)}</b> (최대)` : `${lv ? d(lv) : '효과 없음'} → <b>${d(lv + 1)}</b>`);
    const btn = row.querySelector('.lrBtn'); setH(btn, max ? '연구 완료' : `보강 <small>${MATN.steel} ${SX.barCost(lv)}</small>`); const dis = !!why||buying; if (btn.disabled !== dis) btn.disabled = dis;btn.setAttribute('aria-busy',String(pendingRow==='bar'));
    setH(row.querySelector('.lrLock'), !max && why && why !== '최대' ? '🔒 ' + why : ''); }
}
G.openLab = openLab; G.labTab = t => { if (GR.TTYPES.includes(t) || t === END && endgameOn()) { tab = t; renderLab(); } };
