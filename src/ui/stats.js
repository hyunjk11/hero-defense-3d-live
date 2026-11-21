// ================= 영웅 능력치: 마을 패널(#statPanel) + 전투 오버레이(#statOv, C 키 · 📊 버튼) =================
// 수치는 data/herostats.js 순수 수식 (게임 난수·밸런스에 영향 없음). 전투 오버레이는 일시정지하지 않음 · 0.25초마다 글자만 갱신 (버튼은 탭 목록이 바뀔 때만 다시 만듦)
import { FOCUS_MAX } from '../data/hero-growth.js';
import { Snd } from '../audio/audio.js';
import { $, esc } from '../core/util.js';
import { escLayer } from './keys.js';
import { definePanel } from './panel.js';
import { G } from '../core/state.js';
import { VISIBLE_HEROES, heroLabel } from '../data/heroes.js';
import * as HG from '../account/hero-growth.js';
import { mountTree, selectedBuild } from './skill-tree.js';
import { treeSummary, treeMods } from '../data/skill-tree.js';
import { mountGrowth } from './hero-growth.js';
import * as Acc from '../account/account.js';
import * as Sh from '../account/shop.js';
import * as E from '../account/equip.js';
import { setStatuses } from '../account/set-status.js';
import { equippedSetsHtml } from './setview.js';
import * as AD from '../data/advance.js';
import { NOM, breakdown, finalStats, heroCP, effectsOf, heroEEffect, critMul, CP_TXT } from '../data/herostats.js';
import { meterDps, skillShare } from '../combat/meter.js';

const r1 = v => Math.round(v * 10) / 10, int = v => Math.round(v).toLocaleString('ko-KR');
const big = v => v >= 1e6 ? `${r1(v / 1e6)}M` : v >= 1e4 ? `${r1(v / 1e3)}k` : int(v);
const DPS_TXT = '예상 DPS = 공격력 × 공격 속도 × (1 + 치명타 확률 × (치명타 피해 − 100%)) · 기본 공격 기준 (스킬·조건부 특성 제외)';
const st = { tab:'stats', town: false, cls: null, ov: false, idx: -1, timer: 0, tabsKey: '' };

// ---------- 마을 ----------
function townData(cls, s = Acc.load()) { const eq = E.bonus(s, cls), L = { perm: s.heroLv[cls] || { hp: 0, atk: 0 }, adv: AD.advOf(cls, s.adv[cls]), eq, level: HG.level(cls) }, tree = treeMods(selectedBuild(cls, s));
  const B = breakdown(cls, L,{tree}); return { ...B, L, title: AD.advTitle(cls, s.adv[cls]) || heroLabel(cls), efx: heroEEffect(cls, HG.available() ? L.level : null, eq.cdr || 0,L.adv,tree), fx: effectsOf(E.legendOf(s, cls), eq.cdr || 0) }; }
const chips = parts => parts.map(([src, v], i) => `<span class="stChip${i ? '' : ' base'}"><i>${esc(src)}</i> ${esc(v)}</span>`).join('');
const fxHtml = fx => fx.length ? fx.map(x => `<div class="stFx ${x.kind}"><div><b>${x.icon ? `<span aria-hidden="true">${x.icon}</span> ` : ''}${esc(x.n)}</b><small>${esc(x.tag)}</small></div><p>${esc(x.d || '')}</p></div>`).join('') : '<div class="stNone">장착한 전설 장비 효과 없음</div>';
function renderTown() { const s = Acc.load(), own = VISIBLE_HEROES.filter(h => Sh.heroOwned(h)); if (!own.includes(st.cls)) st.cls = Sh.usableHero(s.hero);
  const tabsKey = own.join(',') + ':' + st.cls;
  if ($('statTabs').dataset.key !== tabsKey) { $('statTabs').dataset.key = tabsKey; $('statTabs').innerHTML = own.map(h => `<button class="ftab${h === st.cls ? ' on' : ''}" data-h="${h}">${esc(heroLabel(h))}</button>`).join(''); }
  const D = townData(st.cls, s), F = D.F;
  if (!$('heroGrowth')) $('statBody').innerHTML = '<div class="treeTabs"><button class="ftab" data-view="stats">능력·성장</button><button class="ftab" data-view="tree">특성</button></div><div id="statsView"><section id="heroGrowth" class="heroGrowth" aria-label="영웅 레벨업"></section><div id="statDetails"></div></div><section id="heroTree" class="hidden"></section>';
  mountGrowth(st.cls, s); mountTree(st.cls, s);
  $('statsView').classList.toggle('hidden',st.tab!=='stats');$('heroTree').classList.toggle('hidden',st.tab!=='tree');
  document.querySelectorAll('[data-view]').forEach(x=>{x.classList.toggle('on',x.dataset.view===st.tab);x.onclick=()=>{st.tab=x.dataset.view;renderTown();};});
  $('statDetails').innerHTML = `<div class="stHead">${esc(D.title)} <small>Q ${esc(D.C.skill || '')}</small></div>
    <div class="stTop"><div class="stCP cp" title="${esc(CP_TXT)}"><small>전투력</small><b id="statCP">${int(D.cp)}</b></div><div class="stCP" title="${esc(DPS_TXT)}"><small>예상 DPS</small><b id="statDps">${r1(F.dps)}</b></div><div class="stCP"><small>실효 체력</small><b>${int(F.ehp)}</b></div></div>
    <div class="stRows">${D.rows.map(r => `<div class="stRow" data-k="${r.k}"><span class="stN">${r.n}</span><b class="stV">${esc(r.v)}</b><span class="stP">${chips(r.parts)}</span></div>`).join('')}</div>
    <div class="lbl">착용 세트 · 능력치에 포함</div>${equippedSetsHtml(setStatuses(s, st.cls).filter(x => x.count))}
    <div class="lbl">영웅 고유 스킬 · Lv.10</div><div class="stFxs">${fxHtml(D.efx)}</div>
    <div class="lbl">장착 전설 자동 효과</div><div class="stFxs">${fxHtml(D.fx)}</div>
    <div class="stNote">${esc(CP_TXT)}<br>${esc(DPS_TXT)}<br>판 안 강화·던전 축복은 전투 중 📊 (C 키) 에서 확인</div>`; }
export function openStats(cls) { st.town = true; st.cls = cls || Sh.usableHero(Acc.load().hero); STP.show(); Snd.play('ui'); renderTown(); $('statClose').focus(); void HG.refresh({ maxAgeMs: HG.awakeningSkillServer() ? 0 : 30000 }); }
HG.onGrowth(() => { if (st.town) renderTown(); });
export function closeStats() { if (!st.town) return; st.town = false; STP.hide(); if (G.screen === 'town') $('twStats')?.focus(); }
const STP = definePanel('statPanel', { id: 'statPanel', z: 40, isOpen: () => st.town, close: () => closeStats() });

// ---------- 전투 ----------
const liveM = h => { const a = h.adv && h.adv.atk; return { tree:h.treeMods, cls: h.cls, ups: G.ups, growthEnabled: G.growthEnabled, focus: G.focus, advLow: a && a.lowHp && h.hp <= h.max * a.lowHp ? a.lowAtk : 1, M: (G.dgM && G.dgM(h)) || NOM, robo: !!h.robo, max: h.max }; };
// Q-7 (2026-10-24): 전투 업그레이드(#ups) "지금 → 다음" 수치 — 같은 finalStats 를 G.ups[k]+1 로 한 번 더 (barricade 는 hud 에서)
export function upPreview(h, k) {
  if (!h || !h.C) return ''; const m = liveM(h), a = finalStats(h.C, h.eq, m), b = finalStats(h.C, h.eq, { ...m, ups: { ...m.ups, [k]: (m.ups[k] || 0) + 1 } }), r2 = v => Math.round(v * 100) / 100;
  if (k === 'atk') return `공격력 ${r1(a.dmg)} → ${r1(b.dmg)}`;
  if (k === 'spd') return `초당 공격 ${r2(a.rate)} → ${r2(b.rate)}회`;
  if (k === 'rng') return `사거리 ${r1(a.range)} → ${r1(b.range)}`;
  if (k === 'skill') return `스킬 위력 ×${r2(a.skillMul)} → ×${r2(b.skillMul)} · 쿨 ${r1(a.cd)}초 → ${r1(b.cd)}초`;
  return '';
}
export function liveStats(h) { const F = finalStats(h.C, h.eq, liveM(h)); return { F, cp: heroCP(h.cls, F) }; }
function buffs(h, m) { const o = h.tree&&Object.keys(h.tree.choices).length?['특성 · '+treeSummary(h.tree)]:[], u = G.ups || {}, M = m.M;
  for (const [k, n, p] of [['atk', '공격', 15], ['spd', '공속', 10], ['rng', '사거리', 8], ['skill', '스킬', 25]]) if (u[k]) o.push(`영웅 강화 ${n} Lv.${u[k]} (+${u[k] * p}%)`);
  if (G.growthEnabled) { o.splice(0,o.length,...(h.tree&&Object.keys(h.tree.choices).length?['특성 · '+treeSummary(h.tree)]:[])); o.push(`영웅 Lv.${h.C.level || 1} · 전투 집중 ${G.focus || 0}/${FOCUS_MAX}`); }
  if(h.eShield?.until>G.t) o.push(`성광 방벽 · 흡수 ${Math.ceil(h.eShield.value)}`);
  if (m.advLow !== 1) o.push(`광전사 분노 공격 +${r1((m.advLow - 1) * 100)}%`); if (m.robo) o.push('변신 로봇 사거리 +45%');
  if (M !== NOM) { const b = []; if (M.dmg !== 1) b.push(`공격 ×${r1(M.dmg * 100) / 100}`); if (M.rate !== 1) b.push(`공속 ×${r1(M.rate * 100) / 100}`); if (M.crit) b.push(`치명 +${M.crit}%`); if (M.critD) b.push(`치명 피해 +${M.critD}%`); if (M.range !== 1) b.push(`사거리 ×${r1(M.range * 100) / 100}`); if (M.cd !== 1) b.push(`재사용 ×${r1(M.cd * 100) / 100}`); if (M.taken !== 1) b.push(`받는 피해 ×${r1(M.taken * 100) / 100}`); if (b.length) o.push('던전 축복: ' + b.join(' · ')); }
  return o; }
const heroesNow = () => (G.heroes && G.heroes.length ? G.heroes : G.hero ? [G.hero] : []);
const cell = (n, v, cls = '') => `<div class="ovC ${cls}"><span>${n}</span><b>${v}</b></div>`;
function renderOv() { const L = heroesNow(), hud = $('hud'); if (!L.length || !hud || hud.classList.contains('hidden')) { closeOv(); return; }
  const key = L.map(h => h.cls).join(',') + '|' + L.indexOf(G.hero); if (key !== st.tabsKey) { st.tabsKey = key; st.idx = Math.max(0, L.indexOf(G.hero));
    $('ovTabs').innerHTML = L.length > 1 ? L.map((h, i) => `<button class="ftab${i === st.idx ? ' on' : ''}" data-i="${i}">${esc(heroLabel(h.cls))}${h === G.hero ? ' 🎮' : ''}</button>`).join('') : ''; }
  if (st.idx >= L.length) st.idx = 0; const h = L[st.idx], m = liveM(h), F = finalStats(h.C, h.eq, m), cp = heroCP(h.cls, F), dm = h.dm, t = G.t;
  const team = L.reduce((a, x) => a + (x.dm ? x.dm.tot : 0), 0) + (G.dmOther ? G.dmOther.tot : 0), bf = buffs(h, m);
  $('ovBody').innerHTML = `<div class="ovHd">${esc(h.C.title || heroLabel(h.cls))}${h.dead > 0 ? ' <em>쓰러짐</em>' : ''}</div>
    <div class="ovG">${cell('전투력', int(cp), 'hi')}${cell('예상 DPS', r1(F.dps), 'hi')}${cell('공격력', r1(F.dmg))}${cell('공격 속도', `${Math.round(F.rate * 100) / 100}/초`)}${cell('치명타 확률', `${r1(Math.min(100, F.crit))}%`)}${cell('치명타 피해', `${Math.round(F.critX * 100)}%`)}${cell('사거리', r1(F.range))}${cell('체력', `${int(Math.max(0, h.hp))}/${int(h.max)}`)}${cell('피해 감소', `${r1((1 - F.taken) * 100)}%`)}${cell('스킬 피해', `${Math.round(F.skillMul * 100)}%`)}${cell('Q 재사용', `${r1(F.cd)}초 (−${r1(F.cdRed * 100)}%)`)}${cell('기대 배율', `×${Math.round(critMul(F.crit, F.critX) * 100) / 100}`)}</div>
    <div class="ovSub">착용 세트 · 능력치에 포함</div>${equippedSetsHtml(h.equippedSets || [])}
    <div class="ovSub">영웅 E / 장비 자동 효과</div><div class="stFxs">${fxHtml([...heroEEffect(h.cls, h.C.level || 1, h.eq?.cdr || 0,h.adv,h.treeMods), ...effectsOf(h.lsk)])}</div>
    <div class="ovSub">판 안 버프</div><div class="ovBf">${bf.length ? bf.map(x => `<span>${esc(x)}</span>`).join('') : '<span class="none">없음</span>'}</div>
    <div class="ovSub">피해 미터</div>${dm ? `<div class="ovG m">${cell('실시간 DPS (5초)', r1(meterDps(dm, t)), 'hi')}${cell('총 피해', big(dm.tot))}${cell('최고 한 방', big(dm.max))}${cell('처치 수', int(dm.kills))}${cell('스킬 비중', `${Math.round(skillShare(dm) * 100)}%`)}${cell('받은 피해', big(dm.taken))}${cell('팀 피해 비중', `${team > 0 ? Math.round(dm.tot / team * 100) : 0}%`)}</div>` : ''}
    ${G.dmOther ? `<div class="ovOther">${G.dungeon ? '합동 공격' : '타워'} 피해 ${big(G.dmOther.tot)} · 실시간 ${r1(meterDps(G.dmOther, t))}/초</div>` : ''}`; }
function openOv() { if (!heroesNow().length) return; st.ov = true; st.tabsKey = ''; $('statOv').classList.remove('hidden'); $('statBtn').classList.add('on'); renderOv(); clearInterval(st.timer); st.timer = setInterval(() => { if (st.ov) renderOv(); }, 250); }
function closeOv() { st.ov = false; clearInterval(st.timer); st.timer = 0; const o = $('statOv'); if (o) o.classList.add('hidden'); const b = $('statBtn'); if (b) b.classList.remove('on'); }
export function toggleOv() { if (st.ov) closeOv(); else openOv(); Snd.play('ui'); }

// 전투 쪽 (버튼·C 키·탭)은 모듈을 불러오면 바로 연결 (?test=1 처럼 마을 흐름 없이 시작해도 동작) · 마을 버튼은 initStats (flow.js 가 다른 창 닫기를 넘김)
function bindBattle() {
  $('statBtn').onclick = () => toggleOv(); $('ovClose').onclick = () => { Snd.play('ui'); closeOv(); };
  $('ovTabs').onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; st.idx = +b.dataset.i; Snd.play('select'); document.querySelectorAll('#ovTabs .ftab').forEach(x => x.classList.toggle('on', x === b)); renderOv(); };
  $('statClose').onclick = () => { Snd.play('ui'); closeStats(); };
  $('statTabs').onclick = e => { const b = e.target.closest('[data-h]'); if (!b || b.dataset.h === st.cls) return; Snd.play('select'); st.cls = b.dataset.h; renderTown(); };
  addEventListener('keydown', e => {
    if (st.town && e.key === 'Tab') { const list=[...$('statPanel').querySelectorAll('button:not(:disabled),input:not(:disabled),summary')].filter(x=>x.getClientRects().length); const first=list[0],last=list.at(-1); if ((!e.shiftKey && (document.activeElement===last || !$('statPanel').contains(document.activeElement))) || (e.shiftKey && (document.activeElement===first || !$('statPanel').contains(document.activeElement)))) { e.preventDefault(); (e.shiftKey?last:first)?.focus(); } return; }
    const tag = document.activeElement && document.activeElement.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const E = G.endStatsUI, endOn = G.phase === 'over' && E && E.kind(); // 결과 화면: C = 📊 통계 (ui/endstats.js)
    if (endOn && (e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) { E.toggle(); return; }
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !$('hud').classList.contains('hidden') && G.phase !== 'select') toggleOv(); });
  escLayer('endStats', 70, () => !!(G.endStatsUI && G.endStatsUI.isOpen()), () => G.endStatsUI.close()); escLayer('statOv', 15, () => st.ov, () => closeOv());
  G.statsUI = { townData, liveStats, openStats, closeStats, toggleOv, isOpen: () => st.ov, townOpen: () => st.town };
}
if (typeof document !== 'undefined' && document.getElementById('statBtn')) bindBattle();
export function initStats({ beforeOpen } = {}) { $('twStats').onclick = () => { if (beforeOpen) beforeOpen(); openStats(); }; }
