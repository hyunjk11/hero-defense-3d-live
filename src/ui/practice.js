// A separate, storage-isolated page. No login, run token, XP checkpoint or settlement.
import { CORE, tileX, tileZ } from '../core/grid.js';
import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { go, reload, configureNavigation } from '../core/nav.js';
import * as E from '../account/equip.js';
import * as HG from '../account/hero-growth.js';
import * as AD from '../data/advance.js';
import * as SX from '../account/steel.js';
import { treeBuild } from '../data/skill-tree.js';
import { readPartner } from '../account/hard-party.js';
import { showSelect, choose } from './select.js';
import { prepareHardParty, startHardParty } from '../heroes/hard-party.js';
import { ensureModels, MON_ASSETS, heroAssets } from '../render/characters.js';
import { CLASSES, isHidden } from '../data/heroes.js';

const KEY = 'hd3d_live_practice_snapshot_v1';
let run = null, elapsed = 0, spawn = 0, started = false;
export function preparePractice() {
  const s = HG.viewSave(), main = s.hero, partner = readPartner(main), party = [main, partner].filter(Boolean);
  const loadouts = Object.fromEntries(party.map(h => [h, {
    perm: s.heroLv[h], equip: E.bonus(s,h), legend:E.legendOf(s,h), adv:AD.advOf(h,s.adv[h]),
    heroLevel:HG.level(h), heroTree:treeBuild(s.growth?.trees,h,AD.advOf(h,s.adv[h])?.k,HG.level(h)), heroGear:E.equippedItems(s,h),
  }]));
  sessionStorage.setItem(KEY, JSON.stringify({ party, loadouts, growthEnabled:HG.available(), research:s.research, barRes:SX.barMul(SX.barLv(s)) }));
}
function valid(value) {
  return value && Array.isArray(value.party) && value.party.length >= 1 && value.party.length <= 2
    && new Set(value.party).size === value.party.length
    && value.party.every(h => CLASSES[h] && !isHidden(h) && value.loadouts?.[h]);
}
function panel(message, finished = false) {
  let box = $('practicePanel');
  if (!box) { box = document.createElement('div'); box.id = 'practicePanel'; box.className = 'panel'; box.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:45;padding:10px;max-width:90vw;text-align:center'; document.body.appendChild(box); }
  box.innerHTML = `<div id="practiceClock" role="status">${message}</div><small>연습 전용 · 보상·소모·진행 저장 없음</small><div>${finished ? '<button id="practiceRetry" class="gbtn sm">다시 연습</button>' : ''}<button id="practiceExit" class="gbtn sm">마을로</button></div>`;
  $('practiceExit').onclick = () => { G.phase = 'over'; go({town:1},0); };
  if ($('practiceRetry')) $('practiceRetry').onclick = () => reload();
  box.onpointerdown = e => e.stopPropagation();
}
function practiceHud(finished = false) {
  $('startWave').classList.add('hidden'); $('startWave').disabled = true;
  $('wavePrev')?.classList.add('hidden');
  $('phase').textContent = finished ? '연습 종료' : '연습 중 · 무보상';
}
export async function startPractice() {
  G.practice = true; G.grow = false; G.growthEnabled = false; G.xpRun = null;
  G.onXPWave = null; G.onRunEnd = finish; G.onStageClear = finish; G.endPractice = finish;
  configureNavigation({});
  if (!window.practiceStorageReady) { G.phase = 'over'; panel('저장 격리를 준비하지 못했습니다. 마을에서 다시 입장해 주세요.'); return; }
  try { run = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch {}
  if (!valid(run)) { G.phase = 'over'; panel('마을에서 현재 영웅을 선택한 뒤 연습장에 입장해 주세요.'); return; }
  panel('연습 준비 중…');
  try {
    await ensureModels([...MON_ASSETS, ...run.party.flatMap(h => heroAssets(h,true))]);
    if (run.party.length === 2) await prepareHardParty(run);
    showSelect(); $('select').classList.add('hidden');
    Object.assign(G, run.loadouts[run.party[0]], {growthEnabled:!!run.growthEnabled,focus:0,research:run.research,barRes:run.barRes,runDrops:[],runBossKills:[],gold:500,coreHp:999999,coreMax:999999,advBar:AD.advBarMul(run.loadouts[run.party[0]].adv)});
    choose(run.party[0]);
    practiceHud(); $('retreat').classList.add('hidden');
  } catch { G.phase = 'over'; panel('모델을 불러오지 못했습니다. 다시 시도해 주세요.',true); }
}
export function updatePractice(dt) {
  if (!G.practice || !run || G.phase === 'over' || !G.hero || G.chooseWait) return;
  if (!started) { if (G.phase !== 'build') return; started = true; if (run.party.length === 2) startHardParty(run); G.phase = 'wave'; G.wave=1; practiceHud(); }
  elapsed += dt; spawn -= dt;
  if (elapsed >= 30) { finish(); return; }
  if (spawn <= 0 && G.enemies.filter(e => !e.dead).length < 8) { spawn = 1.5; G.spawnEnemy('golem', 5, {x:tileX(CORE[0]-4),z:tileZ(CORE[1]),tile:[CORE[0]-4,CORE[1]]}); }
  const clock = $('practiceClock'); if (clock) clock.textContent = `연습 ${Math.ceil(30-elapsed)}초 · 처치 ${Object.values(G.stats.kills).reduce((a,b)=>a+b,0)}`;
}
function finish() {
  if (!G.practice || G.phase === 'over') return;
  G.phase = 'over'; G.spawnQ=[]; practiceHud(true);
  panel(`연습 종료 · ${Math.min(30, Math.floor(elapsed))}초 · 처치 ${Object.values(G.stats.kills).reduce((a,b)=>a+b,0)}`, true);
}
