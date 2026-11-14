// Local RAM QA only. Explicit state injection; never normal-play or production evidence.
import {castSkill} from '/src/heroes/skills.js';
import {groundY} from '/src/monsters/ai.js';
import {updFx,updParticles,P,PB} from '/src/render/vfx.js';
import {G} from '/src/core/state.js';
import {spawnHero,stat,heroDamage,updHero,withHero} from '/src/heroes/hero.js';
import {castLegend,updLegend,legendActive,legendCd} from '/src/heroes/legend.js';
import {ADV,advOf,advModels} from '/src/data/advance.js';
import {ADV_E} from '/src/data/hero-e.js';
import {treeOptions,changeTree,treeBuild} from '/src/data/skill-tree.js';
import {ensureModels,heroAssets,MON_ASSETS,disposeHeroModel} from '/src/render/characters.js';
import {scene,renderer,camera,cam,updateCam} from '/src/render/scene.js';
import {removeEnemy} from '/src/monsters/enemy.js';
import {refreshHud} from '/src/ui/hud.js';
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8860'||!window.__isolatedReview?.memoryOnly)throw Error('isolated RAM QA required');};
const render=()=>{updateCam();renderer.render(scene,camera);};
export const resources=()=>{let objects=0;scene.traverse(()=>objects++);return{geometry:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,objects,fx:G.lfx.length,projs:G.projs.length,bars:G.BARS.length};};
export async function setup(h,b,choice=-1){
 guard();if(G.phase==='select'){G.choose(h);}G.manual=true;G.pauseRender=true;G.setAutoSkill(false,true);G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();
 G.screen='town';updLegend(.01);updFx(10);for(const e of [...G.enemies])removeEnemy(e);G.enemies.length=0;
 for(const old of G.heroes){old.hb?.dispose?.();disposeHeroModel(old.ch);}G.heroes.length=0;
 const adv=advOf(h,{b,n:1});await ensureModels([...MON_ASSETS,...heroAssets(h,true),...advModels(adv)]);
 let trees={};if(choice>=0)for(const tier of [15,20,30,40,50])trees=changeTree(trees,h,b,50,0,tier,treeOptions(h,b,tier)[choice].id);
 Object.assign(G,{screen:null,phase:'build',growthEnabled:true,heroLevel:50,perm:{hp:0,atk:0},equip:{},legend:null,adv,heroTree:treeBuild(trees,h,b,50),focus:0});
 const hero=spawnHero(h);hero.g.position.set(0,groundY(0,1),1);hero.face=0;hero.C={...hero.C,dmg:100,levelSkill:1,armor:0};hero.adv={...hero.adv,atk:{...hero.adv.atk,crit:0,dmg:1}};hero.eq={};
 cam.target.set(0,0,4);cam.r=38;cam.phi=.9;cam.theta=.22;document.querySelectorAll('#scr_town,#select,#scr_intro,#scr_menu,#scr_login,#statPanel').forEach(e=>e.classList.add('hidden'));document.querySelector('#hud').classList.remove('hidden');
 refreshHud();render();return{h,b,choice,key:legendActive()?.key,tree:hero.tree,resources:resources(),camera:{r:cam.r,phi:cam.phi,theta:cam.theta},assumption:'Lv50 with real advancement, base damage normalized to100, equipment empty; stationary target fixture'};
}
export function target(z=3,x=0,{air=false,boss=false,armor=.2}={}){guard();const type=air?'bat':'grunt',e=G.spawnEnemy(type,1,{x,z,tile:G.toTile(x,z)});e.E={...e.E,armor,shieldDef:null,boss};e.g.position.y=groundY(x,z);e.hp=e.max=100000;e.immT=0;return e;}
export function castAt(x=0,z=3){guard();G.hero.lcd=0;const s=legendActive(),before=G.enemies.map(e=>e.hp),ok=castLegend(new G.THREE.Vector3(x,0,z));refreshHud();render();return{ok,s,before,cd:legendCd()};}
export function tick(sec,dt=.02){guard();for(let t=0;t<sec;t+=dt){G.t+=dt;G.hero.ch.mixer.update(dt);updLegend(dt);updFx(dt);updParticles(P,dt);updParticles(PB,dt);}refreshHud();render();return{hp:G.enemies.map(e=>e.hp),shield:G.hero.eShield?{...G.hero.eShield}:null,resources:resources(),errors:window.__isolatedReview.errors};}
export async function measureAll(){guard();const rows=[];for(const [h,bs]of Object.entries(ADV_E))for(const b of Object.keys(bs))for(const choice of [-1,0,1]){const initial=await setup(h,b,choice),e=target();const start=castAt();tick(9);rows.push({...initial,hit:100000-e.hp,cast:start.ok,cd:start.cd,effects:resources().fx,errors:[...window.__isolatedReview.errors]});}return rows;}
export async function lifecycle(){guard();const rows=[];for(const [h,bs]of Object.entries(ADV_E))for(const b of Object.keys(bs)){await setup(h,b);castAt();tick(9);const before=resources();for(let i=0;i<20;i++){castAt();tick(9);}rows.push({h,b,n:20,before,after:resources()});}return rows;}

export async function interactions(){
 guard();const rows=[];
 for(const [h,bs] of Object.entries(ADV_E))for(const b of Object.keys(bs)){
  await setup(h,b,0);const e=target(2),owner=G.hero;owner.cd=0;owner.skillCd=0;
  const cast=castAt(),before={hp:e.hp,proj:G.projs.length,timers:G.timers.length};
  updHero(.01);castSkill(e.g.position);const busy={hp:e.hp,proj:G.projs.length,timers:G.timers.length,qCd:owner.skillCd,eCastT:owner.eCastT};
  if(busy.hp!==before.hp||busy.proj!==before.proj||busy.timers!==before.timers||busy.qCd!==0)throw Error('E cast failed to lock attacks/Q '+b);
  tick(9);owner.C.level=9;const gated=legendActive()===null;owner.C.level=50;owner.adv=null;const base=legendActive()?.key;
  rows.push({h,b,cast:cast.ok,busy,gated,base});
 }
 await setup('warrior','paladin');const h=G.hero;h.C.armor=.2;h.hp=h.max*.5;const hp=h.hp;castAt();tick(.4);const shield=h.eShield.value;heroDamage(100);const after={hp:h.hp,shield:h.eShield?.value};
 if(after.hp!==hp||Math.abs(after.shield-(shield-80))>1e-7)throw Error('shield actual armor path mismatch');
 h.warpT=1;tick(.02);if(h.eShield)throw Error('warp retained shield');
 return {rows,shield:{hp,shield,after,warpCleared:!h.eShield},errors:[...window.__isolatedReview.errors]};
}
