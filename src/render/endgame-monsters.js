import * as THREE from 'three';
import {G} from '../core/state.js';
import {mk,toon,shareGeo} from './toon.js';
const box=shareGeo(new THREE.BoxGeometry(1,1,1)),orb=shareGeo(new THREE.SphereGeometry(1,10,8)),rod=shareGeo(new THREE.CylinderGeometry(1,1,1,8)),cone=shareGeo(new THREE.ConeGeometry(1,1,5)),gem=shareGeo(new THREE.OctahedronGeometry(1)),ring=shareGeo(new THREE.TorusGeometry(1,.09,6,24));
export function makeEndgameEnemy(E){
 const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);const abyss=E.family==='abyss',mats=[];
 const mat=(c,em=0)=>{const m=toon(c,{emissive:em,emissiveIntensity:.5});m.userData.e=m.emissive.clone();mats.push(m);return m;};
 const M={body:mat(abyss?0x5c487c:0x973e35),dark:mat(abyss?0x27283f:0x492c31),plate:mat(abyss?0x9b80bb:0xc46b46),bone:mat(abyss?0xd7c7e5:0xf1c997),wing:mat(abyss?0x64538b:0x8b3943),light:mat(abyss?0x83f1e0:0xffb752,abyss?0x237967:0x9a3f12)};
 const group=(p,x=0,y=0,z=0)=>{const n=new THREE.Group();n.position.set(x,y,z);p.add(n);return n;};
 const part=(p,key,x,y,z,sx,sy=sx,sz=sx,geo=box)=>{const n=mk(geo,M[key],x,y,z,p,.012);n.scale.set(sx,sy,sz);return n;};
 const beam=(p,a,b,r,key='bone')=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),q=new THREE.Vector3(...a).addScaledVector(v,.5);const n=part(p,key,q.x,q.y,q.z,r,v.length(),r,rod);n.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return n;};
 const legs=[],arms=[],wings=[],orbit=[],doors=[],tails=[];let head,core;
 function eye(p,x,y,z){part(p,'dark',x,y,z,.14,.09,.04,orb);part(p,'light',x,y,z+.035,.08,.045,.025,gem);}
 function headAt(p,x,y,z,long=false){const n=group(p,x,y,z);part(n,'body',0,0,0,.35,.25,.3,orb);part(n,'plate',0,-.05,long?.34:.18,.25,.14,long?.37:.2,box);for(const s of [-1,1]){eye(n,s*.22,.1,.2);part(n,'bone',s*.23,.34,-.05,.07,.4,.07,cone).rotation.z=s*.35;}return n;}
 function leg(p,s,z,height=.9){const n=group(p,s*.34,height,z);legs.push(n);beam(n,[0,0,0],[s*.18,-height*.55,.1],.1,'body');beam(n,[s*.18,-height*.55,.1],[s*.22,-height+.1,.2],.07);part(n,'dark',s*.22,-height+.08,.3,.25,.16,.4);return n;}
 function wing(p,s,y,z,large=1){const n=group(p,s*.3,y,z);wings.push(n);const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(s*1.6,.7);shape.lineTo(s*1.3,-.7);shape.lineTo(s*.75,-.35);shape.lineTo(s*.2,-.7);shape.closePath();const mesh=mk(new THREE.ShapeGeometry(shape),M.wing,0,0,0,n,0);mesh.material.side=THREE.DoubleSide;beam(n,[0,0,.02],[s*1.6,.7,.02],.045);beam(n,[0,0,.02],[s*1.3,-.7,.02],.035);beam(n,[0,0,.02],[s*.75,-.35,.02],.035);n.scale.setScalar(large);return n;}
 function tail(p,z,len=1){const n=group(p,0,.6,z);tails.push(n);beam(n,[0,0,0],[0,-.05,-len*.65],.11,'body');beam(n,[0,-.05,-len*.65],[0,.2,-len],.06,'plate');part(n,'bone',0,.3,-len,.13,.3,.13,cone);return n;}
 function humanoid(shield=false,lancer=false){leg(inner,-1,0,1.05);leg(inner,1,0,1.05);part(inner,'body',0,1.4,0,.7,.8,.48);part(inner,'plate',0,1.45,.26,.6,.55,.12,gem);head=headAt(inner,0,2,.05);for(const s of [-1,1]){const a=group(inner,s*.48,1.8,0);arms.push(a);part(a,'plate',0,0,0,.36,.28,.4,orb);beam(a,[0,0,0],[s*.1,-.65,.1],.1,'body');}
  const a=arms[0];if(shield){const d=group(a,0,-.35,.28);doors.push(d);part(d,'dark',0,0,0,.55,.9,.15,gem);part(d,'plate',0,0,.09,.45,.78,.08,gem);part(d,'light',0,.03,.15,.12,.24,.035,gem);}const b=arms[1];beam(b,[0,-.65,0],[0,lancer?1.3:.55,.15],.045);part(b,'bone',0,lancer?1.5:.7,.15,.18,lancer?.6:.5,.08,cone);core=part(inner,'light',0,1.5,.33,.1,.16,.05,gem);}
 if(E.form==='skitter'||E.form==='shardling'){
  const small=E.form==='shardling';part(inner,'body',0,.65,0,.4,.32,.65,orb);part(inner,'plate',0,.9,-.05,.36,.32,.5,gem);core=part(inner,'light',0,1.05,-.05,.13,.13,.22,gem);
  for(const s of [-1,1])for(const z of [-.4,0,.4]){const l=group(inner,s*.28,.65,z);legs.push(l);beam(l,[0,0,0],[s*.45,.1,-.15],.045);beam(l,[s*.45,.1,-.15],[s*.6,-.55,.12],.035,'plate');}
  head=headAt(inner,0,.7,.66);for(const s of [-1,1]){const a=group(head,s*.2,-.08,.2);arms.push(a);beam(a,[0,0,0],[s*.22,0,.3],.06,'plate');beam(a,[s*.22,0,.3],[0,0,.55],.04);}if(small)inner.scale.setScalar(.6);
 }else if(E.form==='gate'||E.form==='obelisk'||E.form==='riftking'){
  const king=E.form==='riftking',obelisk=E.form==='obelisk';part(inner,'dark',0,.25,0,obelisk?1.2:.8,.4,.7,gem);part(inner,'body',0,1.2,0,.55,1.6,.45,gem);core=part(inner,'light',0,1.55,.28,.18,.38,.1,gem);
  for(const s of [-1,1]){const a=group(inner,s*.55,1.6,0);arms.push(a);beam(a,[0,0,0],[s*.35,-.4,.15],.1,'plate');part(a,'bone',s*.35,-.6,.2,.14,.45,.12,cone);if(king){const b=group(inner,s*.45,1,0);arms.push(b);beam(b,[0,0,0],[s*.6,-.25,.2],.08,'plate');}}
  head=group(inner,0,2.2,0);part(head,'plate',0,0,0,.34,.4,.22,gem);eye(head,0,.05,.21);
  const halo=group(inner,0,1.5,-.2);orbit.push(halo);part(halo,'plate',0,0,0,king?1.3:1,king?1.3:1,.5,ring);for(let i=0;i<(king?6:3);i++){const a=i*Math.PI*2/(king?6:3);part(halo,'light',Math.sin(a)*(king?1.3:1),Math.cos(a)*(king?1.3:1),0,.1,.2,.08,gem).rotation.z=-a;}
  if(obelisk){for(const s of [-1,1])part(inner,'plate',s*.4,.6,-.15,.25,1.1,.25,cone);part(inner,'bone',0,2.65,0,.2,.7,.2,cone);}if(king)for(const s of [-1,1])part(head,'bone',s*.25,.5,0,.1,.75,.1,cone).rotation.z=s*.35;
 }else if(E.form==='lantern'){
  part(inner,'plate',0,0,0,.6,.4,.6,orb);part(inner,'dark',0,-.22,0,.4,.3,.4,orb);core=part(inner,'light',0,-.37,0,.25,.35,.25,gem);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,n=group(inner,Math.sin(a)*.35,-.2,Math.cos(a)*.35);arms.push(n);beam(n,[0,0,0],[Math.sin(a)*.12,-.6,Math.cos(a)*.12],.035,'light');beam(n,[Math.sin(a)*.12,-.6,Math.cos(a)*.12],[0,-1,0],.025,'plate');}
  const hoop=part(inner,'bone',0,.2,0,.65,.65,.65,ring);hoop.rotation.x=Math.PI/2;orbit.push(hoop);
 }else if(E.form==='sentinel'){
  part(inner,'body',0,.9,0,.6,.6,.48,orb);core=part(inner,'light',0,1,.5,.23,.3,.08,gem);for(const s of [-1,1]){for(const z of [-.35,.35])leg(inner,s,z,.7);const a=group(inner,s*.6,1.1,.15);arms.push(a);beam(a,[0,0,0],[s*.4,0,.35],.12,'plate');for(const t of [-1,1]){const d=group(a,s*.35,0,.4);doors.push(d);beam(d,[0,0,0],[t*.15,0,.4],.1,'plate');beam(d,[t*.15,0,.4],[0,0,.65],.055);}}head=headAt(inner,0,1.6,.1);
 }else if(E.form==='prism'){
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,n=group(inner,Math.sin(a)*.2,.8,Math.cos(a)*.2);legs.push(n);beam(n,[0,0,0],[Math.sin(a)*.5,-.7,Math.cos(a)*.5],.065,'plate');}
  core=part(inner,'light',0,1.3,0,.35,.6,.35,gem);for(let i=0;i<3;i++){const a=i*Math.PI*2/3,n=group(inner,Math.sin(a)*.45,1.5,Math.cos(a)*.45);orbit.push(n);part(n,'plate',0,0,0,.12,1.25,.12,cone);}part(inner,'bone',0,2.2,0,.18,.75,.18,cone);
 }else if(E.form==='shieldscale'||E.form==='lancer'){humanoid(E.form==='shieldscale',E.form==='lancer');if(E.form==='lancer')for(const s of [-1,1])wing(inner,s,1.7,-.18,.35);
 }else if(E.form==='raptor'){
  part(inner,'body',0,.85,0,.35,.4,.65,orb);leg(inner,-1,-.1,.8);leg(inner,1,-.1,.8);head=headAt(inner,0,1.35,.65,true);tail(inner,-.6,1.2);for(const s of [-1,1]){const a=group(inner,s*.3,1,.25);arms.push(a);beam(a,[0,0,0],[s*.2,-.3,.25],.045);part(a,'bone',s*.2,-.4,.3,.05,.2,.05,cone);}
 }else if(E.form==='tortoise'){
  part(inner,'body',0,.65,0,.65,.4,.85,orb);part(inner,'dark',0,1,0,.8,.55,.9,orb);for(const s of [-1,1])for(const z of [-.5,.5])leg(inner,s,z,.6);head=headAt(inner,0,.7,.85,true);tail(inner,-.9,.6);
  for(const s of [-1,1]){const n=group(inner,s*.3,1.3,-.1);arms.push(n);part(n,'plate',0,0,0,.23,.6,.23,rod).rotation.x=.3;part(n,'light',0,.33,-.1,.18,.04,.18,orb);}core=part(inner,'light',0,1.43,.2,.3,.06,.3,gem);
 }else if(E.form==='bannerwing'||E.form==='wyvern'){
  part(inner,'body',0,0,0,.3,.3,.6,orb);head=headAt(inner,0,.15,.55,true);for(const s of [-1,1])wing(inner,s,.18,0,E.form==='wyvern'?1:.8);tail(inner,-.6,.9);core=part(inner,'light',0,.25,.15,.12,.08,.2,gem);
  if(E.form==='bannerwing'){beam(inner,[0,.15,-.1],[0,1.1,-.1],.035);part(inner,'plate',.28,.82,-.1,.5,.4,.04);part(inner,'light',.28,.82,-.06,.12,.18,.03,gem);}
 }else if(E.form==='dragon'){
  part(inner,'body',0,1.15,0,.65,.6,1.15,orb);part(inner,'plate',0,1.16,.6,.45,.55,.6,orb);for(const s of [-1,1])for(const z of [-.7,.7])leg(inner,s,z,1.05);
  beam(inner,[0,1.35,.7],[0,2.05,1.25],.28,'body');head=headAt(inner,0,2.2,1.5,true);part(head,'dark',0,-.17,.3,.27,.06,.45);for(const s of [-1,1])for(let i=0;i<3;i++)part(head,'bone',s*.18,-.2,.2+i*.14,.035,.14,.035,cone).rotation.z=Math.PI;
  for(const s of [-1,1])wing(inner,s,1.7,-.1,1.45);tail(inner,-1.05,1.9);for(let i=0;i<5;i++)part(inner,'bone',0,1.7-i*.05,.5-i*.35,.12,.4,.15,cone);core=part(inner,'light',0,1.1,.96,.3,.35,.06,gem);
 }
 inner.scale.setScalar(1);inner.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(inner),scale=E.h/Math.max(.1,bounds.max.y-bounds.min.y);inner.scale.setScalar(scale);const y=E.fly?3:-bounds.min.y*scale;inner.position.y=y;
 const m={g,inner,mats,legs,arms,wings,proc:'endgame',form:E.form,mixer:null,acts:null,phase:0,speed:0};
 m.anim=(e,dt)=>{const last=m.last||=e.g.position.clone(),v=dt?Math.min(8,e.g.position.distanceTo(last)/dt):0;last.copy(e.g.position);m.speed+=(v-m.speed)*Math.min(1,dt*8);m.phase+=dt*(2+m.speed*3);
  if(e.dying!==undefined){inner.rotation.z=Math.min(1,(1.6-e.dying)/.8)*.8;return;}
  const charge=e.endCast?1-Math.max(0,e.endCast.t/e.endCast.duration):0,strike=(e.endStrikeT||0)/.45,a=Math.min(1,m.speed/2);
  inner.position.y=y+(E.fly?Math.sin(G.t*3)*.12:Math.abs(Math.sin(m.phase))*a*.025*scale);inner.rotation.x=e.flash>0?-.05:0;
  legs.forEach((n,i)=>n.rotation.x=Math.sin(m.phase+i%2*Math.PI)*a*.4);arms.forEach((n,i)=>{n.rotation.x=-charge*.65+strike*.55;n.rotation.z=(i%2?1:-1)*charge*.22;});
  wings.forEach((n,i)=>{n.rotation.y=(i%2?1:-1)*(E.fly?.3+Math.sin(G.t*7)*.35:e.endAwakened?.65:.25+charge*.2);});orbit.forEach((n,i)=>n.rotation.z+=dt*(.3+charge)*(i%2?-1:1));tails.forEach(n=>n.rotation.y=Math.sin(m.phase)*.2);doors.forEach((n,i)=>n.rotation.y=(i%2?1:-1)*(e.endRecover>0?.9:charge*.4));if(head)head.rotation.x=-charge*.15+strike*.15;if(core&&!e.flash)core.material.emissiveIntensity=.5+charge+(e.endAwakened?.4:0);
 };
 return m;
}
