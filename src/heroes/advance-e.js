import { createSkillCues } from '../render/skill-cues.js';
import * as THREE from 'three';
import { G } from '../core/state.js';
import { scene } from '../render/scene.js';
import { disposeOwned } from '../render/toon.js';
import { groundY } from '../monsters/ai.js';
import { hurt } from '../monsters/enemy.js';
import { knock } from './mechanic.js';
import { hero, stat } from './hero.js';
import { grantEShield } from '../data/hero-e.js';
import { play } from '../render/characters.js';
import { Snd } from '../audio/audio.js';
import { banner } from '../ui/hud.js';
import { catFlight, stepCatFlight } from '../data/cat-flight.js';
import { createCatSpirit, animateCatSpirit } from '../render/cat-spirit.js';

// One owned group and callback per cast. No equipment proc calls or independent timers.
const skillCues=createSkillCues(scene);
const COLORS={wind:0x85ffd5,hawk:0xffdf67,flame:0xff6a22,frost:0x90eaff,paladin:0xffe8a1,berserk:0xff4260,duel:0xff83be,thorn:0xf73179,tiger:0xffac66,dragon:0x78e8ff};
const live=e=>!e.dead&&e.dying===undefined;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function mesh(geo,color,opacity=.8){return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false}));}
function ring(root,p,r,color){const m=mesh(new THREE.RingGeometry(Math.max(.01,r-.1),r,48),color,.65);m.rotation.x=-Math.PI/2;m.position.set(p.x,groundY(p.x,p.z)+.18,p.z);root.add(m);return m;}
function bolt(color,branch){const gun=branch==='thorn',sniper=branch==='hawk',length=gun?2.8:sniper?2.4:1.7,g=new THREE.Group(),shaft=mesh(new THREE.CylinderGeometry(gun?.035:.055,gun?.14:.09,length,8),color,gun?.45:.65),head=mesh(new THREE.ConeGeometry(gun?.12:sniper?.28:.2,gun?.38:sniper?.95:.7,8),color,.95);shaft.rotation.x=head.rotation.x=Math.PI/2;head.position.z=length/2+.2;g.add(shaft,head);return g;}

// Presentation only: use the casting owner, not the currently selected hero.
// No gunner-module import (which would add a circular initialization dependency).
function thornShotFeedback(h){
 const ch=h.ch;ch.aimWeapons?.(h.face);h.g.updateMatrixWorld(true);
 const from=ch.muz?.[0]?.getWorldPosition(new THREE.Vector3())||h.g.position.clone().setY(1.5);
 const f=ch.flashes?.[0];
 if(f){f.t=.07*2.4;f.big=2.4;f.g.visible=true;f.g.rotation.y=h.face;}
 ch.recoil=Math.max(ch.recoil||0,1.2);
 h.gunT=Math.max(h.gunT||0,.24);
 play(ch,'ShootStand',{speed:1,fade:.05});
 Snd.gun(from,{big:true,rate:.6,vol:1.2,skill:true});
}

export function castAdvanceE(s,target,FX){
 const h=hero,origin=h.g.position.clone(),dir=target.clone().sub(origin).setY(0);
 if(dir.lengthSq()<.001)dir.set(Math.sin(h.face),0,Math.cos(h.face));dir.normalize();
 const angle=Math.atan2(dir.x,dir.z),radius=s.radius||1,reach=s.reach*(s.reachMul||1),damage=stat.dmg()*s.mul*stat.skillMul(),color=COLORS[s.b],txt='#'+color.toString(16).padStart(6,'0');
 h.face=angle;h.eCastAngle=angle;h.path=[];h.eCastT=s.kind==='volley'||s.kind==='cone'||s.kind==='paw'?s.cast+(s.ticks-1)*s.interval+.12:s.cast;h.atkT=Math.max(h.atkT,h.eCastT);
 const clip=h.cls==='mage'?'Spellcast_Long':h.cls==='warrior'?(h.ch.acts?.['1H_Melee_Attack_Chop']?'1H_Melee_Attack_Chop':'2H_Melee_Attack_Chop'):h.cls==='gunner'?'ShootStand':h.cls==='fighter'?(s.kind==='paw'?'PalmS':'PunchCombo'):'2H_Ranged_Shoot';
 play(h.ch,clip,{once:true,force:true,speed:1.3});
 banner(s.n+'!',txt,850);Snd.play(h.cls==='gunner'?'draw':h.cls==='warrior'?'stomp':'magic',{pos:origin,force:true});
 const root=new THREE.Group();root.name='advance-e:'+s.key;scene.add(root);
 const terrain=G.tiles,bolts=[],sharedHits=new Set(),aim=target.clone();let time=0,fired=0,ended=false,shield=null,hitCues=0;
 const cue=(kind,p,size=1,duration=.28,a=angle,length=0)=>skillCues.show(root,kind,{x:p.x,y:groundY(p.x,p.z)+.22,z:p.z},color,size,duration,a,length,s.b);
 if(s.kind==='line'||s.kind==='fan')for(const k of s.kind==='fan'?[-1,0,1]:[0])cue('aim',origin,1,s.cast,angle+k*(s.spread||0)*radius,reach);
 const hit=(e,mul=1,source=h.g.position)=>{if(!live(e))return;G.legendDmg=(G.legendDmg||0)+damage*mul;hurt(e,damage*mul,txt,true,{x:source.x,z:source.z,kind:s.ground?'melee':'ranged'});if(s.kind!=='paw'&&hitCues++<16)cue('impact',e.g.position,1.2,.38);};
 const eligible=()=>G.enemies.filter(e=>live(e)&&(!s.ground||!e.E.fly));
 let cat=null,flight=null,catFade=0,stopVoice=null;
 const voices=[];
 const close=()=>{skillCues.clear(root);for(const stop of voices)stop();stopVoice?.();stopVoice=null;cat?.traverse(o=>{if(o.isInstancedMesh)o.dispose();});scene.remove(root);disposeOwned(root);if(h.eShield===shield)h.eShield=null;};
 const shoot=(a,hits=new Set(),limit=1)=>{const m=bolt(color,s.b),d=new THREE.Vector3(Math.sin(a),0,Math.cos(a));m.position.copy(h.g.position).setY(groundY(h.g.position.x,h.g.position.z)+1.3);m.rotation.y=a;m.scale.setScalar(radius);root.add(m);bolts.push({m,d,hits,left:limit,dist:0});};
 let field=null,blades=null,beam=null,shell=null;
 if(s.kind==='field'){
  field=new THREE.Group();field.position.set(aim.x,groundY(aim.x,aim.z)+.15,aim.z);root.add(field);ring(root,aim,s.area*radius,color);
  const g=new THREE.ConeGeometry(s.b==='frost'?.16:.45,s.b==='frost'?.8:2.8,6),mat=mesh(g,color,.65).material;
  for(let i=0;i<(s.b==='frost'?24:9);i++){const m=new THREE.Mesh(g,mat),a=i*2.4,r=(.3+(i%5)/5)*s.area*radius;m.position.set(Math.sin(a)*r,s.b==='frost'?1+(i%4)*.65:1.2,Math.cos(a)*r);field.add(m);}
 }else if(s.kind==='shield'){
  shell=mesh(new THREE.SphereGeometry(2.3,24,16),color,.16);root.add(shell);ring(root,origin,s.area*radius,color);
  const crest=mesh(new THREE.CircleGeometry(.7,6),color,.8);crest.position.set(0,0,2.25);shell.add(crest);
 }else if(s.kind==='cone'){
  blades=new THREE.Group();root.add(blades);
  for(let i=0;i<3;i++){const m=mesh(new THREE.TorusGeometry(s.area*radius*(.65+i*.13),.05,5,32,s.arc*2),color,.7);m.rotation.set(Math.PI/2,0,Math.PI/2-s.arc);m.position.y=1+i*.18;blades.add(m);}
 }else if(s.kind==='volley'){
  beam=mesh(new THREE.CylinderGeometry(.05,.08,1,6),color);beam.geometry.rotateX(Math.PI/2);beam.geometry.translate(0,0,.5);beam.visible=false;root.add(beam);ring(root,aim,s.area*radius,color);
 }else{const m=ring(root,origin,1.6,color);m.userData.charge=true;}
 const fieldHit=()=>{for(const e of eligible())if(distance(e.g.position,aim)<=s.area*radius){hit(e);if(!live(e))continue;if(s.slow){e.slowAmt=Math.max(e.slowT>0?e.slowAmt||0:0,e.E.boss?s.bossSlow:s.slow);e.slowT=Math.max(e.slowT||0,.65);}}};
 const fire=()=>{
  if(s.kind!=='paw'){
   // Field accents on onset/final pulse; other skills accent their real shots/strikes.
   if(s.b!=='thorn'&&s.b!=='duel'&&(s.kind!=='field'||fired===0||fired===s.ticks-1)){const stop=Snd.skill?.(s.b,s.kind==='field'?aim:h.g.position);if(stop)voices.push(stop);}
   if(s.kind==='field'||s.kind==='shield')cue('pulse',s.kind==='field'?aim:h.g.position,s.area*radius,.32);
   else cue('pulse',h.g.position,s.kind==='cone'?1.8:1.25,.32);
  }
  if(s.kind==='fan')for(const k of [-1,0,1])shoot(angle+k*s.spread*radius,sharedHits,99);
  else if(s.kind==='line'){if(s.b==='thorn')thornShotFeedback(h);shoot(angle);}
  else if(s.kind==='paw'){
   cat=createCatSpirit();cat.scale.setScalar(1.9*radius);root.add(cat);flight=catFlight(origin,dir,s);
   cat.position.set(origin.x,groundY(origin.x,origin.z)+1.2,origin.z);cat.rotation.y=angle;stopVoice=Snd.meow?.(origin)||null;
  }
  else if(s.kind==='field')fieldHit();
  else if(s.kind==='shield'){shield=grantEShield(h,s,G.t);for(const e of eligible())if(distance(e.g.position,h.g.position)<=s.area*radius)hit(e);}
  else if(s.kind==='cone'){
   const center=h.g.position;
   for(const e of eligible()){const dx=e.g.position.x-center.x,dz=e.g.position.z-center.z,d=Math.hypot(dx,dz),dot=d?Math.max(-1,Math.min(1,(dx*dir.x+dz*dir.z)/d)):1;
    if(d<=s.area*radius&&Math.acos(dot)<=Math.min(Math.PI*.9,s.arc*radius)){hit(e);if(live(e)&&s.knockBase&&fired===s.ticks-1&&!e.E.boss){knock(e,center.x,center.z,s.knockBase*(s.knock||1),.6);}}}
  }else if(s.kind==='volley'){
   const target=eligible().filter(e=>distance(e.g.position,h.g.position)<=reach&&distance(e.g.position,aim)<=s.area*radius).sort((a,b)=>distance(a.g.position,aim)-distance(b.g.position,aim))[0];
   if(target){const k=fired%2,ch=h.ch;ch.aimWeapons?.(h.face);h.g.updateMatrixWorld(true);const muzzle=ch.muz?.[k]?.getWorldPosition(new THREE.Vector3()),f=ch.flashes?.[k];if(f){f.t=.07*1.5;f.big=1.5;f.g.visible=true;f.g.rotation.y=angle;}ch.gunKick?.(k);h.gunT=Math.max(h.gunT||0,.2);Snd.gun(muzzle||h.g.position,{rate:k?1.04:.97,vol:.85,skill:true});const a=h.g.position.clone().setY(groundY(h.g.position.x,h.g.position.z)+1.3),b=target.g.position.clone().setY(target.g.position.y+1.3);beam.position.copy(a);beam.lookAt(b);beam.scale.z=a.distanceTo(b);beam.visible=true;beam.material.opacity=1;hit(target);}else beam.visible=false;
  }
 };
 FX.push(dt=>{
  const owned=(G.heroes?.includes(h)||G.hero===h),inBattle=['build','wave'].includes(G.phase)&&G.screen!=='town';
  if(!owned||!h.g.parent||h.dead>0||h.warpT>0||G.tiles!==terrain||!inBattle){close();return false;}
  time+=dt;skillCues.update(root,dt);
  if(field){field.visible=time>=s.cast;field.rotation.y+=dt*(s.b==='frost'?1.1:.25);const fade=Math.min(1,Math.max(0,(s.cast+s.duration-time)/.3));
   for(let i=0;i<field.children.length;i++){const m=field.children[i];m.rotation.z+=dt*(s.b==='frost'?2:.1);m.material.opacity=(s.b==='frost'?.52:.48)*fade;
    if(s.b==='frost')m.position.y=3.4-((i*.47+time*3.5)%2.8);else m.scale.y=.8+.22*Math.sin(time*12+i*2.4);}}

  if(shell){shell.position.copy(h.g.position);shell.position.y+=1.4;shell.rotation.y=time*.35;shell.material.opacity=shield?.value?Math.max(.07,.2*shield.value/shield.initial):.12;}
  if(blades){blades.position.copy(h.g.position);blades.rotation.y=angle;const strike=Math.max(0,Math.floor((time-s.cast)/s.interval)),age=time-s.cast-strike*s.interval;
   blades.visible=time>=s.cast&&strike<s.ticks&&age<.14;blades.rotation.y=angle+(strike%2?1:-1)*(.25-age*3);blades.scale.setScalar(.82+Math.min(1,age/.14)*.18);
   for(const m of blades.children)m.material.opacity=.75*Math.max(0,1-age/.16);}
  if(beam)beam.material.opacity=Math.max(0,beam.material.opacity-dt*8);
  const count=s.kind==='paw'?1:(s.ticks||1),interval=s.kind==='field'?s.duration/s.ticks:(s.interval||1);
  while(fired<count&&time>=s.cast+fired*interval){fire();fired++;}
  if(cat){
   if(!flight.done)stepCatFlight(flight,dt,G.enemies,G.t,e=>hit(e,1,{x:flight.x-flight.dx,z:flight.z-flight.dz}));else catFade+=dt;
   const facing=flight.target||flight.seek,targetHeight=facing?.E.fly?facing.g.position.y+3:groundY(flight.x,flight.z)+1.2;
   cat.position.set(flight.x,flight.target?targetHeight:cat.position.y+(targetHeight-cat.position.y)*Math.min(1,dt*16),flight.z);cat.rotation.y=Math.atan2(flight.dx,flight.dz);
   const fade=Math.max(0,1-catFade/.18),appear=Math.min(1,Math.max(.01,(time-s.cast)/.09));cat.scale.setScalar(1.9*radius*appear*(1+catFade));animateCatSpirit(cat,flight.time,flight.pulse,fade);
   if(flight.done&&catFade>=.18){close();return false;}
  }
  for(let i=bolts.length-1;i>=0;i--){const b=bolts[i],p=b.m.position,from=p.clone(),step=Math.min((s.kind==='paw'?24:65)*dt,reach-b.dist);p.addScaledVector(b.d,step);b.dist+=step;
   const candidates=eligible().map(e=>{const dx=e.g.position.x-from.x,dz=e.g.position.z-from.z,along=dx*b.d.x+dz*b.d.z,t=Math.max(0,Math.min(step,along));return {e,along,d2:(dx-b.d.x*t)**2+(dz-b.d.z*t)**2};}).filter(x=>x.along>=0&&x.along<=step&&!b.hits.has(x.e)&&x.d2<=(s.width*radius)**2).sort((a,b)=>a.along-b.along);
   for(const {e} of candidates){b.hits.add(e);hit(e);if(--b.left<=0)break;}
   if(b.left<=0||b.dist>=reach){root.remove(b.m);disposeOwned(b.m);bolts.splice(i,1);}
  }
  if(s.kind==='field'&&time>=s.cast+s.duration&&!ended){ended=true;if(s.freeze)for(const e of eligible())if(distance(e.g.position,aim)<=s.area*radius){e.stunT=Math.max(e.stunT||0,Math.min(e.E.boss?.25:.75,(e.E.boss?s.bossFreeze:s.freeze)*(s.cc||1)));e.frozen=true;}}
  const duration=s.kind==='field'?s.cast+s.duration:s.kind==='shield'?s.cast+Math.min(8,s.duration*(s.durationMul||1)):s.cast+(count-1)*interval+.3;
  if(s.kind!=='paw'&&(s.kind==='shield'&&shield&&h.eShield!==shield||time>=duration&&bolts.length===0&&!skillCues.has(root))){close();return false;}
  return true;
 });
 return true;
}
