// Local RAM-only product-engine probe. Never imported by the production entrypoint.
import {G} from '../src/core/state.js';
import {hero,stat} from '../src/heroes/hero.js';
import {castLegend,updLegend,legendActive} from '../src/heroes/legend.js';
import {spawnEnemy,removeEnemy} from '../src/monsters/enemy.js';
import {renderer,scene,cam,updateCam,composer} from '../src/render/scene.js';
import {groundY} from '../src/monsters/ai.js';
import {refreshHud} from '../src/ui/hud.js';
const guard=()=>{if(location.hostname!=='127.0.0.1'||location.port!=='8981'||!window.__isolatedReview?.memoryOnly)throw Error('isolated cat QA only');};
let targets=[],trace=[],start=0,previous=[];
export function snapshot(){guard();let cat=null,objects=0;scene.traverse(o=>{objects++;if(o.name==='cat-spirit')cat=o;});return {t:G.t-start,cat:cat?{x:cat.position.x,y:cat.position.y,z:cat.position.z,angle:cat.rotation.y,scale:cat.scale.x,claw:cat.userData.cat.clawMat.opacity}:null,loss:targets.map(e=>100000-e.hp),lcd:hero.lcd,fx:G.lfx.length,geometry:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,objects,drawCalls:renderer.info.render.calls,errors:[...window.__isolatedReview.errors]};}
export function finish(){guard();for(let i=0;i<500;i++){G.t+=.01;updLegend(.01);}for(const e of targets)if(G.enemies.includes(e))removeEnemy(e);targets=[];G.sim(3,.05);composer.render();return snapshot();}
export function setup({kind='line',mods={}}={}){guard();G.manual=true;finish();if(G.enemies.length)throw Error('unrelated active enemies');
 hero.g.position.set(-6,groundY(-6,-4),-4);hero.face=0;hero.path=[];hero.atkT=0;hero.eCastT=0;hero.lcd=0;hero.treeMods=mods;
 cam.target.set(-6,0,1);cam.r=38;cam.theta=.22;cam.phi=.9;updateCam();
 const layout=kind==='curve'?[[2,5],[3,9],[4,12]]:kind==='empty'?[]:[[0,4],[0,8],[0,12],[0,15]];
 for(const [i,[x,z]] of layout.entries()){const e=spawnEnemy(kind==='air'?'bat':kind==='boss'?'boss':'grunt',1,{x:-6+x,z:-4+z,tile:G.toTile(-6+x,-4+z)});e.hp=e.max=100000;e.armor=.2;e.g.position.y=groundY(e.g.position.x,e.g.position.z);targets.push(e);}
 trace=[];start=G.t;previous=targets.map(e=>e.hp);refreshHud();return {mode:'injected RAM stationary product-engine fixture',kind,mods,hero:hero.cls,branch:hero.adv.k,level:hero.C.level,damage:stat.dmg(),skill:stat.skillMul(),spec:legendActive(),snapshot:snapshot()};
}
export function cast(){guard();const ok=castLegend(new G.THREE.Vector3(-6,0,14));refreshHud();return {ok,...snapshot()};}
export function advance(seconds,dt=.01){guard();for(let i=0;i<Math.round(seconds/dt);i++){G.t+=dt;updLegend(dt);const s=snapshot();const hit=targets.map((e,j)=>{const d=previous[j]-e.hp;previous[j]=e.hp;return d;});trace.push({...s,hit});}composer.render();return snapshot();}
export function result(){guard();return {url:location.href,viewport:[innerWidth,innerHeight],camera:{r:cam.r,theta:cam.theta,phi:cam.phi},trace,snapshot:snapshot()};}
export async function repeated(n=40){guard();setup({kind:'empty'});cast();advance(2);finish();const before=snapshot(),times=[];let maxCats=0;
 for(let i=0;i<n;i++){const t=performance.now();hero.lcd=0;hero.eCastT=0;castLegend(new G.THREE.Vector3(-6,0,14));for(let j=0;j<200;j++){G.t+=.01;updLegend(.01);if(j===30){let cats=0;scene.traverse(o=>{if(o.name==='cat-spirit')cats++;});maxCats=Math.max(maxCats,cats);composer.render();}}composer.render();times.push(performance.now()-t);if(G.lfx.length)throw Error('retained effect');await new Promise(requestAnimationFrame);}
 const after=snapshot();times.sort((a,b)=>a-b);return {n,before,after,maxCats,wallMs:{median:times[Math.floor(n/2)],min:times[0],max:times[n-1]},note:'200 effect steps and two renders per cast; not whole-game FPS'};
}
