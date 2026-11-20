import {weaponProcFeed} from '../ui/weapon-proc-feed.js';
import {createSkillCues} from './skill-cues.js';
import {scene} from './scene.js';
import {G} from '../core/state.js';
import {groundY} from '../monsters/ai.js';
import * as THREE from 'three';
import {mobileApp} from '../ui/mobile-mode.js';
import {Snd} from '../audio/audio.js';

// Only presentation: successful proc signature or confirmed bounded impacts.
// Legacy projectiles keep their own effects and hit timing; no fake impact cue.
const pool=createSkillCues(scene,16);
const identity={multishot:['arrow',0xffd86a],pierce:['arrow',0xffdf85],frostorb:['frost',0x9ae8ff],meteorstorm:['arcane',0xc798ff],boomerang:['blade',0xffb56a],quake:['blade',0xffb56a],ricochet:['rose',0xff84af],rosebarrage:['rose',0xff7ea9],overdrill:['gear',0x9ce876],gigahammer:['gear',0x9ce876],pawstorm:['paw',0xffcfa1],tigerdash:['claw',0xffcd8b]};
// PC-only silhouettes. One shared geometry and three reusable meshes per slot.
const signatures = mobileApp ? null : (() => {
  const box = new THREE.BoxGeometry(1,1,1), meteor = new THREE.IcosahedronGeometry(.58,0);
  const up = new THREE.Vector3(0,1,0), delta = new THREE.Vector3();
  const slots = Array.from({length:12},()=>{
    const group = new THREE.Group();
    group.name='pc-gear-signature';
    const meshes = [0,1,2].map(()=>new THREE.Mesh(box,new THREE.MeshBasicMaterial({
      transparent:true,depthWrite:false,toneMapped:false,blending:THREE.NormalBlending
    })));
    group.add(...meshes);
    return {group,meshes,owner:null};
  });
  const beam=(m,a,b,w)=>{
    delta.set(b.x-a.x,b.y-a.y,b.z-a.z);
    const len=delta.length();
    m.position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
    m.scale.set(w,Math.max(.01,len),w);
    if(len>.0001)m.quaternion.setFromUnitVectors(up,delta.normalize());
  };
  return {
    show(owner,kind,h,t){
      const slot=slots.find(s=>!s.owner);if(!slot)return;
      const {group,meshes:[a,b,c]}=slot;
      slot.owner=owner;slot.kind=kind;group.userData.gearSignature=kind;
      const p=t.g.position, q=h.g.position, y=p.y+1.25;
      for(const m of slot.meshes){m.visible=true;m.rotation.set(0,0,0);m.material.opacity=.9;m.renderOrder=15;}
      c.geometry=kind==='meteorstorm'?meteor:box;
      if(kind==='pierce'){
        const start={x:q.x,y:q.y+1.45,z:q.z};
        const end={x:p.x,y,z:p.z};
        beam(a,start,end,.44);beam(b,start,end,.15);
        a.material.color.setHex(0xe6800c);b.material.color.setHex(0xfff1b7);b.renderOrder=16;
        c.position.set(p.x,y,p.z);c.scale.set(.5,.5,.5);c.rotation.z=Math.PI/4;
        c.material.color.setHex(0xffdc68);
      }else if(kind==='quake'){
        const floor=groundY(p.x,p.z)+.32, yaw=Math.atan2(p.x-q.x,p.z-q.z);
        const sx=Math.sin(yaw), sz=Math.cos(yaw), spread=1.48, reach=2.12;
        const root={x:p.x-sx*.6,y:floor,z:p.z-sz*.6};
        const arm=(side)=>({x:p.x+sx*reach*.65+sz*spread*side,y:floor+.22,z:p.z+sz*reach*.65-sx*spread*side});
        beam(a,root,arm(-1),.29);beam(b,root,arm(1),.29);
        a.material.color.setHex(0xc75a10);b.material.color.setHex(0xf28f20);
        c.position.set(p.x,floor+.1,p.z);c.scale.set(.52,.85,.42);c.rotation.z=.38;
        c.material.color.setHex(0xffe19a);
      }else{
        const high={x:p.x-2.3,y:y+7,z:p.z-1.5}, end={x:p.x,y,z:p.z};
        beam(a,high,end,.51);beam(b,high,end,.14);b.renderOrder=16;
        a.material.color.setHex(0x7438db);b.material.color.setHex(0xd79aff);
        c.position.set(p.x,y,p.z);c.scale.set(1.3,1,.9);c.rotation.z=.65;c.renderOrder=17;
        c.material.color.setHex(0x6432be);
      }
      scene.add(group);
    },
    update(owner,time){
      const s=slots.find(q=>q.owner===owner);if(!s)return;
      const opacity=Math.max(0,1-time/.44);
      for(const m of s.meshes)m.material.opacity=.85*opacity;
      if(s.kind==='quake'){
        s.meshes[2].scale.y=.85+.76*Math.max(0,1-Math.abs(time-.11)/.11);
      }
    },
    clear(owner){
      const s=slots.find(q=>q.owner===owner);if(!s)return;
      s.owner=null;s.group.position.set(0,0,0);s.group.rotation.set(0,0,0);s.group.removeFromParent();
    }
  };
})();
export function legendFeedback(h,t,s,targets,FX,castOnly=false) {
  if(!castOnly&&!targets.length)return;
  if(s.type==='proc')weaponProcFeed.record(document.getElementById('weaponProcFeed'),G,h,s,performance.now());
  const owner={},terrain=G.tiles,kind=castOnly?(s.key||h.lsk):h.lsk,[profile,fallback]=identity[kind]||['arcane',0xffffff],color=s.color??fallback;
  const cue=(shape,p,size=1,angle=0,length=0)=>pool.show(owner,shape,{x:p.x,y:groundY(p.x,p.z)+.24,z:p.z},color,size,.44,angle,length,profile);
  if(castOnly){cue('pulse',h.g.position,s.type==='proc'?2.6:1.5,h.face||0);}
  else {
    if(kind==='rosebarrage'||(kind==='pierce'&&!signatures)){
      const p=h.g.position,q=t.g.position,dx=q.x-p.x,dz=q.z-p.z;
      cue('link',p,1,Math.atan2(dx,dz),Math.hypot(dx,dz));
    }
    if(['pierce','quake','meteorstorm'].includes(kind)&&s.type==='proc')signatures?.show(owner,kind,h,t);
    if(kind==='meteorstorm')cue('pulse',t.g.position,s.radius);
    for(const e of targets){const p=e.g.position;
      if(kind==='quake'||kind==='tigerdash')cue('slash',p,1.65,.65);
      else cue('impact',p,kind==='rosebarrage'?1.65:2);
    }
  }
  // Legacy projectiles already have layered sounds; do not double their audio.
  const stop=castOnly?null:Snd.skill?.('legend_'+kind,t.g.position);let time=0;
  FX.push(dt=>{time+=dt;const owned=G.hero===h||G.heroes?.includes(h);
    if(time>=.44||!owned||h.dead>0||h.warpT>0||G.tiles!==terrain||G.screen==='town'||!['build','wave'].includes(G.phase)){pool.clear(owner);signatures?.clear(owner);stop?.();return false;}
    pool.update(owner,dt);signatures?.update(owner,time);return true;
  });
}
