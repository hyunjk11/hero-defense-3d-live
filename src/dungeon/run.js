import { readPracticeParty, rankParty } from '../account/sortie-party.js';
import { jointBlessing, rescueBlessing } from '../data/bless-actions.js';
import { treeBuild } from '../data/skill-tree.js';
import * as HG from '../account/hero-growth.js';
import { settleDungeon } from './rewards.js';
// ================= 던전 원정 (파티 던전) 판 진행: 출정 · 층/웨이브 · 역할 AI · 초상화 바 · 결과 =================
// 진입: 마을 던전 건물 → ui/dungeon.js → ?dungeon=1&run=1 새로고침 → ui/flow.js startFlow → startDungeonRun
// 일반 스테이지·도전 모드에서는 G.dungeon 이 없어 이 파일의 어떤 것도 동작하지 않음
import * as THREE from 'three';
import { MORVIA, canDropMorvia, morviaRoll } from '../data/boss-sets.js';
import { lootFx } from '../render/loot.js';
import { itemLabel } from '../account/rewarditems.js';
import { Snd } from '../audio/audio.js';
import { $, esc } from '../core/util.js';
import { go } from '../core/nav.js';
import { G } from '../core/state.js';
import { waveStart, waveEnd } from '../combat/meter.js';
import { CORE, tileX, tileZ } from '../core/grid.js';
import { CLASSES } from '../data/heroes.js';
import { FLOORS, ROLE, dungeonRole, BLESS_BY, ULT_MAX, dungeonParty, pickParty, waveList, dungeonReward, nextFloorHp, blessChoices, blessMods, ultGain, jointReady, jointDamage } from '../data/dungeon.js';
import { FT, isRangedFoe, TQ, ftSkillId } from '../data/fighter.js';
import { later } from '../core/state.js';
import { P as PT, PB, emit, ringFx, setDmgCap } from '../render/vfx.js';
import { play } from '../render/characters.js';
import * as AD from '../data/advance.js';
import * as E from '../account/equip.js';
import * as Acc from '../account/account.js';
import * as Sh from '../account/shop.js';
import * as DS from '../account/dungeon.js';
import * as SS from '../account/spire.js'; // 🗼 T-7 탑 서버 기록 (token · 체크포인트 ping · 정산)
import { partyWiped } from '../core/party.js';
import { rolePlan } from './logic.js';
import { skillBusy } from '../core/autoskill.js';
import { useAutoSkill } from '../heroes/autoskill.js';
import { AUTO_PICK_DELAY, autoBlessChoice, wantAutoJoint, loadDungeonAuto, saveDungeonAuto } from './auto.js';
import { cam } from '../render/scene.js';
import { MON_ASSETS, ensureModels, heroAssets, loadModel } from '../render/characters.js';
import { core } from '../world/terrain.js';
import { hurt, spawnEnemy } from '../monsters/enemy.js';
import { pendingSpawns } from '../monsters/abilities.js';
import { heroGoTo, setControlled, spawnHero, stat } from '../heroes/hero.js';
import { castSkill } from '../heroes/skills.js';
import { choose, showSelect } from '../ui/select.js';
import { banner } from '../ui/hud.js';
import * as HUD from '../ui/dungeonhud.js';
import { updBossFx, clearBossFx, bossDodge } from './boss.js';
import * as SPR from './spire.js'; // 🗼 무한의 탑 (G.spire 일 때만)
import { floorLabel, affixIcons, isBossFloor, SP_TITLES, firstClear } from '../data/spire.js';

const D = G.dg = { floors: FLOORS, floor: 0, wave: -1, q: [], spawnT: 0, gapT: 2.5, over: false, kills: 0, t: 0, swap: false, party: [], bless: {}, blessing: null, cleared: 0, joints: 0, k0: 0, auto: false, autoBlessT: AUTO_PICK_DELAY };
const confirmOpen = () => { const el = $('gConfirm'); return el && !el.classList.contains('hidden'); };
export function setDungeonAuto(on) {
  if (!G.dungeon || D.over) return;
  D.auto = !!on; D.autoBlessT = AUTO_PICK_DELAY; saveDungeonAuto(D.auto);
  for (const h of G.heroes) { h.aiT = 0; h.aiGoal = null; if (h === G.hero) { h.path = []; h.aiTgt = null; } }
  HUD.refreshAuto();
}
G.setDungeonAuto = setDungeonAuto;
function paintBossDrop() {
  const el = $('dgBossDropRes'); if (!el) return;
  const r = D.bossDrop;
  el.innerHTML = !r ? '보스 전리품 확인 중…' : !r.ok ? `${esc(r.msg)} <button id="dgBossRetry" class="gbtn sm">재시도</button>`
    : r.item ? `♛ ${esc(r.name || itemLabel(r.item))}<br><small>${r.mail ? '우편함' : '보상 상자'}에 보관됨</small>` : '모르비아 세트 미획득';
  const retry = $('dgBossRetry'); if (retry) retry.onclick = () => { D.bossDrop = null; paintBossDrop(); D.bossDropPromise = requestBossDrop(); };
}
async function requestBossDrop() {
  const r = await DS.dgBossDrop(D.bossRequest.token, D.bossRequest.hero);
  D.bossDrop = r; if (G.dgResult) G.dgResult.bossDrop = r;
  if (r.mail) { Sh.refresh().catch(() => {}); banner('♛ 모르비아 세트 획득 · 우편함', MORVIA.color, 2600); }
  paintBossDrop(); return r;
}
G.onDungeonBossKilled = (enemy, pos) => {
  if (D.bossRolled || !canDropMorvia({ dungeon: G.dungeon, spire: G.spire, floor: D.floor, type: enemy.type, entry: D.entry, over: D.over })) return;
  D.bossRolled = true;
  // Use the controlled hero at the instant of the kill for weapon drops.
  const hero = G.hero?.cls || 'mage';
  if (D.entry.mode === 'ranked') {
    D.bossRequest = { token: D.entry.token, hero };
    D.bossDropPromise = requestBossDrop().then(r => { if (r.item) lootFx(pos, MORVIA.grade); return r; });
  } else {
    const spec = morviaRoll(hero);
    if (spec) {
      const it = E.makeItem(spec.s, spec.h, spec.g, Math.random, spec.set);
      Acc.update(save => { E.addChests(save, [{ it, src: 'boss' }]); return save; }); Acc.flush();
      D.bossDrop = { ok: true, item: spec, name: it.n }; lootFx(pos, it.g);
      later(1.2, () => banner(`♛ ${it.n} 획득`, MORVIA.color, 2600));
    } else D.bossDrop = { ok: true, item: null };
  }
};
// 영웅별 출정 정보 (일반 출정 ui/flow.js startStageRun2 와 같은 계산)
export const loadoutOf = (s, c) => ({ perm: s.heroLv[c], equip: E.bonus(s, c), legend: E.legendOf(s, c), adv: AD.advOf(c, (s.adv || {})[c]), heroLevel: HG.level(c), heroTree:treeBuild(HG.HG.growth?.trees,c,AD.advOf(c,s.adv?.[c])?.k,HG.level(c)) });

// Navigation preloads likely models; the ranked entry snapshot is authoritative after reload.
export const loadPick = () => (G.spire ? readPracticeParty('spire') : null) || readPracticeParty('dungeon');
export async function startDungeonRun() { setDmgCap(30); // U-11: 던전 피해 숫자 동시 표시 상한 30 (전투 60)
  $('loadTxt').textContent = '파티 확인 중…'; $('loading').classList.remove('hidden');
  D.floors = FLOORS; // T-1: 이번 판의 층 목록 (원정 = FLOORS, 무한의 탑은 층 목록을 바꿔 끼움)
  const spFrom = SPR.spireFrom(), SPI = spFrom ? SPR.spireInit(spFrom) : null; if (SPI) D.floors = SPI.floors; // 🗼 T-4 연습 탑: ?sptest=1&spire=N
  D.entry = SPI ? SS.takeEntry(spFrom) : DS.takeEntry(); G.dgEntryMode = D.entry.mode; if (!SPI && D.entry.mode !== 'practice') D.floors = FLOORS.slice(0, D.entry.maxFloors === 10 ? 10 : 5); // 🗼 T-7: 탑 = 출발 때 서버가 준 token (없으면 연습 탑)
  if(D.entry.blocked){$('loading').classList.add('hidden');go({town:1});return;}
  if (SPI) { const S = G.spire; Object.assign(S, { practice: D.entry.mode !== 'ranked', why: D.entry.why || null, token: D.entry.token || null, prevBest: D.entry.best || 0, pings: [], ft: [], chain: Promise.resolve() }); D.ft0 = 0; if (!S.practice) SS.spStatus().catch(() => {}); } // 5단계: 출발 때 서버가 준 1회용 입장 token (없으면 연습 원정 — 메달 없음)
  await Sh.verifyOwned(); // 로즈: 서버 소유 기록(hd3d_owned)만 믿음 — 저장 데이터의 영웅 값은 쓰지 않음
  await HG.refresh(); G.growthEnabled = HG.available(); G.focus = 0;
  if (D.entry.mode === 'ranked' && D.entry.owner && D.entry.owner !== Acc.A.user?.id) {
    $('loading').classList.add('hidden'); go({town:1}); return;
  }
  const cands = dungeonParty(c => Sh.heroOwned(c));
  const rankedParty = D.entry.mode === 'ranked' && (D.entry.party || rankParty(SPI ? 'spire' : 'dungeon'));
  const s = Acc.load(), party = pickParty(cands, rankedParty || (D.entry.mode === 'ranked' && Acc.A.sb?.serverEconomy ? null : loadPick())), L = Object.fromEntries(party.map(c => [c, loadoutOf(s, c)]));
  const need = [...MON_ASSETS, ...party.flatMap(c => heroAssets(c, true))], opt = party.flatMap(c => AD.advModels(L[c].adv));
  $('loadTxt').textContent = '모델 불러오는 중…'; await ensureModels(need); for (const k of opt) await loadModel(k).catch(e => { console.warn('adv model', k, e); G.advModelFail = true; });
  loadModel('lich_meshy').then(() => { G.dgBossModel = 'meshy'; }).catch(e => { console.warn('boss model fallback', e); G.dgBossModel = 'fallback'; }); // 5층 보스 모델: 기다리지 않고 뒤에서 (보스 출현 때 없으면 해골 마법사 + 왕관)
  $('loading').classList.add('hidden');
  Object.assign(G, { dungeon: true, gold: 0, grow: false, research: null, runDrops: [], runBossKills: [], stage: null, runStart: performance.now() });
  D.rallyReady = 0; D.rescueReady = 0;
  D.xpChain = Promise.resolve(); D.auto = loadDungeonAuto(); D.bossDrop = null; D.bossDropPromise = null; D.bossRolled = false;
  document.body.classList.add('dungeonRun'); core.visible = false;
  showSelect(); $('select').classList.add('hidden'); Object.assign(G, L[party[0]]); choose(party[0]); // 첫 영웅(세라) = 조작 영웅
  for (const c of party.slice(1)) spawnHero(c, L[c], true);
  const off = [[0, 0], [-2.2, 1.8], [-2.2, -1.8], [-4, 0]]; G.heroes.forEach((h, i) => { h.g.position.set(tileX(CORE[0]) + off[i][0], 0, tileZ(CORE[1]) + off[i][1]); h.face = -Math.PI / 2; });
  setControlled(G.heroes[0]); D.party = party; G.partyAI = partyAI; G.onHeroDown = () => { D.swap = true; };
  G.heroes.forEach(h => { h.ult = 0; }); setMods(); D.k0 = killCount();
  G.phase = 'wave'; G.nightTarget = .55; G.wave = 0; cam.target.set(0, 0, 1); cam.r = 50; cam.phi = .95; cam.theta = 0;
  buildHud(); if (SPI && SPI.catchup) { D.floor = -1; D.blessQ = SPI.catchup - 1; openBless(); refreshTop(); } else startFloor(0); if (D.entry.mode === 'ranked') DS.dgStatus().catch(() => {}); // 칭호 표시용
}
// 축복 배수 (역할별로 미리 계산) → hero.js stat 이 G.dgM(영웅) 으로 읽음. 던전 밖에서는 G.dgM 이 없어 일반 판과 동일
function setMods() { const M = {}; for (const r of ['tank', 'ranged', 'caster', 'bruiser', null]) M[r] = blessMods(D.bless, r); D.mods = M; G.dgM = h => G.dungeon ? M[ROLE[h.cls] || null] || M[null] : null; }
const killCount = () => Object.values(G.stats.kills || {}).reduce((a, b) => a + b, 0);
// 층 시작: 쓰러진 영웅 = 체력 30% 로 복귀, 살아남은 영웅 = 15% 회복 (생명의 샘 축복: +50%), 파티를 방 가운데로
function startFloor(f, heal = 0, ult0 = 0) {
  D.blessHeal = 0; D.blessUlt = 0;
  for(const h of G.heroes)h.blessHasteUntil=0;
  D.floor = f; D.wave = -1; D.q = []; D.blessing = null; D.nextT = 0; if (G.spire) SPR.ensureFloors(D); const off = [[0, 0], [-2.2, 1.8], [-2.2, -1.8], [-4, 0]];
  const hk = G.spire ? SPR.healKOf(D.floors[f]) : 1; // 🗼 💔 저주: 층 사이 회복 −50% (쓰러짐 30% 복귀는 그대로)
  G.heroes.forEach((h, i) => { const down = h.dead > 0; if (f > 0) { h.hp = hk === 1 ? Math.min(h.max, nextFloorHp(h.hp, h.max, down) + h.max * heal) : Math.min(h.max, down ? nextFloorHp(h.hp, h.max, true) + h.max * heal * hk : h.hp + (nextFloorHp(h.hp, h.max, false) - h.hp + h.max * heal) * hk); h.ult = Math.max(h.ult || 0, ult0); }
    else { h.hp = Math.min(h.max, h.hp + h.max * heal * hk); h.ult = Math.max(h.ult || 0, ult0); }
    if (down && f > 0) { h.dead = 0; h.hb.show(true); h.path = []; play(h.ch, 'Cheer', { once: true }); h.atkT = 1.2; }
    if (f > 0) { h.g.position.set(tileX(CORE[0]) + off[i][0], 0, tileZ(CORE[1]) + off[i][1]); h.path = []; h.aiGoal = null; h.face = -Math.PI / 2; if (down) { emit(PT, h.g.position.x, 1, h.g.position.z, 40, 0x8aff9a, 5, .8); ringFx(h.g.position, 2.5, 0x8aff9a, .6); } } });
  if (G.hero.dead > 0) { const n = G.heroes.find(h => h.dead <= 0); if (n) setControlled(n); }
  if (G.spire) { const F = D.floors[f]; nextWave(); banner(`🗼 ${F.n}${F.bossInfo ? ' — ' + F.bossInfo.n : ''}${F.affixes.length ? ' · ' + affixIcons(F.affixes) : ''}`, F.boss ? '#ff8a9a' : F.type === 'elite' ? '#ffb07a' : '#9ad8ff', 2600); refreshBar(); return; }
  nextWave(); banner(f === 0 ? `🔮 영혼석 던전 · ${D.floors[f].n}` : `⚔ ${D.floors[f].n}${D.floors[f].boss ? ' — 보스의 방!' : ''}`, D.floors[f].boss ? '#ff8a9a' : '#c8a8ff', 2600); refreshBar(); }
G.dgStartFloor = startFloor;

// ---------- 층 진행 (main.js step 에서, 일시정지·배속 그대로) ----------
export function updDungeon(dt) {
  if (!G.dungeon || D.over || G.paused) return; const F = D.floors[D.floor];
  if (D.blessing) {
    if (D.auto && !confirmOpen()) {
      D.autoBlessT -= dt;
      if (D.autoBlessT <= 0) { const healScale = G.spire ? SPR.healKOf(D.floors[D.floor + 1]) : 1; const id = autoBlessChoice(D.blessing, D.bless, G.heroes, D.blessHeal || 0, healScale); if (id) takeBless(id); }
    }
    D.hudT = (D.hudT || 0) - dt; if (D.hudT <= 0) { D.hudT = .15; refreshBar(); } return;
  }
  D.t += dt; updBossFx(dt);
  if (D.swap) { D.swap = false; if (G.hero.dead > 0) { const n = G.heroes.find(h => h.dead <= 0); if (n) { setControlled(n); banner(`${CLASSES[n.cls].nm} 조작`, '#ffe066', 900); } } }
  if (partyWiped(G.heroes)) return finish(false);
  if (D.nextT > 0) { D.nextT -= dt; if (D.nextT <= 0) startFloor(D.floor + 1); return; } // 🗼 일반 층 돌파 → 3초 뒤 다음 층
  if (D.q.length) { D.spawnT -= dt; if (D.spawnT <= 0) { D.spawnT = F.every; spawnEnemy(D.q.shift(), F.hpMul, undefined, D.qe ? !!D.qe.shift() : false); } }
  else if (!G.enemies.some(e => !e.dead) && !pendingSpawns()) { if (D.wave >= F.waves.length - 1) return floorClear(); D.gapT -= dt; if (D.gapT <= 0) nextWave(); }
  if (G.spire) SPR.spireTick(F, dt); // 🗼 🌿 재생 어픽스
  // 궁극기 게이지: 전투 중 매초 + 처치마다 (살아있는 영웅 전원) · 재생 축복
  const k = killCount(), nk = Math.max(0, k - D.k0), combat = G.enemies.some(e => !e.dead); D.k0 = k;
  for (const h of G.heroes) { if (h.dead > 0) continue; const M = G.dgM(h); h.ult = Math.min(ULT_MAX, (h.ult || 0) + ultGain(dt, nk, combat, M.ult)); if (M.regen && h.hp < h.max) h.hp = Math.min(h.max, h.hp + h.max * M.regen * dt * (G.spire ? SPR.healKOf(D.floors[D.floor]) : 1)); }
  if(combat){const healed=rescueBlessing(D.bless,G.heroes,G.t,D,G.spire?SPR.healKOf(F):1);
    if(healed.length){for(const h of healed)ringFx(h.g.position,1.2,0x80ffc0,.45);}}
  if (D.auto && !confirmOpen() && wantAutoJoint(G.heroes, G.enemies) && G.heroes.filter(h => h.dead <= 0).every(h => !skillBusy(h))) joint();
  D.hudT = (D.hudT || 0) - dt; if (D.hudT <= 0) { D.hudT = .15; refreshBar(); }
}
// 층 돌파: 마지막 층이면 완주, 아니면 축복 3택1 → 다음 층
function floorClear() { waveEnd(G.waveLog, G.t); D.cleared = D.floor + 1; if (G.spire) return spireClear();
  if (G.growthEnabled && D.entry.mode !== 'practice') { const floors = D.cleared, token = D.entry.token; D.xpChain = D.xpChain.catch(() => {}).then(() => D.entry.mode === 'local' ? HG.guestDungeon(token, floors, false) : HG.settleMode('dungeon_ping', { p_token: token, p_floors: floors })); }
  const pos = G.hero.g.position; emit(PT, pos.x, 1.3, pos.z, 36, 0xc894ff, 4, .9); ringFx(pos, 3.5, 0xc894ff, .8); refreshBar();
  if (D.floor >= D.floors.length - 1) return finish(true); openBless(); }
// 🗼 층 돌파: 보스층(5의 배수)·✨축복의 층 = 축복 3택1 (+추가), 나머지 = 3초 카드 후 다음 층 (생존 15% 회복 · 쓰러짐 30% 복귀는 startFloor)
function spireClear() { const F = D.floors[D.floor], S = G.spire; S.top = F.floor; SPR.ensureFloors(D); S.ft.push(Math.round(D.t - (D.ft0 || 0))); if (S.ft.length > 40) S.ft.shift(); D.ft0 = D.t;
  if (!S.practice && (G.growthEnabled || isBossFloor(F.floor))) spirePing(F.floor);
  if (F.bless > 0) { D.blessQ = F.bless - 1; openBless(); return; } D.nextT = 3; banner(`✔ ${F.floor}층 돌파 → ${F.floor + 1}층으로…`, '#9ad8ff', 2400); refreshBar(); }
// 🗼 T-7 보스층 돌파 = 서버 체크포인트 (순서대로 한 번에 하나 · 연결 오류면 다시 시도). 실패해도 판은 계속 — 정산(finish)이 시간으로 다시 인정
function spirePing(fl) { const S = G.spire, label = isBossFloor(fl) ? '체크포인트' : '완료 기록'; S.chain = S.chain.then(() => SS.spPing(S.token, fl)).then(r => { r.at = fl; S.pings.push(r); if (D.over || G.spire !== S) return;
  if (r.ok) { const w = r.reward; banner(`✔ ${label} ${fl}층 저장${r.newBest ? ' · 🎉 신기록' : ''}${w.souls || w.medals ? ` · 📮 첫 돌파 보상${w.souls ? ' 영혼석 ' + w.souls : ''}${w.medals ? ' · 메달 ' + w.medals : ''}` : ''}`, '#9affb0', 2600); if (w.mail) Sh.refresh().catch(() => {}); }
  else if (r.reason !== 'too_fast') banner(`⚠ ${label} ${fl}층 저장 실패 — ${r.msg} (도전이 끝날 때 다시 기록해요)`, '#ffb06a', 2600); }).catch(e => console.warn('spire ping', e)); }
function openBless() { const roles = [...new Set(G.heroes.map(h => ROLE[h.cls]))], ch = blessChoices(D.bless, roles, G.dgRnd || Math.random); D.blessing = ch;
  D.autoBlessT = AUTO_PICK_DELAY;
  if (!ch.length) { D.blessQ = 0; startFloor(D.floor + 1); refreshTop(); return; }
  Snd.play('levelUp', { force: true }); let el = $('dgBless'); if (!el) { el = document.createElement('div'); el.id = 'dgBless'; $('stageClear').parentNode.appendChild(el); }
  const nf = D.floors[D.floor + 1], down = G.heroes.filter(h => h.dead > 0).length, cf = D.floors[D.floor], more = D.blessQ > 0 ? ` (한 번 더 · 남은 ${D.blessQ})` : '';
  el.className = 'dgBless'; el.innerHTML = `<div class="dgBBox"><div class="dgBT">✦ ${cf ? `${esc(cf.n)} 돌파!` : '🗼 출발 축복'}${more} ✦</div><div class="dgBS">${G.spire ? '축복 선택' : `🔮 ${dungeonReward(D.cleared, false).toLocaleString()}`}<br><small>다음: <b>${esc(nf.n)}</b>${nf.boss ? ' (보스)' : ''} · 생존 영웅 체력 +15%${down ? ` · 쓰러진 영웅 ${down}명은 체력 30% 로 복귀` : ''}</small></div>
    <div class="dgBC">${ch.map((id, i) => { const B = BLESS_BY[id], n = D.bless[id] || 0; return `<button class="dgBc" data-id="${id}" data-i="${i}"><span class="dgBi">${B.icon}</span><b>${esc(B.n)}</b><span class="dgBd">${esc(B.d)}</span>${n ? `<span class="dgBn">보유 ${n} → ${n + 1}</span>` : ''}<span class="dgBk">${i + 1}</span></button>`; }).join('')}</div><button type="button" id="dgBlessAuto" class="dgAuto"></button></div>`;
  $('dgBlessAuto').onclick = e => { e.stopPropagation(); setDungeonAuto(!D.auto); };
  HUD.refreshAuto();
  el.querySelectorAll('.dgBc').forEach(b => { b.onpointerdown = e => e.stopPropagation(); b.onclick = e => { e.stopPropagation(); if (D.blessing === ch) takeBless(b.dataset.id); }; }); }
function takeBless(id) { if (!D.blessing || !D.blessing.includes(id) || D.over || G.paused) return; D.autoBlessT = AUTO_PICK_DELAY; D.bless[id] = (D.bless[id] || 0) + 1; setMods(); Snd.play('confirm'); const B = BLESS_BY[id];
  if (id === 'heal') D.blessHeal = Math.min(1, (D.blessHeal || 0) + .5);
  if (id === 'ult') D.blessUlt = 30;
  const el = $('dgBless'); if (el) el.className = 'dgBless hidden'; (G.dgBlessLog ||= []).push(id);
  if (D.blessQ > 0) { D.blessQ--; banner(`${B.icon} ${B.n}`, '#ffe9a0', 1200); openBless(); refreshTop(); return; } // 🗼 축복 여러 번 (따라잡기 · ✨축복의 층)
  banner(`${B.icon} ${B.n}`, '#ffe9a0', 1600); startFloor(D.floor + 1, D.blessHeal || 0, D.blessUlt || 0); refreshTop(); }
G.dgTakeBless = takeBless;

// ---------- 합동 공격: 살아있는 영웅 전원 궁극기 가득 → 모두 스킬 동시 시전 + 화면 전체 큰 피해 ----------
function joint() { if (D.over || D.blessing || G.paused || !jointReady(G.heroes)) { if (!D.over && !D.blessing) Snd.play('error'); return false; }
  const L = G.heroes.filter(h => h.dead <= 0), En = G.enemies.filter(e => !e.dead && e.dying === undefined);
  jointBlessing(D.bless,L,G.t,D);
  const dmg = jointDamage(L.map(h => h.C.dmg)); D.joints++; G.dgJointN = D.joints;
  for (const h of L) { h.ult = 0; G.withHero(h, () => { const p = h.g.position; let t = null, bd = Infinity; for (const e of En) { const d = e.g.position.distanceTo(p); if (d < bd) { bd = d; t = e; } }
    h.skillCd = 0; castSkill(t ? t.g.position.clone() : p.clone()); ringFx(p, 3, 0xffe066, .7); emit(PB, p.x, 2, p.z, 30, 0xffe066, 6, .8, -2, 2); }); }
  G.shake = Math.max(G.shake || 0, 1); Snd.play('meteorCast', { force: true }); Snd.play('levelUp', { force: true }); banner('✦ 합동 공격! ✦', '#ffe066', 1800);
  const fl = $('dgFlash'); if (fl) { fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on'); }
  later(.55, () => { const c = { x: 0, y: 0, z: 1 }; ringFx(new THREE.Vector3(c.x, 0, c.z), 26, 0xffd23a, .9); emit(PB, c.x, 3, c.z, 120, 0xffe9a0, 16, 1.2, -4, 6); Snd.play('boom', { force: true });
    let n = 0; const w0 = G.mWho; G.mWho = null; G.mK = 1; // 피해 미터: 합동 공격은 공용(파티) 칸
    for (const e of [...G.enemies]) { if (e.dead || e.dying !== undefined) continue; hurt(e, dmg, '#ffe066', true); n++; const q = e.g.position; emit(PT, q.x, 1.5, q.z, 12, 0xffd23a, 5, .6); } G.mWho = w0; G.dgJointHits = n; });
  refreshBar(); return true; }
G.dgJoint = joint;

function nextWave() { const F = D.floors[D.floor]; G.dgDmg = F.dmgMul || 1; if (G.spire) G.hpMul = F.hpMul; /* 🗼 소환·보호막이 층 체력 배수를 따름 */ D.wave++; G.wave = D.wave + 1; waveStart(G.waveLog, `${F.floor || D.floor + 1}-${D.wave + 1}`, G.t); D.q = waveList(F, D.wave); D.qe = G.spire ? SPR.eliteQueue(F, D.wave, D.q) : null; D.spawnT = .6; D.gapT = F.gap; Snd.horn(); if (D.wave > 0) banner(`웨이브 ${D.wave + 1} / ${F.waves.length}`, '#ffd27a', 1400); }

// ---------- 역할 AI (조작하지 않는 영웅, hero.js updParty 가 그 영웅 문맥으로 호출) ----------
const _v = new THREE.Vector3(), pos = o => ({ x: o.g.position.x, z: o.g.position.z });
function partyAI(h, dt) {
  if (D.over || D.blessing || G.paused || (D.auto && confirmOpen())) return;
  h.aiT = (h.aiT || 0) - dt; if (h.aiT > 0) return; h.aiT = .3 + G.heroes.indexOf(h) * .04;
  const rangedFighter = h.cls === 'fighter' && h.adv?.k === 'dragon';
  const role = dungeonRole(h.cls, h.adv), En = G.enemies.filter(e => !e.dead && e.dying === undefined && !(e.immT > G.t) && e.state !== 'spawn');
  const tank = G.heroes.find(x => x !== h && x.dead <= 0 && ROLE[x.cls] === 'tank'), lead = G.hero !== h && G.hero.dead <= 0 ? pos(G.hero) : null;
  const busy = skillBusy(h); // core/autoskill.js (스킬 자동 사용과 같은 판정)
  const dz = bossDodge(h); if (dz) { const g0 = h.aiGoal; if (!g0 || Math.hypot(g0.x - dz.x, g0.z - dz.z) > .8 || !h.path.length) { heroGoTo(_v.set(dz.x, 0, dz.z)); h.aiGoal = dz; } h.aiT = .15; return; } // 5층 보스: 원 피하기 · 창 막기 (dungeon/boss.js)
  const P = rolePlan(role, { ...pos(h), range: rangedFighter ? FT.jpRange : stat.range(), minRange: rangedFighter ? Math.min(FT.jpRange * .7, Math.max(4, stat.range() + 1.2)) : undefined, jp: FT.jpRange, qSelf: h.adv && ftSkillId(h.adv.skill) === 'tigerquake' ? TQ.R * .85 : 0, skillReady: h.skillCd <= 0 && !busy }, { lead, tank: tank ? pos(tank) : null, enemies: En.map(e => ({ ...pos(e), r: isRangedFoe(e.E), fly: !!e.E.fly })), backs: G.heroes.filter(x => x !== h && x.dead <= 0 && ROLE[x.cls] !== 'tank').map(pos) });
  h.aiTgt = P.focus !== null && P.focus !== undefined ? En[P.focus] : null;
  if (P.move) { const g0 = h.aiGoal; if (!g0 || Math.hypot(g0.x - P.move.x, g0.z - P.move.z) > 1.2 || !h.path.length) { heroGoTo(_v.set(P.move.x, 0, P.move.z)); h.aiGoal = P.move; } }
  else if (role !== 'tank' && (En.length || rangedFighter) && h.path.length) { h.path = []; h.aiGoal = null; } // 사거리 안: 멈춰서 사격
  if (D.auto) useAutoSkill(h);
  else if (P.skill && !busy && h.skillCd <= 0) { castSkill(new THREE.Vector3(P.skill.x, 0, P.skill.z)); G.dgAiSkills = (G.dgAiSkills || 0) + 1; }
}

// ---------- HUD: 층 표시 + 초상화 바 ----------
const buildHud = () => HUD.buildHud({ pick, joint, toggleAuto: () => setDungeonAuto(!D.auto), giveUp: () => { D.retreated = true; finish(false); } }), refreshTop = HUD.refreshTop, refreshBar = HUD.refreshBar; // C-12 ui/dungeonhud.js
function pick(i) { const h = G.heroes[i]; if (!h || D.over || G.paused) return; if (h.dead > 0) { Snd.play('error'); banner(`${CLASSES[h.cls].nm} 쓰러짐 — 조작할 수 없어요`, '#ff8a9a', 900); return; }
  if (h === G.hero) return; Snd.play('ui'); setControlled(h); h.aiGoal = null; h.aiTgt = null; refreshBar(); }
G.dgPick = pick;
addEventListener('keydown', e => { if (!G.dungeon || G.paused || e.repeat || D.over) return;
  if (D.blessing) { if (e.key >= '1' && e.key <= '3' && D.blessing[+e.key - 1]) takeBless(D.blessing[+e.key - 1]); return; } // 축복 고르는 중: 1~3 = 카드
  if (e.key === ' ') { e.preventDefault(); joint(); return; } if (e.key >= '1' && e.key <= '4') pick(+e.key - 1); });
// ---------- 결과 ----------
function finish(win) { if (D.over) return; D.over = true; clearBossFx(); G.phase = 'over'; G.paused = false; const el0 = $('dgBless'); if (el0) el0.className = 'dgBless hidden';
  HUD.refreshAuto();
  if (G.spire) return spireFinish();
  const N = D.floors.length, cleared = win ? N : D.cleared, E0 = D.entry || { mode: 'practice', why: 'reload' }, ranked = E0.mode === 'ranked';
  const got = 0;
  Snd.setMusic('none'); if (win) Snd.play('victory', { force: true, exact: true }); else Snd.play('error', { force: true });
  const sec = Math.round(D.t), el = $('stageClear'), alive = G.heroes.filter(h => h.dead <= 0).length;
  const dots = D.floors.map((F, i) => `<span class="${i < cleared ? 'ok' : i === D.floor && !win ? 'fail' : ''}" title="${esc(F.n)}">${i < cleared ? '✔' : i === D.floor && !win ? '✖' : i + 1}</span>`).join('');
  const bl = Object.entries(D.bless).map(([id, n]) => `${BLESS_BY[id].icon} ${esc(BLESS_BY[id].n)}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
  el.innerHTML = `<div class="scBox dgRes ${win ? 'win' : 'lose'}"><div class="scT">${win ? `🔮 영혼석 던전 완주!` : D.retreated ? `🏠 귀환 · ${cleared}층 돌파` : cleared ? `💀 원정 실패 · ${cleared}층 돌파` : '💀 원정 실패'}</div><div class="scS">${win ? `생존 ${alive}/${G.heroes.length}` : D.retreated ? '원정 종료' : `${esc(D.floors[D.floor].n)}에서 파티 전멸`} · ${Math.floor(sec / 60)}분 ${sec % 60}초${D.joints ? ` · 합동 공격 ${D.joints}회` : ''}</div>
    <div class="dgFloors">${dots}</div>
    <div class="dgResParty">${G.heroes.map(h => `<span class="${h.dead > 0 ? 'down' : ''}">${CLASSES[h.cls].icon} ${esc(CLASSES[h.cls].nm)}</span>`).join('')}</div>${bl ? `<div class="dgResBl">${bl}</div>` : ''}
    <div class="scRw"><div id="dgSoulRes" class="dgMedalRes">보상 정산 중…</div></div><button class="gbtn main" id="dgTown">🏠 마을로 귀환</button></div>`;
  if (D.bossRolled) el.querySelector('.scRw').insertAdjacentHTML('beforeend', '<div id="dgBossDropRes"></div>'); paintBossDrop();
  el.classList.remove('hidden'); $('dgTown').onclick = async () => { Snd.play('confirm'); if (D.rewardPromise) await D.rewardPromise; goTownD(); }; if (G.endStatsShow) G.endStatsShow('dungeon'); /* 📊 통계 (파티원별) */ G.dgResult = { win, got, sec, alive, cleared, floor: D.floor, joints: D.joints, bless: { ...D.bless }, mode: E0.mode, why: E0.why || null, medals: null, bossDrop: D.bossDrop };
  const pay = () => {
    const m = $('dgSoulRes'); if (m) m.textContent = '보상 정산 중…';
    const town = $('dgTown'); if (town) town.disabled = true;
    D.rewardPromise = Promise.all([D.bossDropPromise, D.xpChain]).catch(() => {}).then(() => settleDungeon(E0, cleared, win, {
      finish: DS.dgFinish, finishLocal: DS.dgFinishLocal, claim: Sh.claim, flush: Acc.flush,
    })).catch(() => ({ ok: false, msg: '보상을 확인하지 못했어요.' })).then(r => {
      G.dgResult.reward = r; G.dgResult.got = r.souls || 0; G.dgResult.medals = ranked ? r : null;
      if (town) town.disabled = false;
      if (!m) return r;
      m.innerHTML = r.ok
        ? r.practice ? '<small>연습 · 보상 없음</small>' : `<div class="dgSoulTotal">🔮 +${r.souls.toLocaleString()}</div>${r.xp != null ? `<div>공용 XP +${r.xp}</div>` : ''}${ranked ? `<small>🏅 +${r.medals} · 보유 ${r.total}</small>` : ''}${r.mail && !r.claimed ? '<div>📮 우편함에 보관됨</div>' : ''}${r.capped ? '<div><small>진행 시간에 따라 일부 층만 인정됐어요</small></div>' : ''}`
        : `<span class="dgUpd">${esc(r.msg)}</span> <button id="dgRewardRetry" class="gbtn sm">다시 받기</button>`;
      const retry = $('dgRewardRetry'); if (retry) retry.onclick = pay;
      return r;
    });
  };
  pay();
}
// 🗼 탑 결과: 정식(로그인 + 서버 token) = 서버 정산(최고 기록 · 이번 주 · 첫 돌파 보상) · 연습(게스트·서버 업데이트 전·오프라인·새로고침) = 기록·보상 없음
const SP_PR = { guest: '게스트 연습 탑 — 로그인하면 기록과 첫 돌파 보상이 저장돼요', missing: '⚠ 서버 업데이트 필요 — 지금은 기록·보상 없는 연습 탑이에요', error: '서버에 연결할 수 없어 연습 탑으로 진행했어요 (기록·보상 없음)', reload: '새로고침·직접 입장한 도전은 연습이라 기록·보상이 없어요' };
function spireFinish() { const S = G.spire, sec = Math.round(D.t), el = $('stageClear'), F = D.floors[Math.max(0, D.floor)], top = S.top, up = Math.max(0, top - S.from + 1), ranked = !S.practice && !!S.token;
  Snd.setMusic('none'); Snd.play(up ? 'victory' : 'error', { force: true, exact: !!up });
  const dots = D.floors.slice(0, Math.max(0, D.floor) + 1).map((f, i) => { const done = f.floor <= top; return `<span class="${done ? 'ok' : 'fail'}" title="${esc(f.n)}">${done ? '✔' : '✖'}${f.floor}</span>`; }).slice(-12).join('');
  const bl = Object.entries(D.bless).map(([id, n]) => `${BLESS_BY[id].icon} ${esc(BLESS_BY[id].n)}${n > 1 ? ` ×${n}` : ''}`).join(' · ');
  el.innerHTML = `<div class="scBox dgRes lose spRes"><div class="scT">🗼 무한의 탑 · ${top >= S.from ? `${top}층 돌파` : `${S.from}층 도전 실패`}</div><div class="scS">시작 ${S.from}층 → 이번 도전 <b>+${up}층</b> · ${esc(F ? F.n : '')}에서 ${D.retreated ? '귀환' : '파티 전멸'} · ${Math.floor(sec / 60)}분 ${sec % 60}초${D.joints ? ` · 합동 공격 ${D.joints}회` : ''}</div>
    <div class="dgFloors">${dots}</div>
    <div class="dgResParty">${G.heroes.map(h => `<span class="${h.dead > 0 ? 'down' : ''}">${CLASSES[h.cls].icon} ${esc(CLASSES[h.cls].nm)}</span>`).join('')}</div>${bl ? `<div class="dgResBl">${bl}</div>` : ''}
    <div class="scRw">${ranked ? '<div id="spRecRes" class="dgMedalRes spRecRes">🗼 기록 저장 중…</div>' : `<small class="dgPrNote">${esc(SP_PR[S.why] || SP_PR.reload)}</small>`}</div><button class="gbtn" id="spAgain">🗼 다시 오르기 (${S.from}층)</button> <button class="gbtn main" id="dgTown">🏠 마을로 귀환</button></div>`;
  if (D.bossRolled) el.querySelector('.scRw').insertAdjacentHTML('beforeend', '<div id="dgBossDropRes"></div>'); paintBossDrop();
  el.classList.remove('hidden'); $('dgTown').onclick = () => { Snd.play('confirm'); goTownD(); }; $('spAgain').onclick = () => spireAgain(S.from);
  if (G.endStatsShow) G.endStatsShow('dungeon'); G.dgResult = { spire: true, win: false, from: S.from, top, up, sec, floor: F ? F.floor : S.from, joints: D.joints, bless: { ...D.bless }, mode: ranked ? 'ranked' : 'practice', why: ranked ? null : (S.why || 'reload'), server: null };
  if (!ranked) return; const tok = S.token, R = G.dgResult; S.token = null;
  const summary = { v: 1, party: D.party.slice(0, 5), from: S.from, top, sec, ft: S.ft.slice(-40), kills: Math.max(0, killCount()), joints: D.joints, bless: { ...D.bless }, week: S.week };
  D.rewardPromise = S.chain.then(() => SS.spFinish(tok, top, summary)).then(r => { R.server = r; const pr = SS.mergeRewards([...S.pings, r]); R.rewards = pr; const m = $('spRecRes'); if (!m) return;
    if (!r.ok) { m.innerHTML = `<span class="dgUpd">⚠ ${esc(r.msg)}</span>${pr.floors.length ? `<br><small>체크포인트로 이미 저장된 첫 돌파 보상: ${pr.floors.join('·')}층 (📮 우편함)</small>` : ''}`; return; }
    const rec = r.top > (S.prevBest || 0); R.newRecord = rec;
    const tt = pr.titles.map(t => SP_TITLES[t]).filter(Boolean).join(' ');
    m.innerHTML = `<div>공용 XP +${r.xp || 0}</div><div class="spRecL">${rec ? '<b class="spNew">🎉 신기록!</b> ' : ''}인정 <b>${r.top}층</b> · 최고 기록 <b>${r.best}층</b> · 이번 주 <b>${r.weekBest}층</b></div>${r.capped ? `<small>너무 빨리 끝나 ${r.top}층까지만 인정됐어요</small>` : ''}`
      + (pr.floors.length ? `<div class="spRw">📮 첫 돌파 보상 (${pr.floors.join('·')}층)${pr.souls ? ` · 영혼석 <b>+${pr.souls}</b>` : ''}${pr.medals ? ` · 🏅 던전 메달 <b>+${pr.medals}</b>` : ''}${tt ? ` · 칭호 <b>${esc(tt)}</b>` : ''}<br><small>우편함에서 받기를 눌러 주세요</small></div>` : nextFirstHtml(r.best));
    if (rec) Snd.play('levelUp', { force: true }); if (pr.mails.length) { Snd.play('coin', { force: true }); Sh.refresh().catch(() => {}); } }).catch(e => console.warn('spire finish', e)); }
const nextFirstHtml = best => { const n = (Math.floor(Math.max(0, best) / 5) + 1) * 5, x = firstClear(n); return x ? `<small>다음 첫 돌파 보상: ${n}층 — ${x.souls ? '영혼석 ' + x.souls : ''}${x.medals ? ' · 던전 메달 ' + x.medals : ''}${x.title ? ' · 칭호 ' + esc(SP_TITLES[x.title]) : ''}</small>` : ''; };
// 다시 오르기: 로그인 계정은 서버에 새 도전 등록 (하루 30회), 게스트·서버 업데이트 전은 연습
async function spireAgain(from) { const b = $('spAgain'); if (!b || b.disabled) return; b.disabled = true; b.textContent = '입장 확인 중…';
  const r = await SS.spStart(from); if (r.blocked) { Snd.play('error'); banner(r.msg, '#ffb06a', 2600); b.disabled = false; b.textContent = `🗼 다시 오르기 (${from}층)`; return; }
  if (r.mode === 'practice') SS.markPractice(r.why, r.from); Snd.play('confirm'); $('fade').classList.add('on'); go({ spire: r.from || from }, 400); }
async function goTownD() { if (D.rewardPromise) await D.rewardPromise; $('fade').classList.add('on'); go({ town: 1 }, 400); }
export { finish as dgFinish };
