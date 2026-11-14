// Local isolated renderer probe; it never calls account or reward APIs.
import * as THREE from '/lib/three.module.js';import {G} from '/src/core/state.js';
import {renderer,scene,camera} from '/src/render/scene.js';import {hardTick} from '/src/monsters/hard.js';
import {hardEnemy} from '/src/data/hard.js';import {ETYPES} from '/src/data/monsters.js';
import {makeArrow,updProjs} from '/src/combat/projectiles.js';import {P,PB,updFx,updParticles,updDebris} from '/src/render/vfx.js';
const render=()=>renderer.render(scene,camera);
const sample=()=>({geometry:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,programRefs:renderer.info.programs.reduce((n,p)=>n+p.usedTimes,0),sceneObjects:(()=>{let n=0;scene.traverse(()=>n++);return n;})(),projs:G.projs.length,fxs:G.fxs.length,timers:G.timers.length});
export function run(n=20){
 if(location.hostname!=='127.0.0.1'||location.port!=='8854'||!window.__isolatedReview?.memoryOnly)throw Error('RAM QA required');
 G.manual=true;G.pauseRender=true;if(G.projs.length||G.phase==='wave')throw Error('completed battle required');
 const original=G.enemies;G.enemies=[];
 const cycle=()=>{const e={g:new THREE.Group(),E:hardEnemy(ETYPES.grunt,true,false,0),hardCd:0};e.g.position.copy(G.hero.g.position);hardTick(e,.01);render();e.stunT=1;hardTick(e,.01);updFx(2);
 const m=makeArrow(0xffdd88);m.position.copy(G.hero.g.position);scene.add(m);G.projs.push({kind:'pierce',m,dir:new THREE.Vector3(1,0,0),left:4,spd:32,hit:new Set(),maxHits:2,ap:false,air:true,dmg:1});render();updProjs(.5);updFx(2);updParticles(P,2);updParticles(PB,2);updDebris(2);render();};
 try{cycle();const before=sample(),rows=[];for(let i=0;i<n;i++){cycle();rows.push(sample());}return {n,before,after:sample(),rows,conditions:'one warm-up; actual renderer; no GC; actual hard warning cancellation and shared piercing projectile cleanup'};}finally{G.enemies=original;}
}
