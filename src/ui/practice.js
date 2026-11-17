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
import { showSelect, choose } from './select.js';
import { ensureModels, MON_ASSETS, heroAssets } from '../render/characters.js';
import { CLASSES, isHidden } from '../data/heroes.js';

const KEY = 'hd3d_live_practice_snapshot_v1';
let run = null, elapsed = 0, spawn = 0, started = false;
export function preparePractice() {
  const s = HG.viewSave(), main = s.hero, party = [main];
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
// Old two-hero snapshots remain readable, but only the selected main hero enters.
function soloRun(value) {
  if (!valid(value)) return null;
  const main = value.party[0];
  return { ...value, party:[main], loadouts:{[main]:value.loadouts[main]} };
}
function panel(message, finished = false) {
  let box = $('practicePanel');
  if (!box) { box = document.createElement('section'); box.id = 'practicePanel'; document.body.appendChild(box); }
  box.innerHTML = `<div class="practiceHeading"><b>1인 연습장</b><span id="practiceMessage" role="status">${message}</span></div>${run ? '<div id="practiceClock" role="timer" aria-label="남은 연습 시간"><span>남은 시간</span><strong id="practiceSeconds">'+(finished ? '0' : '30')+'</strong><span>초</span></div>' : ''}<div class="practiceFooter"><small>보상·소모·저장 없음</small><div>${finished ? '<button id="practiceRetry" class="gbtn sm">다시 연습</button>' : ''}<button id="practiceExit" class="gbtn sm">마을로</button></div></div>`;
  $('practiceExit').onclick = () => { G.phase = 'over'; go({town:1},0); };
  if ($('practiceRetry')) $('practiceRetry').onclick = () => reload();
  box.onpointerdown = e => e.stopPropagation();
}
function practiceHud(finished = false) {
  $('startWave').classList.add('hidden'); $('startWave').disabled = true;
  $('wavePrev')?.classList.add('hidden');
  const partyBar=$('hardPartyBar'); if(partyBar){partyBar.hidden=true;partyBar.classList.add('hidden');}
  const speed=$('speedBtn');if(speed){speed.title='배속은 전투만 변경합니다. 연습 시간은 30초입니다.';}
  $('phase').textContent = finished ? '연습 종료' : '연습 중 · 무보상';
}
export async function startPractice() {
  document.body.classList.add('practiceRun');
  G.practice = true; G.hardParty = null; G.partyAI = null; G.grow = false; G.growthEnabled = false; G.xpRun = null;
  G.onXPWave = null; G.onRunEnd = finish; G.onStageClear = finish; G.endPractice = finish;
  configureNavigation({});
  if (!window.practiceStorageReady) { G.phase = 'over'; panel('저장 격리를 준비하지 못했습니다. 마을에서 다시 입장해 주세요.'); return; }
  try { run = soloRun(JSON.parse(sessionStorage.getItem(KEY) || 'null')); } catch {}
  if (!valid(run)) { G.phase = 'over'; panel('마을에서 현재 영웅을 선택한 뒤 연습장에 입장해 주세요.'); return; }
  panel('연습 준비 중…');
  try {
    await ensureModels([...MON_ASSETS, ...run.party.flatMap(h => heroAssets(h,true))]);
    showSelect(); $('select').classList.add('hidden');
    Object.assign(G, run.loadouts[run.party[0]], {growthEnabled:!!run.growthEnabled,focus:0,research:run.research,barRes:run.barRes,runDrops:[],runBossKills:[],gold:500,coreHp:999999,coreMax:999999,advBar:AD.advBarMul(run.loadouts[run.party[0]].adv)});
    choose(run.party[0]);
    practiceHud(); $('retreat').classList.add('hidden');
  } catch { G.phase = 'over'; panel('모델을 불러오지 못했습니다. 다시 시도해 주세요.',true); }
}
export function updatePractice(dt, clockDt = dt) {
  if (!G.practice || !run || G.phase === 'over' || !G.hero || G.chooseWait) return;
  if (!started) { if (G.phase !== 'build') return; started = true; G.phase = 'wave'; G.wave=1; practiceHud(); $('practiceMessage').textContent='주영웅 혼자 · 30초 후 자동 종료'; }
  elapsed += Number.isFinite(clockDt) ? Math.max(0, clockDt) : 0; spawn -= dt;
  if (elapsed >= 30) { finish(); return; }
  if (spawn <= 0 && G.enemies.filter(e => !e.dead).length < 8) { spawn = 1.5; G.spawnEnemy('golem', 5, {x:tileX(CORE[0]-4),z:tileZ(CORE[1]),tile:[CORE[0]-4,CORE[1]]}); }
  const seconds = $('practiceSeconds'); if (seconds) seconds.textContent = String(Math.max(0, Math.ceil(30-elapsed)));
}
function finish() {
  if (!G.practice || G.phase === 'over') return;
  G.phase = 'over'; G.spawnQ=[]; practiceHud(true);
  panel(`연습 종료 · ${Math.min(30, Math.floor(elapsed))}초 · 처치 ${Object.values(G.stats.kills).reduce((a,b)=>a+b,0)}`, true);
}
