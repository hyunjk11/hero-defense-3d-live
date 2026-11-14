// Local RAM-backed QA only. Controlled enemies/RNG, not a campaign clear.
import { G } from '../src/core/state.js';
import * as F from '../src/heroes/fighter.js';
import * as L from '../src/heroes/legend.js';
import * as R from '../src/render/scene.js';
const assert=(v,msg)=>{if(!v)throw Error(msg);};
const near=(a,b)=>assert(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function sample(){let objects=0;G.scene.traverse(()=>objects++);return {geometry:G.renderer.info.memory.geometries,textures:G.renderer.info.memory.textures,programs:G.renderer.info.programs.length,programRefs:G.renderer.info.programs.reduce((n,p)=>n+p.usedTimes,0),objects,timers:G.timers.length,fxs:G.fxs.length,legendFx:G.lfx.length};}
function reset(){const h=G.hero;F.ftStop();h.cd=1e6;h.atkT=0;h.path=[];for(const e of G.enemies){e.dead=true;e.dying=0;}G.sim(3);h.face=0;h.g.rotation.y=0;h.licd=0;h.ft.n=0;h.ft.fin=false;h.ft.dealt=0;return h;}
function target(distance,type='grunt'){const p=G.hero.g.position,e=G.spawnEnemy(type,1,{x:p.x,z:p.z+distance,tile:G.toTile(p.x,p.z+distance)});e.g.position.set(p.x,0,p.z+distance);e.hp=e.max=100000;e.spdK=1e-9;e.spawnT=0;e.next=null;return e;}
function clearStrip(){let spot=null;outer:for(let c=3;c<G.GW-3;c++)for(let r=3;r<G.GH-7;r++){let ok=true;for(let a=-1;a<=1;a++)for(let b=-1;b<=5;b++){const t=G.tileAt(c+a,r+b);if(!t||[G.T.BEDROCK,G.T.CORE,G.T.SPAWN].includes(t.t)||t.tower||t.bar)ok=false;}if(ok){spot=[c,r];break outer;}}
 assert(spot,'no isolated strip');const[c,r]=spot;for(let a=-1;a<=1;a++)for(let b=-1;b<=5;b++){const t=G.tileAt(c+a,r+b);if(![G.T.GRASS,G.T.CARVED].includes(t.t))G.carve(t);}const[x,z]=G.tileXZ(c,r);G.hero.g.position.set(x,-.5,z);G.hero.stuckT=0;return spot;}
export async function setup(){await G.choose('fighter');G.manual=true;G.screen='run';document.querySelectorAll('[id^=scr_]').forEach(e=>e.classList.add('hidden'));const h=G.hero;h.lsk='pawstorm';G.legendForce=true;h.C.armor=1;h.path=[];h.cd=1e6;G.sim(.2);clearStrip();return {hero:h.cls,attack:h.C.dmg,range:G.heroStat.range()};}
export function run(){const result={kind:'real engine, controlled local targets and forced RNG; not normal campaign completion',cases:[]};
 let h=reset(),e=target(6),n=G.ftN.paw,j=G.ftN.jpFull;h.cd=h.atkT=0;G.sim(2.5);const loss=100000-e.hp;near(loss,26*(2.5+2.7));assert(G.ftN.paw-n===1,'ranged proc');result.cases.push({name:'normal ranged attack',distance:6,paw:G.ftN.paw-n,jpFull:G.ftN.jpFull-j,loss});
 h=reset();e=target(2);h.cd=h.atkT=0;n=G.ftN.paw;F.fighterTick(.01,e,false);e.g.position.z=h.g.position.z+8;G.sim(.4);near(100000-e.hp,0);assert(G.ftN.paw===n&&h.licd===0,'escaped melee consumed proc');result.cases.push({name:'escaped melee swing',paw:G.ftN.paw-n,loss:100000-e.hp,licd:h.licd});
 for(const [mode,type,d] of [['melee','grunt',2],['ranged','bat',6]]){h=reset();e=target(d,type);n=G.ftN.paw;L.legendProc(e,{mode});G.sim(1.2);near(100000-e.hp,26*2.7);result.cases.push({name:mode+' '+type,paw:G.ftN.paw-n,loss:100000-e.hp});}
 h=reset();e=target(8);const cycle=()=>{h.licd=0;L.legendProc(e,{mode:'ranged'});G.sim(.2);G.renderer.render(G.scene,R.camera);G.sim(2);G.renderer.render(G.scene,R.camera);};for(let i=0;i<3;i++)cycle();const before=sample(),samples=[];for(let i=0;i<20;i++){cycle();if((i+1)%5===0)samples.push({cycle:i+1,...sample()});}const after=sample();assert(JSON.stringify(before)===JSON.stringify(after),'resource counts did not settle');result.memory={warmup:3,repeats:20,before,samples,after};result.errors=window.__isolatedReview.errors;assert(!result.errors.length,'browser errors');window.__pawResult=result;return result;
}
export function visual(mode='ranged'){const h=reset(),e=target(mode==='ranged'?8.5:2);h.licd=0;R.cam.target.copy(h.g.position).add(new G.THREE.Vector3(0,1.2,mode==='ranged'?4:1));R.cam.r=mode==='ranged'?13:9;R.cam.theta=1.2;R.cam.phi=.8;R.updateCam();L.legendProc(e,{mode});G.sim(.3);G.renderer.render(G.scene,R.camera);return {mode,paw:G.ftN.paw};}
