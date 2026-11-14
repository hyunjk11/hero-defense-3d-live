// Chapter-five attacks: fixed landing points, interruptible healing and a visible boss phase change.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { tileX, tileZ, toTile, inGrid } from '../core/grid.js';
import { scene } from '../render/scene.js';
import { toon, mk, shareGeo, disposeOwned } from '../render/toon.js';
import { emit, P, ringFx, dmgText } from '../render/vfx.js';
import { Snd } from '../audio/audio.js';
import { banner } from '../ui/hud.js';

const acid = 0xc6d54a, healing = 0x5be3bc;
const ringG = shareGeo(new THREE.RingGeometry(.92, 1, 36)), discG = shareGeo(new THREE.CircleGeometry(1, 32));
const ballG = shareGeo(new THREE.SphereGeometry(.18, 12, 8));
let hooks;
export const initSwamp = h => { hooks = h; };
const shots = [], pools = [];
const heroes = () => (G.heroes?.length ? G.heroes : G.hero ? [G.hero] : []).filter(h => h.dead <= 0);
const live = e => !e.dead && e.dying === undefined;
const count = key => { G.stats[key] = (G.stats[key] || 0) + 1; };
const remove = object => { scene.remove(object); disposeOwned(object); };
function marker(p, radius, color, opacity = .13) {
  const group = new THREE.Group(); group.position.set(p.x, .07, p.z); group.scale.setScalar(radius);
  for (const [geometry, alpha] of [[discG, opacity], [ringG, .85]]) {
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; group.add(m);
  }
  scene.add(group); return group;
}
function targets(e, S) {
  const p = e.g.position, candidates = G.towers.filter(t => !t.dead).map(t => new THREE.Vector3(tileX(t.c), 0, tileZ(t.r)));
  for (const h of heroes()) candidates.push(h.g.position.clone().setY(0));
  candidates.sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p));
  const out = [], n = S.n + (e.swampRuptured ? 1 : 0);
  for (const q of candidates) if (q.distanceToSquared(p) <= S.range ** 2 && out.every(v => v.distanceToSquared(q) > S.radius ** 2)) { out.push(q); if (out.length >= n) break; }
  return out;
}
function cancel(e) {
  const c = e.swampCast; if (!c) return;
  for (const mark of c.marks) remove(mark);
  e.swampCast = null; e.castT = 0;
}
export function swampKilled(e) { cancel(e); }
export function swampTick(e, dt) {
  const S = e.E.swamp;
  if (!S) return false;
  const p = e.g.position;
  e.swampCd ??= S.first;
  if (e.swampCast) {
    const c = e.swampCast;
    if (c.kind === 'mend' && c.hp - e.hp >= e.max * S.interrupt) {
      cancel(e); e.swampCd = S.every * .6; count('swampInterrupts');
      dmgText(p.clone().setY(e.E.h + .4), '치유 중단', '#8de7cd'); return false;
    }
    c.t -= dt; e.castT = Math.max(0, c.t);
    const f = Math.max(0, 1 - c.t / c.windup);
    for (const m of c.marks) { m.children[0].material.opacity = .1 + .17 * f; m.children[1].scale.setScalar(1.18 - .18 * f); }
    if (c.t <= 0) {
      if (c.kind === 'mend') {
        for (const o of G.enemies.filter(live)) if (o !== e && o.g.position.distanceToSquared(p) <= S.radius ** 2) {
          const healed = Math.min(o.max - o.hp, o.max * S.heal * (o.E.boss ? (S.bossHeal ?? 1) : 1)); if (healed <= 0) continue; o.hp += healed;
          G.stats.swampHealed = (G.stats.swampHealed || 0) + healed;
          emit(P, o.g.position.x, o.E.h * .5, o.g.position.z, 7, healing, 2, .6, 2, .6);
        }
        count('swampHeals'); ringFx(p, S.radius, healing, .5); Snd.play('magic', { pos: p, rate: .8 });
      } else if (c.kind === 'rupture') {
        e.swampRuptured = true; e.armor = S.rupture.armor; count('swampRuptures');
        for (let i = 0; i < S.rupture.n; i++) {
          const a = i / S.rupture.n * Math.PI * 2, q = p.clone().add(new THREE.Vector3(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1));
          const tile = toTile(q.x, q.z); if (!inGrid(...tile)) q.copy(p);
          const o = hooks.spawnEnemy(S.rupture.type, e.max / e.E.hp, { x: q.x, z: q.z, tile: inGrid(...tile) ? tile : e.tile.slice() }); o.stunT = .5;
        }
        emit(P, p.x, e.E.h * .55, p.z, 38, acid, 6, .9, -2, 1.4); banner('역병의 심장 노출', '#dfdf7a', 1800); Snd.roar(p);
      } else {
        for (const q of c.targets) {
          const from = p.clone().setY(e.E.fly ? 3 : e.E.h * .6), m = mk(ballG, toon(acid, { emissive: 0x526d18 }), ...from.toArray(), scene, 0);
          m.scale.setScalar(e.E.boss ? 2 : 1.3); shots.push({ from, q, m, S, t: 0, duration: .65, mark: marker(q, S.radius, acid) });
        }
        count('swampSpits'); Snd.play('digSoft', { pos: p, rate: .8 });
      }
      cancel(e); e.swampCd = S.every * (e.swampRuptured ? S.rupture.cooldown : 1);
    }
    return true;
  }
  if (e.cast || e.stunT > 0) return false;
  if (S.rupture && !e.swampRuptured && e.hp <= e.max * S.rupture.at) {
    e.swampCast = { kind: 'rupture', t: 1.8, windup: 1.8, marks: [marker(p, 3.2, acid)] };
    e.castT = 1.8; return true;
  }
  e.swampCd -= dt; if (e.swampCd > 0) return false;
  const pts = S.kind === 'mend' ? [] : targets(e, S);
  if (S.kind === 'mend' ? !G.enemies.some(o => o !== e && live(o) && o.hp < o.max * .9 && o.g.position.distanceToSquared(p) <= S.radius ** 2) : !pts.length) { e.swampCd = .6; return false; }
  e.swampCast = { kind: S.kind, t: S.windup, windup: S.windup, hp: e.hp, targets: pts,
    marks: S.kind === 'mend' ? [marker(p, S.radius, healing)] : pts.map(q => marker(q, S.radius, acid)) };
  e.castT = S.windup; count('swampWarnings'); return true;
}
export function updateSwamp(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const o = shots[i]; o.t += dt; const f = Math.min(1, o.t / o.duration);
    o.m.position.lerpVectors(o.from, o.q, f); o.m.position.y += Math.sin(f * Math.PI) * 2;
    if (f < 1) continue;
    shots.splice(i, 1); remove(o.m); remove(o.mark);
    const m = marker(o.q, o.S.radius, acid, .34); m.children[1].material.color.setHex(0x7d9c3a);
    pools.push({ q: o.q, S: o.S, m, remaining: o.S.duration, acc: 0 }); count('swampPools');
    emit(P, o.q.x, .2, o.q.z, 12, acid, 3, .5, 2, .7);
  }
  for (let i = pools.length - 1; i >= 0; i--) {
    const o = pools[i], elapsed = Math.min(dt, Math.max(0, o.remaining)); o.remaining -= dt; o.acc += elapsed;
    o.m.children[0].material.opacity = Math.min(1, o.remaining * 2) * (.27 + Math.sin(G.t * 3) * .045);
    while (o.acc >= .5 - 1e-8) { o.acc -= .5;
      for (const tw of G.towers) if (!tw.dead && Math.hypot(tileX(tw.c) - o.q.x, tileZ(tw.r) - o.q.z) <= o.S.radius) { hooks.damageTower(tw, o.S.towerDps * .5, { kind: 'poison' }); count('swampTowerHits'); }
      for (const h of heroes()) if (Math.hypot(h.g.position.x - o.q.x, h.g.position.z - o.q.z) <= o.S.radius) { G.heroDamage(o.S.heroDps * .5, h); count('swampHeroHits'); }
    }
    if (o.remaining <= 0) { remove(o.m); pools.splice(i, 1); }
  }
}
export function clearSwamp() {
  for (const e of G.enemies) cancel(e);
  for (const o of shots) { remove(o.m); remove(o.mark); }
  for (const o of pools) remove(o.m);
  shots.length = pools.length = 0;
}
export const swampEffects = () => ({ shots: shots.length, pools: pools.length, casting: G.enemies.filter(e => e.swampCast).length });
