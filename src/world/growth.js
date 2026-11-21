import { Snd } from '../audio/audio.js';
import * as THREE from 'three';
import { towerSpecializable } from './tower-rules.js';
import { G } from '../core/state.js';
import { TOWERS } from '../data/towers.js';
import { hardBeam, HARD_BEAM_COLD, HARD_BEAM_HOT } from './tower-rules.js';
import { BRANCH, towerStats, branchFor, XP_NEED, starsFor } from '../data/growth.js';
import { Q } from '../render/quality.js';
import { camera, scene } from '../render/scene.js';
import { glow, mk, toon, shareGeo, shareMat, disposeOwned } from '../render/toon.js';
import { P, PB, emit, ringFx } from '../render/vfx.js';
import { banner, refreshHud } from '../ui/hud.js';

const starShape = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? .1 : .24, a = Math.PI / 2 + i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return s; })();
const starGeo = shareGeo(new THREE.ExtrudeGeometry(starShape, { depth: .06, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 1 }).center());
const starOn = glow(0xffd23a, 2.2), starOff = new THREE.MeshBasicMaterial({ color: 0x4a4458, transparent: true, opacity: .75 });
const goldM = toon(0xffcc44, { emissive: 0x3a2200 });
const add = (geo, color, op = .8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
[starOn, starOff, goldM].forEach(shareMat);
const fx = []; // 빛기둥 등 자체 이펙트
// 모든 타워가 한 장의 텍스처를 공유한다. 전문화가 가능한 동안만 머리 위에 표시.
let readyMat;
const readyGeo = shareGeo(new THREE.PlaneGeometry(5.2, 1.3));
function specializationMark() {
  if (!readyMat) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#211a31'; ctx.strokeStyle = '#ffd65a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(2, 2, 252, 60, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe477'; ctx.font = 'bold 34px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↑ 전문화', 128, 33);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    readyMat = shareMat(new THREE.MeshBasicMaterial({ map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  }
  const mark = new THREE.Mesh(readyGeo, readyMat); mark.position.y = 1.05; mark.renderOrder = 20; mark.name = 'specialization-ready'; return mark;
}

export const recalc = tw => {
  tw.S = towerStats(tw.type, tw.lvl, tw.branch, tw.mods, tw.stars);
  tw.B = branchFor(tw.type, tw.branch, tw.mods, tw.lvl);
  if (hardBeam && tw.type === 'guardian') {
    tw.S.dmg *= HARD_BEAM_COLD;
    tw.S.beamMaxHeat *= HARD_BEAM_HOT / HARD_BEAM_COLD;
    tw.S.beamHeavy = true;
  }
};
export function decorate(tw) {
  if (!G.grow || !tw.m) return; const g = tw.m.g, box = new THREE.Box3().setFromObject(g), top = box.max.y + .55, D = { orb: [], top };
  const bill = new THREE.Group(); bill.position.y = top; g.add(bill); D.bill = bill; D.stars = [];
  D.ready = specializationMark(); D.ready.visible = towerSpecializable(tw, G.practiceSandbox); bill.add(D.ready);
  for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(starGeo, k < tw.stars ? starOn : starOff); s.position.x = (k - 1) * .5; s.scale.setScalar(k < tw.stars ? 1 : .8); bill.add(s); D.stars.push(s); }
  const xb = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .07), new THREE.MeshBasicMaterial({ color: 0x1a1426, transparent: true, opacity: .7, depthWrite: false })); xb.position.y = -.28; bill.add(xb);
  D.xf = new THREE.Mesh(new THREE.PlaneGeometry(1, .07), new THREE.MeshBasicMaterial({ color: 0x9affd0, toneMapped: false, depthWrite: false, transparent: true })); D.xf.position.set(0, -.28, .001); bill.add(D.xf);
  const B = tw.branch && BRANCH[tw.type][tw.branch], bc = B ? new THREE.Color(B.c).getHex() : 0xffd23a;
  if (tw.stars >= 2) { // ★★: 금 테두리 + 궤도 룬
    mk(new THREE.TorusGeometry(.98, .06, 6, 28), goldM, 0, .47, 0, g, .015).rotation.x = Math.PI / 2;
    const n = tw.stars >= 3 ? 4 : 2; for (let k = 0; k < n; k++) { const o = mk(new THREE.OctahedronGeometry(.13), glow(k % 2 ? 0xffe06a : bc, 2.4), 0, 0, 0, g, .015); o.userData.a = k * Math.PI * 2 / n; D.orb.push(o); }
  }
  if (tw.stars >= 3) { // ★★★: 바닥 오라 + 분기 장식
    const aura = new THREE.Mesh(new THREE.RingGeometry(.9, 1.35, 40), add(0, bc, .55)); aura.rotation.x = -Math.PI / 2; aura.position.y = .5; g.add(aura); D.aura = aura;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.6, 24, 1, true), add(0, bc, .12)); col.position.y = 1.8; g.add(col); D.col = col;
    if (B) branchDeco(tw, g, B, bc, D);
  }
  tw.deco = D; updXpBar(tw);
}
function branchDeco(tw, g, B, bc, D) { const h = tw.m.head;
  if (tw.branch === 'multi') for (const x of [-.32, .32]) { const b = mk(new THREE.TorusGeometry(.3, .035, 6, 12, Math.PI), glow(bc, 1.6), x, .12, .3, h, .015); b.rotation.x = Math.PI / 2; b.rotation.z = x > 0 ? -.4 : .4; }
  else if (tw.branch === 'snipe') { mk(new THREE.CylinderGeometry(.06, .06, 1.1, 8), toon(0x30333e), 0, .14, .5, h, .015).rotation.x = Math.PI / 2; mk(new THREE.SphereGeometry(.09, 8, 6), glow(bc, 3), 0, .2, 1.05, h, 0); }
  else if (tw.branch === 'blast') for (let k = 0; k < 6; k++) { const s = mk(new THREE.ConeGeometry(.1, .4, 6), glow(bc, 1.8), Math.cos(k * 1.05) * .6, 0, Math.sin(k * 1.05) * .6, h, .015); s.rotation.set(Math.sin(k * 1.05) * 1.2, 0, -Math.cos(k * 1.05) * 1.2); }
  else if (tw.branch === 'pierce') { const b = mk(new THREE.CylinderGeometry(.11, .14, 1.9, 10), toon(0x5a6a8a), 0, .15, .8, h, .015); b.rotation.x = Math.PI / 2 - .2; mk(new THREE.TorusGeometry(.15, .04, 6, 12), glow(bc, 2.5), 0, .33, 1.7, h, 0).rotation.x = -.2; }
  else if (tw.branch === 'storm') { D.spin = []; for (let k = 0; k < 3; k++) { const s = mk(new THREE.IcosahedronGeometry(.16, 0), glow(bc, 3), 0, 0, 0, h, .015); s.userData.a = k * 2.09; D.spin.push(s); } }
  else if (tw.branch === 'frost') for (let k = 0; k < 3; k++) { const s = mk(new THREE.OctahedronGeometry(.16, 0), glow(bc, 2), Math.cos(k * 1.26) * .95, .7 + (k % 2) * .3, Math.sin(k * 1.26) * .95, g, .015); s.scale.y = 2.4; }
}
function updXpBar(tw) { const D = tw.deco; if (!D) return; const s = tw.stars, k = s >= 3 ? 1 : (tw.xp - XP_NEED[s - 1]) / (XP_NEED[s] - XP_NEED[s - 1]); const w = Math.max(.001, Math.min(1, k)) * 1.3; D.xf.scale.x = w; D.xf.position.x = -.65 + w / 2;
  D.xf.material.color.setHex(s >= 3 ? (tw.branch ? 0xffd23a : 0xff9a3a) : 0x9affd0); }
export function updDeco(tw, dt) { const D = tw.deco; if (!D) return; D.bill.quaternion.copy(camera.quaternion); const t = G.t;
  D.ready.visible = towerSpecializable(tw, G.practiceSandbox);
  D.bill.position.y = D.top + Math.sin(t * 2.2 + tw.c) * .06;
  if (tw.branchPending) D.stars.forEach((s, k) => s.scale.setScalar(1 + Math.sin(t * 6 + k) * .18));
  D.orb.forEach(o => { const a = o.userData.a + t * 1.6; o.position.set(Math.cos(a) * 1.15, 1.3 + Math.sin(t * 2 + o.userData.a) * .25, Math.sin(a) * 1.15); o.rotation.y += dt * 3; });
  if (D.aura) { const k = .5 + .5 * Math.sin(t * 3 + tw.c); D.aura.material.opacity = .35 + k * .35; D.aura.scale.setScalar(1 + k * .12); D.col.material.opacity = .06 + k * .08; D.col.rotation.y += dt; }
  if (D.spin) D.spin.forEach(s => { const a = s.userData.a + t * 4; s.position.set(Math.cos(a) * .9, Math.sin(t * 5 + s.userData.a) * .2, Math.sin(a) * .9); });
}
export function updGrowFx(dt) { for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const k = f.t / f.dur; f.m.scale.set(1 + k * .6, 1 + k * 1.5, 1 + k * .6); f.m.material.opacity = (1 - k) * (f.op || .85); if (k >= 1) { scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); fx.splice(i, 1); } } }
export function towerXp(tw, amt) {
  if (!G.grow || !tw || tw.dead || !Number.isFinite(amt) || amt <= 0 || (tw.stars || 1) >= 3) return 0;
  const old = tw.stars || 1; tw.xp = Math.min(XP_NEED[2], (tw.xp || 0) + amt); tw.stars = starsFor(tw.xp);
  if (tw.stars > old) { recalc(tw); redecorate(tw); Snd.play('levelUp', { pos: tw.m.g.position }); ringFx(tw.m.g.position, 3, 0xffd23a, .6); }
  else updXpBar(tw);
  tw.branchPending = towerSpecializable(tw, G.practiceSandbox); if (G.sel === tw) refreshHud(); return tw.stars - old;
}
export function redecorate(tw) { if (!tw.m) return; const ry = tw.m.head.rotation.y; scene.remove(tw.m.g); disposeOwned(tw.m.g); tw.m = tw.rebuild(); tw.m.head.rotation.y = ry; scene.add(tw.m.g); decorate(tw); }
export function chooseBranch(tw, key) {
  if (!towerSpecializable(tw, G.practiceSandbox) || !BRANCH[tw.type][key]) return false; tw.branch = key; tw.branchPending = false; tw.shots = 0; recalc(tw); redecorate(tw); tw.pop = 0;
  const B = BRANCH[tw.type][key], p = tw.m.g.position, c = new THREE.Color(B.c).getHex();
  const pil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 12, 24, 1, true), add(0, c, .9)); pil.position.set(p.x, 6, p.z); scene.add(pil); fx.push({ m: pil, t: 0, dur: 1.1 });
  emit(PB, p.x, 2.5, p.z, 30, c, 6, 1.1, 0, 1.5); emit(P, p.x, 1.2, p.z, 120, c, 9, 1.2, -4, 2); ringFx(p, 5, c, .8); setTimeout(() => ringFx(p, 3.5, 0xffffff, .5), 150);
  G.shake = Math.max(G.shake, .4); Snd.play('meteorCast', { pos: p, force: true }); Snd.play('levelUp', { pos: p, force: true, delay: .15 });
  banner(`${B.icon} ${TOWERS[tw.type].n} → ${B.n}!`, B.c, 1600); refreshHud(); return true;
}
