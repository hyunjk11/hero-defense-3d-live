// A separate, storage-isolated page. No login, run token, XP checkpoint or settlement.
import { G } from '../core/state.js';
import { $ } from '../core/util.js';
import { go, reload, configureNavigation } from '../core/nav.js';
import * as E from '../account/equip.js';
import * as HG from '../account/hero-growth.js';
import * as AD from '../data/advance.js';
import * as SX from '../account/steel.js';
import { treeBuild } from '../data/skill-tree.js';
import { showSelect, choose } from './select.js';
import { DEFAULT_HERO, VISIBLE_HEROES } from '../data/heroes.js';
import { beamAttackBonus } from '../data/endgame-research.js';
import { awakeningLevel } from '../data/awakening.js';
import { STAGES, HARD_STAGES, getStage } from '../data/stages.js';
import { HARD_ELITE_CAP } from '../data/hard.js';
import { PRACTICE_PRESETS, practiceWaveNumber, practiceWave } from '../core/practice-wave.js';
import { pendingSpawns } from '../monsters/abilities.js';
import { preparePracticeParty, initPracticeParty, clearPracticeParty } from '../heroes/practice-party.js';
import { select } from './input.js';

const KEY = 'hd3d_live_practice_snapshot_v1';
export function preparePractice() {
  const s = HG.viewSave(), main = VISIBLE_HEROES.includes(s.hero) ? s.hero : DEFAULT_HERO;
  const party = [main, ...VISIBLE_HEROES.filter(h => h !== main)];
  const loadouts = Object.fromEntries(party.map(h => {
    const adv = AD.advOf(h,s.adv[h]), heroLevel = HG.level(h);
    return [h, {
      perm:s.heroLv[h], equip:E.bonus(s,h), legend:E.legendOf(s,h), adv, heroLevel,
      heroTree:treeBuild(s.growth?.trees,h,adv?.k,heroLevel), heroGear:E.equippedItems(s,h),
      awakeningLevel:awakeningLevel(s.growth,h,s.adv[h]), awakeningUseE:HG.awakeningSkill(h),
    }];
  }));
  sessionStorage.setItem(KEY, JSON.stringify({party,loadouts,growthEnabled:HG.available(),research:s.research,
    barRes:SX.barMul(SX.barLv(s)),beamAttackResearch:beamAttackBonus(s)}));
}
function valid(value) {
  const party = value?.party;
  return Array.isArray(party) && party.length === VISIBLE_HEROES.length && new Set(party).size === party.length &&
    party.every(h => VISIBLE_HEROES.includes(h) && value.loadouts?.[h] && typeof value.loadouts[h] === 'object');
}
function showError(message, retry = false) {
  let box = $('practicePanel');
  if (!box) { box = document.createElement('section'); box.id = 'practicePanel'; document.body.appendChild(box); }
  box.innerHTML = `<div class="practiceHeading"><b>연습장</b><span role="status">${message}</span></div><div class="practiceFooter"><div>${retry ? '<button id="practiceRetry" class="gbtn sm">다시 시도</button>' : ''}<button id="practiceExit" class="gbtn sm">마을로</button></div></div>`;
  $('practiceExit').onclick = leavePractice;
  if (retry) $('practiceRetry').onclick = () => reload();
  box.onpointerdown = e => e.stopPropagation();
}
function leavePractice() {
  G.phase = 'over'; clearPracticeParty(); go({town:1},0);
}
export async function startPractice() {
  document.body.classList.add('practiceRun','practiceSandbox');
  G.practice = true; G.hardParty = null; G.partyAI = null; G.grow = false; G.growthEnabled = false; G.xpRun = null;
  G.onXPWave = G.onRunEnd = G.onStageClear = G.endPractice = null;
  configureNavigation({});
  if (!window.practiceStorageReady) { G.phase = 'over'; showError('마을에서 다시 입장해 주세요.'); return; }
  let run;
  try { run = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch {}
  if (!valid(run)) { G.phase = 'over'; showError('마을에서 다시 입장해 주세요.'); return; }
  sandboxPanel();
  try {
    if (!await preparePracticeParty(run)) throw new Error('Practice loadout is invalid');
    if (G.navigating || G.phase === 'over') return;
    showSelect(); $('select').classList.add('hidden');
    const lead = run.loadouts[run.party[0]];
    Object.assign(G, lead, {growthEnabled:!!run.growthEnabled,focus:0,research:run.research,barRes:run.barRes,
      runDrops:[],runBossKills:[],gold:0,coreHp:999999,coreMax:999999,
      advBar:AD.advBarMul(lead.adv),beamAttackResearch:run.beamAttackResearch || 0});
    choose(run.party[0]);
    $('startWave').classList.add('hidden');
    $('wavePrev')?.classList.add('hidden');
    if (!initPracticeParty(run)) throw new Error('Practice party failed to deploy');
    syncSandboxPanel();
    $('retreat').classList.add('hidden');
  } catch (error) {
    if (G.navigating || G.phase === 'over') return;
    G.phase = 'over'; clearPracticeParty();
    console.warn('practice setup', error);
    showError('모델을 불러오지 못했어요.',true);
  }
}

const stageOptions = (label, stages) => `<optgroup label="${label}">${Object.values(stages).map(s =>
  `<option value="${s.id}">${s.no}</option>`).join('')}</optgroup>`;
function sandboxPanel() {
  const box = document.createElement('section'); box.id = 'practicePanel';
  box.innerHTML = `<div class="practiceControls"><b>연습장</b>
    <select id="practicePreset" aria-label="적 유형">${Object.entries(PRACTICE_PRESETS).map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select>
    <button id="practiceStart" class="gbtn sm" disabled>▶ 시작</button>
    <button id="practiceExit" class="gbtn sm" aria-label="마을로">↩ 마을</button>
    </div><div id="practiceStageOptions" class="practiceControls hidden">
    <select id="practiceStage" aria-label="스테이지">${stageOptions('일반', STAGES)}${stageOptions('하드', HARD_STAGES)}</select>
    <select id="practiceWave" aria-label="웨이브"></select></div>`;
  document.body.appendChild(box);
  box.addEventListener('pointerdown', e => e.stopPropagation());
  box.addEventListener('keydown', e => e.stopPropagation());
  $('practiceExit').onclick = leavePractice;
  $('practicePreset').onchange = syncSandboxPanel;
  $('practiceStage').onchange = syncStageWaves;
  $('practiceStart').onclick = startSandboxWave;
  syncStageWaves();
}
function chosenStage() { return getStage($('practiceStage').value); }
function syncStageWaves() {
  const stage = chosenStage(), waves = $('practiceWave'), keep = +waves.value || 1;
  waves.innerHTML = Array.from({length:stage?.waves || 0}, (_, i) => `<option value="${i + 1}">웨이브 ${i + 1}</option>`).join('');
  if (stage) waves.value = String(practiceWaveNumber(stage, keep));
}
function syncSandboxPanel() {
  const active = G.phase === 'wave', preset = $('practicePreset'), stageMode = preset.value === 'stage';
  $('practiceStageOptions').classList.toggle('hidden', !stageMode);
  for (const id of ['practicePreset', 'practiceStage', 'practiceWave']) $(id).disabled = active;
  document.body.classList.toggle('practiceStageSelected',stageMode);
  const start = $('practiceStart');
  start.disabled = G.phase !== 'build';
  start.textContent = active ? '전투 중' : '▶ 시작';
}
function startSandboxWave() {
  if (!G.practiceSandbox || G.phase !== 'build' || G.paused || G.navigating || !G.hero) return;
  const preset = $('practicePreset').value, stage = chosenStage(), wave = +$('practiceWave').value;
  const plan = practiceWave(preset, {stage, wave});
  if (!plan) return;
  select(null);
  G.wave = preset === 'stage' ? practiceWaveNumber(stage, wave) : 5;
  G.phase = 'wave'; G.practiceHard = plan.hard; G.practiceWavePlan = plan;
  G.spawnQ = plan.queue; G.spawnE = plan.elites; G.hpMul = plan.hp; G.spawnT = 0;
  syncSandboxPanel();
}
export function updatePractice() {
  if (!G.practiceSandbox || G.phase !== 'wave' || G.spawnQ.length || G.enemies.length || pendingSpawns()) return;
  G.phase = 'build';
  G.practiceHard = G.practiceWavePlan = G.spawnE = null;
  syncSandboxPanel();
}
export function practiceSpawnAllowed() {
  return !G.practiceWavePlan?.exclusiveElites || !G.spawnE?.[0] ||
    G.enemies.filter(e => !e.dead && e.E.hardElite).length < HARD_ELITE_CAP;
}
