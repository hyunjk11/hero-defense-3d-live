import * as THREE from 'three';
import { G } from '../core/state.js';
import { mk, shareGeo, toon } from './toon.js';
const cache=new Map();
const geo=(kind,...args)=>{const k=kind+args.join(',');if(!cache.has(k))cache.set(k,shareGeo(new THREE[kind](...args)));return cache.get(k);};
const orb=geo('SphereGeometry',1,10,8),rod=geo('CylinderGeometry',1,1,1,7),cone=geo('ConeGeometry',1,1,5),box=geo('BoxGeometry',1,1,1);
const feather=(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(.3,.25);s.lineTo(1,.1);s.lineTo(.76,-.12);s.lineTo(.95,-.22);s.lineTo(.25,-.25);s.closePath();return shareGeo(new THREE.ExtrudeGeometry(s,{depth:.06,bevelEnabled:false}));})();

export function makeStormEnemy(E){
  const g=new THREE.Group(),inner=new THREE.Group();g.add(inner);
  const mats=[],mat=(color,emissive=0)=>{const m=toon(color,{emissive,emissiveIntensity:.4});m.userData.e=m.emissive.clone();mats.push(m);return m;};
  const M={navy:mat(0x264564),blue:mat(0x4c89a3),pale:mat(0xd0e8e4),gold:mat(0xcab57b),dark:mat(0x192837),shell:mat(0x8b6f9f),eye:mat(0x9efff2,0x226767),light:mat(0xb6efff,0x347699)};
  const group=(p,x=0,y=0,z=0)=>{const n=new THREE.Group();n.position.set(x,y,z);p.add(n);return n;};
  const part=(p,key,x,y,z,sx,sy=sx,sz=sx,geometry=orb)=>{const n=mk(geometry,M[key],x,y,z,p,.014);n.scale.set(sx,sy,sz);return n;};
  const beam=(p,a,b,r,key='gold')=>{const from=new THREE.Vector3(...a),d=new THREE.Vector3(...b).sub(from);const n=part(p,key,...from.addScaledVector(d,.5).toArray(),r,d.length(),r,rod);n.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return n;};
  const eyes=(p,y,z,x=.18)=>{for(const side of [-1,1]){part(p,'dark',side*x,y,z,.095,.07,.06);part(p,'eye',side*x,y,z+.045,.045,.04,.025);}};
  const legs=[],arms=[],wings=[],segments=[],tentacles=[],rings=[],plates=[];let head,core,tail;
  const wing=(p,side,length=1.3)=>{const w=group(p,side*.35,0,0);wings.push(w);for(let i=0;i<5;i++){const f=part(w,i%2?'blue':'pale',side*(.1+i*.18),.12-i*.07,-i*.12,length-i*.12,.8,.85,feather);f.rotation.y=side<0?Math.PI:0;f.rotation.z=side*(.15+i*.09);}return w;};
  const ring=(p,x,y,z,r,key='gold')=>{const n=mk(geo('TorusGeometry',r,.04,6,28),M[key],x,y,z,p,0);rings.push(n);return n;};
  function birdHead(p,big=false){const h=group(p,0,0,0);part(h,'pale',0,0,0,.27,.3,.27);eyes(h,.06,.23,.17);part(h,'gold',0,-.035,.46,.12,big?.65:.55,.12,cone).rotation.x=Math.PI/2;for(let i=0;i<3;i++)part(h,'blue',(i-1)*.12,.29,-.13,.06,.43+i*.08,.07,cone).rotation.x=-.4;return h;}
  function birdLegs(height=1){for(const side of [-1,1]){const l=group(inner,side*.23,height,0);legs.push(l);beam(l,[0,0,0],[0,-height*.55,-.13],.075);beam(l,[0,-height*.55,-.13],[0,-height+.1,.02],.065);for(let i=0;i<3;i++)beam(l,[0,-height+.1,.02],[(i-1)*.12,-height+.05,.27],.035);}}
  function anchor(p){beam(p,[0,-.4,0],[0,.72,0],.075,'navy');beam(p,[-.35,.35,0],[.35,.35,0],.06,'gold');ring(p,0,.8,0,.13);for(const s of [-1,1]){beam(p,[0,-.4,0],[s*.44,-.18,0],.09,'navy');part(p,'gold',s*.43,-.05,0,.1,.35,.08,cone).rotation.z=-s*.45;}}
  if(E.form==='gazelle'){
    part(inner,'blue',0,.95,-.14,.34,.36,.65);part(inner,'pale',0,.88,.32,.26,.3,.25);
    for(const s of [-1,1])for(const z of [-.55,.4]){const l=group(inner,s*.25,.85,z);legs.push(l);beam(l,[0,0,0],[s*.05,-.45,-.12],.065,'blue');beam(l,[s*.05,-.45,-.12],[s*.04,-.8,.05],.05,'pale');part(l,'navy',s*.04,-.8,.1,.09,.06,.13);}
    head=group(inner,0,1.39,.48);part(head,'pale',0,0,.1,.2,.29,.28);part(head,'navy',0,-.05,.34,.14,.1,.18);eyes(head,.09,.26,.14);
    for(const s of [-1,1]){beam(head,[s*.13,.17,0],[s*.23,.64,-.15],.045);beam(head,[s*.23,.64,-.15],[s*.12,.98,-.08],.03);beam(head,[s*.2,.54,-.12],[s*.4,.72,-.05],.03);part(head,'blue',s*.25,.18,0,.19,.065,.09).rotation.z=s*.3;}
    tail=group(inner,0,1.03,-.65);for(let i=0;i<3;i++){const f=part(tail,i%2?'blue':'pale',(i-1)*.13,.07,-.2,.4,.5,.7,feather);f.rotation.y=Math.PI/2;f.rotation.z=(i-1)*.3;}
  }else if(E.form==='manta'){
    part(inner,'blue',0,0,0,.45,.17,.73);part(inner,'pale',0,-.09,.04,.36,.1,.6);eyes(inner,.08,.48,.24);core=part(inner,'light',0,.15,.04,.16,.065,.22);
    for(const s of [-1,1]){const w=group(inner,s*.28,0,0);wings.push(w);const shape=new THREE.Shape();shape.moveTo(0,.65);shape.quadraticCurveTo(.6,.25,1.75,-.35);shape.lineTo(.75,-.65);shape.lineTo(0,-.4);shape.closePath();const mesh=mk(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:false}),M.blue,0,0,0,w,.012);mesh.rotation.x=-Math.PI/2;mesh.scale.x=s;beam(w,[0,.07,.4],[s*1.55,.07,-.28],.025,'pale');for(let i=0;i<3;i++)part(w,'pale',s*(.3+i*.32),.06,-.1-i*.12,.08,.025,.1);}
    tail=group(inner,0,0,-.6);for(let i=0;i<4;i++){const s=group(tail,0,0,-i*.28);segments.push(s);part(s,i===3?'light':'navy',0,0,-.12,.065-i*.01,.04,.2);}
    for(const s of [-1,1])beam(inner,[s*.25,0,.5],[s*.32,.05,.83],.06,'pale');
  }else if(E.form==='eel'){
    for(let i=0;i<7;i++){const s=group(inner,0,Math.sin(i*.7)*.07,.5-i*.22);segments.push(s);part(s,i%2?'blue':'pale',0,0,0,.16-i*.016,.13-i*.01,.16);if(i%2===0)part(s,'light',0,.12,0,.07,.18,.1,cone);}
    head=segments[0];eyes(head,.035,.14,.09);core=part(head,'light',0,.09,.01,.08,.04,.09);
    for(const s of [-1,1])part(segments[6],'blue',s*.09,0,-.12,.13,.035,.2).rotation.y=s*.5;
  }else if(E.form==='heron'||E.form==='thunderlord'){
    const boss=E.form==='thunderlord';birdLegs(1);part(inner,'navy',0,1.35,0,.42,.52,.29);part(inner,'blue',0,1.48,.17,.36,.35,.19);part(inner,'gold',0,1.55,.32,.27,.07,.035,box);
    head=birdHead(group(inner,0,2.05,.04),boss);
    for(const s of [-1,1]){const a=group(inner,s*.42,1.7,0);arms.push(a);beam(a,[0,0,0],[s*.14,-.45,.16],.105,'blue');beam(a,[s*.14,-.45,.16],[s*.09,-.6,.32],.075,'pale');const plate=part(a,'gold',s*.03,.04,0,.24,.13,.23);plates.push(plate);}
    const spear=group(arms[1],.1,-.5,.36);beam(spear,[0,-.8,0],[0,1.25,0],.045,'navy');part(spear,'light',0,1.45,0,.12,.55,.08,cone);for(const y of [.6,.8,1])ring(spear,0,y,0,.12,'gold').rotation.x=Math.PI/2;
    for(let i=0;i<3;i++)part(inner,i%2?'pale':'blue',(i-1)*.2,.88,-.25,.2,.65,.09,cone).rotation.z=Math.PI;
    if(boss){const mount=group(inner,0,1.86,-.2);wing(mount,-1,1.4);wing(mount,1,1.4);core=part(inner,'light',0,1.38,.36,.15,.24,.05);const halo=ring(inner,0,2.15,-.35,.83,'light');halo.rotation.z=.2;for(let i=0;i<5;i++)part(head,'gold',(i-2)*.11,.43+(2-Math.abs(i-2))*.07,0,.065,.35,.07,cone);}
    else {part(inner,'pale',-.42,1.5,-.07,.14,.5,.32);for(let i=0;i<3;i++)part(inner,'blue',-.45,1.2-i*.1,-.18-i*.08,.16,.35,.08,cone).rotation.z=Math.PI;}
  }else if(E.form==='conch'){
    part(inner,'navy',0,.7,.05,.52,1.15,.42,cone);part(inner,'blue',0,1.15,.08,.37,.43,.3);head=group(inner,0,1.68,.12);part(head,'pale',0,0,.03,.27,.3,.25);part(head,'navy',0,.03,.24,.2,.13,.05,box);eyes(head,.05,.29,.12);
    // A coiled shell backpack gives the caster a recognizable side and rear silhouette.
    const shell=group(inner,0,1.28,-.25);for(let i=0;i<12;i++){const a=i*.65,r=.52-i*.033;part(shell,'shell',Math.cos(a)*r,Math.sin(a)*r,-i*.015,.2-i*.008,.2-i*.008,.26);}
    for(const s of [-1,1]){const arm=group(inner,s*.36,1.3,.1);arms.push(arm);beam(arm,[0,0,0],[s*.18,-.25,.28],.09,'pale');}
    const horn=group(arms[1],.24,-.2,.35);part(horn,'gold',0,0,.12,.24,.4,.23,cone).rotation.x=-Math.PI/2;ring(horn,0,0,.32,.24,'pale');
    for(let i=0;i<3;i++){const r=ring(inner,0,2.05+i*.12,-.05,.3-i*.05,'blue');r.rotation.x=Math.PI/2;}
    core=part(inner,'light',0,1.1,.38,.12,.15,.06);
  }else if(E.form==='crab'){
    part(inner,'navy',0,.75,0,.74,.35,.7);for(const s of [-1,1]){const p=part(inner,'blue',s*.31,1,0,.39,.28,.67);plates.push(p);
      for(let i=0;i<3;i++){const l=group(inner,s*.56,.66,.45-i*.44);legs.push(l);beam(l,[0,0,0],[s*.46,-.05,-.12],.09,'navy');beam(l,[s*.46,-.05,-.12],[s*.62,-.55,.14],.065,'pale');}
      const a=group(inner,s*.56,.78,.42);arms.push(a);beam(a,[0,0,0],[s*.3,.12,.44],.13,'navy');part(a,'blue',s*.4,.15,.6,.25,.21,.3);for(const q of [-1,1]){const claw=part(a,'pale',s*.4+q*.14,.16,.88,.1,.42,.11,cone);claw.rotation.x=Math.PI/2;}
      beam(inner,[s*.22,.95,.46],[s*.28,1.32,.63],.045,'gold');part(inner,'eye',s*.28,1.32,.65,.08);
    }
    const mast=group(inner,0,1.3,-.25);anchor(mast);core=part(inner,'light',0,1.08,.13,.18,.1,.3);
  }else if(E.form==='medusa'){
    part(inner,'shell',0,.55,0,.85,.47,.85);part(inner,'blue',0,.38,0,.92,.2,.92);core=part(inner,'light',0,.27,0,.38,.32,.38);
    const rim=ring(inner,0,.3,0,.88,'pale');rim.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,t=group(inner,Math.cos(a)*.58,.25,Math.sin(a)*.58);tentacles.push(t);let p=t;for(let j=0;j<4;j++){const s=group(p,0,j?-.29:0,0);segments.push(s);beam(s,[0,0,0],[Math.sin(i+j)*.08,-.3,0],.045-j*.007,j===3?'light':'pale');p=s;}}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;part(inner,'gold',Math.cos(a)*.6,.65,Math.sin(a)*.6,.08,.32,.08,cone);}
    eyes(inner,.47,.77,.28);
  }
  inner.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(inner),heightScale=E.h/Math.max(.1,bounds.max.y-bounds.min.y),scale=E.form==='manta'?Math.min(heightScale,4.6/(bounds.max.x-bounds.min.x)):heightScale,baseY=E.fly?3:-bounds.min.y*scale;inner.scale.setScalar(scale);inner.position.y=baseY;
  const rest=segments.map(s=>s.position.clone()),m={g,inner,mats,legs,arms,wings,plates,rings,core,proc:'storm',form:E.form,mixer:null,acts:null,phase:0,speed:0};
  m.anim=(e,dt)=>{
    const last=m.last ||= e.g.position.clone(),v=dt?Math.min(8,e.g.position.distanceTo(last)/dt):0;last.copy(e.g.position);m.speed+=(v-m.speed)*Math.min(1,dt*8);m.phase+=dt*(3+m.speed*2.5);
    if(e.dying!==undefined){inner.rotation.z=Math.min(1,(1.6-e.dying)/.7)*.9;return;}
    const c=e.stormCast,f=c?Math.max(0,1-c.t/c.duration):0,a=Math.min(1,m.speed/2),strike=(e.stormStrikeT||0)/.45;
    inner.position.y=baseY+(E.fly?Math.sin(G.t*2.5)*.2:Math.abs(Math.sin(m.phase))*a*.035*scale);inner.rotation.x=e.flash>0?-.07:0;
    legs.forEach((l,i)=>l.rotation.x=Math.sin(m.phase+(i%2)*Math.PI)*a*.42);
    arms.forEach((p,i)=>{p.rotation.x=-f*.9+strike*.8;p.rotation.z=E.form==='crab'?(i?1:-1)*f*.45:0;});
    if(head)head.rotation.x=-f*.15+strike*.18;
    if(tail)tail.rotation.y=Math.sin(m.phase*.6)*.18;
    wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*(Math.sin(G.t*5)*.16+f*.25+(e.stormAwakened?.25:0)));
    segments.forEach((s,i)=>{s.position.copy(rest[i]);if(E.form==='eel'||E.form==='manta')s.position.x+=Math.sin(G.t*7-i*.7)*.09;else s.rotation.z=Math.sin(G.t*3-i*.6)*.17+f*.2;});
    tentacles.forEach((p,i)=>p.rotation.z=Math.sin(G.t*2+i)*.15+f*.3);
    if(E.form==='crab')plates.forEach((p,i)=>p.rotation.z=e.stormRecover>0?(i?-.65:.65):0);
    if(E.form==='thunderlord'){plates.forEach(p=>p.visible=!e.stormAwakened);rings[rings.length-1].rotation.z=G.t*(e.stormAwakened?1:.35);}
    if(E.form==='conch')rings.slice(1).forEach((p,i)=>p.rotation.z=G.t*(.5+i*.2));
    if(core&&!e.flash)core.material.emissiveIntensity=.4+f*.4+(e.stormAwakened?.2:0);
  };
  return m;
}
