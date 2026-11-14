import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture} from './support/advance-e-runtime.mjs';
import {catFlight,stepCatFlight} from '../src/data/cat-flight.js';
import {ADV_E,eDescription} from '../src/data/hero-e.js';
import {treeESkill} from '../src/data/skill-tree.js';
import {catVoice} from '../src/audio/cat-voice.js';
const spec=ADV_E.fighter.dragon,cast=f=>f.api.castLegend(new f.THREE.Vector3(0,0,18));
const loss=e=>10000-e.hp;
const cats=f=>{const a=[];f.scene.traverse(o=>{if(o.name==='cat-spirit')a.push(o);});return a;};

test('one cat, recognizable owned body, animated paws/tail, existing unlock and balance constants',()=>{
 assert.equal(spec.cd,10);assert.equal(spec.mul,1);assert.equal(spec.ticks,3);assert.equal(spec.pierce,3);assert.equal(spec.reach,18);assert.equal(spec.width,1);
 const f=fixture('fighter','dragon');cast(f);f.tick(.16);assert.equal(cats(f).length,1);const cat=cats(f)[0],a=cat.userData.cat;
 assert.equal(a.legs.length,4);assert.ok(a.head.children.length>=7);assert.equal(a.tail.children.length,2);
 let draws=0,instances=0;cat.traverse(o=>{if(o.isMesh)draws++;if(o.isInstancedMesh)instances+=o.count;});assert.ok(instances>=20);assert.ok(draws<=24,'larger cat must not increase draw calls');
 f.tick(.1);assert.equal(cat.scale.x,1.9);
 const tail=a.tail.rotation.y,paw=a.legs[0].rotation.x;f.tick(.1);assert.notEqual(a.tail.rotation.y,tail);assert.notEqual(a.legs[0].rotation.x,paw);
 assert.equal(cats(f).length,1);assert.match(eDescription(spec),/100%씩 최대 9타\(적마다 3타\)/);f.tick(5);assert.equal(cats(f).length,0);
});
test('three actual 100% hits per healthy target, nine strike cap, armor applied per hit; proc never recurses',()=>{
 const f=fixture('fighter','dragon'),en=[2,4,6,8].map(z=>f.target(0,z,{armor:.2}));f.hero.lsk='pawstorm';cast(f);f.tick(5);
 assert.deepEqual(en.map(loss),[240,240,240,0]);assert.equal(f.hits.length,9);assert.deepEqual(Object.keys(f.G.legendN),[]);assert.equal(f.hero.licd,0);
});
test('weak enemies do not waste the original nine-hit budget; tenth enemy is untouched',()=>{
 const f=fixture('fighter','dragon'),en=Array.from({length:10},(_,i)=>f.target(0,1+i*1.2));for(const e of en)e.hp=1;
 cast(f);f.tick(5);assert.deepEqual(en.map(e=>e.dead),[true,true,true,true,true,true,true,true,true,false]);assert.equal(f.hits.length,9);assert.equal(en[9].hp,1);
});
test('uses dragon forward homing, excludes behind/off-cone and limits total curved travel',()=>{
 const f=fixture('fighter','dragon'),side=f.target(3,5),behind=f.target(0,-2),outside=f.target(19,4);cast(f);f.tick(4);
 assert.equal(loss(side),300);assert.equal(loss(behind),0);assert.equal(loss(outside),0);
 const g=catFlight({x:0,z:0},{x:0,z:1},spec),enemy={g:{position:{x:3,z:5}},dead:false};
 for(let i=0;i<1000&&!g.done;i++)stepCatFlight(g,1/60,[enemy],0,()=>{});
 assert.ok(g.distance<=18+1e-7);assert.ok(g.dx!==0);assert.equal(g.hit.size,1);
});
test('skill width/reach/damage tradeoffs remain active, exact boundary and no chasing escaped combo',()=>{
 for(const [mods,expected] of [[{eMul:.9,eRadius:1.2},270],[{eMul:1.2,eReach:.75},360]]){
  const f=fixture('fighter','dragon');f.hero.treeMods=mods;const e=f.target(0,3);cast(f);f.tick(4);assert.equal(loss(e),expected);
 }
 const a=fixture('fighter','dragon');a.hero.treeMods={eReach:.75};const far=a.target(0,13.51);cast(a);a.tick(4);assert.equal(loss(far),0);
 const f=fixture('fighter','dragon'),e=f.target(0,2);cast(f);f.tick(.25);assert.equal(loss(e),100);e.g.position.x=10;f.tick(3);assert.equal(loss(e),100);
 const s=treeESkill(spec,{eRadius:1.2,eReach:.75});assert.equal(s.reach*s.reachMul,13.5);assert.equal(s.width*s.radius,1.2);
});
test('dead, removed and invulnerable targets do not receive remaining swipes or create endless flight',()=>{
 for(const mode of ['dead','removed','immune']){
  const f=fixture('fighter','dragon'),e=f.target(0,2),next=f.target(0,5);cast(f);f.tick(.25);
  if(mode==='dead')e.dead=true;if(mode==='removed')f.G.enemies.splice(f.G.enemies.indexOf(e),1);if(mode==='immune')e.immT=99;
  f.tick(5);assert.equal(loss(e),100);assert.equal(loss(next),300);assert.equal(f.FX.length,0);
 }
});
test('cat follows a walking target through its combo, within the same finite travel budget',()=>{
 const f=catFlight({x:0,z:0},{x:0,z:1},spec),e={g:{position:{x:0,z:3}}},hits=[];
 for(let t=0;t<3&&!f.done;t+=.01){e.g.position.z+=2.6*.01;stepCatFlight(f,.01,[e],t,x=>hits.push({t,z:f.z,targetZ:x.g.position.z}));}
 assert.equal(hits.length,3);assert.ok(hits.every(x=>Math.abs(x.targetZ-x.z)<=f.width));assert.ok(f.distance<=18+1e-7);
});
test('air and boss receive same damage without inherited Q stun/slow; no control recursion',()=>{
 for(const extra of [{fly:true},{boss:true},{fly:true,boss:true}]){const f=fixture('fighter','dragon'),e=f.target(0,3,extra);cast(f);f.tick(5);assert.equal(loss(e),300);assert.equal(e.stunT,0);assert.equal(e.slowT,0);}
});
test('low FPS swept contact, path and per-target hit budget agree at 120/60/20 FPS',()=>{
 const run=dt=>{const f=catFlight({x:0,z:0},{x:0,z:1},spec),en=[{x:1,z:4},{x:1.5,z:7},{x:2,z:10},{x:3,z:12}].map((p,id)=>({id,g:{position:p}})),hits=[];for(let t=0;t<5&&!f.done;t+=dt)stepCatFlight(f,dt,en,t,e=>hits.push(e.id));return {hits,distance:f.distance,done:f.done};};
 const ref=run(1/120);for(const dt of [1/60,.05,.2]){const v=run(dt);assert.deepEqual(v.hits,ref.hits);assert.equal(v.done,true);assert.ok(Math.abs(v.distance-ref.distance)<1e-7);}
});
test('all cancellation paths dispose each owned material/geometry once during flight and combo',()=>{
 for(const during of [.17,.3])for(const mode of ['death','warp','map','town','remove']){
  const f=fixture('fighter','dragon');f.target(0,2);cast(f);f.tick(during);const c=cats(f)[0];assert.ok(c);const objects=new Set(),disposed=new Map();c.traverse(o=>{if(o.geometry)objects.add(o.geometry);if(o.material)objects.add(o.material);if(o.isInstancedMesh)objects.add(o);});for(const o of objects)o.addEventListener('dispose',()=>disposed.set(o,(disposed.get(o)||0)+1));
  const before=f.hits.length;if(mode==='death')f.hero.dead=5;if(mode==='warp')f.hero.warpT=1;if(mode==='map')f.G.tiles=[];if(mode==='town')f.G.screen='town';if(mode==='remove'){f.G.heroes=[];f.G.hero=null;}
  f.tick(.1);assert.equal(f.hits.length,before);assert.equal(f.FX.length,0);assert.equal(cats(f).length,0);for(const o of objects)assert.equal(disposed.get(o),1);
 }
});
test('100 repeated casts retain no cat/FX, no early recast, no shared-resource double disposal',()=>{
 const f=fixture('fighter','dragon');for(let i=0;i<100;i++){f.hero.lcd=0;assert.equal(cast(f),true);assert.equal(cast(f),false);f.tick(4);assert.equal(f.FX.length,0);assert.equal(f.scene.children.length,1);}
});

function audioFixture(){
 const nodes=[],param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=type=>{const n={type,gain:param(),frequency:param(),Q:param(),connect(){},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};nodes.push(n);return n;};
 const ctx={currentTime:0,state:'running',createOscillator:()=>node('osc'),createBiquadFilter:()=>node('filter'),createGain:()=>node('gain')};
 const c=vm.createContext({catVoice,localStorage:{getItem:()=>null},fetch:()=>Promise.resolve({ok:false}),window:{__hd3dBgAudio:true},addEventListener(){},setTimeout(){}});
 const src=fs.readFileSync(new URL('../src/audio/audio.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export const Snd','const Snd');vm.runInContext(src+';this.sound=Snd;',c);
 c.sound.ctx=ctx;c.sound.sfxG=node('destination');return {S:c.sound,ctx,nodes};
}
test('cast cue honors activation, suspended context, foreground, mute and zero volume',()=>{
 for(const mode of ['locked','suspended','background','muted','zero']){const f=audioFixture(),before=f.nodes.length;if(mode==='locked')f.S.ctx=null;if(mode==='suspended')f.ctx.state='suspended';if(mode==='background')f.S.bg.muted=true;if(mode==='muted')f.S.cfg.sfxOn=false;if(mode==='zero')f.S.cfg.sfx=0;assert.equal(f.S.meow({x:0,z:0}),undefined);assert.equal(f.nodes.length,before);}
});
test('one bounded meow, volume bus, no stacked recast; finish/cancel disconnect every owned node once',()=>{
 for(const cancel of [false,true]){const f=audioFixture(),stop=f.S.meow({x:0,z:0});assert.equal(typeof stop,'function');assert.equal(f.S.voices,1);assert.equal(f.S.meow({x:0,z:0}),undefined);assert.equal(f.nodes.filter(n=>n.started).length,1);
  if(cancel){stop();stop();}else f.nodes.find(n=>n.started).onended();assert.equal(f.S.voices,0);assert.equal(f.S.catVoiceStop,null);assert.ok(f.nodes.slice(1).every(n=>n.disconnected));
  f.ctx.currentTime=1;assert.equal(typeof f.S.meow({x:0,z:0}),'function');f.S.catVoiceStop();assert.equal(f.S.voices,0);
 }
});
test('one reserved cast voice survives busy combat and distance without overriding user volume',()=>{
 const f=audioFixture();f.S.voices=31;f.S.cfg.sfx=.2;const cfg=JSON.stringify(f.S.cfg),stop=f.S.meow({x:100,z:100});
 assert.equal(typeof stop,'function');assert.equal(f.S.voices,32);assert.equal(f.S.meow({x:0,z:0}),undefined);
 assert.equal(f.nodes[1].gain.value,.9*.55);assert.equal(JSON.stringify(f.S.cfg),cfg);
 stop();assert.equal(f.S.voices,31);assert.equal(f.S.catVoiceStop,null);assert.ok(f.nodes.slice(1).every(n=>n.disconnected));
});
