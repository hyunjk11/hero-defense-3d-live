import * as THREE from 'three';
import { mk, toon, shareGeo, disposeObj } from './toon.js';
// Additive, bone-mounted cosmetics only. No item, stat, save or attack changes.
const box=shareGeo(new THREE.BoxGeometry(1,1,1));
const gem=shareGeo(new THREE.OctahedronGeometry(1));
const rod=shareGeo(new THREE.CylinderGeometry(1,1,1,8));
const ring=shareGeo(new THREE.TorusGeometry(1,.09,5,16));
const blade=shareGeo(new THREE.ConeGeometry(1,1,4));
export function updateAbyssalGear(ch,items=[]) {
  const selected=items.filter(it=>it?.set==='abyssal'&&it.g===4&&['weapon','armor','acc'].includes(it.s));
  const signature=selected.map(it=>`${it.s}:${it.h||''}:${it.id}`).sort().join('|');
  if(ch.abyssalGearSignature===signature)return;
  for(const n of ch.abyssalGearNodes||[]){n.removeFromParent();disposeObj(n);}
  for(const m of new Set((ch.mats||[]).filter(m=>m.userData.abyssalGear)))m.dispose();
  ch.mats=(ch.mats||[]).filter(m=>!m.userData.abyssalGear);
  ch.abyssalGearNodes=[];ch.abyssalGearSignature=signature;
  if(!selected.length)return;
  let palette;
  function materials(){if(palette)return palette;const make=(color,emissive=0)=>{const m=toon(color,{emissive,emissiveIntensity:.65});m.userData.e=m.emissive.clone();m.userData.abyssalGear=true;ch.mats.push(m);return m;};return palette={metal:make(0x152b48),edge:make(0xb9dbea),light:make(0x80e9ff,0x226b98)};}
  function mount(names,offset,slot,tip=false){
    const target=tip&&ch.tip?ch.tip:names.map(n=>ch.root.getObjectByName(n)).find(Boolean);if(!target)return null;
    ch.root.updateMatrixWorld(true);const scale=target.getWorldScale(new THREE.Vector3()).x;
    if(!Number.isFinite(scale)||Math.abs(scale)<1e-6)return null;
    const q=target.getWorldQuaternion(new THREE.Quaternion()).invert(),g=new THREE.Group();
    g.name=`abyssal-${slot}`;g.quaternion.copy(q);g.scale.setScalar(.65/scale);
    g.position.set(...offset).applyQuaternion(q).multiplyScalar(1/scale);target.add(g);ch.abyssalGearNodes.push(g);materials();return g;
  }
  const add=(p,k,x,y,z,sx,sy=sx,sz=sx,geo=box)=>{const m=mk(geo,palette[k],x,y,z,p,.009);m.scale.set(sx,sy,sz);return m;};
  function star(p,x=0,y=0,z=0,s=.18){
    add(p,'edge',x,y,z,s*.38,s*2.2,s*.2,gem);
    add(p,'edge',x,y,z,s*1.6,s*.4,s*.2,gem);
    add(p,'light',x,y,z+.035,s*.45,s*.6,s*.28,gem);
  }
  for(const it of selected){
    if(it.s==='armor'){
      for(const side of [-1,1]){const p=mount(side<0?['LeftArm','LeftShoulder']:['RightArm','RightShoulder'],[side*.03,.05,0],'armor');if(!p)continue;
        add(p,'metal',0,0,0,.32,.22,.3,gem);add(p,'edge',side*.16,.05,0,.13,.26,.23,gem);star(p,0,.02,.22,.12);}
      const p=mount(['Spine02','Spine2','Spine01','Spine','Chest'],[0,.05,-.2],'armor');if(p){add(p,'metal',0,0,0,.35,.5,.1,gem);star(p,0,.04,-.08,.2);}
    } else if(it.s==='acc'){
      const p=mount(['Spine02','Spine2','Spine01','Spine','Chest'],[0,.03,.24],'acc');if(!p)continue;
      add(p,'edge',0,.18,0,.018,.3,.018,rod);add(p,'metal',0,0,0,.23,.3,.07,gem);
      add(p,'edge',0,0,.06,.23,.23,.23,ring);star(p,0,0,.1,.16);
    } else if(it.h==='mage'){
      const p=mount(['RightHand','handslotr'],[0,.05,0],'weapon-mage');if(!p)continue;
      add(p,'metal',0,.04,0,.07,.35,.07,rod);add(p,'edge',0,.3,0,.3,.3,.3,ring);star(p,0,.3,.04,.22);
      for(const side of [-1,1])add(p,'light',side*.29,.3,0,.06,.12,.06,gem);
    } else if(it.h==='archer'){
      const p=mount(['LeftHand','handslotl'],[0,.03,.02],'weapon-archer');if(!p)continue;
      add(p,'metal',0,0,0,.1,.22,.1);for(const side of [-1,1]){
        add(p,'metal',.12,side*.27,0,.1,.48,.1).rotation.z=side*.35;
        add(p,'edge',.2,side*.52,0,.11,.3,.07,blade).rotation.z=side<0?Math.PI:0;
        add(p,'light',.09,side*.25,.07,.026,.38,.025).rotation.z=side*.35;}
      star(p,0,0,.11,.13);
    } else if(it.h==='gunner'||it.h==='fighter'){
      for(const side of [-1,1]){const p=mount(side<0?['LeftHand','handslotl']:['RightHand','handslotr'],[0,.025,.04],`weapon-${it.h}`);if(!p)continue;
        add(p,'metal',0,0,0,.2,.19,.22);
        if(it.h==='gunner'){add(p,'metal',0,.1,.21,.17,.12,.4);add(p,'edge',0,.1,.4,.2,.15,.08);add(p,'light',0,.17,.22,.045,.025,.3);star(p,side*.11,.06,.12,.08);}
        else{add(p,'edge',0,.12,.11,.28,.1,.17);for(let i=-1;i<=1;i++)add(p,'light',i*.085,.13,.19,.045,.07,.09,gem);star(p,0,.02,.15,.12);}
      }
    } else if(it.h==='warrior'){
      const p=mount(['RightHand','handslotr'],[0,.03,.02],'weapon-warrior');if(!p)continue;
      add(p,'metal',0,.08,0,.09,.25,.09);add(p,'edge',0,.23,0,.43,.08,.1);
      add(p,'metal',0,.6,0,.19,.72,.075,gem);add(p,'edge',0,1.03,0,.13,.32,.065,blade);
      add(p,'light',0,.59,.065,.03,.6,.025);star(p,0,.25,.08,.12);
    }
  }
}
