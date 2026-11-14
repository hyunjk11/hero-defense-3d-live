// Browser-only QA. Call on a disposable localhost origin with ?test=1.
import * as THREE from 'three';
import { towerModel } from '../src/render/tower-models.js';
import { disposeOwned } from '../src/render/toon.js';
import { renderer } from '../src/render/scene.js';

function guard() {
  if (location.hostname !== '127.0.0.1' || location.port !== '8774' || !new URLSearchParams(location.search).has('test')) throw Error('Disposable QA origin required');
  if (window.G.gear?.Acc.A.user) throw Error('Never run against an account');
}
const assert = (yes, message) => { if (!yes) throw Error(message); };

export function verifyModels() {
  guard(); const results = [];
  for (const type of ['arrow', 'cannon', 'magic']) {
    const heights = [];
    for (let level = 1; level <= 5; level++) {
      const m = towerModel(type, level); m.g.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(m.g), p = m.muzzle.getWorldPosition(new THREE.Vector3());
      assert([p.x, p.y, p.z, ...bounds.min, ...bounds.max].every(Number.isFinite), 'Invalid model bounds');
      assert(bounds.max.x - bounds.min.x < 2.1 && bounds.max.z - bounds.min.z < 3, 'Tower exceeds tile clearance');
      assert(p.y > 1 && (type === 'magic' || p.z > .6), 'Muzzle inside pedestal');
      m.head.rotation.y = Math.PI / 2; m.g.updateMatrixWorld(true);
      const turned = m.muzzle.getWorldPosition(new THREE.Vector3());
      assert(Math.abs(turned.x - p.z) < 1e-6 && Math.abs(turned.z + p.x) < 1e-6, 'Muzzle does not follow aim');
      heights.push(bounds.max.y);
      let triangles = 0; m.g.traverse(o => { if (o.isMesh) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
      results.push({ type, level, height: +bounds.max.y.toFixed(2), triangles, muzzle: p.toArray() }); disposeOwned(m.g);
    }
    assert(new Set(heights).size === 5, type + ' has indistinguishable level heights');
  }
  return results;
}

export function gallery() {
  guard(); const G = window.G; G.manual = true; G.pauseRender = true;
  G.Snd.cfg.bgmOn = G.Snd.cfg.sfxOn = false; G.Snd.apply();
  for (const el of [...document.body.children]) if (el.tagName !== 'SCRIPT') el.style.display = 'none';
  const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;inset:0;background:#161e2a;color:#e9edf2;font-family:Malgun Gothic,sans-serif'; document.body.append(wrap);
  renderer.setPixelRatio(1.5); renderer.setSize(innerWidth, innerHeight); wrap.append(renderer.domElement);
  const label = (text, x, y, size, color) => { const d = document.createElement('div'); d.textContent = text; d.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:${size}px;color:${color};font-weight:bold`; wrap.append(d); };
  label('타워 외형 · Lv.1 → Lv.5', 28, 18, 24, '#f4dfaa');
  const W = innerWidth / 5, H = (innerHeight - 70) / 3;
  renderer.autoClear = true; renderer.setScissorTest(true);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    const type = ['arrow', 'cannon', 'magic'][row], level = col + 1, s = new THREE.Scene(); s.background = new THREE.Color(row % 2 ? 0x1c2736 : 0x202d3d);
    s.add(new THREE.HemisphereLight(0xe6f4ff, 0x626073, 2));
    const sun = new THREE.DirectionalLight(0xffefcf, 3); sun.position.set(-4, 8, 5); s.add(sun);
    const m = towerModel(type, level); s.add(m.g);
    const camera = new THREE.PerspectiveCamera(32, W / H, .1, 50); camera.position.set(5.4, 6.3, 8.8); camera.lookAt(0, 1.9, 0);
    const y = innerHeight - 66 - (row + 1) * H; renderer.setViewport(col * W, y, W, H); renderer.setScissor(col * W, y, W, H); renderer.render(s, camera);
    label(`${['화살탑', '대포탑', '마법탑'][row]}  ${level}`, col * W + 22, 72 + row * H, 16, '#d9e4ef');
  }
  renderer.setScissorTest(false); return { models: 15, muted: true };
}

export async function verifyLifecycle(type, branch) {
  guard(); const G = window.G;
  assert(G.ready && G.phase === 'build' && G.towers.length === 0, 'Fresh battle required');
  G.manual = true; G.grow = true; G.stage = G.STAGE_CFG; G.gold = 10000;
  G.build(12, 7, type); const tw = G.towers[0]; assert(tw, 'Build failed');
  assert(!tw.branchPending && tw.xp === 0, 'Fresh tower specialization unlocked');
  const levels = [tw.m.g.name]; tw.m.head.rotation.y = .7;
  G.damageTower(tw, 11); const missingHp = tw.max - tw.hp;
  for (let i = 0; i < 2; i++) { assert(G.upgradeTower(tw), 'Upgrade rejected'); levels.push(tw.m.g.name); }
  assert(tw.xp === 0 && !G.upgradeTower(tw), 'XP gate removed');
  assert(tw.max - tw.hp === missingHp && tw.m.head.rotation.y === .7, 'Upgrade reset damage or aim');
  G.towerXp(tw, 600); assert(tw.stars === 2 && tw.m.g.name.endsWith('lv3'), 'XP rebuild changed paid level');
  G.towerXp(tw, 1799); assert(!tw.branchPending, 'Specialization available before 2400 XP');
  G.towerXp(tw, 1); assert(tw.branchPending && tw.deco.ready.visible, 'Missing specialization marker');
  assert(G.chooseBranch(tw, branch), 'Specialization failed');
  for (let i = 0; i < 2; i++) { assert(G.upgradeTower(tw), 'Specialized upgrade rejected'); levels.push(tw.m.g.name); }
  assert(new Set(levels).size === 5 && tw.lvl === 5 && tw.branch === branch, 'Missing paid level models');
  assert(!G.upgradeTower(tw), 'Maximum level not enforced');
  G.repairTower(tw); assert(tw.hp === tw.max, 'Repair failed');
  const animation = (await import('../src/world/towers.js')).updTowers;
  const enemies = []; G.heroes[0].g.position.set(22, 0, 14);
  for (let i = 0; i < 8; i++) { const [x, z] = G.tileXZ(12, 8); const e = G.spawnEnemy('grunt', 1000, { x: x + (i % 2) * .4, z: z + Math.floor(i / 2) * .6, tile: [12, 8] }); e.E = { ...e.E, spd: 0 }; enemies.push(e); }
  tw.cd = 0; animation(.05); const projectiles = G.projs.map(p => p.kind); let peakStun = 0;
  for (let i = 0; i < 140; i++) { G.sim(.05); peakStun = Math.max(peakStun, ...enemies.map(e => e.stunT || 0)); }
  const damage = enemies.reduce((n, e) => n + e.max - e.hp, 0), shots = tw.shots;
  assert(damage > 0 && enemies.every(e => Number.isFinite(e.hp)), 'No valid damage');
  if (branch === 'multi') assert(projectiles.length === 5, 'Multishot lost');
  if (branch === 'pierce') assert(projectiles.includes('pierce'), 'Piercing shot lost');
  if (branch === 'frost') assert(peakStun >= 1.2, 'Freeze lost');
  if (branch === 'storm') assert(enemies.every(e => e.hp < e.max), 'Chain targets lost');
  G.sellTower(tw); assert(!G.towers.includes(tw) && !tw.m.g.parent && !tw.anchor.parent, 'Sold model still active');
  G.build(12, 7, type); const replacement = G.towers[0]; assert(replacement.m.g.name.endsWith('lv1'), 'Shared model damaged after sale');
  G.damageTower(replacement, replacement.max + 1); assert(G.towers.length === 0, 'Destroyed model still active');
  return { type, branch, levels, shots, damage, projectiles, peakStun, lifecycle: 'passed' };
}
