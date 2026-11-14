import * as THREE from 'three';
import { STORM_ENEMIES } from '../src/data/chapters/storm.js';
export async function verify(){
 if(location.hostname!=='127.0.0.1'||!['8779','8785'].includes(location.port)||!location.search.includes('test=1')||G.gear.Acc.A.mode!=='guest'||G.gear.Acc.A.user)throw Error('Disposable guest only');
 G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();
 const D=await import('../src/monsters/storm.js'),A=await import('../src/monsters/abilities.js'),M=await import('../src/monsters/enemy.js'),T=await import('../src/combat/towerstatus.js');
 const checks=[],ok=(name,value)=>{if(!value)throw Error(name);checks.push(name);},h=G.hero;
 const clear=()=>{A.clearAbilities();for(const e of [...G.enemies])M.removeEnemy(e);};
 const spawn=(type,x=0,z=4)=>M.spawnEnemy(type,1,{x,z,tile:G.toTile(x,z)});
 const resetHero=()=>{h.dead=0;h.hp=h.max;h.g.position.set(0,0,0);};resetHero();clear();
 for(const[type,E]of Object.entries(STORM_ENEMIES)){const e=spawn(type);e.m.anim(e,.05);e.g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(e.g);ok(type+' finite own model',e.m.form===E.form&&[...b.min,...b.max].every(Number.isFinite));clear();}
 const ray=spawn('storm_splitter');M.hurt(ray,ray.max*2);A.updAbilities(.05);ok('manta death creates exactly two lightning eels',G.enemies.filter(e=>e.type==='storm_shard').length===2);clear();
 let e=spawn('storm_pikeman');e.stormCd=0;D.stormTick(e,.05);ok('lightning snapshots hero position',e.stormCast.points[0].distanceTo(h.g.position)<.01);const hp=h.hp;h.g.position.x=8;D.stormTick(e,1.6);ok('dodging warning avoids lightning',h.hp===hp);clear();
 resetHero();e=spawn('storm_pikeman');e.stormCd=0;D.stormTick(e,.05);D.stormTick(e,1.6);ok('remaining inside warning takes damage',h.hp<h.max);clear();
 resetHero();e=spawn('storm_caller');e.stormCd=0;D.stormTick(e,.05);M.hurt(e,e.max*.11);D.stormTick(e,.05);ok('focus damage interrupts gust',!e.stormCast&&D.stormEffects().fields===0);clear();
 e=spawn('storm_caller');e.stormCd=0;D.stormTick(e,.05);M.removeEnemy(e);ok('death cancels windup',D.stormEffects().casting===0);D.updateStorm(5);ok('cancelled cast never leaves field',D.stormEffects().fields===0);
 resetHero();e=spawn('storm_anchor',0,2);const armored=e.hp;M.hurt(e,10);const closedDamage=armored-e.hp;e.stormCd=0;D.stormTick(e,.05);D.stormTick(e,1.5);const open=e.hp;M.hurt(e,10);ok('anchor slam opens armor',e.stormRecover>0&&open-e.hp>closedDamage);D.stormTick(e,2);ok('armor returns after recovery',e.armor===e.E.armor);clear();
 resetHero();e=spawn('storm_sentinel',0,0);e.stormCd=0;D.stormTick(e,.05);D.stormTick(e,1.9);ok('center of ring is safe',h.hp===h.max);h.g.position.x=3;e.stormCd=0;D.stormTick(e,.05);D.stormTick(e,1.9);ok('ring band damages hero',h.hp<h.max);h.hp=h.max;e.stormCd=0;D.stormTick(e,.05);h.g.position.x=6;D.stormTick(e,1.9);ok('outside ring is safe',h.hp===h.max);clear();
 resetHero();e=spawn('boss_storm');e.stormCd=0;D.stormTick(e,.05);ok('judge opens with lightning',e.stormCast.kind==='lightning');D.stormTick(e,2);e.stormCd=0;D.stormTick(e,.05);ok('judge alternates hollow pulse',e.stormCast.kind==='pulse'&&e.stormCast.radius===6);D.stormTick(e,2);
 e.hp=e.max*.49;D.stormTick(e,.05);ok('half health warns before phase',e.stormCast.kind==='awaken'&&!e.stormAwakened);D.stormTick(e,2.2);e.m.anim(e,.05);ok('phase changes armor silhouette and summons three eels',e.stormAwakened&&e.armor===.08&&e.m.plates.every(p=>!p.visible)&&G.enemies.filter(q=>q.type==='storm_shard').length===3);D.stormTick(e,.05);ok('phase occurs once',G.enemies.length===4);clear();
 // Fixture-only structures: place through normal build API, then put them in a line to isolate chain geometry.
 resetHero();h.g.position.set(100,0,100);const oldGold=G.gold;G.gold=1000;const towers=[];
 for(let c=2;c<20&&towers.length<4;c++)for(let r=2;r<14&&towers.length<4;r++)if(!G.buildReason(c,r,'magic')&&G.build(c,r,'magic'))towers.push(G.towers[G.towers.length-1]);
 ok('four diagnostic towers created',towers.length===4);const original=towers.map(t=>[t.c,t.r]);towers.forEach((t,i)=>{t.c=9+i;t.r=8;});const[x,z]=G.tileXZ(9,8);
 e=spawn('storm_pikeman',x,z+3);e.stormCd=0;D.stormTick(e,.05);const before=towers.map(t=>t.hp);D.stormTick(e,1.6);const losses=towers.map((t,i)=>before[i]-t.hp);ok('chain hits primary and two neighbors only',losses[0]===44&&Math.abs(losses[1]-24.2)<1e-6&&Math.abs(losses[2]-24.2)<1e-6&&losses[3]===0);clear();
 e=spawn('storm_caller',x,z+3);e.stormCd=0;D.stormTick(e,.05);D.stormTick(e,1.7);D.updateStorm(.05);ok('gust slows tower attack',T.towerRateK(towers[0],G.t)===.7);D.updateStorm(4);G.t+=.3;ok('gust expiry restores rate',T.towerRateK(towers[0],G.t)===1);clear();
 towers.forEach((t,i)=>{[t.c,t.r]=original[i];G.sellTower(t);});G.gold=oldGold;resetHero();
 for(let i=0;i<12;i++){e=spawn('storm_caller');e.stormCd=0;D.stormTick(e,.05);M.removeEnemy(e);}ok('despawn cleans all warning and bolt objects',Object.values(D.stormEffects()).every(n=>n===0));ok('muted throughout',!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn);
 return{checks,effects:D.stormEffects(),stats:G.stats,chainLosses:losses};
}
