import * as THREE from 'three';
import { FT } from '../data/fighter.js';

// One reusable ground ring: outer basic-attack target acquisition boundary.
// Fighter auto-attacks include charged palms (jpTarget/jpWants), for both branches.
// Their fixed acquisition range is separate from gear-modified melee range,
// projectile travel distance, and Q/E skill areas. Combat rules stay unchanged.
export function createHeroRange(scene) {
  const geometry = new THREE.RingGeometry(.975, 1, 96);
  const material = new THREE.MeshBasicMaterial({ color: 0x81c8e8, transparent: true,
    opacity: .32, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(geometry, material);
  ring.name = 'heroAttackRange'; ring.renderOrder = 2; ring.rotation.x = -Math.PI / 2;
  ring.visible = false; ring.raycast = () => {}; scene.add(ring);
  return {
    ring,
    update(hero, radius, phase, navigating = false) {
      ring.visible = !!hero && !navigating && (phase === 'build' || phase === 'wave')
        && hero.dead <= 0 && hero.hp > 0 && Number.isFinite(radius) && radius > 0;
      if (!ring.visible) return;
      if (hero.cls === 'fighter') radius = Math.max(radius, FT.jpRange);
      ring.position.set(hero.g.position.x, .09, hero.g.position.z);
      ring.scale.set(radius, radius, 1);
    },
    dispose() { scene.remove(ring); geometry.dispose(); material.dispose(); }
  };
}
