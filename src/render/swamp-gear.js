import * as THREE from 'three';
import { mk, shareGeo, toon, disposeOwned } from './toon.js';
const ball = shareGeo(new THREE.SphereGeometry(1, 12, 8)), fang = shareGeo(new THREE.ConeGeometry(1, 1, 6));
const ring = shareGeo(new THREE.TorusGeometry(.14, .025, 5, 16));
// Bone-mounted set ornaments retain the heroes' existing animated weapons and attack origins.
export function updateSwampGear(ch, items) {
  const selected = items.filter(it => it.c === 5), signature = selected.map(it => `${it.s}:${it.g}:${it.id}`).join('|');
  if (ch.swampGearSignature === signature) return;
  for (const node of ch.swampGearNodes || []) { node.removeFromParent(); disposeOwned(node); }
  ch.mats = ch.mats.filter(m => !m.userData.swampGear);
  ch.swampGearNodes = []; ch.swampGearSignature = signature;
  if (!selected.length) return;
  const mat = (color, emission = 0) => { const m = toon(color, { emissive: emission, emissiveIntensity: .65 }); m.userData.e = m.emissive.clone(); m.userData.swampGear = true; ch.mats.push(m); return m; };
  const moss = mat(0x859759), bone = mat(0xd2d8a1), jewel = mat(0xa4d978, 0x356b2c);
  const mount = (names, offset) => {
    const target = names.map(n => ch.root.getObjectByName(n)).find(Boolean); if (!target) return null;
    const g = new THREE.Group(); ch.root.updateMatrixWorld(true); const scale = target.getWorldScale(new THREE.Vector3()).x;
    const q = target.getWorldQuaternion(new THREE.Quaternion()).invert(); g.quaternion.copy(q); g.scale.setScalar(.65 / scale);
    g.position.set(...offset).applyQuaternion(q).multiplyScalar(1 / scale); target.add(g); ch.swampGearNodes.push(g); return g;
  };
  const oval = (g, m, x, y, z, sx, sy, sz, geometry = ball) => { const p = mk(geometry, m, x, y, z, g, .012); p.scale.set(sx, sy, sz); return p; };
  for (const it of selected) {
    if (it.s === 'armor') {
      for (const [side, names] of [[-1, ['LeftArm', 'LeftShoulder']], [1, ['RightArm', 'RightShoulder']]]) {
        const g = mount(names, [side * .03, .03, 0]); if (!g) continue;
        g.scale.multiplyScalar(.8);
        oval(g, moss, 0, .03, 0, .26, .16, .3); oval(g, bone, side * .1, .12, .08, .17, .08, .23);
        if (it.g >= 2) for (let i = 0; i < 3; i++) { const p = oval(g, bone, side * .18, .18, -.12 + i * .12, .045, .2, .045, fang); p.rotation.z = -side * .45; }
      }
    } else if (it.s === 'acc') {
      const g = mount(['Spine02', 'Spine2', 'Spine01', 'Spine1', 'Spine', 'Chest', 'chest'], [0, .1, .22]); if (!g) continue;
      const chain = mk(ring, bone, 0, .07, 0, g, 0); chain.scale.set(1, 1.2, .7);
      oval(g, moss, 0, -.1, .01, .12, .17, .055); oval(g, jewel, 0, -.1, .065, .08, .12, .025);
    } else {
      const names = it.h === 'archer' ? ['LeftHand', 'handslotl'] : ['RightHand', 'handslotr'];
      const g = mount(names, [0, .05, .04]); if (!g) continue;
      oval(g, moss, 0, .04, 0, .12, .18, .1);
      for (let i = 0; i < (it.g >= 3 ? 4 : 2); i++) { const p = oval(g, bone, (i % 2 ? 1 : -1) * .14, .1 + Math.floor(i / 2) * .16, 0, .045, .2, .045, fang); p.rotation.z = (i % 2 ? -1 : 1) * .65; }
      oval(g, jewel, 0, .22, .06, .07, it.h === 'mage' ? .18 : .09, .055);
    }
  }
}
