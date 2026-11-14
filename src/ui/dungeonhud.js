// 던전 원정 HUD 렌더링 (C-12: dungeon/run.js 에서 분리 — 동작 불변). 상단 층·축복 표시, 영웅 바, 합동 공격 버튼
import { $, esc } from '../core/util.js';
import { askConfirm } from './confirm.js';
import { G } from '../core/state.js';
import { CLASSES, heroLabel } from '../data/heroes.js';
import { floorLabel } from '../data/spire.js';
import { BLESS_BY, dungeonReward, ULT_MAX, jointReady } from '../data/dungeon.js';
// 원정 상태 D = G.dg (dungeon/run.js 가 만듦 — 이 모듈이 먼저 평가되므로 함수 안에서 읽음)
export function refreshTop() { const D = G.dg; const b = $('dgBl'); if (b) b.innerHTML = Object.entries(D.bless).map(([id, n]) => `<i title="${esc(BLESS_BY[id].n)}">${BLESS_BY[id].icon}${n > 1 ? `<sub>${n}</sub>` : ''}</i>`).join(''); }
export function refreshAuto() {
  const D = G.dg;
  document.body.classList.toggle('dgAllAuto', !!D.auto && !D.over);
  for (const id of ['dgAuto', 'dgBlessAuto']) { const b = $(id); if (!b) continue; b.textContent = `자동 진행 ${D.auto ? 'ON' : 'OFF'}`; b.classList.toggle('on', D.auto); b.setAttribute('aria-pressed', String(D.auto)); b.disabled = D.over; }
}
export function buildHud({ pick, joint, toggleAuto, giveUp }) { const D = G.dg;
  const effects = $('heroEffects'); if (effects && effects.parentNode !== $('hud')) $('hud').appendChild(effects);
  let top = $('dgTop'); if (!top) { top = document.createElement('div'); top.id = 'dgTop'; $('top').appendChild(top); }
  top.className = 'pill dgTop'; top.innerHTML = `<span class="lbl">${G.spire ? '⚔ 던전' : '🔮 영혼석 던전'}${D.entry && D.entry.mode === 'practice' ? ' <i class="dgPrTag">연습</i>' : ''}</span><b id="dgFloor"></b>${G.spire ? '' : '<b id="dgSoulBank" class="dgSoulBank">🔮 0</b>'}<span id="dgBl" class="dgBl"></span><button id="dgGiveUp" class="dgGiveUp" title="귀환">🏳 귀환</button>`;
  $('dgGiveUp').onclick = e => { e.stopPropagation(); if (D.over) return; askConfirm({ title: '귀환', icon: '🏳', body: G.spire ? G.spire.practice ? '연습을 마치고 귀환할까요? (기록·보상 없음)' : '완료한 층 기록과 보상을 정산하고 귀환할까요?' : '돌파한 층 보상을 받고 귀환할까요?', ok: '귀환', tone: 'danger' }).then(y => { if (!y || D.over) return; giveUp(); }); };
  let bar = $('dgBar'); if (!bar) { bar = document.createElement('div'); bar.id = 'dgBar'; $('hud').appendChild(bar); }
  bar.innerHTML = G.heroes.map((h, i) => { const C = CLASSES[h.cls], A = h.adv; return `<button class="dgP" data-i="${i}" style="--hc:#${C.color.toString(16).padStart(6, '0')}" title="${esc(heroLabel(h.cls))} (${i + 1})"><span class="dgIc">${C.icon}</span><span class="dgNm">${esc(C.nm)}${A ? `<i style="color:${A.c}">${A.icon}</i>` : ''}</span><span class="dgHp"><u></u></span><span class="dgUlt"><u></u></span><span class="dgSk"></span><span class="dgKey">${i + 1}</span></button>`; }).join('');
  bar.querySelectorAll('.dgP').forEach(b => { b.onpointerdown = e => e.stopPropagation(); b.onclick = e => { e.stopPropagation(); pick(+b.dataset.i); }; });
  let jb = $('dgJoint'); if (!jb) { jb = document.createElement('button'); jb.id = 'dgJoint'; $('hud').appendChild(jb); } jb.className = 'dgJoint'; jb.title = '합동 공격 (Space)';
  jb.innerHTML = '<span class="dgJf"></span><span class="dgJt">⚡ 합동 공격</span><small id="dgJp"></small>'; jb.onpointerdown = e => e.stopPropagation(); jb.onclick = e => { e.stopPropagation(); joint(); };
  let ab = $('dgAuto'); if (!ab) { ab = document.createElement('button'); ab.id = 'dgAuto'; $('hud').appendChild(ab); }
  ab.type = 'button'; ab.className = 'dgAuto'; ab.onpointerdown = e => e.stopPropagation(); ab.onclick = e => { e.stopPropagation(); toggleAuto(); ab.blur(); };
  if (!$('dgFlash')) { const f = document.createElement('div'); f.id = 'dgFlash'; $('stageClear').parentNode.appendChild(f); }
  refreshBar(); refreshTop(); refreshAuto();
}
export function refreshBar() { const D = G.dg; const bank = $('dgSoulBank'); if (bank) bank.textContent = `🔮 ${dungeonReward(D.cleared, false).toLocaleString()}`; const L = D.floors, F = L[D.floor], fl = $('dgFloor'); if (!F) return; if (G.spire) { if (fl) fl.textContent = floorLabel(F, D.wave) + (D.nextT > 0 ? ' · ✔ 돌파!' : ''); } else if (fl) fl.textContent = `${F.n} (${D.floor + 1}/${L.length}) · 웨이브 ${Math.max(1, D.wave + 1)}/${F.waves.length}`;
  const jb = $('dgJoint'); if (jb) { const L = G.heroes.filter(h => h.dead <= 0), m = L.length ? Math.min(...L.map(h => h.ult || 0)) : 0, rd = jointReady(G.heroes) && !D.blessing; jb.classList.toggle('ready', rd); jb.disabled = !rd;
    jb.style.setProperty('--p', Math.round(m) + '%'); const jp = $('dgJp'); if (jp) jp.textContent = rd ? 'Space' : Math.floor(m) + '%'; }
  document.querySelectorAll('#dgBar .dgP').forEach(b => { const h = G.heroes[+b.dataset.i]; if (!h) return; b.classList.toggle('ctl', h === G.hero); b.classList.toggle('down', h.dead > 0);
    const w = Math.max(0, h.hp / h.max) * 100 + '%', u = b.querySelector('.dgHp u'); if (u.style.width !== w) u.style.width = w;
    const uw = (h.dead > 0 ? 0 : Math.round(h.ult || 0)) + '%', uu = b.querySelector('.dgUlt u'); if (uu.style.width !== uw) uu.style.width = uw; b.classList.toggle('ultFull', h.dead <= 0 && (h.ult || 0) >= ULT_MAX); b.querySelector('.dgSk').classList.toggle('ready', h.skillCd <= 0 && h.dead <= 0); }); }
