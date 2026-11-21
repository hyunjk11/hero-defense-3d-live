import * as THREE from 'three';
import {G} from '../core/state.js';
import {tileX,tileZ,toTile,inGrid,T,STAGE} from '../core/grid.js';
import {mobileApp} from '../ui/mobile-mode.js';
import {scene} from '../render/scene.js';
import {shareGeo,disposeOwned} from '../render/toon.js';
import {P,emit,ringFx,dmgText} from '../render/vfx.js';
import {Snd} from '../audio/audio.js';
import {banner} from '../ui/hud.js';
import {inCircle,inCone,inLine,inRing,wardTargets,summonRoom} from './endgame-geometry.js';
const disc=shareGeo(new THREE.CircleGeometry(1,32)),rim=shareGeo(new THREE.RingGeometry(.95,1,32)),plane=shareGeo(new THREE.PlaneGeometry(1,1));
const traces=[],wards=new Set();let hooks;
const wardGeo=shareGeo(new THREE.SphereGeometry(1,12,8));
function clearWard(e){if(!e.endWard)return;remove(e.endWard);e.endWard=null;e.shield=0;e.shieldT=0;wards.delete(e);}
function giveWard(e,amount,duration){clearWard(e);e.shield=e.shieldMax=amount;e.shieldT=duration;const m=new THREE.Mesh(wardGeo,material(0x8ce4dd,.18));m.position.y=e.E.fly?3:e.E.h*.5;m.scale.set(e.E.h*.6,e.E.h*.65,e.E.h*.6);e.g.add(m);e.endWard=m;wards.add(e);}
export const initEndgame=h=>{hooks=h;};
const count=k=>{G.stats[k]=(G.stats[k]||0)+1;};
const color=e=>e.E.family==='abyss'?0xba8bff:0xff9c58;
const remove=m=>{m.removeFromParent();disposeOwned(m);};
const material=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,depthWrite:false,side:THREE.DoubleSide});
const targets=()=>[...G.towers.filter(t=>!t.dead).map(t=>({id:t,x:tileX(t.c),z:tileZ(t.r),tower:true})),...(G.heroes?.length?G.heroes:G.hero?[G.hero]:[]).filter(h=>h.dead<=0).map(h=>({id:h,x:h.g.position.x,z:h.g.position.z}))];
function circle(q,r,c,inner=0){const g=new THREE.Group();g.position.set(q.x,.17,q.z);const mesh=new THREE.Mesh(inner?new THREE.RingGeometry(inner/r,1,40):disc,material(c,.2));mesh.rotation.x=-Math.PI/2;mesh.scale.setScalar(r);g.add(mesh);const edge=new THREE.Mesh(rim,material(c,.85));edge.rotation.x=-Math.PI/2;edge.scale.setScalar(r);g.add(edge);if(inner){const edge2=new THREE.Mesh(rim,material(c,.85));edge2.rotation.x=-Math.PI/2;edge2.scale.setScalar(inner);g.add(edge2);}scene.add(g);return g;}
function cone(q,r,heading,angle,c){const shape=new THREE.Shape();shape.moveTo(0,0);for(let i=0;i<=24;i++){const a=heading-angle/2+angle*i/24;shape.lineTo(Math.sin(a)*r,-Math.cos(a)*r);}shape.closePath();const g=new THREE.Group();g.position.set(q.x,.18,q.z);const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),material(c,.3));m.rotation.x=-Math.PI/2;g.add(m);scene.add(g);return g;}
function line(a,b,w,c){const g=new THREE.Group();g.position.set((a.x+b.x)/2,.18,(a.z+b.z)/2);g.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);const m=new THREE.Mesh(plane,material(c,.3));m.rotation.x=-Math.PI/2;m.scale.set(w*2,Math.hypot(b.x-a.x,b.z-a.z),1);g.add(m);scene.add(g);return g;}
function trace(a,b,c){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,1.5,a.z),new THREE.Vector3(b.x,1.5,b.z)]),new THREE.LineBasicMaterial({color:c,transparent:true}));scene.add(m);traces.push({m,left:.35});}
function cancel(e){e.endCast?.marks.forEach(remove);e.endCast=null;e.castT=0;}
export const endgameKilled=e=>{cancel(e);clearWard(e);};
function begin(e,kind,S,points=[]){const from=e.g.position.clone().setY(0),qs=points.map(p=>new THREE.Vector3(p.x,0,p.z)),first=qs[0]||from,heading=Math.atan2(first.x-from.x,first.z-from.z),c=color(e);let end,marks;
 if(kind==='line'){const dir=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));end=from.clone().addScaledVector(dir,S.length);marks=[line(from,end,S.width,c)];}
 else if(kind==='cleave'||kind==='breath')marks=[cone(from,S.range,heading,S.angle,c)];
 else if(kind==='ring')marks=[circle(from,S.ringRadius||S.radius,c,S.inner)];
 else if(kind==='salvo')marks=qs.map(p=>circle(p,S.radius,c));
 else marks=[circle(from,kind==='ward'?S.range:kind==='awaken'?3:S.radius,kind==='ward'?0x8ce4dd:c)];
 // On PC Hard, raised terrain and towers must not hide the boss's attack footprint.
 const stage=G.practiceSandbox?G.practiceHard:STAGE;
 const clearWarning=!mobileApp&&stage?.hard&&(stage.ch===9||stage.ch===10)&&e.E.boss&&['line','cleave','breath','ring','salvo'].includes(kind);
 if(clearWarning){
  for(const mark of marks)for(const mesh of mark.children){mesh.material.depthTest=false;mesh.material.toneMapped=false;mesh.renderOrder=22;}
  for(const mark of marks)mark.children[0].material.opacity=.40;
 }
 if(['line','cleave','breath'].includes(kind))e.g.rotation.y=heading;
 e.endCast={kind,S,from,end,heading,points:qs,marks,clearWarning,t:S.windup,duration:S.windup,hp:e.hp};e.castT=S.windup;count('endWarnings');
}
function spawn(e,S){const n=Math.min(summonRoom(G.enemies,S.spawn,S.cap,S.count),(S.budget||S.cap)-(e.endSummoned||0)),[c,r]=toTile(e.g.position.x,e.g.position.z);let done=0;
 // Spawn beside the summoner, never on a wall, structure, core or outside the map.
 for(const [dc,dr] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1]]){if(done>=n)break;const a=c+dc,b=r+dr,t=G.tiles[a]?.[b];if(!inGrid(a,b)||!t||[T.BEDROCK,T.CORE].includes(t.t)||t.lava||t.bar||t.tower)continue;
  const child=hooks.spawnEnemy(S.spawn,e.max/e.E.hp*.65,{x:tileX(a),z:tileZ(b),tile:[a,b]});child.stunT=.6;done++;e.endSummoned=(e.endSummoned||0)+1;count('endSummons');}
}
function finish(e,c){const S=c.S,C=color(e);
 if(c.kind==='awaken'){e.endAwakened=true;e.armor=e.E.endgame.phase.armor;count('endAwakenings');banner(`${e.E.n} · 봉인 해제`,e.E.family==='abyss'?'#d6b2ff':'#ffc08a',1800);Snd.roar(e.g.position);return;}
 if(c.kind==='gate'){spawn(e,S);Snd.play('glass',{pos:c.from,vol:.4});}
 else if(c.kind==='ward'){for(const ally of wardTargets(e,G.enemies,S.range,S.targets)){giveWard(ally,Math.min(ally.max*S.shield,S.capHP*ally.max/ally.E.hp),S.duration);trace(e.g.position,ally.g.position,0x8ce4dd);count('endWards');}return;}
 else {for(const t of targets()){const hit=c.kind==='line'?inLine(t,c.from,c.end,S.width):c.kind==='ring'?inRing(t,c.from,S.ringRadius||S.radius,S.inner):c.kind==='salvo'?c.points.some(p=>inCircle(t,p,S.radius)):inCone(t,c.from,c.heading,S.range,S.angle);
   if(!hit)continue;if(t.tower){hooks.damageTower(t.id,S.tower);count('endTowerHits');}else{G.heroDamage(S.hero,t.id);count('endHeroHits');}}
  count('endAttack_'+c.kind);e.endStrikeT=.45;if(c.kind==='line')trace(c.from,c.end,C);else for(const p of c.points.length?c.points:[c.from]){ringFx(p,c.kind==='salvo'?S.radius:2,C,.35);emit(P,p.x,.5,p.z,12,C,4,.5,-3,.7);}Snd.play(c.kind==='line'?'zap':'boom',{pos:c.from,vol:.45});}
 if(S.exposed){e.endRecover=S.exposed;e.armor=S.openArmor;count('endOpenings');}
}
export function endgameTick(e,dt){const S=e.E.endgame;if(!S)return false;e.endCd??=S.first;e.endStrikeT=Math.max(0,(e.endStrikeT||0)-dt);
 if(e.endCast){const c=e.endCast;if(S.interrupt&&c.kind!=='awaken'&&c.hp-e.hp>=e.max*S.interrupt){cancel(e);e.endCd=S.every*.65;count('endInterrupts');dmgText(e.g.position.clone().setY(e.E.h+.3),'시전 차단','#ddc6ff');return false;}
  c.t-=dt;e.castT=Math.max(0,c.t);for(const m of c.marks)m.children[0].material.opacity=(c.clearWarning ? .40 : .2)+.25*(1-Math.max(0,c.t/c.duration));if(c.t<=0){c.marks.forEach(remove);e.endCast=null;e.castT=0;finish(e,c);e.endCd=S.every*(e.endAwakened?S.phase.everyK:1);}return true;}
 if(e.endRecover>0){e.endRecover=Math.max(0,e.endRecover-dt);if(!e.endRecover)e.armor=e.endAwakened?S.phase.armor:e.E.armor;return true;}
 if(S.phase&&!e.endAwakened&&e.hp<=e.max*S.phase.at){begin(e,'awaken',S.phase);return true;}
 e.endCd-=dt;if(e.endCd>0||e.stunT>0)return false;
 const kind=S.kind==='cycle'?S.pattern[(e.endPattern||0)%S.pattern.length]:S.kind;
 if(kind==='ward'){if(!wardTargets(e,G.enemies,S.range,S.targets).length){e.endCd=1;return false;}begin(e,kind,S);return true;}
 const opts=targets().filter(p=>inCircle(p,e.g.position,S.range)).sort((a,b)=>(a.x-e.g.position.x)**2+(a.z-e.g.position.z)**2-((b.x-e.g.position.x)**2+(b.z-e.g.position.z)**2));
 if(!opts.length){e.endCd=.5;return false;}
 if(kind==='gate'&&(!summonRoom(G.enemies,S.spawn,S.cap,S.count)||(e.endSummoned||0)>=(S.budget||S.cap))){e.endCd=1;if(S.kind==='cycle')e.endPattern=(e.endPattern||0)+1;return false;}
 const chosen=[];for(const p of opts){if(kind==='salvo'&&chosen.some(q=>inCircle(p,q,S.radius*2)))continue;chosen.push(p);if(chosen.length>=(kind==='salvo'?S.n:1))break;}
 if(S.kind==='cycle')e.endPattern=(e.endPattern||0)+1;begin(e,kind,S,chosen);return true;
}
export function updateEndgame(dt){for(const e of wards){e.shieldT-=dt;if(e.shieldT<=0||e.shield<=0||e.dead)clearWard(e);else e.endWard.material.opacity=.13+.04*Math.sin(G.t*4);}for(let i=traces.length-1;i>=0;i--){const f=traces[i];f.left-=dt;if(f.left<=0){remove(f.m);traces.splice(i,1);}else f.m.material.opacity=f.left/.35;}}
export function clearEndgame(){G.enemies.forEach(endgameKilled);[...wards].forEach(clearWard);traces.forEach(f=>remove(f.m));traces.length=0;}
export const endgameEffects=()=>({traces:traces.length,wards:wards.size,casting:G.enemies.filter(e=>e.endCast).length});
