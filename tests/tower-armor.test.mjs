// Actual installed hurt/projectile function bodies; rendering/audio are inert.
// No network, account, save, enemy AI, or browser storage is involved.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import * as Meter from '../src/combat/meter.js';
import { towerStats } from '../src/data/growth.js';
const read = f => fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
const enemy = read('monsters/enemy.js'), abilities = read('monsters/abilities.js'), projectile = read('combat/projectiles.js');
const between = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); return s.slice(i, j); };
const no = () => {}, numbers = [];
const G = { t: 0, stats: {}, enemies: [], projs: [], timers: [], dmTowers: [], mWho: null, mTw: null, mK: 0 };
const env = { G, THREE, DUNGEON: false, KILL_XP: 15, P: {}, PB: {},
  Snd: { play: no }, scene: { remove: no }, disposeOwned: no,
  emit: no, debris: no, ringFx: no, txt: no, bubble: no, st: () => G.stats,
  bump: k => G.stats[k] = (G.stats[k] || 0) + 1,
  dmgText: (_p, n) => { numbers.push(n); return null; },
  enemyAim: e => e.g.position.clone(), rand: () => 1,
  killEnemy: e => { e.dead = true; }, towerXp: (tw, d) => { tw.xp += d; },
  meterAdd: Meter.meterAdd, towerAdd: Meter.towerAdd,
  later: (t, fn) => G.timers.push({ t, fn }) };
vm.createContext(env);
vm.runInContext(
  between(abilities, 'function armorOf(', 'function reforge(') + '\n' +
  between(abilities, 'function absorbShield(', '// 죽음:') + '\n' +
  between(enemy, 'function shieldFactor(', 'function killEnemy(') + '\n' +
  between(projectile, 'function aoe(', '// 명중 콜백') + '\n' +
  between(projectile, 'function killProj(', '// 피해 미터:') + '\n' +
  between(projectile, 'function updProjs(', '\nexport {'), env);
function reset() { Object.assign(G, { t: 0, stats: {}, enemies: [], projs: [], timers: [], dmTowers: [], dmOther: Meter.newMeter(), mWho: null, mTw: null, mK: 0 }); numbers.length = 0; }
function target({ armor = 0, hp = 10000, crack = null, x = 0, z = 1.5 } = {}) {
  const g = new THREE.Object3D(); g.position.set(x, 0, z);
  const e = { g, m: {}, hp, max: hp, E: { h: 1, armor }, armor, dead: false };
  if (crack) { e.E.ab = { crack }; e.crackAcc = 0; }
  return e;
}
function fire(kind, dmg, es, ap = false) {
  const tw = { xp: 0 }, m = new THREE.Object3D(); G.enemies = es;
  G.projs = [{ kind, m, target: es[0], dmg, ap, tw, spd: 60, left: 20, hit: new Set(), dir: new THREE.Vector3(0, 0, 1) }];
  // Pierce speed 30 advances to z=1.5 at dt=.05.
  if (kind === 'pierce') G.projs[0].spd = 30;
  const before = es.map(e => e.hp); env.updProjs(.05);
  return { loss: es.map((e, i) => before[i] - e.hp), tw };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
let failures = 0, passed = 0;
function test(name, fn) { reset(); try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failures++; console.error('FAIL ' + name + ': ' + e.message); } }
for (const kind of ['pierce', 'arrow']) {
  const dmg = kind === 'pierce' ? 861.3 : 313.2;
  test(kind + ': fixed armor bypass and normal damage', () => {
    for (const armor of [0, .5, .6]) {
      near(fire(kind, dmg, [target({ armor })], true).loss[0], dmg);
      if (kind === 'arrow') near(fire(kind, dmg, [target({ armor })]).loss[0], dmg * (1 - armor));
    }
  });
  for (const [name, armor, after] of [['frost', .6, 0], ['swamp', .5, .08]]) {
    test(kind + ': before, breaking, after armor (' + name + ')', () => {
      const e = target({ armor, crack: { armor, after, at: .3 } });
      for (let i = 0; i < 12; i++) near(fire(kind, dmg, [e], true).loss[0], dmg);
      assert.equal(e.cracked, true); near(e.armor, after);
    });
  }
}
test('ordinary breaking hit keeps its existing post-break armor behavior', () => {
  const e = target({ armor: .6, crack: { armor: .6, after: 0, at: .3 } });
  for (const expected of [400, 400, 1000, 1000]) near(fire('arrow', 1000, [e]).loss[0], expected);
});
test('armor bypass uses its actual incoming damage for crack accumulation', () => {
  const e = target({ armor: .6, crack: { armor: .6, after: 0, at: .3 } });
  fire('pierce', 861.3, [e], true); near(e.crackAcc, 861.3); assert.equal(!!e.cracked, false);
});
test('piercing multiple targets records actual damage once each', () => {
  const es = [target(), target({ x: .5, armor: .5 }), target({ x: -.5, armor: .6 })];
  const { loss, tw } = fire('pierce', 200, es, true); loss.forEach(v => near(v, 200));
  near(tw.dmT, 600); near(G.dmOther.tot, 600); assert.equal(G.dmOther.hits, 3);
});
test('ordinary splash retains per-target armor and its total', () => {
  G.enemies = [target(), target({ armor: .5 }), target({ armor: .6 })];
  G.mTw = { xp: 0 }; env.aoe(new THREE.Vector3(0, 0, 1.5), 2, 100);
  [100, 50, 40].forEach((v, i) => near(10000 - G.enemies[i].hp, v)); near(G.dmOther.tot, 190);
});
test('repeated ordinary damage keeps armor on every tick', () => {
  const e = target({ armor: .5 }); for (let i = 0; i < 10; i++) env.hurt(e, 10);
  near(10000 - e.hp, 50); near(G.dmOther.tot, 50);
});
test('energy shield absorbs post-armor damage before HP or meter', () => {
  const e = target({ armor: .5 }); e.shield = 50; env.hurt(e, 100);
  near(e.hp, 10000); near(G.dmOther.tot, 0); env.hurt(e, 100); near(G.dmOther.tot, 50);
});
test('bypass does not bypass the direction shield', () => {
  const e = target({ armor: .5 }); e.g.rotation.y = Math.PI;
  e.E.shieldDef = { arc: 80, side: 130, front: .8, sideRed: .2, back: -.2, melee: .2 };
  near(fire('arrow', 100, [e], true).loss[0], 20);
});
test('overkill is displayed but not included in damage totals', () => {
  const e = target({ hp: 7 }); const r = fire('pierce', 861.3, [e], true);
  near(r.tw.dmT, 7); near(G.dmOther.tot, 7); near(numbers[0], 861.3);
});
test('pierce has no splash stat; basic and blast preserve their radii', () => {
  for (const lv of [3, 4, 5]) {
    assert.equal(towerStats('cannon', lv, 'pierce', null, 3).splash, undefined);
    const base = towerStats('cannon', lv, null, null, 3).splash;
    near(towerStats('cannon', lv, 'blast', null, 3).splash, base * 1.6);
  }
});
console.log(JSON.stringify({ passed, failures })); if (failures) process.exitCode = 1;
