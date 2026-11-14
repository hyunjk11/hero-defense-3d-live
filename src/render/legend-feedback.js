import {createSkillCues} from './skill-cues.js';
import {scene} from './scene.js';
import {G} from '../core/state.js';
import {groundY} from '../monsters/ai.js';
import {Snd} from '../audio/audio.js';

// Equipment follow-up presentation only. Called after the existing bounded hits.
// A fixed pool avoids per-proc UUID/random consumption and unbounded scene growth.
const pool=createSkillCues(scene,16);
export function legendFeedback(h,t,s,targets,FX) {
  if(!targets.length)return;
  const owner={},terrain=G.tiles,kind=h.lsk,color=s.color;
  const cue=(shape,p,size=1,angle=0,length=0)=>pool.show(owner,shape,{x:p.x,y:groundY(p.x,p.z)+.24,z:p.z},color,size,.34,angle,length);
  if(kind==='pierce'||kind==='rosebarrage'){
    const p=h.g.position,q=t.g.position,dx=q.x-p.x,dz=q.z-p.z;
    cue('link',p,1,Math.atan2(dx,dz),Math.hypot(dx,dz));
  }
  if(kind==='meteorstorm')cue('pulse',t.g.position,s.radius);
  for(const e of targets){const p=e.g.position;
    if(kind==='quake'||kind==='tigerdash'){cue('slash',p,1.1,.65);cue('slash',p,.85,-.65);}
    else cue('impact',p,kind==='rosebarrage'?.65:.9);
  }
  const stop=Snd.skill?.('legend_'+kind,t.g.position);let time=0;
  FX.push(dt=>{time+=dt;const owned=G.hero===h||G.heroes?.includes(h);
    if(time>=.34||!owned||h.dead>0||h.warpT>0||G.tiles!==terrain||G.screen==='town'||!['build','wave'].includes(G.phase)){pool.clear(owner);stop?.();return false;}
    pool.update(owner,dt);return true;
  });
}
