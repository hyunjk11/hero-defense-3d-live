import * as THREE from 'three';
import { mobileApp } from '../ui/mobile-mode.js';
import { scene } from './scene.js';
import { shareGeo, disposeOwned } from './toon.js';
const tube=shareGeo(new THREE.CylinderGeometry(1,1,1,8,1,true)),orb=shareGeo(new THREE.SphereGeometry(1,10,8)),up=new THREE.Vector3(0,1,0);
const hot=new THREE.Color(0xff2312);
const coldCut=[0xaadcff,0xe7f8ff,0xd4efff].map(v=>new THREE.Color(v));
const chargedCut=[0x0863ff,0x338cff,0x1775ff].map(v=>new THREE.Color(v));
export function createBeamVisual() {
  const g=new THREE.Group();g.name='continuous-tower-beam';
  const mat=(opacity)=>new THREE.MeshBasicMaterial({color:0x83edff,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const halo=new THREE.Mesh(tube,mat(.24)),core=new THREE.Mesh(tube,mat(.95)),tip=new THREE.Mesh(orb,mat(.8));core.material.blending=THREE.NormalBlending;core.renderOrder=1;g.add(halo,core,tip);g.visible=false;scene.add(g);
  return {g,halo,core,tip,delta:new THREE.Vector3(),mid:new THREE.Vector3()};
}
export function drawBeam(v,from,to,{heat=1,charge=0,color=0x83edff,flash=0,cut=false,heavyCut=false}={}) {
  v.delta.subVectors(to,from);const length=v.delta.length();v.g.visible=length>.01;if(!v.g.visible)return;
  v.mid.copy(from).lerp(to,.5);const width=(cut?.14:.045)+.055*Math.max(0,heat-1)+flash*.11;
  const blueCut=cut&&(!mobileApp||heavyCut);
  const paint=(m,i)=>blueCut?m.material.color.copy(coldCut[i]).lerp(chargedCut[i],charge):m.material.color.setHex(color).lerp(hot,charge);
  for(const [m,k,i] of [[v.halo,2.5,0],[v.core,1,1]]){m.position.copy(v.mid);m.quaternion.setFromUnitVectors(up,v.delta.clone().normalize());m.scale.set(width*k,length,width*k);paint(m,i); }
  v.tip.position.copy(to);v.tip.scale.setScalar(width*2.4);paint(v.tip,2);if(flash>.5)v.tip.material.color.setHex(0xffffff);
}
export function disposeBeamVisual(v){if(v){scene.remove(v.g);disposeOwned(v.g);}}
