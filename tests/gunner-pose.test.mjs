import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from '../lib/three.module.js';
const source=fs.readFileSync(new URL('../src/render/gunner-pose.js',import.meta.url),'utf8');
const {gunPose}=new Function('THREE',source.replace(/^import .*;\r?\n/gm,'').replace('export function','function')+';return {gunPose};')(THREE);
function fixture(rifle=false){
 const g=new THREE.Group(),root=new THREE.Group();g.add(root);const bones=[];
 for(const [n,x] of [['Left',.25],['Right',-.25]]){
  const upper=new THREE.Bone(),fore=new THREE.Bone(),hand=new THREE.Bone();upper.name=n+'Arm';fore.name=n+'ForeArm';hand.name=n+'Hand';
  upper.position.set(x,1.72,0);fore.position.y=-.34;hand.position.y=-.32;hand.scale.setScalar(.028);root.add(upper);upper.add(fore);fore.add(hand);bones.push(upper,fore,hand);
 }
 let clip=rifle?'AimR':'ShootStand';const ch={g,root,cur:{getClip:()=>({name:clip})},mixer:{update(){for(const b of bones)b.quaternion.identity();return this}},recoil:0};
 const rig=rifle?{gun:new THREE.Group(),R:{s:.85,grip:[.44,-.01,0],fore:[-.1,.06,0],muz:[-.95,.085,.008]},dir:new THREE.Vector3()}:null;
 if(rig)g.add(rig.gun);gunPose(ch,rig);return {ch,rig,bones,clip:n=>clip=n};
}
let poses=0;
for(const rifle of [false,true])for(const moving of [false,true])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const visualLag of [0,.8,-2.4]){
 const {ch,rig,bones,clip}=fixture(rifle);clip(rifle?(moving?'AimRun':'AimR'):(moving?'ShootWalk':'ShootStand'));
 ch.g.position.set(4,.3,-9);ch.g.rotation.y=yaw-visualLag;ch.mixer.update(1/60);const before=bones.map(b=>b.position.toArray());ch.aimWeapons(yaw);ch.g.updateMatrixWorld(true);
 const want=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
 if(rifle){const actual=new THREE.Vector3(-1,0,0).transformDirection(rig.gun.matrixWorld);assert.ok(actual.dot(want)>.999999);
  for(let i=0;i<2;i++){const p=rig.grips[i].getWorldPosition(new THREE.Vector3()),target=rig.gun.localToWorld(new THREE.Vector3(...(i?rig.R.grip:rig.R.fore)).multiplyScalar(rig.R.s));assert.ok(p.distanceTo(target)<.015);}
 }else for(const n of ['LeftHand','RightHand']){const h=ch.root.getObjectByName(n),d=new THREE.Vector3(0,1,0).transformDirection(h.matrixWorld);assert.ok(d.dot(want)>.999999);}
 assert.deepEqual(bones.map(b=>b.position.toArray()),before);for(const b of bones)assert.ok(b.quaternion.toArray().every(Number.isFinite));
 // Repeated placement must not accumulate twisting or change skeletal lengths.
 const first=bones.map(b=>b.quaternion.clone());ch.aimWeapons(yaw);bones.forEach((b,i)=>assert.ok(b.quaternion.angleTo(first[i])<1e-5));poses++;
}
const plain=fixture();plain.clip('ShootCharged');const q=plain.bones.map(b=>b.quaternion.clone());assert.equal(plain.ch.aimWeapons(2),false);plain.bones.forEach((b,i)=>assert.ok(b.quaternion.equals(q[i])));
const a=fixture(),b=fixture();a.ch.mixer.update(1/60);b.ch.mixer.update(1/60);a.ch.gunKick(0);a.ch.aimWeapons(0);const aHand=a.ch.root.getObjectByName('LeftHand').getWorldPosition(new THREE.Vector3()),bHand=b.ch.root.getObjectByName('LeftHand').getWorldPosition(new THREE.Vector3());assert.ok(aHand.z<bHand.z);assert.equal(a.ch.root.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3()).distanceTo(b.ch.root.getObjectByName('RightHand').getWorldPosition(new THREE.Vector3()))<1e-6,true);
const r=fixture(true);r.ch.mixer.update(1/60);r.clip('Death');r.ch.aimWeapons();const relative=r.rig.relative.clone();r.bones[4].rotation.x=.5;r.ch.aimWeapons();r.ch.g.updateMatrixWorld(true);const expected=r.bones[5].matrixWorld.clone().multiply(relative);assert.ok(new THREE.Vector3().setFromMatrixPosition(expected).distanceTo(r.rig.gun.getWorldPosition(new THREE.Vector3()))<1e-6);
const absent={root:new THREE.Group()};assert.doesNotThrow(()=>gunPose(absent));assert.equal(absent.aimWeapons,undefined);
console.log('PASS '+poses+' stationary/moving/turn pose cases: both barrels aim, rifle grips, fixed bone lengths, idempotence; independent recoil, skill/death/fallback boundaries');
