import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {towerStats,branchFor} from '../src/data/growth.js';
import {acquireGuard,releaseGuard,activeGuard,guardCombat} from '../src/combat/guardian.js';
import {towerRateK} from '../src/combat/towerstatus.js';
const scene=new THREE.Scene(),T={GRASS:0,CARVED:1,BEDROCK:5},G={tiles:[],t:0,enemies:[],structVer:0};
for(let c=0;c<24;c++){G.tiles[c]=[];for(let r=0;r<16;r++)G.tiles[c][r]={t:0};}
const tileX=c=>(c-11.5)*2,tileZ=r=>(r-7.5)*2,toTile=(x,z)=>[Math.floor(x/2+12),Math.floor(z/2+8)];
const model=()=>({g:new THREE.Group()});let pulses=0,sounds=0,disposed=0;
const ctx=vm.createContext({THREE,G,GW:24,GH:16,DIRS:[[1,0],[-1,0],[0,1],[0,-1]],T,inGrid:(c,r)=>c>=0&&c<24&&r>=0&&r<16,isBlock:t=>[2,3,4].includes(t),tileX,tileZ,toTile,scene,disposeOwned:()=>disposed++,guardianModel:model,animateGuardian:()=>{},hpBar:()=>({set(){},dispose(){}}),Snd:{play:()=>sounds++},P:{},emit(){},ringFx(){pulses++},hurt:(e,d)=>{e.hp-=d;if(e.hp<=0)e.dead=true},towerXp:(tw,x)=>tw.xp+=x,acquireGuard,releaseGuard,activeGuard,towerRateK});
let src=fs.readFileSync(new URL('../src/world/guardians.js',import.meta.url),'utf8').replace(/^import .*;\s*$/gm,'').replaceAll('export ','');vm.runInContext(src+';this.api={updGuardians,clearGuardians};',ctx);
const makeTw=(branch=null,lvl=5)=>({type:'guardian',c:12,r:7,lvl,branch,S:towerStats('guardian',lvl,branch),B:branchFor('guardian',branch,null,lvl),xp:0,shots:0});
const enemy=(p,E={})=>({hp:1e6,E:{dps:20,...E},g:{position:p.clone()},state:'walk'});
function tick(tw,n){for(let i=0;i<n;i++){G.t+=.05;for(const e of G.enemies)guardCombat(e,G.t,.05);ctx.api.updGuardians(tw,.05,true);}}
for(const branch of [null,'guardian_bulwark','guardian_assault']){
 G.enemies=[];const tw=makeTw(branch);ctx.api.updGuardians(tw,.05);assert.equal(tw.guards.length,2);const s=tw.guards[0],e=enemy(s.m.g.position),near=enemy(s.m.g.position.clone().add(new THREE.Vector3(.3,0,0)));G.enemies=[e,near];s.sig=0;
 if(branch==='guardian_assault'){s.charging=true;}
 const hp=e.hp;tick(tw,20);assert.ok(e.hp<hp,'melee damage '+branch+' '+JSON.stringify({target:!!s.target,pos:s.m.g.position,ep:e.g.position,scan:s.scan,cd:s.cd}));assert.ok(e.guardTotal>0,'enemy blocked');assert.ok(tw.xp>0,'support XP');
 if(branch==='guardian_bulwark'){assert.ok(e.hp<=hp-tw.S.dmg*2.6,'pulse damages ordinary enemy with no immT');assert.ok(s.sig>6);}
 if(branch==='guardian_assault')assert.ok(near.hp<1e6,'cleave damages nearby enemy');
 const flying=enemy(s.m.g.position,{fly:true});G.enemies=[flying];tick(tw,30);assert.equal(flying.hp,1e6);assert.equal(flying.guardSoldier,undefined);
 const old=s.m.g;s.hp=0;tick(tw,1);assert.equal(old.parent,null);tick(tw,180);assert.ok(s.hp>0&&s.m.g.parent===scene);
 const rebuilt=s.m.g;tw.lvl=4;tw.S=towerStats('guardian',4,branch);tick(tw,1);assert.equal(rebuilt.parent,null);assert.equal(tw.guards.length,2);
 const leased=enemy(s.m.g.position);G.enemies=[leased];tick(tw,7);const groups=tw.guards.map(s=>s.m.g);ctx.api.clearGuardians(tw);assert.ok(groups.every(g=>!g.parent));assert.equal(leased.guardSoldier,null);
}
assert.equal(scene.children.length,0);assert.ok(disposed>=12);console.log('Guardian runtime: melee, support XP, real pulse/cleave, flying exclusion, respawn, rebuild and cleanup passed', {pulses,sounds,disposed});
// A tower can have walkable cells on disconnected sides: don't lock onto unreachable enemies.
G.enemies=[];for(let r=0;r<16;r++)G.tiles[12][r].t=T.BEDROCK;G.structVer++;
const split=makeTw();ctx.api.updGuardians(split,.05);const right=split.guards[0];
const blocked=enemy(new THREE.Vector3(tileX(11),0,tileZ(7))),reachable=enemy(new THREE.Vector3(tileX(13),0,tileZ(9)));
G.enemies=[blocked,reachable];right.scan=0;tick(split,1);assert.equal(right.target,reachable,'Must choose reachable enemy, not nearer disconnected lane');
// A lease alone must not award XP when AI selected another action (cast/hero/bomber).
const credit=right.support||0;right.support=0;const xp=split.xp;for(let i=0;i<20;i++){G.t+=.05;ctx.api.updGuardians(split,.05);}assert.equal(split.xp,xp,'No fake support XP without guardCombat');
ctx.api.clearGuardians(split);console.log('Disconnected lanes and actual-support-only XP passed');
