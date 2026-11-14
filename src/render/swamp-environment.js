import * as THREE from 'three';
import { scene } from './scene.js';
import { toon, mk, shareGeo } from './toon.js';
import { GW, GH, STAGE } from '../core/grid.js';
const lamps = [];
export function swampDeco() {
  if (STAGE?.ch !== 5) return;
  const group = new THREE.Group(); group.name = 'swamp-shore'; scene.add(group);
  const water = toon(0x2f665b, { transparent: true, opacity: .78 }), leaf = toon(0x547f51), reed = toon(0xa5b57a), bark = toon(0x65503b);
  const disk = shareGeo(new THREE.CircleGeometry(1, 18)), stem = shareGeo(new THREE.CylinderGeometry(.035, .05, 1, 5)), bud = shareGeo(new THREE.SphereGeometry(.12, 8, 6));
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1, x = side * (GW + 3 + (i % 3) * 1.4), z = (i / 18 - .5) * GH * 4;
    const pool = mk(disk, water, x, -.75, z, group, 0); pool.rotation.x = -Math.PI / 2; pool.scale.set(4.8, 3, 1);
    const pad = mk(disk, leaf, x + .7, -.69, z - .7, group, 0); pad.rotation.x = -Math.PI / 2; pad.scale.set(.8, .65, 1);
    for (let j = 0; j < 4; j++) {
      const xx = x + Math.sin(j * 2.1 + i) * 2, zz = z + Math.cos(j * 2.1 + i) * 1.2;
      const stalk = mk(stem, reed, xx, -.1 + j * .06, zz, group, 0); stalk.scale.y = 1.3 + j * .15; stalk.rotation.z = Math.sin(i + j) * .13;
      const cat = mk(bud, bark, xx, .6 + j * .16, zz, group, 0); cat.scale.y = 2.5;
    }
    const m = toon(0xc4e582, { emissive: 0x70bc5a, emissiveIntensity: 1.5 });
    const firefly = mk(bud, m, x, 1.2, z, group, 0); firefly.scale.setScalar(.4); lamps.push({ m: firefly, x, z, phase: i * 1.7 });
  }
}
export function updateSwampDeco(time) { for (const o of lamps) { o.m.position.set(o.x + Math.sin(time * .6 + o.phase), .8 + Math.sin(time * .9 + o.phase) * .5, o.z + Math.cos(time * .4 + o.phase)); } }
