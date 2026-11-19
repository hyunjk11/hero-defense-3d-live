import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture} from './support/advance-e-runtime.mjs';
import {LSK,legendOf} from '../src/account/equip.js';
import {HERO_E} from '../src/data/hero-e.js';
import {createWeaponFeed} from '../src/ui/weapon-proc-feed.js';
const heroSetup=(cls,key)=>{
  const f=fixture(cls,null,1), it={id:'fixture_weapon',s:'weapon',g:4,h:cls,u:key};
  f.hero.lsk=legendOf({eq:{[cls]:{weapon:it.id}},inv:[it]},cls); f.hero.C.nm='테스트';
  return f;
};
for(const [key,s] of Object.entries(LSK).filter(([key])=>key!=='ricochet')){
  test(key+': equipped below Lv.10, single named activation independent of sound, no cooldown duplicate',()=>{
    const f=heroSetup(s.h,key),t=f.target();f.env.Snd.skill=undefined;
    f.api.legendProc(t); f.api.legendProc(t);
    assert.equal(f.rows.length,1);assert.equal(f.rows[0].textContent,s.n+'!');
    assert.equal(f.hero.licd,s.icd);assert.equal(f.G.legendN[key],1);
  });
}
test('failed roll, dead target, no equipped proc, and manual innate E do not announce a weapon',()=>{
 const f=heroSetup('archer','pierce'),t=f.target();
 f.G.legendForce=false; f.env.G.legendSeed(42);vm.runInContext('lrNext=()=>.99',f.env); f.api.legendProc(t);
 t.dead=true;f.G.legendForce=true;f.api.legendProc(t);
 t.dead=false;f.hero.lsk=null;f.api.legendProc(t);
 f.hero.C.level=10;assert.equal(f.api.castLegend(new f.THREE.Vector3(0,0,3)),true);
 assert.equal(f.rows.length,0);assert.equal(f.hero.licd,0);
});
test('ricochet announces the first actual bounce, not its roll, individual hits or an isolated target',()=>{
 const f=heroSetup('gunner','ricochet'),t=f.target();f.G.gunN={ricochet:0};
 const src=fs.readFileSync(new URL('../src/heroes/gunner.js',import.meta.url),'utf8');
 Object.assign(f.env,{tracer:()=>{},hurt:f.env.hurt0});
 f.env.ricochet=vm.runInContext('let lsk=false;('+src.slice(src.indexOf('export function ricochet')+7,src.indexOf('// 장미 탄막 (active)')).trim()+')', f.env);
 f.api.legendProc(t); f.tick(.1);assert.equal(f.rows.length,0);assert.equal(f.hits.length,0);
 f.target(1,2);f.target(2,2);f.hero.licd=0;f.api.legendProc(t);
 assert.equal(f.rows.length,0);f.tick(.3);
 assert.equal(f.hits.length,2);assert.equal(f.rows.length,1);assert.equal(f.rows[0].textContent,'도탄 난사!');
});
test('existing E title always wins; two heroes take turns without stacking or stale map announcements',()=>{
 const feed=createWeaponFeed(),els=[];let busy=false;
 const root={appendChild:e=>els.push(e),ownerDocument:{getElementById:()=>({classList:{contains:()=>busy}}),createElement:()=>({remove(){els.splice(els.indexOf(this),1);}})}};
 const heroes=[{},{}],g={phase:'wave',hero:heroes[0],heroes,tiles:[]};
 const proc=(h,s,t)=>feed.record(root,g,heroes[h],LSK[s],t);
 busy=true;proc(0,'ricochet',0);proc(1,'frostorb',10);assert.equal(els.length,0);
 busy=false;feed.refresh(g,850);assert.deepEqual(els.map(e=>e.textContent),['도탄 난사!']);
 proc(0,'ricochet',900);feed.refresh(g,1750);assert.deepEqual(els.map(e=>e.textContent),['프로즌 오브!']);
 busy=true;feed.refresh(g,1800);assert.equal(els.length,0);
 busy=false;feed.refresh(g,2400);assert.deepEqual(els.map(e=>e.textContent),['프로즌 오브!']);
 g.tiles=[];feed.refresh(g,2410);assert.equal(els.length,0);busy=true;proc(0,'ricochet',2500);
 busy=false;feed.refresh(g,5100);assert.equal(els.length,0);
});
test('equipped weapon and battle proc use the original skill name without inheriting active mechanics',()=>{
 for(const [key,active] of Object.entries(HERO_E)){
  const f=heroSetup(active.h,key),proc=LSK[f.hero.lsk];assert.equal(proc.n,active.n);assert.equal(proc.type,'proc');assert.equal(proc.cd,undefined);
  f.api.legendProc(f.target());assert.equal(f.rows[0].textContent,active.n+'!');
 }
});

test('title styles share the banner slot, with immediate priority and no lingering 300ms fade',()=>{
 const css=fs.readFileSync(new URL('../style.css',import.meta.url),'utf8');
 assert.match(css,/#banner,#weaponProcFeed\{position:absolute/);
 assert.match(css,/#banner\.show~#weaponProcFeed\{display:none\}/);
 assert.match(css,/#banner:not\(\.show\):has\(~ #weaponProcFeed:not\(:empty\)\)\{transition:none\}/);
});
