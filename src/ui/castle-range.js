import * as THREE from 'three';
import { CORE, S, inGrid, tileX, tileZ } from '../core/grid.js';
import { G } from '../core/state.js';
import { castleRank, inCastleRing } from '../data/castle-defense.js';
import { scene } from '../render/scene.js';

let highlight = null;
export function hideCastleRange() {
  if (highlight) highlight.visible = false;
}
export function toggleCastleRange() {
  if (!castleRank(G) || !['build','wave'].includes(G.phase) || G.paused || G.navigating) return false;
  if (!highlight) {
    const tiles = [];
    for (let c = CORE[0] - 4; c <= CORE[0] + 4; c++) for (let r = CORE[1] - 4; r <= CORE[1] + 4; r++) {
      if (inGrid(c, r) && inCastleRing(c, r, CORE)) tiles.push([c, r]);
    }
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(S * .95, S * .95),
      new THREE.MeshBasicMaterial({color:0x81e6d8,transparent:true,opacity:.24,depthWrite:false,toneMapped:false}), tiles.length);
    const matrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    tiles.forEach(([c,r],i) => mesh.setMatrixAt(i, matrix.setPosition(tileX(c), .12, tileZ(r))));
    mesh.name = 'castleDefenseRange';
    mesh.visible = false;
    scene.add(mesh);
    highlight = mesh;
  }
  highlight.visible = !highlight.visible;
  return true;
}
