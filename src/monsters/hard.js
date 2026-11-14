import * as THREE from 'three';
import { scene } from '../render/scene.js';
import { G } from '../core/state.js';
import { STAGE } from '../core/grid.js';
import { hardEnemy, pulseStep, hardHit, hardDirection, hardShape } from '../data/hard.js';
import { ringFx } from '../render/vfx.js';
import { heroDamage } from '../heroes/hero.js';

export function hardDefinition(base, elite, summoned) {
  return STAGE?.hard ? hardEnemy(base,elite,!!summoned,G.enemies.filter(e=>!e.dead&&e.E.hardElite).length,STAGE.attackMul) : base;
}
export function hardTick(e,dt) {
  if(!STAGE?.hard||!(e.E.hardElite||e.E.boss))return false;
  const heroes=(G.heroes.length?G.heroes:[G.hero]).filter(h=>h&&h.dead<=0);
  const h=heroes.reduce((a,h)=>!a||h.g.position.distanceToSquared(e.g.position)<a.g.position.distanceToSquared(e.g.position)?h:a,null);
  const event=pulseStep(e,dt,h?.g.position,e.E.boss,STAGE.rule);
  if(event?.kind==='warn'){if(hardShape(event))chapterWarning(event,e);else warning(event);}
  if(event?.kind==='hit'){
    if(hardShape(event))chapterWarning(event,null);else ringFx(event.p,event.rule==='ash-eruption'?3.6:3.2,0xffc55a,.25);
    for(const h of heroes)if(hardHit(event,h.g.position)){heroDamage(e.E.dps*(hardShape(event)?1.2:event.rule==='ash-eruption'?1.5:1.4),h);if(event.rule==='ice-fracture')h.hardSlowUntil=Math.max(h.hardSlowUntil||0,G.t+1.5);}
    G.hardPulseHits=(G.hardPulseHits||0)+1;
  }
  return !!e.hardCast;
}

// Owned warning mesh uses the existing effect lifecycle (expiry and return both dispose it).
function warning(event){
 if(event.rule!=='ice-fracture'&&event.rule!=='ash-eruption'){ringFx(event.p,3.2,0xff6344,1.2);return;}
 // Telegraphs must stay visible across raised terrain; only the new chapters
 // use this fixed-footprint overlay. Collision still comes from hardHit.
 const ice=event.rule==='ice-fracture';
 const geometry=ice?new THREE.PlaneGeometry(2.7,10):new THREE.RingGeometry(3.25,3.6,48);
 const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:ice?0x65dfff:0xff903d,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false}));
 m.renderOrder=20;
 if(!ice){m.rotation.x=-Math.PI/2;m.position.set(event.p.x,.22,event.p.z);scene.add(m);G.fxs.push({m,t:0,dur:1.5,kind:'hard-circle'});return;}
 const u=hardDirection(event);
 m.rotation.set(-Math.PI/2,0,Math.atan2(u.x,u.z));m.position.set(event.from.x+u.x*5,.22,event.from.z+u.z*5);scene.add(m);G.fxs.push({m,t:0,dur:1.35,kind:'hard-line'});
}

// Each mesh belongs to G.fxs; cancelled/dead casters release it on the next fx update.
function chapterWarning(event,owner){
 const shape=hardShape(event),live=owner?()=>!owner.dead&&owner.dying===undefined&&!(owner.stunT>0)&&!!owner.hardCast:undefined;
 const angles=shape.kind==='cross'?[shape.angle,shape.angle+Math.PI/2]:[0];
 for(const angle of angles){
  const geometry=shape.kind==='annulus'?new THREE.RingGeometry(shape.inner,shape.outer,64):new THREE.PlaneGeometry(shape.width,shape.length);
  const material=new THREE.MeshBasicMaterial({color:shape.color,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false});
  const m=new THREE.Mesh(geometry,material);m.renderOrder=20;m.rotation.set(-Math.PI/2,0,angle);m.position.set(event.p.x,.24,event.p.z);scene.add(m);
  G.fxs.push({m,t:0,dur:owner?shape.dur:.25,kind:'hard-'+shape.kind,live});
 }
}
