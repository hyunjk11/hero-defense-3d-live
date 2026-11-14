// Node-only, network-free fixture. Never imported by the game or the server.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
function no() { throw Error('SET_LAB_EXTERNAL_ACCESS_DISABLED'); }
const noop = () => {};
export async function createLab() {
  if (!vm.SourceTextModule) throw Error('Run Node with --experimental-vm-modules');
  const THREE = await import(pathToFileURL(path.join(root, 'lib/three.module.js')));
  const nodes = new Map(), sourceHashes = {}, mutedCalls = [], blocked = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent:'',innerHTML:'',style:{setProperty:noop,removeProperty:noop},classList:{toggle:noop},focus:noop});
    return nodes.get(id);
  };
  let roll = .999999;
  const math = Object.create(Math); math.random = () => roll;
  const ctx = vm.createContext({console, URLSearchParams, URL, structuredClone,
    Math:math, window:{}, location:{search:'?stage=1-1&rng=2311',hostname:'set-lab.invalid'},
    document:{getElementById:node}, fetch:no, WebSocket:no, XMLHttpRequest:no,
    localStorage:{getItem:no,setItem:no,removeItem:no}, setTimeout:no, setInterval:no});
  const scene = new THREE.Scene();
  const model = () => ({g:new THREE.Group(),acts:{},mats:[],ring:{material:{opacity:0}},mixer:{update:noop}});
  const sound = new Proxy({}, {get:(_,key)=>(..._args)=>mutedCalls.push(String(key))});
  const stubs = {
    'three':THREE,
    'src/account/account.js':{A:{user:null},load:no,update:no},
    'src/render/scene.js':{scene,cam:{theta:0}},
    'src/render/characters.js':{makeHeroModel:model,makeEnemyModel:model,play:noop,flashMats:noop},
    'src/render/chapter-gear.js':{updateChapterGear:noop},
    'src/render/hpbars.js':{hpBar:()=>({show:noop,set:noop,dispose:noop})},
    'src/render/vfx.js':{P:{},PB:{},emit:noop,ringFx:noop,debris:noop,popCoins:noop,dmgText:()=>({})},
    'src/render/toon.js':{glow:c=>new THREE.MeshBasicMaterial({color:c}),shareGeo:x=>x,shareMat:x=>x,disposeOwned:o=>{o.geometry?.dispose();o.material?.dispose();},disposeObj:noop},
    'src/render/quality.js':{Q:{}},
    'src/render/route.js':{drawRoute:noop,updRoute:noop},
    'src/render/loot.js':{lootFx:no},
    'src/audio/audio.js':{Snd:sound},
    'src/ui/hud.js':{banner:noop},
    'src/ui/input.js':{keys:{},mouseGround:new THREE.Vector3()},
    'src/world/terrain.js':{tileAt:()=>({t:0}),core:{position:new THREE.Vector3()},crystalMat:{emissive:{setHex:noop}}},
    'src/world/towers.js':{enemyAim:e=>e.g.position.clone()},
    'src/world/growth.js':{towerXp:no},
    'src/core/waves.js':{gameOver:no},
    'src/monsters/ai.js':{groundY:()=>0,shadowOf:noop},
    'src/monsters/hard.js':{hardDefinition:e=>e},
    'src/monsters/endgame.js':{endgameKilled:noop},
    'src/monsters/machine.js':{machineKilled:noop},
    'src/monsters/storm.js':{stormKilled:noop},
    'src/monsters/desert.js':{desertKilled:noop},
    // Targets have no special abilities; HP and meter mutation still use enemy.js.
    'src/monsters/abilities.js':{initAbilities:noop,armorOf:e=>e.E.armor||0,crackHit:no,absorbShield:no,onKilled:no},
    'src/heroes/legend.js':{legendProc:no,updLeap:no,updLegendHero:noop},
    'src/heroes/gunner.js':{gunAttack:no,updRose:no,gunSkill:no},
    'src/heroes/mechanic.js':{mechAbsorb:no,mechInit:no,mechRevert:no,mechSwing:no,updMech:()=>false,mechTransform:no},
    'src/heroes/fighter.js':{fighterInit:no,fighterTick:no,ftStop:no,updFtLeap:no,ftGuard:no,fighterSkill:no},
    'src/heroes/advfx.js':{advFx:noop,advInit:noop,advUpd:no,advPick:no,advArrow:no,advOrb:no,advLeech:no,advAtkMul:no,advOnHurt:no,advSkill:no},
  };
  const cache = new Map();
  function module(id) {
    if (cache.has(id)) return cache.get(id);
    let m;
    if (Object.hasOwn(stubs,id)) {
      const values=stubs[id], keys=Object.keys(values);
      m=new vm.SyntheticModule(keys,function(){for(const k of keys)this.setExport(k,values[k]);},{context:ctx,identifier:id});
    } else {
      if (!id.startsWith('src/') || id.includes('..') || !id.endsWith('.js') || /(?:config|firebase|server|direct|network)\//.test(id)) {blocked.push(id);throw Error('SET_LAB_IMPORT_BLOCKED '+id);}
      const source=fs.readFileSync(path.join(root,id),'utf8');
      sourceHashes[id]=createHash('sha256').update(source).digest('hex');
      m=new vm.SourceTextModule(source,{context:ctx,identifier:id,importModuleDynamically:no});
    }
    cache.set(id,m);return m;
  }
  const entries=['src/core/state.js','src/account/equip.js','src/account/progress.js','src/account/set-status.js','src/ui/setview.js','src/heroes/hero.js','src/heroes/skills.js','src/combat/projectiles.js','src/monsters/enemy.js','src/data/herostats.js','src/data/heroes.js'];
  const bootstrap=new vm.SourceTextModule(entries.map((id,i)=>`import * as m${i} from './${id}'; export {m${i}};`).join('\n'),{context:ctx,identifier:'bootstrap'});
  await bootstrap.link((specifier,parent)=>module(specifier==='three'?'three':path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier),specifier))));
  await bootstrap.evaluate();
  const [State,E,P,Sets,View,Hero,Skills,Projs,Enemy,Stats,Heroes]=entries.map((_,i)=>bootstrap.namespace['m'+i]);
  const {G,runTimer}=State;
  let save=P.empty(); save.nick='RAM set test';
  const owner='set-lab-memory-only';
  function cleanBattle() {
    scene.clear();G.heroes=[];G.hero=null;G.curHero=null;G.projs=[];G.enemies=[];G.timers=[];G.fxs=[];
    Object.assign(G,{t:0,phase:'build',growthEnabled:true,focus:0,perm:{hp:0,atk:0},adv:null,legend:null,heroTree:null,heroLevel:1,dungeon:false,spire:false,stage:{hard:false},mWho:undefined,mK:0});
  }
  function spawn(cls='mage') {
    cleanBattle(); return Hero.spawnHero(cls,{perm:{hp:0,atk:0},equip:E.bonus(save,cls),heroGear:E.equippedItems(save,cls),heroLevel:1,adv:null,legend:null,heroTree:null});
  }
  function target(distance=2) {
    const h=G.hero, e=Enemy.spawnEnemy('grunt',100000,{tile:[21,7],x:h.g.position.x-distance,z:h.g.position.z});
    e.hp=e.max=1e8;e.E={...e.E,armor:0,gold:0};return e;
  }
  function tick(dt=1/120,{basic=false}={}) {
    G.t+=dt;
    if (basic) Hero.updHero(dt);
    if (G.hero.skillCd>0) G.hero.skillCd-=dt;
    for(let i=G.timers.length-1;i>=0;i--){const tm=G.timers[i];tm.t-=dt;if(tm.t<=0){G.timers.splice(i,1);runTimer(tm);}}
    Projs.updProjs(dt);
  }
  return {G,E,P,Sets,View,Hero,Skills,Projs,Enemy,Stats,Heroes,THREE,owner,sourceHashes,stubs:Object.keys(stubs).filter(x=>x!=='three'),mutedCalls,blocked,
    save:()=>save, reset(){save=P.empty();save.nick='RAM set test';cleanBattle();},
    seed(set,grade=0){save.inv=E.SLOT_KEYS.map((s,i)=>({...E.makeItem(s,'mage',set==='morvia'?3:grade,()=>.31,set),id:'lab-'+i}));for(const it of save.inv)E.codexAdd(save,it);return save.inv;},
    equip(slot,cls='mage'){const it=save.inv.find(x=>x.s===slot);return E.equip(save,cls,it?.id)[1];},
    unequip(slot,cls='mage'){E.unequip(save,cls,slot);},
    roundtrip(){save=P.clean(JSON.parse(JSON.stringify(save)));},
    spawn,target,tick,setRoll(n){roll=n;},
    snapshot(){const h=G.hero;return {hp:h.max,attack:Hero.stat.dmg(),rate:Hero.stat.rate(),range:Hero.stat.range(),skill:Hero.stat.skillMul(),cooldown:Hero.stat.skillCd(),sets:structuredClone(h.equippedSets)};},
    async verifyIsolation(){for(const expression of ["fetch('https://example.invalid')","localStorage.getItem('save')","new XMLHttpRequest()"]){let denied=false;try{vm.runInContext(expression,ctx);}catch(e){denied=e.message==='SET_LAB_EXTERNAL_ACCESS_DISABLED';}if(!denied)throw Error('isolation failure '+expression);}return true;},
  };
}
