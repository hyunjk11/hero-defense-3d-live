// Local-only visual/resource fixture. No accounts, rewards, storage or remote requests.
import * as THREE from '../lib/three.module.js';
import {G} from '../src/core/state.js';
import {scene,cam,camera,renderer,updateCam} from '../src/render/scene.js';
import {ETYPES,ROSTERS} from '../src/data/monsters.js';
import {makeEndgameEnemy} from '../src/render/endgame-monsters.js';
import {disposeObj} from '../src/render/toon.js';
import {spawnEnemy,removeEnemy} from '../src/monsters/enemy.js';
import {endgameTick,updateEndgame,clearEndgame,endgameEffects} from '../src/monsters/endgame.js';
const guard=()=>{if(location.hostname!=='127.0.0.1'||!window.__isolatedReview?.memoryOnly)throw Error('Isolated local fixture only');};
let preview=[],labels=[],hidden=[];
export function clearPreview(){for(const m of preview){m.g.removeFromParent();disposeObj(m.g);m.mats.forEach(x=>x.dispose());}preview=[];labels.forEach(x=>x.remove());labels=[];for(const [o,v]of hidden)o.visible=v;hidden=[];}
export function lineup(ch=9){guard();clearPreview();G.manual=true;G.pauseRender=false;const types=[...ROSTERS[ch].pool.map(x=>x[0]),ROSTERS[ch].miniboss,ROSTERS[ch].boss];
 for(const o of scene.children){if(!o.isLight&&!o.isCamera){hidden.push([o,o.visible]);o.visible=false;}}
 document.querySelector('#hud').style.display='none';cam.theta=0;cam.phi=1.06;cam.r=27;cam.target.set(0,1.5,0);updateCam();camera.updateMatrixWorld(true);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,40),new THREE.MeshStandardMaterial({color:ch===9?0x343044:0x3c3030,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.05;floor.receiveShadow=true;scene.add(floor);preview.push({g:floor,mats:[floor.material]});
 types.forEach((type,i)=>{const m=makeEndgameEnemy(ETYPES[type]);m.g.position.set(i<4?(i-1.5)*4.5:(i-5)*6,0,i<4?3.5:-4);m.g.rotation.y=.15;scene.add(m.g);preview.push(m);
  const p=new THREE.Vector3(m.g.position.x,.1,m.g.position.z+1.5).project(camera),label=document.createElement('div');Object.assign(label.style,{position:'fixed',left:((p.x+1)/2*innerWidth)+'px',top:((1-p.y)/2*innerHeight)+'px',transform:'translateX(-50%)',background:'#101827dc',color:'white',padding:'5px 8px',font:'13px system-ui',borderRadius:'6px',zIndex:100});label.textContent=ETYPES[type].n;document.body.append(label);labels.push(label);m.anim({g:m.g,E:ETYPES[type],flash:0},.016);});
 renderer.render(scene,camera);return {chapter:ch,types,resource:renderer.info.memory};
}
const metrics=()=>{let objects=0;scene.traverse(()=>objects++);return{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,objects,effects:endgameEffects(),enemies:G.enemies.length};};
export function resourceCycle(n=20){guard();G.manual=true;clearPreview();const run=()=>{
  const all=Object.entries(ETYPES).filter(([,E])=>E.proc==='endgame');for(let i=0;i<all.length;i++){const [type]=all[i];const e=spawnEnemy(type,1,{x:(i%5-2)*3,z:(Math.floor(i/5)-1)*3,tile:[12,8]});e.state='move';e.endCd=0;}for(const e of [...G.enemies])if(e.E.endgame){endgameTick(e,.1);if(e.endCast)endgameTick(e,e.endCast.t+.01);}
  renderer.render(scene,camera);for(const e of [...G.enemies])removeEnemy(e);clearEndgame();updateEndgame(1);renderer.render(scene,camera);
 };for(let i=0;i<3;i++)run();const before=metrics();for(let i=0;i<n;i++)run();return{warmup:3,cycles:n,before,after:metrics()};
}
