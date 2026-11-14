import * as THREE from 'three';
import { G } from '../core/state.js';
import { mk, shareGeo, toon } from './toon.js';

const cache = new Map();
const geometry = (kind, args) => { const key = kind + args.join(','); if (!cache.has(key)) cache.set(key, shareGeo(new THREE[kind](...args))); return cache.get(key); };
const ball = () => geometry('SphereGeometry', [1, 12, 8]), cylinder = () => geometry('CylinderGeometry', [1, 1, 1, 8]);
const cone = () => geometry('ConeGeometry', [1, 1, 6]), cube = () => geometry('BoxGeometry', [1, 1, 1]);

export function makeDesertEnemy(E) {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const mats = [], mat = (color, emission = 0) => { const m = toon(color, { emissive: emission, emissiveIntensity: .45 }); m.userData.e = m.emissive.clone(); mats.push(m); return m; };
  const M = { sand: mat(0xc69a57), pale: mat(0xf0d79d), dark: mat(0x443c38), blue: mat(0x345c79), gold: mat(0xe9b749), bronze: mat(0x967044), cloth: mat(0x786294), eye: mat(0x71e2df, 0x226c85), sun: mat(0xffbc50, 0xa05115) };
  const group = (p, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); p.add(o); return o; };
  const part = (p, key, x, y, z, sx, sy = sx, sz = sx, geo = ball()) => { const o = mk(geo, M[key], x, y, z, p, .018); o.scale.set(sx, sy, sz); return o; };
  const beam = (p, a, b, r, key) => { const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.sub(from), m = part(p, key, ...from.addScaledVector(d, .5).toArray(), r, d.length(), r, cylinder()); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const eyes = (p, x, y, z, radius = .07) => { for (const side of [-1, 1]) { part(p, 'dark', x * side, y, z, radius * 1.5, radius * .9, radius); part(p, 'eye', x * side, y, z + radius * .7, radius, radius * .5, radius * .5); } };
  const legs = [], arms = [], tails = [], wings = [], plates = [], ornaments = [], segments = [];
  let head, shield, staff, core;
  function headdress(p, height = .65) {
    part(p, 'gold', 0, .3, -.05, .47, .23, .31, cube());
    for (const side of [-1, 1]) {
      part(p, 'blue', side * .38, -.03, -.05, .19, height, .35, cube()).rotation.z = side * -.13;
      for (let i = 0; i < 3; i++) part(p, 'gold', side * .4, .2 - i * .2, .14, .2, .045, .04, cube());
    }
    const disk = part(p, 'gold', 0, .5, -.03, .2, .05, .2, cylinder()); disk.rotation.x = Math.PI / 2;
    part(p, 'sun', 0, .5, .04, .11);
  }
  function quadrupedLeg(side, z, y = .75, length = .7, r = .12) {
    const l = group(inner, side * .43, y, z); legs.push(l);
    beam(l, [0, 0, 0], [side * .1, -length * .55, -.15], r, 'sand');
    beam(l, [side * .1, -length * .55, -.15], [side * .14, -length, .04], r * .8, 'sand');
    part(l, 'pale', side * .14, -length, .16, r * 1.25, .08, r * 1.8); return l;
  }
  if (E.form === 'fennec') {
    part(inner, 'sand', 0, .78, -.16, .38, .32, .65); part(inner, 'pale', 0, .67, .29, .29, .26, .26);
    head = group(inner, 0, 1.05, .53); part(head, 'sand', 0, 0, .06, .32, .28, .29);
    part(head, 'pale', 0, -.08, .34, .21, .12, .28); part(head, 'dark', 0, -.02, .58, .09, .065, .07); eyes(head, .2, .07, .27, .055);
    for (const side of [-1, 1]) {
      const ear = part(head, 'sand', side * .23, .4, -.06, .22, .75, .13, cone()); ear.rotation.z = -side * .18;
      part(ear, 'cloth', 0, -.03, .84, .55, .78, .06, cone());
      quadrupedLeg(side, .36, .65, .58, .085); quadrupedLeg(side, -.59, .65, .58, .085);
    }
    const tail = group(inner, 0, .76, -.64); tail.rotation.x = -.55; tails.push(tail);
    part(tail, 'sand', 0, .06, -.37, .22, .2, .48); part(tail, 'pale', 0, .13, -.75, .17, .16, .2);
  } else if (E.form === 'worm') {
    for (let i = 0; i < 6; i++) {
      const s = group(inner, 0, .42 + Math.sin(i * .5) * .12, .7 - i * .36); segments.push(s);
      part(s, i % 2 ? 'sand' : 'bronze', 0, 0, 0, .35 - i * .025, .35 - i * .025, .24);
      part(s, 'pale', 0, -.12, .04, .24, .14, .23);
      for (const side of [-1, 1]) part(s, 'gold', side * .32, .02, 0, .065, .26, .08, cone()).rotation.z = side * -.8;
    }
    head = group(segments[0], 0, .18, .25); part(head, 'bronze', 0, 0, 0, .4, .33, .3); eyes(head, .22, .08, .26);
    for (const side of [-1, 1]) { const jaw = group(head, side * .3, -.08, .15); arms.push(jaw); part(jaw, 'pale', side * .02, 0, .25, .11, .55, .1, cone()).rotation.x = Math.PI / 2; }
    part(head, 'gold', 0, .3, 0, .2, .44, .15, cone());
  } else if (E.form === 'guard' || E.form === 'priest') {
    const priest = E.form === 'priest';
    for (const side of [-1, 1]) {
      const l = group(inner, side * .23, .86, 0); legs.push(l); beam(l, [0,0,0], [0,-.74,0], .115, 'sand'); part(l, 'blue', 0, -.73, .13, .17, .1, .27);
    }
    part(inner, priest ? 'cloth' : 'blue', 0, .93, 0, .48, .9, .34, cone());
    part(inner, priest ? 'pale' : 'bronze', 0, 1.5, 0, .67, .66, .42, cube());
    part(inner, 'gold', 0, 1.58, .24, .45, .16, .06, cube());
    head = group(inner, 0, 2.05, .02); part(head, 'sand', 0, 0, 0, .3, .36, .26); headdress(head, priest ? .8 : .6);
    if (priest) { part(head, 'dark', 0, .02, .26, .23, .12, .035, cube()); eyes(head, .13, .05, .3, .055); }
    else { part(head, 'bronze', 0, .02, .3, .2, .13, .27, cone()).rotation.x = Math.PI / 2; eyes(head, .19, .13, .25); }
    for (const side of [-1, 1]) {
      const arm = group(inner, side * .43, 1.75, 0); arms.push(arm);
      beam(arm, [0,0,0], [side*.14,-.43,.1], .11, 'sand'); beam(arm, [side*.14,-.43,.1], [side*.08,-.65,.34], .09, 'sand');
      part(arm, 'gold', 0, .02, 0, .24, .14, .24);
    }
    if (!priest) {
      shield = group(arms[0], -.13, -.46, .45);
      const disk = part(shield, 'bronze', 0, 0, 0, .48, .09, .6, cylinder()); disk.rotation.x = Math.PI / 2;
      const face = part(shield, 'gold', 0, 0, .08, .4, .045, .51, cylinder()); face.rotation.x = Math.PI / 2;
      part(shield, 'blue', 0, 0, .14, .25, .36, .04); part(shield, 'sun', 0, 0, .2, .16);
      const sword = group(arms[1], .08, -.5, .36);
      beam(sword, [0,-.2,0], [0,.55,0], .06, 'gold'); beam(sword, [0,.5,0], [.24,.76,0], .11, 'pale'); beam(sword, [.24,.76,0], [.2,1.05,0], .1, 'pale');
    } else {
      staff = group(arms[1], .2, -.6, .3); beam(staff, [0,-.55,0], [0,1.2,0], .055, 'bronze');
      for (const x of [-.21,.21]) beam(staff, [x,.83,0], [x,1.47,0], .035, 'gold');
      for (const y of [.81,1.49]) part(staff, 'gold', 0,y,0,.29,.08,.2,cube());
      part(staff, 'eye', 0,1.02,0,.15,.25,.15,cone()); part(staff, 'sun', 0,1.28,0,.15,.25,.15,cone()).rotation.z = Math.PI;
    }
  } else if (E.form === 'vulture') {
    part(inner, 'bronze', 0,.1,-.1,.3,.36,.55); part(inner, 'pale', 0,.29,.36,.22,.22,.26);
    head = group(inner,0,.5,.5); part(head,'pale',0,0,0,.23); eyes(head,.14,.03,.17,.05);
    part(head,'gold',0,-.04,.24,.12,.34,.12,cone()).rotation.x = Math.PI / 2;
    for (const side of [-1,1]) {
      const w=group(inner,side*.2,.21,.05); wings.push(w);
      beam(w,[0,0,0],[side*.9,.05,.05],.13,'bronze');
      for(let i=0;i<6;i++){ const feather=part(w,i%2?'bronze':'gold',side*(.35+i*.19),-.04,-.18-i*.07,.13,.075,.55-i*.035);feather.rotation.y=-side*(.12+i*.1); }
      const leg=group(inner,side*.15,-.17,.13);legs.push(leg);beam(leg,[0,0,0],[0,-.38,.08],.045,'gold');
      for(let i=0;i<2;i++)beam(leg,[0,-.38,.08],[(i-.5)*.14,-.42,.23],.025,'dark');
    }
    for(let i=0;i<3;i++)part(inner,'bronze',(i-1)*.16,0,-.67,.12,.07,.4).rotation.y=(i-1)*.25;
    part(inner,'blue',0,.36,-.05,.14,.08,.22);
  } else if (E.form === 'sphinx') {
    part(inner,'sand',0,1,-.2,.66,.55,1.1);
    for(const side of [-1,1]) { quadrupedLeg(side,.68,.86,.75,.19);quadrupedLeg(side,-.86,.82,.71,.2); }
    head=group(inner,0,1.86,.7);part(head,'pale',0,0,0,.4,.5,.36);headdress(head,.92);eyes(head,.19,.06,.35,.075);
    part(head,'bronze',0,-.3,.34,.09,.42,.08,cone()).rotation.z=Math.PI;
    core=part(inner,'eye',0,1.2,.88,.2,.26,.08);
    for(const side of [-1,1]) {
      const w=group(inner,side*.5,1.25,-.36);ornaments.push(w);
      for(let i=0;i<4;i++){const feather=part(w,i%2?'sand':'pale',side*(.13+i*.13),.25+i*.12,-i*.12,.16,.65,.19,cube());feather.rotation.z=-side*.4;}
    }
    const tail=group(inner,0,1,-1.1);tails.push(tail);beam(tail,[0,0,0],[.35,.15,-.65],.1,'sand');beam(tail,[.35,.15,-.65],[.48,.6,-.72],.08,'sand');
  } else {
    const scorpion=E.form==='scorpion';
    part(inner,'dark',0,.65,-.13,.65,.38,.95);part(inner,'sand',0,.88,-.2,.64,.36,.83);
    for(const side of [-1,1]) for(let i=0;i<3;i++) {
      const l=group(inner,side*.5,.68,.45-i*.5);legs.push(l);beam(l,[0,0,0],[side*.44,-.08,-.12],.09,'bronze');beam(l,[side*.44,-.08,-.12],[side*.65,-.62,.12],.07,'bronze');
    }
    head=group(inner,0,.68,.75);part(head,'bronze',0,0,0,.39,.26,.35);eyes(head,.21,.1,.3);
    for(const side of [-1,1]) {
      const plate=part(inner,'gold',side*.3,1.04,-.2,.32,.21,.75);plates.push(plate);
      if(scorpion){const arm=group(inner,side*.48,.76,.55);arms.push(arm);beam(arm,[0,0,0],[side*.55,-.07,.53],.14,'bronze');
        part(arm,'sand',side*.62,-.06,.73,.27,.21,.36);for(const z of [-1,1])part(arm,'gold',side*(.62+z*.17),-.04,1.05,.13,.62,.13,cone()).rotation.x=Math.PI/2;}
      else part(head,'gold',side*.21,-.03,.38,.07,.3,.07,cone()).rotation.x=Math.PI/2;
    }
    core=part(inner,'sun',0,1.1,-.15,.21,.12,.44);
    if(scorpion){
      let parent=group(inner,0,.76,-.92);
      for(let i=0;i<5;i++){const t=group(parent,0,i? .39:0,i?-.18:0);tails.push(t);part(t,i%2?'gold':'bronze',0,.15,-.06,.23-i*.02,.32,.24-i*.02);parent=t;}
      part(parent,'dark',0,.35,.17,.12,.56,.12,cone()).rotation.x=Math.PI*.7;
      const crown=group(head,0,.22,-.04);for(let i=0;i<3;i++)part(crown,'gold',(i-1)*.19,.2+(i===1 ? .1:0),0,.1,.45,.08,cone());
      part(inner,'blue',0,.96,.63,.5,.23,.16,cube());
    }
  }
  inner.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(inner),scale=E.h/Math.max(.1,bounds.max.y-bounds.min.y),baseY=E.fly?3:-bounds.min.y*scale;
  inner.scale.setScalar(scale);inner.position.y=baseY;
  const rest=segments.map(p=>p.position.clone());
  const m={g,inner,mats,legs,wings,plates,head,shield,core,proc:'desert',form:E.form,mixer:null,acts:null,phase:0,speed:0};
  m.anim=(e,dt)=>{
    const last=m.last ||= e.g.position.clone(),speed=dt?Math.min(8,e.g.position.distanceTo(last)/dt):0;last.copy(e.g.position);
    m.speed+=(speed-m.speed)*Math.min(1,dt*8);m.phase+=dt*(2.5+m.speed*3);
    if(e.dying!==undefined){const f=Math.min(1,((E.fly ? .7:1.6)-e.dying)/.65);inner.rotation.z=f*.95;inner.scale.y=scale*(1-f*.4);return;}
    const c=e.desertCast,f=c?Math.max(0,1-c.t/c.duration):0,a=Math.min(1,m.speed/2),strike=(e.desertStrikeT||0)/.4;
    inner.rotation.x=e.flash>0?-.08:e.digging ? .1:0;inner.rotation.z=0;
    inner.scale.y=scale*(e.desertTravel ? .08:1);inner.position.y=e.desertTravel?-.45:baseY+Math.abs(Math.sin(m.phase))*a*.045*scale;
    legs.forEach((l,i)=>l.rotation.x=Math.sin(m.phase+(i%2)*Math.PI)*a*.48);
    if(head)head.rotation.x=-f*.24+strike*.3;
    arms.forEach((arm,i)=>{arm.rotation.x=-f*.65+strike*.85;arm.rotation.y=E.form==='scorpion'?(i?1:-1)*(f*.55-strike*.6):0;});
    if(shield)shield.rotation.y=e.guardOpenT>0?-1.5:0;
    if(staff)staff.rotation.z=-f*.4;
    tails.forEach((tail,i)=>{tail.rotation.y=Math.sin(m.phase*.55-i*.5)*.12;tail.rotation.x=E.form==='scorpion'?f*.34+strike*.5:0;});
    segments.forEach((s,i)=>{s.position.copy(rest[i]);s.position.x+=Math.sin(m.phase-i*.8)*a*.13;s.position.y+=Math.sin(m.phase-i*.8)*a*.06;});
    wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*(Math.sin(G.t*7)*.3+f*.6));
    if(E.form==='vulture'&&c)inner.position.y=3-Math.sin(f*Math.PI)*1.3;
    if(E.form==='scorpion') {plates.forEach(p=>p.visible=!e.desertAwakened);if(core)core.scale.y=e.desertAwakened ? .27:.12;}
    if(core&&!e.flash)core.material.emissiveIntensity=.45+f*.45+(e.desertAwakened ? .25:0);
  };
  return m;
}
