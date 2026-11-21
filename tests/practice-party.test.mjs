import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {CLASSES,VISIBLE_HEROES,heroLabel} from '../src/data/heroes.js';
const source=readFileSync(new URL('../src/heroes/practice-party.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bexport\s+/g,'');
const heroSource=readFileSync(new URL('../src/heroes/hero.js',import.meta.url),'utf8');
function fixture({practiceSandbox=true}={}){
 const Vector3=class{set(x,y,z){Object.assign(this,{x,y,z});return this;}};
 const position=()=>new Vector3().set(0,0,0);
 const make=(cls,L)=>({cls,L,dead:0,path:[1],hp:10,max:10,skillCd:0,lcd:0,g:{position:position()}});
 const roster=VISIBLE_HEROES.slice().reverse(),main=make(roster[0],{}),G={practice:true,practiceSandbox,phase:'build',hero:main,heroes:[main]};
 const run={party:roster,loadouts:Object.fromEntries(roster.map((cls,i)=>[cls,{heroLevel:i+8,adv:{asset:cls}}]))};
 const dom={},events={},buttons=new Map(),loaded=[],spawned=[],assisted=[];
 const button=()=>({dataset:{},style:{},attrs:{},classList:{toggle(){}},setAttribute(k,v){this.attrs[k]=v;},querySelector:()=>({style:{}})});
 const $=id=>dom[id];dom.hud={appendChild:n=>{dom[n.id]=n;}};
 const deps={G,$,esc:s=>s,CLASSES,VISIBLE_HEROES,heroLabel,advModels:a=>a?[a.asset]:[],clearOrders:h=>{h.path=[];h.aiTgt=null;},heroAssets:h=>[h],ensureModels:async a=>loaded.push(...a),loadModel:async a=>loaded.push('adv:'+a),MON_ASSETS:['monster'],cam:{target:{lerp(){}}},typing:()=>false,openLayers:()=>[],resetControlInput(){},refreshHud(){},runSupportAI:h=>assisted.push(h.cls),passAt:()=>true,setControlled:h=>{G.hero=h;},spawnHero:(cls,L,party)=>{assert.equal(party,true);spawned.push([cls,L]);const h=make(cls,L);G.heroes.push(h);return h;},THREE:{Vector3},addEventListener:(k,fn)=>events[k]=fn,document:{createElement:()=>({...button(),querySelector(sel){if(!buttons.has(sel))buttons.set(sel,button());return buttons.get(sel);}})}};
 const api=new Function(...Object.keys(deps),source+'\nreturn {preparePracticeParty,initPracticeParty,updatePracticeParty,clearPracticeParty,switchPracticeHero,togglePracticeAssist};')(...Object.values(deps));
 const rest=new Function('G',heroSource.match(/const practiceRest = [^\n]+/)[0]+'; return practiceRest;')(G);
 return {api,run,main,G,dom,events,buttons,loaded,spawned,assisted,rest};
}
test('loads and deploys all visible heroes only in the sandbox using distinct hero loadouts',async()=>{
 for(const opt of [{practiceSandbox:false}]){
  const f=fixture(opt);assert.equal(await f.api.preparePracticeParty(f.run),false);assert.equal(f.api.initPracticeParty(f.run),false);assert.equal(f.loaded.length,0);
 }
 const f=fixture();
 assert.equal(await f.api.preparePracticeParty(f.run),true);
 assert.deepEqual(f.loaded,['monster',...f.run.party,...f.run.party.map(h=>'adv:'+h)]);
 assert.equal(f.api.initPracticeParty(f.run),true);
 assert.equal(f.api.initPracticeParty(f.run),false);
 assert.deepEqual(f.G.heroes.map(h=>h.cls),f.run.party);
 assert.deepEqual(f.spawned,f.run.party.slice(1).map(h=>[h,f.run.loadouts[h]]));
 assert.equal(f.G.hero,f.main);assert.equal(new Set(f.G.heroes.map(h=>JSON.stringify(h.g.position))).size,5);
 assert.equal((f.dom.practicePartyBar.innerHTML.match(/data-pick=/g)||[]).length,5);
});
test('assist is off by default, suppresses only background attacks and movement, and never resets cooldowns',()=>{
 const f=fixture();f.api.initPracticeParty(f.run);
 const support=f.G.heroes[1];support.skillCd=7;support.lcd=9;
 assert.equal(f.rest(f.main),false);assert.equal(f.rest(support),true);
 f.G.partyAI(support,.1);assert.deepEqual(f.assisted,[]);
 assert.equal(f.api.togglePracticeAssist(),true);assert.equal(f.rest(support),false);
 f.G.partyAI(support,.1);assert.deepEqual(f.assisted,[support.cls]);
 support.path=[1];assert.equal(f.api.togglePracticeAssist(),true);assert.deepEqual(support.path,[]);
 assert.equal(f.buttons.get('[data-assist]').attrs['aria-pressed'],'false');
 assert.equal(f.api.switchPracticeHero(1),true);
 assert.equal(f.rest(support),false);assert.equal(f.rest(f.main),true);assert.equal(support.skillCd,7);assert.equal(support.lcd,9);
 assert.match(heroSource,/if \(!rest\) for \(const e of G.enemies\)/);
 assert.match(heroSource,/h.cls === 'fighter' && !rest/);
});
test('keyboard cycles survivors, pause rejects control, loss auto-selects alive and ending detaches AI',()=>{
 const f=fixture();f.api.initPracticeParty(f.run);
 f.G.heroes[1].dead=5;
 f.events.keydown({key:'v',preventDefault(){}});
 assert.equal(f.G.hero,f.G.heroes[2]);
 f.G.paused=true;assert.equal(f.api.switchPracticeHero(3),false);f.G.paused=false;
 f.G.hero.dead=5;f.api.updatePracticeParty(.15);assert.equal(f.G.hero,f.G.heroes[3]);
 f.G.phase='over';f.api.updatePracticeParty(.15);assert.equal(f.dom.practicePartyBar.hidden,true);
 f.api.clearPracticeParty();assert.equal(f.G.partyAI,null);assert.equal(f.G.practiceParty,null);assert.equal(f.G.heroes.length,5);
});
