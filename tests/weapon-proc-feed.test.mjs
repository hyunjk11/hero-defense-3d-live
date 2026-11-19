import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture} from './support/advance-e-runtime.mjs';
import {LSK,legendOf} from '../src/account/equip.js';
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
    assert.equal(f.rows.length,1);assert.equal(f.rows[0].textContent,'테스트 · 무기 발동: '+s.n);
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
 assert.equal(f.hits.length,2);assert.equal(f.rows.length,1);assert.equal(f.rows[0].textContent,'테스트 · 무기 발동: 도탄 난사');
});
test('party owners remain distinct; repeated procs coalesce; timed, map and roster cleanup require no timers',()=>{
 const feed=createWeaponFeed(), els=[], root={appendChild:e=>els.push(e),ownerDocument:{createElement:()=>({remove(){els.splice(els.indexOf(this),1);}})}};
 const heroes=['루나','로즈','세라'].map(nm=>({C:{nm}})),g={phase:'wave',hero:heroes[0],heroes,tiles:[]};
 const record=(h,s,t)=>feed.record(root,g,heroes[h],LSK[s],t);
 record(0,'frostorb',10);record(1,'rosebarrage',20);record(1,'rosebarrage',1000);
 assert.deepEqual(els.map(e=>e.textContent),['루나 · 무기 발동: 프로즌 오브','로즈 · 무기 발동: 장미 쐐기 ×2']);
 record(2,'quake',1100);assert.equal(els.length,2);g.hero=heroes[1];feed.refresh(g,3201);
 assert.deepEqual(els.map(e=>e.textContent),['세라 · 무기 발동: 검기 파열']);
 g.tiles=[];feed.refresh(g,3210);assert.equal(els.length,0);
 record(1,'ricochet',4000);g.heroes=[];g.hero=null;feed.refresh(g,4001);assert.equal(els.length,0);
});
