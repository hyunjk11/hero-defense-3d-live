import * as THREE from '/lib/three.module.js';import {G} from '/src/core/state.js';import {renderer,scene,camera} from '/src/render/scene.js';import {hardTick} from '/src/monsters/hard.js';import {hardEnemy} from '/src/data/hard.js';import {ETYPES} from '/src/data/monsters.js';
const sample=()=>({geometry:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,programRefs:renderer.info.programs.reduce((n,p)=>n+p.usedTimes,0),sceneObjects:(()=>{let n=0;scene.traverse(()=>n++);return n;})(),projs:G.projs.length,fxs:G.fxs.length,timers:G.timers.length,legendFx:G.lfx?.length});
export function run(n=30){
 if(location.hostname!=='127.0.0.1'||location.port!=='8854'||!window.__isolatedReview?.memoryOnly||G.phase!=='build'||!['ruin-ring','spore-cross'].includes(G.stage.rule))throw Error('isolated upper hard build stage required');
 G.manual=true;G.pauseRender=true;G.setAutoSkill(false,false);G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();
 const cycle=()=>{const e={g:new THREE.Group(),E:hardEnemy(ETYPES.grunt,true,false,0),hardCd:0};e.g.position.copy(G.hero.g.position);hardTick(e,.01);renderer.render(scene,camera);e.stunT=1;hardTick(e,.01);
 G.hero.lcd=0;const p=G.hero.g.position;G.castLegend(new THREE.Vector3(p.x-5,0,p.z));renderer.render(scene,camera);for(let i=0;i<200;i++)G.sim(.05);renderer.render(scene,camera);};
 cycle();const before=sample(),rows=[];for(let i=0;i<n;i++){cycle();rows.push(sample());}return{conditions:'RAM fixture; real WebGL renderer; one warmup then 30 current-rule warning+actual mage E cycles; no forced GC; E cooldown reset only to isolate cleanup; no combat/reward success claim',before,after:sample(),rows};
}
