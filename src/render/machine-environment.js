import * as THREE from 'three';
import {scene} from './scene.js';
import {IM,mk,toon,setI,hideI,shareGeo,shareMat} from './toon.js';
import {STAGE,T,GH,GW,NT,tileX,tileZ} from '../core/grid.js';
export const MACHINE=STAGE?.ch===8;
const steel=shareMat(toon(0x455866)),brass=shareMat(toon(0xb58c51)),dark=shareMat(toon(0x293843)),light=shareMat(toon(0xe7a051,{emissive:0x67371b,emissiveIntensity:.4}));
const box=shareGeo(new THREE.BoxGeometry(1,1,1)),cylinder=shareGeo(new THREE.CylinderGeometry(1,1,1,10));let crates,ribs;const fans=[];
function ensure(){if(crates)return;crates=IM(box,toon(0x5c6c73),NT,.018);ribs=IM(box,toon(0xb49865),NT*3,.012);}
export function refreshMachineTile(t){if(!MACHINE)return;ensure();const i=t.c*GH+t.r;hideI(crates,i);for(let k=0;k<3;k++)hideI(ribs,i*3+k);if(t.t!==T.FOREST)return;const h=(1.1+t.s*.5)*(.55+.45*t.hp/t.max),x=tileX(t.c),z=tileZ(t.r);setI(crates,i,x,h/2,z,1.1,h,1.1,t.s*.2);for(let k=0;k<3;k++)setI(ribs,i*3+k,x,h*(.2+k*.3),z,1.18,.07,1.18,t.s*.2);}
const block=(p,m,x,y,z,sx,sy,sz)=>{const n=mk(box,m,x,y,z,p,.015);n.scale.set(sx,sy,sz);return n;};
export function machinePylon(parent,t){const g=new THREE.Group();g.position.set(tileX(t.c),0,tileZ(t.r));parent.add(g);block(g,dark,0,.3,0,1.4,.6,1.4);block(g,steel,0,1.25,0,1,1.5,1);for(const y of [.65,1.2,1.75])block(g,brass,0,y,0,1.08,.12,1.08);block(g,light,0,1.3,.52,.3,.75,.04);for(const s of [-1,1]){const pipe=mk(cylinder,brass,s*.56,1.1,-.15,g,.01);pipe.scale.set(.08,1.7,.08);}block(g,dark,0,2.1,0,1.25,.2,1.25);}
export function machineDeco(){if(!MACHINE)return;const g=new THREE.Group();g.name='machine-factory';scene.add(g);
 for(let i=0;i<8;i++){const x=(i%2?1:-1)*(GW+4),z=(Math.floor(i/2)-1.5)*12,h=3+(i%3);block(g,steel,x,h/2-1.5,z,5,h,7);block(g,brass,x,h-1.35,z,5.2,.18,7.2);for(let j=0;j<3;j++){block(g,dark,x+(i%2?-2.53:2.53),h*.45-1,z+(j-1)*1.8,.08,1.2,1);block(g,light,x+(i%2?-2.59:2.59),h*.45-1,z+(j-1)*1.8,.03,.8,.5);}const chimney=mk(cylinder,dark,x,h+.9,z-1,g,.01);chimney.scale.set(.5,3.3,.5);for(const y of [h,h+1,h+2]){const rim=mk(cylinder,brass,x,y,z-1,g,.01);rim.scale.set(.58,.1,.58);}
  const fan=new THREE.Group();fan.position.set(x,h-.95,z+1.7);g.add(fan);fans.push(fan);for(let k=0;k<4;k++)block(fan,brass,0,.08,0,2,.06,.2).rotation.y=k*Math.PI/4;
 }
 for(const z of [-GH-3,GH+3]){block(g,dark,0,-.15,z,GW*2+9,.65,1.4);for(let x=-GW-4;x<GW+5;x+=3){const stripe=block(g,brass,x,.2,z,1,.025,1.4);stripe.rotation.y=.5;}for(const s of [-1,1]){const pipe=mk(cylinder,steel,s*(GW+2),.5,z,g,.01);pipe.scale.set(.45,4,.45);pipe.rotation.z=Math.PI/2;}}
}
export function updateMachineDeco(t){for(const f of fans)f.rotation.y=t*.8;}
