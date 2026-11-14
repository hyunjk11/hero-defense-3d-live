import * as THREE from 'three';
import { G } from '../core/state.js';
import { tileX, tileZ, toTile, inGrid } from '../core/grid.js';
import { scene } from '../render/scene.js';
import { shareGeo, disposeOwned } from '../render/toon.js';
import { P, emit, ringFx, dmgText } from '../render/vfx.js';
import { Snd } from '../audio/audio.js';
import { banner } from '../ui/hud.js';
import { inStormCircle, inStormRing, stormChain } from './storm-geometry.js';
const cyan=0x95eaff,gold=0xffd782;
const disc=shareGeo(new THREE.CircleGeometry(1,40)),edge=shareGeo(new THREE.RingGeometry(.97,1,40));
let hooks;const fields=[],bolts=[];
export const initStorm=h=>{hooks=h;};
const heroes=()=>(G.heroes?.length?G.heroes:G.hero?[G.hero]:[]).filter(h=>h.dead<=0);
const count=key=>{G.stats[key]=(G.stats[key]||0)+1;};
const remove=m=>{m.removeFromParent();disposeOwned(m);};
const mat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false});
function mark(q,r,inner=0){
  const g=new THREE.Group();g.position.set(q.x,.14,q.z);
  const fill=new THREE.Mesh(inner?new THREE.RingGeometry(inner,r,48):disc,mat(cyan,.14));fill.rotation.x=-Math.PI/2;if(!inner)fill.scale.setScalar(r);g.add(fill);
  for(const radius of inner?[inner,r]:[r]){const rim=new THREE.Mesh(edge,mat(gold,.85));rim.rotation.x=-Math.PI/2;rim.scale.setScalar(radius);g.add(rim);}
  scene.add(g);return g;
}
function bolt(from,to){
  const a=new THREE.Vector3(from.x,from.y??1,from.z),b=new THREE.Vector3(to.x,to.y??.5,to.z),points=[];
  for(let i=0;i<=6;i++){const p=a.clone().lerp(b,i/6);if(i>0&&i<6){p.x+=i%2?.18:-.18;p.z+=i%2?-.1:.1;}points.push(p);}
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:cyan,transparent:true,opacity:.95}));scene.add(line);bolts.push({m:line,left:.28});
}
function targets(){return[...G.towers.filter(t=>!t.dead).map(t=>({id:t,x:tileX(t.c),z:tileZ(t.r),tower:true})),...heroes().map(h=>({id:h,x:h.g.position.x,z:h.g.position.z,tower:false}))];}
function begin(e,kind,S,points){
  const from=e.g.position.clone().setY(0),radius=kind==='pulse'?(S.pulseRadius||S.radius):kind==='awaken'?2.5:S.radius;
  const qs=kind==='pulse'||kind==='awaken'?[from]:points;
  e.stormCast={kind,S,from,points:qs.map(p=>new THREE.Vector3(p.x,0,p.z)),marks:qs.map(q=>mark(q,radius,kind==='pulse'?S.inner:0)),radius,hp:e.hp,t:S.windup,duration:S.windup};
  e.castT=S.windup;count('stormWarnings');
}
function cancel(e){if(e.stormCast)e.stormCast.marks.forEach(remove);e.stormCast=null;e.castT=0;}
export const stormKilled=e=>cancel(e);
function damage(target,S,k=1){
  if(target.tower){hooks.damageTower(target.id,S.tower*k);count('stormTowerHits');}
  else{G.heroDamage(S.hero*k,target.id);count('stormHeroHits');}
}
function impact(c){
  const list=targets(),hit=new Set(),seeds=[];
  for(const t of list){const inside=c.kind==='pulse'?inStormRing(t,c.from,c.S.inner,c.radius):c.points.some(q=>inStormCircle(t,q,c.radius));
    if(inside){damage(t,c.S);hit.add(t.id);seeds.push(t);}}
  // Multiple warning circles still deal at most one primary/chain hit to each entity.
  if(c.kind==='lightning')for(const seed of seeds){let from=seed;for(const target of stormChain(seed,list.filter(t=>t.tower?!t.id.dead:t.id.dead<=0),c.S.chainRange,c.S.jumps,hit)){damage(target,c.S,c.S.chainK);hit.add(target.id);bolt(from,target);from=target;count('stormChainHits');}}
}
function finish(e,c){
  const S=c.S;
  if(c.kind==='awaken'){
    const phase=e.E.storm.phase;e.stormAwakened=true;e.armor=phase.armor;count('stormAwakenings');
    for(let i=0;i<phase.summons;i++){const a=i*Math.PI*2/phase.summons,x=e.g.position.x+Math.sin(a)*.8,z=e.g.position.z+Math.cos(a)*.8,tile=toTile(x,z);hooks.spawnEnemy(phase.type,e.max/e.E.hp,{x,z,tile:inGrid(...tile)?tile:e.tile.slice()}).stunT=.5;}
    banner('폭풍의 심판자 · 봉인 해방','#abedff',1600);emit(P,e.g.position.x,2,e.g.position.z,35,cyan,5,.8,-2,1);Snd.roar(e.g.position);return;
  }
  impact(c);e.stormStrikeT=.45;
  if(c.kind==='gust'){
    for(const q of c.points){const m=mark(q,S.radius);for(let i=0;i<3;i++){const r=new THREE.Mesh(edge,mat(cyan,.35));r.rotation.x=-Math.PI/2;r.position.y=.3+i*.4;r.scale.setScalar(S.radius*(.55+i*.18));m.add(r);}fields.push({q,radius:S.radius,slow:S.slow,left:S.duration,m});}count('stormGusts');
  }else if(c.kind==='slam'){e.stormRecover=S.exposed;e.armor=S.openArmor;count('stormOpenings');}
  else if(c.kind==='pulse')count('stormPulses');else count('stormLightning');
  for(const q of c.points){if(c.kind==='lightning')bolt({x:q.x,y:7,z:q.z},q);emit(P,q.x,.4,q.z,12,cyan,3,.5,1,.6);ringFx(q,c.radius,cyan,.35);}
  Snd.play(c.kind==='slam'?'breakRock':'zap',{pos:e.g.position,vol:.65});
}
export function stormTick(e,dt){
  const S=e.E.storm;if(!S)return false;e.stormCd??=S.first;e.stormStrikeT=Math.max(0,(e.stormStrikeT||0)-dt);
  if(e.stormCast){const c=e.stormCast;
    if(S.interrupt&&c.hp-e.hp>=e.max*S.interrupt){cancel(e);e.stormCd=S.every*.6;count('stormInterrupts');dmgText(e.g.position.clone().setY(e.E.h+.3),'시전 중단','#c1efff');return false;}
    c.t-=dt;e.castT=Math.max(0,c.t);for(const m of c.marks)m.children[0].material.opacity=.14+.2*(1-Math.max(0,c.t/c.duration));
    if(c.t<=0){c.marks.forEach(remove);e.stormCast=null;e.castT=0;finish(e,c);e.stormCd=S.every*(e.stormAwakened?S.phase.everyK:1);}return true;
  }
  if(e.stormRecover>0){e.stormRecover=Math.max(0,e.stormRecover-dt);if(!e.stormRecover)e.armor=e.E.armor;return true;}
  if(S.phase&&!e.stormAwakened&&e.hp<=e.max*S.phase.at){begin(e,'awaken',{windup:S.phase.windup},[]);return true;}
  e.stormCd-=dt;if(e.stormCd>0||e.cast||e.stunT>0)return false;
  const options=targets().filter(q=>inStormCircle(q,e.g.position,S.range)).sort((a,b)=>(a.x-e.g.position.x)**2+(a.z-e.g.position.z)**2-((b.x-e.g.position.x)**2+(b.z-e.g.position.z)**2));
  if(!options.length){e.stormCd=.6;return false;}
  const kind=S.kind==='judgment'?((e.stormPattern=(e.stormPattern||0)+1)%2?'lightning':'pulse'):S.kind;
  const points=[];for(const p of options)if(points.every(q=>!inStormCircle(p,q,S.radius*2))){points.push(p);if(points.length>=(S.kind==='judgment'&&kind==='lightning'?S.n+(e.stormAwakened?1:0):1))break;}
  begin(e,kind,S,points);return true;
}
export function updateStorm(dt){
  for(let i=fields.length-1;i>=0;i--){const f=fields[i];f.left-=dt;if(f.left<=0){remove(f.m);fields.splice(i,1);continue;}f.m.rotation.y+=dt*2;
    f.m.children.slice(2).forEach((m,j)=>{m.position.x=Math.sin(G.t*4+j)*.15;m.position.z=Math.cos(G.t*4+j)*.15;});
    for(const tw of G.towers)if(!tw.dead&&inStormCircle({x:tileX(tw.c),z:tileZ(tw.r)},f.q,f.radius)){tw.stormUntil=G.t+Math.min(.2,f.left);tw.stormK=f.slow;}}
  for(let i=bolts.length-1;i>=0;i--){const b=bolts[i];b.left-=dt;if(b.left<=0){remove(b.m);bolts.splice(i,1);}else b.m.material.opacity=b.left/.28;}
}
export function clearStorm(){G.enemies.forEach(cancel);fields.forEach(f=>remove(f.m));bolts.forEach(b=>remove(b.m));fields.length=bolts.length=0;for(const tw of G.towers)tw.stormUntil=0;}
export const stormEffects=()=>({fields:fields.length,bolts:bolts.length,casting:G.enemies.filter(e=>e.stormCast).length});
