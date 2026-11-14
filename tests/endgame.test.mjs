import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {ETYPES,ROSTERS} from '../src/data/monsters.js';
import {STAGES,stageUnlocked,stageReward,nextStage} from '../src/data/stages.js';
import {CHSET} from '../src/data/items.js';
import * as E from '../src/account/equip.js';
import * as P from '../src/account/progress.js';
import * as H from '../src/data/hero-growth.js';
import * as geometry from '../src/monsters/endgame-geometry.js';
import {endgameIcon} from '../src/ui/endgame-icons.js';
const read=f=>fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/\bexport (?=(?:const|function|let))/g,'');
let cases=0;const check=(name,fn)=>{fn();cases++;console.log('PASS '+name);};
check('12 stage definitions and 14 distinct roster roles',()=>{
 const forms=[];for(const ch of [9,10]){const roster=ROSTERS[ch];for(const type of [...roster.pool.map(p=>p[0]),roster.miniboss,roster.boss]){const e=ETYPES[type];assert.equal(e.proc,'endgame');assert.ok(e.desc&&e.icon);forms.push(e.form);if(e.endgame)assert.ok(e.endgame.windup>=1.4);}
 for(let i=1;i<=6;i++){const s=STAGES[`${ch}-${i}`];assert.ok(s.waves>=13);assert.equal(s.boss===true,i===6);assert.equal(new Set(s.spawns.map(p=>p.join())).size,s.spawns.length);}}
 assert.equal(new Set(forms).size,14);assert.equal(ETYPES.rift_spawn.gold,0);assert.ok(ETYPES.rift_spawn.child);
});
check('unlock, first/repeat rewards, save normalization and no changed legacy grant',()=>{
 let s=P.empty();s.st['8-6']=2;assert.ok(stageUnlocked(s,'9-1'));assert.ok(!stageUnlocked(s,'10-1'));
 const old=H.initialGrowth(s).granted;
 for(const ch of [9,10])for(let i=1;i<=6;i++){const id=`${ch}-${i}`;assert.ok(stageUnlocked(s,id));const before=s.souls;let result;[s,result]=P.applyStage(s,id,2,'mage',()=>.4);assert.equal(s.souls-before,stageReward(id,true));assert.ok(result.loot.every(x=>!x.it||x.it.c===ch));assert.equal(H.initialGrowth(s).granted,old);}
 assert.deepEqual(P.clean(s).st,s.st);assert.equal(nextStage(s,'10-6'),null);assert.equal(nextStage(s,'9-6'),'10-1');assert.equal(H.campaignXP('9-1',13,true,true),675);assert.equal(H.campaignXP('10-6',16,true,true),895);
 const g=H.initialGrowth();g.first=['9-1','10-6','bad'];assert.deepEqual(H.cleanGrowth(g).first,['9-1','10-6']);
});
check('80 unique names, grade stats, set bonuses, 16 icons and cleaned item identity',()=>{
 const names=new Set(),icons=new Set();for(const ch of [9,10])for(const row of Object.keys(CHSET[ch].names)){
 for(let g=0;g<5;g++){const slot=['armor','acc'].includes(row)?row:'weapon',it=E.makeItem(slot,row,g,()=>.45,ch);assert.equal(it.m[1],E.MAIN[it.m[0]][g]);assert.equal(it.c,ch);names.add(CHSET[ch].names[row][g]);}
 icons.add(endgameIcon({c:ch,s:['armor','acc'].includes(row)?row:'weapon',h:row}));}
 assert.equal(names.size,80);assert.equal(icons.size,16);for(const icon of icons)assert.ok(icon.includes('class="endgameItemIcon"'));assert.ok(fs.readFileSync(new URL('../style.css',import.meta.url),'utf8').includes('.machineItemIcon,.endgameItemIcon{'));
});
function fixture(){
 const scene=new THREE.Scene(),G={stats:{},enemies:[],towers:[],heroes:[],t:0,tiles:Array.from({length:24},()=>Array.from({length:16},()=>({t:0})))},hits=[];
 const no=()=>{};G.heroDamage=(n,h)=>{h.hp-=n;hits.push(n);};
 const ctx=vm.createContext({THREE,G,scene,...geometry,T:{BEDROCK:5,CORE:7},tileX:n=>n,tileZ:n=>n,toTile:(x,z)=>[Math.round(x),Math.round(z)],inGrid:(c,r)=>c>=0&&r>=0&&c<24&&r<16,shareGeo:g=>{g.userData.shared=true;return g;},disposeOwned:o=>o.traverse?.(m=>{if(m.geometry&&!m.geometry.userData.shared)m.geometry.dispose();if(m.material)m.material.dispose();}),P:{},emit:no,ringFx:no,dmgText:no,banner:no,Snd:{play:no,roar:no}});
 vm.runInContext(strip(read('monsters/endgame.js'))+'\nthis.api={initEndgame,endgameTick,updateEndgame,clearEndgame,endgameKilled,endgameEffects};',ctx);
 const enemy=(type,x=10,z=8)=>{const E=ETYPES[type],g=new THREE.Group();g.position.set(x,0,z);scene.add(g);const e={E,g,hp:E.hp,max:E.hp,armor:E.armor,stunT:0,type};G.enemies.push(e);return e;};
 ctx.api.initEndgame({spawnEnemy:(type,m,p)=>{const e=enemy(type,p.x,p.z);e.hp=e.max=e.E.hp*m;return e;},damageTower:(t,n)=>{t.hp-=n;hits.push(n);}});
 const hero=(x=10,z=10)=>{const h={g:new THREE.Group(),hp:1000,dead:0};h.g.position.set(x,0,z);G.heroes.push(h);return h;};
 const cast=(e,kind)=>{if(kind)e.endPattern=e.E.endgame.pattern.indexOf(kind);e.endCd=0;ctx.api.endgameTick(e,.01);assert.ok(e.endCast);return e.endCast;};
 const finish=e=>ctx.api.endgameTick(e,e.endCast.t+.01);
 return {G,scene,hits,enemy,hero,cast,finish,...ctx.api};
}
check('new summoned shards grant no kill reward; existing slime children retain it',()=>{
 const source=read('monsters/enemy.js'),body=source.slice(source.indexOf('function killEnemy(e)'),source.indexOf('function reachCore(e)'));
 const G={gold:0,stats:{goldEarned:0,kills:{}}},no=()=>{};
 const ctx=vm.createContext({G,enemyAim:e=>e.g.position,emit:no,P:{},PB:{},debris:no,popCoins:no,Snd:{play:no},play:no});
 vm.runInContext(body+';this.kill=killEnemy;',ctx);
 for(const type of ['rift_spawn','slime_s']){const E={gold:0,child:true,h:1};ctx.kill({type,E,g:{position:new THREE.Vector3()},hb:{show:no},m:{}});}
 assert.equal(G.stats.summonedKills,1);assert.equal(G.stats.kills.rift_spawn,undefined);assert.equal(G.stats.kills.slime_s,1);assert.equal(G.gold,0);
});
check('fixed line aim and one hit; moving away evades',()=>{const f=fixture(),e=f.enemy('rift_lancer'),h=f.hero();f.cast(e);h.g.position.x+=3;f.finish(e);assert.equal(h.hp,1000);e.endCd=0;h.g.position.set(10,0,10);f.cast(e);f.finish(e);assert.equal(h.hp,950);});
check('ring inner safe region, outside safe, annulus hits',()=>{const f=fixture(),e=f.enemy('rift_keeper');const a=f.hero(10,8),b=f.hero(10,12),c=f.hero(10,15);f.cast(e,'ring');f.finish(e);assert.equal(a.hp,1000);assert.equal(b.hp,920);assert.equal(c.hp,1000);});
check('cleave armor opening restores and telegraph cleanup',()=>{const f=fixture(),e=f.enemy('dragon_guard');f.hero();f.cast(e);f.finish(e);assert.equal(e.armor,.04);f.endgameTick(e,2.6);assert.equal(e.armor,.4);assert.equal(f.endgameEffects().casting,0);});
check('interrupt and caster death cancel damage/summon and dispose marks',()=>{for(const dead of [false,true]){const f=fixture(),e=f.enemy('rift_caller');f.hero();f.cast(e);if(dead)f.endgameKilled(e);else{e.hp-=e.max*.09;f.endgameTick(e,.1);}assert.equal(e.endCast,null);assert.equal(f.G.enemies.length,1);assert.equal(f.scene.children.length,1);}});
check('ward expiration, no stacking, death and clear cleanup',()=>{const f=fixture(),e=f.enemy('void_lantern'),a=f.enemy('void_walker',11,8);f.cast(e);f.finish(e);assert.equal(a.shield,a.max*.12);assert.equal(f.endgameEffects().wards,1);f.updateEndgame(5.1);assert.equal(a.shield,0);assert.equal(a.endWard,null);f.cast(e);f.finish(e);f.endgameKilled(a);assert.equal(f.endgameEffects().wards,0);f.clearEndgame();assert.deepEqual(JSON.parse(JSON.stringify(f.endgameEffects())),{traces:0,wards:0,casting:0});});
check('finite summon budget, simultaneous cap and invalid spawn tiles',()=>{const f=fixture(),e=f.enemy('rift_caller');f.hero();for(let i=0;i<6;i++){f.cast(e);f.finish(e);for(const x of f.G.enemies)if(x.E.child)x.dead=true;}assert.equal(e.endSummoned,12);e.endCd=0;f.endgameTick(e,.1);assert.ok(!e.endCast);const a=fixture(),b=a.enemy('rift_caller');a.hero();for(const col of a.G.tiles)for(const t of col)t.t=5;a.cast(b);a.finish(b);assert.equal(a.G.enemies.length,1);});
check('boss phase occurs once, changes armor and cooldown, no direct damage',()=>{const f=fixture(),e=f.enemy('boss_dragon');f.hero();e.hp=e.max*.4;f.endgameTick(e,.1);assert.equal(e.endCast.kind,'awaken');f.finish(e);assert.equal(e.armor,.1);assert.ok(Math.abs(e.endCd-9.6)<1e-9);assert.equal(f.hits.length,0);f.endgameTick(e,.1);assert.ok(!e.endCast);});
console.log(`endgame ${cases} groups passed`);
