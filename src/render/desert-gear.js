import * as THREE from 'three';
import { mk, toon, shareGeo, disposeOwned } from './toon.js';
const orb = shareGeo(new THREE.SphereGeometry(1, 10, 8)), box = shareGeo(new THREE.BoxGeometry(1,1,1));
const cone = shareGeo(new THREE.ConeGeometry(1,1,6)), loop = shareGeo(new THREE.TorusGeometry(.18,.035,6,20));

// Animated weapon meshes and projectile anchors remain in place; the new set adds
// class-specific metalwork at the hands/tip and wearable armor at skeletal joints.
export function updateDesertGear(ch, items) {
  const selected=items.filter(it=>it.c===6), signature=selected.map(it=>`${it.s}:${it.h}:${it.g}:${it.id}`).join('|');
  if(ch.desertGearSignature===signature)return;
  for(const node of ch.desertGearNodes||[]){node.removeFromParent();disposeOwned(node);}
  ch.mats=ch.mats.filter(m=>!m.userData.desertGear);ch.desertGearNodes=[];ch.desertGearSignature=signature;
  if(!selected.length)return;
  const mat=(color,emissive=0)=>{const m=toon(color,{emissive,emissiveIntensity:.45});m.userData.e=m.emissive.clone();m.userData.desertGear=true;ch.mats.push(m);return m;};
  const gold=mat(0xe2b653),blue=mat(0x3a6b87),ivory=mat(0xf0d59b),gem=mat(0x63c6cb,0x20545b);
  const add=(p,m,x,y,z,sx,sy=sx,sz=sx,geo=orb)=>{const o=mk(geo,m,x,y,z,p,.012);o.scale.set(sx,sy,sz);return o;};
  function mount(names,offset,tip=false){
    const target=tip&&ch.tip?ch.tip:names.map(n=>ch.root.getObjectByName(n)).find(Boolean);if(!target)return null;
    ch.root.updateMatrixWorld(true);const scale=target.getWorldScale(new THREE.Vector3()).x,q=target.getWorldQuaternion(new THREE.Quaternion()).invert();
    const g=new THREE.Group();g.quaternion.copy(q);g.scale.setScalar(.62/scale);g.position.set(...offset).applyQuaternion(q).multiplyScalar(1/scale);target.add(g);ch.desertGearNodes.push(g);return g;
  }
  for(const it of selected){
    if(it.s==='armor'){
      for(const side of [-1,1]){const g=mount(side<0?['LeftArm','LeftShoulder']:['RightArm','RightShoulder'],[side*.02,.03,0]);if(!g)continue;
        add(g,gold,0,.02,0,.3,.14,.27);add(g,blue,side*.03,-.13,.02,.22,.15,.2);
        for(let i=0;i<(it.g>=3?3:1);i++)add(g,ivory,side*.12,.09,-.15+i*.15,.16,.035,.055,box);
      }
    }else if(it.s==='acc'){
      const g=mount(['Spine02','Spine2','Spine01','Spine','Chest'],[0,.08,.22]);if(!g)continue;
      mk(loop,gold,0,.06,0,g,0);add(g,gold,0,-.13,.02,.1,.16,.04);add(g,gem,0,-.13,.065,.055,.1,.025);
      for(const side of [-1,1]){const wing=add(g,blue,side*.13,-.11,.02,.14,.065,.035);wing.rotation.z=side*.4;}
    }else if(it.h==='mage'){
      const g=mount(['RightHand','handslotr'],[0,.04,0],true);if(!g)continue;
      for(const y of [-.2,.2])add(g,gold,0,y,0,.4,.06,.26,box);
      for(const x of [-.17,.17])add(g,gold,x,0,0,.035,.42,.035,box);
      add(g,gem,0,.1,0,.12,.2,.12,cone).rotation.z=Math.PI;add(g,ivory,0,-.1,0,.12,.2,.12,cone);
    }else if(it.h==='archer'){
      const g=mount(['LeftHand','handslotl'],[0,.04,.02]);if(!g)continue;
      add(g,blue,0,0,0,.11,.2,.1);for(const side of [-1,1]){const limb=add(g,gold,side*.09,side*.3,0,.08,.5,.06,box);limb.rotation.z=-.3;add(g,ivory,side*.18,side*.52,0,.09,.25,.065,cone).rotation.z=side<0?Math.PI:0;}
      add(g,gem,0,.07,.1,.07,.1,.035);
    }else if(it.h==='gunner'||it.h==='fighter'){
      for(const side of [-1,1]){const g=mount(side<0?['LeftHand','handslotl']:['RightHand','handslotr'],[0,.03,.02]);if(!g)continue;
        add(g,blue,0,0,0,.11,.14,.12);add(g,gold,0,.07,.08,.18,.1,it.h==='gunner' ? .24:.18);
        if(it.h==='fighter')for(const s of [-1,1]){const claw=add(g,ivory,s*.13,.23,.08,.07,.3,.065,cone);claw.rotation.z=-s*.35;}
        else {add(g,ivory,0,.12,.12,.14,.035,.28,box);add(g,gem,0,.07,.22,.05);}
      }
    }else{
      const g=mount(['RightHand','handslotr'],[0,.04,.03]);if(!g)continue;
      add(g,blue,0,0,0,.11,.2,.1);add(g,gold,0,.2,0,.35,.07,.16,box);
      const blade=add(g,ivory,.09,.41,0,.1,.5,.065,box);blade.rotation.z=-.25;
      add(g,gold,.18,.66,0,.11,.25,.065,cone).rotation.z=-.45;add(g,gem,0,.15,.09,.07);
    }
  }
}
