import { applyTowerSlow } from '../combat/tower-slow.js';
import { updBeam, clearBeam } from './beam.js';
import { retireTowerMeter } from '../combat/meter.js';
import { towerShell } from '../render/tower-projectiles.js';
import { Snd } from '../audio/audio.js';
import * as THREE from 'three';
import { rnd } from '../core/util.js';
import { tileX, tileZ } from '../core/grid.js';
import { TOWERS, REPAIR_K } from '../data/towers.js';
import { towerAvailable } from './tower-rules.js';
import { G } from '../core/state.js';
import { scene } from '../render/scene.js';
import { glow, mk, toon, disposeOwned } from '../render/toon.js';
import { P, PB, debris, dmgText, emit, popCoins, ringFx } from '../render/vfx.js';
import { core, refreshTile } from './terrain.js';
import { computeDist, dAt } from './pathfinding.js';
import { towerModel } from '../render/tower-models.js';
import { shoot } from '../combat/projectiles.js';
import { hurt } from '../monsters/enemy.js';
import { banner, refreshHud } from '../ui/hud.js';
import { hpBar } from '../render/hpbars.js';
import { select } from '../ui/input.js';
import { endgameTowerMods } from '../data/endgame-research.js';
import { BRANCH, upgradeCost, upgradeBlock, MAX_TOWER_LEVEL, canSpecialize } from '../data/growth.js';
import { advTowerMods } from '../data/advance.js';
import { decorate, recalc, updDeco, updGrowFx } from './growth.js';
import { Q } from '../render/quality.js';
import { towerCdStep } from '../combat/towerstatus.js';

function placeTower(t, type) {
  if(!towerAvailable(type,G))return null;
  const D = TOWERS[type], tw = { kind: 'tower', type, lvl: 1, t, c: t.c, r: t.r, cd: .5, invest: D.cost, pop: 0, recoil: 0 };
  tw.max = tw.hp = D.hp[0]; tw.hitT = 0; tw.fxT = 0; tw.anchor = new THREE.Object3D(); tw.anchor.position.set(tileX(t.c), 0, tileZ(t.r)); scene.add(tw.anchor);
  tw.hb = hpBar(tw.anchor, 3.6, 1.6, 0x55ff77, { auto: true, h: .17 });
  tw.xp = 0; tw.stars = 1; tw.branchPending = false; tw.branch = null; tw.shots = 0; tw.mods = endgameTowerMods(G.research, type, G.adv ? advTowerMods(G.adv, type) : undefined, G.beamAttackResearch); recalc(tw);
  tw.rebuild = () => { const m = towerModel(tw.type, tw.lvl); m.g.position.set(tileX(tw.c), 0, tileZ(tw.r)); return m; };
  tw.m = towerModel(type, 1); tw.m.g.position.set(tileX(t.c), 0, tileZ(t.r)); decorate(tw); Snd.play('build', { pos: tw.m.g.position }); Snd.play('place', { delay: .12 }); scene.add(tw.m.g); t.tower = tw; G.towers.push(tw); refreshTile(t); return tw;
}
function upgradeTower(tw) {
  const why = upgradeBlock(tw, G.gold); if (why) { Snd.play('error'); return false; } const c = upgradeCost(tw.type, tw.lvl, tw.mods); G.gold -= c; tw.invest += c; tw.lvl++; { const nm = TOWERS[tw.type].hp[tw.lvl - 1]; tw.hp += nm - tw.max; tw.max = nm; tw.hb.set(tw.hp / tw.max); } Snd.play('upgrade', { pos: { x: tileX(tw.c), z: tileZ(tw.r) } }); Snd.play('levelUp', { vol: .7 });
  const ry = tw.m.head.rotation.y; scene.remove(tw.m.g); disposeOwned(tw.m.g); tw.m = towerModel(tw.type, tw.lvl); tw.m.head.rotation.y = ry; tw.m.g.position.set(tileX(tw.c), 0, tileZ(tw.r)); scene.add(tw.m.g); tw.pop = 0; recalc(tw); decorate(tw);
  const p = tw.m.g.position; emit(P, p.x, 1, p.z, 50, 0xffe066, 6, .9, -4, 2); emit(PB, p.x, 2, p.z, 10, 0xffd23a, 3, .8, 2, 1); ringFx(p, 2.5, 0xffd23a, .6); banner(`${TOWERS[tw.type].n} Lv.${tw.lvl}!`, '#ffe066', 900); tw.branchPending = canSpecialize(tw); refreshHud(); return true;
}
function sellTower(tw) {
  const v = Math.floor(tw.invest * .7 * (tw.hp / tw.max >= .999 ? 1 : .5 + .5 * tw.hp / tw.max)); G.gold += v; Snd.play('sell'); Snd.play('breakWood', { pos: { x: tileX(tw.c), z: tileZ(tw.r) }, vol: .5 }); const hpK = tw.hp / tw.max; scene.remove(tw.m.g); removeTowerObj(tw);
  const p = tw.m.g.position; debris(p.x, 1, p.z, 14, [0xe0dacb, 0x9e98ae, 0xa8703a], 6); popCoins(p.clone().setY(1.5), 4); dmgText(p.clone().setY(2.5), `+${v}G`, '#ffe066', true); select(null); computeDist(); refreshHud();
}
function removeTowerObj(tw) { clearBeam(tw); disposeOwned(tw.m.g); tw.dead = true; retireTowerMeter(G.dmTowers, tw); G.towers.splice(G.towers.indexOf(tw), 1); tw.t.tower = null; refreshTile(tw.t); scene.remove(tw.anchor); tw.hb.dispose(); }
// ---- 타워 체력 / 피해 / 파괴 / 수리 ----
function damageTower(tw, dmg, src) {
  if (!tw || tw.dead || dmg <= 0) return; tw.hp -= dmg; tw.hb.set(Math.max(0, tw.hp / tw.max)); tw.hitT = .25; G.stats.towerDmg = (G.stats.towerDmg || 0) + dmg;
  const p = tw.anchor.position; dmgText(new THREE.Vector3(p.x, 3, p.z), Math.round(dmg), '#ff9a6a'); Snd.play('towerHit', { pos: p });
  debris(p.x, 1.2, p.z, 3, [0xe0dacb, 0x9e98ae, 0xa8703a], 3.5);
  if (tw.hp <= 0) destroyTower(tw, src);
}
function destroyTower(tw) {
  const p = tw.m.g.position.clone(); scene.remove(tw.m.g); removeTowerObj(tw); G.stats.towersLost = (G.stats.towersLost || 0) + 1;
  debris(p.x, 1.4, p.z, 30, [0xe0dacb, 0x9e98ae, 0xa8703a, 0x6a6a7a], 8); emit(P, p.x, 1.5, p.z, 60, 0x9a9a9a, 5, 1.1, 1, 1.5); emit(PB, p.x, 1, p.z, 18, 0xff8a3a, 4, .6, 0, 1); ringFx(p, 3, 0xff6a3a, .5);
  G.shake = Math.max(G.shake, .45); Snd.play('towerBreak', { pos: p, force: true }); Snd.play('breakRock', { pos: p, force: true, rate: .8 });
  banner(`${TOWERS[tw.type].n} 파괴됨!`, '#ff7a5a', 1200); if (G.sel === tw) select(null); computeDist(); refreshHud();
}
const repairCost = tw => tw.hp >= tw.max ? 0 : Math.max(5, Math.ceil((1 - tw.hp / tw.max) * tw.invest * REPAIR_K));
function repairTower(tw, quiet) {
  const c = repairCost(tw); if (!c) return 0; if (G.gold < c) { if (!quiet) { Snd.play('error'); banner('골드가 부족합니다', '#ff8a8a', 700); } return -1; }
  G.gold -= c; G.stats.repairSpent = (G.stats.repairSpent || 0) + c; tw.hp = tw.max; tw.hb.set(1); const p = tw.anchor.position;
  emit(P, p.x, 1.5, p.z, 30, 0x7aff9a, 4, .8, -2, 1.5); ringFx(p, 2.2, 0x7aff9a, .45); dmgText(new THREE.Vector3(p.x, 3, p.z), `수리 -${c}G`, '#9affb0', true); Snd.play('repair', { pos: p }); refreshHud(); return c;
}
function repairAll() { let n = 0, spent = 0; const L = G.towers.filter(t => t.hp < t.max).sort((a, b) => a.hp / a.max - b.hp / b.max);
  for (const tw of L) { const c = repairTower(tw, true); if (c > 0) { n++; spent += c; } }
  if (!L.length) banner('수리할 타워가 없습니다', '#ffffff', 700); else if (!n) { Snd.play('error'); banner('골드가 부족합니다', '#ff8a8a', 700); } return spent; }
function enemyAim(e) { return e.g.position.clone().setY(e.E.fly ? e.m.inner.position.y : e.E.h * .55 + e.g.position.y); }
// 피해 미터: 타워 피해는 영웅이 아닌 공용 칸 (G.mWho = null)
function updTowers(dt) { const w0 = G.mWho; G.mWho = null; try { updTowers0(dt); } finally { G.mWho = w0; G.mTw = null; } } // G.mTw = 지금 행동 중인 타워 (타워별 피해)
function updTowers0(dt) {
  if (G.grow) updGrowFx(dt);
  for (const tw of [...G.towers]) { G.mTw = tw;
    if (tw.poisonT > 0) {
      const step = Math.min(dt, tw.poisonT); tw.poisonT -= step;
      tw.poisonTick = (tw.poisonTick || 0) + step; tw.poisonDamage = (tw.poisonDamage || 0) + tw.poisonDps * step;
      if (tw.poisonTick >= .5 || tw.poisonT <= 0) { damageTower(tw, tw.poisonDamage); tw.poisonTick = tw.poisonDamage = 0; }
      if (tw.dead) continue;
    }
    const D = TOWERS[tw.type], L = tw.lvl - 1, m = tw.m, p = m.g.position, S = tw.S, B = tw.branch ? tw.B || BRANCH[tw.type][tw.branch] : null; if (tw.deco) updDeco(tw, dt); const canAct = towerCdStep(tw, dt, G.t); /* 챕터 몬스터 디버프: 속박·용암·저주(정지) · 빙결·한기(감속) — combat/towerstatus.js */ tw.pop = Math.min(1, tw.pop + dt * 3);
    const s = tw.pop < 1 ? 1 + Math.sin(tw.pop * Math.PI) * .25 : 1; m.g.scale.set(s, tw.pop < 1 ? .4 + tw.pop * .6 : 1, s);
    if (m.anim.crys) { m.head.position.y = m.anim.baseY + Math.sin(G.t * 2.4 + tw.c) * .15; m.anim.crys.rotation.y += dt * 1.6; m.anim.rings.forEach((r, k) => { r.rotation.z += dt * (1.2 + k * .7) * (k % 2 ? -1 : 1); }); }
    if (m.anim.flag) m.anim.flag.rotation.y = Math.sin(G.t * 5 + tw.c) * .4; if (m.anim.gem) m.anim.gem.rotation.y += dt * 2;
    tw.recoil = Math.max(0, tw.recoil - dt * 4);
    if (tw.hp < tw.max) { // 손상 연출: 피격 흔들림, 50% 이하 연기, 25% 이하 불꽃
      if (tw.hitT > 0) { tw.hitT -= dt; m.g.position.x = tileX(tw.c) + Math.sin(G.t * 70) * tw.hitT * .4; } else m.g.position.x = tileX(tw.c);
      tw.fxT -= dt; const k = tw.hp / tw.max; if (k < .5 && tw.fxT <= 0) { tw.fxT = k < .25 ? .08 : .2; emit(P, p.x + rnd(-.5, .5), 2.2, p.z + rnd(-.5, .5), 1, 0x5a5a62, .6, 1.4, 2.5, .3); if (k < .25) emit(P, p.x + rnd(-.4, .4), 1.6, p.z + rnd(-.4, .4), 2, 0xff8a2a, 1.2, .5, 3, .3); } }
    if (tw.type === 'guardian') { updBeam(tw, dt, canAct); continue; }
    if (!canAct) continue; // 속박·용암 웅덩이·저주 봉인: 조준·공격 정지
    const rng = S.range; let best = null, bd = Infinity; const many = B && B.targets && tw.cd <= 0 ? [] : null, byHp = B && B.prio === 'hp';
    for (const e of G.enemies) { if (e.dead || (e.E.fly && !D.air) || e.immT > G.t) continue; const dx = e.g.position.x - p.x, dz = e.g.position.z - p.z; if (dx * dx + dz * dz > rng * rng) continue;
      const prog = byHp ? -e.hp : e.E.fly ? Math.hypot(core.position.x - e.g.position.x, core.position.z - e.g.position.z) : dAt(e.tile[0], e.tile[1]); if (many) many.push([prog, e]); if (prog < bd) { bd = prog; best = e; } }
    if (!best) continue;
    const want = Math.atan2(best.g.position.x - p.x, best.g.position.z - p.z); let d = want - m.head.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.head.rotation.y += d * Math.min(1, dt * 10);
    if (tw.type === 'cannon') { const k = tw.recoil * .25; m.head.position.x = -Math.sin(m.head.rotation.y) * k; m.head.position.z = -Math.cos(m.head.rotation.y) * k; }
    if (tw.cd > 0) continue; tw.cd = 1 / S.rate; tw.shots++; const from = new THREE.Vector3(); m.muzzle.getWorldPosition(from);
    if (tw.type === 'arrow') {
      if (many) { many.sort((a, b) => a[0] - b[0]); for (const [, e] of many.slice(0, B.targets)) shoot('arrow', from, e, S.dmg, { spd: 36, color: 0x7affc0, tw }); }
      else shoot('arrow', from, best, S.dmg, B ? { spd: 60, color: 0xff7a9a, tw, ap: true, big: true } : { spd: 34, color: L >= 2 ? 0x9affff : 0xfff0c0, tw });
      Snd.play('arrow', { pos: from, rate: B && !many ? .8 : 1.15 }); }
    else if (B && B.pierce) { const dir = new THREE.Vector3(best.g.position.x - from.x, 0, best.g.position.z - from.z).normalize(), shell = towerShell('pierce', L, from, scene);
      shell.lookAt(from.clone().add(dir)); shell.rotateX(Math.PI / 2); G.projs.push({ kind: 'pierce', m: shell, dir, left: S.range + 2, spd: 30, dmg: S.dmg, hit: new Set(), tw });
      tw.recoil = 1.3; emit(P, from.x, from.y, from.z, 20, 0x9ad8ff, 5, .35, 0, .5); Snd.play('cannon', { pos: from, rate: .8 }); Snd.play('zap', { pos: from, vol: .5 }); }
    else if (tw.type === 'cannon') { const dest = best.g.position.clone(); if (best.next) { const v = new THREE.Vector3(tileX(best.next[0]) - dest.x, 0, tileZ(best.next[1]) - dest.z); if (v.length() > .01) dest.addScaledVector(v.normalize(), Math.min(1.5, best.E.spd * .6)); }
      const ball = towerShell('ball', L, from, scene); G.projs.push({ kind: 'ball', m: ball, from: from.clone(), dest, t: 0, dur: .7, dmg: S.dmg, r: S.splash, tw, cluster: B ? B : null });
      tw.recoil = 1; emit(P, from.x, from.y, from.z, 14, 0xffaa4a, 4, .35, 0, .5); emit(P, from.x, from.y, from.z, 8, 0x8a8a8a, 2, .8, 1.5, .5); Snd.play('cannon', { pos: from }); }
    else chainLightning(from, best, S.dmg, S.chain, S.slow, tw, S, B);
  }
}
function chainLightning(from, first, dmg, n, slow, tw, S, B) {
  const hit = new Set(), fp = first.g.position.clone(); let cur = first, a = from.clone(); const fo = S ? S.falloff : .85, hop = S ? S.hop : 3.8, frost = B && B.freezeEvery, cA = frost ? 0x8ae8ff : B ? 0xd8b0ff : 0x9ae8ff, cB = frost ? 0xc8f4ff : 0xc0a0ff;

  for (let k = 0; k < n && cur; k++) { const b = enemyAim(cur); bolt(a, b, k ? cB : cA); const ce = cur; hit.add(ce); applyTowerSlow(ce, slow, B && B.slowT ? B.slowT : 1.3); hurt(ce, dmg * Math.pow(fo, k), frost ? '#bff4ff' : '#c8b8ff'); emit(P, b.x, b.y, b.z, 8, frost ? 0xbff4ff : 0xb8a0ff, 4, .35, 0, .5);
    if (frost && k === 0 && !ce.dead && tw.shots % B.freezeEvery === 0) { ce.stunT = ce.E.boss ? B.freezeBoss : B.freezeT; ce.frozen = true; emit(PB, b.x, b.y, b.z, 8, 0x8ae8ff, 3, .6, 0, .8); emit(P, b.x, b.y, b.z, 30, 0xe0fbff, 5, .7, -3, 1); ringFx(ce.g.position, 2, 0x8ae8ff, .4); Snd.play('glass', { pos: b, vol: .45 }); }
    a = b; let nb = null, nd = hop * hop; for (const e of G.enemies) { if (e.dead || hit.has(e)) continue; const d = e.g.position.distanceToSquared(ce.g.position); if (d < nd) { nd = d; nb = e; } } cur = nb; }
  Snd.crackle(first.g.position);
}
function bolt(a, b, color) {
  for (let w = 0; w < 2; w++) { const pts = [], n = 9; for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); if (i > 0 && i < n) p.add(new THREE.Vector3(rnd(-.4, .4), rnd(-.4, .4), rnd(-.4, .4))); pts.push(p); }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: w ? 0xffffff : color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); scene.add(l); G.fxs.push({ m: l, t: 0, dur: .2, kind: 'fade' }); }
}
export { towerModel, placeTower, upgradeTower, sellTower, enemyAim, updTowers, damageTower, destroyTower, repairTower, repairAll, repairCost };
