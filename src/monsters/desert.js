import * as THREE from 'three';
import { G } from '../core/state.js';
import { T, tileX, tileZ, toTile, inGrid, isBlock } from '../core/grid.js';
import { scene } from '../render/scene.js';
import { shareGeo, disposeOwned } from '../render/toon.js';
import { P, emit, ringFx, dmgText } from '../render/vfx.js';
import { Snd } from '../audio/audio.js';
import { banner } from '../ui/hud.js';
import { inDesertCircle, inDesertLane } from './desert-geometry.js';

const sand = 0xe8b65e, heat = 0xff7950;
const discGeo = shareGeo(new THREE.CircleGeometry(1, 32)), ringGeo = shareGeo(new THREE.RingGeometry(.93, 1, 32));
const planeGeo = shareGeo(new THREE.PlaneGeometry(1, 1));
let hooks; const fields = [];
export const initDesert = h => { hooks = h; };
const heroes = () => (G.heroes?.length ? G.heroes : G.hero ? [G.hero] : []).filter(h => h.dead <= 0);
const count = key => { G.stats[key] = (G.stats[key] || 0) + 1; };
const remove = m => { m.removeFromParent(); disposeOwned(m); };
const material = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
function circle(p, radius, color = sand) {
  const g = new THREE.Group(); g.position.set(p.x, .12, p.z); g.scale.setScalar(radius);
  for (const [geo, alpha] of [[discGeo, .15], [ringGeo, .85]]) { const m = new THREE.Mesh(geo, material(color, alpha)); m.rotation.x = -Math.PI / 2; g.add(m); }
  scene.add(g); return g;
}
function lane(from, to, width) {
  const g = new THREE.Group(), length = Math.hypot(to.x - from.x, to.z - from.z);
  g.position.copy(from).lerp(to, .5); g.position.y = .14; g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  const fill = new THREE.Mesh(planeGeo, material(heat, .18)); fill.rotation.x = -Math.PI / 2; fill.scale.set(width, length, 1); g.add(fill);
  for (const x of [-width / 2, width / 2]) { const edge = new THREE.Mesh(planeGeo, material(sand, .9)); edge.rotation.x = -Math.PI / 2; edge.position.x = x; edge.scale.set(.06, length, 1); g.add(edge); }
  scene.add(g); return g;
}
function candidates(e, range) {
  const p = e.g.position;
  return [...G.towers.filter(t => !t.dead).map(t => new THREE.Vector3(tileX(t.c), 0, tileZ(t.r))), ...heroes().map(h => h.g.position.clone().setY(0))]
    .filter(q => Math.hypot(q.x - p.x, q.z - p.z) <= range).sort((a, b) => a.distanceToSquared(p) - b.distanceToSquared(p));
}
function begin(e, kind, S, targets = []) {
  const from = e.g.position.clone().setY(0), marks = [];
  let end;
  if (kind === 'beam' || kind === 'cleave') {
    const dir = targets[0].clone().sub(from); if (dir.lengthSq() < .01) dir.set(0, 0, 1);
    end = from.clone().addScaledVector(dir.normalize(), S.range); marks.push(lane(from, end, S.width));
    e.g.rotation.y = Math.atan2(dir.x, dir.z);
  } else for (const p of targets) marks.push(circle(p, S.radius || 1.2, kind === 'awaken' ? heat : sand));
  e.desertCast = { kind, S, from, end, targets, marks, hp: e.hp, t: S.windup, duration: S.windup };
  e.castT = S.windup; count('desertWarnings');
}
function cancel(e) {
  if (e.desertCast) e.desertCast.marks.forEach(remove);
  e.desertCast = null; e.castT = 0;
  if (e.desertTravel) { remove(e.desertTravel.mark); e.desertTravel = null; e.immT = 0; }
}
export const desertKilled = e => cancel(e);
function hitArea(c, S) {
  const inside = p => c.end ? inDesertLane(p, c.from, c.end, S.width) : c.targets.some(q => inDesertCircle(p, q, S.radius));
  for (const tw of [...G.towers]) if (!tw.dead && inside({ x: tileX(tw.c), z: tileZ(tw.r) })) { hooks.damageTower(tw, S.tower); count('desertTowerHits'); }
  for (const h of heroes()) if (inside(h.g.position)) { G.heroDamage(S.hero, h); count('desertHeroHits'); }
}
function finish(e, c) {
  const S = c.S;
  if (c.kind === 'burrow') {
    const tile = e.desertTile, t = G.tiles[tile[0]]?.[tile[1]];
    // A structure built during the warning blocks the burrow. Never pass a core or bedrock.
    if (!t || t.tower || t.bar || [T.BEDROCK, T.CORE, T.SPAWN].includes(t.t)) return;
    if (isBlock(t.t)) { hooks.damageTile(t, t.hp + 1); count('desertTunnelTiles'); }
    const to = new THREE.Vector3(tileX(tile[0]), 0, tileZ(tile[1]));
    e.desertTravel = { from: e.g.position.clone(), to, tile: tile.slice(), t: 0, duration: S.travel, mark: circle(e.g.position, .65) };
    e.immT = G.t + S.travel + .01; count('desertBurrows'); return;
  }
  if (c.kind === 'awaken') {
    const phase = e.E.desert.phase; e.desertAwakened = true; e.armor = phase.armor; count('desertAwakenings');
    for (let i = 0; i < phase.summons; i++) {
      const a = i * Math.PI * 2 / phase.summons, p = e.g.position, x = p.x + Math.sin(a) * .8, z = p.z + Math.cos(a) * .8, tile = toTile(x, z);
      hooks.spawnEnemy(phase.type, e.max / e.E.hp, { x, z, tile: inGrid(...tile) ? tile : e.tile.slice() }).stunT = .5;
    }
    emit(P, e.g.position.x, 2, e.g.position.z, 45, sand, 6, .7, -2, 1); banner('아크셰트 · 태양핵 개방', '#ffd181', 1600); Snd.roar(e.g.position); return;
  }
  hitArea(c, S); e.desertStrikeT = .4;
  if (c.kind === 'quicksand') {
    for (const q of c.targets) fields.push({ q, radius: S.radius, slow: S.slow, left: S.duration, m: circle(q, S.radius) });
    count('desertSandfields');
  } else if (c.kind === 'cleave') { e.guardOpenT = S.exposed; e.desertRecover = S.exposed; count('desertShieldOpenings'); }
  else if (c.kind === 'beam') count('desertBeams');
  else if (c.kind === 'dive') count('desertDives');
  else count('desertStings');
  if (c.end) for (let i = 0; i <= 12; i++) { const p = c.from.clone().lerp(c.end, i / 12); emit(P, p.x, .5, p.z, 3, sand, 2, .4, 2, .5); }
  else for (const q of c.targets) { emit(P, q.x, .4, q.z, 15, sand, 4, .5, 2, .7); ringFx(q, S.radius, heat, .35); }
  Snd.play(c.kind === 'beam' ? 'zap' : 'breakRock', { pos: e.g.position, vol: .65 });
}
export function desertTick(e, dt) {
  const S = e.E.desert; if (!S) return false;
  e.desertCd ??= S.first;
  e.guardOpenT = Math.max(0, (e.guardOpenT || 0) - dt); e.desertStrikeT = Math.max(0, (e.desertStrikeT || 0) - dt);
  if (e.desertTravel) {
    const b = e.desertTravel; b.t += dt; const k = Math.min(1, b.t / b.duration);
    e.g.position.lerpVectors(b.from, b.to, k); b.mark.position.set(e.g.position.x, .15, e.g.position.z);
    if (k >= 1) { e.tile = b.tile; e.next = null; e.ckP = null; e.immT = 0; e.desertRecover = S.exposed; remove(b.mark); e.desertTravel = null; emit(P, e.g.position.x, .3, e.g.position.z, 15, sand, 3, .5, 2, .6); }
    return true;
  }
  if (e.desertCast) {
    const c = e.desertCast;
    if (S.interrupt && c.hp - e.hp >= e.max * S.interrupt) {
      cancel(e); e.desertCd = S.every * .6; count('desertInterrupts'); dmgText(e.g.position.clone().setY(e.E.h + .3), '시전 중단', '#ffe2a0'); return false;
    }
    c.t -= dt; e.castT = Math.max(0, c.t);
    c.marks.forEach(m => { m.children[0].material.opacity = .15 + .2 * (1 - Math.max(0, c.t / c.duration)); });
    if (c.t <= 0) { c.marks.forEach(remove); e.desertCast = null; e.castT = 0; finish(e, c); e.desertCd = S.every * (e.desertAwakened ? S.phase.everyK : 1); }
    return true;
  }
  if (e.desertRecover > 0) { e.desertRecover = Math.max(0, e.desertRecover - dt); return true; }
  if (S.phase && !e.desertAwakened && e.hp <= e.max * S.phase.at) { begin(e, 'awaken', { windup: S.phase.windup, radius: 2.8 }, [e.g.position.clone().setY(0)]); return true; }
  e.desertCd -= dt; if (e.desertCd > 0 || e.cast || e.stunT > 0) return false;
  if (S.kind === 'burrow') {
    const tile = hooks.nextStep(e.tile[0], e.tile[1], e.profile), t = tile && G.tiles[tile[0]]?.[tile[1]];
    if (!t || t.tower || t.bar || [T.BEDROCK, T.CORE, T.SPAWN].includes(t.t)) { e.desertCd = .7; return false; }
    e.desertTile = tile; begin(e, 'burrow', S, [new THREE.Vector3(tileX(tile[0]), 0, tileZ(tile[1]))]); return true;
  }
  const options = candidates(e, S.range); if (!options.length) { e.desertCd = .6; return false; }
  const kind = S.kind === 'monarch' ? ((e.desertPattern = (e.desertPattern || 0) + 1) % 2 ? 'beam' : 'sting') : S.kind;
  const pts = []; for (const p of options) if (pts.every(q => p.distanceToSquared(q) > (S.radius || 1) ** 2)) { pts.push(p); if (pts.length >= (kind === 'sting' ? S.n + (e.desertAwakened ? 1 : 0) : 1)) break; }
  begin(e, kind, S, pts); return true;
}
export function updateDesert(dt) {
  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i]; f.left -= dt;
    if (f.left <= 0) { remove(f.m); fields.splice(i, 1); continue; }
    f.m.rotation.y += dt * .6; f.m.children[0].material.opacity = .18 + Math.sin(G.t * 3) * .03;
    for (const tw of G.towers) if (!tw.dead && inDesertCircle({ x: tileX(tw.c), z: tileZ(tw.r) }, f.q, f.radius)) { tw.sandUntil = G.t + Math.min(.2, f.left); tw.sandK = f.slow; }
  }
}
export function clearDesert() { G.enemies.forEach(cancel); fields.forEach(f => remove(f.m)); fields.length = 0; for (const tw of G.towers) tw.sandUntil = 0; }
export const desertEffects = () => ({ fields: fields.length, casting: G.enemies.filter(e => e.desertCast).length, burrowing: G.enemies.filter(e => e.desertTravel).length });
