import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeMeter } from '../src/ui/practice-meter.js';
import { newMeter, meterAdd, retireTowerMeter, towerAdd } from '../src/combat/meter.js';
const create=()=>({practiceSandbox:true,t:0,phase:'build',hero:{cls:'mage',dm:newMeter()},towers:[],dmTowers:[]});
test('Practice DPS tracks simulation wave time, not build, pause, or result time',()=>{
 const s=create(),m=createPracticeMeter();m.observe(s);s.t=10;m.observe(s);
 s.phase='wave';m.observe(s);s.t=12;meterAdd(s.hero.dm,60,s.t,false,true);m.observe(s);
 s.paused=true;m.observe(s);s.t=22;m.observe(s);s.paused=false;m.observe(s);
 s.t=23;meterAdd(s.hero.dm,30,s.t,true,false);m.observe(s);
 s.phase='build';m.observe(s);s.t=90;m.observe(s);s.phase='over';s.t=100;m.observe(s);
 const {seconds,damage,dps,heroes:[h],kills}=m.read(s);
 assert.deepEqual({seconds,damage,dps,kills},{seconds:3,damage:90,dps:30,kills:1});
 assert.deepEqual([h.basic,h.skill],[60,30]);assert.equal(m.reset(s),false);
 s.practiceSandbox=false;assert.equal(m.read(s).damage,0);
});
test('Reset does not touch simulation meters; sold tower retains identity and updates from in-flight attacks',()=>{
 const s=create(),m=createPracticeMeter();s.phase='wave';m.observe(s);
 const a={type:'arrow',lvl:3},b={type:'arrow',lvl:1};s.towers.push(a,b);
 towerAdd(s.dmTowers,a,80,true);towerAdd(s.dmTowers,b,40,false);meterAdd(s.hero.dm,70,1,true,true);
 s.t=1;const first=m.read(s);assert.equal(first.towers[0].damage,120);assert.equal(first.towers[0].towers.length,2);
 const aName=first.towers[0].towers[0].name,bName=first.towers[0].towers[1].name;
 assert.equal(m.reset(s),true);assert.equal(a.dmT,80);assert.equal(s.hero.dm.tot,70);
 assert.equal(m.read(s).damage,0);
 a.dead=true;retireTowerMeter(s.dmTowers,a);s.towers.shift();
 s.t=3;towerAdd(s.dmTowers,a,10,false);towerAdd(s.dmTowers,b,30,true);meterAdd(s.hero.dm,20,3,false,false);
 const next=m.read(s),arrow=next.towers[0];
 assert.deepEqual([next.seconds,next.damage,next.dps,next.kills],[2,60,30,1]);
 assert.deepEqual(arrow.towers.map(r=>[r.name,r.damage,r.kills]),[[bName,30,1],[aName+' · 제거',10,0]]);
 assert.equal(s.dmTowers[0].dmT,90);assert.equal(Object.hasOwn(s.dmTowers[0],'m'),false);
});
test('Sorting heroes is separate from towers and a sandbox state rewind clears baselines',()=>{
 const s=create(),m=createPracticeMeter(),archer={cls:'archer',dm:newMeter()};s.heroes=[s.hero,archer];
 s.phase='wave';m.observe(s);s.t=5;meterAdd(archer.dm,73,s.t,false,false);meterAdd(s.hero.dm,64,s.t,true,false);
 const one=m.read(s);assert.deepEqual(one.heroes.map(h=>h.damage),[73,64]);
 m.reset(s);s.hero={cls:'mage',dm:newMeter()};s.heroes=[s.hero];s.t=0;
 assert.equal(m.read(s).heroes.length,1);assert.equal(m.read(s).damage,0);
});
