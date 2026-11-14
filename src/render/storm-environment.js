import * as THREE from 'three';
import { scene } from './scene.js';
import { IM,mk,toon,setI,hideI,shareGeo,shareMat } from './toon.js';
import { STAGE,T,GH,GW,NT,tileX,tileZ } from '../core/grid.js';
export const STORM=STAGE?.ch===7;
let stems,fronds;const currents=[];
const rockMat=shareMat(toon(0x385570)),stoneMat=shareMat(toon(0x6e98a7)),brassMat=shareMat(toon(0xb4a477));
function ensurePalms(){if(stems)return;stems=IM(new THREE.CylinderGeometry(.12,.19,1,6),toon(0x6c7773),NT,.018);fronds=IM(new THREE.SphereGeometry(1,6,4),toon(0x528b91),NT*5,.015);}
export function refreshStormTile(t){
  if(!STORM)return;ensurePalms();const i=t.c*GH+t.r;hideI(stems,i);for(let k=0;k<5;k++)hideI(fronds,i*5+k);if(t.t!==T.FOREST)return;
  const k=.7+.3*t.hp/t.max,x=tileX(t.c),z=tileZ(t.r),h=(1.35+t.s*.45)*k;setI(stems,i,x-.16,h/2,z,k,h,k,0,-.18);
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5+t.s;setI(fronds,i*5+j,x+.12+Math.sin(a)*.35,h-.05,z+Math.cos(a)*.35,.19*k,.08*k,.7*k,a,-.15);}
}
export function stormPylon(parent,t){const g=new THREE.Group();g.position.set(tileX(t.c),0,tileZ(t.r));parent.add(g);mk(new THREE.CylinderGeometry(.7,.9,.5,6),rockMat,0,.25,0,g);mk(new THREE.CylinderGeometry(.26,.4,1.5,6),stoneMat,0,1.15,0,g);mk(new THREE.ConeGeometry(.18,.85,4),brassMat,0,2.18,0,g);for(const y of [1,1.4,1.8]){const ring=mk(new THREE.TorusGeometry(.35,.055,6,16),brassMat,0,y,0,g,0);ring.rotation.x=Math.PI/2;}}
export function stormDeco(){
  if(!STORM)return;const g=new THREE.Group();g.name='storm-islands-and-currents';scene.add(g);
  const stone=shareGeo(new THREE.CylinderGeometry(1,1.5,1,6)),cloud=shareGeo(new THREE.SphereGeometry(1,8,6)),cloudMat=shareMat(toon(0x96b4bf));
  for(let i=0;i<10;i++){const side=i%2?1:-1,x=side*(GW+6+i%3*4),z=(Math.floor(i/2)-2)*11,h=3+i%3;
    const island=mk(stone,rockMat,x,-2,z,g,0);island.scale.set(3+i%3,h,2.8);const top=mk(stone,stoneMat,x,h*.5-2,z,g,0);top.scale.set(3+i%3,.35,2.8);
    if(i%2===0){const mast=mk(new THREE.CylinderGeometry(.15,.23,3,6),brassMat,x,h*.5-.45,z,g,0);mast.rotation.z=-.15;const sail=mk(new THREE.ConeGeometry(.85,1.5,3),cloudMat,x+.3,h*.5+.3,z,g,0);sail.rotation.y=.8;}
    for(let j=0;j<3;j++){const m=mk(cloud,cloudMat,x+(j-1)*1.6,-.4,z-2,g,0);m.scale.set(2,.6,1.1);}
  }
  for(const[x,z,angle]of [[-29,0,0],[29,0,Math.PI],[0,-22,Math.PI/2],[0,22,-Math.PI/2]]){
    const group=new THREE.Group();group.position.set(x,-.72,z);group.rotation.y=angle;g.add(group);
    for(let i=0;i<4;i++){const curve=new THREE.EllipseCurve(0,0,1+i*.8,2+i*.6,-1.8,1.8,false,0),points=curve.getPoints(32).map(p=>new THREE.Vector3(p.x,0,p.y));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8dc5d0,transparent:true,opacity:.35}));group.add(line);currents.push({line,base:i,origin:line.position.clone()});}
  }
}
export function updateStormDeco(t){for(const c of currents){c.line.position.x=Math.sin(t*.55+c.base)*.4;c.line.material.opacity=.18+(Math.sin(t*.7+c.base)+1)*.12;}}
