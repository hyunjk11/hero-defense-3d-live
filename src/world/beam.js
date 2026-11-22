import * as THREE from 'three';
import { G } from '../core/state.js';
import { hurt } from '../monsters/enemy.js';
import { towerRateK } from '../combat/towerstatus.js';
import { BEAM_STEP, beamHeatIntegral, beamTouches, beamSweepAt } from '../combat/beam.js';
import { createBeamVisual, drawBeam, disposeBeamVisual } from '../render/beam.js';
import { Snd } from '../audio/audio.js';

// 'guardian' remains the persisted research/type key; the fourth slot now fires a beam.
const aim=e=>e.g.position.clone().setY(e.E.fly?(e.m?.inner?.position.y??3):e.g.position.y+(e.E.h||1.5)*.55);
const valid=(e,tw)=>!!e&&!e.dead&&e.state!=='spawn'&&!(e.immT>G.t)&&Math.hypot(e.g.position.x-tw.m.g.position.x,e.g.position.z-tw.m.g.position.z)<=tw.S.range;
function reset(b){b.target=null;b.age=0;b.acc=0;b.burst=0;b.sweep=0;b.flash=0;b.cutLock=0;b.cutFlash=0;b.visual.g.visible=false;if(b.lance)b.lance.g.visible=false;}
export function clearBeam(tw){if(tw.beam){disposeBeamVisual(tw.beam.visual);if(tw.beam.lance)disposeBeamVisual(tw.beam.lance);tw.beam=null;}}
const heavyRank=e=>e?.E.boss?2:e?.E.elite?1:0;
function select(tw, onlyHeavy=false){
  let best=null,score=Infinity;const focus=tw.B?.beamFocus,heavy=tw.S.beamHeavy;
  const rank=e=>heavy?heavyRank(e):Number(!!e.E.boss);
  for(const e of G.enemies){
    if(!valid(e,tw)||(onlyHeavy&&!heavyRank(e)))continue;
    const d=tw.m.g.position.distanceToSquared(e.g.position);
    const priority=best&&(focus||heavy)?(rank(e)-rank(best)||(focus?e.hp-best.hp:0)):0;
    if(!best||priority>0||priority===0&&d<score){best=e;score=d;}
  }
  return best;
}
function endpoints(tw,b,sweepAge=b.sweep){
  const target=aim(b.target),center=Math.atan2(target.x-tw.m.g.position.x,target.z-tw.m.g.position.z);
  const sweep=tw.B?.beamSweep?beamSweepAt(sweepAge,!!tw.B.beamReturn):{active:true,offset:0},angle=center+sweep.offset;
  tw.m.head.rotation.y=angle;const from=new THREE.Vector3();tw.m.muzzle.getWorldPosition(from);
  if(!tw.B?.beamSweep)return {from,to:target,active:true};
  // Pitch crosses the target's actual distance, not the maximum-range endpoint.
  // A high-level muzzle otherwise shoots over nearby ground enemies.
  const distance=Math.max(.05,Math.hypot(target.x-from.x,target.z-from.z));
  const slope=(target.y-from.y)/distance;
  const range=Math.min(tw.S.range,slope<0?Math.max(.05,(from.y-.12)/-slope):tw.S.range);
  return {from,to:new THREE.Vector3(from.x+Math.sin(angle)*range,from.y+slope*range,from.z+Math.cos(angle)*range),active:sweep.active};
}
function reacquire(b,tw){
  const next=select(tw);
  if(tw.S.beamHeavy||!tw.B?.beamSweep||!next)reset(b);
  b.target=next;
}
// Keep the lateral sweep and its collateral contact exact. Periodically hold a
// second, short line on the same heavy target once the lock has started heating.
const LOCK_START=2, LOCK_FULL=6, FIRST_STRIKE=2.4, STRIKE_SPACING=.8, STRIKE_FLASH=.26;
const strikeIndex=t=>Math.floor((t-FIRST_STRIKE+1e-8)/STRIKE_SPACING);
const lockCharge=t=>Math.max(0,Math.min(1,(t-LOCK_START)/(LOCK_FULL-LOCK_START)));
function cutStrike(b,S,elapsed,enabled){
  if(!enabled){b.cutLock=0;b.cutFlash=0;return 0;}
  const next=b.cutLock+elapsed, fire=next+1e-8>=FIRST_STRIKE&&strikeIndex(next)>strikeIndex(b.cutLock);
  b.cutLock=next;
  if(!fire)return 0;
  b.cutFlash=STRIKE_FLASH;
  return 1+(S.beamMaxHeat*1.7-1)*lockCharge(next);
}
function hitCutStrike(tw,b,ray,charged,swept){
  hurt(b.target,Math.max(charged,swept),'#6ab7ff',false,{x:ray.from.x,z:ray.from.z,kind:'beam-cut-charge',guardPierce:.5*lockCharge(b.cutLock)});
  tw.shots++;
}
export function updBeam(tw,dt,canAct=true){
  const b=tw.beam||= {visual:createBeamVisual(),target:null,age:0,acc:0,burst:0,sweep:0,flash:0,cutLock:0,cutFlash:0};
  if(!canAct||tw.dead){reset(b);return;}
  if(!valid(b.target,tw)){reacquire(b,tw);}
  if(!b.target)return;
  b.flash=Math.max(0,b.flash-dt*5);b.cutFlash=Math.max(0,b.cutFlash-dt);b.acc+=dt;
  // Fixed simulation ticks: bounded draw/sound/text work, no per-render-frame damage.
  while(b.acc+1e-9>=BEAM_STEP){
    b.acc-=BEAM_STEP;if(!valid(b.target,tw)){reacquire(b,tw);break;}
    const S=tw.S,B=tw.B||{},k=towerRateK(tw,G.t),elapsed=BEAM_STEP*k;
    if(S.beamHeavy&&!heavyRank(b.target)){const next=select(tw,true);if(next){reset(b);b.target=next;}}
    const charging=!S.beamHeavy||heavyRank(b.target)>0;
    if(k<=0){reset(b);break;}
    b.sweep+=elapsed;const ray=endpoints(tw,b),base=S.dmg*S.rate;
    const cold=base*elapsed,amount=charging?base*beamHeatIntegral(b.age,elapsed,S.beamWarmup,S.beamMaxHeat,S.beamHeavy):cold;
    if(ray.active&&charging)b.age+=elapsed;if(charging)b.burst+=elapsed;
    const strike=S.beamHeavy&&B.beamSweep?cutStrike(b,S,elapsed,charging):0;
    let struck=false;
    if(ray.active){
      const hits=B.beamSweep?G.enemies.filter(e=>valid(e,tw)&&beamTouches(ray.from,ray.to,aim(e),Math.max(.6,(e.E.h||1.5)*.3)+.35)):[b.target];
      for(const e of hits){
        if(strike&&e===b.target){hitCutStrike(tw,b,ray,cold*strike,amount);struck=true;}
        else{hurt(e,S.beamHeavy&&e!==b.target?cold:amount,B.beamSweep?'#d4b0ff':'#a8f4ff',false,{x:ray.from.x,z:ray.from.z,kind:'beam'});tw.shots++;}
      }
    }
    if(strike&&!struck&&valid(b.target,tw))hitCutStrike(tw,b,ray,cold*strike,0);
    if(charging&&B.beamBurst&&b.burst+1e-8>=4&&valid(b.target,tw)){b.burst-=4;hurt(b.target,base*1.8,'#ffffff',true,{x:ray.from.x,z:ray.from.z,kind:'beam'});b.flash=1;tw.shots++;Snd.play('zap',{pos:ray.from,vol:.45});}
    if(!valid(b.target,tw)){reacquire(b,tw);break;}
  }
  if(!b.target)return;
  const preview=b.acc*towerRateK(tw,G.t),ray=endpoints(tw,b,b.sweep+preview),charge=Math.min(1,(b.age+(ray.active&&(!tw.S.beamHeavy||heavyRank(b.target))?preview:0))/tw.S.beamWarmup),heat=1+charge*1.6;
  if(ray.active)drawBeam(b.visual,ray.from,ray.to,{heat,charge,color:tw.B?.beamSweep?0xc18bff:0x72e4ff,flash:b.flash,cut:!!tw.B?.beamSweep});else b.visual.g.visible=false;
  if(b.cutFlash>0&&tw.S.beamHeavy&&tw.B?.beamSweep){
    const v=b.lance||=createBeamVisual(),hot=lockCharge(b.cutLock);
    // Tracking uses the actual heavy hit point, not the lateral sweep endpoint.
    drawBeam(v,ray.from,aim(b.target),{heat:1.2+hot,charge:.45+.55*hot,flash:.45*b.cutFlash/STRIKE_FLASH,cut:true});
  }else if(b.lance)b.lance.g.visible=false;
}
