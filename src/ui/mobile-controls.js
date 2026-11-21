import * as THREE from 'three';
import { G } from '../core/state.js';
import { T, inGrid, isBlock, tileX, tileZ, toTile } from '../core/grid.js';
import { cam, camera, renderer } from '../render/scene.js';
import { tileAt } from '../world/terrain.js';
import { groundY } from '../monsters/ai.js';
import { TOWERS, BARRICADE } from '../data/towers.js';
import { towerAvailable, towerVisible } from '../world/tower-rules.js';
import { SFX } from '../audio/sfx.js';
import { clearCost } from '../combat/build.js';
import { build, select, mouseGround, setTool } from './input.js';

const types = ['arrow','cannon','magic','guardian'].filter(towerVisible);
const practiceTypes = [...types,'barricade'];
const icons = {barricade:'🧱',clear:'⛏',arrow:'🏹',cannon:'💣',magic:'🔮',guardian:'🔆'};
export function tileOptions(t) {
  if (!t || t.tower || t.bar) return [];
  return isBlock(t.t) ? ['clear'] : t.t === T.GRASS ? (G.practiceSandbox ? practiceTypes : types) : t.t===T.CARVED ? ['barricade'] : [];
}
export function startTouchControls() {
  document.body.classList.add('mobileBattle');
  const $=id=>document.getElementById(id), cvs=renderer.domElement, pad=$('trialStick'), knob=pad.firstElementChild, menu=$('trialActions'), mark=$('trialMark');
  const ray=new THREE.Raycaster(), ground=new THREE.Plane(new THREE.Vector3(0,1,0),0), pt=new THREE.Vector3(), ndc=new THREE.Vector2();
  let laserButton=null,picked=null, stickId=null, pinched=false, pinch=null, lastHero=G.hero;
  const contacts=new Map();
  const battle=()=>!G.screen || G.screen==='game';
  const active=()=>battle()&&!G.dg?.blessing&&!G.paused && !G.navigating && (G.phase==='wave'||G.phase==='build');
  function close(){laserButton=null;picked=null;menu.hidden=mark.hidden=true;}
  function render(){
    if (!picked)return;
    const [c,r]=picked,t=tileAt(c,r), options=tileOptions(t);
    if (!active() || !options.length) {close();return;}
    laserButton=null;menu.replaceChildren();
    for (const k of options) {
      const cost=k==='clear'?clearCost(t):k==='barricade'?BARRICADE.cost:TOWERS[k].cost;
      const b=document.createElement('button');b.type='button';b.dataset.tool=k;b.setAttribute('aria-label',(k==='clear'?'개간':k==='barricade'?'바리케이드':TOWERS[k].n)+(G.practiceSandbox?'':' '+cost+'골드'));
      if(k==='guardian'){laserButton=b;b.disabled=!towerAvailable(k,G);}
      const icon=document.createElement('span');icon.textContent=icons[k];
      b.append(icon);
      if(!G.practiceSandbox){const small=document.createElement('small');small.textContent=cost+'G';b.append(small);}
      b.onclick=e=>{e.stopPropagation();if (!towerAvailable(k,G)||!active()||!picked||picked[0]!==c||picked[1]!==r||!tileOptions(tileAt(c,r)).includes(k)) return;
        const prev=G.tool;let ok=false;try{G.tool=k;ok=build(c,r);}finally{G.tool=prev;}
        if(ok && k!=='clear')close();else render();
      }; menu.append(b);
    }
    menu.hidden=mark.hidden=false; position();
  }
  function position(){
    if(!picked)return;if(laserButton)laserButton.disabled=!towerAvailable('guardian',G);if(!active()){close();return;}
    const [c,r]=picked,x=tileX(c),z=tileZ(r);pt.set(x,groundY(x,z)+.16,z).project(camera);
    const bounds=cvs.getBoundingClientRect(),sx=bounds.left+(pt.x+1)*bounds.width/2,sy=bounds.top+(1-pt.y)*bounds.height/2;
    mark.style.left=sx+'px';mark.style.top=sy+'px';
    const w=menu.offsetWidth,h=menu.offsetHeight;
    menu.style.left=Math.max(4,Math.min(innerWidth-w-4,sx-w/2))+'px';
    menu.style.top=Math.max(4,Math.min(innerHeight-h-4,sy>h+16?sy-h-12:sy+12))+'px';
  }
  function pick(e) {
    const b=cvs.getBoundingClientRect();
    ndc.set(2*(e.clientX-b.left)/b.width-1,1-2*(e.clientY-b.top)/b.height);ray.setFromCamera(ndc,camera);
    if(!ray.ray.intersectPlane(ground,pt)){close();return;}
    mouseGround.copy(pt);
    const [c,r]=toTile(pt.x,pt.z);close();
    if(G.dungeon)return;
    if(!inGrid(c,r))return;
    const t=tileAt(c,r);
    if(G.tool==='barricade'){if(build(c,r))setTool('move');return;}
    select(t.tower||t.bar||null);
    if (tileOptions(t).length) {picked=[c,r];render();}
  }
  // Canvas owns canvas contacts only. A thumb on the stick never becomes a pinch finger.
  function anchor(){
    if(contacts.size!==2){pinch=null;return;}
    const [a,b]=contacts.values();
    pinch={d:Math.max(4,Math.hypot(a.x-b.x,a.y-b.y)),r:cam.r};
  }
  function lost(id){
    if(!contacts.delete(id))return;
    anchor();if(!contacts.size)pinched=false;
  }
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel']) cvs.addEventListener(type,e=>{
    if(e.pointerType!=='touch'||(!active()&&!contacts.has(e.pointerId)))return;
    e.stopImmediatePropagation();e.preventDefault();
    if(type==='pointerdown'){
      SFX.init();contacts.set(e.pointerId,{x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,moved:false});
      cvs.setPointerCapture(e.pointerId);
      if(contacts.size>=2){pinched=true;close();anchor();}
      return;
    }
    const a=contacts.get(e.pointerId);if(!a)return;
    a.x=e.clientX;a.y=e.clientY;
    if(Math.hypot(a.x-a.x0,a.y-a.y0)>12)a.moved=true;
    if(type==='pointermove' && pinch && active()){
      const [p,q]=contacts.values(),d=Math.max(4,Math.hypot(p.x-q.x,p.y-q.y));
      cam.r=Math.max(14,Math.min(90,pinch.r*pinch.d/d));
    }
    if(type==='pointerup'||type==='pointercancel'){
      const ok=type==='pointerup'&&!pinched&&!a.moved&&active();
      lost(e.pointerId);if(ok)pick(e);
    }
  },{capture:true,passive:false});
  cvs.addEventListener('lostpointercapture',e=>lost(e.pointerId));
  const waveButton=$('startWave');waveButton.textContent='▶';waveButton.setAttribute('aria-label','웨이브 시작');
  const axis=G.trialAxis={x:0,y:0};
  function release(){stickId=null;axis.x=axis.y=0;knob.style.transform='translate(-50%,-50%)';}
  function drag(e){const b=pad.getBoundingClientRect(),rx=e.clientX-b.left-b.width/2,ry=e.clientY-b.top-b.height/2,d=Math.hypot(rx,ry),r=b.width*.31;
    const scale=d>r?r/d:1;axis.x=d<5?0:rx*scale/r;axis.y=d<5?0:-ry*scale/r;knob.style.transform='translate(calc(-50% + '+rx*scale+'px),calc(-50% + '+ry*scale+'px))';}
  pad.onpointerdown=e=>{if(stickId!==null||!active())return;e.preventDefault();close();SFX.init();stickId=e.pointerId;pad.setPointerCapture(stickId);drag(e);};
  pad.onpointermove=e=>{if(e.pointerId===stickId)drag(e);};
  for(const key of ['onpointerup','onpointercancel','onlostpointercapture'])pad[key]=e=>{if(e.pointerId===stickId)release();};
  const reset=()=>{contacts.clear();pinch=null;pinched=false;close();release();};
  addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  document.addEventListener('pointerdown',e=>{if(e.target!==cvs&&!menu.contains(e.target)&&!pad.contains(e.target))close();},true);
  mountBattleTools($,close,reset);
  return ()=>{if(lastHero!==G.hero){lastHero=G.hero;reset();}
    if(!active()){if(stickId!==null||picked||contacts.size)reset();}else position();};
}

// Preserve every real control and handler rather than creating duplicate actions.
function mountBattleTools($,close,reset){
  const hud=$('hud'), shelf=document.createElement('section'), toggle=document.createElement('button');
  shelf.id='mobileBattleTools';shelf.className='mobileBattleTools settings';shelf.hidden=true;
  toggle.id='mobileBattleMenu';toggle.type='button';toggle.textContent='☰';toggle.setAttribute('aria-label','전투 도구');toggle.setAttribute('aria-controls',shelf.id);
  const show=on=>{shelf.hidden=!on;toggle.setAttribute('aria-expanded',String(on));if(!on)$('sndPanel')?.classList.add('hidden');};
  toggle.onclick=()=>{reset();show(shelf.hidden);};hud.append(toggle,shelf);
  const cameraBar=$('camTop');
  cameraBar.setAttribute('aria-label','카메라');
  for(const [id,label,icon,step] of [['tiltUp','카메라 각도 올리기','▴',-.12],['tiltDown','카메라 각도 내리기','▾',.12]]){
    const button=document.createElement('button');button.type='button';button.id=id;button.textContent=icon;button.setAttribute('aria-label',label);
    button.onclick=()=>{cam.phi=Math.max(.45,Math.min(1.25,cam.phi+step));};
    button.addEventListener('keydown',e=>{if(e.key===' ')e.stopPropagation();});
    cameraBar.append(button);
  }
  for(const el of [$('cam'),$('sndBtn'),$('sndPanel'),$('ups'),$('wavePrev'),document.querySelector('#build [data-tool="barricade"]'),$('retreat')])if(el)shelf.append(el);
  show(false);
  document.addEventListener('pointerdown',e=>{if(!shelf.hidden&&!toggle.contains(e.target)&&!shelf.contains(e.target))show(false);},true);
  shelf.addEventListener('click',e=>{
    const b=e.target.closest('button');if(b && (['statBtn','pauseBtn','retreat'].includes(b.id)||b.dataset.tool==='barricade'))show(false);
  });
  for(const id of ['skillBtn','legBtn'])$(id)?.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!G.hero?.g)return;
    const h=G.hero,p=h.g.position;let nearest=null,dist=Infinity;
    for(const enemy of G.enemies||[]){if(enemy.dead||enemy.dying!==undefined||enemy.immT>G.t)continue;
      const q=enemy.g.position,d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<dist){dist=d;nearest=q;}}
    if(nearest)mouseGround.copy(nearest);
    else mouseGround.set(p.x+Math.sin(h.face||0)*5,p.y,p.z+Math.cos(h.face||0)*5);
    close();
  });
}
