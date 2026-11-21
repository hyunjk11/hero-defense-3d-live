import { weaponProcFeed } from './weapon-proc-feed.js';
import { FOCUS_MAX } from '../data/hero-growth.js';
import { renderBossDebuffs } from './boss-debuffs.js';
import { renderHeroEffects } from './hero-effects.js';
import { healK } from '../data/spire.js';
import { eDescription } from '../data/hero-e.js';
import { $ } from '../core/util.js';
import { UPS } from '../data/heroes.js';
import { TOWERS, BARRICADE, barHpAt } from '../data/towers.js';
import { towerAvailable, towerVisible, towerUpgradeBlock, towerUpgradeCost } from '../world/tower-rules.js';
import { upPreview } from './stats.js';
import { repairCost } from '../world/towers.js';
import { G } from '../core/state.js';
import { hero, stat, WARP_CD } from '../heroes/hero.js';
import { upCost } from './input.js';
import { legendActive, legendCd } from '../heroes/legend.js';
import { BRANCH, MAX_TOWER_LEVEL, XP_NEED, starsFor } from '../data/growth.js';
import { renderBranch } from './branch.js';
import { refreshWavePrev } from './waveprev.js';
const r2 = v => Math.round(v * 100) / 100, f1 = v => Math.round(v * 10) / 10;
function banner(text, color = '#fff', ms = 1600) { const b = $('banner'); b.textContent = text; b.style.color = color; b.classList.toggle('long', String(text).length > 22); /* 긴 문구는 작은 글씨 + 줄바꿈 */ b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), ms); }
function showNote(list, ms = 2400) {
  const n = $('note');
  if (!list.length) return;
  n.setAttribute('role', 'status');
  n.textContent = list.length === 1 ? `신규 몬스터 · ${list[0].name}` : '신규 몬스터';
  n.classList.remove('hidden');
  clearTimeout(n._t);
  n._t = setTimeout(() => n.classList.add('hidden'), Math.min(ms, 2400));
}
function setPhaseUI() { const ph = $('phase'); ph.textContent = G.phase === 'wave' ? '전투 중 (밤)' : '건설 단계 (낮)'; ph.classList.toggle('night', G.phase === 'wave'); $('startWave').disabled = G.phase !== 'build'; refreshWavePrev(); }
function setBar(f, t, r) { const w = Math.max(0, Math.min(1, r)) * 100 + '%', a = $(f), b = $(t); if (a.style.width !== w) { a.style.width = w; b.style.width = w; } }
function updBossBar() { let b = null; for (const e of G.enemies) if (e.E.boss && !e.dead && e.dying === undefined && (!b || e.max > b.max)) b = e; // 여러 보스면 가장 강한(챕터) 보스
  $('bossHud').classList.toggle('hidden', !b); renderBossDebuffs($('bossDebuffs'), b, G.t, {
    floor:G.spire&&G.dungeon?G.dg?.floors?.[G.dg.floor]:null,
    attackScale:b&&G.spire&&G.dungeon&&G.spireAtkK?G.spireAtkK(b):1
  }); if (!b) return; setBar('bossFill', 'bossTr', b.hp / b.max); const nm = $('bossName'); if (nm.textContent !== b.E.n) nm.textContent = b.E.n; }
function refreshHud() {
  weaponProcFeed.refresh(G, performance.now());
  // Dungeon HUD temporarily owns this strip; restore it above normal HP on return.
  const effects=$('heroEffects'),heroBox=$('heroBox');
  if (!G.dungeon && effects && heroBox && effects.parentNode!==heroBox) heroBox.insertBefore(effects,heroBox.querySelector('.bar.hp'));
  const controlled=G.hero; // withHero temporarily changes the module binding during party simulation.
  renderHeroEffects($('heroEffects'), ['build','wave'].includes(G.phase)?controlled:null, {
    now:G.t, focus:G.focus, growthEnabled:G.growthEnabled, dungeon:G.dungeon, dungeonDamage:G.dgDmg,
    dungeonMods:G.dungeon&&G.dgM&&controlled?G.dgM(controlled):null,
    damageScale:G.dungeon&&G.spireDmgK&&controlled?G.spireDmgK(controlled):1,
    healScale:G.dungeon&&G.spire?healK(G.dg?.floors?.[G.dg.floor]):1
  });
  $('gold').textContent = Math.floor(G.gold); $('wave').textContent = G.wave; setBar('coreBar', 'coreTr', G.coreHp / G.coreMax); if (G.coreHb) G.coreHb.set(G.coreHp / G.coreMax); $('coreTxt').textContent = `${Math.max(0, G.coreHp)}/${G.coreMax}`;
  refreshWavePrev(); $('enemyCnt').textContent = `적 ${G.enemies.filter(e => !e.dead).length + (G.spawnQ ? G.spawnQ.length : 0)}`;
  document.querySelectorAll('.up').forEach(b => { const k = b.dataset.up, c = upCost(k); b.classList.toggle('hidden', k === 'focus' ? !G.growthEnabled || !!G.dungeon : !!G.growthEnabled && k !== 'bar'); if (k === 'focus') { const n = G.focus || 0; b.textContent = `전투 집중 ${n}/${FOCUS_MAX} · ${n >= FOCUS_MAX ? 'MAX' : c + 'G'}`; b.title = '단계당 공격 +4% · 공속 +2% · 스킬 계수 +4% · 쿨 ×0.98 (회복 없음)'; b.disabled = n >= FOCUS_MAX || G.gold < c || G.paused || G.navigating || !['build', 'wave'].includes(G.phase); return; } const h = `<span class="row"><span>${UPS[k].n} Lv.${G.ups[k]}</span><small>${c}G</small></span>${k === 'bar' ? '' : `<span class="desc">${UPS[k].d}</span>`}`; if (b._h !== h) { b._h = h; b.innerHTML = h; if (k === 'bar') b.setAttribute('aria-label', `${UPS[k].n} Lv.${G.ups[k]}, ${c}골드, ${UPS[k].d}`); }
    const tt = k === 'bar' ? `바리케이드 체력 ${Math.round(barHpAt(G.ups.bar, (G.advBar || 1) * (G.barRes || 1)))} → ${Math.round(barHpAt(G.ups.bar + 1, (G.advBar || 1) * (G.barRes || 1)))}` : upPreview(G.hero, k); if (b._tt !== tt) { b._tt = tt; b.title = tt ? `${UPS[k].n}: ${tt}` : ''; b.dataset.nx = tt; } /* Q-7: 지금 → 다음 (툴팁 · data-nx) */
    const dis = G.gold < c; if (b.disabled !== dis) b.disabled = dis; }); // 바뀔 때만 다시 그림 (매 프레임 innerHTML 교체 → 클릭 씹힘 방지)
  document.querySelectorAll('.tool').forEach(b => { const T2 = TOWERS[b.dataset.tool]; if (b.dataset.tool === 'guardian') b.classList.toggle('hidden', !towerVisible('guardian')); if (G.practiceSandbox) { if (b.dataset.tool === 'clear') b.classList.add('hidden'); if (T2 || b.dataset.tool === 'barricade') { const price = b.querySelector('small'); if (price && !price.hidden) price.hidden = true; } } if (T2) b.disabled = !towerAvailable(b.dataset.tool,G) || (!G.practiceSandbox && G.gold < T2.cost); if (b.dataset.tool === 'barricade') b.disabled = !G.practiceSandbox && G.gold < BARRICADE.cost; });
  const allRepair = $('repairAllBtn');
  if (allRepair) {
    const costs = G.towers.map(repairCost).filter(c => c > 0), total = costs.reduce((a, b) => a + b, 0);
    allRepair.disabled = !costs.some(c => c <= G.gold) || G.paused || G.navigating || !['build', 'wave'].includes(G.phase);
    allRepair.classList.toggle('hidden', !!G.dungeon);
    allRepair.title = total ? `모두 수리 · ${total}G` : '모두 수리';
    allRepair.setAttribute('aria-label', total ? `모두 수리, 전체 비용 ${total}골드` : '모두 수리, 수리할 타워 없음');
  }
  const s = G.sel;
  renderBranch(s);
  if (s && s.kind === 'tower') {
    const D = TOWERS[s.type], S = s.S, Bn = s.branch && BRANCH[s.type][s.branch];
    $('tName').textContent = `${D.n} Lv.${s.lvl}/${MAX_TOWER_LEVEL}${Bn ? ' · ' + Bn.n : ''}`;
    const stars = starsFor(s.xp || 0), cap = XP_NEED[stars] || XP_NEED[2], lo = XP_NEED[stars - 1];
    const ratio = stars >= 3 ? 1 : Math.max(0, Math.min(1, ((s.xp || 0) - lo) / (cap - lo)));
    $('tStats').innerHTML = `<span class="tstar">${'★'.repeat(stars)}<i>${'☆'.repeat(3-stars)}</i></span> XP ${Math.floor(s.xp || 0)}/${cap}<div class="txp"><b style="width:${ratio*100}%"></b></div>${s.type === 'guardian' ? `초당 피해 ${r2(S.dmg * S.rate)} → ${r2(S.dmg * S.rate * S.beamMaxHeat)}<br>사거리 ${r2(S.range)}` : `피해 ${r2(S.dmg)} · ${r2(S.rate)}/초<br>사거리 ${r2(S.range)}${S.splash ? ' · 폭발 ' + r2(S.splash) : ''}${S.chain ? ' · 연쇄 ' + S.chain : ''}`}`;
    const u = $('tUp'), c = towerUpgradeCost(s, G.practiceSandbox), why = towerUpgradeBlock(s, G.gold, G.practiceSandbox);
    u.textContent = s.lvl >= MAX_TOWER_LEVEL ? 'MAX' : `Lv.${s.lvl + 1}${G.practiceSandbox ? '' : ' · ' + c + 'G'}`; u.disabled = !!why;
    u.title = ''; delete u.dataset.nx;
    const k = s.hp / s.max, rc = repairCost(s), rb = $('tRep'); $('tStats').innerHTML += `<br>내구도 ${Math.ceil(s.hp)}/${s.max}`;
    rb.style.display = ''; rb.textContent = rc ? `수리 (R) −${rc}G` : '수리 (내구도 최대)'; rb.disabled = !rc || G.gold < rc; rb.classList.toggle('warn', k < .5);
    $('tSell').textContent = G.practiceSandbox ? '철거' : `판매 (+${Math.floor(s.invest * .7 * (k >= .999 ? 1 : .5 + .5 * k))}G)`; }
  else if (s && s.kind === 'bar') { $('tName').textContent = '바리케이드'; $('tStats').innerHTML = `내구도 ${Math.ceil(s.hp)}/${Math.ceil(s.max)}<br>몬스터가 돌아가거나 부숴야 합니다`; $('tUp').textContent = '-'; $('tUp').disabled = true; $('tSell').textContent = G.practiceSandbox ? '철거' : `철거 (+${BARRICADE.refund}G)`; $('tRep').style.display = 'none'; }
  if (hero) { const wb = $('warpBtn'); if (wb) { const wp = hero.warpCd > 0 ? hero.warpCd / WARP_CD * 100 : 0; $('warpCd').style.setProperty('--p', wp + '%'); $('warpCd').textContent = hero.warpCd > 0 ? Math.ceil(hero.warpCd) : ''; wb.classList.toggle('channel', hero.warpT > 0); }
    setBar('heroBar', 'heroTr', hero.hp / hero.max); const cdp = hero.skillCd > 0 ? hero.skillCd / stat.skillCd() * 100 : 0; $('skillCd').style.setProperty('--p', cdp + '%'); $('skillCd').textContent = hero.skillCd > 0 ? Math.ceil(hero.skillCd) : ''; $('skillBtn').classList.toggle('ready', hero.skillCd <= 0);
    const la = legendActive(), lb = $('legBtn'); lb.classList.toggle('hidden', !la); if (la) { $('legName').textContent = (la.icon ? la.icon+' ' : '')+la.n; lb.setAttribute('aria-label',la.n+' (E)'); lb.title=eDescription(la); const lp = hero.lcd > 0 ? hero.lcd / legendCd() * 100 : 0; $('legCd').style.setProperty('--p', lp + '%'); lb.style.setProperty('--p', lp + '%'); $('legCd').textContent = hero.lcd > 0 ? Math.ceil(hero.lcd) : ''; lb.classList.toggle('ready', !(hero.lcd > 0)); } }
}

export { banner, showNote, setPhaseUI, updBossBar, refreshHud };
