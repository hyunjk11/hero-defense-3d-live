import * as THREE from 'three';
import { mk, toon, glow, shareGeo, shareMat } from './toon.js';
// Immutable tower shell assets: five paid levels and one piercing type.
// Mesh transforms remain per-shot; disposeOwned must preserve these shared assets.
const balls = new Map();
let piercing, ballMaterial, pierceMaterial;
export function towerShell(kind, level, from, parent) {
  let geometry, material;
  if (kind === 'pierce') {
    geometry = piercing ||= shareGeo(new THREE.CapsuleGeometry(.14, .7, 4, 8));
    material = pierceMaterial ||= shareMat(glow(0x9ad8ff, 2.2));
  } else {
    if (!balls.has(level)) balls.set(level, shareGeo(new THREE.SphereGeometry(.22 + level * .04, 12, 8)));
    geometry = balls.get(level); material = ballMaterial ||= shareMat(toon(0x26282e));
  }
  return mk(geometry, material, from.x, from.y, from.z, parent, .02);
}
