import * as THREE from 'three';
import { scene } from './scene.js';
import { IM, mk, toon, setI, hideI, shareGeo, shareMat } from './toon.js';
import { STAGE, T, GH, GW, NT, tileX, tileZ } from '../core/grid.js';

export const DESERT = STAGE?.ch === 6;
let stems, caps;
const sandMat = shareMat(toon(0xc99d61)), lightMat = shareMat(toon(0xe4c18a)), blueMat = shareMat(toon(0x517889));
function ensureCacti() {
  if (stems) return;
  stems = IM(new THREE.CylinderGeometry(.2, .23, 1, 7), toon(0x65885a), NT * 5, .022);
  caps = IM(new THREE.SphereGeometry(.2, 8, 6), toon(0x819e67), NT * 3, .018);
}
export function refreshDesertTile(t) {
  if (!DESERT) return; ensureCacti(); const i = t.c * GH + t.r;
  for (let k = 0; k < 5; k++) hideI(stems, i * 5 + k);
  for (let k = 0; k < 3; k++) hideI(caps, i * 3 + k);
  if (t.t !== T.FOREST) return;
  const k = .7 + .3 * t.hp / t.max, x = tileX(t.c), z = tileZ(t.r), h = (1.4 + t.s * .45) * k;
  setI(stems, i * 5, x, h / 2, z, k, h, k);
  setI(caps, i * 3, x, h, z, k);
  for (let j = 0; j < 2; j++) { const side = j ? 1 : -1, y = (.68 + j * .3) * k;
    setI(stems, i * 5 + 1 + j * 2, x + side * .25 * k, y, z, .7 * k, .55 * k, .7 * k, 0, Math.PI / 2);
    // Rotate the cylinder onto X while keeping it inside the tile.
    const index = i * 5 + 1 + j * 2; const m = new THREE.Matrix4().compose(new THREE.Vector3(x + side * .25 * k, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI/2), new THREE.Vector3(.7*k,.55*k,.7*k)); stems.setMatrixAt(index,m);
    setI(stems, i * 5 + 2 + j * 2, x + side * .5 * k, y + .2 * k, z, .7 * k, .4 * k, .7 * k);
    setI(caps, i * 3 + j + 1, x + side * .5 * k, y + .4 * k, z, .7 * k);
  }
  stems.instanceMatrix.needsUpdate = true;
}
export function desertObelisk(parent, t) {
  const g = new THREE.Group(); g.position.set(tileX(t.c),0,tileZ(t.r)); parent.add(g);
  mk(new THREE.BoxGeometry(1.5,.3,1.5),sandMat,0,.15,0,g);
  mk(new THREE.CylinderGeometry(.36,.51,2.1,4),lightMat,0,1.35,0,g).rotation.y=Math.PI/4;
  mk(new THREE.ConeGeometry(.51,.55,4),sandMat,0,2.67,0,g).rotation.y=Math.PI/4;
  for(let i=0;i<3;i++) mk(new THREE.BoxGeometry(.15,.12,.035),blueMat,0,.85+i*.38,.4,g,.01);
}
export function desertDeco() {
  if (!DESERT) return;
  const g = new THREE.Group(); g.name='desert-dunes-and-temples';scene.add(g);
  const dune = shareGeo(new THREE.SphereGeometry(1,16,10)), pyramid = shareGeo(new THREE.ConeGeometry(1,1,4));
  for(let i=0;i<12;i++) { const side=i%2?1:-1,x=side*(GW+6+(i%3)*3),z=(i/11-.5)*GH*4;
    const m=mk(dune,sandMat,x,-1.6,z,g,0);m.scale.set(5+i%3,2.1,3.8);
  }
  for(const [x,z,size] of [[-37,-27,12],[34,-30,10],[40,23,8]]) {
    const p=mk(pyramid,lightMat,x,size*.42-.8,z,g,0);p.scale.set(size,size*.84,size);p.rotation.y=Math.PI/4;
    const tip=mk(pyramid,sandMat,x,size*.8-.8,z,g,0);tip.scale.set(size*.12,size*.1,size*.12);tip.rotation.y=Math.PI/4;
  }
  for(let i=0;i<8;i++){ const x=(i%2?1:-1)*(GW+4),z=(Math.floor(i/2)-1.5)*9;
    const h=1.7+i%3*.45;mk(new THREE.CylinderGeometry(.55,.7,h,8),sandMat,x,h/2-.7,z,g);
    const cap=mk(new THREE.BoxGeometry(1.5,.25,1.5),lightMat,x,h-.58,z,g);cap.rotation.y=i*.15;
  }
}
