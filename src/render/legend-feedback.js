import {weaponProcFeed} from '../ui/weapon-proc-feed.js';
import {createSkillCues} from './skill-cues.js';
import {scene} from './scene.js';
import {G} from '../core/state.js';
import {groundY} from '../monsters/ai.js';
import {Snd} from '../audio/audio.js';

// Only presentation: successful proc signature or confirmed bounded impacts.
// Legacy projectiles keep their own effects and hit timing; no fake impact cue.
const pool=createSkillCues(scene,16);
const identity={multishot:['arrow',0xffd86a],pierce:['arrow',0xffdf85],frostorb:['frost',0x9ae8ff],meteorstorm:['arcane',0xc798ff],boomerang:['blade',0xffb56a],quake:['blade',0xffb56a],ricochet:['rose',0xff84af],rosebarrage:['rose',0xff7ea9],overdrill:['gear',0x9ce876],gigahammer:['gear',0x9ce876],pawstorm:['paw',0xffcfa1],tigerdash:['claw',0xffcd8b]};
export function legendFeedback(h,t,s,targets,FX,castOnly=false) {
  if(!castOnly&&!targets.length)return;
  if(s.type==='proc')weaponProcFeed.record(document.getElementById('weaponProcFeed'),G,h,s,performance.now());
  const owner={},terrain=G.tiles,kind=castOnly?(s.key||h.lsk):h.lsk,[profile,fallback]=identity[kind]||['arcane',0xffffff],color=s.color??fallback;
  const cue=(shape,p,size=1,angle=0,length=0)=>pool.show(owner,shape,{x:p.x,y:groundY(p.x,p.z)+.24,z:p.z},color,size,.44,angle,length,profile);
  if(castOnly){cue('pulse',h.g.position,s.type==='proc'?2.6:1.5,h.face||0);}
  else {
    if(kind==='pierce'||kind==='rosebarrage'){
      const p=h.g.position,q=t.g.position,dx=q.x-p.x,dz=q.z-p.z;
      cue('link',p,1,Math.atan2(dx,dz),Math.hypot(dx,dz));
    }
    if(kind==='meteorstorm')cue('pulse',t.g.position,s.radius);
    for(const e of targets){const p=e.g.position;
      if(kind==='quake'||kind==='tigerdash')cue('slash',p,1.65,.65);
      else cue('impact',p,kind==='rosebarrage'?1.65:2);
    }
  }
  // Legacy projectiles already have layered sounds; do not double their audio.
  const stop=castOnly?null:Snd.skill?.('legend_'+kind,t.g.position);let time=0;
  FX.push(dt=>{time+=dt;const owned=G.hero===h||G.heroes?.includes(h);
    if(time>=.44||!owned||h.dead>0||h.warpT>0||G.tiles!==terrain||G.screen==='town'||!['build','wave'].includes(G.phase)){pool.clear(owner);stop?.();return false;}
    pool.update(owner,dt);return true;
  });
}
