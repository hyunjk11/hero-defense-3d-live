import { startPractice, preparePractice } from './practice.js';
import { prepareHardParty, startHardParty } from '../heroes/hard-party.js';
import { heroBadges } from './hero-badges.js';
// ================= 화면 흐름: 인트로 → 로그인 → 메인 메뉴 → 마을 → 출정(기존 디펜스) → 마을 귀환 =================
import { Snd } from '../audio/audio.js';
import * as THREE from 'three';
import { $, QS } from '../core/util.js';
import { askConfirm } from './confirm.js';
import { escLayer, typing } from './keys.js';
import { definePanel } from './panel.js';
import { go, reload, configureNavigation } from '../core/nav.js';
import { settleNavigation } from '../account/navigation-save.js';
import { CLASSES, VISIBLE_HEROES, heroLabel } from '../data/heroes.js';
import { G } from '../core/state.js';
import { cam, camera, scene, renderer } from '../render/scene.js';
import { updateChapterGear } from '../render/chapter-gear.js';
import { altOk, disposeHeroModel, ensureModels, heroAssets, makeHeroModel, modelsReady, play } from '../render/characters.js';
import { showSelect, choose } from './select.js';
import * as HG from '../account/hero-growth.js';
import { initGrowthUI, refreshGrowthUI } from './hero-growth.js';
import * as Acc from '../account/account.js';
import { mobileApp } from './mobile-mode.js';
import { startingGoldBonus, beamAttackBonus, ENDGAME_RESEARCH_VERSION } from '../data/endgame-research.js';
import * as P from '../account/progress.js';
import * as GR from '../data/growth.js';
import * as SX from '../account/steel.js';
import * as AD from '../data/advance.js';
import { initAdv, renderAdv, closeConfirm as closeAdvConfirm, resetPreview as resetAdvPreview } from './advance.js';
import { labels as TL, buildTown as buildTownScene, updTown, townPass, LAKE, LR, PORTAL, tower } from '../world/town.js';
let smithNear = false, portalNear = false;
import { sun } from '../render/scene.js';
import * as E from '../account/equip.js';
import * as SG from '../account/storage.js';
import { initGear, openInv, closeInv, openSmith, closeSmith, refreshGear, reveal, revealing, openChestUI, chestCount, lastChestBatch, doEnhance, lastEnh, bonusHtml, heroDots, codexClaimable } from './gear.js';
import { banner } from './hud.js';
import { smith, SMITH } from '../world/town.js';
import { initStageSel, openStageSel, closeStageSel, rememberStage } from './stagesel.js';
import * as ST from '../data/stages.js';
import { STAGE, DUNGEON } from '../core/grid.js';
import { startDungeonRun } from '../dungeon/run.js';
import { initLab, openLab, closeLab, renderLab } from './lab.js';
import { lab, LAB, labFront } from '../world/town.js';
let labNear = false;
import * as Sh from '../account/shop.js';
import { initShop, openShop, closeShop, closeMail, closeAdmin, updShop } from './shop.js';
import { initNotice, showNotices } from './notice.js';
import { initStats, closeStats } from './stats.js';
import './endstats.js'; // 판 종료 통계 (결과 화면 📊 통계)
import { equipLine, lootLines, onRunEnd, goTown, initResult } from './result.js'; // C-9: 판 결과·보상 저장
import { afterIntro, doAuth, toMenu, refreshMenu, refreshLogin, initAuth } from './auth.js'; // C-9: 로그인·메인 메뉴
export { equipLine, goTown } from './result.js'; // 기존 import 경로 호환
import { shop as shopBld, SHOP_P, shopFront } from '../world/town.js';
import { dungeon as dungeonBld, DUNGEON_P, dungeonFront } from '../world/town.js';
import { initDungeonUI, openDungeon, closeDungeon } from './dungeon.js';
import { DG_OPEN } from '../data/dungeon.js';
let dgNear = false;
let shopNear = false; const closeShopUI = () => { closeShop(true); closeMail(true); };

const TOWN_Z = -150, TOWN = new THREE.Vector3(0, 0, TOWN_Z), esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SCREENS = ['intro', 'login', 'menu', 'town'];
function setMobileHeroPicker(open) {
  if (!mobileApp) return;
  $('scr_town').classList.toggle('mobileHeroOpen', open);
  $('twHeroToggle').setAttribute('aria-expanded', String(open));
}
let town = null, th = null, tKeys = {}, labels = [], portalPos = null, departing = false, toast = 0;
function show(id) { for (const s of SCREENS) $('scr_' + s).classList.toggle('hidden', s !== id); G.screen = id; G.screenMusic = id === 'intro' ? 'wave' : 'build'; }
function hideAll() { for (const s of SCREENS) $('scr_' + s).classList.add('hidden'); G.screen = null; G.screenMusic = null; }
const heroN = c => heroLabel(c);

async function prepareGrowth(stage, hero) {
  const session = Acc.sessionId(), run = await HG.startRun(stage, hero);
  if (session !== Acc.sessionId() || !Acc.saveAllowed() || HG.pendingSortieSettings()) return false;
  G.xpRun = run; G.growthEnabled = HG.available(); G.focus = 0; G.completedWaves = 0; G.heroLevel = HG.level(hero); G.heroTree=run?.build||null; G.awakeningLevel=run?.awakeningLevel??null; G.awakeningUseE=run?.awakeningUseE!==false;
  G.xpPendingWrite = Promise.resolve(true);
  G.onXPWave = () => { G.xpPendingWrite = HG.checkpoint(G.xpRun, G.completedWaves, false, false, 1, Object.values(G.stats.kills||{}).reduce((a,b)=>a+b,0)); };
  return true;
}
function applyEndgameResearch() {
  if (!Acc.ready() || !Acc.A.sb?.serverEconomy || HG.HG.features.endgameResearch !== ENDGAME_RESEARCH_VERSION) return;
  const save = Acc.load();
  G.gold = Math.min(Number.MAX_SAFE_INTEGER, G.gold + startingGoldBonus(save));
  G.beamAttackResearch = beamAttackBonus(save);
}
// ---------- 스테이지 ----------
async function departStage(id) { if (!Acc.saveAllowed()) return; if (departing) return; departing = true; rememberStage(id); Snd.play('meteorCast', { force: true }); Snd.play('confirm'); $('fade').classList.add('on'); // Q-5 지도·Q-6 재도전/다음 공통 (47b5eb7 에서 주석 안으로 들어가 소리·화면 어두워짐이 빠졌던 것 복구)
  if (G.xpPendingWrite && !await G.xpPendingWrite) { departing = false; $('fade').classList.remove('on'); banner('XP 기록을 저장하지 못했습니다. 다시 시도해 주세요.'); return; }
  go({ stage: id }, 500); }
function startStageRun() { // 저장된 영웅이 유료 영웅이면 서버 소유권(hd3d_owned)을 먼저 확인
  const s0 = Acc.load(); if (CLASSES[s0.hero] && CLASSES[s0.hero].paid) { $('loadTxt').textContent = '영웅 확인 중…'; Sh.verifyOwned().then(() => startStageRun2(true)); } else startStageRun2(false);
}
async function startStageRun2(logged) {
  if (!logged) await Acc.autoLogin().catch(() => {}); if (!Acc.A.user && Acc.A.mode !== 'guest') { show('login'); refreshLogin(); return; }
  if (STAGE.hard) await Sh.verifyOwned();
  const s = Acc.load(); s.hero = Sh.usableHero(s.hero); if (!await prepareGrowth(STAGE.id, s.hero)) { enterTown(); if (HG.pendingSortieSettings()) banner(Acc.SAVE_WAIT_MESSAGE); return; } if(STAGE.hard&&!G.xpRun){enterTown();banner('하드 출정 확인 실패 · 연결과 해금 확인');return;} showSelect(); $('select').classList.add('hidden'); hideAll(); s.hero = Sh.usableHero(s.hero); // 잠긴 유료 영웅이면 기본 영웅
  G.perm = s.heroLv[s.hero]; G.equip = E.bonus(s, s.hero); G.legend = E.legendOf(s, s.hero); G.adv = AD.advOf(s.hero, s.adv[s.hero]); G.advBar = AD.advBarMul(G.adv); G.barRes = SX.barMul(SX.barLv(s)); G.dropCh = STAGE ? STAGE.ch : P.openChapters(s); G.runBossKills = []; G.grow = true; G.research = s.research; G.runDrops = []; G.runStart = performance.now(); G.stage = STAGE; G.gold += STAGE.startGold || 0; applyEndgameResearch(); G.phase = 'select';
  if (STAGE.hard && G.xpRun?.party) {
    const run = G.xpRun, current = () => G.xpRun === run && Acc.A.user?.id === run.owner && Acc.sessionId() === run.session;
    $('loading').classList.remove('hidden');
    try { await prepareHardParty(run); if(!current())return; Object.assign(G,run.loadouts[run.party[0]]); choose(run.party[0]); startHardParty(run); }
    catch (error) { if(current()){enterTown(); banner('영웅 모델을 불러오지 못했습니다. 다시 출정해 주세요.');} return; }
    finally { if(current())$('loading').classList.add('hidden'); }
  } else choose(s.hero);
  $('retreat').classList.remove('hidden');
  const C = (STAGE.hard ? ST.HARD_CHAPTERS : ST.CHAPTERS).find(c => c.id === STAGE.ch); setTimeout(() => banner(`${STAGE.no} ${STAGE.n} · 웨이브 ${STAGE.waves} · ${C.propN}`, C.color, 3200), 500);
  const bt = equipLine(G.equip); if (bt) setTimeout(() => banner(bt, '#ffe08a', 2200), 3900);
}
initResult({ departStage: (id) => departStage(id) }); initAuth({ show: id => show(id) });
// ---------- 시작 ----------
export function startFlow() {
  if (QS.get('practice') === '1') { hideAll(); void startPractice(); return; }
  // Keep game-input protection; result statistics stay usable while saving.
  const resultInput=event=>!!event.target?.closest?.('#scStats,#overStats,#esClose,#esBack,#endStats');
  addEventListener('keydown', event => { if (G.navigating && !event.ctrlKey && !event.metaKey && !event.altKey && !resultInput(event) && !['c','C','Escape'].includes(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture: true });
  for (const type of ['pointerdown','pointerup','pointermove','click','dblclick','contextmenu','touchstart','touchmove','wheel'])
    addEventListener(type, event => { if (G.navigating && !resultInput(event)) { event.preventDefault(); event.stopImmediatePropagation(); } }, { capture:true, passive:false });
  configureNavigation({
    beforeLeave: () => settleNavigation(Acc, HG, G),
    onWaiting: waiting => {
      G.navigating=waiting;
      for(const id of ['scTown','scRetry','scNext','overTown','overRetry','dgTown']){const b=$(id);if(b)b.disabled=waiting;}
      if(waiting)$('fade').classList.remove('on');
    },
    onReady: () => $('fade').classList.add('on'),
    onCancel: () => { departing=false;$('fade').classList.remove('on'); },
  });
  const s = Acc.load(); if (s.settings.audio) { Object.assign(Snd.cfg, s.settings.audio); Snd.apply(); }
  const save0 = Snd.save.bind(Snd); Snd.save = () => { save0(); Acc.update(d => ({ ...d, settings: { ...d.settings, audio: { ...Snd.cfg } } })); };
  G.onRunEnd = onRunEnd; Acc.onChange(() => { refreshMenu(); refreshTown(); refreshLogin(); });
  bindUI();
  if (DUNGEON && QS.has('run')) { startDungeonRun(); return; } // 던전 원정 (마을 던전 건물에서 새로고침으로 진입)
  if (STAGE && QS.has('run')) { startStageRun(); return; } // 스테이지 출정 (원정 지도에서 새로고침으로 진입)
  if (!STAGE && !DUNGEON && QS.has('challenge') && QS.has('run')) { startChallengeRun(); return; }
  if (QS.has('town')) { resume(); return; } // 출정 후 귀환: 바로 마을
  showSelect(); $('select').classList.add('hidden'); show('intro'); // 인트로: 세 영웅이 포즈를 취하는 3D 무대 재사용
}
async function resume() { showSelect(); $('select').classList.add('hidden'); const ok = await Acc.autoLogin(); if (!ok && Acc.A.mode !== 'guest') { show('login'); refreshLogin(); return; } if (!ok) Acc.playGuest(); enterTown(); }

// ---------- 마을 ----------
// U-2: 자원 알약 줄(.twTop) 아래로 들어간 건물 라벨은 흐리게 (겹침 방지) — 사각형은 0.5초마다만 측정
let _twR = null, _twRt = -9; const twTopRect = () => { const now = performance.now(); if (now - _twRt > 500) { _twRt = now; const e = document.querySelector('#scr_town .twTop'); _twR = e && e.offsetParent ? e.getBoundingClientRect() : null; } return _twR; };
function buildTown() {
  town = new THREE.Group(); town.position.copy(TOWN); scene.add(town); buildTownScene(town);
  portalPos = new THREE.Vector3(PORTAL.x, 0, TOWN_Z + PORTAL.y); labels = TL;
  const wrap = $('townLabels'); wrap.innerHTML = ''; for (const L of labels) { L.el = document.createElement('div'); L.el.className = 'tlabel ' + (L.cls || ''); L.el.innerHTML = L.html; wrap.appendChild(L.el); }
}
// 여신탑까지 경로: (호수 반대편이면 호수를 돌아) 다리 입구 → 섬
function routeToTower() { const V = (x, z) => new THREE.Vector3(x, 0, z), p = th.g.position, dl = Math.hypot(p.x - LAKE.x, p.z - LAKE.y), q = [];
  if (dl > LR + .5) { if (p.x > LAKE.x - LR && dl < 11.5) { const s = p.z < LAKE.y ? -1 : 1; if (p.x > LAKE.x - 2) q.push(V(LAKE.x, LAKE.y + s * 8.6)); q.push(V(LAKE.x - 6.2, LAKE.y + s * 6.2)); } q.push(V(LAKE.x - LR - 1.6, LAKE.y)); }
  q.push(V(LAKE.x - 2.45, 0 + LAKE.y)); th.goal = q.shift(); th.goals = q; }
// ---------- 여신의 축복 (여신탑 영구 강화 창) ----------
let blessOpen = false, blessNear = false, blessTab = 'perm';
const heroRingColor = () => { if (!th || !th.ring) return; const s = Acc.load(), A = AD.advOf(th.cls, s.adv[th.cls]); th.ring.material.color.setHex(A ? A.col : CLASSES[th.cls].color); }; // 전직 칭호 색 (마을 단상 영웅 발밑 링)
function setBlessTab(t) { blessTab = t === 'adv' ? 'adv' : 'perm'; document.querySelectorAll('#blessTabs .ftab').forEach(b => b.classList.toggle('on', b.dataset.bt === blessTab)); $('twPerm').classList.toggle('hidden', blessTab !== 'perm'); $('twAdv').classList.toggle('hidden', blessTab !== 'adv'); $('twBless').classList.toggle('advMode', blessTab === 'adv'); if (blessTab !== 'adv') { resetAdvPreview(); endPv(); } refreshTown(); }
G.blessTab = setBlessTab;
function openBless() { if (G.screen !== 'town') return; if (!blessOpen) { Snd.play('confirm'); Snd.play('levelUp', { vol: .35 }); } blessOpen = true; closeShopUI(); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); closeLab(true); BP.show(); refreshTown(); }
function closeBless() { if (blessOpen) Snd.play('ui'); blessOpen = false; BP.hide(); closeAdvConfirm(); resetAdvPreview(); endPv(); }
const BP = definePanel('bless', { id: 'twBless', z: 40, isOpen: () => blessOpen, close: () => closeBless() });
G.openBlessing = openBless; G.closeBlessing = closeBless;
G.townHero = () => th && { x: th.g.position.x, z: th.g.position.z, cls: th.cls, key: th.key, acts: Object.keys(th.acts || {}), fallback: !!th.fallback };
G.townTeleport = (x, z) => { if (th) { th.g.position.set(x, 0, z); th.goal = null; } };
G.townGoal = (x, z) => { if (th) th.goal = new THREE.Vector3(x, 0, z); };
G.townLab = () => { const f = labFront(); return [LAB.x, LAB.y, f.x, f.z]; }; G.closeLab = closeLab;
G.townTower = () => [LAKE.x, LAKE.y]; G.townSmith = () => [SMITH.x, SMITH.y]; G.townShop = () => { const f = shopFront(); return [SHOP_P.x, SHOP_P.y, f.x, f.z]; };
G.stageSel = { openStageSel, departStage, ST };
G.gear = { E, Acc, P, SG, openInv, openSmith, closeSmith, doEnhance, lastEnh, reveal, openChestUI, chestCount, lastChestBatch };
// 마을 단상 영웅: 전직 전용 몸(소총 로즈)이 있으면 그 모델 (지연 로딩 → 도착하면 교체, 실패하면 기본 모델 유지). pvA = 전직 탭에서 미리 보는 분기
let pvA = null;
function endPv() { const had = pvA; pvA = null; if (had && town && town.visible && th) spawnTownHero(); heroRingColor(); } // 미리보기 끝: 저장된 분기 모델·링 색으로
const townAlt = (hc, s) => { const A = pvA && pvA.h === hc ? pvA : AD.advOf(hc, s.adv[hc]); return A && A.model ? A : null; };
function spawnTownHero() {
  const s = Acc.load(), hc = Sh.usableHero(s.hero), A = townAlt(hc, s), alt = A && altOk(A.model) ? A.model : null;
  if (!modelsReady(heroAssets(hc))) { ensureModels(heroAssets(hc)).then(() => { if (town && town.visible && Sh.usableHero(Acc.load().hero) === hc && (!th || th.cls !== hc)) spawnTownHero(); }).catch(e => console.warn(e)); return; } // 지연 로딩: 도착하면 교체 (그 사이엔 이전 영웅 유지)
  if (A && !alt && !G.advModelFail) ensureModels(AD.advModels(A)).then(() => { if (town && town.visible && th && th.cls === hc && th.key !== A.model && townAlt(hc, Acc.load()) === A) spawnTownHero(); }).catch(e => { console.warn('adv model', e); G.advModelFail = true; });
  if (th && th.cls === hc && th.key === (alt || CLASSES[hc].model)) { heroRingColor(); return; } // 같은 모델이면 그대로
  disposeHeroModel(th); th = makeHeroModel(hc, null, alt); th.cls = hc; updateChapterGear(th, E.equippedItems(s, hc)); th.g.position.set(0, 0, 4); th.g.rotation.y = Math.PI; town.add(th.g); play(th, 'Idle'); th.goal = null; heroRingColor();
}
export function enterTown() {
  hideAll(); setMobileHeroPicker(false); $('select').classList.add('hidden'); if (!town) buildTown(); town.visible = true; spawnTownHero(); show('town'); G.phase = 'town'; departing = false; blessNear = false; closeBless(); smithNear = false; portalNear = false; labNear = false; shopNear = false; closeShopUI(); closeAdmin(true); closeLab(true); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); dgNear = false; closeDungeon(true);
  void HG.refresh();
  cam.target.set(0, 1, TOWN_Z - 2); cam.r = 34; cam.phi = .78; cam.theta = 0; G.nightTarget = 0; refreshTown(); if (Acc.A.user) Sh.refresh({ maxAgeMs: 5000 }).catch(() => {}); showNotices().catch(() => {}); // 마을 입장 시 우편·소유권·공지 갱신
  const lr = sessionStorage.getItem('hd3d_live_lastRun'); if (lr) { sessionStorage.removeItem('hd3d_live_lastRun'); const r = JSON.parse(lr), show2 = () => (r.reason === 'clear' && r.resultShown === true) ? undefined : popup(`<h3>${r.reason === 'clear' ? `스테이지 ${ST.stageNo(r.stage)} 클리어! <span class="popStars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</span>` : r.reason === 'retreat' ? '무사히 귀환했습니다' : r.stage ? `스테이지 ${ST.stageNo(r.stage)} 실패 · 코어가 파괴되었습니다` : '코어가 파괴되었습니다'}</h3>도달 웨이브 <b>${r.wave}</b> · 처치 <b>${r.kills}</b><br>획득 영혼석 <b class="soul">+${r.got}</b>${r.best ? '<br><span class="newbest">★ 최고 기록 갱신!</span>' : ''}${lootLines(r.loot || [])}`); if (chestCount()) setTimeout(() => openChestUI(show2), 600); else show2(); }
}

function doOpenShop() { openShop(); }
function popup(html) { const p = $('townPop'); p.innerHTML = html + '<br><button id="popOk">확인</button>'; p.classList.remove('hidden'); $('popOk').onclick = () => { Snd.play('ui'); p.classList.add('hidden'); }; }
function doOpenLab() { closeBless(); closeShopUI(); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); openLab(); }
// 레일 배지 (Q-4 나머지, 2026-10-23): 지금 살 수 있는 연구(타워 3종 중 하나라도) · 지금 영웅이 살 수 있는 여신의 축복
export function railBadges(s, cls) {
  const lab = GR.TTYPES.some(t => GR.RKEYS.some(k => !GR.resBlock(s, t, k)));
  const L = s.heroLv[cls] || {}, bless = Object.keys(P.PERM).some(k => { const lv = L[k] || 0; return lv < P.permMax(s, cls) && s.souls >= P.permCost(k, lv); });
  return { lab, bless };
}
function refreshTown() {
  if (th && G.screen === "town") updateChapterGear(th, E.equippedItems(Acc.load(), th.cls));
  renderLab();
  if (G.screen !== 'town') return;
  refreshGrowthUI(); const s = HG.viewSave(), A = Acc.A, cls = Sh.usableHero(s.hero), L = s.heroLv[cls];
  $('twSouls').textContent = s.souls; $('twSteel').textContent = s.mat.steel; $('twCrystal').textContent = s.mat.crystal; $('twBagN').textContent = `${s.inv.length}/${E.CAP}`; $('twStorN').textContent = `${(s.stor || []).length}/${SG.storCap(s)}`; $('twBagN').classList.toggle('full', s.inv.length >= E.CAP); $('twBag').classList.toggle('hasNew', codexClaimable(s)); /* Q-4a 도감 보상 배지 */
  { const rb = railBadges(s, cls); document.querySelectorAll('#twRail .railBtn[data-go]').forEach(b => b.classList.toggle('hasNew', !!rb[b.dataset.go])); } /* 레일 배지: 연구 가능 · 축복 가능 */
  const nc = (s.chests || []).length; $('twChest').classList.toggle('hidden', !nc); $('twChestN').textContent = nc;
  $('twBonus').innerHTML = `<div class="lbl">${heroN(cls)} 장비 보너스</div>` + bonusHtml(E.bonus(s, cls)); $('twBest').textContent = s.bestWave; $('twRuns').textContent = s.stats.runs; $('twKills').textContent = s.stats.kills;
  $('twAcct').innerHTML = A.user ? `${esc(s.nick || A.user.email)} · <span class="sync s_${A.sync}">${Acc.syncText()}</span>` : `${esc(s.nick || '게스트')} · <span class="sync">게스트 (이 기기 저장)</span>`;
  $('twAcct').classList.toggle('hidden', !Acc.serverSaveState() && (!A.user || ['saved','local'].includes(A.sync)));
  const hh = VISIBLE_HEROES.map(h => { const l = s.heroLv[h], lock = !Sh.heroOwned(h); return `<button class="hcard ${h === cls ? 'sel' : ''} ${lock ? 'locked' : ''} ${CLASSES[h].paid ? 'paid' : ''}" data-h="${h}"><b>${lock ? '🔒 ' : ''}${heroN(h)}</b><small>${lock ? '상점에서 구매' : heroBadges(HG.available()?HG.level(h):null,l.hp,l.atk)}</small>${!lock && AD.advOf(h, s.adv[h]) ? `<em class="advT" style="--ac:${AD.advOf(h, s.adv[h]).c}">${AD.advOf(h, s.adv[h]).icon} ${AD.advOf(h, s.adv[h]).n}</em>` : ''}${lock ? '' : `<span class="dots">${heroDots(s, h)}</span>`}</button>`; }).join(''); if ($('twHeroes')._h !== hh) { $('twHeroes')._h = hh; $('twHeroes').innerHTML = hh; }
  refreshGear();
  document.querySelectorAll('#twHeroes .hcard').forEach(b => b.onclick = () => { if (!Sh.heroOwned(b.dataset.h)) { Snd.play('select'); openShop('hero_' + b.dataset.h); return; } if (b.dataset.h === cls) return; Snd.play('select'); Acc.update(d => ({ ...d, hero: b.dataset.h })); spawnTownHero(); if (th?.cls === b.dataset.h) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } setMobileHeroPicker(false); });
  $('blessHero').textContent = AD.advTitle(cls, s.adv[cls]) || heroN(cls); if (blessOpen && blessTab === 'adv') renderAdv();
  // 축복 버튼은 한 번만 만들고 내용/disabled만 갱신 (동기화 상태 변경 등으로 refreshTown이 자주 불려도 버튼이 교체되지 않아 클릭이 한 번에 들어감)
  const wrap = $('twPerm'); if (!wrap._built) { wrap._built = true; wrap.innerHTML = Object.keys(P.PERM).map(k => `<button class="perm" data-k="${k}"></button>`).join('');
    wrap.querySelectorAll('.perm').forEach(b => b.onclick = () => { const hero = Acc.load().hero; let ok = false; Acc.update(d => { const [n, o] = P.buyPerm(d, hero, b.dataset.k); ok = o; return n; }); if (ok) { Snd.play('upgrade'); Snd.play('levelUp', { vol: .5 }); if (th) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } } else Snd.play('error'); refreshTown(); }); }
  wrap.querySelectorAll('.perm').forEach(b => { const k = b.dataset.k, D = P.PERM[k], lv = L[k], pm = P.permMax(s, cls), max = lv >= pm, c = P.permCost(k, lv), h = `<span class="row"><span>${D.n} Lv.${lv}/${pm}${pm > D.max ? ' ⚜' : ''}</span><small>${max ? 'MAX' : c + ' 영혼석'}</small></span><span class="desc">${D.d} (영구)</span>`;
    if (b._h !== h) { b._h = h; b.innerHTML = h; } const dis = max || s.souls < c; if (b.disabled !== dis) b.disabled = dis; });
}
export async function depart() {
  if (!Acc.saveAllowed() || departing || G.phase !== 'town') return;
  departing = true; Snd.play('meteorCast', { force: true }); Snd.play('confirm');
  // A fresh document owns the new terrain and GPU resources. Do not rebuild over an old map.
  await go({ challenge: true }, 650);
}
async function startChallengeRun() {
  await Acc.autoLogin().catch(() => {});
  if (!Acc.A.user && Acc.A.mode !== 'guest') { show('login'); refreshLogin(); return; }
  const saved = Acc.load();
  if (CLASSES[saved.hero]?.paid) await Sh.verifyOwned();
  const s = Acc.load(); s.hero = Sh.usableHero(s.hero);
  if (!await prepareGrowth(null, s.hero)) { enterTown(); if (HG.pendingSortieSettings()) banner(Acc.SAVE_WAIT_MESSAGE); return; }
  showSelect(); $('select').classList.add('hidden'); hideAll();
  G.perm = s.heroLv[s.hero]; G.equip = E.bonus(s, s.hero); G.legend = E.legendOf(s, s.hero); G.adv = AD.advOf(s.hero, s.adv[s.hero]); G.advBar = AD.advBarMul(G.adv); G.barRes = SX.barMul(SX.barLv(s)); G.dropCh = P.openChapters(s); G.runBossKills = []; G.grow = true; G.research = s.research; G.runDrops = []; G.runStart = performance.now(); applyEndgameResearch(); G.phase = 'select'; choose(s.hero); $('retreat').classList.remove('hidden'); $('fade').classList.remove('on');
  const bt = equipLine(G.equip); if (bt) setTimeout(() => banner(bt, '#ffe08a', 2200), 900);
}

// ---------- UI 바인딩 ----------
function bindUI() {
  initGrowthUI(); HG.onGrowth(() => { if (G.screen === 'town') refreshTown(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && G.screen === 'town' && !$('statPanel').classList.contains('hidden') && HG.awakeningSkillServer()) void HG.refresh();
  });
  $('scr_intro').onclick = () => afterIntro(); addEventListener('keydown', e => { if (G.screen === 'intro' && !e.repeat) afterIntro(); });
  if (mobileApp) {
    $('twHeroToggle').onclick = () => {
      const open = $('twHeroToggle').getAttribute('aria-expanded') !== 'true';
      if (open) { closeDungeon(true); closeBless(); closeShopUI(); closeLab(true); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); }
      setMobileHeroPicker(open);
    };
    for (const [id, icon, label] of [['twGo','🌀','출정'],['twPractice','🎯','연습장'],['twMenu','☰','메뉴']]) {
      $(id).textContent = icon; $(id).setAttribute('aria-label', label); $(id).title = label;
    }
    $('scr_town').addEventListener('click', e => {
      if (e.target.closest('button') && !e.target.closest('#twHeroToggle,#twHeroPicker')) setMobileHeroPicker(false);
    }, true);
    escLayer('mobileHeroPicker', 20, () => $('twHeroToggle').getAttribute('aria-expanded') === 'true', () => setMobileHeroPicker(false));
  }
  $('lgIn').onclick = () => doAuth('in'); $('lgUp').onclick = () => doAuth('up'); $('lgPw').addEventListener('keydown', e => { if (e.key === 'Enter') doAuth('in'); });
  $('lgGuest').onclick = () => { Snd.play('confirm'); try { Acc.playGuest(); toMenu(); } catch (e) { $('lgMsg').textContent = e.message; } };
  $('mnCont').onclick = () => { Snd.play('confirm'); enterTown(); };
  $('mnNew').onclick = async () => { const s = Acc.load(); if ((s.stats.runs > 0 || s.souls > 0) && !(await askConfirm({ title: '새로 시작', icon: '⚠', body: '새로 시작하면 영혼석·영웅 강화·기록이 모두 초기화됩니다.\n계속할까요?', ok: '새로 시작', tone: 'danger' }))) return;
    Snd.play('confirm'); Acc.store({ ...P.empty(), nick: s.nick, settings: s.settings }); enterTown(); };
  $('mnSet').onclick = () => {
    Snd.play('ui'); const settings = $('mnSettings'), closed = settings.classList.toggle('hidden'); syncSet();
    if (mobileApp) (closed ? $('mnSet') : settings).scrollIntoView({block: closed ? 'nearest' : 'start'});
  };
  for (const id of ['stBgm', 'stSfx', 'stBgmOn', 'stSfxOn', 'stBgMute']) $(id).addEventListener('input', () => { const C = Snd.cfg; C.bgm = $('stBgm').value / 100; C.sfx = $('stSfx').value / 100; C.bgmOn = $('stBgmOn').checked; C.sfxOn = $('stSfxOn').checked; C.bgMute = $('stBgMute').checked; Snd.apply(); Snd.bgSync(); Snd.save(); });
  $('mnNickSave').onclick = async () => { Snd.play('ui'); await Acc.saveNick($('mnNick').value); refreshMenu(); };
  $('mnAuth').onclick = async () => { Snd.play('ui'); try { if (Acc.A.user) { await Acc.signOut(); } else Acc.A.mode = ''; show('login'); refreshLogin(); } catch (e) { banner(e.message, '#ffb0a0', 5000); } };
  // U-9a/Q-15 (2026-10-23): 오른쪽 '시설 바로가기' 레일 — 걷지 않고 바로 패널 열기 (걷기 경로는 그대로). 다른 큰 패널은 닫고 엶
  const railGo = { smith: () => { closeDungeon(true); closeBless(); closeShopUI(); closeStageSel(true); openSmith(); }, lab: () => { closeDungeon(true); doOpenLab(); }, shop: () => { closeDungeon(true); doOpenShop(); }, dungeon: () => openDungeon(), bless: () => { closeDungeon(true); openBless(); } };
  document.querySelectorAll('#twRail .railBtn[data-go]').forEach(b => { if (b.dataset.go === 'dungeon' && !DG_OPEN) b.classList.add('hidden'); b.onclick = e => { e.stopPropagation(); setMobileHeroPicker(false); const f = railGo[b.dataset.go]; if (f) f(); }; });
  $('twPractice').onclick = () => { setMobileHeroPicker(false); if (!Acc.saveAllowed()) return; preparePractice(); go({ practice: true }); };
  $('twGo').onclick = () => { setMobileHeroPicker(false); closeDungeon(true); closeBless(); closeShopUI(); closeLab(true); closeSmith(true); closeInv(); closeStats(); openStageSel(); };
  initStageSel({ challenge: () => depart(), start: (id) => departStage(id) }); $('twMenu').onclick = () => { Snd.play('ui'); closeBless(); closeShopUI(); closeLab(true); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); if (th) { disposeHeroModel(th); th = null; } town.visible = false; G.phase = 'menu'; cam.target.set(0, 1.5, 22); cam.r = 13.5; cam.phi = 1.3; toMenu(); };
  $('retreat').onclick = async () => { if (G.phase !== 'build') { Snd.play('error'); return; } if (!(await askConfirm({ title: '마을로 귀환', icon: '🏠', body: '지금까지의 보상을 가지고 마을로 귀환할까요?', ok: '귀환' }))) return; if (G.phase !== 'build') { Snd.play('error'); return; } onRunEnd('retreat'); };
  $('overTown').onclick = () => goTown();
  $('overRetry').onclick = () => { if (STAGE) departStage(STAGE.id); else if (DUNGEON) reload(); else go({ challenge: true }); }; // Q-6: 스테이지 판은 같은 스테이지 재도전 (보상은 onRunEnd 에서 이미 저장)
  if (STAGE) $('overRetry').textContent = '🔁 재도전';
  addEventListener('keydown', e => { if (G.screen === 'town' && !typing(e)) tKeys[e.key.toLowerCase()] = true; }); addEventListener('keyup', e => tKeys[e.key.toLowerCase()] = false);
  const townFieldTap = e => { if (G.screen !== 'town' || e.button !== 0 || !th) return;
    setMobileHeroPicker(false); const m = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1), rc = new THREE.Raycaster(); rc.setFromCamera(m, camera);
    if (revealing()) return; if (shopBld && rc.intersectObject(shopBld, true).length > 0) { th.goals = null; th.goal = shopFront(); if (Math.hypot(th.g.position.x - SHOP_P.x, th.g.position.z - SHOP_P.y) < 4.4) doOpenShop(); return; }
    if (lab && rc.intersectObject(lab, true).length > 0) { th.goals = null; th.goal = labFront(); if (Math.hypot(th.g.position.x - LAB.x, th.g.position.z - LAB.y) < 4.6) doOpenLab(); return; }
    if (dungeonBld && rc.intersectObject(dungeonBld, true).length > 0) { th.goals = null; th.goal = dungeonFront(); if (Math.hypot(th.g.position.x - DUNGEON_P.x, th.g.position.z - DUNGEON_P.y) < 4.6) openDungeon(); return; } // 던전 원정 건물
    const smithHit = smith && rc.intersectObject(smith, true).length > 0; if (smithHit) { th.goals = null; th.goal = new THREE.Vector3(SMITH.x + .6 * 3.4, 0, SMITH.y + .8 * 3.4); if (Math.hypot(th.g.position.x - SMITH.x, th.g.position.z - SMITH.y) < 4.1) openSmith(); return; }
    const towerHit = rc.intersectObject(tower, true).length > 0; // 여신탑 클릭 → 섬으로 걸어가서 축복 창
    const p = new THREE.Vector3(); if (!rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return; p.sub(TOWN).setY(0);
    if (towerHit || Math.hypot(p.x - LAKE.x, p.z - LAKE.y) < LR + .3) { routeToTower(); if (Math.hypot(th.g.position.x - LAKE.x, th.g.position.z - LAKE.y) < 3.4) openBless(); }
    else { th.goal = p; th.goals = null; }
  };
  bindTownField(townFieldTap);
  $('blessClose').onclick = () => closeBless(); $('twBag').onclick = () => { setMobileHeroPicker(false); closeShopUI(); closeStageSel(true); closeLab(true); openInv(); }; $('twStor').onclick = () => { setMobileHeroPicker(false); closeShopUI(); closeStageSel(true); closeLab(true); openInv('stor'); }; $('twChest').onclick = () => { if (revealing()) return; closeShopUI(); closeStageSel(true); closeLab(true); closeBless(); openChestUI(); };
  initDungeonUI({ closeOthers: () => { closeBless(); closeShopUI(); closeLab(true); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); } });
  initNotice();
  initShop({ onChange: () => refreshTown(), closeOthers: k => { closeBless(); closeLab(true); closeSmith(true); closeInv(); closeStats(); closeStageSel(true); if (k !== 'shop') closeShop(true); if (k !== 'mail') closeMail(true); }, cheer: () => { if (th) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } } });
  Sh.onShop(() => { if (th && G.screen === 'town' && th.cls !== Sh.usableHero(Acc.load().hero)) spawnTownHero(); refreshTown(); refreshMenu(); }); // 서버 소유권 갱신 → 마을 영웅 모델도 맞춤
  document.querySelectorAll('#blessTabs .ftab').forEach(b => b.onclick = () => { if (b.dataset.bt === blessTab) return; Snd.play('ui'); setBlessTab(b.dataset.bt); });
  initAdv({ onChange: () => refreshTown(), cheer: () => { if (th) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } }, preview: A => { pvA = A; if (th && th.ring) th.ring.material.color.setHex(A.col); spawnTownHero(); if (th && th.ring) th.ring.material.color.setHex(A.col); } }); // 미리보기: 링 색 + (소총 로즈) 모델
  initLab({ onChange: () => refreshTown(), cheer: () => { if (th) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } } });
  initStats({ beforeOpen: () => { closeDungeon(true); closeBless(); closeShopUI(); closeLab(true); closeSmith(true); closeInv(); closeStageSel(true); } }); // 📊 능력치 (마을 패널 · 전투 C 키)
  initGear({ onChange: () => refreshTown(), cheer: () => { if (th) { play(th, 'Cheer', { once: true }); th.cheerT = 1.6; } } });
  escLayer('advConfirm', 60, () => !$('advConfirm').classList.contains('hidden'), () => closeAdvConfirm());
}
function bindTownField(tap) {
  const field = renderer.domElement;
  if (!mobileApp) { field.addEventListener('pointerdown', tap); return; }
  const points = new Map();
  let single = null, pinch = null;
  const clear = () => { points.clear(); single = null; pinch = null; };
  const distance = () => {
    const [a,b] = points.values(); return Math.hypot(a.x-b.x,a.y-b.y);
  };
  field.addEventListener('pointerdown', e => {
    if (G.screen !== 'town' || e.button !== 0) return;
    if (e.pointerType === 'mouse') { tap(e); return; }
    const point = {x:e.clientX,y:e.clientY};
    points.set(e.pointerId,point);
    field.setPointerCapture(e.pointerId);
    if (points.size === 1) single = point;
    else {
      single = null;
      pinch = points.size === 2 ? {base:Math.max(1,distance()), radius:cam.r} : null;
    }
  });
  field.addEventListener('pointermove',e=>{
    const point = points.get(e.pointerId);
    if (!point) return;
    if (G.screen !== 'town') { clear(); return; }
    if (single && Math.hypot(e.clientX-point.x,e.clientY-point.y) > 9) single = null;
    if (points.size === 2 && pinch) {
      points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      cam.r = Math.min(55,Math.max(18,pinch.radius * pinch.base / Math.max(1,distance())));
    }
  });
  const end = e => {
    const point = points.get(e.pointerId);
    if (!point) return;
    if (e.type === 'pointerup' && single && points.size === 1 && Math.hypot(e.clientX-point.x,e.clientY-point.y) <= 9) tap(e);
    points.delete(e.pointerId); single = null;
    pinch = points.size === 2 ? {base:Math.max(1,distance()),radius:cam.r} : null;
  };
  for (const type of ['pointerup','pointercancel','lostpointercapture']) field.addEventListener(type,end);
  addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
}
function syncSet() { const C = Snd.cfg; $('stBgm').value = Math.round(C.bgm * 100); $('stSfx').value = Math.round(C.sfx * 100); $('stBgmOn').checked = C.bgmOn; $('stSfxOn').checked = C.sfxOn; $('stBgMute').checked = C.bgMute !== false; }

// ---------- 매 프레임 ----------
const _v = new THREE.Vector3(), _zero = new THREE.Vector3(); let sunInTown = false;
export function updFlow(dt) {
  const inTown = !!(town && town.visible);
  if (inTown !== sunInTown) { sunInTown = inTown; const o = inTown ? TOWN : _zero; sun.position.set(-22 + o.x, 42, 26 + o.z); sun.target.position.copy(o); sun.target.updateMatrixWorld(); } // 마을에서도 그림자
  if (!inTown) return; updTown(G.t, dt); updShop(dt);
  for (const L of labels) { L.obj.getWorldPosition(_v); _v.y += L.y; _v.project(camera); const vis = G.screen === 'town' && _v.z < 1; L.el.style.display = vis ? '' : 'none'; if (vis) { const lx = (_v.x + 1) / 2 * innerWidth, ly = (1 - _v.y) / 2 * innerHeight, R = twTopRect(); L.el.style.transform = `translate(-50%,-100%) translate(${lx}px,${ly}px)`; if (L.vw !== innerWidth || !L.h) { L.vw = innerWidth; L.h = L.el.offsetHeight; L.w = L.el.offsetWidth; }
      const under = !!R && ly - L.h < R.bottom && lx + L.w / 2 > R.left && lx - L.w / 2 < R.right;
      L.el.classList.toggle('under', under);
      if (mobileApp) {
        const bottom = innerHeight - (innerWidth > 700 ? 56 : 108);
        L.el.classList.toggle('mobileLabelClipped', under || lx-L.w/2<8 || lx+L.w/2>innerWidth-8 || ly-L.h<8 || ly>bottom);
      } } }
  if (!th || G.screen !== 'town') return; th.mixer.update(dt);
  const fwd = new THREE.Vector3(-Math.sin(cam.theta), 0, -Math.cos(cam.theta)), right = new THREE.Vector3(-fwd.z, 0, fwd.x), mv = new THREE.Vector3();
  if (tKeys.w || tKeys.arrowup) mv.add(fwd); if (tKeys.s || tKeys.arrowdown) mv.sub(fwd); if (tKeys.d || tKeys.arrowright) mv.add(right); if (tKeys.a || tKeys.arrowleft) mv.sub(right);
  const p = th.g.position; if (mv.lengthSq()) { th.goal = null; th.goals = null; } else if (th.goal) { mv.subVectors(th.goal, p); if (mv.length() < .2) { th.goal = th.goals && th.goals.length ? th.goals.shift() : null; if (!th.goal) mv.set(0, 0, 0); } }
  if (mv.lengthSq()) { const step = Math.min(6.5 * dt, th.goal ? mv.length() : 99); mv.normalize().multiplyScalar(step); let moved = false;
    if (townPass(p.x + mv.x, p.z)) { p.x += mv.x; moved = true; } if (townPass(p.x, p.z + mv.z)) { p.z += mv.z; moved = true; } if (!moved) th.goal = null;
    let d = Math.atan2(mv.x, mv.z) - th.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); th.g.rotation.y += d * Math.min(1, dt * 12); if (!th.cheerT) play(th, 'Running_A', { speed: 1.1 }); }
  else if (!th.cheerT) play(th, 'Idle', { fade: .25 });
  if (th.cheerT) { th.cheerT -= dt; if (th.cheerT <= 0) th.cheerT = 0; }
  th.ring.material.opacity = .5 + Math.sin(G.t * 4) * .2;
  cam.target.lerp(_v.set(p.x * .5, 1, TOWN_Z + p.z * .5 - 3), Math.min(1, dt * 3));
  const dl = Math.hypot(p.x - LAKE.x, p.z - LAKE.y); // 여신탑 접근 → 여신의 축복 창
  if (dl < 3.4 && !blessNear) { blessNear = true; openBless(); } else if (dl > 4.4 && blessNear) { blessNear = false; closeBless(); }
  const dsh = Math.hypot(p.x - SHOP_P.x, p.z - SHOP_P.y); if (dsh < 4.2 && !shopNear) { shopNear = true; doOpenShop(); } else if (dsh > 5.2 && shopNear) { shopNear = false; closeShop(); }
  const dd = Math.hypot(p.x - DUNGEON_P.x, p.z - DUNGEON_P.y); if (dd < 4.6 && !dgNear) { dgNear = true; openDungeon(); } else if (dd > 5.6 && dgNear) { dgNear = false; closeDungeon(); } // 던전 원정 입장 화면
  const ds = Math.hypot(p.x - SMITH.x, p.z - SMITH.y); if (ds < 4.0 && !smithNear) { smithNear = true; closeShopUI(); closeStageSel(true); openSmith(); } else if (ds > 4.8 && smithNear) { smithNear = false; closeSmith(); }
  const dlab = Math.hypot(p.x - LAB.x, p.z - LAB.y); if (dlab < 4.6 && !labNear) { labNear = true; doOpenLab(); } else if (dlab > 5.4 && labNear) { labNear = false; closeLab(); }
  const nearPortal = Math.hypot(p.x - PORTAL.x, p.z - PORTAL.y + 1) < 2.2; $('twHint').classList.toggle('go', nearPortal); if (nearPortal && !portalNear && !departing) { portalNear = true; closeBless(); closeLab(true); closeSmith(true); closeInv(); closeStats(); openStageSel(); } else if (!nearPortal && portalNear && Math.hypot(p.x - PORTAL.x, p.z - PORTAL.y + 1) > 3.2) { portalNear = false; closeStageSel(); }
}
