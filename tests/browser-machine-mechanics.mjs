import * as THREE from 'three';
import {MACHINE_ENEMIES} from '../src/data/chapters/machine.js';
export async function verify(){
 if(location.hostname!=='127.0.0.1'||!['8784','8785'].includes(location.port)||!location.search.includes('test=1')||G.gear.Acc.A.mode!=='guest'||G.gear.Acc.A.user)throw Error('Disposable guest only');
 G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();
 const D=await import('../src/monsters/machine.js'),A=await import('../src/monsters/abilities.js'),M=await import('../src/monsters/enemy.js'),T=await import('../src/combat/towerstatus.js');
 const checks=[],ok=(name,value)=>{if(!value)throw Error(name);checks.push(name);},h=G.hero;
 const clear=()=>{A.clearAbilities();for(const e of [...G.enemies])M.removeEnemy(e);};
 const spawn=(type,x=0,z=4)=>M.spawnEnemy(type,1,{x,z,tile:G.toTile(x,z)});
 const resetHero=()=>{h.dead=0;h.hp=h.max;h.g.position.set(0,0,0);};resetHero();clear();
 for(const[type,E]of Object.entries(MACHINE_ENEMIES)){const e=spawn(type);e.m.anim(e,.05);e.g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(e.g);ok(type+' finite own model',e.m.form===E.form&&[...b.min,...b.max].every(Number.isFinite));clear();}
 let e=spawn('repair_drone'),allies=[spawn('gear_hound',0,3),spawn('machine_guard',1,3),spawn('rivet_gunner',2,3),spawn('gear_hound',3,3),spawn('gear_hound',20,20)];allies.forEach(a=>a.hp=a.max*.5);e.hp=e.max*.5;e.machineCd=0;D.machineTick(e,.05);ok('drone warns before repair',e.machineCast?.kind==='repair');D.machineTick(e,1.4);ok('repair affects three nearby allies only',allies.filter(a=>a.hp>a.max*.5).length===3&&allies[4].hp===allies[4].max*.5&&e.hp===e.max*.5);clear();
 e=spawn('repair_drone');let ally=spawn('gear_hound',0,3);ally.hp=ally.max*.98;e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,1.4);ok('repair never overheals',ally.hp===ally.max);ally.hp=1;e.machineCd=0;D.machineTick(e,.05);M.hurt(e,e.max*.11);D.machineTick(e,.05);ok('focused damage interrupts repair',!e.machineCast&&ally.hp===1);clear();
 e=spawn('siege_crawler');e.machineCd=0;D.machineTick(e,.05);ok('shell snapshots hero position',e.machineCast.points[0].distanceTo(h.g.position)<.01);h.g.position.x=8;D.machineTick(e,2.1);ok('moving out avoids shell',h.hp===h.max);clear();
 resetHero();e=spawn('siege_crawler');e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,2.1);ok('staying in shell warning hurts',h.hp<h.max);clear();
 resetHero();e=spawn('siege_crawler');e.machineCd=0;D.machineTick(e,.05);M.hurt(e,e.max*.15);D.machineTick(e,.05);ok('focus damage interrupts cannon loading',!e.machineCast&&h.hp===h.max);clear();
 resetHero();e=spawn('rivet_gunner');e.machineCd=0;D.machineTick(e,.05);h.g.position.x=2;D.machineTick(e,1.8);ok('sideways dodge avoids piercing shot',h.hp===h.max);clear();
 resetHero();e=spawn('rivet_gunner');e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,1.8);ok('beam hits hero on line',h.hp<h.max);clear();
 resetHero();e=spawn('machine_guard',0,1.8);const hp=e.hp;M.hurt(e,10);const closed=hp-e.hp;e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,1.5);const open=e.hp;M.hurt(e,10);e.m.anim(e,.05);ok('slam opens armor and shield model',e.machineRecover>0&&open-e.hp>closed&&e.m.panels.every(p=>Math.abs(p.rotation.y)>.9));D.machineTick(e,2.3);ok('shield closes after recovery',e.armor===e.E.armor);clear();
 resetHero();e=spawn('foundry_warden');e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,2.3);ok('foundry builds two hounds and exposes core',G.enemies.filter(q=>q.type==='gear_hound').length===2&&e.machineRecover>0);clear();
 resetHero();e=spawn('boss_machine');e.machineCd=0;D.machineTick(e,.05);ok('boss opens with shell',e.machineCast.kind==='shell');D.machineTick(e,2.1);D.machineTick(e,2);e.machineCd=0;D.machineTick(e,.05);ok('boss alternates beam',e.machineCast.kind==='beam');D.machineTick(e,2.1);D.machineTick(e,2);e.hp=e.max*.49;D.machineTick(e,.05);ok('half health warns before phase',e.machineCast.kind==='awaken'&&!e.machineAwakened);D.machineTick(e,2.6);e.m.anim(e,.05);ok('phase opens reactor and launches two drones',e.machineAwakened&&e.armor===.1&&e.m.panels.every(p=>Math.abs(p.rotation.y)>.9)&&G.enemies.filter(q=>q.type==='repair_drone').length===2);D.machineTick(e,.05);ok('phase occurs once',G.enemies.length===3);clear();
 // Fixture towers isolate collision and debuff rules; no campaign result uses fixture gold.
 resetHero();h.g.position.set(100,0,100);const oldGold=G.gold,towers=[];G.gold=1000;
 for(let c=2;c<20&&towers.length<3;c++)for(let r=2;r<14&&towers.length<3;r++)if(!G.buildReason(c,r,'magic')&&G.build(c,r,'magic'))towers.push(G.towers.at(-1));
 ok('three diagnostic towers created',towers.length===3);const original=towers.map(t=>[t.c,t.r]);towers.forEach((t,i)=>{t.c=9;t.r=7+i;});const[x,z]=G.tileXZ(9,7);
 e=spawn('rivet_gunner',x,z-3);e.machineCd=0;D.machineTick(e,.05);const before=towers.map(t=>t.hp);D.machineTick(e,1.8);const losses=towers.map((t,i)=>before[i]-t.hp);ok('piercing line hits each tower exactly once',losses.every(n=>n===54));clear();
 e=spawn('coil_wasp',x,z+3);e.machineCd=0;D.machineTick(e,.05);D.machineTick(e,1.6);D.updateMachine(.05);ok('EMP slows nearby tower',towers.some(t=>T.towerRateK(t,G.t)===.6));D.updateMachine(3.1);G.t+=.3;ok('EMP expires without permanent slow',towers.every(t=>T.towerRateK(t,G.t)===1));clear();
 towers.forEach((t,i)=>{[t.c,t.r]=original[i];G.sellTower(t);});G.gold=oldGold;resetHero();
 for(let i=0;i<16;i++){e=spawn('coil_wasp');e.machineCd=0;D.machineTick(e,.05);M.removeEnemy(e);}ok('despawn cancels every warning',Object.values(D.machineEffects()).every(n=>n===0));
 e=spawn('foundry_warden');for(let i=0;i<9;i++){e.machineCd=0;e.machineRecover=0;D.machineTick(e,.05);D.machineTick(e,2.3);}ok('repeated assembly has bounded summons',G.enemies.filter(q=>q.type==='gear_hound').length===16);clear();
 ok('all chapter effect objects cleaned',Object.values(D.machineEffects()).every(n=>n===0));ok('sound off',!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn);
 return{checks,effects:D.machineEffects(),stats:G.stats,lineLosses:losses};
}
