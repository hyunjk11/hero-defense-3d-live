import * as THREE from 'three';
import { G } from '../core/state.js';
import { mk, shareGeo, toon } from './toon.js';

const cache = {};
const geo = (k, fn) => cache[k] ||= shareGeo(fn());
const sphere = () => geo('sphere', () => new THREE.SphereGeometry(1, 14, 10));
const cone = () => geo('cone', () => new THREE.ConeGeometry(1, 1, 7));
const cylinder = () => geo('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 7));
const up = new THREE.Vector3(0, 1, 0);

// Models are built independently of the skeleton/wolf/slime assets used in earlier chapters.
export function makeSwampEnemy(E) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const mats = [], material = (color, light = 0) => {
    const m = toon(color, { emissive: light, emissiveIntensity: .65 }); m.userData.e = m.emissive.clone(); mats.push(m); return m;
  };
  const skin = material(0x677b49), dark = material(0x293d37), pale = material(0xc5cb91), bark = material(0x6c4c37);
  const moss = material(0x809442), amber = material(0xe7b045, 0x68430a), teal = material(0x62d9b1, 0x1e9a71), eye = material(0xf6e7ad, 0x856a25);
  const part = (parent, m, x, y, z, sx, sy = sx, sz = sx, shape = sphere()) => {
    const p = mk(shape, m, x, y, z, parent, .018); p.scale.set(sx, sy, sz); return p;
  };
  const group = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
  const bone = (parent, a, b, radius, mat = bark) => {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.sub(av);
    const p = part(parent, mat, ...av.addScaledVector(delta, .5).toArray(), radius, delta.length(), radius, cylinder());
    p.quaternion.setFromUnitVectors(up, delta.normalize()); return p;
  };
  const eyes = (parent, width, y, z, r = .09) => {
    for (const side of [-1, 1]) { part(parent, dark, side * width, y, z, r * 1.45, r * 1.15, r * .7); part(parent, eye, side * width, y, z + r * .6, r * .72, r * .8, r * .45); }
  };
  const legs = [], antennae = [], sacs = [], shells = [], tails = [];
  let head, jaw, heart, staff, wings, bloom;
  const heartRibs = [];
  const limb = (side, z, wide = .7, mat = skin) => {
    const p = group(inner, side * wide, .62, z); legs.push(p);
    bone(p, [0, 0, 0], [side * .35, -.25, -.12], .12, mat);
    bone(p, [side * .35, -.25, -.12], [side * .49, -.57, .05], .07, mat);
    part(p, pale, side * .5, -.58, .14, .17, .055, .2); return p;
  };
  if (E.form === 'newt' || E.form === 'larva') {
    part(inner, skin, 0, .6, -.12, .37, .29, .85);
    head = group(inner, 0, .7, .7); part(head, skin, 0, 0, .13, .36, .21, .44); eyes(head, .23, .14, .41, .07);
    jaw = part(head, pale, 0, -.16, .22, .31, .045, .34);
    for (const side of [-1, 1]) for (const z of [-.55, .35]) limb(side, z, .29);
    let tail = group(inner, 0, .57, -.8); for (let i = 0; i < 4; i++) { const p = group(tail, 0, 0, -.25); part(p, skin, 0, 0, -.2, .21 - i * .04, .15 - i * .025, .35); tails.push(p); tail = p; }
    for (let i = 0; i < 6; i++) part(inner, amber, 0, .9, .42 - i * .21, .09, .16, .12, cone());
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) part(inner, teal, side * .3, .72, .4 - i * .3, .045);
    if (E.form === 'larva') { skin.color.setHex(0xc3aa58); legs.forEach(l => l.scale.setScalar(.65)); }
  } else if (E.form === 'toad') {
    part(inner, skin, 0, .78, -.12, .68, .57, .72);
    head = group(inner, 0, .95, .43); part(head, skin, 0, 0, .1, .65, .29, .45);
    jaw = part(head, pale, 0, -.22, .22, .58, .1, .37);
    const sac = part(head, amber, 0, -.33, .3, .38, .24, .34); sacs.push(sac);
    for (const side of [-1, 1]) {
      part(head, skin, side * .43, .24, .15, .22, .23, .2); if (side === 1) eyes(head, .43, .3, .32, .1);
      limb(side, .38, .45); const rear = limb(side, -.55, .51); part(rear, skin, side * .08, -.03, -.08, .29, .28, .37);
      for (let i = 0; i < 3; i++) part(inner, moss, side * (.27 + i * .11), 1.17 - i * .1, -.1 - i * .18, .13, .09, .17);
    }
    for (let i = 0; i < 4; i++) part(inner, amber, (i % 2 ? -.25 : .25), 1.25, -.38 + Math.floor(i / 2) * .4, .11, .08, .1);
  } else if (E.form === 'beetle') {
    part(inner, dark, 0, .7, -.13, .6, .4, .85);
    for (const side of [-1, 1]) {
      const shell = part(inner, skin, side * .27, .99, -.15, .37, .42, .84); shell.rotation.z = -side * .17; shells.push(shell);
      for (let i = 0; i < 3; i++) limb(side, .45 - i * .6, .49, bark);
      for (let i = 0; i < 3; i++) { const p = part(shell, moss, 0, .86, -.5 + i * .5, .55, .13, .22); p.rotation.y = side * .3; }
    }
    head = group(inner, 0, .74, .85); part(head, bark, 0, 0, 0, .35, .3, .35); eyes(head, .21, .1, .28, .07);
    for (const side of [-1, 1]) { const fang = part(head, pale, side * .28, -.06, .4, .11, .48, .11, cone()); fang.rotation.set(Math.PI / 2, 0, side * .3); }
    part(inner, amber, 0, 1.1, -.2, .17, .16, .62); // vulnerable abdomen is revealed when the paired shell breaks
  } else if (E.form === 'mender') {
    const robe = part(inner, moss, 0, 1.06, 0, .55, 1.2, .45, cone()); robe.rotation.z = .08;
    for (const side of [-1, 1]) { const p = group(inner, side * .24, .65, 0); legs.push(p); bone(p, [0, 0, 0], [side * .13, -.6, .12], .09); }
    head = group(inner, 0, 1.93, .08); part(head, bark, 0, 0, 0, .34, .38, .23);
    part(head, pale, 0, .02, .19, .28, .3, .05); eyes(head, .14, .08, .25, .06);
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; const p = part(head, moss, Math.cos(a) * .32, .28, Math.sin(a) * .25, .07, .7 + (i % 3) * .13, .05, cone()); p.rotation.z = -Math.cos(a) * .3; }
    staff = group(inner, .63, .4, .14); bone(staff, [0, -.3, 0], [.05, 1.7, 0], .06);
    bone(staff, [.05, 1.7, 0], [-.18, 1.9, .02], .065); bone(staff, [-.18, 1.9, .02], [-.36, 1.65, .02], .06);
    bloom = part(staff, teal, -.3, 1.37, .02, .19, .26, .19); sacs.push(bloom);
    for (const side of [-1, 1]) { bone(inner, [side * .32, 1.5, 0], [side * .65, 1.03, .15], .09); }
    part(inner, amber, -.42, 1.0, .18, .16, .2, .14);
  } else if (E.form === 'moth') {
    part(inner, dark, 0, 0, 0, .16, .24, .54); part(inner, moss, 0, -.02, -.43, .2, .2, .38);
    head = group(inner, 0, .08, .48); part(head, pale, 0, 0, 0, .22); eyes(head, .12, .05, .18, .07);
    wings = [-1, 1].map(side => {
      const p = group(inner, side * .13, .05, .12);
      const wingGeo = geo('moth-wing', () => { const s = new THREE.Shape(); s.moveTo(0,0); s.bezierCurveTo(.4,.6,1.4,.7,1.32,-.2); s.bezierCurveTo(1.18,-.68,.55,-.9,0,0); return new THREE.ShapeGeometry(s, 10); });
      const wing = new THREE.Mesh(wingGeo, material(0xb8c66a)); wing.material.side = THREE.DoubleSide; wing.rotation.x = -Math.PI / 2; wing.scale.x = side; p.add(wing);
      const rear = wing.clone(); rear.material = material(0x7b9466); rear.position.z = -.42; rear.scale.multiplyScalar(.68); rear.rotation.z = side * .25; p.add(rear);
      part(p, dark, side * .86, .02, -.06, .23, .018, .28); part(p, amber, side * .86, .04, -.06, .13, .025, .18);
      for (let i = 0; i < 3; i++) bone(p, [0, .025, 0], [side * (1.08 - i * .23), .025, -.4 + i * .28], .015, pale);
      return p;
    });
    for (const side of [-1, 1]) { const p = group(head, side * .13, .15, 0); bone(p, [0,0,0], [side * .15,.3,.15], .025, bark); antennae.push(p); }
    sacs.push(part(inner, amber, 0, -.2, -.35, .13, .17, .22));
  } else {
    // Heartwood: hollow trunk, exposed beating heart, root claws and shelf fungi.
    part(inner, dark, 0, 1.9, 0, .82, 1.38, .72);
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; if (Math.cos(a) > .7) continue; const p = part(inner, bark, Math.sin(a) * .75, 1.94, Math.cos(a) * .62, .22, 2.8 + (i % 3) * .16, .24, cylinder()); p.rotation.z = Math.sin(a) * .1; shells.push(p); }
    heart = part(inner, amber, 0, 1.88, .68, .42, .64, .23); sacs.push(heart);
    for (const side of [-1, 1]) {
      const rib = group(inner, side * .63, 1.3, .65); heartRibs.push({ rib, side });
      bone(rib, [0,0,0], [-side*.45,.55,.2], .12); bone(rib, [-side*.45,.55,.2], [-side*.15,1.15,0], .1);
      bone(inner, [side*.6,2.6,-.15], [side*1.1,3.2,-.5], .1);
      bone(inner, [side*1.1,3.2,-.5], [side*1.45,3.35,-.65], .05);
    }
    for (const side of [-1, 1]) {
      const p = group(inner, side * .61, 1.12, .12); legs.push(p);
      bone(p, [0,0,0], [side * .68,-.35,.2], .2); bone(p, [side * .68,-.35,.2], [side * .9,-1.05,.65], .14);
      for (let i = 0; i < 3; i++) bone(p, [side * .9,-1.05,.65], [side * (1.1 + i * .14),-1.08,.92 - i * .15], .075);
      const arm = group(inner, side * .77, 2.53, -.1); antennae.push(arm);
      bone(arm, [0,0,0], [side * .74,-.3,.2], .19); bone(arm, [side * .74,-.3,.2], [side * .92,-1.13,.45], .14);
      for (let i = 0; i < 3; i++) bone(arm, [side * .92,-1.13,.45], [side * (1 + i * .16),-1.42,.7], .06);
      bone(inner, [side * .4,3,0], [side * .78,3.76,-.2], .13); bone(inner, [side * .78,3.76,-.2], [side * 1.08,3.93,-.17], .07);
      for (let i = 0; i < 3; i++) { const cap = part(inner, moss, side * .8, 1.2 + i * .6, -.15, .46 - i * .07, .13, .4); cap.rotation.z = side * -.12; }
    }
    head = group(inner, 0, 2.95, .46); part(head, bark, 0, .05, 0, .52, .4, .25); eyes(head, .25, .08, .24, .11);
    jaw = part(head, dark, 0, -.2, .21, .33, .09, .08);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; sacs.push(part(inner, amber, Math.sin(a) * .67, 2.65 + i % 2 * .4, -.38 + Math.cos(a) * .4, .22, .3, .22)); }
    for (let i = 0; i < 4; i++) bone(inner, [Math.sin(i*1.7)*.6, .6, -.2], [Math.sin(i*1.7)*1.4,.04,-.7-Math.cos(i)*.4], .12);
  }
  inner.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(inner), height = Math.max(.1, bounds.max.y - bounds.min.y), scale = E.h / height;
  inner.scale.setScalar(scale); if (E.fly) inner.position.y = 3;
  const baselineY = E.fly ? 3 : -bounds.min.y * scale, sacScales = sacs.map(s => s.scale.clone());
  inner.position.y = baselineY;
  const m = { g, inner, mats, head, wings, legs, shells, heart, mixer: null, acts: null, proc: 'swamp', form: E.form, ph: 0, v: 0 };
  if (E.form === 'beetle') m.iceParts = shells;
  m.anim = (e, dt) => {
    const last = m.last ||= e.g.position.clone(), speed = dt ? Math.min(8, e.g.position.distanceTo(last) / dt) : 0; last.copy(e.g.position);
    m.v += (speed - m.v) * Math.min(1, dt * 8); m.ph += dt * (2.5 + m.v * 3);
    if (e.dying !== undefined) {
      const d = Math.min(1, (E.fly ? .7 - e.dying : 1.6 - e.dying) / .6);
      inner.rotation.z = d * (E.form === 'heartwood' ? .4 : 1.2); inner.scale.y = scale * (1 - d * .35); sacs.forEach(s => s.visible = d < .65); return;
    }
    const casting = e.swampCast, f = casting ? Math.max(0, 1 - casting.t / casting.windup) : 0;
    const a = Math.min(1, m.v / 2), attack = e.digging || (e.atkCd > .55 && m.v < .4);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(m.ph + i % 2 * Math.PI) * a * .48 + (attack && i < 2 ? Math.sin(G.t * 14) * .25 : 0); });
    tails.forEach((p, i) => { p.rotation.y = Math.sin(m.ph * .7 - i * .7) * (.15 + a * .15); });
    if (!E.fly) inner.position.y = baselineY + Math.abs(Math.sin(m.ph)) * a * .07 * scale;
    inner.rotation.x = e.flash > 0 ? -.13 : attack ? .1 + Math.sin(G.t * 13) * .07 : casting ? -.12 * f : 0;
    if (head) head.rotation.x = attack ? Math.sin(G.t * 13) * .16 : -f * .23;
    if (jaw) jaw.rotation.x = f * .5 + (attack ? Math.max(0, Math.sin(G.t * 13)) * .3 : 0);
    sacs.forEach((s, i) => s.scale.copy(sacScales[i]).multiplyScalar(1 + f * .42 + Math.sin(G.t * (e.swampRuptured ? 7 : 3) + i) * .045));
    antennae.forEach((p, i) => { p.rotation.x = casting ? -f * .55 : Math.sin(m.ph + i) * .08; });
    if (staff) staff.rotation.z = -.08 - f * .45;
    if (bloom && casting) bloom.rotation.y += dt * 5;
    if (heart) { heart.material.color.setHex(e.swampRuptured ? 0xf5cf6c : 0xd08c2a); if (!e.flash) heart.material.emissiveIntensity = e.swampRuptured ? 1.4 : .65; }
    if (E.form === 'heartwood') {
      const opening = e.swampRuptured ? 1 : casting?.kind === 'rupture' ? f : 0;
      for (const { rib, side } of heartRibs) rib.rotation.y = side * opening * 1.25;
    }
  };
  return m;
}
