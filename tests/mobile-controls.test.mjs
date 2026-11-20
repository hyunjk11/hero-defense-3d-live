import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';
import {towerAvailable} from '../src/data/towers.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const strip=s=>s.replace(/^import .*;.*$/gm,'').replace(/\bexport (?=function|const)/g,'');
function fixture(){
 class Element {
  constructor(){this.handlers={};this.style={};this.children=[];this.dataset={};this.hidden=true;this.classList={add(){}};}
  addEventListener(t,fn){this.handlers[t]=fn;} setPointerCapture(){} replaceChildren(){this.children=[];}
  setAttribute(k,v){this[k]=v;} appendChild(el){this.children.push(el);} append(...els){this.children.push(...els);}
  contains(el){return this===el||this.children.includes(el);}
  getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}
 }
 const nodes=Object.fromEntries(['trialStick','trialActions','trialMark','startWave','hud','cam','camTop','sndBtn','sndPanel','ups','wavePrev','retreat','skillBtn','legBtn','barricade'].map(k=>[k,new Element()]));
 const cvs=new Element(),pad=nodes.trialStick,menu=nodes.trialActions;pad.firstElementChild=new Element();
 const doc=new Element();doc.getElementById=k=>nodes[k];doc.querySelector=()=>nodes.barricade;doc.createElement=()=>new Element();doc.body=new Element();
 const G={phase:'build',tool:'move',gold:220},tile={t:1},T={GRASS:0,CARVED:9},called=[],cam={r:58,theta:.22,phi:.9},mouseGround=new THREE.Vector3();
 const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,12,8);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const towers=Object.fromEntries(['arrow','cannon','magic','guardian'].map(k=>[k,{n:k,cost:60}]));
 const env=vm.createContext({towerAvailable,cam,mouseGround,setTool:k=>G.tool=k,BARRICADE:{cost:30},THREE,G,T,isBlock:t=>t===1,TOWERS:towers,document:doc,renderer:{domElement:cvs},camera,inGrid:()=>true,toTile:()=>[2,3],tileAt:()=>tile,tileX:()=>0,tileZ:()=>0,groundY:()=>0,clearCost:()=>15,
 select(){},build(c,r){called.push([c,r,G.tool]);if(G.gold<(G.tool==='clear'?15:60))return false;
 if(G.tool==='clear'){G.gold-=15;tile.t=0;}else {G.gold-=60;tile.tower={};}return true;},
 addEventListener(){},innerWidth:720,innerHeight:400,SFX:{init(){}}});
 vm.runInContext(strip(read('src/ui/mobile-controls.js'))+';this.update=startTouchControls();',env);
 const event=(x=50,y=50,id=5,type='touch')=>({clientX:x,clientY:y,pointerId:id,pointerType:type,stopImmediatePropagation(){},preventDefault(){},stopPropagation(){}});
 const send=(t,...args)=>cvs.handlers[t](event(...args));const tap=()=>{send('pointerdown');send('pointerup');};
 return {G,tile,called,cam,mouseGround,nodes,menu,pad,event,send,tap,update:env.update};
}
test('obstacle: tap offers clear only; preserve location and existing price, then four contextual towers; no duplicate build',()=>{
 const f=fixture();f.tap();assert.deepEqual(f.menu.children.map(b=>b.dataset.tool),['clear']);
 assert.equal(f.G.gold,220);f.menu.children[0].onclick(f.event());assert.equal(f.G.gold,205);
 assert.deepEqual(f.menu.children.map(b=>b.dataset.tool),['arrow','cannon','magic','guardian']);
 const magic=f.menu.children[2];magic.onclick(f.event());magic.onclick(f.event());
 assert.equal(f.menu.hidden,true);assert.deepEqual(f.called,[[2,3,'clear'],[2,3,'magic']]);assert.equal(f.G.tool,'move');
});
test('grass offers four options directly; rejected build preserves choice; swipes, canceled, mouse or multi-contact taps do not activate a palette',()=>{
 const f=fixture();f.tile.t=0;
 f.send('pointerdown');f.send('pointermove',70);f.send('pointerup',70);assert.equal(f.menu.hidden,true);
 f.send('pointerdown');f.send('lostpointercapture');f.send('pointerup');assert.equal(f.menu.hidden,true);
 f.send('pointerdown');f.send('pointercancel');f.send('pointerup');assert.equal(f.menu.hidden,true);
 f.send('pointerdown',50,50,1);f.send('pointerdown',50,50,2);f.send('pointerup',50,50,2);f.send('pointerup',50,50,1);assert.equal(f.menu.hidden,true);
 f.send('pointerdown',50,50,1,'mouse');f.send('pointerup',50,50,1,'mouse');assert.equal(f.menu.hidden,true);
 f.tap();assert.equal(f.menu.children.length,4);f.G.gold=0;f.menu.children[0].onclick(f.event());assert.equal(f.menu.hidden,false);
 f.G.paused=true;f.update();assert.equal(f.menu.hidden,true);
});
test('dedicated stick supports diagonal movement, opposite axes, capture cancellation and pause',()=>{
 const f=fixture();f.pad.onpointerdown(f.event(80,25));assert.ok(f.G.trialAxis.x>0&&f.G.trialAxis.y>0);assert.ok(Math.hypot(f.G.trialAxis.x,f.G.trialAxis.y)<=1.00001);
 f.pad.onpointermove(f.event(15,75));assert.ok(f.G.trialAxis.x<0&&f.G.trialAxis.y<0);f.pad.onlostpointercapture(f.event());assert.equal(Math.hypot(f.G.trialAxis.x,f.G.trialAxis.y),0);
 f.pad.onpointerdown(f.event(80,50));f.G.paused=true;f.update();assert.equal(f.G.trialAxis.x,0);
});
test('two fingers change camera radius, clamp to existing wheel limits; three fingers re-anchor without a ghost tap',()=>{
 const f=fixture();
 f.send('pointerdown',20,30,1);f.send('pointerdown',60,30,2);f.send('pointermove',100,30,2);assert.equal(f.cam.r,29);
 f.send('pointermove',500,30,2);assert.equal(f.cam.r,14);
 f.send('pointermove',21,30,2);assert.equal(f.cam.r,90);
 f.send('pointerdown',50,80,3);f.send('pointermove',65,30,2);assert.equal(f.cam.r,90);
 f.send('pointerup',50,80,3);f.send('pointermove',110,30,2);assert.equal(f.cam.r,45);
 f.send('pointercancel',20,30,1);f.send('pointerup',110,30,2);assert.equal(f.menu.hidden,true);assert.equal(f.called.length,0);
 f.tap();assert.equal(f.menu.hidden,false);
});
test('stick can run while another finger builds without becoming a pinch; inactive town, dungeon and blessing boundaries',()=>{
 const f=fixture();f.G.screen='town';f.tap();assert.equal(f.menu.hidden,true);
 f.G.screen=null;f.pad.onpointerdown(f.event(80,40,12));f.tap();assert.equal(f.menu.hidden,false);assert.ok(f.G.trialAxis.x>0);assert.equal(f.cam.r,58);
 f.G.dungeon=true;f.tap();assert.equal(f.menu.hidden,true);
 f.G.dg={blessing:[1]};f.update();assert.equal(f.G.trialAxis.x,0);
 f.G.dg=null;f.G.dungeon=false;f.tile.t=9;f.tap();assert.deepEqual(f.menu.children.map(b=>b.dataset.tool),['barricade']);
});
test('full HUD reuses actual controls; nearest live enemy supplies a manual skill target for touch only',()=>{
 const f=fixture(),[menu,shelf]=f.nodes.hud.children;
 assert.equal(menu['aria-controls'],shelf.id);assert.equal(shelf.hidden,true);menu.onclick();assert.equal(shelf.hidden,false);
 for(const id of ['cam','sndBtn','sndPanel','ups','wavePrev','retreat','barricade'])assert.ok(shelf.children.includes(f.nodes[id]));
 f.G.hero={g:{position:new THREE.Vector3(0,0,0)},face:0};f.G.enemies=[{dead:true,g:{position:new THREE.Vector3()}},{g:{position:new THREE.Vector3(3,0,4)}}];
 f.nodes.skillBtn.handlers.pointerdown(f.event());assert.equal(f.mouseGround.x,3);assert.equal(f.mouseGround.z,4);
});

test('APK keeps the camera toolbar outside the drawer and confines tilt to the desktop camera range',()=>{
 const f=fixture(),bar=f.nodes.camTop,shelf=f.nodes.hud.children[1];
 assert.equal(shelf.hidden,true);assert.ok(!shelf.children.includes(bar));
 const [up,down]=bar.children;assert.equal(up.id,'tiltUp');assert.equal(down.id,'tiltDown');assert.equal(up['aria-label'],'카메라 각도 올리기');
 up.onclick();assert.ok(f.cam.phi<.9);for(let i=0;i<20;i++)up.onclick();assert.equal(f.cam.phi,.45);
 for(let i=0;i<20;i++)down.onclick();assert.equal(f.cam.phi,1.25);assert.equal(f.cam.r,58);assert.equal(f.cam.theta,.22);
});

test('fifth wave preparation silently enables an open laser icon; stale direct taps stay guarded',()=>{
 const f=fixture();f.tile.t=0;f.G.phase='wave';f.G.wave=4;f.tap();
 const laser=f.menu.children.find(b=>b.dataset.tool==='guardian');assert.equal(laser.disabled,true);laser.onclick(f.event());assert.equal(f.called.length,0);
 f.G.phase='build';f.update();assert.equal(laser.disabled,false);laser.onclick(f.event());assert.equal(f.called[0][2],'guardian');
 for(const phase of ['build','wave','over'])for(let wave=0;wave<=6;wave++)assert.equal(towerAvailable('guardian',{phase,wave}),phase==='build'?wave>=4:phase==='wave'&&wave>=5);
});

test('public build helper never places a previously selected tower when laser is locked',()=>{
 const main=read('src/main.js').split('\n').find(s=>s.startsWith('G.build ='));
 const guard=read('src/ui/input.js').match(/function setTool\(t\) \{ (if\(!towerAvailable\(t,G\)\)return false;)/)[1];
 const G={tool:'arrow',wave:4,phase:'wave',gold:200},ctx=vm.createContext({G,towerAvailable,build(){G.gold-=60;return true;}});
 vm.runInContext('function setTool(t){'+guard+'G.tool=t;}'+main,ctx);
 assert.equal(G.build(2,3,'guardian'),false);assert.equal(G.gold,200);assert.equal(G.tool,'arrow');
});
