import * as THREE from 'three';
import {batchMachineParts} from './machine-batch.js';
import {G} from '../core/state.js';
import {mk,toon,shareGeo} from './toon.js';
const box=shareGeo(new THREE.BoxGeometry(1,1,1)),orb=shareGeo(new THREE.SphereGeometry(1,10,8)),rod=shareGeo(new THREE.CylinderGeometry(1,1,1,10)),cone=shareGeo(new THREE.ConeGeometry(1,1,6)),torus=shareGeo(new THREE.TorusGeometry(1,.13,6,20));
export function makeMachineEnemy(E){
 const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);const mats=[];
 const material=(c,glow=0)=>{const m=toon(c,{emissive:glow,emissiveIntensity:.5});m.userData.e=m.emissive.clone();mats.push(m);return m;};
 const M={steel:material(0x567082),dark:material(0x233544),silver:material(0xb4c3c6),brass:material(0xc88f46),orange:material(0xea873c),red:material(0x9b4441),core:material(E.form==='drone'?0x9ef5bd:0xffc66a,E.form==='drone'?0x28794a:0x873715),glass:material(0x6bd0da,0x225268)};
 const group=(p,x=0,y=0,z=0)=>{const n=new THREE.Group();n.position.set(x,y,z);p.add(n);return n;};
 const part=(p,key,x,y,z,sx,sy=sx,sz=sx,geo=box)=>{const n=mk(geo,M[key],x,y,z,p,.014);n.scale.set(sx,sy,sz);return n;};
 const beam=(p,a,b,r,key='silver')=>{const from=new THREE.Vector3(...a),v=new THREE.Vector3(...b).sub(from);const m=part(p,key,...from.addScaledVector(v,.5).toArray(),r,v.length(),r,rod);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;};
 const legs=[],arms=[],wheels=[],rotors=[],wings=[],panels=[],barrels=[];let head,core,tail;
 const disk=(p,x,y,z,r,key='brass')=>{const n=part(p,key,x,y,z,r,.08,r,rod);n.rotation.x=Math.PI/2;return n;};
 const gear=(p,x,y,z,r)=>{const n=group(p,x,y,z);disk(n,0,0,0,r);for(let i=0;i<8;i++){const a=i*Math.PI/4,m=part(n,'brass',Math.sin(a)*r,Math.cos(a)*r,0,r*.3,r*.3,.12);m.rotation.z=-a;}disk(n,0,0,.08,r*.4,'dark');wheels.push(n);return n;};
 const eye=(p,x,y,z)=>{part(p,'dark',x,y,z,.23,.12,.06);part(p,'core',x,y,z+.04,.15,.055,.03);};
 const vent=(p,x,y,z,n=3)=>{for(let i=0;i<n;i++)part(p,'dark',x,y+i*.09,z,.28,.035,.025);};
 const cannon=(p,x,y,z,len=1)=>{const n=group(p,x,y,z);part(n,'dark',0,0,len*.4,.16,len,.16,rod).rotation.x=Math.PI/2;part(n,'brass',0,0,len*.8,.23,.14,.23,rod).rotation.x=Math.PI/2;disk(n,0,0,len*.89,.145,'dark');barrels.push(n);return n;};
 function track(p,side){const t=group(p,side*.62,.34,0);part(t,'dark',0,0,0,.36,.38,1.55);for(const z of [-.55,0,.55]){const wh=gear(t,0,0,z,.2);wh.rotation.y=Math.PI/2;}for(let i=0;i<7;i++)for(const y of [-.21,.21])part(t,'silver',0,y,-.66+i*.22,.4,.055,.1);return t;}
 function pistonLeg(p,side,height=1.1){const l=group(p,side*.38,height,0);legs.push(l);part(l,'steel',0,-.27,0,.29,.52,.3);disk(l,0,-.5,.18,.14);beam(l,[0,-.5,0],[side*.06,-height+.12,.05],.09);beam(l,[side*.14,-.2,-.12],[side*.17,-height+.15,-.1],.05,'brass');part(l,'dark',side*.06,-height+.08,.16,.37,.18,.54);return l;}
 if(E.form==='hound'){
  part(inner,'steel',0,.85,-.05,.55,.45,1.1);part(inner,'brass',0,1.08,-.12,.6,.12,.65);core=part(inner,'core',0,1.17,-.12,.12,.08,.35);gear(inner,0,1,-.62,.24);
  for(const s of [-1,1])for(const z of [-.48,.42]){const l=group(inner,s*.3,.8,z);legs.push(l);beam(l,[0,0,0],[s*.12,-.32,-.18],.085,'brass');beam(l,[s*.12,-.32,-.18],[s*.16,-.68,.08],.065);part(l,'dark',s*.16,-.72,.12,.16,.11,.28);}
  head=group(inner,0,1.03,.62);part(head,'steel',0,0,0,.47,.36,.45);part(head,'silver',0,-.07,.3,.32,.18,.28);part(head,'dark',0,-.15,.3,.28,.04,.3);for(const s of [-1,1]){eye(head,s*.16,.08,.22);part(head,'brass',s*.17,.28,-.08,.12,.35,.16,cone);}tail=group(inner,0,.97,-.62);beam(tail,[0,0,0],[0,.4,-.4],.055);gear(tail,0,.45,-.42,.16);
 }else if(E.form==='drone'){
  part(inner,'silver',0,0,0,.48,.28,.4,orb);part(inner,'brass',0,.08,0,.4,.18,.33,orb);head=group(inner,0,-.13,.28);eye(head,0,0,.08);core=part(inner,'core',0,.25,0,.1,.07,.1,orb);
  for(const s of [-1,1]){beam(inner,[s*.22,.1,0],[s*.9,.12,0],.07);const r=group(inner,s*.92,.16,0);rotors.push(r);part(r,'dark',0,0,0,.11,.12,.11,rod);part(r,'brass',0,.06,0,.9,.04,.1);part(r,'brass',0,.06,0,.1,.04,.9);const hoop=part(inner,'silver',s*.92,.13,0,.53,.53,.53,torus);hoop.rotation.x=Math.PI/2;
   const a=group(inner,s*.24,-.15,.05);arms.push(a);beam(a,[0,0,0],[s*.14,-.35,.12],.065,'brass');beam(a,[s*.14,-.35,.12],[s*.08,-.58,.28],.045);for(const q of [-1,1])part(a,'dark',s*.08+q*.07,-.62,.29,.055,.18,.1);}
  part(inner,'core',0,.1,.38,.22,.05,.04);part(inner,'core',0,.1,.38,.05,.21,.04);
 }else if(E.form==='wasp'){
  for(let i=0;i<3;i++){part(inner,i%2?'dark':'orange',0,0,.24-i*.3,.24-i*.025,.22-i*.02,.28,orb);const ring=part(inner,'brass',0,0,-i*.3,.25,.25,.25,torus);}
  head=group(inner,0,.06,.5);part(head,'steel',0,0,0,.34,.28,.3);for(const s of [-1,1]){eye(head,s*.1,.04,.17);beam(head,[s*.1,.12,0],[s*.26,.38,.12],.025);for(const z of [0,-.32]){const w=group(inner,s*.17,.12,z);wings.push(w);part(w,'silver',s*.5,0,-.15,1.05,.045,.3).rotation.y=s*.23;}beam(inner,[s*.16,-.13,.1],[s*.3,-.35,.23],.035,'dark');}
  tail=group(inner,0,0,-.66);part(tail,'brass',0,0,0,.1,.6,.1,cone).rotation.x=-Math.PI/2;core=part(inner,'glass',0,.2,-.3,.1,.06,.15);
 }else if(E.form==='bulwark'){
  track(inner,-1);track(inner,1);part(inner,'steel',0,.93,0,.9,1.1,.72);part(inner,'brass',0,1.5,0,1.1,.16,.8);head=group(inner,0,1.76,0);part(head,'dark',0,0,0,.55,.32,.45);eye(head,0,0,.25);
  for(const s of [-1,1]){const arm=group(inner,s*.52,1.25,0);arms.push(arm);beam(arm,[0,0,0],[s*.18,-.3,.3],.12);const shield=group(inner,s*.28,1,.48);panels.push(shield);part(shield,'steel',0,0,0,.52,.91,.17);part(shield,'silver',0,.39,.07,.57,.08,.12);part(shield,'brass',0,-.36,.07,.52,.13,.12);for(const y of [-.23,.23])disk(shield,s*.13,y,.13,.035);}
  core=part(inner,'core',0,1,.43,.2,.38,.07);vent(inner,0,1.22,-.38,3);
 }else if(E.form==='crawler'){
  track(inner,-1);track(inner,1);part(inner,'steel',0,.65,0,1.2,.45,1.25);part(inner,'brass',0,.92,-.05,.7,.25,.8,rod);head=group(inner,0,1.05,-.12);part(head,'steel',0,0,0,.75,.45,.66);const tube=cannon(head,0,.1,.23,1.25);tube.rotation.x=-.15;for(const s of [-1,1]){part(inner,'red',s*.42,.88,-.42,.15,.23,.3);vent(inner,s*.28,.58,-.64,3);}core=part(head,'core',0,.29,-.08,.18,.055,.25);eye(head,.27,0,.34);
 }else if(E.form==='riveter'){
  pistonLeg(inner,-1);pistonLeg(inner,1);part(inner,'steel',0,1.4,0,.64,.7,.45);part(inner,'orange',0,1.65,-.05,.75,.18,.5);head=group(inner,0,2.05,.06);part(head,'silver',0,0,0,.45,.35,.38);eye(head,0,.04,.21);beam(head,[.18,.17,0],[.18,.53,0],.025,'brass');
  const gun=group(inner,.43,1.7,.05);arms.push(gun);part(gun,'dark',.05,-.22,.14,.32,.5,.4);for(const x of [-.1,.1])cannon(gun,x,-.18,.3,.7);const a=group(inner,-.4,1.65,0);arms.push(a);beam(a,[0,0,0],[-.1,-.5,.12],.11);part(a,'brass',-.1,-.55,.15,.24,.2,.3);disk(inner,0,1.5,-.4,.38);core=part(inner,'core',0,1.45,.25,.23,.15,.05);for(let i=0;i<4;i++)part(inner,'brass',-.37,1.25+i*.12,-.3,.12,.08,.15);
 }else if(E.form==='foundry'){
  part(inner,'dark',0,1.1,0,1.15,1.3,1);part(inner,'brass',0,1.86,0,1.3,.22,1.1);part(inner,'steel',0,2.04,0,.9,.22,.8);core=part(inner,'core',0,1.1,.51,.72,.75,.08);
  for(const s of [-1,1]){const door=group(inner,s*.35,1.12,.59);panels.push(door);part(door,'steel',0,0,0,.43,.88,.12);vent(door,0,-.15,.08,4);for(let i=0;i<3;i++){const l=group(inner,s*.52,.9,.5-i*.45);legs.push(l);beam(l,[0,0,0],[s*.5,-.2,-.1],.13,'brass');beam(l,[s*.5,-.2,-.1],[s*.65,-.82,.1],.085);part(l,'dark',s*.65,-.84,.1,.28,.13,.27);}const pipe=part(inner,'steel',s*.42,2.35,-.3,.16,.85,.16,rod);part(inner,'dark',s*.42,2.8,-.3,.12,.03,.12,rod);part(inner,'brass',s*.42,2.55,-.3,.2,.1,.2,rod);}
  head=group(inner,0,2.24,.15);eye(head,0,0,.25);
 }else if(E.form==='overseer'){
  for(const s of [-1,1]){pistonLeg(inner,s,1.25);part(inner,'brass',s*.38,.77,.2,.35,.42,.17);}
  part(inner,'dark',0,1.6,0,1,.8,.65);part(inner,'steel',0,1.95,0,1.22,.52,.8);core=part(inner,'core',0,1.72,.4,.25,.25,.09,orb);gear(inner,0,1.72,.4,.34);
  for(const s of [-1,1]){const panel=group(inner,s*.3,1.7,.45);panels.push(panel);part(panel,'steel',s*.05,0,0,.38,.65,.13);vent(panel,s*.05,-.15,.08,4);const a=group(inner,s*.78,2.13,0);arms.push(a);part(a,'brass',0,0,0,.55,.48,.62);beam(a,[0,-.2,0],[s*.08,-.72,.1],.15);if(s>0){part(a,'dark',.08,-.83,.2,.43,.4,.65);cannon(a,.08,-.82,.42,.55);}else{gear(a,-.08,-.83,.28,.35);for(let i=0;i<6;i++){const ang=i*Math.PI/3;part(a,'silver',-.08+Math.sin(ang)*.38,-.83+Math.cos(ang)*.38,.28,.11,.2,.1,cone).rotation.z=-ang;}}
   const shoulder=cannon(inner,s*.6,2.55,-.08,.65);shoulder.rotation.x=-.18;part(inner,'red',s*.6,2.5,-.37,.43,.45,.3);}
  head=group(inner,0,2.57,.07);part(head,'silver',0,0,0,.52,.4,.47);eye(head,0,.03,.26);part(head,'brass',0,.24,0,.65,.13,.52);for(const s of [-1,1])beam(head,[s*.24,.2,0],[s*.36,.55,0],.045);part(head,'core',0,.4,0,.08,.2,.1,cone);for(const s of [-1,1])part(inner,'brass',s*.3,2,-.5,.1,.8,.1,rod);
 }
 inner.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(inner),scale=E.h/Math.max(.1,b.max.y-b.min.y),y=E.fly?3:-b.min.y*scale;inner.scale.setScalar(scale);inner.position.y=y;
 batchMachineParts(inner);
 const rest=barrels.map(n=>n.position.clone()),m={g,inner,mats,legs,arms,panels,wheels,rotors,wings,core,proc:'machine',form:E.form,mixer:null,acts:null,phase:0,speed:0};
 m.anim=(e,dt)=>{const last=m.last||=e.g.position.clone(),v=dt?Math.min(8,e.g.position.distanceTo(last)/dt):0;last.copy(e.g.position);m.speed+=(v-m.speed)*Math.min(1,dt*8);m.phase+=dt*(2+m.speed*3);
  if(e.dying!==undefined){inner.rotation.z=Math.min(1,(1.6-e.dying)/.7)*.85;return;}
  const c=e.machineCast,charge=c?Math.max(0,1-c.t/c.duration):0,strike=(e.machineStrikeT||0)/.4,a=Math.min(1,m.speed/2);
  inner.position.y=y+(E.fly?Math.sin(G.t*3)*.12:Math.abs(Math.sin(m.phase))*a*.025*scale);inner.rotation.x=e.flash>0?-.04:0;
  legs.forEach((l,i)=>l.rotation.x=Math.sin(m.phase+i%2*Math.PI)*a*(E.form==='hound'?.55:.25));wheels.forEach(w=>w.rotation.z+=dt*m.speed*1.6);rotors.forEach(r=>r.rotation.y+=dt*20);wings.forEach((w,i)=>w.rotation.z=Math.sin(G.t*24+i%2*Math.PI)*.28);
  arms.forEach((arm,i)=>{arm.rotation.x=-charge*.65+strike*.65;arm.rotation.z=E.form==='drone'?(i?1:-1)*(.3-charge*.5):0;});barrels.forEach((n,i)=>{n.position.copy(rest[i]);n.position.z-=strike*.18;});
  panels.forEach((p,i)=>{const opened=e.machineRecover>0||e.machineAwakened||c?.kind==='forge';p.rotation.y=opened?(i?1:-1)*.95:0;});if(head)head.rotation.x=-charge*.09;if(tail)tail.rotation.y=Math.sin(m.phase)*.15;if(core&&!e.flash)core.material.emissiveIntensity=.5+charge*.6+(e.machineAwakened?.4:0);
 };
 return m;
}
