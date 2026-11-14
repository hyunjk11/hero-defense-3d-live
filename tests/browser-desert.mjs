import * as THREE from 'three';
import { DESERT_ENEMIES } from '../src/data/chapters/desert.js';
import { makeDesertEnemy } from '../src/render/desert-monsters.js';
import { renderer } from '../src/render/scene.js';
import { disposeOwned } from '../src/render/toon.js';
function guard(){if(location.hostname!=='127.0.0.1'||!['8775','8785'].includes(location.port)||!location.search.includes('test=1')||G.gear.Acc.A.mode!=='guest'||G.gear.Acc.A.user)throw Error('Disposable guest only');G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();}
export async function verifyDesert(){
 guard();const D=await import('../src/monsters/desert.js'),A=await import('../src/monsters/abilities.js'),M=await import('../src/monsters/enemy.js'),T=await import('../src/combat/towerstatus.js'),PF=await import('../src/world/pathfinding.js');
 const checks=[],ok=(name,value)=>{if(!value)throw Error(name);checks.push(name);};
 const clear=()=>{A.clearAbilities();for(const e of [...G.enemies])M.removeEnemy(e);};
 const spawn=(type,x=0,z=4)=>M.spawnEnemy(type,1,{x,z,tile:G.toTile(x,z)});
 const h=G.hero;h.dead=0;h.hp=h.max;h.g.position.set(0,0,0);clear();
 for(const[type,E]of Object.entries(DESERT_ENEMIES)){const e=spawn(type);e.m.anim(e,.05);e.g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(e.g);ok(type+' finite distinct model',e.m.form===E.form&&[...b.min,...b.max].every(Number.isFinite));clear();}
 const priest=spawn('sand_priest');priest.desertCd=0;D.desertTick(priest,.05);const hp=h.hp;
 ok('sand warning fixed at hero position',priest.desertCast.targets[0].distanceTo(h.g.position)<.01);h.g.position.x=8;D.desertTick(priest,1.7);
 ok('moving out avoids sand impact',h.hp===hp&&D.desertEffects().fields===1);
 D.updateDesert(4);ok('sandfield expires',D.desertEffects().fields===0);
 h.g.position.x=0;priest.desertCd=0;D.desertTick(priest,.05);M.hurt(priest,priest.max*.11);D.desertTick(priest,.05);
 ok('focus damage interrupts priest',!priest.desertCast&&D.desertEffects().fields===0);
 clear();const guardE=spawn('sand_guard');guardE.g.rotation.y=Math.PI;
 const front={x:0,z:0,kind:'ranged'};ok('shield reduces frontal damage',Math.abs(M.shieldFactor(guardE,front)-.3)<.001);
 guardE.desertCd=0;h.g.position.z=1;D.desertTick(guardE,.05);const before=h.hp;D.desertTick(guardE,1.2);
 ok('cleave damages inside telegraph',h.hp<before);ok('cleave opens shield',guardE.guardOpenT>0&&M.shieldFactor(guardE,front)===1);
 D.desertTick(guardE,2);ok('shield closes after recovery',M.shieldFactor(guardE,front)<1);clear();
 h.hp=h.max;h.g.position.set(0,0,0);const sphinx=spawn('sand_sentinel');sphinx.desertCd=0;D.desertTick(sphinx,.05);h.g.position.x=2;const safeHp=h.hp;D.desertTick(sphinx,1.8);
 ok('sideways dodge avoids sphinx beam',h.hp===safeHp);sphinx.desertCd=0;D.desertTick(sphinx,.05);D.desertTick(sphinx,1.8);ok('beam hits its fixed lane',h.hp<safeHp);clear();
 h.hp=h.max;h.g.position.set(0,0,0);const bird=spawn('sand_vulture');bird.desertCd=0;D.desertTick(bird,.05);bird.m.anim(bird,.05);D.desertTick(bird,1.3);
 ok('vulture dive damages marked target',h.hp<h.max&&bird.m.wings.length===2&&bird.m.wings.every(w=>Number.isFinite(w.rotation.z)));clear();
 const worm=spawn('sand_burrower',G.tileXZ(12,8)[0],G.tileXZ(12,8)[1]);worm.desertCd=0;D.desertTick(worm,.05);
 ok('burrow announces adjacent tile',worm.desertCast?.kind==='burrow'&&Math.abs(worm.desertTile[0]-worm.tile[0])+Math.abs(worm.desertTile[1]-worm.tile[1])===1);
 const dest=worm.desertTile.slice(),dtile=G.tileAt(...dest),old={t:dtile.t,hp:dtile.hp,max:dtile.max};dtile.t=G.T.DIRT;dtile.hp=dtile.max=10;
 D.desertTick(worm,1.1);ok('burrow carves one tile then travels',worm.desertTravel&&dtile.t===G.T.CARVED&&worm.immT>G.t);
 const whp=worm.hp;M.hurt(worm,10);ok('submerged worm is untargetable',worm.hp===whp);D.desertTick(worm,1.1);ok('worm emerges exposed at warned tile',worm.tile.join()===dest.join()&&worm.desertRecover>0&&!worm.immT);M.hurt(worm,10);ok('exposed worm takes damage',worm.hp<whp);clear();
 Object.assign(dtile,old);G.refreshTile?.(dtile);PF.invalidatePaths();
 const blocked=spawn('sand_burrower',G.tileXZ(12,8)[0],G.tileXZ(12,8)[1]);blocked.desertCd=0;D.desertTick(blocked,.05);const bt=G.tileAt(...blocked.desertTile);const bar=bt.bar;bt.bar={hp:100};D.desertTick(blocked,1.1);ok('new barricade cancels warned burrow',!blocked.desertTravel);bt.bar=bar;clear();
 h.hp=h.max;h.g.position.set(0,0,0);const boss=spawn('boss_desert');boss.desertCd=0;D.desertTick(boss,.05);ok('boss first attack is a lane',boss.desertCast.kind==='beam');D.desertTick(boss,1.9);boss.desertCd=0;D.desertTick(boss,.05);ok('boss alternates ground stings',boss.desertCast.kind==='sting');D.desertTick(boss,1.9);
 boss.hp=boss.max*.49;D.desertTick(boss,.05);ok('half health announces phase',boss.desertCast.kind==='awaken');D.desertTick(boss,2.1);boss.m.anim(boss,.05);
 ok('phase exposes core and spawns exactly three scarabs',boss.desertAwakened&&boss.armor===.08&&boss.m.plates.every(p=>!p.visible)&&G.enemies.filter(e=>e.type==='sand_scarab').length===3);
 D.desertTick(boss,.05);ok('phase is not repeated',G.enemies.length===4);clear();
 for(let i=0;i<12;i++){const e=spawn('sand_priest');e.desertCd=0;D.desertTick(e,.05);M.removeEnemy(e);}
 ok('despawn removes all warnings',Object.values(D.desertEffects()).every(n=>n===0));ok('muted throughout',!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn);
 return{checks,stats:G.stats,effects:D.desertEffects()};
}
export function gallery(){
 guard();G.pauseRender=true;for(const el of [...document.body.children])if(el.tagName!=='SCRIPT')el.style.display='none';
 const wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;background:#242735;color:#f4e0b8;font-family:Malgun Gothic,sans-serif';document.body.append(wrap);
 renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);wrap.append(renderer.domElement);
 const label=(text,x,y,size)=>{const d=document.createElement('div');d.textContent=text;d.style.cssText=`position:absolute;left:${x}px;top:${y}px;font-size:${size}px;font-weight:bold`;wrap.append(d);};
 label('6장 · 태양의 사막',24,12,24);const W=innerWidth/4,H=(innerHeight-58)/2;renderer.setScissorTest(true);
 Object.entries(DESERT_ENEMIES).forEach(([type,E],i)=>{const row=Math.floor(i/4),col=i%4,s=new THREE.Scene();s.background=new THREE.Color(row?0x28313b:0x303b45);s.add(new THREE.HemisphereLight(0xf1f5ff,0x737281,2));const sun=new THREE.DirectionalLight(0xffe3a4,3);sun.position.set(-4,8,5);s.add(sun);const m=makeDesertEnemy(E);m.inner.position.y=0;m.g.rotation.y=.45;s.add(m.g);const b=new THREE.Box3().setFromObject(m.g),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());const cam=new THREE.PerspectiveCamera(34,W/H,.1,100);const distance=Math.max(size.y,size.x*H/W,size.z)*2.05;cam.position.copy(center).add(new THREE.Vector3(.28,.25,1).multiplyScalar(distance));cam.lookAt(center);const y=innerHeight-58-(row+1)*H;renderer.setViewport(col*W,y,W,H);renderer.setScissor(col*W,y,W,H);renderer.render(s,cam);label(E.n,col*W+18,61+row*H,17);});renderer.setScissorTest(false);return{models:8,muted:true};
}
export async function verifySandTower(){
 guard();const D=await import('../src/monsters/desert.js'),M=await import('../src/monsters/enemy.js'),T=await import('../src/combat/towerstatus.js');D.clearDesert();for(const e of [...G.enemies])M.removeEnemy(e);
 if(G.towers.length)throw Error('Fresh map required');const oldGold=G.gold;G.gold=1000;
 let tile;for(let c=3;c<20&&!tile;c++)for(let r=2;r<14;r++)if(!G.buildReason(c,r,'magic')){tile=[c,r];break;}
 if(!tile||!G.build(...tile,'magic'))throw Error('Test tower placement failed');const tw=G.towers[0],[x,z]=G.tileXZ(...tile);G.hero.g.position.set(100,0,100);
 const e=M.spawnEnemy('sand_priest',1,{x:x+3,z,tile:G.toTile(x+3,z)});e.desertCd=0;const hp=tw.hp;D.desertTick(e,.05);D.desertTick(e,1.7);D.updateDesert(.05);
 if(tw.hp!==hp-30||T.towerRateK(tw,G.t)!==.65)throw Error('Field damage or slowdown mismatch');const cd=tw.cd=5;T.towerCdStep(tw,1,G.t);if(Math.abs(tw.cd-(cd-.65))>1e-8)throw Error('Tower CD not slowed');
 D.updateDesert(4);G.t+=.3;if(T.towerRateK(tw,G.t)!==1)throw Error('Tower slowdown did not expire');G.sellTower(tw);G.gold=oldGold;M.removeEnemy(e);D.clearDesert();return{damage:30,rate:.65,expired:true,muted:!G.Snd.cfg.bgmOn&&!G.Snd.cfg.sfxOn};
}
export async function gearGallery(){
 guard();const C=await import('../src/render/characters.js'),CG=await import('../src/render/chapter-gear.js'),E=await import('../src/account/equip.js');
 const heroes=['archer','mage','warrior','gunner','fighter'];await C.ensureModels(heroes.flatMap(h=>C.heroAssets(h)));
 G.pauseRender=true;for(const el of [...document.body.children])if(el.tagName!=='SCRIPT')el.style.display='none';
 const wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;background:#252c38;color:#f2dca2;font-family:Malgun Gothic,sans-serif';document.body.append(wrap);renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);wrap.append(renderer.domElement);const title=document.createElement('h2');title.textContent='태양묘 수호자 · 영웅별 착용 외형';title.style.cssText='position:absolute;top:0;left:22px';wrap.append(title);
 const results=[],W=innerWidth/5,H=innerHeight-60;renderer.setScissorTest(true);
 for(const[h,index]of heroes.map((h,i)=>[h,i])){
  const ch=C.makeHeroModel(h),items=E.SLOT_KEYS.map(slot=>E.makeItem(slot,h,4,()=>.4,6));C.play(ch,'Idle');ch.mixer.update(.4);CG.updateChapterGear(ch,items);const nodes=ch.desertGearNodes.length; if(nodes<(h==='gunner'||h==='fighter'?5:4))throw Error(h+' missing attachment');
  const first=[...ch.desertGearNodes];CG.updateChapterGear(ch,items);if(ch.desertGearNodes.some((p,i)=>p!==first[i]))throw Error('needless rebuild');CG.updateChapterGear(ch,[{...items[0],c:5},items[1],items[2]]);if(ch.swampGearNodes.length<1)throw Error('mixed set missing');CG.updateChapterGear(ch,[]);if(first.some(p=>p.parent)||ch.mats.some(m=>m.userData.desertGear||m.userData.swampGear))throw Error('unequip leaked');CG.updateChapterGear(ch,items);
  ch.g.updateMatrixWorld(true);const tips=ch.desertGearNodes.map(p=>p.getWorldPosition(new THREE.Vector3()).toArray());if(!tips.flat().every(Number.isFinite))throw Error(h+' invalid attachment position');results.push({hero:h,nodes,tips});
  const s=new THREE.Scene();s.background=new THREE.Color(index%2?0x303945:0x28313b);s.add(new THREE.HemisphereLight(0xf0f5ff,0x627080,2));const sun=new THREE.DirectionalLight(0xffe3af,2.7);sun.position.set(-4,8,5);s.add(sun);s.add(ch.g);ch.g.rotation.y=.18;
  const cam=new THREE.PerspectiveCamera(30,W/H,.1,100);cam.position.set(.3,2.2,7);cam.lookAt(0,1.4,0);renderer.setViewport(index*W,0,W,H);renderer.setScissor(index*W,0,W,H);renderer.render(s,cam);
  const label=document.createElement('div');label.textContent=items[0].n;label.style.cssText=`position:absolute;top:70px;left:${index*W+12}px;width:${W-24}px;font-size:15px;text-align:center`;wrap.append(label);
 }
 renderer.setScissorTest(false);return results;
}
