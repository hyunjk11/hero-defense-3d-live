import * as THREE from 'three';
import { mk, toon, shareGeo, disposeOwned } from './toon.js';
const orb=shareGeo(new THREE.SphereGeometry(1,10,8)),box=shareGeo(new THREE.BoxGeometry(1,1,1)),cone=shareGeo(new THREE.ConeGeometry(1,1,5)),ring=shareGeo(new THREE.TorusGeometry(.18,.035,6,20));
export function updateStormGear(ch,items){
  const selected=items.filter(it=>it.c===7),signature=selected.map(it=>`${it.s}:${it.h}:${it.g}:${it.id}`).join('|');if(ch.stormGearSignature===signature)return;
  for(const n of ch.stormGearNodes||[]){n.removeFromParent();disposeOwned(n);}ch.mats=ch.mats.filter(m=>!m.userData.stormGear);ch.stormGearNodes=[];ch.stormGearSignature=signature;if(!selected.length)return;
  const mat=(color,emissive=0)=>{const m=toon(color,{emissive,emissiveIntensity:.4});m.userData.e=m.emissive.clone();m.userData.stormGear=true;ch.mats.push(m);return m;};
  const blue=mat(0x427d9a),pale=mat(0xc7e8e8),gold=mat(0xcfb878),light=mat(0x9fe6f2,0x255b77);
  const add=(p,m,x,y,z,sx,sy=sx,sz=sx,geo=orb)=>{const n=mk(geo,m,x,y,z,p,.012);n.scale.set(sx,sy,sz);return n;};
  function mount(names,offset,tip=false){const target=tip&&ch.tip?ch.tip:names.map(n=>ch.root.getObjectByName(n)).find(Boolean);if(!target)return null;ch.root.updateMatrixWorld(true);const scale=target.getWorldScale(new THREE.Vector3()).x,q=target.getWorldQuaternion(new THREE.Quaternion()).invert();const g=new THREE.Group();g.quaternion.copy(q);g.scale.setScalar(.65/scale);g.position.set(...offset).applyQuaternion(q).multiplyScalar(1/scale);target.add(g);ch.stormGearNodes.push(g);return g;}
  const plume=(p,side,n,size=1)=>{for(let i=0;i<n;i++){const f=add(p,i%2?blue:pale,side*(.12+i*.09),-.07-i*.065,-i*.045,.09*size,.3*size,.065,cone);f.rotation.z=side*-.65;}};
  for(const it of selected){const detail=it.g>=3?3:1;
    if(it.s==='armor'){
      for(const side of [-1,1]){const g=mount(side<0?['LeftArm','LeftShoulder']:['RightArm','RightShoulder'],[side*.02,.04,-.02]);if(!g)continue;add(g,blue,0,0,0,.25,.14,.23);plume(g,side,detail+1);add(g,gold,side*.02,.04,.16,.23,.04,.06,box);}
    }else if(it.s==='acc'){
      const g=mount(['Spine02','Spine2','Spine01','Spine','Chest'],[0,.05,.23]);if(!g)continue;mk(ring,gold,0,-.03,0,g,0);add(g,blue,0,-.03,0,.16,.16,.03);for(const s of [-1,1])add(g,s>0?pale:light,0,-.03+s*.08,.04,.045,.19,.025,cone).rotation.z=s<0?Math.PI:0;add(g,light,0,-.03,.07,.045);if(detail>1)for(const s of [-1,1])add(g,gold,s*.23,-.03,0,.055,.16,.035,cone).rotation.z=s*Math.PI/2;
    }else if(it.h==='mage'){
      const g=mount(['RightHand','handslotr'],[0,.04,0],true);if(!g)continue;for(let i=0;i<10;i++){const a=i*.75,r=.25-i*.02;add(g,i%2?pale:blue,Math.cos(a)*r,Math.sin(a)*r,-i*.008,.12-i*.006,.12-i*.006,.13);}add(g,light,.03,.01,.14,.08);if(detail>1)for(const s of [-1,1])add(g,gold,s*.22,.23,0,.05,.3,.06,cone).rotation.z=-s*.4;
    }else if(it.h==='archer'){
      const g=mount(['LeftHand','handslotl'],[0,.04,.02]);if(!g)continue;add(g,gold,0,0,0,.09,.18,.08);for(const side of [-1,1]){const limb=add(g,blue,side*.1,side*.32,0,.065,.55,.06,box);limb.rotation.z=-.3;for(let i=0;i<detail;i++){const f=add(g,pale,side*(.13+i*.06),side*(.25+i*.13),.02,.07,.28,.05,cone);f.rotation.z=side<0?Math.PI-.4:-.4;}}add(g,light,0,0,.1,.07,.11,.04);
    }else if(it.h==='gunner'||it.h==='fighter'){
      for(const side of [-1,1]){const g=mount(side<0?['LeftHand','handslotl']:['RightHand','handslotr'],[0,.03,.03]);if(!g)continue;add(g,blue,0,0,0,.11,.13,.12);add(g,pale,0,.07,.08,.16,.09,it.h==='gunner'?.26:.16);
        if(it.h==='gunner'){for(let i=0;i<detail;i++){const coil=mk(ring,gold,0,.08,.05+i*.1,g,0);coil.scale.setScalar(.7);}add(g,light,0,.08,.3,.055);}else{for(let i=0;i<3;i++)add(g,pale,(i-1)*.09,.2,.08,.045,.3,.05,cone).rotation.z=(i-1)*-.15;if(detail>1)plume(g,side,3,.75);}}
    }else{
      const g=mount(['RightHand','handslotr'],[0,.03,.02]);if(!g)continue;add(g,blue,0,0,0,.1,.18,.08);add(g,gold,0,.18,0,.35,.06,.14,box);for(const[x,y,a]of [[0,.34,-.15],[.08,.55,.3],[.1,.75,-.2]])add(g,pale,x,y,0,.08,.3,.055,box).rotation.z=a;add(g,light,.13,.95,0,.1,.3,.055,cone).rotation.z=-.2;if(detail>1)plume(g,-1,2,.7);
    }
  }
}
