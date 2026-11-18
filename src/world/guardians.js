import * as THREE from 'three';
import { G } from '../core/state.js';
import { GW, GH, DIRS, T, SPAWNS, CORE, inGrid, tileX, tileZ, toTile } from '../core/grid.js';
import { scene } from '../render/scene.js';
import { disposeOwned } from '../render/toon.js';
import { guardianModel, animateGuardian } from '../render/guardian-model.js';
import { hpBar } from '../render/hpbars.js';
import { Snd } from '../audio/audio.js';
import { P, emit, ringFx } from '../render/vfx.js';
import { hurt } from '../monsters/enemy.js';
import { towerXp } from './growth.js';
import { acquireGuard, releaseGuard, activeGuard } from '../combat/guardian.js';
import { towerRateK } from '../combat/towerstatus.js';
import { nextStep } from './pathfinding.js';
import { enemyMarchRoute, closestMarchIndex } from '../combat/guardian-route.js';

let marchCache;
function marchRoutes() {
  if(!marchCache||marchCache.tiles!==G.tiles||marchCache.version!==G.structVer||marchCache.dist!==G.D) {
    const previous=marchCache?.tiles===G.tiles?marchCache.routes:[];
    const routes=SPAWNS.map((p,i)=>{const route=enemyMarchRoute(p,CORE,nextStep,GW,GH),old=previous[i];return old&&old.length===route.length&&old.every((v,n)=>v[0]===route[n][0]&&v[1]===route[n][1])?old:route;});
    marchCache={tiles:G.tiles,version:G.structVer,dist:G.D,routes};
  }
  return marchCache.routes;
}
function homeFor(tw,i) {
  const cells=DIRS.map(([dc,dr])=>[tw.c+dc,tw.r+dr]).filter(([c,r])=>inGrid(c,r));
  return cells[i%cells.length]||[tw.c,tw.r];
}
function marchPoint(s,routes) {
  const route=routes[s.lane%routes.length],p=s.m.g.position;
  if(s.route!==route||s.marchIndex==null){const old=s.marchIndex!=null?s.route?.[s.marchIndex]:null,keep=old?route.findIndex(c=>c[0]===old[0]&&c[1]===old[1]):-1;
    s.route=route;s.marchIndex=keep>=0?keep:closestMarchIndex(route,p.x,p.z,tileX,tileZ);}
  let cell=route[s.marchIndex];
  if(Math.hypot(tileX(cell[0])-p.x,tileZ(cell[1])-p.z)<.12&&s.marchIndex>0)cell=route[--s.marchIndex];
  let x=tileX(cell[0]),z=tileZ(cell[1]);
  if(s.marchIndex===0){const first=route[1]||[cell[0]+1,cell[1]],dx=first[0]-cell[0],dz=first[1]-cell[1],len=Math.hypot(dx,dz)||1;
    const slot=Math.floor(s.formation/routes.length),side=slot%2?.6:-.6,back=1.5+Math.min(2,Math.floor(slot/2))*.45;
    x+=(-dz*side+dx*back)/len;z+=(dx*side+dz*back)/len;}
  s.waiting=s.marchIndex===0&&Math.hypot(x-p.x,z-p.z)<.12;
  return [x,z];
}
function release(s){releaseGuard(s.target,s);s.target=null;}
function dropModel(s){if(s.m){scene.remove(s.m.g);disposeOwned(s.m.g);s.hb?.dispose();s.m=null;s.hb=null;}}
export function clearGuardians(tw){for(const s of tw.guards||[]){release(s);dropModel(s);}tw.guards=[];}
function makeModel(s){ const old=s.m?.g.position.clone(), ratio=s.max? s.hp/s.max:1;dropModel(s);s.m=guardianModel({level:s.tw.lvl,branch:s.tw.branch,giant:s.tw.lvl>=5&&s.tw.branch==='guardian_bulwark'&&s.index===0});
  s.max=s.tw.S.soldierHp;s.hp=Math.max(0,ratio*s.max);const p=old||new THREE.Vector3(tileX(s.home[0]),0,tileZ(s.home[1]));s.m.g.position.copy(p);scene.add(s.m.g);s.hb=hpBar(s.m.g,1.95*s.m.g.scale.y,1.0,0x80dfff,{auto:true,h:.12});s.skin=`${s.tw.lvl}:${s.tw.branch}`; }
function hit(s,e,k=1){hurt(e,s.tw.S.dmg*k,'#bceaff',k>1,{x:s.m.g.position.x,z:s.m.g.position.z,kind:'melee'});s.tw.shots++;s.swing=.3;}
function signature(s){const tw=s.tw,p=s.m.g.position,B=tw.B;
  if(B?.guardianPulse&&s.index===0&&s.sig<=0){s.sig=8;ringFx(p,3.1,0x8edbff,.65);emit(P,p.x,1,p.z,18,0xc2edff,4,.45,1,.6);Snd.play('block',{pos:p});
    for(const e of G.enemies)if(!e.dead&&!e.E.fly&&e.state!=='spawn'&&!(e.immT>G.t)&&e.g.position.distanceToSquared(p)<9)hit(s,e,1.6);
  }
  if(B?.guardianCleave&&s.charging){ringFx(p,2,0xffc67a,.3);for(const e of G.enemies)if(e!==s.target&&!e.dead&&!e.E.fly&&e.state!=='spawn'&&!(e.immT>G.t)&&e.g.position.distanceToSquared(p)<4)hit(s,e,.65);}
}
export function updGuardians(tw,dt,canAct=true){
  const S=tw.S, skin=`${tw.lvl}:${tw.branch}`;
  const routes=marchRoutes();
  if(!routes.length)return;
  if(!tw.guards?.length){tw.guards=[];const offset=G.towers.filter(t=>!t.dead&&t.type==='guardian').indexOf(tw)*S.soldiers;
    for(let i=0;i<S.soldiers;i++){const s={tw,index:i,lane:Math.max(0,offset+i)%routes.length,formation:Math.max(0,offset+i),home:homeFor(tw,i),hp:S.soldierHp,max:S.soldierHp,cd:0,sig:2+i,respawn:0,swing:0,scan:0};makeModel(s);tw.guards.push(s);}}
  for(const s of tw.guards){
    if(s.hp<=0){release(s);if(s.m){ringFx(s.m.g.position,1,0x8edbff,.3);dropModel(s);s.respawn=S.respawn;}s.respawn-=canAct?dt:0;if(s.respawn>0)continue;s.home=homeFor(tw,s.index);s.route=null;s.marchIndex=null;s.charging=false;s.support=0;s.max=S.soldierHp;s.hp=s.max;makeModel(s);ringFx(s.m.g.position,1.3,0x8edbff,.4);}
    if(s.skin!==skin)makeModel(s);
    const p=s.m.g.position;
    s.hb.set(s.hp/s.max);s.swing=Math.max(0,s.swing-dt);s.hit=Math.max(0,(s.hit||0)-dt);
    if(!canAct){release(s);s.charging=false;s.marchIndex=null;animateGuardian(s.m,{time:G.t,moving:false,attacking:false,blocking:false});continue;}
    s.cd-=dt*towerRateK(tw,G.t);s.sig-=dt;s.scan-=dt;
    const valid=e=>!e.dead&&!e.E.fly&&e.state!=='spawn'&&!(e.immT>G.t);
    if(s.target&&(!valid(s.target)||Math.hypot(s.target.g.position.x-p.x,s.target.g.position.z-p.z)>S.range*1.35)){release(s);s.marchIndex=null;s.charging=false;}
    if(!s.target&&s.scan<=0){s.scan=.25;let best=null,bd=S.range*S.range;for(const e of G.enemies){if(!valid(e))continue;const d=(p.x-e.g.position.x)**2+(p.z-e.g.position.z)**2;if(d<bd){bd=d;best=e;}}s.target=best;if(best){s.marchIndex=null;s.waiting=false;}}
    let moving=false;
    const e=s.target,[x,z]=e?[e.g.position.x,e.g.position.z]:marchPoint(s,routes),dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);
    if(dist>(e?S.meleeRange:.08)){s.charging=!!(e&&tw.B?.guardianCharge&&s.sig<=0);const mv=Math.min(dist,dt*(s.charging?9:3.4));p.x+=dx/dist*mv;p.z+=dz/dist*mv;s.m.g.rotation.y=Math.atan2(dx,dz);moving=true;}
    else if(e){s.m.g.rotation.y=Math.atan2(e.g.position.x-p.x,e.g.position.z-p.z);acquireGuard(e,s,G.t,S);if(activeGuard(e,G.t)===s){if(s.support>=.5){towerXp(tw,s.support*12);s.support=0;}}
      if(s.cd<=0){s.cd=1/S.rate;hit(s,e,s.charging?1.6:1);signature(s);if(s.charging){s.sig=6;Snd.play('hit',{pos:p});}s.charging=false;}
    }
    const [c,r]=toTile(p.x,p.z);p.y=G.tiles[c]?.[r]?.t===T.CARVED?-.46:0;
    animateGuardian(s.m,{time:G.t+s.index,moving,attacking:s.swing>0,blocking:!!(e&&activeGuard(e,G.t)===s)});
  }
}
