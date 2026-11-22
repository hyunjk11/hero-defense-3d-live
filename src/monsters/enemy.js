import { hardDefinition } from './hard.js';
import { endgameKilled } from './endgame.js';
import { machineKilled } from './machine.js';
import { stormKilled } from './storm.js';
import { towerXp } from '../world/growth.js';
import { KILL_XP } from '../data/growth.js';
import { Snd } from '../audio/audio.js';
import { rand, rnd } from '../core/util.js';
import { SPAWN, SPAWNS, tileX, tileZ, GW, STAGE, DUNGEON } from '../core/grid.js';
const DN_MERGE = .15; // U-11 던전 피해 숫자 합치기 창 (초)
import { ETYPES } from '../data/monsters.js';
import { G, later } from '../core/state.js';
import { scene } from '../render/scene.js';
import { disposeObj } from '../render/toon.js';
import { P, PB, debris, dmgText, emit, popCoins } from '../render/vfx.js';
import { hpBar } from '../render/hpbars.js';
import { shadowOf } from './ai.js';
import { desertKilled } from './desert.js';
import { makeEnemyModel, play } from '../render/characters.js';
import { core, crystalMat } from '../world/terrain.js';
import { enemyAim } from '../world/towers.js';
import { gameOver } from '../core/waves.js';
import { banner } from '../ui/hud.js';
import { meterAdd, towerAdd } from '../combat/meter.js';
import { lootFx } from '../render/loot.js';
import { BOSS_DROP, bossOdds, randomItem, GRADES } from '../account/equip.js';
import * as Acc from '../account/account.js';
import { initAbilities, armorOf, crackHit, absorbShield, onKilled } from './abilities.js';
import { SPIRE_ELITE } from '../data/rulesets.js';
import { shareGeo } from '../render/toon.js';
import * as THREE from 'three';

let _eRingG = null, _eRingM = null, _eAuraM = null;
function eliteMark(e) { _eRingG ||= shareGeo(new THREE.RingGeometry(.66, 1, 40)); _eRingM ||= new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: .9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  _eAuraM ||= new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: .3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const r = Math.max(.9, e.E.h * .42) / SPIRE_ELITE.scale, ring = new THREE.Mesh(_eRingG, _eRingM), aura = new THREE.Mesh(_eRingG, _eAuraM); ring.rotation.x = aura.rotation.x = -Math.PI / 2; ring.position.y = .1; aura.position.y = .14;
  ring.scale.setScalar(r); aura.scale.setScalar(r * 1.35); ring.userData.elite = aura.userData.elite = 1; e.g.add(ring, aura); e.eliteRing = ring;
  if (e.m.mats) for (const m of e.m.mats) if (m.emissive) { m.emissive.setHex(0x5a0a00); m.userData.e = m.emissive.clone(); } } // 붉은 기운 (피격 플래시 후에도 유지)


// ================= 적 =================
// at = { x, z, tile } 이면 포털 대신 그 자리에서 (분열한 슬라임 등) — 포털 순번·출현 연출 없음
function spawnEnemy(type, hpMul, at, elite = false) {
  const E = G.spireE ? G.spireE(type, !!elite) : hardDefinition(ETYPES[type],elite,at), /* 🗼 무한의 탑만 G.spireE (dungeon/spire.js) */ m = makeEnemyModel(type), hp = E.hp * hpMul; scene.add(m.g);
  if (E.elite) m.g.scale.setScalar(SPIRE_ELITE.scale);
  const sp = at ? at.tile : SPAWNS.length > 1 ? SPAWNS[(G.spawnIdx = ((G.spawnIdx || 0) + 1)) % SPAWNS.length] : SPAWN, side = sp[0] <= 0 || sp[0] >= GW - 1; // 여러 포털이면 번갈아
  if (at) m.g.position.set(at.x, 0, at.z); else { m.g.position.set(tileX(sp[0]) + (side ? (sp[0] <= 0 ? .4 : -.4) : rnd(-.5, .5)), 0, tileZ(sp[1]) + (side ? rnd(-.5, .5) : sp[1] <= 0 ? .4 : -.4)); m.g.rotation.y = side ? (sp[0] <= 0 ? Math.PI / 2 : -Math.PI / 2) : (sp[1] <= 0 ? 0 : Math.PI); }
  const e = { type, E, m, g: m.g, hp, max: hp, ai: E.ai || 'basic', profile: E.profile || 'default', tile: sp.slice(), next: null, off: [rnd(-.45, .45), rnd(-.45, .45)], slowT: 0, slowAmt: 0, flash: 0, atkCd: rnd(0, .5), hitT: rnd(0, .3), state: 'walk', spawnT: 0, dead: false, bob: rand() * 6 };
  if (E.ab || E.swamp || E.desert || E.storm || E.machine || E.endgame) initAbilities(e); if (E.elite) { e.elite = true; eliteMark(e); }
  if (at) { e.hb = hpBar(m.g, E.fly ? 4 : E.h + .35, Math.max(1.1, E.h * .55), 0x55ff77, { auto: true, h: .15 }); shadowOf(e); G.enemies.push(e); return e; }
  if (!E.fly) { const a = play(m, 'Spawn_Ground_Skeletons', { once: true, speed: 2, fade: 0 }); if (E.elite && !E.boss) banner(`⚠ ${E.n} 출현!`, '#ff8a4a', 1200); e.state = 'spawn'; e.spawnT = a ? Math.min(1.4, a.getClip().duration / 2) : 0; emit(P, m.g.position.x, .3, m.g.position.z, 12, 0x9a7a5a, 3, .6, -6, 1.5); }
  e.hb = hpBar(m.g, E.fly ? 4 : E.h + .35, E.boss ? 3 : E.elite ? Math.max(1.5, E.h * .6) : Math.max(1.1, E.h * .55), E.boss ? 0xff3a4a : E.elite ? 0xff8a2a : 0x55ff77, { auto: !E.boss && !E.elite, h: E.boss ? .22 : E.elite ? .18 : .15 });
  if (E.boss) { G.shake = .7; Snd.roar(m.g.position); banner(`⚠ 보스 출현: ${E.n} ⚠`, '#ff4a5a', 2200); emit(PB, m.g.position.x, 2, m.g.position.z, 40, 0xff3a3a, 8, 1, -2, 2); }
  emit(P, m.g.position.x, 1.5, m.g.position.z, 14, 0xc07aff, 4, .5); shadowOf(e); G.enemies.push(e); return e;
}
// 방패병: 공격 방향(src)과 바라보는 방향의 각도로 피해 감소. 정면 원거리 대폭 감소, 근접은 일부, 옆은 소폭, 뒤는 추가 피해. src 없는 범위/번개 공격은 무시
function shieldFactor(e, src) {
  const S = e.E.shieldDef; if (!S || !src || e.guardOpenT > 0 || e.dying !== undefined) return 1;
  const g = e.g, fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), dx = src.x - g.position.x, dz = src.z - g.position.z, d = Math.hypot(dx, dz) || 1;
  const ang = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / d))) * 180 / Math.PI, melee = src.kind === 'melee';
  let red = ang <= S.arc ? (melee ? S.melee : S.front) : ang <= S.side ? (melee ? S.sideRed / 2 : S.sideRed) : S.back;
  if (red > 0 && src.kind === 'beam-cut-charge' && (e.E.elite || e.E.boss)) red *= 1 - Math.min(.5, Math.max(0, src.guardPierce || 0));
  e.lastShield = { ang, red, kind: src.kind }; return 1 - red;
}
// 피해 미터: 실제로 깎인 체력만 기록 (주인 = G.mWho 가 정해졌으면 그것(null = 타워·공용), 아니면 현재 영웅 G.curHero) · 종류 G.mK (1 = 스킬)
function hurt(e, dmg, color, big, src, ignoreArmor = false) { if (e.dead) return hurt0(e, dmg, color, big, src, ignoreArmor); const tw = G.mTw, w = G.mWho, own = w === undefined ? G.curHero : w, dm = own ? own.dm : G.dmOther;
  if (G.spireDmgK && own && !tw) dmg *= G.spireDmgK(own); // 🗼 🔮마법·🏹원거리 저항 (탑에서만, dungeon/spire.js)
  if (!tw && !dm) return hurt0(e, dmg, color, big, src, ignoreArmor); const h0 = Math.max(0, e.hp); hurt0(e, dmg, color, big, src, ignoreArmor); const d = h0 - Math.max(0, e.hp);
  if (tw) towerXp(tw, d + (e.dead ? KILL_XP : 0)); if (dm) meterAdd(dm, d, G.t, G.mK, e.dead); if (!own && G.mTw) towerAdd(G.dmTowers, G.mTw, d, e.dead); }
function hurt0(e, dmg, color = '#fff', big = false, src = null, ignoreArmor = false) {
  if (e.dead) return; if (e.immT > G.t && dmg < 1e8) { if (!(e.immTxt > G.t)) { e.immTxt = G.t + .6; const p = enemyAim(e); p.y += e.E.fly ? .8 : e.E.h * .55; dmgText(p, e.phaseT > 0 ? '통과!' : '무적', '#d8d0f0'); } return; } // 석상·실체 소멸 (테스트 즉사 피해는 통과)
  const sk = shieldFactor(e, src);
  if (sk < .5) { Snd.play('block', { pos: e.g.position }); const p = enemyAim(e); emit(P, p.x + Math.sin(e.g.rotation.y) * .6, p.y, p.z + Math.cos(e.g.rotation.y) * .6, 6, 0xbfe0ff, 3, .25, 0, .3); e.blockT = .2;
    G.stats.blocked = (G.stats.blocked || 0) + dmg * (1 - sk); if (!(e.blockTxt > G.t)) { e.blockTxt = G.t + .6; p.y += e.E.h * .55 + .3; dmgText(p, '막음!', '#9ad4ff'); } }
  else Snd.play(armorOf(e) ? 'hitArmor' : 'hit', { pos: e.g.position });
  if (sk !== 1) { dmg *= sk; if (sk < .5) { dmg = armorDmg(e, dmg, ignoreArmor); if (e.shield > 0) dmg = absorbShield(e, dmg); e.hp -= dmg; e.flash = .05; if (e.hp <= 0) killEnemy(e); return; } } dmg = armorDmg(e, dmg, ignoreArmor);
  if (e.shield > 0) { dmg = absorbShield(e, dmg); if (dmg <= 0) { e.flash = .05; return; } } e.hp -= dmg; e.flash = .09;
  if (DUNGEON && e.dnEl && e.dnT > G.t && e.dnEl.isConnected) { e.dnSum += dmg; e.dnEl.textContent = Math.round(e.dnSum); e.dnEl.classList.add('sum'); } // U-11: 던전 — 같은 대상 0.15초 안 피해는 한 숫자로 합침
  else { const p = enemyAim(e); p.y += e.E.fly ? .8 : e.E.h * .55; const el = dmgText(p, dmg, color, big); if (DUNGEON) { e.dnEl = el; e.dnSum = dmg; e.dnT = G.t + DN_MERGE; } }
  if (e.hp <= 0) killEnemy(e);
}
// 방어력 (서리 골렘: 깨지기 전 피해 누적, 서리늑대: 무리 감소 포함). 능력 없는 몬스터는 기존 1 - E.armor 그대로
// 방어 무시는 실제 입력 피해로 파괴 누적 후 방어 배율만 생략한다. 같은 타격의 장갑 파괴가 피해를 증폭하지 않는다.
function armorDmg(e, dmg, ignoreArmor = false) { if (e.crackAcc !== undefined) crackHit(e, dmg); return ignoreArmor ? dmg : dmg * (1 - armorOf(e)); }
function killEnemy(e) {
  e.dead = true; if (e.E.ab || e.E.swamp || e.E.desert || e.E.storm || e.E.machine || e.E.endgame) onKilled(e); e.hb.show(false); const p = enemyAim(e);
  emit(P, p.x, p.y, p.z, e.E.boss ? 160 : 22, e.E.deathColor || (e.E.fly ? 0xb08aff : 0xe8e0d0), e.E.boss ? 10 : 5, .8, -10, 1.5); emit(P, p.x, p.y, p.z, 10, 0xffe066, 4, .6);
  if (!e.E.fly) debris(p.x, p.y, p.z, e.E.boss ? 30 : 5, e.E.deathDebris || [0xf0ead8, 0xd8d0c0], 5);
  if (e.E.boss) { G.shake = 1.1; emit(PB, p.x, p.y, p.z, 60, 0xff8a3a, 12, 1.2, -3, 3); banner(`${e.E.n} 처치!`, '#ffd23a'); Snd.play('boom', { pos: p, force: true }); later(.6, () => Snd.play('victory', { force: true, exact: true })); }
  if (e.E.boss && G.perm && !G.practiceSandbox) (G.runBossKills ||= []).push(G.wave);
  if (e.E.boss && G.perm && !G.practiceSandbox && G.hero && !(Acc.A.user && Acc.A.sb?.serverEconomy) && !G.dungeon && !G.stage?.hard && (G.forceDrop || Math.random() < BOSS_DROP)) { const it = randomItem(G.hero.cls, bossOdds(G.wave), Math.random, undefined, G.dropCh); /* 스테이지 = 그 챕터 세트, 도전 모드 = 열린 챕터 무작위 */ (G.runDrops ||= []).push(it); lootFx(p, it.g); // 보스 장비 드롭 (마을 출정 때만 · 던전 원정 제외: 던전 보상은 5단계 던전 메달)
    later(1.2, () => { banner(`✦ ${GRADES[it.g].n} 장비 획득: ${it.n} ✦`, GRADES[it.g].c, 2600); Snd.play('levelUp', { force: true }); Snd.play('coins', { force: true }); }); }
  if (G.dungeon && !G.spire && e.type === "dg_lich") G.onDungeonBossKilled?.(e, p);
  if (!G.practiceSandbox) { G.gold += e.E.gold; G.stats.goldEarned += e.E.gold; popCoins(p, Math.ceil(e.E.gold / 2)); } if (e.type === 'rift_spawn'||e.E.hardSummoned) G.stats.summonedKills = (G.stats.summonedKills || 0) + 1; else G.stats.kills[e.type] = (G.stats.kills[e.type] || 0) + 1; Snd.play(e.E.fly ? 'poof' : 'bones', { pos: p, rate: e.E.boss ? .6 : 1, force: e.E.boss }); e.dying = e.E.fly ? .7 : 1.6;
  if (!e.E.fly) play(e.m, 'Death_A', { once: true, fade: .1 });
}
function reachCore(e) {
  if (!G.practiceSandbox) G.coreHp -= e.E.core;
  G.stats.leaked++; e.dead = true; removeEnemy(e);
  if (G.practiceSandbox) return;
  G.shake = Math.max(G.shake, .35);
  emit(P, core.position.x, 3, core.position.z, 30, 0xff3a5a, 6, .7); crystalMat.emissive.setHex(0xff2a3a); later(.22, () => crystalMat.emissive.setHex(0x1890c0)); Snd.play('coreHit', { force: true }); Snd.play('glass', { vol: .6 });
  banner(`코어 피격! -${e.E.core}`, '#ff6a7a', 700); if (G.coreHp <= 0) gameOver();
}
function removeEnemy(e) { endgameKilled(e); machineKilled(e); stormKilled(e); desertKilled(e); scene.remove(e.g); disposeObj(e.g); e.hb.dispose(); if (e.m.mats) e.m.mats.forEach(m => m.dispose()); if (e.m.mixer) e.m.mixer.stopAllAction(); const i = G.enemies.indexOf(e); if (i >= 0) G.enemies.splice(i, 1); }

export { spawnEnemy, hurt, killEnemy, reachCore, removeEnemy, shieldFactor, armorOf };
