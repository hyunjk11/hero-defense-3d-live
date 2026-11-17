import * as THREE from 'three';
import { mk, toon, shareGeo, shareMat } from './toon.js';
import { batchTowerBodies } from './tower-body-batch.js';

// Every soldier borrows immutable geometry/materials. The runtime owns only its group.
const geometry = new Map();
const mats = Object.fromEntries(Object.entries({ steel:0xe1edf5, dark:0x182336, gold:0xffdc79, teal:0x24e3cf, violet:0xd582f1, skin:0xe9bc91 }).map(([k,c])=>[k,shareMat(toon(c))]));
function geo(kind,args) {const key=kind+args.join(',');if(!geometry.has(key))geometry.set(key,shareGeo(new THREE[kind](...args)));return geometry.get(key);}
const box=(p,w,h,d,x,y,z,mat)=>mk(geo('BoxGeometry',[w,h,d]),mats[mat],x,y,z,p,.028);
const group=(p,x,y,z)=>{const g=new THREE.Group();g.position.set(x,y,z);p.add(g);return g;};

export function guardianModel({level=1,branch=null,giant=false}={}) {
  const assault=String(branch).includes('assault'),bulwark=String(branch).includes('bulwark');
  const g=new THREE.Group(),body=group(g,0,0,0),color=assault?'violet':'teal';
  g.name=giant?'guardian-giant':assault?'guardian-knight':'guardian-soldier';
  box(body,.46,.53,.29,0,.85,0,'steel'); box(body,.29,.37,.04,0,.82,.17,color);
  box(body,.48,.1,.32,0,.58,0,'dark');box(body,.11,.11,.05,0,.59,.2,'gold');
  box(body,.34,.32,.3,0,1.27,0,level>=3?'steel':'dark');
  box(body,.29,.08,.035,0,1.26,.17,'dark');
  box(body,.06,.27,.035,0,1.25,.19,'gold');
  // Raised colored crest reads from the overhead camera, even at small viewports.
  box(body,.13,level>=3?.25:.17,.34,0,level>=3?1.5:1.46,-.02,color);
  const swordArm=group(body,-.33,1.03,0),shieldArm=group(body,.33,1.03,0);
  for(const arm of [swordArm,shieldArm]){box(arm,.21,.18,.28,0,0,0,level>=4?'gold':'steel');box(arm,.13,.35,.15,0,-.23,0,'dark');box(arm,.15,.14,.16,0,-.43,0,'steel');}
  box(swordArm,.075,.7,.07,0,.07,.12,'steel');box(swordArm,.28,.065,.12,0,-.3,.12,'gold');box(swordArm,.09,.22,.09,0,-.43,.12,'dark');
  const sw=bulwark?.61:.48,sh=bulwark?.78:.62;
  box(shieldArm,sw,sh,.1,.04,-.26,.22,'gold');box(shieldArm,sw-.08,sh-.08,.045,.04,-.26,.28,color);
  box(shieldArm,.06,sh-.17,.03,.04,-.26,.31,'gold');box(shieldArm,sw-.16,.06,.03,.04,-.26,.31,'gold');
  const legs=[group(body,-.13,.56,0),group(body,.13,.56,0)];
  for(const leg of legs){box(leg,.16,.34,.18,0,-.19,0,'dark');box(leg,.19,.16,.3,0,-.45,.05,'steel');}
  // Back-facing cape keeps branch color visible when soldiers face away.
  box(body,.45,.58,.06,0,.83,-.2,color);
  if(level>=4)box(body,.48,.09,.08,0,1.09,-.24,'gold');
  if(giant)g.scale.setScalar(1.8);else g.scale.setScalar(1.15+Math.max(0,level-1)*.025);
  batchTowerBodies(g,{shareGeometry:shareGeo});
  return {g,body,swordArm,shieldArm,legs};
}

export function animateGuardian(m,{time=0,moving=false,attacking=false,blocking=false}={}) {
  const stride=moving?Math.sin(time*12)*.5:0;
  m.legs[0].rotation.x=stride;m.legs[1].rotation.x=-stride;
  m.body.position.y=moving?Math.abs(Math.sin(time*12))*.035:Math.sin(time*2)*.01;
  m.swordArm.rotation.x=attacking?-1.1+Math.sin(time*22)*.7:-stride*.5;
  m.swordArm.rotation.z=attacking?-.25:0;
  m.shieldArm.rotation.x=blocking?-.7:stride*.35;
  m.body.rotation.x=moving?.08:0;
}
