import { batchTowerBodies } from './tower-body-batch.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mk, toon, shareGeo, shareMat } from './toon.js';

// Paid levels change the structure; XP stars and specialization attach in growth.js.
// Geometry and palette are immutable/shared across rebuilds and disposal.
const palette = {
  stone: 0xe8dfc8, darkStone: 0x9293a6, wood: 0xb98148, darkWood: 0x624230,
  iron: 0x404959, steel: 0x8297ad, dark: 0x202837, blue: 0x397fca,
  gold: 0xedba50, violet: 0x70569f, lightViolet: 0xb09ad8,
};
const M = Object.fromEntries(Object.entries(palette).map(([k, c]) => [k, shareMat(toon(c))]));
M.crystal = shareMat(toon(0x69d9e2, { emissive: 0x178eaa, emissiveIntensity: .55 }));
M.ember = shareMat(toon(0xffaa4d, { emissive: 0xc94f18, emissiveIntensity: .45 }));
const geometry = new Map();
function geo(kind, args) {
  const key = kind + ':' + args.join(',');
  if (!geometry.has(key)) geometry.set(key, shareGeo(new THREE[kind](...args)));
  return geometry.get(key);
}
const box = (p, w, h, d, x, y, z, mat) => mk(geo('BoxGeometry', [w, h, d]), M[mat], x, y, z, p, .025);
const cyl = (p, rt, rb, h, x, y, z, mat, sides = 8) => mk(geo('CylinderGeometry', [rt, rb, h, sides]), M[mat], x, y, z, p, .025);
const ring = (p, r, tube, x, y, z, mat) => mk(geo('TorusGeometry', [r, tube, 6, 24]), M[mat], x, y, z, p, .015);
function crystal(p, radius, height, x, y, z, mat = 'crystal') {
  const c = mk(geo('OctahedronGeometry', [radius, 0]), M[mat], x, y, z, p, .02); c.scale.y = height; return c;
}
function beam(p, a, b, width, mat) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), mid = start.clone().add(end).multiplyScalar(.5);
  const o = box(p, width, start.distanceTo(end), width, mid.x, mid.y, mid.z, mat);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return o;
}
function foundation(g, level, type) {
  const key = 'base';
  if (!geometry.has(key)) geometry.set(key, shareGeo(new RoundedBoxGeometry(1.75, .35, 1.75, 2, .1)));
  mk(geometry.get(key), M.darkStone, 0, .175, 0, g);
  if (level >= 4) for (const x of [-.7, .7]) for (const z of [-.7, .7])
    box(g, .35, .3, .35, x, .48, z, level === 5 ? 'gold' : 'steel');
  for (let i = 0; i < level; i++) box(g, .13, .13, .04, (i - (level - 1) / 2) * .24, .18, .9, 'gold');
  g.name = `tower-${type}-lv${level}`;
  g.userData.towerLevel = level;
}
function arrowTower(g, head, muzzle, anim, level) {
  const deck = [0, 1.75, 2.05, 2.4, 2.7, 3][level];
  if (level <= 2) {
    for (const x of [-.52, .52]) for (const z of [-.52, .52]) box(g, .19, deck - .35, .19, x, (deck + .35) / 2, z, 'darkWood');
    for (const z of [-.53, .53]) {
      beam(g, [-.52, .5, z], [.52, deck - .2, z], .13, 'wood');
      beam(g, [.52, .5, z], [-.52, deck - .2, z], .13, 'wood');
    }
    if (level === 2) { cyl(g, .54, .66, .65, 0, .68, 0, 'stone'); box(g, 1.35, .13, 1.35, 0, 1.15, 0, 'steel'); }
  } else {
    cyl(g, .62, .73, deck - .35, 0, (deck + .35) / 2, 0, 'stone');
    cyl(g, .75, .75, .16, 0, 1.05, 0, 'darkStone');
    if (level >= 4) for (const x of [-.62, .62]) box(g, .25, deck - .55, .6, x, (deck + .55) / 2, 0, 'darkStone');
    box(g, .4, .65, .08, 0, deck - .62, .67, 'blue');
    if (level === 5) {
      cyl(g, .76, .76, .13, 0, 1.85, 0, 'gold');
      for (const x of [-.69, .69]) for (const z of [-.69, .69]) {
        cyl(g, .14, .17, .75, x, deck + .15, z, 'stone', 6);
        mk(geo('ConeGeometry', [.23, .45, 4]), M.blue, x, deck + .75, z, g, .025);
      }
    }
  }
  box(g, 1.65, .22, 1.5, 0, deck, 0, level >= 4 ? 'gold' : 'wood');
  for (const x of [-.7, .7]) {
    box(g, .16, .43, 1.25, x, deck + .29, 0, level >= 3 ? 'stone' : 'wood');
    if (level >= 3) for (const z of [-.5, .5]) box(g, .24, .22, .27, x, deck + .6, z, 'stone');
  }
  cyl(g, .22, .3, .38, 0, deck + .25, 0, 'iron');
  head.position.y = deck + .55;
  const length = .9 + level * .09, width = .55 + level * .08;
  box(head, .2 + level * .015, .18, length, 0, 0, .12, 'darkWood');
  for (const y of level >= 4 ? [0, .25] : [0]) {
    beam(head, [-width, y, .07], [-width * .6, y, .4], .1, level >= 3 ? 'steel' : 'wood');
    beam(head, [width, y, .07], [width * .6, y, .4], .1, level >= 3 ? 'steel' : 'wood');
    beam(head, [-width * .6, y, .4], [width * .6, y, .4], .1, level === 5 ? 'gold' : 'wood');
    beam(head, [-width, y, .07], [0, y, -.3], .025, 'stone'); beam(head, [width, y, .07], [0, y, -.3], .025, 'stone');
  }
  if (level >= 2) { box(head, .42, .23, .32, 0, -.08, -.3, 'iron'); cyl(head, .18, .18, .38, 0, -.1, -.3, 'gold').rotation.z = Math.PI / 2; }
  if (level === 5) { box(head, .32, .16, .55, 0, .35, -.2, 'blue'); crystal(head, .12, 1, 0, .49, -.2); }
  const tip = .12 + length / 2 + .15;
  beam(head, [0, .13, -.25], [0, .13, tip - .07], .045, 'stone');
  mk(geo('ConeGeometry', [.075, .22, 4]), M.steel, 0, .13, tip, head, .015).rotation.x = Math.PI / 2;
  muzzle.position.set(0, .13, tip + .11);
  if (level >= 3) {
    cyl(g, .025, .025, .75, -.68, deck + .98, -.62, 'iron', 5);
    const flag = new THREE.Group(); flag.position.set(-.68, deck + 1.12, -.62); g.add(flag);
    box(flag, .43, .29, .035, .21, 0, 0, level === 5 ? 'gold' : 'blue'); anim.flag = flag;
  }
}
function cannonTower(g, head, muzzle, anim, level) {
  const deck = [0, .72, .95, 1.2, 1.43, 1.65][level];
  cyl(g, .75, .88, deck - .35, 0, (deck + .35) / 2, 0, 'darkStone');
  cyl(g, .8, .8, .17, 0, deck, 0, level >= 4 ? 'gold' : 'steel');
  if (level >= 2) for (const x of [-.7, .7]) box(g, .26, .58, 1.05, x, deck - .13, 0, 'iron');
  if (level >= 4) for (const x of [-.72, .72]) for (const z of [-.62, .62]) {
    beam(g, [x * .55, deck, z * .55], [x, .42, z], .23, 'steel');
    box(g, .37, .19, .4, x, .43, z, 'iron');
  }
  head.position.y = deck + .5;
  box(head, 1.05, .55, .85, 0, 0, -.2, 'iron');
  if (level >= 2) for (const x of [-.62, .62]) {
    const shield = box(head, .19, .63, .86, x, 0, -.12, level === 5 ? 'gold' : 'steel'); shield.rotation.z = -Math.sign(x) * .15;
  }
  const barrelCount = level === 5 ? 3 : level >= 3 ? 2 : 1;
  const radius = barrelCount === 1 ? .23 : .18, length = .9 + level * .13;
  for (let i = 0; i < barrelCount; i++) {
    const x = (i - (barrelCount - 1) / 2) * .4, y = level === 5 && i === 1 ? .24 : .02;
    // Each bore faces local +Z, the same axis used by aim/recoil and projectiles.
    const barrel = cyl(head, radius, radius * 1.15, length, x, y, .25 + length / 2, 'iron', 12); barrel.rotation.x = Math.PI / 2;
    ring(head, radius, .045, x, y, .25 + length, level >= 4 ? 'gold' : 'steel');
    cyl(head, radius * .72, radius * .72, .02, x, y, .25 + length + .005, 'dark', 12).rotation.x = Math.PI / 2;
    if (level >= 4) ring(head, radius * 1.12, .035, x, y, .65, 'steel');
  }
  if (level >= 3) box(head, .62, .27, .45, 0, .39, -.3, 'steel');
  if (level >= 4) for (const x of [-.4, .4]) { cyl(head, .13, .17, .45, x, .43, -.52, 'iron'); cyl(head, .11, .11, .07, x, .69, -.52, 'ember'); }
  if (level === 5) { box(head, .45, .34, .35, 0, .65, -.3, 'gold'); crystal(head, .13, 1, 0, .91, -.3, 'ember'); }
  muzzle.position.set(0, level === 5 ? .24 : .02, .25 + length + .06);
}
function magicTower(g, head, muzzle, anim, level) {
  const top = [0, 1.5, 1.85, 2.15, 2.45, 2.7][level];
  cyl(g, .64, .8, .26, 0, .47, 0, 'violet', 6);
  if (level < 3) cyl(g, .31, .5, top - .6, 0, (top + .6) / 2, 0, 'violet', 6);
  else for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3, x = Math.cos(a) * .47, z = Math.sin(a) * .47;
    cyl(g, .18, .25, top - .6, x, (top + .6) / 2, z, 'violet', 5);
    cyl(g, .2, .2, .13, x, top - .35, z, level >= 4 ? 'gold' : 'lightViolet', 5);
  }
  cyl(g, .69, .5, .23, 0, top, 0, 'lightViolet', 6);
  if (level >= 2) for (const x of [-.67, .67]) {
    crystal(g, .2, 2, x, .94, 0); cyl(g, .24, .3, .18, x, .6, 0, 'gold', 6);
  }
  if (level >= 4) for (const x of [-.73, .73]) {
    beam(g, [x, top - .2, 0], [x * 1.12, top + .8, 0], .16, 'gold');
    beam(g, [x * 1.12, top + .8, 0], [x * .65, top + 1.24, 0], .12, 'gold');
  }
  head.position.y = top + .75; anim.baseY = head.position.y;
  anim.crys = crystal(head, .3 + level * .035, 1.7, 0, 0, 0);
  anim.rings = [];
  for (let k = 0; k < (level >= 5 ? 3 : level >= 3 ? 2 : 1); k++) {
    const r = ring(head, .57 + k * .13, .035, 0, 0, 0, k % 2 ? 'gold' : 'lightViolet');
    r.rotation.x = Math.PI / 2 + k * .85; anim.rings.push(r);
  }
  if (level === 5) for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3, x = Math.cos(a) * .66, z = Math.sin(a) * .66;
    crystal(g, .16, 2, x, top + 1.35, z); beam(g, [x, top, z], [x, top + 1.06, z], .12, 'gold');
  }
}
// Internal guardian key preserves purchased research. This is now a prism beam emitter.
function beamTower(g, head, muzzle, anim, level) {
  const top = 1.1 + level * .25;
  cyl(g, .62, .8, .3, 0, .5, 0, 'darkStone', 6);
  cyl(g, .35, .5, top - .6, 0, (top + .6) / 2, 0, 'violet', 6);
  for (const x of [-.52, .52]) {
    beam(g, [x, .55, 0], [x * .6, top, 0], .18, level >= 3 ? 'gold' : 'steel');
    if (level >= 2) crystal(g, .13, 1.7, x, .88, 0);
  }
  cyl(g, .63, .52, .2, 0, top, 0, level >= 4 ? 'gold' : 'steel');
  head.position.y = top + .48;
  // The forward optical axis is local +Z, shared by muzzle and targeting.
  box(head, .7, .46, .85, 0, 0, -.18, 'iron');
  anim.gem = crystal(head, .26 + level * .015, 1.1, 0, .18, -.22);
  const lensZ = .53 + level * .055, radius = .27 + level * .025;
  cyl(head, radius + .08, radius + .1, .32, 0, 0, lensZ - .16, 'steel', 12).rotation.x = Math.PI / 2;
  ring(head, radius, .065, 0, 0, lensZ, 'gold');
  cyl(head, radius * .83, radius * .83, .055, 0, 0, lensZ + .025, 'crystal', 12).rotation.x = Math.PI / 2;
  muzzle.position.set(0, 0, lensZ + .08);
  if (level >= 2) for (const x of [-.44, .44]) box(head, .13, .35, .8, x, 0, -.15, 'steel');
  if (level >= 3) {
    for (const x of [-.55, .55]) {
      beam(head, [x * .65, -.2, -.5], [x, .24, .16], .13, 'gold');
      crystal(head, .14, 1.5, x, .31, .16);
    }
    ring(head, .43, .035, 0, 0, lensZ - .16, 'lightViolet');
  }
  if (level >= 4) for (const z of [-.6, -.35, -.1]) box(head, .9, .065, .06, 0, -.26, z, 'gold');
  if (level === 5) {
    for (const x of [-.67, .67]) {
      beam(head, [x, -.12, -.45], [x, .4, .35], .16, 'gold');
      crystal(head, .2, 1.6, x, .51, .35);
    }
    ring(head, .55, .045, 0, 0, lensZ - .33, 'gold');
  }
}
export function towerModel(type, level) {
  if (!['arrow', 'cannon', 'magic', 'guardian'].includes(type) || !Number.isInteger(level) || level < 1 || level > 5) throw new Error('Invalid tower model');
  const g = new THREE.Group(), head = new THREE.Group(), muzzle = new THREE.Object3D(), anim = {};
  foundation(g, level, type);
  ({ arrow: arrowTower, cannon: cannonTower, magic: magicTower, guardian: beamTower })[type](g, head, muzzle, anim, level);
  head.name = 'aim-head'; muzzle.name = 'projectile-muzzle'; head.add(muzzle); g.add(head);
  const excludeMeshes = new Set([anim.crys, anim.gem, ...(anim.rings || [])].filter(Boolean));
  batchTowerBodies(g, { excludeMeshes, shareGeometry: shareGeo });
  return { g, head, muzzle, anim };
}
