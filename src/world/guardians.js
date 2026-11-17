import * as THREE from 'three';
import { G } from '../core/state.js';
import { GW, GH, DIRS, T, inGrid, isBlock, tileX, tileZ, toTile } from '../core/grid.js';
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

const pass = (c, r) => { const t = G.tiles[c]?.[r]; return inGrid(c,r) && t && !isBlock(t.t) && t.t !== T.BEDROCK && !t.tower && !t.bar; };
const key = (c,r) => c * GH + r;
function field(tw) {
  const q = [], seen = new Map(), rng = tw.S.range;
  for (const [dc,dr] of DIRS) { const c=tw.c+dc,r=tw.r+dr; if(pass(c,r)){ q.push([c,r]); seen.set(key(c,r),null); } }
  for(let i=0;i<q.length;i++){const [c,r]=q[i]; for(const [dc,dr] of DIRS){const x=c+dc,z=r+dr,k=key(x,z);if(seen.has(k)||!pass(x,z)||Math.hypot(tileX(x)-tileX(tw.c),tileZ(z)-tileZ(tw.r))>rng)continue;seen.set(k,[c,r]);q.push([x,z]);}}
  return {seen,q};
}
function pathTo(s,c,r) {
  const start=toTile(s.m.g.position.x,s.m.g.position.z), target=key(c,r), q=[start], par=new Map([[key(...start),null]]);
  for(let i=0;i<q.length;i++){const p=q[i],k=key(...p);if(k===target){let at=p,prev=par.get(k);while(prev&&key(...prev)!==key(...start)){at=prev;prev=par.get(key(...at));}return at;}
    for(const [dc,dr] of DIRS){const x=p[0]+dc,z=p[1]+dr,k2=key(x,z);if(!par.has(k2)&&s.tw.guardField.seen.has(k2)&&pass(x,z)){par.set(k2,p);q.push([x,z]);}}
  } return null;
}
function release(s){releaseGuard(s.target,s);s.target=null;}
function dropModel(s){if(s.m){scene.remove(s.m.g);disposeOwned(s.m.g);s.hb?.dispose();s.m=null;s.hb=null;}}
export function clearGuardians(tw){for(const s of tw.guards||[]){release(s);dropModel(s);}tw.guards=[];}
function makeModel(s){ const old=s.m?.g.position.clone(), ratio=s.max? s.hp/s.max:1;dropModel(s);s.m=guardianModel({level:s.tw.lvl,branch:s.tw.branch,giant:s.tw.lvl>=5&&s.tw.branch==='guardian_bulwark'&&s.index===0});
  s.max=s.tw.S.soldierHp;s.hp=Math.max(0,ratio*s.max);const p=old||new THREE.Vector3(tileX(s.home[0]),0,tileZ(s.home[1]));s.m.g.position.copy(p);scene.add(s.m.g);s.hb=hpBar(s.m.g,1.95*s.m.g.scale.y,1.0,0x80dfff,{auto:true,h:.12});s.skin=`${s.tw.lvl}:${s.tw.branch}`; }
function hit(s,e,k=1){hurt(e,s.tw.S.dmg*k,'#bceaff',k>1,{x:s.m.g.position.x,z:s.m.g.position.z,kind:'melee'});s.tw.shots++;s.swing=.3;}
function signature(s){const tw=s.tw,p=s.m.g.position,B=tw.B;
  if(B?.guardianPulse&&s.index===0&&s.sig<=0){s.sig=8;ringFx(p,3.1,0x8edbff,.65);emit(P,p.x,1,p.z,18,0xc2edff,4,.45,1,.6);Snd.play('block',{pos:p});
    for(const e of G.enemies)if(!e.dead&&!e.E.fly&&!(e.immT>G.t)&&e.g.position.distanceToSquared(p)<9)hit(s,e,1.6);
  }
  if(B?.guardianCleave&&s.charging){ringFx(p,2,0xffc67a,.3);for(const e of G.enemies)if(e!==s.target&&!e.dead&&!e.E.fly&&e.g.position.distanceToSquared(p)<4)hit(s,e,.65);}
}
export function updGuardians(tw,dt,canAct=true){
  const S=tw.S, skin=`${tw.lvl}:${tw.branch}`;
  if(!tw.guardField||tw.guardVersion!==G.structVer||tw.guardRange!==S.range||G.t>tw.guardScan){tw.guardField=field(tw);tw.guardVersion=G.structVer;tw.guardRange=S.range;tw.guardScan=G.t+.7;}
  const F=tw.guardField;
  if(!F.q.length){clearGuardians(tw);return;}
  if(!tw.guards?.length){tw.guards=[];for(let i=0;i<S.soldiers;i++){const home=F.q[Math.min(i,F.q.length-1)];const s={tw,index:i,home,hp:S.soldierHp,max:S.soldierHp,cd:0,sig:2+i,respawn:0,swing:0,scan:0};makeModel(s);tw.guards.push(s);}}
  for(const s of tw.guards){
    if(s.hp<=0){release(s);if(s.m){ringFx(s.m.g.position,1,0x8edbff,.3);dropModel(s);s.respawn=S.respawn;}s.respawn-=canAct?dt:0;if(s.respawn>0)continue;s.home=F.q[Math.min(s.index,F.q.length-1)];s.max=S.soldierHp;s.hp=s.max;makeModel(s);ringFx(s.m.g.position,1.3,0x8edbff,.4);}
    if(s.skin!==skin)makeModel(s);
    const p=s.m.g.position;const cell=toTile(p.x,p.z);if(!pass(...cell)||!F.seen.has(key(...cell))){release(s);s.home=F.q[Math.min(s.index,F.q.length-1)];p.set(tileX(s.home[0]),0,tileZ(s.home[1]));}
    s.hb.set(s.hp/s.max);s.swing=Math.max(0,s.swing-dt);s.hit=Math.max(0,(s.hit||0)-dt);
    if(!canAct){release(s);animateGuardian(s.m,{time:G.t,moving:false,attacking:false,blocking:false});continue;}
    s.cd-=dt*towerRateK(tw,G.t);s.sig-=dt;s.scan-=dt;
    if(s.target&&(s.target.dead||s.target.E.fly||s.target.immT>G.t||!F.seen.has(key(...toTile(s.target.g.position.x,s.target.g.position.z)))))release(s);
    if(!s.target&&s.scan<=0){s.scan=.25;let best=null,bd=Infinity;for(const e of G.enemies){if(e.dead||e.E.fly||e.state==='spawn'||e.immT>G.t||tw.guards.some(o=>o!==s&&o.target===e)||!F.seen.has(key(...toTile(e.g.position.x,e.g.position.z))))continue;const d=p.distanceToSquared(e.g.position);if(d<bd&&pathTo(s,...toTile(e.g.position.x,e.g.position.z))){bd=d;best=e;}}s.target=best;}
    let moving=false;
    const e=s.target,target=e?toTile(e.g.position.x,e.g.position.z):s.home;
    if(!F.seen.has(key(...s.home)))s.home=F.q[Math.min(s.index,F.q.length-1)];
    const dist=e?Math.hypot(e.g.position.x-p.x,e.g.position.z-p.z):Math.hypot(tileX(s.home[0])-p.x,tileZ(s.home[1])-p.z);
    if(dist>(e?S.meleeRange:.25)){const step=pathTo(s,...target);if(step){const same=e&&step[0]===target[0]&&step[1]===target[1];const x=same?e.g.position.x:tileX(step[0]),z=same?e.g.position.z:tileZ(step[1]),dx=x-p.x,dz=z-p.z,d=Math.hypot(dx,dz);if(d>.05){s.charging=!!(e&&tw.B?.guardianCharge&&s.sig<=0);const mv=Math.min(d,dt*(s.charging?9:3.4));p.x+=dx/d*mv;p.z+=dz/d*mv;s.m.g.rotation.y=Math.atan2(dx,dz);moving=true;}}else if(e){release(s);s.scan=0;}}
    else if(e){s.m.g.rotation.y=Math.atan2(e.g.position.x-p.x,e.g.position.z-p.z);acquireGuard(e,s,G.t,S);if(activeGuard(e,G.t)===s){if(s.support>=.5){towerXp(tw,s.support*12);s.support=0;}}
      if(s.cd<=0){s.cd=1/S.rate;hit(s,e,s.charging?1.6:1);signature(s);if(s.charging){s.sig=6;Snd.play('hit',{pos:p});}s.charging=false;}
    }
    const [c,r]=toTile(p.x,p.z);p.y=G.tiles[c]?.[r]?.t===T.CARVED?-.46:0;
    animateGuardian(s.m,{time:G.t+s.index,moving,attacking:s.swing>0,blocking:!!(e&&activeGuard(e,G.t)===s)});
  }
}
