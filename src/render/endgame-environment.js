import * as THREE from 'three';
import {scene} from './scene.js';
import {batchMachineParts} from './machine-batch.js';
import {IM,mk,toon,setI,hideI,shareGeo,shareMat} from './toon.js';
import {STAGE,T,GH,GW,NT,tileX,tileZ} from '../core/grid.js';
export const ENDGAME=STAGE?.ch===9||STAGE?.ch===10;
const abyss=STAGE?.ch===9,box=shareGeo(new THREE.BoxGeometry(1,1,1)),gem=shareGeo(new THREE.OctahedronGeometry(1)),cone=shareGeo(new THREE.ConeGeometry(1,1,6)),ring=shareGeo(new THREE.TorusGeometry(1,.12,6,24));
let crystals;const stone=shareMat(toon(abyss?0x5d4a73:0x7f4e43)),edge=shareMat(toon(abyss?0x9b7cba:0xc58d5d)),light=shareMat(toon(abyss?0x8ddfce:0xf3ae56,{emissive:abyss?0x245c53:0x743b19,emissiveIntensity:.5}));
const part=(p,m,x,y,z,sx,sy,sz,geo=box)=>{const n=mk(geo,m,x,y,z,p,.014);n.scale.set(sx,sy,sz);return n;};
export function refreshEndgameTile(t){if(!ENDGAME)return;if(!crystals)crystals=IM(abyss?gem:cone,toon(abyss?0x87769e:0xc07350),NT*3,.015);const i=(t.c*GH+t.r)*3;for(let k=0;k<3;k++)hideI(crystals,i+k);if(t.t!==T.FOREST)return;const h=(1.1+t.s*.5)*(.55+.45*t.hp/t.max),x=tileX(t.c),z=tileZ(t.r);for(let k=0;k<3;k++)setI(crystals,i+k,x+(k-1)*.42,h*(k===1?.55:.4),z+(k===1?-.1:.15),.3,h*(k===1?1:.7),.32,t.s+k);}
export function endgamePylon(parent,t){const g=new THREE.Group();g.position.set(tileX(t.c),0,tileZ(t.r));parent.add(g);part(g,stone,0,.3,0,1.5,.6,1.5);if(abyss){for(const s of [-1,1])part(g,edge,s*.5,1.2,0,.3,1.7,.4,gem);part(g,light,0,1.5,0,.25,.75,.25,gem);}else{part(g,stone,0,1.1,0,1.1,1.7,1.1);part(g,edge,0,2,0,1.4,.2,1.4);for(const s of [-1,1])part(g,edge,s*.46,2.3,0,.3,.5,1.3);part(g,light,0,1.3,.57,.22,.6,.04);}if(!abyss)batchMachineParts(g);}
export function endgameDeco(){if(!ENDGAME)return;const g=new THREE.Group();g.name=abyss?'abyss-rift-gates':'dragon-citadel';scene.add(g);
 for(let i=0;i<6;i++){const x=(i%2?1:-1)*(GW+4),z=(Math.floor(i/2)-1)*13;if(abyss){for(const s of [-1,1])part(g,stone,x+s*2,1,z,1.4,5,1.3,gem);const n=part(g,edge,x,3,z,3,3,1,ring);n.rotation.y=i%2?-.35:.35;part(g,light,x,3,z,.5,1.4,.4,gem);}else{part(g,stone,x,1.8,z,5,5,6);part(g,edge,x,4.5,z,5.4,.4,6.4);for(let j=0;j<4;j++)part(g,edge,x-2+j*1.35,5,z, .7,1,6.3);part(g,light,x+(i%2?-2.53:2.53),2,z,.06,1.2,.6);}}
 for(const z of [-GH-4,GH+4]){if(abyss){for(let x=-GW;x<GW;x+=6)part(g,light,x,-.3,z,.45,1.8,.45,gem);}else{part(g,stone,0,1,z,GW*2+8,3,1.4);for(let x=-GW-3;x<GW+4;x+=3)part(g,edge,x,2.8,z,1.2,.8,1.7);}}
 if(!abyss)batchMachineParts(g);
}
