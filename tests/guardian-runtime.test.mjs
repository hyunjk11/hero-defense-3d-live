import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {towerStats,branchFor} from '../src/data/growth.js';
import {acquireGuard,releaseGuard,activeGuard,guardCombat} from '../src/combat/guardian.js';
import {enemyMarchRoute,closestMarchIndex} from '../src/combat/guardian-route.js';
import {towerRateK} from '../src/combat/towerstatus.js';
const scene=new THREE.Scene(),T={GRASS:0,CARVED:1,BEDROCK:5},G={tiles:[],t:0,enemies:[],towers:[],structVer:0};
for(let c=0;c<24;c++){G.tiles[c]=[];for(let r=0;r<16;r++)G.tiles[c][r]={t:0};}
const tileX=c=>(c-11.5)*2,tileZ=r=>(r-7.5)*2,toTile=(x,z)=>[Math.floor(x/2+12),Math.floor(z/2+8)];
const model=()=>({g:new THREE.Group()});let pulses=0,sounds=0,disposed=0;
const SPAWNS=[[0,7],[0,12]],CORE=[22,7];
const nextStep=(c,r)=>c<22?[c+1,r]:r!==7?[c,r+Math.sign(7-r)]:null;
const ctx=vm.createContext({THREE,G,SPAWNS,CORE,nextStep,enemyMarchRoute,closestMarchIndex,GW:24,GH:16,DIRS:[[1,0],[-1,0],[0,1],[0,-1]],T,inGrid:(c,r)=>c>=0&&c<24&&r>=0&&r<16,isBlock:t=>[2,3,4].includes(t),tileX,tileZ,toTile,scene,disposeOwned:()=>disposed++,guardianModel:model,animateGuardian:()=>{},hpBar:()=>({set(){},dispose(){}}),Snd:{play:()=>sounds++},P:{},emit(){},ringFx(){pulses++},hurt:(e,d)=>{e.hp-=d;if(e.hp<=0)e.dead=true},towerXp:(tw,x)=>tw.xp+=x,acquireGuard,releaseGuard,activeGuard,towerRateK});
let src=fs.readFileSync(new URL('../src/world/guardians.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replaceAll('export ','');vm.runInContext(src+';this.api={updGuardians,clearGuardians};',ctx);
const makeTw=(branch=null,lvl=5)=>{const t=({type:'guardian',c:12,r:7,lvl,branch,S:towerStats('guardian',lvl,branch),B:branchFor('guardian',branch,null,lvl),xp:0,shots:0});G.towers.push(t);return t;};
const enemy=(p,E={})=>({hp:1e6,E:{dps:20,...E},g:{position:p.clone()},state:'walk'});
function tick(tw,n){for(let i=0;i<n;i++){G.t+=.05;for(const e of G.enemies)guardCombat(e,G.t,.05);ctx.api.updGuardians(tw,.05,true);}}
for(const branch of [null,'guardian_bulwark','guardian_assault']){
 G.enemies=[];const tw=makeTw(branch);ctx.api.updGuardians(tw,.05);assert.equal(tw.guards.length,2);const s=tw.guards[0],e=enemy(s.m.g.position),near=enemy(s.m.g.position.clone().add(new THREE.Vector3(.3,0,0)));const spawning=enemy(s.m.g.position.clone()),immune=enemy(s.m.g.position.clone());spawning.state='spawn';immune.immT=G.t+99;G.enemies=[e,near,spawning,immune];s.sig=0;s.scan=0;
 if(branch==='guardian_assault'){s.charging=true;}
 const hp=e.hp;tick(tw,20);assert.equal(spawning.hp,1e6,'Spawn-protected enemy ignores melee and both signatures');assert.equal(immune.hp,1e6,'Immune enemy ignores melee and both signatures');assert.ok(e.hp<hp,'melee damage '+branch+' '+JSON.stringify({target:!!s.target,pos:s.m.g.position,ep:e.g.position,scan:s.scan,cd:s.cd}));assert.ok(e.guardTotal>0,'enemy blocked');assert.ok(tw.xp>0,'support XP');
 if(branch==='guardian_bulwark'){assert.ok(e.hp<=hp-tw.S.dmg*2.6,'pulse damages ordinary enemy with no immT');assert.ok(s.sig>6);}
 if(branch==='guardian_assault')assert.ok(near.hp<1e6,'cleave damages nearby enemy');
 const flying=enemy(s.m.g.position,{fly:true});G.enemies=[flying];tick(tw,30);assert.equal(flying.hp,1e6);assert.equal(flying.guardSoldier,undefined);
 const old=s.m.g;s.hp=0;tick(tw,1);assert.equal(old.parent,null);tick(tw,180);assert.ok(s.hp>0&&s.m.g.parent===scene);
 const rebuilt=s.m.g;tw.lvl=4;tw.S=towerStats('guardian',4,branch);tick(tw,1);assert.equal(rebuilt.parent,null);assert.equal(tw.guards.length,2);
 const leased=enemy(s.m.g.position);G.enemies=[leased];tick(tw,7);const groups=tw.guards.map(s=>s.m.g);ctx.api.clearGuardians(tw);assert.ok(groups.every(g=>!g.parent));assert.equal(leased.guardSoldier,null);
}
assert.equal(scene.children.length,0);assert.ok(disposed>=12);console.log('Guardian runtime: melee, support XP, real pulse/cleave, flying exclusion, respawn, rebuild and cleanup passed', {pulses,sounds,disposed});
// No enemies: move beyond the old tower leash and wait at distinct entrances.
G.enemies=[];const march=makeTw(null,1);ctx.api.updGuardians(march,.05);
const start=march.guards.map(s=>s.m.g.position.clone()),snapshot=JSON.stringify(G.tiles),oldDist=G.D;
// Sealed terrain and structures are not altered by the soldier-only movement.
for(let r=0;r<16;r++)G.tiles[8][r]={t:T.BEDROCK,hp:999,tower:{hp:321},bar:{hp:123}};
const sealed=JSON.stringify(G.tiles);G.structVer++;for(let i=0;i<500;i++){if(i%7===0){G.structVer++;G.D={};}const distRef=G.D;tick(march,1);assert.equal(G.D,distRef);}
assert.equal(JSON.stringify(G.tiles),sealed);assert.ok(G.D);
assert.equal(new Set(march.guards.map(s=>s.lane)).size,2);
for(const s of march.guards){const goal=SPAWNS[s.lane];assert.ok(s.waiting);assert.ok(Math.hypot(s.m.g.position.x-tileX(goal[0]),s.m.g.position.z-tileZ(goal[1]))<2.6);}
const waiting=march.guards.map(s=>s.m.g.position.clone());tick(march,30);march.guards.forEach((s,i)=>assert.ok(s.m.g.position.distanceTo(waiting[i])<.01));
const s=march.guards[0],e=enemy(s.m.g.position.clone().add(new THREE.Vector3(3,0,0)));e.state='spawn';G.enemies=[e];tick(march,10);assert.equal(e.hp,1e6);e.state='walk';tick(march,40);assert.ok(e.hp<1e6);assert.ok(s.m.g.position.distanceTo(waiting[0])>.1);
// Release a killed target and return to the entrance, not the tower.
e.dead=true;tick(march,80);assert.ok(s.waiting);
// A lease alone must not award XP if the enemy AI never entered guardCombat.
const held=enemy(s.m.g.position);G.enemies=[held];s.support=0;const xp=march.xp;for(let i=0;i<20;i++){G.t+=.05;ctx.api.updGuardians(march,.05);}assert.equal(march.xp,xp);
ctx.api.clearGuardians(march);console.log('Reverse march, multi-entrance wait/re-engage, solid transit, immutable terrain/path and support-only XP passed');

// Two soldiers at a single entrance hold separate waiting spots without drifting.
G.enemies=[];G.towers=[];SPAWNS.splice(1);G.structVer++;const pair=makeTw(null,1);tick(pair,500);assert.ok(pair.guards.every(s=>s.waiting));assert.ok(pair.guards[0].m.g.position.distanceTo(pair.guards[1].m.g.position)>1);const spots=pair.guards.map(s=>s.m.g.position.clone());tick(pair,30);pair.guards.forEach((s,i)=>assert.ok(s.m.g.position.distanceTo(spots[i])<.01));ctx.api.clearGuardians(pair);console.log('Single entrance formation spacing and stationary waiting passed');
