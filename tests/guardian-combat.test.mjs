import assert from 'node:assert/strict';
import {canGuard,acquireGuard,activeGuard,guardCombat,releaseGuard} from '../src/combat/guardian.js';
const stats={blockTime:3,bossBlockTime:.35,blockCooldown:5};
const enemy=()=>({E:{dps:10},hp:100,g:{position:{x:0,z:0}}});
const soldier=()=>({hp:100,tw:{dead:false},m:{g:{position:{x:1,z:0}}}});
const e=enemy(),s=soldier(),b=soldier();
assert(acquireGuard(e,s,0,stats));assert.equal(acquireGuard(e,b,1,stats),false);
assert.equal(guardCombat(e,1,1),s);assert.equal(s.hp,90);
releaseGuard(e,s);assert.equal(activeGuard(e,1),null);assert.equal(canGuard(e,4),false);
assert(acquireGuard(e,b,8,stats));assert(acquireGuard(e,s,16,stats));assert.equal(e.guardTotal,8);assert.equal(canGuard(e,30),false);
const boss=enemy();boss.E.boss=true;assert(acquireGuard(boss,s,0,stats));assert(acquireGuard(boss,b,8,stats));assert.equal(boss.guardTotal,.6);assert.equal(canGuard(boss,20),false);
for(const field of ['dead','fly','spawn','immune']){const x=enemy();if(field==='dead')x.dead=true;if(field==='fly')x.E.fly=true;if(field==='spawn')x.state='spawn';if(field==='immune')x.immT=10;assert.equal(canGuard(x,0),false);}
const x=enemy();acquireGuard(x,s,0,stats);s.hp=0;assert.equal(activeGuard(x,1),null);s.hp=100;s.tw.dead=true;assert.equal(activeGuard(x,1),null);
console.log('Guardian combat: shared lease, cooldown, lifetime cap, boss cap, death/flying/spawn/immunity passed');
