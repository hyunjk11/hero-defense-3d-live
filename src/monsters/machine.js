import * as THREE from 'three';
import {G} from '../core/state.js';
import {tileX,tileZ,toTile,inGrid} from '../core/grid.js';
import {scene} from '../render/scene.js';
import {shareGeo,disposeOwned} from '../render/toon.js';
import {P,emit,ringFx,dmgText} from '../render/vfx.js';
import {Snd} from '../audio/audio.js';
import {banner} from '../ui/hud.js';
import {machineCircle,machineBeam,repairTargets} from './machine-geometry.js';
const amber=0xffb856,green=0x8df1bb,disc=shareGeo(new THREE.CircleGeometry(1,32)),rim=shareGeo(new THREE.RingGeometry(.95,1,32)),plane=shareGeo(new THREE.PlaneGeometry(1,1));
let hooks;const fields=[],traces=[];
export const initMachine=h=>{hooks=h;};
const count=k=>{G.stats[k]=(G.stats[k]||0)+1;};
const remove=m=>{m.removeFromParent();disposeOwned(m);};
const mat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
const targets=()=>[...G.towers.filter(t=>!t.dead).map(t=>({id:t,x:tileX(t.c),z:tileZ(t.r),tower:true})),...(G.heroes?.length?G.heroes:G.hero?[G.hero]:[]).filter(h=>h.dead<=0).map(h=>({id:h,x:h.g.position.x,z:h.g.position.z}))];
function circle(q,r,color=amber){const g=new THREE.Group();g.position.set(q.x,.15,q.z);for(const[geo,o]of [[disc,.15],[rim,.85]]){const m=new THREE.Mesh(geo,mat(color,o));m.rotation.x=-Math.PI/2;m.scale.setScalar(r);g.add(m);}scene.add(g);return g;}
function strip(a,b,width){const g=new THREE.Group(),m=new THREE.Mesh(plane,mat(amber,.23));g.position.set((a.x+b.x)/2,.16,(a.z+b.z)/2);g.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);m.rotation.x=-Math.PI/2;m.scale.set(width*2,Math.hypot(b.x-a.x,b.z-a.z),1);g.add(m);for(const side of [-1,1]){const edge=new THREE.Mesh(plane,mat(amber,.8));edge.rotation.x=-Math.PI/2;edge.position.x=side*width;edge.position.y=.01;edge.scale.set(.06,m.scale.y,1);g.add(edge);}scene.add(g);return g;}
function trace(a,b,color=amber){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,a.y??1.3,a.z),new THREE.Vector3(b.x,b.y??1,b.z)]),new THREE.LineBasicMaterial({color,transparent:true,opacity:1}));scene.add(line);traces.push({m:line,left:.35});}
function cancel(e){e.machineCast?.marks.forEach(remove);e.machineCast=null;e.castT=0;}
export const machineKilled=e=>cancel(e);
function begin(e,kind,S,points=[]){const from=e.g.position.clone().setY(0),qs=points.map(p=>new THREE.Vector3(p.x,0,p.z));let end,marks;
 if(kind==='beam'){const d=qs[0].clone().sub(from);if(d.lengthSq()<.01)d.set(Math.sin(e.g.rotation.y),0,Math.cos(e.g.rotation.y));end=from.clone().add(d.normalize().multiplyScalar(S.length));marks=[strip(from,end,S.width)];}
 else {if(['repair','ram','forge','awaken'].includes(kind))qs.splice(0,qs.length,from.clone());marks=qs.map(q=>circle(q,kind==='repair'?S.range:kind==='awaken'?2.8:S.radius,kind==='repair'?green:amber));}
 e.machineCast={kind,S,from,end,points:qs,marks,t:S.windup,duration:S.windup,hp:e.hp};e.castT=S.windup;count('machineWarnings');
}
function releaseUnits(e,type,n){const alive=G.enemies.filter(x=>!x.dead&&x.type===type).length;for(let i=0;i<Math.min(n,Math.max(0,16-alive));i++){const a=i*Math.PI*2/n,x=e.g.position.x+Math.sin(a)*1.1,z=e.g.position.z+Math.cos(a)*1.1,t=toTile(x,z);hooks.spawnEnemy(type,e.max/e.E.hp*.7,{x,z,tile:inGrid(...t)?t:e.tile.slice()}).stunT=.6;count('machineSummons');}}
function finish(e,c){const S=c.S;
 if(c.kind==='repair'){for(const ally of repairTargets(e,G.enemies,S.range,S.targets)){ally.hp=Math.min(ally.max,ally.hp+ally.max*S.heal);trace(e.g.position,ally.g.position,green);count('machineRepairs');}Snd.play('zap',{pos:e.g.position,vol:.35});return;}
 if(c.kind==='awaken'){e.machineAwakened=true;e.armor=e.E.machine.phase.armor;releaseUnits(e,S.spawn,S.count);count('machineAwakenings');banner('아르곤 · 동력로 개방','#ffbb70',1500);Snd.roar(e.g.position);return;}
 for(const t of targets())if(c.kind==='beam'?machineBeam(t,c.from,c.end,S.width):c.points.some(q=>machineCircle(t,q,S.radius))){if(t.tower){hooks.damageTower(t.id,S.tower);count('machineTowerHits');}else{G.heroDamage(S.hero,t.id);count('machineHeroHits');}}
 e.machineStrikeT=.4;
 if(c.kind==='emp'){for(const q of c.points)fields.push({q,radius:S.radius,left:S.duration,slow:S.slow,m:circle(q,S.radius,0x81dce7)});count('machineFields');}
 if(c.kind==='forge'){releaseUnits(e,S.spawn,S.count);count('machineForges');}
 if(S.exposed){e.machineRecover=S.exposed;e.armor=S.openArmor;count('machineOpenings');}
 if(c.kind==='beam')trace(c.from,c.end);else for(const q of c.points){emit(P,q.x,.6,q.z,14,amber,4,.5,-2,.7);ringFx(q,S.radius,amber,.4);}
 count(c.kind==='beam'?'machineBeams':'machineImpacts');Snd.play(c.kind==='beam'?'zap':'boom',{pos:e.g.position,vol:.5});
}
export function machineTick(e,dt){const S=e.E.machine;if(!S)return false;e.machineCd??=S.first;e.machineStrikeT=Math.max(0,(e.machineStrikeT||0)-dt);
 if(e.machineCast){const c=e.machineCast;if(S.interrupt&&c.hp-e.hp>=e.max*S.interrupt){cancel(e);e.machineCd=S.every*.6;count('machineInterrupts');dmgText(e.g.position.clone().setY(e.E.h+.3),'장전 중단','#ffd49b');return false;}
  c.t-=dt;e.castT=Math.max(0,c.t);for(const m of c.marks)m.children[0].material.opacity=.15+.27*(1-Math.max(0,c.t/c.duration));if(c.t<=0){c.marks.forEach(remove);e.machineCast=null;e.castT=0;finish(e,c);e.machineCd=S.every*(e.machineAwakened?S.phase.everyK:1);}return true;}
 if(e.machineRecover>0){e.machineRecover=Math.max(0,e.machineRecover-dt);if(!e.machineRecover)e.armor=e.machineAwakened?S.phase.armor:e.E.armor;return true;}
 if(S.phase&&!e.machineAwakened&&e.hp<=e.max*S.phase.at){begin(e,'awaken',S.phase);return true;}
 e.machineCd-=dt;if(e.machineCd>0||e.cast||e.stunT>0)return false;
 if(S.kind==='repair'){if(!repairTargets(e,G.enemies,S.range,S.targets).length){e.machineCd=1;return false;}begin(e,'repair',S);return true;}
 const opts=targets().filter(q=>machineCircle(q,e.g.position,S.range)).sort((a,b)=>(a.x-e.g.position.x)**2+(a.z-e.g.position.z)**2-((b.x-e.g.position.x)**2+(b.z-e.g.position.z)**2));if(!opts.length){e.machineCd=.5;return false;}
 const kind=S.kind==='overseer'?((e.machinePattern=(e.machinePattern||0)+1)%2?'shell':'beam'):S.kind;
 const qs=[];for(const p of opts)if(qs.every(q=>!machineCircle(p,q,(S.radius||1)*2))){qs.push(p);if(qs.length>=(S.kind==='overseer'&&kind==='shell'?S.n+(e.machineAwakened?1:0):1))break;}
 begin(e,kind,S,qs);return true;
}
export function updateMachine(dt){for(let i=fields.length-1;i>=0;i--){const f=fields[i];f.left-=dt;if(f.left<=0){remove(f.m);fields.splice(i,1);continue;}f.m.children[0].material.opacity=.1+Math.sin(G.t*6)*.04;for(const t of G.towers)if(!t.dead&&machineCircle({x:tileX(t.c),z:tileZ(t.r)},f.q,f.radius)){t.machineUntil=G.t+Math.min(.2,f.left);t.machineK=f.slow;}}
 for(let i=traces.length-1;i>=0;i--){const f=traces[i];f.left-=dt;if(f.left<=0){remove(f.m);traces.splice(i,1);}else f.m.material.opacity=f.left/.35;}}
export function clearMachine(){G.enemies.forEach(cancel);fields.forEach(f=>remove(f.m));traces.forEach(f=>remove(f.m));fields.length=traces.length=0;for(const t of G.towers)t.machineUntil=0;}
export const machineEffects=()=>({fields:fields.length,traces:traces.length,casting:G.enemies.filter(e=>e.machineCast).length});
