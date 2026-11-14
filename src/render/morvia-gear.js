import * as THREE from 'three';
import { mk, toon, shareGeo, disposeOwned } from './toon.js';
const orb=shareGeo(new THREE.SphereGeometry(1,10,8)), box=shareGeo(new THREE.BoxGeometry(1,1,1)), tooth=shareGeo(new THREE.ConeGeometry(1,1,5));
export function updateMorviaGear(ch,items) {
  const selected=items.filter(it=>it.set==='morvia'),signature=selected.map(it=>`${it.s}:${it.h}:${it.id}`).join('|');
  if(ch.morviaGearSignature===signature)return;
  for(const n of ch.morviaGearNodes||[]){n.removeFromParent();disposeOwned(n);}
  ch.mats=ch.mats.filter(m=>!m.userData.morviaGear);ch.morviaGearNodes=[];ch.morviaGearSignature=signature;if(!selected.length)return;
  const mat=(color,emissive=0)=>{const m=toon(color,{emissive,emissiveIntensity:.5});m.userData.e=m.emissive.clone();m.userData.morviaGear=true;ch.mats.push(m);return m;};
  const bone=mat(0xd8cddd),dark=mat(0x44304f),violet=mat(0x9c6cbf),soul=mat(0x9bf1d7,0x347d69);
  const add=(g,m,x,y,z,sx,sy=sx,sz=sx,geo=orb)=>{const n=mk(geo,m,x,y,z,g,.01);n.scale.set(sx,sy,sz);return n;};
  function mount(names,offset,tip=false){const target=tip&&ch.tip?ch.tip:names.map(n=>ch.root.getObjectByName(n)).find(Boolean);if(!target)return null;ch.root.updateMatrixWorld(true);const scale=target.getWorldScale(new THREE.Vector3()).x,q=target.getWorldQuaternion(new THREE.Quaternion()).invert(),g=new THREE.Group();g.quaternion.copy(q);g.scale.setScalar(.65/scale);g.position.set(...offset).applyQuaternion(q).multiplyScalar(1/scale);target.add(g);ch.morviaGearNodes.push(g);return g;}
  function crown(g,size=1){add(g,violet,0,0,0,.35*size,.09*size,.16*size,box);for(let i=-1;i<=1;i++)add(g,bone,i*.13*size,.13*size,0,.06*size,(i===0?.31:.22)*size,.06*size,tooth);add(g,soul,0,.04,.13*size,.07*size);}
  for(const it of selected){
    if(it.s==='armor')for(const side of [-1,1]){const g=mount(side<0?['LeftArm','LeftShoulder']:['RightArm','RightShoulder'],[side*.02,.04,0]);if(!g)continue;add(g,dark,0,0,0,.25,.16,.22);for(let i=0;i<3;i++)add(g,bone,side*(.12+i*.09),.09-i*.06,0,.06,.32,.09,tooth).rotation.z=-side*.7;add(g,soul,0,.03,.18,.07);}
    else if(it.s==='acc'){const g=mount(['Spine02','Spine2','Spine01','Spine','Chest'],[0,.03,.24]);if(g)crown(g,.8);}
    else if(it.h==='mage'){const g=mount(['RightHand','handslotr'],[0,.05,0],true);if(g){crown(g,1.1);add(g,soul,0,.35,0,.12,.24,.12);}}
    else if(it.h==='archer'){const g=mount(['LeftHand','handslotl'],[0,.04,.02]);if(!g)continue;add(g,violet,0,0,0,.1,.18,.1);for(const side of [-1,1]){add(g,bone,.1,side*.3,0,.07,.5,.06,box).rotation.z=side*.4;add(g,bone,.12,side*.58,0,.07,.26,.06,tooth).rotation.z=side<0?Math.PI:.2;}add(g,soul,0,0,.1,.08);}
    else if(it.h==='gunner'||it.h==='fighter')for(const side of [-1,1]){const g=mount(side<0?['LeftHand','handslotl']:['RightHand','handslotr'],[0,.03,.03]);if(!g)continue;add(g,dark,0,0,0,.13,.14,.13);if(it.h==='gunner'){add(g,bone,0,.09,.13,.17,.1,.34,box);add(g,soul,0,.09,.32,.06);crown(g,.65);}else{for(let i=-1;i<=1;i++)add(g,bone,i*.09,.19,.08,.045,.3,.05,tooth);add(g,soul,0,0,.14,.08);}}
    else {const g=mount(['RightHand','handslotr'],[0,.03,.02]);if(!g)continue;add(g,dark,0,0,0,.09,.18,.09);crown(g,.8);add(g,bone,0,.45,0,.12,.65,.07,box);add(g,bone,0,.87,0,.12,.3,.07,tooth);add(g,violet,0,.49,.07,.03,.52,.025,box);}
  }
}
